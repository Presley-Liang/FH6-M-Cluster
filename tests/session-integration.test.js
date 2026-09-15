import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import dgram from 'node:dgram';
import { setTimeout as delay } from 'node:timers/promises';

async function launch(t, cwd) {
  cwd ||= await mkdtemp(resolve(tmpdir(), 'fh6-session-test-'));
  const probe = net.createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, [resolve('src/index.js')], {
    cwd, env: { ...process.env, PORT: '0', HTTP_PORT: String(port), SESSION_CLOSE_GRACE_MS: '150' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  const udpPort = await new Promise((yes, no) => {
    let output = '';
    const timeout = setTimeout(() => no(Error('Startup timeout: ' + output)), 5000);
    child.on('error', no);
    child.stdout.on('data', chunk => {
      output += chunk;
      const udp = output.match(/\[udp\] listening on [^\n]*:(\d+)/);
      if (udp && output.match(/http:\/\/[^:\s]+:\d+/)) { clearTimeout(timeout); yes(Number(udp[1])); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
  });
  const socket = dgram.createSocket('udp4');
  t.after(() => socket.close());
  const url = 'http://127.0.0.1:' + port;
  async function api(path, body) {
    const response = await fetch(url + path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, path);
    return response.json();
  }
  async function send({ race = true, time = 10, car = 1234, timestamp = 1000 } = {}) {
    const packet = Buffer.alloc(324); // Synthetic protocol fixture, not a game capture.
    packet.writeInt32LE(Number(race), 0); packet.writeUInt32LE(timestamp, 4);
    packet.writeFloatLE(8000, 8); packet.writeFloatLE(4000, 16);
    packet.writeInt32LE(car, 212); packet.writeInt32LE(5, 216); packet.writeInt32LE(900, 220);
    packet.writeFloatLE(100, 244); packet.writeFloatLE(200, 252);
    packet.writeFloatLE(20, 256); packet.writeFloatLE(time, 304); packet.writeFloatLE(time, 308);
    packet[314] = race ? 1 : 0;
    const before = (await api('/debug')).packetsTotal;
    await new Promise((yes, no) => socket.send(packet, udpPort, '127.0.0.1', e => e ? no(e) : yes()));
    await until(async () => (await api('/debug')).packetsTotal > before);
  }
  async function stop() {
    if (child.exitCode !== null) return;
    const ended = new Promise(r => child.once('exit', r));
    child.kill(); await ended;
  }
  return { cwd, url, api, send, stop };
}

async function until(predicate, timeout = 3000) {
  const end = Date.now() + timeout;
  do { if (await predicate()) return; await delay(15); } while (Date.now() < end);
  assert.fail('Timed out waiting for observable server state');
}

test('P2: short manual recording Stop persists without another UDP packet; exports and restart preserve it', { timeout: 15000 }, async t => {
  const app = await launch(t);
  await app.api('/mode', { driveMode: 'freeRoam' });
  await app.api('/free-roam-recording', { recording: true });
  await app.send({ race: false, time: 0 });
  await app.send({ race: false, time: 0, timestamp: 1017 });
  await app.api('/free-roam-recording', { recording: false });
  assert.equal((await app.api('/status')).sessionActive, false);
  const list = await app.api('/sessions');
  assert.equal(list.length, 1); assert.equal(list[0].packetCount, 2);
  const saved = await app.api('/session?id=' + list[0].id);
  assert.equal(saved.packets.length, 2);
  assert.equal((await app.api('/export')).id, saved.id);
  assert.equal((await app.api('/export-compact')).id, saved.id);
  const original = await readFile(resolve(app.cwd, 'sessions', list[0].filename), 'utf8');
  await app.stop();
  const restarted = await launch(t, app.cwd);
  await restarted.api('/mode', { driveMode: 'freeRoam' });
  await restarted.api('/free-roam-recording', { recording: true });
  await restarted.send({ race: false, time: 0 });
  await restarted.api('/free-roam-recording', { recording: false });
  const after = await restarted.api('/sessions');
  assert.equal(after.length, 2); assert.equal(new Set(after.map(s => s.id)).size, 2);
  assert.equal(await readFile(resolve(app.cwd, 'sessions', list[0].filename), 'utf8'), original);
});

test('P2: mode switch closes manual recording immediately and does not reopen it on returning', { timeout: 10000 }, async t => {
  const app = await launch(t);
  await app.api('/mode', { driveMode: 'freeRoam' });
  await app.api('/free-roam-recording', { recording: true });
  await app.send({ race: false, time: 0 });
  const switched = await app.api('/mode', { driveMode: 'race' });
  assert.equal(switched.freeRoamRecording, false);
  assert.equal((await app.api('/status')).sessionActive, false);
  assert.equal((await app.api('/sessions')).length, 1);
  await app.api('/mode', { driveMode: 'freeRoam' });
  await app.send({ race: false, time: 0 });
  assert.equal((await app.api('/status')).sessionActive, false);
});

test('P2: Race first packet belongs to session, pause/rewind preserve identity and car change splits it', { timeout: 10000 }, async t => {
  const app = await launch(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const events = await fetch(app.url + '/events', { signal: controller.signal });
  const reader = events.body.getReader();
  await app.send({ time: 50 });
  const initial = await app.api('/status');
  assert.equal(initial.sessionActive, true); assert.equal(initial.packetsRecorded, 1);
  let received = '', telemetry;
  while (!telemetry) {
    const chunk = await reader.read();
    assert.equal(chunk.done, false);
    received += new TextDecoder().decode(chunk.value);
    let boundary;
    while ((boundary = received.indexOf('\n\n')) >= 0) {
      const event = received.slice(0, boundary);
      received = received.slice(boundary + 2);
      const line = event.match(/^data: (.*)$/m);
      if (line) {
        const data = JSON.parse(line[1]);
        if (typeof data.speedKmh === 'number') { telemetry = data; break; }
      }
    }
  }
  assert.equal(telemetry.sessionId, initial.sessionId);
  controller.abort();
  const first = await app.api('/export');
  assert.equal(first.packets[0].sessionId, initial.sessionId);
  await app.send({ race: false, time: 50, timestamp: 1017 });
  await app.send({ time: 40, timestamp: 1034 });
  assert.equal((await app.api('/status')).sessionId, initial.sessionId);
  await app.send({ time: 41, car: 4567, timestamp: 1051 });
  await new Promise(resolve => setTimeout(resolve, 55));
  await app.send({ time: 42, car: 4567, timestamp: 1068 });
  await new Promise(resolve => setTimeout(resolve, 55));
  await app.send({ time: 43, car: 4567, timestamp: 1085 });
  await new Promise(resolve => setTimeout(resolve, 55));
  await app.send({ time: 44, car: 4567, timestamp: 1102 });
  const changed = await app.api('/status');
  assert.notEqual(changed.sessionId, initial.sessionId);
  assert.equal((await app.api('/export')).carOrdinal, 4567);
  await app.api('/mode', { driveMode: 'freeRoam' });
  const list = await app.api('/sessions');
  assert.equal(list.length, 2);
  const old = await app.api('/session?id=' + initial.sessionId);
  assert.equal(old.packets[0].carOrdinal, 1234);
  assert.ok(old.packets.some(packet => packet.carOrdinal === 4567), 'candidate evidence remains in raw arrival history until change is confirmed');
});

test('P2: Race end grace uses wall time and saves even when UDP stops afterwards', { timeout: 10000 }, async t => {
  const app = await launch(t);
  await app.send({ time: 30 });
  const { sessionId } = await app.api('/status');
  await app.send({ race: false, time: 30, timestamp: 1017 });
  await until(async () => !(await app.api('/status')).sessionActive);
  await until(async () => (await app.api('/sessions')).length === 1);
  assert.equal((await app.api('/session?id=' + sessionId)).id, sessionId);
});

test('P2: concurrent mode requests are acknowledged with monotonic state and archive only the original session', { timeout: 10000 }, async t => {
  const app = await launch(t);
  await app.send({ time: 30 });
  const id = (await app.api('/status')).sessionId;
  const replies = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    app.api('/mode', { driveMode: index % 2 ? 'race' : 'freeRoam' })));
  const latest = replies.reduce((a, b) => a.version > b.version ? a : b);
  const state = await app.api('/mode');
  assert.ok(state.version >= latest.version);
  assert.equal(state.driveMode, latest.driveMode);
  assert.equal(state.freeRoamRecording, false);
  assert.equal(state.sessionActive, false);
  const archives = await app.api('/sessions');
  assert.equal(archives.length, 1); assert.equal(archives[0].id, id);
});

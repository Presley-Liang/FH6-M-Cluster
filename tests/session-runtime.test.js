import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionStore } from '../src/session/store.js';
import { SessionRuntime, effectiveTimeline } from '../src/session/runtime.js';
import { EventDetector } from '../src/session/event-detector.js';

async function setup(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-runtime-test-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store);
  t.after(() => runtime.shutdown());
  return { store, runtime };
}

function packet(overrides = {}) {
  return { isRaceOn: 1, racePosition: 1, currentLap: 5, currentRaceTime: 5,
    timestampMs: 1000, carOrdinal: 1234, carClass: 5, carPi: 900,
    positionX: 10, positionZ: 20, lapNumber: 0, lastLap: 0, ...overrides };
}

function holdFinalize(store) {
  const finalize = store.finalize.bind(store);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  store.finalize = async meta => { await gate; return finalize(meta); };
  return release;
}

test('P2: UDP during manual Stop saving cannot reopen recording or leak packets into its archive', async t => {
  const { store, runtime } = await setup(t);
  await runtime.setMode('freeRoam'); await runtime.setRecording(true);
  runtime.process(packet());
  const id = runtime.active.id;
  const release = holdFinalize(store);
  t.after(release);
  const stopping = runtime.setRecording(false);
  assert.equal(runtime.state().sessionState, 'saving');
  for (let i = 0; i < 100; i++) {
    assert.equal(runtime.process(packet({ timestampMs: 1017 + i })).sessionId, null);
  }
  assert.equal(runtime.active, null);
  release(); await stopping;
  assert.equal((await store.read(id)).packets.length, 1);
  assert.equal(runtime.freeRoamRecording, false);
});

test('P2: mode takes effect while prior session saves and incoming UDP remains in the correct mode', async t => {
  const { store, runtime } = await setup(t);
  runtime.process(packet());
  const raceId = runtime.active.id;
  const release = holdFinalize(store);
  t.after(release);
  const switching = runtime.setMode('freeRoam');
  assert.equal(runtime.driveMode, 'freeRoam');
  runtime.process(packet({ timestampMs: 1017 }));
  assert.equal(runtime.active, null);
  release(); await switching;
  assert.equal((await store.read(raceId)).packets.length, 1);
  await runtime.setMode('race');
  const next = runtime.process(packet({ timestampMs: 1034 }));
  assert.notEqual(next.sessionId, raceId);
  assert.equal(runtime.active.driveMode, 'race');
});

test('AUTO: confirmed game activity switches Free Roam and Race without mode flapping', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-runtime-auto-test-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store, {
    autoDriveMode: true,
    eventDetector: new EventDetector({ enterMs: 100, exitMs: 300, staleMs: 1000 }),
  });
  t.after(() => runtime.shutdown());

  let result = runtime.process(packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 0 }), 0);
  assert.equal(result.driveMode, 'freeRoam');
  assert.equal(runtime.state().modeSource, 'auto');

  runtime.process(packet({ racePosition: 2, currentLap: 1, currentRaceTime: 1 }), 100);
  result = runtime.process(packet({ racePosition: 2, currentLap: 1.2, currentRaceTime: 1.2 }), 200);
  assert.equal(result.driveMode, 'race');
  assert.ok(result.sessionId);

  runtime.process(packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 0, positionX: 11, distanceTraveled: 1 }), 300);
  result = runtime.process(packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 0, positionX: 12, distanceTraveled: 2 }), 599);
  assert.equal(result.driveMode, 'race');
  result = runtime.process(packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 0, positionX: 13, distanceTraveled: 3 }), 600);
  assert.equal(result.driveMode, 'freeRoam');
  assert.equal(runtime.freeRoamRecording, false);
});

test('AUTO: settled activity repairs a drive-mode mismatch without requiring a new detector event', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-runtime-auto-reconcile-test-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store, {
    autoDriveMode: true,
    eventDetector: new EventDetector({ enterMs: 100, exitMs: 300, staleMs: 1000 }),
  });
  t.after(() => runtime.shutdown());

  const roaming = packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 0 });
  let result = runtime.process(roaming, 0);
  assert.equal(result.driveMode, 'freeRoam');
  const settledVersion = result.eventVersion;

  await runtime.setMode('race');
  assert.equal(runtime.state().driveMode, 'race');
  assert.equal(runtime.state().eventVersion, settledVersion);

  result = runtime.process({ ...roaming, positionX: 11 }, 17);
  assert.equal(result.eventVersion, settledVersion);
  assert.equal(result.driveMode, 'freeRoam');
  assert.equal(runtime.state().modeSource, 'auto');
});

test('AUTO: a startup race packet stays Race while entry confirmation is pending', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-runtime-auto-race-test-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store, {
    autoDriveMode: true,
    eventDetector: new EventDetector({ enterMs: 500, exitMs: 1200 }),
  });
  t.after(() => runtime.shutdown());

  const result = runtime.process(packet({ racePosition: 2, currentLap: 1, currentRaceTime: 1 }), 0);
  assert.equal(result.driveMode, 'race');
  assert.ok(result.sessionId);
  assert.equal(result.pendingActivity, 'race');
});

test('AUTO: a one-frame race evidence dropout does not inherit startup Free Roam', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-runtime-auto-dropout-test-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store, {
    autoDriveMode: true,
    eventDetector: new EventDetector({ enterMs: 500, exitMs: 1200 }),
  });
  t.after(() => runtime.shutdown());

  const first = runtime.process(packet({ currentRaceTime: 50 }), 0);
  runtime.process(packet({ isRaceOn: 0, racePosition: 0, currentLap: 0, currentRaceTime: 50 }), 17);
  const resumed = runtime.process(packet({ currentRaceTime: 40 }), 34);
  assert.equal(resumed.driveMode, 'race');
  assert.equal(resumed.sessionId, first.sessionId);
});

test('P8: runtime publishes fail-closed live route identity without coupling it to recording', async t => {
  const { runtime } = await setup(t);
  runtime.liveRouteIdentifier = {
    reset() {},
    update(value) {
      assert.equal(value.driveMode, 'race');
      assert.ok(value.sessionId);
      return { status: 'matched', reason: 'test', routeCatalogKey: 'route-a', routeName: 'ROUTE A', confidence: { score: 0.98 }, matchedForSession: true };
    },
  };
  runtime.resolveRoute = key => key === 'route-a' ? { id: 77 } : null;
  const result = runtime.process(packet());
  assert.deepEqual(result.activeRoute, { status: 'matched', reason: 'test', routeId: 77, routeCatalogKey: 'route-a', name: 'ROUTE A', confidence: 0.98, version: 1 });
  assert.deepEqual(runtime.state().activeRoute, result.activeRoute);
});

test('P2: rewind revokes completed lap and best time while preserving raw arrival packets', async t => {
  const { store, runtime } = await setup(t);
  runtime.process(packet({ currentRaceTime: 59, currentLap: 59 }));
  runtime.process(packet({ currentRaceTime: 60, currentLap: 0.1, lapNumber: 1, lastLap: 60, timestampMs: 1017 }));
  assert.equal(runtime.active.laps.length, 1);
  assert.equal(runtime.active.bestLap, 60);
  runtime.process(packet({ currentRaceTime: 55, currentLap: 55, lapNumber: 0, timestampMs: 1034 }));
  assert.equal(runtime.active.laps.length, 0);
  assert.equal(runtime.active.bestLap, -1);
  runtime.process(packet({ currentRaceTime: 62, currentLap: 0.1, lapNumber: 1, lastLap: 62, timestampMs: 1051 }));
  assert.equal(runtime.active.laps.length, 1);
  assert.equal(runtime.active.bestLap, 62);
  const id = runtime.active.id;
  await runtime.close('test-complete');
  const raw = await store.read(id);
  assert.deepEqual(raw.packets.map(p => p.currentRaceTime), [59, 60, 55, 62]);
  assert.equal(raw.packets[1].completedLap.lapTime, 60);
  assert.equal(raw.laps[0].lapTime, 62);
  assert.deepEqual(effectiveTimeline(raw.packets).map(p => p.currentRaceTime), [55, 62]);
});

test('P2: initial metadata write failure can recover through recording retry without losing accepted packet', async t => {
  const { store, runtime } = await setup(t);
  const atomic = store.atomic.bind(store);
  store.atomic = async () => { throw new Error('Injected initial metadata failure'); };
  runtime.process(packet());
  const id = runtime.active.id;
  await assert.rejects(store.entries.get(id).ready, /initial metadata failure/);
  await assert.rejects(runtime.close('storage-error'), /initial metadata failure/);
  assert.ok(runtime.state().failedSaves.includes(id));
  store.atomic = atomic;
  await runtime.retry();
  assert.deepEqual(runtime.state().failedSaves, []);
  assert.equal(runtime.state().storageError, null);
  assert.equal((await store.read(id)).packets.length, 1);
});

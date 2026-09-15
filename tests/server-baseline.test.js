import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import dgram from 'node:dgram';
import net from 'node:net';

test('P0: live HTTP UI, mode API and synthetic UDP → SSE', { timeout: 15000 }, async t => {
  const cwd = await mkdtemp(resolve(tmpdir(), 'fh6-p0-'));
  const probe=net.createServer();
  await new Promise(r=>probe.listen(0,'127.0.0.1',r));
  const httpPort=probe.address().port;
  await new Promise(r=>probe.close(r));
  const child = spawn(process.execPath, [resolve('src/index.js')], {
    cwd, env: { ...process.env, PORT: '0', HTTP_PORT: String(httpPort) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill());
  let output = '';
  const ready = new Promise((yes, no) => {
    const timeout = setTimeout(() => no(Error('Server startup timeout: '+output)), 5000);
    child.on('error', no);
    child.stdout.on('data', b => {
      output += b;
      const udp = output.match(/\[udp\] listening on [^\n]*:(\d+)/);
      const http = output.match(/http:\/\/[^:\s]+:(\d+)/);
      if (udp && http && Number(http[1])) { clearTimeout(timeout); yes({udp:Number(udp[1]),http:Number(http[1])}); }
    });
    child.stderr.on('data', b => output += b);
  });
  const ports = await ready;
  const url = 'http://127.0.0.1:'+ports.http;
  const html = await (await fetch(url)).text();
  const font = await fetch(url+'/assets/fonts/Oxanium-Variable.ttf');
  assert.equal(font.status,200);
  assert.equal(font.headers.get('content-type'),'font/ttf');
  assert.equal(Buffer.from(await font.arrayBuffer()).readUInt32BE(0),0x00010000);
  const leaflet = await fetch(url+'/vendor/leaflet/leaflet.js');
  assert.equal(leaflet.status, 200);
  assert.match(leaflet.headers.get('content-type'), /javascript/);
  assert.match(await leaflet.text(), /Leaflet 1\.9\.4/);
  const tile = await fetch(url+'/maptiles/10/508/508.jpg');
  assert.equal(tile.status, 200);
  assert.equal(tile.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual([...Buffer.from(await tile.arrayBuffer()).subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal((await fetch(url+'/maptiles/10/508/missing.jpg')).status, 404);
  for (const id of ['speed','gear','mode-race-btn','mode-freeroam-btn','map-leaflet','minimap-canvas','sessions-btn']) assert.ok(html.includes('id="'+id+'"'), id);
  const mode = await (await fetch(url+'/mode')).json();
  assert.equal(mode.driveMode, 'race');
  const routes = await (await fetch(url+'/routes')).json();
  assert.equal(routes.enabled, true);
  assert.equal(routes.catalogCount, 77);
  assert.equal(routes.routes.length, 77);
  assert.equal((await fetch(url+'/route?id=bad')).status, 400);
  assert.equal((await fetch(url+'/route-best')).status, 400);
  assert.equal((await fetch(url+'/ghost')).status, 400);
  const switched = await fetch(url+'/mode', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driveMode:'freeRoam'})});
  assert.equal(switched.status,200);
  assert.equal((await switched.json()).driveMode,'freeRoam');
  const controller = new AbortController(); t.after(()=>controller.abort());
  const response = await fetch(url+'/events',{signal:controller.signal});
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const reader = response.body.getReader();
  const packet = Buffer.alloc(324); // Synthetic; not captured from the game.
  packet.writeFloatLE(8000,8); packet.writeFloatLE(5000,16); packet.writeFloatLE(25,256);
  packet.writeFloatLE(123.5,244); packet.writeFloatLE(-222.5,252);
  const udp = dgram.createSocket('udp4'); t.after(()=>udp.close());
  await new Promise((yes,no)=>udp.send(packet,ports.udp,'127.0.0.1',e=>e?no(e):yes()));
  let text='';
  while(!text.includes('\n\n')) { const chunk=await reader.read(); if(chunk.done) throw Error('SSE ended'); text+=new TextDecoder().decode(chunk.value); }
  const data=JSON.parse(text.match(/data: (.*)/)[1]);
  assert.equal(data.speedKmh,90); assert.equal(data.currentEngineRpm,5000);
  assert.equal(data.engineMaxRpm,8000); assert.equal(data.positionX,123.5);
  controller.abort();
});

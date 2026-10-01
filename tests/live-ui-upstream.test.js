import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createHTTP } from '../src/server/http.js';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
async function fixture(t, handler) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fh6-live-ui-'));
  const upstream = http.createServer(handler);
  const upstreamURL = await listen(upstream);
  const proxy = createHTTP({ root, upstreamURL });
  const url = await listen(proxy);
  t.after(async () => { await close(proxy); await close(upstream); await fs.rm(root, { recursive: true, force: true }); });
  return { root, url, upstream, upstreamURL };
}

test('live UI rejects a non-local upstream', () => {
  for (const upstreamURL of ['http://example.com', 'http://127.0.0.2', 'http://localhost.example.com', 'https://localhost']) {
    assert.throws(() => createHTTP({ upstreamURL }), /must be local/);
  }
});

test('live UI relays query, method, body and response status to the receiver', async t => {
  const { url, upstreamURL } = await fixture(t, async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(202, { 'Content-Type': 'application/json', 'X-Receiver': 'original' });
    res.end(JSON.stringify({ url: req.url, method: req.method, body, host: req.headers.host, contentType: req.headers['content-type'] }));
  });
  const get = await fetch(`${url}/session?id=42&label=a%20b`);
  assert.equal(get.status, 202);
  assert.equal(get.headers.get('x-receiver'), 'original');
  assert.equal((await get.json()).url, '/session?id=42&label=a%20b');
  const payload = JSON.stringify({ driveMode: 'race' });
  const post = await fetch(`${url}/mode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
  assert.deepEqual(await post.json(), { url: '/mode', method: 'POST', body: payload, host: new URL(upstreamURL).host, contentType: 'application/json' });
});

test('live UI serves this repository HTML and visual assets without forwarding', async t => {
  let forwarded = 0;
  const { root, url } = await fixture(t, (req, res) => { forwarded++; res.end('receiver'); });
  await fs.mkdir(path.join(root, 'public/css'), { recursive: true });
  await fs.mkdir(path.join(root, 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public/index.html'), '<p>new instrument UI</p>');
  await fs.writeFile(path.join(root, 'public/css/cluster.css'), '.new-cluster{}');
  await fs.writeFile(path.join(root, 'assets/logo.svg'), '<svg/>');
  for (const route of ['/', '/index.html']) assert.equal(await (await fetch(url + route)).text(), '<p>new instrument UI</p>');
  assert.equal(await (await fetch(`${url}/styles/cluster.css`)).text(), '.new-cluster{}');
  assert.equal(await (await fetch(`${url}/assets/logo.svg`)).text(), '<svg/>');
  assert.equal((await fetch(`${url}/styles/missing.css`)).status, 404);
  assert.equal(forwarded, 0);
});

test('live UI reports 502 when the original receiver is offline', async t => {
  const { url, upstream } = await fixture(t, (req, res) => res.end('online'));
  await close(upstream);
  const response = await fetch(`${url}/status`);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'Receiver unavailable');
});

test('live UI streams multiple SSE frames and closes upstream after the client leaves', { timeout: 5000 }, async t => {
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const { url } = await fixture(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('data: {"rpm":850}\n\n');
    const timer = setInterval(() => res.write('data: {"rpm":900}\n\n'), 25);
    res.on('close', () => { clearInterval(timer); resolveClosed(); });
  });
  await new Promise((resolve, reject) => {
    const req = http.get(`${url}/events`, res => {
      assert.equal(res.headers['content-type'], 'text/event-stream');
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.includes('850') && data.includes('900')) { res.destroy(); req.destroy(); resolve(); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
  await closed;
});

test('live UI closes a broken upstream SSE so EventSource can reconnect', { timeout: 5000 }, async t => {
  const { url } = await fixture(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"rpm":850}\n\n');
    setTimeout(() => res.destroy(), 20);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { req.destroy(); reject(new Error('Downstream SSE remained open after the receiver disconnected')); }, 1000);
    const req = http.get(`${url}/events`, res => {
      res.resume();
      res.on('error', () => {});
      res.on('close', () => { clearTimeout(timer); resolve(); });
    });
    req.on('error', error => { clearTimeout(timer); reject(error); });
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SSEHub } from '../src/server/sse.js';

class Response extends EventEmitter {
  messages = [];
  writable = true;
  writeHead() {}
  flushHeaders() {}
  write(text) { this.messages.push(text); return this.writable; }
  destroy() { this.emit('close'); }
  end() { this.emit('close'); }
}

test('P1: slow SSE client retains only newest telemetry and state without slowing healthy clients', () => {
  const hub = new SSEHub();
  const slow = new Response(), fast = new Response();
  hub.add({}, slow); hub.add({}, fast);
  slow.writable = false;
  hub.broadcast({ frame: 0 });
  for (let frame = 1; frame <= 1000; frame++) {
    hub.broadcast({ frame }); hub.broadcast({ version: frame }, 'state');
  }
  assert.equal(slow.messages.length, 1);
  assert.equal(hub.clients.get(slow).pending.size, 2);
  assert.equal(fast.messages.length, 2001);
  slow.writable = true; slow.emit('drain');
  assert.equal(slow.messages.length, 3);
  assert.match(slow.messages[1], /"frame":1000/);
  assert.match(slow.messages[2], /event: state\ndata: \{"version":1000\}/);
  assert.equal(hub.clients.get(slow).pending.size, 0);
  slow.emit('close'); assert.equal(hub.size, 1);
  hub.close(); assert.equal(hub.size, 0);
});

test('P1: repeated drain backpressure preserves pending state until a later drain', () => {
  const hub = new SSEHub(), client = new Response();
  hub.add({}, client); client.writable = false;
  hub.broadcast({ frame: 0 }); hub.broadcast({ frame: 1 }); hub.broadcast({ version: 1 }, 'state');
  client.emit('drain');
  assert.equal(hub.clients.get(client).pending.size, 1);
  hub.broadcast({ version: 2 }, 'state');
  client.writable = true; client.emit('drain');
  assert.match(client.messages.at(-1), /"version":2/);
  hub.close();
});

test('P1: write failure while draining removes only the broken SSE client', () => {
  const hub = new SSEHub(), broken = new Response(), healthy = new Response();
  hub.add({}, broken); hub.add({}, healthy); broken.writable = false;
  hub.broadcast({ frame: 0 }); hub.broadcast({ frame: 1 });
  broken.write = () => { throw new Error('Disconnected while draining'); };
  assert.doesNotThrow(() => broken.emit('drain'));
  assert.equal(hub.size, 1);
  hub.broadcast({ frame: 2 });
  assert.match(healthy.messages.at(-1), /"frame":2/);
  hub.close();
});

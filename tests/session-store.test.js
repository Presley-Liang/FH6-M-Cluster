import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, appendFile, readFile, writeFile } from 'node:fs/promises';
import fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { SessionStore } from '../src/session/store.js';

async function setup(t, options) {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-store-test-'));
  const store = new SessionStore(directory, options);
  await store.init();
  t.after(() => store.shutdown());
  const meta = { id: store.nextId(), carOrdinal: 1234, startedAt: new Date().toISOString(), laps: [] };
  store.open(meta);
  return { directory, store, meta };
}

test('P2: journal recovery preserves complete packets and original incomplete crash tail', async t => {
  const { directory, store, meta } = await setup(t);
  const packet = { timestampMs: 1000, sessionId: meta.id, speedKmh: 72 };
  store.append(meta.id, packet);
  await store.shutdown(); // Leave an unfinished journal, as after process interruption.
  const journal = resolve(directory, store.base(meta.id, meta.carOrdinal) + '.jsonl');
  await appendFile(journal, '{"timestampMs":1017');
  const original = await readFile(journal, 'utf8');
  const recovered = new SessionStore(directory);
  t.after(() => recovered.shutdown());
  await recovered.init();
  const archive = await recovered.read(meta.id);
  assert.equal(archive.recovered, true);
  assert.equal(archive.closeReason, 'recovered-after-interruption');
  assert.deepEqual(archive.packets, [packet]);
  assert.equal(archive.packetCount, 1);
  assert.equal(await readFile(journal, 'utf8'), original);
  assert.ok(recovered.nextId() > meta.id);
});

test('P2: final metadata write failure is visible and retains packets for a successful retry', async t => {
  const { store, meta } = await setup(t);
  const packet = { timestampMs: 1000, sessionId: meta.id, speedKmh: 72 };
  store.append(meta.id, packet);
  await store.flushAll();
  const atomic = store.atomic.bind(store);
  store.atomic = async () => { throw Object.assign(new Error('Injected disk-full failure'), { code: 'ENOSPC' }); };
  await assert.rejects(store.finalize(meta), /disk-full/);
  assert.match(store.error, /disk-full/);
  assert.deepEqual((await store.read(meta.id)).packets, [packet]);
  store.atomic = atomic;
  await store.finalize(meta);
  assert.equal(store.error, null);
  assert.deepEqual((await store.read(meta.id)).packets, [packet]);
  assert.equal(store.list().length, 1);
});

test('P2: recording queue is bounded and rejects overflow without dropping accepted packets', async t => {
  const { store, meta } = await setup(t, { maxQueueBytes: 120 });
  const packet = { timestampMs: 1000, sessionId: meta.id };
  assert.equal(store.append(meta.id, packet), true);
  assert.equal(store.append(meta.id, { data: 'x'.repeat(200) }), false);
  assert.match(store.error, /capacity/);
  await store.finalize(meta);
  assert.deepEqual((await store.read(meta.id)).packets, [packet]);
});

test('P2: legacy JSON archives without sidecar metadata remain readable and reserve their IDs', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-legacy-test-'));
  const legacy = {
    id: Date.now() + 100000, carOrdinal: 42, startedAt: '2026-09-08T10:00:00.000Z',
    endedAt: '2026-09-08T10:01:00.000Z', laps: [{ lapNumber: 0, lapTime: 60 }],
    packets: [{ timestampMs: 0, speedKmh: 72 }, { timestampMs: 17, speedKmh: 73 }],
  };
  await writeFile(resolve(directory, `session_${legacy.id}_42.json`), JSON.stringify(legacy));
  const store = new SessionStore(directory);
  t.after(() => store.shutdown());
  await store.init();
  assert.deepEqual(await store.read(legacy.id), legacy);
  assert.equal(store.list()[0].packetCount, 2);
  assert.equal(store.list()[0].lapCount, 1);
  assert.ok(store.nextId() > legacy.id);
});

test('P2: journal flush metadata failure followed by retry does not duplicate committed packets', async t => {
  const { store, meta } = await setup(t);
  await store.entries.get(meta.id).ready;
  const packet = { timestampMs: 1000, sessionId: meta.id, speedKmh: 72 };
  const atomic = store.atomic.bind(store);
  store.atomic = async () => { throw new Error('Injected flush metadata failure'); };
  store.append(meta.id, packet);
  await assert.rejects(store.flushAll(), /flush metadata failure/);
  store.atomic = atomic;
  await store.flushAll();
  assert.deepEqual((await store.read(meta.id)).packets, [packet]);
  await store.finalize(meta);
  assert.deepEqual((await store.read(meta.id)).packets, [packet]);
});

test('P2: partial journal append failure rolls back only its batch and retry writes it exactly once', async t => {
  const { store, meta } = await setup(t);
  const first = { timestampMs: 1000, sessionId: meta.id };
  const next = { timestampMs: 1017, sessionId: meta.id };
  store.append(meta.id, first); await store.flushAll();
  const originalAppend = fsp.appendFile;
  fsp.appendFile = async (file, text, ...options) => {
    await originalAppend(file, text.slice(0, 7), ...options);
    throw new Error('Injected partial journal append');
  };
  try {
    store.append(meta.id, next);
    await assert.rejects(store.flushAll(), /partial journal append/);
  } finally { fsp.appendFile = originalAppend; }
  await store.flushAll();
  await store.finalize(meta);
  assert.deepEqual((await store.read(meta.id)).packets, [first, next]);
});

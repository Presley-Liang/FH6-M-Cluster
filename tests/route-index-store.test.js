import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { openRouteIndexStore, RouteIndexStore, SCHEMA_VERSION } from '../src/routes/sqlite-store.js';

function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'fh6-route-index-'));
  return { directory, path: join(directory, 'routes.sqlite') };
}

function remove(directory) {
  rmSync(directory, { recursive: true, force: true });
}

test('initialization is versioned, idempotent, and persists data across reopen', async () => {
  const target = temporaryDatabase();
  try {
    let store = await openRouteIndexStore(target.path, { clock: () => 1_700_000_000_000 });
    assert.equal(store.database.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    const routeId = store.upsertRoute({
      catalogKey: 'road:goliath', name: 'The Goliath', source: 'LapScope',
      catalogVersion: 'snapshot', kind: 'circuit', startX: 10, startZ: 20,
      distanceSignature: 5950, spanX: 4200, spanZ: 3100, outline: [[0, 0], [1, 1]],
    });
    store.close();

    store = await openRouteIndexStore(target.path);
    assert.equal(store.listRoutes().length, 1);
    assert.equal(store.getRoute(routeId).catalog_key, 'road:goliath');
    store.saveRouteOutline(routeId, [0, 0, 1000, 1000]);
    store.upsertRoute({
      catalogKey: 'road:goliath', name: 'The Goliath', source: 'LapScope',
      catalogVersion: 'snapshot', kind: 'circuit', startX: 10, startZ: 20,
      distanceSignature: 5950, spanX: 4200, spanZ: 3100,
    });
    assert.deepEqual(JSON.parse(store.getRoute(routeId).outline_json), [0, 0, 1000, 1000]);
    assert.equal(store.database.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    store.close();
  } finally {
    remove(target.directory);
  }
});

test('session, lap, match, and backfill APIs remain idempotent', async () => {
  const target = temporaryDatabase();
  try {
    const store = await openRouteIndexStore(target.path, { clock: () => 1_700_000_000_000 });
    const routeId = store.upsertRoute({
      catalogKey: 'route:1', name: 'Route 1', source: 'test',
      startX: 1, startZ: 2, distanceSignature: 5950,
    });
    const session = {
      id: '20260909T120000Z-0001', startedAt: '2026-09-09T12:00:00.000Z',
      driveMode: 'race', recordingType: 'automatic', carOrdinal: 123,
      rawRecordingPath: 'sessions/example.jsonl',
    };
    store.upsertSession(session);
    store.upsertSession({ ...session, endedAt: '2026-09-09T12:10:00.000Z' });
    store.upsertLap({ sessionId: session.id, lapNumber: 1, lapTime: 90.2, spanX: 800, spanZ: 500 });
    store.upsertLap({ sessionId: session.id, lapNumber: 1, lapTime: 89.9, spanX: 805, spanZ: 502 });
    store.saveRouteMatch({
      sessionId: session.id, routeId, status: 'matched', confidence: 0.98,
      method: 'fingerprint', matcherVersion: 1, candidates: [{ routeId, score: 0.98 }],
    });

    assert.equal(store.getSession(session.id).ended_at, '2026-09-09T12:10:00.000Z');
    assert.equal(store.listLaps(session.id).length, 1);
    assert.equal(store.listLaps(session.id)[0].lap_time, 89.9);
    assert.equal(store.getRouteMatch(session.id).status, 'matched');
    assert.equal(store.getSession(session.id).route_id, routeId);
    assert.equal(store.getBestLap(routeId).lap_time, 89.9);
    assert.equal(store.getBestLap(routeId, { carOrdinal: 123 }).session_id, session.id);
    assert.equal(store.getBestLap(routeId, { carOrdinal: 999 }), null);
    assert.equal(JSON.parse(store.saveRouteOutline(routeId, [0, 0, 1, 1]).outline_json).length, 4);
    assert.equal(store.listSessionsNeedingBackfill(2).length, 1);
    store.markBackfilled(session.id, 2);
    assert.equal(store.listSessionsNeedingBackfill(2).length, 0);
    store.close();
  } finally {
    remove(target.directory);
  }
});

test('transactions roll back completely and reject nesting', () => {
  const database = new DatabaseSync(':memory:');
  const store = new RouteIndexStore(database);
  assert.throws(() => store.transaction(() => {
    store.upsertSession({
      id: 'rollback', startedAt: '2026-09-09T12:00:00.000Z', driveMode: 'race',
    });
    throw new Error('disk write failed');
  }), /disk write failed/);
  assert.equal(store.getSession('rollback'), null);
  assert.throws(() => store.transaction(() => store.transaction(() => {})), /cannot nest/);
  assert.throws(() => store.transaction(async () => {}), /must be synchronous/);
  store.close();
});

test('migration failure rolls back schema and version stamp', () => {
  const database = new DatabaseSync(':memory:');
  const broken = new Map([[1, [
    'CREATE TABLE survives_only_on_bug (id INTEGER PRIMARY KEY)',
    'CREATE TABLE invalid SQL',
  ]]]);
  assert.throws(() => new RouteIndexStore(database, { migrations: broken }));
  assert.equal(database.prepare('PRAGMA user_version').get().user_version, 0);
  assert.equal(database.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'survives_only_on_bug'",
  ).get().count, 0);
  database.close();
});

test('unknown and ambiguous matches never attach a route to the session', async () => {
  const target = temporaryDatabase();
  try {
    const store = await openRouteIndexStore(target.path);
    store.upsertSession({ id: 's1', startedAt: '2026-09-09T12:00:00.000Z', driveMode: 'race' });
    assert.throws(() => store.saveRouteMatch({
      sessionId: 's1', routeId: 9, status: 'ambiguous', method: 'fingerprint', matcherVersion: 1,
    }), /Only a matched result/);
    store.saveRouteMatch({
      sessionId: 's1', status: 'ambiguous', confidence: 0.5,
      method: 'fingerprint', matcherVersion: 1, candidates: [{ routeId: 1 }, { routeId: 2 }],
    });
    assert.equal(store.getSession('s1').route_id, null);
    assert.equal(store.getRouteMatch('s1').status, 'ambiguous');
    store.close();
  } finally {
    remove(target.directory);
  }
});

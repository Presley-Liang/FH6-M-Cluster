import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openArchiveIndex, openOptionalArchiveIndex } from '../src/routes/archive-index.js';

test('P7 archive index seeds 77 routes and reconciles sessions and laps idempotently', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fh6-archive-index-'));
  const index = await openArchiveIndex(directory, { clock: () => 1_700_000_000_000 });
  t.after(async () => { await index.shutdown(); await rm(directory, { recursive: true, force: true }); });
  assert.equal(index.listRoutes().length, 77);
  const archive = {
    id: 42, startedAt: '2026-09-09T12:00:00.000Z', endedAt: '2026-09-09T12:02:00.000Z',
    driveMode: 'race', recordingType: 'automatic', carOrdinal: 123, carPi: 900,
    filename: 'session_0042_123.json',
    routeOutline: [0, 0, 1000, 1000],
    laps: [{ lapNumber: 1, lapTime: 60.25, completedAtRaceTime: 60.25 }],
    lapFingerprints: [{ lapNumber: 1, valid: true, startX: 852.5, startZ: -1256.7, distanceSignature: 5951.6, spanX: 2382.2, spanZ: 2073.9 }],
    routeFingerprint: { lapNumber: 1, valid: true, startX: 852.5, startZ: -1256.7, distanceSignature: 5951.6, spanX: 2382.2, spanZ: 2073.9 },
  };
  assert.equal(await index.enqueue(archive), true);
  assert.equal(await index.enqueue({ ...archive, laps: [{ ...archive.laps[0], lapTime: 59.9 }] }), true);
  assert.equal(index.store.getSession(42).raw_recording_path, archive.filename);
  assert.equal(index.store.listLaps(42).length, 1);
  assert.equal(index.store.listLaps(42)[0].lap_time, 59.9);
  assert.equal(index.store.getRouteMatch(42).status, 'matched');
  assert.equal(index.store.getRoute(index.store.getSession(42).route_id).catalog_key, 'airfield-trail');
  assert.deepEqual(JSON.parse(index.store.getRoute(index.store.getSession(42).route_id).outline_json), archive.routeOutline);
});

test('P7 optional archive index fails soft when SQLite is unavailable', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fh6-no-sqlite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let warning = '';
  class MissingSQLite { constructor() { throw new Error('node:sqlite unavailable'); } }
  const index = await openOptionalArchiveIndex(directory, { DatabaseSync: MissingSQLite, onWarning: value => { warning = value; } });
  assert.equal(index.state().enabled, false);
  assert.match(warning, /SQLite route index disabled/);
  assert.equal(await index.enqueue({ id: 1 }), false);
});

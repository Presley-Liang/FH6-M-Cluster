import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SessionStore } from '../src/session/store.js';

test('P8 completed Race archive derives a bounded route fingerprint without changing raw packets', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fh6-fingerprint-archive-'));
  const store = new SessionStore(directory);
  t.after(async () => { await store.shutdown(); await rm(directory, { recursive: true, force: true }); });
  await store.init();
  const meta = {
    id: store.nextId(), startedAt: '2026-09-09T12:00:00.000Z', endedAt: null,
    driveMode: 'race', recordingType: 'automatic', carOrdinal: 1,
    laps: [{ lapNumber: 0, lapTime: 60, completedAtRaceTime: 60 }],
  };
  store.open(meta);
  for (let index = 0; index < 10; index++) store.append(meta.id, {
    lapNumber: 0, currentRaceTime: index, distanceTraveled: index * 650,
    positionX: index * 10, positionZ: index * 4,
  });
  store.append(meta.id, { lapNumber: 1, currentRaceTime: 10, distanceTraveled: 0, positionX: 0, positionZ: 0 });
  await store.finalize({ ...meta, endedAt: '2026-09-09T12:01:00.000Z' });
  const archive = await store.read(meta.id);
  assert.equal(archive.packetCount, 11);
  assert.equal(archive.packets.length, 11);
  assert.equal(archive.routeFingerprint.valid, true);
  assert.equal(archive.routeFingerprint.distanceSignature, 5850);
  assert.equal(archive.routeFingerprint.spanX, 90);
  assert.equal(archive.lapFingerprints.length, 2);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGhostTrace, selectBestLap } from '../src/routes/best-ghost.js';

function packets(lapNumber, count = 12) {
  return Array.from({ length: count }, (_, index) => ({
    lapNumber, currentRaceTime: 100 + index * 0.5,
    distanceTraveled: index * 500, positionX: index * 10,
    positionZ: index * -4, yaw: index / 10,
  }));
}

function archive(id, routeId, carOrdinal, lapTime, extra = {}) {
  return {
    id, routeId, carOrdinal, driveMode: 'race',
    laps: [{ lapNumber: 1, lapTime }],
    lapFingerprints: [{ lapNumber: 1, valid: true, reasons: [] }],
    packets: packets(1), ...extra,
  };
}

test('P8 Best selects the fastest clean positive lap on the same route without mutating inputs', () => {
  const archives = [archive(9, 'r1', 101, 61), archive(4, 'r1', 202, 59), archive(2, 'r2', 101, 40)];
  const snapshot = structuredClone(archives);
  const best = selectBestLap(archives, { routeId: 'r1' });
  assert.deepEqual({ sessionId: best.sessionId, lapTime: best.lapTime, carOrdinal: best.carOrdinal },
    { sessionId: 4, lapTime: 59, carOrdinal: 202 });
  assert.deepEqual(archives, snapshot);
});

test('P8 Best supports same-car filtering and deterministic equal-time tie breaking', () => {
  const archives = [archive(12, 'r1', 101, 59), archive(3, 'r1', 101, 59), archive(1, 'r1', 202, 58)];
  const best = selectBestLap(archives, { routeId: 'r1', carOrdinal: 101 });
  assert.equal(best.sessionId, 3);
  assert.equal(selectBestLap(archives, { routeId: 'missing' }), null);
});

test('P8 Best rejects invalid, teleport-contaminated, nonpositive and non-Race laps', () => {
  const badFingerprint = archive(1, 'r1', 1, 50, { lapFingerprints: [{ lapNumber: 1, valid: false, reasons: ['teleport'] }] });
  const badFlags = archive(2, 'r1', 1, 49, { laps: [{ lapNumber: 1, lapTime: 49, flags: ['teleport'] }] });
  const zero = archive(3, 'r1', 1, 0);
  const roam = archive(4, 'r1', 1, 30, { driveMode: 'freeRoam' });
  const good = archive(5, 'r1', 1, 55);
  assert.equal(selectBestLap([badFingerprint, badFlags, zero, roam, good], { routeId: 'r1' }).sessionId, 5);
});

test('P8 Ghost emits endpoint-preserving bounded normalized progress samples', () => {
  const source = archive(7, 'r1', 42, 55.5);
  const snapshot = structuredClone(source);
  const ghost = buildGhostTrace(source, 1, { maxSamples: 5 });
  assert.equal(ghost.sampleCount, 5);
  assert.equal(ghost.sourceSampleCount, 12);
  assert.equal(ghost.points[0].t, 0);
  assert.equal(ghost.points.at(-1).t, 1);
  assert.deepEqual(ghost.points[0], { t: 0, progress: 0, raceTime: 0, elapsed: 0, x: 0, z: 0, yaw: 0 });
  assert.equal(ghost.points.at(-1).x, 110);
  assert.deepEqual(source, snapshot);
});

test('P8 Ghost can use normalized race time and rejects contaminated or regressing laps', () => {
  const source = archive(7, 'r1', 42, 55.5);
  const timed = buildGhostTrace(source, 1, { axis: 'raceTime', maxSamples: 50 });
  assert.equal(timed.points.at(-1).t, 1);
  assert.equal(timed.sampleCount, 12);
  source.packets[6].distanceTraveled = 1;
  assert.equal(buildGhostTrace(source, 1), null);
  const dirty = archive(8, 'r1', 42, 54, { lapFingerprints: [{ lapNumber: 1, valid: false, reasons: ['teleport'] }] });
  assert.equal(buildGhostTrace(dirty, 1), null);
});

test('P8 Ghost applies effective rewind history before sampling', () => {
  const source = archive(7, 'r1', 42, 55.5);
  source.packets = [
    ...packets(1, 8),
    { ...packets(1, 1)[0], currentRaceTime: 102, distanceTraveled: 2000, positionX: 40, positionZ: -16, timelineBreak: 'rewind' },
    ...packets(1, 12).slice(5),
  ];
  const ghost = buildGhostTrace(source, 1, { maxSamples: 20 });
  assert.equal(ghost.sourceSampleCount, 12);
  assert.equal(ghost.points.at(-1).progress, 1);
});

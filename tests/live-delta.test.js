import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGhostReference,
  createLiveDeltaTracker,
  interpolateGhostTime,
} from '../src/routes/live-delta.js';

const ghost = [
  { distanceTraveled: 0, currentLap: 0 },
  { distanceTraveled: 1000, currentLap: 10 },
  { distanceTraveled: 2000, currentLap: 20 },
  { distanceTraveled: 3000, currentLap: 30 },
];

test('P8 Delta interpolates Ghost time and classifies ahead, behind, and even', () => {
  const tracker = createLiveDeltaTracker({ ghost });
  assert.deepEqual(tracker.update({ distanceTraveled: 500, currentLap: 4.5, lapNumber: 1 }, 100), {
    available: true, deltaSeconds: -0.5, relation: 'ahead', reason: null,
    progress: 500, currentTime: 4.5, ghostTime: 5, lapNumber: 1,
  });
  assert.equal(tracker.update({ distanceTraveled: 1000, currentLap: 10.5, lapNumber: 1 }, 110).relation, 'behind');
  assert.equal(tracker.update({ distanceTraveled: 1500, currentLap: 15.003, lapNumber: 1 }, 120).relation, 'even');
});

test('P8 Delta resets progress safely on an explicit lap wrap', () => {
  const tracker = createLiveDeltaTracker({ ghost });
  tracker.update({ distanceTraveled: 2900, currentLap: 29, lapNumber: 2 }, 10);
  const wrapped = tracker.update({ distanceTraveled: 100, currentLap: 1.2, lapNumber: 3 }, 20);
  assert.equal(wrapped.available, true);
  assert.ok(Math.abs(wrapped.deltaSeconds - 0.2) < 1e-12);
});

test('P8 Delta fails closed for regression, rewind, teleport, and a backwards lap number', () => {
  const tracker = createLiveDeltaTracker({ ghost });
  tracker.update({ distanceTraveled: 500, currentLap: 5, lapNumber: 2 }, 10);
  assert.equal(tracker.update({ distanceTraveled: 400, currentLap: 4, lapNumber: 2 }, 20).reason, 'progress-regression');
  assert.equal(tracker.update({ distanceTraveled: 300, currentLap: 3, lapNumber: 1 }, 30).reason, 'lap-rewind');
  assert.equal(tracker.update({ distanceTraveled: 200, currentLap: 2, lapNumber: 1, timelineBreak: 'rewind' }, 40).reason, 'rewind');
  assert.equal(tracker.update({ distanceTraveled: 200, currentLap: 2, lapNumber: 1, timelineBreak: 'teleport' }, 50).reason, 'teleport');
});

test('P8 Delta reports current-sample and Ghost-reference gaps without extrapolation', () => {
  const sparse = createLiveDeltaTracker({ ghost, maxGhostProgressGap: 500 });
  assert.equal(sparse.update({ distanceTraveled: 500, currentLap: 5, lapNumber: 1 }, 10).reason, 'ghost-gap');

  const live = createLiveDeltaTracker({ ghost, maxCurrentProgressGap: 2000 });
  live.update({ distanceTraveled: 100, currentLap: 1, lapNumber: 1 }, 10);
  assert.equal(live.update({ distanceTraveled: 2500, currentLap: 25, lapNumber: 1 }, 20).reason, 'sample-gap');
  assert.equal(live.update({ distanceTraveled: 4000, currentLap: 40, lapNumber: 1 }, 30).reason, 'outside-ghost-range');
});

test('P8 Delta becomes stale explicitly and recovers on the next valid packet', () => {
  const tracker = createLiveDeltaTracker({ ghost, staleAfterMs: 100 });
  tracker.update({ distanceTraveled: 500, currentLap: 5, lapNumber: 1 }, 1000);
  assert.equal(tracker.tick(1100).available, true);
  assert.equal(tracker.tick(1101).reason, 'stale');
  assert.equal(tracker.update({ distanceTraveled: 600, currentLap: 6, lapNumber: 1 }, 1110).available, true);
});

test('P8 Delta rejects absent, non-finite, and invalidly ordered Ghost/sample data', () => {
  assert.equal(buildGhostReference([]).reason, 'no-ghost');
  assert.equal(buildGhostReference([
    { progress: 0, time: 0 }, { progress: 10, time: Number.NaN },
  ]).reason, 'invalid-ghost');
  assert.equal(buildGhostReference([
    { progress: 10, time: 1 }, { progress: 5, time: 2 },
  ]).reason, 'invalid-ghost-order');
  assert.equal(createLiveDeltaTracker().update({ distanceTraveled: 5, currentLap: 1 }, 0).reason, 'no-ghost');
  assert.equal(createLiveDeltaTracker({ ghost }).update({ distanceTraveled: NaN, currentLap: 1 }, 0).reason, 'invalid-sample');
  assert.equal(createLiveDeltaTracker({ ghost }).update({ distanceTraveled: 1, currentLap: 1 }, NaN).reason, 'invalid-clock');
});

test('P8 Ghost interpolation accepts exact points but refuses extrapolation', () => {
  const reference = buildGhostReference(ghost);
  assert.deepEqual(interpolateGhostTime(reference, 1000), {
    available: true, timeSeconds: 10, bracketGap: 0,
  });
  assert.equal(interpolateGhostTime(reference, -1).reason, 'outside-ghost-range');
  assert.equal(interpolateGhostTime(reference, 3001).reason, 'outside-ghost-range');
});

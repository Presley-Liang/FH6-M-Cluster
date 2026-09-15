import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrackBuffer } from '../public/js/map/track-buffer.js';

const point = (x, z, timestamp) => ({ positionX: x, positionZ: z, timestamp });
const race = (lap = 1, extra = {}) => ({ mode: 'race', sessionId: 'race-a', lap, ...extra });

test('samples by minimum distance and exposes incremental append state', () => {
  const track = createTrackBuffer({ minDistance: 5 });
  const first = track.push(point(0, 0, 100), race());
  assert.equal(first.delta.type, 'start-segment');
  assert.equal(first.delta.resetReason, 'initial-lap');
  assert.equal(track.push(point(3, 0, 200), race()).delta.reason, 'min-distance');
  const next = track.push(point(5, 0, 300), race());
  assert.equal(next.delta.type, 'append');
  assert.equal(next.delta.segmentId, first.delta.segmentId);
  assert.equal(next.pointCount, 2);
});

test('keeps point storage bounded without losing cumulative session bounds', () => {
  const track = createTrackBuffer({ maxPoints: 3, minDistance: 0 });
  for (let x = 0; x < 5; x += 1) track.push(point(x, -x, x * 10), race());
  const state = track.getState();
  assert.equal(state.pointCount, 3);
  assert.deepEqual(state.segments.flatMap((segment) => segment.points).map((item) => item.x), [2, 3, 4]);
  assert.deepEqual(state.sessionBounds, { minX: 0, minZ: -4, maxX: 4, maxZ: 0 });
});

test('lap change clears current-lap geometry but preserves session bounds', () => {
  const track = createTrackBuffer({ minDistance: 0 });
  track.push(point(-10, 20, 10), race(1));
  track.push(point(10, 30, 20), race(1));
  const changed = track.push(point(50, 60, 30), race(2));
  assert.equal(changed.delta.type, 'start-segment');
  assert.equal(changed.delta.resetReason, 'lap');
  assert.equal(changed.pointCount, 1);
  assert.deepEqual(changed.sessionBounds, { minX: -10, minZ: 20, maxX: 50, maxZ: 60 });
});

test('mode or session change isolates tracks and resets cumulative bounds', () => {
  const track = createTrackBuffer({ minDistance: 0 });
  track.push(point(1, 2, 10), race());
  const roam = track.push(point(100, 200, 20), { mode: 'free-roam', sessionId: 'roam-a', lap: 0 });
  assert.equal(roam.delta.resetReason, 'initial-lap');
  assert.equal(roam.pointCount, 1);
  assert.deepEqual(roam.sessionBounds, { minX: 100, minZ: 200, maxX: 100, maxZ: 200 });
  const session = track.push(point(9, 8, 30), { mode: 'free-roam', sessionId: 'roam-b', lap: 0 });
  assert.equal(session.pointCount, 1);
  assert.deepEqual(session.sessionBounds, { minX: 9, minZ: 8, maxX: 9, maxZ: 8 });
});

test('explicit discontinuities end a segment and annotate the next segment', () => {
  for (const [flag, reason] of [
    ['timelineBreak', 'timeline-break'],
    ['rewind', 'rewind'],
    ['teleport', 'teleport'],
    ['disconnected', 'disconnect'],
  ]) {
    const track = createTrackBuffer({ minDistance: 0 });
    track.push(point(0, 0, 10), race());
    const broken = track.push(point(1, 1, 20), race(1, { [flag]: true }));
    assert.deepEqual(broken.delta, { type: 'break', reason });
    const resumed = track.push(point(2, 2, 30), race());
    assert.equal(resumed.delta.type, 'start-segment');
    assert.equal(resumed.delta.breakReason, reason);
    assert.equal(resumed.segments.length, 2);
  }
});

test('time gaps, backwards time and large jumps create automatic breaks', () => {
  const track = createTrackBuffer({ minDistance: 0, maxGapMs: 100, teleportDistance: 50 });
  track.push(point(0, 0, 100), race());
  assert.equal(track.push(point(1, 0, 250), race()).delta.breakReason, 'disconnect');
  assert.equal(track.push(point(2, 0, 200), race()).delta.breakReason, 'rewind');
  assert.equal(track.push(point(100, 0, 210), race()).delta.breakReason, 'teleport');
  assert.equal(track.getState().segments.length, 4);
});

test('invalid coordinates do not enter the buffer', () => {
  const track = createTrackBuffer();
  const state = track.push(point(NaN, 0, 1), race());
  assert.equal(state.pointCount, 0);
  assert.equal(state.delta.reason, 'invalid-point');
});

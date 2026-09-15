import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveTimeline } from '../src/session/runtime.js';

test('P2: rewind replaces stale future samples including boundary without mutating raw arrival history', () => {
  const packets = [
    { currentRaceTime: 10, positionX: 1 },
    { currentRaceTime: 20, positionX: 2 },
    { currentRaceTime: 30, positionX: 3 },
    { currentRaceTime: 20, positionX: 4, timelineBreak: 'rewind' },
    { currentRaceTime: 21, positionX: 5 },
  ];
  const original = structuredClone(packets);
  assert.deepEqual(effectiveTimeline(packets).map(p => p.positionX), [1, 4, 5]);
  assert.deepEqual(packets, original);
});

test('P2: repeated rewind and teleport keep deterministic effective playback order', () => {
  const packets = [
    { currentRaceTime: 10, positionX: 1 },
    { currentRaceTime: 20, positionX: 2 },
    { currentRaceTime: 15, positionX: 3, timelineBreak: 'rewind' },
    { currentRaceTime: 17, positionX: 4 },
    { currentRaceTime: 12, positionX: 5, timelineBreak: 'rewind' },
    { currentRaceTime: 13, positionX: 9999, timelineBreak: 'teleport' },
  ];
  assert.deepEqual(effectiveTimeline(packets).map(p => p.positionX), [1, 5, 9999]);
  assert.deepEqual(effectiveTimeline([]), []);
});

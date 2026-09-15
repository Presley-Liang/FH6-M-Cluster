import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRouteOutline } from '../src/routes/outline.js';

const sample = (lapNumber, time, distance, x, z, extra = {}) => ({
  lapNumber,
  currentRaceTime: time,
  distanceTraveled: distance,
  positionX: x,
  positionZ: z,
  ...extra,
});

function completedLap(count = 20) {
  const packets = [];
  for (let index = 0; index < count; index++) {
    packets.push(sample(0, index, index * 320, index * 10, index * 5));
  }
  packets.push(sample(1, count, 0, 0, 0));
  return packets;
}

test('P8 outline is flat, integer, bounded, normalized, and flips Z', () => {
  const outline = extractRouteOutline(completedLap());
  assert.ok(outline.length >= 4 && outline.length % 2 === 0);
  assert.ok(outline.every(value => Number.isInteger(value) && value >= 0 && value <= 1000));
  assert.equal(Math.max(...outline.filter((_, index) => index % 2 === 0)), 1000);
  assert.ok(outline[1] > outline.at(-1));
  assert.equal(outline.at(-1), 0);
  assert.doesNotThrow(() => JSON.stringify(outline));
});

test('P8 outline sampling is distance-based and point count is bounded', () => {
  const packets = [];
  for (let index = 0; index < 2000; index++) {
    packets.push(sample(0, index, index * 3, index, Math.sin(index / 3) * 100));
  }
  packets.push(sample(1, 2000, 0, 0, 0));
  const outline = extractRouteOutline(packets, { detail: 1000, maxPoints: 64 });
  assert.ok(outline);
  assert.ok(outline.length / 2 <= 64);

  const stationary = Array.from({ length: 40 }, (_, index) => sample(0, index, index * 150, 0, 0));
  stationary.push(sample(1, 40, 0, 0, 0));
  assert.equal(extractRouteOutline(stationary), null);
});

test('P8 outline follows rewind-effective timeline', () => {
  const packets = completedLap().slice(0, -1);
  packets.splice(12, 0,
    sample(0, 6, 1920, 60, 30, { timelineBreak: 'rewind' }),
  );
  packets.push(sample(1, 20, 0, 0, 0));
  const outline = extractRouteOutline(packets);
  assert.ok(outline);
  assert.ok(outline.every(value => value >= 0 && value <= 1000));
});

test('P8 outline excludes samples rejected by the fingerprint timeline', () => {
  const packets = completedLap();
  packets.splice(8, 0, sample(0, 7.5, NaN, 999999, -999999));
  const outline = extractRouteOutline(packets);
  assert.ok(outline);
  assert.equal(outline[0], 0);
  assert.equal(Math.max(...outline.filter((_, index) => index % 2 === 0)), 1000);
});

test('P8 outline fails closed for incomplete, teleported, malformed, and invalid options', () => {
  assert.equal(extractRouteOutline(completedLap().slice(0, -1)), null);

  const teleported = completedLap();
  teleported[10] = { ...teleported[10], timelineBreak: 'teleport' };
  assert.equal(extractRouteOutline(teleported), null);

  assert.equal(extractRouteOutline(null), null);
  assert.equal(extractRouteOutline(completedLap(), { box: 0 }), null);
  assert.equal(extractRouteOutline(completedLap(), { maxPoints: 1 }), null);
});

test('P8 outline can select a requested valid completed lap', () => {
  const first = completedLap().slice(0, -1);
  const second = [];
  for (let index = 0; index < 20; index++) {
    second.push(sample(1, 20 + index, index * 320, 100 + index * 3, 200 + index * 12));
  }
  const packets = [...first, ...second, sample(2, 40, 0, 0, 0)];
  const outline = extractRouteOutline(packets, { lapNumber: 1 });
  assert.ok(outline);
  assert.equal(Math.max(...outline.filter((_, index) => index % 2 === 1)), 1000);
  assert.equal(extractRouteOutline(packets, { lapNumber: 99 }), null);
});

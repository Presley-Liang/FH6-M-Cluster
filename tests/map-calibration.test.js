import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CALIBRATION,
  createWorldToMap,
  normalizeHeading,
  shortestHeadingDelta,
  validateCalibration,
} from '../public/js/map/calibration.js';

const closeTo = (actual, expected, epsilon = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

test('default calibration maps both measured endpoints exactly', () => {
  assert.equal(validateCalibration(DEFAULT_CALIBRATION), true);
  const project = createWorldToMap();
  const scale = 2 ** DEFAULT_CALIBRATION.referenceZoom;

  DEFAULT_CALIBRATION.points.forEach(({ world, pixel }) => {
    const result = project(world[0], world[1]);
    closeTo(result.pixel.x, pixel[0]);
    closeTo(result.pixel.y, pixel[1]);
    closeTo(result.normalized.x, pixel[0] / scale);
    closeTo(result.normalized.y, pixel[1] / scale);
    closeTo(result.latLng.lng, result.normalized.x);
    closeTo(result.latLng.lat, result.normalized.y);
  });
});

test('independent-axis fit maps the world midpoint to the pixel midpoint', () => {
  const project = createWorldToMap();
  const [a, b] = DEFAULT_CALIBRATION.points;
  const result = project({
    x: (a.world[0] + b.world[0]) / 2,
    z: (a.world[1] + b.world[1]) / 2,
  });
  closeTo(result.pixel.x, (a.pixel[0] + b.pixel[0]) / 2);
  closeTo(result.pixel.y, (a.pixel[1] + b.pixel[1]) / 2);
});

test('invalid calibration axes and non-finite values are rejected', () => {
  const base = structuredClone(DEFAULT_CALIBRATION);
  const sameX = structuredClone(base);
  sameX.points[1].world[0] = sameX.points[0].world[0];
  const sameZ = structuredClone(base);
  sameZ.points[1].world[1] = sameZ.points[0].world[1];
  const nonFinite = structuredClone(base);
  nonFinite.points[0].pixel[1] = Infinity;

  for (const invalid of [null, sameX, sameZ, nonFinite]) {
    assert.equal(validateCalibration(invalid), false);
    assert.throws(() => createWorldToMap(invalid), TypeError);
  }
  const project = createWorldToMap();
  assert.throws(() => project(NaN, 0), TypeError);
  assert.throws(() => project(0, Infinity), TypeError);
});

test('headings normalize and shortest deltas wrap across north', () => {
  assert.equal(normalizeHeading(0), 0);
  assert.equal(normalizeHeading(360), 0);
  assert.equal(normalizeHeading(-10), 350);
  assert.equal(normalizeHeading(725), 5);
  assert.equal(shortestHeadingDelta(350, 10), 20);
  assert.equal(shortestHeadingDelta(10, 350), -20);
  assert.equal(shortestHeadingDelta(0, 180), -180);
  assert.throws(() => normalizeHeading(NaN), TypeError);
  assert.throws(() => shortestHeadingDelta(0, Infinity), TypeError);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrackCatalog } from '../src/tracks/catalog.js';
import { matchTrackFingerprint } from '../src/tracks/matcher.js';

const catalog = loadTrackCatalog();
const fingerprint = (route, overrides = {}) => ({
  start: { ...route.start },
  distance: route.distance,
  span: { ...route.span },
  ...overrides,
});

test('every bundled route identifies itself without catalogue ambiguity', () => {
  for (const route of catalog.routes) {
    const result = matchTrackFingerprint(fingerprint(route), catalog);
    assert.equal(result.status, 'matched', route.name);
    assert.equal(result.match.id, route.id);
    assert.equal(result.confidence.score, 1);
    assert.equal(result.candidates.length, 1);
  }
});

test('uses inclusive LapScope thresholds and reports explainable measurements', () => {
  const route = catalog.byId['airfield-trail'];
  const result = matchTrackFingerprint(fingerprint(route, {
    start: { x: route.start.x + 120, z: route.start.z },
    distance: route.distance * 1.05,
    span: { x: route.span.x + route.span.x * 0.15 / 0.85, z: route.span.z },
  }), [route]);

  assert.equal(result.status, 'matched');
  assert.equal(result.confidence.score, 0);
  assert.deepEqual(result.candidates[0].checks, {
    start: true, distance: true, spanX: true, spanZ: true,
  });
  assert.ok(Math.abs(result.candidates[0].measurements.startDistance - 120) < 1e-9);
});

test('returns ambiguous with both candidates instead of choosing the closest', () => {
  const route = catalog.byId['airfield-trail'];
  const twin = { ...route, id: 'airfield-twin', name: 'Airfield Twin' };
  const result = matchTrackFingerprint(fingerprint(route), [route, twin]);

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.match, null);
  assert.deepEqual(result.candidates.map((entry) => entry.route.id), [route.id, twin.id]);
  assert.equal(result.reason, 'multiple-eligible-candidates');
});

test('returns unknown with per-route failed-check diagnostics', () => {
  const route = catalog.byId['airfield-trail'];
  const result = matchTrackFingerprint({
    start: { x: route.start.x + 121, z: route.start.z },
    distance: route.distance,
    span: route.span,
  }, [route]);

  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'no-eligible-candidate');
  assert.equal(result.candidates.length, 0);
  assert.equal(result.diagnostics[0].checks.start, false);
  assert.equal(result.diagnostics[0].eligible, false);
});

test('invalid fingerprints fail closed without catalogue IO or guesses', () => {
  const result = matchTrackFingerprint({ start: { x: NaN, z: 0 }, distance: 0, span: { x: 1, z: 1 } }, catalog);
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'invalid-fingerprint');
  assert.equal(result.match, null);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.issues.length, 2);
});

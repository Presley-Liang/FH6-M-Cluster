import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRouteIdentifier } from '../src/routes/live-route-identifier.js';

const route = Object.freeze({
  id: 'test-route', name: 'Test Route', kind: 'circuit',
  start: { x: 100, z: 200 }, distance: 5_850, span: { x: 900, z: 360 },
});
const catalog = { routes: [route] };
const packet = (index, extra = {}) => ({
  driveMode: 'race', sessionId: 1, lapNumber: 0,
  currentRaceTime: index, distanceTraveled: index * 650,
  positionX: 100 + index * 100, positionZ: 200 + index * 40,
  ...extra,
});

test('live identifier waits for enough samples/progress then exposes the unique route', () => {
  const live = new LiveRouteIdentifier(catalog);
  for (let index = 0; index < 7; index++) live.update(packet(index));
  assert.equal(live.state().status, 'unknown');
  assert.equal(live.state().reason, 'too-few-samples');
  let result;
  for (let index = 7; index < 10; index++) result = live.update(packet(index));
  assert.equal(result.status, 'matched');
  assert.equal(result.routeCatalogKey, 'test-route');
  assert.equal(result.routeName, 'Test Route');
});

test('unique match remains stable across later laps in the same session and resets on session change', () => {
  const live = new LiveRouteIdentifier(catalog);
  for (let index = 0; index < 10; index++) live.update(packet(index));
  const retained = live.update(packet(0, { lapNumber: 1, distanceTraveled: 0 }));
  assert.equal(retained.status, 'matched');
  assert.equal(retained.lapNumber, 1);
  const reset = live.update(packet(0, { sessionId: 2 }));
  assert.equal(reset.status, 'unknown');
  assert.equal(reset.routeCatalogKey, null);
  assert.equal(reset.sessionId, 2);
});

test('ambiguous and unknown outcomes fail closed without guessing an identity', () => {
  const twin = { ...route, id: 'twin', name: 'Twin' };
  const ambiguous = new LiveRouteIdentifier({ routes: [route, twin] });
  let result;
  for (let index = 0; index < 10; index++) result = ambiguous.update(packet(index));
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.routeCatalogKey, null);
  assert.equal(result.candidates.length, 2);

  const unknown = new LiveRouteIdentifier({ routes: [{ ...route, start: { x: 50_000, z: 50_000 } }] });
  for (let index = 0; index < 10; index++) result = unknown.update(packet(index));
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'no-eligible-candidate');
});

test('rewind replaces superseded samples and bounded storage preserves the lap start', () => {
  const live = new LiveRouteIdentifier(catalog, { maxSamples: 8, minSamples: 8 });
  for (let index = 0; index < 8; index++) live.update(packet(index));
  const result = live.update(packet(4, { timelineBreak: 'rewind' }));
  assert.equal(result.sampleCount, 5);
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'too-few-samples');
  for (let index = 5; index < 12; index++) live.update(packet(index));
  assert.equal(live.state().sampleCount, 8);
  assert.equal(live.samples[0].positionX, 100);
});

test('teleport poisons only the current lap; free roam and invalid samples cannot match', () => {
  const live = new LiveRouteIdentifier(catalog);
  for (let index = 0; index < 5; index++) live.update(packet(index));
  assert.equal(live.update(packet(5, { timelineBreak: 'teleport' })).reason, 'teleport');
  for (let index = 6; index < 20; index++) assert.notEqual(live.update(packet(index)).status, 'matched');

  assert.equal(live.update(packet(0, { lapNumber: 1, positionX: NaN })).reason, 'non-finite-sample');
  assert.equal(live.update(packet(0, { lapNumber: 1, driveMode: 'freeRoam' })).reason, 'inactive-free-roam');
});

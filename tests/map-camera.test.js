import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapCameraController } from '../public/js/map/camera-controller.js';

function mapMock() {
  const listeners = new Map();
  const calls = [];
  const map = {
    calls,
    on(type, fn) { listeners.set(type, fn); },
    off(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.({ type, ...event }); },
    panTo(point, options) { calls.push(['panTo', point, options]); map.fire('movestart'); },
    setView(point, zoom, options) { calls.push(['setView', point, zoom, options]); map.fire('movestart'); },
    fitBounds(bounds, options) { calls.push(['fitBounds', bounds, options]); map.fire('movestart'); },
    getZoom() { return 12; },
  };
  return map;
}

test('free roam follows by default, starts with a short pan, and throttles updates', () => {
  let time = 0;
  const map = mapMock();
  const camera = createMapCameraController(map, { now: () => time, followIntervalMs: 100 });
  camera.update([1, 2], { recording: false, showTrail: false });
  time = 50;
  camera.update([2, 3], { recording: true, showTrail: true });
  time = 100;
  camera.update([3, 4]);
  assert.equal(camera.isFollowing(), true);
  assert.deepEqual(map.calls.map((call) => call[0]), ['panTo', 'panTo']);
  assert.equal(map.calls[0][2].animate, true);
  assert.equal(map.calls[1][2].animate, false);
});

test('user movement pauses follow while programmatic movestart does not', () => {
  const map = mapMock();
  const changes = [];
  const camera = createMapCameraController(map, { onFollowChange: (...args) => changes.push(args) });
  camera.update([1, 2]);
  assert.equal(camera.isFollowing(), true);
  map.fire('movestart', { originalEvent: { type: 'pointerdown' } });
  assert.equal(camera.isFollowing(), false);
  camera.update([2, 3]);
  assert.equal(map.calls.length, 1);
  assert.deepEqual(changes, [[false, 'user']]);
});

test('resume performs one animated catch-up pan then returns to low-cost panning', () => {
  let time = 0;
  const map = mapMock();
  const camera = createMapCameraController(map, { now: () => time, followIntervalMs: 10 });
  map.fire('dragstart');
  camera.resumeFollow();
  camera.update({ lat: 4, lng: 5 });
  time = 10;
  camera.update({ lat: 5, lng: 6 });
  assert.deepEqual(map.calls.map((call) => call[2].animate), [true, false]);
});

test('race mode accumulates full-track bounds and throttles fitBounds', () => {
  let time = 0;
  const map = mapMock();
  const camera = createMapCameraController(map, { mode: 'race', now: () => time, raceIntervalMs: 500 });
  camera.update([10, 20]);
  time = 100;
  camera.update([8, 25]);
  time = 500;
  camera.update([12, 18]);
  assert.deepEqual(map.calls.map((call) => call[0]), ['setView', 'fitBounds']);
  assert.deepEqual(map.calls[1][1], [[8, 18], [12, 25]]);
  assert.equal(camera.isFollowing(), true);
  assert.deepEqual(camera.getState().raceBounds, {
    southWest: [8, 18], northEast: [12, 25], count: 3,
  });
});

test('mode switch preserves explicit follow preference and reset clears race bounds', () => {
  const map = mapMock();
  const camera = createMapCameraController(map);
  camera.pauseFollow();
  camera.setMode('race');
  camera.update([1, 1]);
  camera.resetRaceBounds();
  camera.setMode('freeRoam');
  assert.equal(camera.isFollowing(), false);
  assert.equal(camera.getState().raceBounds, null);
  camera.destroy();
  map.fire('dragstart');
  assert.equal(camera.isFollowing(), false);
});

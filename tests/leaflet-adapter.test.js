import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeafletAdapter } from '../public/js/map/leaflet-adapter.js';

test('Leaflet adapter creates one persistent map and rotates a heading marker', async () => {
  const arrow = { values: {}, style: { setProperty(k, v) { arrow.values[k] = v; } } };
  const marker = { addTo() { return this; }, setLatLng(v) { this.point = v; }, getElement() { return { querySelector: () => arrow }; } };
  const calls = { tiles: null, invalidated: 0, removed: 0 };
  const map = { setView() { return this; }, invalidateSize() { calls.invalidated++; }, remove() { calls.removed++; } };
  const L = {
    CRS: { Simple: {} }, extend: Object.assign,
    Transformation: function() {}, latLngBounds: () => ({ pad() { return this; } }),
    map: () => map,
    tileLayer(url, options) { calls.tiles = { url, options }; return { addTo() {} }; },
    divIcon: value => value,
    marker(point) { marker.point = point; return marker; },
  };
  let statuses = [];
  const adapter = createLeafletAdapter({}, L, (x, z) => ({ latLng: { lat: z, lng: x } }), { onStatus: s => statuses.push(s) });
  assert.equal(calls.tiles.url, '/maptiles/{z}/{y}/{x}.jpg');
  assert.equal(calls.tiles.options.maxNativeZoom, 14);
  assert.equal(adapter.update({ positionX: 12, positionZ: 34, yaw: Math.PI }), true);
  assert.deepEqual(marker.point, { lat: 34, lng: 12 });
  assert.equal(arrow.values['--heading'], '180deg');
  assert.equal(adapter.update({ positionX: NaN, positionZ: 0 }), false);
  adapter.invalidate();
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(calls.invalidated, 1);
  adapter.destroy();
  assert.equal(calls.removed, 1);
  assert.deepEqual(statuses, ['OFFLINE MAP READY']);
});

test('Leaflet adapter renders normalized route outline separately and projects world-space ghost', () => {
  const children = [];
  const makeNode = tag => ({
    tag, attributes: {}, style: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = String(value); },
    appendChild(child) { this.children.push(child); },
    remove() { const index = children.indexOf(this); if (index >= 0) children.splice(index, 1); },
  });
  const element = {
    ownerDocument: { createElementNS(_namespace, tag) { return makeNode(tag); } },
    appendChild(child) { children.push(child); },
  };
  const calls = { maps: 0, polylines: [], removed: [] };
  const map = {
    setView() { return this; },
    removeLayer(layer) { calls.removed.push(layer); },
    remove() {},
  };
  const L = {
    CRS: { Simple: {} }, extend: Object.assign,
    Transformation: function() {}, latLngBounds: () => ({ pad() { return this; } }),
    map: () => { calls.maps++; return map; },
    tileLayer: () => ({ addTo() {} }),
    polyline(points, options) {
      const layer = { points, options, addTo() { return this; } };
      calls.polylines.push(layer);
      return layer;
    },
  };
  const adapter = createLeafletAdapter(element, L, (x, z) => ({ latLng: { lat: z / 10, lng: x / 10 } }));
  assert.equal(adapter.setRouteOverlay({
    routeId: 'route-1',
    outline: [0, 1000, 500, 0, 1000, 1000],
    ghostPoints: [{ x: 10, z: 20 }, { positionX: 30, positionZ: 40 }],
  }), true);
  assert.equal(calls.maps, 1);
  assert.equal(children.length, 1);
  assert.equal(children[0].attributes.class, 'fh6-route-outline');
  assert.equal(children[0].style.mixBlendMode, 'normal');
  assert.equal(children[0].style.filter, 'none');
  assert.equal(children[0].children.length, 2);
  const [edge, core] = children[0].children;
  assert.equal(edge.attributes.class, 'fh6-route-outline-edge');
  assert.equal(edge.attributes.points, '0,1000 500,0 1000,1000');
  assert.equal(edge.attributes.stroke, '#071018');
  assert.equal(edge.attributes['stroke-width'], '9');
  assert.equal(core.attributes.class, 'fh6-route-outline-core');
  assert.equal(core.attributes.points, edge.attributes.points);
  assert.equal(core.attributes.stroke, '#ff4058');
  assert.equal(core.attributes['stroke-width'], '3.4');
  assert.deepEqual(calls.polylines[0].points, [[2, 1], [4, 3]]);
  assert.equal(calls.polylines[0].options.color, '#f4fbff');
  assert.equal(calls.polylines[0].options.interactive, false);
});

test('Leaflet adapter clears route overlays on session or mode boundary without rebuilding map', () => {
  const children = [];
  const makeNode = () => ({
    attributes: {}, style: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = String(value); },
    appendChild(child) { this.children.push(child); },
    remove() { const index = children.indexOf(this); if (index >= 0) children.splice(index, 1); },
  });
  const element = {
    ownerDocument: { createElementNS() { return makeNode(); } },
    appendChild(child) { children.push(child); },
  };
  const calls = { maps: 0, removed: [], trackSamples: 0, cameraUpdates: 0, raceResets: 0, markerPoint: null };
  const map = { setView() { return this; }, removeLayer(layer) { calls.removed.push(layer); }, remove() {} };
  const L = {
    CRS: { Simple: {} }, extend: Object.assign,
    Transformation: function() {}, latLngBounds: () => ({ pad() { return this; } }),
    map: () => { calls.maps++; return map; }, tileLayer: () => ({ addTo() {} }),
    polyline(points) { return { points, addTo() { return this; } }; },
    divIcon: value => value,
    marker(point) {
      calls.markerPoint = point;
      return { addTo() { return this; }, setLatLng(value) { calls.markerPoint = value; }, getElement() { return null; } };
    },
  };
  const adapter = createLeafletAdapter(element, L, (x, z) => ({ latLng: { lat: z, lng: x } }), {
    createTrackBuffer: () => ({ push() { calls.trackSamples++; return { delta: { type: 'noop' } }; } }),
    createCamera: () => ({
      update() { calls.cameraUpdates++; }, resetRaceBounds() { calls.raceResets++; }, setMode() {},
    }),
  });
  adapter.update({ positionX: 1, positionZ: 1 }, { sessionId: 'session-a' });
  adapter.setRouteOverlay({ outline: [0, 0, 1000, 1000], ghostPoints: [[1, 1], [2, 2]] });
  assert.equal(children.length, 1);
  adapter.update({ positionX: 2, positionZ: 2 }, { sessionId: 'session-a' });
  assert.equal(children.length, 1);
  assert.equal(adapter.update({ positionX: 0, positionZ: 0, routeSampleAvailable: false, timelineBreak: 'unknown-vehicle' },
    { sessionId: 'session-a' }), false);
  assert.equal(children.length, 1, 'unknown identity retains route and Ghost');
  assert.equal(calls.removed.length, 0);
  assert.deepEqual(calls.markerPoint, { lat: 2, lng: 2 });
  assert.equal(calls.trackSamples, 2);
  assert.equal(calls.cameraUpdates, 2);
  assert.equal(calls.raceResets, 1);
  adapter.update({ positionX: 3, positionZ: 3 }, { sessionId: 'session-b' });
  assert.equal(children.length, 0);
  assert.equal(calls.removed.length, 1);
  adapter.setRouteOverlay({ outline: [0, 0, 1000, 1000] });
  assert.equal(children.length, 1);
  adapter.update({ positionX: NaN, positionZ: NaN, routeSampleAvailable: false }, { sessionId: null });
  assert.equal(children.length, 0, 'a real session end clears overlays even without valid coordinates');
  adapter.setRouteOverlay({ outline: [0, 0, 1000, 1000] });
  assert.equal(children.length, 1);
  adapter.setMode('freeRoam');
  assert.equal(children.length, 0);
  assert.equal(adapter.setRouteOverlay({ outline: [0, 0, 1000, 1000] }), false);
  assert.equal(calls.maps, 1);
});

test('Leaflet adapter fails closed for malformed route overlays', () => {
  const map = { setView() { return this; }, remove() {} };
  const L = {
    CRS: { Simple: {} }, extend: Object.assign,
    Transformation: function() {}, latLngBounds: () => ({ pad() { return this; } }),
    map: () => map, tileLayer: () => ({ addTo() {} }),
    polyline() { throw new Error('invalid overlay should not draw'); },
  };
  const adapter = createLeafletAdapter({}, L, (x, z) => ({ latLng: { lat: z, lng: x } }));
  assert.equal(adapter.setRouteOverlay({ outline: [0, 0, 1001, 2] }), false);
  assert.equal(adapter.setRouteOverlay({ ghostPoints: [{ x: 1, z: 2 }] }), false);
  assert.equal(adapter.setRouteOverlay({ ghostPoints: [{ x: 1, z: 2 }, { x: NaN, z: 3 }] }), false);
});

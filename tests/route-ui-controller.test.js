import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteUIController } from '../public/js/route-ui-controller.js';
import { createLiveDeltaTracker } from '../src/routes/live-delta.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function element(textContent = '') { return { textContent, dataset: {}, title: '' }; }
function setup(fetchJson) {
  const elements = { 'map-route-name': element('ROUTE —'), 'map-delta': element(), 'map-delta-value': element('—') };
  const overlays = [], secondary = [];
  const controller = createRouteUIController({
    doc: { getElementById: id => elements[id] ?? null }, fetchJson,
    mapAdapter: { setRouteOverlay: value => overlays.push(value), clearRouteOverlay: () => overlays.push(null) },
    createDeltaTracker: createLiveDeltaTracker,
    setDriveSecondary: value => secondary.push(value),
  });
  return { controller, elements, overlays, secondary };
}

test('P8 route UI fetches a matched route once, overlays Ghost and renders live Delta', async () => {
  const calls = [];
  const app = setup(async url => {
    calls.push(url);
    if (url.startsWith('/route?')) return { outline_json: '[0,0,1000,1000]' };
    return { points: [{ x: 1, z: 2 }, { x: 3, z: 4 }], timingPoints: [{ distanceTraveled: 0, timeSeconds: 0 }, { distanceTraveled: 1000, timeSeconds: 10 }] };
  });
  const packet = { driveMode: 'race', sessionId: 7, carOrdinal: 42, distanceTraveled: 500, currentLap: 4.5, lapNumber: 1,
    activeRoute: { status: 'matched', routeId: 3, name: 'VOLCAN SPRINT' } };
  app.controller.update(packet); await flush(); await flush();
  app.controller.update(packet);
  assert.equal(calls.filter(url => url.startsWith('/route?')).length, 1);
  assert.equal(app.elements['map-route-name'].textContent, 'VOLCAN SPRINT');
  assert.equal(app.elements['map-delta-value'].textContent, '-0.500');
  assert.equal(app.elements['map-delta'].dataset.relation, 'ahead');
  assert.equal(app.overlays.at(-1).ghostPoints.length, 2);
});

test('P8 route UI clears enhancement layers in Free Roam and fails closed without a best lap', async () => {
  const app = setup(async url => {
    if (url.startsWith('/route?')) return { outline_json: '[0,0,1000,1000]' };
    throw new Error('404');
  });
  app.controller.update({ driveMode: 'race', sessionId: 1, carOrdinal: 2, activeRoute: { status: 'matched', routeId: 9, name: 'ROUTE' } });
  await flush(); await flush();
  assert.equal(app.elements['map-delta-value'].textContent, '—');
  assert.equal(app.secondary.at(-1), 'NO REFERENCE');
  app.controller.update({ driveMode: 'freeRoam' });
  assert.equal(app.elements['map-route-name'].textContent, 'FREE ROAM');
  assert.equal(app.overlays.at(-1), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { getDefaultHTML } from '../src/ui/default-html.js';
import { createC8AmericaInstrument } from '../public/js/themes/c8-america-instrument.js';
import { createClassicalEuropeInstrument } from '../public/js/themes/classical-europe-instrument.js';
import { createLfaJapanInstrument } from '../public/js/themes/lfa-japan-instrument.js';
import { createTaycanEuropeInstrument } from '../public/js/themes/taycan-europe-instrument.js';
import { createClusterBindings } from '../public/js/cluster-bindings.js';

// Lightweight SVG/DOM surface: run the shipped factories and inspect their
// actual readouts and geometry without duplicating their calculations.
function instrument(factory, prefix, themeId) {
  function node() {
    const found = new Map();
    return {
      dataset: {}, style: {}, attributes: {}, textContent: '', innerHTML: '',
      setAttribute(k, v) { this.attributes[k] = v; },
      append() {}, remove() {}, getTotalLength() { return 1000; },
      querySelector(s) { if (!found.has(s)) found.set(s, node()); return found.get(s); },
      querySelectorAll(s) {
        const attribute = s.match(/^\[([^\]]+)\]$/)?.[1];
        if (!attribute) return [];
        const dataKey = attribute.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return [...this.innerHTML.matchAll(new RegExp(attribute + '="([^"]+)"', 'g'))].map(match => {
          const item = this.querySelector('[' + attribute + '="' + match[1] + '"]');
          item.dataset[dataKey] = match[1];
          return item;
        });
      },
    };
  }
  const root = { dataset: { themeId, ignitionPhase: 'live' } };
  const doc = { createElement: node, createElementNS: node };
  const result = factory({ document: doc, mount: { append() {}, closest: () => root } });
  const value = name => result.element.querySelector(`[data-${prefix}-value="${name}"]`).textContent;
  return { ...result, root, value };
}

test('C8 live speed arc follows its linear scale and override takes priority during sweep', () => {
  const h = instrument(createC8AmericaInstrument, 'c8', 'y2020_2024.america');
  const fill = h.element.querySelector('.c8-arc-fill');
  h.update({ speedKmh: 100 }, { mode: 'freeRoam', speedFraction: 4 / 7 });
  assert.equal(fill.style.strokeDasharray, '384.6 1000.0');
  assert.equal(h.value('rpm'), '100');
  h.update({ speedKmh: 100 }, { mode: 'freeRoam', speedFraction: 4 / 7, displayOverride: { speed: .8, rpm: .8 } });
  assert.equal(fill.style.strokeDasharray, '800.0 1000.0');
  assert.equal(h.value('rpm'), '208');
  h.update({ speedKmh: 100 }, { mode: 'freeRoam', stale: true });
  assert.equal(fill.style.strokeDasharray, '0.0 1000.0');
  assert.equal(h.value('rpm'), '—');
});

test('classical numeric speed preserves telemetry above the mechanical dial limit', () => {
  const h = instrument(createClassicalEuropeInstrument, 'ce', 'pre1949.europe');
  h.update({ speedKmh: 340 }, { speedFraction: 1 });
  assert.equal(h.value('speed'), '340');
  h.update({ speedKmh: 340 }, { speedFraction: 1, displayOverride: { speed: 1, rpm: 1 } });
  assert.equal(h.value('speed'), '260');
  h.update({ speedKmh: 355 }, { speedFraction: 1 });
  assert.equal(h.value('speed'), '355');
  h.update({ speedKmh: 0 }, { speedFraction: 0 });
  assert.equal(h.value('speed'), '0');
  h.update({ speedKmh: 355 }, { stale: true });
  assert.equal(h.value('speed'), '—');
});

test('LFA Free Roam speed displays agree during sweep and live handoff', () => {
  const h = instrument(createLfaJapanInstrument, 'lfa', 'y2009_2014.japan');
  h.update({ speedKmh: 55 }, { mode: 'freeRoam', displayOverride: { speed: .5, rpm: .5 } });
  assert.equal(h.value('center'), '140');
  assert.equal(h.value('speed'), '140');
  h.update({ speedKmh: 63 }, { mode: 'freeRoam' });
  assert.equal(h.value('center'), '63');
  assert.equal(h.value('speed'), '63');
});

test('Taycan lateral G reads X and remains unavailable for stale or missing X', () => {
  const h = instrument(createTaycanEuropeInstrument, 'tay', 'y2020_2024.europe');
  h.update({ gX: -.42, gY: 1.8 }, { mode: 'race' });
  assert.equal(h.value('foot1'), '-0.42');
  h.update({ gY: 1.8 }, { mode: 'race' });
  assert.equal(h.value('foot1'), '—');
  h.update({ gX: .42 }, { mode: 'race', stale: true });
  assert.equal(h.value('foot1'), '—');
});

test('server control updates reconcile both directions without posting a policy request', () => {
  const html = getDefaultHTML();
  const start = html.indexOf('  function applyServerState(data)');
  const end = html.indexOf('  function applyMode(mode)', start);
  const nodes = { 'session-info': {}, status: {} };
  const saved = [], wakes = [], controls = [];
  const context = vm.createContext({
    serverVersion: -1, clientModeControl: 'auto', clientDriveMode: 'race', desiredDriveMode: 'race',
    manualThemeChosen: false, latestVehicleState: null,
    localStorage: { setItem: (...args) => saved.push(args) },
    document: { getElementById: id => nodes[id] },
    syncControlModeUI() { controls.push(context.clientModeControl); },
    animationCoordinator: { wake: (...args) => wakes.push(args) },
    vehicleProfileFromState: state => state, applyThemeOverlay() {},
    applyMode: mode => { context.clientDriveMode = mode; }, applyRecordingState() {},
  });
  vm.runInContext(html.slice(start, end), context);
  context.applyServerState({ version: 2, modeControl: 'manual', driveMode: 'freeRoam' });
  assert.equal(context.clientModeControl, 'manual');
  assert.equal(context.desiredDriveMode, 'freeRoam');
  assert.equal(context.manualThemeChosen, true);
  context.applyServerState({ version: 3, modeControl: 'auto', driveMode: 'race' });
  assert.equal(context.clientModeControl, 'auto');
  assert.deepEqual(controls, ['manual', 'auto']);
  assert.equal(wakes.length, 2);
  assert.equal(saved.at(-1)[1], 'auto');
  context.applyServerState({ version: 2, modeControl: 'manual' });
  assert.equal(context.clientModeControl, 'auto', 'ignore older server state');
  context.applyServerState({ version: 3, modeControl: 'auto' });
  assert.equal(wakes.length, 2, 'duplicate state must not restart the transition');
});

test('all outgoing vehicle indicators stay hidden until their next build', () => {
  const names = ['classical-europe', 'belair-america', 'early-911-europe', 's30-japan', 'ae86-japan', 'retro-digital-america', 'jdm90', 'rx8-japan', 'r8-europe', 'c8-america', 'ds-europe', 'lfa-japan', 'cx-europe', 'ford-gt-america', 'taycan-europe', 'panoramic-europe'];
  for (const name of names) {
    const css = readFileSync(new URL(`../public/css/${name}-instrument.css`, import.meta.url), 'utf8');
    const rule = css.split('\n').find(line => line.includes('data-ignition-kind="vehicle"') && line.includes('data-ignition-phase="off-needles"'));
    for (const phase of ['off-needles', 'off-frames', 'off-center', 'vehicle-blackout', 'vehicle-card']) {
      assert.ok(rule.includes(`data-ignition-phase="${phase}"`), `${name} retains hidden indicators in ${phase}`);
    }
    assert.match(rule, /opacity\s*:\s*0/);
  }
});

test('fuel raw values never imply percentages or low-fuel warnings', () => {
  const source = createClusterBindings.toString();
  const start = source.indexOf('    const fuelFraction =');
  const end = source.indexOf('    const tyreTemperatures', start);
  const nodes = { fuel: {}, needle: { style: { setProperty() {} }, classList: { toggle() {} } }, gauge: { dataset: {} }, fill: { style: {} } };
  const context = vm.createContext({
    model: {}, text: (id, value) => { nodes[id].textContent = value; },
    doc: { querySelector: () => nodes.gauge }, fuelFill: nodes.fill, fuelLength: 100, fuelNeedle: nodes.needle,
  });
  for (const fuelRaw of [0, .1, .5, 1, 1.4, NaN]) {
    context.model.fuelRaw = fuelRaw;
    vm.runInContext('{\n' + source.slice(start, end) + '\n}', context);
    assert.equal(nodes.gauge.dataset.level, 'unknown');
    assert.equal(nodes.fill.style.strokeDasharray, '0 100');
    assert.equal(nodes.fuel.textContent, Number.isFinite(fuelRaw) ? fuelRaw.toFixed(3) + ' raw' : '—');
  }
});

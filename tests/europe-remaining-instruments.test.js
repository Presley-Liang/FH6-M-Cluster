import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getDefaultHTML } from '../src/ui/default-html.js';

const themes = [
  ['kadett', 'createKadettEuropeInstrument', 'y1986_1994.europe'],
  ['multipla', 'createMultiplaEuropeInstrument', 'y1995_2002.europe'],
  ['c4', 'createC4EuropeInstrument', 'y2003_2008.europe'],
];
// Execute the real serialized factories, including both shared data projectors.
function harness(factoryName) {
  function node() {
    const children = new Map();
    return {
      dataset: {}, style: { setProperty(key, value) { this[key] = value; } },
      attributes: {}, innerHTML: '', textContent: '', removed: false,
      setAttribute(key, value) { this.attributes[key] = value; },
      remove() { this.removed = true; },
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, node());
        return children.get(selector);
      },
      querySelectorAll(selector) {
        const attr = selector.match(/^\[([^\]=]+)(?:="[^"]*")?\]$/)?.[1];
        if (!attr) return [];
        const key = attr.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        const nodes = [...this.innerHTML.matchAll(new RegExp(attr + '(?:="([^"]*)")?', 'g'))].map(match => {
          const selector = `[${attr}="${match[1] || ''}"]`;
          const child = this.querySelector(selector);
          child.dataset[key] = match[1] || '';
          return { child, selector };
        });
        return nodes.filter(n => !selector.includes('=') || selector === n.selector).map(n => n.child);
      },
    };
  }
  const html = getDefaultHTML();
  const start = html.indexOf('  var createModernInstrumentBinding =');
  const end = html.indexOf('  var createInstrumentThemeHost =', start);
  const factory = vm.runInNewContext(html.slice(start, end) + '\n' + factoryName + ';');
  const root = { dataset: { ignitionPhase: 'live' } };
  const mounted = [];
  const instrument = factory({ document: { createElement: node }, mount: { closest: () => root, append: (...nodes) => mounted.push(...nodes) } });
  return { ...instrument, root, mounted,
    value: key => instrument.element.querySelector(`[data-next-value="${key}"]`).textContent,
    eu: key => instrument.element.querySelector(`[data-eu-value="${key}"]`).textContent,
  };
}
for (const [name, factory] of themes) {
  test(`${name}: valid zero readings, long numbers, freshness, and teardown`, () => {
    const h = harness(factory);
    h.update({ speedKmh: 0, rpm: 0, powerKw: 0, throttlePercent: 0, wheels: [{ tempC: 0 }], gearLabel: 'N', gX: 0 }, { mode: 'freeRoam' });
    assert.equal(h.value('speed'), '0'); assert.equal(h.eu('drive'), '0');
    assert.equal(h.eu('temperature'), '0'); assert.equal(h.value('b'), '0.00');
    h.update({ speedKmh: 350, rpm: 11980, powerKw: -248, wheels: [{ tempC: 104 }, { tempC: 98 }], gearLabel: '10', gX: -.42 }, { mode: 'freeRoam', rpmGauge: { gaugeMax: 13000 } });
    assert.equal(h.value('speed'), '350'); assert.equal(h.value('gear'), '10');
    assert.equal(h.eu('drive'), '11980'); assert.equal(h.value('a'), '-248');
    assert.equal(h.eu('temperature'), '104'); assert.equal(h.value('b'), '-0.42');
    h.update({ speedKmh: 350, rpm: 11980, wheels: [{ tempC: 104 }] }, { stale: true });
    assert.equal(h.value('speed'), '—'); assert.equal(h.eu('drive'), '—'); assert.equal(h.eu('temperature'), '—');
    h.destroy(); assert.ok(h.mounted.every(n => n.removed));
  });
  test(`${name}: sweeping and handoff use the selected scale without clipping live digits`, () => {
    const h = harness(factory);
    h.update({ speedKmh: 120, rpm: 5500, engineMaxRpm: 8000 }, { mode: 'race', rpmGauge: { gaugeMax: 13000 }, displayOverride: { speed: 1, rpm: 1 } });
    assert.equal(h.value('speed'), '260'); assert.equal(h.eu('drive'), '13000');
    h.update({ speedKmh: 350, rpm: 11980, engineMaxRpm: 12000 }, { mode: 'race', rpmGauge: { gaugeMax: 13000 } });
    assert.equal(h.value('speed'), '350'); assert.equal(h.eu('drive'), '11980');
    h.update({ rpm: 5500 }, { displayOverride: { speed: 1 } });
    assert.equal(h.eu('drive'), '5500'); assert.equal(h.eu('scale'), '— RPM');
  });
  test(`${name}: outgoing labels remain stable and lap times require racing confirmation`, () => {
    const h = harness(factory);
    h.update({ currentLap: 3599.99, bestLap: 3590.32 }, { mode: 'race', racing: true });
    assert.equal(h.value('a'), '59:59.99');
    h.root.dataset.ignitionKind = 'mode'; h.root.dataset.ignitionPhase = 'off-frames';
    h.update({ currentLap: 75, gX: -.42 }, { mode: 'freeRoam', racing: true });
    assert.equal(h.element.dataset.mode, 'race'); assert.equal(h.value('a'), '1:15.00');
    assert.equal(h.element.querySelector('[data-next-label="b"]').textContent, 'BEST LAP');
    h.root.dataset.ignitionPhase = 'center';
    h.update({ powerKw: -20, gX: -.42 }, { mode: 'freeRoam' });
    assert.equal(h.element.dataset.mode, 'freeRoam'); assert.equal(h.value('b'), '-0.42');
    h.update({ currentLap: 75, bestLap: 74 }, { mode: 'race', racing: false });
    assert.equal(h.value('a'), '—'); assert.equal(h.value('b'), '—');
  });
  test(`${name}: EV uses input percent and actual signed output, with unavailable fields preserved`, () => {
    const h = harness(factory);
    h.update({ rpm: 9000, throttlePercent: 25, powerKw: -40, fuelRaw: .5, gX: 0 }, { mode: 'freeRoam', powertrain: 'electric' });
    assert.equal(h.eu('drive'), '25'); assert.equal(h.eu('driveUnit'), '%');
    assert.equal(h.eu('driveLabel'), 'DRIVE INPUT'); assert.equal(h.eu('scale'), '0—100 %');
    assert.equal(h.value('a'), '-40');
    h.update({}, { mode: 'freeRoam', powertrain: 'ev' });
    assert.equal(h.eu('drive'), '—'); assert.equal(h.value('a'), '—');
    h.update({}, { powertrain: 'ev', displayOverride: { speed: .5, rpm: .75 } });
    assert.equal(h.eu('drive'), '75');
  });
}
test('Kadett lamps and Multipla needle share the numeric scale and darken on missing data', () => {
  const kad = harness('createKadettEuropeInstrument');
  const count = () => kad.element.querySelectorAll('[data-kad-segment]').filter(n => n.dataset.lit === 'true').length;
  kad.update({ rpm: 4000, engineMaxRpm: 8000 }); assert.equal(count(), 12);
  kad.update({ throttlePercent: 25 }, { powertrain: 'ev' }); assert.equal(count(), 6);
  kad.update({ throttlePercent: 75 }, { powertrain: 'ev', stale: true }); assert.equal(count(), 0);
  const mul = harness('createMultiplaEuropeInstrument');
  const needle = mul.element.querySelector('[data-mul-needle]');
  mul.update({ speedKmh: 130 }); assert.equal(needle.attributes.transform, 'rotate(0 180 180)');
  mul.update({ speedKmh: 350 }); assert.equal(needle.attributes.transform, 'rotate(130 180 180)'); assert.equal(mul.value('speed'), '350');
  mul.update({}, { stale: true }); assert.equal(needle.style.visibility, 'hidden');
});
test('new European factories and CSS are delivered for their exact production IDs', () => {
  const html = getDefaultHTML();
  for (const [name, factory, id] of themes) {
    assert.ok(html.includes(`'${id}': ${factory}`));
    assert.ok(html.includes(`/styles/${name}-europe-instrument.css`));
  }
});

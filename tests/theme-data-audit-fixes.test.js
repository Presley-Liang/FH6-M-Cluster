import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createModernInstrumentBinding } from '../public/js/themes/modern-instrument-binding.js';
import { createEuropeanInstrumentBinding } from '../public/js/themes/european-instrument-binding.js';

// Run the serialized production factories against a minimal SVG/DOM surface.
// This is a data/geometry contract check; rendered readability is checked in a browser.
function harness(factory, prefix, themeId) {
  function node(tag = 'div') {
    const found = new Map(); let html = '';
    return {
      tag, dataset: {}, style: { setProperty(k, v) { this[k] = v; } }, attributes: {}, children: [], textContent: '',
      setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k]; },
      append(...items) { this.children.push(...items); }, remove() {},
      get innerHTML() { return html; }, set innerHTML(value) { html = value; this.children = []; },
      getTotalLength() { return 1000; }, getPointAtLength(distance) { return { x: distance, y: 20 }; },
      querySelector(s) {
        if (!found.has(s)) {
          const item = node(), attr = s.match(/^\[(data-[\w-]+)\]$/)?.[1];
          const value = attr && html.match(new RegExp(attr + '="([^"]*)"'))?.[1];
          if (attr && value !== undefined) item.dataset[attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
          found.set(s, item);
        }
        return found.get(s);
      },
      querySelectorAll(s) {
        const attribute = s.match(/^\[([^\]]+)\]$/)?.[1];
        if (attribute) {
          const key = attribute.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return [...html.matchAll(new RegExp(attribute + '(?:="([^"]*)")?', 'g'))].map((match, index) => {
            const item = this.querySelector(match[1] !== undefined ? '[' + attribute + '="' + match[1] + '"]' : s + ':' + index);
            item.dataset[key] = match[1] ?? ''; return item;
          });
        }
        const children = this.children.flatMap(child => [child, ...child.querySelectorAll(s)]);
        if (s === 'span') return [...html.matchAll(/<span>([^<]*)<\/span>/g)].map((match, index) => { const item = this.querySelector('span:' + index); item.tag = 'span'; item.textContent ||= match[1]; return item; }).concat(children.filter(c => c.tag === 'span'));
        if (s[0] !== '.') return [];
        const fromHTML = [...html.matchAll(/<[\w-]+\b([^>]*)>/g)].flatMap((match, index) => {
          const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
          if (!(attrs.class || '').split(' ').includes(s.slice(1))) return [];
          const item = this.querySelector(s + ':html:' + index); item.attributes = attrs;
          for (const [attr, value] of Object.entries(attrs)) if (attr.startsWith('data-')) item.dataset[attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
          return [item];
        });
        return fromHTML.concat(children.filter(c => (c.attributes.class || '').split(' ').includes(s.slice(1))));
      },
    };
  }
  const root = { dataset: { themeId, ignitionPhase: 'live' } };
  const document = { createElement: node, createElementNS: (_ns, tag) => node(tag) };
  const standaloneFactory = vm.runInNewContext('(' + factory.toString() + ')', { createModernInstrumentBinding });
  const instrument = standaloneFactory({ document, mount: { append() {}, closest: () => root } });
  return { ...instrument, root, value: key => instrument.element.querySelector(`[data-${prefix}-value="${key}"]`).textContent };
}

const themes = [
  ['ae86-japan', 'createAe86JapanInstrument', 'ae86', 'y1976_1985.japan', 'speed', 'rpm'],
  ['belair-america', 'createBelairAmericaInstrument', 'ba', 'y1950_1959.america', 'speed', 'left'],
  ['c8-america', 'createC8AmericaInstrument', 'c8', 'y2020_2024.america', 'speed', 'rpm'],
  ['cx-europe', 'createCxEuropeInstrument', 'cx', 'y1976_1985.europe', 'speed', 'rpm'],
  ['ds-europe', 'createDsEuropeInstrument', 'ds', 'y1950_1959.europe', 'speed', 'left'],
  ['early-911-europe', 'createEarly911EuropeInstrument', 'e911', 'y1960_1975.europe', 'speed', 'drive'],
  ['ford-gt-america', 'createFordGtAmericaInstrument', 'fgt', 'y2015_2019.america', 'secondary', 'rpm'],
  ['jdm90', 'createJdm90Instrument', 'jdm', 'y1995_2002.japan', 'speed', 'rpm'],
  ['lfa-japan', 'createLfaJapanInstrument', 'lfa', 'y2009_2014.japan', 'speed', 'right2'],
  ['panoramic-europe', 'createPanoramicEuropeInstrument', 'pan', 'y2025plus.europe', 'speed', 'main'],
  ['r8-europe', 'createR8EuropeInstrument', 'r8', 'y2009_2014.europe', 'speed', 'rpm'],
  ['retro-digital-america', 'createRetroDigitalAmericaInstrument', 'rda', 'y1986_1994.america', 'speed', 'rpm'],
  ['rx8-japan', 'createRx8JapanInstrument', 'rx8', 'y2003_2008.japan', 'speed', 'rpm'],
  ['s30-japan', 'createS30JapanInstrument', 's30', 'y1960_1975.japan', 'speed', 'rpm'],
  ['taycan-europe', 'createTaycanEuropeInstrument', 'tay', 'y2020_2024.europe', 'speed', 'drive'],
];

for (const [stem, name, prefix, id, speedKey, rpmKey] of themes) {
  const factory = (await import('../public/js/themes/' + stem + '-instrument.js'))[name];
  test(stem + ': first live update after public sweep uses newest telemetry without a second return', () => {
    assert.equal(typeof factory, 'function', name);
    const h = harness(factory, prefix, id);
    const model = { speedKmh: 37, rpm: 850, engineMaxRpm: 6500, gearLabel: '3' };
    const context = { mode: ['c8', 'lfa'].includes(prefix) ? 'freeRoam' : 'race', rpmGauge: { gaugeMax: 6500 }, gaugeFraction: 850 / 6500 };
    h.update(model, { ...context, displayOverride: { speed: 1, rpm: 1 } });
    h.update({ ...model, speedKmh: 113, rpm: 1250 }, { ...context, gaugeFraction: 1250 / 6500 });
    if (prefix === 'ba') assert.equal(h.value(speedKey), '70'); // 113 km/h in its printed mph axis.
    else assert.equal(h.value(prefix === 'c8' ? 'rpm' : speedKey), '113');
    if (prefix === 'c8') assert.equal(h.value('speed'), '1250');
    else if (prefix !== 'lfa') assert.equal(h.value(rpmKey), '1250');
    assert.doesNotMatch(readFileSync(new URL('../public/js/themes/' + stem + '-instrument.js', import.meta.url), 'utf8'), /handoff|\/ 480/);
  });
}

test('R8 updates TORQUE/GEAR caption when only powertrain changes, and hides stale EV readouts', async () => {
  const { createR8EuropeInstrument } = await import('../public/js/themes/r8-europe-instrument.js');
  const h = harness(createR8EuropeInstrument, 'r8', 'y2009_2014.europe');
  h.update({ powerKw: 80, gearLabel: '3' }, { mode: 'race' });
  h.update({ powerKw: 80, torque: 420 }, { mode: 'race', powertrain: 'ev' });
  assert.equal(h.element.querySelector('[data-r8-label="primary"]').textContent, 'TORQUE / Nm');
  assert.equal(h.value('primary'), '420');
  assert.equal(h.value('rpm'), '80');
  h.update({ powerKw: 80 }, { mode: 'race', powertrain: 'ev', stale: true });
  assert.equal(h.value('primary'), '—');
  assert.equal(h.value('rpm'), '—');
  h.update({ gearLabel: '4' }, { mode: 'race', powertrain: 'combustion' });
  assert.equal(h.element.querySelector('[data-r8-label="primary"]').textContent, 'GEAR');
});

test('classical raw RPM remains readable beyond the pointer limit or without an axis', async () => {
  const { createClassicalEuropeInstrument } = await import('../public/js/themes/classical-europe-instrument.js');
  const h = harness(createClassicalEuropeInstrument, 'ce', 'pre1949.europe');
  h.update({ rpm: 9000 }, { rpmGauge: { gaugeMax: 8500 }, gaugeFraction: 1 });
  assert.equal(h.value('drive'), '9000');
  h.update({ rpm: 4000 }, {}); assert.equal(h.value('drive'), '4000');
  h.update({ rpm: 4000 }, { stale: true }); assert.equal(h.value('drive'), '—');
});

test('six custom red zones follow both actual fractions after same-axis engine changes', async () => {
  for (const [stem, name, prefix, id] of themes.filter(t => ['r8', 's30', 'e911', 'jdm', 'rx8', 'lfa'].includes(t[2]))) {
    const factory = (await import('../public/js/themes/' + stem + '-instrument.js'))[name];
    const h = harness(factory, prefix, id);
    for (const end of [.6, .68]) {
      h.update({ engineMaxRpm: end * 5000 }, { rpmGauge: { gaugeMax: 5000, engineMaxRpm: end * 5000, redlineStartFraction: .9 * end, redlineEndFraction: end } });
      const all = []; const collect = node => { all.push(node); for (const child of node.children) collect(child); };
      // Groups created inside the factory are held by the RPM-tick surface.
      for (const selector of ['[data-r8-ticks="rpm"]', '[data-s30-ticks="rpm"]', '.s30-rpm-ticks', '.e911-redline', '.jdm90-redline-layer', '.rx8-redline-layer', '[data-lfa-ticks]']) collect(h.element.querySelector(selector));
      const group = all.find(node => node.attributes['data-redline-end'] === String(end));
      assert.ok(group, stem + ' exposes updated red-zone endpoint');
      assert.equal(group.attributes['data-redline-start'], String(.9 * end));
      assert.equal(group.children.length, 7);
    }
    h.update({ engineMaxRpm: 3000 }, { powertrain: 'ev', rpmGauge: { gaugeMax: 5000 } });
  }
});

test('shared per-layout projection commits each final field once and unchanged fields zero times', () => {
  const value = { dataset: { nextValue: 'b' }, writes: 0, _text: '', get textContent() { return this._text; }, set textContent(v) { this.writes++; this._text = v; } };
  const label = { dataset: { nextLabel: 'b' }, textContent: '' }, unit = { dataset: { nextLabel: 'bUnit' }, textContent: '' };
  const element = { dataset: {}, querySelectorAll(s) { return s === '[data-next-value]' ? [value] : s === '[data-next-label]' ? [label, unit] : []; }, querySelector() { return null; } };
  const bind = createModernInstrumentBinding({ element, mount: {}, project(v, l) { v.b = '0.42'; l.b = 'LATERAL G'; l.bUnit = 'g'; } });
  bind({ throttlePercent: 99 }, { mode: 'freeRoam' }); assert.equal(value.writes, 1);
  bind({ throttlePercent: 98 }, { mode: 'freeRoam' }); assert.equal(value.writes, 1);
  assert.equal(label.textContent, 'LATERAL G');
});

test('eight RPM axes draw readable nice labels and matching major/minor physical positions', async () => {
  const cases = [
    ['r8-europe', 'createR8EuropeInstrument', 'r8', '[data-r8-ticks="rpm"]', '.r8-tick-label', '.r8-major', '.r8-tick', 200, -130, 260, 4],
    ['ae86-japan', 'createAe86JapanInstrument', 'ae86', '.ae86-rpm-ticks', '.ae86-dial-number', '.ae86-tick-major', '.ae86-tick-minor', 200, -130, 260, 7],
    ['jdm90', 'createJdm90Instrument', 'jdm', '.jdm90-tick-layer', '.jdm90-tick-label', '.jdm90-tick-major', '.jdm90-tick-minor', 360, -120, 240, 5],
    ['s30-japan', 'createS30JapanInstrument', 's30', '[data-s30-ticks="rpm"]', '.s30-tick-label', '.s30-tick-major', '.s30-tick', 200, -130, 260, 7],
    ['rx8-japan', 'createRx8JapanInstrument', 'rx8', '.rx8-tick-layer', '.rx8-tach-number', '.rx8-tach-major', '.rx8-tach-minor', 300, -125, 250, 5],
    ['early-911-europe', 'createEarly911EuropeInstrument', 'e911', '.e911-rpm-ticks', '.e911-tick-label', '.e911-tick-major', '.e911-tick-minor', 200, -130, 260, 4],
    ['classical-europe', 'createClassicalEuropeInstrument', 'ce', '.ce-drive-ticks', '.ce-tick-number', '.ce-tick-major', '.ce-tick-minor', 300, -120, 240, 5],
    ['lfa-japan', 'createLfaJapanInstrument', 'lfa', '[data-lfa-ticks]', '.lfa-tick-number', '.lfa-major', '.lfa-tick', 200, -130, 260, 5],
  ];
  for (const [stem, name, prefix, layer, selector, majorSelector, minorSelector, center, begin, span, subdivisions] of cases) {
    const factory = (await import('../public/js/themes/' + stem + '-instrument.js'))[name];
    const h = harness(factory, prefix, '');
    const at = (node, xKey, yKey) => Math.atan2(Number(node.attributes[xKey]) - center, center - Number(node.attributes[yKey])) * 180 / Math.PI;
    for (const max of [5500, 6500, 12000, 6500]) {
      h.update({ rpm: 1000, engineMaxRpm: max - 200 }, { rpmGauge: { gaugeMax: max } });
      const surface = h.element.querySelector(layer), labels = surface.querySelectorAll(selector);
      const texts = labels.map(n => Number(n.textContent)), expected = [];
      for (let rpm = 0; rpm <= max; rpm += max <= 9000 ? 1000 : 2000) expected.push(rpm / 1000);
      if (expected.at(-1) !== max / 1000) expected.push(max / 1000);
      assert.deepEqual(texts, expected, stem + ' readable integer/half endpoint labels');
      assert.equal(new Set(texts).size, texts.length, stem + ' no repeated labels');
      const majorLines = surface.querySelectorAll(majorSelector);
      assert.equal(majorLines.length, labels.length, stem + ' each major value owns a mark');
      for (const [index, value] of texts.entries()) {
        assert.match(labels[index].textContent, /^\d+(?:\.\d{1,2})?$/, stem + ' concise tick ' + index);
        const angle = begin + value * 1000 / max * span;
        assert.ok(Math.abs(at(labels[index], 'x', 'y') - angle) < .04, stem + ' label physical angle ' + index);
        assert.ok(Math.abs(at(majorLines[index], 'x2', 'y2') - angle) < .04, stem + ' major-line physical angle ' + index);
      }
      const minors = surface.querySelectorAll(minorSelector).filter(n => !/(?:major|red)/.test(n.attributes.class || ''));
      assert.equal(minors.length, (texts.length - 1) * (subdivisions - 1), stem + ' minor count');
      let index = 0;
      for (let interval = 0; interval < texts.length - 1; interval++) for (let minor = 1; minor < subdivisions; minor++) {
        const rpm = (texts[interval] + (texts[interval + 1] - texts[interval]) * minor / subdivisions) * 1000;
        const angle = begin + rpm / max * span;
        assert.ok(Math.abs(at(minors[index++], 'x2', 'y2') - angle) < .04, stem + ' minor physical angle');
      }
    }
    h.update({ rpm: 1000, engineMaxRpm: 6300 }, { powertrain: 'ev', rpmGauge: { gaugeMax: 6500 } });
    assert.ok(h.element.querySelector(layer).querySelectorAll(selector).every(n => n.textContent === ''), stem + ' EV does not retain a fuel RPM axis');
  }
});

test('CX drum labels share its dynamic axis, and unknown axes do not animate real RPM', async () => {
  const { createCxEuropeInstrument } = await import('../public/js/themes/cx-europe-instrument.js');
  const h = harness(createCxEuropeInstrument, 'cx', 'y1976_1985.europe');
  h.update({ rpm: 3250, engineMaxRpm: 6300 }, { rpmGauge: { gaugeMax: 6500 } });
  const track = h.element.querySelector('[data-cx-track="rpm"]');
  assert.equal(track.querySelectorAll('span')[5].textContent, '3.25');
  assert.equal(track.style.transform, 'translateY(-15.620cqw)');
  h.update({ rpm: 4000 }, {});
  assert.equal(track.style.transform, 'translateY(-1.420cqw)');
  assert.equal(track.querySelectorAll('span')[5].textContent, '—');
});

test('Ford GT, Taycan and Panoramic show raw RPM without inventing an 8000 live axis', async () => {
  for (const [stem, name, prefix, selector, style, expected] of [
    ['ford-gt-america', 'createFordGtAmericaInstrument', 'fgt', '.fgt-tach-fill', 'strokeDasharray', '0.00 1000.00'],
    ['taycan-europe', 'createTaycanEuropeInstrument', 'tay', '[data-tay-meter="drive"]', 'height', '0.00%'],
    ['panoramic-europe', 'createPanoramicEuropeInstrument', 'pan', '[data-pan-meter="power"]', 'width', '0.00%'],
  ]) {
    const factory = (await import('../public/js/themes/' + stem + '-instrument.js'))[name];
    const h = harness(factory, prefix, '');
    h.update({ rpm: 4000 }, { mode: 'race' });
    assert.equal(h.element.querySelector(selector).style[style], expected, stem);
  }
});

test('DS does not show stale POSITION, and Panoramic explicitly identifies its input meter', async () => {
  const { createDsEuropeInstrument } = await import('../public/js/themes/ds-europe-instrument.js');
  const ds = harness(createDsEuropeInstrument, 'ds', '');
  ds.update({ rank: 12 }, { mode: 'race', racing: true, stale: true });
  assert.equal(ds.value('footer'), '');
  assert.equal(ds.element.querySelector('[data-ds-value="footer"]').hidden, true);
  const { createPanoramicEuropeInstrument } = await import('../public/js/themes/panoramic-europe-instrument.js');
  const pan = harness(createPanoramicEuropeInstrument, 'pan', '');
  for (const context of [{ mode: 'freeRoam' }, { mode: 'race', powertrain: 'ev' }]) {
    pan.update({ powerKw: 7, throttlePercent: 100 }, context);
    assert.equal(pan.element.querySelector('[data-pan-label="midFoot"]').textContent, 'DRIVE INPUT · %');
  }
});

test('Ford GT compressed positions print 3.44/5.72 on an 8000-RPM axis', async () => {
  const { createFordGtAmericaInstrument } = await import('../public/js/themes/ford-gt-america-instrument.js');
  const h = harness(createFordGtAmericaInstrument, 'fgt', '');
  h.update({ rpm: 3440 }, { rpmGauge: { gaugeMax: 8000 } });
  assert.deepEqual(h.element.querySelector('.fgt-tach-labels').children.map(n => n.textContent), ['0', '3.44', '5.72', '8']);
  assert.equal(h.element.querySelector('.fgt-tach-fill').style.strokeDasharray, '250.00 1000.00');
});

test('Civic label coordinates use the same SVG path fractions as the fill', async () => {
  const { createCivicJapanInstrument } = await import('../public/js/themes/civic-japan-instrument.js');
  const h = harness(createCivicJapanInstrument, 'next', '');
  h.update({ rpm: 1000 }, { rpmGauge: { gaugeMax: 8000 } });
  const ticks = h.element.querySelectorAll('[data-next-tick]');
  assert.equal(ticks[1].textContent, '1');
  assert.equal(ticks[1].attributes.x, '125.000');
  assert.equal(ticks[1].attributes.y, '36.000');
  assert.equal(h.element.querySelector('[data-next-fill]').style.strokeDasharray, '12.500 100');
});

test('AE86 throttle and LFA signed Y-axis readouts use explicit data names', async () => {
  const ae86 = readFileSync(new URL('../public/js/themes/ae86-japan-instrument.js', import.meta.url), 'utf8');
  assert.ok(ae86.includes('<span>THROTTLE INPUT</span>')); assert.ok(!ae86.includes('ENGINE LOAD'));
  const { createLfaJapanInstrument } = await import('../public/js/themes/lfa-japan-instrument.js');
  const h = harness(createLfaJapanInstrument, 'lfa', '');
  h.update({ gX: .5, gY: -.42 }, { mode: 'race' });
  assert.equal(h.element.querySelector('[data-lfa-label="left2"]').textContent, 'G / Y AXIS');
  assert.equal(h.value('left2'), '-0.42');
});

test('unknown RPM limits remain unknown during scan, stale scan and EV overrides', async () => {
  const cases = [
    ['ford-gt-america', 'createFordGtAmericaInstrument', 'fgt', 'rpm', '58'],
    ['taycan-europe', 'createTaycanEuropeInstrument', 'tay', 'drive', '58'],
    ['panoramic-europe', 'createPanoramicEuropeInstrument', 'pan', 'main', '-14'],
    ['c8-america', 'createC8AmericaInstrument', 'c8', 'rpm', '-14'],
    ['cx-europe', 'createCxEuropeInstrument', 'cx', 'rpm', '-14'],
    ['retro-digital-america', 'createRetroDigitalAmericaInstrument', 'rda', 'rpm', '-14'],
  ];
  for (const [stem, name, prefix, key, evValue] of cases) {
    const factory = (await import('../public/js/themes/' + stem + '-instrument.js'))[name];
    const h = harness(factory, prefix, '');
    const model = { rpm: 4000, speedKmh: 80, powerKw: -14, throttlePercent: 20 };
    const scan = { mode: 'race', displayOverride: { speed: .5, rpm: .58 } };
    h.update(model, scan); assert.equal(h.value(key), '—', stem + ' no guessed scan RPM');
    h.update(model, { ...scan, stale: true }); assert.equal(h.value(key), '—', stem + ' no guessed stale scan RPM');
    h.update(model, { ...scan, rpmGauge: { gaugeMax: 6500 } }); assert.equal(h.value(key), '3770', stem + ' known scale stays exact');
    h.update(model, { ...scan, powertrain: 'ev' }); assert.equal(h.value(key), evValue, stem + ' EV remains power/input, not fuel RPM');
    h.update(model, { mode: 'race' }); assert.equal(h.value(key), '4000', stem + ' actual raw RPM stays readable');
    h.update(model, { mode: 'race', stale: true }); assert.equal(h.value(key), '—', stem + ' stale raw RPM hidden');
  }
});

test('shared modern and European scans do not turn absent limits into an 8000-RPM reading', () => {
  for (const binding of [createModernInstrumentBinding, createEuropeanInstrumentBinding]) {
    const values = { next: { dataset: { nextValue: 'drive' }, textContent: '' }, eu: { dataset: { euValue: 'drive' }, textContent: '' } };
    const scale = { dataset: { nextLabel: 'scale' }, textContent: '' };
    const fill = { dataset: { nextFill: 'arc' }, style: {} };
    const element = { dataset: {},
      querySelector(s) { return s === '[data-next-fill]' ? fill : null; },
      querySelectorAll(s) { return s === '[data-next-value]' ? [values.next] : s === '[data-next-label]' ? [scale] : s === '[data-eu-value="drive"]' ? [values.eu] : []; },
    };
    const update = binding({ element, mount: {} });
    const context = { displayOverride: { speed: .5, rpm: 1 } };
    update({ rpm: 4000 }, context);
    assert.equal(values.next.textContent, '—');
    assert.equal(fill.style.strokeDasharray, '100.000 100', 'only an uncalibrated decoration scans');
    if (binding === createEuropeanInstrumentBinding) assert.equal(values.eu.textContent, '—');
    update({ rpm: 4000 }, { ...context, stale: true }); assert.equal(values.next.textContent, '—');
    update({ rpm: 4000 }, { ...context, rpmGauge: { gaugeMax: 6500 } }); assert.equal(values.next.textContent, '6500');
    update({ powerKw: -14, throttlePercent: 20 }, { ...context, powertrain: 'ev' });
    assert.equal(values.next.textContent, '-14');
    if (binding === createEuropeanInstrumentBinding) assert.equal(values.eu.textContent, '100', 'its separately labelled drive-input percent');
    update({ rpm: 4000 }, {}); assert.equal(values.next.textContent, '4000'); assert.equal(fill.style.strokeDasharray, '0.000 100');
  }
});

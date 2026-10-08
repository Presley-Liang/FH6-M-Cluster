import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getDefaultHTML } from '../src/ui/default-html.js';

// Exercise the code shipped in the page, without the source module's scope.
function browserAnimation(options = {}) {
  const html = getDefaultHTML();
  const start = html.indexOf('var createUIAnimationCoordinator = ');
  const end = html.indexOf('var createJdm90Instrument = ', start);
  assert.ok(start >= 0 && end > start);
  let now = 0, nextId = 0;
  const tasks = new Map();
  const phases = [];
  const phaseEvents = [];
  const root = { dataset: new Proxy({ ignitionPhase: 'live' }, {
    set(target, key, value) {
      if (key === 'ignitionPhase') { phases.push(value); phaseEvents.push({ phase: value, at: now }); }
      target[key] = value;
      return true;
    },
  }) };
  const body = { dataset: { driveMode: 'race' } };
  const overrides = [];
  const overrideEvents = [];
  const themes = [];
  let live = { speed: .24, rpm: .12 };
  const cardFields = Object.fromEntries(['era', 'region', 'brand', 'model', 'year', 'drive', 'powertrain', 'class'].map(key => [key, { textContent: '' }]));
  const infoCard = { dataset: { visible: 'false' }, setAttribute() {}, querySelector(selector) {
    return cardFields[selector.match(/^\[data-card-(\w+)\]$/)?.[1]] ?? null;
  } };
  const factory = vm.runInNewContext(
    html.slice(start, end) + '\ncreateUIAnimationCoordinator;',
    { performance: { now: () => now } },
  );
  const coordinator = factory({
    ...options,
    root, body,
    display: { setDisplayOverride: value => { overrides.push(value); overrideEvents.push({ value, at: now }); } },
    getLiveFractions: () => live,
    infoCard,
    schedule(fn, delay) { const id = ++nextId; tasks.set(id, { fn, at: now + delay }); return id; },
    cancelSchedule: id => tasks.delete(id),
    ...(options.frameCadence ? {
      requestFrame(fn) { const id = ++nextId; tasks.set(id, { fn, at: now + options.frameCadence }); return id; },
      cancelFrame: id => tasks.delete(id),
    } : {}),
  });
  function advance(to) {
    for (;;) {
      const next = [...tasks].filter(([, task]) => task.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = to;
  }
  function applyTheme(mode) { body.dataset.driveMode = mode; themes.push({ mode, at: now }); }
  return { coordinator, root, body, infoCard, cardFields, overrides, overrideEvents, themes, phases, phaseEvents, tasks, advance, applyTheme, setLive(value) { live = value; } };
}

test('reduced motion settles mode and vehicle changes immediately without blackout timers', () => {
  const h = browserAnimation({ reducedMotion: true });
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  assert.equal(h.body.dataset.driveMode, 'freeRoam');
  assert.equal(h.root.dataset.ignitionPhase, 'live');
  assert.equal(h.tasks.size, 0);
  h.coordinator.wake({ brand: 'NEW', themeEra: 'y2020_2024', themeRegion: 'japan' }, 'race', h.applyTheme);
  assert.equal(h.coordinator.state().vehicle.brand, 'NEW');
  assert.equal(h.root.dataset.startupThemeRegion, 'japan');
  assert.equal(h.body.dataset.driveMode, 'race');
  assert.equal(h.infoCard.dataset.visible, 'false');
  assert.equal(h.overrides.at(-1), null);
  assert.equal(h.tasks.size, 0);
  assert.deepEqual(h.phases, ['live', 'live']);
});

test('enabling reduced motion cancels an active vehicle sweep and its queued mode', () => {
  let reduce = false;
  const h = browserAnimation({ reducedMotion: () => reduce });
  h.coordinator.wake({ themeEra: 'y1995_2002' }, 'race', h.applyTheme);
  h.advance(6000);
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  reduce = true;
  h.coordinator.switchMode('race', h.applyTheme);
  assert.equal(h.tasks.size, 0);
  h.advance(12000);
  assert.equal(h.body.dataset.driveMode, 'race');
  assert.equal(h.root.dataset.ignitionPhase, 'live');
  assert.equal(h.overrides.at(-1), null);
});

test('shipped standalone page runs the original complete Race/Free transition', () => {
  const h = browserAnimation();
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  assert.equal(h.root.dataset.ignitionPhase, 'off-needles');
  for (const [at, phase] of [[220, 'off-frames'], [650, 'off-center'], [1250, 'center'], [1810, 'frames'], [2750, 'scan'], [4050, 'return'], [4550, 'live']]) {
    if (at === 1250) { h.advance(1249); assert.equal(h.body.dataset.driveMode, 'race'); }
    h.advance(at);
    assert.equal(h.root.dataset.ignitionPhase, phase, 'phase at ' + at + 'ms');
  }
  assert.equal(h.themes[0].at, 1250);
  assert.equal(h.body.dataset.driveMode, 'freeRoam');
  assert.ok(!h.phases.includes('vehicle-blackout') && !h.phases.includes('blank'), 'mode switch must not use vehicle blackout');
  assert.ok(h.overrides.some(value => value?.rpm > 0.99));
  assert.equal(h.overrides.at(-1), null, 'handover must use current live telemetry');
  h.coordinator.switchMode('race', h.applyTheme);
  h.advance(9100);
  assert.equal(h.body.dataset.driveMode, 'race');
  assert.equal(h.root.dataset.ignitionPhase, 'live');
});

test('custom mode content commits at relight while the baseline keeps its center timing', () => {
  const h = browserAnimation();
  h.root.dataset.instrumentVariant = 'custom';
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  h.advance(1250);
  assert.equal(h.root.dataset.ignitionPhase, 'center');
  assert.equal(h.body.dataset.driveMode, 'race');
  assert.equal(h.themes.length, 0);
  h.advance(1809);
  assert.equal(h.body.dataset.driveMode, 'race');
  h.advance(1810);
  assert.equal(h.root.dataset.ignitionPhase, 'frames');
  assert.equal(h.body.dataset.driveMode, 'freeRoam');
  assert.equal(h.themes[0].at, 1810);
});

test('sweep and live return follow browser frames and cancel pending frame callbacks', () => {
  const h = browserAnimation({ frameCadence: 7 });
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  h.advance(2800);
  const scan = h.overrideEvents.filter(entry => entry.at >= 2750);
  assert.ok(scan.length >= 8);
  assert.equal(scan[1].at - scan[0].at, 7);
  h.advance(4080);
  const returning = h.overrideEvents.filter(entry => entry.at >= 4050);
  assert.ok(returning.length >= 5);
  assert.equal(returning[1].at - returning[0].at, 7);
  h.coordinator.cancel();
  assert.equal(h.tasks.size, 0);
  assert.equal(h.overrides.at(-1), null);
  const count = h.overrideEvents.length;
  h.advance(6000);
  assert.equal(h.overrideEvents.length, count, 'cancelled frame must not write an old display override');
});

test('shipped standalone vehicle sequence reveals one complete card before build and sweep', () => {
  const html = getDefaultHTML();
  assert.ok(html.includes('vehicle-info-card'), 'vehicle information card must ship in the page');
  assert.ok(!html.includes('id="vehicle-brand-splash"'), 'separate brand splash must not ship in the page');
  assert.ok(!html.includes('ENGINE       ...'), 'removed self-check must not ship in the page');
  assert.ok(html.includes('header-vehicle-info'), 'small vehicle identity stays available in the header');
  const h = browserAnimation();
  h.root.dataset.instrumentEra = 'modern-2015';
  h.coordinator.wake({ themeEra: 'y2015_2019', metadata: { powertrainType: 'EV' } }, 'race', h.applyTheme);
  h.advance(1080);
  assert.equal(h.root.dataset.ignitionPhase, 'vehicle-blackout');
  h.advance(1539);
  assert.equal(h.root.dataset.ignitionPhase, 'vehicle-blackout', 'blackout must remain opaque for a visible hold');
  assert.equal(h.root.dataset.instrumentEra, 'modern-2015', 'outgoing instrument retains its era until blackout completes');
  h.advance(10000);
  assert.deepEqual(h.phases, ['off-needles', 'off-frames', 'off-center', 'vehicle-blackout', 'vehicle-card', 'frames', 'scan', 'return', 'live']);
  assert.equal(h.root.dataset.powertrain, 'EV');
  assert.equal(h.overrides.at(-1), null);
});

test('vehicle build waits for card exit and starts from zero before sweep', () => {
  const h = browserAnimation();
  h.coordinator.wake({ themeEra: 'y1995_2002', themeRegion: 'japan' }, 'race', h.applyTheme);
  h.advance(1080);
  assert.equal(h.overrides.at(-1).speed, 0);
  assert.equal(h.overrides.at(-1).rpm, 0);
  h.advance(3039);
  assert.equal(h.root.dataset.ignitionPhase, 'vehicle-card');
  assert.equal(h.infoCard.dataset.visible, 'true');
  assert.equal(h.themes.length, 0);
  h.advance(3040);
  assert.equal(h.infoCard.dataset.visible, 'false');
  h.advance(3419);
  assert.equal(h.themes.length, 0, 'target theme must wait until the card has faded out');
  h.advance(3420);
  assert.equal(h.themes[0].at, 3420);
  h.advance(3452);
  assert.equal(h.root.dataset.ignitionPhase, 'frames');
  h.advance(4571);
  assert.equal(h.root.dataset.ignitionPhase, 'frames');
  h.advance(4572);
  assert.equal(h.root.dataset.ignitionPhase, 'scan');
});

test('mode request during vehicle sweep runs after live handoff', () => {
  const h = browserAnimation();
  h.coordinator.wake({ themeEra: 'y1995_2002' }, 'race', h.applyTheme);
  h.advance(6000);
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  assert.equal(h.body.dataset.driveMode, 'race');
  h.advance(6501);
  assert.equal(h.body.dataset.driveMode, 'race');
  h.advance(6502);
  assert.equal(h.root.dataset.ignitionKind, 'mode');
  assert.equal(h.root.dataset.ignitionPhase, 'off-needles');
  h.advance(7752);
  assert.equal(h.body.dataset.driveMode, 'freeRoam');
});

test('a new vehicle change cancels the old target before its card can appear', () => {
  const h = browserAnimation();
  h.coordinator.wake({ brand: 'FIRST', themeEra: 'y2015_2019' }, 'race', h.applyTheme);
  h.advance(1100);
  h.coordinator.wake({ brand: 'SECOND', themeEra: 'y1995_2002' }, 'race', h.applyTheme);
  h.advance(2000);
  assert.equal(h.root.dataset.ignitionPhase, 'off-center');
  assert.equal(h.themes.length, 0, 'cancelled vehicle must not apply its theme');
  h.advance(3000);
  assert.equal(h.root.dataset.instrumentEra, 'digital-00s');
});

test('the merged card adopts target era and region only after the full-black interval', () => {
  const h = browserAnimation();
  h.root.dataset.startupThemeEra = 'y2015_2019';
  h.root.dataset.startupThemeRegion = 'europe';
  h.coordinator.wake({ brand: 'JAPAN BRAND', modelName: 'GT', themeEra: 'y1995_2002', themeRegion: 'japan' }, 'race', h.applyTheme);
  h.advance(1539);
  assert.equal(h.root.dataset.startupThemeEra, 'y2015_2019');
  assert.equal(h.root.dataset.startupThemeRegion, 'europe');
  h.advance(1540);
  assert.equal(h.root.dataset.ignitionPhase, 'vehicle-card');
  assert.equal(h.root.dataset.startupThemeEra, 'y1995_2002');
  assert.equal(h.root.dataset.startupThemeRegion, 'japan');
  assert.equal(h.infoCard.dataset.visible, 'true');
  assert.equal(h.cardFields.era.textContent, '1995—02');
  assert.equal(h.cardFields.region.textContent, 'JAPAN');
  assert.equal(h.cardFields.brand.textContent, 'JAPAN BRAND');
  assert.equal(h.cardFields.model.textContent, 'GT');
});

test('sweep returns toward the latest live telemetry before relinquishing override', () => {
  const h = browserAnimation();
  h.coordinator.switchMode('freeRoam', h.applyTheme);
  h.advance(4050);
  h.setLive({ speed: .42, rpm: .27 });
  h.advance(4300);
  const mid = h.overrides.at(-1);
  assert.ok(mid.speed < 1 && mid.speed > .42, 'speed should interpolate toward current live value');
  assert.ok(mid.rpm < 1 && mid.rpm > .27, 'rpm should interpolate toward current live value');
  h.advance(4550);
  assert.equal(h.overrides.at(-1), null);
});

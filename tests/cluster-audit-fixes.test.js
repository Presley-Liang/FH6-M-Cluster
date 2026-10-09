import test from 'node:test';
import assert from 'node:assert/strict';
import { mapInstrumentLiveFractions } from '../public/js/instrument-live-fractions.js';
import { createRaceFeedbackController } from '../public/js/race-feedback-controller.js';
import { lookupVehicleMetadata, resolveVehicleTheme, VERIFIED_EV_SOURCES } from '../src/vehicle/vehicle-metadata.js';
import vm from 'node:vm';
import { getDefaultHTML } from '../src/ui/default-html.js';

test('R01 all linear instruments hand back to their own speed axes', () => {
  const cases = {
    'y1950_1959.europe': 280, 'y1960_1975.europe': 280,
    'y1960_1975.japan': 280, 'y1976_1985.japan': 280,
    'y1995_2002.japan': 280, 'y2003_2008.japan': 280,
    'y2009_2014.europe': 280, 'y2009_2014.japan': 280,
    'y2020_2024.america': 260, 'y1995_2002.europe': 260,
    'y1960_1975.america': 260, 'y1976_1985.america': 260,
    'y2003_2008.america': 260, 'y1950_1959.america': 160 / .621371,
  };
  for (const [theme, max] of Object.entries(cases)) {
    const live = { speed: 4 / 7, speedKmh: 100, rpm: .31 };
    assert.equal(mapInstrumentLiveFractions(theme, live).speed, 100 / max, theme);
    assert.equal(mapInstrumentLiveFractions(theme, live).rpm, .31);
    assert.equal(mapInstrumentLiveFractions(theme, { speed: 4 / 7 }).speed, 100 / max);
    assert.equal(mapInstrumentLiveFractions(theme, { speedKmh: -3 }).speed, 0);
    assert.equal(mapInstrumentLiveFractions(theme, { speedKmh: 350 }).speed, 1);
  }
  assert.equal(mapInstrumentLiveFractions('y1995_2002.japan', { speed: 1, speedKmh: 270 }).speed, 270 / 280);
  assert.deepEqual(mapInstrumentLiveFractions('y2015_2019.europe', { speed: 4 / 7, rpm: .31 }), { speed: 4 / 7, rpm: .31 });
});

test('R13 exact manufacturer verified EV ordinals activate the overlay, unknown remains unknown', () => {
  for (const ordinal of Object.keys(VERIFIED_EV_SOURCES)) {
    const metadata = lookupVehicleMetadata(Number(ordinal));
    assert.equal(metadata.powertrain, 'electric', ordinal);
    assert.match(metadata.powertrainSource, /^https:\/\//);
    assert.equal(resolveVehicleTheme(metadata).powertrainOverride, 'electric');
  }
  assert.equal(lookupVehicleMetadata(3722).powertrain, 'electric');
  assert.equal(lookupVehicleMetadata(3789).powertrain, 'electric');
  assert.equal(lookupVehicleMetadata(999999), null);
  assert.equal(resolveVehicleTheme(lookupVehicleMetadata(999999)).powertrain, 'unknown');
  assert.equal(lookupVehicleMetadata(344).powertrain, 'unknown');
});

test('R26 a vehicle boundary cannot emit a best lap or rank improvement from the prior car', () => {
  const feedback = createRaceFeedbackController();
  const packet = { sessionId: 1, carOrdinal: 123, isRaceOn: 1, lapNumber: 1, bestLap: 60, racePosition: 3 };
  feedback.update(packet);
  assert.deepEqual(feedback.update({ ...packet, carOrdinal: 456, lapNumber: 2, lastLap: 59, bestLap: 59, racePosition: 1 }), []);
});

for (const acknowledged of [false, true]) {
  test('R24 failed mode POST ' + (acknowledged ? 'preserves the acknowledged target' : 'cannot retry after an unrelated session update'), async () => {
    const html = getDefaultHTML();
    const start = html.indexOf('  function pumpModeRequest()');
    const end = html.indexOf("  document.querySelectorAll('.mode-seg-btn')", start);
    let reject, requests = 0;
    const context = vm.createContext({
      clientModeControl: 'manual', policyRequestInFlight: false, queuedControlMode: null, modeRequestInFlight: false,
      desiredDriveMode: 'race', clientDriveMode: 'freeRoam', serverInstanceEpoch: 0, policyAuthorityRevision: 1,
      updateModePending() {}, applyServerState() {}, setControlMode() {}, setTimeout() {},
      document: { querySelector: () => ({ dataset: {} }) }, console: { error() {} },
      fetch() { requests++; return new Promise((_, fail) => { reject = fail; }); },
    });
    vm.runInContext(html.slice(start, end), context);
    context.pumpModeRequest();
    context.policyAuthorityRevision++;
    if (acknowledged) context.clientDriveMode = 'race';
    reject(new Error('intentional failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1);
    assert.equal(context.modeRequestInFlight, false);
    assert.equal(context.desiredDriveMode, acknowledged ? 'race' : 'freeRoam');
  });
}

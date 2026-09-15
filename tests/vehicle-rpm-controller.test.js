import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleStateController } from '../public/js/vehicle-state-controller.js';
import { createRpmGaugeController, niceRpmScale } from '../public/js/rpm-gauge-controller.js';

test('P9 nice RPM scale produces readable headroom instead of raw endpoint labels', () => {
  assert.deepEqual([4800, 5000, 6800, 7600, 8000, 8900].map(niceRpmScale), [5000, 5500, 7000, 8000, 8500, 9000]);
  assert.equal(niceRpmScale(NaN), null);
});

test('P9 vehicle identity ignores one-frame ordinal errors and commits a sustained change once', () => {
  const controller = createVehicleStateController({ confirmFrames: 3, confirmMs: 100 });
  const packet = carOrdinal => ({ carOrdinal, engineMaxRpm: carOrdinal === 1 ? 8000 : 5000, carPi: 900 });
  controller.update(packet(1), 0); controller.update(packet(1), 50);
  let result = controller.update(packet(1), 100);
  assert.equal(result.changed, true); assert.equal(result.vehicle.carOrdinal, 1);
  result = controller.update(packet(999), 120);
  assert.equal(result.status, 'changing'); assert.equal(result.vehicle, null);
  result = controller.update(packet(1), 130);
  assert.equal(result.status, 'locked'); assert.equal(result.changed, false);
  controller.update(packet(2), 200); controller.update(packet(2), 250);
  result = controller.update(packet(2), 300);
  assert.equal(result.changed, true); assert.equal(result.vehicle.carOrdinal, 2);
});

test('P9 RPM controller hides the old scale while vehicle change is pending', () => {
  const vehicles = createVehicleStateController({ confirmFrames: 2, confirmMs: 10 });
  const rpm = createRpmGaugeController();
  const high = { carOrdinal: 1, engineMaxRpm: 8000, currentEngineRpm: 4000 };
  vehicles.update(high, 0); const locked = vehicles.update(high, 10);
  const highGauge = rpm.update(high, locked);
  assert.equal(highGauge.gaugeMax, 8500);
  assert.equal(highGauge.gaugeFraction, 4000 / 8500);
  const low = { carOrdinal: 2, engineMaxRpm: 4800, currentEngineRpm: 2400 };
  const changing = vehicles.update(low, 20);
  assert.equal(rpm.update(low, changing).available, false);
  const lowLocked = vehicles.update(low, 30);
  const lowGauge = rpm.update(low, lowLocked);
  assert.equal(lowGauge.gaugeMax, 5000);
  assert.deepEqual(lowGauge.majorTicks, [0,1,2,3,4,5]);
  assert.ok(lowGauge.redlineEndFraction < 1);
});

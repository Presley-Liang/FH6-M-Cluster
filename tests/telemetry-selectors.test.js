import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { selectTelemetry } from '../public/js/telemetry-selectors.js';

test('selector distinguishes valid zero from missing, NaN, Infinity and numeric strings', () => {
  const missing = selectTelemetry(null);
  assert.equal(missing.speedKmh, null);
  assert.equal(missing.wheels[0].tempC, null);
  assert.equal(missing.gearLabel, '—');
  const zero = selectTelemetry({ speedMs: 0, currentEngineRpm: 0, engineMaxRpm: 8000, fuel: 0, throttle: 0, gear: 0 });
  assert.equal(zero.speedKmh, 0);
  assert.equal(zero.rpmRatio, 0);
  assert.equal(zero.fuelRaw, 0);
  assert.equal(zero.throttlePercent, 0);
  assert.equal(zero.gearLabel, 'R');
  const bad = selectTelemetry({ currentEngineRpm: NaN, engineMaxRpm: Infinity, power: '200', torque: null });
  assert.equal(bad.rpm, null);
  assert.equal(bad.rpmRatio, null);
  assert.equal(bad.powerKw, null);
  assert.equal(bad.torque, null);
});

test('redline refreshes per car, clamps presentation only, and disables when stale or invalid', () => {
  const packet = { carOrdinal: 1, currentEngineRpm: 7200, engineMaxRpm: 8000 };
  assert.equal(selectTelemetry(packet).rpmRatio, 0.9);
  assert.equal(selectTelemetry({ ...packet, carOrdinal: 2, engineMaxRpm: 6000 }).rpmRatio, 1.1);
  assert.equal(selectTelemetry(packet, true).rpmRatio, null);
  assert.equal(selectTelemetry(packet, true).rpm, 7200);
  for (const engineMaxRpm of [0, -1, NaN, Infinity, undefined]) {
    assert.equal(selectTelemetry({ ...packet, engineMaxRpm }).rpmRatio, null);
  }
  assert.equal(packet.engineMaxRpm, 8000);
});

test('input units, signed engine power, orientation and G are projected correctly', () => {
  const s = selectTelemetry({ speedMs: 10, power: -25000, torque: -42, throttle: 255, brake: 127.5,
    clutch: 0, handbrake: 255, steer: -128, accelX: 9.80665, yaw: Math.PI, fuel: 1.4, boost: -0.5 });
  assert.equal(s.speedKmh, 36);
  assert.equal(s.powerKw, -25);
  assert.equal(s.torque, -42);
  assert.equal(s.throttlePercent, 100);
  assert.equal(s.brakePercent, 50);
  assert.equal(s.steerNormalized, -1);
  assert.equal(selectTelemetry({ steer: 127 }).steerNormalized, 1);
  assert.equal(s.yawDegrees, 180);
  assert.equal(s.gX, 1);
  assert.equal(s.fuelRaw, 1.4);
  assert.equal(s.boostRaw, -0.5);
});

test('wheel order, enums, lap values and unavailable channels are explicit', () => {
  const p = { gear: 11, carClass: 4, drivetrainType: 2, carOrdinal: 999999, currentLap: 0, lapNumber: 0 };
  ['Fl', 'Fr', 'Rl', 'Rr'].forEach((suffix, i) => {
    p['tireTemp' + suffix] = 20 + i;
    p['suspensionTravelMeters' + suffix] = i / 10;
  });
  const s = selectTelemetry(p);
  assert.deepEqual(s.wheels.map(w => w.id), ['FL', 'FR', 'RL', 'RR']);
  assert.deepEqual(s.wheels.map(w => w.tempC), [20, 21, 22, 23]);
  assert.equal(s.wheels[3].travelMeters, 0.3);
  assert.equal(s.gearLabel, 'N');
  assert.equal(s.classLabel, 'S1');
  assert.equal(s.drivetrainLabel, 'AWD');
  assert.equal(s.carLabel, 'CAR #999999');
  assert.equal(s.currentLap, 0);
  assert.equal(s.lapNumber, 0);
  assert.equal(selectTelemetry({ gear: 255 }).gearLabel, 'RAW 255');
  assert.equal(selectTelemetry({ drivetrainType: 9 }).drivetrainLabel, 'UNKNOWN (9)');
  assert.deepEqual(s.unavailable, { tireWear: true, coolantTemperature: true });
});

test('selector can execute independently when serialized into browser script', () => {
  const result = vm.runInNewContext('(' + selectTelemetry.toString() + ')({speedMs:20,gear:2})');
  assert.equal(result.speedKmh, 72);
  assert.equal(result.gearLabel, '2');
});

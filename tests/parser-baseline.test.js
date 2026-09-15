import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, toJSON, ParseError, TelemetryPacket } from '../src/parser.js';
import { createPacketFixture } from './helpers/packet-fixture.js';

test('synthetic 324-byte baseline preserves FH6 extension and position offsets', () => {
  const buf = createPacketFixture();
  assert.equal(buf.length, 324);
  const packet = parse(buf);
  assert.ok(packet instanceof TelemetryPacket);
  for (const [key, value] of Object.entries({
    isRaceOn: true, timestampMs: 4000000000,
    engineMaxRpm: 8000, engineIdleRpm: 850, currentEngineRpm: 5000,
    positionX: -1234.5, positionY: 87.25, positionZ: 4321.75,
    yaw: 1.25, pitch: -0.125, roll: 0.0625,
    carGroup: 3000000000, smashableVelDiff: 2.5, smashableMass: 1200,
    carOrdinal: 1234, carClass: 5, carPi: 900, drivetrainType: 2, numCylinders: 8,
    speedMs: 25, power: 250000, torque: 550, boost: 1.5, fuel: 0.75,
  })) assert.equal(packet[key], value, key);
});

test('unsigned pedals and signed steering retain raw values', () => {
  const packet = parse(createPacketFixture());
  for (const [key, value] of Object.entries({ throttle: 255, brake: 128,
    clutch: 64, handbrake: 32, gear: 5, steer: -127,
    normalizedDrivingLine: 63, normalizedAIBrakeDifference: -64,
    lapNumber: 513, racePosition: 3,
  })) assert.equal(packet[key], value, key);
});

test('four-wheel temperatures convert Fahrenheit to Celsius in wheel order', () => {
  const packet = parse(createPacketFixture());
  assert.deepEqual(['Fl', 'Fr', 'Rl', 'Rr'].map(wheel => packet[`tireTemp${wheel}`]), [0, 50, 100, 25]);
  assert.deepEqual(['Fl', 'Fr', 'Rl', 'Rr'].map(wheel => packet[`suspension${wheel}`]), [0.25, 0.5, 0.75, 1]);
  assert.deepEqual(['Fl', 'Fr', 'Rl', 'Rr'].map(wheel => packet[`tireSlipRatio${wheel}`]), [-0.25, 0.5, 0.75, 1.25]);
});

test('JSON baseline keeps packet fields and adds km/h without inventing tire wear', () => {
  const packet = parse(createPacketFixture());
  const json = toJSON(packet);
  assert.deepEqual(Object.keys(json).sort(), [...Object.keys(packet), 'speedKmh'].sort());
  assert.equal(json.speedKmh, 90);
  assert.equal(json.currentEngineRpm, 5000);
  assert.equal(json.positionX, -1234.5);
  assert.equal(json.positionZ, 4321.75);
  assert.equal(json.yaw, 1.25);
  assert.equal(json.currentLap, 12.75);
  assert.equal(json.bestLap, 60.25);
  assert.equal(json.lastLap, 61.5);
  assert.equal(json.currentRaceTime, 135.5);
  assert.equal(json.fuel, 0.75);
  assert.equal(json.tireTempRr, 25);
  assert.equal(Object.keys(json).some(key => /wear/i.test(key)), false);
  assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
});

test('baseline accepts 323 bytes without padding; this is not a strict 324-byte contract', () => {
  const buf = createPacketFixture();
  assert.deepEqual(parse(buf.subarray(0, 323)), parse(buf));
  assert.deepEqual(parse(Buffer.concat([buf, Buffer.from([1, 2])])), parse(buf));
});

test('all lengths below 323 produce ParseError instead of partial telemetry', () => {
  const buf = createPacketFixture();
  for (let length = 0; length < 323; length++) {
    assert.throws(() => parse(buf.subarray(0, length)), error =>
      error instanceof ParseError && error.message.includes(`${length} bytes`));
  }
});

test('baseline documents nonfinite floats pass through and become null in serialized JSON', () => {
  const buf = createPacketFixture();
  buf.writeFloatLE(NaN, 244);
  buf.writeFloatLE(Infinity, 56);
  const packet = parse(buf);
  assert.ok(Number.isNaN(packet.positionX));
  assert.equal(packet.yaw, Infinity);
  const serialized = JSON.parse(JSON.stringify(toJSON(packet)));
  assert.equal(serialized.positionX, null);
  assert.equal(serialized.yaw, null);
  // This records current behavior, not approval for using invalid map coordinates.
});

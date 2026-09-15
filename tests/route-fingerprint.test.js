import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveFingerprintTimeline,
  extractLapFingerprints,
  extractRouteFingerprint,
} from '../src/routes/fingerprint.js';

const sample = (lapNumber, currentRaceTime, distanceTraveled, positionX, positionZ, extra = {}) => ({
  lapNumber, currentRaceTime, distanceTraveled, positionX, positionZ, ...extra,
});

function lap(lapNumber, raceOffset = 0, xOffset = 0) {
  const packets = [];
  for (let index = 0; index < 10; index++) {
    packets.push(sample(lapNumber, raceOffset + index, index * 650, xOffset + index * 10, index * 4));
  }
  return packets;
}

test('P8 fingerprint uses normalized progress and positional spans for a completed lap', () => {
  const packets = [...lap(0), sample(1, 10, 0, 0, 0)];
  const result = extractRouteFingerprint(packets);
  assert.deepEqual(result, {
    lapNumber: 0, startX: 0, startZ: 0,
    distanceSignature: 5850, spanX: 90, spanZ: 36,
    sampleCount: 10, rejectedSamples: 0, valid: true, reasons: [],
  });
});

test('P8 rewind removes superseded future samples without poisoning the recovered lap', () => {
  const packets = [
    ...lap(0).slice(0, 8),
    sample(0, 4, 2600, 40, 16, { timelineBreak: 'rewind' }),
    sample(0, 5, 3250, 50, 20), sample(0, 6, 3900, 60, 24),
    sample(0, 7, 4550, 70, 28), sample(0, 8, 5200, 80, 32),
    sample(0, 9, 5850, 90, 36), sample(1, 10, 0, 0, 0),
  ];
  const timeline = effectiveFingerprintTimeline(packets);
  assert.equal(timeline.filter(packet => packet.lapNumber === 0).length, 10);
  const result = extractRouteFingerprint(packets);
  assert.equal(result.valid, true);
  assert.equal(result.distanceSignature, 5850);
  assert.equal(result.spanX, 90);
});

test('P8 teleport-contaminated lap is rejected and a later clean completed lap is selected', () => {
  const dirty = lap(0);
  dirty[5] = sample(0, 5, 3250, 9999, -9999, { timelineBreak: 'teleport' });
  const packets = [...dirty, ...lap(1, 10, 100), sample(2, 20, 0, 0, 0)];
  const laps = extractLapFingerprints(packets);
  assert.equal(laps[0].valid, false);
  assert.ok(laps[0].reasons.includes('teleport'));
  const result = extractRouteFingerprint(packets);
  assert.equal(result.lapNumber, 1);
  assert.equal(result.startX, 100);
});

test('P8 too few samples and an unfinished final lap are not valid fingerprints', () => {
  const packets = [
    sample(0, 0, 0, 0, 0), sample(0, 1, 1000, 10, 5), sample(0, 2, 2000, 20, 10),
    ...lap(1, 3),
  ];
  const laps = extractLapFingerprints(packets);
  assert.ok(laps[0].reasons.includes('too-few-samples'));
  assert.ok(laps[1].reasons.includes('incomplete'));
  assert.equal(extractRouteFingerprint(packets).valid, false);
});

test('P8 non-finite values are skipped and reported without corrupting extents', () => {
  const packets = lap(0);
  packets.splice(4, 0,
    sample(0, 3.25, 2000, Number.NaN, 99999),
    sample(0, 3.5, Number.POSITIVE_INFINITY, -99999, 0));
  packets.push(sample(1, 10, 0, 0, 0));
  const result = extractRouteFingerprint(packets);
  assert.equal(result.valid, true);
  assert.equal(result.sampleCount, 10);
  assert.equal(result.rejectedSamples, 2);
  assert.equal(result.spanX, 90);
  assert.equal(result.spanZ, 36);
});

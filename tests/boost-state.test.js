import test from 'node:test';
import assert from 'node:assert/strict';
import { BoostStateTracker } from '../src/telemetry/boost-state.js';

const packet = (carOrdinal, boost, extra = {}) => ({
  carOrdinal, boost, carPi: 900, engineMaxRpm: 8000, ...extra
});

test('boost remains UNKNOWN until repeated positive capability evidence', () => {
  const tracker = new BoostStateTracker({ capabilitySamples: 3, confirmMs: 0 });
  assert.equal(tracker.update(packet(1, -0.2), 0).state, 'UNKNOWN');
  assert.equal(tracker.update(packet(1, 0.6), 10).state, 'UNKNOWN');
  assert.equal(tracker.update(packet(1, 0.7), 20).state, 'UNKNOWN');
  const result = tracker.update(packet(1, 0.1), 30);
  assert.equal(result.state, 'UNKNOWN');
  assert.equal(result.rawUnit, null);
  assert.equal(result.raw, 0.1);
  assert.equal(tracker.update(packet(1, 0.8), 40).state, 'ACTIVE');
});

test('READY and ACTIVE use separate enter and exit thresholds with confirmation', () => {
  const tracker = new BoostStateTracker({ capabilitySamples: 1, peakSamples: 99, confirmMs: 100 });
  tracker.update(packet(1, 0.6), 0);
  assert.equal(tracker.update(packet(1, 0.6), 100).state, 'ACTIVE');
  assert.equal(tracker.update(packet(1, 0.4), 150).state, 'ACTIVE');
  assert.equal(tracker.update(packet(1, 0.29), 200).pendingState, 'READY');
  assert.equal(tracker.update(packet(1, 0.31), 250).pendingState, null);
  tracker.update(packet(1, 0.2), 300);
  assert.equal(tracker.update(packet(1, 0.2), 400).state, 'READY');
  assert.equal(tracker.update(packet(1, 0.49), 500).state, 'READY');
});

test('PEAK needs mature samples and has ratio hysteresis', () => {
  const tracker = new BoostStateTracker({ capabilitySamples: 1, peakSamples: 4, confirmMs: 0 });
  tracker.update(packet(1, 2), 0);
  tracker.update(packet(1, 4), 10);
  tracker.update(packet(1, 6), 20);
  assert.equal(tracker.update(packet(1, 8), 30).state, 'PEAK');
  assert.equal(tracker.update(packet(1, 6.2), 40).state, 'PEAK'); // 0.775: above exit threshold
  assert.equal(tracker.update(packet(1, 6), 50).state, 'ACTIVE'); // 0.75: below exit threshold
  assert.equal(tracker.update(packet(1, 6.5), 60).state, 'ACTIVE'); // 0.8125: below enter threshold
  assert.equal(tracker.update(packet(1, 6.6), 70).state, 'PEAK');
});

test('profiles are isolated by carOrdinal and restored when switching back', () => {
  const tracker = new BoostStateTracker({ capabilitySamples: 1, peakSamples: 2, confirmMs: 0 });
  tracker.update(packet(11, 10), 0);
  tracker.update(packet(11, 9), 10);
  assert.equal(tracker.snapshot().observedPeakRaw, 10);

  let state = tracker.update(packet(22, 1), 20);
  assert.equal(state.carOrdinal, 22);
  assert.equal(state.observedPeakRaw, 1);
  state = tracker.update(packet(11, 5), 30);
  assert.equal(state.observedPeakRaw, 10);
  assert.equal(state.ratio, 0.5);
});

test('material identity signature change invalidates learning for the same ordinal', () => {
  const tracker = new BoostStateTracker({ capabilitySamples: 1, confirmMs: 0 });
  tracker.update(packet(7, 12), 0);
  const changed = tracker.update(packet(7, 1, { carPi: 700, engineMaxRpm: 6500 }), 10);
  assert.equal(changed.observedPeakRaw, 1);
  assert.equal(changed.sampleCount, 1);
});

test('invalid car identity or boost never invents a state or physical unit', () => {
  const tracker = new BoostStateTracker();
  assert.deepEqual(tracker.update({ carOrdinal: 0, boost: 2 }, 0), {
    state: 'UNKNOWN', pendingState: null, raw: 2, rawUnit: null, observedPeakRaw: null,
    ratio: null, carOrdinal: null, capable: false, sampleCount: 0, version: 0
  });
  assert.equal(tracker.update({ carOrdinal: 1, boost: NaN }, 10).state, 'UNKNOWN');
});

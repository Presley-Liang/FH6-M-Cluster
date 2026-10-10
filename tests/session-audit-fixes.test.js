import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionRuntime } from '../src/session/runtime.js';
import { SessionStore } from '../src/session/store.js';
import { buildCompactExport, calculateSessionStats } from '../src/session/export.js';
import { buildElapsedTimeline, createElapsedTimeline } from '../public/js/timeline-clock.js';
import { LiveRouteIdentifier } from '../src/routes/live-route-identifier.js';

const packet = (overrides = {}) => ({
  isRaceOn: 1, racePosition: 2, currentLap: 1, currentRaceTime: 1,
  timestampMs: 1000, carOrdinal: 3445, carClass: 5, carPi: 900,
  positionX: 10, positionZ: 20, lapNumber: 2, lastLap: 0,
  speedMs: 20, speedKmh: 72, currentEngineRpm: 4000, power: 100000,
  torque: 200, boost: 1.5, fuel: 0.5, throttle: 100, brake: 0, gear: 3,
  accelX: 0, accelZ: 0, tireTempFl: 60, tireTempFr: 60, tireTempRl: 60, tireTempRr: 60,
  ...overrides,
});

async function setup(t, options = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-session-audit-fixes-'));
  const store = new SessionStore(directory);
  await store.init();
  const runtime = new SessionRuntime(store, options);
  t.after(() => runtime.shutdown());
  return { store, runtime };
}

test('R24: receiver identity stays stable within one runtime and differs after a fresh receiver', async t => {
  const { store, runtime } = await setup(t);
  const id = runtime.state().receiverInstanceId;
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);
  await runtime.setMode('freeRoam');
  assert.equal(runtime.state().receiverInstanceId, id);
  assert.equal(runtime.process(packet(), 0).receiverInstanceId, id);
  const next = new SessionRuntime(store);
  assert.notEqual(next.state().receiverInstanceId, id);
  assert.equal(next.state().version, 0);
});

for (const recordingMode of ['race', 'freeRoam']) {
  test(`R27: ${recordingMode} splits at the first valid B packet despite pending presentation confirmation`, async t => {
    const { runtime, store } = await setup(t);
    if (recordingMode === 'freeRoam') {
      await runtime.setMode('freeRoam');
      await runtime.setRecording(true);
    }
    const first = runtime.process(packet(), 0);
    const oldId = first.sessionId;
    for (let i = 1; i <= 4; i++) runtime.process(packet({ timestampMs: 1000 + i * 50 }), i * 50);
    const next = runtime.process(packet({ carOrdinal: 3625, timestampMs: 1250, racePosition: 8 }), 250);
    assert.equal(next.activeVehicle.status, 'changing');
    assert.notEqual(next.sessionId, oldId);
    const newId = next.sessionId;
    runtime.process(packet({ carOrdinal: 3625, timestampMs: 1267, racePosition: 8 }), 267);
    await runtime.close('test-complete');
    await Promise.allSettled([...runtime.saves]);
    const original = await store.read(oldId);
    const current = await store.read(newId);
    assert.equal(original.packets.length, 5);
    assert.equal(current.packets.length, 2);
    assert.ok(original.packets.every(value => value.carOrdinal === original.carOrdinal));
    assert.ok(current.packets.every(value => value.carOrdinal === current.carOrdinal));
    assert.equal(current.packets[0].timestampMs, 1250);
    assert.equal(runtime.droppedPackets, 0);
  });
}

test('R27: B reverting to A preserves every eligible sample in three correctly identified sessions', async t => {
  const { runtime, store } = await setup(t);
  const packets = [
    packet({ timestampMs: 1000 }),
    packet({ timestampMs: 1017, carOrdinal: 3625 }),
    packet({ timestampMs: 1034 }),
  ];
  const ids = packets.map((value, index) => runtime.process(value, index * 17).sessionId);
  assert.equal(new Set(ids).size, 3);
  await runtime.close('test-complete');
  await Promise.allSettled([...runtime.saves]);
  const archives = await Promise.all(ids.map(id => store.read(id)));
  assert.deepEqual(archives.map(value => value.carOrdinal), [3445, 3625, 3445]);
  assert.deepEqual(archives.flatMap(value => value.packets.map(p => p.timestampMs)), [1000, 1017, 1034]);
});

test('R27: unconfirmed, ineligible menu packets stay realtime without entering either named car archive', async t => {
  const { runtime, store } = await setup(t);
  const first = runtime.process(packet(), 0);
  const boundary = runtime.process(packet({ carOrdinal: 3625, isRaceOn: 0, currentLap: 0, racePosition: 0 }), 17);
  assert.equal(boundary.carOrdinal, 3625);
  assert.equal(boundary.sessionId, null);
  const resumed = runtime.process(packet({ timestampMs: 1034 }), 34);
  assert.equal(resumed.sessionId, first.sessionId);
  assert.equal(resumed.timelineBreak, 'resume');
  await runtime.close('test-complete');
  assert.equal((await store.read(first.sessionId)).packets.length, 2);
});

test('R27: eligible unknown identity is disclosed and excluded, valid capture resumes without mixing', async t => {
  const { runtime, store } = await setup(t);
  await runtime.setMode('freeRoam');
  await runtime.setRecording(true);
  const first = runtime.process(packet(), 0);
  const unknown = runtime.process(packet({ carOrdinal: 0, timestampMs: 1017 }), 17);
  assert.equal(unknown.recordingBoundary, 'unknown-vehicle');
  assert.equal(unknown.sessionId, first.sessionId, 'live context survives without archive ownership');
  assert.equal(unknown.routeSampleAvailable, false);
  assert.equal(runtime.state().unattributedPackets, 1);
  assert.equal(runtime.droppedPackets, 0);
  const resumed = runtime.process(packet({ timestampMs: 1034 }), 34);
  assert.equal(resumed.sessionId, first.sessionId);
  assert.equal(resumed.timelineBreak, 'resume');
  await runtime.close('test-complete');
  const archive = await store.read(first.sessionId);
  assert.deepEqual(archive.packets.map(value => value.carOrdinal), [3445, 3445]);
  assert.equal(archive.unattributedPacketCount, 1);
  assert.ok(archive.segments.some(value => value.reason === 'unknown-vehicle'));
});

test('R27: an unknown first identity never opens a labelled session', async t => {
  const { runtime } = await setup(t);
  const unknown = runtime.process(packet({ carOrdinal: NaN }), 0);
  assert.equal(unknown.sessionId, null);
  assert.equal(runtime.active, null);
  assert.equal(runtime.state().unattributedPackets, 1);
  const valid = runtime.process(packet(), 17);
  assert.ok(valid.sessionId);
  assert.equal(runtime.active.carOrdinal, 3445);
});

for (const recordingMode of ['race', 'freeRoam']) {
  test(`P2: ${recordingMode} A -> unknown -> B splits ownership on the first valid B sample`, async t => {
    const { runtime, store } = await setup(t);
    if (recordingMode === 'freeRoam') {
      await runtime.setMode('freeRoam');
      await runtime.setRecording(true);
    }
    const a = runtime.process(packet(), 0);
    const unknown = runtime.process(packet({ carOrdinal: 0, timestampMs: 1017, positionX: 0, positionZ: 0 }), 17);
    assert.equal(unknown.sessionId, a.sessionId);
    assert.equal(unknown.routeSampleAvailable, false);
    const b = runtime.process(packet({ carOrdinal: 3625, timestampMs: 1034 }), 34);
    assert.ok(b.sessionId);
    assert.notEqual(b.sessionId, a.sessionId);
    assert.equal(b.routeSampleAvailable, true);
    await runtime.close('test-complete');
    await Promise.allSettled([...runtime.saves]);
    const old = await store.read(a.sessionId);
    const next = await store.read(b.sessionId);
    assert.equal(old.closeReason, 'car-change');
    assert.deepEqual(old.packets.map(value => value.carOrdinal), [3445]);
    assert.deepEqual(next.packets.map(value => value.carOrdinal), [3625]);
    assert.equal(next.packets[0].timestampMs, 1034);
  });
}

test('P2: unknown placeholder samples retain the matched live route and never enter its fingerprint/archive', async t => {
  const live = new LiveRouteIdentifier({ routes: [{
    id: 'test-route', name: 'Test Route', kind: 'circuit',
    start: { x: 100, z: 200 }, distance: 5850, span: { x: 900, z: 360 },
  }] });
  const { runtime, store } = await setup(t, { liveRouteIdentifier: live, resolveRoute: () => ({ id: 77 }) });
  const sample = index => packet({
    timestampMs: 1000 + index * 100, currentRaceTime: index, currentLap: index,
    distanceTraveled: index * 650, positionX: 100 + index * 100, positionZ: 200 + index * 40,
  });
  let last;
  for (let index = 0; index < 10; index++) last = runtime.process(sample(index), index * 100);
  assert.equal(last.activeRoute.status, 'matched');
  const before = live.state();
  const unknown = runtime.process(packet({ carOrdinal: 0, timestampMs: 1917,
    currentLap: 0, currentRaceTime: 0, lapNumber: 0, positionX: 0, positionZ: 0, distanceTraveled: 0,
  }), 917);
  assert.equal(unknown.sessionId, last.sessionId);
  assert.equal(unknown.activeRoute.routeId, 77);
  assert.deepEqual(live.state(), before, 'matcher ignores placeholder lap/position/time');
  const resumed = runtime.process(sample(10), 1000);
  assert.equal(resumed.sessionId, last.sessionId);
  assert.equal(resumed.timelineBreak, 'resume');
  assert.equal(resumed.activeRoute.routeId, 77);
  await runtime.close('test-complete');
  assert.equal(runtime.activeRoute, null);
  assert.equal(live.state().sessionId, null);
  const archive = await store.read(last.sessionId);
  assert.equal(archive.packets.length, 11);
  assert.ok(archive.packets.every(value => value.carOrdinal === 3445));
  const afterClose = runtime.process(packet({ carOrdinal: 0 }), 1017);
  assert.equal(afterClose.sessionId, null);
  assert.equal(afterClose.activeRoute, null);
  assert.equal(live.state().sampleCount, 0);
});

test('R31: compact schema exports boost as raw data with unknown unit and explicit migration', () => {
  const data = buildCompactExport([packet()], [], -1, { carOrdinal: 3445 });
  assert.equal(data.schemaVersion, 3);
  assert.equal(data.summary.maxRawBoost, 1.5);
  assert.equal(data.samples[0].rawBoost, 1.5);
  assert.equal(data.sectors[0].avgRawBoost, 1.5);
  assert.equal(data.fieldUnits.rawBoost, null);
  assert.equal(data.boostEncoding.unit, null);
  assert.equal(data.compatibility.renamedRawFields.boostPsi, 'rawBoost');
  assert.equal('maxBoostPsi' in data.summary, false);
  assert.equal('boostPsi' in data.samples[0], false);
  assert.equal('avgBoostPsi' in data.sectors[0], false);
});

test('R31: missing boost is unknown and negative raw values remain unconverted', () => {
  const missing = buildCompactExport([packet({ boost: undefined })], [], -1, {});
  assert.equal(missing.summary.maxRawBoost, null);
  assert.equal(missing.samples[0].rawBoost, null);
  assert.equal(missing.sectors[0].avgRawBoost, null);
  const stats = calculateSessionStats([packet({ boost: -1.5 })]);
  assert.equal(stats.maxRawBoost, -1.5);
  assert.equal(stats.maxBoost, -1.5);
  assert.equal(stats.boostUnit, null);
});

test('R32: self-contained timeline embeds, unwraps u32 and streams with identical results', () => {
  const packets = [packet({ timestampMs: 4294967280 }), packet({ timestampMs: 17 }), packet({ timestampMs: 50 })];
  const standalone = Function(`return (${buildElapsedTimeline.toString()})`)();
  const rows = standalone(packets);
  assert.deepEqual(rows.map(value => value.elapsedMs), [0, 33, 66]);
  assert.equal(rows[1].discontinuity, 'timestamp-wrap');
  const clock = createElapsedTimeline();
  assert.deepEqual(packets.map(value => clock.update(value)), rows);
  assert.deepEqual(clock.snapshot(), { elapsedMs: 66, segment: 1 });
});

test('R32: actual receive time handles reset and differing packet frequencies without a negative duration', () => {
  const packets = [
    packet({ timestampMs: 5000, receivedAt: 1000 }),
    packet({ timestampMs: 20, receivedAt: 1033 }),
    packet({ timestampMs: 70, receivedAt: 1066 }),
  ];
  const rows = buildElapsedTimeline(packets);
  assert.deepEqual(rows.map(value => value.elapsedMs), [0, 33, 66]);
  assert.equal(rows[1].discontinuity, 'timestamp-reset-or-backtrack');
  assert.equal(rows[1].source, 'receivedAt');
  assert.equal(calculateSessionStats(packets).durationMs, 66);
  assert.equal(buildCompactExport(packets, [], -1, {}).summary.durationMs, 66);
});

test('R32: old archives without arrival times do not invent reset elapsed time or frame rate', () => {
  const rows = buildElapsedTimeline([
    packet({ timestampMs: 5000 }), packet({ timestampMs: 20 }), packet({ timestampMs: 53 }),
  ]);
  assert.deepEqual(rows.map(value => value.elapsedMs), [0, 0, 33]);
  assert.equal(rows[1].source, 'unknown');
  assert.deepEqual(buildElapsedTimeline([{}, {}, {}]).map(value => value.elapsedMs), [0, 0, 0]);
});

test('R32: saved header, full stats and compact export share the monotonic elapsed duration', async t => {
  const { store } = await setup(t);
  const meta = { id: store.nextId(), carOrdinal: 3445, laps: [], driveMode: 'freeRoam' };
  store.open(meta);
  const packets = [
    packet({ timestampMs: 4294967280, receivedAt: 1000 }),
    packet({ timestampMs: 17, receivedAt: 1033 }),
  ];
  packets.forEach(value => store.append(meta.id, value));
  await store.finalize(meta);
  const saved = await store.read(meta.id);
  assert.equal(saved.stats.durationMs, 33);
  assert.equal(calculateSessionStats(saved.packets).durationMs, 33);
  assert.equal(buildCompactExport(saved.packets, [], -1, saved).summary.durationMs, 33);
  assert.equal(saved.stats.maxRawBoost, 1.5);
  assert.equal(saved.stats.boostUnit, null);
});

test('R32: legacy negative archive durations are corrected on read/list without rewriting the original', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fh6-session-negative-legacy-'));
  const store = new SessionStore(directory);
  t.after(() => store.shutdown());
  const legacy = {
    id: Date.now(), carOrdinal: 3445, endedAt: '2026-10-08T00:00:00Z', laps: [],
    stats: { durationMs: -4294967263 },
    packets: [packet({ timestampMs: 4294967280 }), packet({ timestampMs: 17 })],
  };
  const filename = resolve(directory, `session_${legacy.id}_3445.json`);
  const original = JSON.stringify(legacy);
  await writeFile(filename, original);
  const { packets, ...metadata } = legacy;
  await writeFile(filename.replace('.json', '.meta.json'), JSON.stringify(metadata));
  await store.init();
  assert.equal(store.list()[0].stats.durationMs, 33);
  assert.equal((await store.read(legacy.id)).stats.durationMs, 33);
  assert.equal(await readFile(filename, 'utf8'), original);
});

for (const count of [1, 3, 10, 17, 21]) {
  test(`R33: all ${count} packets belong to exactly one segment including the last sample`, () => {
    const packets = Array.from({ length: count }, (_, index) => packet({
      timestampMs: index * 17,
      speedKmh: index === count - 1 ? 324 : 72,
    }));
    const compact = buildCompactExport(packets, [{ lapNumber: 2, lapTime: 60 }], 60, {});
    assert.equal(compact.sectors.reduce((sum, value) => sum + value.packetCount, 0), count);
    assert.equal(compact.sectors.at(-1).endPacketIndexExclusive, count);
    assert.equal(compact.sectors.at(-1).maxSpeedKmh, 324);
    assert.ok(compact.sectors.every(value => value.lapIndex === 0 && value.lapNumber === 2));
    assert.equal(compact.lapStats[0].lapNumber, 2);
    assert.equal(compact.sectorPolicy.includes('not official game sectors'), true);
  });
}

test('R33: resumed lap IDs retain their original identifier and distinct packet-run indices', () => {
  const packets = [2, 2, 3, 3, 2].map((lapNumber, index) => packet({ lapNumber, timestampMs: index * 17 }));
  const compact = buildCompactExport(packets, [], -1, {});
  assert.deepEqual(compact.sectors.map(value => [value.lapIndex, value.lapNumber]), [[0, 2], [0, 2], [1, 3], [1, 3], [2, 2]]);
  assert.equal(compact.sectors.reduce((sum, value) => sum + value.packetCount, 0), 5);
});

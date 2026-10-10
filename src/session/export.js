import { buildElapsedTimeline } from '../../public/js/timeline-clock.js';

export function formatTime(seconds) {
  if (seconds <= 0 || !isFinite(seconds)) return "--:--.---";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function downsample(packets, factor) {
  if (factor <= 1) return packets;
  const result = [];
  for (let i = 0; i < packets.length; i += factor) {
    result.push(packets[i]);
  }
  return result;
}

export function buildCompactExport(sessionPackets, sessionLaps, bestLap, sessionInfo) {
  const pkts = sessionPackets;
  if (pkts.length === 0) return null;
  const elapsedTimeline = buildElapsedTimeline(pkts);

  // ── Summary ──────────────────────────────────────────────────────
  let maxSpeed = 0,
    maxRpm = 0,
    maxPower = 0,
    maxTorque = 0,
    maxBoost = -Infinity;
  let totalFuel = 0,
    fuelSamples = 0;
  let maxLatG = 0,
    maxLongG = 0;

  for (const p of pkts) {
    if (p.speedKmh > maxSpeed) maxSpeed = p.speedKmh;
    if (p.currentEngineRpm > maxRpm) maxRpm = p.currentEngineRpm;
    if (p.power > maxPower) maxPower = p.power;
    if (p.torque > maxTorque) maxTorque = p.torque;
    if (Number.isFinite(p.boost) && p.boost > maxBoost) maxBoost = p.boost;
    if (p.fuel > 0) {
      totalFuel += p.fuel;
      fuelSamples++;
    }
    const latG = Math.abs(p.accelX / 9.80665);
    const longG = Math.abs(p.accelZ / 9.80665);
    if (latG > maxLatG) maxLatG = latG;
    if (longG > maxLongG) maxLongG = longG;
  }

  const summary = {
    carOrdinal: sessionInfo.carOrdinal,
    carClass: sessionInfo.carClass,
    carPi: sessionInfo.carPi,
    durationMs: elapsedTimeline[elapsedTimeline.length - 1].elapsedMs,
    packetCount: pkts.length,
    lapCount: sessionLaps.length,
    bestLap: bestLap > 0 ? Math.round(bestLap * 1000) / 1000 : null,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    maxRpm: Math.round(maxRpm),
    maxPowerKw: Math.round((maxPower / 1000) * 10) / 10,
    maxTorqueNm: Math.round(maxTorque * 10) / 10,
    maxRawBoost: Number.isFinite(maxBoost) ? Math.round(maxBoost * 100) / 100 : null,
    avgFuel:
      fuelSamples > 0
        ? Math.round((totalFuel / fuelSamples) * 1000) / 1000
        : null,
    maxLatG: Math.round(maxLatG * 100) / 100,
    maxLongG: Math.round(maxLongG * 100) / 100,
  };

  // ── Per-lap stats ────────────────────────────────────────────────
  const lapStats = sessionLaps.map((lap) => {
    return {
      lapNumber: lap.lapNumber,
      lapTime: Math.round(lap.lapTime * 1000) / 1000,
    };
  });

  // ── Sectors (10 per lap) ────────────────────────────────────────
  const sectors = [];
  const lapBoundaries = [0];
  for (let i = 1; i < pkts.length; i++) {
    if (pkts[i].lapNumber !== pkts[i - 1].lapNumber) {
      lapBoundaries.push(i);
    }
  }
  lapBoundaries.push(pkts.length);

  for (let li = 0; li < lapBoundaries.length - 1; li++) {
    const start = lapBoundaries[li];
    const end = lapBoundaries[li + 1];
    const lapPkts = pkts.slice(start, end);
    const sectorsPerLap = Math.min(10, lapPkts.length);

    for (let s = 0; s < sectorsPerLap; s++) {
      const segmentStart = Math.floor(s * lapPkts.length / sectorsPerLap);
      const segmentEnd = Math.floor((s + 1) * lapPkts.length / sectorsPerLap);
      const seg = lapPkts.slice(segmentStart, segmentEnd);
      if (seg.length === 0) continue;

      let sumSpeed = 0,
        segMaxSpeed = 0,
        sumRpm = 0,
        segMaxRpm = 0;
      let sumThrottle = 0,
        sumBrake = 0;
      let sumLatG = 0,
        sumLongG = 0;
      let sumTempFl = 0,
        sumTempFr = 0,
        sumTempRl = 0,
        sumTempRr = 0;
      let sumBoost = 0, boostSamples = 0,
        sumPower = 0;

      for (const p of seg) {
        sumSpeed += p.speedKmh;
        if (p.speedKmh > segMaxSpeed) segMaxSpeed = p.speedKmh;
        sumRpm += p.currentEngineRpm;
        if (p.currentEngineRpm > segMaxRpm) segMaxRpm = p.currentEngineRpm;
        sumThrottle += p.throttle;
        sumBrake += p.brake;
        sumLatG += Math.abs(p.accelX / 9.80665);
        sumLongG += Math.abs(p.accelZ / 9.80665);
        sumTempFl += p.tireTempFl;
        sumTempFr += p.tireTempFr;
        sumTempRl += p.tireTempRl;
        sumTempRr += p.tireTempRr;
        if (Number.isFinite(p.boost)) { sumBoost += p.boost; boostSamples++; }
        sumPower += p.power;
      }
      const n = seg.length;
      sectors.push({
        lap: li,
        lapIndex: li,
        lapNumber: Number.isFinite(lapPkts[0].lapNumber) ? lapPkts[0].lapNumber : null,
        sector: s,
        sectorKind: 'equal-packet-segment',
        startPacketIndex: start + segmentStart,
        endPacketIndexExclusive: start + segmentEnd,
        packetCount: n,
        avgSpeedKmh: Math.round((sumSpeed / n) * 10) / 10,
        maxSpeedKmh: Math.round(segMaxSpeed * 10) / 10,
        avgRpm: Math.round(sumRpm / n),
        maxRpm: Math.round(segMaxRpm),
        avgThrottlePct: Math.round((sumThrottle / n / 255) * 100),
        avgBrakePct: Math.round((sumBrake / n / 255) * 100),
        avgLatG: Math.round((sumLatG / n) * 100) / 100,
        avgLongG: Math.round((sumLongG / n) * 100) / 100,
        avgTireTempFl: Math.round((sumTempFl / n) * 10) / 10,
        avgTireTempFr: Math.round((sumTempFr / n) * 10) / 10,
        avgTireTempRl: Math.round((sumTempRl / n) * 10) / 10,
        avgTireTempRr: Math.round((sumTempRr / n) * 10) / 10,
        avgRawBoost: boostSamples ? Math.round((sumBoost / boostSamples) * 100) / 100 : null,
        avgPowerKw: Math.round((sumPower / n / 1000) * 10) / 10,
      });
    }
  }

  // Every 30th packet; elapsedMs conveys actual time rather than assuming Hz.
  const sampleFactor = 30;
  const samples = [];
  for (let i = 0; i < pkts.length; i += sampleFactor) {
    const p = pkts[i];
    samples.push({
      i,
      elapsedMs: elapsedTimeline[i].elapsedMs,
      speedKmh: Math.round(p.speedKmh * 10) / 10,
      rpm: Math.round(p.currentEngineRpm),
      powerKw: Math.round((p.power / 1000) * 10) / 10,
      torqueNm: Math.round(p.torque * 10) / 10,
      throttlePct: Math.round((p.throttle / 255) * 100),
      brakePct: Math.round((p.brake / 255) * 100),
      gear: p.gear,
      latG: Math.round((p.accelX / 9.80665) * 100) / 100,
      longG: Math.round((p.accelZ / 9.80665) * 100) / 100,
      tireTempFl: Math.round(p.tireTempFl * 10) / 10,
      tireTempFr: Math.round(p.tireTempFr * 10) / 10,
      tireTempRl: Math.round(p.tireTempRl * 10) / 10,
      tireTempRr: Math.round(p.tireTempRr * 10) / 10,
      rawBoost: Number.isFinite(p.boost) ? Math.round(p.boost * 100) / 100 : null,
      fuel: Math.round(p.fuel * 1000) / 1000,
      lapNumber: p.lapNumber,
      racePosition: p.racePosition,
    });
  }

  return {
    schemaVersion: 3,
    fieldUnits: { durationMs: 'ms', elapsedMs: 'ms', lapTime: 's', bestLap: 's', rawBoost: null, maxRawBoost: null, avgRawBoost: null },
    boostEncoding: { sourceField: 'boost', kind: 'unconverted-protocol-value', unit: null },
    compatibility: {
      previousSchemaVersion: 2,
      renamedRawFields: { maxBoostPsi: 'maxRawBoost', avgBoostPsi: 'avgRawBoost', boostPsi: 'rawBoost' },
      note: 'Previous PSI names contained unconverted raw values; no physical pressure unit has been established.',
      lap: 'zero-based packet-run index; lapNumber is the original telemetry lap identifier',
    },
    sectorPolicy: 'up to 10 equal packet segments per contiguous lap; not official game sectors',
    samplePolicy: { packetStride: sampleFactor, timeField: 'elapsedMs', assumedHz: null },
    summary, lapStats, sectors, samples,
  };
}

export function calculateSessionStats(packets) {
  if (packets.length === 0) return null;

  let maxSpeed = 0;
  let maxRpm = 0;
  let maxPower = 0;
  let totalFuel = 0;
  let fuelSamples = 0;
  let maxBoost = -Infinity;
  const elapsedTimeline = buildElapsedTimeline(packets);

  for (const pkt of packets) {
    if (pkt.speedMs > maxSpeed) maxSpeed = pkt.speedMs;
    if (pkt.currentEngineRpm > maxRpm) maxRpm = pkt.currentEngineRpm;
    if (pkt.power > maxPower) maxPower = pkt.power;
    if (Number.isFinite(pkt.boost) && pkt.boost > maxBoost) maxBoost = pkt.boost;
    if (pkt.fuel > 0) {
      totalFuel += pkt.fuel;
      fuelSamples++;
    }
  }

  return {
    maxSpeedMs: Math.round(maxSpeed * 1000) / 1000,
    maxSpeedKmh: Math.round(maxSpeed * 3.6 * 100) / 100,
    maxRpm: Math.round(maxRpm),
    maxPower: Math.round(maxPower),
    avgFuel:
      fuelSamples > 0
        ? Math.round((totalFuel / fuelSamples) * 100) / 100
        : null,
    maxRawBoost: Number.isFinite(maxBoost) ? Math.round(maxBoost * 100) / 100 : null,
    maxBoost: Number.isFinite(maxBoost) ? Math.round(maxBoost * 100) / 100 : null,
    boostUnit: null,
    durationMs: elapsedTimeline[elapsedTimeline.length - 1].elapsedMs,
    packetCount: packets.length,
  };
}



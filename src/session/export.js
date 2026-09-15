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
    if (p.boost > maxBoost) maxBoost = p.boost;
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
    durationMs:
      pkts.length > 0
        ? pkts[pkts.length - 1].timestampMs - pkts[0].timestampMs
        : 0,
    packetCount: pkts.length,
    lapCount: sessionLaps.length,
    bestLap: bestLap > 0 ? Math.round(bestLap * 1000) / 1000 : null,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    maxRpm: Math.round(maxRpm),
    maxPowerKw: Math.round((maxPower / 1000) * 10) / 10,
    maxTorqueNm: Math.round(maxTorque * 10) / 10,
    maxBoostPsi: Math.round(maxBoost * 100) / 100,
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
    if (lapPkts.length < 10) continue;
    const sectorsPerLap = 10;
    const sectorSize = Math.floor(lapPkts.length / sectorsPerLap);

    for (let s = 0; s < sectorsPerLap; s++) {
      const seg = lapPkts.slice(s * sectorSize, (s + 1) * sectorSize);
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
      let sumBoost = 0,
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
        sumBoost += p.boost;
        sumPower += p.power;
      }
      const n = seg.length;
      sectors.push({
        lap: li,
        sector: s,
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
        avgBoostPsi: Math.round((sumBoost / n) * 100) / 100,
        avgPowerKw: Math.round((sumPower / n / 1000) * 10) / 10,
      });
    }
  }

  // ── Downsampled samples (1/sec, ≈30:1 ratio) ─────────────────────
  const sampleFactor = 30;
  const samples = [];
  for (let i = 0; i < pkts.length; i += sampleFactor) {
    const p = pkts[i];
    samples.push({
      i,
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
      boostPsi: Math.round(p.boost * 100) / 100,
      fuel: Math.round(p.fuel * 1000) / 1000,
      lapNumber: p.lapNumber,
      racePosition: p.racePosition,
    });
  }

  return { summary, lapStats, sectors, samples };
}

export function calculateSessionStats(packets) {
  if (packets.length === 0) return null;

  let maxSpeed = 0;
  let maxRpm = 0;
  let maxPower = 0;
  let totalFuel = 0;
  let fuelSamples = 0;
  let maxBoost = 0;

  for (const pkt of packets) {
    if (pkt.speedMs > maxSpeed) maxSpeed = pkt.speedMs;
    if (pkt.currentEngineRpm > maxRpm) maxRpm = pkt.currentEngineRpm;
    if (pkt.power > maxPower) maxPower = pkt.power;
    if (pkt.boost > maxBoost) maxBoost = pkt.boost;
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
    maxBoost: Math.round(maxBoost * 100) / 100,
    durationMs:
      packets.length > 0
        ? packets[packets.length - 1].timestampMs - packets[0].timestampMs
        : 0,
    packetCount: packets.length,
  };
}



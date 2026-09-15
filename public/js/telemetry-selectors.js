// Pure presentation projection. Kept self-contained for embedding in the UI bundle.
export function selectTelemetry(packet, stale = false) {
  const p = packet && typeof packet === 'object' ? packet : {};
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const scale = (value, factor) => number(value) === null ? null : number(value * factor);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const percent = value => number(value) === null ? null : clamp(value / 255 * 100, 0, 100);
  const enumLabel = (value, labels) => number(value) === null ? '—' : labels[value] ?? ('UNKNOWN (' + value + ')');
  const rpm = number(p.currentEngineRpm);
  const engineMaxRpm = number(p.engineMaxRpm);
  const gearRaw = number(p.gear);
  const carId = number(p.carOrdinal);
  const steer = number(p.steer);
  return {
    stale: Boolean(stale),
    speedKmh: number(p.speedKmh) ?? scale(p.speedMs, 3.6),
    rpm,
    engineMaxRpm,
    rpmRatio: stale || rpm === null || engineMaxRpm === null || engineMaxRpm <= 0
      ? null : clamp(rpm / engineMaxRpm, 0, 1.1),
    // Mappings confirmed against both downloaded FH6 reference implementations.
    gearRaw,
    gearLabel: gearRaw === null ? '—' : gearRaw === 0 ? 'R' : gearRaw === 11 ? 'N'
      : Number.isInteger(gearRaw) && gearRaw >= 1 && gearRaw <= 10 ? String(gearRaw) : 'RAW ' + gearRaw,
    powerKw: scale(p.power, 0.001),
    torque: number(p.torque),
    // Neither unit is established by this parser: never label as bar or percent.
    boostRaw: number(p.boost),
    fuelRaw: number(p.fuel),
    throttlePercent: percent(p.throttle),
    brakePercent: percent(p.brake),
    clutchPercent: percent(p.clutch),
    handbrakePercent: percent(p.handbrake),
    steerNormalized: steer === null ? null : clamp(steer / (steer < 0 ? 128 : 127), -1, 1),
    gX: scale(p.accelX, 1 / 9.80665),
    gY: scale(p.accelY, 1 / 9.80665),
    gZ: scale(p.accelZ, 1 / 9.80665),
    yawDegrees: scale(p.yaw, 180 / Math.PI),
    pitchDegrees: scale(p.pitch, 180 / Math.PI),
    rollDegrees: scale(p.roll, 180 / Math.PI),
    positionX: number(p.positionX),
    positionY: number(p.positionY),
    positionZ: number(p.positionZ),
    wheels: ['Fl', 'Fr', 'Rl', 'Rr'].map(suffix => ({
      id: suffix.toUpperCase(),
      tempC: number(p['tireTemp' + suffix]),
      slipRatio: number(p['tireSlipRatio' + suffix]),
      slipAngle: number(p['tireSlipAngle' + suffix]),
      combinedSlip: number(p['tireCombinedSlip' + suffix]),
      travelNormalized: number(p['suspension' + suffix]),
      travelMeters: number(p['suspensionTravelMeters' + suffix]),
    })),
    carId,
    carLabel: carId === null ? '—' : 'CAR #' + carId,
    classLabel: enumLabel(p.carClass, ['D', 'C', 'B', 'A', 'S1', 'S2', 'X']),
    pi: number(p.carPi),
    drivetrainLabel: enumLabel(p.drivetrainType, ['FWD', 'RWD', 'AWD']),
    currentLap: number(p.currentLap),
    lastLap: number(p.lastLap),
    bestLap: number(p.bestLap),
    rank: number(p.racePosition),
    lapNumber: number(p.lapNumber),
    raceTime: number(p.currentRaceTime),
    unavailable: { tireWear: true, coolantTemperature: true },
  };
}

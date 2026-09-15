export function niceRpmScale(rawMaxRpm) {
  const raw = Number(rawMaxRpm);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const wanted = raw + Math.max(100, raw * 0.01);
  const candidates = [5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000,11000,12000];
  const match = candidates.find(value => value >= wanted);
  return match ?? Math.min(20000, Math.ceil(wanted / 1000) * 1000);
}

export function createRpmGaugeController() {
  let scaleVersion = -1, gaugeMax = null, engineMaxRpm = null;
  function update(packet = {}, vehicleState = {}, stale = false) {
    const vehicle = vehicleState.status === 'locked' ? vehicleState.vehicle : null;
    if (stale || !vehicle || Number(packet.carOrdinal) !== vehicle.carOrdinal) {
      return { available: false, gaugeMax: null, engineMaxRpm: null, majorTicks: [], gaugeFraction: null, rpmRatio: null, redlineStartFraction: null, redlineEndFraction: null, scaleVersion };
    }
    const nextEngineMax = Number(vehicle.engineMaxRpm);
    const nextGaugeMax = niceRpmScale(nextEngineMax);
    if (!nextGaugeMax) return { available: false, gaugeMax: null, engineMaxRpm: null, majorTicks: [], gaugeFraction: null, rpmRatio: null, redlineStartFraction: null, redlineEndFraction: null, scaleVersion };
    if (vehicleState.vehicleVersion !== scaleVersion || nextGaugeMax !== gaugeMax || nextEngineMax !== engineMaxRpm) {
      scaleVersion = vehicleState.vehicleVersion; gaugeMax = nextGaugeMax; engineMaxRpm = nextEngineMax;
    }
    const current = Number(packet.currentEngineRpm);
    const rpm = Number.isFinite(current) && current >= 0 ? current : null;
    const step = gaugeMax <= 9000 ? 1000 : 2000;
    const majorTicks = [];
    for (let value = 0; value <= gaugeMax; value += step) majorTicks.push(value / 1000);
    if (majorTicks.at(-1) * 1000 !== gaugeMax) majorTicks.push(gaugeMax / 1000);
    return {
      available: true, gaugeMax, engineMaxRpm, majorTicks, scaleVersion,
      gaugeFraction: rpm === null ? null : Math.max(0, Math.min(1, rpm / gaugeMax)),
      rpmRatio: rpm === null ? null : Math.max(0, Math.min(1.1, rpm / engineMaxRpm)),
      redlineStartFraction: 0.9 * engineMaxRpm / gaugeMax,
      redlineEndFraction: engineMaxRpm / gaugeMax,
    };
  }
  return { update };
}

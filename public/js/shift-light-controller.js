export function createShiftLightController({ hysteresis = 0.015 } = {}) {
  let level = 0;
  const thresholds = [0.75, 0.90, 0.97];
  function update(ratio, active = true) {
    if (!active || !Number.isFinite(ratio) || ratio < 0) { level = 0; return { level: 'off', segments: 0, ratio: null }; }
    while (level < thresholds.length && ratio >= thresholds[level]) level += 1;
    while (level > 0 && ratio < thresholds[level - 1] - hysteresis) level -= 1;
    const segments = level === 0 ? 0 : Math.max(1, Math.min(11, Math.ceil(((Math.min(1, ratio) - thresholds[0]) / (1 - thresholds[0])) * 11)));
    return { level: ['off','warm','hot','limit'][level], segments, ratio: Math.min(1, ratio) };
  }
  return { update, reset() { level = 0; return { level: 'off', segments: 0, ratio: null }; } };
}

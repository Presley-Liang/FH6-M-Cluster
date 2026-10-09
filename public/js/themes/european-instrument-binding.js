import { createModernInstrumentBinding } from './modern-instrument-binding.js';

// Data projection for the three European layouts, serialized with the page.
// Each instrument owns its geometry; animation and signal freshness stay shared.
export function createEuropeanInstrumentBinding({ element, mount }) {
  const bind = createModernInstrumentBinding({ element, mount, project(values, labels, state) {
    if (state.mode !== 'freeRoam') return;
    labels.b = 'LATERAL G'; labels.bUnit = 'g';
    values.b = state.live && Number.isFinite(state.model.gX) ? state.model.gX.toFixed(2) : '—';
  } });
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const clamp = value => Math.max(0, Math.min(1, value));
  const write = (key, value) => {
    for (const node of element.querySelectorAll('[data-eu-value="' + key + '"]')) {
      if (node.textContent !== value) node.textContent = value;
    }
  };
  return function update(model = {}, context = {}) {
    bind(model, context);
    const live = !Boolean(context.stale ?? model.stale);
    const ev = element.dataset.powertrain === 'ev';
    const max = finite(context.rpmGauge?.gaugeMax) && context.rpmGauge.gaugeMax > 0
      ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) && model.engineMaxRpm > 0 ? model.engineMaxRpm : null;
    const sweep = finite(context.displayOverride?.speed) && finite(context.displayOverride?.rpm);
    const stops = [0, 20, 40, 60, 100, 140, 200, 260];
    const position = sweep ? clamp(context.displayOverride.speed) * 7 : 0;
    const index = Math.min(6, Math.floor(position));
    const speed = sweep ? stops[index] + (stops[index + 1] - stops[index]) * (position - index)
      : live && finite(model.speedKmh) ? model.speedKmh : null;
    const input = live && finite(model.throttlePercent) ? model.throttlePercent : null;
    const drive = sweep ? ev ? clamp(context.displayOverride.rpm) * 100 : max === null ? null : clamp(context.displayOverride.rpm) * max
      : live ? ev ? input : finite(model.rpm) ? model.rpm : null : null;
    const fraction = sweep ? clamp(context.displayOverride.rpm)
      : ev ? clamp((input ?? 0) / 100) : max && drive !== null ? clamp(drive / max) : 0;
    const temperatures = live ? (model.wheels || []).map(wheel => wheel.tempC).filter(finite) : [];
    const temperature = temperatures.length ? Math.max(...temperatures) : null;
    write('drive', drive === null ? '—' : String(Math.round(drive)));
    write('driveLabel', ev ? 'DRIVE INPUT' : sweep && max === null ? 'DISPLAY SCAN' : 'ENGINE SPEED');
    write('driveUnit', ev ? '%' : 'RPM');
    write('scale', ev ? '0—100 %' : max ? '0—' + Math.round(max) + ' RPM' : sweep ? 'DISPLAY SCAN' : '— RPM');
    write('temperature', temperature === null ? '—' : String(Math.round(temperature)));
    element.dataset.sweep = String(sweep);
    return { speed, fraction, input, temperature, sweep, live, ev };
  };
}

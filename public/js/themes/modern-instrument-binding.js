// Shared data projection only. Each caller owns a separate instrument layout.
// Serialized into the standalone page; keep all helpers inside the factory.
export function createModernInstrumentBinding({ element, mount, project }) {
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-next-value]')).map(n => [n.dataset.nextValue, n]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-next-label]')).map(n => [n.dataset.nextLabel, n]));
  const ticks = Array.from(element.querySelectorAll('[data-next-tick]'));
  const fill = element.querySelector('[data-next-fill]');
  const number = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const whole = n => number(n) === null ? '—' : String(Math.round(n));
  const time = n => number(n) === null || n <= 0 ? '—' : Math.floor(n / 60) + ':' + (n % 60).toFixed(2).padStart(5, '0');
  const write = (nodes, key, text) => { if (nodes[key] && nodes[key].textContent !== text) nodes[key].textContent = text; };
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedAt = fraction => {
    const p = clamp(fraction) * 7, i = Math.min(6, Math.floor(p));
    return speedStops[i] + (speedStops[i + 1] - speedStops[i]) * (p - i);
  };
  let priorMode = 'race', priorScale = '', priorFill = -1, priorShift = false;
  return function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live';
    const outgoing = root?.dataset.ignitionKind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase);
    const requested = ['freeRoam', 'free'].includes(context.mode) ? 'freeRoam' : 'race';
    const mode = outgoing ? priorMode : requested;
    priorMode = mode;
    const live = !Boolean(context.stale ?? model.stale);
    const ev = ['ev', 'electric'].includes(String(context.powertrain || '').toLowerCase());
    const override = context.displayOverride;
    const sweep = number(override?.speed) !== null && number(override?.rpm) !== null;
    const gauge = context.rpmGauge;
    const max = gauge == null ? number(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null
      : gauge.available !== false && number(gauge.gaugeMax) > 0 ? gauge.gaugeMax : null;
    const rpm = sweep ? max === null ? null : clamp(override.rpm) * max : live ? number(model.rpm) : null;
    const speed = sweep ? speedAt(override.speed) : live ? number(model.speedKmh) : null;
    const power = live ? number(model.powerKw) : null;
    const input = live ? number(model.throttlePercent) : null;
    const gear = live ? String(model.gearLabel ?? '—') : '—';
    const racing = live && Boolean(context.racing);
    const temps = live ? (model.wheels || []).map(w => w.tempC).filter(v => number(v) !== null) : [];
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = live ? 'live' : 'absent';
    const fraction = ev ? sweep ? clamp(override.rpm) : clamp((input ?? 0) / 100) : sweep ? clamp(override.rpm) : rpm === null || max === null ? 0 : clamp(rpm / max);
    if (Math.abs(fraction - priorFill) > .001) {
      if (fill?.dataset.nextFill === 'arc') fill.style.strokeDasharray = (fraction * 100).toFixed(3) + ' 100';
      else fill?.style.setProperty('--drive-fill', fraction.toFixed(4));
      priorFill = fraction;
    }
    const shifting = live && !ev && number(model.rpmRatio) !== null && model.rpmRatio >= .97;
    if (shifting !== priorShift) { element.dataset.shift = String(shifting); priorShift = shifting; }
    const scale = ev ? 'ev' : String(max);
    if (scale !== priorScale) {
      ticks.forEach((n, i) => { n.textContent = ev ? String(Number((i / (ticks.length - 1) * 100).toFixed(3))) : max ? String(Number((max * i / (ticks.length - 1) / 1000).toFixed(4))) : ''; });
      priorScale = scale;
    }
    const raced = mode === 'race';
    const v = {
      status: live ? 'LIVE' : 'NO SIGNAL', speed: whole(speed), gear,
      drive: ev ? whole(power) : whole(rpm), input: whole(input), power: whole(power),
      primary: raced ? ev ? whole(power) : gear : whole(speed),
      secondary: raced ? whole(speed) : ev ? whole(power) : gear,
      a: raced ? racing ? time(model.currentLap) : '—' : whole(power),
      b: raced ? racing ? time(model.bestLap) : '—' : whole(input),
      c: raced ? live && number(model.gX) !== null ? model.gX.toFixed(2) : '—' : temps.length ? whole(Math.max(...temps)) : '—',
      d: raced ? temps.length ? whole(Math.max(...temps)) : '—' : gear,
    };
    const l = {
      mode: raced ? 'RACE' : 'FREE', drive: ev ? 'POWER' : 'ENGINE SPEED', driveUnit: ev ? 'kW' : 'RPM',
      scale: ev ? 'DRIVE INPUT · %' : sweep && max === null ? 'DISPLAY SCAN' : '×1000 r/min', primary: raced ? ev ? 'POWER' : 'GEAR' : 'SPEED', primaryUnit: raced ? ev ? 'kW' : '' : 'km/h',
      secondary: raced ? 'SPEED' : ev ? 'POWER' : 'GEAR', secondaryUnit: raced ? 'km/h' : ev ? 'kW' : '',
      a: raced ? 'CURRENT LAP' : 'OUTPUT', aUnit: raced ? 'TIME' : 'kW',
      b: raced ? 'BEST LAP' : 'THROTTLE', bUnit: raced ? 'TIME' : '%',
      c: raced ? 'LATERAL G' : 'TYRE MAX', cUnit: raced ? 'g' : '°C',
      d: raced ? 'TYRE MAX' : 'GEAR', dUnit: raced ? '°C' : '',
    };
    // Layout-specific substitutions happen before the single DOM commit.
    project?.(v, l, { model, context, live, ev, mode, raced, temps });
    for (const [key, text] of Object.entries(v)) write(values, key, text);
    for (const [key, text] of Object.entries(l)) write(labels, key, text);
  };
}

// Embedded with toString(): keep all helpers inside this factory.
export function createLfaJapanInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('LFA instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'lfa-instrument';
  element.dataset.themeInstrument = 'y2009_2014.japan';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '2009–2014 Japanese digital performance instrument');
  element.innerHTML = `<div class="lfa-panel"><div class="lfa-header"><span>DRIVER DISPLAY // 2012</span><i></i><span data-lfa-label="program">SPORT</span></div><div class="lfa-body">
    <div class="lfa-side lfa-side-left"><div class="lfa-side-led"></div><div class="lfa-metric"><small data-lfa-label="left1">ENGINE POWER</small><strong data-lfa-value="left1">—</strong><em data-lfa-label="left1unit">kW</em></div><div class="lfa-metric"><small data-lfa-label="left2">G / Y AXIS</small><strong data-lfa-value="left2">—</strong><em data-lfa-label="left2unit">g</em></div><div class="lfa-side-foot">ENGINE SYSTEM / LIVE</div></div>
    <div class="lfa-ring"><svg viewBox="0 0 400 400" aria-label="Digital tachometer"><circle class="lfa-bezel" cx="200" cy="200" r="187"/><circle class="lfa-face" cx="200" cy="200" r="171"/><g data-lfa-ticks></g><path class="lfa-needle" data-lfa-needle d="M196 211 L200 58 L204 211 Z"/><circle class="lfa-hub" cx="200" cy="200" r="10"/></svg><div class="lfa-ring-content"><small data-lfa-label="centerTitle">GEAR</small><strong data-lfa-value="center">—</strong><div class="lfa-ring-speed"><span data-lfa-value="speed">—</span><small>km/h</small></div><div class="lfa-ring-drive" data-lfa-label="drive">×1000 r/min</div></div></div>
    <div class="lfa-side lfa-side-right"><div class="lfa-side-led"></div><div class="lfa-metric"><small data-lfa-label="right1">CURRENT LAP</small><strong data-lfa-value="right1">—</strong><em data-lfa-label="right1unit">TIME</em></div><div class="lfa-metric"><small data-lfa-label="right2">BEST LAP</small><strong data-lfa-value="right2">—</strong><em data-lfa-label="right2unit">TIME</em></div><div class="lfa-side-foot" data-lfa-value="status">NO SIGNAL</div></div>
    </div><div class="lfa-footer"><span>JAPANESE SUPERCAR / TFT</span><span data-lfa-value="footer">—</span></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'lfa-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DRIVE PROFILE</small><strong data-lfa-mode="race">RACE</strong><strong data-lfa-mode="freeRoam">FREE</strong><span>DISPLAY READY</span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-lfa-value]')).map(node => [node.dataset.lfaValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-lfa-label]')).map(node => [node.dataset.lfaLabel, node]));
  const ticks = element.querySelector('[data-lfa-ticks]');
  const needle = element.querySelector('[data-lfa-needle]');
  const point = (radius, angle) => { const rad = angle * Math.PI / 180; return [200 + Math.sin(rad) * radius, 200 - Math.cos(rad) * radius]; };

  const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const whole = n => finite(n) === null ? '—' : String(Math.round(n));
  const signed = n => finite(n) === null ? '—' : n.toFixed(2);
  const time = n => finite(n) === null || n <= 0 ? '—' : Math.floor(n / 60) + ':' + (n % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  let lastMode = null, lastAngle = '', sweepRpm = null;
  const redlineLayer = document.createElementNS(ns, 'g');
  ticks.append(redlineLayer);
  let priorRedline = '';
  function updateRedline(model, context, scale, ev) {
    const engineMax = finite(context.rpmGauge?.engineMaxRpm) ?? finite(model.engineMaxRpm);
    const start = ev || !scale ? null : finite(context.rpmGauge?.redlineStartFraction) ?? (engineMax > 0 ? .9 * engineMax / scale : null);
    const end = ev || !scale ? null : finite(context.rpmGauge?.redlineEndFraction) ?? (engineMax > 0 ? engineMax / scale : null);
    const valid = start !== null && end !== null && start >= 0 && end >= start && end > 0;
    const key = valid ? clamp(start) + ':' + clamp(end) : 'unknown';
    if (key === priorRedline) return;
    priorRedline = key;
    redlineLayer.innerHTML = '';
    redlineLayer.setAttribute('data-redline-start', valid ? String(clamp(start)) : '');
    redlineLayer.setAttribute('data-redline-end', valid ? String(clamp(end)) : '');
    if (!valid) return;
    for (let index = 0; index <= 6; index += 1) {
      const angle = -130 + (clamp(start) + (clamp(end) - clamp(start)) * index / 6) * 260;
      const a = point(153, angle), b = point(168, angle), line = document.createElementNS(ns, 'line');
      for (const [key, value] of Object.entries({ x1:a[0], y1:a[1], x2:b[0], y2:b[1] })) line.setAttribute(key, value.toFixed(2));
      line.setAttribute('class', 'lfa-tick lfa-red'); redlineLayer.append(line);
    }
  }

  let priorRpmAxis = '';
  function drawRpmScale(max, ev) {
    const key = ev ? 'ev' : String(max);
    if (key === priorRpmAxis) return;
    priorRpmAxis = key;
    ticks.innerHTML = '';
    // Whole-thousand major ticks and an exact partial endpoint use the same
    // physical fractions as the pointer. Minor marks interpolate each interval.
    const axisMax = max ?? 8000;
    const step = axisMax <= 9000 ? 1000 : 2000;
    const stops = [];
    for (let value = 0; value <= axisMax; value += step) stops.push(value);
    if (stops.at(-1) !== axisMax) stops.push(axisMax);
    const markAt = (value, major) => {
      const angle = -130 + value / axisMax * 260;
      const caption = ev || max === null ? '' : String(Number((value / 1000).toFixed(2)));
      const a = point(major ? 141 : 153, angle), b = point(168, angle), mark = document.createElementNS(ns, 'line');
      mark.setAttribute('x1', a[0].toFixed(2)); mark.setAttribute('y1', a[1].toFixed(2));
      mark.setAttribute('x2', b[0].toFixed(2)); mark.setAttribute('y2', b[1].toFixed(2));
      mark.setAttribute('class', 'lfa-tick' + (major ? ' lfa-major' : '')); ticks.append(mark);
      if (major) {
        const p = point(119, angle), label = document.createElementNS(ns, 'text');
        label.setAttribute('x', p[0].toFixed(2)); label.setAttribute('y', p[1].toFixed(2));
        label.setAttribute('class', 'lfa-tick-number'); label.textContent = caption; ticks.append(label);
      }
    };
    for (let index = 0; index < stops.length; index += 1) {
      markAt(stops[index], true);
      if (index === stops.length - 1) continue;
      for (let minor = 1; minor < 5; minor += 1) markAt(stops[index] + (stops[index + 1] - stops[index]) * minor / 5, false);
    }
    ticks.setAttribute('data-rpm-axis-max', ev || max === null ? '' : String(max));
    ticks.append(redlineLayer);
  }

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live', kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? (lastMode || requestedMode) : requestedMode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    element.dataset.mode = mode; element.dataset.powertrain = ev ? 'ev' : 'combustion';
    lastMode = mode;
    label('program', mode === 'race' ? 'SPORT' : 'CRUISE');
    label('centerTitle', mode === 'race' ? (ev ? 'POWER / kW' : 'GEAR') : 'SPEED · km/h');
    label('left1', mode === 'race' && ev ? 'DRIVE TORQUE' : 'POWER');
    label('left1unit', mode === 'race' && ev ? 'Nm' : 'kW');
    label('left2', mode === 'race' ? 'G / Y AXIS' : 'THROTTLE');
    label('left2unit', mode === 'race' ? 'g' : '%');
    label('right1', mode === 'race' ? 'CURRENT LAP' : 'GEAR');
    label('right1unit', mode === 'race' ? 'TIME' : '');
    label('right2', mode === 'race' ? 'BEST LAP' : ev ? 'LATERAL G' : 'ENGINE SPEED');
    label('right2unit', mode === 'race' ? 'TIME' : ev ? 'g' : 'rpm');
    label('drive', ev ? mode === 'race' ? 'ELECTRIC DRIVE' : '' : '×1000 r/min');
    drawRpmScale(scale, ev);
    updateRedline(model, context, scale, ev);
    const rpmTarget = available ? finite(model.rpm) : null, speedTarget = available ? finite(model.speedKmh) : null;
    if (sweep) { sweepRpm = scale === null ? null : clamp(override.rpm) * scale; }
    let rpm = sweep ? sweepRpm : rpmTarget;
    const fraction = sweep ? clamp(override.rpm) : rpm === null ? 0 : scale ? clamp(rpm / scale) : clamp(finite(context.gaugeFraction) ?? 0);
    const angle = `rotate(${(-130 + fraction * 260).toFixed(2)} 200 200)`;
    if (angle !== lastAngle) { needle.setAttribute('transform', angle); lastAngle = angle; }
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('center', mode === 'race' ? ev ? available ? whole(model.powerKw) : '—' : available ? String(model.gearLabel ?? '—') : '—' : sweep ? whole(clamp(override.speed) * 280) : available ? whole(speedTarget) : '—');
    write('speed', sweep ? whole(clamp(override.speed) * 280) : available ? whole(speedTarget) : '—');
    write('left1', available ? whole(mode === 'race' && ev ? model.torque : model.powerKw) : '—');
    write('left2', mode === 'race' ? available ? signed(model.gY) : '—' : available ? whole(model.throttlePercent) : '—');
    write('right1', mode === 'race' ? racing ? time(model.currentLap) : '—' : available ? String(model.gearLabel ?? '—') : '—');
    write('right2', mode === 'race' ? racing ? time(model.bestLap) : '—' : ev ? available ? signed(model.gX) : '—' : available ? whole(rpm) : '—');
    write('status', available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : 'NO SIGNAL');
    write('footer', racing && finite(model.rank) > 0 ? 'POSITION ' + whole(model.rank) : available ? '' : 'NO SIGNAL');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

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
    <div class="lfa-side lfa-side-left"><div class="lfa-side-led"></div><div class="lfa-metric"><small data-lfa-label="left1">ENGINE POWER</small><strong data-lfa-value="left1">—</strong><em data-lfa-label="left1unit">kW</em></div><div class="lfa-metric"><small data-lfa-label="left2">G FORCE</small><strong data-lfa-value="left2">—</strong><em data-lfa-label="left2unit">g</em></div><div class="lfa-side-foot">ENGINE SYSTEM / LIVE</div></div>
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
  const numberTicks = [];
  for (let i = 0; i <= 50; i++) {
    const angle = -130 + i * 260 / 50, major = i % 5 === 0;
    const a = point(major ? 141 : 153, angle), b = point(168, angle);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', a[0].toFixed(2)); line.setAttribute('y1', a[1].toFixed(2));
    line.setAttribute('x2', b[0].toFixed(2)); line.setAttribute('y2', b[1].toFixed(2));
    line.setAttribute('class', 'lfa-tick' + (major ? ' lfa-major' : '') + (i >= 45 ? ' lfa-red' : ''));
    ticks.append(line);
    if (major) {
      const p = point(119, angle), text = document.createElementNS(ns, 'text');
      text.setAttribute('x', p[0].toFixed(2)); text.setAttribute('y', p[1].toFixed(2));
      text.setAttribute('class', 'lfa-tick-number'); text.textContent = '—'; ticks.append(text); numberTicks.push(text);
    }
  }
  const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const whole = n => finite(n) === null ? '—' : String(Math.round(n));
  const signed = n => finite(n) === null ? '—' : Math.abs(n).toFixed(2);
  const time = n => finite(n) === null || n <= 0 ? '—' : Math.floor(n / 60) + ':' + (n % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  let lastMode = null, lastScale = undefined, lastEv = null, lastAngle = '', wasSweep = false, sweepRpm = null, handoff = null;
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
    label('centerTitle', mode === 'race' ? (ev ? 'POWER / kW' : 'GEAR') : 'ROAD SPEED');
    label('left1', mode === 'race' && !ev ? 'ENGINE POWER' : 'POWER');
    label('left2', mode === 'race' ? 'G FORCE' : 'THROTTLE');
    label('left2unit', mode === 'race' ? 'g' : '%');
    label('right1', mode === 'race' ? 'CURRENT LAP' : 'DRIVE STATUS');
    label('right1unit', mode === 'race' ? 'TIME' : 'LIVE');
    label('right2', mode === 'race' ? 'BEST LAP' : ev ? 'DRIVE POWER' : 'ENGINE SPEED');
    label('right2unit', mode === 'race' ? 'TIME' : ev ? 'kW' : 'rpm');
    label('drive', ev ? 'POWER / kW' : '×1000 r/min');
    if (lastScale !== scale || lastEv !== ev) { lastScale = scale; lastEv = ev; numberTicks.forEach((node, i) => { node.textContent = scale === null || ev ? '' : String(Math.round(i * scale / 10000)); }); }
    const rpmTarget = available ? finite(model.rpm) : null, speedTarget = available ? finite(model.speedKmh) : null;
    if (sweep) { sweepRpm = scale === null ? null : clamp(override.rpm) * scale; wasSweep = true; handoff = null; }
    else if (wasSweep) { handoff = { at: Date.now(), rpm: sweepRpm }; wasSweep = false; }
    let rpm = sweep ? sweepRpm : rpmTarget;
    if (!sweep && handoff) {
      const t = clamp((Date.now() - handoff.at) / 480), eased = 1 - (1 - t) ** 3;
      if (handoff.rpm !== null) rpm = handoff.rpm + ((rpmTarget ?? 0) - handoff.rpm) * eased;
      if (t >= 1) handoff = null;
    }
    const fraction = sweep ? clamp(override.rpm) : rpm === null ? 0 : scale ? clamp(rpm / scale) : clamp(finite(context.gaugeFraction) ?? 0);
    const angle = `rotate(${(-130 + fraction * 260).toFixed(2)} 200 200)`;
    if (angle !== lastAngle) { needle.setAttribute('transform', angle); lastAngle = angle; }
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('center', mode === 'race' ? ev ? available ? whole(model.powerKw) : '—' : available ? String(model.gearLabel ?? '—') : '—' : sweep ? whole(clamp(override.speed) * 280) : available ? whole(speedTarget) : '—');
    write('speed', sweep ? whole(clamp(override.speed) * 280) : available ? whole(speedTarget) : '—');
    write('left1', available ? whole(model.powerKw) : '—');
    write('left2', mode === 'race' ? available ? signed(model.gY) : '—' : available ? whole(model.throttlePercent) : '—');
    write('right1', mode === 'race' ? racing ? time(model.currentLap) : '—' : available ? ev ? 'E-DRIVE' : 'READY' : '—');
    write('right2', mode === 'race' ? racing ? time(model.bestLap) : '—' : ev ? available ? whole(model.powerKw) : '—' : available ? whole(rpm) : '—');
    write('status', available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : 'NO SIGNAL');
    write('footer', racing && finite(model.rank) > 0 ? 'POSITION ' + whole(model.rank) : available ? 'SPEED ' + whole(speedTarget) : 'NO SIGNAL');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

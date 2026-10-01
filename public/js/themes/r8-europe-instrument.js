// Embedded into the standalone page with toString(); helpers must remain inside the factory.
export function createR8EuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('R8 instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'r8-instrument';
  element.dataset.themeInstrument = 'y2009_2014.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '2009–2014 European twin dial instrument');
  element.innerHTML = `<div class="r8-shroud"><div class="r8-head"><span>INSTRUMENT / 2012</span><i></i><span data-r8-label="mode">DYNAMIC</span></div><div class="r8-layout">
    <div class="r8-dial r8-speed"><svg viewBox="0 0 400 400" aria-label="Speedometer"><circle class="r8-rim" cx="200" cy="200" r="184"/><circle class="r8-face" cx="200" cy="200" r="166"/><g data-r8-ticks="speed"></g><path class="r8-needle" data-r8-needle="speed" d="M196 208 L200 72 L204 208 Z"/><circle class="r8-hub" cx="200" cy="200" r="12"/></svg><div class="r8-dial-title">km/h</div><div class="r8-speed-readout"><strong data-r8-value="speed">—</strong><small>km/h</small></div></div>
    <div class="r8-center"><div class="r8-screen-border"><div class="r8-screen"><span class="r8-screen-heading" data-r8-label="screen">PERFORMANCE</span><div class="r8-primary"><small data-r8-label="primary">GEAR</small><strong data-r8-value="primary">—</strong></div><div class="r8-columns r8-race"><div><span>CURRENT LAP</span><b data-r8-value="lap">—</b></div><div><span>BEST LAP</span><b data-r8-value="best">—</b></div></div><div class="r8-columns r8-free"><div><span>POWER</span><b data-r8-value="power">—</b></div><div><span>THROTTLE</span><b data-r8-value="throttle">—</b></div></div><div class="r8-screen-footer"><span data-r8-label="signal">NO SIGNAL</span><span data-r8-value="status">—</span></div></div></div><div class="r8-lamps" aria-hidden="true"></div></div>
    <div class="r8-dial r8-tach"><svg viewBox="0 0 400 400" aria-label="Tachometer"><circle class="r8-rim" cx="200" cy="200" r="184"/><circle class="r8-face" cx="200" cy="200" r="166"/><g data-r8-ticks="rpm"></g><path class="r8-needle" data-r8-needle="rpm" d="M196 208 L200 72 L204 208 Z"/><circle class="r8-hub" cx="200" cy="200" r="12"/></svg><div class="r8-dial-title" data-r8-label="drive">×1000 r/min</div><div class="r8-rpm-readout"><strong data-r8-value="rpm">—</strong><small data-r8-label="unit">rpm</small></div></div>
  </div><div class="r8-foot"><span>EUROPEAN GT / TYPE 12</span><span data-r8-value="footer">—</span></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'r8-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DRIVE PROFILE</small><strong data-r8-mode="race">RACE</strong><strong data-r8-mode="freeRoam">FREE</strong><span>INSTRUMENT READY</span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-r8-value]')).map(node => [node.dataset.r8Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-r8-label]')).map(node => [node.dataset.r8Label, node]));
  const speedNeedle = element.querySelector('[data-r8-needle="speed"]');
  const rpmNeedle = element.querySelector('[data-r8-needle="rpm"]');
  const speedTicks = element.querySelector('[data-r8-ticks="speed"]');
  const rpmTicks = element.querySelector('[data-r8-ticks="rpm"]');
  const lampsRoot = element.querySelector('.r8-lamps');
  const lamps = Array.from({ length: 7 }, () => { const lamp = document.createElement('i'); lampsRoot.append(lamp); return lamp; });
  const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const point = (radius, degrees) => { const rad = degrees * Math.PI / 180; return [200 + Math.sin(rad) * radius, 200 - Math.cos(rad) * radius]; };
  const makeTick = (group, angle, major, label, red) => {
    const a = point(major ? 144 : 153, angle), b = point(164, angle);
    const line = document.createElementNS(ns, 'line');
    for (const [key, value] of Object.entries({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) line.setAttribute(key, value.toFixed(2));
    line.setAttribute('class', 'r8-tick' + (major ? ' r8-major' : '') + (red ? ' r8-red' : ''));
    group.append(line);
    if (label !== null) {
      const p = point(123, angle), text = document.createElementNS(ns, 'text');
      text.setAttribute('x', p[0].toFixed(2)); text.setAttribute('y', p[1].toFixed(2));
      text.setAttribute('class', 'r8-tick-label'); text.textContent = String(label); group.append(text);
    }
  };
  for (let i = 0; i <= 28; i++) makeTick(speedTicks, -130 + i * 260 / 28, i % 4 === 0, i % 4 === 0 ? i * 10 : null, false);
  for (let i = 0; i <= 32; i++) makeTick(rpmTicks, -130 + i * 260 / 32, i % 4 === 0, i % 4 === 0 ? i / 4 : null, i >= 28);
  let lastMode = null, lastScale = undefined, lastSpeedAngle = '', lastRpmAngle = '';
  let sweeping = false, sweepSpeed = null, sweepRpm = null, handoff = null;
  const setText = (key, value) => { const node = values[key]; if (node && node.textContent !== value) node.textContent = value; };
  const whole = n => finite(n) === null ? '—' : String(Math.round(n));
  const percent = n => finite(n) === null ? '—' : Math.round(n) + '%';
  const lapTime = n => finite(n) === null || n <= 0 ? '—' : n.toFixed(2) + ' s';
  const setNeedle = (node, angle, old) => {
    const next = `rotate(${angle.toFixed(2)} 200 200)`;
    if (next !== old) node.setAttribute('transform', next);
    return next;
  };
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live';
    const kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? (lastMode || requestedMode) : requestedMode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    element.dataset.mode = mode; element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent'; element.dataset.sweep = String(sweep);
    if (mode !== lastMode) { lastMode = mode; labels.mode.textContent = mode === 'race' ? 'DYNAMIC' : 'TOURING'; labels.screen.textContent = mode === 'race' ? 'PERFORMANCE' : 'DRIVE INFORMATION'; labels.primary.textContent = mode === 'race' ? (ev ? 'POWER' : 'GEAR') : 'ROAD SPEED'; }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.drive.textContent = ev ? 'POWER / kW' : '×1000 r/min'; labels.unit.textContent = ev ? 'kW' : 'rpm';
    if (lastScale !== scale) {
      lastScale = scale;
      element.dataset.scale = scale ? 'known' : 'unknown';
      Array.from(rpmTicks.querySelectorAll('.r8-tick-label')).forEach((node, index) => {
        node.textContent = scale === null ? '—' : String(Math.round(index * scale / 8000));
      });
    }
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) { sweepSpeed = clamp(override.speed) * 280; sweepRpm = scale === null ? null : clamp(override.rpm) * scale; sweeping = true; handoff = null; }
    else if (sweeping) { handoff = { at: Date.now(), speed: sweepSpeed, rpm: sweepRpm }; sweeping = false; }
    let speed = speedTarget, rpm = rpmTarget;
    if (sweep) { speed = sweepSpeed; rpm = sweepRpm; }
    else if (handoff) {
      const t = clamp((Date.now() - handoff.at) / 480), eased = 1 - Math.pow(1 - t, 3);
      if (handoff.speed !== null) speed = handoff.speed + ((speedTarget ?? 0) - handoff.speed) * eased;
      if (handoff.rpm !== null) rpm = handoff.rpm + ((rpmTarget ?? 0) - handoff.rpm) * eased;
      if (t >= 1) handoff = null;
    }
    const speedFraction = sweep ? clamp(override.speed) : speed === null ? 0 : clamp(speed / 280);
    const rpmFraction = sweep ? clamp(override.rpm) : handoff && scale && rpm !== null ? clamp(rpm / scale) : finite(context.gaugeFraction) ?? (scale && rpm !== null ? clamp(rpm / scale) : 0);
    lastSpeedAngle = setNeedle(speedNeedle, -130 + speedFraction * 260, lastSpeedAngle);
    lastRpmAngle = setNeedle(rpmNeedle, -130 + clamp(rpmFraction) * 260, lastRpmAngle);
    const lit = !ev && available && mode === 'race' && finite(model.rpmRatio) !== null ? Math.max(0, Math.min(7, Math.ceil((model.rpmRatio - .7) / .04))) : 0;
    lamps.forEach((lamp, i) => { lamp.dataset.lit = String(i < lit); });
    const racing = mode === 'race' && Boolean(context.racing) && available;
    setText('speed', sweep || available ? whole(speed) : '—');
    setText('rpm', ev ? (available ? whole(model.powerKw) : '—') : sweep || available ? whole(rpm) : '—');
    setText('primary', mode === 'race' ? ev ? whole(model.powerKw) : available ? String(model.gearLabel ?? '—') : '—' : sweep || available ? whole(speed) : '—');
    setText('lap', racing ? lapTime(model.currentLap) : '—'); setText('best', racing ? lapTime(model.bestLap) : '—');
    setText('power', available ? whole(model.powerKw) + (finite(model.powerKw) === null ? '' : ' kW') : '—');
    setText('throttle', available ? percent(model.throttlePercent) : '—');
    setText('status', available ? (ev ? 'E-DRIVE' : String(model.gearLabel ?? '—')) : '—');
    setText('footer', racing && finite(model.rank) > 0 ? 'POSITION ' + whole(model.rank) : 'SPEED / ' + (sweep || available ? whole(speed) : '—'));
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

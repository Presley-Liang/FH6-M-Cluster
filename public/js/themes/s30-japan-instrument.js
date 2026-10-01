// Embedded into the standalone dashboard via toString(): no module-scope helpers.
export function createS30JapanInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('S30 instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 's30-instrument';
  element.dataset.themeInstrument = 'y1960_1975.japan';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '1960–1975 Japanese sports car instrument');
  element.innerHTML = `<div class="s30-dash"><div class="s30-header"><span>SPORTS CAR / 1971</span><i></i><span data-s30-label="mode">RACING</span></div><div class="s30-layout">
    <div class="s30-driver"><div class="s30-main-pair">
      <div class="s30-main s30-speed"><div class="s30-bezel"><svg viewBox="0 0 400 400" aria-label="Road speed"><circle class="s30-face" cx="200" cy="200" r="182"/><g data-s30-ticks="speed"></g><path class="s30-needle" data-s30-needle="speed" d="M196 210 L200 66 L204 210 Z"/><circle class="s30-hub" cx="200" cy="200" r="14"/></svg><span class="s30-dial-title">km/h</span><div class="s30-readout"><strong data-s30-value="speed">—</strong><small>km/h</small></div></div><div class="s30-under s30-free-only"><span>ROAD SPEED</span><b data-s30-value="road">—</b></div></div>
      <div class="s30-main s30-rpm"><div class="s30-bezel"><svg viewBox="0 0 400 400" aria-label="Engine speed"><circle class="s30-face" cx="200" cy="200" r="182"/><g data-s30-ticks="rpm"></g><path class="s30-needle" data-s30-needle="rpm" d="M196 210 L200 66 L204 210 Z"/><circle class="s30-hub" cx="200" cy="200" r="14"/></svg><span class="s30-dial-title" data-s30-label="drive">×1000 r/min</span><div class="s30-readout"><strong data-s30-value="rpm">—</strong><small data-s30-label="unit">rpm</small></div></div><div class="s30-under s30-race-only"><span>ENGINE SPEED</span><b data-s30-value="raceRpm">—</b></div></div>
    </div><div class="s30-driver-bottom"><div class="s30-gear"><span data-s30-label="gear">GEAR</span><strong data-s30-value="gear">—</strong></div><div class="s30-drive-note"><span data-s30-label="note">TRACK PROGRAM</span><b data-s30-value="status">—</b></div><div class="s30-shift" aria-hidden="true"></div></div></div>
    <div class="s30-aux"><div class="s30-aux-heading">TRIPLE INSTRUMENT <span>TYPE S30</span></div><div class="s30-aux-stack">
      <div class="s30-aux-pod"><span data-s30-label="aux1">POWER</span><strong data-s30-value="aux1">—</strong><small data-s30-label="aux1unit">kW</small></div>
      <div class="s30-aux-pod"><span data-s30-label="aux2">CURRENT LAP</span><strong data-s30-value="aux2">—</strong><small data-s30-label="aux2unit">TIME</small></div>
      <div class="s30-aux-pod"><span data-s30-label="aux3">BEST LAP</span><strong data-s30-value="aux3">—</strong><small data-s30-label="aux3unit">TIME</small></div>
    </div><div class="s30-aux-foot"><i></i><span data-s30-label="signal">NO SIGNAL</span></div></div>
  </div><div class="s30-footer"><span>JAPANESE GRAND TOURING / 1969—75</span><span data-s30-value="footer">—</span></div></div>`;
  const identity = document.createElement('div');
  identity.className = 's30-mode-identity'; identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DRIVE SELECTION</small><strong data-s30-mode="race">RACE</strong><strong data-s30-mode="freeRoam">FREE</strong><span>S30 / SPORT INSTRUMENT</span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-s30-value]')).map(node => [node.dataset.s30Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-s30-label]')).map(node => [node.dataset.s30Label, node]));
  const speedNeedle = element.querySelector('[data-s30-needle="speed"]');
  const rpmNeedle = element.querySelector('[data-s30-needle="rpm"]');
  const speedTicks = element.querySelector('[data-s30-ticks="speed"]');
  const rpmTicks = element.querySelector('[data-s30-ticks="rpm"]');
  const shiftRoot = element.querySelector('.s30-shift');
  const shift = Array.from({ length: 6 }, () => { const node = document.createElement('i'); shiftRoot.append(node); return node; });
  const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const whole = n => finite(n) === null ? '—' : String(Math.round(n));
  const point = (r, deg) => { const rad = deg * Math.PI / 180; return [200 + Math.sin(rad) * r, 200 - Math.cos(rad) * r]; };
  const addTick = (layer, angle, major, number, red) => {
    const p = point(major ? 148 : 157, angle), q = point(174, angle), line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', p[0].toFixed(2)); line.setAttribute('y1', p[1].toFixed(2));
    line.setAttribute('x2', q[0].toFixed(2)); line.setAttribute('y2', q[1].toFixed(2));
    line.setAttribute('class', 's30-tick' + (major ? ' s30-tick-major' : '') + (red ? ' s30-tick-red' : ''));
    layer.append(line);
    if (number !== null) {
      const xy = point(125, angle), text = document.createElementNS(ns, 'text');
      text.setAttribute('x', xy[0].toFixed(2)); text.setAttribute('y', xy[1].toFixed(2));
      text.setAttribute('class', 's30-tick-label'); text.textContent = String(number); layer.append(text);
    }
  };
  for (let i = 0; i <= 56; i++) {
    const angle = -130 + i * 260 / 56, major = i % 7 === 0;
    addTick(speedTicks, angle, major, major ? i * 5 : null, false);
    addTick(rpmTicks, angle, major, major ? '—' : null, i >= 49);
  }
  const rpmNumbers = Array.from(rpmTicks.querySelectorAll('.s30-tick-label'));
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const time = n => finite(n) === null || n <= 0 ? '—' : Math.floor(n / 60) + ':' + (n % 60).toFixed(3).padStart(6, '0');
  let lastMode = null, lastScale = undefined, lastSpeedNeedle = '', lastRpmNeedle = '';
  let wasSweep = false, sweepSpeed = null, sweepRpm = null, handoff = null;
  const needle = (node, angle, old) => { const next = `rotate(${angle.toFixed(2)} 200 200)`; if (next !== old) node.setAttribute('transform', next); return next; };
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live', kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? (lastMode || requestedMode) : requestedMode;
    const available = !Boolean(context.stale ?? model.stale);
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    element.dataset.mode = mode; element.dataset.powertrain = ev ? 'ev' : 'combustion'; element.dataset.signal = available ? 'live' : 'absent';
    if (lastMode !== mode) { lastMode = mode; labels.mode.textContent = mode === 'race' ? 'RACING' : 'TOURING'; labels.note.textContent = mode === 'race' ? 'TRACK PROGRAM' : 'ROAD PROGRAM'; }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.drive.textContent = ev ? 'POWER / kW' : '×1000 r/min'; labels.unit.textContent = ev ? 'kW' : 'rpm'; labels.gear.textContent = ev ? 'DRIVE' : 'GEAR';
    if (lastScale !== scale) { lastScale = scale; rpmNumbers.forEach((node, i) => { node.textContent = scale === null ? '—' : String(Math.round(i * scale / 8000)); }); }
    const speedTarget = available ? finite(model.speedKmh) : null, rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) { sweepSpeed = clamp(override.speed) * 280; sweepRpm = scale === null ? null : clamp(override.rpm) * scale; wasSweep = true; handoff = null; }
    else if (wasSweep) { handoff = { at: Date.now(), speed: sweepSpeed, rpm: sweepRpm }; wasSweep = false; }
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
    lastSpeedNeedle = needle(speedNeedle, -130 + speedFraction * 260, lastSpeedNeedle);
    lastRpmNeedle = needle(rpmNeedle, -130 + clamp(rpmFraction) * 260, lastRpmNeedle);
    const lit = !ev && available && mode === 'race' && finite(model.rpmRatio) !== null ? Math.max(0, Math.min(shift.length, Math.ceil((model.rpmRatio - .72) / .045))) : 0;
    shift.forEach((node, index) => { node.dataset.lit = String(index < lit); });
    write('speed', sweep || available ? whole(speed) : '—'); write('road', available ? whole(speed) : '—');
    write('rpm', ev ? available ? whole(model.powerKw) : '—' : sweep || available ? whole(rpm) : '—');
    write('raceRpm', ev ? available ? whole(model.powerKw) : '—' : sweep || available ? whole(rpm) : '—');
    write('gear', ev ? 'EV' : available ? String(model.gearLabel ?? '—') : '—');
    write('status', available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : '—');
    const racing = mode === 'race' && Boolean(context.racing) && available;
    if (mode === 'race') {
      labels.aux1.textContent = 'POWER'; labels.aux1unit.textContent = 'kW'; write('aux1', available ? whole(model.powerKw) : '—');
      labels.aux2.textContent = 'CURRENT LAP'; labels.aux2unit.textContent = 'TIME'; write('aux2', racing ? time(model.currentLap) : '—');
      labels.aux3.textContent = 'BEST LAP'; labels.aux3unit.textContent = 'TIME'; write('aux3', racing ? time(model.bestLap) : '—');
    } else {
      labels.aux1.textContent = 'POWER'; labels.aux1unit.textContent = 'kW'; write('aux1', available ? whole(model.powerKw) : '—');
      labels.aux2.textContent = 'THROTTLE'; labels.aux2unit.textContent = '%'; write('aux2', available ? whole(model.throttlePercent) : '—');
      labels.aux3.textContent = ev ? 'DRIVE SYSTEM' : 'FUEL'; labels.aux3unit.textContent = ev ? 'STATUS' : 'RAW';
      const fuel = available ? finite(model.fuelRaw) : null;
      write('aux3', ev ? 'E-DRIVE' : fuel === null ? '—' : fuel.toFixed(3));
    }
    write('footer', racing && finite(model.rank) > 0 ? 'POSITION ' + whole(model.rank) : available ? 'SPEED ' + whole(speed) : 'NO SIGNAL');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

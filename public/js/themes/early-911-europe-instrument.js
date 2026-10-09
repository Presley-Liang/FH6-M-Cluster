// Serialized into the standalone dashboard with toString(); keep helpers inside the factory.
export function createEarly911EuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Early 911 instrument requires document and mount');

  const ns = 'http://www.w3.org/2000/svg';
  const themeId = 'y1960_1975.europe';
  const element = document.createElement('section');
  element.className = 'early911-instrument';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '1960–1975 European five dial instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="e911-cowl" aria-hidden="true"></div>
    <div class="e911-topline"><span>FIVE INSTRUMENTS</span><i></i><span>EUROPE · 1960—1975</span></div>
    <div class="e911-tubes">
      <div class="e911-tube e911-tube-one"><div class="e911-face"><div class="e911-face-title" data-e911-label="outerLeft">CURRENT LAP</div><div class="e911-small-value" data-e911-value="outerLeft">—</div><div class="e911-face-foot" data-e911-label="outerLeftFoot">TIMING / S</div><span class="e911-face-notch"></span></div></div>
      <div class="e911-tube e911-tube-two"><div class="e911-face"><svg class="e911-dial" viewBox="0 0 400 400" role="img" aria-label="Speedometer"><g class="e911-speed-ticks"></g><path class="e911-needle-shadow" data-e911-needle="speed" d="M195 207 L200 66 L205 207 Z"/><path class="e911-needle" data-e911-needle="speed" d="M197 207 L200 64 L203 207 Z"/><circle class="e911-hub" cx="200" cy="200" r="10"/></svg><div class="e911-dial-title">km/h</div><div class="e911-dial-value" data-e911-value="speed">—</div></div></div>
      <div class="e911-tube e911-tube-three"><div class="e911-face"><svg class="e911-dial" viewBox="0 0 400 400" role="img" aria-label="Engine revolutions"><g class="e911-rpm-ticks"></g><g class="e911-redline"></g><path class="e911-needle-shadow" data-e911-needle="rpm" d="M194 209 L200 56 L206 209 Z"/><path class="e911-needle" data-e911-needle="rpm" d="M196 209 L200 53 L204 209 Z"/><circle class="e911-hub" cx="200" cy="200" r="12"/></svg><div class="e911-dial-title" data-e911-label="driveTitle">1/min · ×1000</div><div class="e911-drive-value" data-e911-value="drive">—</div><div class="e911-gear"><span>GEAR</span><b data-e911-value="gear">—</b></div><div class="e911-ev-power"><span>POWER OUTPUT</span><strong data-e911-value="evPower">—</strong><small>kW</small></div></div></div>
      <div class="e911-tube e911-tube-four"><div class="e911-face"><svg class="e911-dial" viewBox="0 0 400 400" role="img" aria-label="Throttle position"><g class="e911-throttle-ticks"></g><path class="e911-needle-shadow" data-e911-needle="throttle" d="M195 207 L200 66 L205 207 Z"/><path class="e911-needle" data-e911-needle="throttle" d="M197 207 L200 64 L203 207 Z"/><circle class="e911-hub" cx="200" cy="200" r="10"/></svg><div class="e911-dial-title">THROTTLE</div><div class="e911-dial-value" data-e911-value="throttle">—</div><div class="e911-dial-unit">%</div></div></div>
      <div class="e911-tube e911-tube-five"><div class="e911-face"><div class="e911-face-title" data-e911-label="outerRight">POSITION</div><div class="e911-small-value" data-e911-value="outerRight">—</div><div class="e911-face-foot" data-e911-label="outerRightFoot">BEST LAP · —</div><span class="e911-face-notch"></span></div></div>
    </div>
    <div class="e911-bottomline"><span><i class="e911-lamp"></i><b data-e911-label="signal">NO SIGNAL</b></span><span data-e911-label="program">RACE PROGRAM</span><span>FIVE DIAL / 01</span></div>`;
  const identity = document.createElement('div');
  identity.className = 'e911-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DRIVING PROGRAM</small><strong data-e911-mode="race">RACE</strong><strong data-e911-mode="freeRoam">FREE</strong><span>FIVE DIAL SYSTEM</span>';
  mount.append(element, identity);

  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-e911-value]')).map(node => [node.dataset.e911Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-e911-label]')).map(node => [node.dataset.e911Label, node]));
  const needles = Object.fromEntries(Array.from(element.querySelectorAll('.e911-needle')).map(node => [node.dataset.e911Needle, node]));
  const shadows = Object.fromEntries(Array.from(element.querySelectorAll('.e911-needle-shadow')).map(node => [node.dataset.e911Needle, node]));
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const integer = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = (value, places) => finite(value) === null ? '—' : value.toFixed(places);
  const time = value => finite(value) === null || value < 0 ? '—' : String(Math.floor(value / 60)) + ':' + (value % 60).toFixed(3).padStart(6, '0');
  const write = (key, value) => { if (values[key]?.textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key]?.textContent !== value) labels[key].textContent = value; };
  const polar = (radius, angle) => {
    const rad = angle * Math.PI / 180;
    return [200 + Math.sin(rad) * radius, 200 - Math.cos(rad) * radius];
  };
  function makeTick(group, angle, major, caption, danger = false) {
    const [x1, y1] = polar(major ? 147 : 156, angle);
    const [x2, y2] = polar(173, angle);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1.toFixed(1)); line.setAttribute('y1', y1.toFixed(1));
    line.setAttribute('x2', x2.toFixed(1)); line.setAttribute('y2', y2.toFixed(1));
    line.setAttribute('class', danger ? 'e911-tick-red' : major ? 'e911-tick-major' : 'e911-tick-minor');
    group.append(line);
    if (!major) return null;
    const [x, y] = polar(124, angle);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x.toFixed(1)); text.setAttribute('y', y.toFixed(1));
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('class', 'e911-tick-label'); text.textContent = caption;
    group.append(text);
    return text;
  }
  const speedGroup = element.querySelector('.e911-speed-ticks');
  const rpmGroup = element.querySelector('.e911-rpm-ticks');
  const throttleGroup = element.querySelector('.e911-throttle-ticks');
  for (let i = 0; i <= 28; i += 1) {
    const angle = -130 + i * 260 / 28;
    makeTick(speedGroup, angle, i % 4 === 0, i % 4 === 0 ? String(i * 10) : '');
    if (i % 2 === 0) makeTick(throttleGroup, angle, i % 7 === 0, i % 7 === 0 ? String(Math.round(i * 100 / 28)) : '');
  }

  let priorMode = null;
  let sweepSpeed = 0;
  let sweepRpm = 0;
  function aim(name, fraction) {
    const degrees = -130 + clamp(fraction) * 260;
    const transform = 'rotate(' + degrees.toFixed(2) + ' 200 200)';
    if (needles[name].getAttribute('transform') !== transform) {
      needles[name].setAttribute('transform', transform);
      shadows[name].setAttribute('transform', transform);
    }
  }

  const redlineLayer = element.querySelector('.e911-redline');
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
      makeTick(redlineLayer, angle, false, '', true);
    }
  }

  let priorRpmAxis = '';
  function drawRpmScale(max, ev) {
    const key = ev ? 'ev' : String(max);
    if (key === priorRpmAxis) return;
    priorRpmAxis = key;
    rpmGroup.innerHTML = '';
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
      makeTick(rpmGroup, angle, major, caption, false);
    };
    for (let index = 0; index < stops.length; index += 1) {
      markAt(stops[index], true);
      if (index === stops.length - 1) continue;
      for (let minor = 1; minor < 4; minor += 1) markAt(stops[index] + (stops[index + 1] - stops[index]) * minor / 4, false);
    }
    rpmGroup.setAttribute('data-rpm-axis-max', ev || max === null ? '' : String(max));

  }

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== themeId));
    const stale = Boolean(context.stale ?? model.stale);
    const available = !stale;
    const requested = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const awaitingMode = root?.dataset.ignitionKind === 'mode' && ['off-needles', 'off-frames', 'off-center', 'center'].includes(root.dataset.ignitionPhase);
    const mode = awaitingMode ? (priorMode || element.dataset.mode) : requested;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || root?.dataset.displayOverride || '').toLowerCase());
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.sweep = String(sweep);
    if (priorMode !== mode) {
      priorMode = mode;
      label('program', mode === 'race' ? 'RACE PROGRAM' : 'TOURING PROGRAM');
      label('outerLeft', mode === 'race' ? 'CURRENT LAP' : 'POWER');
      label('outerLeftFoot', mode === 'race' ? 'TIMING / S' : 'OUTPUT / kW');
      label('outerRight', mode === 'race' ? 'POSITION' : 'BOOST');
    }
    label('signal', available ? 'TELEMETRY LIVE' : 'NO SIGNAL');
    label('driveTitle', ev ? 'ELECTRIC POWER' : '1/min · ×1000');
    drawRpmScale(scale, ev);
    updateRedline(model, context, scale, ev);
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) {
      sweepSpeed = clamp(override.speed) * 280;
      sweepRpm = scale === null ? null : clamp(override.rpm) * scale;
    }
    let speed = sweep ? sweepSpeed : speedTarget;
    let rpm = sweep ? sweepRpm : rpmTarget;
    aim('speed', speed === null ? 0 : speed / 280);
    aim('rpm', ev || scale === null || rpm === null ? 0 : rpm / scale);
    const throttle = available ? finite(model.throttlePercent) : null;
    aim('throttle', throttle === null ? 0 : throttle / 100);
    write('speed', speed !== null ? integer(speed) : '—');
    write('drive', !ev && (available || sweep) && scale !== null ? integer(rpm) : '—');
    write('gear', available && !ev ? String(model.gearLabel ?? '—') : '—');
    write('evPower', available && ev ? integer(model.powerKw) : '—');
    write('throttle', integer(throttle));

    if (mode === 'race') {
      const racing = available && Boolean(context.racing);
      write('outerLeft', racing ? time(model.currentLap) : '—');
      write('outerRight', racing && finite(model.rank) > 0 ? 'P' + integer(model.rank) : '—');
      label('outerRightFoot', 'BEST LAP · ' + (racing ? time(model.bestLap) : '—'));
    } else {
      write('outerLeft', available ? integer(model.powerKw) : '—');
      write('outerRight', available ? decimal(model.boostRaw, 2) : '—');
      label('outerRightFoot', 'RAW · FUEL ' + (available ? decimal(model.fuelRaw, 2) : '—'));
    }
  }

  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

// Serialized into the standalone dashboard with toString(): all helpers stay in this factory.
export function createRx8JapanInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('RX-8 instrument requires document and mount');

  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'rx8-instrument';
  element.dataset.themeInstrument = 'y2003_2008.japan';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '2003–2008 Japanese three-pod sport instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="rx8-housing">
      <div class="rx8-header"><span>ROTARY SPORT / TYPE 08</span><i></i><span data-rx8-label="mode">RACE PROGRAM</span></div>
      <div class="rx8-pod-row">
        <div class="rx8-side rx8-side-left">
          <div class="rx8-side-bezel">
            <svg class="rx8-side-dial" viewBox="0 0 360 360" aria-hidden="true">
              <circle class="rx8-side-face" cx="180" cy="180" r="151"/><circle class="rx8-side-track" cx="180" cy="180" r="120"/>
              <g data-rx8-ticks="fuel"></g><path class="rx8-side-needle" data-rx8-needle="fuel" d="M176 188 L180 73 L184 188 Z"/>
              <circle class="rx8-side-hub" cx="180" cy="180" r="12"/>
            </svg>
            <div class="rx8-side-caption"><span>FUEL / RAW</span><strong data-rx8-value="fuel">—</strong></div>
          </div>
          <div class="rx8-side-foot rx8-race-data"><span>BEST LAP</span><strong data-rx8-value="best">—</strong></div>
          <div class="rx8-side-foot rx8-free-data"><span>POWER OUTPUT</span><strong data-rx8-value="power">—</strong><small>kW</small></div>
        </div>
        <div class="rx8-center">
          <div class="rx8-shift" aria-hidden="true"><span>SHIFT</span><div class="rx8-shift-lamps"></div></div>
          <div class="rx8-main-bezel">
            <svg class="rx8-tach-svg" viewBox="0 0 600 600" aria-label="Engine revolutions">
              <circle class="rx8-tach-face" cx="300" cy="300" r="268"/>
              <circle class="rx8-tach-track" cx="300" cy="300" r="239"/>
              <g class="rx8-redline-layer"></g><g class="rx8-tick-layer"></g>
              <path class="rx8-tach-needle-shadow" d="M293 315 L300 70 L307 315 Z"/>
              <path class="rx8-tach-needle" d="M296 310 L300 66 L304 310 Z"/>
              <circle class="rx8-tach-hub" cx="300" cy="300" r="21"/>
              <circle class="rx8-tach-pin" cx="300" cy="300" r="5"/>
            </svg>
            <div class="rx8-drive-readout"><span data-rx8-label="drive">×1000 r/min</span><strong data-rx8-value="rpm">—</strong></div>
            <div class="rx8-gear"><span>GEAR</span><strong data-rx8-value="gear">—</strong></div>
            <div class="rx8-speed-window"><span>DIGITAL SPEED</span><div><strong data-rx8-value="speed">—</strong><small>km/h</small></div></div>
          </div>
          <div class="rx8-center-foot rx8-race-data"><span>CURRENT LAP</span><strong data-rx8-value="lap">—</strong><small data-rx8-value="rank">—</small></div>
          <div class="rx8-center-foot rx8-free-data"><span>ROAD SPEED</span><strong data-rx8-value="freeSpeed">—</strong><small>km/h</small></div>
        </div>
        <div class="rx8-side rx8-side-right">
          <div class="rx8-side-bezel">
            <svg class="rx8-side-dial" viewBox="0 0 360 360" aria-hidden="true">
              <circle class="rx8-side-face" cx="180" cy="180" r="151"/><circle class="rx8-side-track" cx="180" cy="180" r="120"/>
              <g data-rx8-ticks="throttle"></g><path class="rx8-side-needle" data-rx8-needle="throttle" d="M176 188 L180 73 L184 188 Z"/>
              <circle class="rx8-side-hub" cx="180" cy="180" r="12"/>
            </svg>
            <div class="rx8-side-caption"><span>THROTTLE</span><strong data-rx8-value="throttle">—</strong><small>%</small></div>
          </div>
          <div class="rx8-side-foot rx8-race-data"><span>BOOST / RAW</span><strong data-rx8-value="boost">—</strong></div>
          <div class="rx8-side-foot rx8-free-data"><span>DRIVE</span><strong data-rx8-value="drive">—</strong></div>
        </div>
      </div>
      <div class="rx8-status"><span><i></i><b data-rx8-label="signal">NO SIGNAL</b></span><span>INSTRUMENT SYSTEM / 2003</span></div>
    </div>`;
  const modeIdentity = document.createElement('div');
  modeIdentity.className = 'rx8-mode-identity';
  modeIdentity.setAttribute('aria-hidden', 'true');
  modeIdentity.innerHTML = '<span>DRIVE PROGRAM</span><strong data-rx8-mode="race">RACE</strong><strong data-rx8-mode="freeRoam">FREE</strong><small>TYPE 08 / READY</small>';
  mount.append(element, modeIdentity);

  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-rx8-value]')).map(node => [node.dataset.rx8Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-rx8-label]')).map(node => [node.dataset.rx8Label, node]));
  const tachTicks = element.querySelector('.rx8-tick-layer');
  const redline = element.querySelector('.rx8-redline-layer');
  const tachNeedle = element.querySelector('.rx8-tach-needle');
  const tachShadow = element.querySelector('.rx8-tach-needle-shadow');
  const fuelNeedle = element.querySelector('[data-rx8-needle="fuel"]');
  const throttleNeedle = element.querySelector('[data-rx8-needle="throttle"]');
  const fuelCaption = element.querySelector('.rx8-side-left .rx8-side-caption span');
  const tachSvg = element.querySelector('.rx8-tach-svg');
  const lampsRoot = element.querySelector('.rx8-shift-lamps');
  const lamps = Array.from({ length: 8 }, () => {
    const lamp = document.createElement('i');
    lampsRoot.append(lamp);
    return lamp;
  });
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const point = (cx, cy, radius, angle) => {
    const rad = angle * Math.PI / 180;
    return [cx + Math.sin(rad) * radius, cy - Math.cos(rad) * radius];
  };
  const tick = (parent, cx, cy, angle, inner, outer, className) => {
    const a = point(cx, cy, inner, angle), b = point(cx, cy, outer, angle);
    const node = document.createElementNS(ns, 'line');
    node.setAttribute('x1', a[0].toFixed(2)); node.setAttribute('y1', a[1].toFixed(2));
    node.setAttribute('x2', b[0].toFixed(2)); node.setAttribute('y2', b[1].toFixed(2));
    node.setAttribute('class', className);
    parent.append(node);
  };

  for (const name of ['fuel', 'throttle']) {
    const layer = element.querySelector('[data-rx8-ticks="' + name + '"]');
    for (let index = 0; index <= 10; index += 1) {
      tick(layer, 180, 180, -120 + index * 24, index % 5 === 0 ? 104 : 112, 124, index % 5 === 0 ? 'rx8-side-major' : 'rx8-side-minor');
    }
  }

  let lastMode;
  let lastNeedle = '';
  let lastFuel = '';
  let lastThrottle = '';
  let sweepSpeed = null;
  let sweepRpm = null;
  const write = (key, content) => {
    const node = values[key];
    if (node && node.textContent !== content) node.textContent = content;
  };
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = (value, places) => finite(value) === null ? '—' : value.toFixed(places);
  const time = seconds => finite(seconds) === null || seconds < 0 ? '—' : String(Math.floor(seconds / 60)) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const setNeedle = (node, angle, previous) => {
    const transform = 'rotate(' + angle.toFixed(2) + ' 300 300)';
    if (previous !== transform) node.setAttribute('transform', transform);
    return transform;
  };

  const redlineLayer = redline;
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
      const angle = -125 + (clamp(start) + (clamp(end) - clamp(start)) * index / 6) * 250;
      tick(redlineLayer, 300, 300, angle, 215, 247, 'rx8-redline-tick');
    }
  }

  let priorRpmAxis = '';
  function drawRpmScale(max, ev) {
    const key = ev ? 'ev' : String(max);
    if (key === priorRpmAxis) return;
    priorRpmAxis = key;
    tachTicks.innerHTML = '';
    // Whole-thousand major ticks and an exact partial endpoint use the same
    // physical fractions as the pointer. Minor marks interpolate each interval.
    const axisMax = max ?? 8000;
    const step = axisMax <= 9000 ? 1000 : 2000;
    const stops = [];
    for (let value = 0; value <= axisMax; value += step) stops.push(value);
    if (stops.at(-1) !== axisMax) stops.push(axisMax);
    const markAt = (value, major) => {
      const angle = -125 + value / axisMax * 250;
      const caption = ev || max === null ? '' : String(Number((value / 1000).toFixed(2)));
      tick(tachTicks, 300, 300, angle, major ? 211 : 224, 242, major ? 'rx8-tach-major' : 'rx8-tach-minor');
      if (major) {
        const [x, y] = point(300, 300, 183, angle), label = document.createElementNS(ns, 'text');
        label.setAttribute('x', x.toFixed(2)); label.setAttribute('y', y.toFixed(2));
        label.setAttribute('class', 'rx8-tach-number'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
        label.textContent = caption; tachTicks.append(label);
      }
    };
    for (let index = 0; index < stops.length; index += 1) {
      markAt(stops[index], true);
      if (index === stops.length - 1) continue;
      for (let minor = 1; minor < 5; minor += 1) markAt(stops[index] + (stops[index + 1] - stops[index]) * minor / 5, false);
    }
    tachTicks.setAttribute('data-rpm-axis-max', ev || max === null ? '' : String(max));

  }

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== 'y2003_2008.japan'));
    const phase = root?.dataset.ignitionPhase || 'live';
    const kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase)
      ? (lastMode || element.dataset.mode) : requestedMode;
    const stale = Boolean(context.stale ?? model.stale);
    const available = !stale;
    const powertrain = String(context.powertrain || context.displayOverrideType || '').toLowerCase();
    const ev = powertrain === 'ev' || powertrain === 'electric';
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax
      : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.sweep = String(sweep);
    if (lastMode !== mode) {
      lastMode = mode;
      labels.mode.textContent = mode === 'race' ? 'RACE PROGRAM' : 'STREET PROGRAM';
    }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.drive.textContent = ev ? 'POWER / kW' : '×1000 r/min';
    fuelCaption.textContent = ev ? 'POWER / kW' : 'FUEL / RAW';
    tachSvg.setAttribute('aria-label', ev ? 'Electric power readout' : 'Engine revolutions');
    drawRpmScale(scale, ev);
    updateRedline(model, context, scale, ev);
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) {
      sweepSpeed = clamp(override.speed) * 280;
      sweepRpm = scale === null ? null : clamp(override.rpm) * scale;
    }
    let speed = speedTarget, rpm = rpmTarget;
    if (sweep) {
      speed = sweepSpeed;
      rpm = sweepRpm;
    }

    const rpmFraction = sweep ? clamp(override.rpm) : finite(context.gaugeFraction) ?? (scale && rpm !== null ? rpm / scale : 0);
    const angle = -125 + clamp(rpmFraction) * 250;
    const transform = 'rotate(' + angle.toFixed(2) + ' 300 300)';
    if (lastNeedle !== transform) {
      lastNeedle = setNeedle(tachNeedle, angle, lastNeedle);
      tachShadow.setAttribute('transform', transform);
    }
    const fuelRaw = available ? finite(model.fuelRaw) : null;
    // Packet range alone does not establish a fuel unit or an E/F proportion.
    // Keep the raw readout; only a verified normalized field may drive this needle.
    const fuelFraction = available && finite(model.fuelFraction) !== null
      ? clamp(model.fuelFraction) : null;
    const fuelTransform = 'rotate(' + (-120 + (fuelFraction === null ? 0 : fuelFraction) * 240).toFixed(2) + ' 180 180)';
    if (lastFuel !== fuelTransform) { fuelNeedle.setAttribute('transform', fuelTransform); lastFuel = fuelTransform; }
    const throttle = available ? finite(model.throttlePercent) : null;
    const throttleTransform = 'rotate(' + (-120 + (throttle === null ? 0 : clamp(throttle / 100)) * 240).toFixed(2) + ' 180 180)';
    if (lastThrottle !== throttleTransform) { throttleNeedle.setAttribute('transform', throttleTransform); lastThrottle = throttleTransform; }
    element.dataset.fuelValid = String(!ev && fuelFraction !== null);
    element.dataset.throttleValid = String(throttle !== null);
    const lit = !ev && available && mode === 'race' && finite(model.rpmRatio) !== null
      ? Math.max(0, Math.min(lamps.length, Math.ceil((model.rpmRatio - .7) / .035))) : 0;
    lamps.forEach((lamp, index) => { lamp.dataset.lit = String(index < lit); });

    write('speed', sweep || available ? whole(speed) : '—');
    write('freeSpeed', available ? whole(speed) : '—');
    write('rpm', ev ? (available ? whole(model.powerKw) : '—') : sweep || available ? whole(rpm) : '—');
    write('gear', available && !ev ? String(model.gearLabel ?? '—') : '—');
    write('fuel', ev ? available ? whole(model.powerKw) : '—' : fuelRaw === null ? '—' : decimal(fuelRaw, 2));
    write('throttle', whole(throttle));
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('lap', racing ? time(model.currentLap) : '—');
    write('best', racing ? time(model.bestLap) : '—');
    write('rank', racing && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    write('boost', available ? decimal(model.boostRaw, 2) : '—');
    write('power', available ? whole(model.powerKw) : '—');
    write('drive', ev ? 'E-DRIVE' : available ? String(model.gearLabel ?? '—') : '—');
  }

  return { element, update, destroy() { element.remove(); modeIdentity.remove(); } };
}

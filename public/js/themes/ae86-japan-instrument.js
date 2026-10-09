// Serialized into the standalone dashboard with toString(): keep helpers local.
export function createAe86JapanInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('AE86-era instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'ae86-instrument';
  element.dataset.themeInstrument = 'y1976_1985.japan';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '1976–1985 Japanese twin-dial sport instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="ae86-hood">
      <div class="ae86-top-rail"><span>SPORT METER</span><span class="ae86-mode-title" data-ae86-label="mode">RACE</span><span>JP · 1976—85</span></div>
      <div class="ae86-warning-strip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="ae86-dial-row">
        <div class="ae86-dial-unit ae86-speed-unit">
          <div class="ae86-bezel"><svg class="ae86-dial" viewBox="0 0 400 400" aria-label="Road speed">
            <circle class="ae86-bezel-line" cx="200" cy="200" r="190"/><circle class="ae86-dial-face" cx="200" cy="200" r="178"/>
            <circle class="ae86-track" cx="200" cy="200" r="150"/><g class="ae86-speed-ticks"></g>
            <path class="ae86-needle-shadow" data-ae86-needle="speed-shadow" d="M195 211 L200 71 L205 211 Z"/>
            <path class="ae86-needle" data-ae86-needle="speed" d="M197 209 L200 69 L203 209 Z"/>
            <circle class="ae86-hub" cx="200" cy="200" r="14"/><circle class="ae86-hub-pin" cx="200" cy="200" r="4"/>
          </svg><div class="ae86-dial-word"><span>SPEED</span><strong data-ae86-value="speed">—</strong><small>km/h</small></div></div>
          <div class="ae86-dial-foot"><span>BRAKE INPUT</span><b class="ae86-free-emphasis" data-ae86-value="brake">—</b><small>%</small></div>
        </div>
        <div class="ae86-middle">
          <div class="ae86-gear"><span>GEAR</span><strong data-ae86-value="gear">—</strong></div>
          <div class="ae86-divider"><i></i><i></i><i></i></div>
          <div class="ae86-central-data ae86-race-data"><span>CURRENT LAP</span><strong data-ae86-value="lap">—</strong><small>BEST <b data-ae86-value="best">—</b></small></div>
          <div class="ae86-central-data ae86-free-data"><span>THROTTLE INPUT</span><strong data-ae86-value="throttle">—</strong><small>THROTTLE %</small></div>
          <div class="ae86-shift" aria-hidden="true"><span>SHIFT</span><div class="ae86-shift-lamps"></div></div>
        </div>
        <div class="ae86-dial-unit ae86-rpm-unit">
          <div class="ae86-bezel"><svg class="ae86-dial ae86-rpm-dial" viewBox="0 0 400 400" aria-label="Engine revolutions">
            <circle class="ae86-bezel-line" cx="200" cy="200" r="190"/><circle class="ae86-dial-face" cx="200" cy="200" r="178"/>
            <circle class="ae86-track" cx="200" cy="200" r="150"/><g class="ae86-rpm-ticks"></g>
            <path class="ae86-needle-shadow" data-ae86-needle="rpm-shadow" d="M195 211 L200 71 L205 211 Z"/>
            <path class="ae86-needle" data-ae86-needle="rpm" d="M197 209 L200 69 L203 209 Z"/>
            <circle class="ae86-hub" cx="200" cy="200" r="14"/><circle class="ae86-hub-pin" cx="200" cy="200" r="4"/>
          </svg><div class="ae86-dial-word"><span data-ae86-label="rpmTitle">RPM</span><strong data-ae86-value="rpm">—</strong><small data-ae86-label="rpmUnit">r/min</small></div></div>
          <div class="ae86-dial-foot"><span>TORQUE</span><b class="ae86-race-emphasis" data-ae86-value="torque">—</b><small>Nm</small></div>
        </div>
      </div>
      <div class="ae86-bottom-rail"><span><i class="ae86-signal-lamp"></i><b data-ae86-label="signal">NO SIGNAL</b></span><div class="ae86-power-info"><span>POWER</span><b data-ae86-value="power">—</b><small>kW</small></div><span>MECHANICAL SERIES / JP</span></div>
    </div>`;
  const modeIdentity = document.createElement('div');
  modeIdentity.className = 'ae86-mode-identity';
  modeIdentity.setAttribute('aria-hidden', 'true');
  modeIdentity.innerHTML = '<span>SPORT METER / PROGRAM</span><strong data-ae86-mode="race">RACE</strong><strong data-ae86-mode="freeRoam">FREE</strong><small>1976—1985 · JAPAN</small>';
  mount.append(element, modeIdentity);

  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-ae86-value]')).map(node => [node.dataset.ae86Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-ae86-label]')).map(node => [node.dataset.ae86Label, node]));
  const needles = Object.fromEntries(Array.from(element.querySelectorAll('[data-ae86-needle]')).map(node => [node.dataset.ae86Needle, node]));
  const speedTicks = element.querySelector('.ae86-speed-ticks');
  const rpmTicks = element.querySelector('.ae86-rpm-ticks');
  const rpmDial = element.querySelector('.ae86-rpm-dial');
  const lampsRoot = element.querySelector('.ae86-shift-lamps');
  const lamps = Array.from({ length: 7 }, () => { const lamp = document.createElement('i'); lampsRoot.append(lamp); return lamp; });
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const lapTime = seconds => finite(seconds) === null || seconds < 0 ? '—' : String(Math.floor(seconds / 60)) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const write = (key, content) => { const node = values[key]; if (node && node.textContent !== content) node.textContent = content; };
  const point = (radius, degree) => {
    const radians = degree * Math.PI / 180;
    return [200 + Math.sin(radians) * radius, 200 - Math.cos(radians) * radius];
  };
  const addTick = (layer, degree, inner, outer, className) => {
    const a = point(inner, degree), b = point(outer, degree);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', a[0].toFixed(2)); line.setAttribute('y1', a[1].toFixed(2));
    line.setAttribute('x2', b[0].toFixed(2)); line.setAttribute('y2', b[1].toFixed(2));
    line.setAttribute('class', className);
    layer.append(line);
  };
  const addNumber = (layer, degree, content, isRpm) => {
    const xy = point(116, degree), label = document.createElementNS(ns, 'text');
    label.setAttribute('x', xy[0].toFixed(2)); label.setAttribute('y', xy[1].toFixed(2));
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'ae86-dial-number');
    label.textContent = content;
    layer.append(label);
  };
  for (let i = 0; i <= 56; i += 1) {
    const degree = -130 + i * (260 / 56), major = i % 7 === 0;
    addTick(speedTicks, degree, major ? 135 : 144, 160, major ? 'ae86-tick-major' : 'ae86-tick-minor');
    if (major) {
      addNumber(speedTicks, degree, String(i * 5), false);
    }
  }

  let lastMode = null, sweepSpeed = null, sweepRpm = null;
  const needleState = { speed: '', rpm: '' };
  function rotate(name, fraction) {
    // One coordinate system: the SVG path and its transform share center (200,200).
    const angle = -130 + clamp(fraction) * 260;
    const transform = 'rotate(' + angle.toFixed(2) + ' 200 200)';
    if (needleState[name] === transform) return;
    needles[name].setAttribute('transform', transform);
    needles[name + '-shadow'].setAttribute('transform', transform);
    needleState[name] = transform;
  }

  let priorRpmAxis = '';
  function drawRpmScale(max, ev) {
    const key = ev ? 'ev' : String(max);
    if (key === priorRpmAxis) return;
    priorRpmAxis = key;
    rpmTicks.innerHTML = '';
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
      addTick(rpmTicks, angle, major ? 135 : 144, 160, major ? 'ae86-tick-major' : 'ae86-tick-minor');
      if (major) addNumber(rpmTicks, angle, caption, true);
    };
    for (let index = 0; index < stops.length; index += 1) {
      markAt(stops[index], true);
      if (index === stops.length - 1) continue;
      for (let minor = 1; minor < 7; minor += 1) markAt(stops[index] + (stops[index + 1] - stops[index]) * minor / 7, false);
    }
    rpmTicks.setAttribute('data-rpm-axis-max', ev || max === null ? '' : String(max));

  }

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== 'y1976_1985.japan'));
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
    if (lastMode !== mode) { lastMode = mode; labels.mode.textContent = mode === 'race' ? 'RACE' : 'FREE'; }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.rpmTitle.textContent = ev ? 'POWER' : 'RPM';
    labels.rpmUnit.textContent = ev ? 'kW' : 'r/min';
    rpmDial.setAttribute('aria-label', ev ? 'Electric power' : 'Engine revolutions');
    drawRpmScale(scale, ev);
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) {
      sweepSpeed = clamp(override.speed) * 280;
      sweepRpm = scale === null ? null : clamp(override.rpm) * scale;
    }
    let speed = speedTarget, rpm = rpmTarget;
    if (sweep) { speed = sweepSpeed; rpm = sweepRpm; }

    const speedFraction = sweep ? clamp(override.speed) : speed !== null ? clamp(speed / 280) : 0;
    const rpmFraction = sweep ? clamp(override.rpm) : finite(context.gaugeFraction) ?? (scale && rpm !== null ? clamp(rpm / scale) : 0);
    rotate('speed', speedFraction);
    rotate('rpm', ev ? 0 : rpmFraction);
    const lit = !ev && available && mode === 'race' && finite(model.rpmRatio) !== null
      ? Math.max(0, Math.min(lamps.length, Math.ceil((model.rpmRatio - .72) / .04))) : 0;
    lamps.forEach((lamp, index) => { lamp.dataset.lit = String(index < lit); });

    write('speed', sweep || available ? whole(speed) : '—');
    write('brake', available ? whole(model.brakePercent) : '—');
    write('rpm', ev ? available ? whole(model.powerKw) : '—' : sweep || available ? whole(rpm) : '—');
    write('torque', available ? whole(model.torque) : '—');
    write('gear', available && !ev ? String(model.gearLabel ?? '—') : '—');
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('lap', racing ? lapTime(model.currentLap) : '—');
    write('best', racing ? lapTime(model.bestLap) : '—');
    write('throttle', available ? whole(model.throttlePercent) : '—');
    write('power', available ? whole(model.powerKw) : '—');
  }
  rotate('speed', 0);
  rotate('rpm', 0);
  return { element, update, destroy() { element.remove(); modeIdentity.remove(); } };
}

// The factory is serialized into the standalone dashboard with toString().
// Keep every runtime helper inside it and do not depend on module-level values.
export function createJdm90Instrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('JDM 90 instrument requires document and mount');

  const svgNS = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'jdm90-instrument';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '1995–2002 Japanese sport instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="jdm90-chassis" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="jdm90-panel">
      <div class="jdm90-shift" aria-hidden="true"><span>SHIFT</span><div class="jdm90-shift-lamps"></div><span class="jdm90-shift-end">▲</span></div>
      <div class="jdm90-left">
        <div class="jdm90-plaque"><span class="jdm90-plaque-code">TYPE 02 / JP</span><strong>SPORT<br>CLUSTER</strong><small>INSTRUMENT SYSTEM</small></div>
        <div class="jdm90-race-data">
          <div class="jdm90-readout jdm90-readout-primary"><span>CURRENT LAP</span><strong data-jdm-value="lap">—</strong></div>
          <div class="jdm90-pair"><div class="jdm90-readout"><span>BEST LAP</span><strong data-jdm-value="best">—</strong></div><div class="jdm90-readout"><span>POSITION</span><strong data-jdm-value="rank">—</strong></div></div>
          <div class="jdm90-readout jdm90-thermal"><span>TYRE / MAX</span><strong data-jdm-value="tyre">—</strong><small>°C</small></div>
        </div>
        <div class="jdm90-free-data">
          <div class="jdm90-readout jdm90-readout-primary"><span>POWER OUTPUT</span><strong data-jdm-value="freePower">—</strong><small>kW</small></div>
          <div class="jdm90-readout jdm90-fuel"><span>FUEL RAW</span><strong data-jdm-value="fuel">—</strong><small>raw</small></div>
          <div class="jdm90-free-track"><span data-jdm-label="response">ENGINE RESPONSE</span><i data-jdm-bar="throttle"></i></div>
        </div>
      </div>
      <div class="jdm90-tach">
        <div class="jdm90-tach-case">
          <svg class="jdm90-dial" viewBox="0 0 720 720" role="img" aria-label="Engine revolutions">
            <circle class="jdm90-outer-ring" cx="360" cy="360" r="337"/>
            <circle class="jdm90-inner-ring" cx="360" cy="360" r="309"/>
            <circle class="jdm90-dial-face" cx="360" cy="360" r="295"/>
            <circle class="jdm90-trace" cx="360" cy="360" r="275"/>
            <g class="jdm90-tick-layer"></g>
            <g class="jdm90-redline-layer"></g>
            <path class="jdm90-needle-shadow" d="M350 377 L360 96 L370 377 Z"/>
            <path class="jdm90-needle" d="M354 379 L360 91 L366 379 Z"/>
            <circle class="jdm90-needle-cap" cx="360" cy="360" r="19"/>
            <circle class="jdm90-needle-pin" cx="360" cy="360" r="5"/>
          </svg>
          <div class="jdm90-center-readout"><span data-jdm-label="rpm">ENGINE / r/min</span><strong data-jdm-value="rpm">—</strong><div class="jdm90-gear-box"><small>GEAR</small><b data-jdm-value="gear">—</b></div></div>
          <div class="jdm90-dial-serial">JDM / PERFORMANCE SYSTEM 02</div>
        </div>
      </div>
      <div class="jdm90-right">
        <div class="jdm90-mode-flag"><i></i><span data-jdm-label="mode">RACE SPEC</span><small>1995—2002</small></div>
        <div class="jdm90-speed-window"><span>VELOCITY</span><strong data-jdm-value="speed">—</strong><small>km/h</small><i class="jdm90-speed-stripe"></i></div>
        <div class="jdm90-right-details jdm90-race-data"><div><span>POWER</span><strong data-jdm-value="racePower">—</strong><small>kW</small></div><div class="jdm90-boost"><span>BOOST</span><strong data-jdm-value="boost">—</strong><small>RAW</small></div></div>
        <div class="jdm90-right-details jdm90-free-data"><div><span>THROTTLE</span><strong data-jdm-value="throttle">—</strong><small>%</small></div><div><span>DRIVE</span><strong data-jdm-value="drive">—</strong></div></div>
      </div>
      <div class="jdm90-status"><span><i class="jdm90-status-lamp"></i><b data-jdm-label="signal">NO SIGNAL</b></span><span>TYPE 02 <i>///</i> FUNCTION FIRST</span></div>
    </div>`;

  const modeIdentity = document.createElement('div');
  modeIdentity.className = 'jdm90-mode-identity';
  modeIdentity.setAttribute('aria-hidden', 'true');
  modeIdentity.innerHTML = '<span>DRIVE PROGRAM</span><strong data-jdm-mode="race">RACE</strong><strong data-jdm-mode="freeRoam">FREE</strong><small>TYPE 02 / SYSTEM READY</small>';
  // Keep the program identity outside the dimmed panel so it stays legible
  // while the old mode powers down and the target mode is announced.
  mount.append(element, modeIdentity);

  const dial = element.querySelector('.jdm90-dial');
  const ticks = element.querySelector('.jdm90-tick-layer');
  const redline = element.querySelector('.jdm90-redline-layer');
  const lamps = element.querySelector('.jdm90-shift-lamps');
  const refs = Object.fromEntries(Array.from(element.querySelectorAll('[data-jdm-value]')).map(node => [node.dataset.jdmValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-jdm-label]')).map(node => [node.dataset.jdmLabel, node]));
  const bar = element.querySelector('[data-jdm-bar="throttle"]');
  const needle = element.querySelector('.jdm90-needle');
  const needleShadow = element.querySelector('.jdm90-needle-shadow');
  const shiftLamps = Array.from({ length: 10 }, (_, index) => {
    const lamp = document.createElement('i');
    lamp.style.setProperty('--jdm-lamp', String(index));
    lamps.append(lamp);
    return lamp;
  });
  const polar = (radius, degree) => {
    const radians = degree * Math.PI / 180;
    return [360 + Math.sin(radians) * radius, 360 - Math.cos(radians) * radius];
  };
  const line = (parent, degree, innerRadius, outerRadius, className) => {
    const [x1, y1] = polar(innerRadius, degree);
    const [x2, y2] = polar(outerRadius, degree);
    const node = document.createElementNS(svgNS, 'line');
    node.setAttribute('x1', x1.toFixed(2));
    node.setAttribute('y1', y1.toFixed(2));
    node.setAttribute('x2', x2.toFixed(2));
    node.setAttribute('y2', y2.toFixed(2));
    node.setAttribute('class', className);
    parent.append(node);
  };


  let lastMode = null;
  let sweepSpeed = 0;
  let sweepRpm = 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.min(1, Math.max(0, value));
  const write = (name, value) => {
    const node = refs[name];
    if (node && node.textContent !== value) node.textContent = value;
  };
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = (value, places) => finite(value) === null ? '—' : value.toFixed(places);
  const lapTime = seconds => finite(seconds) === null || seconds < 0 ? '—' : String(Math.floor(seconds / 60)) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const normalizeMode = mode => mode === 'freeRoam' || mode === 'free' ? 'freeRoam' : 'race';

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
      const angle = -120 + (clamp(start) + (clamp(end) - clamp(start)) * index / 6) * 240;
      line(redlineLayer, angle, 251, 277, 'jdm90-redline-mark');
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
      const angle = -120 + value / axisMax * 240;
      const caption = ev || max === null ? '' : String(Number((value / 1000).toFixed(2)));
      line(ticks, angle, major ? 243 : 255, 273, major ? 'jdm90-tick-major' : 'jdm90-tick-minor');
      if (major) {
        const [x, y] = polar(212, angle), label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', x.toFixed(2)); label.setAttribute('y', y.toFixed(2));
        label.setAttribute('class', 'jdm90-tick-label'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
        label.textContent = caption; ticks.append(label);
      }
    };
    for (let index = 0; index < stops.length; index += 1) {
      markAt(stops[index], true);
      if (index === stops.length - 1) continue;
      for (let minor = 1; minor < 5; minor += 1) markAt(stops[index] + (stops[index + 1] - stops[index]) * minor / 5, false);
    }
    ticks.setAttribute('data-rpm-axis-max', ev || max === null ? '' : String(max));

  }

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== 'y1995_2002.japan'));
    const stale = Boolean(context.stale ?? model.stale);
    const mode = normalizeMode(context.mode);
    const ev = String(context.powertrain || root?.dataset.displayOverride || '').toLowerCase() === 'ev'
      || String(context.powertrain || '').toLowerCase() === 'electric';
    const sweep = context.displayOverride && finite(context.displayOverride.rpm) !== null;
    const rpmMax = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const available = !stale;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.sweep = String(Boolean(sweep));

    if (lastMode !== mode) {
      lastMode = mode;
      labels.mode.textContent = mode === 'race' ? 'RACE SPEC' : 'STREET SPEC';
    }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.rpm.textContent = ev ? 'POWER / kW' : 'ENGINE / r/min';
    labels.response.textContent = ev ? 'DRIVE RESPONSE' : 'ENGINE RESPONSE';
    dial.setAttribute('aria-label', ev ? 'Electric power readout' : 'Engine revolutions');
    drawRpmScale(rpmMax, ev);

    const rpmFraction = finite(context.gaugeFraction) ?? finite(model.rpmRatio) ?? 0;
    const needleFraction = ev ? 0 : clamp(rpmFraction);
    const angle = -120 + needleFraction * 240;
    const transform = 'rotate(' + angle.toFixed(2) + ' 360 360)';
    needle.setAttribute('transform', transform);
    needleShadow.setAttribute('transform', transform);
    const lit = available && !ev && mode === 'race' && finite(model.rpmRatio) !== null
      ? Math.max(0, Math.min(10, Math.ceil((model.rpmRatio - 0.72) / 0.028))) : 0;
    shiftLamps.forEach((lamp, index) => { lamp.dataset.lit = String(index < lit); });

    updateRedline(model, context, rpmMax, ev);
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (sweep) {
      sweepSpeed = Math.round(clamp(context.displayOverride.speed ?? 0) * 280);
      sweepRpm = rpmMax === null ? 0 : Math.round(clamp(context.displayOverride.rpm) * rpmMax);
    }
    let speed = speedTarget;
    let rpm = rpmTarget;
    if (sweep) {
      speed = sweepSpeed;
      rpm = sweepRpm;
    }
    write('speed', whole(speed));
    write('gear', available ? String(model.gearLabel ?? '—') : '—');
    write('rpm', ev ? available ? decimal(model.powerKw, 0) : '—'
      : available || sweep ? whole(rpm) : '—');

    const race = mode === 'race' && Boolean(context.racing) && available;
    write('lap', race ? lapTime(model.currentLap) : '—');
    write('best', race ? lapTime(model.bestLap) : '—');
    write('rank', race && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    const temperatures = Array.isArray(model.wheels) ? model.wheels.map(wheel => finite(wheel?.tempC)).filter(value => value !== null) : [];
    write('tyre', available && temperatures.length ? whole(Math.max(...temperatures)) : '—');
    write('racePower', available ? decimal(model.powerKw, 0) : '—');
    write('boost', available ? decimal(model.boostRaw, 2) : '—');
    write('freePower', available ? decimal(model.powerKw, 0) : '—');
    const fuel = finite(model.fuelRaw);
    write('fuel', available && fuel !== null ? decimal(fuel, 2) : '—');
    const throttle = available ? finite(model.throttlePercent) : null;
    write('throttle', whole(throttle));
    write('drive', available ? String(model.gearLabel ?? '—') : '—');
    bar.style.transform = 'scaleX(' + (throttle === null ? 0 : clamp(throttle / 100)).toFixed(3) + ')';
  }

  return { element, update, destroy() { element.remove(); modeIdentity.remove(); } };
}

// Serialized into the standalone dashboard through toString(). Keep helpers local.
export function createC8AmericaInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('C8 instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'c8-america-instrument';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '2020–2024 American performance digital instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="c8-housing">
      <div class="c8-header"><span class="c8-edition">PERFORMANCE DISPLAY <b>08</b></span><span class="c8-header-mode" data-c8-label="mode">TRACK</span><span class="c8-link"><i></i><b data-c8-label="signal">NO SIGNAL</b></span></div>
      <div class="c8-deck">
        <div class="c8-side c8-side-left">
          <div class="c8-tile c8-race"><small>POSITION</small><strong data-c8-value="rank">—</strong><span>RACE ORDER</span></div>
          <div class="c8-tile c8-race"><small>CURRENT LAP</small><strong data-c8-value="lap">—</strong><span>SESSION TIME</span></div>
          <div class="c8-tile c8-free"><small>POWER</small><strong data-c8-value="power">—</strong><span>kW · LIVE OUTPUT</span></div>
          <div class="c8-tile c8-free"><small>THROTTLE</small><strong data-c8-value="throttle">—</strong><span>PERCENT INPUT</span></div>
        </div>
        <div class="c8-core">
          <div class="c8-arch"><svg class="c8-arc-svg" viewBox="0 0 1000 500" aria-hidden="true"><path class="c8-arc-bed"></path><path class="c8-arc-fill"></path><g class="c8-arc-ticks"></g></svg></div>
          <div class="c8-main-readout">
            <span class="c8-primary-label" data-c8-label="primary">ENGINE / RPM</span>
            <strong class="c8-rpm" data-c8-value="rpm">—</strong>
            <div class="c8-main-pair"><div class="c8-gear"><small data-c8-label="gear">GEAR</small><b data-c8-value="gear">—</b></div><div class="c8-speed"><strong data-c8-value="speed">—</strong><span data-c8-label="secondaryUnit">KM/H</span></div></div>
          </div>
          <div class="c8-arc-caption"><span>0</span><b data-c8-label="arc">ENGINE SPEED · r/min</b><span data-c8-value="max">—</span></div>
        </div>
        <div class="c8-side c8-side-right">
          <div class="c8-tile c8-race"><small>BEST LAP</small><strong data-c8-value="best">—</strong><span>SESSION BEST</span></div>
          <div class="c8-tile c8-race"><small>G · X AXIS</small><strong data-c8-value="g">—</strong><span>LIVE ACCELERATION</span></div>
          <div class="c8-tile c8-free"><small>TOP SPEED</small><strong data-c8-value="top">—</strong><span>KM/H · SESSION</span></div>
          <div class="c8-tile c8-free"><small>DRIVE STATE</small><strong data-c8-value="state">—</strong><span>CURRENT GEAR</span></div>
        </div>
      </div>
      <div class="c8-footer"><span>DRIVER INFORMATION CENTER</span><span class="c8-footer-bars"><i></i><i></i><i></i></span><span>AMERICAN PERFORMANCE / 2020—24</span></div>
    </div>`;
  const modeIdentity = document.createElement('div');
  modeIdentity.className = 'c8-mode-identity';
  modeIdentity.setAttribute('aria-hidden', 'true');
  modeIdentity.innerHTML = '<small>DISPLAY RECONFIGURATION</small><strong data-c8-mode="race">TRACK</strong><strong data-c8-mode="freeRoam">TOUR</strong><span><i></i><i></i><i></i><i></i><i></i></span>';
  mount.append(element, modeIdentity);

  const refs = Object.fromEntries(Array.from(element.querySelectorAll('[data-c8-value]')).map(node => [node.dataset.c8Value, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-c8-label]')).map(node => [node.dataset.c8Label, node]));
  const tickLayer = element.querySelector('.c8-arc-ticks');
  const bed = element.querySelector('.c8-arc-bed');
  const fill = element.querySelector('.c8-arc-fill');
  const polar = (radius, degrees) => {
    const angle = degrees * Math.PI / 180;
    return [500 + Math.sin(angle) * radius, 480 - Math.cos(angle) * radius];
  };
  const points = Array.from({ length: 65 }, (_, index) => polar(360, -80 + 160 * index / 64));
  const path = points.map(([x, y], index) => (index ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ');
  bed.setAttribute('d', path);
  fill.setAttribute('d', path);
  for (let index = 0; index <= 32; index += 1) {
    const degrees = -80 + index * 5;
    const major = index % 4 === 0;
    const [x1, y1] = polar(major ? 320 : 335, degrees);
    const [x2, y2] = polar(350, degrees);
    const mark = document.createElementNS(ns, 'line');
    mark.setAttribute('x1', x1.toFixed(2)); mark.setAttribute('y1', y1.toFixed(2));
    mark.setAttribute('x2', x2.toFixed(2)); mark.setAttribute('y2', y2.toFixed(2));
    mark.setAttribute('class', major ? 'c8-arc-major' : 'c8-arc-minor');
    tickLayer.append(mark);
  }
  const arcLength = fill.getTotalLength();
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const lap = seconds => finite(seconds) === null || seconds < 0 ? '—' : Math.floor(seconds / 60) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const write = (key, value) => { if (refs[key] && refs[key].textContent !== value) refs[key].textContent = value; };
  let lastMode = 'race';
  let lastSweep = null;
  let handoff = null;
  let arcShown = -1;

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const active = root?.dataset.themeId === 'y2020_2024.america';
    element.setAttribute('aria-hidden', String(!active));
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const phase = root?.dataset.ignitionPhase || 'live';
    const modeChangingOut = root?.dataset.ignitionKind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase);
    const mode = modeChangingOut ? lastMode : requestedMode;
    lastMode = mode;
    const stale = Boolean(context.stale ?? model.stale);
    const available = !stale;
    const powertrain = String(context.powertrain || root?.dataset.powertrain || '').toLowerCase();
    const ev = powertrain === 'ev' || powertrain === 'electric';
    const override = context.displayOverride;
    const scanning = finite(override?.speed) !== null && finite(override?.rpm) !== null;
    const max = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const fraction = mode === 'freeRoam'
      ? clamp(scanning ? override.speed : available && finite(model.speedKmh) !== null ? model.speedKmh / 260 : 0)
      : ev ? (scanning ? clamp(override.rpm) : available && finite(model.throttlePercent) !== null ? clamp(model.throttlePercent / 100) : 0)
        : clamp(finite(context.gaugeFraction) ?? finite(model.rpmRatio) ?? 0);
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.scan = String(scanning);
    labels.mode.textContent = mode === 'race' ? 'TRACK' : 'TOUR';
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.primary.textContent = mode === 'freeRoam' ? 'VELOCITY / KM/H' : ev ? 'POWER / kW' : 'ENGINE / RPM';
    labels.arc.textContent = mode === 'freeRoam' ? 'VEHICLE SPEED · KM/H' : ev ? 'DRIVE INPUT · %' : 'ENGINE SPEED · r/min';
    labels.gear.textContent = ev ? 'DRIVE' : 'GEAR';
    labels.secondaryUnit.textContent = mode === 'race' ? 'KM/H' : ev ? 'kW' : 'RPM';
    write('max', mode === 'freeRoam' ? '260' : ev ? '100%' : max === null ? '—' : whole(max));
    if (Math.abs(arcShown - fraction) > .002) {
      arcShown = fraction;
      fill.style.strokeDasharray = (arcLength * fraction).toFixed(1) + ' ' + arcLength.toFixed(1);
    }

    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    if (scanning) {
      lastSweep = { speed: clamp(override.speed) * 260, rpm: clamp(override.rpm) * (max ?? 8000) };
      handoff = null;
    } else if (lastSweep) {
      handoff = { ...lastSweep, started: Date.now() };
      lastSweep = null;
    }
    let speed = speedTarget;
    let rpm = rpmTarget;
    if (scanning) {
      speed = lastSweep.speed;
      rpm = lastSweep.rpm;
    } else if (handoff && available) {
      const t = clamp((Date.now() - handoff.started) / 480);
      const ease = t * t * (3 - 2 * t);
      if (speedTarget !== null) speed = handoff.speed + (speedTarget - handoff.speed) * ease;
      if (rpmTarget !== null) rpm = handoff.rpm + (rpmTarget - handoff.rpm) * ease;
      if (t >= 1) handoff = null;
    } else if (!available) handoff = null;
    const speedDisplay = (available || scanning) && speed !== null ? whole(speed) : '—';
    const driveDisplay = ev ? available ? whole(model.powerKw) : '—' : (available || scanning) && rpm !== null ? whole(rpm) : '—';
    write('rpm', mode === 'freeRoam' ? speedDisplay : driveDisplay);
    write('speed', mode === 'freeRoam' ? driveDisplay : speedDisplay);
    write('gear', ev ? 'EV' : available ? String(model.gearLabel ?? '—') : '—');
    const racing = available && mode === 'race' && Boolean(context.racing);
    write('lap', racing ? lap(model.currentLap) : '—');
    write('best', racing ? lap(model.bestLap) : '—');
    write('rank', racing && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    write('g', available && finite(model.gX) !== null ? Math.abs(model.gX).toFixed(2) + ' G' : '—');
    write('power', available ? whole(model.powerKw) : '—');
    write('throttle', available ? whole(model.throttlePercent) : '—');
    write('top', available ? whole(context.topSpeed) : '—');
    write('state', ev ? 'E-DRIVE' : available ? String(model.gearLabel ?? '—') : '—');
  }

  return { element, update, destroy() { element.remove(); modeIdentity.remove(); } };
}

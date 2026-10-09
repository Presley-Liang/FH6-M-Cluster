// Embedded through toString(): keep helpers inside this factory.
export function createPanoramicEuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Panoramic European instrument requires document and mount');
  const element = document.createElement('section');
  element.className = 'pan-instrument';
  element.dataset.themeInstrument = 'y2025plus.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '2025+ European panoramic projection instrument');
  element.innerHTML = `<div class="pan-windshield"><div class="pan-horizon"></div>
    <div class="pan-projection"><div class="pan-projection-left"><span class="pan-kicker">DRIVER VISION</span><div class="pan-speed"><strong data-pan-value="speed">—</strong><small>KM/H</small></div><div class="pan-gear"><span data-pan-label="gear">GEAR</span><b data-pan-value="gear">—</b></div></div>
      <div class="pan-projection-middle"><div class="pan-mid-heading"><span data-pan-label="main">ENGINE SPEED</span><small data-pan-label="mainUnit">RPM</small></div><strong data-pan-value="main">—</strong><div class="pan-power-track"><i data-pan-meter="power"></i><span></span><span></span><span></span><span></span><span></span><span></span></div><span class="pan-mid-foot" data-pan-label="midFoot">PERFORMANCE / RACE</span></div>
      <div class="pan-projection-right"><div class="pan-right-top"><span data-pan-label="rightTop">CURRENT LAP</span><strong data-pan-value="rightTop">—</strong><small data-pan-label="rightTopUnit">TIME</small></div><div class="pan-right-bottom"><span data-pan-label="rightBottom">BEST LAP</span><strong data-pan-value="rightBottom">—</strong><small data-pan-label="rightBottomUnit">TIME</small></div></div>
    </div><div class="pan-sweep-beam" aria-hidden="true"></div></div>
    <div class="pan-cockpit"><div class="pan-cockpit-line"></div><div class="pan-cockpit-shadow"></div><div class="pan-float"><div class="pan-float-head"><span data-pan-label="mode">RACE</span><small data-pan-value="status">NO SIGNAL</small></div><div class="pan-float-grid"><div><span data-pan-label="floatA">LATERAL G</span><strong data-pan-value="floatA">—</strong><small data-pan-label="floatAUnit">g</small></div><div><span data-pan-label="floatB">ENGINE OUTPUT</span><strong data-pan-value="floatB">—</strong><small data-pan-label="floatBUnit">kW</small></div></div><div class="pan-float-foot"><i></i><span data-pan-label="foot">TRACK DATA</span></div></div></div>`;
  // Keep supplementary data in the projection itself; the dash below stays a
  // continuous physical surface rather than a second floating instrument.
  element.querySelector('.pan-projection-right').append(element.querySelector('.pan-float'));
  const identity = document.createElement('div');
  identity.className = 'pan-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>VISION RECONFIGURATION</small><strong data-pan-mode="race">RACE</strong><strong data-pan-mode="freeRoam">FREE</strong><span><i></i><i></i><i></i><i></i></span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-pan-value]')).map(node => [node.dataset.panValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-pan-label]')).map(node => [node.dataset.panLabel, node]));
  const meter = element.querySelector('[data-pan-meter="power"]');
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = value => finite(value) === null ? '—' : value.toFixed(2);
  const lap = value => finite(value) === null || value <= 0 ? '—' : Math.floor(value / 60) + ':' + (value % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromFraction = fraction => {
    const index = clamp(fraction) * (speedStops.length - 1);
    const lower = Math.min(speedStops.length - 2, Math.floor(index));
    return speedStops[lower] + (speedStops[lower + 1] - speedStops[lower]) * (index - lower);
  };
  let priorMode = 'race', lastSweep = null, shownFraction = -1;
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live';
    const kind = root?.dataset.ignitionKind || '';
    const requested = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? priorMode : requested;
    priorMode = mode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweeping = finite(override?.speed) !== null && finite(override?.rpm) !== null;
    const rpmMax = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available && !ev ? finite(model.rpm) : null;
    if (sweeping) {
      lastSweep = { speed: speedFromFraction(override.speed), rpm: rpmMax === null ? null : clamp(override.rpm) * rpmMax };
    }
    let speed = sweeping ? lastSweep.speed : speedTarget;
    let rpm = sweeping ? lastSweep.rpm : rpmTarget;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    const racing = mode === 'race' && Boolean(context.racing) && available;
    label('mode', mode === 'race' ? 'RACE' : 'FREE');
    label('gear', ev ? 'ELECTRIC DRIVE' : mode === 'race' ? 'SELECTED GEAR' : 'GEAR');
    label('main', mode === 'race' ? ev ? 'DRIVE OUTPUT' : 'ENGINE SPEED' : 'DRIVE OUTPUT');
    label('mainUnit', mode === 'race' && !ev ? 'RPM' : 'kW');
    label('midFoot', ev || mode === 'freeRoam' ? 'DRIVE INPUT · %' : sweeping && rpmMax === null ? 'DISPLAY SCAN' : rpmMax === null ? 'RPM RANGE UNKNOWN' : 'ENGINE SCALE · RPM');
    label('rightTop', mode === 'race' ? 'CURRENT LAP' : 'THROTTLE INPUT');
    label('rightTopUnit', mode === 'race' ? 'TIME' : '%');
    label('rightBottom', mode === 'race' ? 'BEST LAP' : ev ? 'DRIVE INPUT' : 'ENGINE SPEED');
    label('rightBottomUnit', mode === 'race' ? 'TIME' : ev ? '%' : 'RPM');
    label('floatA', mode === 'race' ? 'LATERAL G' : 'DRIVE STATE');
    label('floatAUnit', mode === 'race' ? 'g' : '');
    label('floatB', mode === 'race' ? ev ? 'THROTTLE INPUT' : 'ENGINE OUTPUT' : ev ? 'DRIVE OUTPUT' : 'ENGINE OUTPUT');
    label('floatBUnit', mode === 'race' && ev ? '%' : 'kW');
    label('foot', mode === 'race' ? 'TRACK DATA' : 'ROAD DATA');
    write('status', available ? 'TELEMETRY LIVE' : 'NO SIGNAL');
    write('speed', sweeping || available ? whole(speed) : '—');
    write('gear', available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : '—');
    const main = mode === 'race' && !ev ? rpm : available ? finite(model.powerKw) : null;
    write('main', mode === 'race' && !ev ? sweeping || available ? whole(main) : '—' : available ? whole(main) : '—');
    const fraction = ev ? sweeping ? clamp(override.rpm) : available && finite(model.throttlePercent) !== null ? clamp(model.throttlePercent / 100) : 0 : mode === 'race' ? sweeping ? clamp(override.rpm) : rpm === null || rpmMax === null ? 0 : clamp(rpm / rpmMax) : available && finite(model.throttlePercent) !== null ? clamp(model.throttlePercent / 100) : 0;
    if (Math.abs(fraction - shownFraction) > .002) {
      shownFraction = fraction;
      meter.style.width = (fraction * 100).toFixed(2) + '%';
    }
    write('rightTop', mode === 'race' ? racing ? lap(model.currentLap) : '—' : available ? whole(model.throttlePercent) : '—');
    write('rightBottom', mode === 'race' ? racing ? lap(model.bestLap) : '—' : ev ? available ? whole(model.throttlePercent) : '—' : sweeping || available ? whole(rpm) : '—');
    write('floatA', mode === 'race' ? available ? decimal(model.gX) : '—' : available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : '—');
    write('floatB', available ? whole(mode === 'race' && ev ? model.throttlePercent : model.powerKw) : '—');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

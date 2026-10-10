// Embedded through toString(): every helper must remain inside this factory.
export function createTaycanEuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Curved European instrument requires document and mount');
  const element = document.createElement('section');
  element.className = 'tay-instrument';
  element.dataset.themeInstrument = 'y2020_2024.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '2020–2024 European floating curved instrument');
  element.innerHTML = `<div class="tay-glass">
    <div class="tay-top"><span class="tay-top-index">INSTRUMENT / 20—24</span><span data-tay-label="mode">RACE</span><span data-tay-value="status">NO SIGNAL</span></div>
    <div class="tay-body">
      <div class="tay-drive"><span class="tay-eyebrow" data-tay-label="drive">ENGINE SPEED</span><div class="tay-drive-face"><strong data-tay-value="drive">—</strong><small data-tay-label="driveUnit">RPM</small></div><div class="tay-drive-scale"><div class="tay-drive-track"><i data-tay-meter="drive"></i></div><div class="tay-drive-graduations"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="tay-drive-note" data-tay-label="driveNote">POWERTRAIN</span></div>
      <div class="tay-speed"><span class="tay-speed-heading" data-tay-label="speedHeading">ROAD SPEED</span><div class="tay-speed-number"><strong data-tay-value="speed">—</strong><small>KM/H</small></div><div class="tay-speed-under"><i></i><span data-tay-label="centerFoot">DRIVE / FREE</span><i></i></div></div>
      <div class="tay-side"><div class="tay-side-main"><span data-tay-label="sideMain">SELECTED GEAR</span><strong data-tay-value="sideMain">—</strong><small data-tay-label="sideUnit">DRIVE</small></div><div class="tay-side-secondary"><span data-tay-label="sideSecond">OUTPUT</span><strong data-tay-value="sideSecond">—</strong><small data-tay-label="sideSecondUnit">kW</small></div></div>
    </div>
    <div class="tay-lower"><div><span data-tay-label="foot1">THROTTLE INPUT</span><strong data-tay-value="foot1">—</strong><small data-tay-label="foot1Unit">%</small></div><div><span data-tay-label="foot2">ENGINE OUTPUT</span><strong data-tay-value="foot2">—</strong><small data-tay-label="foot2Unit">kW</small></div><div><span data-tay-label="foot3">DRIVE STATE</span><strong data-tay-value="foot3">—</strong><small data-tay-label="foot3Unit"></small></div></div>
    <div class="tay-bottom"><span>EUROPEAN PERFORMANCE</span><div class="tay-bottom-line"><i></i><i></i><i></i><i></i><i></i></div><span data-tay-label="bottom">DRIVE INFORMATION</span></div>
  </div>`;
  const identity = document.createElement('div');
  identity.className = 'tay-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>INSTRUMENT CONFIGURATION</small><strong data-tay-mode="race">RACE</strong><strong data-tay-mode="freeRoam">FREE</strong><span><i></i><i></i><i></i></span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-tay-value]')).map(node => [node.dataset.tayValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-tay-label]')).map(node => [node.dataset.tayLabel, node]));
  const meter = element.querySelector('[data-tay-meter="drive"]');
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = value => finite(value) === null ? '—' : value.toFixed(2);
  const lap = value => finite(value) === null || value <= 0 ? '—' : Math.floor(value / 60) + ':' + (value % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  // The shared animation emits a nonlinear legacy speed dial fraction.
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromFraction = fraction => {
    const index = clamp(fraction) * (speedStops.length - 1);
    const lower = Math.min(speedStops.length - 2, Math.floor(index));
    return speedStops[lower] + (speedStops[lower + 1] - speedStops[lower]) * (index - lower);
  };
  let priorMode = 'race', lastSweep = null, shownDrive = -1;
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
    label('mode', mode === 'race' ? 'RACE' : 'FREE');
    label('drive', ev ? 'DRIVE INPUT' : sweeping && rpmMax === null ? 'DISPLAY SCAN' : 'ENGINE SPEED');
    label('driveUnit', ev ? '%' : sweeping && rpmMax === null ? '' : 'RPM');
    label('driveNote', ev ? 'ELECTRIC DRIVE' : rpmMax === null ? 'RPM RANGE UNKNOWN' : 'POWERTRAIN');
    label('speedHeading', mode === 'race' ? 'VELOCITY / TRACK' : 'ROAD SPEED');
    label('centerFoot', mode === 'race' ? 'PERFORMANCE / RACE' : 'DRIVE / FREE');
    label('sideMain', ev ? 'DRIVE OUTPUT' : 'SELECTED GEAR');
    label('sideUnit', ev ? 'kW' : 'DRIVE');
    label('sideSecond', mode === 'race' ? 'CURRENT LAP' : ev ? 'SELECTED GEAR' : 'ENGINE OUTPUT');
    label('sideSecondUnit', mode === 'race' ? 'TIME' : ev ? '' : 'kW');
    label('foot1', mode === 'race' ? 'LATERAL G' : ev ? 'BRAKE INPUT' : 'THROTTLE INPUT');
    label('foot1Unit', mode === 'race' ? 'g' : '%');
    label('foot2', mode === 'race' ? 'BEST LAP' : ev ? 'LATERAL G' : 'BRAKE INPUT');
    label('foot2Unit', mode === 'race' ? 'TIME' : ev ? 'g' : '%');
    label('foot3', mode === 'race' ? ev ? 'BRAKE INPUT' : 'ENGINE OUTPUT' : ev ? 'LONG. G' : 'LATERAL G');
    label('foot3Unit', mode === 'race' ? ev ? '%' : 'kW' : 'g');
    label('bottom', mode === 'race' ? 'TRACK INFORMATION' : 'DRIVE INFORMATION');
    write('status', available ? 'TELEMETRY LIVE' : 'NO SIGNAL');
    write('speed', sweeping || available ? whole(speed) : '—');
    const driveFraction = ev ? sweeping ? clamp(override.rpm) : available && finite(model.throttlePercent) !== null ? clamp(model.throttlePercent / 100) : 0 : sweeping ? clamp(override.rpm) : rpm === null || rpmMax === null ? 0 : clamp(rpm / rpmMax);
    if (Math.abs(driveFraction - shownDrive) > .002) {
      shownDrive = driveFraction;
      meter.style.height = (driveFraction * 100).toFixed(2) + '%';
    }
    write('drive', ev ? sweeping ? whole(clamp(override.rpm) * 100) : available ? whole(model.throttlePercent) : '—' : sweeping || available ? whole(rpm) : '—');
    write('sideMain', available ? ev ? whole(model.powerKw) : String(model.gearLabel ?? '—') : '—');
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('sideSecond', mode === 'race' ? racing ? lap(model.currentLap) : '—' : available ? ev ? String(model.gearLabel ?? '—') : whole(model.powerKw) : '—');
    write('foot1', mode === 'race' ? available ? decimal(model.gX) : '—' : available ? whole(ev ? model.brakePercent : model.throttlePercent) : '—');
    write('foot2', mode === 'race' ? racing ? lap(model.bestLap) : '—' : available ? ev ? decimal(model.gX) : whole(model.brakePercent) : '—');
    write('foot3', mode === 'race' ? available ? whole(ev ? model.brakePercent : model.powerKw) : '—' : available ? decimal(ev ? model.gZ : model.gX) : '—');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

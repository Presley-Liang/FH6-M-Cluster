// Embedded through toString(): helpers stay inside this factory.
export function createFordGtAmericaInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Ford GT-era instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'fgt-instrument';
  element.dataset.themeInstrument = 'y2015_2019.america';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '2015–2019 American compact digital performance instrument');
  element.innerHTML = `<div class="fgt-surround"><div class="fgt-display">
    <div class="fgt-header"><span>PERFORMANCE / 17</span><b data-fgt-label="mode">RACE</b><span data-fgt-value="status">NO SIGNAL</span></div>
    <div class="fgt-tach"><svg viewBox="0 0 1000 245" preserveAspectRatio="none" aria-hidden="true"><path class="fgt-tach-bed" d="M 70 118 L 820 118 Q 908 118 926 205"/><path class="fgt-tach-fill" d="M 70 118 L 820 118 Q 908 118 926 205"/><g class="fgt-tach-ticks"></g><g class="fgt-tach-labels"></g></svg><div class="fgt-tach-caption"><span data-fgt-label="tach">ENGINE SPEED</span><strong data-fgt-value="rpm">—</strong><em data-fgt-label="tachUnit">RPM</em></div></div>
    <div class="fgt-main"><div class="fgt-main-left"><span data-fgt-label="side">OUTPUT</span><strong data-fgt-value="side">—</strong><small data-fgt-label="sideUnit">kW</small></div><div class="fgt-main-primary"><span data-fgt-label="primary">GEAR</span><strong data-fgt-value="primary">—</strong><small data-fgt-label="primaryUnit">SELECTED</small></div><div class="fgt-main-secondary"><span data-fgt-label="secondary">ROAD SPEED</span><strong data-fgt-value="secondary">—</strong><small data-fgt-label="secondaryUnit">KM/H</small></div></div>
    <div class="fgt-data-strip"><div><span data-fgt-label="detail1">CURRENT LAP</span><strong data-fgt-value="detail1">—</strong><small data-fgt-label="detail1Unit">TIME</small></div><div><span data-fgt-label="detail2">BEST LAP</span><strong data-fgt-value="detail2">—</strong><small data-fgt-label="detail2Unit">TIME</small></div><div><span data-fgt-label="detail3">LATERAL G</span><strong data-fgt-value="detail3">—</strong><small data-fgt-label="detail3Unit">g</small></div></div>
    <div class="fgt-footer"><span>DRIVER INFORMATION</span><i></i><span data-fgt-label="footer">TRACK CONFIGURATION</span></div>
  </div></div>`;
  const identity = document.createElement('div');
  identity.className = 'fgt-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY RECONFIGURATION</small><strong data-fgt-mode="race">RACE</strong><strong data-fgt-mode="freeRoam">FREE</strong><span><i></i><i></i><i></i><i></i></span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-fgt-value]')).map(node => [node.dataset.fgtValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-fgt-label]')).map(node => [node.dataset.fgtLabel, node]));
  const fill = element.querySelector('.fgt-tach-fill');
  const bed = element.querySelector('.fgt-tach-bed');
  const ticks = element.querySelector('.fgt-tach-ticks');
  const tickLabels = element.querySelector('.fgt-tach-labels');
  const length = bed.getTotalLength();
  fill.style.strokeDasharray = `0 ${length.toFixed(2)}`;
  for (let i = 0; i <= 32; i += 1) {
    const distance = length * i / 32;
    const p = bed.getPointAtLength(distance);
    const before = bed.getPointAtLength(Math.max(0, distance - 2));
    const after = bed.getPointAtLength(Math.min(length, distance + 2));
    const tangentLength = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const normalX = (after.y - before.y) / tangentLength;
    const normalY = -(after.x - before.x) / tangentLength;
    const tickHeight = i % 4 === 0 ? 16 : 9;
    const mark = document.createElementNS(ns, 'line');
    mark.setAttribute('x1', (p.x + normalX * tickHeight).toFixed(2));
    mark.setAttribute('y1', (p.y + normalY * tickHeight).toFixed(2));
    mark.setAttribute('x2', (p.x + normalX * 3).toFixed(2));
    mark.setAttribute('y2', (p.y + normalY * 3).toFixed(2));
    mark.setAttribute('class', i % 4 === 0 ? 'fgt-tick-major' : 'fgt-tick-minor');
    ticks.append(mark);
  }
  const scaleTexts = [0, .25, .625, 1].map(fraction => {
    const p = bed.getPointAtLength(length * fraction);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', p.x.toFixed(2));
    text.setAttribute('y', String(Math.min(235, p.y + 30)));
    text.setAttribute('text-anchor', 'middle');
    tickLabels.append(text);
    return text;
  });
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = value => finite(value) === null ? '—' : value.toFixed(2);
  const lap = seconds => finite(seconds) === null || seconds <= 0 ? '—' : Math.floor(seconds / 60) + ':' + (seconds % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  // Shared speed override uses the legacy nonlinear dial stops.
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromFraction = fraction => {
    const index = clamp(fraction) * (speedStops.length - 1);
    const lower = Math.min(speedStops.length - 2, Math.floor(index));
    return speedStops[lower] + (speedStops[lower + 1] - speedStops[lower]) * (index - lower);
  };
  // Like the GT reference, low revs are compressed and the upper range expands.
  const tachFraction = (rpm, max) => {
    const ratio = clamp((rpm || 0) / max);
    return ratio <= .43 ? ratio / .43 * .25 : .25 + (ratio - .43) / .57 * .75;
  };
  let priorMode = 'race', priorScale = null, priorEv = false;
  let lastSweep = null, shownFraction = -1;
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live';
    const changingOut = root?.dataset.ignitionKind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase);
    const requested = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = changingOut ? priorMode : requested;
    priorMode = mode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweeping = finite(override?.speed) !== null && finite(override?.rpm) !== null;
    const max = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available && !ev ? finite(model.rpm) : null;
    if (sweeping) {
      lastSweep = { speed: speedFromFraction(override.speed), rpm: max === null ? null : clamp(override.rpm) * max };
    }
    let speed = sweeping ? lastSweep.speed : speedTarget;
    let rpm = sweeping ? lastSweep.rpm : rpmTarget;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    label('mode', mode === 'race' ? 'RACE' : 'FREE');
    label('tach', ev ? 'DRIVE INPUT' : sweeping && max === null ? 'DISPLAY SCAN' : 'ENGINE SPEED');
    label('tachUnit', ev ? '%' : sweeping && max === null ? '' : 'RPM');
    label('primary', mode === 'race' ? ev ? 'DRIVE POWER' : 'GEAR' : 'ROAD SPEED');
    label('primaryUnit', mode === 'race' ? ev ? 'kW' : 'SELECTED' : 'KM/H');
    label('secondary', mode === 'race' ? 'ROAD SPEED' : ev ? 'DRIVE POWER' : 'GEAR');
    label('secondaryUnit', mode === 'race' ? 'KM/H' : ev ? 'kW' : 'SELECTED');
    label('side', mode === 'race' ? ev ? 'TORQUE' : 'ENGINE OUTPUT' : ev ? 'BRAKE INPUT' : 'THROTTLE');
    label('sideUnit', mode === 'race' ? ev ? 'Nm' : 'kW' : '%');
    label('detail1', mode === 'race' ? 'CURRENT LAP' : ev ? 'TORQUE' : 'ENGINE OUTPUT');
    label('detail1Unit', mode === 'race' ? 'TIME' : ev ? 'Nm' : 'kW');
    label('detail2', mode === 'race' ? 'BEST LAP' : ev ? 'G / X AXIS' : 'BRAKE INPUT');
    label('detail2Unit', mode === 'race' ? 'TIME' : ev ? 'g' : '%');
    label('detail3', mode === 'race' || ev ? 'G / Y AXIS' : 'TORQUE');
    label('detail3Unit', mode === 'race' || ev ? 'g' : 'Nm');
    label('footer', mode === 'race' ? 'TRACK CONFIGURATION' : 'ROAD CONFIGURATION');
    write('status', available ? 'TELEMETRY LIVE' : 'NO SIGNAL');
    if (priorScale !== max || priorEv !== ev) {
      priorScale = max; priorEv = ev;
      const stops = [0, .43, .715, 1];
      scaleTexts.forEach((node, i) => { node.textContent = ev || max === null ? '' : String(Number((max * stops[i] / 1000).toFixed(3))); });
    }
    const fraction = ev ? sweeping ? clamp(override.rpm) : available && finite(model.throttlePercent) !== null ? clamp(model.throttlePercent / 100) : 0 : sweeping ? tachFraction(clamp(override.rpm), 1) : max === null ? 0 : tachFraction(rpm, max);
    if (Math.abs(fraction - shownFraction) > .002) {
      shownFraction = fraction;
      fill.style.strokeDasharray = `${(length * fraction).toFixed(2)} ${length.toFixed(2)}`;
    }
    write('rpm', ev ? sweeping ? whole(clamp(override.rpm) * 100) : available ? whole(model.throttlePercent) : '—' : sweeping || available ? whole(rpm) : '—');
    write('primary', mode === 'race' ? ev ? available ? whole(model.powerKw) : '—' : available ? String(model.gearLabel ?? '—') : '—' : sweeping || available ? whole(speed) : '—');
    write('secondary', mode === 'race' ? sweeping || available ? whole(speed) : '—' : ev ? available ? whole(model.powerKw) : '—' : available ? String(model.gearLabel ?? '—') : '—');
    write('side', available ? mode === 'race' ? whole(ev ? model.torque : model.powerKw) : whole(ev ? model.brakePercent : model.throttlePercent) : '—');
    const racing = mode === 'race' && Boolean(context.racing) && available;
    write('detail1', mode === 'race' ? racing ? lap(model.currentLap) : '—' : available ? whole(ev ? model.torque : model.powerKw) : '—');
    write('detail2', mode === 'race' ? racing ? lap(model.bestLap) : '—' : available ? ev ? decimal(model.gX) : whole(model.brakePercent) : '—');
    write('detail3', available ? mode === 'race' || ev ? decimal(model.gY) : whole(model.torque) : '—');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

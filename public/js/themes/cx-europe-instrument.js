// Embedded with toString(): every helper must remain inside this factory.
export function createCxEuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('CX instrument requires document and mount');
  const element = document.createElement('section');
  element.className = 'cx-instrument';
  element.dataset.themeInstrument = 'y1976_1985.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '1976–1985 European rotating-drum instrument');
  element.innerHTML = `<div class="cx-lunule">
    <div class="cx-crest"><span>LUNULE</span><i></i><b>CONTROLE DE ROUTE</b><i></i><span>1976—85</span></div>
    <div class="cx-warning-bank" aria-hidden="true"><span>◀</span><span>●</span><span>◉</span><strong>STOP</strong><span>◉</span><span>●</span><span>▶</span></div>
    <div class="cx-dashboard">
      <div class="cx-aux cx-aux-left"><small data-cx-label="left">RAPPORT</small><strong data-cx-value="left">—</strong><em data-cx-label="leftUnit">VITESSE</em><div class="cx-aux-rule"></div><span data-cx-value="leftFoot">—</span></div>
      <div class="cx-drum-housing cx-drum-speed"><div class="cx-drum-cap">VITESSE</div><div class="cx-drum-slot"><div class="cx-drum-track" data-cx-track="speed"></div><div class="cx-drum-lens"></div><div class="cx-drum-reading"><strong data-cx-value="speed">—</strong><small>km/h</small></div></div><div class="cx-drum-base">ROUTE</div></div>
      <div class="cx-drum-housing cx-drum-rpm"><div class="cx-drum-cap" data-cx-label="drum">TOURS MOTEUR</div><div class="cx-drum-slot"><div class="cx-drum-track" data-cx-track="rpm"></div><div class="cx-drum-lens"></div><div class="cx-drum-reading"><strong data-cx-value="rpm">—</strong><small data-cx-label="rpmUnit">tr/min</small></div></div><div class="cx-drum-base" data-cx-label="rpmBase">MOTEUR</div></div>
      <div class="cx-aux cx-aux-right"><small data-cx-label="right">TEMPS AU TOUR</small><strong data-cx-value="right">—</strong><em data-cx-label="rightUnit">COURSE</em><div class="cx-aux-rule"></div><span data-cx-value="rightFoot">—</span></div>
    </div>
    <div class="cx-bottom"><span>INSTRUMENTS  /  SERIE I</span><b data-cx-label="program">CONDUITE SPORT</b><span data-cx-value="status">NO SIGNAL</span></div>
  </div>`;
  const identity = document.createElement('div');
  identity.className = 'cx-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>CONDUITE</small><strong data-cx-mode="race">RACE</strong><strong data-cx-mode="freeRoam">FREE</strong><span>INSTRUMENTS EN SERVICE</span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-cx-value]')).map(node => [node.dataset.cxValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-cx-label]')).map(node => [node.dataset.cxLabel, node]));
  const tracks = Object.fromEntries(Array.from(element.querySelectorAll('[data-cx-track]')).map(node => [node.dataset.cxTrack, node]));
  for (const [key, max, step] of [['speed', 280, 20], ['rpm', 10000, 1000]]) {
    for (let value = 0; value <= max; value += step) {
      const mark = document.createElement('div');
      mark.className = 'cx-drum-mark';
      mark.innerHTML = `<i></i><span>${key === 'rpm' ? value / 1000 : value}</span><i></i>`;
      tracks[key].append(mark);
    }
  }
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const lap = value => finite(value) === null || value <= 0 ? '—' : Math.floor(value / 60) + ':' + (value % 60).toFixed(2).padStart(5, '0');
  // The shared animation sends the legacy speed-gauge fraction, whose stops
  // are nonlinear. Invert that scale so its return phase reaches real km/h.
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromFraction = fraction => {
    const index = clamp(fraction) * (speedStops.length - 1);
    const lower = Math.min(speedStops.length - 2, Math.floor(index));
    return speedStops[lower] + (speedStops[lower + 1] - speedStops[lower]) * (index - lower);
  };
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  const move = (key, fraction) => {
    // The center mark is aligned with the lens center; neither drum has a needle pivot.
    const steps = key === 'speed' ? 14 : 10;
    const offset = (1.42 + clamp(fraction) * steps * 2.84).toFixed(3);
    const transform = `translateY(-${offset}cqw)`;
    if (tracks[key].style.transform !== transform) tracks[key].style.transform = transform;
  };
  const rpmMarks = Array.from(tracks.rpm.querySelectorAll('span'));
  let lastMode = null, lastScale, sweepValues = null;
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live', kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? (lastMode || requestedMode) : requestedMode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweeping = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const rpmMax = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    if (lastScale !== rpmMax) {
      lastScale = rpmMax;
      // Each drum step and its printed thousand-RPM value share one axis.
      rpmMarks.forEach((node, index) => { node.textContent = rpmMax === null ? '—' : String(Number((index * rpmMax / 10000).toFixed(3))); });
    }
    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available && !ev ? finite(model.rpm) : null;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    lastMode = mode;
    label('program', mode === 'race' ? 'CONDUITE SPORT' : 'GRAND TOURISME');
    label('left', mode === 'race' ? (ev ? 'PUISSANCE' : 'RAPPORT') : 'PUISSANCE');
    label('leftUnit', mode === 'race' && !ev ? 'VITESSE' : 'kW');
    label('right', mode === 'race' ? 'TEMPS AU TOUR' : 'ACCÉLÉRATEUR');
    label('rightUnit', mode === 'race' ? 'COURSE' : '%');
    label('drum', ev ? 'PUISSANCE' : 'TOURS MOTEUR');
    label('rpmUnit', ev ? 'kW' : 'tr/min');
    label('rpmBase', ev ? 'E-DRIVE' : rpmMax === null ? sweeping ? 'DISPLAY SCAN' : 'RPM RANGE UNKNOWN' : 'MOTEUR · ×1000');
    if (sweeping) {
      sweepValues = { speed: speedFromFraction(override.speed), rpm: rpmMax === null ? null : clamp(override.rpm) * rpmMax };
    }
    let speed = sweeping ? sweepValues.speed : speedTarget;
    let rpm = sweeping ? sweepValues.rpm : rpmTarget;
    move('speed', speed === null ? 0 : speed / 280);
    move('rpm', ev ? 0 : sweeping ? clamp(override.rpm) : rpm === null || rpmMax === null ? 0 : rpm / rpmMax);
    write('speed', sweeping || available ? whole(speed) : '—');
    write('rpm', ev ? available ? whole(model.powerKw) : '—' : sweeping || available ? whole(rpm) : '—');
    write('left', mode === 'race' && !ev ? available ? String(model.gearLabel ?? '—') : '—' : available ? whole(model.powerKw) : '—');
    write('leftFoot', mode === 'race' ? available ? 'RAPPORT ' + String(model.gearLabel ?? '—') : '—' : available ? 'VITESSE ' + whole(speedTarget) : '—');
    write('right', mode === 'race' ? Boolean(context.racing) && available ? lap(model.currentLap) : '—' : available ? whole(model.throttlePercent) : '—');
    write('rightFoot', mode === 'race' ? Boolean(context.racing) && available ? 'MEILLEUR ' + lap(model.bestLap) : '—' : available ? (ev ? 'MOTEUR ÉLECTRIQUE' : 'MOTEUR EN SERVICE') : '—');
    write('status', available ? ev ? 'E-DRIVE' : 'MOTEUR ' + String(model.gearLabel ?? '—') : 'NO SIGNAL');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

// Embedded with toString(): keep all helpers inside this factory.
export function createDsEuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('DS instrument requires document and mount');
  const element = document.createElement('section');
  element.className = 'ds-instrument';
  element.dataset.themeInstrument = 'y1950_1959.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.setAttribute('aria-label', '1950s European panoramic instrument');
  element.innerHTML = `<div class="ds-dashboard"><div class="ds-top"><span>INSTRUMENTS DE BORD</span><i></i><span data-ds-label="program">SPORT</span></div>
    <div class="ds-window"><div class="ds-window-inner"><div class="ds-window-scale" data-ds-scale></div><div class="ds-speed-needle" data-ds-needle="speed"></div><div class="ds-speed-track"></div><div class="ds-speed-unit">km/h</div><div class="ds-speed-number"><strong data-ds-value="speed">—</strong><small>VITESSE</small></div></div></div>
    <div class="ds-lower"><div class="ds-lower-panel ds-left"><span data-ds-label="left">TOUR MOTEUR</span><strong data-ds-value="left">—</strong><small data-ds-label="leftUnit">tr/min</small></div>
      <div class="ds-center"><div class="ds-center-inner"><small data-ds-label="center">RAPPORT</small><strong data-ds-value="center">—</strong><span data-ds-value="status">—</span></div></div>
      <div class="ds-lower-panel ds-right"><span data-ds-label="right">TEMPS AU TOUR</span><strong data-ds-value="right">—</strong><small data-ds-label="rightUnit">COURSE</small></div></div>
    <div class="ds-footer"><span>GRAND TOURISME · 1955—59</span><span data-ds-value="footer">—</span></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'ds-mode-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>PROGRAMME DE CONDUITE</small><strong data-ds-mode="race">RACE</strong><strong data-ds-mode="freeRoam">FREE</strong><span>INSTRUMENTS PRÊTS</span>';
  mount.append(element, identity);
  const values = Object.fromEntries(Array.from(element.querySelectorAll('[data-ds-value]')).map(node => [node.dataset.dsValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-ds-label]')).map(node => [node.dataset.dsLabel, node]));
  const speedNeedle = element.querySelector('[data-ds-needle="speed"]');
  const scale = element.querySelector('[data-ds-scale]');
  for (let i = 0; i <= 14; i++) {
    const node = document.createElement('div');
    node.className = 'ds-scale-mark' + (i % 2 ? '' : ' ds-scale-major');
    node.style.left = (i / 14 * 100) + '%';
    node.innerHTML = i % 2 ? '<i></i>' : `<i></i><span>${i * 20}</span>`;
    scale.append(node);
  }
  const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const whole = n => finite(n) === null ? '—' : String(Math.round(n));
  const lap = n => finite(n) === null || n <= 0 ? '—' : Math.floor(n / 60) + ':' + (n % 60).toFixed(2).padStart(5, '0');
  const write = (key, value) => { if (values[key] && values[key].textContent !== value) values[key].textContent = value; };
  const label = (key, value) => { if (labels[key] && labels[key].textContent !== value) labels[key].textContent = value; };
  let lastMode = null, lastNeedle = '', wasSweep = false, sweepSpeed = null, handoff = null;
  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const phase = root?.dataset.ignitionPhase || 'live', kind = root?.dataset.ignitionKind || '';
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = kind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase) ? (lastMode || requestedMode) : requestedMode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || context.displayOverrideType || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    element.dataset.mode = mode; element.dataset.powertrain = ev ? 'ev' : 'combustion';
    lastMode = mode;
    label('program', mode === 'race' ? 'SPORT' : 'TOURISME');
    label('center', mode === 'race' ? (ev ? 'PUISSANCE' : 'RAPPORT') : 'VITESSE');
    label('left', mode === 'race' && !ev ? 'TOUR MOTEUR' : 'PUISSANCE');
    label('leftUnit', ev || mode === 'freeRoam' ? 'kW' : 'tr/min');
    label('right', mode === 'race' ? 'TEMPS AU TOUR' : 'ACCÉLÉRATEUR');
    label('rightUnit', mode === 'race' ? 'COURSE' : '%');
    const speedTarget = available ? finite(model.speedKmh) : null;
    if (sweep) { sweepSpeed = clamp(override.speed) * 280; wasSweep = true; handoff = null; }
    else if (wasSweep) { handoff = { at: Date.now(), speed: sweepSpeed }; wasSweep = false; }
    let speed = sweep ? sweepSpeed : speedTarget;
    if (!sweep && handoff) {
      const t = clamp((Date.now() - handoff.at) / 480), eased = 1 - (1 - t) ** 3;
      speed = handoff.speed + ((speedTarget ?? 0) - handoff.speed) * eased;
      if (t >= 1) handoff = null;
    }
    const fraction = sweep ? clamp(override.speed) : speed === null ? 0 : clamp(speed / 280);
    const nextNeedle = (8 + fraction * 84).toFixed(2) + '%';
    if (lastNeedle !== nextNeedle) { speedNeedle.style.left = nextNeedle; lastNeedle = nextNeedle; }
    write('speed', sweep || available ? whole(speed) : '—');
    write('center', mode === 'race' ? ev ? (available ? whole(model.powerKw) : '—') : available ? String(model.gearLabel ?? '—') : '—' : sweep || available ? whole(speed) : '—');
    write('left', mode === 'race' && !ev ? sweep ? finite(context.rpmGauge?.gaugeMax) > 0 ? whole(clamp(override.rpm) * context.rpmGauge.gaugeMax) : '—' : available ? whole(model.rpm) : '—' : available ? whole(model.powerKw) : '—');
    write('right', mode === 'race' ? Boolean(context.racing) && available ? lap(model.currentLap) : '—' : available && finite(model.throttlePercent) !== null ? whole(model.throttlePercent) : '—');
    write('status', available ? ev ? 'E-DRIVE' : String(model.gearLabel ?? '—') : 'NO SIGNAL');
    write('footer', mode === 'race' && Boolean(context.racing) && finite(model.rank) > 0 ? 'POSITION ' + whole(model.rank) : available ? 'VITESSE ' + whole(speed) : 'NO SIGNAL');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

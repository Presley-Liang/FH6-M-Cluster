// Serialized into the standalone dashboard with toString(); helpers stay local.
export function createBelairAmericaInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Bel Air instrument requires document and mount');
  const ns = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'belair-america-instrument';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '1950s American touring instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="ba-enamel">
      <div class="ba-grille ba-grille-left" aria-hidden="true"></div>
      <div class="ba-grille ba-grille-right" aria-hidden="true"></div>
      <div class="ba-plaque"><i></i><span>AMERICAN TOURING</span><i></i></div>
      <div class="ba-main-housing">
        <div class="ba-wing ba-wing-left"></div><div class="ba-wing ba-wing-right"></div>
        <div class="ba-speed-window">
          <div class="ba-glass"></div>
          <svg class="ba-speed-svg" viewBox="0 0 1000 560" role="img" aria-label="Speedometer">
            <path class="ba-speed-arc"></path><g class="ba-speed-ticks"></g>
            <path class="ba-speed-needle-shadow"></path><path class="ba-speed-needle"></path>
            <circle class="ba-speed-hub" cx="500" cy="472" r="21"></circle><circle class="ba-speed-pin" cx="500" cy="472" r="6"></circle>
          </svg>
          <span class="ba-speed-caption">SPEEDOMETER</span>
          <div class="ba-speed-readout"><strong data-ba-value="speed">—</strong><span>MPH</span></div>
          <span class="ba-speed-scale">160 MPH · TOURING SCALE</span>
        </div>
        <div class="ba-side ba-side-left"><span data-ba-label="left">ENGINE</span><strong data-ba-value="left">—</strong><small data-ba-label="leftUnit">r/min</small></div>
        <div class="ba-side ba-side-right"><span data-ba-label="right">FUEL</span><strong data-ba-value="right">—</strong><small data-ba-label="rightUnit">RAW</small></div>
      </div>
      <div class="ba-lower">
        <div class="ba-gear"><span data-ba-label="gear">GEAR</span><strong data-ba-value="gear">—</strong></div>
        <div class="ba-mode-data ba-race-data">
          <div><span>CURRENT LAP</span><strong data-ba-value="lap">—</strong></div>
          <div><span>BEST LAP</span><strong data-ba-value="best">—</strong></div>
          <div><span>POSITION</span><strong data-ba-value="rank">—</strong></div>
        </div>
        <div class="ba-mode-data ba-free-data">
          <div><span>POWER</span><strong data-ba-value="power">—</strong><small>kW</small></div>
          <div><span>THROTTLE</span><strong data-ba-value="throttle">—</strong><small>%</small></div>
        </div>
      </div>
      <div class="ba-footer"><span>1950—59 / AMERICA</span><span class="ba-signal"><i></i><b data-ba-label="signal">NO SIGNAL</b></span><span data-ba-label="mode">RACE PROGRAM</span></div>
    </div>
    <div class="ba-mode-identity" aria-hidden="true"><small>INSTRUMENT PROGRAM</small><strong data-ba-mode="race">RACE</strong><strong data-ba-mode="freeRoam">FREE</strong><span><i></i><i></i><i></i></span></div>`;
  mount.append(element);
  const refs = Object.fromEntries(Array.from(element.querySelectorAll('[data-ba-value]')).map(node => [node.dataset.baValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-ba-label]')).map(node => [node.dataset.baLabel, node]));
  const ticks = element.querySelector('.ba-speed-ticks');
  const arc = element.querySelector('.ba-speed-arc');
  const needle = element.querySelector('.ba-speed-needle');
  const shadow = element.querySelector('.ba-speed-needle-shadow');
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const point = (radius, degree) => {
    const rad = degree * Math.PI / 180;
    return [500 + Math.sin(rad) * radius, 472 - Math.cos(rad) * radius];
  };
  const line = (a, b) => 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'L' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
  arc.setAttribute('d', Array.from({ length: 65 }, (_, index) => {
    const p = point(389, -72 + index * 144 / 64);
    return (index ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
  }).join(''));
  for (let index = 0; index <= 40; index += 1) {
    const degree = -72 + index * 144 / 40;
    const major = index % 5 === 0;
    const mark = document.createElementNS(ns, 'path');
    mark.setAttribute('d', line(point(major ? 350 : 365, degree), point(389, degree)));
    mark.setAttribute('class', major ? 'ba-tick-major' : 'ba-tick-minor');
    ticks.append(mark);
    if (major) {
      const label = document.createElementNS(ns, 'text');
      const [x, y] = point(316, degree);
      label.setAttribute('x', x.toFixed(2)); label.setAttribute('y', y.toFixed(2));
      label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('class', 'ba-tick-number');
      label.textContent = String(index * 4);
      ticks.append(label);
    }
  }
  const placeNeedle = fraction => {
    const angle = -72 + clamp(fraction) * 144;
    const rad = angle * Math.PI / 180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const px = Math.cos(rad), py = Math.sin(rad);
    const tip = [500 + dx * 344, 472 + dy * 344];
    const back = [500 - dx * 29, 472 - dy * 29];
    const d = 'M' + tip[0].toFixed(2) + ' ' + tip[1].toFixed(2)
      + ' L' + (500 + px * 7).toFixed(2) + ' ' + (472 + py * 7).toFixed(2)
      + ' L' + back[0].toFixed(2) + ' ' + back[1].toFixed(2)
      + ' L' + (500 - px * 7).toFixed(2) + ' ' + (472 - py * 7).toFixed(2) + ' Z';
    needle.setAttribute('d', d);
    shadow.setAttribute('d', d);
  };
  const lap = seconds => finite(seconds) === null || seconds < 0 ? '—' : Math.floor(seconds / 60) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const write = (key, value) => { if (refs[key] && refs[key].textContent !== value) refs[key].textContent = value; };
  let lastMode = 'race';
  let lastFraction = -1;
  let sweepMph = 0, sweepRpm = null;

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== 'y1950_1959.america'));
    const phase = root?.dataset.ignitionPhase || 'live';
    const modeOut = root?.dataset.ignitionKind === 'mode' && ['off-needles', 'off-frames', 'off-center'].includes(phase);
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const mode = modeOut ? lastMode : requestedMode;
    lastMode = mode;
    const ev = ['ev', 'electric'].includes(String(context.powertrain || root?.dataset.powertrain || '').toLowerCase());
    const available = !Boolean(context.stale ?? model.stale);
    const override = context.displayOverride;
    const sweeping = finite(override?.speed) !== null && finite(override?.rpm) !== null;
    const speedKmh = available ? finite(model.speedKmh) : null;
    const speedMph = speedKmh === null ? null : speedKmh / 1.609344;
    const rpmScale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    if (sweeping) {
      sweepMph = clamp(override.speed) * 160;
      sweepRpm = rpmScale === null ? null : clamp(override.rpm) * rpmScale;
    }
    let shownMph = speedMph, shownRpm = available ? finite(model.rpm) : null;
    if (sweeping) { shownMph = sweepMph; shownRpm = sweepRpm; }
    const fraction = sweeping ? clamp(override.speed) : clamp((shownMph ?? 0) / 160);
    if (Math.abs(fraction - lastFraction) > .001) { placeNeedle(fraction); lastFraction = fraction; }
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.sweep = String(sweeping);
    labels.mode.textContent = mode === 'race' ? 'RACE PROGRAM' : 'TOURING PROGRAM';
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.left.textContent = ev ? 'POWER' : 'ENGINE';
    labels.leftUnit.textContent = ev ? 'kW' : 'r/min';
    labels.right.textContent = mode === 'race' ? 'THROTTLE' : ev ? 'OUTPUT' : 'FUEL';
    labels.rightUnit.textContent = mode === 'race' ? '%' : ev ? 'kW' : 'RAW';
    labels.gear.textContent = ev ? 'DRIVE' : 'GEAR';
    write('speed', sweeping || available ? whole(shownMph) : '—');
    write('left', ev ? available ? whole(model.powerKw) : '—'
      : sweeping || available ? whole(shownRpm) : '—');
    const fuel = finite(model.fuelRaw);
    write('right', mode === 'race' ? available ? whole(model.throttlePercent) : '—'
      : ev ? available ? whole(model.powerKw) : '—'
        : available && fuel !== null ? fuel.toFixed(3) : '—');
    write('gear', ev ? 'EV' : available ? String(model.gearLabel ?? '—') : '—');
    const racing = mode === 'race' && available && Boolean(context.racing);
    write('lap', racing ? lap(model.currentLap) : '—');
    write('best', racing ? lap(model.bestLap) : '—');
    write('rank', racing && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    write('power', available ? whole(model.powerKw) : '—');
    write('throttle', available ? whole(model.throttlePercent) : '—');
  }

  placeNeedle(0);
  return { element, update, destroy() { element.remove(); } };
}

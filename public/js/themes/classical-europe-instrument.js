// Serialized into the standalone dashboard through toString(). Keep all helpers local.
export function createClassicalEuropeInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Classical Europe instrument requires document and mount');

  const svgNS = 'http://www.w3.org/2000/svg';
  const element = document.createElement('section');
  element.className = 'classical-europe-instrument';
  element.dataset.themeInstrument = 'pre1949.europe';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', 'Pre-1949 European mechanical instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="ce-leather" aria-hidden="true"></div>
    <div class="ce-top-rail"><span>INSTRUMENTS DE BORD</span><i></i><span>EUROPA · PRE-1949</span></div>
    <div class="ce-dials">
      <div class="ce-gauge ce-speed-gauge">
        <div class="ce-bezel">
          <svg class="ce-dial" viewBox="0 0 600 600" role="img" aria-label="Speedometer">
            <circle class="ce-bezel-ring" cx="300" cy="300" r="289"/>
            <circle class="ce-dial-face" cx="300" cy="300" r="269"/>
            <circle class="ce-inner-trace" cx="300" cy="300" r="238"/>
            <g class="ce-speed-ticks"></g>
            <path class="ce-speed-needle-shadow"/>
            <path class="ce-speed-needle"/>
            <circle class="ce-needle-hub" cx="300" cy="300" r="16"/>
            <circle class="ce-needle-pin" cx="300" cy="300" r="5"/>
          </svg>
          <div class="ce-dial-title"><small>VITESSE</small><strong>SPEED</strong></div>
          <div class="ce-dial-value"><strong data-ce-value="speed">—</strong><span>km/h</span></div>
          <div class="ce-maker-mark">EUROPEAN · MECHANICAL</div>
        </div>
      </div>
      <div class="ce-gauge ce-drive-gauge">
        <div class="ce-bezel">
          <svg class="ce-dial" viewBox="0 0 600 600" role="img" aria-label="Engine revolutions">
            <circle class="ce-bezel-ring" cx="300" cy="300" r="289"/>
            <circle class="ce-dial-face" cx="300" cy="300" r="269"/>
            <circle class="ce-inner-trace" cx="300" cy="300" r="238"/>
            <g class="ce-drive-ticks"></g>
            <path class="ce-drive-needle-shadow"/>
            <path class="ce-drive-needle"/>
            <circle class="ce-needle-hub" cx="300" cy="300" r="16"/>
            <circle class="ce-needle-pin" cx="300" cy="300" r="5"/>
          </svg>
          <div class="ce-dial-title"><small data-ce-label="driveFrench">TOURS / MINUTE</small><strong data-ce-label="driveTitle">ENGINE</strong></div>
          <div class="ce-dial-value"><strong data-ce-value="drive">—</strong><span data-ce-label="driveUnit">r/min</span></div>
          <div class="ce-maker-mark" data-ce-label="driveMark">MOTEUR · PRECISION</div>
        </div>
      </div>
    </div>
    <div class="ce-bridge">
      <div class="ce-bridge-crown">✦</div>
      <span>TRANSMISSION</span>
      <strong data-ce-value="gear">—</strong>
      <i></i>
      <small data-ce-label="mode">COMPETITION</small>
    </div>
    <div class="ce-lower-rail">
      <div class="ce-race-data">
        <div class="ce-info"><span>TOUR ACTUEL</span><strong data-ce-value="lap">—</strong><small>CURRENT LAP</small></div>
        <div class="ce-info"><span>MEILLEUR TOUR</span><strong data-ce-value="best">—</strong><small>BEST LAP</small></div>
        <div class="ce-info"><span>POSITION</span><strong data-ce-value="rank">—</strong><small>RACE ORDER</small></div>
      </div>
      <div class="ce-free-data">
        <div class="ce-info"><span>PUISSANCE</span><strong data-ce-value="power">—</strong><small>POWER · kW</small></div>
        <div class="ce-info ce-fuel-info"><span>CARBURANT</span><strong data-ce-value="fuel">—</strong><small>FUEL RAW</small></div>
        <div class="ce-info"><span>ACCELERATEUR</span><strong data-ce-value="throttle">—</strong><small>THROTTLE · %</small></div>
      </div>
    </div>
    <div class="ce-status"><span><i class="ce-status-lamp"></i><b data-ce-label="signal">NO SIGNAL</b></span><span>MAISON D'INSTRUMENTS · 01</span></div>
    <div class="ce-mode-identity" aria-hidden="true"><small>DRIVING PROGRAMME</small><strong data-ce-mode="race">RACE</strong><strong data-ce-mode="freeRoam">FREE</strong><span>INSTRUMENTS READY</span></div>`;

  mount.append(element);
  const refs = Object.fromEntries(Array.from(element.querySelectorAll('[data-ce-value]')).map(node => [node.dataset.ceValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-ce-label]')).map(node => [node.dataset.ceLabel, node]));
  const speedNeedle = element.querySelector('.ce-speed-needle');
  const speedShadow = element.querySelector('.ce-speed-needle-shadow');
  const driveNeedle = element.querySelector('.ce-drive-needle');
  const driveShadow = element.querySelector('.ce-drive-needle-shadow');
  const speedTicks = element.querySelector('.ce-speed-ticks');
  const driveTicks = element.querySelector('.ce-drive-ticks');
  const driveNumbers = [];
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromLegacyFraction = fraction => {
    const position = clamp(fraction) * (speedStops.length - 1);
    const index = Math.min(speedStops.length - 2, Math.floor(position));
    return speedStops[index] + (speedStops[index + 1] - speedStops[index]) * (position - index);
  };
  const time = value => finite(value) === null || value < 0 ? '—' : String(Math.floor(value / 60)) + ':' + (value % 60).toFixed(3).padStart(6, '0');
  const point = (radius, degree) => {
    const radian = degree * Math.PI / 180;
    return [300 + Math.sin(radian) * radius, 300 - Math.cos(radian) * radius];
  };
  function addTick(group, degree, major, caption) {
    const [x1, y1] = point(major ? 208 : 220, degree);
    const [x2, y2] = point(240, degree);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    line.setAttribute('class', major ? 'ce-tick-major' : 'ce-tick-minor');
    group.append(line);
    if (!major) return null;
    const [x, y] = point(174, degree);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', x.toFixed(2));
    label.setAttribute('y', y.toFixed(2));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'ce-tick-number');
    label.textContent = caption;
    group.append(label);
    return label;
  }
  for (let index = 0; index <= 35; index += 1) {
    const degree = -120 + index * 240 / 35;
    const major = index % 5 === 0;
    addTick(speedTicks, degree, major, major ? String(speedStops[index / 5]) : '');
  }
  for (let index = 0; index <= 40; index += 1) {
    const degree = -120 + index * 6;
    const major = index % 5 === 0;
    const driveLabel = addTick(driveTicks, degree, major, '—');
    if (driveLabel) driveNumbers.push(driveLabel);
  }

  let lastScale;
  let lastMode;
  const write = (key, value) => {
    if (refs[key] && refs[key].textContent !== value) refs[key].textContent = value;
  };
  const needleAt = (needle, shadow, fraction) => {
    const angle = -120 + clamp(fraction) * 240;
    const radian = angle * Math.PI / 180;
    const alongX = Math.sin(radian), alongY = -Math.cos(radian);
    const acrossX = Math.cos(radian), acrossY = Math.sin(radian);
    const tipX = 300 + alongX * 221, tipY = 300 + alongY * 221;
    const baseX = 300 - alongX * 21, baseY = 300 - alongY * 21;
    const path = 'M' + tipX.toFixed(2) + ' ' + tipY.toFixed(2)
      + ' L' + (300 + acrossX * 4).toFixed(2) + ' ' + (300 + acrossY * 4).toFixed(2)
      + ' L' + baseX.toFixed(2) + ' ' + baseY.toFixed(2)
      + ' L' + (300 - acrossX * 4).toFixed(2) + ' ' + (300 - acrossY * 4).toFixed(2) + ' Z';
    needle.setAttribute('d', path);
    shadow.setAttribute('d', path);
  };

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    element.setAttribute('aria-hidden', String(root?.dataset.themeId !== 'pre1949.europe'));
    const stale = Boolean(context.stale ?? model.stale);
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const waitingForModeChange = root?.dataset.ignitionKind === 'mode'
      && ['off-needles', 'off-frames', 'off-center'].includes(root.dataset.ignitionPhase);
    const mode = waitingForModeChange ? (lastMode || element.dataset.mode) : requestedMode;
    const powertrain = String(context.powertrain || '').toLowerCase();
    const ev = powertrain === 'ev' || powertrain === 'electric';
    const override = context.displayOverride;
    const sweep = Boolean(override && finite(override.speed) !== null && finite(override.rpm) !== null);
    const scale = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax
      : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const available = !stale;
    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.sweep = String(sweep);
    if (lastMode !== mode) {
      lastMode = mode;
      labels.mode.textContent = mode === 'race' ? 'COMPETITION' : 'GRAND TOUR';
    }
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.driveFrench.textContent = ev ? 'PUISSANCE ELECTRIQUE' : 'TOURS / MINUTE';
    labels.driveTitle.textContent = ev ? 'POWER' : 'ENGINE';
    labels.driveUnit.textContent = ev ? 'kW' : 'r/min';
    labels.driveMark.textContent = ev ? 'PROPULSION · ELECTRIQUE' : 'MOTEUR · PRECISION';
    if (lastScale !== scale) {
      lastScale = scale;
      driveNumbers.forEach((node, index) => { node.textContent = scale === null ? '—' : String(Math.round(index * scale / 8000)); });
    }

    const speedTarget = available ? finite(model.speedKmh) : null;
    const driveTarget = available ? finite(ev ? model.powerKw : model.rpm) : null;
    const speedFraction = finite(context.speedFraction) ?? (sweep ? clamp(override.speed) : 0);
    const driveFraction = finite(context.gaugeFraction) ?? (sweep ? clamp(override.rpm) : 0);
    const speed = sweep ? speedFromLegacyFraction(speedFraction) : speedTarget;
    const drive = ev ? driveTarget : scale === null ? null : driveFraction * scale;
    needleAt(speedNeedle, speedShadow, speedFraction);
    needleAt(driveNeedle, driveShadow, driveFraction);
    write('speed', (sweep || available) && (sweep || speedTarget !== null) ? whole(speed) : '—');
    write('drive', ev ? (available ? whole(driveTarget) : '—')
      : (sweep || available) && (sweep || driveTarget !== null) && scale !== null ? whole(drive) : '—');
    write('gear', available ? String(model.gearLabel ?? '—') : '—');

    const race = mode === 'race' && Boolean(context.racing) && available;
    write('lap', race ? time(model.currentLap) : '—');
    write('best', race ? time(model.bestLap) : '—');
    write('rank', race && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    write('power', available ? whole(model.powerKw) : '—');
    const fuel = finite(model.fuelRaw);
    write('fuel', available && fuel !== null ? fuel.toFixed(3) : '—');
    write('throttle', available ? whole(model.throttlePercent) : '—');
  }

  return { element, update, destroy() { element.remove(); } };
}

// Serialized into the standalone dashboard with toString(): keep helpers in the factory.
export function createRetroDigitalAmericaInstrument({ document, mount }) {
  if (!document || !mount) throw new TypeError('Retro digital instrument requires document and mount');

  const element = document.createElement('section');
  element.className = 'retro-digital-america-instrument';
  element.dataset.themeInstrument = 'y1986_1994.america';
  element.dataset.mode = 'race';
  element.dataset.powertrain = 'combustion';
  element.dataset.signal = 'absent';
  element.setAttribute('aria-label', '1986–1994 American digital instrument');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="rda-cabinet">
      <div class="rda-bezel">
        <div class="rda-header"><span class="rda-system">ELECTRONIC INSTRUMENTATION</span><span class="rda-header-rule"></span><span class="rda-era">MODEL 86/94 • USA</span></div>
        <div class="rda-rpm-zone">
          <div class="rda-rpm-heading"><span data-rda-label="rpm">ENGINE RPM</span><strong data-rda-value="rpm">—</strong><small data-rda-label="rpm-unit">r/min</small></div>
          <div class="rda-segment-track" aria-hidden="true"></div>
          <div class="rda-rpm-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span><em data-rda-label="range">SHIFT RANGE</em></div>
        </div>
        <div class="rda-main-row">
          <div class="rda-gear-window"><span>TRANSMISSION</span><strong data-rda-value="gear">—</strong><small>GEAR SELECT</small></div>
          <div class="rda-speed-window"><div class="rda-speed-label">VELOCITY <i></i> DIGITAL READOUT</div><div class="rda-speed-number"><strong data-rda-value="speed">—</strong><span>km/h</span></div><div class="rda-speed-footer"><span>DISPLAY SYSTEM</span><span data-rda-label="signal">NO SIGNAL</span></div></div>
        </div>
        <div class="rda-lower-row">
          <div class="rda-mode-plate"><span data-rda-label="program">RACE PROGRAM</span><strong data-rda-label="mode">RACE</strong><i></i></div>
          <div class="rda-race-data"><div class="rda-lower-cell"><span>CURRENT LAP</span><strong data-rda-value="lap">—</strong></div><div class="rda-lower-cell"><span>POSITION</span><strong data-rda-value="rank">—</strong></div></div>
          <div class="rda-free-data"><div class="rda-lower-cell"><span>POWER OUTPUT</span><strong data-rda-value="power">—</strong><small>kW</small></div><div class="rda-lower-cell"><span>THROTTLE</span><strong data-rda-value="throttle">—</strong><small>%</small></div><div class="rda-lower-cell"><span>FUEL / RAW</span><strong data-rda-value="fuel">—</strong></div></div>
        </div>
        <div class="rda-bottom-legend"><span>VFD DIGITAL SYSTEM</span><span>1986 • 1994</span><span>UNIT 03</span></div>
      </div>
    </div>
    <div class="rda-mode-identity" aria-hidden="true"><span>DRIVE PROGRAM</span><strong data-rda-mode="race">RACE</strong><strong data-rda-mode="freeRoam">FREE</strong><small>DISPLAY RECONFIGURING</small><div class="rda-identity-progress"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;

  const refs = Object.fromEntries(Array.from(element.querySelectorAll('[data-rda-value]')).map(node => [node.dataset.rdaValue, node]));
  const labels = Object.fromEntries(Array.from(element.querySelectorAll('[data-rda-label]')).map(node => [node.dataset.rdaLabel, node]));
  const track = element.querySelector('.rda-segment-track');
  const segments = Array.from({ length: 32 }, (_, index) => {
    const segment = document.createElement('i');
    segment.style.setProperty('--rda-segment', String(index));
    track.append(segment);
    return segment;
  });
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamp = value => Math.min(1, Math.max(0, value));
  const whole = value => finite(value) === null ? '—' : String(Math.round(value));
  const decimal = (value, places) => finite(value) === null ? '—' : value.toFixed(places);
  const lapTime = seconds => finite(seconds) === null || seconds < 0 ? '—' : String(Math.floor(seconds / 60)) + ':' + (seconds % 60).toFixed(3).padStart(6, '0');
  const write = (name, value) => { if (refs[name] && refs[name].textContent !== value) refs[name].textContent = value; };
  const speedStops = [0, 20, 40, 60, 100, 140, 200, 260];
  const speedFromFraction = fraction => {
    const position = clamp(fraction) * (speedStops.length - 1);
    const index = Math.min(speedStops.length - 2, Math.floor(position));
    return speedStops[index] + (speedStops[index + 1] - speedStops[index]) * (position - index);
  };

  let lastSweepSpeed = 0;
  let lastSweepRpm = 0;
  let shownMode = 'race';

  function update(model = {}, context = {}) {
    const root = mount.closest?.('#cluster');
    const active = root?.dataset.themeId === 'y1986_1994.america';
    element.setAttribute('aria-hidden', String(!active));
    const requestedMode = context.mode === 'freeRoam' || context.mode === 'free' ? 'freeRoam' : 'race';
    const stale = Boolean(context.stale ?? model.stale);
    const available = !stale;
    const powertrain = String(context.powertrain || root?.dataset.powertrain || '').toLowerCase();
    const ev = powertrain === 'ev' || powertrain === 'electric';
    const phase = root?.dataset.ignitionPhase || 'live';
    // The coordinator changes the requested mode before power down. Keep the
    // outgoing palette and fields until the dark center phase reconfigures them.
    if (root?.dataset.ignitionKind !== 'mode' || !['off-needles', 'off-frames', 'off-center'].includes(phase)) {
      shownMode = requestedMode;
    }
    const mode = shownMode;
    const scan = active && phase === 'scan';
    const override = context.displayOverride || null;
    const gaugeMax = finite(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const rpmFraction = finite(context.gaugeFraction) ?? finite(model.rpmRatio);

    element.dataset.mode = mode;
    element.dataset.powertrain = ev ? 'ev' : 'combustion';
    element.dataset.signal = available ? 'live' : 'absent';
    element.dataset.scan = scan ? 'true' : 'false';
    labels.mode.textContent = mode === 'race' ? 'RACE' : 'FREE';
    labels.program.textContent = mode === 'race' ? 'RACE PROGRAM' : 'FREE DRIVE';
    labels.range.textContent = ev ? 'POWER TRACE' : override && gaugeMax === null ? 'DISPLAY SCAN' : mode === 'race' ? 'SHIFT RANGE' : 'ENGINE RANGE';
    labels.signal.textContent = available ? 'TELEMETRY LIVE' : 'NO SIGNAL';
    labels.rpm.textContent = ev ? 'POWER OUTPUT' : 'ENGINE RPM';
    labels['rpm-unit'].textContent = ev ? 'kW' : 'r/min';

    const overrideFraction = finite(override?.rpm);
    const segmentFraction = ev ? null : overrideFraction !== null ? clamp(overrideFraction) : available ? rpmFraction : null;
    const litCount = segmentFraction === null ? 0 : Math.max(0, Math.min(segments.length, Math.round(clamp(segmentFraction) * segments.length)));
    segments.forEach((segment, index) => {
      segment.dataset.lit = String(index < litCount);
      segment.dataset.scanHead = String(scan && litCount > 0 && index === litCount - 1);
    });

    const speedTarget = available ? finite(model.speedKmh) : null;
    const rpmTarget = available ? finite(model.rpm) : null;
    const hasOverride = override && finite(override.speed) !== null;
    if (hasOverride) {
      lastSweepSpeed = Math.round(speedFromFraction(override.speed));
      lastSweepRpm = gaugeMax === null ? null : Math.round(clamp(overrideFraction ?? 0) * gaugeMax);
    }

    let speed = speedTarget;
    let rpm = rpmTarget;
    if (hasOverride) {
      speed = lastSweepSpeed;
      rpm = lastSweepRpm;
    }

    write('speed', available || override ? whole(speed) : '—');
    write('rpm', ev ? available ? decimal(model.powerKw, 0) : '—' : available || override ? whole(rpm) : '—');
    write('gear', available ? String(model.gearLabel ?? '—') : '—');
    const racing = available && mode === 'race' && Boolean(context.racing);
    write('lap', racing ? lapTime(model.currentLap) : '—');
    write('rank', racing && finite(model.rank) > 0 ? 'P' + whole(model.rank) : '—');
    write('power', available ? decimal(model.powerKw, 0) : '—');
    write('throttle', available ? whole(model.throttlePercent) : '—');
    write('fuel', available ? decimal(model.fuelRaw, 2) : '—');
  }

  mount.append(element);
  return { element, update, destroy() { element.remove(); } };
}

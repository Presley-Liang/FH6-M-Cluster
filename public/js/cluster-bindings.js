export function createClusterBindings(doc, selectTelemetry, options = {}) {
  const lookupVehicleModel = options.vehicleModelLookup || (() => null);
  let raw = {}, received = 0, frame = 0, previous = 0, lastDetails = 0, displayedSpeed = 0, displayedRpm = 0, speedVelocity = 0, rpmVelocity = 0, maximum = null, topSpeed = 0, car = null;
  let previousGearLabel = null, gearAnimationTimer = null, pendingNeutralSince = null;
  let displayedGearLabel = null, gearVehicle = null, lastGearSampleAt = 0;
  let raceSecondary = null;
  let displayOverride = null;
  let boostPresentationKey = null;
  const vehicleController = options.vehicleStateController;
  const rpmController = options.rpmGaugeController;
  const shiftController = options.shiftLightController;
  const raceFeedbackController = options.raceFeedbackController;
  const slipHighThreshold = Number.isFinite(options.slipHighThreshold) ? Math.abs(options.slipHighThreshold) : Infinity;
  let vehicleState = vehicleController?.state?.() ?? null;
  let rpmGauge = null;
  const root = doc.getElementById('cluster');
  const text = (id, value) => { const el = doc.getElementById(id); if (el && el.textContent !== String(value)) el.textContent = value; };
  function gearValue(label) {
    if (label === 'R') return -1;
    if (label === 'N') return 0;
    const value = Number(label);
    return Number.isFinite(value) ? value : null;
  }
  function resetGearDisplay() {
    displayedGearLabel = null; pendingNeutralSince = null; gearVehicle = null; lastGearSampleAt = 0;
    previousGearLabel = null;
    clearTimeout(gearAnimationTimer);
    doc.getElementById('gear')?.classList.remove('gear-shift-up','gear-shift-down');
  }
  function updateGearDisplay(model, now) {
    const label = model.gearLabel;
    if (gearVehicle !== model.carId || (lastGearSampleAt && now - lastGearSampleAt > 2000)) resetGearDisplay();
    if (gearValue(label) === null) {
      resetGearDisplay();
      return;
    }
    gearVehicle = model.carId; lastGearSampleAt = now;
    // Process every received packet, including gears between browser frames.
    // A lone neutral packet cannot mature just because the RAF clock advances.
    if (label === 'N' && displayedGearLabel !== null && displayedGearLabel !== 'N') {
      if (pendingNeutralSince === null) pendingNeutralSince = now;
      if (now - pendingNeutralSince >= (options.neutralHoldMs ?? 180)) displayedGearLabel = label;
    } else {
      pendingNeutralSince = null;
      displayedGearLabel = label;
    }
  }
  function renderGear(label, stale) {
    const el = doc.getElementById('gear');
    if (!el || el.textContent === String(label)) return;
    const prior = previousGearLabel;
    el.textContent = label;
    if (!stale && prior !== null && gearValue(prior) !== null && gearValue(label) !== null) {
      el.classList.remove('gear-shift-up','gear-shift-down');
      void el.getBoundingClientRect();
      el.classList.add(gearValue(label) > gearValue(prior) ? 'gear-shift-up' : 'gear-shift-down');
      clearTimeout(gearAnimationTimer);
      gearAnimationTimer = setTimeout(() => el.classList.remove('gear-shift-up','gear-shift-down'), 380);
    }
    if (!stale && gearValue(label) !== null) previousGearLabel = label;
  }
  const number = (value, decimals = 0) => value == null ? '—' : value.toFixed(decimals);
  const time = value => value == null || value < 0 ? '—' : Math.floor(value / 60) + ':' + (value % 60).toFixed(3).padStart(6, '0');
  const bound = value => Math.max(0, Math.min(1, value));
  const namespace = 'http://www.w3.org/2000/svg';
  const rails = ['speed','rpm'].map(name => {
    const path = doc.getElementById(name + '-track');
    return { name, path, length: path.getTotalLength(), needle: doc.getElementById(name + '-needle'), fill: doc.getElementById(name === 'speed' ? 'speed-arc' : 'rpm-bar'), bed: doc.querySelector('.' + name + '-progress-bed') };
  });
  const fuelPath = doc.getElementById('fuel-aux-track');
  const fuelFill = doc.getElementById('fuel-aux-fill');
  const fuelNeedle = doc.getElementById('fuel-needle');
  const fuelLength = fuelPath?.getTotalLength?.() || 0;
  const tyrePath = doc.getElementById('tyre-aux-track');
  const tyreFill = doc.getElementById('tyre-aux-fill');
  const tyreNeedle = doc.getElementById('tyre-needle');
  const tyreGauge = doc.querySelector('.tyre-gauge');
  const tyreLength = tyrePath?.getTotalLength?.() || 0;
  const speedStops = [0,20,40,60,100,140,200,260];
  rails.forEach(rail => {
    rail.path.style.setProperty('--frame-length', String(rail.length));
    doc.querySelectorAll('use[href="#'+rail.name+'-track"]:not(.rpm-redline)').forEach(edge => edge.style.setProperty('--frame-length', String(rail.length)));
  });
  function speedRatio(speed) {
    for (let i = 1; i < speedStops.length; i++) if (speed <= speedStops[i]) return (i - 1 + (speed - speedStops[i-1]) / (speedStops[i]-speedStops[i-1])) / (speedStops.length-1);
    return 1;
  }
  function position(rail, fraction) {
    const length = rail.length * bound(fraction);
    const point = rail.path.getPointAtLength(length);
    const a = rail.path.getPointAtLength(Math.max(0, length - 1));
    const b = rail.path.getPointAtLength(Math.min(rail.length, length + 1));
    let nx = -(b.y-a.y), ny = b.x-a.x;
    const norm = Math.hypot(nx,ny) || 1; nx /= norm; ny /= norm;
    const cx = rail.name === 'speed' ? 400 : 1200;
    if (nx * (cx-point.x) + ny * (360-point.y) < 0) { nx = -nx; ny = -ny; }
    return { x:point.x, y:point.y, nx, ny };
  }
  function ticks(rail, values) {
    const container = doc.getElementById(rail.name + '-ticks');
    container.replaceChildren();
    values.forEach((value,i) => {
      const fraction = rail.name === 'rpm' && Number.isFinite(value) && Number.isFinite(values.at(-1)) && values.at(-1) > 0
        ? value / values.at(-1) : i / (values.length - 1);
      const p = position(rail, fraction);
      const mark = doc.createElementNS(namespace,'line');
      mark.style.setProperty('--tick-delay', (i/(values.length-1)*650)+'ms');
      mark.setAttribute('x1',p.x); mark.setAttribute('y1',p.y);
      mark.setAttribute('x2',p.x+p.nx*12); mark.setAttribute('y2',p.y+p.ny*12); container.append(mark);
      const label = doc.createElementNS(namespace,'text');
      label.style.setProperty('--tick-delay', (80+i/(values.length-1)*650)+'ms');
      label.setAttribute('x',p.x+p.nx*39); label.setAttribute('y',p.y+p.ny*39+7); label.setAttribute('text-anchor','middle');
      label.textContent = value; container.append(label);
    });
    for (let i=0;i<(values.length-1)*5;i++) {
      if(i%5===0)continue;
      const interval = Math.floor(i / 5), step = i % 5;
      const tickValue = Number(values[interval]) + (Number(values[interval+1])-Number(values[interval])) * step / 5;
      const fraction = rail.name === 'rpm' && Number.isFinite(tickValue) && values.at(-1) > 0
        ? tickValue / values.at(-1) : i / ((values.length - 1) * 5);
      const p=position(rail,fraction);
      const mark=doc.createElementNS(namespace,'line');
      mark.style.setProperty('--tick-delay', (i/((values.length-1)*5)*650)+'ms');
      mark.setAttribute('x1',p.x);mark.setAttribute('y1',p.y);mark.setAttribute('x2',p.x+p.nx*5);mark.setAttribute('y2',p.y+p.ny*5);container.append(mark);
    }
  }
  ticks(rails[0], speedStops);
  ticks(rails[1], [0,1,2,3,4,5,6,7,8]);
  function gauge(rail, fraction) {
    fraction = bound(fraction);
    const p = position(rail, fraction);
    const length = 54 - fraction*30;
    rail.needle.setAttribute('d', `M${p.x-p.nx*14-p.ny*2.3} ${p.y-p.ny*14+p.nx*2.3} L${p.x+p.nx*length} ${p.y+p.ny*length} L${p.x-p.nx*14+p.ny*2.3} ${p.y-p.ny*14-p.nx*2.3} Z`);
    rail.fill.style.strokeDasharray = `${rail.length*fraction} ${rail.length}`;
    if (rail.bed) rail.bed.style.strokeDasharray = `${rail.length*fraction} ${rail.length}`;
  }
  function spring(value, velocity, target, dt, stiffness, damping) {
    const seconds = Math.min(0.05, Math.max(0.001, dt / 1000));
    velocity += ((target - value) * stiffness - velocity * damping) * seconds;
    value += velocity * seconds;
    if (value < 0) { value = 0; velocity = 0; }
    if (value > 1) { value = 1; velocity *= -0.16; }
    return [value, velocity];
  }
  function render(now) {
    const stale = !received || Date.now()-received>2000;
    const model = selectTelemetry(raw, stale);
    const stableVehicle = vehicleState?.status === 'locked' ? vehicleState.vehicle : null;
    const identityModel = stableVehicle ? selectTelemetry({ ...raw, ...stableVehicle }, stale) : model;
    const dt = previous ? Math.min(100,now-previous) : 16; previous=now;
    const confirmedCar = stableVehicle?.carOrdinal ?? model.carId;
    if (car !== confirmedCar) { car=confirmedCar; topSpeed=0; displayedRpm=0; speedVelocity=0; rpmVelocity=0; }
    if (stale && lastGearSampleAt) resetGearDisplay();
    model.gearLabel = stale ? '—' : displayedGearLabel ?? model.gearLabel;
    if (!stale) topSpeed=Math.max(topSpeed,model.speedKmh || 0);
    const max = rpmGauge?.available ? [rpmGauge.scaleVersion, rpmGauge.gaugeMax, rpmGauge.redlineStartFraction, rpmGauge.redlineEndFraction].join(':') : null;
    if (max !== maximum) {
      maximum=max;
      ticks(rails[1], rpmGauge?.available ? rpmGauge.majorTicks : Array(9).fill('—'));
      const redline = doc.getElementById('rpm-redline');
      if (redline) {
        const start = rpmGauge?.available ? rails[1].length * rpmGauge.redlineStartFraction : rails[1].length;
        const width = rpmGauge?.available ? rails[1].length * (rpmGauge.redlineEndFraction - rpmGauge.redlineStartFraction) : 0;
        redline.style.strokeDasharray = `0 ${start} ${width} ${rails[1].length}`;
      }
    }
    const speedTarget = displayOverride ? displayOverride.speed : (stale ? (received ? displayedSpeed : 0) : speedRatio(model.speedKmh || 0));
    const rpmTarget = displayOverride ? displayOverride.rpm : (stale || rpmGauge?.gaugeFraction == null ? 0 : bound(rpmGauge.gaugeFraction));
    [displayedSpeed,speedVelocity]=spring(displayedSpeed,speedVelocity,bound(speedTarget),dt,76,15.5);
    [displayedRpm,rpmVelocity]=spring(displayedRpm,rpmVelocity,bound(rpmTarget),dt,112,17.5);
    // Custom instruments own their needles; the legacy SVG rails are hidden.
    // Keep the spring state live so switching back redraws at the current value.
    if (root.dataset.instrumentVariant !== 'custom') {
      gauge(rails[0],displayedSpeed); gauge(rails[1],displayedRpm);
    }
    frame=requestAnimationFrame(render);
    const race = doc.body.dataset.driveMode !== 'freeRoam';
    const racing = race && raw.isRaceOn && (raw.racePosition > 0 || raw.currentLap > 0);
    const renderInstrument = () => options.onRender?.(model, {
      stale, mode: race ? 'race' : 'freeRoam', racing, topSpeed,
      displayOverride, gaugeFraction: displayedRpm, speedFraction: displayedSpeed, rpmGauge,
    });
    // The animation display must follow browser frames. Slow telemetry/details
    // keep their own 50ms cadence and never throttle a sweep or mode relight.
    if (root.dataset.instrumentVariant === 'custom') renderInstrument();
    if (now-lastDetails<50) return;
    lastDetails=now;
    root.dataset.stale=String(stale);
    text('data-freshness', stale ? (received ? 'STALE · LAST VALUES' : 'NO SIGNAL') : 'CONNECTED');
    text('speed',number(model.speedKmh)); text('rpm',number(model.rpm)); renderGear(model.gearLabel,stale);
    // The packet's fuel unit is unverified; keep the E/F needle parked and
    // show the raw value without assigning percentage or warning thresholds.
    const fuelFraction = null;
    text('fuel',Number.isFinite(model.fuelRaw) ? model.fuelRaw.toFixed(3)+' raw' : '—');
    const fuelGauge = doc.querySelector('.fuel-gauge');
    if (fuelGauge) fuelGauge.dataset.level = 'unknown';
    if (fuelFill && fuelLength) fuelFill.style.strokeDasharray = `${fuelLength*(fuelFraction ?? 0)} ${fuelLength}`;
    if (fuelNeedle) {
      fuelNeedle.classList.toggle('parked',fuelFraction == null);
      const fuelAngle = fuelFraction == null ? -102.69 : fuelFraction <= .5 ? -102.69+(fuelFraction/.5)*90.34 : -12.35+((fuelFraction-.5)/.5)*56.22;
      fuelNeedle.style.setProperty('--fuel-angle',`${fuelAngle}deg`);
    }
    const tyreTemperatures = model.wheels.map(w=>w.tempC).filter(Number.isFinite);
    const tyreMax = tyreTemperatures.length ? Math.max(...tyreTemperatures) : null;
    const tyreFraction = tyreMax == null ? null : bound((tyreMax-20)/120);
    text('tyre-max',tyreMax == null ? '—' : Math.round(tyreMax)+'°');
    if (tyreFill && tyreLength) tyreFill.style.strokeDasharray = `${tyreLength*(tyreFraction ?? 0)} ${tyreLength}`;
    if (tyreNeedle) {
      tyreNeedle.classList.toggle('parked',tyreFraction == null);
      tyreNeedle.style.setProperty('--tyre-angle',`${tyreFraction == null ? 0 : tyreFraction*-135}deg`);
    }
    if (tyreGauge) tyreGauge.dataset.heat = tyreMax == null ? 'unknown' : tyreMax >= 120 ? 'hot' : tyreMax >= 95 ? 'warm' : 'normal';
    const boostState = raw.boostState?.state || 'UNKNOWN';
    text('boost-status', boostState === 'UNKNOWN' ? '—' : boostState);
    const boostStatus = doc.getElementById('boost-status');
    const boostKey=[raw.boostState?.carOrdinal,raw.boostState?.version,boostState].join(':');
    if (boostStatus && boostKey!==boostPresentationKey) {boostPresentationKey=boostKey;boostStatus.setAttribute('class', 'boost-status boost-' + boostState.toLowerCase());}
    text('power',number(model.powerKw,1));text('power-ev-value',number(model.powerKw,1));text('boost',number(model.boostRaw,3));
    const shift=shiftController?.update?.(rpmGauge?.rpmRatio, !stale && race && rpmGauge?.available) ?? {level:'off',segments:0,ratio:null};
    root.dataset.shiftLevel=shift.level;root.style.setProperty('--shift-segments',String(shift.segments));
    doc.querySelectorAll('.shift-light i').forEach((lamp,index)=>{lamp.dataset.lit=String(index<shift.segments);});
    text('dial-mode-label',race?'RACE':'FREE ROAM');
    root.dataset.raceTiming = racing ? 'live' : 'idle';
    text('lap-time',racing?time(model.currentLap):'—');text('lap-best',racing?time(model.bestLap):'—');text('position',racing?number(model.rank):'—');text('lap-num',racing?number(model.lapNumber):'—');text('footer-lap-number',racing?number(model.lapNumber):'—');text('footer-top-speed',stale?'—':number(topSpeed));
    text('drive-label',race?'CURRENT LAP':'POWER / kW');text('drive-primary',race?(racing?time(model.currentLap):'—'):number(model.powerKw,1));
    text('drive-secondary',stale?'TELEMETRY UNAVAILABLE':race?(raceSecondary || 'LIVE TIMING · ROUTE UNCONFIRMED'):'TOP SPEED  '+number(topSpeed)+' km/h');
    const values = {positionX:number(model.positionX,1),positionY:number(model.positionY,1),positionZ:number(model.positionZ,1),yaw:number(model.yawDegrees,1),pitch:number(model.pitchDegrees,1),roll:number(model.rollDegrees,1),gX:number(model.gX,2),gY:number(model.gY,2),gZ:number(model.gZ,2),torque:number(model.torque,1),carPi:identityModel.classLabel+' '+number(identityModel.pi),carName:lookupVehicleModel(identityModel.carId) || 'MODEL UNKNOWN',drivetrain:identityModel.drivetrainLabel,lastLap:time(model.lastLap),raceTime:time(model.raceTime)};
    doc.querySelectorAll('[data-value]').forEach(el=>{const value=values[el.dataset.value]; if(value!=null && el.textContent!==String(value))el.textContent=value;});
    model.wheels.forEach(w=>{
      const id=w.id.toLowerCase(); text('temp-'+id,number(w.tempC));
      const dot=doc.getElementById('temp-'+id+'-bar');dot.style.background=w.tempC==null?'#59788e':w.tempC>110?'#ff4058':w.tempC>80?'#efba62':'#67ddff';
      const data={ratio:number(w.slipRatio,2),angle:number(w.slipAngle,2),combined:number(w.combinedSlip,2),travel:number(w.travelNormalized==null?null:w.travelNormalized*100,1),meters:number(w.travelMeters,3)};
      for(const key of Object.keys(data)){const el=doc.querySelector('[data-wheel="'+id+'-'+key+'"]');if(el)el.textContent=data[key];}
      const wheelNode=doc.querySelector('.wheel-'+id);if(wheelNode)wheelNode.dataset.slip=Math.abs(w.combinedSlip || 0)>slipHighThreshold?'high':'normal';
      const travelBar=doc.querySelector('[data-wheel="'+id+'-travel-bar"]');if(travelBar)travelBar.style.transform='scaleX('+bound(w.travelNormalized || 0)+')';
    });
    for(const input of ['throttle','brake','clutch','handbrake']){
      const value=model[input+'Percent'];text(input,number(value)+(value==null?'':'%'));
      doc.getElementById(input+'-bar').style.transform='scaleY('+bound((value || 0)/100)+')';
      const drive=doc.getElementById('drive-'+input);if(drive)drive.style.width=(value || 0)+'%';
    }
    text('steer',model.steerNormalized==null?'—':number(model.steerNormalized*100)+'%');
    doc.getElementById('steer-pip').style.left=(50+(model.steerNormalized || 0)*50)+'%';
    const steerFill=doc.getElementById('steer-fill');if(steerFill){const steer=model.steerNormalized || 0;steerFill.style.transformOrigin=steer<0?'right':'left';steerFill.style.transform='scaleX('+Math.abs(steer)+')';steerFill.style.left=steer<0?'0':'50%';}
    const gAvailable = !stale && Number.isFinite(model.gX) && Number.isFinite(model.gZ);
    const gTarget = doc.querySelector('.g-target');
    if (gTarget) gTarget.dataset.available = String(gAvailable);
    const gTravel = value => Math.max(-19, Math.min(19, value * 11));
    doc.getElementById('g-dot').style.transform = gAvailable ? `translate(${gTravel(model.gX)}px,${gTravel(-model.gZ)}px)` : 'translate(0px,0px)';
    text('g-magnitude', gAvailable ? Math.hypot(model.gX, model.gZ).toFixed(2) + ' G' : '—');
    if (root.dataset.instrumentVariant !== 'custom') renderInstrument();
  }
  frame=requestAnimationFrame(render);
  return {update(packet){raw=packet;received=Date.now();updateGearDisplay(selectTelemetry(packet,false),received);vehicleState=vehicleController?.update?.(packet,received) ?? null;options.onVehicleState?.(vehicleState);if(vehicleState?.changed)options.onVehicleChange?.(vehicleState);rpmGauge=rpmController?.update?.(packet,vehicleState,false) ?? {available:true,gaugeFraction:selectTelemetry(packet,false).rpmRatio,rpmRatio:selectTelemetry(packet,false).rpmRatio,majorTicks:Array.from({length:9},(_,i)=>i),gaugeMax:8000,scaleVersion:0,redlineStartFraction:.9,redlineEndFraction:1};const events=raceFeedbackController?.update?.(packet,{active:doc.body.dataset.driveMode!=='freeRoam'&&vehicleState?.status!=='changing',stale:false})??[];if(events[0])options.onRaceFeedback?.(events[0]);},setRaceSecondary(value){raceSecondary=value || null;},setDisplayOverride(value){displayOverride=value&&Number.isFinite(value.speed)&&Number.isFinite(value.rpm)?{speed:bound(value.speed),rpm:bound(value.rpm)}:null;},getLiveFractions(){const model=selectTelemetry(raw,false);const ev=root.dataset.instrumentVariant==='custom'&&['ev','electric'].includes(String(root.dataset.powertrain||'').toLowerCase());return {speed:Number.isFinite(model.speedKmh)?speedRatio(model.speedKmh):0,speedKmh:model.speedKmh,rpm:ev?(Number.isFinite(model.throttlePercent)?bound(model.throttlePercent/100):0):(Number.isFinite(rpmGauge?.gaugeFraction)?bound(rpmGauge.gaugeFraction):0)};},destroy(){cancelAnimationFrame(frame);clearTimeout(gearAnimationTimer);}};
}

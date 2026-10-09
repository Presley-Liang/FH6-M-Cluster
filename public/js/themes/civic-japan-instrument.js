import { createModernInstrumentBinding } from './modern-instrument-binding.js';
export function createCivicJapanInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument ctr-instrument';
  element.setAttribute('aria-label', '2020–2024 Japanese horizontal performance instrument');
  element.innerHTML = `<div class="ctr-hood"><div class="ctr-rim"><div class="ctr-lcd next-body">
    <header class="ctr-heading"><span data-next-label="mode">RACE</span><div class="ctr-shift-lights">${'<i></i>'.repeat(8)}</div><div class="ctr-speed"><b data-next-value="secondary">—</b><small data-next-label="secondaryUnit">km/h</small></div></header>
    <div class="ctr-tach"><svg class="ctr-tach-track" viewBox="0 0 1000 106" preserveAspectRatio="none" aria-label="Engine speed ribbon"><path class="ctr-tach-base" d="M5 82L138 20H995"/><path class="ctr-tach-fill" pathLength="100" data-next-fill="arc" d="M5 82L138 20H995"/><g class="ctr-tach-ticks">${Array.from({length:9},()=>'<text data-next-tick></text>').join('')}</g></svg><div class="ctr-tach-caption"><span data-next-label="scale">×1000 r/min</span><b data-next-value="drive">—</b><small data-next-label="driveUnit">RPM</small></div></div>
    <div class="ctr-main"><div class="ctr-left next-detail"><span data-next-label="a">CURRENT LAP</span><strong data-next-value="a">—</strong><small data-next-label="aUnit">TIME</small><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div>
      <div class="ctr-primary next-readout"><div class="ctr-gear-notch"><span data-next-label="primary">GEAR</span><strong data-next-value="primary">—</strong><small data-next-label="primaryUnit"></small></div><div class="ctr-driver-data next-detail"><span data-next-label="d">TYRE MAX</span><b data-next-value="d">—</b><small data-next-label="dUnit">°C</small></div></div>
      <div class="ctr-right next-detail"><span data-next-label="c">LATERAL G</span><strong data-next-value="c">—</strong><small data-next-label="cUnit">g</small><div class="ctr-g-field" aria-label="Lateral and longitudinal acceleration"><i></i></div><small>LATERAL / LONGITUDINAL</small></div></div>
    <footer class="ctr-footer"><span>PERFORMANCE DATA</span><small data-next-value="status">NO SIGNAL</small><span>20—24 / JP</span></footer>
  </div></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity ctr-identity';
  identity.setAttribute('aria-hidden','true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const scalePath = element.querySelector('.ctr-tach-base');
  const scaleTicks = Array.from(element.querySelectorAll('[data-next-tick]'));
  if (scalePath?.getTotalLength && scalePath.getPointAtLength) {
    const length = scalePath.getTotalLength();
    scaleTicks.forEach((tick, index) => {
      // The printed value and fill front use the same path-length fraction.
      const point = scalePath.getPointAtLength(length * index / (scaleTicks.length - 1));
      tick.setAttribute('x', point.x.toFixed(3)); tick.setAttribute('y', (point.y + 16).toFixed(3));
      tick.setAttribute('text-anchor', index === 0 ? 'start' : index === scaleTicks.length - 1 ? 'end' : 'middle');
    });
  }
  const bind=createModernInstrumentBinding({element,mount,project(values,labels,state){
    // The EV ribbon measures driver input; the main readout keeps actual power.
    if(state.ev){
      labels.drive='DRIVE INPUT';labels.driveUnit='%';
      const scan=state.context.displayOverride;
      values.drive=Number.isFinite(scan?.speed)&&Number.isFinite(scan?.rpm)?String(Math.round(Math.max(0,Math.min(1,scan.rpm))*100)):values.input;
    }
    if(state.mode!=='freeRoam')return;
    if(state.ev){
      labels.a='TORQUE';labels.aUnit='Nm';
      values.a=state.live&&Number.isFinite(state.model.torque)?String(Math.round(state.model.torque)):'—';
      labels.b='BRAKE';labels.bUnit='%';
      values.b=state.live&&Number.isFinite(state.model.brakePercent)?String(Math.round(state.model.brakePercent)):'—';
    }else{
      labels.d='BRAKE';labels.dUnit='%';
      values.d=state.live&&Number.isFinite(state.model.brakePercent)?String(Math.round(state.model.brakePercent)):'—';
    }
  }});
  const gDot=element.querySelector('.ctr-g-field i');const lamps=Array.from(element.querySelectorAll('.ctr-shift-lights i'));
  return {element, update(model={},context={}){bind(model,context);const valid=!Boolean(context.stale??model.stale)&&Number.isFinite(model.gX)&&Number.isFinite(model.gZ);gDot.style.opacity=valid?'1':'0';const ratio=!Boolean(context.stale??model.stale)&&element.dataset.powertrain!=='ev'&&Number.isFinite(model.rpmRatio)?model.rpmRatio:0;lamps.forEach((lamp,i)=>{const level=Math.min(i,7-i);lamp.dataset.lit=String(ratio>=.72+level*.07);});if(valid)gDot.style.transform='translate('+Math.max(-1,Math.min(1,model.gX/2))*3+'cqw,'+Math.max(-1,Math.min(1,model.gZ/2))*-3+'cqw)';}, destroy(){element.remove();identity.remove();}};
}

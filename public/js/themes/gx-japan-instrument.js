import { createModernInstrumentBinding } from './modern-instrument-binding.js';
export function createGxJapanInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument gx-instrument';
  element.setAttribute('aria-label', '2025+ Japanese recessed utility instrument');
  element.innerHTML = `<div class="gx-cowl"><div class="gx-bezel"><div class="gx-screen next-body">
    <header class="gx-top"><span data-next-label="mode">RACE</span><span data-next-value="status">NO SIGNAL</span><span>DRIVER / 25+</span></header>
    <div class="gx-main"><div class="gx-heading-column next-detail"><span>VEHICLE YAW</span><div class="gx-heading-dial"><svg viewBox="0 0 100 100" aria-label="Yaw direction"><circle cx="50" cy="50" r="42"/><path class="gx-heading-ticks" d="M50 8V17 M92 50H83 M50 92V83 M8 50H17"/><path class="gx-yaw-needle" d="M50 18L45 56L50 50L55 56Z"/><circle class="gx-heading-hub" cx="50" cy="50" r="3"/></svg><b data-gx-yaw>—</b><small>DEG</small></div><span data-next-label="a">CURRENT LAP</span><strong data-next-value="a">—</strong><small data-next-label="aUnit">TIME</small></div>
      <div class="gx-speed-column next-readout"><div class="gx-speed"><strong data-next-value="speed">—</strong><span>km/h</span></div><div class="gx-gear"><b data-next-value="gear">—</b><small>GEAR</small></div><div class="gx-driver-rule"></div><div class="gx-pair"><div><span data-next-label="c">LATERAL G</span><b data-next-value="c">—</b><small data-next-label="cUnit">g</small></div><div><span data-next-label="d">TYRE MAX</span><b data-next-value="d">—</b><small data-next-label="dUnit">°C</small></div></div></div>
      <div class="gx-drive-column next-detail"><span data-next-label="drive">ENGINE SPEED</span><svg class="gx-drive-dial" viewBox="0 0 120 90" aria-label="Drive meter"><path d="M15 65A45 45 0 0 1 105 65"/><path class="gx-drive-fill" data-next-fill="arc" pathLength="100" d="M15 65A45 45 0 0 1 105 65"/></svg><b data-next-value="drive">—</b><small data-next-label="driveUnit">RPM</small><span data-next-label="b">BEST LAP</span><strong data-next-value="b">—</strong><small data-next-label="bUnit">TIME</small></div>
    </div><footer class="gx-bottom"><span data-next-label="scale">×1000 r/min</span><span>JAPAN · NEXT GENERATION</span></footer>
  </div></div><div class="gx-lower-lip"></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity gx-identity';
  identity.setAttribute('aria-hidden','true');
  identity.innerHTML = '<small>INSTRUMENT MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element,identity);
  const bind = createModernInstrumentBinding({element,mount,project(values,labels,state){
    if(state.mode!=='freeRoam')return;
    labels.d='BRAKE';labels.dUnit='%';
    values.d=state.live&&Number.isFinite(state.model.brakePercent)?String(Math.round(state.model.brakePercent)):'—';
    if(state.ev){
      labels.a='TORQUE';labels.aUnit='Nm';
      values.a=state.live&&Number.isFinite(state.model.torque)?String(Math.round(state.model.torque)):'—';
    }
  }});
  const needle=element.querySelector('.gx-yaw-needle'),yawValue=element.querySelector('[data-gx-yaw]');
  let lastAngle=null;
  function update(model={},context={}) {
    bind(model,context);
    const angle=!Boolean(context.stale??model.stale)&&Number.isFinite(model.yawDegrees)?model.yawDegrees:null;
    const text=angle===null?'—':String(Math.round(angle));
    if(yawValue.textContent!==text)yawValue.textContent=text;
    needle.style.opacity=angle===null?'0':'1';
    if(angle!==null&&angle!==lastAngle){needle.setAttribute('transform','rotate('+angle+' 50 50)');lastAngle=angle;}
  }
  return {element,update,destroy(){element.remove();identity.remove();}};
}

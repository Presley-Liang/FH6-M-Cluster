import { createModernInstrumentBinding } from './modern-instrument-binding.js';
export function createCivicJapanInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument ctr-instrument';
  element.setAttribute('aria-label', '2020–2024 Japanese horizontal performance instrument');
  element.innerHTML = `<div class="ctr-hood"><div class="ctr-rim"><div class="ctr-lcd next-body">
    <header class="ctr-heading"><span data-next-label="mode">RACE</span><div class="ctr-shift-lights">${'<i></i>'.repeat(8)}</div><div class="ctr-speed"><b data-next-value="secondary">—</b><small data-next-label="secondaryUnit">km/h</small></div></header>
    <div class="ctr-tach"><div class="ctr-scale">${Array.from({length:9},()=>'<span data-next-tick></span>').join('')}</div><svg class="ctr-tach-track" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-label="Engine speed ribbon"><path d="M5 82L138 20H995"/><path class="ctr-tach-fill" pathLength="100" data-next-fill="arc" d="M5 82L138 20H995"/></svg><div class="ctr-tach-caption"><span data-next-label="scale">×1000 r/min</span><b data-next-value="drive">—</b><small data-next-label="driveUnit">RPM</small></div></div>
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
  const bind=createModernInstrumentBinding({element,mount});
  const gDot=element.querySelector('.ctr-g-field i');const lamps=Array.from(element.querySelectorAll('.ctr-shift-lights i'));
  return {element, update(model={},context={}){bind(model,context);const valid=!Boolean(context.stale??model.stale)&&Number.isFinite(model.gX)&&Number.isFinite(model.gZ);gDot.style.opacity=valid?'1':'0';const ratio=!Boolean(context.stale??model.stale)&&element.dataset.powertrain!=='ev'&&Number.isFinite(model.rpmRatio)?model.rpmRatio:0;lamps.forEach((lamp,i)=>{const level=Math.min(i,7-i);lamp.dataset.lit=String(ratio>=.72+level*.07);});if(valid)gDot.style.transform='translate('+Math.max(-1,Math.min(1,model.gX/2))*3+'cqw,'+Math.max(-1,Math.min(1,model.gZ/2))*-3+'cqw)';}, destroy(){element.remove();identity.remove();}};
}

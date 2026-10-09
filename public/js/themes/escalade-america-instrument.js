import { createModernInstrumentBinding } from './modern-instrument-binding.js';
export function createEscaladeAmericaInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument esc-instrument';
  element.setAttribute('aria-label', '2025+ American continuous curved cockpit instrument');
  element.innerHTML = `<div class="esc-dashboard"><div class="esc-stitch"></div><div class="esc-slab next-body"><div class="esc-black-glass">
    <div class="esc-left-panel next-detail"><header><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header><div class="esc-left-data"><span data-next-label="a">CURRENT LAP</span><strong data-next-value="a">—</strong><small data-next-label="aUnit">TIME</small><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div><footer>DRIVER INFORMATION</footer></div>
    <div class="esc-driver-panel"><div class="esc-speed next-readout"><small>SPEED</small><strong data-next-value="speed">—</strong><span>km/h</span></div><div class="esc-driver-line"><div><b data-next-value="gear">—</b><span>GEAR</span></div><div><b data-next-value="drive">—</b><span data-next-label="driveUnit">RPM</span></div></div><svg class="esc-drive-track" viewBox="0 0 300 95" preserveAspectRatio="xMidYMid meet" aria-label="Engine speed scale"><path class="esc-drive-axis" d="M4 70L35 35H296"/><path class="esc-drive-fill" data-next-fill="arc" pathLength="100" d="M4 70L35 35H296"/><g class="esc-drive-scale"></g></svg><span class="esc-scale-label" data-next-label="scale">×1000 r/min</span></div>
    <div class="esc-right-panel next-detail"><header>VEHICLE STATUS</header><div><span data-next-label="c">LATERAL G</span><strong data-next-value="c">—</strong><small data-next-label="cUnit">g</small></div><div><span data-next-label="d">TYRE MAX</span><strong data-next-value="d">—</strong><small data-next-label="dUnit">°C</small></div><footer>25+ / AMERICA</footer></div>
  </div></div><div class="esc-metal-rail"></div><div class="esc-lower-dash"></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity esc-identity';
  identity.setAttribute('aria-hidden','true');
  identity.innerHTML = '<small>DRIVER CONFIGURATION</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const axis = element.querySelector('.esc-drive-axis');
  const scale = element.querySelector('.esc-drive-scale');
  let priorAxis = '';
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const update = createModernInstrumentBinding({element,mount,project(values,labels,state){
    if(state.mode!=='freeRoam')return;
    labels.d='BRAKE';labels.dUnit='%';
    values.d=state.live&&Number.isFinite(state.model.brakePercent)?String(Math.round(state.model.brakePercent)):'—';
    if(state.ev){
      labels.a='TORQUE';labels.aUnit='Nm';
      values.a=state.live&&Number.isFinite(state.model.torque)?String(Math.round(state.model.torque)):'—';
    }
  }});
  function updateScale(model,context) {
    const ev = ['ev','electric'].includes(String(context.powertrain || '').toLowerCase());
    const max = number(context.rpmGauge?.gaugeMax) > 0 ? context.rpmGauge.gaugeMax : number(model.engineMaxRpm) > 0 ? model.engineMaxRpm : null;
    const key = ev ? 'ev' : String(max);
    if (priorAxis === key) return;
    priorAxis = key;
    scale.innerHTML = '';
    if (!ev && max === null) return;
    const axisMax = ev ? 100 : max;
    const step = ev ? 25 : axisMax > 10000 ? 2000 : 1000;
    const tickValues = [];
    for (let value = 0;value < axisMax;value += step) tickValues.push(value);
    tickValues.push(axisMax);
    const length = axis.getTotalLength();
    tickValues.forEach((value,index) => {
      // Stroke reveal, tick marks and numbers all use distance along this axis.
      const fraction = value / axisMax;
      const point = axis.getPointAtLength(fraction * length);
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      const label = document.createElementNS('http://www.w3.org/2000/svg','text');
      for (const node of [line,label]) {
        node.dataset.escFraction = String(fraction);
        node.dataset.escValue = String(value);
        if (index === 0 || index === Math.floor((tickValues.length - 1) / 2) || index === tickValues.length - 1) node.setAttribute('data-esc-narrow','true');
      }
      line.setAttribute('x1',point.x);line.setAttribute('x2',point.x);
      line.setAttribute('y1',point.y - 3);line.setAttribute('y2',point.y + 3);
      label.setAttribute('x',point.x);label.setAttribute('y',point.y - 12);
      label.setAttribute('text-anchor',index === 0 ? 'start' : index === tickValues.length - 1 ? 'end' : 'middle');
      label.textContent = String(Number((ev ? value : value / 1000).toFixed(3)));
      scale.append(line,label);
    });
  }
  return {element,update(model = {},context = {}){updateScale(model,context);update(model,context);},destroy(){element.remove();identity.remove();}};
}

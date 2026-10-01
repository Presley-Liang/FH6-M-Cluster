import { createModernInstrumentBinding } from './modern-instrument-binding.js';
export function createEscaladeAmericaInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument esc-instrument';
  element.setAttribute('aria-label', '2025+ American continuous curved cockpit instrument');
  element.innerHTML = `<div class="esc-dashboard"><div class="esc-stitch"></div><div class="esc-slab next-body"><div class="esc-black-glass">
    <div class="esc-left-panel next-detail"><header><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header><div class="esc-left-data"><span data-next-label="a">CURRENT LAP</span><strong data-next-value="a">—</strong><small data-next-label="aUnit">TIME</small><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div><footer>DRIVER INFORMATION</footer></div>
    <div class="esc-driver-panel"><div class="esc-speed next-readout"><small>SPEED</small><strong data-next-value="speed">—</strong><span>km/h</span></div><div class="esc-driver-line"><div><b data-next-value="gear">—</b><span>GEAR</span></div><div><b data-next-value="drive">—</b><span data-next-label="driveUnit">RPM</span></div></div><div class="esc-drive-scale">${Array.from({length:9},()=>'<span data-next-tick></span>').join('')}</div><svg class="esc-drive-track" viewBox="0 0 300 50" preserveAspectRatio="none" aria-label="Engine speed scale"><path d="M4 44L35 9H296"/><path class="esc-drive-fill" data-next-fill="arc" pathLength="100" d="M4 44L35 9H296"/></svg><span class="esc-scale-label" data-next-label="scale">×1000 r/min</span></div>
    <div class="esc-right-panel next-detail"><header>VEHICLE STATUS</header><div><span data-next-label="c">LATERAL G</span><strong data-next-value="c">—</strong><small data-next-label="cUnit">g</small></div><div><span data-next-label="d">TYRE MAX</span><strong data-next-value="d">—</strong><small data-next-label="dUnit">°C</small></div><footer>25+ / AMERICA</footer></div>
  </div></div><div class="esc-metal-rail"></div><div class="esc-lower-dash"></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity esc-identity';
  identity.setAttribute('aria-hidden','true');
  identity.innerHTML = '<small>DRIVER CONFIGURATION</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  return {element,update:createModernInstrumentBinding({element,mount}),destroy(){element.remove();identity.remove();}};
}

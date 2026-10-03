import { createEuropeanInstrumentBinding } from './european-instrument-binding.js';

// The coordinator's baseline uses nonlinear speed stops. This instrument's
// evenly spaced 20 km/h ticks require a linear return target as well as sweep.
export function mapMultiplaLiveFractions(fractions = {}) {
  const stops = [0,20,40,60,100,140,200,260];
  const position = Math.max(0, Math.min(1, Number.isFinite(fractions.speed) ? fractions.speed : 0)) * 7;
  const index = Math.min(6, Math.floor(position));
  return { ...fractions, speed: (stops[index] + (stops[index+1]-stops[index])*(position-index)) / 260 };
}

// Multipla-era center pod direction; the OEM photo comparison is pending.
export function createMultiplaEuropeInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument mul-instrument';
  element.setAttribute('aria-label', '1995–2002 European center speed pod instrument');
  const ticks = Array.from({ length: 14 }, (_, index) => {
    const angle = (-130 + index * 20) * Math.PI / 180;
    const point = radius => [180 + Math.sin(angle) * radius, 180 - Math.cos(angle) * radius];
    const start = point(141), end = point(152), label = point(121);
    return `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}"/><text x="${label[0]}" y="${label[1]}" dominant-baseline="middle" text-anchor="middle">${index * 20}</text>`;
  }).join('');
  element.innerHTML = `<div class="mul-dashboard"><div class="mul-pod next-body">
    <header><span>EUROPE / 95—02</span><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header>
    <div class="mul-speed-dial"><svg viewBox="0 0 360 360" aria-label="Speed scale 0 to 260 kilometres per hour"><circle class="mul-dial-face" cx="180" cy="180" r="167"/><g class="mul-ticks">${ticks}</g><g class="mul-needle next-readout" data-mul-needle><path d="M180 42L175 194L180 188L185 194Z"/><circle cx="180" cy="180" r="8"/></g></svg>
      <div class="mul-speed next-readout"><strong data-next-value="speed">—</strong><small>km/h</small></div>
      </div><div class="mul-gear next-detail"><span>GEAR</span><b data-next-value="gear">—</b></div>
    <div class="mul-info next-detail"><div><span data-next-label="a">CURRENT LAP</span><b data-next-value="a">—</b><small data-next-label="aUnit">TIME</small></div><div><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div><div><span>TYRE MAX</span><b data-eu-value="temperature">—</b><small>°C</small></div></div>
    <div class="mul-drive next-detail"><span data-eu-value="driveLabel">ENGINE SPEED</span><div class="mul-drive-track"><i data-next-fill></i></div><div class="mul-drive-values"><small data-eu-value="scale">— RPM</small><b data-eu-value="drive">—</b><small data-eu-value="driveUnit">RPM</small></div></div>
  </div><div class="mul-dash-line"></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity mul-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createEuropeanInstrumentBinding({ element, mount });
  const needle = element.querySelector('[data-mul-needle]');
  function update(model, context) {
    const state = bind(model, context);
    if (state.sweep) {
      state.speed = Math.max(0, Math.min(1, context.displayOverride.speed)) * 260;
      element.querySelector('[data-next-value="speed"]').textContent = String(Math.round(state.speed));
    }
    needle.style.visibility = state.speed === null ? 'hidden' : 'visible';
    const fraction = Math.max(0, Math.min(1, (state.speed ?? 0) / 260));
    needle.setAttribute('transform', 'rotate(' + (-130 + fraction * 260) + ' 180 180)');
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

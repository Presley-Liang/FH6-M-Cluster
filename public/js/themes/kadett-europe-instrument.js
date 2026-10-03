import { createEuropeanInstrumentBinding } from './european-instrument-binding.js';

// Kadett-era LCD vocabulary; pending verification against an original photo.
export function createKadettEuropeInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument kad-instrument';
  element.setAttribute('aria-label', '1986–1994 European stepped digital instrument');
  const bands = Array.from({ length: 24 }, (_, index) => {
    const x = 16 + index * 13;
    const y = 180 - index * 5;
    return '<path data-kad-segment="' + index + '" d="M' + x + ' 194V' + y + 'H' + (x + 9) + 'V194Z"/>';
  }).join('');
  element.innerHTML = `<div class="kad-hood"><div class="kad-face next-body">
    <header><span>EUROPE / 86—94</span><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header>
    <div class="kad-main"><div class="kad-drive"><div class="kad-meter next-readout"><svg viewBox="0 0 340 214" aria-label="Stepped drive scale">${bands}</svg></div>
      <div class="kad-drive-line next-detail"><span data-eu-value="driveLabel">ENGINE SPEED</span><b data-eu-value="drive">—</b><small data-eu-value="driveUnit">RPM</small></div>
      <div class="kad-scale next-detail"><span data-eu-value="scale">— RPM</span></div></div>
      <div class="kad-speed-column"><div class="kad-speed next-readout"><strong data-next-value="speed">—</strong><small>km/h</small></div>
        <div class="kad-small next-detail"><div><span>GEAR</span><b data-next-value="gear">—</b></div><div><span>TYRE MAX</span><b data-eu-value="temperature">—</b><small>°C</small></div></div></div></div>
    <footer class="kad-footer next-detail"><div><span data-next-label="a">CURRENT LAP</span><b data-next-value="a">—</b><small data-next-label="aUnit">TIME</small></div><div><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div></footer>
  </div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity kad-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createEuropeanInstrumentBinding({ element, mount });
  const bandsNodes = Array.from(element.querySelectorAll('[data-kad-segment]'));
  function update(model, context) {
    const state = bind(model, context);
    bandsNodes.forEach((node, index) => { node.dataset.lit = String(index < Math.ceil(state.fraction * bandsNodes.length)); });
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

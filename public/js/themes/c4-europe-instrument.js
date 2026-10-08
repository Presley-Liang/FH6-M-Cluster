import { createEuropeanInstrumentBinding } from './european-instrument-binding.js';

// Segmented central LCD inspired by the viewed first-generation-era PSA panel.
// OEM fuel/coolant slots show accurately labelled FH input/tyre temperature.
export function createC4EuropeInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument c4-instrument';
  element.setAttribute('aria-label', '2003–2008 European translucent central LCD instrument');
  element.innerHTML = `<div class="c4-dashboard"><div class="c4-visor"><div class="c4-glass next-body">
    <header><span>EUROPE / 03—08</span><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header>
    <div class="c4-scale-panel next-detail"><span data-eu-value="driveLabel">ENGINE SPEED</span><div class="c4-scale-track"><i data-next-fill></i></div><div class="c4-scale-values"><small data-eu-value="scale">— RPM</small><b data-eu-value="drive">—</b><small data-eu-value="driveUnit">RPM</small></div></div>
    <div class="c4-primary"><div class="c4-side next-detail"><span>TYRE MAX</span><div class="c4-tower"><i data-c4-temperature></i></div><b data-eu-value="temperature">—</b><small>°C</small></div>
      <div class="c4-speed next-readout"><strong data-next-value="speed">—</strong><small>km/h</small><div class="c4-gear next-detail"><span>GEAR</span><b data-next-value="gear">—</b></div></div>
      <div class="c4-side next-detail"><span>THROTTLE</span><div class="c4-tower"><i data-c4-input></i></div><b data-next-value="input">—</b><small>%</small></div></div>
    <footer class="c4-information next-detail"><div><span data-next-label="a">CURRENT LAP</span><b data-next-value="a">—</b><small data-next-label="aUnit">TIME</small></div><div><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div></footer>
  </div></div><div class="c4-dashboard-ridge"></div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity c4-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createEuropeanInstrumentBinding({ element, mount });
  const temperature = element.querySelector('[data-c4-temperature]');
  const input = element.querySelector('[data-c4-input]');
  function update(model, context) {
    const state = bind(model, context);
    const clamp = value => Math.max(0, Math.min(1, value));
    temperature.style.height = (state.temperature === null ? 0 : clamp((state.temperature - 20) / 120) * 100) + '%';
    input.style.height = (state.input === null ? 0 : clamp(state.input / 100) * 100) + '%';
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

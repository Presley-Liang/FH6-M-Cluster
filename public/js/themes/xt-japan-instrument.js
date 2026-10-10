import { createModernInstrumentBinding } from './modern-instrument-binding.js';
// Serialized into the standalone page. This layout uses the XT-era perspective
// display vocabulary; all labels describe FH telemetry, not simulated OEM data.
export function createXtJapanInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument xt-instrument';
  element.setAttribute('aria-label', '1986–1994 Japanese perspective digital instrument');
  const segments = Array.from({ length: 16 }, (_, i) => {
    const y = 22 + i * 10, next = y + 7;
    const half = y * 1.7, halfNext = next * 1.7;
    return `<polygon data-xt-segment="${i}" points="${500-half},${y} ${500+half},${y} ${500+halfNext},${next} ${500-halfNext},${next}"/>`;
  }).join('');
  element.innerHTML = `<div class="xt-hood"><div class="xt-face next-body">
    <header class="xt-header"><span>JAPAN / 86—94</span><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header>
    <div class="xt-numbers next-readout"><div class="xt-speed"><strong data-next-value="speed">—</strong><span>km/h</span></div><div class="xt-gear"><small>GEAR</small><b data-next-value="gear">—</b></div><div class="xt-drive"><strong data-next-value="drive">—</strong><span data-next-label="driveUnit">RPM</span></div></div>
    <div class="xt-graphic"><div class="xt-tower next-detail"><span>TYRE MAX</span><div class="xt-tower-well"><i data-xt-temperature></i></div><b data-xt-value="temperature">—</b><small>°C</small></div>
      <div class="xt-road"><svg viewBox="0 0 1000 205" aria-label="Perspective engine speed scale"><path class="xt-road-outline" d="M175 190L466 18H534L825 190ZM500 18V190"/>${segments}</svg><div class="xt-road-caption"><span data-xt-caption>ENGINE SPEED</span><b data-xt-value="scale">—</b></div></div>
      <div class="xt-tower next-detail"><span>THROTTLE</span><div class="xt-tower-well"><i data-xt-throttle></i></div><b data-next-value="input">—</b><small>%</small></div></div>
    <footer class="xt-footer next-detail"><div><span data-next-label="a">CURRENT LAP</span><b data-next-value="a">—</b><small data-next-label="aUnit">TIME</small></div><div><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div></footer>
  </div></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity xt-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createModernInstrumentBinding({ element, mount, project(values, labels, state) {
    if (state.mode !== 'freeRoam') return;
    labels.b = 'LATERAL G'; labels.bUnit = 'g';
    values.b = state.live && Number.isFinite(state.model.gX) ? state.model.gX.toFixed(2) : '—';
    if (state.ev) {
      labels.a = 'BRAKE'; labels.aUnit = '%';
      values.a = state.live && Number.isFinite(state.model.brakePercent) ? String(Math.round(state.model.brakePercent)) : '—';
    }
  } });
  const segmentsNodes = Array.from(element.querySelectorAll('[data-xt-segment]'));
  const temp = element.querySelector('[data-xt-temperature]');
  const throttle = element.querySelector('[data-xt-throttle]');
  const tempValue = element.querySelector('[data-xt-value="temperature"]');
  const scale = element.querySelector('[data-xt-value="scale"]');
  const caption = element.querySelector('[data-xt-caption]');
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const clamp = v => Math.max(0, Math.min(1, v));
  function update(model = {}, context = {}) {
    bind(model, context);
    const live = !Boolean(context.stale ?? model.stale);
    const ev = element.dataset.powertrain === 'ev';
    const max = finite(context.rpmGauge?.gaugeMax) && context.rpmGauge.gaugeMax > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) && model.engineMaxRpm > 0 ? model.engineMaxRpm : null;
    const sweep = finite(context.displayOverride?.rpm) && finite(context.displayOverride?.speed);
    const input = live && finite(model.throttlePercent) ? clamp(model.throttlePercent / 100) : 0;
    const ratio = sweep ? clamp(context.displayOverride.rpm) : ev ? input : live && max && finite(model.rpm) ? clamp(model.rpm / max) : 0;
    segmentsNodes.forEach((node, i) => { node.dataset.lit = String(i < Math.ceil(ratio * segmentsNodes.length)); });
    const temperatures = live ? (model.wheels || []).map(w => w.tempC).filter(finite) : [];
    const hottest = temperatures.length ? Math.max(...temperatures) : null;
    temp.style.height = (hottest === null ? 0 : clamp((hottest - 20) / 120) * 100) + '%';
    throttle.style.height = (input * 100) + '%';
    tempValue.textContent = hottest === null ? '—' : String(Math.round(hottest));
    caption.textContent = ev ? 'DRIVE INPUT' : sweep && max === null ? 'DISPLAY SCAN' : 'ENGINE SPEED';
    scale.textContent = ev ? '0—100%' : max ? '0—' + Math.round(max) + ' RPM' : sweep ? 'DISPLAY SCAN' : '— RPM';
    element.dataset.sweep = String(sweep);
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

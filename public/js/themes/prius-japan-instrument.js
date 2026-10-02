import { createModernInstrumentBinding } from './modern-instrument-binding.js';
// Prius-generation center-mounted split screens, adapted to FH telemetry.
// No SOC, battery-flow arrows, CHG/ECO/PWR classification or economy is inferred.
export function createPriusJapanInstrument({ document, mount }) {
  const element = document.createElement('section');
  element.className = 'next-instrument pri-instrument';
  element.setAttribute('aria-label', '2015–2019 Japanese center-mounted twin-screen instrument');
  element.innerHTML = `<div class="pri-dashboard"><div class="pri-hood"><div class="pri-screens next-body">
    <div class="pri-left"><header><span data-next-label="mode">RACE</span><small data-next-value="status">NO SIGNAL</small></header>
      <div class="pri-speed next-readout"><strong data-next-value="speed">—</strong><small>km/h</small></div>
      <div class="pri-left-bottom next-detail"><div class="pri-gear"><span>GEAR</span><b data-next-value="gear">—</b></div><div class="pri-output"><span>OUTPUT</span><b data-next-value="power">—</b><small>kW</small></div></div>
    </div><div class="pri-right"><header><span data-pri-caption>ENGINE SPEED</span><small data-next-label="driveUnit">RPM</small></header>
      <div class="pri-meter next-readout"><div class="pri-meter-track"><i data-next-fill></i></div><div class="pri-scale">${Array.from({ length: 5 }, () => '<span data-next-tick></span>').join('')}</div><div class="pri-meter-number"><b data-pri-drive>—</b><small data-pri-unit>RPM</small></div></div>
      <div class="pri-information next-detail"><div><span data-next-label="a">CURRENT LAP</span><strong data-next-value="a">—</strong><small data-next-label="aUnit">TIME</small></div><div><span data-next-label="b">BEST LAP</span><b data-next-value="b">—</b><small data-next-label="bUnit">TIME</small></div></div>
    </div></div></div><div class="pri-dash-edge"></div><footer>JAPAN / 15—19</footer></div>`;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity pri-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createModernInstrumentBinding({ element, mount });
  const caption = element.querySelector('[data-pri-caption]');
  const value = element.querySelector('[data-pri-drive]');
  const unit = element.querySelector('[data-pri-unit]');
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  function update(model = {}, context = {}) {
    bind(model, context);
    const live = !Boolean(context.stale ?? model.stale);
    const ev = element.dataset.powertrain === 'ev';
    const override = context.displayOverride;
    const sweep = finite(override?.speed) && finite(override?.rpm);
    const max = finite(context.rpmGauge?.gaugeMax) && context.rpmGauge.gaugeMax > 0 ? context.rpmGauge.gaugeMax : finite(model.engineMaxRpm) && model.engineMaxRpm > 0 ? model.engineMaxRpm : null;
    const drive = sweep ? Math.max(0, Math.min(1, override.rpm)) * (ev ? 100 : max ?? 8000) : live ? ev ? model.throttlePercent : model.rpm : null;
    caption.textContent = ev ? 'DRIVE INPUT' : 'ENGINE SPEED';
    value.textContent = finite(drive) ? String(Math.round(drive)) : '—';
    unit.textContent = ev ? '%' : 'RPM';
    element.querySelector('header small[data-next-label="driveUnit"]').textContent = ev ? '%' : '×1000 r/min';
    if (element.dataset.mode === 'freeRoam') {
      const temperatures = live ? (model.wheels || []).map(w => w.tempC).filter(finite) : [];
      element.querySelector('[data-next-label="a"]').textContent = ev ? 'LATERAL G' : 'THROTTLE';
      element.querySelector('[data-next-value="a"]').textContent = live && finite(ev ? model.gX : model.throttlePercent)
        ? ev ? model.gX.toFixed(2) : String(Math.round(model.throttlePercent)) : '—';
      element.querySelector('[data-next-label="aUnit"]').textContent = ev ? 'g' : '%';
      element.querySelector('[data-next-label="b"]').textContent = 'TYRE MAX';
      element.querySelector('[data-next-value="b"]').textContent = temperatures.length ? String(Math.round(Math.max(...temperatures))) : '—';
      element.querySelector('[data-next-label="bUnit"]').textContent = '°C';
    }
    element.dataset.sweep = String(sweep);
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

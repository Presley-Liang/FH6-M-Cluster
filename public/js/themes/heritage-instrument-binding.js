import { createEuropeanInstrumentBinding } from './european-instrument-binding.js';

// Reuse signal/phase projection, never dashboard geometry. All functions here
// are serialized into the standalone HTML before the eight layout factories.
export function createHeritageDial({ drive = false, start = -130, end = 130, half = false } = {}) {
  const marks = Array.from({ length: 8 }, (_, i) => {
    const angle = (start + (end - start) * i / 7) * Math.PI / 180;
    const point = r => [(150 + Math.sin(angle) * r) * (half ? 2 : 1), (150 - Math.cos(angle) * r) * (half ? 2/3 : 1)];
    const a = point(124), b = point(134), c = point(108);
    const label = drive ? `data-next-tick` : '';
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><text ${label} x="${c[0]}" y="${c[1]}" dominant-baseline="middle" text-anchor="middle">${drive ? '' : [0,20,40,60,100,140,200,260][i]}</text>`;
  }).join('');
  const face = half ? '<path class="heritage-face" d="M14 100A286 95.333 0 0 1 586 100Z"/>' : '<circle class="heritage-face" cx="150" cy="150" r="143"/>';
  return `<svg viewBox="0 0 ${half ? '600 120' : '300 300'}" aria-label="${drive ? 'Engine speed or drive input scale' : 'Speed scale 0 to 260 km/h'}">${face}<g class="heritage-ticks">${marks}</g><g transform="scale(${half ? '2 .6666667' : '1 1'})"><g class="heritage-needle" data-heritage-needle="${drive ? 'drive' : 'speed'}" data-start="${start}" data-end="${end}"><path d="M150 30L146 166L150 160L154 166Z"/><circle cx="150" cy="150" r="7"/></g></g></svg>`;
}

export function createHeritageInstrument({ document, mount, className, label, markup }) {
  const element = document.createElement('section');
  element.className = 'next-instrument heritage-instrument ' + className + '-instrument';
  element.setAttribute('aria-label', label);
  element.innerHTML = markup;
  const identity = document.createElement('div');
  identity.className = 'next-mode-identity ' + className + '-identity';
  identity.setAttribute('aria-hidden', 'true');
  identity.innerHTML = '<small>DISPLAY MODE</small><strong data-next-mode="race">RACE</strong><strong data-next-mode="freeRoam">FREE</strong>';
  mount.append(element, identity);
  const bind = createEuropeanInstrumentBinding({ element, mount });
  const needles = [...element.querySelectorAll('[data-heritage-needle]')];
  const speedMeters = [...element.querySelectorAll('[data-heritage-speed-meter]')];
  const driveMeters = [...element.querySelectorAll('[data-heritage-drive-meter]')];
  const speedStops = [0,20,40,60,100,140,200,260];
  const clamp = n => Math.max(0, Math.min(1, n));
  function speedFraction(speed) {
    if (speed <= 0) return 0;
    for (let i = 0; i < 7; i++) if (speed <= speedStops[i+1]) return (i + (speed-speedStops[i])/(speedStops[i+1]-speedStops[i]))/7;
    return 1;
  }
  function update(model = {}, context = {}) {
    const state = bind(model, context);
    const speed = speedFraction(state.speed ?? 0);
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const driveAvailable = state.sweep || state.live && (state.ev ? state.input !== null
      : finite(model.rpm) && (finite(context.rpmGauge?.gaugeMax) && context.rpmGauge.gaugeMax > 0
        || finite(model.engineMaxRpm) && model.engineMaxRpm > 0));
    for (const needle of needles) {
      const drive = needle.dataset.heritageNeedle === 'drive';
      needle.style.visibility = drive ? driveAvailable ? 'visible' : 'hidden' : state.speed === null ? 'hidden' : 'visible';
      const fraction = drive ? state.fraction : speed;
      const start = Number(needle.dataset.start), end = Number(needle.dataset.end);
      needle.setAttribute('transform', 'rotate(' + (start + fraction * (end-start)) + ' 150 150)');
    }
    for (const meter of speedMeters) meter.style.setProperty('--heritage-fill', clamp((state.speed ?? 0) / 260).toFixed(4));
    for (const meter of driveMeters) meter.style.setProperty('--heritage-fill', state.fraction.toFixed(4));
  }
  return { element, update, destroy() { element.remove(); identity.remove(); } };
}

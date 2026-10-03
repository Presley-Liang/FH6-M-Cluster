import { createHeritageInstrument, createHeritageDial } from './heritage-instrument-binding.js';

// Independent era layout. OEM photo verification remains in the reference log.
export function createCorvette84AmericaInstrument({ document, mount }) {
  return createHeritageInstrument({ document, mount, className: 'v84', label: 'AMERICA / 76—85 instrument', markup: `<div class="v84-dashboard">
    <div class="v84-case next-body">
    <header class="heritage-heading">
    <span>AMERICA / 76—85</span>
    <span data-next-label="mode">RACE</span>
    <small data-next-value="status">NO SIGNAL</small>
    </header>
    <div class="v84-speed-panel">
    <svg viewBox="0 0 300 210" class="v84-curve" aria-hidden="true">
    <path d="M40 195Q15 80 130 20" class="v84-speed-arc" pathLength="100" data-heritage-speed-meter/>
    </svg>
    <div class="heritage-speed next-readout">
    <strong data-next-value="speed">—</strong>
    <small>km/h</small>
    </div>
    <span class="v84-speed-caption next-detail">SPEED · 0—260</span>
    </div>
    <div class="v84-status-panel next-detail">
    <div class="heritage-gear next-detail">
    <span>GEAR</span>
    <b data-next-value="gear">—</b>
    </div>
    <div class="heritage-temp next-detail">
    <span>TYRE MAX</span>
    <b data-eu-value="temperature">—</b>
    <small>°C</small>
    </div>
    <div class="heritage-input next-detail">
    <span>THROTTLE</span>
    <b data-next-value="input">—</b>
    <small>%</small>
    </div>
    </div>
    <div class="v84-drive-panel">
    <div class="v84-mountain" data-heritage-drive-meter>
    </div>
    <div class="heritage-drive next-detail">
    <span data-eu-value="driveLabel">ENGINE SPEED</span>
    <div class="heritage-track">
    <i data-next-fill>
    </i>
    </div>
    <div class="heritage-drive-values">
    <b data-eu-value="drive">—</b>
    <small data-eu-value="driveUnit">RPM</small>
    </div>
    <small data-eu-value="scale">— RPM</small>
    </div>
    </div>
    <footer class="heritage-info next-detail">
    <div>
    <span data-next-label="a">CURRENT LAP</span>
    <b data-next-value="a">—</b>
    <small data-next-label="aUnit">TIME</small>
    </div>
    <div>
    <span data-next-label="b">BEST LAP</span>
    <b data-next-value="b">—</b>
    <small data-next-label="bUnit">TIME</small>
    </div>
    </footer>
    </div>
    </div>` });
}

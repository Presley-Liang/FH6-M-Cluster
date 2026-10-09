import { createHeritageInstrument, createHeritageDial } from './heritage-instrument-binding.js';

// Central digital speed / lower gear topology from the 1999 GM owner's manual,
// printed page 2-64. Side fields use available game data rather than fake fuel/HVAC.
export function createDevilleAmericaInstrument({ document, mount }) {
  return createHeritageInstrument({ document, mount, className: 'deville', label: 'AMERICA / 95—02 instrument', markup: `<div class="deville-dashboard">
    <div class="deville-tunnel next-body">
    <header class="heritage-heading">
    <span>AMERICA / 95—02</span>
    <span data-next-label="mode">RACE</span>
    <small data-next-value="status">NO SIGNAL</small>
    </header>
    <div class="deville-line next-detail">
    <span>DIGITAL DRIVER INFORMATION</span>
    </div>
    <div class="deville-speed-window">
    <div class="heritage-speed next-readout">
    <strong data-next-value="speed">—</strong>
    <small>km/h</small>
    </div>
    <div class="heritage-gear next-detail">
    <span>GEAR</span>
    <b data-next-value="gear">—</b>
    </div>
    </div>
    <div class="deville-upper">
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
    <div class="deville-bottom">
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
    <div class="heritage-temp next-detail">
    <span>TYRE MAX</span>
    <b data-eu-value="temperature">—</b>
    <small>°C</small>
    </div>
    </div>
    </div>
    </div>` });
}

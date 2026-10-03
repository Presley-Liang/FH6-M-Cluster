import { createHeritageInstrument, createHeritageDial } from './heritage-instrument-binding.js';

// Independent era layout. OEM photo verification remains in the reference log.
export function createPortalAmericaInstrument({ document, mount }) {
  return createHeritageInstrument({ document, mount, className: 'portal', label: 'AMERICA / 60—75 instrument', markup: `<div class="portal-dashboard">
    <div class="portal-casing next-body">
    <header class="heritage-heading">
    <span>AMERICA / 60—75</span>
    <span data-next-label="mode">RACE</span>
    <small data-next-value="status">NO SIGNAL</small>
    </header>
    <div class="portal-speed-window">
    <div class="portal-speed-scale next-detail">
    <span>0</span>
    <span>60</span>
    <span>140</span>
    <span>260 km/h</span>
    </div>
    <div class="portal-ribbon" data-heritage-speed-meter>
    </div>
    <div class="heritage-speed next-readout">
    <strong data-next-value="speed">—</strong>
    <small>km/h</small>
    </div>
    <div class="heritage-gear next-detail">
    <span>GEAR</span>
    <b data-next-value="gear">—</b>
    </div>
    </div>
    <div class="portal-tower">
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

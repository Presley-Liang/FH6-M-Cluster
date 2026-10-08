import { createHeritageInstrument, createHeritageDial } from './heritage-instrument-binding.js';

// Independent era layout. OEM photo verification remains in the reference log.
export function createCrownJapanInstrument({ document, mount }) {
  return createHeritageInstrument({ document, mount, className: 'crown', label: 'JAPAN / 50—59 instrument', markup: `<div class="crown-dashboard">
    <div class="crown-hood next-body">
    <header class="heritage-heading">
    <span>JAPAN / 50—59</span>
    <span data-next-label="mode">RACE</span>
    <small data-next-value="status">NO SIGNAL</small>
    </header>
    <div class="crown-dial">${createHeritageDial({start:-90,end:90,half:true})}</div>
    <div class="heritage-speed next-readout">
    <strong data-next-value="speed">—</strong>
    <small>km/h</small>
    </div>
    <div class="heritage-gear next-detail">
    <span>GEAR</span>
    <b data-next-value="gear">—</b>
    </div>
    </div>
    <div class="crown-tray next-body">
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

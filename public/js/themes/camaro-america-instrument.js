import { createHeritageInstrument, createHeritageDial } from './heritage-instrument-binding.js';

// Independent era layout. OEM photo verification remains in the reference log.
export function createCamaroAmericaInstrument({ document, mount }) {
  return createHeritageInstrument({ document, mount, className: 'camaro', label: 'AMERICA / 09—14 instrument', markup: `<div class="camaro-dashboard">
    <div class="camaro-binnacle next-body">
    <header class="heritage-heading">
    <span>AMERICA / 09—14</span>
    <span data-next-label="mode">RACE</span>
    <small data-next-value="status">NO SIGNAL</small>
    </header>
    <div class="camaro-left">
    <div class="camaro-dial">${createHeritageDial({drive:true})}</div>
    <span class="camaro-dial-label next-detail" data-eu-value="driveLabel">ENGINE SPEED</span>
    </div>
    <div class="camaro-center">
    <div class="heritage-speed next-readout">
    <strong data-next-value="speed">—</strong>
    <small>km/h</small>
    </div>
    <div class="heritage-gear next-detail">
    <span>GEAR</span>
    <b data-next-value="gear">—</b>
    </div>
    </div>
    <div class="camaro-right">
    <div class="camaro-dial">${createHeritageDial()}</div>
    <span class="camaro-speed-label next-detail">SPEED · km/h</span>
    </div>
    <div class="camaro-quad next-detail">
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
    <div class="camaro-output">
    <span>OUTPUT</span>
    <b data-next-value="power">—</b>
    <small>kW</small>
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

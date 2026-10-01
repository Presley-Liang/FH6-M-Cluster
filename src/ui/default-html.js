import { createTelemetryStore } from '../../public/js/telemetry-store.js';
import { effectiveTimeline } from '../session/runtime.js';
import { clusterShell, clusterCSS } from './cluster-shell.js';
import { selectTelemetry } from '../../public/js/telemetry-selectors.js';
import { createPageController } from '../../public/js/page-controller.js';
import { createClusterBindings } from '../../public/js/cluster-bindings.js';
import { DEFAULT_CALIBRATION, validateCalibration, createWorldToMap } from '../../public/js/map/calibration.js';
import { createLeafletAdapter } from '../../public/js/map/leaflet-adapter.js';
import { createTrackBuffer } from '../../public/js/map/track-buffer.js';
import { createMapCameraController } from '../../public/js/map/camera-controller.js';
import { createRouteUIController } from '../../public/js/route-ui-controller.js';
import { finiteDeltaValue, unavailableDelta, readDeltaProgress, readDeltaTime, buildGhostReference, interpolateGhostTime, LiveDeltaTracker, createLiveDeltaTracker } from '../routes/live-delta.js';
import { createVehicleStateController } from '../../public/js/vehicle-state-controller.js';
import { niceRpmScale, createRpmGaugeController } from '../../public/js/rpm-gauge-controller.js';
import { createUIAnimationCoordinator } from '../../public/js/ui-animation-coordinator.js';
import { createShiftLightController } from '../../public/js/shift-light-controller.js';
import { createRaceFeedbackController } from '../../public/js/race-feedback-controller.js';
import { VEHICLE_MODEL_BY_ORDINAL, lookupVehicleModel } from '../../public/js/vehicle-model-catalog.js';
import { createJdm90Instrument } from '../../public/js/themes/jdm90-instrument.js';
import { createClassicalEuropeInstrument } from '../../public/js/themes/classical-europe-instrument.js';
import { createRetroDigitalAmericaInstrument } from '../../public/js/themes/retro-digital-america-instrument.js';
import { createEarly911EuropeInstrument } from '../../public/js/themes/early-911-europe-instrument.js';
import { createRx8JapanInstrument } from '../../public/js/themes/rx8-japan-instrument.js';
import { createC8AmericaInstrument } from '../../public/js/themes/c8-america-instrument.js';
import { createBelairAmericaInstrument } from '../../public/js/themes/belair-america-instrument.js';
import { createAe86JapanInstrument } from '../../public/js/themes/ae86-japan-instrument.js';
import { createR8EuropeInstrument } from '../../public/js/themes/r8-europe-instrument.js';
import { createS30JapanInstrument } from '../../public/js/themes/s30-japan-instrument.js';
import { createDsEuropeInstrument } from '../../public/js/themes/ds-europe-instrument.js';
import { createLfaJapanInstrument } from '../../public/js/themes/lfa-japan-instrument.js';
import { createCxEuropeInstrument } from '../../public/js/themes/cx-europe-instrument.js';
import { createFordGtAmericaInstrument } from '../../public/js/themes/ford-gt-america-instrument.js';
import { createTaycanEuropeInstrument } from '../../public/js/themes/taycan-europe-instrument.js';
import { createPanoramicEuropeInstrument } from '../../public/js/themes/panoramic-europe-instrument.js';
import { createModernInstrumentBinding } from '../../public/js/themes/modern-instrument-binding.js';
import { createCivicJapanInstrument } from '../../public/js/themes/civic-japan-instrument.js';
import { createEscaladeAmericaInstrument } from '../../public/js/themes/escalade-america-instrument.js';
import { createGxJapanInstrument } from '../../public/js/themes/gx-japan-instrument.js';
import { createInstrumentThemeHost } from '../../public/js/themes/instrument-theme-host.js';
import { mountManualThemeButtonSet as createManualThemeButtonSet } from '../../public/js/themes/manual-theme-button-set.js';
import { VEHICLE_METADATA_BY_ORDINAL, resolveVehicleTheme } from '../vehicle/vehicle-metadata.js';
import { DEFAULT_THEME_ID, THEME_REGISTRY, resolveTheme } from '../../public/js/themes/theme-registry.js';

const VEHICLE_THEME_PRESENTATIONS = Object.fromEntries(
  Object.keys(THEME_REGISTRY).flatMap(themeId => ['race', 'freeRoam'].flatMap(driveMode => ['combustion', 'hybrid', 'ev'].map(powertrain => {
    const capabilities = powertrain === 'ev' ? { power: { available: true, verified: true, sourceKey: 'power', unit: 'kW' } } : {};
    const resolved = resolveTheme({ themeId, driveMode, powertrain, capabilities });
    return [`${themeId}|${driveMode}|${powertrain}`, {
      themeId: resolved.themeId,
      era: resolved.base.eraId,
      region: resolved.base.regionId,
      visual: resolved.base.visual,
      mode: resolved.mode.id,
      powertrain: resolved.powertrain?.kind ?? 'combustion',
      displayOverride: resolved.powertrain ? 'ev' : 'none',
      displayPowerAvailable: Boolean(resolved.powertrain?.signals.power.available),
      displayRegenAvailable: Boolean(resolved.powertrain?.signals.regen.available),
      displaySocAvailable: Boolean(resolved.powertrain?.signals.soc.available),
      displayEnergyAvailable: Boolean(resolved.powertrain?.signals.energy.available),
      tokens: resolved.tokens,
    }];
  }))));
const VEHICLE_THEME_BY_ORDINAL = Object.fromEntries(Object.entries(VEHICLE_METADATA_BY_ORDINAL)
  .map(([ordinal, metadata]) => [ordinal, resolveVehicleTheme(metadata)]));

export function getDefaultHTML() {
  // Speedometer arc: r=95, circ=596.9, 270deg sweep=447.7
  // Half-arc gauges: r=40, circ=251.3, 180deg sweep=125.7
  const legacy = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FH6 Telemetry</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0A0A0A;
      color: #fff;
      height: 100vh;
      overflow: hidden;
      padding: 10px 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background-image:
        repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px);
    }
    .header {
      background: #111;
      border: 1px solid #1E1E1E;
      border-bottom: 2px solid #C0392B;
      border-radius: 8px;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    #session-info {
      font-size: 11px;
      color: #ccc;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      white-space: nowrap;
    }
    #status {
      font-size: 11px;
      color: #ccc;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #status.active { color: #27AE60; }
    #status.sse-error { color: #E74C3C; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #2A2A2A; flex-shrink: 0; }
    .dot.active { background: #27AE60; box-shadow: 0 0 6px #27AE60; }
    .dot.error { background: #E74C3C; box-shadow: 0 0 6px #E74C3C; }

    .main { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
    .left-col, .right-col { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
    .left-col > .card:first-child { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .minimap-card { flex: 1; min-height: 0; margin-bottom: 0; display: flex; flex-direction: column; }

    .card {
      background: #111;
      border: 1px solid #1E1E1E;
      border-top: 2px solid #C0392B;
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 2.5px;
      color: #fff;
      margin-bottom: 14px;
      font-weight: 600;
    }

    /* SPEEDOMETER */
    .speedo-svg { width: 100%; max-width: 280px; display: block; margin: 0 auto; }

    /* INSTRUMENTS */
    .instruments {
      display: grid;
      grid-template-columns: 1fr 72px 1fr;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
    }
    .instr-label {
      font-size: 9px;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
      margin-bottom: 2px;
    }
    .gear-ring {
      width: 64px; height: 64px;
      border-radius: 50%;
      border: 2px solid #1E1E1E;
      background: #0A0A0A;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto;
    }
    #gear {
      font-size: 32px;
      font-weight: 900;
      color: #C0392B;
      font-variant-numeric: tabular-nums;
    }

    /* LAP INFO */
    #lap-time {
      font-size: 30px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
      font-variant-numeric: tabular-nums;
    }
    #lap-best { font-size: 11px; color: #C0392B; margin-top: 4px; letter-spacing: 1px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    .info-item {
      background: #0D0D0D;
      border: 1px solid #1A1A1A;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex; flex-direction: column; gap: 3px;
    }
    .info-label { font-size: 8px; color: #fff; text-transform: uppercase; letter-spacing: 2px; }
    .info-value { font-size: 18px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }

    /* TIRE LAYOUT */
    .tire-grid {
      display: grid;
      grid-template-areas:
        "fl car fr"
        "rl car rr";
      grid-template-columns: 1fr 56px 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 12px 8px;
      align-items: center;
      justify-items: center;
    }
    .tire-slot { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .tire-slot.fl { grid-area: fl; }
    .tire-slot.fr { grid-area: fr; }
    .tire-slot.rl { grid-area: rl; }
    .tire-slot.rr { grid-area: rr; }
    .car-body { grid-area: car; }
    .tire {
      width: 32px; height: 54px;
      border-radius: 7px;
      border: 3px solid #222;
      background: #0D0D0D;
      background-image: repeating-linear-gradient(
        0deg, transparent, transparent 5px,
        rgba(255,255,255,0.03) 5px, rgba(255,255,255,0.03) 6px
      );
      transition: border-color 0.25s, box-shadow 0.25s;
    }
    .tire.cool { border-color: #27AE60; box-shadow: 0 0 8px rgba(39,174,96,0.35); }
    .tire.warm { border-color: #F39C12; box-shadow: 0 0 8px rgba(243,156,18,0.35); }
    .tire.hot  { border-color: #E74C3C; box-shadow: 0 0 10px rgba(231,76,60,0.5); }
    .tire-lbl  { font-size: 8px; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
    .tire-val  { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .tire-val.cool { color: #27AE60; }
    .tire-val.warm { color: #F39C12; }
    .tire-val.hot  { color: #E74C3C; }

    /* INPUTS */
    .inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .input-row { display: flex; flex-direction: column; gap: 4px; }
    .input-header { display: flex; justify-content: space-between; }
    .input-lbl { font-size: 8px; color: #fff; text-transform: uppercase; letter-spacing: 2px; }
    .input-val { font-size: 10px; font-variant-numeric: tabular-nums; }
    .bar-bg { height: 7px; background: #0D0D0D; border-radius: 4px; overflow: hidden; border: 1px solid #1A1A1A; }
    .bar-fill { height: 100%; border-radius: 4px; width: 0; transition: width 0.08s linear; }
    .bar-thr { background: linear-gradient(90deg, #1A6B35, #27AE60); }
    .bar-brk { background: linear-gradient(90deg, #7B1414, #E74C3C); }
    .bar-clt { background: linear-gradient(90deg, #1A3A7B, #3B82F6); }
    .bar-hbk { background: linear-gradient(90deg, #7B5A00, #F39C12); }
    .steer-section { margin-top: 10px; }
    .steer-track {
      height: 7px; background: #0D0D0D;
      border-radius: 4px; position: relative;
      border: 1px solid #1A1A1A; margin-top: 4px;
    }
    .steer-center {
      position: absolute; top: -2px; left: 50%;
      width: 1px; height: 11px; background: #2A2A2A;
      transform: translateX(-50%);
    }
    .steer-pip {
      position: absolute; top: 1px;
      width: 5px; height: 5px; border-radius: 50%;
      background: #C0392B; left: 50%;
      transform: translateX(-50%);
      transition: left 0.08s linear;
    }

    /* SESSION */
    .btn {
      padding: 7px 18px; border-radius: 4px;
      font-size: 10px; font-weight: 700; cursor: pointer;
      transition: background 0.2s; letter-spacing: 2px;
      text-transform: uppercase; border: none;
      font-family: inherit;
    }
    .btn-primary { background: #C0392B; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #E74C3C; }
    .btn-primary:disabled { background: #1A1A1A; color: #2A2A2A; cursor: not-allowed; }
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 11px;
      color: #555;
      letter-spacing: 1px;
    }
    .footer a {
      color: #888;
      text-decoration: none;
    }
    .footer a:hover {
      color: #C0392B;
    }

    /* MINIMAP */
    #minimap-canvas {
      display: block;
      width: 100%;
      flex: 1;
      min-height: 0;
      border-radius: 6px;
      background: #0D0D0D;
      border: 1px solid #1A1A1A;
    }

    /* OVERLAYS */
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      z-index: 200; display: flex; align-items: center; justify-content: center;
    }
    .overlay.hidden { display: none; }
    .drawer {
      background: #111; border: 1px solid #1E1E1E; border-radius: 10px;
      width: min(480px,94vw); max-height: 85vh; display: flex; flex-direction: column;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6);
    }
    .viewer {
      background: #111; border: 1px solid #1E1E1E; border-radius: 10px;
      width: min(740px,96vw); max-height: 92vh; display: flex; flex-direction: column;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6);
    }
    .drawer-head, .viewer-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #1E1E1E;
      font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    }
    .close-btn {
      background: none; border: none; color: #555; font-size: 18px; cursor: pointer;
    }
    .close-btn:hover { color: #E74C3C; }
    .sessions-list { flex:1; overflow-y:auto; padding: 8px; }
    .session-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; margin: 4px 0; border-radius: 6px;
      background: #0D0D0D; border: 1px solid #1A1A1A; cursor: pointer;
      transition: border-color 0.15s;
    }
    .session-row:hover { border-color: #C0392B; }
    .session-row .s-left { display:flex; flex-direction:column; gap:2px; }
    .session-row .s-id { font-size: 11px; color: #C0392B; font-weight: 700; }
    .session-row .s-date { font-size: 10px; color: #555; }
    .session-row .s-right { text-align: right; }
    .session-row .s-meta { font-size: 10px; color: #888; }
    .session-row .s-lap { font-size: 12px; color: #27AE60; font-weight: 700; }

    .viewer-tabs {
      display: flex; gap: 2px; padding: 6px 14px 0; border-bottom: 1px solid #1E1E1E;
    }
    .vtab {
      background: none; border: none; border-bottom: 2px solid transparent;
      color: #555; padding: 8px 14px; font-size: 11px; font-weight: 700;
      letter-spacing: 1.5px; cursor: pointer; text-transform: uppercase;
    }
    .vtab.active { color: #C0392B; border-bottom-color: #C0392B; }
    .viewer-body { flex:1; overflow-y:auto; padding: 12px; }
    .v-panel.hidden { display: none; }
    .v-stats {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
      margin-bottom: 14px;
    }
    .v-stat {
      background: #0D0D0D; border: 1px solid #1A1A1A; border-radius: 6px;
      padding: 10px; text-align: center;
    }
    .v-stat .vsl { font-size: 8px; color: #fff; text-transform: uppercase; letter-spacing: 2px; }
    .v-stat .vsv { font-size: 18px; font-weight: 700; color: #fff; margin-top: 2px; }
    .v-chart { display: block; width: 100%; margin-bottom: 10px; border-radius: 4px; background: #0D0D0D; }

    .replay-controls {
      display: flex; align-items: center; gap: 10px; margin-top: 12px;
      padding: 8px 12px; background: #0D0D0D; border: 1px solid #1A1A1A; border-radius: 6px;
    }
    #replay-play {
      background: #C0392B; color: #fff; border: none;
      width: 36px; height: 36px; border-radius: 50%;
      font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    #replay-play:hover { background: #E74C3C; }
    #replay-slider { accent-color: #C0392B; }
    #replay-time { font-size: 12px; color: #fff; font-variant-numeric: tabular-nums; min-width: 50px; text-align: right; }

    .btn-secondary {
      background: #1A1A1A; color: #888; border: 1px solid #2A2A2A;
    }
    .btn-secondary:hover { background: #222; color: #fff; }
    .mode-seg { display:flex; background:#0D0D0D; border:1px solid #2A2A2A; border-radius:4px; overflow:hidden; }
    .mode-seg-btn { padding:6px 14px; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; border:none; background:transparent; color:#555; cursor:pointer; font-family:inherit; transition:background 0.15s,color 0.15s; }
    .mode-seg-btn:hover { color:#888; }
    .mode-seg-btn.seg-active { background:#C0392B; color:#fff; }
    #free-roam-rec-btn { display:none; padding:6px 14px; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; border:1px solid #2A2A2A; border-radius:4px; cursor:pointer; font-family:inherit; background:#1A1A1A; color:#888; transition:background 0.15s,color 0.15s; }
    #free-roam-rec-btn.recording { background:#C0392B; color:#fff; border-color:#C0392B; animation:rec-pulse 1.4s ease-in-out infinite; }
    @keyframes rec-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,0.5)} 50%{box-shadow:0 0 0 5px rgba(192,57,43,0)} }
  </style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 866.7 388.2" style="height:28px;display:block;" aria-label="Forza">
      <path fill="#ffffff" d="M397.4,279.9l113-17.1l85-126.4H472.8c-0.5,0-0.7,0.4-0.3,0.7c0.2,0.1,0.5,0.3,0.5,0.3c5.1,2.4,13.5,10-2.5,33.8L397.4,279.9z"/>
      <path fill="#ffffff" d="M618.4,136.5H604c-0.5,0-0.7,0.4-0.3,0.7c0.2,0.1,0.5,0.3,0.5,0.3c5.1,2.4,13.5,10-2.5,33.8l-57.9,86l-0.3,0.5l76.1-11.6c8.1-1.4,15.3-3.6,21.7-7.1c21.3-11.6,35.6-28.9,48.8-48.4l36.5-54.3H618.4V136.5z"/>
      <path fill="#ffffff" d="M251.2,302l113.1-17.1l99.9-148.5H12c-2.2,0-3.6,0.8-3.6,2.5c0,1.3,0.9,2.3,3.6,2.7l313.1,50.6L251.2,302z"/>
      <polygon fill="#ffffff" points="136.8,184.6 0,388.2 182,360.6 283.4,209.9"/>
      <path fill="#ffffff" d="M399,0h-59.5C296,2,264.3,17.6,238.6,38.3c-19.5,15.7-35.8,35-50.4,55.5l-13.1,19.5h523.3c30.7-1.3,54-7.6,75.3-19.2c34.4-18.6,59.7-45.9,81.3-76.7L866.7,0C861.6,0,399,0,399,0z"/>
    </svg>
    <span style="font-size:15px;font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;">TELEMETRY</span>
  </div>
  <div class="header-center">
    <div id="session-info">No active session</div>
  </div>
  <div class="header-right">
    <div class="mode-seg">
      <button class="mode-seg-btn seg-active" id="mode-race-btn" data-mode="race">Race</button>
      <button class="mode-seg-btn" id="mode-freeroam-btn" data-mode="freeRoam">Free Roam</button>
    </div>
    <button id="free-roam-rec-btn">&#11044; Rec</button>
    <button id="sessions-btn" class="btn btn-secondary">Sessions</button>
    <button id="export-btn" class="btn btn-primary" disabled>Export</button>
    <button id="export-compact-btn" class="btn btn-primary" disabled style="background:#1A6B35;">Compact</button>
    <div id="status"><span class="dot" id="status-dot"></span>Waiting</div>
    <div id="no-data-warn" style="display:none;font-size:10px;color:#F39C12;letter-spacing:1px;text-transform:uppercase;margin-left:8px;">No UDP data</div>
  </div>
</div>

<div class="main">

  <!-- LEFT COLUMN: Speed+Engine (grows) + Tire/Inputs row -->
  <div class="left-col">

    <div class="card">
      <div class="card-title">Speed & Engine</div>
      <svg class="speedo-svg" viewBox="0 0 220 155" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spd-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#E74C3C"/>
            <stop offset="100%" stop-color="#FF6B35"/>
          </linearGradient>
        </defs>
        <circle cx="110" cy="130" r="95" fill="none" stroke="#1A1A1A" stroke-width="13"
          stroke-dasharray="447.7 596.9" transform="rotate(135 110 130)"/>
        <circle id="speed-arc" cx="110" cy="130" r="95" fill="none"
          stroke="url(#spd-grad)" stroke-width="13" stroke-linecap="round"
          stroke-dasharray="0 596.9" transform="rotate(135 110 130)"/>
        <text x="16"  y="140" fill="#aaa" font-size="8" font-family="monospace">0</text>
        <text x="62"  y="46"  fill="#aaa" font-size="8" font-family="monospace">100</text>
        <text x="148" y="46"  fill="#aaa" font-size="8" font-family="monospace">250</text>
        <text x="186" y="140" fill="#aaa" font-size="8" font-family="monospace">350</text>
        <text id="speed" x="110" y="116" text-anchor="middle"
          font-size="52" font-weight="900" fill="#fff" font-family="monospace">0</text>
        <text x="110" y="133" text-anchor="middle"
          font-size="9" fill="#ccc" letter-spacing="3" font-family="monospace">KM/H</text>
      </svg>
      <div class="instruments">
        <div>
          <div class="instr-label">RPM</div>
          <svg viewBox="0 0 100 58" style="width:100%;max-width:110px;display:block;margin:0 auto;">
            <circle cx="50" cy="52" r="40" fill="none" stroke="#1A1A1A" stroke-width="9"
              stroke-dasharray="125.7 251.3" transform="rotate(180 50 52)"/>
            <circle id="rpm-bar" cx="50" cy="52" r="40" fill="none" stroke="#E74C3C" stroke-width="9"
              stroke-linecap="round" stroke-dasharray="0 251.3" transform="rotate(180 50 52)"/>
            <text id="rpm" x="50" y="46" text-anchor="middle"
              font-size="13" font-weight="700" fill="#fff" font-family="monospace">0</text>
            <text x="50" y="56" text-anchor="middle" font-size="6" fill="#ccc" letter-spacing="1" font-family="monospace">RPM</text>
          </svg>
        </div>
        <div>
          <div class="instr-label">Gear</div>
          <div class="gear-ring"><span id="gear">N</span></div>
        </div>
        <div>
          <div class="instr-label">Power</div>
          <svg viewBox="0 0 100 58" style="width:100%;max-width:110px;display:block;margin:0 auto;">
            <circle cx="50" cy="52" r="40" fill="none" stroke="#1A1A1A" stroke-width="9"
              stroke-dasharray="125.7 251.3" transform="rotate(180 50 52)"/>
            <circle id="power-bar" cx="50" cy="52" r="40" fill="none" stroke="#3B82F6" stroke-width="9"
              stroke-linecap="round" stroke-dasharray="0 251.3" transform="rotate(180 50 52)"/>
            <text id="power" x="50" y="46" text-anchor="middle"
              font-size="13" font-weight="700" fill="#fff" font-family="monospace">0</text>
            <text x="50" y="56" text-anchor="middle" font-size="6" fill="#ccc" letter-spacing="1" font-family="monospace">KW</text>
          </svg>
        </div>
      </div>
    </div>

    <div class="bottom-row">

      <!-- TIRE TEMPS -->
      <div class="card">
        <div class="card-title">Tire Temps</div>
        <div class="tire-grid">
          <div class="tire-slot fl">
            <span class="tire-lbl">FL</span>
            <div id="temp-fl-bar" class="tire"></div>
            <span id="temp-fl" class="tire-val">--</span>
          </div>
          <svg class="car-body" viewBox="0 0 56 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="44" height="98" rx="10" fill="#1A1A1A" stroke="#2A2A2A" stroke-width="1"/>
            <rect x="12" y="14" width="32" height="22" rx="4" fill="#141414"/>
            <rect x="14" y="58" width="28" height="18" rx="3" fill="#141414"/>
          </svg>
          <div class="tire-slot fr">
            <span class="tire-lbl">FR</span>
            <div id="temp-fr-bar" class="tire"></div>
            <span id="temp-fr" class="tire-val">--</span>
          </div>
          <div class="tire-slot rl">
            <span class="tire-lbl">RL</span>
            <div id="temp-rl-bar" class="tire"></div>
            <span id="temp-rl" class="tire-val">--</span>
          </div>
          <div></div>
          <div class="tire-slot rr">
            <span class="tire-lbl">RR</span>
            <div id="temp-rr-bar" class="tire"></div>
            <span id="temp-rr" class="tire-val">--</span>
          </div>
        </div>
      </div>

      <!-- DRIVER INPUTS -->
      <div class="card">
        <div class="card-title">Driver Inputs</div>
        <div class="inputs-grid">
          <div class="input-row">
            <div class="input-header">
              <span class="input-lbl">Throttle</span>
              <span id="throttle" class="input-val" style="color:#27AE60">0%</span>
            </div>
            <div class="bar-bg"><div id="throttle-bar" class="bar-fill bar-thr"></div></div>
          </div>
          <div class="input-row">
            <div class="input-header">
              <span class="input-lbl">Brake</span>
              <span id="brake" class="input-val" style="color:#E74C3C">0%</span>
            </div>
            <div class="bar-bg"><div id="brake-bar" class="bar-fill bar-brk"></div></div>
          </div>
          <div class="input-row">
            <div class="input-header">
              <span class="input-lbl">Clutch</span>
              <span id="clutch" class="input-val" style="color:#3B82F6">0%</span>
            </div>
            <div class="bar-bg"><div id="clutch-bar" class="bar-fill bar-clt"></div></div>
          </div>
          <div class="input-row">
            <div class="input-header">
              <span class="input-lbl">Handbrake</span>
              <span id="handbrake" class="input-val" style="color:#F39C12">0%</span>
            </div>
            <div class="bar-bg"><div id="handbrake-bar" class="bar-fill bar-hbk"></div></div>
          </div>
        </div>
        <div class="steer-section">
          <div class="input-header">
            <span class="input-lbl">Steering</span>
            <span id="steer" class="input-val" style="color:#555">0</span>
          </div>
          <div class="steer-track">
            <div class="steer-center"></div>
            <div id="steer-pip" class="steer-pip"></div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- RIGHT COLUMN: Race Info (fixed) + Track Map (grows) -->
  <div class="right-col">

    <!-- RACE INFO -->
    <div class="card">
      <div class="card-title">Race Info</div>
      <div id="lap-time">--:--.---</div>
      <div id="lap-best">BEST &nbsp;--:--.---</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Lap</span>
          <span id="lap-num" class="info-value">-</span>
        </div>
        <div class="info-item">
          <span class="info-label">Position</span>
          <span id="position" class="info-value">-</span>
        </div>
        <div class="info-item">
          <span class="info-label">Fuel</span>
          <span id="fuel" class="info-value">-</span>
        </div>
        <div class="info-item">
          <span class="info-label">Boost</span>
          <span id="boost" class="info-value">-</span>
        </div>
      </div>
    </div>

    <!-- TRACK MAP -->
    <div class="card minimap-card" id="minimap-card">
      <div class="card-title">TRACK MAP <span id="map-status" style="color:#27AE60;font-size:8px;">● LIVE</span></div>
      <canvas id="minimap-canvas" width="700" height="394"></canvas>
    </div>

  </div>

</div>

<!-- SESSIONS DRAWER -->
<div id="sessions-overlay" class="overlay hidden">
  <div class="drawer">
    <div class="drawer-head">
      <span>Sessions</span>
      <button id="close-drawer" class="close-btn">✕</button>
    </div>
    <div id="sessions-list" class="sessions-list">Loading...</div>
  </div>
</div>

<!-- SESSION VIEWER -->
<div id="viewer-overlay" class="overlay hidden">
  <div class="viewer">
    <div class="viewer-head">
      <span id="viewer-title">Session</span>
      <button id="close-viewer" class="close-btn">✕</button>
    </div>
    <div class="viewer-tabs">
      <button class="vtab active" data-tab="charts">Charts</button>
      <button class="vtab" data-tab="replay-map">Replay Map</button>
    </div>
    <div class="viewer-body" id="viewer-body">
      <div id="v-charts" class="v-panel">
        <div id="v-stats" class="v-stats"></div>
        <canvas id="chart-speed" width="680" height="160"></canvas>
        <canvas id="chart-rpm" width="680" height="160"></canvas>
        <canvas id="chart-temps" width="680" height="160"></canvas>
        <canvas id="chart-inputs" width="680" height="160"></canvas>
      </div>
      <div id="v-map" class="v-panel hidden">
        <canvas id="replay-map-canvas" width="680" height="480"></canvas>
        <div class="replay-controls">
          <button id="replay-play">▶</button>
          <input type="range" id="replay-slider" min="0" max="100" value="0" style="flex:1;">
          <span id="replay-time">0:00</span>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
  var createTelemetryStore = ${createTelemetryStore.toString()};
  var effectiveTimeline = ${effectiveTimeline.toString()};
  var selectTelemetry = ${selectTelemetry.toString()};
  var createPageController = ${createPageController.toString()};
  var createClusterBindings = ${createClusterBindings.toString()};
  var VEHICLE_MODEL_BY_ORDINAL = ${JSON.stringify(VEHICLE_MODEL_BY_ORDINAL)};
  var VEHICLE_METADATA_BY_ORDINAL = ${JSON.stringify(VEHICLE_METADATA_BY_ORDINAL)};
  var VEHICLE_THEME_BY_ORDINAL = ${JSON.stringify(VEHICLE_THEME_BY_ORDINAL)};
  var VEHICLE_THEME_PRESENTATIONS = ${JSON.stringify(VEHICLE_THEME_PRESENTATIONS)};
  var DEFAULT_THEME_ID = '${DEFAULT_THEME_ID}';
  var MANUAL_THEME_OPTIONS = ${JSON.stringify(Object.values(THEME_REGISTRY).map(theme => ({ id: theme.id, eraId: theme.eraId, eraLabel: theme.era.range, regionId: theme.regionId, regionLabel: theme.region.label })))};
  var mountManualThemeButtonSet = ${createManualThemeButtonSet.toString()};
  var lookupVehicleModel = ${lookupVehicleModel.toString()};
  var lookupVehicleMetadata = function(carOrdinal) {
    var key = Number.isFinite(Number(carOrdinal)) ? String(Number(carOrdinal)) : '';
    return VEHICLE_METADATA_BY_ORDINAL[key] || null;
  };
  var resolveVehicleTheme = function(vehicle, options) {
    var ordinal = Number(vehicle && vehicle.ordinal);
    var key = Number.isSafeInteger(ordinal) ? String(ordinal) : '';
    var resolved = VEHICLE_THEME_BY_ORDINAL[key] || { themeId:'${DEFAULT_THEME_ID}', eraId:'y2015_2019', regionId:'europe', powertrain:'unknown', resolved:false, fallback:true };
    var driveMode = options && options.driveMode;
    return { ...resolved, modeOverlay: driveMode === 'race' || driveMode === 'freeRoam' ? driveMode : null };
  };
  var applyClusterVehicleTheme = function(root, context) {
    var key = (context.themeId || '${DEFAULT_THEME_ID}') + '|' + (context.driveMode || 'race') + '|' + (context.powertrain || 'combustion');
    var resolved = VEHICLE_THEME_PRESENTATIONS[key] || VEHICLE_THEME_PRESENTATIONS['${DEFAULT_THEME_ID}|race|combustion'];
    var tokenNames = { surface:'--theme-surface', panel:'--theme-panel', ink:'--theme-ink', muted:'--theme-muted', metal:'--theme-metal', grid:'--theme-grid', glow:'--theme-glow', accent:'--theme-accent', accentStrong:'--theme-accent-strong', modeAccent:'--theme-mode-accent', modeAccentStrong:'--theme-mode-accent-strong', cool:'--theme-cool', displayAccent:'--theme-display-accent', displayCool:'--theme-display-cool' };
    Object.keys(tokenNames).forEach(function(name) {
      var value = resolved.tokens[name];
      if (typeof value === 'string') root.style.setProperty(tokenNames[name], value);
      else root.style.removeProperty(tokenNames[name]);
    });
    root.dataset.themeId = resolved.themeId;
    root.dataset.themeEra = resolved.era;
    root.dataset.themeRegion = resolved.region;
    root.dataset.driveMode = resolved.mode;
    root.dataset.powertrain = resolved.powertrain;
    root.dataset.displayOverride = resolved.displayOverride;
    root.dataset.displayPowerAvailable = String(resolved.displayPowerAvailable);
    root.dataset.displayRegenAvailable = String(resolved.displayRegenAvailable);
    root.dataset.displaySocAvailable = String(resolved.displaySocAvailable);
    root.dataset.displayEnergyAvailable = String(resolved.displayEnergyAvailable);
    root.dataset.themeDial = resolved.visual.dial;
    root.dataset.themeBezel = resolved.visual.bezel;
    root.dataset.themeTypography = resolved.visual.typography;
    root.dataset.themeMotion = resolved.visual.motion;
    root.dataset.themeDensity = resolved.visual.density;
    root.dataset.themeSilhouette = resolved.visual.silhouette;
    root.dataset.themeContrast = resolved.visual.contrast;
    root.dataset.themeInformationDensity = resolved.visual.informationDensity;
    root.dataset.themeTickWeight = resolved.visual.tickWeight;
    return resolved;
  };
  var createVehicleStateController = ${createVehicleStateController.toString()};
  var createRpmGaugeController = (function() { var niceRpmScale = ${niceRpmScale.toString()}; return ${createRpmGaugeController.toString()}; })();
  var createUIAnimationCoordinator = ${createUIAnimationCoordinator.toString()};
  var createJdm90Instrument = ${createJdm90Instrument.toString()};
  var createClassicalEuropeInstrument = ${createClassicalEuropeInstrument.toString()};
  var createRetroDigitalAmericaInstrument = ${createRetroDigitalAmericaInstrument.toString()};
  var createEarly911EuropeInstrument = ${createEarly911EuropeInstrument.toString()};
  var createRx8JapanInstrument = ${createRx8JapanInstrument.toString()};
  var createC8AmericaInstrument = ${createC8AmericaInstrument.toString()};
  var createBelairAmericaInstrument = ${createBelairAmericaInstrument.toString()};
  var createAe86JapanInstrument = ${createAe86JapanInstrument.toString()};
  var createR8EuropeInstrument = ${createR8EuropeInstrument.toString()};
  var createS30JapanInstrument = ${createS30JapanInstrument.toString()};
  var createDsEuropeInstrument = ${createDsEuropeInstrument.toString()};
  var createLfaJapanInstrument = ${createLfaJapanInstrument.toString()};
  var createCxEuropeInstrument = ${createCxEuropeInstrument.toString()};
  var createFordGtAmericaInstrument = ${createFordGtAmericaInstrument.toString()};
  var createTaycanEuropeInstrument = ${createTaycanEuropeInstrument.toString()};
  var createPanoramicEuropeInstrument = ${createPanoramicEuropeInstrument.toString()};
  var createModernInstrumentBinding = ${createModernInstrumentBinding.toString()};
  var createCivicJapanInstrument = ${createCivicJapanInstrument.toString()};
  var createEscaladeAmericaInstrument = ${createEscaladeAmericaInstrument.toString()};
  var createGxJapanInstrument = ${createGxJapanInstrument.toString()};
  var createInstrumentThemeHost = ${createInstrumentThemeHost.toString()};
  var createShiftLightController = ${createShiftLightController.toString()};
  var createRaceFeedbackController = ${createRaceFeedbackController.toString()};
  var DEFAULT_CALIBRATION = ${JSON.stringify(DEFAULT_CALIBRATION)};
  var isFinitePair = function(value) { return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite); };
  var validateCalibration = ${validateCalibration.toString()};
  var createWorldToMap = ${createWorldToMap.toString()};
  var finite = Number.isFinite;
  var makeBounds = function() { return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }; };
  var publicBounds = function(bounds) { return finite(bounds.minX) ? { minX:Object.is(bounds.minX,-0)?0:bounds.minX, minZ:Object.is(bounds.minZ,-0)?0:bounds.minZ, maxX:Object.is(bounds.maxX,-0)?0:bounds.maxX, maxZ:Object.is(bounds.maxZ,-0)?0:bounds.maxZ } : null; };
  var updateBounds = function(bounds, point) { bounds.minX=Math.min(bounds.minX,point.x); bounds.minZ=Math.min(bounds.minZ,point.z); bounds.maxX=Math.max(bounds.maxX,point.x); bounds.maxZ=Math.max(bounds.maxZ,point.z); };
  var createTrackBuffer = ${createTrackBuffer.toString()};
  var normalizePoint = function(point) { var lat=Array.isArray(point)?point[0]:point&&point.lat; var lng=Array.isArray(point)?point[1]:point&&point.lng; return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:null; };
  var positive = function(value,fallback) { return Number.isFinite(value)&&value>=0?value:fallback; };
  var cloneBounds = function(bounds) { return bounds?{southWest:[...bounds.southWest],northEast:[...bounds.northEast],count:bounds.count}:null; };
  var createMapCameraController = ${createMapCameraController.toString()};
  var createLeafletAdapter = ${createLeafletAdapter.toString()};
  var createLiveDeltaTracker = (function() {
    var finiteDeltaValue = ${finiteDeltaValue.toString()};
    var finite = finiteDeltaValue;
    var unavailableDelta = ${unavailableDelta.toString()};
    var unavailable = unavailableDelta;
    var readDeltaProgress = ${readDeltaProgress.toString()};
    var readProgress = readDeltaProgress;
    var readDeltaTime = ${readDeltaTime.toString()};
    var readTime = readDeltaTime;
    var buildGhostReference = ${buildGhostReference.toString()};
    var interpolateGhostTime = ${interpolateGhostTime.toString()};
    var LiveDeltaTracker = ${LiveDeltaTracker.toString()};
    return ${createLiveDeltaTracker.toString()};
  })();
  var createRouteUIController = ${createRouteUIController.toString()};
  var telemetryStore = createTelemetryStore(function(err) { console.error('Telemetry subscriber:', err); });
  var sessionId = null;
  var SPEEDO_ARC = 447.7, SPEEDO_CIRC = 596.9, MAX_SPD = 350;
  var HALF_ARC = 125.7, HALF_CIRC = 251.3;
  var MAX_RPM = 10000, MAX_PWR = 600000;

  function fmt(ms) {
    if (!ms || ms <= 0) return '--:--.---';
    var s = ms / 1000, m = Math.floor(s / 60), sec = Math.floor(s % 60), mil = Math.floor((s % 1) * 1000);
    return p2(m) + ':' + p2(sec) + '.' + p3(mil);
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function p3(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }

  function tcls(t) {
    if (t == null) return '';
    return t < 70 ? 'cool' : t < 90 ? 'warm' : 'hot';
  }

  function setArc(id, val, max, arcLen, circ) {
    var el = document.getElementById(id);
    if (!el) return;
    var f = Math.min(1, Math.max(0, val / max));
    el.setAttribute('stroke-dasharray', (arcLen * f).toFixed(1) + ' ' + circ);
  }

  function setBar(id, pct) {
    var el = document.getElementById(id);
    if (el) el.style.width = Math.min(100, Math.max(0, pct)).toFixed(1) + '%';
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function updateTire(barId, valId, temp) {
    var cls = tcls(temp);
    var bar = document.getElementById(barId);
    var val = document.getElementById(valId);
    if (bar) bar.className = 'tire' + (cls ? ' ' + cls : '');
    if (val) {
      val.textContent = temp != null ? temp.toFixed(0) + '°C' : '--';
      val.className = 'tire-val' + (cls ? ' ' + cls : '');
    }
  }

  // ── Map calibration (FH6 Japan) ───────────────────────────────────
  // Two reference points map game world (positionX, positionZ) →
  // full-resolution tile pixels (zoom 14, tile range 8128-8191 × 256px).
  // Source: fh6-tel reference project (mapDefaults.ts).
  var _calAWX=-119.49154, _calAWZ=3888.595, _calAPX=2089486, _calAPY=2087415;
  var _calBWX=-7104.7695, _calBWZ=-1863.08,  _calBPX=2086885, _calBPY=2089556;
  var _tileMin=8128*256, _tileRange=64*256; // 2080768, 16384
  var _mX=(_calBPX-_calAPX)/(_calBWX-_calAWX), _bX=_calAPX-_mX*_calAWX;
  var _mZ=(_calBPY-_calAPY)/(_calBWZ-_calAWZ), _bY=_calAPY-_mZ*_calAWZ;

  function worldToCanvas(worldX, worldZ, cw, ch) {
    var fx = (_mX*worldX+_bX-_tileMin)/_tileRange;
    var fy = (_mZ*worldZ+_bY-_tileMin)/_tileRange;
    return [fx*cw, fy*ch];
  }

  var liveTrail = [];
  var mapW = 700, mapH = 394;
  var mapCtx = null;
  var prevRaceOn = false;
  var frameCount = 0;

  var _mapImg = new Image();
  var _mapImgLoaded = false;
  _mapImg.onload = function() { _mapImgLoaded = true; _drawMapBg(); };
  _mapImg.src = '/assets/map/venus.png';

  (function() {
    var c = document.getElementById('minimap-canvas');
    if (c) { mapCtx = c.getContext('2d'); _drawMapBg(); }
  })();

  function _drawMapBg(ctx, w, h) {
    ctx = ctx || mapCtx; w = w || mapW; h = h || mapH;
    if (!ctx) return;
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    if (_mapImgLoaded) {
      ctx.globalAlpha = 0.82;
      ctx.drawImage(_mapImg, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }
  }

  function _drawArrow(ctx, cx, cy, yaw) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(yaw);
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(5.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-5.5, 7);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function updateMapTrail(d) {
    if (clientDriveMode === 'freeRoam') return;
    if (!mapCtx || (!d.positionX && !d.positionZ)) return;
    if (d.isRaceOn && !prevRaceOn) { liveTrail = []; frameCount = 0; }
    prevRaceOn = d.isRaceOn;
    if (!d.isRaceOn) return;
    frameCount++;
    if (frameCount % 3 !== 0 && liveTrail.length > 0) return;
    liveTrail.push({ x: d.positionX, z: d.positionZ, yaw: d.yaw || 0, lap: d.lapNumber });

    _drawMapBg();
    var ctx = mapCtx;
    if (liveTrail.length >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      var curLap = liveTrail[0].lap;
      var p0 = worldToCanvas(liveTrail[0].x, liveTrail[0].z, mapW, mapH);
      ctx.moveTo(p0[0], p0[1]);
      for (var i = 1; i < liveTrail.length; i++) {
        var pt = liveTrail[i];
        if (pt.lap !== curLap) {
          ctx.stroke(); curLap = pt.lap; ctx.beginPath();
          var pp = worldToCanvas(pt.x, pt.z, mapW, mapH); ctx.moveTo(pp[0], pp[1]);
        } else {
          var pp2 = worldToCanvas(pt.x, pt.z, mapW, mapH); ctx.lineTo(pp2[0], pp2[1]);
        }
      }
      ctx.stroke();
    }
    var lp = liveTrail[liveTrail.length - 1];
    var cp = worldToCanvas(lp.x, lp.z, mapW, mapH);
    _drawArrow(ctx, cp[0], cp[1], lp.yaw);
  }

  // ── Session List ──────────────────────────────────────────────────
  var sessionsCache = [];

  document.getElementById('sessions-btn').addEventListener('click', function() {
    document.getElementById('sessions-overlay').classList.remove('hidden');
    loadSessions();
  });
  document.getElementById('close-drawer').addEventListener('click', function() {
    document.getElementById('sessions-overlay').classList.add('hidden');
  });
  document.getElementById('close-viewer').addEventListener('click', function() {
    document.getElementById('viewer-overlay').classList.add('hidden');
  });

  document.querySelectorAll('.vtab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.vtab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.dataset.tab;
      document.getElementById('v-charts').classList.toggle('hidden', tab !== 'charts');
      document.getElementById('v-map').classList.toggle('hidden', tab !== 'replay-map');
      if (tab === 'replay-map' && currentViewerPackets) drawReplayMap(currentViewerPackets, 0);
    });
  });

  function loadSessions() {
    fetch('/sessions').then(function(r) { return r.json(); }).then(function(list) {
      sessionsCache = list;
      var el = document.getElementById('sessions-list');
      if (!list.length) { el.innerHTML = '<div style="color:#555;text-align:center;padding:40px;">No sessions recorded yet.</div>'; return; }
      el.innerHTML = list.map(function(s) {
        var bl = s.bestLap && s.bestLap > 0 ? (s.bestLap/1000).toFixed(3) : null;
        return '<div class="session-row" data-id="'+s.id+'">'
          + '<div class="s-left"><span class="s-id">Session #'+s.id+'</span><span class="s-date">'+new Date(s.startedAt).toLocaleString()+'</span></div>'
          + '<div class="s-right"><div class="s-meta">'+s.packetCount+' pkts &middot; '+s.lapCount+' laps</div>'
          + (bl ? '<div class="s-lap">Best '+bl+'s</div>' : '')
          + '</div></div>';
      }).join('');
      el.querySelectorAll('.session-row').forEach(function(row) {
        row.addEventListener('click', function() { openSessionViewer(parseInt(row.dataset.id)); });
      });
    });
  }

  var currentViewerPackets = null;
  var replayTimer = null;

  function openSessionViewer(id) {
    document.getElementById('sessions-overlay').classList.add('hidden');
    document.getElementById('viewer-overlay').classList.remove('hidden');
    document.getElementById('viewer-title').textContent = 'Session #' + id;
    fetch('/session?id=' + id).then(function(r) { return r.json(); }).then(function(data) {
      data.packets = effectiveTimeline(data.packets || []);
      currentViewerPackets = data.packets;
      document.getElementById('replay-slider').max = data.packets.length - 1;
      drawCharts(data);
      document.querySelector('.vtab[data-tab="charts"]').click();
    });
  }

  function drawCharts(data) {
    var pkts = data.packets;
    // Stats
    var maxRpm = 0, maxSpeed = 0, maxPower = 0;
    pkts.forEach(function(p) {
      if (p.currentEngineRpm > maxRpm) maxRpm = p.currentEngineRpm;
      if (p.speedKmh > maxSpeed) maxSpeed = p.speedKmh;
      if (p.power > maxPower) maxPower = p.power;
    });
    var el = document.getElementById('v-stats');
    var blap = data.bestLap && data.bestLap > 0 ? (data.bestLap).toFixed(3)+'s' : 'N/A';
    el.innerHTML = '<div class="v-stat"><div class="vsl">Max Speed</div><div class="vsv">'+Math.round(maxSpeed)+' km/h</div></div>'
      + '<div class="v-stat"><div class="vsl">Max RPM</div><div class="vsv">'+Math.round(maxRpm)+'</div></div>'
      + '<div class="v-stat"><div class="vsl">Max Power</div><div class="vsv">'+Math.round(maxPower/1000)+' kW</div></div>'
      + '<div class="v-stat"><div class="vsl">Best Lap</div><div class="vsv">'+blap+'</div></div>';

    drawLineChart('chart-speed', pkts, function(p) { return p.speedKmh; }, '#3b82f6', 'Speed (km/h)');
    drawLineChart('chart-rpm', pkts, function(p) { return p.currentEngineRpm; }, '#a855f7', 'RPM');
    drawLineChart('chart-temps', pkts, [
      {fn: function(p) { return p.tireTempFl; }, color: '#60a5fa'},
      {fn: function(p) { return p.tireTempFr; }, color: '#f87171'},
      {fn: function(p) { return p.tireTempRl; }, color: '#34d399'},
      {fn: function(p) { return p.tireTempRr; }, color: '#fbbf24'},
    ]);
    drawLineChart('chart-inputs', pkts, [
      {fn: function(p) { return p.throttle/255*100; }, color: '#22c55e'},
      {fn: function(p) { return p.brake/255*100; }, color: '#ef4444'},
    ]);
  }

  function drawLineChart(canvasId, pkts, series, colorOrLabel, labelOverride) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    el.style.width = '100%';
    var ctx = el.getContext('2d');
    var w = el.clientWidth || 680, h = 160;
    el.width = w; el.height = h;
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1;
    for (var gy = 0; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke(); }
    ctx.fillStyle = '#444';
    ctx.font = '9px monospace';
    ctx.fillText(labelOverride || '', 8, 14);

    var seriesArr = Array.isArray(series) ? series : [{fn: series, color: colorOrLabel}];
    seriesArr.forEach(function(s) {
      var vals = pkts.map(s.fn);
      var mn = Infinity, mx = -Infinity;
      vals.forEach(function(v) { if (v < mn) mn = v; if (v > mx) mx = v; });
      if (mx - mn < 1) mx = mn + 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (var i = 0; i < vals.length; i++) {
        var x = (i / Math.max(1, vals.length-1)) * (w - 10) + 5;
        var y = h - 10 - ((vals[i] - mn) / (mx - mn)) * (h - 20);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  function drawReplayMap(pkts, idx) {
    var c = document.getElementById('replay-map-canvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = c.clientWidth || 680, h = Math.round(w * 475 / 844);
    c.width = w; c.height = h;

    _drawMapBg(ctx, w, h);

    var colors = ['#3b82f6','#eab308','#22c55e','#ef4444','#a855f7','#f59e0b','#06b6d4','#f97316'];
    ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    var curLap = -1, ci = 0;
    ctx.beginPath();
    for (var i = 0; i < pkts.length; i++) {
      var p = pkts[i];
      if (!p.positionX && !p.positionZ) continue;
      var pos = worldToCanvas(p.positionX, p.positionZ, w, h);
      if (p.lapNumber !== curLap || p.timelineBreak) {
        ctx.stroke();
        curLap = p.lapNumber;
        ctx.strokeStyle = colors[ci % colors.length]; ci++;
        ctx.beginPath(); ctx.moveTo(pos[0], pos[1]);
      } else {
        ctx.lineTo(pos[0], pos[1]);
      }
    }
    ctx.stroke();

    var cp = pkts[Math.min(idx, pkts.length - 1)];
    if (cp && (cp.positionX || cp.positionZ)) {
      var cpos = worldToCanvas(cp.positionX, cp.positionZ, w, h);
      _drawArrow(ctx, cpos[0], cpos[1], cp.yaw || 0);
    }
  }

  // Replay controls
  var replayPlaying = false, replayIdx = 0;
  document.getElementById('replay-play').addEventListener('click', function() {
    replayPlaying = !replayPlaying;
    this.textContent = replayPlaying ? '⏸' : '▶';
    if (replayPlaying) runReplay();
    else clearInterval(replayTimer);
  });
  document.getElementById('replay-slider').addEventListener('input', function() {
    replayIdx = parseInt(this.value);
    if (currentViewerPackets) {
      drawReplayMap(currentViewerPackets, replayIdx);
      document.getElementById('replay-time').textContent = formatReplayTime(replayIdx);
    }
  });

  function formatReplayTime(idx) {
    var s = (idx / 60).toFixed(0);
    return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0');
  }

  function runReplay() {
    clearInterval(replayTimer);
    replayTimer = setInterval(function() {
      if (!currentViewerPackets) return;
      if (replayIdx >= currentViewerPackets.length - 1) { replayIdx = 0; }
      replayIdx += 3;
      if (replayIdx >= currentViewerPackets.length) replayIdx = currentViewerPackets.length - 1;
      document.getElementById('replay-slider').value = replayIdx;
      document.getElementById('replay-time').textContent = formatReplayTime(replayIdx);
      drawReplayMap(currentViewerPackets, replayIdx);
    }, 100);
  }

  // ── SSE connection with error handling and watchdog ──────────────
  var lastSseDataMs = null;
  var noDataWarnTimer = null;
  var sseReconnectTimer = null;
  var NO_DATA_TIMEOUT_MS = 8000;

  function connectSSE() {
    if (window._es) { try { window._es.close(); } catch(e) {} }
    var es = new EventSource('/events');
    window._es = es;

    es.onerror = function() {
      var st = document.getElementById('status');
      st.className = 'sse-error';
      st.innerHTML = '<span class="dot error" id="status-dot"></span>SSE Disconnected';
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = setTimeout(function() { connectSSE(); }, 3000);
    };

    es.onopen = function() {
      fetch('/mode').then(function(r) { return r.json(); }).then(applyServerState).catch(console.error);
      var st = document.getElementById('status');
      if (st.classList.contains('sse-error')) {
        st.className = '';
        st.innerHTML = '<span class="dot" id="status-dot"></span>Waiting';
      }
    };

    es.onmessage = handleSSEMessage;
    es.addEventListener('state', function(e) {
      try { applyServerState(JSON.parse(e.data)); } catch (error) { console.error(error); }
    });
    return es;
  }

  function checkNoData() {
    var warn = document.getElementById('no-data-warn');
    if (!lastSseDataMs || Date.now() - lastSseDataMs > NO_DATA_TIMEOUT_MS) {
      if (warn) warn.style.display = 'block';
    } else {
      if (warn) warn.style.display = 'none';
    }
  }

  noDataWarnTimer = setInterval(checkNoData, 2000);

  // ── Drive Mode ───────────────────────────────────────────────────
  var clientDriveMode = 'race';
  var clientFreeRoamRecording = false;
  var serverVersion = -1;
  var animationCoordinator = null;
  var instrumentHost = null;
  var desiredDriveMode = clientDriveMode;
  var modeRequestInFlight = false;
  var latestVehicleMetadata = null;
  var latestVehicleState = null;
  var clientModeControl = 'auto';
  var policyRequestInFlight = false;
  var manualThemeChosen = false;
  var manualThemeId = DEFAULT_THEME_ID;
  try {
    clientModeControl = localStorage.getItem('fh6.clusterControlMode') === 'manual' ? 'manual' : 'auto';
    var savedManualTheme = localStorage.getItem('fh6.manualThemeId');
    if (MANUAL_THEME_OPTIONS.some(function(theme) { return theme.id === savedManualTheme; })) {
      manualThemeId = savedManualTheme;
      manualThemeChosen = true;
    }
  } catch (_) {}

  function syncControlModeUI() {
    var cluster = document.querySelector('.cluster-control-cluster');
    if (!cluster) return;
    cluster.dataset.controlMode = clientModeControl;
    cluster.dataset.pending = String(policyRequestInFlight);
    var auto = clientModeControl === 'auto';
    var autoButton = document.getElementById('control-auto-btn');
    var manualButton = document.getElementById('control-manual-btn');
    autoButton.classList.toggle('is-active', auto);
    manualButton.classList.toggle('is-active', !auto);
    autoButton.setAttribute('aria-pressed', String(auto));
    manualButton.setAttribute('aria-pressed', String(!auto));
    autoButton.disabled = policyRequestInFlight;
    manualButton.disabled = policyRequestInFlight;
    document.querySelectorAll('.mode-seg-btn').forEach(function(button) {
      button.disabled = auto || policyRequestInFlight;
      button.setAttribute('aria-disabled', String(auto || policyRequestInFlight));
    });
  }

  var themeButtonSet = mountManualThemeButtonSet({
    container: document.getElementById('manual-theme-button-set-mount'),
    options: MANUAL_THEME_OPTIONS,
    selectedId: manualThemeId,
    onChange: function(themeId) {
      if (clientModeControl !== 'manual' || !MANUAL_THEME_OPTIONS.some(function(theme) { return theme.id === themeId; })) return;
      manualThemeId = themeId;
      manualThemeChosen = true;
      try { localStorage.setItem('fh6.manualThemeId', manualThemeId); } catch (_) {}
      if (animationCoordinator) {
        animationCoordinator.wake(vehicleProfileFromState(latestVehicleState || { vehicle: {} }), clientDriveMode, applyThemeOverlay);
      } else applyVehicleTheme(clientDriveMode);
    }
  });
  syncControlModeUI();

  function applyVehicleTheme(mode) {
    var metadata = latestVehicleMetadata;
    var resolved = metadata ? resolveVehicleTheme(metadata, { driveMode: mode }) : { themeId: DEFAULT_THEME_ID, powertrain: 'unknown', eraId: 'y2015_2019', regionId: 'europe', resolved: false };
    var powertrain = resolved.powertrain === 'electric' ? 'ev'
      : resolved.powertrain === 'hybrid' ? 'hybrid' : 'combustion';
    var displayThemeId = clientModeControl === 'manual' ? manualThemeId : resolved.themeId;
    applyClusterVehicleTheme(document.getElementById('cluster'), {
      themeId: displayThemeId, driveMode: mode, powertrain: powertrain,
      capabilities: metadata && metadata.capabilities ? metadata.capabilities : {},
    });
    var root = document.getElementById('cluster');
    root.dataset.themeResolution = resolved.resolved ? 'resolved' : 'fallback';
    root.dataset.themeSource = clientModeControl === 'manual' ? 'manual' : metadata && metadata.source ? metadata.source : 'anchor';
    root.dataset.themeRegionSource = metadata && metadata.regionSource ? metadata.regionSource : 'unknown';
    root.dataset.themeRegionConfidence = metadata && metadata.regionConfidence ? metadata.regionConfidence : 'unknown';
    instrumentHost?.activate(displayThemeId);
    return displayThemeId;
  }

  function applyThemeOverlay(nextMode) {
    document.body.dataset.driveMode = nextMode;
    document.getElementById('mode-race-btn').classList.toggle('seg-active', nextMode === 'race');
    document.getElementById('mode-freeroam-btn').classList.toggle('seg-active', nextMode === 'freeRoam');
    document.getElementById('mode-race-btn').setAttribute('aria-pressed', String(nextMode === 'race'));
    document.getElementById('mode-freeroam-btn').setAttribute('aria-pressed', String(nextMode === 'freeRoam'));
    applyVehicleTheme(nextMode);
  }

  function vehicleProfileFromState(state) {
    var vehicle = state && state.vehicle ? state.vehicle : {};
    var metadata = lookupVehicleMetadata(vehicle.carOrdinal) || {};
    latestVehicleMetadata = metadata;
    var resolvedTheme = resolveVehicleTheme(metadata, { driveMode: clientDriveMode });
    if (!manualThemeChosen) {
      manualThemeId = resolvedTheme.themeId;
      themeButtonSet.update({ selectedId: manualThemeId });
      if (clientModeControl === 'manual') {
        manualThemeChosen = true;
        try { localStorage.setItem('fh6.manualThemeId', manualThemeId); } catch (_) {}
      }
    }
    var selectedThemeId = clientModeControl === 'manual' ? manualThemeId : resolvedTheme.themeId;
    var selectedThemeParts = selectedThemeId.split('.');
    var details = selectTelemetry({ ...vehicle, carId: vehicle.carOrdinal }, false);
    return {
      vehicle: vehicle,
      metadata: {
        brand: metadata.brand || 'BRAND UNKNOWN',
        modelName: metadata.model || metadata.name || lookupVehicleModel(vehicle.carOrdinal) || 'MODEL UNKNOWN',
        year: metadata.year,
        drivetrain: details.drivetrainLabel || 'DRIVETRAIN UNKNOWN',
        classPi: details.classLabel !== '—' && Number.isFinite(details.pi) ? details.classLabel + ' ' + Math.round(details.pi) : '—',
        powertrainType: metadata.powertrain === 'electric' ? 'EV' : metadata.powertrain === 'hybrid' ? 'HYBRID' : metadata.powertrain === 'combustion' ? 'COMBUSTION' : 'UNKNOWN',
      },
      themeEra: selectedThemeParts[0] || resolvedTheme.eraId,
      themeRegion: selectedThemeParts[1] || resolvedTheme.regionId,
      themeId: selectedThemeId,
      intervalMs: 560,
    };
  }

  function applyServerState(data) {
    if (data.version != null && data.version < serverVersion) return;
    serverVersion = data.version == null ? serverVersion : data.version;
    if (data.driveMode) {
      if (clientModeControl === 'auto') desiredDriveMode = data.driveMode;
      applyMode(data.driveMode);
    }
    if (typeof data.freeRoamRecording === 'boolean') applyRecordingState(data.freeRoamRecording);
    var info = document.getElementById('session-info');
    if (data.storageError || data.error) {
      info.textContent = 'Recording error: ' + (data.storageError || data.error);
      info.title = 'Resolve the storage problem, then POST /recording-retry to retry retained data.';
    } else if (data.sessionActive) {
      info.textContent = 'Recording session #' + data.sessionId + '…';
      var activeStatus = document.getElementById('status');
      activeStatus.className = 'active';
      activeStatus.textContent = '● REC';
    } else {
      info.textContent = data.sessionState === 'saving' ? 'Saving session…' : 'Recording stopped';
      var status = document.getElementById('status');
      status.className = '';
      status.textContent = data.sessionState === 'saving' ? 'Saving' : 'Live / idle';
    }
  }

  function applyMode(mode) {
    var changed = clientDriveMode !== mode;
    clientDriveMode = mode;
    if (routeUI) routeUI.setMode(mode);
    if (changed && animationCoordinator) {
      animationCoordinator.switchMode(mode, applyThemeOverlay);
    } else if (!animationCoordinator || animationCoordinator.state().phase === 'live') {
      // SSE and the /mode response can report the same transition twice. Keep
      // that duplicate from applying the new colors before the mode animation's
      // black-frame handoff. Other server state still flows through normally.
      applyThemeOverlay(mode);
    }
    var mapCard = document.getElementById('minimap-card');
    if (mapCard) mapCard.style.display = '';
    var recBtn = document.getElementById('free-roam-rec-btn');
    recBtn.style.display = mode === 'freeRoam' ? '' : 'none';
    if (leafletMap) leafletMap.setMode(mode);
    if (mode === 'race') {
      clientFreeRoamRecording = false;
      recBtn.textContent = '● Rec';
      recBtn.classList.remove('recording');
      var mapRec = document.getElementById('map-rec-btn');
      if (mapRec) { mapRec.textContent = '● REC'; mapRec.classList.remove('recording'); }
    }
  }

  function applyRecordingState(recording) {
    clientFreeRoamRecording = recording;
    var recBtn = document.getElementById('free-roam-rec-btn');
    if (recording) {
      recBtn.textContent = '■ Stop';
      recBtn.classList.add('recording');
    } else {
      recBtn.textContent = '● Rec';
      recBtn.classList.remove('recording');
    }
    var mapRec = document.getElementById('map-rec-btn');
    if (mapRec) {
      mapRec.textContent = recording ? '■ STOP' : '● REC';
      mapRec.classList.toggle('recording', recording);
    }
  }

  function updateModePending() {
    var control = document.querySelector('.mode-seg');
    var pending = modeRequestInFlight || desiredDriveMode !== clientDriveMode;
    control.dataset.pending = String(pending);
    if (pending) control.setAttribute('aria-busy', 'true'); else control.removeAttribute('aria-busy');
    document.querySelectorAll('.mode-seg-btn').forEach(function(button) {
      button.dataset.desired = String(pending && button.dataset.mode === desiredDriveMode);
    });
  }
  function pumpModeRequest() {
    updateModePending();
    if (clientModeControl !== 'manual' || modeRequestInFlight || desiredDriveMode === clientDriveMode) return;
    var requestedMode = desiredDriveMode;
    modeRequestInFlight = true;
    updateModePending();
    fetch('/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveMode: requestedMode })
      }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function(data) {
        if (data.driveMode !== 'race' && data.driveMode !== 'freeRoam') throw new Error('Invalid mode response');
        applyServerState(data);
      }).catch(function(err) {
        desiredDriveMode = clientDriveMode;
        var control = document.querySelector('.mode-seg');
        control.dataset.error = 'true';
        setTimeout(function(){ control.dataset.error = 'false'; }, 1200);
        console.error('Mode switch failed:', err);
      }).finally(function() {
        modeRequestInFlight = false;
        pumpModeRequest();
      });
  }
  document.querySelectorAll('.mode-seg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (clientModeControl !== 'manual') return;
      desiredDriveMode = btn.dataset.mode;
      pumpModeRequest();
    });
  });

  function setControlMode(nextMode, forceSync) {
    if ((nextMode !== 'auto' && nextMode !== 'manual') || (!forceSync && nextMode === clientModeControl) || policyRequestInFlight) return;
    var previousMode = clientModeControl;
    var previousThemeId = document.getElementById('cluster').dataset.themeId;
    clientModeControl = nextMode;
    if (nextMode === 'manual') {
      if (!manualThemeChosen && latestVehicleMetadata) {
        manualThemeId = resolveVehicleTheme(latestVehicleMetadata).themeId;
        themeButtonSet.update({ selectedId: manualThemeId });
      }
      manualThemeChosen = true;
      try { localStorage.setItem('fh6.manualThemeId', manualThemeId); } catch (_) {}
      desiredDriveMode = clientDriveMode;
    }
    syncControlModeUI();
    var automaticThemeId = latestVehicleMetadata ? resolveVehicleTheme(latestVehicleMetadata, { driveMode: clientDriveMode }).themeId : DEFAULT_THEME_ID;
    var nextThemeId = clientModeControl === 'manual' ? manualThemeId : automaticThemeId;
    var vehicleTransitionActive = animationCoordinator && document.getElementById('cluster').dataset.ignitionKind === 'vehicle' && animationCoordinator.state().phase !== 'live';
    if (animationCoordinator && (nextThemeId !== previousThemeId || vehicleTransitionActive)) {
      animationCoordinator.wake(vehicleProfileFromState(latestVehicleState || { vehicle: {} }), clientDriveMode, applyThemeOverlay);
    } else applyVehicleTheme(clientDriveMode);
    policyRequestInFlight = true;
    syncControlModeUI();
    fetch('/mode-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modeControl: nextMode })
    }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function(data) {
      if (data.modeControl !== nextMode) throw new Error('Invalid mode control response');
      try { localStorage.setItem('fh6.clusterControlMode', nextMode); } catch (_) {}
      applyServerState(data);
    }).catch(function(error) {
      clientModeControl = previousMode;
      if (animationCoordinator && (previousThemeId !== nextThemeId || vehicleTransitionActive)) {
        animationCoordinator.wake(vehicleProfileFromState(latestVehicleState || { vehicle: {} }), clientDriveMode, applyThemeOverlay);
      }
      var cluster = document.querySelector('.cluster-control-cluster');
      cluster.dataset.error = 'true';
      setTimeout(function() { cluster.dataset.error = 'false'; }, 1200);
      console.error('Control mode switch failed:', error);
    }).finally(function() {
      policyRequestInFlight = false;
      syncControlModeUI();
      if (!animationCoordinator || animationCoordinator.state().phase === 'live') applyVehicleTheme(clientDriveMode);
      pumpModeRequest();
    });
  }
  document.getElementById('control-auto-btn').addEventListener('click', function() { setControlMode('auto'); });
  document.getElementById('control-manual-btn').addEventListener('click', function() { setControlMode('manual'); });
  function toggleFreeRoamRecording() {
    var newRecording = !clientFreeRoamRecording;
    fetch('/free-roam-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording: newRecording })
    }).then(function(r) { return r.json(); }).then(function(data) {
      applyServerState(data);
    }).catch(function(err) { console.error('Recording toggle failed:', err); });
  }
  document.getElementById('free-roam-rec-btn').addEventListener('click', toggleFreeRoamRecording);
  document.getElementById('map-rec-btn').addEventListener('click', toggleFreeRoamRecording);

  fetch('/mode').then(function(r) { return r.json(); }).then(function(data) {
    applyServerState(data);
    if (data.modeControl && data.modeControl !== clientModeControl) setControlMode(clientModeControl, true);
  }).catch(function() { applyMode('race'); });

  // ── Hook minimap into SSE ─────────────────────────────────────────
  connectSSE();

  function handleSSEMessage(e) {
    try { telemetryStore.publish(JSON.parse(e.data)); }
    catch (error) { console.error('Invalid telemetry event:', error); }
  }

  instrumentHost = createInstrumentThemeHost({
    document: document,
    mount: document.querySelector('.cluster-stage'),
    root: document.getElementById('cluster'),
    factories: {
      'pre1949.europe': createClassicalEuropeInstrument,
      'y1986_1994.america': createRetroDigitalAmericaInstrument,
      'y1995_2002.japan': createJdm90Instrument,
      'y1960_1975.europe': createEarly911EuropeInstrument,
      'y2003_2008.japan': createRx8JapanInstrument,
      'y2020_2024.america': createC8AmericaInstrument,
      'y1950_1959.america': createBelairAmericaInstrument,
      'y1976_1985.japan': createAe86JapanInstrument,
      'y2009_2014.europe': createR8EuropeInstrument,
      'y1960_1975.japan': createS30JapanInstrument,
      'y1950_1959.europe': createDsEuropeInstrument,
      'y2009_2014.japan': createLfaJapanInstrument,
      'y1976_1985.europe': createCxEuropeInstrument,
      'y2015_2019.america': createFordGtAmericaInstrument,
      'y2020_2024.europe': createTaycanEuropeInstrument,
      'y2025plus.europe': createPanoramicEuropeInstrument,
      'y2020_2024.japan': createCivicJapanInstrument,
      'y2025plus.america': createEscaladeAmericaInstrument,
      'y2025plus.japan': createGxJapanInstrument,
    },
  });
  instrumentHost.activate(document.getElementById('cluster').dataset.themeId || DEFAULT_THEME_ID);
  var clusterBindings = createClusterBindings(document, selectTelemetry, {
    vehicleModelLookup: lookupVehicleModel,
    vehicleStateController: createVehicleStateController(),
    rpmGaugeController: createRpmGaugeController(),
    shiftLightController: createShiftLightController(),
    raceFeedbackController: createRaceFeedbackController(),
    onVehicleChange: function(state) {
      latestVehicleState = state;
      if (animationCoordinator) animationCoordinator.wake(vehicleProfileFromState(state), clientDriveMode, applyThemeOverlay);
    },
    onRender: function(model, context) {
      var root = document.getElementById('cluster');
      context.displayOverrideType = root.dataset.displayOverride;
      context.powertrain = root.dataset.powertrain;
      instrumentHost.update(model, context);
    },
    onRaceFeedback: function(event) { if (animationCoordinator) animationCoordinator.feedback(event); }
  });
  animationCoordinator = createUIAnimationCoordinator({
    root: document.getElementById('cluster'), body: document.body, display: clusterBindings,
    getLiveFractions: function() { return clusterBindings.getLiveFractions(); },
    infoCard: document.getElementById('vehicle-info-card'),
    feedbackElement: document.getElementById('race-feedback'),
  });
  var leafletMap = null;
  var mapTrailVisible = true;
  try {
    leafletMap = createLeafletAdapter(document.getElementById('map-leaflet'), window.L, createWorldToMap(DEFAULT_CALIBRATION), {
      mode: clientDriveMode,
      createTrackBuffer: createTrackBuffer,
      createCamera: createMapCameraController,
      onStatus: function(message) { setText('map-status', message); },
      onFollowChange: function(following) {
        var button = document.getElementById('map-follow-btn');
        button.textContent = following ? 'FOLLOWING' : 'RESUME';
        button.classList.toggle('active', following);
      }
    });
    window.L.DomEvent.disableClickPropagation(document.getElementById('map-toolbar'));
    window.L.DomEvent.disableScrollPropagation(document.getElementById('map-toolbar'));
  } catch (error) {
    setText('map-status', 'MAP UNAVAILABLE');
    console.error('Offline map initialization:', error);
  }
  var routeUI = createRouteUIController({
    doc: document,
    fetchJson: function(url) { return fetch(url).then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }); },
    mapAdapter: leafletMap,
    createDeltaTracker: createLiveDeltaTracker,
    setDriveSecondary: function(value) { clusterBindings.setRaceSecondary(value); }
  });
  setInterval(function() { routeUI.tick(); }, 250);
  document.getElementById('map-follow-btn').addEventListener('click', function() {
    if (leafletMap) leafletMap.resumeFollow();
  });
  document.getElementById('map-trail-btn').addEventListener('click', function() {
    mapTrailVisible = !mapTrailVisible;
    this.setAttribute('aria-pressed', String(mapTrailVisible));
    this.textContent = mapTrailVisible ? 'TRACE ON' : 'TRACE OFF';
    if (leafletMap) leafletMap.setTrailVisible(mapTrailVisible);
  });
  var pageController = createPageController(document.getElementById('cluster'), {onChange:function(page) {
    if (page === 'MAP' && leafletMap) leafletMap.invalidate();
  }});
  if (new URLSearchParams(location.search).get('preview') === '1') {
    var previewCaption = document.querySelector('.cluster-caption');
    previewCaption.dataset.preview = 'true';
    previewCaption.firstElementChild.textContent = 'SYNTHETIC PREVIEW · NOT GAME DATA';
  }
  telemetryStore.subscribe(function(d) {
    lastSseDataMs = Date.now();
    document.getElementById('no-data-warn').style.display = 'none';
    clusterBindings.update(d);
    routeUI.update(d);
    if (d.sessionId) {
      sessionId = d.sessionId;
      document.getElementById('export-btn').disabled = false;
      document.getElementById('export-compact-btn').disabled = false;
    }
  });
  var mapSessionId = null;
  telemetryStore.subscribe(function(d) {
    if (d.sessionId && d.sessionId !== mapSessionId) {
      mapSessionId = d.sessionId;
      liveTrail = []; frameCount = 0; prevRaceOn = false;
    }
    updateMapTrail(d);
    if (leafletMap) leafletMap.update(d, { mode: clientDriveMode, sessionId: d.sessionId, showTrail: mapTrailVisible });
  });

  function renderTelemetry(d) {
    lastSseDataMs = Date.now();
    document.getElementById('no-data-warn').style.display = 'none';

    if (d.sessionId && d.sessionId !== sessionId) {
      sessionId = d.sessionId;
      var st = document.getElementById('status');
      st.className = 'active';
      st.innerHTML = '<span class="dot active" id="status-dot"></span>Session #' + sessionId;
      document.getElementById('export-btn').disabled = false;
      document.getElementById('export-compact-btn').disabled = false;
      setText('session-info', 'Recording session #' + sessionId + '…');
    }

    var spd = d.speedKmh || 0;
    setText('speed', Math.round(spd));
    setArc('speed-arc', spd, MAX_SPD, SPEEDO_ARC, SPEEDO_CIRC);

    var rpm = d.currentEngineRpm || 0;
    setText('rpm', Math.round(rpm));
    setArc('rpm-bar', rpm, MAX_RPM, HALF_ARC, HALF_CIRC);

    var g = d.gear != null ? d.gear : 0;
    setText('gear', g === 0 ? 'N' : (g < 0 ? 'R' : g));

    var pwr = d.power || 0;
    setText('power', Math.round(Math.abs(pwr) / 1000));
    setArc('power-bar', Math.abs(pwr), MAX_PWR, HALF_ARC, HALF_CIRC);

    updateTire('temp-fl-bar', 'temp-fl', d.tireTempFl);
    updateTire('temp-fr-bar', 'temp-fr', d.tireTempFr);
    updateTire('temp-rl-bar', 'temp-rl', d.tireTempRl);
    updateTire('temp-rr-bar', 'temp-rr', d.tireTempRr);

    setText('lap-time', fmt((d.currentLap || 0) * 1000));
    setText('lap-num',  d.lapNumber != null ? d.lapNumber : '-');
    setText('position', d.racePosition || '-');
    setText('fuel',     d.fuel  ? d.fuel.toFixed(1) + 'L' : '-');
    setText('boost',    d.boost != null ? d.boost.toFixed(1) : '-');

    var thr = Math.round((d.throttle  || 0) / 255 * 100);
    var brk = Math.round((d.brake     || 0) / 255 * 100);
    var clt = Math.round((d.clutch    || 0) / 255 * 100);
    var hbk = Math.round((d.handbrake || 0) / 255 * 100);
    setText('throttle',  thr + '%'); setBar('throttle-bar',  thr);
    setText('brake',     brk + '%'); setBar('brake-bar',     brk);
    setText('clutch',    clt + '%'); setBar('clutch-bar',    clt);
    setText('handbrake', hbk + '%'); setBar('handbrake-bar', hbk);

    var sv = d.steer || 0;
    setText('steer', sv);
    var pip = document.getElementById('steer-pip');
    if (pip) pip.style.left = (50 + (sv / 128) * 47).toFixed(1) + '%';

    if (d.bestLap && d.bestLap > 0) setText('lap-best', 'BEST  ' + fmt(d.bestLap * 1000));
    if (d.completedLap)             setText('lap-best', 'BEST  ' + fmt(d.completedLap.lapTime * 1000));

  }

  document.getElementById('export-btn').addEventListener('click', function() {
    downloadExport('/export', 'Export', 'session_' + sessionId + '.json');
  });
  document.getElementById('export-compact-btn').addEventListener('click', function() {
    downloadExport('/export-compact', 'Compact', 'session_' + sessionId + '_compact.json');
  });

  function downloadExport(url, label, filename) {
    var btns = [document.getElementById('export-btn'), document.getElementById('export-compact-btn')];
    btns.forEach(function(b) { if (b) b.disabled = true; });
    fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = filename; a.click();
      URL.revokeObjectURL(u);
    }).catch(function(err) {
      alert(label + ' export failed: ' + err.message);
    }).finally(function() {
      btns.forEach(function(b) { if (b) b.disabled = false; });
    });
  }
</script>

<div class="footer">
  developed by <a href="https://github.com/viunow" target="_blank" rel="noopener noreferrer">@viunow</a>
</div>
</body>
</html>`;
  const themeCssVersion = Date.now();
  return legacy.replace(/<body>[\s\S]*?<!-- SESSIONS DRAWER -->/, '<body>' + clusterShell() + '\n<!-- SESSIONS DRAWER -->')
    .replace('</head>', '<link rel="stylesheet" href="/vendor/leaflet/leaflet.css"><link rel="stylesheet" href="/styles/manual-theme-button-set.css"><link rel="stylesheet" href="/styles/jdm90-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/classical-europe-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/retro-digital-america-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/early-911-europe-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/rx8-japan-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/c8-america-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/belair-america-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/ae86-japan-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/r8-europe-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/s30-japan-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/ds-europe-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/lfa-japan-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/vehicle-info-card.css?v=' + themeCssVersion + '"><style>' + clusterCSS + '</style></head>')
    .replace('</head>', '<link rel="stylesheet" href="/styles/cx-europe-instrument.css?v=' + themeCssVersion + '"></head>')
    .replace('</head>', '<link rel="stylesheet" href="/styles/ford-gt-america-instrument.css?v=' + themeCssVersion + '"></head>')
    .replace('</head>', '<link rel="stylesheet" href="/styles/taycan-europe-instrument.css?v=' + themeCssVersion + '"></head>')
    .replace('</head>', '<link rel="stylesheet" href="/styles/panoramic-europe-instrument.css?v=' + themeCssVersion + '"></head>')
    .replace('</head>', '<link rel="stylesheet" href="/styles/modern-instrument-common.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/civic-japan-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/escalade-america-instrument.css?v=' + themeCssVersion + '"><link rel="stylesheet" href="/styles/gx-japan-instrument.css?v=' + themeCssVersion + '"></head>')
    .replace('<script>', '<script src="/vendor/leaflet/leaflet.js"></script><script>');
}

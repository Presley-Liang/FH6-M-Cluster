export function createUIAnimationCoordinator(options = {}) {
  // This factory is embedded in the standalone page with toString(). Keep its
  // constants and helpers inside the factory so browser execution is self-contained.
  const VEHICLE_CARD_HOLD_MS = 1500;
  const VEHICLE_CARD_EXIT_MS = 380;
  const VEHICLE_BLACKOUT_MS = 460;
  const THEME_BUILD_MS = 1120;
  const SWEEP_MS = 1400;
  const SWEEP_HOLD_MS = 50;

  function vehicleEra(profile = {}) {
    const explicit = String(profile.instrumentEra || '').toLowerCase();
    if (['mechanical', 'digital-80s', 'digital-00s', 'modern-2015', 'modern-2020'].includes(explicit)) return explicit;
    const era = String(profile.themeEra || profile.metadata?.themeEra || '');
    if (['pre1949', 'y1950_1959', 'y1960_1975', 'y1976_1985'].includes(era)) return 'mechanical';
    if (era === 'y1986_1994') return 'digital-80s';
    if (['y1995_2002', 'y2003_2008', 'y2009_2014'].includes(era)) return 'digital-00s';
    if (era === 'y2015_2019') return 'modern-2015';
    if (['y2020_2024', 'y2025plus'].includes(era)) return 'modern-2020';
    const yearValue = profile.year ?? profile.metadata?.year;
    const year = yearValue == null || yearValue === '' ? NaN : Number(yearValue);
    if (Number.isFinite(year)) {
      if (year < 1980) return 'mechanical';
      if (year < 1990) return 'digital-80s';
      if (year < 2015) return 'digital-00s';
      if (year < 2020) return 'modern-2015';
      return 'modern-2020';
    }
    return 'modern-2015';
  }

  function powertrain(profile = {}) {
    return String(profile.powertrainType ?? profile.metadata?.powertrainType ?? '').trim().toUpperCase();
  }

  function sweepCurve(era, t) {
    if (era === 'mechanical') return 1 - Math.pow(1 - t, 2.25);
    if (era === 'digital-80s') return Math.min(1, Math.floor(t * 18) / 18);
    if (era === 'digital-00s') return t * t * (3 - 2 * t);
    if (era === 'modern-2015') return 1 - Math.pow(1 - t, 3);
    return 1 - Math.pow(1 - t, 2.6);
  }
  function sweepExtent(era) {
    // A pre-electronic needle makes a restrained travel instead of striking
    // the mechanical stop. The return starts from exactly this same position.
    return era === 'mechanical' ? 0.64 : 1;
  }

  const root = options.root;
  const body = options.body;
  const display = options.display;
  const infoCard = options.infoCard;
  const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
  const cancelSchedule = options.cancelSchedule || clearTimeout;
  const reducedMotion = () => typeof options.reducedMotion === 'function'
    ? options.reducedMotion() : Boolean(options.reducedMotion);
  let generation = 0;
  let timers = [];
  let feedbackGeneration = 0, feedbackTimer = null;
  let activeVehicle = false;
  let vehicleThemeApplied = false;
  let queuedVehicleMode = null;
  let latestVehicle = null;
  let latestMode = body?.dataset.driveMode || 'race';
  let applyTheme = null;

  function clear() {
    generation += 1;
    timers.forEach(cancelSchedule);
    timers = [];
  }
  function later(token, ms, fn) {
    timers.push(schedule(() => { if (token === generation) fn(); }, ms));
  }
  function phase(value) {
    if (root) root.dataset.ignitionPhase = value;
  }
  function cardVisible(value) {
    if (!infoCard) return;
    infoCard.dataset.visible = String(value);
    infoCard.setAttribute('aria-hidden', String(!value));
  }
  function setVehiclePresentation(profile) {
    if (!root) return;
    const eraLabels = {
      pre1949: 'PRE 1949', y1950_1959: '1950—59', y1960_1975: '1960—75',
      y1976_1985: '1976—85', y1986_1994: '1986—94', y1995_2002: '1995—02',
      y2003_2008: '2003—08', y2009_2014: '2009—14', y2015_2019: '2015—19',
      y2020_2024: '2020—24', y2025plus: '2025+',
    };
    const regionLabels = { europe: 'EUROPE', america: 'AMERICA', japan: 'JAPAN' };
    const requestedEra = profile.themeEra ?? profile.metadata?.themeEra;
    const requestedRegion = profile.themeRegion ?? profile.metadata?.themeRegion;
    const startupEra = Object.hasOwn(eraLabels, requestedEra) ? requestedEra : 'y2015_2019';
    const startupRegion = Object.hasOwn(regionLabels, requestedRegion) ? requestedRegion : 'europe';
    root.dataset.startupThemeEra = startupEra;
    root.dataset.startupThemeRegion = startupRegion;
    const era = vehicleEra(profile);
    const type = powertrain(profile);
    const yearValue = profile.year ?? profile.metadata?.year;
    const year = yearValue == null || yearValue === '' ? NaN : Number(yearValue);
    root.dataset.instrumentEra = era;
    root.dataset.powertrain = type || 'unknown';
    root.dataset.vehicleYear = Number.isFinite(year) ? String(year) : 'unknown';
    const brand = profile.brand ?? profile.metadata?.brand ?? 'BRAND UNKNOWN';
    const modelName = profile.modelName ?? profile.metadata?.modelName ?? profile.name ?? 'MODEL UNKNOWN';
    const headerVehicle = root.querySelector?.('#header-vehicle-info');
    if (headerVehicle) {
      headerVehicle.textContent = [Number.isFinite(year) ? String(year) : '', brand, modelName].filter(Boolean).join(' · ');
      headerVehicle.title = headerVehicle.textContent;
    }
    if (infoCard) {
      const details = profile.metadata || {};
      const content = {
        era: eraLabels[startupEra], region: regionLabels[startupRegion],
        brand, model: modelName, year: Number.isFinite(year) ? String(year) : '—',
        drive: details.drivetrain && details.drivetrain !== 'DRIVETRAIN UNKNOWN' ? details.drivetrain : '—',
        powertrain: details.powertrainType && details.powertrainType !== 'UNKNOWN' ? details.powertrainType : '—',
        class: details.classPi || '—',
      };
      for (const [key, value] of Object.entries(content)) {
        const node = infoCard.querySelector?.('[data-card-' + key + ']');
        if (node) node.textContent = value;
      }
    }
  }
  function applyLatestTheme() {
    setVehiclePresentation(latestVehicle || {});
    if (typeof applyTheme === 'function') applyTheme(latestMode);
  }
  function settle() {
    applyLatestTheme();
    if (body) body.dataset.driveMode = latestMode;
    phase('live');
    activeVehicle = false;
    display?.setDisplayOverride?.(null);
    cardVisible(false);
    const queuedMode = queuedVehicleMode;
    queuedVehicleMode = null;
    if (queuedMode && queuedMode !== latestMode) switchMode(queuedMode, applyTheme);
  }
  function sweep(token, era, startedAt = performance.now(), durationMs = SWEEP_MS) {
    const extent = sweepExtent(era);
    const step = () => {
      if (token !== generation || (root && root.dataset.ignitionPhase !== 'scan')) return;
      const t = Math.min(1, (performance.now() - startedAt) / durationMs);
      const fraction = sweepCurve(era, t) * extent;
      display?.setDisplayOverride?.({ speed: fraction, rpm: fraction });
      if (t < 1) later(token, 16, step);
    };
    step();
  }
  function returnToLive(token, durationMs = 480, from = 1) {
    const startedAt = performance.now();
    const readLive = options.getLiveFractions;
    if (typeof readLive !== 'function') {
      display?.setDisplayOverride?.(null);
      return;
    }
    const step = () => {
      if (token !== generation || root?.dataset.ignitionPhase !== 'return') return;
      const t = Math.min(1, (performance.now() - startedAt) / durationMs);
      const eased = t * t * (3 - 2 * t);
      const live = readLive() || {};
      const speed = Number.isFinite(live.speed) ? Math.max(0, Math.min(1, live.speed)) : 0;
      const rpm = Number.isFinite(live.rpm) ? Math.max(0, Math.min(1, live.rpm)) : 0;
      if (t < 1) {
        display?.setDisplayOverride?.({ speed: from + (speed - from) * eased, rpm: from + (rpm - from) * eased });
        later(token, 16, step);
      } else display?.setDisplayOverride?.(null);
    };
    step();
  }
  function startupMode(token, offset = 0) {
    const era = root?.dataset.instrumentVariant === 'custom' ? vehicleEra(latestVehicle || {}) : 'digital-00s';
    const scanDuration = era === 'mechanical' ? 1800 : 1250;
    later(token, offset, () => {
      phase('center');
      display?.setDisplayOverride?.({ speed: 0, rpm: 0 });
    });
    later(token, offset + 560, () => phase('frames'));
    later(token, offset + 1500, () => {
      phase('scan');
      // The modern European anchor keeps its original smoothstep timing.
      sweep(token, era, performance.now(), scanDuration);
    });
    later(token, offset + 1550 + scanDuration, () => {
      phase('return');
      returnToLive(token, 480, sweepExtent(era));
    });
    later(token, offset + 2050 + scanDuration, settle);
  }
  function runVehicle(profile, mode, theme) {
    clear();
    cardVisible(false);
    activeVehicle = true;
    vehicleThemeApplied = false;
    queuedVehicleMode = null;
    latestVehicle = profile || latestVehicle || {};
    latestMode = mode || latestMode;
    applyTheme = theme || applyTheme;
    if (root) {
      root.dataset.ignitionKind = 'vehicle';
      root.dataset.targetMode = latestMode;
    }
    if (reducedMotion()) {
      settle();
      return;
    }
    const token = generation;
    const era = vehicleEra(latestVehicle);
    later(token, 0, () => phase('off-needles'));
    later(token, 300, () => phase('off-frames'));
    later(token, 700, () => phase('off-center'));
    later(token, 1080, () => {
      phase('vehicle-blackout');
      // The target gauge builds at zero while telemetry keeps updating below.
      display?.setDisplayOverride?.({ speed: 0, rpm: 0 });
    });
    later(token, 1080 + VEHICLE_BLACKOUT_MS, () => {
      setVehiclePresentation(latestVehicle);
      phase('vehicle-card');
      cardVisible(true);
      later(token, VEHICLE_CARD_HOLD_MS, () => {
        cardVisible(false);
        later(token, VEHICLE_CARD_EXIT_MS, () => {
          applyLatestTheme();
          vehicleThemeApplied = true;
          later(token, 32, () => {
            phase('frames');
            later(token, THEME_BUILD_MS, () => {
              phase('scan');
              const sweepDuration = era === 'mechanical' ? 1850 : SWEEP_MS;
              sweep(token, era, performance.now(), sweepDuration);
              later(token, sweepDuration + SWEEP_HOLD_MS, () => {
                phase('return');
                returnToLive(token, 480, sweepExtent(era));
              });
              later(token, sweepDuration + SWEEP_HOLD_MS + 480, settle);
            });
          });
        });
      });
    });
  }
  function switchMode(mode, applyModeTheme) {
    applyTheme = applyModeTheme || applyTheme;
    if (reducedMotion()) {
      latestMode = mode;
      clear();
      queuedVehicleMode = null;
      if (root) { root.dataset.ignitionKind = 'mode'; root.dataset.targetMode = mode; }
      settle();
      return;
    }
    if (activeVehicle) {
      if (vehicleThemeApplied) {
        // A mode request during build or sweep starts its own transition after
        // the vehicle has reached live values.
        queuedVehicleMode = mode === latestMode ? null : mode;
      } else {
        latestMode = mode;
        if (root) root.dataset.targetMode = mode;
      }
      return;
    }
    latestMode = mode;
    clear();
    if (root) { root.dataset.ignitionKind = 'mode'; root.dataset.targetMode = mode; }
    const token = generation;
    phase('off-needles');
    later(token, 220, () => phase('off-frames'));
    later(token, 650, () => phase('off-center'));
    // Switch only the current instrument's illumination and mode identity.
    later(token, 1250, () => applyLatestTheme());
    startupMode(token, 1250);
  }
  function wake(profile, mode, theme) {
    runVehicle(profile, mode, theme);
  }
  function feedback(event) {
    const panel=options.feedbackElement;if(!panel||!event)return;
    const token=++feedbackGeneration;if(feedbackTimer)cancelSchedule(feedbackTimer);
    const formatTime=seconds=>Math.floor(seconds/60)+':'+(seconds%60).toFixed(3).padStart(6,'0');
    const copy=event.type==='rewind'?['REWIND','TIMELINE RESYNC','LIVE DATA CONTINUES']
      :event.type==='race-start'?['RACE','SESSION LIVE','AUTO RECORDING']
      :event.type==='new-best'?['NEW BEST',formatTime(event.seconds),'LAP '+event.lap]
      :event.type==='lap-complete'?['LAP COMPLETE',formatTime(event.seconds),'LAP '+event.lap]
      :event.type==='position-gain'?['POSITION','P'+event.rank,'+'+Math.abs(event.delta)]
      :['POSITION','P'+event.rank,'-'+Math.abs(event.delta)];
    panel.querySelector('[data-feedback-label]').textContent=copy[0];panel.querySelector('[data-feedback-value]').textContent=copy[1];panel.querySelector('[data-feedback-detail]').textContent=copy[2];
    panel.dataset.tone=event.tone;panel.dataset.visible='false';void panel.offsetWidth;panel.dataset.visible='true';panel.setAttribute('aria-hidden','false');
    feedbackTimer=schedule(()=>{if(token===feedbackGeneration){panel.dataset.visible='false';panel.setAttribute('aria-hidden','true');}},event.type==='new-best'?2400:1700);
  }
  return {
    switchMode, wake, feedback,
    cancel() { clear(); activeVehicle = false; vehicleThemeApplied = false; queuedVehicleMode = null; cardVisible(false); display?.setDisplayOverride?.(null); phase('live'); },
    state: () => ({ generation, phase: root?.dataset.ignitionPhase || 'live', vehicle: latestVehicle, mode: latestMode }),
  };
}

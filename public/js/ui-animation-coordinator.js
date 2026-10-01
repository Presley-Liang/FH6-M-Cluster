export function createUIAnimationCoordinator(options = {}) {
  const root = options.root;
  const body = options.body;
  const display = options.display;
  const reducedMotion = options.reducedMotion || (() => false);
  const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
  const cancelSchedule = options.cancelSchedule || clearTimeout;
  let generation = 0;
  let timers = [];
  let feedbackGeneration = 0, feedbackTimer = null;

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
  function settle(mode) {
    if (body) body.dataset.driveMode = mode;
    phase('live');
    display?.setDisplayOverride?.(null);
  }
  function startup(token, mode, offset = 0) {
    later(token, offset, () => {
      phase('blank');
      display?.setDisplayOverride?.({ speed: 0, rpm: 0 });
    });
    later(token, offset + 60, () => phase('center'));
    later(token, offset + 560, () => phase('frames'));
    later(token, offset + 1500, () => {
      phase('scan');
      const start = performance.now();
      const step = () => {
        if (token !== generation || (root && root.dataset.ignitionPhase !== 'scan')) return;
        const t = Math.min(1, (performance.now() - start) / 1250);
        const fraction = t * t * (3 - 2 * t);
        display?.setDisplayOverride?.({ speed: fraction, rpm: fraction });
        if (t < 1) later(token, 16, step);
      };
      step();
    });
    later(token, offset + 2800, () => {
      phase('return');
      display?.setDisplayOverride?.(null);
    });
    later(token, offset + 3300, () => settle(mode));
  }
  function switchMode(mode, applyTheme) {
    clear();
    if (root) { root.dataset.ignitionKind = 'mode'; root.dataset.targetMode = mode; }
    const token = generation;
    if (reducedMotion()) { applyTheme(mode); settle(mode); return; }
    phase('off-needles');
    later(token, 220, () => phase('off-frames'));
    later(token, 650, () => phase('off-center'));
    // Give every old-theme light layer a true-black frame before recoloring.
    later(token, 1250, () => applyTheme(mode));
    startup(token, mode, 1250);
  }
  function wake() {
    // A vehicle confirmation joins an ongoing mode sequence.
    if (root?.dataset.ignitionPhase && root.dataset.ignitionPhase !== 'live') return;
    clear();
    const mode = body?.dataset.driveMode || 'race';
    if (root) root.dataset.ignitionKind = 'vehicle';
    if (reducedMotion()) { settle(mode); return; }
    startup(generation, mode);
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
  return { switchMode, wake, feedback, cancel: clear, state: () => ({ generation, phase: root?.dataset.ignitionPhase || 'live' }) };
}

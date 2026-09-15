export const finiteDeltaValue = value => Number.isFinite(Number(value));
const finite = finiteDeltaValue;

export const unavailableDelta = (reason, extra = {}) => ({
  available: false,
  deltaSeconds: null,
  relation: 'unavailable',
  reason,
  ...extra,
});
const unavailable = unavailableDelta;

export function readDeltaProgress(sample) {
  return sample?.distanceTraveled ?? sample?.progress;
}
const readProgress = readDeltaProgress;

export function readDeltaTime(sample) {
  return sample?.currentLap ?? sample?.lapTime ?? sample?.timeSeconds ?? sample?.time;
}
const readTime = readDeltaTime;

/**
 * Validate a completed-lap trace for use as a Ghost timing reference.
 * Input order is significant: regressions/wraps make the reference invalid
 * instead of being silently sorted into a plausible-looking lap.
 */
export function buildGhostReference(samples = []) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return { valid: false, reason: 'no-ghost', points: [] };
  }

  const points = [];
  for (const sample of samples) {
    const progress = Number(readProgress(sample));
    const timeSeconds = Number(readTime(sample));
    if (!Number.isFinite(progress) || !Number.isFinite(timeSeconds)
      || progress < 0 || timeSeconds < 0) {
      return { valid: false, reason: 'invalid-ghost', points: [] };
    }
    const prior = points[points.length - 1];
    if (prior && (progress <= prior.progress || timeSeconds < prior.timeSeconds)) {
      return { valid: false, reason: 'invalid-ghost-order', points: [] };
    }
    points.push({ progress, timeSeconds });
  }
  return {
    valid: true,
    reason: null,
    points,
    minProgress: points[0].progress,
    maxProgress: points[points.length - 1].progress,
  };
}

/** Binary-search and linearly interpolate Ghost time at normalized progress. */
export function interpolateGhostTime(reference, progress, { maxGhostProgressGap = Infinity } = {}) {
  if (!reference?.valid || !Array.isArray(reference.points)) return unavailable('no-ghost');
  const target = Number(progress);
  if (!Number.isFinite(target)) return unavailable('invalid-progress');
  const points = reference.points;
  if (target < reference.minProgress || target > reference.maxProgress) {
    return unavailable('outside-ghost-range');
  }

  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (points[mid].progress === target) {
      return { available: true, timeSeconds: points[mid].timeSeconds, bracketGap: 0 };
    }
    if (points[mid].progress < target) low = mid + 1;
    else high = mid - 1;
  }

  const before = points[high];
  const after = points[low];
  const bracketGap = after.progress - before.progress;
  if (!Number.isFinite(bracketGap) || bracketGap <= 0 || bracketGap > maxGhostProgressGap) {
    return unavailable('ghost-gap', { bracketGap });
  }
  const ratio = (target - before.progress) / bracketGap;
  return {
    available: true,
    timeSeconds: before.timeSeconds + ratio * (after.timeSeconds - before.timeSeconds),
    bracketGap,
  };
}

/**
 * Stateful, IO-free live Delta calculator. `update` is safe for the UDP/SSE
 * hot path; `tick` lets a slower UI clock explicitly detect stale telemetry.
 */
export class LiveDeltaTracker {
  constructor({
    ghost = [],
    staleAfterMs = 1500,
    maxGhostProgressGap = 1000,
    maxCurrentProgressGap = 1000,
    regressionTolerance = 1,
    evenThresholdSeconds = 0.005,
  } = {}) {
    this.options = {
      staleAfterMs, maxGhostProgressGap, maxCurrentProgressGap,
      regressionTolerance, evenThresholdSeconds,
    };
    this.reference = buildGhostReference(ghost);
    this.reset();
  }

  reset() {
    this.lastProgress = null;
    this.lastLapNumber = null;
    this.lastUpdateMs = null;
    this.lastResult = unavailable(this.reference.valid ? 'no-sample' : this.reference.reason);
    return this.lastResult;
  }

  setGhost(samples) {
    this.reference = buildGhostReference(samples);
    return this.reset();
  }

  update(sample, nowMs = Date.now()) {
    if (!this.reference.valid) {
      this.lastResult = unavailable(this.reference.reason);
      return this.lastResult;
    }
    if (!sample || typeof sample !== 'object') return this.#reject('invalid-sample');
    if (!finite(nowMs)) return this.#reject('invalid-clock');
    if (sample.timelineBreak === 'rewind' || sample.timelineBreak === 'teleport') {
      this.lastProgress = null;
      this.lastLapNumber = null;
      return this.#reject(sample.timelineBreak);
    }

    const progress = Number(readProgress(sample));
    const currentTime = Number(readTime(sample));
    if (!Number.isFinite(progress) || !Number.isFinite(currentTime)
      || progress < 0 || currentTime < 0) return this.#reject('invalid-sample');

    const hasLap = finite(sample.lapNumber);
    const lapNumber = hasLap ? Number(sample.lapNumber) : null;
    if (hasLap && this.lastLapNumber !== null && lapNumber < this.lastLapNumber) {
      this.lastProgress = null;
      this.lastLapNumber = lapNumber;
      return this.#reject('lap-rewind');
    }
    const newLap = hasLap && this.lastLapNumber !== null && lapNumber > this.lastLapNumber;
    if (!newLap && this.lastProgress !== null
      && progress < this.lastProgress - this.options.regressionTolerance) {
      this.lastProgress = progress;
      this.lastLapNumber = lapNumber;
      return this.#reject('progress-regression');
    }
    if (!newLap && this.lastProgress !== null
      && progress - this.lastProgress > this.options.maxCurrentProgressGap) {
      this.lastProgress = progress;
      this.lastLapNumber = lapNumber;
      return this.#reject('sample-gap');
    }

    const ghost = interpolateGhostTime(this.reference, progress, this.options);
    this.lastProgress = progress;
    this.lastLapNumber = lapNumber;
    this.lastUpdateMs = Number(nowMs);
    if (!ghost.available) return this.#reject(ghost.reason, { progress });

    const deltaSeconds = currentTime - ghost.timeSeconds;
    if (!Number.isFinite(deltaSeconds)) return this.#reject('invalid-delta');
    const threshold = Math.max(0, Number(this.options.evenThresholdSeconds) || 0);
    const relation = deltaSeconds < -threshold ? 'ahead'
      : deltaSeconds > threshold ? 'behind' : 'even';
    this.lastResult = {
      available: true,
      deltaSeconds,
      relation,
      reason: null,
      progress,
      currentTime,
      ghostTime: ghost.timeSeconds,
      lapNumber,
    };
    return this.lastResult;
  }

  tick(nowMs = Date.now()) {
    const now = Number(nowMs);
    if (!Number.isFinite(now)) return unavailable('invalid-clock');
    if (this.lastUpdateMs === null) return this.lastResult;
    if (now - this.lastUpdateMs > this.options.staleAfterMs) {
      this.lastResult = unavailable('stale');
    }
    return this.lastResult;
  }

  #reject(reason, extra) {
    this.lastResult = unavailable(reason, extra);
    return this.lastResult;
  }
}

export function createLiveDeltaTracker(options) {
  return new LiveDeltaTracker(options);
}

import { effectiveFingerprintTimeline } from './fingerprint.js';

const finite = value => Number.isFinite(Number(value));
const positive = value => finite(value) && Number(value) > 0;
const cleanNumber = value => Object.is(Number(value), -0) ? 0 : Number(value);

function routeIdentity(archive) {
  return archive?.routeId ?? archive?.routeCatalogKey ?? archive?.catalogKey
    ?? archive?.routeMatch?.routeId ?? archive?.routeMatch?.catalogKey
    ?? archive?.matchedRoute?.id ?? null;
}

function contaminated(lap, fingerprint) {
  const flags = Array.isArray(lap?.flags) ? lap.flags : [];
  return lap?.valid === false || fingerprint?.valid === false
    || flags.includes('teleport') || fingerprint?.reasons?.includes('teleport');
}

const stableText = value => value == null ? '' : String(value);

/**
 * Select a best completed lap from already-loaded Race archives.
 *
 * The result is deterministic even when two laps have the same time. Archives
 * and laps are never sorted or otherwise mutated. `carOrdinal` is deliberately
 * optional: omit it for route-wide best, provide it for same-car comparison.
 */
export function selectBestLap(archives = [], { routeId, carOrdinal } = {}) {
  if (routeId == null) return null;
  const candidates = [];
  for (const archive of archives || []) {
    if (!archive || archive.driveMode !== 'race' || routeIdentity(archive) !== routeId) continue;
    if (carOrdinal != null && archive.carOrdinal !== carOrdinal) continue;
    const fingerprints = new Map((archive.lapFingerprints || []).map(item => [Number(item?.lapNumber), item]));
    for (const lap of archive.laps || []) {
      if (!finite(lap?.lapNumber) || !positive(lap?.lapTime)) continue;
      const fingerprint = fingerprints.get(Number(lap.lapNumber));
      // A fingerprint is the proof that the lap completed cleanly enough for
      // route comparison. Old archives may instead carry an explicit valid bit.
      if (!fingerprint && lap.valid !== true) continue;
      if (contaminated(lap, fingerprint)) continue;
      candidates.push({
        sessionId: archive.id,
        lapNumber: Number(lap.lapNumber),
        lapTime: Number(lap.lapTime),
        carOrdinal: archive.carOrdinal ?? null,
        routeId,
        archive,
        lap,
      });
    }
  }
  candidates.sort((a, b) => a.lapTime - b.lapTime
    || stableText(a.sessionId).localeCompare(stableText(b.sessionId), 'en', { numeric: true })
    || a.lapNumber - b.lapNumber);
  return candidates[0] ?? null;
}

function boundedIndices(length, maximum) {
  if (length <= maximum) return Array.from({ length }, (_, index) => index);
  if (maximum === 1) return [0];
  const result = [];
  for (let index = 0; index < maximum; index++) {
    result.push(Math.round(index * (length - 1) / (maximum - 1)));
  }
  return result;
}

/**
 * Build a bounded, display-neutral Ghost trace for one lap.
 *
 * `axis: 'progress'` exposes normalized DistanceTraveled as `t`; `raceTime`
 * exposes normalized elapsed race time. Both normalized values remain present
 * so later Delta/UI layers can choose without rebuilding the raw recording.
 */
export function buildGhostTrace(archive, lapNumber, {
  axis = 'progress',
  maxSamples = 600,
} = {}) {
  if (!archive || !Number.isInteger(maxSamples) || maxSamples < 2
    || !['progress', 'raceTime'].includes(axis)) return null;
  const fingerprint = (archive.lapFingerprints || []).find(item => Number(item?.lapNumber) === Number(lapNumber));
  const lap = (archive.laps || []).find(item => Number(item?.lapNumber) === Number(lapNumber));
  if (!lap || !positive(lap.lapTime) || contaminated(lap, fingerprint)) return null;

  const source = effectiveFingerprintTimeline(archive.packets || []).filter(packet =>
    Number(packet?.lapNumber) === Number(lapNumber)
    && finite(packet.positionX) && finite(packet.positionZ)
    && finite(packet.distanceTraveled) && finite(packet.currentRaceTime));
  if (source.length < 2 || source.some(packet => packet.timelineBreak === 'teleport')) return null;

  const startProgress = Number(source[0].distanceTraveled);
  const startTime = Number(source[0].currentRaceTime);
  const progressSpan = Number(source.at(-1).distanceTraveled) - startProgress;
  const timeSpan = Number(source.at(-1).currentRaceTime) - startTime;
  if (!(progressSpan > 0) || !(timeSpan > 0)) return null;

  // Reject regressions left after rewind reconstruction: a Ghost timeline must
  // always move forward on both axes.
  for (let index = 1; index < source.length; index++) {
    if (Number(source[index].distanceTraveled) < Number(source[index - 1].distanceTraveled)
      || Number(source[index].currentRaceTime) < Number(source[index - 1].currentRaceTime)) return null;
  }

  const indices = boundedIndices(source.length, maxSamples);
  const points = indices.map(index => {
    const packet = source[index];
    const progress = (Number(packet.distanceTraveled) - startProgress) / progressSpan;
    const elapsed = Number(packet.currentRaceTime) - startTime;
    const raceTime = elapsed / timeSpan;
    return {
      t: axis === 'progress' ? progress : raceTime,
      progress,
      raceTime,
      elapsed,
      x: cleanNumber(packet.positionX),
      z: cleanNumber(packet.positionZ),
      yaw: finite(packet.yaw) ? cleanNumber(packet.yaw) : null,
    };
  });
  return {
    sessionId: archive.id,
    lapNumber: Number(lapNumber),
    lapTime: Number(lap.lapTime),
    routeId: routeIdentity(archive),
    carOrdinal: archive.carOrdinal ?? null,
    axis,
    sourceSampleCount: source.length,
    sampleCount: points.length,
    points,
  };
}

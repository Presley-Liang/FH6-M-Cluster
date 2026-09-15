import { matchTrackFingerprint } from '../tracks/matcher.js';

const finite = value => Number.isFinite(Number(value));

const initialResult = (reason = 'awaiting-race-samples') => ({
  status: 'unknown',
  reason,
  routeCatalogKey: null,
  routeName: null,
  confidence: null,
  candidates: [],
});

/**
 * Incremental, side-effect-free-with-respect-to-the-outside-world route matcher.
 *
 * The caller owns IO and supplies an already validated catalogue. This class
 * only retains a bounded sample window for the active lap and a small matched
 * identity for the active session, making update() safe on the UDP hot path.
 */
export class LiveRouteIdentifier {
  constructor(catalog, {
    minSamples = 8,
    minDistanceSignature = 1_000,
    maxSamples = 512,
    minSampleDistance = 25,
    matcherOptions,
  } = {}) {
    if (!Array.isArray(catalog?.routes) && !Array.isArray(catalog)) {
      throw new TypeError('catalog must expose a routes array');
    }
    if (!Number.isInteger(minSamples) || minSamples < 2) throw new RangeError('minSamples must be at least 2');
    if (!Number.isInteger(maxSamples) || maxSamples < minSamples) throw new RangeError('maxSamples must be >= minSamples');
    this.catalog = catalog;
    this.options = { minSamples, minDistanceSignature, maxSamples, minSampleDistance, matcherOptions };
    this.reset();
  }

  reset() {
    this.sessionId = null;
    this.lapNumber = null;
    this.samples = [];
    this.contaminated = false;
    this.match = null;
    this.result = initialResult();
    return this.state();
  }

  state() {
    return {
      ...this.result,
      sessionId: this.sessionId,
      lapNumber: this.lapNumber,
      sampleCount: this.samples.length,
      matchedForSession: !!this.match,
    };
  }

  update(packet = {}) {
    const isRace = packet?.driveMode === 'race';
    if (!isRace) {
      this.samples = [];
      this.lapNumber = null;
      this.contaminated = false;
      this.result = initialResult('inactive-free-roam');
      return this.state();
    }

    const incomingSession = packet.sessionId ?? null;
    if (incomingSession !== this.sessionId) {
      this.sessionId = incomingSession;
      this.lapNumber = null;
      this.samples = [];
      this.contaminated = false;
      this.match = null;
      this.result = initialResult('new-session');
    }

    if (!finite(packet.lapNumber)) {
      this.result = this.match ? this.#matchedResult() : initialResult('invalid-lap-number');
      return this.state();
    }
    const lapNumber = Number(packet.lapNumber);
    if (this.lapNumber === null || lapNumber !== this.lapNumber) {
      this.lapNumber = lapNumber;
      this.samples = [];
      this.contaminated = false;
      this.result = this.match ? this.#matchedResult() : initialResult('new-lap');
    }

    if (packet.timelineBreak === 'teleport') {
      this.samples = [];
      this.contaminated = true;
      this.result = this.match ? this.#matchedResult() : initialResult('teleport');
      return this.state();
    }
    if (packet.timelineBreak === 'rewind') this.#rewind(packet);

    if (!finite(packet.positionX) || !finite(packet.positionZ)
      || !finite(packet.distanceTraveled) || !finite(packet.currentRaceTime)) {
      this.result = this.match ? this.#matchedResult() : initialResult('non-finite-sample');
      return this.state();
    }
    if (this.contaminated) {
      this.result = this.match ? this.#matchedResult() : initialResult('teleport');
      return this.state();
    }

    this.#append(packet);
    if (this.match) {
      this.result = this.#matchedResult();
      return this.state();
    }
    return this.#identify();
  }

  #rewind(packet) {
    if (!finite(packet.currentRaceTime)) {
      this.samples = [];
      return;
    }
    const boundary = Number(packet.currentRaceTime);
    while (this.samples.length && this.samples.at(-1).currentRaceTime >= boundary) this.samples.pop();
  }

  #append(packet) {
    const sample = {
      positionX: Number(packet.positionX),
      positionZ: Number(packet.positionZ),
      distanceTraveled: Number(packet.distanceTraveled),
      currentRaceTime: Number(packet.currentRaceTime),
    };
    const last = this.samples.at(-1);
    if (last && Math.abs(sample.distanceTraveled - last.distanceTraveled) < this.options.minSampleDistance
      && packet.timelineBreak !== 'rewind') return;
    this.samples.push(sample);
    if (this.samples.length > this.options.maxSamples) {
      // Keep the true lap start because it is a catalogue discriminator.
      this.samples.splice(1, this.samples.length - this.options.maxSamples);
    }
  }

  #identify() {
    if (this.samples.length < this.options.minSamples) {
      this.result = initialResult('too-few-samples');
      return this.state();
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let minDistance = Infinity, maxDistance = -Infinity;
    for (const sample of this.samples) {
      minX = Math.min(minX, sample.positionX); maxX = Math.max(maxX, sample.positionX);
      minZ = Math.min(minZ, sample.positionZ); maxZ = Math.max(maxZ, sample.positionZ);
      minDistance = Math.min(minDistance, sample.distanceTraveled);
      maxDistance = Math.max(maxDistance, sample.distanceTraveled);
    }
    const distance = maxDistance - minDistance;
    if (distance < this.options.minDistanceSignature) {
      this.result = initialResult('insufficient-progress');
      return this.state();
    }
    const outcome = matchTrackFingerprint({
      start: { x: this.samples[0].positionX, z: this.samples[0].positionZ },
      distance,
      span: { x: maxX - minX, z: maxZ - minZ },
    }, this.catalog, this.options.matcherOptions);
    if (outcome.status === 'matched') {
      this.match = outcome;
      this.result = this.#matchedResult();
    } else {
      this.result = {
        ...initialResult(outcome.reason),
        status: outcome.status,
        candidates: outcome.candidates.map(candidate => ({
          routeCatalogKey: candidate.route.id,
          routeName: candidate.route.name,
          confidence: candidate.confidence,
        })),
      };
    }
    return this.state();
  }

  #matchedResult() {
    return {
      status: 'matched',
      reason: 'single-eligible-candidate',
      routeCatalogKey: this.match.match.id,
      routeName: this.match.match.name,
      confidence: this.match.confidence,
      candidates: [],
    };
  }
}

export function createLiveRouteIdentifier(catalog, options) {
  return new LiveRouteIdentifier(catalog, options);
}

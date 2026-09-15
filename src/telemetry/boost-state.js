const DEFAULTS = Object.freeze({
  capabilityRaw: 0.5,
  capabilitySamples: 3,
  activeEnterRaw: 0.5,
  activeExitRaw: 0.3,
  peakEnterRatio: 0.82,
  peakExitRatio: 0.76,
  peakSamples: 8,
  peakMinimumRaw: 1,
  confirmMs: 150,
  rpmSignatureStep: 100
});

const LEVEL = Object.freeze({ UNKNOWN: 0, READY: 1, ACTIVE: 2, PEAK: 3 });

function finite(value) {
  return Number.isFinite(value);
}

function vehicleSignature(packet, rpmStep) {
  const pi = Number.isInteger(packet.carPi) ? packet.carPi : null;
  const rpm = finite(packet.engineMaxRpm) && packet.engineMaxRpm > 0
    ? Math.round(packet.engineMaxRpm / rpmStep) * rpmStep
    : null;
  return pi === null && rpm === null ? null : `${pi ?? '?'}:${rpm ?? '?'}`;
}

function freshProfile(carOrdinal, signature) {
  return {
    carOrdinal,
    signature,
    observedPeakRaw: 0,
    positiveSamples: 0,
    capableSamples: 0,
    capable: false,
    state: 'UNKNOWN',
    pendingState: null,
    pendingSince: null,
    version: 0
  };
}

/**
 * Learns boost behaviour independently for each FH6 car ordinal and derives a
 * display-only state. Raw boost is deliberately returned without a unit label:
 * the FH6 field's physical unit still requires real-capture validation.
 */
export class BoostStateTracker {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.profiles = new Map();
    this.activeCarOrdinal = null;
  }

  update(packet = {}, now = Date.now()) {
    const carOrdinal = Number.isSafeInteger(packet.carOrdinal) && packet.carOrdinal > 0
      ? packet.carOrdinal
      : null;
    const raw = finite(packet.boost) ? packet.boost : null;
    if (carOrdinal === null || raw === null) {
      this.activeCarOrdinal = carOrdinal;
      return this.snapshot(null, raw);
    }

    this.activeCarOrdinal = carOrdinal;
    const signature = vehicleSignature(packet, this.config.rpmSignatureStep);
    let profile = this.profiles.get(carOrdinal);
    if (!profile || (signature !== null && profile.signature !== null && signature !== profile.signature)) {
      profile = freshProfile(carOrdinal, signature);
      this.profiles.set(carOrdinal, profile);
    } else if (profile.signature === null && signature !== null) {
      profile.signature = signature;
    }

    if (raw > 0) {
      profile.positiveSamples++;
      profile.observedPeakRaw = Math.max(profile.observedPeakRaw, raw);
    }
    if (raw >= this.config.capabilityRaw) profile.capableSamples++;
    if (!profile.capable && profile.capableSamples >= this.config.capabilitySamples) profile.capable = true;

    const ratio = profile.observedPeakRaw > 0 ? raw / profile.observedPeakRaw : null;
    const target = this.targetState(profile, raw, ratio);
    this.confirmTransition(profile, target, now);
    return this.snapshot(profile, raw, ratio);
  }

  targetState(profile, raw, ratio) {
    if (!profile.capable) return 'UNKNOWN';
    const peakMature = profile.positiveSamples >= this.config.peakSamples
      && profile.observedPeakRaw >= this.config.peakMinimumRaw;

    if (profile.state === 'PEAK') {
      if (raw < this.config.activeExitRaw) return 'READY';
      return !peakMature || ratio < this.config.peakExitRatio ? 'ACTIVE' : 'PEAK';
    }
    if (profile.state === 'ACTIVE') {
      if (raw < this.config.activeExitRaw) return 'READY';
      return peakMature && ratio >= this.config.peakEnterRatio ? 'PEAK' : 'ACTIVE';
    }
    if (raw >= this.config.activeEnterRaw) {
      return peakMature && ratio >= this.config.peakEnterRatio ? 'PEAK' : 'ACTIVE';
    }
    return 'READY';
  }

  confirmTransition(profile, target, now) {
    if (target === profile.state) {
      profile.pendingState = null;
      profile.pendingSince = null;
      return;
    }
    if (profile.pendingState !== target) {
      profile.pendingState = target;
      profile.pendingSince = now;
    }
    if (now - profile.pendingSince >= this.config.confirmMs) {
      profile.state = target;
      profile.pendingState = null;
      profile.pendingSince = null;
      profile.version++;
    }
  }

  snapshot(profile = this.profiles.get(this.activeCarOrdinal), raw = null, ratio = null) {
    if (!profile) return {
      state: 'UNKNOWN', pendingState: null, raw, rawUnit: null, observedPeakRaw: null,
      ratio: null, carOrdinal: this.activeCarOrdinal, capable: false, sampleCount: 0, version: 0
    };
    const calculatedRatio = ratio ?? (raw !== null && profile.observedPeakRaw > 0
      ? raw / profile.observedPeakRaw : null);
    return {
      state: profile.state,
      pendingState: profile.pendingState,
      raw,
      rawUnit: null,
      observedPeakRaw: profile.observedPeakRaw || null,
      ratio: calculatedRatio,
      carOrdinal: profile.carOrdinal,
      capable: profile.capable,
      sampleCount: profile.positiveSamples,
      version: profile.version
    };
  }

  reset(carOrdinal = null) {
    if (carOrdinal === null) {
      this.profiles.clear();
      this.activeCarOrdinal = null;
    } else {
      this.profiles.delete(carOrdinal);
      if (this.activeCarOrdinal === carOrdinal) this.activeCarOrdinal = null;
    }
  }
}

export const BOOST_STATE_DEFAULTS = DEFAULTS;
export const BOOST_STATE_LEVEL = LEVEL;

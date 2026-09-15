const DEFAULTS = Object.freeze({ enterMs: 500, exitMs: 1200, staleMs: 1800, clockEpsilon: 0.01 });

// Pure event/activity inference. It deliberately does not mutate SessionRuntime:
// AUTO may consume confirmed output later, after real-capture validation.
export class EventDetector {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.activity = 'freeRoam';
    this.pending = null;
    this.pendingSince = null;
    this.lastAt = null;
    this.previous = null;
    this.version = 0;
    this.postRaceBlackout = false;
  }

  update(packet, now = Date.now()) {
    const finite = value => Number.isFinite(value);
    const prior = this.previous;
    const clockAdvancing = prior && finite(packet.currentRaceTime) && finite(prior.currentRaceTime)
      && packet.currentRaceTime > prior.currentRaceTime + this.config.clockEpsilon;
    const lapAdvancing = prior?.isRaceOn && finite(packet.currentLap) && finite(prior.currentLap)
      && packet.currentLap > prior.currentLap + this.config.clockEpsilon;
    const lapIncremented = prior?.isRaceOn && finite(packet.lapNumber) && finite(prior.lapNumber)
      && packet.lapNumber > prior.lapNumber;
    const ranked = finite(packet.racePosition) && packet.racePosition > 0;
    const raceEvidence = !!packet.isRaceOn && (ranked || lapAdvancing || lapIncremented);
    const worldMotion = !!prior && finite(packet.positionX) && finite(packet.positionZ)
      && finite(prior.positionX) && finite(prior.positionZ)
      && Math.hypot(packet.positionX - prior.positionX, packet.positionZ - prior.positionZ) >= 0.5;
    const distanceMotion = !!prior && finite(packet.distanceTraveled) && finite(prior.distanceTraveled)
      && packet.distanceTraveled > prior.distanceTraveled + 0.5;
    const racePositionCleared = !finite(packet.racePosition) || packet.racePosition <= 0;
    // IsRaceOn denotes active driving, including Free Roam (LapScope).
    const raceContextCleared = racePositionCleared
      && (!finite(packet.currentRaceTime) || packet.currentRaceTime <= this.config.clockEpsilon)
      && (!finite(packet.currentLap) || packet.currentLap <= this.config.clockEpsilon);
    const vehicleTelemetryReady = finite(packet.carOrdinal) && packet.carOrdinal > 0
      && finite(packet.engineMaxRpm) && packet.engineMaxRpm > 0
      && finite(packet.positionX) && finite(packet.positionZ);
    const openWorldReady = raceContextCleared && vehicleTelemetryReady;
    const zeroedVehicleFrame = !packet.isRaceOn
      && (!finite(packet.carOrdinal) || packet.carOrdinal <= 0)
      && (!finite(packet.engineMaxRpm) || packet.engineMaxRpm <= 0);
    if (this.activity === 'race' && zeroedVehicleFrame) this.postRaceBlackout = true;
    if (raceEvidence) this.postRaceBlackout = false;
    // FH6 can retain completed-race clocks after its results blackout. Once a
    // real non-race vehicle stream returns with race position cleared, that is
    // a stronger open-world boundary than the stale lap clocks.
    const postRaceVehicleReturn = this.postRaceBlackout
      && !!packet.isRaceOn && racePositionCleared && vehicleTelemetryReady && !raceEvidence;
    // Pause, rewind and the finish-line transition are neutral frames. Race only
    // exits after the game has cleared race context and the player is moving in
    // the open world again; the normal exit debounce then confirms that state.
    const freeRoamEvidence = postRaceVehicleReturn
      || (raceContextCleared && (openWorldReady || worldMotion || distanceMotion));
    const target = raceEvidence ? 'race' : freeRoamEvidence ? 'freeRoam' : this.activity;
    const evidence = { ranked, clockAdvancing: !!clockAdvancing, lapAdvancing: !!lapAdvancing, lapIncremented: !!lapIncremented, worldMotion, distanceMotion, raceContextCleared, vehicleTelemetryReady, zeroedVehicleFrame, postRaceBlackout: this.postRaceBlackout, postRaceVehicleReturn, openWorldReady, freeRoamEvidence };

    if (target === this.activity) {
      this.pending = null;
      this.pendingSince = null;
    } else {
      if (this.pending !== target) { this.pending = target; this.pendingSince = now; }
      const delay = target === 'race' ? this.config.enterMs : this.config.exitMs;
      if (now - this.pendingSince >= delay) {
        this.activity = target;
        if (target === 'freeRoam') this.postRaceBlackout = false;
        this.pending = null;
        this.pendingSince = null;
        this.version++;
      }
    }
    this.previous = {
      isRaceOn: !!packet.isRaceOn,
      currentRaceTime: packet.currentRaceTime, currentLap: packet.currentLap, lapNumber: packet.lapNumber,
      positionX: packet.positionX, positionZ: packet.positionZ, distanceTraveled: packet.distanceTraveled,
    };
    this.lastAt = now;
    return this.state(evidence);
  }

  tick(now = Date.now()) {
    if (this.lastAt !== null && now - this.lastAt >= this.config.staleMs && this.activity === 'race') {
      if (this.pending !== 'freeRoam') { this.pending = 'freeRoam'; this.pendingSince = this.lastAt + this.config.staleMs; }
      if (now - this.pendingSince >= this.config.exitMs) {
        this.activity = 'freeRoam'; this.pending = null; this.pendingSince = null; this.version++;
      }
    }
    return this.state({ stale: this.lastAt === null || now - this.lastAt >= this.config.staleMs });
  }

  state(evidence = {}) {
    return { activity: this.activity, pendingActivity: this.pending, eventVersion: this.version, evidence };
  }
}

export const EVENT_DETECTOR_DEFAULTS = DEFAULTS;

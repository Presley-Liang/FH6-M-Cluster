import { formatTime } from './export.js';
import { EventDetector } from './event-detector.js';
import { createVehicleStateController } from '../../public/js/vehicle-state-controller.js';
import { BoostStateTracker } from '../telemetry/boost-state.js';
import { randomUUID } from 'node:crypto';

// Shared by future replay/map consumers: raw arrival order is immutable;
// a rewind supersedes earlier samples at or beyond its race-time boundary.
export function effectiveTimeline(packets) {
  const result = [];
  for (const packet of packets) {
    if (packet.timelineBreak === 'rewind') {
      while (result.length && result[result.length - 1].currentRaceTime >= packet.currentRaceTime) result.pop();
    }
    result.push(packet);
  }
  return result;
}

export class SessionRuntime {
  constructor(store, { graceMs = 2500, onState = () => {}, eventDetector = new EventDetector(), liveRouteIdentifier = null, resolveRoute = () => null, vehicleStateController = createVehicleStateController(), boostStateTracker = new BoostStateTracker(), autoDriveMode = false, receiverInstanceId = randomUUID() } = {}) {
    this.store = store;
    this.graceMs = graceMs;
    this.onState = onState;
    this.driveMode = 'race';
    this.autoDriveMode = !!autoDriveMode;
    this.modeControl = this.autoDriveMode ? 'auto' : 'manual';
    this.autoModeInitialized = false;
    this.awaitingInitialRaceConfirmation = false;
    this.appliedEventVersion = 0;
    this.modeSource = 'startup';
    this.freeRoamRecording = false;
    this.version = 0;
    this.receiverInstanceId = receiverInstanceId;
    this.active = null;
    this.lastId = null;
    this.pendingSince = null;
    this.lastPacketAt = 0;
    this.lastPacket = null;
    this.saves = new Set();
    this.failed = new Map();
    this.recordingError = null;
    this.droppedPackets = 0;
    this.unattributedPackets = 0;
    this.eventDetector = eventDetector;
    this.detected = eventDetector.state();
    this.liveRouteIdentifier = liveRouteIdentifier;
    this.resolveRoute = resolveRoute;
    this.activeRoute = null;
    this.vehicleStateController = vehicleStateController;
    this.activeVehicle = vehicleStateController.state();
    this.boostStateTracker = boostStateTracker;
    this.activeBoost = boostStateTracker.snapshot();
  }
  state() {
    return {
      driveMode: this.driveMode, freeRoamRecording: this.freeRoamRecording,
      autoDriveMode: this.autoDriveMode, modeControl: this.modeControl, modeSource: this.modeSource,
      version: this.version, modeVersion: this.version, receiverInstanceId: this.receiverInstanceId,
      sessionActive: !!this.active, sessionId: this.active?.id ?? null,
      packetsRecorded: this.active?.packetCount ?? 0,
      lapsRecorded: this.active?.laps.length ?? 0,
      sessionState: this.active ? (this.pendingSince === null ? 'recording' : 'pendingClose') : this.saves.size ? 'saving' : 'idle',
      storageError: this.recordingError || this.store.error,
      storageWarning: this.store.warning,
      failedSaves: [...this.failed.keys()], droppedPackets: this.droppedPackets, unattributedPackets: this.unattributedPackets,
      detectedActivity: this.detected.activity,
      detectionEvidence: this.detected.evidence,
      pendingActivity: this.detected.pendingActivity,
      eventVersion: this.detected.eventVersion,
      activeRoute: this.activeRoute,
      activeVehicle: this.activeVehicle,
      activeBoost: this.activeBoost,
    };
  }
  changed() { this.version++; this.onState(this.state()); }
  open(packet, now) {
    this.active = {
      id: this.store.nextId(), startedAt: new Date(now).toISOString(), endedAt: null,
      carOrdinal: packet.carOrdinal, carClass: packet.carClass, carPi: packet.carPi,
      driveMode: this.driveMode, recordingType: this.driveMode === 'race' ? 'automatic' : 'manual',
      bestLap: -1, packetCount: 0, laps: [], segments: [], schemaVersion: 2,
      timelinePolicy: 'raw-arrival-order; rewind supersedes prior raceTime >= boundary',
      vehiclePolicy: 'one valid raw carOrdinal per session; presentation identity is independently debounced',
    };
    this.previousRecorded = null;
    this.pendingSince = null;
    this.store.open(this.active);
    this.changed();
  }
  close(reason = 'stop') {
    if (!this.active) return Promise.resolve();
    const snapshot = { ...this.active, endedAt: new Date().toISOString(), closeReason: reason };
    this.active = null;
    this.pendingSince = null;
    this.previousRecorded = null;
    this.lastId = snapshot.id;
    this.liveRouteIdentifier?.reset();
    this.activeRoute = null;
    const save = this.store.finalize(snapshot).catch(error => {
      this.failed.set(snapshot.id, snapshot);
      this.recordingError = error.message;
      throw error;
    });
    this.saves.add(save);
    save.then(() => this.failed.delete(snapshot.id), () => {}).finally(() => { this.saves.delete(save); this.changed(); });
    this.changed();
    return save;
  }
  transitionMode(mode, source = 'manual') {
    if (mode !== this.driveMode) {
      // Detach and persist before acknowledging; no next UDP packet required.
      const closing = this.close(source === 'auto' ? 'activity-change' : 'mode-change');
      this.driveMode = mode;
      this.modeSource = source;
      this.freeRoamRecording = false;
      this.liveRouteIdentifier?.reset();
      this.activeRoute = null;
      this.version++;
      this.changed();
      return closing;
    }
    this.modeSource = source;
    return Promise.resolve();
  }
  async setMode(mode) {
    // The legacy /mode endpoint is an explicit user selection. Keep its
    // driveMode contract while preventing detector updates from undoing it.
    const versionBefore = this.version;
    this.modeControl = 'manual';
    this.autoDriveMode = false;
    await this.transitionMode(mode, 'manual');
    if (this.version === versionBefore) { this.version++; this.changed(); }
    return this.state();
  }
  async setModeControl(modeControl) {
    if (!['auto', 'manual'].includes(modeControl)) {
      throw Object.assign(new Error('Invalid modeControl'), { status: 400 });
    }
    if (modeControl === this.modeControl) return this.state();

    const versionBefore = this.version;
    this.modeControl = modeControl;
    if (modeControl === 'auto') {
      // Resume from the detector's current settled activity. The detector has
      // continued observing packets while Manual was active.
      this.autoDriveMode = true;
      this.autoModeInitialized = true;
      this.awaitingInitialRaceConfirmation = false;
      this.appliedEventVersion = this.detected.eventVersion;
      await this.transitionMode(this.detected.activity, 'auto');
    } else {
      this.autoDriveMode = false;
      this.modeSource = 'manual';
    }
    if (this.version === versionBefore) { this.version++; this.changed(); }
    return this.state();
  }
  async setRecording(recording) {
    if (this.driveMode !== 'freeRoam') throw Object.assign(new Error('Only valid in freeRoam mode'), { status: 409 });
    if (!recording) {
      this.freeRoamRecording = false;
      await this.close('manual-stop');
    } else this.freeRoamRecording = true;
    this.version++;
    this.changed();
    return this.state();
  }
  process(packet, now = Date.now()) {
    this.lastPacketAt = now;
    this.lastPacket = packet;
    this.detected = this.eventDetector.update(packet, now);
    if (this.modeControl === 'auto') {
      let autoTarget = null;
      if (!this.autoModeInitialized) {
        // A first packet with Race evidence starts the detector's enter debounce.
        // Keep the startup Race mode so that packet still belongs to its Session.
        if (this.detected.pendingActivity === 'race') {
          this.autoModeInitialized = true;
          this.awaitingInitialRaceConfirmation = true;
        }
        else if (this.detected.pendingActivity === null) {
          this.autoModeInitialized = true;
          autoTarget = this.detected.activity;
        }
      } else if (this.awaitingInitialRaceConfirmation) {
        // The detector starts in Free Roam. Do not let a neutral pause/rewind
        // frame between the first Race packets reconcile back to that default.
        if (this.detected.activity === 'race') {
          this.awaitingInitialRaceConfirmation = false;
          this.appliedEventVersion = this.detected.eventVersion;
        }
      } else if (this.detected.pendingActivity === null) {
        // Reconcile the settled detector state on every packet. Event versions
        // describe recognition changes, but the UI mode can diverge after a
        // manual selection or a missed async transition. Limiting this to a
        // settled state preserves the Race enter/exit debounce.
        this.appliedEventVersion = this.detected.eventVersion;
        autoTarget = this.detected.activity;
      }
      if (autoTarget && autoTarget !== this.driveMode) this.transitionMode(autoTarget, 'auto').catch(error => {
          this.recordingError = error.message;
          this.changed();
        });
    }
    this.activeVehicle = this.vehicleStateController.update(packet, now);
    this.activeBoost = this.activeVehicle.status === 'locked' && this.activeVehicle.vehicle?.carOrdinal === packet.carOrdinal
      ? this.boostStateTracker.update(packet, now)
      : { state: 'UNKNOWN', pendingState: null, raw: Number.isFinite(packet.boost) ? packet.boost : null, rawUnit: null, observedPeakRaw: null, ratio: null, carOrdinal: null, capable: false, sampleCount: 0, version: 0 };
    const eligible = this.driveMode === 'freeRoam' ? this.freeRoamRecording :
      !!packet.isRaceOn && (packet.racePosition > 0 || packet.currentLap > 0);
    const rawOrdinal = Number(packet.carOrdinal);
    const knownVehicle = Number.isSafeInteger(rawOrdinal) && rawOrdinal > 0;
    const recordable = eligible && knownVehicle;
    // Archive the first valid new-car packet in its own session. The UI's
    // confirmation window must never change the ownership of raw samples.
    if (this.active && knownVehicle && this.active.carOrdinal !== rawOrdinal &&
        (recordable || this.activeVehicle.changed)) {
      this.close('car-change').catch(() => {});
      this.liveRouteIdentifier?.reset();
      this.activeRoute = null;
    }
    if (eligible && !knownVehicle) {
      this.unattributedPackets++;
      packet.recordingBoundary = 'unknown-vehicle';
      packet.timelineBreak = 'unknown-vehicle';
      if (this.active) {
        this.active.unattributedPacketCount = (this.active.unattributedPacketCount ?? 0) + 1;
        if (this.pendingSince === null) this.active.segments.push({ reason: 'unknown-vehicle', startIndex: this.active.packetCount, raceTime: packet.currentRaceTime });
      }
      // Preserve the realtime packet while excluding it from a named vehicle's
      // archive; the next valid packet receives the existing resume boundary.
    }
    if (recordable && !this.active && !this.recordingError) this.open({ ...packet, carOrdinal: rawOrdinal }, now);
    if (this.active && !recordable) {
      if (this.pendingSince === null) { this.pendingSince = now; this.changed(); }
    } else if (this.active && recordable) {
      const prior = this.previousRecorded;
      if (this.pendingSince !== null) { packet.timelineBreak = 'resume'; this.pendingSince = null; this.changed(); }
      packet.sessionId = this.active.id;
      packet.arrivalIndex = this.active.packetCount;
      packet.receivedAt = now;
      const rewind = this.driveMode === 'race' && prior && packet.currentRaceTime + 0.25 < prior.currentRaceTime;
      if (rewind) {
        packet.timelineBreak = 'rewind';
        this.active.segments.push({ reason: 'rewind', startIndex: packet.arrivalIndex, raceTime: packet.currentRaceTime, supersedesFromRaceTime: packet.currentRaceTime });
        this.active.laps = this.active.laps.filter(lap => lap.completedAtRaceTime < packet.currentRaceTime);
      } else if (prior && Math.hypot(packet.positionX - prior.positionX, packet.positionZ - prior.positionZ) > Math.max(150, (now - prior.receivedAt) / 1000 * 180)) {
        packet.timelineBreak = 'teleport';
        this.active.segments.push({ reason: 'teleport', startIndex: packet.arrivalIndex, raceTime: packet.currentRaceTime });
      }
      if (this.driveMode === 'race' && prior && !rewind && packet.lapNumber > prior.lapNumber && packet.lastLap > 0) {
        const lap = { lapNumber: prior.lapNumber, lapTime: packet.lastLap, lapTimeFormatted: formatTime(packet.lastLap), completedAtRaceTime: packet.currentRaceTime };
        this.active.laps.push(lap);
        packet.completedLap = lap;
      }
      this.active.bestLap = this.active.laps.length ? Math.min(...this.active.laps.map(lap => lap.lapTime)) : -1;
      if (this.store.append(this.active.id, packet)) {
        this.active.packetCount++;
        this.previousRecorded = packet;
        this.store.entries.get(this.active.id).meta = { ...this.active };
      } else {
        this.droppedPackets++;
        this.recordingError = this.store.error;
        this.freeRoamRecording = false;
        this.close('storage-queue-overflow').catch(() => {});
      }
    }
    // sessionId is the live context, not permission to archive this packet.
    // Unknown identity cannot own a stored sample, but a short dropout must not
    // erase the current route/ghost. A valid different car still gets its own
    // session above, or no context if that sample is ineligible.
    packet.sessionId = this.active && (!knownVehicle || this.active.carOrdinal === rawOrdinal) ? this.active.id : null;
    // Keep raw telemetry intact. Only spatial/route consumers skip unverified
    // samples, whose position/lap fields can also be menu placeholders.
    packet.routeSampleAvailable = knownVehicle;
    packet.driveMode = this.driveMode;
    packet.modeVersion = this.version;
    packet.receiverInstanceId = this.receiverInstanceId;
    packet.sessionState = this.state().sessionState;
    packet.detectedActivity = this.detected.activity;
    packet.pendingActivity = this.detected.pendingActivity;
    packet.eventVersion = this.detected.eventVersion;
    packet.activeVehicle = this.activeVehicle;
    packet.boostState = this.activeBoost;
    if (this.liveRouteIdentifier && knownVehicle) {
      const identified = this.liveRouteIdentifier.update(packet);
      const row = identified.routeCatalogKey ? this.resolveRoute(identified.routeCatalogKey) : null;
      this.activeRoute = {
        status: identified.status,
        reason: identified.reason,
        routeId: row?.id ?? null,
        routeCatalogKey: identified.routeCatalogKey,
        name: identified.routeName,
        confidence: identified.confidence?.score ?? identified.confidence ?? null,
        version: identified.matchedForSession ? 1 : 0,
      };
    }
    if (!knownVehicle && !this.active) {
      this.liveRouteIdentifier?.reset();
      this.activeRoute = null;
    }
    if (this.liveRouteIdentifier) packet.activeRoute = this.activeRoute;
    return packet;
  }
  tick(now = Date.now()) {
    this.detected = this.eventDetector.tick(now);
    if (!this.active) return;
    if (this.store.error) {
      this.recordingError = this.store.error;
      this.freeRoamRecording = false;
      this.close('storage-error').catch(() => {});
      return;
    }
    if (this.pendingSince === null && now - this.lastPacketAt >= this.graceMs) {
      this.pendingSince = this.lastPacketAt;
      this.changed();
    }
    if (this.pendingSince !== null && now - this.pendingSince >= this.graceMs) this.close('inactivity').catch(() => {});
  }
  async exportData() {
    const id = this.active?.id ?? this.lastId;
    if (id == null) return null;
    const raw = await this.store.read(id);
    return raw && this.active?.id === id ? { ...raw, ...this.active, packets: raw.packets, packetCount: raw.packets.length } : raw;
  }
  async retry() {
    await this.store.prepareRetry();
    await this.store.flushAll();
    for (const [id, snapshot] of this.failed) { await this.store.finalize(snapshot); this.failed.delete(id); }
    this.recordingError = null;
    this.store.error = null;
    this.changed();
    return this.state();
  }
  async shutdown() {
    try { await this.close('shutdown'); await Promise.allSettled([...this.saves]); }
    finally { await this.store.shutdown(); }
  }
}

// Stable vehicle identity for both SessionRuntime and the browser presentation layer.
export function createVehicleStateController({ confirmFrames = 4, confirmMs = 150 } = {}) {
  let locked = null, candidate = null, vehicleVersion = 0;
  const validOrdinal = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const snapshot = packet => ({
    carOrdinal: Number(packet.carOrdinal),
    engineMaxRpm: Number.isFinite(packet.engineMaxRpm) && packet.engineMaxRpm > 0 ? packet.engineMaxRpm : null,
    engineIdleRpm: Number.isFinite(packet.engineIdleRpm) && packet.engineIdleRpm >= 0 ? packet.engineIdleRpm : null,
    carClass: Number.isFinite(packet.carClass) ? packet.carClass : null,
    carPi: Number.isFinite(packet.carPi) ? packet.carPi : null,
    drivetrainType: Number.isFinite(packet.drivetrainType) ? packet.drivetrainType : null,
  });
  function state(status = locked ? 'locked' : candidate ? 'locking' : 'unlocked', changed = false) {
    return { status, changed, vehicleVersion, vehicle: status === 'locked' ? locked : null, candidateOrdinal: candidate?.value.carOrdinal ?? null };
  }
  function update(packet = {}, nowMs = Date.now()) {
    const now = Number(nowMs);
    if (!validOrdinal(packet.carOrdinal) || !Number.isFinite(now)) return state();
    const value = snapshot(packet);
    if (locked?.carOrdinal === value.carOrdinal) {
      candidate = null;
      locked = { ...locked, ...value, engineMaxRpm: value.engineMaxRpm ?? locked.engineMaxRpm, engineIdleRpm: value.engineIdleRpm ?? locked.engineIdleRpm };
      return state('locked');
    }
    if (!candidate || candidate.value.carOrdinal !== value.carOrdinal) candidate = { value, frames: 1, since: now };
    else { candidate.value = value; candidate.frames++; }
    const status = locked ? 'changing' : 'locking';
    if (candidate.frames < confirmFrames || now - candidate.since < confirmMs) return state(status);
    locked = candidate.value; candidate = null; vehicleVersion++;
    return state('locked', true);
  }
  return { update, state, reset() { locked = null; candidate = null; vehicleVersion = 0; return state(); } };
}

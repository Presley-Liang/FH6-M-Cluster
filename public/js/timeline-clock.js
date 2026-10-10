// This function is self-contained so the server can embed its source in the
// replay page. Streaming callers may retain `state`; no packet array is kept.
export function buildElapsedTimeline(packets, { fallbackStepMs = 0, state = {} } = {}) {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const timestamp = value => finite(value) && value >= 0 && value <= 0xffffffff ? value : null;
  const arrival = value => finite(value) && value >= 0 ? value : null;
  if (!finite(state.elapsedMs)) state.elapsedMs = 0;
  if (!Number.isInteger(state.segment)) state.segment = 0;
  const result = [];
  for (const packet of packets) {
    const current = { timestampMs: timestamp(packet.timestampMs), receivedAt: arrival(packet.receivedAt) };
    const previous = state.previous;
    let deltaMs = 0, source = 'origin', discontinuity = null;
    if (previous) {
      let timestampDelta = null;
      if (current.timestampMs !== null && previous.timestampMs !== null) {
        timestampDelta = current.timestampMs - previous.timestampMs;
        if (timestampDelta < 0) {
          if (previous.timestampMs >= 0xf0000000 && current.timestampMs <= 0x0fffffff) {
            timestampDelta += 0x100000000;
            discontinuity = 'timestamp-wrap';
          } else {
            timestampDelta = null;
            discontinuity = 'timestamp-reset-or-backtrack';
          }
        }
      }
      const arrivalDelta = current.receivedAt !== null && previous.receivedAt !== null
        ? current.receivedAt - previous.receivedAt : null;
      if (arrivalDelta !== null && arrivalDelta >= 0) {
        // Actual packet arrival time includes pauses and uses neither assumed
        // frame rate nor a game clock that can rewind/reset.
        deltaMs = arrivalDelta;
        source = 'receivedAt';
      } else if (timestampDelta !== null) {
        deltaMs = timestampDelta;
        source = 'timestampMs';
      } else if (finite(fallbackStepMs) && fallbackStepMs > 0) {
        deltaMs = fallbackStepMs;
        source = 'fallback-step';
      } else source = 'unknown';
      if (arrivalDelta !== null && arrivalDelta < 0) discontinuity ??= 'received-clock-backtrack';
      if (discontinuity) state.segment++;
    }
    state.elapsedMs += Math.max(0, deltaMs);
    state.previous = current;
    result.push({ elapsedMs: state.elapsedMs, deltaMs, segment: state.segment, discontinuity, source });
  }
  return result;
}

export function createElapsedTimeline(options = {}) {
  const state = {};
  return {
    update(packet) { return buildElapsedTimeline([packet], { ...options, state })[0]; },
    snapshot() { return { elapsedMs: state.elapsedMs ?? 0, segment: state.segment ?? 0 }; },
  };
}

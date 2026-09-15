const finite = Number.isFinite;

function makeBounds() {
  return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
}

function publicBounds(bounds) {
  return finite(bounds.minX)
    ? {
        minX: Object.is(bounds.minX, -0) ? 0 : bounds.minX,
        minZ: Object.is(bounds.minZ, -0) ? 0 : bounds.minZ,
        maxX: Object.is(bounds.maxX, -0) ? 0 : bounds.maxX,
        maxZ: Object.is(bounds.maxZ, -0) ? 0 : bounds.maxZ,
      }
    : null;
}

function updateBounds(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minZ = Math.min(bounds.minZ, point.z);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxZ = Math.max(bounds.maxZ, point.z);
}

/**
 * Bounded, renderer-independent storage for a single active FH6 track.
 *
 * `push(packet, context)` returns a small `delta` for incremental rendering.
 * A renderer only needs to clear on `reset`, finish its polyline on `break`,
 * and append the supplied point on `append`/`start-segment`.
 */
export function createTrackBuffer(options = {}) {
  const maxPoints = Math.max(2, Math.floor(options.maxPoints ?? 6000));
  const minDistance = Math.max(0, options.minDistance ?? 1.5);
  const teleportDistance = Math.max(minDistance, options.teleportDistance ?? 500);
  const maxGapMs = Math.max(0, options.maxGapMs ?? 2500);

  let mode = null;
  let sessionId = null;
  let lap = null;
  let segments = [];
  let pointCount = 0;
  let lastPoint = null;
  let pendingBreak = null;
  let bounds = makeBounds();
  let segmentSequence = 0;

  const snapshot = (delta = { type: 'noop' }) => ({
    mode,
    sessionId,
    lap,
    pointCount,
    segments: segments.map((segment) => ({ id: segment.id, points: segment.points })),
    sessionBounds: publicBounds(bounds),
    delta,
  });

  const resetLap = (nextLap, reason) => {
    lap = nextLap;
    segments = [];
    pointCount = 0;
    lastPoint = null;
    pendingBreak = null;
    return { type: 'reset', reason };
  };

  const resetSession = (nextMode, nextSessionId) => {
    mode = nextMode;
    sessionId = nextSessionId;
    bounds = makeBounds();
    segmentSequence = 0;
    return resetLap(null, 'session');
  };

  function trim() {
    while (pointCount > maxPoints && segments.length) {
      const first = segments[0];
      first.points.shift();
      pointCount -= 1;
      if (!first.points.length) segments.shift();
    }
  }

  function breakTrack(reason) {
    if (!pendingBreak) pendingBreak = reason;
    lastPoint = null;
    return snapshot({ type: 'break', reason: pendingBreak });
  }

  function push(packet, context = {}) {
    const nextMode = context.mode ?? 'unknown';
    const nextSessionId = context.sessionId ?? 'default';
    const nextLap = context.lap ?? 0;
    let resetDelta = null;

    if (mode !== nextMode || sessionId !== nextSessionId) {
      resetDelta = resetSession(nextMode, nextSessionId);
    }
    if (lap !== nextLap) resetDelta = resetLap(nextLap, lap === null ? 'initial-lap' : 'lap');

    const explicitBreak = context.timelineBreak ? 'timeline-break'
      : context.rewind ? 'rewind'
        : context.teleport ? 'teleport'
          : context.disconnected ? 'disconnect'
            : null;
    if (explicitBreak) return breakTrack(explicitBreak);

    const x = packet?.positionX ?? packet?.x;
    const z = packet?.positionZ ?? packet?.z;
    const timestamp = packet?.timestamp ?? context.timestamp ?? Date.now();
    if (!finite(x) || !finite(z) || !finite(timestamp)) {
      return snapshot({ type: 'noop', reason: 'invalid-point', resetReason: resetDelta?.reason ?? null });
    }

    const distance = lastPoint ? Math.hypot(x - lastPoint.x, z - lastPoint.z) : Infinity;
    const elapsed = lastPoint ? timestamp - lastPoint.timestamp : 0;
    if (lastPoint && (elapsed < 0 || elapsed > maxGapMs)) pendingBreak = elapsed < 0 ? 'rewind' : 'disconnect';
    if (lastPoint && distance > teleportDistance) pendingBreak = 'teleport';
    if (lastPoint && !pendingBreak && distance < minDistance) {
      return snapshot(resetDelta ?? { type: 'noop', reason: 'min-distance' });
    }

    const point = Object.freeze({ x, z, timestamp });
    let segment = segments.at(-1);
    const startsSegment = !segment || pendingBreak;
    const breakReason = pendingBreak;
    if (startsSegment) {
      segment = { id: ++segmentSequence, points: [] };
      segments.push(segment);
    }
    segment.points.push(point);
    pointCount += 1;
    lastPoint = point;
    pendingBreak = null;
    updateBounds(bounds, point);
    trim();

    return snapshot({
      type: startsSegment ? 'start-segment' : 'append',
      segmentId: segment.id,
      point,
      breakReason,
      resetReason: resetDelta?.reason ?? null,
    });
  }

  return {
    push,
    break: breakTrack,
    clear() {
      const currentMode = mode;
      const currentSession = sessionId;
      resetSession(currentMode, currentSession);
      return snapshot({ type: 'reset', reason: 'clear' });
    },
    getState: () => snapshot(),
  };
}

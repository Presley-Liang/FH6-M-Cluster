const finite = value => Number.isFinite(Number(value));

const emptyFingerprint = (lapNumber = null, reasons = []) => ({
  lapNumber,
  startX: null,
  startZ: null,
  distanceSignature: null,
  spanX: null,
  spanZ: null,
  sampleCount: 0,
  valid: false,
  reasons,
});

/**
 * Reconstruct the effective race timeline without mutating arrival history.
 * A rewind packet replaces samples at and after its race-time boundary. The
 * returned packet is retained because it is the first valid sample after the
 * rewind; only the superseded future is discarded.
 */
export function effectiveFingerprintTimeline(packets = []) {
  const result = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== 'object') continue;
    if (packet.timelineBreak === 'rewind' && finite(packet.currentRaceTime)) {
      const boundary = Number(packet.currentRaceTime);
      while (result.length) {
        const priorTime = Number(result[result.length - 1].currentRaceTime);
        if (!Number.isFinite(priorTime) || priorTime < boundary) break;
        result.pop();
      }
    }
    result.push(packet);
  }
  return result;
}

function completedLapNumbers(packets, completedLaps) {
  const completed = new Set(
    (completedLaps || []).filter(lap => finite(lap?.lapNumber)).map(lap => Number(lap.lapNumber)),
  );
  for (let index = 1; index < packets.length; index++) {
    const prior = packets[index - 1];
    const packet = packets[index];
    if (packet.timelineBreak === 'rewind') continue;
    if (finite(prior.lapNumber) && finite(packet.lapNumber)
      && Number(packet.lapNumber) > Number(prior.lapNumber)) {
      completed.add(Number(prior.lapNumber));
    }
    if (finite(packet.completedLap?.lapNumber)) completed.add(Number(packet.completedLap.lapNumber));
  }
  return completed;
}

/**
 * Produce one route-fingerprint candidate per completed lap.
 *
 * FH6 DistanceTraveled is a route-normalized progress value (normally about
 * 5950 at a finish), not physical metres. It is therefore used only as the
 * lap's progress range; position extents provide the distinguishing shape.
 */
export function extractLapFingerprints(packets = [], {
  completedLaps = [],
  minSamples = 8,
  minDistanceSignature = 1,
} = {}) {
  const timeline = effectiveFingerprintTimeline(packets);
  const completed = completedLapNumbers(timeline, completedLaps);
  const groups = new Map();

  for (const packet of timeline) {
    if (!finite(packet.lapNumber)) continue;
    const lapNumber = Number(packet.lapNumber);
    let group = groups.get(lapNumber);
    if (!group) {
      group = { lapNumber, packets: [], contaminated: new Set(), rejectedSamples: 0 };
      groups.set(lapNumber, group);
    }
    if (packet.timelineBreak === 'teleport') group.contaminated.add('teleport');
    if (!finite(packet.positionX) || !finite(packet.positionZ) || !finite(packet.distanceTraveled)) {
      group.rejectedSamples++;
      continue;
    }
    group.packets.push(packet);
  }

  return [...groups.values()].sort((a, b) => a.lapNumber - b.lapNumber).map(group => {
    const reasons = [];
    if (!completed.has(group.lapNumber)) reasons.push('incomplete');
    if (group.contaminated.has('teleport')) reasons.push('teleport');
    if (group.packets.length < minSamples) reasons.push('too-few-samples');
    if (!group.packets.length) {
      const result = emptyFingerprint(group.lapNumber, reasons.length ? reasons : ['no-finite-samples']);
      result.rejectedSamples = group.rejectedSamples;
      return result;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let minDistance = Infinity, maxDistance = -Infinity;
    for (const packet of group.packets) {
      const x = Number(packet.positionX), z = Number(packet.positionZ);
      const distance = Number(packet.distanceTraveled);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      minDistance = Math.min(minDistance, distance); maxDistance = Math.max(maxDistance, distance);
    }
    const distanceSignature = maxDistance - minDistance;
    if (distanceSignature < minDistanceSignature) reasons.push('insufficient-progress');
    return {
      lapNumber: group.lapNumber,
      startX: Number(group.packets[0].positionX),
      startZ: Number(group.packets[0].positionZ),
      distanceSignature,
      spanX: maxX - minX,
      spanZ: maxZ - minZ,
      sampleCount: group.packets.length,
      rejectedSamples: group.rejectedSamples,
      valid: reasons.length === 0,
      reasons,
    };
  });
}

/** Select the first complete, uncontaminated lap suitable for route matching. */
export function extractRouteFingerprint(packets = [], options = {}) {
  const laps = extractLapFingerprints(packets, options);
  const fingerprint = laps.find(lap => lap.valid);
  return fingerprint || { ...emptyFingerprint(null, ['no-valid-completed-lap']), laps };
}

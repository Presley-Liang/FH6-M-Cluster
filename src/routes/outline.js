import { effectiveFingerprintTimeline, extractLapFingerprints } from './fingerprint.js';

const finite = value => Number.isFinite(Number(value));

function limitPoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const limited = [];
  for (let index = 0; index < maxPoints; index++) {
    const sourceIndex = Math.round(index * (points.length - 1) / (maxPoints - 1));
    limited.push(points[sourceIndex]);
  }
  return limited;
}

/**
 * Build a compact, screen-space route outline from one valid completed lap.
 *
 * The output is a JSON-serializable flat integer array:
 * [x0, y0, x1, y1, ...], normalized into a 0..box square. Z is flipped so
 * the result can be placed directly into an SVG/canvas screen coordinate
 * system. Invalid, incomplete, teleported, or stationary captures fail closed.
 */
export function extractRouteOutline(packets = [], {
  completedLaps = [],
  lapNumber = null,
  minSamples = 8,
  minDistanceSignature = 1,
  minSpan = 1,
  box = 1000,
  detail = 150,
  maxPoints = 600,
} = {}) {
  if (!Array.isArray(packets)
    || !Number.isInteger(box) || box < 1
    || !Number.isInteger(detail) || detail < 1
    || !Number.isInteger(maxPoints) || maxPoints < 2
    || !Number.isInteger(minSamples) || minSamples < 2
    || !finite(minSpan) || Number(minSpan) <= 0) return null;

  const laps = extractLapFingerprints(packets, {
    completedLaps,
    minSamples,
    minDistanceSignature,
  });
  const selected = lapNumber == null
    ? laps.find(lap => lap.valid)
    : laps.find(lap => lap.valid && lap.lapNumber === Number(lapNumber));
  if (!selected) return null;

  const points = effectiveFingerprintTimeline(packets)
    .filter(packet => Number(packet?.lapNumber) === selected.lapNumber)
    .filter(packet => finite(packet?.positionX)
      && finite(packet?.positionZ)
      && finite(packet?.distanceTraveled))
    .map(packet => [Number(packet.positionX), -Number(packet.positionZ)]);
  if (points.length < minSamples) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(span) || span < Number(minSpan)) return null;

  // Distance-based sampling avoids over-representing time spent stationary.
  const spacing = span / detail;
  const kept = [points[0]];
  for (const point of points.slice(1, -1)) {
    if (Math.hypot(point[0] - kept.at(-1)[0], point[1] - kept.at(-1)[1]) >= spacing) {
      kept.push(point);
    }
  }
  const finalPoint = points.at(-1);
  if (kept.at(-1)[0] !== finalPoint[0] || kept.at(-1)[1] !== finalPoint[1]) kept.push(finalPoint);

  const sampled = limitPoints(kept, maxPoints);
  const scale = box / span;
  const outline = [];
  for (const [x, y] of sampled) {
    outline.push(
      Math.max(0, Math.min(box, Math.round((x - minX) * scale))),
      Math.max(0, Math.min(box, Math.round((y - minY) * scale))),
    );
  }
  return outline.length >= 4 && outline.every(Number.isInteger) ? outline : null;
}

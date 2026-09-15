/**
 * Built-in FH6 Japan two-point calibration.
 *
 * Pixel coordinates use the standard XYZ convention: origin at the top-left,
 * X grows right and Y grows down. `referenceZoom` is the zoom level at which
 * those full-resolution pixels were measured.
 */
export const DEFAULT_CALIBRATION = Object.freeze({
  referenceZoom: 14,
  points: Object.freeze([
    Object.freeze({
      world: Object.freeze([-119.49154, 3888.595]),
      pixel: Object.freeze([2089486, 2087415]),
    }),
    Object.freeze({
      world: Object.freeze([-7104.7695, -1863.08]),
      pixel: Object.freeze([2086885, 2089556]),
    }),
  ]),
});

const isFinitePair = (value) =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

/** Return whether a value is a usable independent-axis two-point calibration. */
export function validateCalibration(calibration) {
  if (!calibration || !Number.isInteger(calibration.referenceZoom) || calibration.referenceZoom < 0) {
    return false;
  }
  if (!Array.isArray(calibration.points) || calibration.points.length !== 2) return false;

  const [a, b] = calibration.points;
  if (!isFinitePair(a?.world) || !isFinitePair(a?.pixel)) return false;
  if (!isFinitePair(b?.world) || !isFinitePair(b?.pixel)) return false;

  // The fit is independent per axis: world X -> pixel X, world Z -> pixel Y.
  return a.world[0] !== b.world[0] && a.world[1] !== b.world[1];
}

/**
 * Build a world-position projector for the y-down CRS.Simple map.
 *
 * The returned function accepts `(worldX, worldZ)` (or `{x, z}`) and returns:
 * - `pixel`: full-resolution XYZ pixels at `referenceZoom` (Y grows down)
 * - `normalized`: pixels divided by `2 ** referenceZoom`
 * - `latLng`: the matching Leaflet value for CRS.Simple configured y-down;
 *   normalized Y is `lat` and normalized X is `lng`.
 */
export function createWorldToMap(calibration = DEFAULT_CALIBRATION) {
  if (!validateCalibration(calibration)) {
    throw new TypeError('Invalid map calibration');
  }

  const [a, b] = calibration.points;
  const xSlope = (b.pixel[0] - a.pixel[0]) / (b.world[0] - a.world[0]);
  const ySlope = (b.pixel[1] - a.pixel[1]) / (b.world[1] - a.world[1]);
  const xOffset = a.pixel[0] - xSlope * a.world[0];
  const yOffset = a.pixel[1] - ySlope * a.world[1];
  const scale = 2 ** calibration.referenceZoom;

  return function worldToMap(worldX, worldZ) {
    if (worldX && typeof worldX === 'object') {
      worldZ = worldX.z;
      worldX = worldX.x;
    }
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      throw new TypeError('World coordinates must be finite numbers');
    }

    const pixelX = xSlope * worldX + xOffset;
    const pixelY = ySlope * worldZ + yOffset;
    const normalizedX = pixelX / scale;
    const normalizedY = pixelY / scale;

    return {
      pixel: { x: pixelX, y: pixelY },
      normalized: { x: normalizedX, y: normalizedY },
      latLng: { lat: normalizedY, lng: normalizedX },
    };
  };
}

/** Normalize a finite heading in degrees into the half-open range [0, 360). */
export function normalizeHeading(degrees) {
  if (!Number.isFinite(degrees)) throw new TypeError('Heading must be a finite number');
  return ((degrees % 360) + 360) % 360;
}

/** Return the shortest signed turn from `from` to `to`, in [-180, 180). */
export function shortestHeadingDelta(from, to) {
  return normalizeHeading(to - from + 180) - 180;
}

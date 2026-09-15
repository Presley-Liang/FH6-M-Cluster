export const TRACK_MATCH_THRESHOLDS = Object.freeze({
  startRadius: 120,
  distanceFraction: 0.05,
  spanFraction: 0.15,
  spanFloor: 50,
});

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeFingerprint(value) {
  const issues = [];
  if (!value || typeof value !== 'object') {
    return { issues: ['fingerprint must be an object'] };
  }

  const start = value.start;
  const span = value.span;
  const distance = value.distance;
  if (!start || !finite(start.x) || !finite(start.z)) issues.push('start.x and start.z must be finite');
  if (!finite(distance) || distance <= 0) issues.push('distance must be finite and greater than zero');
  if (!span || !finite(span.x) || span.x <= 0 || !finite(span.z) || span.z <= 0) {
    issues.push('span.x and span.z must be finite and greater than zero');
  }
  return { fingerprint: { start, distance, span }, issues };
}

function thresholdMargin(actual, limit) {
  return Math.max(0, Math.min(1, 1 - (actual / limit)));
}

function within(actual, limit) {
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(limit)) * 8;
  return actual <= limit + epsilon;
}

function diagnose(route, fingerprint, thresholds) {
  const startDistance = Math.hypot(
    fingerprint.start.x - route.start.x,
    fingerprint.start.z - route.start.z,
  );
  const distanceDelta = Math.abs(fingerprint.distance - route.distance);
  const distanceLimit = thresholds.distanceFraction * route.distance;
  const spanDeltaX = Math.abs(fingerprint.span.x - route.span.x);
  const spanDeltaZ = Math.abs(fingerprint.span.z - route.span.z);
  const spanLimitX = Math.max(
    thresholds.spanFraction * Math.max(fingerprint.span.x, route.span.x),
    thresholds.spanFloor,
  );
  const spanLimitZ = Math.max(
    thresholds.spanFraction * Math.max(fingerprint.span.z, route.span.z),
    thresholds.spanFloor,
  );
  const checks = {
    start: within(startDistance, thresholds.startRadius),
    distance: within(distanceDelta, distanceLimit),
    spanX: within(spanDeltaX, spanLimitX),
    spanZ: within(spanDeltaZ, spanLimitZ),
  };
  const components = {
    start: thresholdMargin(startDistance, thresholds.startRadius),
    distance: thresholdMargin(distanceDelta, distanceLimit),
    spanX: thresholdMargin(spanDeltaX, spanLimitX),
    spanZ: thresholdMargin(spanDeltaZ, spanLimitZ),
  };

  return {
    route,
    eligible: Object.values(checks).every(Boolean),
    checks,
    measurements: {
      startDistance,
      distanceDelta,
      distanceLimit,
      spanDelta: { x: spanDeltaX, z: spanDeltaZ },
      spanLimit: { x: spanLimitX, z: spanLimitZ },
    },
    confidence: {
      score: Math.min(...Object.values(components)),
      components,
      method: 'minimum normalized margin to the four eligibility thresholds',
    },
  };
}

/**
 * Match one completed-lap fingerprint against a normalized track catalogue.
 * This is deliberately deterministic and side-effect free. A second eligible
 * route makes the result ambiguous: an unnamed route is safer than a guess.
 */
export function matchTrackFingerprint(fingerprintInput, catalog, options = {}) {
  const normalized = normalizeFingerprint(fingerprintInput);
  if (normalized.issues.length) {
    return {
      status: 'unknown',
      reason: 'invalid-fingerprint',
      issues: normalized.issues,
      match: null,
      candidates: [],
    };
  }

  const routes = Array.isArray(catalog) ? catalog : catalog?.routes;
  if (!Array.isArray(routes)) throw new TypeError('catalog must expose a routes array');
  const thresholds = { ...TRACK_MATCH_THRESHOLDS, ...options.thresholds };
  const diagnostics = routes.map((route) => diagnose(route, normalized.fingerprint, thresholds));
  const eligible = diagnostics.filter((candidate) => candidate.eligible);

  if (eligible.length === 1) {
    return {
      status: 'matched',
      reason: 'single-eligible-candidate',
      match: eligible[0].route,
      confidence: eligible[0].confidence,
      candidates: eligible,
      diagnostics,
      thresholds,
    };
  }
  if (eligible.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'multiple-eligible-candidates',
      match: null,
      confidence: null,
      candidates: eligible,
      diagnostics,
      thresholds,
    };
  }
  return {
    status: 'unknown',
    reason: 'no-eligible-candidate',
    match: null,
    confidence: null,
    candidates: [],
    diagnostics,
    thresholds,
  };
}

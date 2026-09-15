import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TRACK_CATALOG_VERSION = 1;
export const TRACK_CATALOG_GAME = 'fh6';
export const EXPECTED_TRACK_COUNT = 77;
export const TRACK_KINDS = Object.freeze(['circuit', 'sprint']);
const sourceCatalogUrl = (() => {
  try { return new URL('../../assets/data/track-catalog.json', import.meta.url); }
  catch { return null; }
})();
// SEA runs from the copied executable; resolve bundled resources beside it.
export const DEFAULT_TRACK_CATALOG_URL = process.versions.sea || !sourceCatalogUrl
  ? pathToFileURL(path.resolve(path.dirname(process.execPath), 'assets/data/track-catalog.json'))
  : sourceCatalogUrl;

export class TrackCatalogValidationError extends Error {
  constructor(issues) {
    super(`Invalid FH6 track catalog (${issues.length} issue${issues.length === 1 ? '' : 's'})`);
    this.name = 'TrackCatalogValidationError';
    this.code = 'ERR_FH6_TRACK_CATALOG';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

function issue(path, code, message, value) {
  return { path, code, message, value };
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validatePair(value, path, issues, { positive = false } = {}) {
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push(issue(path, 'invalid_pair', 'must be an array containing exactly two numbers', value));
    return null;
  }

  value.forEach((component, index) => {
    if (!finiteNumber(component)) {
      issues.push(issue(`${path}[${index}]`, 'invalid_number', 'must be a finite number', component));
    } else if (positive && component <= 0) {
      issues.push(issue(`${path}[${index}]`, 'non_positive', 'must be greater than zero', component));
    }
  });

  return value.every((component) => finiteNumber(component) && (!positive || component > 0))
    ? value
    : null;
}

/**
 * Validate and normalize the bundled LapScope route catalogue.
 *
 * This module intentionally performs no route matching. It only provides the
 * stable fingerprint fields needed by the later P8 matcher.
 */
export function parseTrackCatalog(input, { expectedCount = EXPECTED_TRACK_COUNT } = {}) {
  let raw;
  const issues = [];

  try {
    raw = typeof input === 'string' || Buffer.isBuffer(input)
      ? JSON.parse(input.toString())
      : input;
  } catch (error) {
    throw new TrackCatalogValidationError([
      issue('$', 'invalid_json', error.message, undefined),
    ]);
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TrackCatalogValidationError([
      issue('$', 'invalid_root', 'must be a JSON object', raw),
    ]);
  }

  if (raw.version !== TRACK_CATALOG_VERSION) {
    issues.push(issue('version', 'unsupported_version', `must equal ${TRACK_CATALOG_VERSION}`, raw.version));
  }
  if (raw.game !== TRACK_CATALOG_GAME) {
    issues.push(issue('game', 'unsupported_game', `must equal ${TRACK_CATALOG_GAME}`, raw.game));
  }
  if (!Array.isArray(raw.routes)) {
    issues.push(issue('routes', 'invalid_routes', 'must be an array', raw.routes));
    throw new TrackCatalogValidationError(issues);
  }
  if (expectedCount != null && raw.routes.length !== expectedCount) {
    issues.push(issue('routes', 'unexpected_count', `must contain exactly ${expectedCount} routes`, raw.routes.length));
  }

  const ids = new Set();
  const routes = raw.routes.map((route, index) => {
    const base = `routes[${index}]`;
    if (!route || typeof route !== 'object' || Array.isArray(route)) {
      issues.push(issue(base, 'invalid_route', 'must be an object', route));
      return null;
    }

    const id = typeof route.key === 'string' ? route.key.trim() : '';
    const name = typeof route.name === 'string' ? route.name.trim() : '';
    if (!id) {
      issues.push(issue(`${base}.key`, 'invalid_id', 'must be a non-empty string', route.key));
    } else if (ids.has(id)) {
      issues.push(issue(`${base}.key`, 'duplicate_id', `duplicates stable id ${JSON.stringify(id)}`, id));
    } else {
      ids.add(id);
    }
    if (!name || name.length > 80) {
      issues.push(issue(`${base}.name`, 'invalid_name', 'must contain 1-80 characters', route.name));
    }
    if (!TRACK_KINDS.includes(route.kind)) {
      issues.push(issue(`${base}.kind`, 'invalid_kind', `must be one of ${TRACK_KINDS.join(', ')}`, route.kind));
    }

    const start = validatePair(route.start, `${base}.start`, issues);
    const span = validatePair(route.span, `${base}.span`, issues, { positive: true });
    if (!finiteNumber(route.length)) {
      issues.push(issue(`${base}.length`, 'invalid_number', 'must be a finite number', route.length));
    } else if (route.length <= 0) {
      issues.push(issue(`${base}.length`, 'non_positive', 'must be greater than zero', route.length));
    }

    if (!id || !name || name.length > 80 || !TRACK_KINDS.includes(route.kind)
      || !start || !span || !finiteNumber(route.length) || route.length <= 0) {
      return null;
    }

    return Object.freeze({
      id,
      name,
      kind: route.kind,
      start: Object.freeze({ x: start[0], z: start[1] }),
      distance: route.length,
      span: Object.freeze({ x: span[0], z: span[1] }),
    });
  });

  if (issues.length) throw new TrackCatalogValidationError(issues);

  const frozenRoutes = Object.freeze(routes);
  return Object.freeze({
    version: raw.version,
    game: raw.game,
    count: frozenRoutes.length,
    routes: frozenRoutes,
    byId: Object.freeze(Object.fromEntries(frozenRoutes.map((route) => [route.id, route]))),
  });
}

export function loadTrackCatalog(source = DEFAULT_TRACK_CATALOG_URL, options) {
  return parseTrackCatalog(readFileSync(source, 'utf8'), options);
}

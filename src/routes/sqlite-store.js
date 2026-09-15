const SCHEMA_VERSION = 1;

const MIGRATIONS = new Map([
  [1, [
    `CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY,
      catalog_key TEXT UNIQUE,
      name TEXT,
      source TEXT NOT NULL,
      catalog_version TEXT,
      kind TEXT,
      start_x REAL NOT NULL,
      start_z REAL NOT NULL,
      distance_signature REAL NOT NULL,
      span_x REAL,
      span_z REAL,
      outline_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_routes_start ON routes(start_x, start_z)`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      drive_mode TEXT NOT NULL,
      recording_type TEXT,
      car_ordinal INTEGER,
      car_class INTEGER,
      car_pi INTEGER,
      drivetrain_type INTEGER,
      raw_recording_path TEXT,
      route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
      backfill_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_route ON sessions(route_id)`,
    `CREATE TABLE IF NOT EXISTS laps (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      lap_number INTEGER NOT NULL,
      lap_time REAL,
      started_race_time REAL,
      ended_race_time REAL,
      distance_signature REAL,
      start_x REAL,
      start_z REAL,
      span_x REAL,
      span_z REAL,
      flags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id, lap_number)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id)`,
    `CREATE TABLE IF NOT EXISTS route_matches (
      session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('matched', 'ambiguous', 'unknown')),
      confidence REAL,
      method TEXT NOT NULL,
      matcher_version INTEGER NOT NULL,
      candidates_json TEXT,
      matched_at TEXT NOT NULL
    )`,
  ]],
]);

function json(value) {
  return value == null ? null : JSON.stringify(value);
}

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function assertOneOf(value, values, label) {
  if (!values.includes(value)) throw new TypeError(`${label} must be one of: ${values.join(', ')}`);
}

export class RouteIndexStore {
  constructor(database, { clock = Date.now, migrations = MIGRATIONS } = {}) {
    this.database = database;
    this.clock = clock;
    this.migrations = migrations;
    this.inTransaction = false;
    this.closed = false;
    this.initialize();
  }

  initialize() {
    this.database.exec('PRAGMA foreign_keys = ON');
    this.database.exec('PRAGMA journal_mode = WAL');
    const current = Number(this.database.prepare('PRAGMA user_version').get().user_version);
    if (current > SCHEMA_VERSION) {
      throw new Error(`Route database schema v${current} is newer than supported v${SCHEMA_VERSION}`);
    }
    for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
      const statements = this.migrations.get(version);
      if (!statements) throw new Error(`Missing route database migration v${version}`);
      this.transaction(() => {
        for (const statement of statements) this.database.exec(statement);
        this.database.exec(`PRAGMA user_version = ${version}`);
      });
    }
  }

  transaction(work) {
    if (this.inTransaction) throw new Error('RouteIndexStore transactions cannot nest');
    this.inTransaction = true;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = work(this);
      if (result && typeof result.then === 'function') {
        throw new TypeError('RouteIndexStore transaction callback must be synchronous');
      }
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  upsertRoute(route) {
    if (!route.catalogKey || typeof route.catalogKey !== 'string') {
      throw new TypeError('catalogKey is required; observed routes must use a stable derived key');
    }
    if (!route.source || typeof route.source !== 'string') throw new TypeError('source is required');
    const timestamp = nowIso(this.clock);
    const result = this.database.prepare(`
      INSERT INTO routes (
        catalog_key, name, source, catalog_version, kind, start_x, start_z,
        distance_signature, span_x, span_z, outline_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(catalog_key) DO UPDATE SET
        name=excluded.name, source=excluded.source,
        catalog_version=excluded.catalog_version, kind=excluded.kind,
        start_x=excluded.start_x, start_z=excluded.start_z,
        distance_signature=excluded.distance_signature,
        span_x=excluded.span_x, span_z=excluded.span_z,
        outline_json=COALESCE(excluded.outline_json, routes.outline_json), updated_at=excluded.updated_at
      RETURNING id
    `).get(
      route.catalogKey ?? null, route.name ?? null, route.source,
      route.catalogVersion ?? null, route.kind ?? null,
      route.startX, route.startZ, route.distanceSignature,
      route.spanX ?? null, route.spanZ ?? null, json(route.outline),
      timestamp, timestamp,
    );
    return Number(result.id);
  }

  getRoute(id) {
    return this.database.prepare('SELECT * FROM routes WHERE id = ?').get(id) ?? null;
  }

  getRouteByCatalogKey(catalogKey) {
    return this.database.prepare('SELECT * FROM routes WHERE catalog_key = ?').get(catalogKey) ?? null;
  }

  listRoutes() {
    return this.database.prepare('SELECT * FROM routes ORDER BY name, id').all();
  }

  saveRouteOutline(routeId, outline) {
    if (!Array.isArray(outline) || outline.length < 4 || outline.length % 2) throw new TypeError('outline must be a flat array of x/y pairs');
    this.database.prepare('UPDATE routes SET outline_json = ?, updated_at = ? WHERE id = ?')
      .run(json(outline), nowIso(this.clock), routeId);
    return this.getRoute(routeId);
  }

  getBestLap(routeId, { carOrdinal = null } = {}) {
    const carClause = carOrdinal == null ? '' : ' AND s.car_ordinal = ?';
    const params = carOrdinal == null ? [routeId] : [routeId, carOrdinal];
    return this.database.prepare(`
      SELECT l.*, s.car_ordinal, s.car_class, s.car_pi, s.raw_recording_path,
             s.started_at AS session_started_at
      FROM laps l JOIN sessions s ON s.id = l.session_id
      WHERE s.route_id = ? AND l.lap_time > 0${carClause}
      ORDER BY l.lap_time ASC, s.started_at ASC, l.id ASC LIMIT 1
    `).get(...params) ?? null;
  }

  upsertSession(session) {
    assertOneOf(session.driveMode, ['race', 'freeRoam'], 'driveMode');
    const timestamp = nowIso(this.clock);
    this.database.prepare(`
      INSERT INTO sessions (
        id, started_at, ended_at, drive_mode, recording_type, car_ordinal,
        car_class, car_pi, drivetrain_type, raw_recording_path, route_id,
        backfill_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ended_at=excluded.ended_at, drive_mode=excluded.drive_mode,
        recording_type=excluded.recording_type, car_ordinal=excluded.car_ordinal,
        car_class=excluded.car_class, car_pi=excluded.car_pi,
        drivetrain_type=excluded.drivetrain_type,
        raw_recording_path=excluded.raw_recording_path, route_id=excluded.route_id,
        backfill_version=excluded.backfill_version, updated_at=excluded.updated_at
    `).run(
      String(session.id), session.startedAt, session.endedAt ?? null,
      session.driveMode, session.recordingType ?? null,
      session.carOrdinal ?? null, session.carClass ?? null, session.carPi ?? null,
      session.drivetrainType ?? null, session.rawRecordingPath ?? null,
      session.routeId ?? null, session.backfillVersion ?? 0,
      timestamp, timestamp,
    );
  }

  getSession(id) {
    return this.database.prepare('SELECT * FROM sessions WHERE id = ?').get(String(id)) ?? null;
  }

  upsertLap(lap) {
    const timestamp = nowIso(this.clock);
    const result = this.database.prepare(`
      INSERT INTO laps (
        session_id, lap_number, lap_time, started_race_time, ended_race_time,
        distance_signature, start_x, start_z, span_x, span_z, flags,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, lap_number) DO UPDATE SET
        lap_time=excluded.lap_time, started_race_time=excluded.started_race_time,
        ended_race_time=excluded.ended_race_time,
        distance_signature=excluded.distance_signature,
        start_x=excluded.start_x, start_z=excluded.start_z,
        span_x=excluded.span_x, span_z=excluded.span_z,
        flags=excluded.flags, updated_at=excluded.updated_at
      RETURNING id
    `).get(
      String(lap.sessionId), lap.lapNumber, lap.lapTime ?? null,
      lap.startedRaceTime ?? null, lap.endedRaceTime ?? null,
      lap.distanceSignature ?? null, lap.startX ?? null, lap.startZ ?? null,
      lap.spanX ?? null, lap.spanZ ?? null, lap.flags ?? null,
      timestamp, timestamp,
    );
    return Number(result.id);
  }

  listLaps(sessionId) {
    return this.database.prepare(
      'SELECT * FROM laps WHERE session_id = ? ORDER BY lap_number, id',
    ).all(String(sessionId));
  }

  saveRouteMatch(match) {
    assertOneOf(match.status, ['matched', 'ambiguous', 'unknown'], 'status');
    if (match.status === 'matched' && match.routeId == null) {
      throw new TypeError('A matched result requires routeId');
    }
    if (match.status !== 'matched' && match.routeId != null) {
      throw new TypeError('Only a matched result may have routeId');
    }
    const timestamp = nowIso(this.clock);
    this.transaction(() => {
      this.database.prepare(`
        INSERT INTO route_matches (
          session_id, route_id, status, confidence, method, matcher_version,
          candidates_json, matched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          route_id=excluded.route_id, status=excluded.status,
          confidence=excluded.confidence, method=excluded.method,
          matcher_version=excluded.matcher_version,
          candidates_json=excluded.candidates_json, matched_at=excluded.matched_at
      `).run(
        String(match.sessionId), match.routeId ?? null, match.status,
        match.confidence ?? null, match.method, match.matcherVersion,
        json(match.candidates), timestamp,
      );
      this.database.prepare(
        'UPDATE sessions SET route_id = ?, updated_at = ? WHERE id = ?',
      ).run(match.status === 'matched' ? match.routeId : null, timestamp, String(match.sessionId));
    });
  }

  getRouteMatch(sessionId) {
    return this.database.prepare(
      'SELECT * FROM route_matches WHERE session_id = ?',
    ).get(String(sessionId)) ?? null;
  }

  markBackfilled(sessionId, version) {
    this.database.prepare(
      'UPDATE sessions SET backfill_version = ?, updated_at = ? WHERE id = ?',
    ).run(version, nowIso(this.clock), String(sessionId));
  }

  listSessionsNeedingBackfill(version, limit = 100) {
    return this.database.prepare(`
      SELECT * FROM sessions
      WHERE drive_mode = 'race' AND backfill_version < ?
      ORDER BY started_at, id LIMIT ?
    `).all(version, limit);
  }

  close() {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }
}

export async function openRouteIndexStore(path, options = {}) {
  const DatabaseSync = options.DatabaseSync ?? (await import('node:sqlite')).DatabaseSync;
  const database = new DatabaseSync(path);
  try {
    return new RouteIndexStore(database, options);
  } catch (error) {
    database.close();
    throw error;
  }
}

export { SCHEMA_VERSION };

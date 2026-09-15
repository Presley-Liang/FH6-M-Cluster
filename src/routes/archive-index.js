import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadTrackCatalog } from '../tracks/catalog.js';
import { openRouteIndexStore } from './sqlite-store.js';
import { matchTrackFingerprint } from '../tracks/matcher.js';

export class ArchiveIndexCoordinator {
  constructor(store, catalog, { onWarning = () => {} } = {}) {
    this.store = store;
    this.catalog = catalog;
    this.onWarning = onWarning;
    this.queue = Promise.resolve();
    this.pending = 0;
    this.indexed = 0;
    this.warning = null;
    this.closed = false;
    this.seedCatalog();
  }
  seedCatalog() {
    this.store.transaction(() => {
      for (const route of this.catalog.routes) this.store.upsertRoute({
        catalogKey: route.id, name: route.name, source: 'LapScope',
        catalogVersion: String(this.catalog.version), kind: route.kind,
        startX: route.start.x, startZ: route.start.z,
        distanceSignature: route.distance, spanX: route.span.x, spanZ: route.span.z,
      });
    });
  }
  enqueue(archive) {
    if (this.closed) return Promise.resolve(false);
    this.pending++;
    const task = this.queue.then(() => this.indexArchive(archive));
    this.queue = task.then(() => {
      this.pending--; this.indexed++; return true;
    }, error => {
      this.pending--;
      this.warning = `Route index skipped archive ${archive?.id ?? 'unknown'}: ${error.message}`;
      this.onWarning(this.warning);
      return false;
    });
    return this.queue;
  }
  indexArchive(archive) {
    if (!archive || archive.id == null || !archive.startedAt || !archive.driveMode) throw new TypeError('Archive index requires id, startedAt, and driveMode');
    this.store.transaction(() => {
      this.store.upsertSession({
        id: archive.id, startedAt: archive.startedAt, endedAt: archive.endedAt,
        driveMode: archive.driveMode, recordingType: archive.recordingType,
        carOrdinal: archive.carOrdinal, carClass: archive.carClass, carPi: archive.carPi,
        drivetrainType: archive.drivetrainType, rawRecordingPath: archive.filename,
        backfillVersion: archive.driveMode === 'race' ? 2 : 1,
      });
      for (const lap of archive.laps || []) {
        const fingerprint = archive.lapFingerprints?.find(item => item.lapNumber === lap.lapNumber && item.valid);
        this.store.upsertLap({
          sessionId: archive.id, lapNumber: lap.lapNumber, lapTime: lap.lapTime,
          endedRaceTime: lap.completedAtRaceTime, flags: lap.flags,
          distanceSignature: fingerprint?.distanceSignature,
          startX: fingerprint?.startX, startZ: fingerprint?.startZ,
          spanX: fingerprint?.spanX, spanZ: fingerprint?.spanZ,
        });
      }
    });
    if (archive.driveMode === 'race') {
      const match = this.matchArchive(archive);
      if (match.routeId && archive.routeOutline) this.store.saveRouteOutline(match.routeId, archive.routeOutline);
    }
  }
  matchArchive(archive) {
    const fingerprint = archive.routeFingerprint;
    const result = matchTrackFingerprint(fingerprint ? {
      start: { x: fingerprint.startX, z: fingerprint.startZ },
      distance: fingerprint.distanceSignature,
      span: { x: fingerprint.spanX, z: fingerprint.spanZ },
    } : null, this.catalog);
    const row = result.match ? this.store.getRouteByCatalogKey(result.match.id) : null;
    const candidateRows = result.candidates.map(candidate => ({
      routeId: this.store.getRouteByCatalogKey(candidate.route.id)?.id ?? null,
      catalogKey: candidate.route.id,
      score: candidate.confidence.score,
    }));
    this.store.saveRouteMatch({
      sessionId: archive.id,
      routeId: row?.id,
      status: result.status,
      confidence: result.confidence?.score,
      method: 'catalog-fingerprint-v1', matcherVersion: 1,
      candidates: candidateRows,
    });
    return { status: result.status, routeId: row?.id ?? null };
  }
  reconcile(archives) { for (const archive of archives) this.enqueue(archive); return this.queue; }
  listRoutes() { return this.store.listRoutes(); }
  getRoute(id) { return this.store.getRoute(id); }
  getRouteByCatalogKey(key) { return this.store.getRouteByCatalogKey(key); }
  getBestLap(routeId, options) { return this.store.getBestLap(routeId, options); }
  state() { return { enabled: true, catalogCount: this.catalog.count, pending: this.pending, indexed: this.indexed, warning: this.warning }; }
  async shutdown() { this.closed = true; await this.queue; this.store.close(); }
}

export async function openArchiveIndex(directory, options = {}) {
  await fsp.mkdir(directory, { recursive: true });
  const store = await openRouteIndexStore(path.join(directory, 'routes.sqlite'), options);
  try { return new ArchiveIndexCoordinator(store, options.catalog ?? loadTrackCatalog(), options); }
  catch (error) { store.close(); throw error; }
}

export class DisabledArchiveIndex {
  constructor(reason) { this.reason = reason; }
  enqueue() { return Promise.resolve(false); }
  reconcile() { return Promise.resolve(false); }
  listRoutes() { return []; }
  getRoute() { return null; }
  getRouteByCatalogKey() { return null; }
  getBestLap() { return null; }
  state() { return { enabled: false, catalogCount: 0, pending: 0, indexed: 0, warning: this.reason }; }
  async shutdown() {}
}

export async function openOptionalArchiveIndex(directory, options = {}) {
  try { return await openArchiveIndex(directory, options); }
  catch (error) {
    const warning = `SQLite route index disabled: ${error.message}`;
    options.onWarning?.(warning);
    return new DisabledArchiveIndex(warning);
  }
}

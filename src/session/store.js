import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';
import { extractLapFingerprints } from '../routes/fingerprint.js';
import { extractRouteOutline } from '../routes/outline.js';

// Raw packets are appended in arrival order. Completed JSON is streamed from
// that journal; continuous driving never keeps an unbounded packet array.
export class SessionStore {
  constructor(directory, { maxQueueBytes = 8 * 1024 * 1024 } = {}) {
    this.directory = path.resolve(directory);
    this.maxQueueBytes = maxQueueBytes;
    this.entries = new Map();
    this.index = new Map();
    this.error = null;
    this.warning = null;
    this.archiveIndex = null;
    this.counter = Date.now();
    this.timer = setInterval(() => this.flushAll().catch(() => {}), 200);
    this.timer.unref();
  }
  attachArchiveIndex(archiveIndex) {
    this.archiveIndex = archiveIndex;
    archiveIndex?.reconcile([...this.index.values()]);
  }
  base(id, carOrdinal) { return `session_${String(id).padStart(4, '0')}_${carOrdinal}`; }
  async init() {
    await fsp.mkdir(this.directory, { recursive: true });
    const files = await fsp.readdir(this.directory);
    for (const filename of files) {
      const id = Number(filename.match(/^session_(\d+)_/)?.[1]);
      if (Number.isSafeInteger(id)) this.counter = Math.max(this.counter, id);
    }
    for (const filename of files.filter(f => /^session_\d+_.*\.json$/.test(f) && !f.endsWith('.meta.json'))) {
      try {
        const metadataPath = path.join(this.directory, filename.replace(/\.json$/, '.meta.json'));
        let raw;
        try { raw = JSON.parse(await fsp.readFile(metadataPath, 'utf8')); if (!raw.endedAt) throw Error('Unfinished metadata'); }
        catch { const { packets, ...rest } = JSON.parse(await fsp.readFile(path.join(this.directory, filename), 'utf8')); raw = { ...rest, packetCount: packets?.length || 0 }; }
        this.index.set(raw.id, { ...raw, filename });
        this.counter = Math.max(this.counter, Number(raw.id) || 0);
      } catch (error) { this.error = `Skipped corrupt archive ${filename}: ${error.message}`; }
    }
    // A journal without completed JSON is an interrupted recording. Preserve it
    // and recover every complete line; incomplete crash-tail lines are reported.
    for (const filename of files.filter(f => f.endsWith('.jsonl'))) {
      const base = filename.slice(0, -6);
      if (files.includes(`${base}.json`)) continue;
      try {
        const meta = JSON.parse(await fsp.readFile(path.join(this.directory, `${base}.meta.json`), 'utf8'));
        this.counter = Math.max(this.counter, Number(meta.id) || 0);
        const entry = this.makeEntry(meta, base);
        entry.ready = Promise.resolve();
        this.entries.set(meta.id, entry);
        meta.endedAt = new Date().toISOString();
        meta.closeReason = 'recovered-after-interruption';
        meta.recovered = true;
        await this.finalize(meta);
      } catch (error) { this.error = `Recovery required for ${filename}: ${error.message}`; }
    }
  }
  makeEntry(meta, base) { return { meta: { ...meta }, base, pending: [], bytes: 0, busy: null, ready: null }; }
  open(meta) {
    const base = this.base(meta.id, meta.carOrdinal);
    const entry = this.makeEntry(meta, base);
    this.entries.set(meta.id, entry);
    entry.ready = this.initialize(entry);
    entry.ready.catch(error => { this.error = error.message; });
  }
  async initialize(entry) {
    if (!entry.journalCreated) {
      const handle = await fsp.open(path.join(this.directory, `${entry.base}.jsonl`), 'wx');
      entry.journalCreated = true;
      await handle.close();
    }
    await this.atomic(`${entry.base}.meta.json`, JSON.stringify(entry.meta));
  }
  async prepareRetry() {
    for (const entry of this.entries.values()) {
      try { await entry.ready; }
      catch { entry.ready = this.initialize(entry); await entry.ready; }
    }
  }
  nextId() { return ++this.counter; }
  append(id, packet) {
    const entry = this.entries.get(id);
    const line = JSON.stringify(packet) + '\n';
    const bytes = Buffer.byteLength(line);
    if (entry.bytes + bytes > this.maxQueueBytes) {
      this.error = 'Recording queue capacity exceeded; recording stopped. Queued data retained for retry.';
      return false;
    }
    entry.pending.push(line);
    entry.bytes += bytes;
    return true;
  }
  async flush(entry) {
    while (entry.busy) await entry.busy;
    if (entry.unrecoverable) throw Error(entry.unrecoverable);
    if (!entry.pending.length) { await entry.ready; return; }
    entry.busy = (async () => {
      await entry.ready;
      const lines = entry.pending;
      entry.pending = [];
      const text = lines.join('');
      const journal = path.join(this.directory, `${entry.base}.jsonl`);
      let originalSize;
      try {
        originalSize = (await fsp.stat(journal)).size;
        await fsp.appendFile(journal, text);
      } catch (error) {
        // Roll back only this failed append, never previously committed lines.
        if (originalSize != null) {
          try { await fsp.truncate(journal, originalSize); }
          catch { entry.unrecoverable = 'Partial journal write needs manual recovery; automatic append disabled'; }
        }
        entry.pending = lines.concat(entry.pending);
        this.error = error.message;
        throw error;
      }
      entry.bytes -= Buffer.byteLength(text);
      // A metadata failure must not enqueue already-written packet lines again.
      try { await this.atomic(`${entry.base}.meta.json`, JSON.stringify(entry.meta)); }
      catch (error) { this.error = error.message; throw error; }
    })();
    try { await entry.busy; } finally { entry.busy = null; }
  }
  async flushAll() { await Promise.all([...this.entries.values()].map(entry => this.flush(entry))); }
  async atomic(filename, text) {
    const dest = path.join(this.directory, filename);
    const temp = `${dest}.tmp`;
    await fsp.writeFile(temp, text);
    await fsp.rename(temp, dest);
  }
  async *packets(entry) {
    const stream = fs.createReadStream(path.join(this.directory, `${entry.base}.jsonl`));
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (!line.trim()) continue;
        let packet;
        try { packet = JSON.parse(line); }
        catch { this.warning = `Incomplete journal line in ${entry.base}; retained original for inspection`; continue; }
        yield packet;
      }
    } finally { lines.close(); stream.destroy(); }
  }
  async finalize(meta) {
    const entry = this.entries.get(meta.id);
    let output;
    try {
      await this.flush(entry);
      const temp = path.join(this.directory, `${entry.base}.json.tmp`);
      output = fs.createWriteStream(temp);
      let writeError = null;
      output.on('error', error => { writeError = error; });
      const write = async value => {
        if (writeError) throw writeError;
        if (!output.write(value)) await once(output, 'drain');
      };
      const header = { ...meta, packetCount: 0 };
      // The final packet count comes from the journal, including crash recovery.
      let count = 0, maxSpeed = 0, maxRpm = 0, maxPower = 0, maxBoost = 0, fuelTotal = 0, fuelCount = 0, firstTime = null, lastTime = 0;
      const fingerprintPackets = [];
      let lastFingerprintPacket = null;
      for await (const packet of this.packets(entry)) {
        count++; firstTime ??= packet.timestampMs; lastTime = packet.timestampMs;
        maxSpeed = Math.max(maxSpeed, packet.speedMs || 0); maxRpm = Math.max(maxRpm, packet.currentEngineRpm || 0);
        maxPower = Math.max(maxPower, packet.power || 0); maxBoost = Math.max(maxBoost, packet.boost || 0);
        if (packet.fuel > 0) { fuelTotal += packet.fuel; fuelCount++; }
        const sampleFingerprint = !lastFingerprintPacket || packet.timelineBreak ||
          packet.lapNumber !== lastFingerprintPacket.lapNumber ||
          Math.abs((packet.distanceTraveled || 0) - (lastFingerprintPacket.distanceTraveled || 0)) >= 25;
        if (sampleFingerprint && fingerprintPackets.length < 20000) {
          fingerprintPackets.push(packet);
          lastFingerprintPacket = packet;
        }
      }
      header.packetCount = count;
      header.stats = { maxSpeedMs: maxSpeed, maxSpeedKmh: maxSpeed * 3.6, maxRpm, maxPower, maxBoost,
        avgFuel: fuelCount ? fuelTotal / fuelCount : null, durationMs: lastTime - (firstTime || 0), packetCount: count };
      if (header.driveMode === 'race') {
        header.lapFingerprints = extractLapFingerprints(fingerprintPackets, { completedLaps: header.laps });
        header.routeFingerprint = header.lapFingerprints.find(fingerprint => fingerprint.valid) ?? null;
        header.routeOutline = extractRouteOutline(fingerprintPackets, { completedLaps: header.laps });
      }
      await write(JSON.stringify(header).slice(0, -1) + ',"packets":[');
      let first = true;
      for await (const packet of this.packets(entry)) {
        await write((first ? '' : ',') + JSON.stringify(packet)); first = false;
      }
      const finished = once(output, 'finish');
      output.end(']}');
      await finished;
      await fsp.rename(temp, path.join(this.directory, `${entry.base}.json`));
      await this.atomic(`${entry.base}.meta.json`, JSON.stringify(header));
      this.index.set(meta.id, { ...header, filename: `${entry.base}.json` });
      this.archiveIndex?.enqueue({ ...header, filename: `${entry.base}.json` });
      this.entries.delete(meta.id);
      this.error = null;
      return `${entry.base}.json`;
    } catch (error) { this.error = error.message; throw error; }
    finally { output?.destroy(); }
  }
  async read(id) {
    const entry = this.entries.get(id);
    if (entry) {
      await this.flush(entry);
      const packets = [];
      for await (const packet of this.packets(entry)) packets.push(packet);
      return { ...entry.meta, packets, packetCount: packets.length };
    }
    const row = this.index.get(id);
    if (!row) return null;
    return JSON.parse(await fsp.readFile(path.join(this.directory, row.filename), 'utf8'));
  }
  list() { return [...this.index.values()].sort((a, b) => b.id - a.id).map(({ laps, ...row }) => ({ ...row, lapCount: laps?.length || 0 })); }
  async shutdown() { clearInterval(this.timer); await this.flushAll(); await this.archiveIndex?.shutdown(); }
}

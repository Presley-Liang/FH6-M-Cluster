import dgram from 'node:dgram';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, toJSON } from './parser.js';
import { SessionStore } from './session/store.js';
import { SessionRuntime } from './session/runtime.js';
import { createHTTP } from './server/http.js';
import { SSEHub } from './server/sse.js';
import { openOptionalArchiveIndex } from './routes/archive-index.js';
import { loadTrackCatalog } from './tracks/catalog.js';
import { createLiveRouteIdentifier } from './routes/live-route-identifier.js';

async function start() {
  const root = import.meta.url ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') : path.resolve(__dirname, '..');
  const store = new SessionStore(process.env.OUTPUT_DIR || './sessions');
  await store.init();
  const trackCatalog = loadTrackCatalog();
  const routeIndex = await openOptionalArchiveIndex(store.directory, { catalog: trackCatalog, onWarning: warning => { store.warning = warning; console.warn('[routes]', warning); } });
  store.attachArchiveIndex(routeIndex);
  const hub = new SSEHub();
  const grace = Number(process.env.SESSION_CLOSE_GRACE_MS ?? 2500);
  const runtime = new SessionRuntime(store, {
    autoDriveMode: true,
    graceMs: Number.isFinite(grace) && grace >= 50 ? grace : 2500,
    onState: state => hub.broadcast(state, 'state'),
    liveRouteIdentifier: createLiveRouteIdentifier(trackCatalog),
    resolveRoute: key => routeIndex.getRouteByCatalogKey(key),
  });
  runtime.lastId = store.list()[0]?.id ?? null;
  const diag = { packetsTotal: 0, parseErrors: 0, lastParseError: null, lastPacketMs: null, lastParseErrorMs: null };
  const udp = dgram.createSocket('udp4');
  udp.on('message', message => {
    diag.packetsTotal++;
    let packet;
    try { packet = toJSON(parse(message)); }
    catch (error) { diag.parseErrors++; diag.lastParseError = error.message; diag.lastParseErrorMs = Date.now(); return; }
    diag.lastPacketMs = Date.now();
    try { hub.broadcast(runtime.process(packet)); }
    catch (error) { runtime.recordingError = error.message; console.error('[recording]', error); hub.broadcast(packet); }
  });
  const server = createHTTP({ runtime, store, routeIndex, hub, root, diagnostics: () => ({
    ...diag, udpPort: udp.address().port, httpPort: server.address().port,
    lastPacketAgoMs: diag.lastPacketMs ? Date.now() - diag.lastPacketMs : null,
    lastParseErrorAgoMs: diag.lastParseErrorMs ? Date.now() - diag.lastParseErrorMs : null,
    currentSessionPackets: runtime.active?.packetCount || 0, currentSessionLaps: runtime.active?.laps.length || 0,
    routeIndex: routeIndex.state(),
    uptimeMs: process.uptime() * 1000,
  }) });
  await new Promise((resolve, reject) => { udp.once('error', reject); udp.bind(Number(process.env.PORT ?? 20440), resolve); });
  console.log(`[udp] listening on ${udp.address().address}:${udp.address().port}`);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(process.env.HTTP_PORT ?? 3000), resolve); });
  console.log(`[http] dashboard at http://localhost:${server.address().port}`);
  console.log(`[output] sessions will be saved to ${store.directory}`);
  const timer = setInterval(() => runtime.tick(), 50);
  let stopping = false;
  async function stop() {
    if (stopping) return; stopping = true;
    clearInterval(timer); udp.close(); hub.close(); server.close();
    try { await runtime.shutdown(); } catch (error) { console.error('[shutdown] unsaved journal retained:', error.message); process.exitCode = 1; }
  }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
start().catch(error => { console.error(error); process.exit(1); });

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDefaultHTML } from '../ui/default-html.js';
import { buildCompactExport, calculateSessionStats, downsample } from '../session/export.js';
import { effectiveTimeline } from '../session/runtime.js';
import { buildGhostTrace } from '../routes/best-ghost.js';

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}
const STATIC_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
async function staticFile(res, root, route, prefix, directory) {
  let relative;
  try { relative = decodeURIComponent(route.slice(prefix.length)); }
  catch { return false; }
  if (relative.includes('\0')) return false;
  const base = path.resolve(root, directory);
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) {
    json(res, 403, { error: 'Forbidden' });
    return true;
  }
  try {
    const buffer = await fs.readFile(file);
    let type = STATIC_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') type = 'image/webp';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': prefix === '/styles/' ? 'no-store' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(buffer);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 8192) throw Object.assign(Error('Request too large'), { status: 413 });
  }
  try { return JSON.parse(text); } catch { throw Object.assign(Error('Bad JSON'), { status: 400 }); }
}
export function createHTTP({ runtime, store, routeIndex, hub, root, diagnostics, upstreamURL }) {
  const upstream = upstreamURL ? new URL(upstreamURL) : null;
  if (upstream && (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname))) throw new TypeError('Live UI upstream must be local HTTP');
  let command = Promise.resolve();
  const serialize = action => { const result = command.then(action); command = result.catch(() => {}); return result; };
  return http.createServer((req, res) => {
    (async () => {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      // A development UI can reuse the packaged receiver's Store and SSE stream.
      // Only its backend endpoints are relayed; HTML and visual assets stay local.
      if (upstream && !['/', '/index.html'].includes(route) && !['/assets/', '/styles/', '/vendor/', '/maptiles/'].some(prefix => route.startsWith(prefix))) {
        const target = new URL(req.url, upstream);
        const forwarded = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, incoming => {
          res.writeHead(incoming.statusCode, incoming.headers);
          incoming.on('aborted', () => res.destroy());
          incoming.on('error', () => res.destroy());
          incoming.pipe(res);
        });
        forwarded.on('error', error => { if (!res.headersSent) json(res, 502, { error: 'Receiver unavailable', detail: error.message }); else res.destroy(); });
        res.on('close', () => forwarded.destroy());
        req.pipe(forwarded);
        return;
      }
      if (route === '/events') { hub.add(req, res); return; }
      if (route === '/status') return json(res, 200, { ...runtime.state(), clients: hub.size });
      if (route === '/debug') return json(res, 200, { ...diagnostics(), ...runtime.state(), sseClients: hub.size });
      if (route === '/sessions') return json(res, 200, store.list());
      if (route === '/routes') return json(res, 200, { ...routeIndex?.state(), routes: routeIndex?.listRoutes() ?? [] });
      if (route === '/route') {
        const id = Number(url.searchParams.get('id'));
        if (!Number.isSafeInteger(id) || id <= 0) return json(res, 400, { error: 'Missing or invalid ?id= param' });
        const data = routeIndex?.getRoute(id);
        return json(res, data ? 200 : 404, data || { error: 'Route not found' });
      }
      if (route === '/route-best' || route === '/ghost') {
        const routeId = Number(url.searchParams.get('routeId'));
        const carParam = url.searchParams.get('carOrdinal');
        const carOrdinal = carParam == null ? null : Number(carParam);
        if (!Number.isSafeInteger(routeId) || routeId <= 0 || (carParam != null && !Number.isSafeInteger(carOrdinal))) {
          return json(res, 400, { error: 'Missing or invalid routeId/carOrdinal param' });
        }
        const best = routeIndex?.getBestLap(routeId, { carOrdinal });
        if (!best) return json(res, 404, { error: 'No valid best lap for route' });
        if (route === '/route-best') return json(res, 200, best);
        const archive = await store.read(Number(best.session_id));
        if (!archive) return json(res, 404, { error: 'Best lap archive not found' });
        const ghost = buildGhostTrace({ ...archive, routeId }, best.lap_number);
        if (!ghost) return json(res, 422, { error: 'Best lap cannot produce a clean Ghost' });
        const timingPoints = ghost.points.map(point => ({
          distanceTraveled: point.progress * best.distance_signature,
          timeSeconds: point.elapsed,
        }));
        return json(res, 200, { ...ghost, timingPoints });
      }
      if (route === '/session') {
        const id = Number(url.searchParams.get('id'));
        if (!Number.isSafeInteger(id) || id <= 0) return json(res, 400, { error: 'Missing or invalid ?id= param' });
        const data = await store.read(id);
        return json(res, data ? 200 : 404, data || { error: 'Session not found' });
      }
      if (route === '/mode' && req.method === 'GET') return json(res, 200, runtime.state());
      if (route === '/mode' && req.method === 'POST') {
        const payload = await body(req);
        if (!['race', 'freeRoam'].includes(payload?.driveMode)) return json(res, 400, { error: 'Invalid driveMode' });
        return json(res, 200, await serialize(() => runtime.setMode(payload.driveMode)));
      }
      if (route === '/mode-control' && req.method === 'GET') return json(res, 200, runtime.state());
      if (route === '/mode-control' && req.method === 'POST') {
        const payload = await body(req);
        if (!['auto', 'manual'].includes(payload?.modeControl)) return json(res, 400, { error: 'modeControl must be auto or manual' });
        return json(res, 200, await serialize(() => runtime.setModeControl(payload.modeControl)));
      }
      if (route === '/free-roam-recording' && req.method === 'POST') {
        const payload = await body(req);
        if (typeof payload?.recording !== 'boolean') return json(res, 400, { error: 'recording must be boolean' });
        return json(res, 200, await serialize(() => runtime.setRecording(payload.recording)));
      }
      if (route === '/recording-retry' && req.method === 'POST') return json(res, 200, await serialize(() => runtime.retry()));
      if (route === '/export' || route === '/export-compact') {
        const raw = await runtime.exportData();
        if (!raw?.packets?.length) return json(res, 400, { error: 'No session data available' });
        let data;
        if (route === '/export-compact') {
          data = { ...buildCompactExport(effectiveTimeline(raw.packets), raw.laps || [], raw.bestLap, raw), id: raw.id, startedAt: raw.startedAt, endedAt: raw.endedAt };
        } else {
          const factor = Math.max(1, Math.floor(Number(url.searchParams.get('downsample')) || 1));
          data = { ...raw, stats: calculateSessionStats(effectiveTimeline(raw.packets)), packets: downsample(raw.packets, factor) };
        }
        return json(res, 200, data, { 'Content-Disposition': `attachment; filename="session_${raw.id}${route.endsWith('compact') ? '_compact' : ''}.json"` });
      }
      if (route === '/' || route === '/index.html') {
        let html;
        try { html = await fs.readFile(path.join(root, 'public/index.html')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; html = getDefaultHTML(); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
      }
      if (route.startsWith('/assets/') && await staticFile(res, root, route, '/assets/', 'assets')) return;
      if (route.startsWith('/styles/') && await staticFile(res, root, route, '/styles/', 'public/css')) return;
      if (route.startsWith('/vendor/') && await staticFile(res, root, route, '/vendor/', 'public/vendor')) return;
      if (route.startsWith('/maptiles/') && await staticFile(res, root, route, '/maptiles/', 'reference-assets/maptiles')) return;
      json(res, 404, { error: 'Not found' });
    })().catch(error => {
      if (!res.headersSent) json(res, error.status || 500, { ...runtime?.state?.(), error: error.message });
      else res.destroy();
    });
  });
}

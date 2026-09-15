export function createRouteUIController({
  doc, fetchJson, mapAdapter, createDeltaTracker, setDriveSecondary = () => {},
} = {}) {
  if (!doc || typeof fetchJson !== 'function' || typeof createDeltaTracker !== 'function') {
    throw new TypeError('Route UI dependencies unavailable');
  }
  const nameEl = doc.getElementById('map-route-name');
  const deltaEl = doc.getElementById('map-delta');
  const deltaValue = doc.getElementById('map-delta-value');
  let key = null, requestSeq = 0, tracker = null, mode = 'race';

  const text = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
  function renderDelta(result, fallback = 'NO REFERENCE') {
    const available = !!result?.available;
    const relation = available ? result.relation : 'unavailable';
    const value = available ? `${result.deltaSeconds > 0 ? '+' : ''}${result.deltaSeconds.toFixed(3)}` : '—';
    text(deltaValue, value);
    if (deltaEl) { deltaEl.dataset.relation = relation; deltaEl.dataset.state = available ? 'live' : 'idle'; deltaEl.title = available ? 'Live delta to route best' : fallback; }
    setDriveSecondary(available ? `DELTA ${value}s · ${relation.toUpperCase()}` : fallback);
  }
  function clear(label = 'ROUTE —') {
    requestSeq++; key = null; tracker = null;
    mapAdapter?.clearRouteOverlay?.();
    text(nameEl, label); renderDelta(null, mode === 'race' ? 'ROUTE UNCONFIRMED' : 'FREE ROAM · LIVE MAP');
  }
  async function fetchGhost(routeId, carOrdinal) {
    const carQuery = Number.isFinite(Number(carOrdinal)) ? `&carOrdinal=${encodeURIComponent(carOrdinal)}` : '';
    try { return await fetchJson(`/ghost?routeId=${encodeURIComponent(routeId)}${carQuery}`); }
    catch { return fetchJson(`/ghost?routeId=${encodeURIComponent(routeId)}`); }
  }
  async function load(activeRoute, packet, seq) {
    let route = null;
    try { route = await fetchJson(`/route?id=${encodeURIComponent(activeRoute.routeId)}`); } catch {}
    if (seq !== requestSeq || mode !== 'race') return;
    let outline = route?.outline_json ?? route?.outline;
    if (typeof outline === 'string') { try { outline = JSON.parse(outline); } catch { outline = null; } }
    mapAdapter?.setRouteOverlay?.({ routeId: activeRoute.routeId, outline });
    try {
      const ghost = await fetchGhost(activeRoute.routeId, packet.carOrdinal);
      if (seq !== requestSeq || mode !== 'race') return;
      mapAdapter?.setRouteOverlay?.({ routeId: activeRoute.routeId, outline, ghostPoints: ghost.points });
      tracker = createDeltaTracker({ ghost: ghost.timingPoints, staleAfterMs: 1500 });
      renderDelta(null, 'REFERENCE READY');
    } catch {
      if (seq === requestSeq) renderDelta(null, 'NO REFERENCE');
    }
  }
  function update(packet = {}) {
    const priorMode = mode;
    mode = packet.driveMode === 'freeRoam' ? 'freeRoam' : 'race';
    if (mode !== 'race') { if (key !== null || priorMode !== mode) clear('FREE ROAM'); return; }
    const activeRoute = packet.activeRoute;
    if (activeRoute?.status !== 'matched' || !activeRoute.routeId) {
      if (key !== null) clear(activeRoute?.status === 'ambiguous' ? 'ROUTE ?' : 'ROUTE —');
      return;
    }
    const nextKey = `${packet.sessionId ?? 'pending'}:${activeRoute.routeId}:${packet.carOrdinal ?? 'car'}`;
    if (nextKey !== key) {
      key = nextKey; tracker = null; const seq = ++requestSeq;
      text(nameEl, activeRoute.name || activeRoute.routeCatalogKey || 'KNOWN ROUTE');
      renderDelta(null, 'LOADING REFERENCE');
      load(activeRoute, packet, seq);
    }
    if (tracker) renderDelta(tracker.update(packet));
  }
  return {
    update,
    setMode(nextMode) {
      const normalized = nextMode === 'freeRoam' ? 'freeRoam' : 'race';
      if (normalized === mode) return;
      mode = normalized;
      clear(mode === 'race' ? 'ROUTE —' : 'FREE ROAM');
    },
    clear,
    tick(now = Date.now()) { if (tracker) renderDelta(tracker.tick(now)); },
    destroy() { clear(); },
  };
}

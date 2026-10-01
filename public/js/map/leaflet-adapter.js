// Leaflet stays behind this adapter so a map failure cannot interrupt telemetry UI.
export function createLeafletAdapter(element, L, projectWorld, options = {}) {
  if (!element || !L || typeof projectWorld !== 'function') throw new TypeError('Map dependencies unavailable');
  const report = typeof options.onStatus === 'function' ? options.onStatus : () => {};
  const crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1, 0, 1, 0) });
  const bounds = L.latLngBounds([8128 / 2 ** 6, 8128 / 2 ** 6], [8192 / 2 ** 6, 8192 / 2 ** 6]);
  const center = [127.5, 127.5];
  let marker = null;
  let destroyed = false;
  let mode = options.mode === 'freeRoam' ? 'freeRoam' : 'race';
  let showTrail = options.showTrail !== false;
  let contextKey = null;
  let routeOverlayContext = null;
  let routeId = null;
  let routeOutline = null;
  let ghostLayer = null;
  let outlineSvg = null;
  const trailLayers = new Map();

  const map = L.map(element, {
    crs,
    minZoom: 9,
    maxZoom: 15,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    maxBounds: bounds.pad(0.04),
  }).setView(center, 12);
  L.tileLayer('/maptiles/{z}/{y}/{x}.jpg', {
    minZoom: 9,
    maxZoom: 14,
    maxNativeZoom: 14,
    tileSize: 256,
    noWrap: true,
    bounds,
  }).addTo(map);
  const track = options.createTrackBuffer?.({ maxPoints: 6000, minDistance: 2, teleportDistance: 500, maxGapMs: 2500 });
  const camera = options.createCamera?.(map, {
    mode,
    onFollowChange: (following, reason) => options.onFollowChange?.(following, reason),
  });
  report('OFFLINE MAP READY');

  function clearTrail() {
    for (const layer of trailLayers.values()) map.removeLayer?.(layer);
    trailLayers.clear();
  }

  function removeOutline() {
    outlineSvg?.remove?.();
    outlineSvg = null;
  }

  function clearRouteOverlay() {
    removeOutline();
    if (ghostLayer) map.removeLayer?.(ghostLayer);
    ghostLayer = null;
    routeId = null;
    routeOutline = null;
    routeOverlayContext = null;
  }

  function normalizedOutlinePoints(outline) {
    if (!Array.isArray(outline)) return null;
    const flat = Array.isArray(outline[0]) ? outline.flatMap(point => [point?.[0], point?.[1]]) : outline;
    if (flat.length < 4 || flat.length % 2 || flat.some(value => !Number.isFinite(value) || value < 0 || value > 1000)) return null;
    const points = [];
    for (let index = 0; index < flat.length; index += 2) points.push(`${flat[index]},${flat[index + 1]}`);
    return points.join(' ');
  }

  function drawNormalizedOutline(outline) {
    removeOutline();
    const points = normalizedOutlinePoints(outline);
    const documentRef = element.ownerDocument ?? globalThis.document;
    if (!points || !documentRef?.createElementNS || !element.appendChild) return false;
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = documentRef.createElementNS(namespace, 'svg');
    const line = documentRef.createElementNS(namespace, 'polyline');
    svg.setAttribute('class', 'fh6-route-outline');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { position: 'absolute', inset: '6%', width: '88%', height: '88%', pointerEvents: 'none', zIndex: '410' });
    line.setAttribute('points', points);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#ff4058');
    line.setAttribute('stroke-width', '7');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    line.setAttribute('opacity', '0.62');
    svg.appendChild(line);
    element.appendChild(svg);
    outlineSvg = svg;
    return true;
  }

  function ghostLatLngs(points) {
    if (!Array.isArray(points)) return null;
    const projected = [];
    for (const point of points) {
      const x = Array.isArray(point) ? point[0] : point?.x ?? point?.positionX;
      const z = Array.isArray(point) ? point[1] : point?.z ?? point?.positionZ;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      const latLng = projectWorld(x, z)?.latLng;
      if (!Number.isFinite(latLng?.lat) || !Number.isFinite(latLng?.lng)) return null;
      projected.push([latLng.lat, latLng.lng]);
    }
    return projected.length >= 2 ? projected : null;
  }

  function setRouteOverlay(overlay = {}) {
    if (destroyed || mode !== 'race') return false;
    const outlinePoints = normalizedOutlinePoints(overlay.outline);
    const ghostPoints = ghostLatLngs(overlay.ghostPoints);
    if (!outlinePoints && !ghostPoints) return false;
    clearRouteOverlay();
    routeId = overlay.routeId == null ? null : String(overlay.routeId);
    routeOutline = outlinePoints ? overlay.outline : null;
    routeOverlayContext = contextKey;
    if (routeOutline) drawNormalizedOutline(routeOutline);
    if (ghostPoints) {
      ghostLayer = L.polyline(ghostPoints, {
        color: '#f4fbff', weight: 1.6, opacity: 0.62, dashArray: '7 7', interactive: false,
      }).addTo(map);
    }
    return true;
  }

  function trailColor() { return mode === 'race' ? '#ff4058' : '#43c7ef'; }

  function drawTrack(state) {
    if (!track || (!showTrail && mode === 'freeRoam')) return;
    const delta = state.delta;
    if (delta.resetReason || delta.type === 'reset') clearTrail();
    if (delta.type !== 'start-segment' && delta.type !== 'append') return;
    let line = trailLayers.get(delta.segmentId);
    const latLng = projectWorld(delta.point.x, delta.point.z).latLng;
    if (!line) {
      line = L.polyline([], { color: trailColor(), weight: 2.2, opacity: 0.88, interactive: false }).addTo(map);
      trailLayers.set(delta.segmentId, line);
    }
    line.addLatLng(latLng);
  }

  function update(packet, state = {}) {
    if (destroyed || !Number.isFinite(packet?.positionX) || !Number.isFinite(packet?.positionZ)) return false;
    if (state.mode === 'race' || state.mode === 'freeRoam') setMode(state.mode);
    const point = projectWorld(packet.positionX, packet.positionZ).latLng;
    const heading = Number.isFinite(packet.yaw) ? packet.yaw * 180 / Math.PI : 0;
    if (!marker) {
      marker = L.marker(point, {
        keyboard: false,
        interactive: false,
        icon: L.divIcon({
          className: 'fh6-vehicle-icon',
          html: '<div class="fh6-vehicle-arrow"></div>',
          iconSize: [24, 30],
          iconAnchor: [12, 15],
        }),
      }).addTo(map);
    } else marker.setLatLng(point);
    const arrow = marker.getElement()?.querySelector('.fh6-vehicle-arrow');
    if (arrow) arrow.style.setProperty('--heading', heading + 'deg');
    const key = mode === 'race' ? String(state.sessionId ?? 'race-pending') : 'freeRoam-live';
    if (contextKey !== key) {
      if (routeOverlayContext == null && (routeOutline || ghostLayer)) routeOverlayContext = key;
      else if (routeOverlayContext != null && routeOverlayContext !== key) clearRouteOverlay();
      contextKey = key;
      if (mode === 'race') camera?.resetRaceBounds();
    }
    if (track) {
      const trackState = track.push(packet, {
        mode,
        sessionId: key,
        lap: mode === 'race' ? (packet.lapNumber ?? 0) : 0,
        timelineBreak: packet.timelineBreak,
        timestamp: packet.receivedAt ?? state.receivedAt ?? Date.now(),
      });
      drawTrack(trackState);
    }
    camera?.update([point.lat, point.lng], { mode, recording: state.recording, showTrail });
    return true;
  }

  function setMode(nextMode) {
    if (nextMode !== 'race' && nextMode !== 'freeRoam') return false;
    if (nextMode === mode) return true;
    mode = nextMode;
    contextKey = null;
    clearTrail();
    clearRouteOverlay();
    camera?.setMode(mode);
    return true;
  }

  function setTrailVisible(visible) {
    showTrail = !!visible;
    if (!showTrail && mode === 'freeRoam') clearTrail();
    else if (track) {
      clearTrail();
      for (const segment of track.getState().segments) {
        const line = L.polyline(segment.points.map(p => {
          const ll = projectWorld(p.x, p.z).latLng;
          return [ll.lat, ll.lng];
        }), { color: trailColor(), weight: 2.2, opacity: 0.88, interactive: false }).addTo(map);
        trailLayers.set(segment.id, line);
      }
    }
  }

  return {
    update,
    setMode,
    setTrailVisible,
    setRouteOverlay,
    clearRouteOverlay,
    resumeFollow() { camera?.resumeFollow(); },
    isFollowing() { return camera?.isFollowing() ?? false; },
    invalidate() { if (!destroyed) setTimeout(() => map.invalidateSize(false), 0); },
    destroy() { if (!destroyed) { clearRouteOverlay(); destroyed = true; camera?.destroy(); map.remove(); } },
    getMap() { return map; },
  };
}

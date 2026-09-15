// Stateful camera policy kept independent from Leaflet so it can be tested with a tiny map mock.
export function createMapCameraController(map, options = {}) {
  if (!map || typeof map.on !== 'function') throw new TypeError('Map camera requires an event-capable map');

  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const followIntervalMs = positive(options.followIntervalMs, 120);
  const raceIntervalMs = positive(options.raceIntervalMs, 500);
  const followZoom = Number.isFinite(options.followZoom) ? options.followZoom : 14;
  const racePadding = options.racePadding ?? [28, 28];
  let mode = options.mode === 'race' ? 'race' : 'freeRoam';
  let following = options.follow !== false;
  let resumePanPending = true;
  let lastFollowAt = -Infinity;
  let lastRaceFitAt = -Infinity;
  let raceBounds = null;
  let programmaticMove = 0;
  let destroyed = false;

  function runProgrammatic(operation) {
    programmaticMove += 1;
    try { return operation(); }
    finally { programmaticMove -= 1; }
  }

  function pauseForUser(event) {
    if (destroyed || mode !== 'freeRoam' || programmaticMove > 0) return false;
    // Leaflet supplies originalEvent for pointer/wheel input. Tests/integrators may use userInitiated.
    if (event?.originalEvent || event?.userInitiated === true || event?.type === 'dragstart') {
      following = false;
      resumePanPending = true;
      options.onFollowChange?.(false, 'user');
      return true;
    }
    return false;
  }

  function onDragStart(event = {}) { pauseForUser({ ...event, type: 'dragstart' }); }
  function onMoveStart(event = {}) { pauseForUser(event); }
  map.on('dragstart', onDragStart);
  map.on('movestart', onMoveStart);

  function update(position, state = {}) {
    if (destroyed) return false;
    const point = normalizePoint(position);
    if (!point) return false;
    const activeMode = state.mode === 'race' || state.mode === 'freeRoam' ? state.mode : mode;
    if (activeMode !== mode) setMode(activeMode);
    const timestamp = now();

    if (mode === 'race') {
      extendBounds(point);
      if (timestamp - lastRaceFitAt < raceIntervalMs) return true;
      lastRaceFitAt = timestamp;
      runProgrammatic(() => {
        if (raceBounds.count === 1) map.setView?.(point, map.getZoom?.(), { animate: false });
        else map.fitBounds?.([raceBounds.southWest, raceBounds.northEast], {
          animate: false,
          padding: racePadding,
          maxZoom: options.raceMaxZoom ?? 14,
        });
      });
      return true;
    }

    // Recording and showTrail deliberately do not participate in the follow policy.
    if (!following || timestamp - lastFollowAt < followIntervalMs) return true;
    lastFollowAt = timestamp;
    runProgrammatic(() => {
      if (resumePanPending) {
        resumePanPending = false;
        map.panTo?.(point, { animate: true, duration: options.resumeDuration ?? 0.28 });
      } else if (typeof map.panTo === 'function') {
        map.panTo(point, { animate: false });
      } else {
        map.setView?.(point, followZoom, { animate: false });
      }
    });
    return true;
  }

  function extendBounds(point) {
    if (!raceBounds) {
      raceBounds = { southWest: [...point], northEast: [...point], count: 1 };
      return;
    }
    raceBounds.southWest[0] = Math.min(raceBounds.southWest[0], point[0]);
    raceBounds.southWest[1] = Math.min(raceBounds.southWest[1], point[1]);
    raceBounds.northEast[0] = Math.max(raceBounds.northEast[0], point[0]);
    raceBounds.northEast[1] = Math.max(raceBounds.northEast[1], point[1]);
    raceBounds.count += 1;
  }

  function setMode(nextMode) {
    if (nextMode !== 'race' && nextMode !== 'freeRoam') return false;
    if (nextMode === mode) return true;
    mode = nextMode;
    lastFollowAt = -Infinity;
    if (mode === 'freeRoam') resumePanPending = true;
    options.onModeChange?.(mode);
    return true;
  }

  function resumeFollow() {
    const changed = !following;
    following = true;
    resumePanPending = true;
    lastFollowAt = -Infinity;
    if (changed) options.onFollowChange?.(true, 'resume');
  }

  function pauseFollow() {
    const changed = following;
    following = false;
    resumePanPending = true;
    if (changed) options.onFollowChange?.(false, 'manual');
  }

  function resetRaceBounds() {
    raceBounds = null;
    lastRaceFitAt = -Infinity;
  }

  return {
    update,
    setMode,
    resumeFollow,
    pauseFollow,
    resetRaceBounds,
    handleUserMoveStart: pauseForUser,
    isFollowing: () => following,
    getState: () => ({ mode, following, raceBounds: cloneBounds(raceBounds) }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      map.off?.('dragstart', onDragStart);
      map.off?.('movestart', onMoveStart);
    },
  };
}

function normalizePoint(point) {
  const lat = Array.isArray(point) ? point[0] : point?.lat;
  const lng = Array.isArray(point) ? point[1] : point?.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function positive(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function cloneBounds(bounds) {
  return bounds ? {
    southWest: [...bounds.southWest],
    northEast: [...bounds.northEast],
    count: bounds.count,
  } : null;
}

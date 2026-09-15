// Self-contained factory: shared by the embedded page and Node unit tests.
export function createTelemetryStore(onError = () => {}) {
  let latest = null, receivedAt = 0;
  const subscribers = new Set();
  return {
    publish(packet, now = Date.now()) {
      if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return false;
      latest = Object.freeze({ ...packet }); receivedAt = now;
      for (const subscriber of subscribers) {
        try { subscriber(latest); } catch (error) { try { onError(error); } catch {} }
      }
      return true;
    },
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    getSnapshot() { return latest; },
    isStale(now = Date.now(), timeout = 2000) { return latest === null || now - receivedAt > timeout; }
  };
}

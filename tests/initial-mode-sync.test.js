import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getDefaultHTML } from '../src/ui/default-html.js';

// Execute the actual connection, state application and bootstrap code emitted
// by the production page. EventSource deliberately never fires onopen.
function startPage() {
  const html = getDefaultHTML();
  const pending = [];
  const sources = [];
  const elements = new Map();
  const context = vm.createContext({
    serverConnectionGeneration: 0, serverInstanceEpoch: 0,
    serverInstanceId: null, serverVersion: -1, retiredServerInstances: new Set(),
    clientDriveMode: 'race', clientModeControl: 'auto', desiredDriveMode: 'race',
    clientFreeRoamRecording: false, policyAuthorityRevision: 0,
    animationCoordinator: null, manualThemeChosen: false,
    routeUI: null, leafletMap: null, sseReconnectTimer: null,
    window: {}, console: { error() {} },
    localStorage: { setItem() {} },
    syncControlModeUI() {}, applyVehicleTheme() {}, applyThemeOverlay() {}, handleSSEMessage() {},
    setTimeout() {}, clearTimeout() {},
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          style: {}, classList: { contains() { return false; }, add() {}, remove() {}, toggle() {} },
        });
        return elements.get(id);
      },
    },
    EventSource: class {
      constructor() { this.listeners = {}; this.closed = false; sources.push(this); }
      addEventListener(name, handler) { this.listeners[name] = handler; }
      close() { this.closed = true; }
    },
    fetch(url) {
      assert.equal(url, '/mode');
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
  });
  const connectStart = html.indexOf('  function connectSSE()');
  const connectEnd = html.indexOf('  function checkNoData()', connectStart);
  const stateStart = html.indexOf('  function applyServerState(data)');
  const stateEnd = html.indexOf('  function updateModePending()', stateStart);
  const initialStart = html.indexOf('  function fetchModeState()');
  const initialEnd = html.indexOf('  function handleSSEMessage(e)', initialStart);
  assert.ok(connectStart > 0 && stateStart > 0 && initialStart > 0);
  vm.runInContext(html.slice(connectStart, connectEnd) + html.slice(stateStart, stateEnd) + html.slice(initialStart, initialEnd), context);
  return { context, pending, sources };
}

async function deliver(request, data) {
  request.resolve({ ok: true, json: async () => data });
  await new Promise(resolve => setImmediate(resolve));
}

const freeManual = { receiverInstanceId: 'receiver-a', version: 0, driveMode: 'freeRoam', modeControl: 'manual' };

test('initial HTTP mode sync applies Free/Manual when SSE never opens', async () => {
  const { context, pending, sources } = startPage();
  assert.equal(sources.length, 1);
  assert.equal(context.serverConnectionGeneration, 1);
  assert.equal(pending.length, 1, 'HTTP initialization does not depend on EventSource.onopen');
  await deliver(pending[0], freeManual);
  assert.equal(context.clientDriveMode, 'freeRoam');
  assert.equal(context.clientModeControl, 'manual');
  assert.equal(context.serverInstanceId, 'receiver-a');
});

test('an initial HTTP response from a retired connection cannot replace the current connection state', async () => {
  const { context, pending, sources } = startPage();
  context.connectSSE();
  assert.equal(sources[0].closed, true);
  sources[1].listeners.state({ data: JSON.stringify({ receiverInstanceId: 'receiver-b', version: 0, driveMode: 'race', modeControl: 'auto' }) });
  await deliver(pending[0], freeManual);
  assert.equal(context.serverInstanceId, 'receiver-b');
  assert.equal(context.clientDriveMode, 'race');
  assert.equal(context.clientModeControl, 'auto');
  assert.equal(context.retiredServerInstances.has('receiver-b'), false);
  sources[0].listeners.state({ data: JSON.stringify(freeManual) });
  assert.equal(context.serverInstanceId, 'receiver-b', 'retired EventSource handlers remain inert');
});

test('an initial HTTP response from a superseded receiver cannot undo its SSE state', async () => {
  const { context, pending, sources } = startPage();
  sources[0].listeners.state({ data: JSON.stringify({ receiverInstanceId: 'receiver-b', version: 0, driveMode: 'race', modeControl: 'auto' }) });
  await deliver(pending[0], freeManual);
  assert.equal(context.serverInstanceId, 'receiver-b');
  assert.equal(context.clientDriveMode, 'race');
  assert.equal(context.clientModeControl, 'auto');
  assert.equal(context.retiredServerInstances.has('receiver-b'), false);
});

test('a reconnected SSE stream can still refresh HTTP state after discarding the old initial request', async () => {
  const { context, pending, sources } = startPage();
  context.connectSSE();
  await deliver(pending[0], { receiverInstanceId: 'receiver-old', version: 99, driveMode: 'race', modeControl: 'auto' });
  assert.equal(context.serverInstanceId, null);
  sources[1].onopen();
  assert.equal(pending.length, 2);
  await deliver(pending[1], freeManual);
  assert.equal(context.serverInstanceId, 'receiver-a');
  assert.equal(context.clientDriveMode, 'freeRoam');
  assert.equal(context.clientModeControl, 'manual');
});

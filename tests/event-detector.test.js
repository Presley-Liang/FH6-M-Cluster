import test from 'node:test';
import assert from 'node:assert/strict';
import { EventDetector } from '../src/session/event-detector.js';

const packet = overrides => ({ isRaceOn: 1, racePosition: 0, currentRaceTime: 0, currentLap: 0, lapNumber: 0, positionX: 0, positionZ: 0, distanceTraveled: 0, ...overrides });

test('event detector ignores IsRaceOn alone and confirms ranked race with debounce', () => {
  const detector = new EventDetector({ enterMs: 500, exitMs: 1000 });
  assert.equal(detector.update(packet({}), 0).activity, 'freeRoam');
  assert.equal(detector.update(packet({ currentRaceTime: 1 }), 200).activity, 'freeRoam');
  assert.equal(detector.update(packet({ racePosition: 4, currentRaceTime: 2 }), 300).pendingActivity, 'race');
  assert.equal(detector.update(packet({ racePosition: 4, currentRaceTime: 2.6 }), 799).activity, 'freeRoam');
  assert.equal(detector.update(packet({ racePosition: 4, currentRaceTime: 2.8 }), 800).activity, 'race');
});

test('advancing lap clock detects an unranked timed event and exit is conservative', () => {
  const detector = new EventDetector({ enterMs: 100, exitMs: 500 });
  detector.update(packet({ currentLap: 1 }), 0);
  detector.update(packet({ currentLap: 1.2 }), 10);
  assert.equal(detector.update(packet({ currentLap: 1.4 }), 110).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, currentLap: 0, positionX: 1, distanceTraveled: 1 }), 200).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, currentLap: 0, positionX: 2, distanceTraveled: 2 }), 699).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, currentLap: 0, positionX: 3, distanceTraveled: 3 }), 700).activity, 'freeRoam');
});

test('pause, rewind and finish-line neutral frames hold Race until open-world driving resumes', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500, staleMs: 1000 });
  detector.update(packet({ racePosition: 2, currentRaceTime: 20, currentLap: 20, positionX: 10, distanceTraveled: 100 }), 0);
  assert.equal(detector.state().activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, racePosition: 2, currentRaceTime: 20, currentLap: 20, positionX: 10, distanceTraveled: 100 }), 100).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, racePosition: 2, currentRaceTime: 10, currentLap: 10, positionX: 8, distanceTraveled: 80 }), 200).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, racePosition: 1, currentRaceTime: 60, currentLap: 0, positionX: 12, distanceTraveled: 105 }), 800).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, racePosition: 0, currentRaceTime: 0, currentLap: 0, positionX: 13, distanceTraveled: 106 }), 1000).activity, 'race');
  assert.equal(detector.update(packet({ isRaceOn: 0, racePosition: 0, currentRaceTime: 0, currentLap: 0, positionX: 15, distanceTraveled: 108 }), 1500).activity, 'freeRoam');
});

test('short evidence dropout and short telemetry silence do not flap activity', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500, staleMs: 1000 });
  detector.update(packet({ racePosition: 1 }), 0);
  assert.equal(detector.state().activity, 'race');
  detector.update(packet({}), 100);
  detector.update(packet({ racePosition: 1 }), 400);
  assert.equal(detector.tick(1300).activity, 'race');
  assert.equal(detector.tick(1899).activity, 'race');
  assert.equal(detector.tick(1900).activity, 'freeRoam');
});

test('pause-like neutral frames without a finish transition do not arm stationary exit', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 2, currentRaceTime: 20, currentLap: 20 }), 0);
  detector.update(packet({ isRaceOn: 0, racePosition: 2, currentRaceTime: 20, currentLap: 20 }), 100);
  assert.equal(detector.update(packet({ isRaceOn: 0 }), 5000).activity, 'race');
});

test('results remain Race until real open-world vehicle telemetry returns', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 3, currentRaceTime: 30, currentLap: 20 }), 0);
  detector.update(packet({ isRaceOn: 0 }), 100);
  assert.equal(detector.update(packet({ isRaceOn: 0 }), 10000).activity, 'race');
  const roam = { isRaceOn: 0, carOrdinal: 3534, engineMaxRpm: 8000, positionX: 100, positionZ: 200 };
  assert.equal(detector.update(packet(roam), 10100).pendingActivity, 'freeRoam');
  assert.equal(detector.update(packet(roam), 10600).activity, 'freeRoam');
});

test('zeroed result packets never become open-world-ready', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 1, currentRaceTime: 60, currentLap: 59 }), 0);
  const state = detector.update(packet({ isRaceOn: 0, carOrdinal: 0, engineMaxRpm: 0 }), 10000);
  assert.equal(state.activity, 'race');
  assert.equal(state.evidence.openWorldReady, false);
});

test('active Free Roam frames with IsRaceOn=1 clear Race without a blackout', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 1, currentLap: 40 }), 0);
  const roam = packet({ isRaceOn: 1, carOrdinal: 340, engineMaxRpm: 10000, positionX: 80 });
  assert.equal(detector.update(roam, 100).pendingActivity, 'freeRoam');
  assert.equal(detector.update(roam, 600).activity, 'freeRoam');
});

test('post-race blackout followed by valid vehicle telemetry exits despite stale lap clocks', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 1, currentRaceTime: 60, currentLap: 59 }), 0);
  let state = detector.update(packet({ isRaceOn: 0, carOrdinal: 0, engineMaxRpm: 0 }), 100);
  assert.equal(state.activity, 'race');
  assert.equal(state.evidence.postRaceBlackout, true);

  const returned = {
    isRaceOn: 1, racePosition: 0, currentRaceTime: 60, currentLap: 59,
    carOrdinal: 489, engineMaxRpm: 8000, positionX: 100, positionZ: 200,
  };
  state = detector.update(packet(returned), 200);
  assert.equal(state.pendingActivity, 'freeRoam');
  assert.equal(state.evidence.postRaceVehicleReturn, true);
  state = detector.update(packet({ ...returned, positionX: 101 }), 700);
  assert.equal(state.activity, 'freeRoam');
});

test('post-race blackout does not exit when ranked Race telemetry resumes', () => {
  const detector = new EventDetector({ enterMs: 0, exitMs: 500 });
  detector.update(packet({ racePosition: 2, currentRaceTime: 20, currentLap: 20 }), 0);
  detector.update(packet({ isRaceOn: 0, carOrdinal: 0, engineMaxRpm: 0 }), 100);
  const resumed = detector.update(packet({
    isRaceOn: 1, racePosition: 2, currentRaceTime: 21, currentLap: 21,
    carOrdinal: 489, engineMaxRpm: 8000,
  }), 200);
  assert.equal(resumed.activity, 'race');
  assert.equal(resumed.evidence.postRaceBlackout, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceFeedbackController} from '../public/js/race-feedback-controller.js';

const packet=(overrides={})=>({sessionId:1,arrivalIndex:1,isRaceOn:1,racePosition:3,currentLap:12,lapNumber:1,bestLap:60,lastLap:0,...overrides});

test('P10 race feedback emits only continuous confirmed race events',()=>{
 const feedback=createRaceFeedbackController();
 assert.deepEqual(feedback.update(packet()),[]);
 assert.equal(feedback.update(packet({arrivalIndex:2,racePosition:2}))[0].type,'position-gain');
 const events=feedback.update(packet({arrivalIndex:3,racePosition:1,lapNumber:2,lastLap:59,bestLap:59}));
 assert.deepEqual(events.map(event=>event.type),['new-best','position-gain']);
 assert.deepEqual(feedback.update(packet({arrivalIndex:3,racePosition:1,lapNumber:2,lastLap:59,bestLap:59})),[]);
});

test('P10 race feedback treats mode, stale, session and timeline breaks as boundaries',()=>{
 const feedback=createRaceFeedbackController();feedback.update(packet());
 assert.deepEqual(feedback.update(packet({arrivalIndex:2,racePosition:2}),{active:false}),[]);
 assert.deepEqual(feedback.update(packet({arrivalIndex:3,racePosition:1})),[],'mode return baselines');
 assert.deepEqual(feedback.update(packet({sessionId:2,arrivalIndex:4,racePosition:4})),[],'session change baselines');
 assert.equal(feedback.update(packet({sessionId:2,arrivalIndex:5,timelineBreak:'rewind'}))[0].type,'rewind');
 assert.deepEqual(feedback.update(packet({sessionId:2,arrivalIndex:5,timelineBreak:'rewind'})),[],'rewind id deduplicates');
 assert.deepEqual(feedback.update(packet({sessionId:2,arrivalIndex:6,lapNumber:3,lastLap:50,timelineBreak:'teleport'})),[]);
});

test('P10 lap completion requires an exact increment and corroborated best time',()=>{
 const feedback=createRaceFeedbackController();feedback.update(packet());
 assert.deepEqual(feedback.update(packet({arrivalIndex:2,lapNumber:3,lastLap:59,bestLap:59})),[],'skipped lap is not guessed');
 feedback.reset();feedback.update(packet({bestLap:0}));
 const first=feedback.update(packet({arrivalIndex:3,lapNumber:2,lastLap:61,bestLap:61}));
 assert.equal(first[0].type,'new-best');assert.equal(first[0].lap,1);
});

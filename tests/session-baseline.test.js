import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionManager} from '../src/session.js';
test('automatic open and manual mode no automatic open',()=>{
 assert.equal(new SessionManager(true).onRaceOnChange(false,true,1,2,800),'open');
 assert.equal(new SessionManager(false).onRaceOnChange(false,true,1,2,800),'none');
});
test('rewind helper accepts earlier race time within window, but rejects zero',()=>{
 const s=new SessionManager();s.activeId=3;s.updateRaceTime(60);s.noteClose(1000);
 assert.equal(s.checkReopen(0,2000),null);
 assert.equal(s.checkReopen(40,2000),3);
});
test('best lap tracks lower positive time and resets on new session',()=>{
 const s=new SessionManager();s.updateBestLap(55);s.updateBestLap(50);s.updateBestLap(-1);
 assert.equal(s.bestForClose(),50);s.beginNewSession();assert.equal(s.bestForClose(),-1);
});

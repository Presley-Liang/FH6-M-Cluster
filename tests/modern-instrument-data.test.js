import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createModernInstrumentBinding } from '../public/js/themes/modern-instrument-binding.js';
import { getDefaultHTML } from '../src/ui/default-html.js';
import { createClusterBindings } from '../public/js/cluster-bindings.js';
import { createCivicJapanInstrument } from '../public/js/themes/civic-japan-instrument.js';

function harness(arc=false) {
  const keys=['status','speed','gear','drive','primary','secondary','power','input','a','b','c','d'];
  const labels=['mode','drive','driveUnit','scale','primary','primaryUnit','secondary','secondaryUnit','a','aUnit','b','bUnit','c','cUnit','d','dUnit'];
  const values=Object.fromEntries(keys.map(k=>[k,{dataset:{nextValue:k},textContent:''}]));
  const captions=Object.fromEntries(labels.map(k=>[k,{dataset:{nextLabel:k},textContent:''}]));
  const fill={dataset:{nextFill:arc?'arc':''},style:{setProperty(k,v){this[k]=v;}}};
  const element={dataset:{},querySelectorAll(s){return s==='[data-next-value]'?Object.values(values):s==='[data-next-label]'?Object.values(captions):[];},querySelector(){return fill;}};
  const root={dataset:{ignitionPhase:'live'}};
  // Execute the actual serialization boundary, with no source-module closure.
  const factory=vm.runInNewContext('('+createModernInstrumentBinding.toString()+')');
  const update=factory({element,mount:{closest(){return root;}}});
  return {update,values,captions,fill,element,root};
}
test('new digital layouts preserve valid zero, reject stale data, and use latest values at sweep handoff',()=>{
  const h=harness();
  h.update({speedKmh:0,rpm:850,engineMaxRpm:8000,gearLabel:'N',powerKw:0,throttlePercent:0,gY:0,wheels:[]},{mode:'freeRoam'});
  assert.equal(h.values.primary.textContent,'0');assert.equal(h.values.a.textContent,'0');
  h.update({speedKmh:123,rpm:900,engineMaxRpm:8000},{displayOverride:{speed:1,rpm:1},stale:true});
  assert.equal(h.values.speed.textContent,'260');assert.equal(h.values.drive.textContent,'8000');
  h.update({speedKmh:47,rpm:1250,engineMaxRpm:8000},{stale:false});
  assert.equal(h.values.speed.textContent,'47');assert.equal(h.values.drive.textContent,'1250');
  h.update({speedKmh:47,rpm:1250,engineMaxRpm:8000},{stale:true});
  assert.equal(h.values.speed.textContent,'—');assert.equal(h.values.drive.textContent,'—');
});
test('EV uses real signed power and drive input, with no fabricated SOC or RPM',()=>{
  const h=harness(true);h.update({powerKw:-24,throttlePercent:0,speedKmh:0,rpm:5000},{powertrain:'ev',mode:'race'});
  assert.equal(h.values.primary.textContent,'-24');assert.equal(h.captions.drive.textContent,'POWER');
  assert.equal(h.captions.driveUnit.textContent,'kW');assert.equal(h.fill.style.strokeDasharray,'0.000 100');
  h.update({throttlePercent:50,speedKmh:2},{powertrain:'ev',mode:'race'});
  assert.equal(h.values.drive.textContent,'—');assert.equal(h.fill.style.strokeDasharray,'50.000 100');
});
test('mode content stays with outgoing illumination until the center transition',()=>{
  const h=harness();const model={speedKmh:50,gearLabel:'3'};
  h.update(model,{mode:'race'});
  h.root.dataset.ignitionKind='mode';h.root.dataset.ignitionPhase='off-frames';
  h.update(model,{mode:'freeRoam'});assert.equal(h.values.primary.textContent,'3');
  h.root.dataset.ignitionPhase='center';h.update(model,{mode:'freeRoam'});
  assert.equal(h.values.primary.textContent,'50');
});
test('lateral G uses the vehicle X axis rather than vertical acceleration',()=>{
  const h=harness();h.update({gX:.42,gY:1.8},{mode:'race'});
  assert.equal(h.values.c.textContent,'0.42');
});
test('standalone page embeds all new factories and their shared data projector',()=>{
  const html=getDefaultHTML();
  for(const name of ['createModernInstrumentBinding','createCivicJapanInstrument','createEscaladeAmericaInstrument','createGxJapanInstrument'])assert.ok(html.includes('var '+name+' = '));
  for(const id of ['y2020_2024.japan','y2025plus.america','y2025plus.japan'])assert.ok(html.includes("'"+id+"': create"));
});

test('custom EV sweep returns to the same drive input fraction used by its live meter',()=>{
  const body=createClusterBindings.toString().match(/getLiveFractions\(\)\{([\s\S]*?)\},destroy\(\)/)[1];
  const root={dataset:{instrumentVariant:'custom',powertrain:'ev'}};
  const run=vm.runInNewContext('(function(){'+body+'})',{root,raw:{},selectTelemetry:()=>({speedKmh:0,throttlePercent:25}),rpmGauge:{gaugeFraction:.9},bound:n=>Math.min(1,Math.max(0,n)),speedRatio:n=>n});
  assert.equal(run().rpm,.25);
  root.dataset.powertrain='combustion';assert.equal(run().rpm,.9);
  root.dataset.powertrain='ev';root.dataset.instrumentVariant='legacy';assert.equal(run().rpm,.9);
});

test('Civic gradual shift lights stay off for EV aliases and light inward for combustion',()=>{
  const lamps=Array.from({length:8},()=>({dataset:{}}));
  const dot={style:{}};
  const doc={createElement:()=>({dataset:{},setAttribute(){},remove(){},querySelectorAll(s){return s==='.ctr-shift-lights i'?lamps:[];},querySelector(s){return s==='.ctr-g-field i'?dot:null;}})};
  const instrument=createCivicJapanInstrument({document:doc,mount:{append(){},closest(){return {dataset:{ignitionPhase:'live'}};}}});
  for(const type of ['EV','ev','electric']){instrument.update({rpmRatio:1},{powertrain:type});assert.equal(lamps.filter(n=>n.dataset.lit==='true').length,0);}
  instrument.update({rpmRatio:.9},{powertrain:'combustion'});
  assert.deepEqual(lamps.map(n=>n.dataset.lit),['true','true','true','false','false','true','true','true']);
});

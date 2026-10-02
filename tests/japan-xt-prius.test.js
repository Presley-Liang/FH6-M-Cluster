import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getDefaultHTML } from '../src/ui/default-html.js';

// Exercise the actual definitions shipped to the browser, including the
// shared projector, rather than relying on the modules' lexical scope.
function harness(kind) {
  function node() {
    const children = new Map();
    return {
      dataset: {}, style: { setProperty(key,value) { this[key]=value; } }, innerHTML: '', textContent: '', removed: false,
      setAttribute() {}, remove() { this.removed=true; },
      querySelector(selector) {
        const canonical = selector.replace(/^header small/, '');
        if(!children.has(canonical)) children.set(canonical,node());
        return children.get(canonical);
      },
      querySelectorAll(selector) {
        const attr = selector.match(/^\[([^\]]+)\]$/)?.[1];
        if(!attr) return [];
        const key=attr.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
        return [...this.innerHTML.matchAll(new RegExp(attr+'(?:="([^"]*)")?', 'g'))].map(match=>{
          const child=this.querySelector(`[${attr}="${match[1]||''}"]`);
          child.dataset[key]=match[1]||'';
          return child;
        });
      },
    };
  }
  const html=getDefaultHTML();
  const a=html.indexOf('  var createModernInstrumentBinding =');
  const b=html.indexOf('  var createInstrumentThemeHost =',a);
  const factory=vm.runInNewContext(html.slice(a,b)+'\n'+(kind==='xt'?'createXtJapanInstrument':'createPriusJapanInstrument')+';');
  const root={dataset:{ignitionPhase:'live'}};
  const mounted=[];
  const instrument=factory({document:{createElement:node},mount:{closest:()=>root,append:(...nodes)=>mounted.push(...nodes)}});
  const value=key=>instrument.element.querySelector(`[data-next-value="${key}"]`).textContent;
  return {...instrument,root,mounted,value};
}

for(const kind of ['xt','prius']) {
  test(`${kind}: valid zeros, signed output, stale data, and exact live handoff`,()=>{
    const h=harness(kind);
    h.update({speedKmh:0,rpm:0,engineMaxRpm:8000,powerKw:-24,throttlePercent:0,gearLabel:'N',wheels:[{tempC:0}]},{mode:'freeRoam'});
    assert.equal(h.value('speed'),'0');assert.equal(h.value(kind==='xt'?'drive':'power'),kind==='xt'?'0':'-24');
    h.update({speedKmh:350,rpm:11980,engineMaxRpm:12000,powerKw:200,gearLabel:'10',wheels:[]},{mode:'race',rpmGauge:{gaugeMax:13000},displayOverride:{speed:1,rpm:1}});
    assert.equal(h.value('speed'),'260');
    h.update({speedKmh:350,rpm:11980,engineMaxRpm:12000,powerKw:200,gearLabel:'10',wheels:[]},{mode:'race',rpmGauge:{gaugeMax:13000}});
    assert.equal(h.value('speed'),'350');
    h.update({speedKmh:350,rpm:11980,powerKw:200,throttlePercent:75,wheels:[{tempC:100}]},{mode:'race',stale:true});
    assert.equal(h.value('speed'),'—');assert.equal(h.value(kind==='xt'?'drive':'power'),'—');
    h.destroy();assert.ok(h.mounted.every(n=>n.removed));
  });
  test(`${kind}: outgoing mode labels stay stable and Race timing requires confirmed racing`,()=>{
    const h=harness(kind);
    h.update({currentLap:75,bestLap:74},{mode:'race',racing:true});
    assert.equal(h.value('a'),'1:15.00');
    h.root.dataset.ignitionKind='mode';h.root.dataset.ignitionPhase='off-frames';
    h.update({currentLap:76},{mode:'freeRoam',racing:true});
    assert.equal(h.element.dataset.mode,'race');assert.equal(h.value('a'),'1:16.00');
    h.root.dataset.ignitionPhase='center';h.update({throttlePercent:25},{mode:'freeRoam'});
    assert.equal(h.element.dataset.mode,'freeRoam');
    h.update({currentLap:75,bestLap:74},{mode:'race',racing:false});
    assert.equal(h.value('a'),'—');assert.equal(h.value('b'),'—');
  });
}

test('XT perspective segments use its RPM scale or actual EV input, never a fake SOC',()=>{
  const h=harness('xt');
  const lamps=()=>h.element.querySelectorAll('[data-xt-segment]').filter(n=>n.dataset.lit==='true').length;
  h.update({rpm:4000,engineMaxRpm:8000},{mode:'race'});assert.equal(lamps(),8);
  h.update({rpm:8000,throttlePercent:25,powerKw:-40},{mode:'race',powertrain:'electric'});
  assert.equal(lamps(),4);assert.equal(h.value('drive'),'-40');
  assert.equal(h.element.querySelector('[data-xt-caption]').textContent,'DRIVE INPUT');
  h.update({throttlePercent:25},{powertrain:'ev',displayOverride:{speed:.5,rpm:.75}});assert.equal(lamps(),12);
  h.update({rpm:5000},{stale:true});assert.equal(lamps(),0);
  h.update({powerKw:-40,throttlePercent:25,brakePercent:0,gX:-.42},{mode:'freeRoam',powertrain:'ev'});
  assert.equal(h.value('drive'),'-40');assert.equal(h.value('a'),'0');assert.equal(h.value('b'),'-0.42');
  assert.equal(h.element.querySelector('[data-next-label="a"]').textContent,'BRAKE');
  h.update({powerKw:40,gX:0},{mode:'freeRoam'});
  assert.equal(h.value('a'),'40');assert.equal(h.value('b'),'0.00');
});

test('Prius uses real RPM/input and signed power, never classifies CHG/ECO/REGEN',()=>{
  const h=harness('prius');
  h.update({rpm:11980,engineMaxRpm:12000,powerKw:-40,throttlePercent:75,wheels:[{tempC:90},{tempC:104}]},{mode:'freeRoam'});
  assert.equal(h.element.querySelector('[data-pri-drive]').textContent,'11980');
  assert.equal(h.value('power'),'-40');assert.equal(h.value('a'),'75');assert.equal(h.value('b'),'104');
  h.update({rpm:5000,powerKw:-40,throttlePercent:25,gX:-.42,wheels:[]},{mode:'freeRoam',powertrain:'ev'});
  assert.equal(h.element.querySelector('[data-pri-drive]').textContent,'25');
  assert.equal(h.element.querySelector('[data-pri-unit]').textContent,'%');
  assert.equal(h.value('a'),'-0.42');assert.equal(h.value('b'),'—');
  const fill=h.element.querySelector('[data-next-fill]');
  assert.equal(fill.style['--drive-fill'],'0.2500');
});

test('both exact theme IDs, factories and CSS ship in the production page',()=>{
  const html=getDefaultHTML();
  for(const [id,name,css] of [['y1986_1994.japan','createXtJapanInstrument','xt-japan-instrument.css'],['y2015_2019.japan','createPriusJapanInstrument','prius-japan-instrument.css']]) {
    assert.ok(html.includes(`'${id}': ${name}`));assert.ok(html.includes('/styles/'+css));
  }
});

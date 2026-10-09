import test from 'node:test';
import assert from 'node:assert/strict';
import { createEscaladeAmericaInstrument } from '../public/js/themes/escalade-america-instrument.js';

function harness() {
  const rise = Math.hypot(31,35), length = rise + 261;
  const point = distance => distance <= rise
    ? {x:4+31*distance/rise,y:70-35*distance/rise}
    : {x:35+distance-rise,y:35};
  const node = () => ({dataset:{},style:{setProperty(k,v){this[k]=v;}},children:[],attributes:{},textContent:'',
    setAttribute(k,v){this.attributes[k]=String(v);},append(...items){this.children.push(...items);},remove(){}});
  const axis = {...node(),getTotalLength:()=>length,getPointAtLength:point};
  const scale = node();Object.defineProperty(scale,'innerHTML',{set(){this.children=[];}});
  const fill=node();fill.dataset.nextFill='arc';
  const values=new Map(),labels=new Map();let html='';
  const element={...node(),set innerHTML(value){html=value;},querySelector(selector){
    if(selector==='.esc-drive-axis')return axis;
    if(selector==='.esc-drive-scale')return scale;
    if(selector==='[data-next-fill]')return fill;
  },querySelectorAll(selector){
    const kind=selector==='[data-next-value]'?'Value':selector==='[data-next-label]'?'Label':null;
    if(!kind)return [];
    const collection=kind==='Value'?values:labels;
    for(const match of html.matchAll(new RegExp('data-next-'+kind.toLowerCase()+'="([^"]+)"','g'))){
      if(!collection.has(match[1])){const item=node();item.dataset['next'+kind]=match[1];collection.set(match[1],item);}
    }
    return [...collection.values()];
  }};
  let first=true;
  const document={createElement:()=>first?(first=false,element):node(),createElementNS:()=>node()};
  const root={dataset:{ignitionPhase:'live'}};
  const instrument=createEscaladeAmericaInstrument({document,mount:{append(){},closest:()=>root}});
  return {...instrument,scale,fill,point,length,values,labels};
}

test('Escalade nice labels and tick marks use the reveal path distance, including 6500 endpoint',()=>{
  const h=harness();h.update({rpm:3250,engineMaxRpm:6500},{rpmGauge:{gaugeMax:6500}});
  const lines=h.scale.children.filter(n=>n.attributes.x1!==undefined);
  const texts=h.scale.children.filter(n=>n.attributes.x!==undefined);
  assert.deepEqual(texts.map(n=>n.textContent),['0','1','2','3','4','5','6','6.5']);
  for(let i=0;i<texts.length;i++){
    const expected=h.point(Number(texts[i].dataset.escValue)/6500*h.length);
    assert.equal(Number(texts[i].attributes.x),expected.x);
    assert.equal(Number(texts[i].attributes.y)+12,expected.y);
    assert.equal(lines[i].attributes.x1,texts[i].attributes.x);
    assert.equal(Number(lines[i].attributes.y1)+3,expected.y);
  }
  assert.equal(h.fill.style.strokeDasharray,'50.000 100');
});

test('Escalade range changes rebuild the axis, with no stale labels or invented unknown range',()=>{
  const h=harness();h.update({rpm:4321,engineMaxRpm:6500},{});
  h.update({rpm:11980,engineMaxRpm:13000},{});
  assert.deepEqual(h.scale.children.filter(n=>n.attributes.x).map(n=>n.textContent),['0','2','4','6','8','10','12','13']);
  h.update({rpm:850},{});assert.equal(h.scale.children.length,0);
});

test('Escalade EV axis is driver input percent and the power number remains actual kW',()=>{
  const h=harness();h.update({powerKw:-23,throttlePercent:75},{powertrain:'ev'});
  assert.deepEqual(h.scale.children.filter(n=>n.attributes.x).map(n=>n.textContent),['0','25','50','75','100']);
  assert.equal(h.labels.get('scale').textContent,'DRIVE INPUT · %');
  assert.equal(h.values.get('drive').textContent,'-23');
  assert.equal(h.fill.style.strokeDasharray,'75.000 100');
});

test('Escalade sweep uses the shared reveal fraction and returns directly to newest live input',()=>{
  const h=harness();h.update({rpm:850,engineMaxRpm:6500},{displayOverride:{speed:.5,rpm:.8}});
  assert.equal(h.fill.style.strokeDasharray,'80.000 100');
  h.update({rpm:1300,engineMaxRpm:6500},{});
  assert.equal(h.fill.style.strokeDasharray,'20.000 100');
  assert.equal(h.values.get('drive').textContent,'1300');
});

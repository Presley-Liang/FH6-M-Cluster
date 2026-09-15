import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {getDefaultHTML} from '../src/ui/default-html.js';
import {createTelemetryStore} from '../public/js/telemetry-store.js';

test('extracted UI preserves baseline IDs and valid embedded script',()=>{
 const baseline=JSON.parse(fs.readFileSync('tests/fixtures/baseline-manifest.json','utf8'));
 const html=getDefaultHTML();
 for(const id of baseline.domIds)assert.ok(html.includes(`id="${id}"`),id);
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});
test('historical P1 base stylesheet is retained; P3 overrides are separately scoped',()=>{
 const css=getDefaultHTML().match(/<style>([\s\S]*?)<\/style>/)[1];
 assert.equal(crypto.createHash('sha256').update(css).digest('hex'),
  '5a9c5c80d4b8ceee3b1e9f890dc275ec0c62a97764963ee86bc7c976caf5d368');
});
test('telemetry subscribers are isolated; unsubscribe and stale state work',()=>{
 const errors=[];const store=createTelemetryStore(e=>errors.push(e));
 let value;store.subscribe(()=>{throw Error('map fails')});
 const off=store.subscribe(p=>{value=p.speedKmh});
 store.publish({speedKmh:80},100);assert.equal(value,80);assert.equal(errors.length,1);
 assert.equal(store.isStale(150),false);assert.equal(store.isStale(2200),true);
 off();store.publish({speedKmh:90},2300);assert.equal(value,80);
 assert.equal(store.getSnapshot().speedKmh,90);
});

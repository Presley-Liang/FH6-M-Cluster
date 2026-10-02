import test from 'node:test';
import assert from 'node:assert/strict';
import {getDefaultHTML} from '../src/ui/default-html.js';
import {clusterShell,clusterCSS} from '../src/ui/cluster-shell.js';
import {createClusterBindings} from '../public/js/cluster-bindings.js';
import {createUIAnimationCoordinator} from '../public/js/ui-animation-coordinator.js';
import {createShiftLightController} from '../public/js/shift-light-controller.js';
import vm from 'node:vm';
import fs from 'node:fs';

test('P3 fixed instrument shell stays outside all four stable page panes',()=>{
 const html=clusterShell();
 const svg=html.slice(html.indexOf('<svg'),html.indexOf('<div class="center-window">'));
 for(const id of ['speed','gear','rpm','fuel','speed-track','rpm-track','speed-needle','rpm-needle'])assert.ok(svg.includes('id="'+id+'"'),id);
 for(const p of ['DRIVE','MAP','DYN','RPY'])assert.equal([...html.matchAll(new RegExp('data-cluster-page="'+p+'"','g'))].length,1);
 const output=getDefaultHTML().split('<script>')[0];
 const ids=[...output.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'duplicate HTML IDs');
 assert.ok(!/<script[^>]+src="https?:/.test(getDefaultHTML()));
});
test('P10 shift light uses hysteresis and fails dark',()=>{
 const shift=createShiftLightController();
 assert.equal(shift.update(.74,true).level,'off');
 assert.equal(shift.update(.75,true).level,'warm');
 assert.equal(shift.update(.89,true).level,'warm');
 assert.equal(shift.update(.90,true).level,'hot');
 assert.equal(shift.update(.97,true).level,'limit');
 assert.equal(shift.update(.96,true).level,'limit');
 assert.equal(shift.update(.954,true).level,'hot');
 assert.equal(shift.update(0,true).level,'off');
 assert.equal(shift.update(NaN,true).level,'off');
 assert.equal(shift.update(1,false).level,'off');
 assert.equal((clusterShell().match(/<div class="shift-light"/g)||[]).length,1);
 assert.match(clusterCSS,/data-shift-level=limit/);
 assert.match(createClusterBindings.toString(),/lamp\.dataset\.lit/);
});
test('P11 gear changes use directional motion without delaying telemetry',()=>{
 const source=createClusterBindings.toString();
 assert.match(source,/gear-shift-up/);
 assert.match(source,/gear-shift-down/);
 assert.match(source,/previousGearLabel/);
 assert.match(source,/pendingNeutralSince/);
 assert.match(source,/neutralHoldMs \?\? 180/);
 assert.match(clusterCSS,/@keyframes gear-shift-up/);
 assert.match(clusterCSS,/@keyframes gear-shift-down/);
 assert.match(clusterCSS,/prefers-reduced-motion:reduce[^}]+/);
});
test('P11 vehicle identity display survives FH6 zeroed transition packets',()=>{
 const source=createClusterBindings.toString();
 assert.match(source,/stableVehicle/);
 assert.match(source,/identityModel/);
 assert.match(source,/carPi:identityModel\.classLabel/);
 assert.match(source,/lookupVehicleModel\(identityModel\.carId\)/);
 assert.match(source,/drivetrain:identityModel\.drivetrainLabel/);
});
test('P11 standalone UI embeds both vehicle lookup function and catalog data',()=>{
 const output=getDefaultHTML();
 assert.match(output,/var VEHICLE_MODEL_BY_ORDINAL = \{/);
 assert.match(output,/"3534":"2021 MINI JCW GP"/);
 assert.match(output,/var lookupVehicleModel = function lookupVehicleModel/);
 assert.doesNotThrow(()=>new vm.Script(output.match(/<script>([\s\S]*)<\/script>/)[1]));
});
test('P10 mode selector is distinctive and ignition coordinator is cancellable',()=>{
 const html=clusterShell();
 for(const token of ['class="mode-slider"','class="mode-icon race-icon"','class="mode-icon road-icon"','class="mode-identity"','class="mode-arming"','aria-label="Drive mode"'])assert.ok(html.includes(token),token);
 assert.match(clusterCSS,/data-ignition-phase=shutdown/);
 assert.match(clusterCSS,/data-ignition-kind=mode[^}]+\.fixed-info/);
 assert.match(clusterCSS,/data-ignition-kind=mode[^}]+\.center-window/);
 assert.match(clusterCSS,/not\(\[data-ignition-phase=live\]\) \.rpm-redline\{opacity:0!important\}/);
 assert.match(clusterCSS,/prefers-reduced-motion:reduce/);
 assert.ok(!/transition:\s*all/.test(clusterCSS));
 const queue=[];const overrides=[];const root={dataset:{}};const body={dataset:{driveMode:'race'}};
 const coordinator=createUIAnimationCoordinator({root,body,display:{setDisplayOverride:v=>overrides.push(v)},schedule:(fn,ms)=>{queue.push({fn,ms});return queue.length;},cancelSchedule:()=>{}});
 coordinator.switchMode('freeRoam',mode=>{body.dataset.driveMode=mode;});
 assert.equal(root.dataset.targetMode,'freeRoam');
 assert.ok(queue.some(task=>task.ms===1250),'theme change must follow a true-black gate');
 assert.equal(root.dataset.ignitionPhase,'off-needles');assert.equal(overrides.length,0,'shutdown must not sweep');
 for(const task of [...queue].sort((a,b)=>a.ms-b.ms))task.fn();
 assert.equal(body.dataset.driveMode,'freeRoam');assert.equal(root.dataset.ignitionPhase,'live');assert.equal(overrides.at(-1),null);
});
test('P3-V font is bundled and center tray has an opaque boundary',()=>{
 const font=fs.readFileSync('assets/fonts/Oxanium-Variable.ttf');
 assert.equal(font.readUInt32BE(0),0x00010000);
 assert.match(fs.readFileSync('assets/fonts/Oxanium-OFL.txt','utf8'),/SIL OPEN FONT LICENSE/);
 assert.match(clusterCSS,/font-family:'Oxanium'/);
 assert.match(clusterCSS,/left:35%;width:30%;top:26%;height:44%/);
 assert.ok(clusterShell().includes('M540 595 H319'));
 assert.match(clusterCSS,/background:linear-gradient\(#18222b,#111820\)/);
});
test('P3-V dual material layer and unknown channels are explicit',()=>{
 const html=clusterShell();
 for(const name of ['rim-underlay','rim-inner','rim-silver','dial-facet','micro-grid'])assert.ok(html.includes(name));
 for(const token of ['id="fuel-aux-track"','id="fuel-aux-fill"','id="fuel-needle"','id="tyre-aux-track"','id="tyre-aux-fill"','id="tyre-needle"','id="tyre-max"'])assert.ok(html.includes(token),token);
 assert.ok(clusterCSS.includes('body[data-drive-mode=freeRoam] .gauge-fill'));
 assert.ok(!/transition:\s*all/.test(clusterCSS));
 const source=createClusterBindings.toString();
 assert.match(source,/fuelFraction/);assert.match(source,/fuelNeedle\.style\.setProperty\('--fuel-angle'/);
 assert.match(source,/tyreTemperatures/);assert.match(source,/tyreNeedle\.style\.setProperty\('--tyre-angle'/);
 new vm.Script('('+source+')');
});
test('DYN four-corner radar keeps real telemetry bindings without a vehicle illustration',()=>{
 const html=clusterShell();
 assert.equal((html.match(/class="cluster-page dyn-page"/g)||[]).length,1);
 assert.ok(html.includes('class="dyn-radar"'));
 assert.ok(html.includes('class="g-target"'));
 assert.ok(!html.includes('class="vehicle-top"'));
 for(const wheel of ['fl','fr','rl','rr']){
  for(const token of [`class="wheel wheel-${wheel}"`,`id="temp-${wheel}"`,`id="temp-${wheel}-bar"`,`data-wheel="${wheel}-combined"`,`data-wheel="${wheel}-travel-bar"`]) assert.ok(html.includes(token),token);
 }
 for(const input of ['throttle','brake','clutch','handbrake']){
  assert.ok(html.includes(`id="${input}"`));assert.ok(html.includes(`id="${input}-bar"`));
 }
 for(const id of ['steer','steer-fill','steer-pip','g-dot','g-magnitude','power','boost'])assert.ok(html.includes(`id="${id}"`),id);
 assert.ok(html.includes('data-value="torque"'));
 assert.match(clusterCSS,/\.dyn-page \.pedal-grid\{display:grid;grid-template-columns:repeat\(4/);
 assert.match(clusterCSS,/\.dyn-page\{overflow:hidden!important/);
 assert.match(clusterCSS,/data-stale=true\] \.dyn-page\.active\{opacity:\.42/);
 assert.match(clusterCSS,/data-stale=true\] \.dyn-page:not\(\.active\)\{opacity:0/);
 assert.match(clusterCSS,/@media\(max-height:760px\)/);
 const source=createClusterBindings.toString();
 assert.match(source,/travelBar\.style\.transform='scaleX/);
 assert.match(source,/steerFill\.style\.transform='scaleX/);
 assert.match(source,/input\+'-bar'\)\.style\.transform='scaleY/);
 assert.match(source,/Math\.hypot\(model\.gX, model\.gZ\)/);
 assert.match(source,/!stale && Number\.isFinite\(model\.gX\) && Number\.isFinite\(model\.gZ\)/);
});

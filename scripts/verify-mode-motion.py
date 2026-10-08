#!/usr/bin/env python3
"""Measure mode animation pacing on an isolated dashboard receiver, not the user's live page."""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True, help='Use an isolated receiver; mode controls change its state')
parser.add_argument('--chromium')
parser.add_argument('--theme', action='append')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()

with sync_playwright() as p:
    launch = {'headless': True}
    if args.chromium:
        launch['executable_path'] = args.chromium
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='no-preference')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.locator('#control-manual-btn').click()
    page.wait_for_function("()=>document.querySelector('#control-manual-btn').getAttribute('aria-pressed')==='true'&&(document.querySelector('#cluster').dataset.ignitionPhase||'live')==='live'", timeout=25000)
    available = page.locator('button[data-theme-id]').evaluate_all('(buttons)=>buttons.map(b=>b.dataset.themeId)')
    themes = args.theme or list(dict.fromkeys(available))
    assert themes and set(themes) <= set(available), 'Unknown requested themes'
    page.evaluate('''()=>{
      window.motionAudit=null;
      const original=instrumentHost.update;
      instrumentHost.update=function(model,context){
        const at=performance.now();
        original(model,context);
        if(window.motionAudit) motionAudit.updates.push({at,phase:document.querySelector('#cluster').dataset.ignitionPhase,cost:performance.now()-at,presentedMode:document.querySelector('[data-theme-instrument][data-active="true"]')?.dataset.mode||document.body.dataset.driveMode});
      };
      new PerformanceObserver(list=>{
        if(window.motionAudit) for(const task of list.getEntries()) motionAudit.longTasks.push({at:task.startTime,duration:task.duration});
      }).observe({type:'longtask',buffered:false});
    }''')
    checks = []
    brightness_checks = []
    for theme in themes:
        # Establish the actual selected era/profile through the coordinator.
        # Reduced motion applies only to this setup; both measured modes below
        # run with full motion and the theme's own sweep duration.
        page.emulate_media(reduced_motion='reduce')
        page.evaluate('''id=>{
          manualThemeId=id;
          manualThemeChosen=true;
          animationCoordinator.wake(vehicleProfileFromState(latestVehicleState||{vehicle:{}}),clientDriveMode,applyThemeOverlay);
        }''', theme)
        page.emulate_media(reduced_motion='no-preference')
        page.wait_for_timeout(350)
        current = page.evaluate('document.body.dataset.driveMode')
        target_modes = ['freeRoam', 'race'] if current == 'race' else ['race', 'freeRoam']
        for mode in target_modes:
            page.evaluate('''()=>{
              const root=document.querySelector('#cluster');
              window.motionAudit={updates:[],frames:[],longTasks:[],phases:[],samples:[],active:true};
              const audit=motionAudit;
              const layerSelectors='.next-body,.ce-dial,.ae86-hood,.jdm90-panel,.jdm90-chassis,.rx8-pod-row,.r8-dial';
              const active=document.querySelector('[data-theme-instrument][data-active="true"]');
              const layers=active?Array.from(active.querySelectorAll(layerSelectors)):[];
              const observer=new MutationObserver(()=>audit.phases.push({at:performance.now(),phase:root.dataset.ignitionPhase,bodyMode:document.body.dataset.driveMode}));
              observer.observe(root,{attributes:true,attributeFilter:['data-ignition-phase']});
              audit.stop=()=>{audit.active=false;observer.disconnect();clearInterval(audit.sampleTimer);};
              const frame=at=>{if(audit.active){audit.frames.push({at,phase:root.dataset.ignitionPhase});requestAnimationFrame(frame);}};
              requestAnimationFrame(frame);
              audit.sampleTimer=setInterval(()=>{
                const el=document.querySelector('[data-theme-instrument][data-active="true"]');
                const body=el?.querySelector('.next-body')||el;
                if(body){const style=getComputedStyle(body);audit.samples.push({at:performance.now(),phase:root.dataset.ignitionPhase,filter:style.filter,opacity:style.opacity,layers:layers.map(node=>{const s=getComputedStyle(node);return {layer:node.classList[0],filter:s.filter,opacity:s.opacity};})});}
              },50);
            }''')
            button = '#mode-race-btn' if mode == 'race' else '#mode-freeroam-btn'
            page.locator(button).click()
            page.wait_for_function('''mode=>document.body.dataset.driveMode===mode&&document.querySelector('#cluster').dataset.ignitionPhase==='live' ''', arg=mode, timeout=20000)
            page.wait_for_timeout(100)
            result = page.evaluate('''()=>{motionAudit.stop();const {stop,sampleTimer,...result}=motionAudit;window.motionAudit=null;return result;}''')
            def gaps(entries, phase):
                return [b['at']-a['at'] for a,b in zip(entries,entries[1:]) if a['phase']==phase and b['phase']==phase]
            stats = {}
            for phase in ('frames', 'scan', 'return'):
                update_gaps = gaps(result['updates'], phase)
                frame_gaps = gaps(result['frames'], phase)
                costs = [u['cost'] for u in result['updates'] if u['phase']==phase]
                stats[phase] = {
                    'updateCount': len(costs),
                    'frameCount': sum(frame['phase']==phase for frame in result['frames']),
                    'meanUpdateGapMs': sum(update_gaps)/len(update_gaps) if update_gaps else None,
                    'maxUpdateGapMs': max(update_gaps, default=None),
                    'maxFrameGapMs': max(frame_gaps, default=None),
                    'maxUpdateCostMs': max(costs, default=None),
                }
            expected = ['off-needles','off-frames','off-center','center','frames','scan','return','live']
            assert [entry['phase'] for entry in result['phases']] == expected, (theme, mode, result['phases'])
            if theme != 'y2015_2019.europe':
                for phase in ('frames','scan','return'):
                    assert stats[phase]['updateCount'] >= .8 * stats[phase]['frameCount'], (theme, mode, phase, stats[phase])
                assert all(entry['bodyMode'] != mode for entry in result['phases'] if entry['phase'] in ('off-needles','off-frames','off-center','center')), (theme, mode, 'Mode committed before relight')
            layer_values = {}
            for sample in result['samples']:
                if sample['phase'] != 'frames':
                    continue
                for layer in sample['layers']:
                    match = re.search(r'brightness\(([^)]+)\)', layer['filter'])
                    layer_values.setdefault(layer['layer'], []).append(float(match[1]) if match else 1.0)
            for name, values in layer_values.items():
                max_rise = max((b-a for a,b in zip(values, values[1:])), default=0)
                assert len(set(values)) >= 5 and values[-1] > .95 and max_rise < .3, (theme, mode, name, values)
                brightness_checks.append({'theme':theme,'mode':mode,'layer':name,
                                          'unique':len(set(values)),'first':values[0],
                                          'last':values[-1],'maxRise':max_rise})
            # Raw frame/update streams are only used for assertions and derived
            # timing. Keep phase logs and brightness traces as compact evidence.
            checks.append({'theme':theme,'mode':mode,'stats':stats,
                           'phases':result['phases'],'samples':result['samples'],
                           'longTasks':result['longTasks']})
            print(json.dumps({'theme':theme,'mode':mode,'stats':stats}), flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'generatedAt':datetime.now(timezone.utc).isoformat(),'scope':'Isolated browser timing with no game telemetry; not live FPS acceptance','checks':checks,'errors':errors,
                                      'brightnessValidation':{'passed':True,'layerCases':len(brightness_checks),
                                                              'criteria':'At least five sampled brightness values, final brightness above .95, maximum rise between 50ms samples below .3',
                                                              'checks':brightness_checks}},indent=2),encoding='utf-8')
    assert not errors, errors
    browser.close()

#!/usr/bin/env python3
"""Inspect thirteen completed instruments with synthetic telemetry in Chromium.
Requires Python Playwright. Uses --chromium, a Chromium on PATH, or Playwright's managed Chromium; does not install packages.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,base64,argparse,shutil,subprocess
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir',type=Path,default=Path('/tmp/completion-preview'))
parser.add_argument(
 '--chromium',
 default=shutil.which('chromium') or shutil.which('chromium-browser'),
 help='Chromium executable. If omitted, use chromium/chromium-browser from PATH or Playwright managed Chromium.',
)
args=parser.parse_args()
output=args.output_dir.resolve();output.mkdir(parents=True,exist_ok=True)
html=subprocess.check_output(['node','--input-type=module','-e',"import {getDefaultHTML} from './src/ui/default-html.js'; process.stdout.write(getDefaultHTML());"],cwd=root,text=True)
a=html.index('  var createModernInstrumentBinding =');b=html.index('  var createInstrumentThemeHost =',a)
factories=html[a:b]
static=re.sub(r'<script[\s\S]*?</script>','',html)
static=re.sub(r'<link[^>]*>','',static)
css='\n'.join((root/'public/css'/n).read_text() for n in re.findall(r'href="/styles/([^"?]+)',html))
font=base64.b64encode((root/'assets/fonts/Oxanium-Variable.ttf').read_bytes()).decode()
css+='\n@font-face{font-family:Oxanium;src:url(data:font/ttf;base64,'+font+')}\n'
static=static.replace('</head>','<style>'+css+'</style></head>')
script='''
const configs={kadett:['y1986_1994.europe',createKadettEuropeInstrument],multipla:['y1995_2002.europe',createMultiplaEuropeInstrument],c4:['y2003_2008.europe',createC4EuropeInstrument],xt:['y1986_1994.japan',createXtJapanInstrument],prius:['y2015_2019.japan',createPriusJapanInstrument],shield:['pre1949.america',createShieldAmericaInstrument],aa:['pre1949.japan',createAaJapanInstrument],crown:['y1950_1959.japan',createCrownJapanInstrument],portal:['y1960_1975.america',createPortalAmericaInstrument],v84:['y1976_1985.america',createCorvette84AmericaInstrument],deville:['y1995_2002.america',createDevilleAmericaInstrument],well:['y2003_2008.america',createThreeWellAmericaInstrument],camaro:['y2009_2014.america',createCamaroAmericaInstrument]};
window.renderInstrument=function(kind,mode,powertrain,stale,sweep){
 document.body.dataset.driveMode=mode;
 const root=document.getElementById('cluster');root.dataset.themeId=configs[kind][0];root.dataset.instrumentVariant='custom';root.dataset.ignitionPhase='live';root.dataset.ignitionKind='vehicle';
 window.currentInstrument?.destroy();
 window.currentInstrument=configs[kind][1]({document,mount:document.querySelector('.cluster-stage')});
 window.currentInstrument.update({speedKmh:350,rpm:11980,engineMaxRpm:12000,gearLabel:'10',powerKw:-248,throttlePercent:75,gX:-.42,currentLap:3599.99,bestLap:3590.32,wheels:[{tempC:104},{tempC:98}]},{mode,powertrain,stale,racing:true,rpmGauge:{gaugeMax:13000},displayOverride:sweep?{speed:1,rpm:1}:null});
};
window.measureLayout=function(){
 const el=currentInstrument.element,box=el.getBoundingClientRect(),texts=[],outside=[];
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const n=walker.currentNode,t=n.textContent.trim();if(!t)continue;
  const r=document.createRange();r.selectNodeContents(n);const br=r.getBoundingClientRect();
  if(!br.width||!br.height)continue;
  const style=getComputedStyle(n.parentElement);if(style.visibility==='hidden'||style.display==='none')continue;
  const obj={text:t,left:br.left,right:br.right,top:br.top,bottom:br.bottom};texts.push(obj);
  if(br.left<box.left-1||br.right>box.right+1||br.top<box.top-1||br.bottom>box.bottom+1)outside.push(t);
 }
 const overlaps=[];
 for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
  const a=texts[i],b=texts[j];const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  if(w>1.5&&h>1.5)overlaps.push([a.text,b.text]);
 }
 return {width:box.width,height:box.height,outside,overlaps};
};
'''
with sync_playwright() as p:
 launch={'headless':True,'args':['--no-sandbox']}
 if args.chromium: launch['executable_path']=args.chromium
 browser=p.chromium.launch(**launch)
 page=browser.new_page(reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(static);page.add_script_tag(content=factories+'\n'+script)
 checks=[]
 for width in [375,469,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for kind in ['kadett', 'multipla', 'c4', 'xt', 'prius', 'shield', 'aa', 'crown', 'portal', 'v84', 'deville', 'well', 'camaro']:
   for mode in ['race','freeRoam']:
    for powertrain in ['combustion','ev']:
     page.evaluate('([kind,mode,powertrain])=>renderInstrument(kind,mode,powertrain,false,false)',[kind,mode,powertrain]);page.wait_for_timeout(80)
     check=page.evaluate('measureLayout()');check.update({'viewport':width,'theme':kind,'mode':mode,'powertrain':powertrain});checks.append(check)
     if powertrain=='combustion':page.locator('.cluster-stage').screenshot(path=str(output/f'{kind}-{mode}-{width}.png'))
 page.emulate_media(reduced_motion='reduce')
 phase_checks=[]
 for kind in ['kadett', 'multipla', 'c4', 'xt', 'prius', 'shield', 'aa', 'crown', 'portal', 'v84', 'deville', 'well', 'camaro']:
  for phase in ['off-needles','off-frames','off-center','vehicle-blackout','vehicle-card','frames','scan','return','live']:
   page.evaluate('kind=>renderInstrument(kind,"race","combustion",false,true)',kind)
   check=page.evaluate('''phase=>{
    const root=document.getElementById('cluster');root.dataset.ignitionKind='vehicle';root.dataset.ignitionPhase=phase;
    const el=currentInstrument.element;
    const opacity=node=>{if(!node)throw Error('Missing animated meter');let result=1;for(let n=node;n&&n!==root;n=n.parentElement)result*=Number(getComputedStyle(n).opacity);return result;};
    const readout=el.querySelector('[data-next-value="speed"]');
    const meters=[...el.querySelectorAll('.kad-meter,[data-mul-needle],.heritage-needle,[data-heritage-speed-meter],.xt-graphic,[data-next-fill],[data-c4-temperature],[data-c4-input]')];
    if(!meters.length)throw Error('Missing animated meters');
    const meterOpacities=meters.map(opacity);
    return {phase,speedOpacity:opacity(readout),meterOpacities,maxMeterOpacity:Math.max(...meterOpacities),screenOpacity:opacity(el)};
   }''',phase)
   check['theme']=kind;phase_checks.append(check)
 for c in phase_checks:
  if c['phase'] in ['off-needles','off-frames','off-center','vehicle-blackout','vehicle-card']:assert c['speedOpacity']==0 and c['maxMeterOpacity']==0,c
  if c['phase']=='live':assert c['speedOpacity']==1 and c['maxMeterOpacity']==1,c
 (output/'css-phase-checks.json').write_text(json.dumps({'checks':phase_checks},indent=2))
 (output/'layout-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2))
 print(json.dumps({'cases':len(checks),'cssPhaseCases':len(phase_checks),'failed':[c for c in checks if c['outside'] or c['overlaps']],'errors':errors}))
 assert not errors and not any(c['outside'] or c['overlaps'] for c in checks), 'Browser layout checks failed; inspect reports and screenshots'
 browser.close()

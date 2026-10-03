from playwright.sync_api import sync_playwright
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Inspect actual theme and mode switches in Chromium')
parser.add_argument('--url',default='http://127.0.0.1:3000/')
parser.add_argument('--theme',action='append',help='Optional exact theme IDs to recheck')
parser.add_argument('--output-dir',type=Path,default=Path('/tmp/completion-preview'))
args=parser.parse_args()
args.output_dir.mkdir(parents=True,exist_ok=True)
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='no-preference')
 errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:failed.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 response=page.goto(args.url,wait_until='domcontentloaded')
 assert response.status==200
 page.wait_for_timeout(500)
 page.locator('#control-manual-btn').click();page.wait_for_timeout(300)
 page.evaluate('''()=>{window.phaseLog=[];const root=document.querySelector('#cluster');new MutationObserver(()=>{const instrument=document.querySelector('.next-instrument[data-active="true"]');const phase=root.dataset.ignitionPhase;const needle=instrument?.querySelector('[data-mul-needle],.heritage-needle,[data-heritage-speed-meter],.xt-graphic,[data-next-fill]');requestAnimationFrame(()=>{phaseLog.push({phase,kind:root.dataset.ignitionKind,theme:root.dataset.themeId,mode:instrument?.dataset.mode,needleOpacity:needle?getComputedStyle(needle).opacity:null});});}).observe(root,{attributes:true,attributeFilter:['data-ignition-phase']});}''')
 checks=[]
 for id,cls in [('y1986_1994.europe', '.kad-instrument'), ('y1995_2002.europe', '.mul-instrument'), ('y2003_2008.europe', '.c4-instrument'), ('y1986_1994.japan', '.xt-instrument'), ('y2015_2019.japan', '.pri-instrument'), ('pre1949.america', '.shield-instrument'), ('pre1949.japan', '.aa-instrument'), ('y1950_1959.japan', '.crown-instrument'), ('y1960_1975.america', '.portal-instrument'), ('y1976_1985.america', '.v84-instrument'), ('y1995_2002.america', '.deville-instrument'), ('y2003_2008.america', '.well-instrument'), ('y2009_2014.america', '.camaro-instrument')]:
  if args.theme and id not in args.theme:continue
  page.locator('.manual-theme-set__trigger').click();page.locator('button[data-theme-id="'+id+'"]').click()
  page.wait_for_function("([id])=>document.querySelector('#cluster').dataset.themeId===id&&document.querySelector('#cluster').dataset.ignitionPhase==='live'",arg=[id],timeout=20000)
  assert page.locator(cls).is_visible()
  assert page.locator('.next-instrument[data-active="true"]').count()==1
  for mode,button in [('freeRoam','#mode-freeroam-btn'),('race','#mode-race-btn')]:
   page.locator(button).click()
   page.wait_for_function("([mode])=>document.querySelector('#cluster').dataset.ignitionPhase==='live'&&document.querySelector('.next-instrument[data-active=\"true\"]').dataset.mode===mode",arg=[mode],timeout=20000)
   assert page.locator('.next-instrument[data-active="true"]').count()==1
   assert page.locator('.next-mode-identity:visible').count()==0
   checks.append({'theme':id,'mode':mode,'phase':'live'})
  print(json.dumps({'theme':id,'modeSwitches':2}),flush=True)
 assert checks,'No theme IDs matched'
 report={'status':response.status,'checks':checks,'phases':page.evaluate('phaseLog'),'errors':errors,'failedResponses':failed}
 (args.output_dir/'live-animation-checks.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({'status':response.status,'checks':checks,'phaseCount':len(report['phases']),'phaseNames':sorted(set(x['phase'] for x in report['phases'])),'errors':errors,'failedResponses':failed}))
 assert not errors and not failed
 b.close()

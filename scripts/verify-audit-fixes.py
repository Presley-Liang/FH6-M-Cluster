import argparse, json, shutil
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description='Regression-check audit fixes on an isolated dashboard receiver using synthetic data; not game acceptance.')
parser.add_argument('--url', required=True, help='An isolated receiver URL; never use the live game receiver for this audit')
parser.add_argument('--chromium', default=shutil.which('chromium') or shutil.which('chromium-browser'))
parser.add_argument('--output', type=Path, required=True)
args=parser.parse_args()
URL=args.url
packets=[dict(timestampMs=100000+i*50,positionX=i+10,positionZ=i/2+5,yaw=0,lapNumber=1,currentEngineRpm=2500,speedKmh=72,power=100000,tireTempFl=80,tireTempFr=81,tireTempRl=82,tireTempRr=83,throttle=120,brake=0,currentRaceTime=i*.05) for i in range(601)]
fixture=dict(id=901,bestLap=60,startedAt=100000,packetCount=len(packets),lapCount=1,packets=packets)
report={'generatedAt':datetime.now(timezone.utc).isoformat(),'scope':'Actual production HTML/CSS in isolated Chrome. Synthetic packets, route responses, and failures. No real game telemetry or game FPS claim.','url':URL,'checks':{}}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,**({'executable_path':args.chromium} if args.chromium else {}))
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='domcontentloaded');page.wait_for_function('()=>!!animationCoordinator')
    page.wait_for_timeout(150)
    page.evaluate("()=>{window._es.close();clientModeControl='manual';manualThemeId=DEFAULT_THEME_ID;manualThemeChosen=true;animationCoordinator.wake(vehicleProfileFromState({vehicle:{}}),clientDriveMode,applyThemeOverlay);}")
    assert page.evaluate("()=>[...document.querySelectorAll('link[rel=stylesheet]')].at(-1).href.includes('instrument-responsive.css')")
    # Baseline geometry uses actual tick values and same-car redline updates.
    packet=dict(carOrdinal=1598,engineMaxRpm=6300,engineIdleRpm=850,currentEngineRpm=6000,carClass=4,carPi=850,drivetrainType=2,speedKmh=100,isRaceOn=1,racePosition=3,currentLap=20)
    for _ in range(4): page.evaluate('p=>clusterBindings.update(p)',packet);page.wait_for_timeout(65)
    page.wait_for_timeout(500)
    baseline=page.evaluate('''()=>{const path=document.querySelector('#rpm-track'),total=path.getTotalLength(),g=6500;return [...document.querySelectorAll('#rpm-ticks text')].map(n=>{const value=Number(n.textContent)*1000,point=path.getPointAtLength(total*value/g),a=path.getPointAtLength(Math.max(0,total*value/g-1)),b=path.getPointAtLength(Math.min(total,total*value/g+1));let nx=-(b.y-a.y),ny=b.x-a.x,norm=Math.hypot(nx,ny)||1;nx/=norm;ny/=norm;if(nx*(1200-point.x)+ny*(360-point.y)<0){nx=-nx;ny=-ny;}return {value,error:Math.hypot(Number(n.getAttribute('x'))-(point.x+nx*39),Number(n.getAttribute('y'))-(point.y+ny*39+7))};});}''')
    assert max(t['error'] for t in baseline)<.001,baseline
    before=page.locator('.rpm-redline').get_attribute('stroke-dasharray') or page.locator('.rpm-redline').evaluate('(n)=>n.style.strokeDasharray')
    packet['engineMaxRpm']=6000;packet['carPi']=900;packet['drivetrainType']=1
    page.evaluate('p=>clusterBindings.update(p)',packet);page.wait_for_timeout(100)
    after=page.locator('.rpm-redline').get_attribute('stroke-dasharray') or page.locator('.rpm-redline').evaluate('(n)=>n.style.strokeDasharray')
    card=page.evaluate('()=>vehicleProfileFromState(latestVehicleState).metadata')
    assert before!=after,(before,after)
    assert '900' in card['classPi'] and card['drivetrain']=='RWD',card
    report['checks']['R10_R18_R21']={'baselineTickPositionErrors':baseline,'redlineBefore':before,'redlineAfter':after,'freshCardMetadata':card}
    # Custom geometry follows normal browser frames, not the details 50ms gate.
    page.evaluate("()=>{manualThemeId='y1995_2002.japan';animationCoordinator.wake(vehicleProfileFromState(latestVehicleState),'race',applyThemeOverlay);window.auditRenderTimes=[];window.auditRafTimes=[];const old=instrumentHost.update;instrumentHost.update=function(...a){auditRenderTimes.push(performance.now());return old(...a);};window.auditRafActive=true;function f(t){if(auditRafActive){auditRafTimes.push(t);requestAnimationFrame(f);}}requestAnimationFrame(f);}")
    page.wait_for_timeout(500)
    cadence=page.evaluate('()=>{auditRafActive=false;return {renders:auditRenderTimes.length,browserFrames:auditRafTimes.length,phase:document.querySelector("#cluster").dataset.ignitionPhase};}')
    assert cadence['renders']>=cadence['browserFrames']-1 and cadence['renders']>10,cadence
    report['checks']['R09']=cadence
    # New receiver's lower version accepted, then retired receiver cannot revert.
    state=page.evaluate("()=>{const old=serverInstanceId;applyServerState({receiverInstanceId:old,version:100,modeControl:'manual',driveMode:'race'});applyServerState({receiverInstanceId:'audit-new-instance',version:0,modeControl:'manual',driveMode:'freeRoam'});applyServerState({receiverInstanceId:old,version:999,modeControl:'auto',driveMode:'race'});return {instance:serverInstanceId,version:serverVersion,mode:clientDriveMode,control:clientModeControl};}")
    assert state==dict(instance='audit-new-instance',version=0,mode='freeRoam',control='manual'),state
    report['checks']['R24']=state
    # Policy rejection blocks theme choices and settles rollback presentation.
    page.evaluate("()=>{clientModeControl='auto';manualThemeId=DEFAULT_THEME_ID;animationCoordinator.wake(vehicleProfileFromState(latestVehicleState),clientDriveMode,applyThemeOverlay);syncControlModeUI();}")
    pending=[];page.route('**/mode-control',lambda r:pending.append(r))
    page.locator('#control-manual-btn').click();page.wait_for_timeout(100)
    blocked=page.locator('#manual-theme-button-set-mount').evaluate('(n)=>n.inert')
    assert blocked and len(pending)==1
    page.evaluate("document.querySelector('button[data-theme-id=\"pre1949.japan\"]').click()")
    assert page.evaluate('manualThemeId')!='pre1949.japan'
    pending[0].fulfill(status=500,content_type='application/json',body='{"error":"intentional audit rejection"}')
    page.wait_for_function('()=>!policyRequestInFlight')
    policy=page.evaluate('()=>({mode:clientModeControl,theme:document.querySelector("#cluster").dataset.themeId,card:animationCoordinator.state().vehicle.themeEra})')
    assert policy['mode']=='auto' and policy['theme']=='y2009_2014.europe',policy
    report['checks']['R11']={'themePickerInertWhilePending':blocked,'rollback':policy};page.unroute('**/mode-control')
    # Reduced-motion preference stops the active sweep, including queued writes.
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate("()=>animationCoordinator.switchMode('race',applyThemeOverlay)")
    page.wait_for_function("()=>document.querySelector('#cluster').dataset.ignitionPhase==='scan'",timeout=12000)
    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100)
    reduce=page.evaluate('()=>({phase:animationCoordinator.state().phase,evScan:document.querySelector("#cluster").dataset.evScan})')
    assert reduce['phase']=='live' and reduce['evScan']=='false';report['checks']['R12']=reduce
    # Hidden legacy canvas does no drawing, with a bounded retained trace.
    hidden=page.evaluate('''()=>{clientDriveMode='race';let draws=0;const old=_drawMapBg;window._drawMapBg=function(...a){draws++;return old(...a)};liveTrail=[];frameCount=0;prevRaceOn=false;for(let i=0;i<12000;i++)updateMapTrail({isRaceOn:true,positionX:10+i,positionZ:20+i,yaw:0,lapNumber:0});window._drawMapBg=old;return {draws,trail:liveTrail.length,canvasRects:mapCtx.canvas.getClientRects().length};}''')
    assert hidden['draws']==0 and hidden['trail']==2048,hidden;report['checks']['R36']=hidden
    # Replay is timestamp-driven; seeking rebases, close cancels, stale loads ignored.
    page.route('**/sessions',lambda r:r.fulfill(content_type='application/json',body=json.dumps([{k:v for k,v in fixture.items() if k!='packets'}])))
    page.route('**/session?id=901',lambda r:r.fulfill(content_type='application/json',body=json.dumps(fixture)))
    page.evaluate("document.querySelector('#sessions-btn').click()");page.wait_for_function("()=>document.querySelector('.s-lap')?.textContent.includes('60.000s')")
    page.evaluate('openSessionViewer(901)');page.wait_for_function('()=>currentViewerPackets?.length===601')
    assert page.evaluate('formatReplayTime(600)')=='0:30'
    page.locator('.vtab[data-tab="replay-map"]').click();page.locator('#replay-play').click();page.wait_for_timeout(1100)
    elapsed=page.evaluate('currentViewerTimeline[replayIdx].elapsedMs');assert 800<=elapsed<=1600,elapsed
    page.locator('#replay-slider').evaluate('(n)=>{n.value=400;n.dispatchEvent(new Event("input"));}');page.wait_for_timeout(250)
    seek=page.evaluate('currentViewerTimeline[replayIdx].elapsedMs');assert 20100<=seek<=20700,seek
    page.locator('#replay-play').click();assert page.evaluate('replayTimer===null&&!replayPlaying')
    page.locator('#replay-play').click();page.locator('#close-viewer').click();index=page.evaluate('replayIdx');page.wait_for_timeout(250)
    assert page.evaluate('replayTimer===null&&!replayPlaying&&replayIdx')==index
    oldLoads=[];page.route('**/session?id=902',lambda r:oldLoads.append(r))
    page.evaluate('openSessionViewer(902)');page.wait_for_timeout(100);page.evaluate('openSessionViewer(901)');page.wait_for_function('()=>currentViewerPackets?.length===601')
    oldLoads[0].fulfill(content_type='application/json',body=json.dumps(dict(fixture,id=902,packets=packets[:2])));page.wait_for_timeout(100)
    assert page.evaluate('currentViewerPackets.length')==601
    report['checks']['R30_R34_R35']={'bestLapSeconds':60,'fullTime':'0:30','after1100ms':elapsed,'afterSeekMs':seek,'pausedAndClosedTimer':True,'staleLoadIgnored':True}
    # A delayed failed initial GET cannot overwrite an already received Free state.
    other=browser.new_page(reduced_motion='reduce');initial=[]
    other.on('pageerror',lambda e:errors.append(str(e)))
    def mode_route(r):
        if r.request.method=='GET': initial.append(r)
        else: r.continue_()
    other.route('**/mode',mode_route);other.goto(URL,wait_until='domcontentloaded');other.wait_for_function('()=>!!animationCoordinator');other.wait_for_timeout(100)
    other.evaluate("applyServerState({receiverInstanceId:'fresh-mode',version:12,modeControl:'auto',driveMode:'freeRoam'})")
    for r in initial:r.abort()
    other.wait_for_timeout(100);assert other.evaluate('clientDriveMode')=='freeRoam'
    report['checks']['R25']={'modeAfterFailedOldGet':'freeRoam'}
    # An old GET from an unseen receiver must not retire the newly accepted one.
    late=[];third=browser.new_page(reduced_motion='reduce')
    third.on('pageerror',lambda e:errors.append(str(e)))
    third.route('**/mode',lambda r:late.append(r) if r.request.method=='GET' else r.continue_())
    third.goto(URL,wait_until='domcontentloaded');third.wait_for_function('()=>!!animationCoordinator');third.wait_for_timeout(100)
    third.evaluate("()=>{_es.close();applyServerState({receiverInstanceId:'receiver-B',version:0,modeControl:'auto',driveMode:'freeRoam'});}")
    for r in late:r.fulfill(content_type='application/json',body=json.dumps(dict(receiverInstanceId='unseen-old-A',version=900,modeControl='manual',driveMode='race')))
    third.wait_for_timeout(100)
    third.evaluate("applyServerState({receiverInstanceId:'receiver-B',version:1,modeControl:'auto',driveMode:'freeRoam'})")
    assert third.evaluate("serverInstanceId==='receiver-B'&&!retiredServerInstances.has('receiver-B')&&clientDriveMode==='freeRoam'")
    # Confirmed SSE state wins even if the same POST's HTTP response fails.
    controls=[];third.route('**/mode-control',lambda r:controls.append(r))
    third.locator('#control-manual-btn').click();third.wait_for_timeout(100);assert len(controls)==1
    third.evaluate("applyServerState({receiverInstanceId:'receiver-B',version:2,modeControl:'manual',driveMode:'freeRoam'})")
    controls[0].fulfill(status=500,content_type='application/json',body='{}');third.wait_for_function('()=>!policyRequestInFlight')
    assert third.evaluate('clientModeControl')=='manual'
    third.unroute('**/mode-control');controls=[];race=[]
    third.route('**/mode-control',lambda r:controls.append(r))
    third.unroute('**/mode');third.route('**/mode',lambda r:race.append(r) if r.request.method=='POST' else r.continue_())
    third.locator('#mode-race-btn').click();third.wait_for_timeout(100);assert len(race)==1
    third.locator('#control-auto-btn').click();third.locator('#control-manual-btn').click();third.locator('#control-auto-btn').click()
    assert third.evaluate('queuedControlMode')=='auto' and len(controls)==0
    race[0].fulfill(content_type='application/json',body=json.dumps(dict(receiverInstanceId='receiver-B',version=3,modeControl='manual',driveMode='race')))
    third.wait_for_function('()=>policyRequestInFlight');third.wait_for_timeout(50);assert len(controls)==1
    controls[0].fulfill(content_type='application/json',body=json.dumps(dict(receiverInstanceId='receiver-B',version=4,modeControl='auto',driveMode='freeRoam')))
    third.wait_for_function('()=>!policyRequestInFlight&&!modeRequestInFlight');assert third.evaluate("clientModeControl==='auto'&&clientDriveMode==='freeRoam'&&queuedControlMode===null")
    report['checks']['R11_R24_followup']={'unseenOldGetCannotRetireCurrentReceiver':True,'confirmedStateSurvivesHttpFailure':True,'lastAutoChoiceSerializedAfterPendingRace':True}
    report['errors']=errors;assert not errors,errors
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True));browser.close()

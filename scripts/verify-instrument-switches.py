from playwright.sync_api import sync_playwright
from pathlib import Path
import argparse
import json
import shutil

parser = argparse.ArgumentParser(description='Inspect actual theme and mode switches in Chromium')
parser.add_argument('--url', default='http://127.0.0.1:3000/')
parser.add_argument('--theme', action='append', help='Optional exact theme IDs to recheck')
parser.add_argument('--output-dir', type=Path, default=Path('/tmp/completion-preview'))
parser.add_argument(
    '--chromium',
    default=shutil.which('chromium') or shutil.which('chromium-browser'),
    help='Chromium executable. If omitted, use chromium/chromium-browser from PATH or Playwright managed Chromium.',
)
args = parser.parse_args()
args.output_dir.mkdir(parents=True, exist_ok=True)

themes = [
    ('y1986_1994.europe', '.kad-instrument'),
    ('y1995_2002.europe', '.mul-instrument'),
    ('y2003_2008.europe', '.c4-instrument'),
    ('y1986_1994.japan', '.xt-instrument'),
    ('y2015_2019.japan', '.pri-instrument'),
    ('pre1949.america', '.shield-instrument'),
    ('pre1949.japan', '.aa-instrument'),
    ('y1950_1959.japan', '.crown-instrument'),
    ('y1960_1975.america', '.portal-instrument'),
    ('y1976_1985.america', '.v84-instrument'),
    ('y1995_2002.america', '.deville-instrument'),
    ('y2003_2008.america', '.well-instrument'),
    ('y2009_2014.america', '.camaro-instrument'),
]
selected_themes = [(theme_id, selector) for theme_id, selector in themes if not args.theme or theme_id in args.theme]

vehicle_sequence = [
    'off-needles', 'off-frames', 'off-center', 'vehicle-blackout',
    'vehicle-card', 'frames', 'scan', 'return', 'live',
]
mode_sequence = [
    'off-needles', 'off-frames', 'off-center', 'center',
    'frames', 'scan', 'return', 'live',
]
off_phases = {'off-needles', 'off-frames', 'off-center', 'vehicle-blackout', 'vehicle-card'}


def validate_phase_log(phases, expected_transition_count):
    groups = {}
    for entry in phases:
        transition = entry.get('transition')
        if not isinstance(transition, int) or transition < 1:
            continue
        groups.setdefault(transition, []).append(entry)

    assert len(groups) == expected_transition_count, (
        f'Expected {expected_transition_count} transitions, recorded {len(groups)}'
    )

    validation = []
    for transition, entries in sorted(groups.items()):
        kinds = {entry.get('kind') for entry in entries}
        assert len(kinds) == 1, f'Transition {transition} changed kind: {kinds}'
        kind = next(iter(kinds))
        assert kind in {'vehicle', 'mode'}, f'Transition {transition} has unexpected kind {kind!r}'
        expected = vehicle_sequence if kind == 'vehicle' else mode_sequence
        observed = [entry.get('phase') for entry in entries]
        assert observed == expected, (
            f'Transition {transition} ({kind}) phase order mismatch: '
            f'expected {expected}, got {observed}'
        )

        opacity_checks = []
        for entry in entries:
            phase = entry.get('phase')
            opacities = entry.get('settledMeterOpacities')
            if phase not in off_phases or opacities is None:
                continue
            values = [float(value) for value in opacities]
            assert values, (
                f'Transition {transition} ({kind}) recorded no animated meters in {phase}'
            )
            max_value = max(values)
            # off-needles intentionally fades for .28 s; sample near the end of
            # that phase and allow a small timing margin. Later off phases must
            # already be effectively dark.
            limit = 0.20 if phase == 'off-needles' else 0.05
            assert max_value <= limit, (
                f'Transition {transition} ({kind}) left a meter visible in '
                f'{phase}: max settled opacity {max_value:.3f} > {limit:.2f}; '
                f'all meter opacities={values}'
            )
            opacity_checks.append({
                'phase': phase,
                'meterCount': len(values),
                'opacities': values,
                'maxOpacity': max_value,
                'limit': limit,
            })

        validation.append({
            'transition': transition,
            'kind': kind,
            'phases': observed,
            'opacityChecks': opacity_checks,
        })
    return validation


with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if args.chromium:
        launch['executable_path'] = args.chromium
    b = p.chromium.launch(**launch)
    page = b.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='no-preference')
    errors = []
    failed = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failed.append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
    response = page.goto(args.url, wait_until='domcontentloaded')
    assert response.status == 200
    page.wait_for_timeout(500)
    page.locator('#control-manual-btn').click()
    page.wait_for_timeout(300)
    # Normalize the starting mode before installing the observer. This keeps
    # every selected theme at exactly one vehicle + two real mode transitions,
    # even when the server happened to start in freeRoam.
    page.locator('#mode-race-btn').click()
    page.wait_for_function(
        "()=>document.querySelector('#cluster').dataset.ignitionPhase==='live'&&document.querySelector('.next-instrument[data-active=\"true\"]')?.dataset.mode==='race'",
        timeout=20000,
    )
    page.wait_for_timeout(100)
    page.evaluate('''()=>{
      window.phaseLog=[];
      window.transitionIndex=0;
      const root=document.querySelector('#cluster');
      const meterSelector='[data-mul-needle],.heritage-needle,[data-heritage-speed-meter],.xt-graphic,[data-next-fill],[data-c4-temperature],[data-c4-input],.next-readout strong';
      const effectiveOpacity=node=>{
        let value=1;
        for(let current=node;current&&current!==root;current=current.parentElement){
          const opacity=Number.parseFloat(getComputedStyle(current).opacity);
          if(Number.isFinite(opacity)) value*=opacity;
        }
        return value;
      };
      const readOpacities=()=>{
        const instrument=document.querySelector('.next-instrument[data-active="true"]');
        if(!instrument) return [];
        return [...instrument.querySelectorAll(meterSelector)].map(effectiveOpacity);
      };
      new MutationObserver(()=>{
        const phase=root.dataset.ignitionPhase;
        if(phase==='off-needles') window.transitionIndex+=1;
        const instrument=document.querySelector('.next-instrument[data-active="true"]');
        const entry={
          transition:window.transitionIndex,
          phase,
          kind:root.dataset.ignitionKind,
          theme:root.dataset.themeId,
          mode:instrument?.dataset.mode,
          meterOpacities:readOpacities(),
          settledMeterOpacities:null
        };
        phaseLog.push(entry);
        const delay=phase==='off-needles'?260:80;
        setTimeout(()=>{
          if(root.dataset.ignitionPhase===phase) entry.settledMeterOpacities=readOpacities();
        },delay);
      }).observe(root,{attributes:true,attributeFilter:['data-ignition-phase']});
    }''')

    checks = []
    for theme_id, selector in selected_themes:
        page.locator('.manual-theme-set__trigger').click()
        page.locator('button[data-theme-id="' + theme_id + '"]').click()
        page.wait_for_function(
            "([id])=>document.querySelector('#cluster').dataset.themeId===id&&document.querySelector('#cluster').dataset.ignitionPhase==='live'",
            arg=[theme_id],
            timeout=20000,
        )
        assert page.locator(selector).is_visible()
        assert page.locator('.next-instrument[data-active="true"]').count() == 1
        for mode, button in [('freeRoam', '#mode-freeroam-btn'), ('race', '#mode-race-btn')]:
            page.locator(button).click()
            page.wait_for_function(
                "([mode])=>document.querySelector('#cluster').dataset.ignitionPhase==='live'&&document.querySelector('.next-instrument[data-active=\"true\"]').dataset.mode===mode",
                arg=[mode],
                timeout=20000,
            )
            assert page.locator('.next-instrument[data-active="true"]').count() == 1
            assert page.locator('.next-mode-identity:visible').count() == 0
            checks.append({'theme': theme_id, 'mode': mode, 'phase': 'live'})
        print(json.dumps({'theme': theme_id, 'modeSwitches': 2}), flush=True)

    assert checks, 'No theme IDs matched'
    # Let the delayed opacity sample for the last live transition settle before
    # collecting the final phase log.
    page.wait_for_timeout(300)
    phases = page.evaluate('phaseLog')
    validation = validate_phase_log(phases, expected_transition_count=len(selected_themes) * 3)
    report = {
        'status': response.status,
        'chromium': args.chromium or 'playwright-managed',
        'checks': checks,
        'phases': phases,
        'validation': validation,
        'errors': errors,
        'failedResponses': failed,
    }
    (args.output_dir / 'live-animation-checks.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({
        'status': response.status,
        'checks': checks,
        'transitionCount': len(validation),
        'phaseCount': len(phases),
        'phaseNames': sorted(set(x['phase'] for x in phases)),
        'errors': errors,
        'failedResponses': failed,
    }))
    assert not errors and not failed
    b.close()

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const themes = [
  'classical-europe', 'belair-america', 'early-911-europe', 's30-japan',
  'ae86-japan', 'retro-digital-america', 'jdm90', 'rx8-japan',
  'r8-europe', 'c8-america', 'ds-europe', 'lfa-japan', 'cx-europe', 'ford-gt-america', 'taycan-europe', 'panoramic-europe',
];
const css = name => readFileSync(new URL(`../public/css/${name}-instrument.css`, import.meta.url), 'utf8');

test('each existing custom instrument follows the shared switch phase order', () => {
  for (const name of themes) {
    const sheet = css(name);
    for (const phase of ['off-needles', 'off-frames', 'off-center', 'vehicle-blackout', 'vehicle-card', 'frames', 'scan']) {
      assert.ok(sheet.includes(`data-ignition-phase="${phase}"`), `${name} handles ${phase}`);
    }
    const cardRule = sheet.split('\n').find(line => line.includes('data-ignition-kind="vehicle"') && line.includes('data-ignition-phase="vehicle-card"'));
    assert.ok(cardRule && /opacity\s*:\s*0/.test(cardRule), `${name} hides its instrument while the vehicle card is visible`);
  }
});

test('mode titles cannot persist into the relight or sweep phases', () => {
  for (const name of themes) {
    const sheet = css(name);
    const titleClass = {
      'classical-europe': 'ce-mode-identity', 'belair-america': 'ba-mode-identity',
      'early-911-europe': 'e911-mode-identity', 's30-japan': 's30-mode-identity',
      'ae86-japan': 'ae86-mode-identity', 'retro-digital-america': 'rda-mode-identity',
      jdm90: 'jdm90-mode-identity', 'rx8-japan': 'rx8-mode-identity',
      'r8-europe': 'r8-mode-identity', 'c8-america': 'c8-mode-identity',
      'ds-europe': 'ds-mode-identity', 'lfa-japan': 'lfa-mode-identity',
      'cx-europe': 'cx-mode-identity',
      'ford-gt-america': 'fgt-mode-identity',
      'taycan-europe': 'tay-mode-identity',
      'panoramic-europe': 'pan-mode-identity',
    }[name];
    const sweepRules = sheet.split('\n').filter(line => line.includes('data-ignition-phase="scan"') && line.includes(`.${titleClass}`));
    if (name === 'c8-america') {
      assert.match(sheet, /\.c8-mode-identity\s*\{\s*display:none/);
      assert.match(sheet, /data-ignition-phase="center"\]\s+\.c8-mode-identity\s*\{\s*display:flex/);
    } else {
      assert.ok(sweepRules.some(line => /(?:display\s*:\s*none|visibility\s*:\s*hidden)/.test(line)), `${name} title is hidden by scan`);
    }
  }
});

test('panoramic projection fits narrow preview panes without clipping its controls or readouts', () => {
  const sheet = css('panoramic-europe');
  assert.match(sheet, /@media\(max-width:759px\)\s*\{/);
  assert.match(sheet, /#cluster\[data-theme-id="y2025plus\.europe"\]\{width:100%;max-width:100%;min-width:0/);
  assert.match(sheet, /#cluster\[data-theme-id="y2025plus\.europe"\] \.cluster-stage\{height:340px;aspect-ratio:auto\}/);
  assert.match(sheet, /\.pan-projection-right\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:1fr 1fr/);
  assert.match(sheet, /\.pan-instrument\[data-powertrain="ev"\] \.pan-gear\{flex-direction:column/);
});

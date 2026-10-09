import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDefaultHTML } from '../src/ui/default-html.js';

const css = name => readFileSync(new URL(`../public/css/${name}`, import.meta.url), 'utf8');
const responsive = css('instrument-responsive.css');

test('responsive adaptations load after theme styles and keep legacy changes in narrow-window rules', () => {
  const html = getDefaultHTML();
  assert.ok(html.lastIndexOf('/styles/instrument-responsive.css') > html.lastIndexOf('/styles/vehicle-info-card.css'));
  const narrow = responsive.indexOf('@media (min-width:760px) and (max-width:1099px)');
  assert.ok(narrow > 0);
  assert.doesNotMatch(responsive.slice(0, narrow), /y2015_2019\.europe|\.instrument-shell|\.center-window|\.fixed-info/);
  assert.match(responsive.slice(narrow), /y2015_2019\.europe.*aux-scale/);
  assert.doesNotMatch(responsive, /\.instrument-shell\s*\{|\.center-window\s*\{|\.fixed-info\s*\{/);
});

test('SVG text floors use calibrated viewBox units and keep BOOST below RPM in small windows', () => {
  assert.match(responsive, /\.boost-status\s*\{[^}]*font-size:40px/);
  assert.match(responsive, /\.boost-module\s*\{[^}]*translateY\(50px\)/);
  assert.match(responsive, /\.gauge-ticks text\s*\{[^}]*font-size:38px/);
  assert.match(responsive, /\.ba-tick-number\s*\{[^}]*font-size:54px/);
  assert.match(responsive, /\.pri-instrument \.pri-screens header small/);
});

test('AE86 keeps a bounded circular bezel and clears the bottom tick labels on narrow screens', () => {
  assert.match(css('ae86-japan-instrument.css'), /width:min\(100%,24\.5cqw,38vh\);\s*aspect-ratio:1/);
  assert.match(responsive, /\.ae86-dial-word\s*\{[^}]*left:22%;[^}]*right:22%;[^}]*bottom:9%/);
});

test('Civic short windows constrain the main row and preserve a circular G field', () => {
  assert.match(responsive, /\.ctr-main\s*\{\s*grid-template-rows:minmax\(0,1fr\)/);
  assert.match(responsive, /:is\(\.ctr-left,\.ctr-right,\.ctr-primary\)\s*\{\s*min-height:0/);
  assert.match(responsive, /\.ctr-g-field\s*\{\s*width:min\(16cqw,8vh\);\s*height:min\(16cqw,8vh\)/);
});

test('vehicle identity wraps complete model names and reserves stage height', () => {
  const card = css('vehicle-info-card.css');
  const model = card.match(/\.vehicle-card-identity strong\s*\{([^}]+)\}/)?.[1];
  assert.ok(model);
  assert.match(model, /overflow-wrap:anywhere/);
  assert.match(model, /white-space:normal/);
  assert.doesNotMatch(model, /text-overflow:ellipsis|overflow:hidden/);
  assert.match(card, /max-height:calc\(100% - 32px\)/);
});

test('mechanical needle shadows turn off with the needles during mode transitions', () => {
  for (const [filename, needles] of [
    ['classical-europe-instrument.css', ['.ce-speed-needle-shadow', '.ce-drive-needle-shadow']],
    ['belair-america-instrument.css', ['.ba-speed-needle-shadow']],
  ]) {
    const file = css(filename);
    const offRule = file.split('\n').find(line => line.includes('[data-ignition-kind="mode"]') && line.includes('[data-ignition-phase="off-needles"]'));
    assert.ok(offRule, `${filename} has a mode shutdown rule`);
    for (const needle of needles) assert.ok(offRule.includes(needle), `${filename} includes ${needle}`);
    assert.match(offRule, /opacity:0/);
  }
});

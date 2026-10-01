import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('SVG attribute rotated needles do not also declare CSS or inline transform origins', () => {
  const cases = [
    ['jdm90', 'public/js/themes/jdm90-instrument.js', 'public/css/jdm90-instrument.css', ['.jdm90-needle-shadow,.jdm90-needle']],
    ['RX-8', 'public/js/themes/rx8-japan-instrument.js', 'public/css/rx8-japan-instrument.css', ['.rx8-side-needle', '.rx8-tach-needle,.rx8-tach-needle-shadow']],
  ];
  for (const [name, jsPath, cssPath, selectors] of cases) {
    const js = source(jsPath);
    const css = source(cssPath);
    assert.match(js, /setAttribute\('transform',\s*transform\)/, name + ' uses SVG pivot transforms');
    assert.doesNotMatch(js, /needle\.style\.transform\s*=/, name + ' must not override the SVG pivot');
    for (const selector of selectors) {
      const rule = css.split(selector + ' {')[1]?.split('}')[0] ?? '';
      assert.ok(rule, name + ' needle CSS rule exists');
      assert.doesNotMatch(rule, /transform-origin\s*:/, name + ' must not apply a second origin');
    }
  }
});

test('new 911 needle rotations keep their 200,200 SVG pivots and classical pointers use path geometry', () => {
  const early911 = source('public/js/themes/early-911-europe-instrument.js');
  const classical = source('public/js/themes/classical-europe-instrument.js');
  assert.match(early911, /' 200 200\)'/);
  assert.doesNotMatch(source('public/css/early-911-europe-instrument.css'), /\.e911-needle[^{}]*\{[^}]*transform-origin\s*:/);
  assert.match(classical, /needle\.setAttribute\('d', path\)/);
  assert.doesNotMatch(classical, /needle\.style\.transform\s*=/);
});

test('all custom analog needles rotate around the center drawn by their SVG hub', () => {
  const cases = [
    ['GX yaw', 'gx-japan', '50', '50'],
    ['AE86', 'ae86-japan', '200', '200'],
    ['S30', 's30-japan', '200', '200'],
    ['R8', 'r8-europe', '200', '200'],
    ['LFA era TFT', 'lfa-japan', '200', '200'],
    ['early 911', 'early-911-europe', '200', '200'],
    ['JDM 90', 'jdm90', '360', '360'],
    ['RX-8', 'rx8-japan', '300', '300'],
  ];
  for (const [name, stem, cx, cy] of cases) {
    const js = source(`public/js/themes/${stem}-instrument.js`);
    const css = source(`public/css/${stem}-instrument.css`);
    assert.match(js, new RegExp(`cx="${cx}" cy="${cy}"`), `${name} SVG hub is drawn at its pivot`);
    assert.ok(js.includes(` ${cx} ${cy})`), `${name} uses the hub as its SVG rotation pivot`);
    assert.doesNotMatch(css, /\.\S*needle[^{}]*\{[^}]*transform-origin\s*:/, `${name} does not add a CSS pivot`);
  }
  const rx8 = source('public/js/themes/rx8-japan-instrument.js');
  assert.match(rx8, /cx="180" cy="180"/);
  assert.match(rx8, / 180 180\)'/);
});

test('DS era panoramic indicator stays within its labeled speed ribbon', () => {
  const js = source('public/js/themes/ds-europe-instrument.js');
  const css = source('public/css/ds-europe-instrument.css');
  assert.match(js, /node\.style\.left = \(i \/ 14 \* 100\) \+ '%'/);
  assert.match(js, /\(8 \+ fraction \* 84\)\.toFixed\(2\) \+ '%'/);
  assert.match(css, /\.ds-window-scale\{[^}]*left:8%;right:8%/);
  assert.doesNotMatch(css, /\.ds-speed-needle\{[^}]*transform-origin\s*:/);
});

test('CX rolling drums align each number to the center of its lens without a pointer', () => {
  const js = source('public/js/themes/cx-europe-instrument.js');
  const css = source('public/css/cx-europe-instrument.css');
  assert.match(js, /const offset = \(1\.42 \+ clamp\(fraction\) \* steps \* 2\.84\)/);
  assert.match(css, /\.cx-drum-mark\{height:2\.84cqw/);
  assert.match(css, /\.cx-drum-track\{position:absolute;top:50%/);
  assert.match(js, /speedFromFraction\(override\.speed\)/);
  assert.match(js, /const speedStops = \[0, 20, 40, 60, 100, 140, 200, 260\]/);
  assert.doesNotMatch(js, /createElementNS|<svg|style\.transformOrigin/);
});

test('Ford GT-era tachometer uses a kinked path and compressed low-rpm scale without a needle', () => {
  const js = source('public/js/themes/ford-gt-america-instrument.js');
  const css = source('public/css/ford-gt-america-instrument.css');
  assert.match(js, /M 70 118 L 820 118 Q 908 118 926 205/);
  assert.match(js, /const normalX = \(after\.y - before\.y\) \/ tangentLength/);
  assert.match(js, /ratio \/ \.43 \* \.25/);
  assert.match(js, /speedFromFraction\(override\.speed\)/);
  assert.match(css, /\.fgt-tach-fill\{stroke:var\(--fgt-accent\)/);
  assert.doesNotMatch(js, /rotate\(|transformOrigin|needle\.setAttribute/);
});

test('Taycan-era floating display uses a vertical drive scale without a pivot', () => {
  const js = source('public/js/themes/taycan-europe-instrument.js');
  const css = source('public/css/taycan-europe-instrument.css');
  assert.match(js, /meter\.style\.height = \(driveFraction \* 100\)\.toFixed\(2\) \+ '%'/);
  assert.match(js, /speedFromFraction\(override\.speed\)/);
  assert.match(css, /\.tay-drive-track i\{position:absolute;bottom:0/);
  assert.doesNotMatch(js, /rotate\(|transformOrigin|needle\.setAttribute|createElementNS/);
});

test('2025+ panoramic projection uses a horizontal power trace without a needle', () => {
  const js = source('public/js/themes/panoramic-europe-instrument.js');
  const css = source('public/css/panoramic-europe-instrument.css');
  assert.match(js, /meter\.style\.width = \(fraction \* 100\)\.toFixed\(2\) \+ '%'/);
  assert.match(js, /speedFromFraction\(override\.speed\)/);
  assert.match(css, /\.pan-power-track>i\{position:absolute;left:0;top:0;bottom:0/);
  assert.doesNotMatch(js, /rotate\(|transformOrigin|needle\.setAttribute|createElementNS/);
});

test('path-based mechanical needles use the same center as their SVG hubs', () => {
  const belair = source('public/js/themes/belair-america-instrument.js');
  assert.match(belair, /cx="500" cy="472"/);
  assert.match(belair, /return \[500 \+ Math\.sin\(rad\) \* radius, 472 - Math\.cos\(rad\) \* radius\]/);
  assert.match(belair, /500 \+ dx \* 344, 472 \+ dy \* 344/);

  const classical = source('public/js/themes/classical-europe-instrument.js');
  assert.match(classical, /cx="300" cy="300"/);
  assert.match(classical, /return \[300 \+ Math\.sin\(radian\) \* radius, 300 - Math\.cos\(radian\) \* radius\]/);
  assert.match(classical, /needle\.setAttribute\('d', path\)/);
});

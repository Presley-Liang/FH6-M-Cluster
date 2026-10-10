import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = name => readFileSync(new URL('../public/css/' + name, import.meta.url), 'utf8');

test('LFA has a central ring and independent auxiliary columns without shrinking text', () => {
  const source = css('lfa-japan-instrument.css');
  assert.match(source, /\.lfa-ring\{grid-column:2;grid-row:1/);
  assert.match(source, /\.lfa-side-left\{grid-column:1;grid-row:1\}/);
  assert.match(source, /\.lfa-side-right\{grid-column:3;grid-row:1\}/);
  assert.match(source, /lfa-ring-offset/);
  assert.doesNotMatch(source, /scale\(\.96\)/);
});

test('LFA build ends at the same ring offset used by live mode to avoid a final snap', () => {
  assert.match(css('lfa-japan-instrument.css'), /to\{opacity:1;transform:translateX\(var\(--lfa-ring-offset\)\) scale\(1\) rotate\(0\)/);
});

test('S30 triple auxiliary gauges are horizontal with a top row on narrow windows', () => {
  const source = css('s30-japan-instrument.css');
  assert.match(source, /\.s30-aux-stack\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(source, /\.s30-aux\{order:-1/);
});

test('DeVille speed and gear occupy one centered column and AA housings remain circular', () => {
  assert.match(css('deville-america-instrument.css'), /\.deville-speed-window\{[^}]*inset:30% 28% 12%[^}]*flex-direction:column/);
  assert.match(css('aa-japan-instrument.css'), /\.aa-cylinder\{[^}]*aspect-ratio:1/);
});

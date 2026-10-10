import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const palette = readFileSync(new URL('../public/css/race-combat-palette.css', import.meta.url), 'utf8');
const civic = readFileSync(new URL('../public/css/civic-japan-instrument.css', import.meta.url), 'utf8');

test('Race static needle glow cannot override the approved European scan glow', () => {
  const needleRules = [...palette.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => selector.includes('.gauge-needle') && /\bfilter\s*:/.test(body));
  assert.equal(needleRules.length, 1);
  assert.ok(needleRules[0][1].includes(':not([data-ignition-phase="scan"])'));
});

test('Race target-title styling includes legacy mode identity and excludes vehicle identity', () => {
  const selectors = [...palette.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector]) => selector)
    .filter(selector => selector.includes('[data-target-mode="race"]') && selector.includes('identity'));
  assert.ok(selectors.length >= 4);
  for (const selector of selectors) {
    assert.ok(!selector.includes('[class$="-identity"]'));
    assert.ok(!selector.includes('.vehicle-card-identity'));
  }
  assert.ok(selectors.some(selector => selector.includes('.mode-identity,')));
});

test('Civic Race decorative rail has a scoped accent override above generic path paint', () => {
  assert.match(civic, /#cluster\s+\.ctr-instrument\[data-mode="race"\]\s+\.ctr-tach-track\s+\.ctr-combat-rail\s*\{\s*stroke:var\(--ctr-accent\)/);
  assert.match(civic, /\.ctr-combat-rail\{[^}]*opacity:0/);
});

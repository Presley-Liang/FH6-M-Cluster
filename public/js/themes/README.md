# Theme system boundary

This folder defines the 33-theme configuration, the DOM adapter, and the
instrument host used by the current page. `default-html.js` embeds the
factories into the standalone dashboard; only exact theme IDs with a custom
instrument factory replace the legacy instrument. All other IDs continue to
use the shared instrument shell and era/region tokens.

## Stable interface

```js
import { DEFAULT_THEME_ID, THEME_REGISTRY, resolveTheme } from './theme-registry.js';
import { applyTheme, applyVehicleTheme, createThemeAdapter } from './theme-adapter.js';

const resolved = resolveTheme({
  themeId: DEFAULT_THEME_ID,
  driveMode: 'race', // 'race' | 'freeRoam'
  powertrain: 'combustion', // 'combustion' | 'ev'
  capabilities: {}, // explicit, verified signal contracts only
});
applyTheme(document.getElementById('cluster'), {
  themeId: resolved.themeId,
  driveMode: resolved.mode.id,
  powertrain: 'combustion',
});
```

When task A supplies its resolved vehicle theme, use the strict integration
adapter:

```js
const result = applyVehicleTheme(clusterRoot, resolvedVehicleTheme, capabilities);
if (!result.resolved) {
  // Keep the current display and surface the metadata contract error to integration.
}
```

The registry has exactly 33 base IDs: each of the 11 era IDs is paired with
`europe`, `america`, and `japan`. Race and Free Roam are overlays applied after
the base theme. The EV display override is a separate powertrain concern and
does not create new registry entries.

`createInstrumentThemeHost()` owns custom instrument instances. It activates
one exact theme ID, pauses updates for hidden custom instruments, and receives
the existing `selectTelemetry()` model through the page's single
`createClusterBindings()` render callback. A custom factory returns
`{ element, update(model, context), destroy }`; it must not open another SSE
connection, read the Store independently, or control Session state. The host
sets `data-instrument-variant=custom` on the cluster while a custom instrument
is active, so the old BMW shell stays mounted but visually hidden.

Exact custom instrument IDs currently mounted by this branch are
`pre1949.europe`,
`y1986_1994.america`,
`y1995_2002.japan`,
`y1960_1975.europe`,
`y2003_2008.japan`,
`y2020_2024.america`,
`y1950_1959.america`,
`y1976_1985.japan`,
`y2009_2014.europe`,
`y1960_1975.japan`,
`y1950_1959.europe`,
`y2009_2014.japan`,
`y1976_1985.europe`,
`y2015_2019.america`,
`y2020_2024.europe`,
`y2025plus.europe`,
`y2020_2024.japan`,
`y2025plus.america`,
`y2025plus.japan`,
`y1986_1994.europe`,
`y1995_2002.europe`,
`y2003_2008.europe`.
`y2015_2019.europe` remains the existing baseline: 23 independent surfaces
and 10 shared-shell IDs. This branch starts from main; the two Japanese
surfaces in PR #3 are separate. After both batches merge, the total is 25.
The three new European surfaces remain development previews with reference
verification boundaries documented in `docs/EUROPE_REMAINING_REFERENCE_AND_IMPLEMENTATION_2026-10-03.md`.
Vehicle-change cards use the target era and region in one combined card and
do not start an ENGINE/TELEMETRY/DISPLAY self-check.

## Era IDs

`pre1949`, `y1950_1959`, `y1960_1975`, `y1976_1985`, `y1986_1994`,
`y1995_2002`, `y2003_2008`, `y2009_2014`, `y2015_2019`, `y2020_2024`,
`y2025plus`.

The default anchor is `y2015_2019.europe`, preserving the current modern
European performance direction. Region and era visual tokens can be maintained
centrally in `theme-tokens.js`.

## Integration contract for task A

Task A's `resolveVehicleTheme()` returns both its source identifiers, such as
`baseThemeId: '2015-2019.americas'`, `region: 'americas'`, and
`powertrain: 'electric'`, plus canonical fields `themeId: 'y2015_2019.america'`,
`eraId: 'y2015_2019'`, and `regionId: 'america'`. Use `applyVehicleTheme()` (or
`mapVehicleThemeMetadata()`) at the boundary. The explicit adapter maps the
source year/region/powertrain IDs to registry IDs such as
`y2015_2019.america`, `america`, and `ev`, then verifies that these agree with
the canonical fields from task A. All 33 source IDs are enumerated in
`VEHICLE_THEME_ID_MAP`; the year, region, and powertrain translations are
exported individually from `theme-registry.js`.

The mapping validates `resolved`, `baseThemeId`, `yearBandId`, `region`,
`powertrain`, `powertrainOverride`, `themeId`, `eraId`, and `regionId` together.
Missing metadata or mismatched identifiers return
`{ resolved: false, reason: ..., themeId: ... }`; unknown metadata reports the
default anchor ID while remaining explicitly unresolved. `applyVehicleTheme()`
leaves the DOM untouched in that case; it does not mask integration mismatches
with the default anchor. Do not infer year, region, or EV status from a vehicle
name or ordinal here. The generic `resolveTheme()` remains available for callers that
already have registry IDs; it falls back to the default anchor for unknown IDs
and reports `fallback: true`.

For EV signals, each capability must explicitly provide:

```js
{ available: true, verified: true, sourceKey: '...', unit: '...' }
```

Missing or unverified contracts make that signal unavailable. No values are
read or invented here. Without SOC, REGEN, or ENERGY contracts, those visual
slots must stay hidden. The EV override only marks combustion RPM and shift
logic for removal when integration can supply a trustworthy `powertrain: 'ev'`.

## Boundaries

- The adapter only sets `--theme-*` CSS custom properties and `data-theme-*`,
  `data-drive-mode`, and `data-display-*` attributes on the supplied element.
- It does not create or clone telemetry components, bind fields, read packet
  values, animate gauges, or mutate the telemetry store.
- Semantic brake, warning, temperature, throttle, recording, and unavailable
  colors remain stable across themes.
- Existing `switchMode(mode, applyTheme)` is a future integration point; this
  module is currently independent and requires no changes to the HTML template,
  shell, selectors, or animation coordinator.

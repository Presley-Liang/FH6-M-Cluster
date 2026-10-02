import { ERA_PROFILES, REGION_PROFILES, SEMANTIC_COLORS } from './theme-tokens.js';

export const DEFAULT_THEME_ID = 'y2015_2019.europe';
export const ERA_IDS = Object.freeze(Object.keys(ERA_PROFILES));
export const REGION_IDS = Object.freeze(Object.keys(REGION_PROFILES));

function freezeTheme(eraId, regionId) {
  const era = ERA_PROFILES[eraId];
  const region = REGION_PROFILES[regionId];
  const themeId = `${eraId}.${regionId}`;
  return Object.freeze({
    id: themeId,
    eraId,
    regionId,
    label: `${era.label} · ${region.label}`,
    isDefault: themeId === DEFAULT_THEME_ID,
    era,
    region,
    tokens: Object.freeze({
      surface: era.surface,
      panel: era.panel,
      ink: era.ink,
      muted: era.muted,
      metal: era.metal,
      grid: era.grid,
      glow: era.glow,
      accent: region.accent,
      accentStrong: region.accentStrong,
      cool: region.cool,
    }),
    visual: Object.freeze({
      dial: era.dial,
      bezel: era.bezel,
      typography: era.typography,
      motion: era.motion,
      density: era.density,
      regionalTypography: region.typography,
      silhouette: region.silhouette,
      contrast: region.contrast,
      informationDensity: region.informationDensity,
      materials: region.materials,
      tickWeight: region.tickWeight,
    }),
  });
}

const entries = Object.create(null);
for (const eraId of ERA_IDS) {
  for (const regionId of REGION_IDS) {
    const theme = freezeTheme(eraId, regionId);
    entries[theme.id] = theme;
  }
}

export const THEME_REGISTRY = Object.freeze(entries);
export const BASE_THEME_COUNT = Object.keys(THEME_REGISTRY).length;

// Exact identifiers currently exported by src/vehicle/vehicle-metadata.js.
// Keep translation here, at the integration boundary, so neither module has
// to adopt the other's internal naming convention.
export const VEHICLE_YEAR_BAND_TO_ERA = Object.freeze({
  'pre-1949': 'pre1949',
  '1950-1959': 'y1950_1959',
  '1960-1975': 'y1960_1975',
  '1976-1985': 'y1976_1985',
  '1986-1994': 'y1986_1994',
  '1995-2002': 'y1995_2002',
  '2003-2008': 'y2003_2008',
  '2009-2014': 'y2009_2014',
  '2015-2019': 'y2015_2019',
  '2020-2024': 'y2020_2024',
  '2025+': 'y2025plus',
});

export const VEHICLE_REGION_TO_THEME_REGION = Object.freeze({
  europe: 'europe',
  americas: 'america',
  japan: 'japan',
});

export const VEHICLE_POWERTRAIN_TO_DISPLAY = Object.freeze({
  combustion: 'combustion',
  hybrid: 'hybrid',
  electric: 'ev',
  unknown: 'unknown',
});

const vehicleThemeIdMap = Object.create(null);
for (const [yearBandId, eraId] of Object.entries(VEHICLE_YEAR_BAND_TO_ERA)) {
  for (const [vehicleRegionId, themeRegionId] of Object.entries(VEHICLE_REGION_TO_THEME_REGION)) {
    vehicleThemeIdMap[`${yearBandId}.${vehicleRegionId}`] = `${eraId}.${themeRegionId}`;
  }
}
export const VEHICLE_THEME_ID_MAP = Object.freeze(vehicleThemeIdMap);

export const MODE_OVERLAYS = Object.freeze({
  race: Object.freeze({
    id: 'race',
    accent: '#C0392B',
    accentStrong: '#E74C3C',
    emphasis: Object.freeze(['gear', 'rpm', 'shift-light', 'lap-time', 'delta', 'temperature', 'g-force']),
    navigation: 'secondary',
  }),
  freeRoam: Object.freeze({
    id: 'freeRoam',
    accent: '#2563EB',
    accentStrong: '#3B82F6',
    emphasis: Object.freeze(['speed', 'navigation', 'vehicle-state', 'cruise']),
    navigation: 'primary',
  }),
});

const POWERTRAIN_SIGNALS = Object.freeze({ power: 'POWER', regen: 'REGEN', soc: 'SOC', energy: 'ENERGY' });

function validCapability(capabilities, signal) {
  const item = capabilities?.[signal];
  return Boolean(item && item.available === true && item.verified === true
    && typeof item.sourceKey === 'string' && item.sourceKey.trim()
    && typeof item.unit === 'string' && item.unit.trim());
}

// EV is a display-domain override. It only exposes a signal when a later
// metadata/telemetry contract explicitly marks its source and unit as verified.
export function resolvePowertrainOverride(powertrain, capabilities = {}) {
  if (powertrain !== 'ev') return null;
  const signals = {};
  for (const [key, label] of Object.entries(POWERTRAIN_SIGNALS)) {
    const available = validCapability(capabilities, key);
    const capability = available ? capabilities[key] : null;
    signals[key] = Object.freeze({
      key,
      label,
      available,
      sourceKey: capability?.sourceKey ?? null,
      unit: capability?.unit ?? null,
    });
  }
  return Object.freeze({
    kind: 'ev',
    hideCombustionRpm: true,
    hideCombustionShiftLogic: true,
    primarySignal: signals.power.available ? 'power' : null,
    signals: Object.freeze(signals),
  });
}

export function getTheme(themeId = DEFAULT_THEME_ID) {
  return THEME_REGISTRY[themeId] ?? THEME_REGISTRY[DEFAULT_THEME_ID];
}

export function resolveTheme({ themeId, eraId, regionId, driveMode = 'race', powertrain = 'combustion', capabilities } = {}) {
  const candidateId = themeId || (eraId && regionId ? `${eraId}.${regionId}` : DEFAULT_THEME_ID);
  const base = getTheme(candidateId);
  const mode = MODE_OVERLAYS[driveMode] ? driveMode : 'race';
  const overlay = MODE_OVERLAYS[mode];
  const displayOverride = resolvePowertrainOverride(powertrain, capabilities);
  const tokens = {
    ...base.tokens,
    modeAccent: overlay.accent,
    modeAccentStrong: overlay.accentStrong,
  };
  if (displayOverride) {
    tokens.displayAccent = '#48C7D9';
    tokens.displayCool = '#8FD9DC';
  }
  return Object.freeze({
    themeId: base.id,
    requestedThemeId: candidateId,
    fallback: candidateId !== base.id,
    base,
    mode: overlay,
    powertrain: displayOverride,
    tokens: Object.freeze(tokens),
    semanticColors: SEMANTIC_COLORS,
  });
}

/**
 * Translate the exact resolveVehicleTheme() result from src/vehicle into this
 * registry's canonical IDs. Unresolved or internally inconsistent metadata
 * is returned as unresolved; it never silently selects the default anchor.
 */
export function mapVehicleThemeMetadata(vehicleTheme, capabilities = {}) {
  const requestedBaseThemeId = vehicleTheme?.baseThemeId;
  const yearBandId = vehicleTheme?.yearBandId;
  const vehicleRegionId = vehicleTheme?.region;
  const eraId = VEHICLE_YEAR_BAND_TO_ERA[yearBandId];
  const regionId = VEHICLE_REGION_TO_THEME_REGION[vehicleRegionId];
  const powertrain = VEHICLE_POWERTRAIN_TO_DISPLAY[vehicleTheme?.powertrain];
  const candidateThemeId = typeof requestedBaseThemeId === 'string'
    ? VEHICLE_THEME_ID_MAP[requestedBaseThemeId]
    : null;
  const hasCanonicalFields = ['themeId', 'eraId', 'regionId'].some(key => vehicleTheme?.[key] != null);
  const canonicalFieldsMatch = !hasCanonicalFields || (
    vehicleTheme.themeId === candidateThemeId
    && vehicleTheme.eraId === eraId
    && vehicleTheme.regionId === regionId
  );
  const powertrainOverrideMatches = !Object.hasOwn(vehicleTheme || {}, 'powertrainOverride')
    || vehicleTheme.powertrainOverride === (vehicleTheme.powertrain === 'electric' ? 'electric' : null);
  const idParts = typeof requestedBaseThemeId === 'string' ? requestedBaseThemeId.split('.') : [];
  const identifiersMatch = candidateThemeId
    && idParts.length === 2
    && idParts[0] === yearBandId
    && idParts[1] === vehicleRegionId
    && getTheme(candidateThemeId).eraId === eraId
    && getTheme(candidateThemeId).regionId === regionId
    && canonicalFieldsMatch
    && powertrainOverrideMatches;
  const resolved = vehicleTheme?.resolved === true
    && identifiersMatch
    && powertrain !== undefined;

  if (!resolved) {
    const reason = vehicleTheme?.resolved !== true
      ? 'vehicle-metadata-unresolved'
      : !identifiersMatch
        ? 'vehicle-theme-identifiers-mismatch'
        : 'vehicle-powertrain-unknown';
    return Object.freeze({
      resolved: false,
      reason,
      themeId: candidateThemeId ?? DEFAULT_THEME_ID,
      fallback: candidateThemeId === null,
      fallbackThemeId: DEFAULT_THEME_ID,
      requestedBaseThemeId: requestedBaseThemeId ?? null,
      yearBandId: yearBandId ?? null,
      region: vehicleRegionId ?? null,
      powertrain: powertrain ?? null,
    });
  }

  const driveMode = vehicleTheme.modeOverlay === 'race' || vehicleTheme.modeOverlay === 'freeRoam'
    ? vehicleTheme.modeOverlay
    : 'race';
  return Object.freeze({
    resolved: true,
    sourceThemeId: requestedBaseThemeId,
    themeId: candidateThemeId,
    eraId,
    regionId,
    powertrain,
    driveMode,
    theme: resolveTheme({ themeId: candidateThemeId, driveMode, powertrain, capabilities }),
  });
}

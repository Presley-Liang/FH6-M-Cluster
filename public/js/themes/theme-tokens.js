// Shared visual vocabulary for the 11 x 3 theme matrix.
// Semantic telemetry colors are intentionally outside this theme palette.
export const REGION_PROFILES = Object.freeze({
  europe: Object.freeze({
    label: 'European', accent: '#C0392B', accentStrong: '#E74C3C', cool: '#A9C4D4',
    silhouette: 'precision', contrast: 'restrained', informationDensity: 'balanced',
    typography: 'condensed', materials: 'brushed-metal', tickWeight: 'fine',
  }),
  america: Object.freeze({
    label: 'American', accent: '#B9432F', accentStrong: '#F06A3D', cool: '#D7D5CA',
    silhouette: 'bold', contrast: 'high', informationDensity: 'focused',
    typography: 'wide', materials: 'painted-metal', tickWeight: 'heavy',
  }),
  japan: Object.freeze({
    label: 'Japanese', accent: '#D34146', accentStrong: '#FF5964', cool: '#8FD9DC',
    silhouette: 'technical', contrast: 'high', informationDensity: 'dense',
    typography: 'compact', materials: 'technical-polymer', tickWeight: 'fine-dense',
  }),
});

// Each era describes the era-specific instrument language. Regional profiles
// supply the distinct visual character; the shared telemetry components remain
// the responsibility of the single existing binding layer.
export const ERA_PROFILES = Object.freeze({
  pre1949: Object.freeze({
    label: 'Pre-1949 Classic Mechanical', range: '1949 and earlier',
    surface: '#0B0A08', panel: '#171410', ink: '#F1E8D4', muted: '#A99C81', metal: '#9A8766',
    grid: '#5D513D', glow: '#E2B96A', dial: 'ivory-mechanical', bezel: 'aged-brass',
    typography: 'serif-instrument', motion: 'mechanical-sweep', density: 'sparse',
  }),
  y1950_1959: Object.freeze({
    label: '1950–1959 Retro Classic', range: '1950–1959',
    surface: '#11100D', panel: '#201D17', ink: '#F4EBD6', muted: '#B6A98B', metal: '#B9A77D',
    grid: '#665C49', glow: '#F2D28E', dial: 'cream-roundel', bezel: 'polished-chrome',
    typography: 'rounded-classic', motion: 'slow-mechanical', density: 'sparse',
  }),
  y1960_1975: Object.freeze({
    label: '1960–1975 Classic Mechanical', range: '1960–1975',
    surface: '#0D0E0F', panel: '#191B1C', ink: '#ECECE5', muted: '#A7AAA6', metal: '#A7ADB1',
    grid: '#4C5154', glow: '#F2B94F', dial: 'black-face-mechanical', bezel: 'bright-chrome',
    typography: 'motorsport-grotesk', motion: 'paired-needle', density: 'balanced',
  }),
  y1976_1985: Object.freeze({
    label: '1976–1985 Late Mechanical', range: '1976–1985',
    surface: '#090C0E', panel: '#11171A', ink: '#E8F0ED', muted: '#91A5A7', metal: '#778B90',
    grid: '#314449', glow: '#E5A243', dial: 'angular-mechanical', bezel: 'dark-anodized',
    typography: 'square-analog', motion: 'stepped-needle', density: 'balanced',
  }),
  y1986_1994: Object.freeze({
    label: '1986–1994 Retro Digital', range: '1986–1994',
    surface: '#050B0A', panel: '#0A1512', ink: '#B9F5C7', muted: '#71AE83', metal: '#436653',
    grid: '#1D4832', glow: '#5BFF8B', dial: 'phosphor-digital', bezel: 'black-polymer',
    typography: 'segmented-digital', motion: 'pixel-scan', density: 'dense',
  }),
  y1995_2002: Object.freeze({
    label: '1995–2002 Nineties Sport', range: '1995–2002',
    surface: '#080A0D', panel: '#11151A', ink: '#F1F4F5', muted: '#9CA8B2', metal: '#687784',
    grid: '#35414B', glow: '#E85A32', dial: 'sport-round-gauge', bezel: 'satin-alloy',
    typography: 'bold-italic', motion: 'fast-needle', density: 'dense',
  }),
  y2003_2008: Object.freeze({
    label: '2003–2008 Millennium', range: '2003–2008',
    surface: '#080B0E', panel: '#11171D', ink: '#EAF1F5', muted: '#91A2AE', metal: '#647782',
    grid: '#2A414C', glow: '#55B9DB', dial: 'lcd-hybrid', bezel: 'graphite',
    typography: 'lcd-sans', motion: 'lcd-wipe', density: 'balanced',
  }),
  y2009_2014: Object.freeze({
    label: '2009–2014 Hybrid Instrument', range: '2009–2014',
    surface: '#090C10', panel: '#121820', ink: '#EDF3F7', muted: '#9AAEBB', metal: '#718494',
    grid: '#334957', glow: '#56C6D7', dial: 'hybrid-ring-display', bezel: 'dark-metal',
    typography: 'humanist-digital', motion: 'ring-and-needle', density: 'balanced',
  }),
  y2015_2019: Object.freeze({
    label: '2015–2019 Modern Performance', range: '2015–2019',
    surface: '#070B0F', panel: '#0B131A', ink: '#F1F8FC', muted: '#91A6B4', metal: '#8298A6',
    grid: '#263C49', glow: '#D84B42', dial: 'digital-arc-needle', bezel: 'precision-metal',
    typography: 'oxanium-display', motion: 'sweeping-arc', density: 'balanced',
  }),
  y2020_2024: Object.freeze({
    label: '2020–2024 Digital Cockpit', range: '2020–2024',
    surface: '#060A10', panel: '#0A1420', ink: '#F2F8FF', muted: '#9BB1C7', metal: '#63819B',
    grid: '#203A51', glow: '#4AB5FF', dial: 'full-digital-cockpit', bezel: 'glass-composite',
    typography: 'variable-sans', motion: 'layer-reveal', density: 'flexible',
  }),
  y2025plus: Object.freeze({
    label: '2025+ Next-Generation Cockpit', range: '2025 and later',
    surface: '#050811', panel: '#0A1020', ink: '#F4F7FF', muted: '#A1ADD0', metal: '#737FAD',
    grid: '#26335D', glow: '#8C7BFF', dial: 'adaptive-spatial-display', bezel: 'light-field',
    typography: 'adaptive-display', motion: 'spatial-scan', density: 'adaptive',
  }),
});

export const SEMANTIC_COLORS = Object.freeze({
  success: '#27AE60', caution: '#F39C12', danger: '#E74C3C', recording: '#E74C3C',
  brake: '#E74C3C', throttle: '#27AE60', unavailable: '#718897',
});

export const THEME_TOKEN_KEYS = Object.freeze([
  'surface', 'panel', 'ink', 'muted', 'metal', 'grid', 'glow',
  'accent', 'accentStrong', 'cool',
]);

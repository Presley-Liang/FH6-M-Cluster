import { DEFAULT_THEME_ID, mapVehicleThemeMetadata, resolveTheme } from './theme-registry.js';

const TOKEN_TO_CSS = Object.freeze({
  surface: '--theme-surface', panel: '--theme-panel', ink: '--theme-ink',
  muted: '--theme-muted', metal: '--theme-metal', grid: '--theme-grid',
  glow: '--theme-glow', accent: '--theme-accent', accentStrong: '--theme-accent-strong',
  modeAccent: '--theme-mode-accent', modeAccentStrong: '--theme-mode-accent-strong',
  cool: '--theme-cool', displayAccent: '--theme-display-accent', displayCool: '--theme-display-cool',
});

function applyResolvedTheme(root, resolved) {
  if (!root?.style?.setProperty || !root?.dataset) {
    throw new TypeError('Theme adapter requires an element with style and dataset');
  }
  for (const [token, cssName] of Object.entries(TOKEN_TO_CSS)) {
    const value = resolved.tokens[token];
    if (typeof value === 'string') root.style.setProperty(cssName, value);
    else root.style.removeProperty(cssName);
  }
  root.dataset.themeId = resolved.themeId;
  root.dataset.themeEra = resolved.base.eraId;
  root.dataset.themeRegion = resolved.base.regionId;
  root.dataset.driveMode = resolved.mode.id;
  root.dataset.powertrain = resolved.powertrain?.kind ?? 'combustion';
  root.dataset.displayOverride = resolved.powertrain ? 'ev' : 'none';
  root.dataset.displayPowerAvailable = String(Boolean(resolved.powertrain?.signals.power.available));
  root.dataset.displayRegenAvailable = String(Boolean(resolved.powertrain?.signals.regen.available));
  root.dataset.displaySocAvailable = String(Boolean(resolved.powertrain?.signals.soc.available));
  root.dataset.displayEnergyAvailable = String(Boolean(resolved.powertrain?.signals.energy.available));
  return resolved;
}

/**
 * DOM adapter with no telemetry reads, subscriptions, or markup creation.
 * A page integration can pass the existing #cluster node and canonical theme
 * context without coupling theme configuration to telemetry modules.
 */
export function applyTheme(root, context = {}) {
  return applyResolvedTheme(root, resolveTheme(context));
}

/** Apply the exact output of src/vehicle/resolveVehicleTheme(). A rejected
 * metadata result leaves the element untouched so integration mismatches are
 * visible to the caller instead of being hidden by the default theme. */
export function applyVehicleTheme(root, vehicleTheme, capabilities = {}) {
  const mapped = mapVehicleThemeMetadata(vehicleTheme, capabilities);
  if (!mapped.resolved) return mapped;
  const applied = applyResolvedTheme(root, mapped.theme);
  return Object.freeze({ ...mapped, applied });
}

export function createThemeAdapter(root, initialContext = {}) {
  let current = null;
  const apply = (context = {}) => {
    current = applyTheme(root, context);
    return current;
  };
  return Object.freeze({
    apply,
    reset() {
      current = apply({ themeId: DEFAULT_THEME_ID, driveMode: 'race' });
      return current;
    },
    state() { return current; },
    init() { return apply(initialContext); },
  });
}

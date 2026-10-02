/**
 * Owns the mounted visual instrument for an exact era.region theme ID.
 * Telemetry is selected once by cluster-bindings; inactive instruments receive
 * no render updates and keep no independent Store or Session subscriptions.
 * This factory is embedded into the standalone page with toString().
 */
export function createInstrumentThemeHost({ document, mount, root, factories = {} }) {
  if (!document?.createElement || !mount?.append) throw new TypeError('Instrument host requires a document and mount');
  const instances = new Map();
  let activeId = null;
  let active = null;

  function activate(themeId) {
    if (themeId === activeId) return active;
    if (active?.element) {
      active.element.hidden = true;
      active.element.style.display = 'none';
      active.element.dataset.active = 'false';
      active.element.setAttribute('aria-hidden', 'true');
    }
    activeId = themeId || null;
    const factory = factories[activeId];
    if (!factory) {
      active = null;
      if (root) root.dataset.instrumentVariant = 'legacy';
      return null;
    }
    let instrument = instances.get(activeId);
    if (!instrument) {
      instrument = factory({ document, mount });
      if (!instrument?.element || typeof instrument.update !== 'function') throw new TypeError('Invalid instrument factory for ' + activeId);
      instrument.element.dataset.themeInstrument = activeId;
      instances.set(activeId, instrument);
    }
    active = instrument;
    active.element.hidden = false;
    active.element.style.removeProperty('display');
    active.element.dataset.active = 'true';
    active.element.setAttribute('aria-hidden', 'false');
    if (root) root.dataset.instrumentVariant = 'custom';
    return active;
  }

  function update(model, context) {
    active?.update(model, context);
  }

  function destroy() {
    for (const instrument of instances.values()) instrument.destroy?.();
    instances.clear();
    active = null;
    activeId = null;
    if (root) root.dataset.instrumentVariant = 'legacy';
  }

  return { activate, update, destroy, activeId: () => activeId };
}

/**
 * Mount the compact 11-era × 3-region theme picker inside a Manual debug
 * entry. The caller controls when it is mounted; use it only while Manual is
 * active so automatic vehicle selection remains the normal dashboard path.
 *
 * @param {object} config
 * @param {Element} config.container Manual debug-entry mount point.
 * @param {Array<object>} config.options Theme registry options (id/eraId/regionId).
 * @param {string} config.selectedId Currently selected theme id.
 * @param {(themeId: string) => void} config.onChange Selection callback.
 * @returns {{ element: HTMLElement, open: Function, close: Function, update: Function, destroy: Function }}
 */
export function mountManualThemeButtonSet({ container, options, selectedId, onChange, document: doc } = {}) {
  const REGIONS = [
    { id: 'europe', label: '欧' },
    { id: 'america', label: '美' },
    { id: 'japan', label: '日' },
  ];
  const themeIdOf = option => option?.id ?? option?.themeId ?? null;
  const regionIdOf = option => option?.regionId ?? option?.region?.id ?? null;
  const eraIdOf = option => option?.eraId ?? option?.era?.id ?? null;
  const eraLabelOf = option => option?.era?.range ?? option?.era?.label ?? option?.eraLabel ?? eraIdOf(option) ?? '未知年代';
  const normalizeOptions = input => {
    if (!Array.isArray(input)) throw new TypeError('Theme button set options must be an array');
    const entries = input.filter(option => themeIdOf(option) && eraIdOf(option) && regionIdOf(option));
    const byEra = new Map();
    entries.forEach(option => {
      const eraId = eraIdOf(option);
      let era = byEra.get(eraId);
      if (!era) {
        era = { id: eraId, label: eraLabelOf(option), regions: new Map() };
        byEra.set(eraId, era);
      }
      era.regions.set(regionIdOf(option), option);
    });
    return Array.from(byEra.values());
  };
  if (!container?.appendChild) throw new TypeError('Theme button set requires a container element');
  if (typeof onChange !== 'function') throw new TypeError('Theme button set requires an onChange callback');
  doc = doc ?? container.ownerDocument ?? globalThis.document;
  if (!doc?.createElement) throw new TypeError('Theme button set requires a document');

  let eras = normalizeOptions(options);
  let currentId = selectedId ?? null;
  let destroyed = false;
  const nodeById = new Map();
  const shell = doc.createElement('section');
  const panelId = `manual-theme-set-panel-${Math.random().toString(36).slice(2, 10)}`;
  shell.className = 'manual-theme-set';
  shell.innerHTML = `
    <button type="button" class="manual-theme-set__trigger" aria-expanded="false" aria-haspopup="dialog" aria-controls="${panelId}">
      <span>UI</span><i aria-hidden="true"></i>
    </button>
    <div id="${panelId}" class="manual-theme-set__panel" role="dialog" aria-label="UI主题" hidden>
      <header class="manual-theme-set__heading">
        <span><small>THEME SELECT</small><strong>UI主题</strong></span>
        <button type="button" class="manual-theme-set__close" aria-label="关闭UI主题选择">×</button>
      </header>
      <div class="manual-theme-set__table-wrap">
        <table class="manual-theme-set__table" aria-label="按年代和地区选择UI主题">
          <thead><tr><th scope="col">年代</th>${REGIONS.map(region => `<th scope="col">${region.label}</th>`).join('')}</tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <footer class="manual-theme-set__footer"><span class="manual-theme-set__selected-mark"></span>已选主题</footer>
    </div>`;

  const trigger = shell.querySelector('.manual-theme-set__trigger');
  const panel = shell.querySelector('.manual-theme-set__panel');
  const closeButton = shell.querySelector('.manual-theme-set__close');
  const body = shell.querySelector('tbody');
  const selectedMark = shell.querySelector('.manual-theme-set__selected-mark');

  function renderRows() {
    nodeById.clear();
    body.replaceChildren();
    eras.forEach(era => {
      const row = doc.createElement('tr');
      const heading = doc.createElement('th');
      heading.scope = 'row';
      heading.textContent = era.label;
      row.append(heading);

      REGIONS.forEach(region => {
        const cell = doc.createElement('td');
        const option = era.regions.get(region.id);
        if (option) {
          const id = themeIdOf(option);
          const button = doc.createElement('button');
          button.type = 'button';
          button.className = 'manual-theme-set__choice';
          button.dataset.themeId = id;
          button.textContent = region.label;
          button.setAttribute('aria-label', `${era.label} · ${region.label}洲`);
          button.setAttribute('aria-pressed', String(id === currentId));
          button.addEventListener('click', () => {
            if (destroyed) return;
            currentId = id;
            syncSelection();
            try { onChange(id); }
            finally { close({ returnFocus: true }); }
          });
          nodeById.set(id, button);
          cell.append(button);
        } else {
          const unavailable = doc.createElement('span');
          unavailable.className = 'manual-theme-set__unavailable';
          unavailable.setAttribute('aria-hidden', 'true');
          unavailable.textContent = '—';
          cell.append(unavailable);
        }
        row.append(cell);
      });
      body.append(row);
    });
  }

  function syncSelection() {
    nodeById.forEach((button, id) => button.setAttribute('aria-pressed', String(id === currentId)));
    const selected = eras.flatMap(era => Array.from(era.regions.values())).find(option => themeIdOf(option) === currentId);
    selectedMark.textContent = selected ? `${eraLabelOf(selected)} · ${REGIONS.find(region => region.id === regionIdOf(selected))?.label ?? ''}` : '未选择';
  }

  function open() {
    if (destroyed) return;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const selected = nodeById.get(currentId);
    (selected ?? panel.querySelector('.manual-theme-set__choice'))?.focus();
  }

  function close({ returnFocus = false } = {}) {
    if (destroyed || panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  function onDocumentPointerDown(event) {
    if (!shell.contains(event.target)) close();
  }

  function onDocumentKeydown(event) {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      close({ returnFocus: true });
    }
  }

  function onTriggerClick() {
    if (panel.hidden) open();
    else close({ returnFocus: true });
  }

  trigger.addEventListener('click', onTriggerClick);
  closeButton.addEventListener('click', () => close({ returnFocus: true }));
  doc.addEventListener('pointerdown', onDocumentPointerDown);
  doc.addEventListener('keydown', onDocumentKeydown);
  renderRows();
  syncSelection();
  container.append(shell);

  return Object.freeze({
    element: shell,
    open,
    close,
    update(next = {}) {
      if (destroyed) return;
      if (Object.hasOwn(next, 'options')) eras = normalizeOptions(next.options);
      if (Object.hasOwn(next, 'selectedId')) currentId = next.selectedId ?? null;
      if (Object.hasOwn(next, 'options')) renderRows();
      syncSelection();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      trigger.removeEventListener('click', onTriggerClick);
      doc.removeEventListener('pointerdown', onDocumentPointerDown);
      doc.removeEventListener('keydown', onDocumentKeydown);
      shell.remove();
      nodeById.clear();
    },
  });
}

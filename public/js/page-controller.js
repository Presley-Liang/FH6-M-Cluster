// Self-contained so the server can embed this factory without a browser bundle.
export function createPageController(root, options = {}) {
  const order = ['DRIVE', 'MAP', 'DYN', 'RPY'];
  const panes = Array.from(root.querySelectorAll('[data-cluster-page]'));
  const buttons = Array.from(root.querySelectorAll('[data-page-target]'));
  const available = order.filter(name => panes.some(pane => pane.getAttribute('data-cluster-page') === name));
  const keyboardTarget = root.ownerDocument || root;
  let current = null;
  let destroyed = false;

  function apply(name) {
    root.setAttribute('data-page', name);
    for (const pane of panes) {
      const active = pane.getAttribute('data-cluster-page') === name;
      pane.classList.toggle('active', active);
      pane.setAttribute('aria-hidden', String(!active));
      pane.inert = !active;
      if (active) pane.removeAttribute('inert');
      else pane.setAttribute('inert', '');
    }
    for (const button of buttons) {
      const active = button.getAttribute('data-page-target') === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('tabindex', active ? '0' : '-1');
    }
  }

  function select(name) {
    if (destroyed || !available.includes(name)) return false;
    if (name === current) return true;
    const previous = current;
    current = name;
    apply(name);
    if (typeof options.onChange === 'function') options.onChange(name, previous);
    return true;
  }

  const clickHandlers = buttons.map(button => {
    const handler = () => select(button.getAttribute('data-page-target'));
    button.addEventListener('click', handler);
    return handler;
  });
  function onKeydown(event) {
    if (destroyed || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || available.length < 2) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target;
    if (target && (target.isContentEditable || (typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-map-interaction]')))) return;
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = available[(available.indexOf(current) + offset + available.length) % available.length];
    event.preventDefault();
    select(next);
    // Keep keyboard tab navigation aligned when a page tab itself had focus.
    if (buttons.includes(target)) {
      const button = buttons.find(item => item.getAttribute('data-page-target') === next);
      if (button && typeof button.focus === 'function') button.focus();
    }
  }
  keyboardTarget.addEventListener('keydown', onKeydown);
  const preferred = options.initialPage || root.getAttribute('data-page');
  current = available.includes(preferred) ? preferred : available[0] || null;
  if (current) apply(current);
  return {
    select,
    getCurrent() { return current; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      keyboardTarget.removeEventListener('keydown', onKeydown);
      buttons.forEach((button, index) => button.removeEventListener('click', clickHandlers[index]));
    }
  };
}

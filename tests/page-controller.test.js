import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createPageController } from '../public/js/page-controller.js';

function element(attributes = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    attributes: { ...attributes }, classes,
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatch(name, event = {}) { for (const listener of listeners.get(name) || []) listener(event); },
    closest() { return null; },
    focus() { this.focused = true; }
  };
}
function fixture() {
  const names = ['DRIVE', 'MAP', 'DYN', 'RPY'];
  const panes = names.map(name => element({ 'data-cluster-page': name }));
  const buttons = names.map(name => element({ 'data-page-target': name }));
  const document = element();
  const root = element();
  root.ownerDocument = document;
  root.querySelectorAll = selector => selector === '[data-cluster-page]' ? panes : buttons;
  return { root, panes, buttons, document };
}
function key(target, key = 'ArrowRight', extras = {}) {
  return { target, key, prevented: false, preventDefault() { this.prevented = true; }, ...extras };
}

test('page controller keeps stable panes and updates accessibility on every selection', () => {
  const { root, panes, buttons } = fixture();
  const changes = [];
  const controller = createPageController(root, { onChange: (...args) => changes.push(args) });
  assert.equal(controller.getCurrent(), 'DRIVE');
  for (const [index, name] of ['DRIVE', 'MAP', 'DYN', 'RPY'].entries()) {
    assert.equal(controller.select(name), true);
    assert.equal(root.getAttribute('data-page'), name);
    panes.forEach((pane, i) => {
      assert.equal(pane.inert, i !== index);
      assert.equal(pane.getAttribute('aria-hidden'), String(i !== index));
      assert.equal(pane.classes.has('active'), i === index);
      assert.equal(buttons[i].getAttribute('tabindex'), i === index ? '0' : '-1');
      assert.equal(buttons[i].getAttribute('aria-selected'), String(i === index));
    });
  }
  assert.deepEqual(changes, [['MAP', 'DRIVE'], ['DYN', 'MAP'], ['RPY', 'DYN']]);
  assert.equal(controller.select('BOGUS'), false);
  assert.equal(controller.getCurrent(), 'RPY');
  buttons[0].dispatch('click');
  assert.equal(controller.getCurrent(), 'DRIVE');
});

test('keyboard wraps, preserves editable/map input and cleans up listeners', () => {
  const { root, document, buttons } = fixture();
  const controller = createPageController(root);
  const left = key(buttons[0], 'ArrowLeft');
  document.dispatch('keydown', left);
  assert.equal(controller.getCurrent(), 'RPY');
  assert.equal(left.prevented, true);
  assert.equal(buttons[3].focused, true);
  for (const target of [{ isContentEditable: true }, { closest: () => ({}) }]) {
    const event = key(target);
    document.dispatch('keydown', event);
    assert.equal(event.prevented, false);
    assert.equal(controller.getCurrent(), 'RPY');
  }
  document.dispatch('keydown', key(buttons[3]));
  assert.equal(controller.getCurrent(), 'DRIVE');
  controller.destroy();
  controller.destroy();
  document.dispatch('keydown', key(buttons[0]));
  buttons[2].dispatch('click');
  assert.equal(controller.select('DYN'), false);
  assert.equal(controller.getCurrent(), 'DRIVE');
});

test('factory embeds without module dependencies and honors the starting page', () => {
  const factory = vm.runInNewContext('(' + createPageController.toString() + ')');
  const { root } = fixture();
  const controller = factory(root, { initialPage: 'DYN' });
  assert.equal(controller.getCurrent(), 'DYN');
  controller.destroy();
});

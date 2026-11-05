import test from 'node:test';
import assert from 'node:assert/strict';
import { createMouseShakeDetector, shouldShakeFromSpace } from './gummyGestures.js';

test('a deliberate fast horizontal or vertical mouse shake is recognized once', () => {
  for (const axis of ['x', 'y']) {
    const detector = createMouseShakeDetector();
    const results = [0, 90, 0, 90, 0].map((position, index) =>
      detector.sample(axis === 'x' ? position : 0, axis === 'y' ? position : 0, index * 50));
    assert.deepEqual(results, [false, false, false, false, true]);
    assert.equal(detector.sample(0, 0, 300), false);
  }
});

test('ordinary pointer navigation, slow reversals and tiny jitter do not shake', () => {
  const detector = createMouseShakeDetector();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index * 90, 0, index * 30), false);
  detector.reset();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index % 2 ? 80 : 0, 0, index * 300), false);
  detector.reset();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index % 2 ? 5 : 0, 0, index * 5), false);
});

test('a pause or leaving the window discards a partial mouse shake', () => {
  const detector = createMouseShakeDetector();
  [0, 90, 0].forEach((x, index) => detector.sample(x, 0, index * 40));
  assert.equal(detector.sample(90, 0, 600), false);
  assert.equal(detector.sample(0, 0, 640), false);
  detector.reset();
  assert.equal(detector.sample(90, 0, 680), false);
});

test('Space only handles unmodified background presses and preserves interactive controls', () => {
  const event = { code: 'Space', target: { closest: () => null } };
  assert.equal(shouldShakeFromSpace(event), true);
  assert.equal(shouldShakeFromSpace({ key: ' ' }), true);
  for (const flag of ['repeat', 'defaultPrevented', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(shouldShakeFromSpace({ ...event, [flag]: true }), false, flag);
  }
  assert.equal(shouldShakeFromSpace({ code: 'Enter' }), false);
  assert.equal(shouldShakeFromSpace({ ...event, target: { isContentEditable: true } }), false);
  assert.equal(shouldShakeFromSpace({ ...event, target: { closest: () => ({}) } }), false);
});

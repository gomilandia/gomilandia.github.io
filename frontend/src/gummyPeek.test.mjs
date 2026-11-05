import test from 'node:test';
import assert from 'node:assert/strict';
import { getPeekState } from './gummyPeek.js';

test('the corner bear waits before appearing and leaves between visits', () => {
  assert.equal(getPeekState(0).visible, false);
  assert.equal(getPeekState(8).visible, false);
  assert.equal(getPeekState(11).visible, true);
  assert.equal(getPeekState(18).visible, false);
});

test('the bear alternates bottom corners without jumping between them while visible', () => {
  assert.equal(getPeekState(11).side, 'right');
  assert.equal(getPeekState(12).side, 'right');
  assert.equal(getPeekState(35).side, 'left');
  assert.equal(getPeekState(59).side, 'right');
});

test('the entrance and exit are gradual and respect reduced motion', () => {
  assert.ok(getPeekState(8.7).amount > 0 && getPeekState(8.7).amount < 1);
  assert.equal(getPeekState(11).amount, 1);
  assert.ok(getPeekState(14.9).amount > 0 && getPeekState(14.9).amount < 1);
  assert.equal(getPeekState(11, true).visible, false);
  assert.equal(getPeekState(Number.NaN).visible, false);
});

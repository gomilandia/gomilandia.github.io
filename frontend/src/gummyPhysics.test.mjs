import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAR_COUNT,
  COLOR_NAMES,
  createWorld,
  createBears,
  createScore,
  hitBear,
  stepSimulation,
  resizeWorld,
} from './gummyPhysics.js';

function setup() {
  const world = createWorld(1100, 500);
  return { world, bears: createBears(world), score: createScore() };
}

test('creates 25 unique bears and exactly five of each requested color', () => {
  const { world, bears } = setup();
  assert.equal(bears.length, BEAR_COUNT);
  assert.equal(new Set(bears.map((bear) => bear.id)).size, 25);
  assert.deepEqual(COLOR_NAMES.map((_, color) => bears.filter((bear) => bear.colorIndex === color).length), [5, 5, 5, 5, 5]);
  for (const bear of bears) {
    assert.ok(Math.abs(bear.x) + world.bearSize * 0.7 <= world.width / 2);
    assert.ok(Math.abs(bear.y) + world.bearSize * 0.5 <= world.height / 2);
  }
});

test('falls and rotates over elapsed time without scroll input', () => {
  const { world, bears, score } = setup();
  const before = { ...bears[0] };
  for (let i = 0; i < 30; i++) stepSimulation(bears, world, 1 / 60, score);
  assert.ok(bears[0].y < before.y);
  assert.notEqual(bears[0].rotationY, before.rotationY);
  assert.equal(score.visible, false);
});

test('clicking starts a visible streak and sends that bear upward', () => {
  const { world, bears, score } = setup();
  const target = bears[10];
  const previousY = target.y;
  assert.equal(hitBear(bears, target.id, score, world), true);
  assert.equal(score.score, 1);
  assert.equal(score.activeId, target.id);
  assert.equal(score.visible, true);
  assert.equal(target.bounceAmount, 1);
  stepSimulation(bears, world, 1 / 60, score);
  assert.ok(target.y > previousY);
  assert.ok(target.vy > 0);
});

test('only clicks on the same airborne bear continue the streak', () => {
  const { world, bears, score } = setup();
  hitBear(bears, 10, score, world);
  hitBear(bears, 10, score, world);
  hitBear(bears, 10, score, world);
  assert.equal(score.score, 3);
  assert.equal(score.best, 3);
  hitBear(bears, 11, score, world);
  assert.equal(score.score, 1);
  assert.equal(score.activeId, 11);
  assert.equal(score.lastScore, 3);
  assert.equal(score.best, 3);
});

test('a fallen active bear ends the streak, preserves the record, and respawns with the same identity', () => {
  const { world, bears, score } = setup();
  const target = bears[10];
  hitBear(bears, target.id, score, world);
  hitBear(bears, target.id, score, world);
  target.y = -world.height;
  target.vy = -1;
  assert.equal(stepSimulation(bears, world, 1 / 60, score), true);
  assert.deepEqual(score, { visible: true, activeId: null, score: 0, best: 2, lastScore: 2, ended: true });
  assert.equal(target.id, 10);
  assert.ok(target.y > world.height / 2);
  assert.equal(bears.length, 25);
  hitBear(bears, target.id, score, world);
  assert.equal(score.score, 1);
  assert.equal(score.ended, false);
});

test('an unrelated falling bear cannot end the active streak', () => {
  const { world, bears, score } = setup();
  hitBear(bears, 10, score, world);
  bears[11].y = -world.height;
  assert.equal(stepSimulation(bears, world, 1 / 60, score), false);
  assert.equal(score.activeId, 10);
  assert.equal(score.score, 1);
});

test('upward clicks remain within the top edge instead of losing the active bear', () => {
  const { world, bears, score } = setup();
  hitBear(bears, 0, score, world);
  for (let i = 0; i < 120; i++) {
    stepSimulation(bears, world, 1 / 60, score);
    assert.ok(bears[0].y <= world.height / 2 - world.bearSize * 0.7);
  }
  assert.equal(score.activeId, 0);
});

test('resizing from desktop to phone preserves the selected bear, score and horizontal bounds', () => {
  const { world, bears, score } = setup();
  hitBear(bears, 10, score, world);
  hitBear(bears, 10, score, world);
  const expectedScore = { ...score };
  const ids = bears.map((bear) => bear.id);
  const mobile = createWorld(320, 580);
  resizeWorld(bears, world, mobile);
  assert.deepEqual(bears.map((bear) => bear.id), ids);
  assert.deepEqual(score, expectedScore);
  for (const bear of bears) {
    assert.ok(Math.abs(bear.x) + mobile.bearSize * 0.7 <= mobile.width / 2 + 1e-10);
  }
});

test('large and invalid frame durations cannot teleport bears or corrupt state', () => {
  const first = setup();
  const second = setup();
  stepSimulation(first.bears, first.world, 300, first.score);
  stepSimulation(second.bears, second.world, 0.05, second.score);
  assert.deepEqual(first.bears, second.bears);
  const before = structuredClone(first.bears);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(stepSimulation(first.bears, first.world, invalid, first.score), false);
  }
  assert.deepEqual(first.bears, before);
});

test('reduced motion leaves positions and rotations stationary but permits scoring', () => {
  const { world, bears, score } = setup();
  const target = bears[10];
  hitBear(bears, target.id, score, world);
  const before = { ...target };
  for (let i = 0; i < 60; i++) stepSimulation(bears, world, 1 / 60, score, { reducedMotion: true });
  assert.equal(target.y, before.y);
  assert.equal(target.x, before.x);
  assert.equal(target.rotationX, before.rotationX);
  assert.equal(target.rotationY, before.rotationY);
  assert.ok(target.bounceAmount < before.bounceAmount);
  hitBear(bears, target.id, score, world);
  assert.equal(score.score, 2);
});

test('unknown bear IDs do not change the score or simulation', () => {
  const { world, bears, score } = setup();
  const before = structuredClone(score);
  assert.equal(hitBear(bears, 100, score, world), false);
  assert.deepEqual(score, before);
});

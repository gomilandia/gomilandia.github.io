import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAR_COUNT,
  MOBILE_BEAR_COUNT,
  COLOR_NAMES,
  createWorld,
  createBears,
  stepSimulation,
  resizeWorld,
  shakeBears,
} from './gummyPhysics.js';

function seeded(seed = 123456) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function setup(width = 1100, height = 650) {
  const world = createWorld(width, height);
  const random = seeded();
  return { world, random, bears: createBears(world, random) };
}

function advance(bears, world, seconds, options = {}) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
    stepSimulation(bears, world, 1 / 60, options);
  }
}

function activate(bear, values = {}) {
  Object.assign(bear, {
    active: true, spawnDelay: 0, clearing: false, x: 0, y: 0, vx: 0, vy: 0,
    ...values,
  });
  return bear;
}

test('uses 25 desktop bears, 6 mobile bears and a configurable breakpoint/count', () => {
  const desktop = setup();
  const mobile = setup(640, 850);
  assert.equal(desktop.world.mobile, false);
  assert.equal(desktop.bears.length, BEAR_COUNT);
  assert.equal(mobile.world.mobile, true);
  assert.equal(mobile.bears.length, MOBILE_BEAR_COUNT);
  assert.equal(MOBILE_BEAR_COUNT, 6);
  assert.equal(createWorld(641, 850).bearCount, 25);
  assert.equal(createWorld(700, 850, { mobileBreakpoint: 720, mobileCount: 8 }).bearCount, 8);
  assert.equal(new Set(desktop.bears.map((bear) => bear.id)).size, BEAR_COUNT);
  assert.deepEqual(COLOR_NAMES.map((_, color) => desktop.bears.filter((bear) => bear.colorIndex === color).length), [5, 5, 5, 5, 5]);
});

test('starts above the viewport with randomized positions, rotations and delayed arrivals', () => {
  const { world, bears } = setup();
  assert.ok(bears.every((bear) => bear.y > world.height / 2));
  assert.equal(bears.filter((bear) => bear.active).length, 1);
  assert.ok(new Set(bears.map((bear) => bear.spawnDelay)).size > 20);
  assert.ok(new Set(bears.map((bear) => bear.x)).size > 20);
  assert.notEqual(bears[0].rotationY, bears[1].rotationY);
  assert.notDeepEqual(bears, createBears(world, seeded(987)));
  const before = { ...bears[0] };
  advance(bears, world, 0.3);
  assert.ok(bears[0].y < before.y);
  assert.notEqual(bears[0].rotationY, before.rotationY);
});

test('all bears accumulate inside the floor and settle without recycling or overlapping', () => {
  for (const dimensions of [[1100, 650], [375, 800]]) {
    const { world, bears, random } = setup(...dimensions);
    advance(bears, world, 28, { random });
    const floor = -world.height / 2 + world.bearSize / 2;
    assert.ok(bears.every((bear) => bear.active && !bear.clearing));
    for (const bear of bears) {
      assert.ok(bear.y >= floor - 1e-8);
      assert.ok(bear.y < -world.height / 2 + world.bearSize * 5);
      assert.ok(Math.abs(bear.x) <= world.width / 2 - world.bearSize / 2 + 1e-8);
      assert.ok(Math.abs(bear.vy) < 0.1, `bear ${bear.id} should rest; vy=${bear.vy}`);
    }
    for (let first = 0; first < bears.length; first++) {
      for (let second = first + 1; second < bears.length; second++) {
        const distance = Math.hypot(bears[first].x - bears[second].x, bears[first].y - bears[second].y);
        assert.ok(distance >= world.bearSize * 0.92 - 0.015, `overlap: ${distance}`);
      }
    }
    const resting = bears.map((bear) => ({ x: bear.x, y: bear.y }));
    advance(bears, world, 2, { random });
    bears.forEach((bear, index) => {
      assert.ok(Math.hypot(bear.x - resting[index].x, bear.y - resting[index].y) < 0.03);
    });
  }
});

test('pair contacts separate bodies and transfer momentum', () => {
  const { world, bears } = setup();
  const first = activate(bears[0], { x: -0.35, vx: 2 });
  const second = activate(bears[1], { x: 0.35, vx: -1 });
  const pair = [first, second];
  stepSimulation(pair, world, 1 / 120);
  assert.ok(second.x - first.x >= world.bearSize * 0.92 - 1e-5);
  assert.ok(second.vx > -1);
  assert.ok(first.vx < 2);
  assert.ok(Math.abs(first.vx + second.vx - 1) < 0.01);
});

test('a moving circular pointer pushes a bear away without click input', () => {
  const { world, bears } = setup();
  const bear = activate(bears[0], { x: 0.3, y: 1 });
  const pointer = { x: 0, y: 1, vx: 5, vy: 0, radius: world.bearSize * 0.7 };
  stepSimulation([bear], world, 1 / 120, { pointer });
  assert.ok(Math.hypot(bear.x - pointer.x, bear.y - pointer.y) >= pointer.radius + world.bearSize * 0.46 - 1e-5);
  assert.ok(bear.vx > 4);
  assert.ok(bear.bounceAmount > 0);
});

test('shake launches settled bears outward, then schedules fresh falls after a random delay', () => {
  const { world, bears, random } = setup();
  advance(bears, world, 24, { random });
  const colors = bears.map((bear) => bear.colorIndex);
  shakeBears(bears, world, random);
  assert.ok(bears.every((bear) => bear.clearing && bear.active));
  assert.ok(bears.every((bear) => bear.vy >= 5 && Math.abs(bear.vx) >= 8));
  let waiting = false;
  for (let frame = 0; frame < 240; frame++) {
    stepSimulation(bears, world, 1 / 60, { random });
    for (const bear of bears) {
      if (bear.active || bear.clearing) continue;
      waiting = true;
      assert.ok(bear.y > world.height / 2);
      assert.ok(bear.spawnDelay > 0 && bear.spawnDelay <= 6);
    }
  }
  assert.ok(waiting);
  advance(bears, world, 20, { random });
  assert.ok(bears.every((bear) => bear.active && !bear.clearing && bear.y < 0));
  assert.deepEqual(bears.map((bear) => bear.colorIndex), colors);
});

test('resize adjusts population and bounds while preserving existing bear identities', () => {
  const { world, bears, random } = setup();
  advance(bears, world, 24, { random });
  const retained = bears.slice(0, MOBILE_BEAR_COUNT);
  const mobile = createWorld(360, 780);
  resizeWorld(bears, world, mobile, random);
  assert.equal(bears.length, MOBILE_BEAR_COUNT);
  assert.ok(bears.every((bear, index) => bear === retained[index]));
  assert.ok(bears.every((bear) => Math.abs(bear.x) <= mobile.width / 2 - mobile.bearSize / 2 + 1e-8));
  assert.ok(bears.every((bear) => bear.y >= -mobile.height / 2 + mobile.bearSize / 2));
  resizeWorld(bears, mobile, world, random);
  assert.equal(bears.length, 25);
  assert.equal(new Set(bears.map((bear) => bear.id)).size, 25);
  assert.ok(bears.slice(MOBILE_BEAR_COUNT).every((bear) => !bear.active && bear.y > world.height / 2));
});

test('seeded piles settle after pointer contact without late drift (seeds 6, 11 and 13)', () => {
  for (const seed of [6, 11, 13]) {
    const random = seeded(seed * 7919);
    const world = createWorld(1440, 900);
    const bears = createBears(world, random);
    advance(bears, world, 30, { random });
    const pointer = { x: 0, y: -world.height / 2 + world.bearSize * 0.25,
      vx: 0, vy: 0, radius: world.bearSize * 1.2 };
    for (let frame = 0; frame < 60; frame++) {
      const angle = frame / 59 * Math.PI * 2;
      pointer.x = Math.sin(angle) * world.bearSize * 2;
      pointer.vx = Math.cos(angle) * world.bearSize * 2 * Math.PI * 2;
      stepSimulation(bears, world, 1 / 60, { random, pointer });
    }
    advance(bears, world, 15, { random });
    assert.ok(bears.every((bear) => bear.sleeping), `seed ${seed} should settle`);
    const resting = bears.map((bear) => [bear.x, bear.y, bear.rotationZ]);
    advance(bears, world, 20, { random });
    assert.deepEqual(bears.map((bear) => [bear.x, bear.y, bear.rotationZ]), resting);
  }
});

test('rest wakes for pointer, impact, missing support, shake and resize', () => {
  const { world, bears, random } = setup();
  const bear = activate(bears[0], { y: -world.height / 2 + world.bearSize / 2 });
  advance([bear], world, 2);
  assert.equal(bear.sleeping, true);
  const pointer = { x: bear.x - world.bearSize * 0.5, y: bear.y,
    vx: 6, vy: 0, radius: world.bearSize * 0.5 };
  stepSimulation([bear], world, 1 / 60, { pointer });
  assert.equal(bear.sleeping, false);
  assert.ok(bear.vx > 0);
  advance([bear], world, 3);
  assert.equal(bear.sleeping, true);
  const falling = activate(bears[1], { x: bear.x, y: bear.y + world.bearSize * 0.94, vy: -3 });
  stepSimulation([bear, falling], world, 1 / 60);
  assert.equal(bear.sleeping, false);
  advance([bear], world, 2);
  bear.y = 1;
  stepSimulation([bear], world, 1 / 60);
  assert.equal(bear.sleeping, false);
  const height = bear.y;
  advance([bear], world, 0.3);
  assert.ok(bear.y < height);
  advance([bear], world, 4);
  assert.equal(bear.sleeping, true);
  resizeWorld([bear], world, { ...world, bearCount: 1 }, random);
  assert.equal(bear.sleeping, false);
  advance([bear], world, 2);
  shakeBears([bear], world, random);
  assert.equal(bear.sleeping, false);
  assert.equal(bear.clearing, true);
  assert.ok(bear.vy > 0);
});

test('airborne bears remain awake through a slow apex and fall normally', () => {
  const { world, bears } = setup();
  const bear = activate(bears[0], { y: 2, vy: 0 });
  advance([bear], world, 0.5);
  assert.equal(bear.sleeping, false);
  assert.ok(bear.y < 1.2);
  assert.ok(bear.vy < -3);
});

test('invalid deltas and reduced motion leave every field unchanged; long frames are capped', () => {
  const first = setup();
  const second = setup();
  const before = structuredClone(first.bears);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(stepSimulation(first.bears, first.world, invalid), false);
  }
  assert.equal(stepSimulation(first.bears, first.world, 1, { reducedMotion: true }), false);
  assert.deepEqual(first.bears, before);
  stepSimulation(first.bears, first.world, 300);
  stepSimulation(second.bears, second.world, 0.05);
  assert.deepEqual(first.bears, second.bears);
  assert.ok(first.bears.every((bear) => Object.values(bear).every((value) => typeof value !== 'number' || Number.isFinite(value))));
});

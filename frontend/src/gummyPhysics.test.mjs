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
  const world = createWorld(width, height, {
    maxBears: width <= 640 ? MOBILE_BEAR_COUNT : BEAR_COUNT,
  });
  // Contact tests isolate a fixed batch; emission is covered separately below.
  world.maxBears = world.bearCount;
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

function finishClearing(bears, world, random, maxSeconds = 3) {
  for (let frame = 0; world.clearing && frame < Math.ceil(maxSeconds * 60); frame++) {
    stepSimulation(bears, world, 1 / 60, { random });
  }
  assert.equal(world.clearing, false, 'expulsion must finish after bodies physically leave');
  assert.equal(world.wallsEnabled, true);
}

test('uses 15 desktop bears, 6 mobile bears and a configurable breakpoint/count', () => {
  const desktop = setup();
  const mobile = setup(640, 850);
  assert.equal(desktop.world.mobile, false);
  assert.equal(desktop.bears.length, BEAR_COUNT);
  assert.equal(mobile.world.mobile, true);
  assert.equal(mobile.bears.length, MOBILE_BEAR_COUNT);
  assert.equal(MOBILE_BEAR_COUNT, 6);
  assert.equal(BEAR_COUNT, 15);
  assert.equal(createWorld(641, 850).bearCount, 15);
  assert.equal(createWorld(700, 850, { mobileBreakpoint: 720, mobileCount: 8 }).bearCount, 8);
  assert.equal(new Set(desktop.bears.map((bear) => bear.id)).size, BEAR_COUNT);
  assert.deepEqual(COLOR_NAMES.map((_, color) => desktop.bears.filter((bear) => bear.colorIndex === color).length), [3, 3, 3, 3, 3]);
});

test('desktop density and emission are reduced while portrait mobile bears are smaller', () => {
  const desktop = createWorld(1440, 900);
  const oldCapacity = Math.ceil(desktop.width * desktop.height / (1.12 ** 2 * 0.78));
  assert.equal(desktop.bearSize, 1.12);
  assert.equal(desktop.fillCapacity, Math.ceil(oldCapacity * 0.65));
  assert.equal(desktop.spawnInterval, 0.4);
  const portrait = createWorld(390, 844);
  const landscape = createWorld(844, 390, { mobileBreakpoint: Infinity });
  assert.equal(portrait.bearSize, 0.65);
  assert.equal(landscape.bearSize, 0.95);
  assert.equal(portrait.spawnInterval, 0.85);
  assert.equal(landscape.bearCount, 6);
  assert.ok(createWorld(100, 1000).bearSize <= createWorld(100, 1000).width / 4.4);
});

test('starts above the viewport with randomized positions, rotations and delayed arrivals', () => {
  const { world, bears } = setup();
  assert.ok(bears.every((bear) => bear.y > world.height / 2));
  assert.equal(bears.filter((bear) => bear.active).length, 1);
  assert.ok(new Set(bears.map((bear) => bear.spawnDelay)).size > BEAR_COUNT * 0.8);
  assert.ok(new Set(bears.map((bear) => bear.x)).size > BEAR_COUNT * 0.8);
  assert.notEqual(bears[0].rotationY, bears[1].rotationY);
  assert.notDeepEqual(bears, createBears(world, seeded(987)));
  const before = { ...bears[0] };
  advance(bears, world, 0.3);
  assert.ok(bears[0].y < before.y);
  assert.notEqual(bears[0].rotationY, before.rotationY);
});

test('rain keeps emitting after the initial batch, with a slower mobile rate', () => {
  const desktop = createWorld(1440, 900);
  const mobile = createWorld(390, 844);
  assert.ok(mobile.spawnInterval > desktop.spawnInterval);
  for (const world of [desktop, mobile]) {
    const random = seeded();
    const bears = createBears(world, random);
    const initial = bears.slice();
    advance(bears, world, 10, { random });
    assert.ok(bears.length > world.bearCount);
    assert.ok(initial.every((bear, index) => bears[index] === bear));
    assert.equal(new Set(bears.map((bear) => bear.id)).size, bears.length);
    assert.ok(bears.slice(world.bearCount).every((bear) => bear.active));
    assert.ok(bears.every((bear) => bear.colorIndex === bear.id % COLOR_NAMES.length));
  }
});

test('continuous rain reaches its lower desktop density or mobile fill capacity', () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const world = createWorld(width, height);
    const random = seeded();
    const bears = createBears(world, random);
    assert.ok(world.maxBears > world.bearCount && world.maxBears <= 600);
    const duration = (world.maxBears - world.bearCount) * world.spawnInterval + 25;
    for (let frame = 0; frame < Math.ceil(duration / 0.05); frame++) {
      stepSimulation(bears, world, 0.05, { random });
      assert.ok(bears.length <= world.maxBears);
    }
    assert.equal(bears.length, world.maxBears);
    assert.ok(bears.every((bear) => bear.active && bear.sleeping));
    const pileTop = Math.max(...bears.map((bear) => bear.y));
    assert.ok(pileTop >= (world.mobile ? world.height / 2 - world.bearSize : -world.height * 0.1));
    assert.ok(bears.every((bear) => bear.y >= -world.height / 2 + world.bearSize / 2));
    assert.ok(bears.every((bear) => Object.values(bear).every((value) => typeof value !== 'number' || Number.isFinite(value))));
    const retained = bears.slice();
    advance(bears, world, 2, { random });
    assert.equal(bears.length, world.maxBears);
    assert.ok(bears.every((bear, index) => bear === retained[index]));
    if (width === 1440) {
      const mobile = createWorld(390, 844);
      const nativeCapacity = mobile.maxBears;
      resizeWorld(bears, world, mobile, random);
      assert.equal(bears.length, retained.length);
      assert.equal(mobile.maxBears, Math.max(nativeCapacity, retained.length));
      assert.equal(mobile.fillCapacity, nativeCapacity);
      shakeBears(bears, mobile, random);
      finishClearing(bears, mobile, random);
      assert.equal(bears.length, MOBILE_BEAR_COUNT);
      assert.equal(mobile.maxBears, nativeCapacity);
    }
    shakeBears(bears, world, random);
    finishClearing(bears, world, random);
    assert.equal(bears.length, world.bearCount);
    assert.equal(world.emissionElapsed, 0);
    assert.ok(bears.every((bear) => bear.y > world.height / 2 && !bear.sleeping));
    advance(bears, world, 5, { random });
    assert.ok(bears.length > world.bearCount);
    assert.ok(bears.some((bear) => bear.active && bear.y < world.height / 2));
  }
});

test('resize keeps the accumulated population and expands emission capacity when needed', () => {
  const random = seeded();
  const desktop = createWorld(1440, 900, { maxBears: 120, spawnInterval: 0.1 });
  const bears = createBears(desktop, random);
  advance(bears, desktop, 12, { random });
  const retained = bears.slice();
  assert.equal(retained.length, 120);
  const mobile = createWorld(390, 844, { maxBears: 80 });
  assert.ok(mobile.maxBears < retained.length);
  resizeWorld(bears, desktop, mobile, random);
  assert.equal(bears.length, retained.length);
  assert.equal(mobile.maxBears, retained.length);
  assert.ok(bears.every((bear, index) => bear === retained[index]));
  assert.ok(bears.every((bear) => Math.abs(bear.x) <= mobile.width / 2 - mobile.bearSize / 2 + 1e-8));
  const large = createWorld(1920, 1080);
  resizeWorld(bears, mobile, large, random);
  assert.ok(large.maxBears > bears.length);
  advance(bears, large, 2, { random });
  assert.ok(bears.length > retained.length);
  assert.ok(retained.every((bear, index) => bears[index] === bear));
  resizeWorld(bears, large, mobile, random);
  assert.ok(mobile.maxBears > mobile.fillCapacity);
  shakeBears(bears, mobile, random);
  finishClearing(bears, mobile, random);
  assert.equal(bears.length, MOBILE_BEAR_COUNT);
  assert.equal(mobile.maxBears, mobile.fillCapacity);
});

test('reduced motion freezes the emission clock and restarts without a backlog', () => {
  const world = createWorld(390, 844);
  const random = seeded();
  const bears = createBears(world, random);
  advance(bears, world, 0.3, { random });
  const before = structuredClone({ bears, world });
  advance(bears, world, 20, { reducedMotion: true, random });
  assert.deepEqual({ bears, world }, before);
  advance(bears, world, 0.1, { random });
  assert.equal(bears.length, world.bearCount);
  advance(bears, world, 1, { random });
  assert.equal(bears.length, world.bearCount + 1);
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

test('shake clears accumulated bears and restarts the initial falling batch', () => {
  const { world, bears, random } = setup();
  advance(bears, world, 24, { random });
  const previous = bears.slice();
  world.emissionElapsed = 0.2;
  shakeBears(bears, world, random);
  assert.ok(bears.every((bear, index) => bear === previous[index] && bear.active && bear.clearing));
  assert.equal(world.wallsEnabled, false);
  finishClearing(bears, world, random);
  assert.equal(bears.length, world.bearCount);
  assert.equal(world.emissionElapsed, 0);
  assert.ok(bears.every((bear, index) => bear !== previous[index] && bear.y > world.height / 2));
  assert.equal(bears.filter((bear) => bear.active).length, 1);
  advance(bears, world, 5, { random });
  assert.ok(bears.some((bear) => bear.active && bear.y < world.height / 2));
});

test('resize adjusts population and bounds while preserving existing bear identities', () => {
  const { world, bears, random } = setup();
  advance(bears, world, 24, { random });
  const retained = bears.slice();
  const mobile = createWorld(360, 780);
  resizeWorld(bears, world, mobile, random);
  assert.equal(bears.length, retained.length);
  assert.ok(bears.every((bear, index) => bear === retained[index]));
  assert.ok(bears.every((bear) => Math.abs(bear.x) <= mobile.width / 2 - mobile.bearSize / 2 + 1e-8));
  assert.ok(bears.every((bear) => bear.y >= -mobile.height / 2 + mobile.bearSize / 2));
  resizeWorld(bears, mobile, world, random);
  assert.equal(bears.length, BEAR_COUNT);
  assert.equal(new Set(bears.map((bear) => bear.id)).size, BEAR_COUNT);
  assert.ok(bears.every((bear, index) => bear === retained[index]));
});

test('seeded piles settle after pointer contact without late drift (seeds 6, 11 and 13)', () => {
  for (const seed of [6, 11, 13]) {
    const random = seeded(seed * 7919);
    const world = createWorld(1440, 900, { maxBears: BEAR_COUNT });
    world.maxBears = world.bearCount;
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
  Object.assign(world, { bearCount: 1, fillCapacity: 1, maxBears: 1 });
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
  const reset = [bear];
  shakeBears(reset, world, random);
  assert.equal(reset.length, world.bearCount);
  assert.equal(reset[0], bear);
  assert.ok(reset.every((next) => !next.sleeping && next.clearing));
  finishClearing(reset, world, random);
});

test('expulsion preserves visible bodies until the whole model crosses a side, then restarts', () => {
  const world = createWorld(1440, 900);
  const random = seeded();
  const bears = createBears(world, random);
  bears.forEach((bear, index) => activate(bear, {
    x: (index % 3 - 1) * world.width * 0.2,
    y: index % 2 ? world.height / 2 - world.bearSize : -world.height / 2 + world.bearSize,
  }));
  const previous = bears.slice();
  assert.equal(shakeBears(bears, world, random), true);
  assert.ok(previous.every((bear, index) => bears[index] === bear && bear.active));
  assert.ok(previous.every((bear) => bear.vx * bear.exitDirection > 0));
  const beforeRepeat = structuredClone({ bears, world });
  assert.equal(shakeBears(bears, world, random), false);
  assert.deepEqual({ bears, world }, beforeRepeat);
  let partialCrossing = false;
  let allOutAt = null;
  for (let frame = 1; frame <= 180 && world.clearing; frame++) {
    stepSimulation(bears, world, 1 / 60, {
      random, pointer: { x: 0, y: 0, vx: -100, vy: 100, radius: 100 },
    });
    const now = frame / 60;
    for (const bear of previous) {
      if (!bear.active) assert.ok(Math.abs(bear.x) > world.width / 2 + world.bearSize);
      else if (Math.abs(bear.x) > world.width / 2) partialCrossing = true;
    }
    if (previous.every((bear) => !bear.active) && allOutAt === null) allOutAt = now;
    if (world.clearing) {
      assert.equal(world.wallsEnabled, false);
      assert.equal(world.emissionElapsed, 0);
      assert.equal(bears.length, previous.length);
      assert.ok(bears.every((bear, index) => bear === previous[index]));
    } else {
      assert.ok(allOutAt !== null && now - allOutAt >= 0.25);
    }
  }
  assert.ok(partialCrossing, 'bodies remain visible while crossing the edge');
  assert.equal(world.clearing, false);
  assert.equal(world.wallsEnabled, true);
  assert.equal(world.clearElapsed, 0);
  assert.equal(world.clearWaitElapsed, 0);
  assert.equal(bears.length, world.bearCount);
  assert.ok(bears.every((bear, index) => bear !== previous[index] && !bear.clearing));
  advance(bears, world, 1, { random });
  assert.ok(bears.length > world.bearCount);
});

test('expulsion has no floor or top recycling and preserves velocities through resize', () => {
  const world = createWorld(390, 844);
  const random = seeded();
  const bears = createBears(world, random);
  bears.forEach((bear, index) => activate(bear, { x: 0, y: index ? 7 : -6 }));
  shakeBears(bears, world, random);
  bears[0].vy = -2;
  const before = bears.map((bear) => ({ x: bear.x, y: bear.y, vx: bear.vx, vy: bear.vy }));
  stepSimulation(bears, world, 0.05, { random });
  bears.forEach((bear, index) => {
    assert.equal(bear.active, true);
    assert.ok(Math.abs(bear.x - before[index].x - before[index].vx * 0.05) < 1e-8);
    assert.ok(Math.abs(bear.y - before[index].y - before[index].vy * 0.05) < 1e-8);
  });
  assert.ok(bears[0].y < -6);
  const velocities = bears.map((bear) => [bear.vx, bear.vy]);
  const population = bears.slice();
  const enlarged = createWorld(3840, 900);
  resizeWorld(bears, world, enlarged, random);
  assert.equal(enlarged.clearing, true);
  assert.equal(enlarged.wallsEnabled, false);
  assert.equal(enlarged.clearElapsed, world.clearElapsed);
  assert.deepEqual(bears.map((bear) => [bear.vx, bear.vy]), velocities);
  assert.equal(bears.length, population.length, 'resize must not add the desktop initial batch during expulsion');
  assert.ok(bears.every((bear, index) => bear === population[index]));
  finishClearing(bears, enlarged, random);
  assert.equal(bears.length, BEAR_COUNT);
  assert.ok(bears.every((bear) => Object.values(bear).every((value) => typeof value !== 'number' || Number.isFinite(value))));
});

test('createBears can immediately reset an expulsion for reduced-motion rendering', () => {
  const { world, bears, random } = setup();
  shakeBears(bears, world, random);
  advance(bears, world, 0.2, { random });
  const reset = createBears(world, random);
  assert.equal(world.clearing, false);
  assert.equal(world.wallsEnabled, true);
  assert.equal(world.clearElapsed, 0);
  assert.equal(world.clearWaitElapsed, 0);
  assert.equal(world.emissionElapsed, 0);
  assert.equal(reset.length, world.bearCount);
});

test('airborne bears remain awake through a slow apex and fall normally', () => {
  const { world, bears } = setup();
  world.maxBears = 1;
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

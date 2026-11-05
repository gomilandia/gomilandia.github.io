import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createBears, stepSimulation, resizeWorld } from './gummyPhysics.js';
import { createRainLifecycle } from './gummyLifecycle.js';

function seeded(seed = 123456) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function setup({ width = 1440, height = 900, worldHeight, intro = true } = {}) {
  const world = createWorld(width, height);
  if (worldHeight) world.height = worldHeight;
  const random = seeded();
  const bears = createBears(world, random);
  const lifecycle = createRainLifecycle(world, { intro, random });
  lifecycle.initialize(bears);
  return { world, bears, lifecycle, random };
}

function advance(state, seconds, callback = () => {}) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    state.lifecycle.step(state.bears, state.world, 1 / 60);
    stepSimulation(state.bears, state.world, 1 / 60, { random: state.random });
    callback(state);
  }
}

test('first visit starts a bounded full rain with all five colors and arrivals within three seconds', () => {
  for (const [width, height, count] of [[1440, 900, 25], [390, 844, 15]]) {
    const state = setup({ width, height });
    assert.equal(state.bears.length, count);
    assert.equal(new Set(state.bears.map((bear) => bear.id)).size, count);
    assert.deepEqual(new Set(state.bears.map((bear) => bear.colorIndex)), new Set([0, 1, 2, 3, 4]));
    assert.ok(state.bears.every((bear) => bear.y > state.world.height / 2));
    assert.ok(state.bears.every((bear) => bear.spawnDelay >= 0 && bear.spawnDelay <= 3));
    assert.equal(state.lifecycle.phase, 'intro');
    advance(state, 4);
    assert.ok(state.bears.every((bear) => bear.active));
    assert.equal(state.bears.length, count);
  }
});

test('the initial rain falls, bounces and remains fully visible while the pile forms', () => {
  const state = setup();
  const initial = new Map(state.bears.map((bear) => [bear.id, bear.y]));
  let bounced = false;
  advance(state, 5.5, ({ bears }) => {
    bounced ||= bears.some((bear) => bear.active && bear.vy > 0.05);
  });
  assert.equal(bounced, true);
  assert.ok(state.bears.every((bear) => bear.y < initial.get(bear.id)));
  assert.ok(state.bears.every((bear) => bear.opacity === 1));
  assert.ok(state.bears.some((bear) => bear.y < -state.world.height / 2 + state.world.bearSize * 2));
});

test('older bears fade over several seconds before being removed, preserving the decorative IDs', () => {
  const state = setup();
  const decorativeIds = state.bears.filter((bear) => bear.decorative).map((bear) => bear.id);
  advance(state, 7.5);
  const fading = state.bears.filter((bear) => !bear.decorative && bear.opacity > 0 && bear.opacity < 1);
  assert.ok(fading.length > 0);
  assert.equal(state.lifecycle.phase, 'fading');
  const tracked = fading[0];
  const previousOpacity = tracked.opacity;
  advance(state, 0.5);
  assert.ok(state.bears.includes(tracked));
  assert.ok(tracked.opacity < previousOpacity && tracked.opacity > 0);
  advance(state, 9);
  assert.deepEqual(state.bears.filter((bear) => bear.decorative).map((bear) => bear.id), decorativeIds);
  assert.ok(state.bears.filter((bear) => bear.decorative).every((bear) => bear.opacity === 1));
  assert.ok(state.bears.filter((bear) => !bear.decorative).every((bear) => bear.ambientRain));
  assert.equal(state.lifecycle.phase, 'ambient');
});

test('desktop and mobile keep their handful while a low-density rain continues after a minute', () => {
  for (const [width, height, count] of [[1440, 900, 6], [390, 844, 4]]) {
    const state = setup({ width, height });
    let maximum = state.bears.length;
    const seenAmbientIds = new Set();
    const seenAmbientColors = new Set();
    advance(state, 60, ({ bears, world }) => {
      maximum = Math.max(maximum, bears.length);
      assert.equal(world.maxBears, bears.length);
      assert.equal(world.emissionElapsed, 0);
      if (state.lifecycle.phase === 'ambient') {
        assert.ok(bears.filter((bear) => !bear.decorative).length <= (world.mobile ? 4 : 6));
        assert.equal(new Set(bears.map((bear) => bear.id)).size, bears.length);
      }
      bears.filter((bear) => bear.ambientRain).forEach((bear) => {
        seenAmbientIds.add(bear.id);
        seenAmbientColors.add(bear.colorIndex);
      });
    });
    assert.equal(maximum, width === 1440 ? 25 : 15);
    const decoration = state.bears.filter((bear) => bear.decorative);
    assert.equal(decoration.length, count);
    assert.ok(decoration.every((bear) => bear.opacity === 1));
    assert.ok(decoration.every((bear) => bear.y < -state.world.height / 2 + state.world.bearSize * 3));
    assert.ok(state.bears.some((bear) => bear.ambientRain));
    assert.ok(seenAmbientIds.size > 8);
    assert.deepEqual(seenAmbientColors, new Set([0, 1, 2, 3, 4]));
    assert.ok([...seenAmbientIds].some((id) => !state.bears.some((bear) => bear.id === id)), 'old ambient bears must retire');
    assert.equal(state.lifecycle.step(state.bears, state.world, 1 / 60).settled, false);
  }
});

test('returning visits skip the full intro but start a gentle ongoing rain above the resting decoration', () => {
  for (const [width, height, count] of [[1440, 900, 6], [390, 844, 4]]) {
    const state = setup({ width, height, intro: false });
    const decorativeIds = state.bears.map((bear) => bear.id);
    assert.equal(state.bears.length, count);
    assert.equal(state.lifecycle.phase, 'ambient');
    assert.ok(state.bears.every((bear) => bear.active && bear.sleeping && bear.opacity === 1));
    advance(state, 0.6);
    assert.equal(state.bears.length, count, 'return visits do not start with a full rain');
    advance(state, 2);
    assert.equal(state.bears.length, count + 1);
    assert.ok(state.bears.some((bear) => bear.ambientRain && bear.active));
    const firstAmbientId = state.bears.find((bear) => bear.ambientRain).id;
    advance(state, 20);
    assert.deepEqual(state.bears.filter((bear) => bear.decorative).map((bear) => bear.id), decorativeIds);
    assert.ok(!state.bears.some((bear) => bear.id === firstAmbientId));
    assert.ok(state.bears.length > count && state.bears.length <= count + (state.world.mobile ? 4 : 6));
    assert.equal(state.lifecycle.phase, 'ambient');
  }
});

test('resize preserves the finite population, identities and fade progress while fitting the new viewport', () => {
  const state = setup();
  advance(state, 7.5);
  const retained = state.bears.slice();
  const opacities = retained.map((bear) => bear.opacity);
  const phone = createWorld(320, 568);
  state.lifecycle.resize(phone);
  resizeWorld(state.bears, state.world, phone, state.random);
  state.world = phone;
  assert.equal(state.bears.length, retained.length);
  assert.ok(state.bears.every((bear, index) => bear === retained[index]));
  assert.deepEqual(state.bears.map((bear) => bear.opacity), opacities);
  assert.ok(state.bears.every((bear) => Math.abs(bear.x) <= phone.width / 2 - phone.bearSize / 2 + 1e-8));
  advance(state, 15);
  assert.equal(state.bears.filter((bear) => bear.decorative).length, 6, 'resizing a visit preserves its original decorative identities');
  assert.ok(state.bears.length <= 10, 'phone keeps the original decoration and at most four passing bears');
  assert.ok(state.bears.every((bear) => Number.isFinite(bear.x) && Number.isFinite(bear.y)));
  assert.equal(phone.maxBears, state.bears.length);
});

test('ambient rain holds briefly, fades smoothly, then retires within its lifetime', () => {
  const state = setup({ intro: false });
  advance(state, 1);
  const bear = state.bears.find((candidate) => candidate.ambientRain);
  assert.ok(bear);
  advance(state, 4.5);
  assert.equal(bear.opacity, 1);
  advance(state, 1);
  assert.ok(bear.opacity > 0 && bear.opacity < 1);
  const opacity = bear.opacity;
  advance(state, 0.5);
  assert.ok(state.bears.includes(bear) && bear.opacity < opacity);
  advance(state, 2);
  assert.ok(!state.bears.includes(bear));
  assert.equal(state.lifecycle.phase, 'ambient');
});

test('a tall document keeps falling bears opaque until they reach the actual footer pile', () => {
  const state = setup({ worldHeight: 60 });
  const tracked = state.bears.find((bear) => !bear.decorative);
  advance(state, 6);
  assert.ok(tracked.y > -state.world.height / 2 + state.world.bearSize * 5.5);
  assert.equal(tracked.rainLandedAt, null);
  assert.equal(tracked.opacity, 1);
  for (let frame = 0; frame < 15 * 60 && tracked.rainLandedAt === null; frame++) advance(state, 1 / 60);
  assert.ok(tracked.rainLandedAt > 6, 'the landing clock must follow the long document fall');
  assert.equal(tracked.opacity, 1);
  advance(state, 2.5);
  assert.equal(tracked.opacity, 1, 'the pile gets a visible resting period');
  advance(state, 2);
  assert.ok(tracked.opacity > 0 && tracked.opacity < 1);
  advance(state, 4);
  assert.ok(!state.bears.includes(tracked));
  const ambientIds = new Set();
  advance(state, 60, ({ bears }) => {
    assert.ok(bears.length <= 12);
    bears.filter((bear) => bear.ambientRain).forEach((bear) => ambientIds.add(bear.id));
  });
  assert.ok(ambientIds.size > 8);
  assert.equal(state.lifecycle.phase, 'ambient');
});

test('invalid deltas do not advance lifetimes and an overdue frame is capped like the physics clock', () => {
  const state = setup();
  const before = structuredClone(state.bears);
  for (const delta of [0, -1, Infinity, NaN]) state.lifecycle.step(state.bears, state.world, delta);
  assert.equal(state.lifecycle.elapsed, 0);
  assert.deepEqual(state.bears, before);
  state.lifecycle.step(state.bears, state.world, 10);
  assert.equal(state.lifecycle.elapsed, 0.05);
  assert.ok(state.bears.every((bear) => bear.opacity === 1));
});

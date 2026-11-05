import { createBears } from './gummyPhysics.js';

const INTRO_DESKTOP_COUNT = 25;
const INTRO_MOBILE_COUNT = 15;
const RESTING_DESKTOP_COUNT = 6;
const RESTING_MOBILE_COUNT = 4;
const MAX_STEP = 0.05;
const HOLD_SECONDS = 3.5;
const FADE_SECONDS = 3;
const AMBIENT_HOLD_SECONDS = 3;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// This controller keeps the existing collision solver, but gives the rain a
// finite lifetime. The renderer reads each bear's opacity without hiding a
// supporting body until its fade has completed.
export function createRainLifecycle(initialWorld, { intro = true, random = Math.random } = {}) {
  let world = initialWorld;
  let population = null;
  let elapsed = 0;
  let phase = intro ? 'intro' : 'ambient';
  let nextId = 0;
  let nextEmissionAt = 0;
  const decorationCount = world.mobile ? RESTING_MOBILE_COUNT : RESTING_DESKTOP_COUNT;

  function preventEmission() {
    const count = population?.length ?? 0;
    world.bearCount = count;
    world.fillCapacity = count;
    world.maxBears = count;
    world.emissionElapsed = 0;
  }

  function status(changed = false) {
    return {
      changed,
      phase,
      // Even between quiet arrivals, the ambient emitter's clock must keep
      // running. A sleeping decorative handful is not the end of the scene.
      settled: false,
    };
  }

  function tagBear(bear, index, bornAt = 0) {
    const variation = clamp(Number(random()) || 0, 0, 1);
    bear.opacity = 1;
    bear.decorative = index < decorationCount;
    bear.rainBornAt = bornAt;
    bear.rainHoldSeconds = HOLD_SECONDS + variation * 0.6;
    bear.rainFadeSeconds = FADE_SECONDS;
    bear.rainLandedAt = null;
    bear.ambientRain = false;
  }

  function initialize(bears) {
    population = bears;
    elapsed = 0;
    phase = intro ? 'intro' : 'ambient';
    const count = intro
      ? (world.mobile ? INTRO_MOBILE_COUNT : INTRO_DESKTOP_COUNT)
      : decorationCount;
    Object.assign(world, { bearCount: count, fillCapacity: count, maxBears: count });
    bears.splice(0, bears.length, ...createBears(world, random));
    nextId = count;
    nextEmissionAt = intro ? Infinity : (world.mobile ? 1.5 : 0.8);

    bears.forEach((bear, index) => {
      const delay = intro ? index / Math.max(1, count - 1) * 3 : 0;
      tagBear(bear, index, delay);
      bear.spawnDelay = delay;
      bear.active = delay === 0;

      // The handful that remains is spread across the bottom rather than
      // collecting into a single tall tower behind the content.
      if (bear.decorative) {
        const usableWidth = Math.max(0, world.width - world.bearSize * 1.5);
        bear.x = decorationCount === 1 ? 0
          : (index / (decorationCount - 1) - 0.5) * usableWidth;
        bear.vx *= 0.15;
      }

      if (!intro) {
        Object.assign(bear, {
          y: -world.height / 2 + world.bearSize / 2,
          rotationX: 0.05,
          rotationY: (index % 2 ? 1 : -1) * 0.16,
          rotationZ: (index % 2 ? 1 : -1) * 0.13,
          vx: 0,
          vy: 0,
          spinX: 0,
          spinY: 0,
          spinZ: 0,
          active: true,
          sleeping: true,
          sleepTime: 1,
          supported: true,
          disturbed: false,
        });
      }
    });
    preventEmission();
    return status(true);
  }

  function emitAmbientBear(bears) {
    // Isolate the old generator's setup mutations from the live world. Its
    // bodies still receive the same natural falling/rotation parameters.
    const sourceWorld = { ...world, bearCount: 1, fillCapacity: 1, maxBears: 1 };
    const [bear] = createBears(sourceWorld, random);
    bear.id = nextId++;
    bear.colorIndex = bear.id % 5;
    bear.opacity = 1;
    bear.decorative = false;
    bear.ambientRain = true;
    bear.rainBornAt = elapsed;
    bear.rainHoldSeconds = AMBIENT_HOLD_SECONDS;
    bear.rainFadeSeconds = FADE_SECONDS;
    bear.rainLandedAt = null;
    bears.push(bear);
  }

  function step(bears, nextWorld, deltaTime) {
    population = bears;
    world = nextWorld;
    preventEmission();
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return status();
    elapsed += Math.min(deltaTime, MAX_STEP);
    let changed = false;

    for (let index = bears.length - 1; index >= 0; index--) {
      const bear = bears[index];
      // A manual clear may replace physics objects. Keep the settled visit
      // finite instead of accidentally re-enabling the old endless emitter.
      if (!Number.isFinite(bear.opacity)) {
        tagBear(bear, index, phase === 'ambient' ? elapsed : 0);
        changed = true;
      }
      if (bear.decorative) continue;
      const age = elapsed - bear.rainBornAt;
      const floor = -world.height / 2 + world.bearSize / 2;
      const atThePile = bear.y <= floor + world.bearSize * 5.5;
      if (bear.rainLandedAt === null && atThePile && (bear.supported || bear.sleeping)) {
        bear.rainLandedAt = elapsed;
      }
      // A tall document may take many seconds to cross. The visible resting
      // period starts at the actual footer pile, never halfway down the page.
      // The generous fallback only retires an unusually stranded actor.
      const restingAge = bear.rainLandedAt === null ? 0 : elapsed - bear.rainLandedAt;
      const fallbackAge = Math.max(0, age - (world.height / 6 + 8));
      const fadeAge = Math.max(restingAge - bear.rainHoldSeconds, fallbackAge);
      const nextOpacity = clamp(1 - fadeAge / bear.rainFadeSeconds, 0, 1);
      if (nextOpacity !== bear.opacity) changed = true;
      bear.opacity = nextOpacity;
      if (nextOpacity === 0) bears.splice(index, 1);
    }

    if (phase !== 'ambient') {
      const nextPhase = bears.every((bear) => bear.decorative)
        ? 'ambient'
        : bears.some((bear) => bear.opacity < 1) ? 'fading' : 'intro';
      if (nextPhase !== phase) changed = true;
      phase = nextPhase;
      if (phase === 'ambient') nextEmissionAt = elapsed + (world.mobile ? 1.5 : 0.8);
    }
    if (phase === 'ambient' && elapsed >= nextEmissionAt) {
      const extraCount = bears.filter((bear) => !bear.decorative).length;
      const extraLimit = world.mobile ? 4 : 6;
      if (extraCount < extraLimit) {
        emitAmbientBear(bears);
        changed = true;
      }
      nextEmissionAt = elapsed + (world.mobile ? 3.8 : 2.6);
    }
    preventEmission();
    return status(changed);
  }

  // Call before the physics resize so that its population minimum does not
  // restore removed bears. Existing IDs, opacities and lifetimes stay intact.
  function resize(nextWorld) {
    world = nextWorld;
    preventEmission();
    return status();
  }

  return {
    initialize,
    step,
    resize,
    get elapsed() { return elapsed; },
    get phase() { return phase; },
    get decorationCount() { return decorationCount; },
  };
}

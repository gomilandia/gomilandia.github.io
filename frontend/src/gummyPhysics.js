export const BEAR_COUNT = 25;
export const MOBILE_BEAR_COUNT = 6;
export const COLOR_NAMES = ['rojo', 'verde', 'naranja', 'amarillo', 'rosa'];

const GRAVITY = 7;
const MAX_FRAME = 0.05;
const SUBSTEP = 1 / 120;
const SOLVER_ITERATIONS = 12;
const MAX_CAPACITY = 600;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sample = (random) => clamp(Number(random()) || 0, 0, 1);
const between = (random, min, max) => min + sample(random) * (max - min);
const radiusFor = (world) => world.bearSize * 0.46;
const floorFor = (world) => -world.height / 2 + world.bearSize / 2;
const limitFor = (world) => Math.max(0, world.width / 2 - world.bearSize / 2);

function wakeBear(bear) {
  bear.sleeping = false;
  bear.sleepTime = 0;
  bear.disturbed = true;
}

export function createWorld(pixelWidth, pixelHeight, {
  mobileBreakpoint = 640,
  desktopCount = BEAR_COUNT,
  mobileCount = MOBILE_BEAR_COUNT,
  maxBears,
  spawnInterval,
} = {}) {
  const safeWidth = Number.isFinite(pixelWidth) && pixelWidth > 0 ? pixelWidth : 1;
  const safeHeight = Number.isFinite(pixelHeight) && pixelHeight > 0 ? pixelHeight : 1;
  const height = 12;
  const width = height * safeWidth / safeHeight;
  const mobile = safeWidth <= mobileBreakpoint;
  const bearCount = Math.max(0, Math.floor(mobile ? mobileCount : desktopCount));
  const bearSize = Math.min(mobile ? 0.95 : 1.12, width / 4.4);
  const capacity = Math.max(bearCount, Math.min(MAX_CAPACITY,
    Math.ceil(width * height / (bearSize * bearSize * 0.78))));
  const fillCapacity = Math.max(bearCount, Math.min(MAX_CAPACITY, maxBears ?? capacity));
  return {
    width, height, bearSize, bearCount, mobile,
    fillCapacity,
    maxBears: fillCapacity,
    spawnInterval: spawnInterval ?? (mobile ? 0.85 : 0.28),
    emissionElapsed: 0,
  };
}

function scheduleBear(bear, world, random, delay) {
  const limit = limitFor(world);
  Object.assign(bear, {
    x: between(random, -limit, limit),
    y: world.height / 2 + world.bearSize * between(random, 0.6, 1.6),
    z: between(random, -0.15, 0.15),
    vx: between(random, -0.35, 0.35),
    vy: between(random, -1.2, -0.5),
    rotationX: between(random, -0.45, 0.45),
    rotationY: between(random, -Math.PI, Math.PI),
    rotationZ: between(random, -0.6, 0.6),
    spinX: between(random, -0.4, 0.4),
    spinY: between(random, -0.8, 0.8),
    spinZ: between(random, -0.65, 0.65),
    bounceAmount: 0,
    active: delay <= 0,
    clearing: false,
    spawnDelay: Math.max(0, delay),
    sleeping: false,
    sleepTime: 0,
    supported: false,
    disturbed: false,
  });
}

function makeBear(id, world, random, delay) {
  const bear = { id, colorIndex: id % COLOR_NAMES.length };
  scheduleBear(bear, world, random, delay);
  return bear;
}

export function createBears(world, random = Math.random) {
  world.emissionElapsed = 0;
  world.maxBears = world.fillCapacity ?? world.maxBears;
  return Array.from({ length: world.bearCount }, (_, id) =>
    makeBear(id, world, random, id === 0 ? 0 : between(random, 0.2, 7.5)));
}

function containBear(bear, world) {
  const floor = floorFor(world);
  const limit = limitFor(world);
  if (bear.x < -limit || bear.x > limit) {
    bear.x = clamp(bear.x, -limit, limit);
    if ((bear.x <= -limit && bear.vx < 0) || (bear.x >= limit && bear.vx > 0)) {
      bear.vx *= -0.22;
    }
  }
  if (bear.y <= floor) {
    bear.y = floor;
    if (bear.vy < 0) bear.vy = bear.vy < -0.8 ? -bear.vy * 0.18 : 0;
    bear.supported = true;
  }
}

function collidePair(first, second, world) {
  const diameter = radiusFor(world) * 2;
  let dx = second.x - first.x;
  let dy = second.y - first.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= diameter) return;
  if (first.sleeping && second.sleeping) return;
  if (distance < 1e-8) {
    // Coincident centers still need a normal when using a deterministic RNG.
    dx = first.id < second.id ? 1 : -1;
    dy = 0;
  } else {
    dx /= distance;
    dy /= distance;
  }
  const normalVelocity = (second.vx - first.vx) * dx + (second.vy - first.vy) * dy;
  if (normalVelocity < -0.35 || diameter - distance > world.bearSize * 0.025) {
    wakeBear(first);
    wakeBear(second);
  }
  const firstMass = first.sleeping ? 0 : 1;
  const secondMass = second.sleeping ? 0 : 1;
  const totalMass = firstMass + secondMass;
  const correction = (diameter - distance + 1e-6) / totalMass;
  first.x -= dx * correction * firstMass;
  first.y -= dy * correction * firstMass;
  second.x += dx * correction * secondMass;
  second.y += dy * correction * secondMass;

  if (normalVelocity < 0) {
    const restitution = normalVelocity < -1.2 ? 0.12 : 0;
    const impulse = -(1 + restitution) * normalVelocity / totalMass;
    first.vx -= impulse * dx * firstMass;
    first.vy -= impulse * dy * firstMass;
    second.vx += impulse * dx * secondMass;
    second.vy += impulse * dy * secondMass;
    const tangentVelocity = (second.vx - first.vx) * -dy + (second.vy - first.vy) * dx;
    const friction = clamp(tangentVelocity / totalMass, -impulse * 0.35, impulse * 0.35);
    first.vx += friction * -dy * firstMass;
    first.vy += friction * dx * firstMass;
    second.vx -= friction * -dy * secondMass;
    second.vy -= friction * dx * secondMass;
  }
  if (dy > 0.35) second.supported = true;
  if (dy < -0.35) first.supported = true;
}

function collidePointer(bear, pointer, world) {
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return;
  const pointerRadius = Number.isFinite(pointer.radius) && pointer.radius > 0
    ? pointer.radius : world.bearSize * 0.65;
  const distance = Math.hypot(bear.x - pointer.x, bear.y - pointer.y);
  const contactDistance = radiusFor(world) + pointerRadius;
  if (distance >= contactDistance) return;
  wakeBear(bear);
  const pointerVx = clamp(Number(pointer.vx) || 0, -18, 18);
  const pointerVy = clamp(Number(pointer.vy) || 0, -18, 18);
  const speed = Math.hypot(pointerVx, pointerVy);
  const nx = distance > 1e-8 ? (bear.x - pointer.x) / distance : (speed > 0 ? pointerVx / speed : 0);
  const ny = distance > 1e-8 ? (bear.y - pointer.y) / distance : (speed > 0 ? pointerVy / speed : 1);
  bear.x += nx * (contactDistance - distance + 1e-5);
  bear.y += ny * (contactDistance - distance + 1e-5);
  const relativeVelocity = (bear.vx - pointerVx) * nx + (bear.vy - pointerVy) * ny;
  if (relativeVelocity < 0) {
    bear.vx -= relativeVelocity * 1.12 * nx;
    bear.vy -= relativeVelocity * 1.12 * ny;
    bear.spinZ += clamp((pointerVx * ny - pointerVy * nx) * 0.12, -1.5, 1.5);
    bear.bounceAmount = Math.min(1, -relativeVelocity * 0.14);
  }
}

function makeGrid(bears, cellSize) {
  const cells = new Map();
  for (const bear of bears) {
    const key = `${Math.floor(bear.x / cellSize)},${Math.floor(bear.y / cellSize)}`;
    const cell = cells.get(key);
    if (cell) cell.push(bear);
    else cells.set(key, [bear]);
  }
  return { cells, cellSize };
}

function neighbors(grid, bear) {
  const x = Math.floor(bear.x / grid.cellSize);
  const y = Math.floor(bear.y / grid.cellSize);
  const nearby = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = grid.cells.get(`${x + dx},${y + dy}`);
      if (cell) nearby.push(...cell);
    }
  }
  return nearby;
}

function solveContacts(bears, world, pointer, iterations = SOLVER_ITERATIONS) {
  const solid = bears.filter((bear) => bear.active && !bear.clearing);
  if (!pointer && solid.every((bear) => bear.sleeping)) return;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const grid = makeGrid(solid, radiusFor(world) * 2);
    for (const first of solid) {
      if (first.sleeping) continue;
      for (const second of neighbors(grid, first)) {
        if (first === second || (!second.sleeping && first.id > second.id)) continue;
        collidePair(first, second, world);
      }
    }
    for (const bear of solid) {
      collidePointer(bear, pointer, world);
      containBear(bear, world);
    }
  }
}

function updateRest(bears, world, dt) {
  // A resting body must have a chain of contacts all the way to the floor.
  // Low speed alone must never freeze a bear at the apex of a bounce.
  const solid = bears.filter((bear) => bear.active && !bear.clearing)
    .sort((first, second) => first.y - second.y);
  const grounded = new Set();
  const tolerance = world.bearSize * 0.012;
  const diameter = radiusFor(world) * 2;
  const grid = makeGrid(solid, diameter + tolerance);
  for (const bear of solid) {
    const supports = neighbors(grid, bear).filter((lower) => grounded.has(lower)
      && bear.y - lower.y > diameter * 0.04
      && Math.hypot(bear.x - lower.x, bear.y - lower.y) <= diameter + tolerance);
    // Two shallow contacts on opposite sides also support a body in a gap.
    // A single nearly horizontal contact must still be allowed to slide down.
    const supported = bear.y <= floorFor(world) + tolerance
      || supports.some((lower) => bear.y - lower.y > diameter * 0.25)
      || (supports.some((lower) => lower.x < bear.x)
        && supports.some((lower) => lower.x > bear.x));
    if (supported) grounded.add(bear);
    if (!supported) {
      wakeBear(bear);
      continue;
    }
    if (bear.sleeping) continue;
    const quiet = !bear.disturbed && Math.hypot(bear.vx, bear.vy) < 0.18
      && Math.hypot(bear.x - bear.previousX, bear.y - bear.previousY) < world.bearSize * 0.003;
    bear.sleepTime = quiet ? bear.sleepTime + dt : 0;
    if (bear.sleepTime < 0.9) continue;
    bear.sleeping = true;
    bear.vx = 0;
    bear.vy = 0;
    bear.spinX = 0;
    bear.spinY = 0;
    bear.spinZ = 0;
    bear.bounceAmount = 0;
  }
}

export function stepSimulation(bears, world, deltaTime, {
  pointer = null,
  reducedMotion = false,
  random = Math.random,
} = {}) {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0 || reducedMotion) return false;
  const delta = Math.min(deltaTime, MAX_FRAME);
  const steps = Math.ceil(delta / SUBSTEP);
  const dt = delta / steps;
  if (bears.length < world.maxBears) {
    world.emissionElapsed += delta;
    const interval = Math.max(0.05, world.spawnInterval);
    while (world.emissionElapsed >= interval && bears.length < world.maxBears) {
      world.emissionElapsed -= interval;
      bears.push(makeBear(bears.length, world, random, 0));
    }
  } else {
    world.emissionElapsed = 0;
  }

  for (let step = 0; step < steps; step++) {
    for (const bear of bears) {
      bear.disturbed = false;
      bear.previousX = bear.x;
      bear.previousY = bear.y;
      if (!bear.active) {
        bear.spawnDelay -= dt;
        if (bear.spawnDelay > 0) continue;
        bear.spawnDelay = 0;
        bear.active = true;
      }
      bear.supported = false;
      if (bear.sleeping) continue;
      bear.vy = Math.max(-8, bear.vy - GRAVITY * dt);
      bear.vx *= Math.exp(-0.12 * dt);
      bear.x += bear.vx * dt;
      bear.y += bear.vy * dt;
      bear.rotationX += bear.spinX * dt;
      bear.rotationY += bear.spinY * dt;
      bear.rotationZ += bear.spinZ * dt;
      bear.bounceAmount *= Math.exp(-10 * dt);

      if (bear.clearing && (
        Math.abs(bear.x) > world.width / 2 + world.bearSize
        || bear.y > world.height / 2 + world.bearSize * 2
        || bear.y < -world.height / 2 - world.bearSize
      )) {
        scheduleBear(bear, world, random, between(random, 1.5, 6));
      }
    }

    solveContacts(bears, world, pointer);
    for (const bear of bears) {
      if (!bear.active || !bear.supported || bear.clearing) continue;
      const friction = Math.exp(-7 * dt);
      bear.vx *= friction;
      bear.spinX *= friction;
      bear.spinY *= friction;
      bear.spinZ *= friction;
      if (Math.abs(bear.vx) < 0.015) bear.vx = 0;
      if (Math.abs(bear.vy) < 0.015) bear.vy = 0;
    }
    updateRest(bears, world, dt);
  }
  return true;
}

export function shakeBears(bears, world, random = Math.random) {
  bears.splice(0, bears.length, ...createBears(world, random));
}

export function resizeWorld(bears, oldWorld, newWorld, random = Math.random) {
  newWorld.maxBears = Math.max(newWorld.maxBears, bears.length);
  newWorld.emissionElapsed = oldWorld.emissionElapsed ?? 0;
  const widthRatio = newWorld.width / oldWorld.width;
  const heightRatio = newWorld.height / oldWorld.height;
  for (const bear of bears) {
    wakeBear(bear);
    bear.x *= widthRatio;
    bear.y *= heightRatio;
    bear.vx *= widthRatio;
    bear.vy *= heightRatio;
    if (!bear.clearing) {
      bear.x = clamp(bear.x, -limitFor(newWorld), limitFor(newWorld));
      if (bear.active) containBear(bear, newWorld);
      else bear.y = newWorld.height / 2 + newWorld.bearSize;
    }
  }
  while (bears.length < newWorld.bearCount) {
    bears.push(makeBear(bears.length, newWorld, random, between(random, 0.3, 6)));
  }
  solveContacts(bears, newWorld, null, 40);
}

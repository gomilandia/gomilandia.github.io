export const BEAR_COUNT = 25;
export const COLOR_NAMES = ['rojo', 'verde', 'naranja', 'amarillo', 'rosa'];

const GRAVITY = 3.3;
const MAX_STEP = 0.05;
const BOUNCE_SPEED = 2.5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function seedFor(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createWorld(pixelWidth, pixelHeight) {
  const safeWidth = Number.isFinite(pixelWidth) && pixelWidth > 0 ? pixelWidth : 1;
  const safeHeight = Number.isFinite(pixelHeight) && pixelHeight > 0 ? pixelHeight : 1;
  const height = 12;
  const width = height * safeWidth / safeHeight;
  const columns = width / height < 0.85 ? 3 : 5;
  const rows = Math.ceil(BEAR_COUNT / columns);
  const bearSize = Math.min(1.15, width / columns * 0.72, height / rows * 0.72);
  return { width, height, bearSize, columns, rows };
}

export function createBears(world) {
  const cellWidth = world.width / world.columns;
  const cellHeight = world.height / world.rows;
  const horizontalLimit = Math.max(0, world.width / 2 - world.bearSize * 0.7);

  return Array.from({ length: BEAR_COUNT }, (_, id) => {
    const seed = seedFor(id);
    const row = Math.floor(id / world.columns);
    const column = id % world.columns;
    const rowCount = Math.min(world.columns, BEAR_COUNT - row * world.columns);
    const baseX = clamp(
      cellWidth * (column - (rowCount - 1) / 2) + (seed - 0.5) * cellWidth * 0.2,
      -horizontalLimit,
      horizontalLimit,
    );

    return {
      id,
      colorIndex: id % COLOR_NAMES.length,
      x: baseX,
      baseX,
      y: world.height / 2 - cellHeight * (row + 0.5),
      z: (seed - 0.5) * 0.8,
      vy: -0.65 - seed * 0.45,
      rotationX: (seed - 0.5) * 0.4,
      rotationY: (seed - 0.5) * 0.8,
      rotationZ: (seed - 0.5) * 0.75,
      spinX: (seed - 0.5) * 0.45,
      spinY: (seed > 0.5 ? 1 : -1) * (0.18 + seed * 0.18),
      spinZ: (seed - 0.5) * 0.35,
      seed,
      bounceAmount: 0,
    };
  });
}

export function createScore() {
  return {
    visible: false,
    activeId: null,
    score: 0,
    best: 0,
    lastScore: 0,
    ended: false,
  };
}

export function hitBear(bears, id, scoreState, world) {
  const bear = bears.find((candidate) => candidate.id === id);
  if (!bear) return false;

  if (scoreState.activeId === id && !scoreState.ended) {
    scoreState.score += 1;
  } else {
    if (scoreState.score > 0) scoreState.lastScore = scoreState.score;
    scoreState.activeId = id;
    scoreState.score = 1;
  }

  scoreState.visible = true;
  scoreState.ended = false;
  scoreState.best = Math.max(scoreState.best, scoreState.score);
  bear.y = clamp(bear.y, -world.height / 2 + world.bearSize * 0.7, world.height / 2 - world.bearSize * 0.7);
  bear.vy = BOUNCE_SPEED;
  bear.bounceAmount = 1;
  bear.spinX = 0.55;
  bear.spinY = (bear.seed > 0.5 ? 1 : -1) * 0.9;
  return true;
}

export function stepSimulation(bears, world, deltaTime, scoreState, { reducedMotion = false } = {}) {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return false;
  const delta = Math.min(deltaTime, MAX_STEP);
  const margin = world.bearSize * 0.7;
  const top = world.height / 2 - margin;
  const bottom = -world.height / 2 - margin;
  const horizontalLimit = Math.max(0, world.width / 2 - margin);
  let scoreChanged = false;

  for (const bear of bears) {
    bear.bounceAmount *= Math.exp(-8 * delta);
    if (bear.bounceAmount < 0.001) bear.bounceAmount = 0;

    // Reduced motion keeps the bears in place and only shows the brief squash
    // caused by a deliberate click. No automatic fall, spin, or lost streak.
    if (reducedMotion) {
      bear.vy = 0;
      continue;
    }

    const terminalSpeed = 1.7 + bear.seed * 0.5;
    bear.vy = Math.max(-terminalSpeed, bear.vy - GRAVITY * delta);
    bear.y += bear.vy * delta;
    bear.rotationX += bear.spinX * delta;
    bear.rotationY += bear.spinY * delta;
    bear.rotationZ += bear.spinZ * delta;
    bear.x = clamp(
      bear.baseX + Math.sin(bear.rotationY * 1.5 + bear.seed * Math.PI * 2) * world.bearSize * 0.16,
      -horizontalLimit,
      horizontalLimit,
    );

    // A clicked bear cannot escape through the ceiling while its streak runs.
    if (bear.vy > 0 && bear.y > top) {
      bear.y = top;
      bear.vy = -Math.abs(bear.vy) * 0.18;
    }

    if (bear.y < bottom) {
      if (scoreState.activeId === bear.id) {
        scoreState.lastScore = scoreState.score;
        scoreState.score = 0;
        scoreState.activeId = null;
        scoreState.ended = true;
        scoreChanged = true;
      }
      // Recycle the same bear and ID, preserving the exact five-per-color count.
      bear.y = world.height / 2 + margin + bear.seed * 0.4;
      bear.vy = -0.65 - bear.seed * 0.45;
      bear.bounceAmount = 0;
    }
  }

  return scoreChanged;
}

export function resizeWorld(bears, oldWorld, newWorld) {
  const widthRatio = newWorld.width / oldWorld.width;
  const heightRatio = newWorld.height / oldWorld.height;
  const limit = Math.max(0, newWorld.width / 2 - newWorld.bearSize * 0.7);

  for (const bear of bears) {
    bear.baseX = clamp(bear.baseX * widthRatio, -limit, limit);
    bear.x = clamp(bear.x * widthRatio, -limit, limit);
    bear.y *= heightRatio;
    bear.vy *= heightRatio;
  }
}

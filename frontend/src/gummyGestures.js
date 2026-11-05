// Several quick reversals distinguish a shake from ordinary navigation.
export function createMouseShakeDetector() {
  let previous = null;
  let gesture = null;
  return {
    reset() { previous = null; gesture = null; },
    sample(x, y, time) {
      const last = previous;
      previous = { x, y, time };
      if (!last || time <= last.time || time - last.time > 140) { gesture = null; return false; }
      const dx = x - last.x;
      const dy = y - last.y;
      if (Math.hypot(dx, dy) / ((time - last.time) / 1000) < 650) return false;
      if (!gesture || time - gesture.started > 650) {
        gesture = { axis: Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y', started: last.time, direction: 0, stroke: 0, reversals: 0, travel: 0 };
      }
      const distance = gesture.axis === 'x' ? dx : dy;
      if (Math.abs(distance) < 3) return false;
      const direction = Math.sign(distance);
      if (gesture.direction && direction !== gesture.direction) {
        if (gesture.stroke >= 28) gesture.reversals++;
        gesture.stroke = 0;
      }
      gesture.direction = direction;
      gesture.stroke += Math.abs(distance);
      gesture.travel += Math.abs(distance);
      if (gesture.reversals >= 3 && gesture.travel >= 240) { gesture = null; return true; }
      return false;
    },
  };
}

const MOTION_AXES = ['x', 'y', 'z'];
const DEVICE_SHAKE_THRESHOLD = 6;
const DEVICE_SHAKE_RELEASE = 3;
const DEVICE_SHAKE_COOLDOWN = 1400;

function motionVector(value) {
  if (!value) return null;
  const vector = MOTION_AXES.map((axis) => Number.isFinite(value[axis]) ? value[axis] : null);
  return vector.some(Number.isFinite) ? vector : null;
}

function magnitude(vector) {
  return Math.hypot(...vector.map((value) => value ?? 0));
}

function opposite(first, second) {
  const dot = first.reduce((total, value, index) => total + (value ?? 0) * (second[index] ?? 0), 0);
  return dot < -0.25 * magnitude(first) * magnitude(second);
}

// DeviceMotion acceleration is unreliable on some Android devices: it can be
// zero, partially null, or absent while accelerationIncludingGravity is valid.
// Keep both channels and remove gravity with a time-based high-pass filter.
export function createDeviceShakeDetector() {
  let previousTime = null;
  let gravityBaseline = [null, null, null];
  let lastShake = -Infinity;
  const channels = [{}, {}];

  function clearHistory() {
    previousTime = null;
    gravityBaseline = [null, null, null];
    for (const channel of channels) {
      channel.first = null;
      channel.direction = null;
      channel.inPulse = false;
    }
  }

  function consume(channel, movement, time, raw = null, baseline = null) {
    if (!movement) return false;
    const strength = magnitude(movement);
    if (channel.first && time - channel.first.time > 650) channel.first = null;
    if (strength <= DEVICE_SHAKE_RELEASE) channel.inPulse = false;
    if (strength < DEVICE_SHAKE_THRESHOLD) return false;
    const reversed = channel.direction && opposite(channel.direction, movement);
    const opposingFirst = channel.first && opposite(channel.first.movement, movement);
    if (channel.inPulse && !reversed && !opposingFirst) return false;
    channel.inPulse = true;
    channel.direction = movement;

    const first = channel.first;
    if (!first) {
      channel.first = { movement, time, baseline: baseline?.slice() };
      return false;
    }
    if (time - first.time < 20 || !opposite(first.movement, movement)) return false;
    if (raw) {
      // A high-pass filter's recovery after one isolated bump is not a second
      // physical impulse. Require reversal relative to the original reference.
      const relative = raw.map((value, index) =>
        value !== null && first.baseline[index] !== null ? value - first.baseline[index] : null);
      if (magnitude(relative) < DEVICE_SHAKE_THRESHOLD || !opposite(first.movement, relative)) return false;
    }
    return true;
  }

  return {
    reset() {
      clearHistory();
      lastShake = -Infinity;
    },
    sample(event, timeMs) {
      event ??= {};
      const suppliedTime = Number.isFinite(timeMs) ? timeMs : null;
      const stampedTime = Number.isFinite(event.timeStamp) && event.timeStamp >= 0 ? event.timeStamp : null;
      const sameClock = suppliedTime !== null && stampedTime !== null
        && Math.abs(suppliedTime - stampedTime) < 60_000;
      // Native event timestamps preserve sensor spacing when callbacks arrive
      // together. Discard stale queued events rather than replaying a shake.
      if (sameClock && suppliedTime - stampedTime > 250) {
        clearHistory();
        return false;
      }
      const interval = Number.isFinite(event.interval) && event.interval > 0 ? event.interval : 1000 / 60;
      const time = sameClock ? stampedTime : suppliedTime ?? stampedTime ?? (previousTime === null ? 0 : previousTime + interval);
      if (previousTime !== null && time <= previousTime) {
        clearHistory();
        return false;
      }
      if (previousTime !== null && time - previousTime > 250) clearHistory();
      const delta = previousTime === null ? interval : time - previousTime;
      previousTime = time;

      const linear = motionVector(event.acceleration);
      const gravity = motionVector(event.accelerationIncludingGravity);
      const reference = gravityBaseline.slice();
      const alpha = Math.exp(-delta / 300);
      const filtered = gravity?.map((value, index) => {
        if (value === null) return null;
        if (gravityBaseline[index] === null) gravityBaseline[index] = value;
        gravityBaseline[index] = alpha * gravityBaseline[index] + (1 - alpha) * value;
        return value - gravityBaseline[index];
      });
      if (time - lastShake < DEVICE_SHAKE_COOLDOWN) {
        for (const channel of channels) {
          channel.first = null;
          channel.direction = null;
          channel.inPulse = false;
        }
        return false;
      }
      if (!consume(channels[0], linear, time)
        && !consume(channels[1], filtered, time, gravity, reference)) return false;
      lastShake = time;
      for (const channel of channels) {
        channel.first = null;
        channel.direction = null;
        channel.inPulse = false;
      }
      return true;
    },
  };
}

export function shouldShakeFromSpace(event) {
  if ((event.code !== 'Space' && event.key !== ' ') || event.repeat || event.defaultPrevented
    || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  return !event.target?.isContentEditable
    && !event.target?.closest?.('input, textarea, select, button, a, [contenteditable], [role="button"], [role="textbox"]');
}

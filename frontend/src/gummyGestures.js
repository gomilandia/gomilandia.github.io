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

export function shouldShakeFromSpace(event) {
  if ((event.code !== 'Space' && event.key !== ' ') || event.repeat || event.defaultPrevented
    || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  return !event.target?.isContentEditable
    && !event.target?.closest?.('input, textarea, select, button, a, [contenteditable], [role="button"], [role="textbox"]');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceShakeDetector, createMouseShakeDetector, shouldShakeFromSpace } from './gummyGestures.js';

test('a deliberate fast horizontal or vertical mouse shake is recognized once', () => {
  for (const axis of ['x', 'y']) {
    const detector = createMouseShakeDetector();
    const results = [0, 90, 0, 90, 0].map((position, index) =>
      detector.sample(axis === 'x' ? position : 0, axis === 'y' ? position : 0, index * 50));
    assert.deepEqual(results, [false, false, false, false, true]);
    assert.equal(detector.sample(0, 0, 300), false);
  }
});

test('ordinary pointer navigation, slow reversals and tiny jitter do not shake', () => {
  const detector = createMouseShakeDetector();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index * 90, 0, index * 30), false);
  detector.reset();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index % 2 ? 80 : 0, 0, index * 300), false);
  detector.reset();
  for (let index = 0; index < 30; index++) assert.equal(detector.sample(index % 2 ? 5 : 0, 0, index * 5), false);
});

test('a pause or leaving the window discards a partial mouse shake', () => {
  const detector = createMouseShakeDetector();
  [0, 90, 0].forEach((x, index) => detector.sample(x, 0, index * 40));
  assert.equal(detector.sample(90, 0, 600), false);
  assert.equal(detector.sample(0, 0, 640), false);
  detector.reset();
  assert.equal(detector.sample(90, 0, 680), false);
});

test('Space only handles unmodified background presses and preserves interactive controls', () => {
  const event = { code: 'Space', target: { closest: () => null } };
  assert.equal(shouldShakeFromSpace(event), true);
  assert.equal(shouldShakeFromSpace({ key: ' ' }), true);
  for (const flag of ['repeat', 'defaultPrevented', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(shouldShakeFromSpace({ ...event, [flag]: true }), false, flag);
  }
  assert.equal(shouldShakeFromSpace({ code: 'Enter' }), false);
  assert.equal(shouldShakeFromSpace({ ...event, target: { isContentEditable: true } }), false);
  assert.equal(shouldShakeFromSpace({ ...event, target: { closest: () => ({}) } }), false);
});

function motionTrace(detector, hz, duration, eventAt, start = 0) {
  const hits = [];
  for (let sample = 0; sample <= Math.floor(duration * hz / 1000); sample++) {
    const time = start + sample * 1000 / hz;
    const event = { interval: 1000 / hz, ...eventAt(time - start) };
    if (detector.sample(event, time)) hits.push(time);
  }
  return hits;
}

function shakeWave(time) {
  return time < 250 || time > 900 ? 0 : Math.sin((time - 250) / 1000 * Math.PI * 2 * 3) * 10;
}

test('device shakes work with Android linear and gravity channels at 15/30/60/100 Hz', () => {
  for (const hz of [15, 30, 60, 100]) {
    for (const channel of ['linear', 'gravity', 'zero-linear-gravity']) {
      const detector = createDeviceShakeDetector();
      const hits = motionTrace(detector, hz, 1200, (time) => ({
        acceleration: channel === 'linear' ? { x: shakeWave(time), y: 0, z: 0 }
          : channel === 'zero-linear-gravity' ? { x: 0, y: 0, z: 0 } : null,
        accelerationIncludingGravity: { x: channel === 'linear' ? 0 : shakeWave(time), y: 0, z: 9.81 },
      }));
      assert.equal(hits.length, 1, `${hz}Hz ${channel}`);
    }
  }
});

test('one finite axis is sufficient while null axes and missing channels remain valid', () => {
  for (const gravity of [false, true]) {
    const detector = createDeviceShakeDetector();
    const hits = motionTrace(detector, 60, 1200, (time) => ({
      acceleration: gravity ? { x: null, y: 0, z: null } : { x: shakeWave(time), y: null, z: null },
      accelerationIncludingGravity: gravity ? { x: shakeWave(time), y: null, z: null } : null,
    }));
    assert.equal(hits.length, 1);
  }
  const detector = createDeviceShakeDetector();
  for (let index = 0; index < 30; index++) {
    assert.equal(detector.sample({ acceleration: { x: null, y: NaN, z: undefined } }, index * 20), false);
  }
});

test('fast reversals below 75ms trigger, with one detection per cooldown', () => {
  const detector = createDeviceShakeDetector();
  const hits = [0, 16, 32, 48, 64, 80].map((time, index) =>
    detector.sample({ acceleration: { x: index % 2 ? -18 : 18, y: 0, z: 0 } }, time));
  assert.equal(hits.filter(Boolean).length, 1);
  assert.ok(hits.findIndex(Boolean) < 5);
  assert.equal(detector.sample({ acceleration: { x: 12 } }, 1300), false);
  assert.equal(detector.sample({ acceleration: { x: -12 } }, 1320), false);
});

test('quiet gravity, gradual tilt and ordinary small scrolling never trigger', () => {
  for (const hz of [15, 30, 60, 100]) {
    const detector = createDeviceShakeDetector();
    const hits = motionTrace(detector, hz, 8000, (time) => {
      const angle = Math.sin(time / 3000) * 1.2;
      return {
        acceleration: { x: Math.sin(time / 150) * 2.5, y: 0, z: null },
        accelerationIncludingGravity: { x: 9.81 * Math.sin(angle), y: 0, z: 9.81 * Math.cos(angle) },
      };
    });
    assert.deepEqual(hits, [], `${hz}Hz tilt/scroll`);
  }
});

test('a single linear or gravity bump and its filter recovery are not a shake', () => {
  for (const duration of [20, 150, 300]) {
    for (const gravity of [false, true]) {
      const detector = createDeviceShakeDetector();
      const hits = motionTrace(detector, 100, 1800, (time) => {
        const value = time >= 300 && time < 300 + duration ? 14 : 0;
        return {
          acceleration: gravity ? null : { x: value },
          accelerationIncludingGravity: { x: gravity ? value : 0, z: 9.81 },
        };
      });
      assert.deepEqual(hits, [], `${duration}ms ${gravity ? 'gravity' : 'linear'} bump`);
    }
  }
});

test('reset, discontinuous timestamps and stale event backlogs discard partial gestures', () => {
  const detector = createDeviceShakeDetector();
  const plus = { acceleration: { x: 10 } };
  const minus = { acceleration: { x: -10 } };
  assert.equal(detector.sample(plus, 0), false);
  detector.reset();
  assert.equal(detector.sample(minus, 40), false);
  assert.equal(detector.sample(plus, 2000), false);
  assert.equal(detector.sample(minus, 1990), false);
  detector.reset();
  for (let index = 0; index < 8; index++) {
    assert.equal(detector.sample({ ...(index % 2 ? minus : plus), timeStamp: index * 20 }, 1000 + index), false);
  }
  assert.equal(detector.sample({ ...plus, timeStamp: 1200 }, 1200), false);
  assert.equal(detector.sample({ ...minus, timeStamp: 1240 }, 1240), true);
  detector.reset();
  assert.equal(detector.sample(plus, 1300), false);
  assert.equal(detector.sample(minus, 1340), true);
});

test('event timestamps preserve sensor cadence when callbacks arrive together', () => {
  const detector = createDeviceShakeDetector();
  assert.equal(detector.sample({ acceleration: { x: 9 }, timeStamp: 100, interval: 20 }, 180), false);
  assert.equal(detector.sample({ acceleration: { x: -9 }, timeStamp: 140, interval: 20 }, 181), true);
  detector.reset();
  assert.equal(detector.sample({ acceleration: { x: 9 }, timeStamp: 200 }), false);
  assert.equal(detector.sample({ acceleration: { x: -9 }, timeStamp: 240 }), true);
  detector.reset();
  assert.equal(detector.sample({ acceleration: { x: 9 }, interval: 30 }), false);
  assert.equal(detector.sample({ acceleration: { x: -9 }, interval: 30 }), true);
});

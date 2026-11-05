import { useEffect, useRef } from 'react';
import './GummyRain.css';

const noop = () => undefined;
const interactiveSelector = 'a, button, input, textarea, select, form, summary, label, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

function motionAccess() {
  if (typeof window.DeviceMotionEvent === 'undefined') return 'unavailable';
  return typeof window.DeviceMotionEvent.requestPermission === 'function' ? 'prompt' : 'enabled';
}

function vector(value) {
  if (!value || ![value.x, value.y, value.z].every(Number.isFinite)) return null;
  return [value.x, value.y, value.z];
}

export default function GummyRain() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let scene;
    let shakeTimer;
    import('./gummyScene.js').then(({ createGummyScene }) => {
      if (cancelled) return;
      scene = createGummyScene(canvasRef.current, {
        onReady: noop,
        onPausedChange: noop,
        onError: noop,
        onShake: () => {
          if (cancelled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          document.documentElement.classList.add('gummy-page-shaking');
          window.clearTimeout(shakeTimer);
          shakeTimer = window.setTimeout(() => {
            document.documentElement.classList.remove('gummy-page-shaking');
          }, 600);
        },
      });
      sceneRef.current = scene;
    }).catch(noop);
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
      window.clearTimeout(shakeTimer);
      document.documentElement.classList.remove('gummy-page-shaking');
    };
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 640px), (pointer: coarse)');
    const hasPointerEvents = typeof window.PointerEvent !== 'undefined';
    let cancelled = false;
    let permission = motionAccess();
    let requested = false;
    let previousGravity = null;
    let firstPeak = null;
    let lastShake = -Infinity;
    let touchStart = null;
    let lastTap = null;

    function detectShake(event) {
      if (!mobile.matches || permission !== 'enabled' || document.hidden) return;
      const linear = vector(event.acceleration);
      const gravity = vector(event.accelerationIncludingGravity);
      const movement = linear ?? (gravity && previousGravity
        ? gravity.map((value, index) => value - previousGravity[index]) : null);
      previousGravity = gravity;
      if (!movement) return;
      const now = performance.now();
      if (now - lastShake < 1400 || Math.hypot(...movement) < 14) return;
      if (!firstPeak || now - firstPeak.time > 650) {
        firstPeak = { time: now, movement };
        return;
      }
      if (now - firstPeak.time < 75) return;
      const reversal = movement.reduce((total, value, index) => total + value * firstPeak.movement[index], 0);
      if (reversal >= 0) return;
      lastShake = now;
      firstPeak = null;
      sceneRef.current?.shake();
    }

    function requestMotion(event) {
      if (requested || permission !== 'prompt' || !event.isTrusted) return;
      requested = true;
      permission = 'requesting';
      // Keep this call inside the first real touch gesture for browsers that require it.
      try {
        const result = window.DeviceMotionEvent.requestPermission();
        Promise.resolve(result).then((next) => {
          if (!cancelled) permission = next === 'granted' ? 'enabled' : 'denied';
        }).catch(() => { if (!cancelled) permission = 'denied'; });
      } catch {
        permission = 'denied';
      }
    }

    function isTouch(event) {
      return !hasPointerEvents || (event.pointerType === 'touch' && event.isPrimary !== false);
    }

    function startTouch(event) {
      if (!mobile.matches || !isTouch(event) || document.hidden) return;
      if (event.touches && event.touches.length !== 1) {
        touchStart = null;
        lastTap = null;
        return;
      }
      if (event.target.closest?.(interactiveSelector)) {
        touchStart = null;
        lastTap = null;
        return;
      }
      const point = event.changedTouches?.[0] ?? event;
      touchStart = { x: point.clientX, y: point.clientY, time: performance.now() };
    }

    function endTouch(event) {
      if (!mobile.matches || !isTouch(event) || document.hidden) return;
      requestMotion(event);
      const start = touchStart;
      touchStart = null;
      if (!start || event.defaultPrevented || event.target.closest?.(interactiveSelector)) return;
      const point = event.changedTouches?.[0] ?? event;
      const now = performance.now();
      if (now - start.time > 350 || Math.hypot(point.clientX - start.x, point.clientY - start.y) > 12) {
        lastTap = null;
        return;
      }
      if (lastTap && now - lastTap.time < 350
        && Math.hypot(point.clientX - lastTap.x, point.clientY - lastTap.y) < 28) {
        lastTap = null;
        sceneRef.current?.shake();
      } else {
        lastTap = { x: point.clientX, y: point.clientY, time: now };
      }
    }

    function cancelTouch() {
      touchStart = null;
      lastTap = null;
      firstPeak = null;
      previousGravity = null;
    }

    const startEvent = hasPointerEvents ? 'pointerdown' : 'touchstart';
    const endEvent = hasPointerEvents ? 'pointerup' : 'touchend';
    const cancelEvent = hasPointerEvents ? 'pointercancel' : 'touchcancel';
    window.addEventListener('devicemotion', detectShake, { passive: true });
    window.addEventListener(startEvent, startTouch, { passive: true });
    window.addEventListener(endEvent, endTouch, { passive: true });
    window.addEventListener(cancelEvent, cancelTouch, { passive: true });
    window.addEventListener('blur', cancelTouch);
    document.addEventListener('visibilitychange', cancelTouch);
    return () => {
      cancelled = true;
      window.removeEventListener('devicemotion', detectShake);
      window.removeEventListener(startEvent, startTouch);
      window.removeEventListener(endEvent, endTouch);
      window.removeEventListener(cancelEvent, cancelTouch);
      window.removeEventListener('blur', cancelTouch);
      document.removeEventListener('visibilitychange', cancelTouch);
    };
  }, []);

  return (
    <div className="gummy-rain" aria-hidden="true">
      <canvas ref={canvasRef} className="gummy-canvas" />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { createDeviceShakeDetector } from './gummyGestures.js';
import './GummyRain.css';

const noop = () => undefined;
const interactiveSelector = 'a, button, input, textarea, select, form, summary, label, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

function motionAccess() {
  if (typeof window.DeviceMotionEvent === 'undefined') return 'unavailable';
  return typeof window.DeviceMotionEvent.requestPermission === 'function' ? 'prompt' : 'enabled';
}

export default function GummyRain() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const sceneReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let scene;
    let shakeTimer;
    import('./gummyScene.js').then(({ createGummyScene }) => {
      if (cancelled) return;
      scene = createGummyScene(canvasRef.current, {
        onReady: () => { if (!cancelled) sceneReadyRef.current = true; },
        onPausedChange: noop,
        onError: () => { sceneReadyRef.current = false; },
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
      sceneReadyRef.current = false;
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
    const deviceShake = createDeviceShakeDetector();
    let touchStart = null;
    let lastTap = null;

    function detectShake(event) {
      if (!mobile.matches || permission === 'denied' || document.hidden || !sceneReadyRef.current) return;
      // Chrome can expose requestPermission while already allowing sensor readings.
      // Receiving usable data means the browser has granted access; no tap is needed.
      if (permission !== 'enabled') {
        const readable = [event.acceleration, event.accelerationIncludingGravity]
          .some((reading) => reading && ['x', 'y', 'z'].some((axis) => Number.isFinite(reading[axis])));
        if (!readable) return;
        permission = 'enabled';
      }
      // The detector keeps sensor timestamps and rejects stale queued samples.
      if (deviceShake.sample(event, performance.now())) sceneRef.current?.shake();
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
      deviceShake.reset();
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

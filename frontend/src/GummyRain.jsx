import { useEffect, useRef, useState } from 'react';
import './GummyRain.css';

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
  const shakeTimerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px), (pointer: coarse)').matches);
  const [motion, setMotion] = useState(motionAccess);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px), (pointer: coarse)');
    const change = (event) => setMobile(event.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let scene;
    import('./gummyScene.js').then(({ createGummyScene }) => {
      if (cancelled) return;
      scene = createGummyScene(canvasRef.current, {
        onReady: () => { if (!cancelled) setReady(true); },
        onPausedChange: (next) => { if (!cancelled) setPaused(next); },
        onError: () => { if (!cancelled) setReady(false); },
        onShake: () => {
          if (cancelled) return;
          setAnnouncement('Ositos despejados.');
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          document.documentElement.classList.add('gummy-page-shaking');
          window.clearTimeout(shakeTimerRef.current);
          shakeTimerRef.current = window.setTimeout(() => {
            document.documentElement.classList.remove('gummy-page-shaking');
          }, 600);
        },
      });
      sceneRef.current = scene;
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
      window.clearTimeout(shakeTimerRef.current);
      document.documentElement.classList.remove('gummy-page-shaking');
    };
  }, []);

  useEffect(() => {
    if (!mobile || motion !== 'enabled' || !ready) return;
    let previousGravity = null;
    let firstPeak = null;
    let lastShake = -Infinity;

    function detectShake(event) {
      if (document.hidden) return;
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

    window.addEventListener('devicemotion', detectShake, { passive: true });
    return () => window.removeEventListener('devicemotion', detectShake);
  }, [mobile, motion, ready]);

  async function activateMotion() {
    if (motion !== 'prompt') {
      sceneRef.current?.shake();
      return;
    }
    try {
      const permission = await window.DeviceMotionEvent.requestPermission();
      setMotion(permission === 'granted' ? 'enabled' : 'denied');
      if (permission === 'granted') sceneRef.current?.shake();
    } catch {
      setMotion('denied');
    }
  }

  const fallback = motion === 'denied' || motion === 'unavailable';
  const instruction = !mobile
    ? 'Mueve rápido el mouse o pulsa Espacio'
    : fallback ? 'Puedes despejar los ositos con el botón'
      : motion === 'prompt' ? 'Activa la sacudida del teléfono'
        : 'Agita el teléfono para despejar';

  return (
    <>
      <div className="gummy-rain" aria-hidden="true">
        <canvas ref={canvasRef} className="gummy-canvas" />
      </div>
      {ready && <aside className="gummy-controls" aria-label="Lluvia de ositos">
        <p id="gummy-instructions">{instruction}</p>
        <div className="gummy-controls-actions">
          <button type="button" className="gummy-shake" aria-describedby="gummy-instructions"
            onClick={mobile ? activateMotion : () => sceneRef.current?.shake()}>
            <span className="gummy-shake-icon" aria-hidden="true">↔</span>{' '}
            {mobile ? motion === 'prompt' ? 'Activar movimiento' : 'Limpiar ositos' : 'Agitar'}
          </button>
          <button type="button" className="gummy-pause" onClick={() => sceneRef.current?.setPaused(!paused)}
            aria-pressed={paused} aria-label={paused ? 'Reanudar lluvia' : 'Pausar lluvia'}>
            <span className="gummy-pause-icon" aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
            <span className="gummy-pause-label">{paused ? 'Reanudar' : 'Pausar'}</span>
          </button>
        </div>
        {mobile && motion === 'denied' && <p className="gummy-motion-note" role="status">Movimiento desactivado. Usa «Limpiar ositos».</p>}
        <p className="gummy-visually-hidden" role="status" aria-live="polite">{announcement}</p>
      </aside>}
    </>
  );
}

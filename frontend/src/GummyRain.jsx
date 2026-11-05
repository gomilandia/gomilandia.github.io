import { useEffect, useRef } from 'react';
import './GummyRain.css';

const INTRO_KEY = 'gomilandia-rain-intro-seen';

export default function GummyRain() {
  const canvasRef = useRef(null);
  const peekCanvasRef = useRef(null);
  const peekRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let scene;
    let intro = true;
    try { intro = window.sessionStorage.getItem(INTRO_KEY) !== '1'; } catch { /* Storage can be disabled. */ }
    // Local review can replay the entrance without changing the saved visit.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('intro') === '1') intro = true;

    import('./gummyScene.js').then(({ createGummyScene }) => {
      if (cancelled) return;
      scene = createGummyScene(canvasRef.current, {
        intro,
        peekCanvas: peekCanvasRef.current,
        peekElement: peekRef.current,
        onSettled: () => {
          if (cancelled) return;
          try { window.sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* Keep the scene usable without storage. */ }
        },
      });
    }).catch((error) => console.error('No se pudo iniciar la decoración de gomitas:', error));

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  return (
    <>
      <div className="gummy-rain" aria-hidden="true">
        <canvas ref={canvasRef} className="gummy-canvas" />
      </div>
      <div ref={peekRef} className="gummy-peek" data-visible="false" data-side="right" aria-hidden="true">
        <canvas ref={peekCanvasRef} />
      </div>
    </>
  );
}

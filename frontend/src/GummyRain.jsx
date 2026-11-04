import { useEffect, useRef, useState } from 'react';
import './GummyRain.css';

const COLOR_LABELS = ['rojo', 'verde', 'naranja', 'amarillo', 'rosa'];
const COLOR_HEX = ['#ff0033', '#00cc44', '#ffaa00', '#ffee00', '#ff66cc'];

export default function GummyRain() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [score, setScore] = useState({ visible: false, activeId: null, score: 0, best: 0, lastScore: 0, ended: false });

  useEffect(() => {
    let cancelled = false;
    let scene;
    import('./gummyScene.js').then(({ createGummyScene }) => {
      if (cancelled) return;
      scene = createGummyScene(canvasRef.current, {
        onReady: () => { if (!cancelled) setReady(true); },
        onScore: (next) => { if (!cancelled) setScore(next); },
        onPausedChange: (next) => { if (!cancelled) setPaused(next); },
        onError: () => { if (!cancelled) { setReady(false); setScore((current) => ({ ...current, visible: false })); } },
      });
      sceneRef.current = scene;
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const activeColor = score.activeColorIndex ?? 0;
  const message = score.ended
    ? `¡Se cayó! Última racha: ${score.lastScore}. Toca otro osito para volver a jugar.`
    : `Sigue con el mismo osito ${COLOR_LABELS[activeColor]}. ¡Que no caiga!`;

  return (
    <>
      <div className="gummy-rain" aria-hidden="true">
        <canvas ref={canvasRef} className="gummy-canvas" />
      </div>
      <p className="gummy-visually-hidden">Hay 25 ositos de goma cayendo por la página. Toca uno para descubrir el juego. Los clics consecutivos al mismo osito suman puntos hasta que cae.</p>
      {ready && !score.visible && <button type="button" className="gummy-discover" onClick={() => sceneRef.current?.bounceActive()}>Jugar con los ositos</button>}
      {ready && score.visible && <aside className="gummy-score-widget" aria-label="Marcador de ositos">
        <div className="gummy-widget-header">
          <span>¡Encontraste el juego!</span>
          <button type="button" className="gummy-close" aria-label="Cerrar marcador" onClick={() => sceneRef.current?.resetGame()}>×</button>
        </div>
        <div className="gummy-score-row">
          <div className="gummy-score-number"><span>Score</span><strong>{score.score}</strong></div>
          <div className="gummy-score-copy">
            <p role="status" aria-live="polite" aria-atomic="true">
              <span className="gummy-visually-hidden">Score: {score.score}. </span>
              {!score.ended && <span className="gummy-color-dot" style={{ backgroundColor: COLOR_HEX[activeColor] }} aria-hidden="true" />}
              {message}
            </p>
            <p className="gummy-best">Mejor racha: <strong>{score.best}</strong></p>
          </div>
        </div>
        <div className="gummy-widget-actions">
          <button className="gummy-bounce-button" type="button" onClick={() => sceneRef.current?.bounceActive()}>
            {score.activeId !== null ? 'Rebotar mi osito' : 'Elegir otro osito'} <span aria-hidden="true">↗</span>
          </button>
          <button className="gummy-pause" type="button" onClick={() => sceneRef.current?.setPaused(!paused)}
            aria-pressed={paused} aria-label={paused ? 'Reanudar lluvia' : 'Pausar lluvia'}>
            {paused ? 'Reanudar' : 'Pausar'}
          </button>
        </div>
      </aside>}
    </>
  );
}

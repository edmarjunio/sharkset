import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { loadAquariumAssets, renderAquarium } from '../animation/aquariumScene';
import { useI18n } from '../hooks/useI18n';
import './AquariumBackground.css';

export const AquariumBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pausedRef = useRef(paused);
  const resumeRef = useRef<(() => void) | null>(null);
  const { t } = useI18n();
  useEffect(() => { pausedRef.current = paused; resumeRef.current?.(); }, [paused]);

  useEffect(() => {
    let disposed = false, frame = 0, lastTime = 0, lastPaint = 0, elapsed = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
    if (connection?.saveData) return;
    let motionRestricted = reducedMotion.matches || Boolean(connection?.saveData);
    const assetsPromise = loadAquariumAssets(import.meta.env.BASE_URL);
    let assets: Awaited<typeof assetsPromise> | undefined;
    const resize = () => {
      // Adapt to the viewport, with an upper bound of 4K; small screens avoid a 4K canvas.
      const ratio = Math.min(window.devicePixelRatio || 1, 2, 3840 / window.innerWidth, 2160 / window.innerHeight);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      if (assets) renderAquarium(ctx, assets, canvas.width, canvas.height, elapsed);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || document.hidden || motionRestricted || pausedRef.current) { lastTime = 0; return; }
      const moving = !motionRestricted && !pausedRef.current;
      if (moving && lastTime) elapsed += Math.min((now - lastTime) / 1000, .1);
      lastTime = now;
      if (assets && moving && now - lastPaint >= 1000 / 30) {
        renderAquarium(ctx, assets, canvas.width, canvas.height, elapsed);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      lastTime = 0;
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else if (!frame && assets && !motionRestricted && !pausedRef.current) frame = requestAnimationFrame(tick);
    };
    const preference = () => { motionRestricted = reducedMotion.matches; visibility(); };
    resumeRef.current = visibility;
    resize();
    assetsPromise.then((result) => {
      if (disposed) return;
      assets = result; resize(); setLoaded(true); visibility();
    }).catch(() => { /* Keep the optimized poster visible on loading failure. */ });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', preference);
    return () => {
      disposed = true; cancelAnimationFrame(frame); resumeRef.current = null;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      reducedMotion.removeEventListener('change', preference);
    };
  }, []);

  return (
    <>
      <div className="aquarium-background" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}media/aquarium/poster.webp`} alt="" fetchPriority="high" />
        <canvas ref={canvasRef} className={loaded ? 'is-loaded' : undefined} />
        <div className="aquarium-background__shade" />
      </div>
      {loaded && <button type="button" className="aquarium-motion-toggle" onClick={() => setPaused(value => !value)}
        aria-label={t(paused ? 'aquarium_play' : 'aquarium_pause')} aria-pressed={paused}>
        {paused ? <Play size={13} /> : <Pause size={13} />}
        <span>{t(paused ? 'aquarium_play' : 'aquarium_pause')}</span>
      </button>}
    </>
  );
};
import React, { useEffect, useState } from 'react';

export function AquariumBackground() {
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem('sharkset_aquarium_paused') === 'true'; } catch { return false; }
  });
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <>
    <div className={`aquarium-world ${paused || hidden ? 'aquarium-paused' : ''}`} aria-hidden="true">
      <div className="aquarium-scenery" />
      <div className="aquarium-rays" />
      <div className="aquarium-swimmer"><img src="/brand/shark-swimming.png" alt="" width="1536" height="1024" decoding="async" /></div>
      <div className="aquarium-bubbles">{Array.from({ length: 24 }, (_, index) =>
        <i key={index} style={{ left: `${3 + (index * 17) % 94}%`, width: 4 + index % 5 * 5, height: 4 + index % 5 * 5,
          animationDuration: `${12 + index % 7 * 3}s`, animationDelay: `${-2 - index * 3}s` }} />)}</div>
      <div className="aquarium-depth" />
    </div>
    <button className="aquarium-motion-control" aria-pressed={paused} onClick={() => {
      const next = !paused; setPaused(next);
      try { localStorage.setItem('sharkset_aquarium_paused', String(next)); } catch { /* Preference remains available in memory. */ }
    }}>{paused ? '▶ Animar aquário' : 'Ⅱ Pausar aquário'}</button>
  </>;
}

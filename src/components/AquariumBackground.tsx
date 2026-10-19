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
      <div className="aquarium-caustics" />
      <div className="aquarium-surface" />
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

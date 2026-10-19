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
      <div className="aquarium-rays" />
      <div className="aquarium-swimmer"><img src="/brand/shark-swimming.png" alt="" width="1536" height="1024" decoding="async" /></div>
      <div className="aquarium-bubbles">{Array.from({ length: 8 }, (_, index) =>
        <i key={index} style={{ left: `${8 + index * 12}%`, width: 8 + index % 3 * 9, height: 8 + index % 3 * 9,
          animationDuration: `${19 + index * 2}s`, animationDelay: `${-index * 4}s` }} />)}</div>
    </div>
    <button className="aquarium-motion-control" aria-pressed={paused} onClick={() => {
      const next = !paused; setPaused(next);
      try { localStorage.setItem('sharkset_aquarium_paused', String(next)); } catch { /* Preference remains available in memory. */ }
    }}>{paused ? '▶ Animar aquário' : 'Ⅱ Pausar aquário'}</button>
  </>;
}

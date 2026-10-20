import React, { useEffect, useState } from 'react';

export function AquariumBackground() {
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem('sharkset_aquarium_paused') === 'true';
    } catch {
      return false;
    }
  });
  const [hidden, setHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return (
    <>
      <div
        className={`aquarium-world ${paused || hidden ? 'aquarium-paused' : ''}`}
        aria-hidden="true"
      >
        <div className="aquarium-scenery" />

        {/* Cinematic Aquarium Depth, Light Rays & Water Caustics Overlay */}
        <div className="aquarium-rays" />
        <div className="aquarium-bubbles">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={{
                left: `${3 + (index * 17) % 94}%`,
                width: 4 + (index % 5) * 4,
                height: 4 + (index % 5) * 4,
                animationDuration: `${14 + (index % 7) * 3}s`,
                animationDelay: `${-2 - index * 2.5}s`,
              }}
            />
          ))}
        </div>
        <div className="aquarium-depth" />
      </div>

      <button
        type="button"
        className="aquarium-motion-control"
        aria-pressed={paused}
        onClick={() => {
          const next = !paused;
          setPaused(next);
          try {
            localStorage.setItem('sharkset_aquarium_paused', String(next));
          } catch {
            /* Preference remains available in memory. */
          }
        }}
        title={paused ? 'Retomar animação do aquário' : 'Pausar animação do aquário'}
      >
        {paused ? '▶ Animar aquário' : 'Ⅱ Pausar aquário'}
      </button>
    </>
  );
}

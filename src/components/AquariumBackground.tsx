import React, { useEffect, useState } from 'react';

const TropicalFish: React.FC<{
  className: string;
  bodyColor: string;
  tailColor: string;
}> = ({ className, bodyColor, tailColor }) => (
  <span className={`aquarium-fish-wrap ${className}`}>
    <svg className="aquarium-fish" viewBox="0 0 120 80" aria-hidden="true">
      <path d="M29 40 8 21v38z" fill={tailColor} stroke="#12344b" strokeWidth="3" />
      <path
        d="M26 40c9-17 28-24 52-19 15 3 26 10 35 19-9 10-20 16-35 19-24 5-43-2-52-19z"
        fill={bodyColor}
        stroke="#12344b"
        strokeWidth="3"
      />
      <path d="M50 22c-6 11-6 25 0 36M72 20c-6 13-6 27 0 40" fill="none" stroke="#eafcff" strokeWidth="8" />
      <path d="M54 20c-6 13-6 28 0 40M76 19c-6 14-6 29 0 42" fill="none" stroke="#173a52" strokeWidth="2" />
      <path d="M57 20c4-9 12-12 21-10-1 7-6 12-14 15M64 59c5 8 12 10 20 8-2-7-7-10-15-13" fill={tailColor} stroke="#12344b" strokeWidth="2.5" />
      <circle cx="94" cy="34" r="5" fill="#fff" />
      <circle cx="96" cy="34" r="2.5" fill="#102b43" />
      <path d="M100 47q7 2 11-2" fill="none" stroke="#fff5e7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </span>
);

const Kelp: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
  const gradientId = `kelp-fill-${side}`;

  return (
    <div className={`aquarium-kelp aquarium-kelp-${side}`} aria-hidden="true">
      <svg viewBox="0 0 250 300" preserveAspectRatio="none">
        <path
          d="M44 310C28 240 58 194 45 142 34 98 45 57 26 10c45 34 48 78 45 115-2 42 13 76 3 111 34-50 20-104 43-143 14-24 39-42 45-85 25 50 4 91-14 123-21 38-25 75-43 117 33-32 54-68 92-83 19-8 35-24 48-52 10 42-13 69-45 83-51 22-66 62-91 114z"
          fill={`url(#${gradientId})`}
          fillOpacity=".72"
        />
        <path d="M45 300C37 219 60 166 45 109M77 294C104 215 97 167 126 114M111 292C143 230 171 211 222 176" fill="none" stroke="#b6ffe7" strokeOpacity=".42" strokeWidth="3" />
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="1" y2="0">
            <stop stopColor="#08775f" />
            <stop offset=".52" stopColor="#21c38d" />
            <stop offset="1" stopColor="#8af2c5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

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
        <div className="aquarium-depth" />
        <div className="aquarium-rays" />
        <div className="aquarium-caustics" />
        <Kelp side="left" />
        <Kelp side="right" />

        <div className="aquarium-school">
          <TropicalFish className="aquarium-fish-one" bodyColor="#ff823d" tailColor="#ffb347" />
          <TropicalFish className="aquarium-fish-two" bodyColor="#35c9c3" tailColor="#f5ad39" />
          <TropicalFish className="aquarium-fish-three" bodyColor="#ffd65a" tailColor="#fa9f43" />
        </div>

        <div className="aquarium-swimmer">
          <img
            src="/brand/shark-swimming.png"
            alt=""
            width="1536"
            height="1024"
            decoding="async"
          />
        </div>

        <div className="aquarium-bubbles">
          {Array.from({ length: 24 }, (_, index) => (
            <i
              key={index}
              style={{
                left: `${3 + (index * 17) % 94}%`,
                width: 4 + (index % 5) * 5,
                height: 4 + (index % 5) * 5,
                animationDuration: `${12 + (index % 7) * 3}s`,
                animationDelay: `${-2 - index * 3}s`,
              }}
            />
          ))}
        </div>
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
            // Keep the motion preference for this page session.
          }
        }}
        title={paused ? 'Retomar animação do aquário' : 'Pausar animação do aquário'}
      >
        {paused ? '▶ Animar aquário' : 'Ⅱ Pausar aquário'}
      </button>
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';

export function AquariumBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem('sharkset_aquarium_paused') === 'true';
    } catch {
      return false;
    }
  });
  const [hidden, setHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused || hidden) {
      video.pause();
    } else {
      video.play().catch(() => {
        // Autoplay may wait for user interaction in certain strict browser settings
      });
    }
  }, [paused, hidden]);

  return (
    <>
      <div
        className={`aquarium-world ${paused || hidden ? 'aquarium-paused' : ''}`}
        aria-hidden="true"
      >
        {/* Real HD Looping Aquarium Video Background (Zero Audio, Enhanced Aquarium Depth) */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/brand/ocean-bg.jpg"
          onLoadedData={() => setVideoLoaded(true)}
          className={`aquarium-video transition-opacity duration-700 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src="/brand/aquarium-bg.mp4" type="video/mp4" />
        </video>

        {/* Fallback Static Scenery for loading state */}
        {!videoLoaded && <div className="aquarium-scenery" />}

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

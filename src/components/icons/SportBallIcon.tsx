import React from 'react';

export type SportBallType = 'futevolei' | 'volei-praia' | 'beach-tennis';

interface SportBallIconProps {
  sport: SportBallType;
  className?: string;
  size?: number;
}

const BALL_ASSETS: Record<SportBallType, { src: string; alt: string; label: string }> = {
  futevolei: {
    src: '/brand/sports/futevolei-transparent.png',
    alt: 'Bola Oficial de Futevôlei',
    label: 'Futevôlei',
  },
  'volei-praia': {
    src: '/brand/sports/volei-transparent.png',
    alt: 'Bola Oficial de Vôlei de Praia',
    label: 'Vôlei de Praia',
  },
  'beach-tennis': {
    src: '/brand/sports/beach-tennis-transparent.png',
    alt: 'Bola Oficial de Beach Tennis',
    label: 'Beach Tennis',
  },
};

export const SportBallIcon: React.FC<SportBallIconProps> = ({
  sport,
  className = 'w-5 h-5',
  size,
}) => {
  const ball = BALL_ASSETS[sport] || BALL_ASSETS.futevolei;
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <span
      className={`relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full shrink-0 select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.55)] ${className}`}
      style={style}
      title={ball.label}
    >
      <img
        src={ball.src}
        alt={ball.alt}
        className={`h-full w-full object-contain transition-transform duration-200 ${sport === 'beach-tennis' || sport === 'volei-praia' ? 'scale-[1.16]' : 'scale-[1.03]'}`}
        loading="lazy"
        decoding="async"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 28% 22%, rgba(255,255,255,.42), transparent 34%, rgba(0,0,0,.08) 63%, rgba(0,0,0,.45) 100%)',
          boxShadow: 'inset -2px -3px 5px rgba(0,0,0,.35), inset 1px 1px 2px rgba(255,255,255,.2)',
        }}
      />
    </span>
  );
};

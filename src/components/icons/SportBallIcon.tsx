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
      className={`relative inline-flex h-7 w-7 items-center justify-center shrink-0 select-none ${className}`}
      style={style}
      title={ball.label}
    >
      <img
        src={ball.src}
        alt={ball.alt}
        className="relative z-0 h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(0,18,38,0.42)] transition-transform duration-200"
        loading="lazy"
        decoding="async"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: 'radial-gradient(ellipse at 28% 18%, rgba(255,255,255,.28), transparent 40%, rgba(12,55,89,.10) 78%, rgba(12,55,89,.22) 100%)',
          WebkitMaskImage: `url("${ball.src}")`,
          maskImage: `url("${ball.src}")`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    </span>
  );
};

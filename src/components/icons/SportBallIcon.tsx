import React from 'react';

export type SportBallType = 'futevolei' | 'volei-praia' | 'beach-tennis';

interface SportBallIconProps {
  sport: SportBallType;
  className?: string;
  size?: number;
}

const BALL_ASSETS: Record<SportBallType, { src: string; alt: string; label: string }> = {
  futevolei: {
    src: '/brand/sports/futevolei.jpg',
    alt: 'Bola Oficial de Futevôlei',
    label: 'Futevôlei',
  },
  'volei-praia': {
    src: '/brand/sports/volei.png',
    alt: 'Bola Oficial de Vôlei de Praia',
    label: 'Vôlei de Praia',
  },
  'beach-tennis': {
    src: '/brand/sports/beach-tennis.png',
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
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] ring-1 ring-white/20 ${className}`}
      style={style}
      title={ball.label}
    >
      <img
        src={ball.src}
        alt={ball.alt}
        className="w-full h-full object-cover rounded-full transform scale-[1.03] transition-transform duration-200"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
};

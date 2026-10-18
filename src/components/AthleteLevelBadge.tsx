import React from 'react';
import { AthleteLevel } from '../types';
import { ATHLETE_LEVEL_LABELS, ATHLETE_LEVEL_WEIGHT } from '../services/rankingValidator';
import { Award, Shield, Star, Trophy, Zap } from 'lucide-react';

interface AthleteLevelBadgeProps {
  level: AthleteLevel;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTierNumber?: boolean;
  points?: number;
}

const LEVEL_STYLES: Record<
  AthleteLevel,
  {
    bg: string;
    text: string;
    border: string;
    tierCode: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  iniciante: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    tierCode: 'Nível I',
    icon: Shield,
  },
  serie_c: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    tierCode: 'Nível II',
    icon: Zap,
  },
  serie_b: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    tierCode: 'Nível III',
    icon: Star,
  },
  serie_a: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-300',
    tierCode: 'Nível IV',
    icon: Award,
  },
  profissional: {
    bg: 'bg-slate-900',
    text: 'text-amber-300',
    border: 'border-slate-800',
    tierCode: 'Elite V',
    icon: Trophy,
  },
};

export const AthleteLevelBadge: React.FC<AthleteLevelBadgeProps> = ({
  level,
  size = 'sm',
  showIcon = true,
  showTierNumber = false,
  points,
}) => {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.iniciante;
  const Icon = style.icon;
  const label = ATHLETE_LEVEL_LABELS[level] || 'Iniciante';

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1 rounded',
    sm: 'px-2 py-0.5 text-[11px] gap-1 rounded-md',
    md: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',
    lg: 'px-3.5 py-1.5 text-sm gap-2 rounded-xl',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold border ${style.bg} ${style.text} ${style.border} ${sizeClasses} whitespace-nowrap shrink-0 select-none`}
      title={`Categoria Oficial: ${label} (Peso Técnico ${ATHLETE_LEVEL_WEIGHT[level]})`}
    >
      {showIcon && <Icon className={`${iconSizes} shrink-0`} />}
      <span>{label}</span>
      {showTierNumber && <span className="opacity-70 font-normal">· {style.tierCode}</span>}
      {points !== undefined && <span className="font-mono opacity-85">({points} pts)</span>}
    </span>
  );
};

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
    tierCode: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  iniciante: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    tierCode: 'Nível I',
    icon: Shield,
  },
  serie_c: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    tierCode: 'Nível II',
    icon: Zap,
  },
  serie_b: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    tierCode: 'Nível III',
    icon: Star,
  },
  serie_a: {
    bg: 'bg-[#0987CE]/20',
    text: 'text-[#5BC3FA]',
    tierCode: 'Nível IV',
    icon: Award,
  },
  profissional: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
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
    sm: 'px-2 py-0.5 text-[11px] gap-1 rounded',
    md: 'px-2.5 py-1 text-xs gap-1.5 rounded',
    lg: 'px-3 py-1 text-sm gap-2 rounded-md',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold ${style.bg} ${style.text} ${sizeClasses} whitespace-nowrap shrink-0 select-none`}
      title={`Categoria Oficial: ${label} (Peso Técnico ${ATHLETE_LEVEL_WEIGHT[level]})`}
    >
      {showIcon && <Icon className={`${iconSizes} shrink-0`} />}
      <span>{label}</span>
      {showTierNumber && <span className="opacity-75 font-normal">· {style.tierCode}</span>}
      {points !== undefined && <span className="font-semibold opacity-90">({points} pts)</span>}
    </span>
  );
};


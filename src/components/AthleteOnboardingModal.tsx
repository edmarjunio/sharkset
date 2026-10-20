import React, { useState } from 'react';
import { AthleteLevel } from '../types';
import { ATHLETE_TIERS } from '../services/rankingValidator';
import { SharksetLogo } from './SharksetLogo';
import { Shield, Zap, Star, Award, Trophy, CheckCircle, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  playerName: string;
  onComplete: (level: AthleteLevel) => void;
}

const LEVEL_ICONS: Record<AthleteLevel, React.FC<{ className?: string }>> = {
  iniciante: Shield,
  serie_c: Zap,
  serie_b: Star,
  serie_a: Award,
  profissional: Trophy,
};

export const AthleteOnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  playerName,
  onComplete,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<AthleteLevel>('iniciante');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(selectedLevel);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="aquarium-glass bg-[#030E1F]/98 border-2 border-[#12C7BB]/60 text-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2 border-b border-white/10 pb-4">
          <SharksetLogo size="sm" showText />
          <h2 id="onboarding-title" className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
            Defina sua Categoria Inicial
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md">
            Olá, <strong className="text-cyan-300">{playerName || 'Atleta'}</strong>! Para entrar no{' '}
            <strong>Ranking Oficial SHARKSET</strong> e disputar partidas nas arenas, selecione seu nível técnico inicial:
          </p>
        </div>

        {/* Options */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2.5">
            {ATHLETE_TIERS.map((tier) => {
              const Icon = LEVEL_ICONS[tier.level];
              const isSelected = selectedLevel === tier.level;

              return (
                <button
                  key={tier.level}
                  type="button"
                  onClick={() => setSelectedLevel(tier.level)}
                  className={`w-full p-3.5 rounded-2xl text-left transition-all cursor-pointer flex items-center gap-3.5 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#0987CE]/30 via-[#12C7BB]/20 to-transparent border-[#12C7BB] shadow-[0_0_20px_rgba(18,199,187,0.35)] scale-[1.01]'
                      : 'bg-slate-900/80 border-slate-700 hover:border-slate-500 hover:bg-slate-800/80'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                      isSelected
                        ? 'bg-[#12C7BB] text-[#030E1F] font-black'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm sm:text-base font-extrabold text-white block">
                        {tier.label}
                      </strong>
                      <span className="text-[11px] font-mono text-cyan-300 font-bold shrink-0">
                        {tier.minPoints} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{tier.description}</p>
                  </div>
                  {isSelected && <CheckCircle className="w-5 h-5 text-[#12C7BB] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-amber-300 font-semibold">
              🔒 Escolha única no cadastro: após confirmar, a categoria não poderá ser alterada manualmente e subirá por pontuação (MMR).
            </span>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:from-[#0878b8] hover:to-[#0ea89e] text-[#030E1F] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(9,135,206,0.4)] active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <span>Confirmar Categoria</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { closeOnBackdrop } from '../utils/dialog';
import { AthleteLevel } from '../types';
import { ATHLETE_TIERS } from '../services/rankingValidator';
import { SharksetLogo } from './SharksetLogo';
import { Shield, Zap, Star, Award, Trophy, CheckCircle, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  playerName: string;
  onComplete: (level: AthleteLevel) => void;
  onClose: () => void;
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
  onClose,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<AthleteLevel>('iniciante');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(selectedLevel);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={(event) => closeOnBackdrop(event, onClose)}
    >
      <div className="aquarium-glass bg-[#030E1F]/98 border-2 border-[#12C7BB]/60 text-white rounded-3xl max-w-xl w-full shadow-2xl my-auto max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5">
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
        <form id="athlete-category-form" onSubmit={handleSubmit} className="space-y-4">
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

        </form>
        </div>
          <div className="onboarding-confirm-panel">
            <span className="onboarding-selected-category text-sm text-white font-bold">
              Categoria selecionada: {ATHLETE_TIERS.find(tier => tier.level === selectedLevel)?.label}
            </span>
            <div className="onboarding-rules-card w-full rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs p-4 space-y-2 shadow-inner">
              <div className="flex items-center justify-center gap-1.5 font-black text-amber-300">
                <span>🔒 Escolha única de categoria:</span>
              </div>
              <p className="mx-auto max-w-2xl text-center text-[11px] text-slate-100 leading-relaxed">
                Você <strong>só poderá escolher sua categoria esta única vez</strong> no cadastro. Após confirmar, não será mais possível alterá-la manualmente; sua evolução ocorrerá exclusivamente por pontuação (MMR) conquistada nas partidas do app.
              </p>
              <div className="onboarding-rules-notices mt-2 pt-3 border-t border-amber-500/20 text-[10px] text-amber-100 leading-relaxed grid gap-2">
                <p>⚠️ <strong>Regra de Inatividade:</strong> Se ficar <strong>30 dias sem pontuar</strong>, você será desclassificado do ranking. Quanto mais tempo sem jogar, mais pontos você perde!</p>
                <p>🚨 <strong>Integridade Competitiva:</strong> Os outros atletas podem te denunciar caso seu nível no ranking não seja o mesmo citado. Fique atento com isso!</p>
              </div>
            </div>
            <button
              type="submit"
              form="athlete-category-form"
              className="onboarding-confirm-button"
            >
              <span>Confirmar Categoria</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
      </div>
    </div>
  );
};

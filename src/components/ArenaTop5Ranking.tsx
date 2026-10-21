import React, { useMemo } from 'react';
import { Crown, Trophy, ArrowRight, Star, Award, TrendingUp } from 'lucide-react';
import { AthleteProfile, TenantConfig } from '../types';
import { AthleteLevelBadge } from './AthleteLevelBadge';

interface Props {
  arena: TenantConfig;
  athletes: AthleteProfile[];
  onViewFullRanking: () => void;
}

export const ArenaTop5Ranking: React.FC<Props> = ({
  arena,
  athletes,
  onViewFullRanking,
}) => {
  const top5 = useMemo(() => {
    const list = athletes.filter(
      (a) =>
        a.arenaId === arena.id ||
        (a.city && arena.city && a.city.toLowerCase() === arena.city.toLowerCase()) ||
        !a.arenaId
    );
    return [...list].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5);
  }, [athletes, arena.id, arena.city]);

  if (top5.length === 0) return null;

  const numberOne = top5[0];
  const runnersUp = top5.slice(1, 5);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#05182C] via-[#041224] to-[#020b17] border border-cyan-800/60 shadow-xl text-white space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black shadow-lg">
            <Crown size={22} className="text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              Quadro de Honra Oficial
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Top 5 Ranking da Arena {arena.name}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewFullRanking}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Ver Ranking Completo</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* NUMBER ONE ATHLETE (Rei / Rainha da Quadra) com super ênfase visual dourada */}
        {numberOne && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/25 via-[#081e36] to-[#040e1c] border-2 border-amber-400/90 shadow-2xl flex flex-col justify-between gap-3 relative overflow-hidden group">
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-md">
              <Crown size={12} />
              <span>Rei da Quadra #1</span>
            </div>

            <div className="flex items-center gap-3.5 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center border-2 border-white shadow-lg shrink-0">
                🥇
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  Líder Absoluto
                </span>
                <h4 className="text-base font-black text-white truncate group-hover:text-amber-300 transition-colors">
                  {numberOne.name}
                </h4>
                <div className="mt-1">
                  <AthleteLevelBadge level={numberOne.level} size="sm" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-amber-500/30 text-xs">
              <span className="text-slate-300 font-semibold">Pontuação Oficial:</span>
              <span className="font-mono font-black text-lg text-amber-300">
                {numberOne.points || 0} pts
              </span>
            </div>
          </div>
        )}

        {/* Positions #2 to #5 */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {runnersUp.map((athlete, idx) => {
            const rankPos = idx + 2;
            const rankBadgeColor =
              rankPos === 2
                ? 'bg-slate-300 text-slate-950'
                : rankPos === 3
                ? 'bg-amber-700 text-white'
                : 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/60';

            return (
              <div
                key={athlete.id}
                className="p-3.5 rounded-2xl bg-[#031326] border border-cyan-800/60 hover:border-cyan-500/50 transition-all flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${rankBadgeColor}`}
                  >
                    #{rankPos}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white text-xs block truncate">
                      {athlete.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {athlete.city || arena.city}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-cyan-300 text-xs block">
                    {athlete.points || 0} pts
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400">
                    Nível {athlete.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

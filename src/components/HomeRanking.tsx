import { Trophy, ArrowUpRight, MapPin, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRankingAthletes } from '../hooks/useRankingAthletes';
import { ATHLETE_LEVEL_LABELS, filterAndRankAthletesByScope, formatSharksetSince } from '../services/rankingValidator';

export function HomeRanking() {
  const { setActiveTab } = useApp();
  const { sourceAthletes, isLoading } = useRankingAthletes();
  const leaders = filterAndRankAthletesByScope(sourceAthletes, { scope: 'geral' }).slice(0, 5);
  return (
    <section aria-labelledby="home-ranking-title" className="aquarium-glass rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <h2 id="home-ranking-title" className="font-extrabold text-base flex items-center gap-2 text-white">
          <Trophy size={18} className="text-amber-400" />
          <span>Top 5 do ranking</span>
        </h2>
        <button
          onClick={() => setActiveTab('ranking_athletes')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <span>Ver ranking</span>
          <ArrowUpRight size={15} />
        </button>
      </div>
      {isLoading ? (
        <p role="status" className="p-4 text-sm text-slate-400">Carregando ranking…</p>
      ) : leaders.length ? (
        <ol className="grid divide-y divide-white/10 lg:grid-cols-5 lg:divide-y-0 lg:divide-x">
          {leaders.map((athlete, index) => {
            const matches = athlete.matchesPlayed || 0;
            const wins = athlete.wins || 0;
            const losses = Math.max(0, matches - wins);
            const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
            const cityUf = `${(athlete.city || 'Mineiros').split(' - ')[0]} - ${athlete.state || 'GO'}`;
            return (
              <li key={athlete.id} className="flex items-start gap-3 px-4 py-4 min-w-0">
                <span className={`text-lg font-black tabular-nums mt-0.5 ${index === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {index + 1}º
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <strong className="block truncate text-sm text-white" title={athlete.name}>
                    {athlete.name}
                  </strong>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-cyan-300">
                      {ATHLETE_LEVEL_LABELS[athlete.level]}
                    </span>
                    <span className="text-[11px] text-slate-400">· {cityUf}</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    <span className="text-emerald-400 font-bold">{wins}V</span> -{' '}
                    <span className="text-rose-400 font-bold">{losses}D</span> ({winRate}%)
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar size={11} className="text-cyan-400 shrink-0" />
                    <span>Desde {formatSharksetSince(athlete.createdAt)}</span>
                  </div>
                  <div className="pt-0.5">
                    <span className="text-sm font-black text-amber-400 tabular-nums">
                      {(athlete.points || 0).toLocaleString('pt-BR')}{' '}
                      <span className="text-xs font-normal text-slate-400">pts</span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="p-4 text-sm text-slate-400">Nenhum atleta no ranking.</p>
      )}
    </section>
  );
}

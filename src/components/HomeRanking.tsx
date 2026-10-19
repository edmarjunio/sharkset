import { Trophy, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRankingAthletes } from '../hooks/useRankingAthletes';
import { ATHLETE_LEVEL_LABELS, filterAndRankAthletesByScope } from '../services/rankingValidator';

export function HomeRanking() {
  const { setActiveTab } = useApp();
  const { sourceAthletes, isLoading } = useRankingAthletes();
  const leaders = filterAndRankAthletesByScope(sourceAthletes, { scope: 'geral' }).slice(0, 5);
  return <section aria-labelledby="home-ranking-title" className="rounded-2xl border border-slate-700/70 bg-slate-950/75 overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
      <h2 id="home-ranking-title" className="font-bold flex items-center gap-2"><Trophy size={18} className="text-amber-400" />Top 5 do ranking</h2>
      <button onClick={() => setActiveTab('ranking_athletes')} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 py-2">Ver ranking<ArrowUpRight size={15} /></button>
    </div>
    {isLoading ? <p role="status" className="p-4 text-sm text-slate-400">Carregando ranking…</p> : leaders.length ? <ol className="grid divide-y divide-white/10 lg:grid-cols-5 lg:divide-y-0 lg:divide-x">
      {leaders.map((athlete, index) => <li key={athlete.id} className="flex items-center gap-3 px-4 py-4 min-w-0">
        <span className={`text-lg font-bold tabular-nums ${index === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{index + 1}</span>
        <div className="min-w-0 flex-1"><strong className="block truncate text-sm" title={athlete.name}>{athlete.name}</strong><span className="block text-xs text-slate-400">{ATHLETE_LEVEL_LABELS[athlete.level]}</span><span className="text-sm font-bold text-cyan-300 tabular-nums">{(athlete.points || 0).toLocaleString('pt-BR')} <span className="text-xs font-normal">pts</span></span></div>
      </li>)}
    </ol> : <p className="p-4 text-sm text-slate-400">Nenhum atleta no ranking.</p>}
  </section>;
}

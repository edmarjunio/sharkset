import React, { useMemo } from 'react';
import { Trophy, Calendar, ArrowRight } from 'lucide-react';
import { TenantConfig, Tournament } from '../types';
import { TOURNAMENT_CATEGORY_LABELS } from '../services/rankingValidator';

interface Props {
  arena: TenantConfig;
  tournaments: Tournament[];
  onOpenTournament: (tournamentId: string) => void;
  onRegisterTournament?: (tournamentId: string) => void;
}

export const ArenaFeaturedChampionship: React.FC<Props> = ({
  arena,
  tournaments,
  onOpenTournament,
  onRegisterTournament,
}) => {
  const arenaTournaments = useMemo(() => {
    return tournaments.filter((t) => t.tenantId === arena.id);
  }, [tournaments, arena.id]);

  const featured = useMemo(() => {
    if (arenaTournaments.length === 0) return null;
    const nowIso = new Date().toISOString().slice(0, 10);

    // Upcoming tournaments sorted ascending
    const upcoming = arenaTournaments
      .filter((t) => (t.date || '') >= nowIso)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (upcoming.length > 0) {
      return { tournament: upcoming[0], isUpcoming: true };
    }

    // Past tournaments sorted descending
    const past = arenaTournaments
      .filter((t) => (t.date || '') < nowIso)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (past.length > 0) {
      return { tournament: past[0], isUpcoming: false };
    }

    return { tournament: arenaTournaments[0], isUpcoming: false };
  }, [arenaTournaments]);

  if (!featured) return null;

  const { tournament, isUpcoming } = featured;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#071d38] via-[#05182c] to-[#030d1a] border-2 border-amber-400/50 shadow-2xl text-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black shadow-lg">
            <Trophy size={20} className="text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              {isUpcoming ? '🔥 Próximo Campeonato Oficial na Arena' : '🏆 Último Campeonato Realizado na Arena'}
            </span>
            <h3 className="text-base sm:text-xl font-black text-white">
              {tournament.name}
            </h3>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
            isUpcoming
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 animate-pulse'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
          }`}
        >
          {isUpcoming ? 'Inscrições Abertas' : 'Torneio Concluído'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Data</span>
          <span className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
            <Calendar size={13} className="text-cyan-400" />
            {tournament.date ? new Date(`${tournament.date}T12:00:00Z`).toLocaleDateString('pt-BR') : 'A definir'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Categoria</span>
          <span className="font-bold text-sky-300 text-xs mt-0.5">
            {TOURNAMENT_CATEGORY_LABELS[tournament.category] || tournament.category}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Taxa / Dupla</span>
          <span className="font-mono font-bold text-amber-300 text-xs mt-0.5">
            R$ {tournament.registrationFee || 100}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Modalidade</span>
          <span className="font-bold text-emerald-400 text-xs mt-0.5">
            {tournament.sport === 'futevolei' ? '⚽ Futevôlei' : tournament.sport === 'beach_tennis' ? '🎾 Beach Tennis' : '🏐 Vôlei de Praia'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-cyan-900/50">
        <button
          type="button"
          onClick={() => onOpenTournament(tournament.id)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all border border-slate-700 inline-flex items-center gap-1.5"
        >
          <span>Ver Tabela & Chave</span>
          <ArrowRight size={13} />
        </button>

        {isUpcoming && onRegisterTournament && (
          <button
            type="button"
            onClick={() => onRegisterTournament(tournament.id)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 inline-flex items-center gap-1.5"
          >
            <Trophy size={14} />
            <span>Garantir Vaga da Dupla</span>
          </button>
        )}
      </div>
    </div>
  );
};

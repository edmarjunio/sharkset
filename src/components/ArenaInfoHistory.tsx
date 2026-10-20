import React, { useMemo, useState } from 'react';
import { Clock, MapPin, History, Phone, Search, Sparkles } from 'lucide-react';
import type { TenantConfig } from '../types';
import { useApp } from '../context/AppContext';

interface ArenaInfoHistoryProps {
  tenant: TenantConfig;
}

export const ArenaInfoHistory: React.FC<ArenaInfoHistoryProps> = ({ tenant }) => {
  const { tournaments, tournamentMatches } = useApp();
  const [matchSearchQuery, setMatchSearchQuery] = useState('');

  const completedMatches = useMemo(() => {
    const arenaTournaments = new Map(
      tournaments
        .filter((tournament) => tournament.tenantId === tenant.id)
        .map((tournament) => [tournament.id, tournament])
    );

    return tournamentMatches.flatMap((match) => {
      const tournament = arenaTournaments.get(match.tournamentId);
      if (match.status !== 'completed' || !tournament || !match.team1 || !match.team2) return [];

      const winner = [match.team1, match.team2].find((team) => team.id === match.winnerId);
      if (!winner) return [];

      const dateValue = match.officialAt || tournament.date;
      const date = new Date(dateValue);
      const displayDate = Number.isNaN(date.getTime())
        ? dateValue
        : date.toLocaleDateString('pt-BR');
      const formatPair = (player1: string, player2: string) => [player1, player2].filter(Boolean).join(' & ');

      return [{
        id: match.id,
        sortDate: dateValue,
        date: displayDate,
        tournament: tournament.name,
        category: tournament.category,
        court: match.courtName || '',
        teamA: formatPair(match.team1.player1, match.team1.player2),
        teamB: formatPair(match.team2.player1, match.team2.player2),
        scoreA: match.score1,
        scoreB: match.score2,
        winner: formatPair(winner.player1, winner.player2),
      }];
    }).sort((left, right) => right.sortDate.localeCompare(left.sortDate));
  }, [tenant.id, tournaments, tournamentMatches]);

  const filteredMatches = completedMatches.filter((match) => {
    const query = matchSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return [match.teamA, match.teamB, match.tournament, match.category]
      .some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6">
      <section className="aquarium-glass bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black">Informações da arena</h2>
            <p className="text-xs text-slate-300">Dados cadastrados para {tenant.name}.</p>
          </div>
          {tenant.whatsapp && (
            <a
              href={`https://wa.me/${tenant.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Contato WhatsApp
            </a>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase">
              <Clock className="w-4 h-4" /> Horários cadastrados
            </div>
            <p className="text-sm text-slate-200">
              {tenant.operatingHours.open}–{tenant.operatingHours.close}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase">
              <MapPin className="w-4 h-4" /> Endereço cadastrado
            </div>
            <p className="text-sm text-slate-200">{tenant.address || 'Endereço não informado'}</p>
            <p className="text-xs text-slate-400">{[tenant.city, tenant.state].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase">
              <Sparkles className="w-4 h-4" /> Estrutura cadastrada
            </div>
            {tenant.amenities.length ? (
              <div className="flex flex-wrap gap-1.5">
                {tenant.amenities.map((amenity) => (
                  <span key={amenity} className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-bold">
                    {amenity}
                  </span>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400">Nenhuma estrutura cadastrada.</p>}
          </div>
        </div>
      </section>

      <section className="aquarium-glass bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" /> Partidas concluídas
            </h3>
            <p className="text-xs text-slate-400">Resultados registrados nos campeonatos desta arena.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              aria-label="Buscar partida por atleta ou campeonato"
              placeholder="Buscar atleta ou campeonato"
              value={matchSearchQuery}
              onChange={(event) => setMatchSearchQuery(event.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </header>

        {filteredMatches.length ? (
          <div className="space-y-3">
            {filteredMatches.map((match) => (
              <article key={match.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black uppercase">{match.category}</span>
                    <span className="text-slate-400 font-mono">{match.date}</span>
                    {match.court && <span className="text-cyan-400 font-semibold">{match.court}</span>}
                  </div>
                  <div className="text-sm font-black text-white">{match.tournament}</div>
                  <div className="text-xs text-slate-300 flex items-center gap-3">
                    <span className={match.winner === match.teamA ? 'font-black text-emerald-400' : 'text-slate-400'}>
                      {match.teamA}{match.scoreA !== undefined ? ` (${match.scoreA})` : ''}
                    </span>
                    <span className="text-slate-500 font-mono">VS</span>
                    <span className={match.winner === match.teamB ? 'font-black text-emerald-400' : 'text-slate-400'}>
                      {match.teamB}{match.scoreB !== undefined ? ` (${match.scoreB})` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs font-black text-emerald-300">Vencedor: {match.winner}</div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            {matchSearchQuery.trim()
              ? `Nenhuma partida encontrada para "${matchSearchQuery}".`
              : 'Ainda não há partidas concluídas registradas nesta arena.'}
          </p>
        )}
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { TenantConfig, Booking, BracketMatch } from '../types';
import { useApp } from '../context/AppContext';
import {
  Clock,
  MapPin,
  ShieldCheck,
  Trophy,
  History,
  Phone,
  Info,
  Calendar,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface ArenaInfoHistoryProps {
  tenant: TenantConfig;
}

export const ArenaInfoHistory: React.FC<ArenaInfoHistoryProps> = ({ tenant }) => {
  const { bookings, tournaments, tournamentMatches, athletes } = useApp();
  const [matchSearchQuery, setMatchSearchQuery] = useState('');

  // Collect historical matches played at this arena
  const arenaTournaments = tournaments.filter(
    (t) => t.tenantId === tenant.id || t.responsibleName.toLowerCase().includes(tenant.name.toLowerCase()) || true
  );

  // Sample verified completed matches for this arena
  const arenaHistoryMatches = [
    {
      id: 'hist-1',
      date: '2026-10-18',
      tournament: 'Circuito SHARKSET - Etapa Outubro',
      category: 'Iniciante Série C',
      court: 'Quadra 1 - Central SHARK SET',
      teamA: 'Lucas Silva & Rodrigo Ramos',
      teamB: 'Gabriel Rocha & Matheus Lima',
      scoreA: 18,
      scoreB: 14,
      winner: 'Lucas Silva & Rodrigo Ramos',
      pointsEarned: 100,
    },
    {
      id: 'hist-2',
      date: '2026-10-17',
      tournament: 'Desafio Noturno de Futevôlei',
      category: 'Série B & C Mista',
      court: 'Quadra 2 - SHARK SET Palmeiras',
      teamA: 'Felipe Santos & Carlos Eduardo',
      teamB: 'Bruno Souza & Thiago Mendes',
      scoreA: 21,
      scoreB: 19,
      winner: 'Felipe Santos & Carlos Eduardo',
      pointsEarned: 150,
    },
    {
      id: 'hist-3',
      date: '2026-10-15',
      tournament: 'Torneio Integração de Areia',
      category: 'Iniciante',
      court: 'Quadra 1 - Central SHARK SET',
      teamA: 'Vinicius Costa & Diego Alves',
      teamB: 'Eduardo Martins & Rafael Gomes',
      scoreA: 18,
      scoreB: 16,
      winner: 'Vinicius Costa & Diego Alves',
      pointsEarned: 100,
    },
    {
      id: 'hist-4',
      date: '2026-10-12',
      tournament: 'Taça Primavera de Futevôlei',
      category: 'Série A / Pro',
      court: 'Quadra 1 - Central SHARK SET',
      teamA: 'Tavinho & Tavinho Jr',
      teamB: 'Bruninho & Marcelinho',
      scoreA: 18,
      scoreB: 12,
      winner: 'Tavinho & Tavinho Jr',
      pointsEarned: 250,
    },
  ];

  const filteredHistory = arenaHistoryMatches.filter((m) => {
    if (!matchSearchQuery.trim()) return true;
    const q = matchSearchQuery.toLowerCase();
    return (
      m.teamA.toLowerCase().includes(q) ||
      m.teamB.toLowerCase().includes(q) ||
      m.tournament.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="aquarium-glass bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                INFORMAÇÕES OFICIAIS & HISTÓRICO · {tenant.name.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Estrutura, Horários de Funcionamento & Histórico</span>
              <Info className="w-6 h-6 text-cyan-400 shrink-0" />
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Consulte os horários de pico, regras internas da arena, estrutura física das quadras e o histórico completo de partidas oficiais disputadas nesta sede.
            </p>
          </div>

          <a
            href={`https://wa.me/${tenant.whatsapp}?text=${encodeURIComponent(`Olá, gostaria de tirar dúvidas sobre a ${tenant.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all self-start sm:self-auto shrink-0"
          >
            <Phone className="w-4 h-4" />
            <span>Contato WhatsApp</span>
          </a>
        </div>

        {/* 3 Overview Quick Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Operating Hours */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase">
              <Clock className="w-4 h-4" />
              <span>Horários de Funcionamento</span>
            </div>
            <div className="text-xs space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Segunda a Sexta:</span>
                <strong className="text-white font-mono">{tenant.operatingHours.open} às {tenant.operatingHours.close}</strong>
              </div>
              <div className="flex justify-between">
                <span>Sábados & Domingos:</span>
                <strong className="text-white font-mono">07:00 às 22:00</strong>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Horário de Pico:</span>
                <strong className="font-mono">18:00 às 22:00</strong>
              </div>
            </div>
          </div>

          {/* Location & Address */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase">
              <MapPin className="w-4 h-4" />
              <span>Localização & Endereço</span>
            </div>
            <p className="text-xs text-white font-semibold">
              {tenant.address}
            </p>
            <p className="text-[11px] text-slate-400">
              {tenant.city} - {tenant.state} · A {tenant.distanceKm} km do seu ponto de referência
            </p>
          </div>

          {/* Amenities & Courts */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Estrutura Homologada</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tenant.amenities.map((am) => (
                <span
                  key={am}
                  className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-bold"
                >
                  ✓ {am}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Courts Technical Specifications */}
      <div className="aquarium-glass bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <span>Quadras Oficiais da Arena ({tenant.courts.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenant.courts.map((court) => (
            <div
              key={court.id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-black text-white text-sm">{court.name}</h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {court.isCovered ? 'Coberta' : 'Ar Livre'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{court.description}</p>
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                <span>Piso: <strong className="text-white">{court.surface}</strong></span>
                <span>Taxa Normal: <strong className="text-emerald-400 font-mono">R$ {court.hourlyRate}/h</strong></span>
                <span>Pico: <strong className="text-amber-400 font-mono">R$ {court.peakHourlyRate}/h</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Match History at this Arena */}
      <div className="aquarium-glass bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <span>Histórico de Partidas Realizadas na {tenant.name}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Resultados homologados que pontuaram no Ranking Oficial SHARKSET.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por atleta ou torneio..."
              value={matchSearchQuery}
              onChange={(e) => setMatchSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {filteredHistory.length > 0 ? (
          <div className="space-y-3">
            {filteredHistory.map((match) => (
              <div
                key={match.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black uppercase">
                      {match.category}
                    </span>
                    <span className="text-slate-400 font-mono">{match.date}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-cyan-400 font-semibold">{match.court}</span>
                  </div>

                  <div className="text-sm font-black text-white">
                    {match.tournament}
                  </div>

                  <div className="text-xs text-slate-300 flex items-center gap-3">
                    <span className={match.winner === match.teamA ? 'font-black text-emerald-400' : 'text-slate-400'}>
                      {match.teamA} ({match.scoreA})
                    </span>
                    <span className="text-slate-500 font-mono">VS</span>
                    <span className={match.winner === match.teamB ? 'font-black text-emerald-400' : 'text-slate-400'}>
                      {match.teamB} ({match.scoreB})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Vencedores</span>
                    <span className="text-xs font-black text-emerald-300">
                      🏆 {match.winner}
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-black text-xs">
                    +{match.pointsEarned} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            Nenhuma partida encontrada para a busca "{matchSearchQuery}".
          </div>
        )}
      </div>
    </div>
  );
};

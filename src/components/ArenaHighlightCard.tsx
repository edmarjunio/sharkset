import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  TenantConfig,
  Tournament,
  TimeSlot,
  Court,
  AthleteProfile,
  Booking,
  SportType,
} from '../types';
import { ATHLETE_LEVEL_LABELS, TOURNAMENT_CATEGORY_LABELS } from '../services/rankingValidator';
import {
  Trophy,
  Clock,
  Crown,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle2,
  ChevronRight,
  Zap,
  Star,
  MapPin,
  ShieldCheck,
  Filter,
} from 'lucide-react';

interface ArenaHighlightCardProps {
  tenant: TenantConfig;
  upcomingTournaments: Tournament[];
  upcomingAvailableSlots: TimeSlot[];
  arenaAthletes: AthleteProfile[];
  recentBookings: Booking[];
  onBookSlot: (slot: TimeSlot, court: Court) => void;
  onRegisterTournament: (tournId: string) => void;
  onViewAllTournaments: () => void;
  onViewAllSlots: () => void;
  onViewAllRanking: () => void;
}

export const ArenaHighlightCard: React.FC<ArenaHighlightCardProps> = ({
  tenant,
  upcomingTournaments,
  upcomingAvailableSlots,
  arenaAthletes,
  recentBookings,
  onBookSlot,
  onRegisterTournament,
  onViewAllTournaments,
  onViewAllSlots,
  onViewAllRanking,
}) => {
  const { availableTenants, setTenantId, setActiveTab } = useApp();
  const [selectedHourFilter, setSelectedHourFilter] = useState<string>('todos');

  const arenaPalette = tenant.brandPalette;
  const primaryColor = arenaPalette?.primary || '#0987CE';
  const accentColor = arenaPalette?.accent || '#FF6B00';

  // Sort arena athletes by points for Top 3 Podium
  const top3Athletes = [...arenaAthletes]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 3);

  // Available slots filtered by hour if selected
  const filteredSlots = useMemo(() => {
    if (selectedHourFilter === 'todos') {
      return upcomingAvailableSlots.slice(0, 3);
    }
    return upcomingAvailableSlots
      .filter((s) => s.startTime === selectedHourFilter)
      .slice(0, 3);
  }, [upcomingAvailableSlots, selectedHourFilter]);

  // Cross-arena regional tips for the selected hour or general peak hours
  const regionalHourTips = useMemo(() => {
    const targetHour = selectedHourFilter === 'todos' ? '18:00' : selectedHourFilter;
    const tips: {
      arenaId: string;
      arenaName: string;
      distanceKm: number;
      startTime: string;
      endTime: string;
      courtName: string;
      price: number;
      isCurrentArena: boolean;
      court: Court;
    }[] = [];

    // Search through available arenas sorted by distance
    const sortedArenas = [...availableTenants].sort((a, b) => a.distanceKm - b.distanceKm);

    for (const ar of sortedArenas) {
      for (const crt of ar.courts) {
        const hourNum = parseInt(targetHour.split(':')[0], 10) || 18;
        const openNum = parseInt((crt.openTime || '06:00').split(':')[0], 10) || 6;
        const closeNum = parseInt((crt.closeTime || '23:00').split(':')[0], 10) || 23;
        if (hourNum >= openNum && hourNum < closeNum) {
          const isPeak = hourNum >= 18 && hourNum <= 22;
          const price = isPeak ? (crt.peakHourlyRate || crt.hourlyRate) : crt.hourlyRate;
          const endStr = `${String(hourNum + 1).padStart(2, '0')}:00`;

          tips.push({
            arenaId: ar.id,
            arenaName: ar.name,
            distanceKm: ar.distanceKm,
            startTime: targetHour,
            endTime: endStr,
            courtName: crt.name,
            price,
            isCurrentArena: ar.id === tenant.id,
            court: crt,
          });
          break; // 1 tip per arena for variety
        }
      }
    }

    return tips.slice(0, 3);
  }, [availableTenants, selectedHourFilter, tenant.id]);

  // Take active/upcoming tournaments
  const nextTournaments = upcomingTournaments.slice(0, 2);

  // Take the last 4 confirmed bookings for social proof
  const latestBookings = recentBookings
    .filter((b) => b.tenantId === tenant.id || b.courtId.includes(tenant.id) || true)
    .slice(0, 4);

  return (
    <div className="w-full space-y-4">
      {/* =========================================================================
          ARENA EXECUTIVE PULSE — HERO HIGHLIGHT BANNER
          ========================================================================= */}
      <div
        className="aquarium-glass rounded-3xl p-5 sm:p-7 border shadow-xl relative overflow-hidden transition-all"
        style={{
          background: arenaPalette
            ? `linear-gradient(135deg, ${arenaPalette.headerBg}f2 0%, #031427fa 100%)`
            : 'linear-gradient(135deg, rgba(4, 28, 52, 0.94) 0%, rgba(2, 16, 32, 0.98) 100%)',
          borderColor: arenaPalette ? `${primaryColor}66` : 'rgba(56, 189, 248, 0.35)',
        }}
      >
        {/* Subtle Ambient Background Watermark/Glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Header Row of the Highlight Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: accentColor }}
              >
                DESTAQUES & RADAR EM TEMPO REAL · {tenant.name.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Radar da Arena: Campeonatos, Horários & Ranking</span>
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Tudo o que está acontecendo na arena agora: próximos torneios com vagas abertas, horários livres imediatos para jogar hoje, os líderes do ranking da arena e as últimas reservas confirmadas.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 flex items-center gap-2 text-xs">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-slate-300 font-semibold">Quadras:</span>
              <strong className="text-white">{tenant.courts.length} Oficiais</strong>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 flex items-center gap-2 text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-slate-300 font-semibold">Avaliação:</span>
              <strong className="text-amber-300">★ {tenant.rating.toFixed(1)}</strong>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-emerald-300">
                {upcomingAvailableSlots.length} Vagas Hoje
              </strong>
            </div>
          </div>
        </div>

        {/* 4 Interactive Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 pt-5 relative z-10">
          {/* ===================================================================
              CARD 1: PRÓXIMOS CAMPEONATOS DA ARENA
              =================================================================== */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-amber-400/60 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center font-bold">
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block text-amber-400">
                      TORNEIOS ABERTOS
                    </span>
                    <span className="text-xs font-black text-white">Próximos Campeonatos</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {upcomingTournaments.length} Ativos
                </span>
              </div>

              {nextTournaments.length > 0 ? (
                <div className="space-y-2.5">
                  {nextTournaments.map((tourn) => (
                    <div
                      key={tourn.id}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-colors space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <strong className="text-xs font-black text-white leading-tight line-clamp-1">
                          {tourn.name}
                        </strong>
                        <span className="text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                          R$ {tourn.registrationFee}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="text-slate-300 font-semibold">{tourn.date}</span>
                        <span>·</span>
                        <span className="text-sky-300">
                          {TOURNAMENT_CATEGORY_LABELS[tourn.category] || tourn.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRegisterTournament(tourn.id)}
                        className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Inscrever Dupla</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-400">
                  Nenhum torneio agendado no momento. Crie um novo torneio na aba de Gestão!
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onViewAllTournaments}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <span>Ver Todos Campeonatos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ===================================================================
              CARD 2: HORÁRIOS LIVRES CHAMATIVOS + FILTRO ESPECÍFICO + TIPS
              =================================================================== */}
          <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-cyan-400/60 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block text-cyan-400">
                      HORÁRIOS CHAMATIVOS LIVRES
                    </span>
                    <span className="text-xs font-black text-white">Jogar Hoje na Região</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ao Vivo
                </span>
              </div>

              {/* Opção de filtrar um horário específico */}
              <div className="space-y-1.5 pt-1 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="font-bold flex items-center gap-1 text-cyan-300">
                    <Filter className="w-3 h-3" />
                    Filtrar Horário Específico:
                  </span>
                  {selectedHourFilter !== 'todos' && (
                    <button
                      type="button"
                      onClick={() => setSelectedHourFilter('todos')}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold cursor-pointer"
                    >
                      Limpar ({selectedHourFilter})
                    </button>
                  )}
                </div>

                {/* Quick hour selector chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'todos', label: 'Agora' },
                    { id: '07:00', label: '07h' },
                    { id: '08:00', label: '08h' },
                    { id: '17:00', label: '17h' },
                    { id: '18:00', label: '18h' },
                    { id: '19:00', label: '19h' },
                    { id: '20:00', label: '20h' },
                    { id: '21:00', label: '21h' },
                  ].map((h) => {
                    const isSelected = selectedHourFilter === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHourFilter(h.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all shrink-0 ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-xs'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tips com informação básica: Qual arena tem, Quantos km de mim ela está, Qual valor */}
              <div className="space-y-2 pt-1">
                {regionalHourTips.map((tip) => {
                  return (
                    <div
                      key={`${tip.arenaId}-${tip.startTime}`}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all space-y-1.5"
                    >
                      {/* Top: Qual Arena & Quantos Km */}
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-black text-white truncate flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="truncate">{tip.arenaName}</span>
                          {tip.isCurrentArena && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                              Esta Arena
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3" />
                          {tip.distanceKm.toFixed(1)} km de você
                        </span>
                      </div>

                      {/* Bottom: Horário, Qual Valor e Ação Reservar */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-cyan-300">
                            {tip.startTime}
                          </span>
                          <span className="font-black text-xs text-emerald-400">
                            R$ {tip.price}/h
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (tip.isCurrentArena) {
                              const matchSlot = upcomingAvailableSlots.find(
                                (s) => s.startTime === tip.startTime
                              ) || {
                                id: `slot-${tip.court.id}-${tip.startTime}`,
                                courtId: tip.court.id,
                                date: new Date().toISOString().split('T')[0],
                                startTime: tip.startTime,
                                endTime: tip.endTime,
                                price: tip.price,
                                isAvailable: true,
                              };
                              onBookSlot(matchSlot as any, tip.court);
                            } else {
                              setTenantId(tip.arenaId);
                              setActiveTab('scheduler');
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold text-[10px] shrink-0 shadow-xs transition-colors cursor-pointer"
                        >
                          {tip.isCurrentArena ? 'Reservar' : 'Ver Arena'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onViewAllSlots}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <span>Abrir Grade Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ===================================================================
              CARD 3: RANKING DA ARENA (TOP 3 ATLETAS)
              =================================================================== */}
          <div className="bg-slate-950/70 border border-sky-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-sky-400/60 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center font-bold">
                    <Crown className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block text-sky-400">
                      CIRCUITO DA ARENA
                    </span>
                    <span className="text-xs font-black text-white">Líderes do Ranking</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Podium
                </span>
              </div>

              {top3Athletes.length > 0 ? (
                <div className="space-y-2">
                  {top3Athletes.map((ath, idx) => {
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const isThird = idx === 2;

                    return (
                      <div
                        key={ath.id}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 border transition-colors ${
                          isFirst
                            ? 'bg-amber-500/15 border-amber-400/50'
                            : isSecond
                            ? 'bg-slate-300/10 border-slate-300/30'
                            : 'bg-orange-500/10 border-orange-400/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-black w-6 text-center shrink-0">
                            {isFirst ? '🥇' : isSecond ? '🥈' : '🥉'}
                          </span>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-white block truncate">
                              {ath.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {ATHLETE_LEVEL_LABELS[ath.level]}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-sky-300 block">
                            {ath.points || 0} pts
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {ath.wins || 0}V
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-400">
                  Ainda sem partidas oficiais registradas nesta arena. Seja o primeiro!
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onViewAllRanking}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <span>Ver Ranking Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ===================================================================
              CARD 4: ÚLTIMOS CLIENTES & RESERVAS CONFIRMADAS
              =================================================================== */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-emerald-400/60 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block text-emerald-400">
                      COMUNIDADE & ATIVIDADE
                    </span>
                    <span className="text-xs font-black text-white">Últimos Clientes</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ao Vivo
                </span>
              </div>

              {latestBookings.length > 0 ? (
                <div className="space-y-2">
                  {latestBookings.map((bk, i) => {
                    const initials = bk.customerName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={bk.id || i}
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-black flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-white block truncate">
                              {bk.customerName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {bk.courtName?.split(' - ')[0] || 'Quadra'} · {bk.startTime}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold text-[9px] uppercase shrink-0 border border-emerald-500/20">
                          Confirmado
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-400">
                  Agenda aberta para as próximas reservas!
                </div>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Reserva com confirmação Pix instantânea
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

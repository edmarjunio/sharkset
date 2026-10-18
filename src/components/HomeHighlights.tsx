import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TOURNAMENT_CATEGORY_LABELS } from '../services/rankingValidator';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
import { SharksetLogo } from './SharksetLogo';
import { MostWatchedGamesMiniRail } from './MostWatchedGamesMiniRail';
import {
  Flame,
  Trophy,
  Calendar,
  GraduationCap,
  MapPin,
  ArrowRight,
  Zap,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  Play,
} from 'lucide-react';

export const HomeHighlights: React.FC = () => {
  const {
    tenant,
    availableTenants,
    setTenantId,
    slots,
    tournaments,
    registeredPairs,
    setActiveTournamentId,
    setActiveTab,
    setArenaSubTab,
  } = useApp();

  // 1. Free Peak Hours across current arena (18:00 - 22:00 available slots)
  const freePeakSlots = useMemo(() => {
    return slots
      .filter((s) => s.isAvailable && (s.isPeakHour || parseInt(s.startTime.split(':')[0], 10) >= 18))
      .slice(0, 6);
  }, [slots]);

  // 2. Classes with Open Spots across all regional arenas
  const openClassesHighlight = useMemo(() => {
    const list: Array<{
      arenaId: string;
      arenaName: string;
      city: string;
      courtName: string;
      classTitle: string;
      coachName: string;
      daysLabel: string;
      timeLabel: string;
      spotsLeft: number;
      monthlyPrice: number;
    }> = [];

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    availableTenants.forEach((ar) => {
      ar.courts.forEach((court) => {
        (court.classSchedules || []).forEach((cls) => {
          const rawDays = Array.isArray(cls.daysOfWeek) ? cls.daysOfWeek : [2, 4];
          const daysStr = rawDays
            .map((d) => {
              const num = Number(d);
              if (!Number.isNaN(num) && dayNames[num]) return dayNames[num];
              return String(d ?? '').toUpperCase();
            })
            .join(' e ');
          list.push({
            arenaId: ar.id,
            arenaName: ar.name,
            city: ar.city,
            courtName: court.name,
            classTitle: cls.title,
            coachName: cls.coachName,
            daysLabel: daysStr,
            timeLabel: `${cls.startTime} às ${cls.endTime}`,
            spotsLeft: Math.max(2, cls.maxStudents - 7),
            monthlyPrice: cls.monthlyPrice,
          });
        });
      });
    });

    return list.slice(0, 4);
  }, [availableTenants]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-slate-900">
      {/* MINIATURE MOST-WATCHED LIVE GAMES + BROADCAST STUDIO LAUNCHER */}
      <MostWatchedGamesMiniRail />

      {/* =================================================================== */}
      {/* BRAND HERO BANNER: (Matching Brand Manual Slide 9: "A quadra é sua")*/}
      {/* =================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0B254E] border-2 border-[#145A9B] p-6 sm:p-10 shadow-2xl">
        {/* Ambient Wave Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0987CE]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#12C7BB]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0987CE]/20 text-[#0987CE] border border-[#0987CE]/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              SUA PRÓXIMA PARTIDA COMEÇA AQUI
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              A quadra é sua.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Agende, participe e acompanhe sua jornada no futevôlei. Chaveamento oficial com <strong>Infinity Scroll</strong>, súmula de árbitro e ranking regional por categoria.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={() => {
                  setArenaSubTab('agenda');
                  setActiveTab('scheduler');
                }}
                className="px-6 py-3 rounded-2xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#0987CE]/30 transition-all cursor-pointer flex items-center gap-2"
              >
                Explorar Agendamentos
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('tournaments')}
                className="aquarium-glass px-5 py-3 rounded-2xl bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <Trophy className="w-4 h-4 text-[#0987CE]" />
                Ver Torneios & Tabela
              </button>
              <button
                onClick={() => setActiveTab('ranking_athletes')}
                className="aquarium-glass px-5 py-3 rounded-2xl bg-[#071D3D] hover:bg-[#0B254E] border border-[#12C7BB]/40 text-[#12C7BB] font-extrabold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                Ranking Board
              </button>
              <button
                onClick={() => setActiveTab('shark_academy')}
                className="px-5 py-3 rounded-2xl bg-[#12C7BB] hover:bg-[#0ea89e] text-slate-950 font-black text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-md shadow-[#12C7BB]/20"
              >
                <GraduationCap className="w-4 h-4 text-slate-950" />
                Shark Academy & Comunidade (Tática + IA)
              </button>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center">
            <SharksetLogo size="2xl" />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BLOCO 1: 4 CARDS CHAMATIVOS DE CONVERSÃO RÁPIDA (SEM POLUIÇÃO)      */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Horários de Pico Livres */}
        <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#12C7BB]/20 text-[#12C7BB] font-black text-[10px] uppercase">
                HORÁRIOS DE PICO LIVRES HOJE
              </span>
              <Flame className="w-4 h-4 text-[#12C7BB]" />
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              {freePeakSlots.length} Quadras Vagas no Horário Nobre (18h às 22h)
            </h2>
            <p className="text-xs text-slate-300">
              Agende e pague no PIX em <strong>2 cliques</strong> na {tenant.name}.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {freePeakSlots.slice(0, 4).map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => {
                    setArenaSubTab('agenda');
                    setActiveTab('scheduler');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#12C7BB] font-mono font-black text-xs cursor-pointer transition-colors"
                >
                  ⚡ {slot.startTime} · R$ {slot.price}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setArenaSubTab('agenda');
              setActiveTab('scheduler');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#12C7BB] hover:bg-[#0ea89e] text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            Reservar Horário em 2 Cliques
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Torneios Próximos & Tabela Oficial */}
        <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#0987CE]/20 text-[#0987CE] font-black text-[10px] uppercase">
                TORNEIOS PRÓXIMOS & TABELA
              </span>
              <Trophy className="w-4 h-4 text-[#0987CE]" />
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              {tournaments[0]?.name || 'Copa Regional Shark Set'}
            </h2>
            <p className="text-xs text-slate-300">
              Chaveamento oficial com <strong>Infinity Scroll</strong>, placar ao vivo e súmula do árbitro.
            </p>

            <div className="space-y-1.5 pt-1">
              {tournaments.slice(0, 2).map((t) => {
                const count = registeredPairs.filter(
                  (p) => p.tournamentId === t.id && p.enrollmentStatus !== 'rejected'
                ).length;
                return (
                  <div
                    key={t.id}
                    className="px-2.5 py-1.5 rounded-xl bg-[#030B17] border border-[#145A9B] flex items-center justify-between text-[11px]"
                  >
                    <span className="font-bold text-slate-200 truncate pr-2">{t.name}</span>
                    <span className="font-mono font-black text-[#0987CE] shrink-0">
                      {count}/{t.maxPairs} duplas
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('tournaments')}
              className="py-2.5 px-3 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1 shadow-md"
            >
              <Trophy className="w-3.5 h-3.5" />
              Ver Tabela
            </button>
            <button
              onClick={() => setActiveTab('ranking_athletes')}
              className="py-2.5 px-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] text-[#12C7BB] border border-[#12C7BB]/40 font-black text-xs cursor-pointer flex items-center justify-center gap-1"
            >
              Ranking →
            </button>
          </div>
        </div>

        {/* Card 3: Aulas com Vagas na Região */}
        <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#0987CE]/20 text-[#0987CE] font-black text-[10px] uppercase">
                AULAS COM VAGA NA REGIÃO
              </span>
              <GraduationCap className="w-4 h-4 text-[#0987CE]" />
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              Turmas de Futevôlei & Beach Tennis
            </h2>
            <p className="text-xs text-slate-300">
              Filtre por dias (ex: <strong>Terça e Quinta 07h às 08h</strong>) e matricule-se na hora.
            </p>

            <div className="space-y-1.5 pt-1">
              {openClassesHighlight.slice(0, 2).map((item, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded-xl bg-[#030B17] border border-[#145A9B] flex items-center justify-between text-[11px]"
                >
                  <span className="font-bold text-slate-200 truncate pr-2">
                    {item.daysLabel} · {item.timeLabel}
                  </span>
                  <span className="font-mono font-black text-[#12C7BB] shrink-0">
                    {item.spotsLeft} vagas
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setArenaSubTab('aulas');
              setActiveTab('scheduler');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Ver Turmas & Mensalidades
          </button>
        </div>

        {/* Card 4: Conversão SaaS (R$ 20 Tabela / R$ 99 Arena) */}
        <div className="bg-gradient-to-br from-[#0B254E] via-[#071D3D] to-[#030B17] text-white border-2 border-[#12C7BB] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#12C7BB] text-slate-950 font-black text-[10px] uppercase">
                PARA ARENAS & ORGANIZADORES
              </span>
              <Zap className="w-4 h-4 text-[#12C7BB]" />
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              Tabela Oficial R$ 20 ou Sistema Arena R$ 99/mês
            </h2>
            <p className="text-xs text-slate-300">
              Automatize campeonatos, agendamentos em 2 cliques e cobrança de mensalidades no WhatsApp 2 dias antes do vencimento.
            </p>

            <div className="space-y-1 text-[11px] text-[#12C7BB] font-bold pt-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Acesso avulso à Tabela: R$ 20 / torneio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Plano Arena Completo: R$ 99 / mês</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('saas_hub')}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Contratar Tabela ou Arena
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BLOCO 2: BUSCA REGIONAL DE AULAS E QUADRAS ("TERÇA E QUINTA 7 ÀS 8") */}
      {/* =================================================================== */}
      <RegionalAvailabilityFinder />

      {/* =================================================================== */}
      {/* BLOCO 3: VITRINE RÁPIDA DAS ARENAS COM FOTO DE CAPA E 2 CLIQUES     */}
      {/* =================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0987CE] block">
              RESERVA RÁPIDA EM POUCOS CLIQUES
            </span>
            <h2 className="text-xl font-black text-white">
              Arenas Parceiras com Horários de Pico Livres
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('arenas_directory')}
            className="px-4 py-2 rounded-xl bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] text-white font-black text-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            Ver Todas as Arenas ({availableTenants.length})
            <ArrowRight className="w-3.5 h-3.5 text-[#0987CE]" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {availableTenants.map((ar) => {
            const minPrice = Math.min(...ar.courts.map((c) => c.hourlyRate || 80));
            return (
              <div
                key={ar.id}
                className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] hover:border-[#0987CE] rounded-3xl overflow-hidden shadow-xl transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-44 bg-[#030B17] overflow-hidden">
                    <img
                      src={
                        ar.imageUrl ||
                        'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&auto=format&fit=crop&q=80'
                      }
                      alt={ar.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030B17] via-[#071D3D]/30 to-transparent" />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-[#12C7BB] text-slate-950 font-black text-[10px] uppercase">
                        ● Horários Livres Hoje
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#030B17]/90 text-[#12C7BB] font-mono font-bold text-xs">
                        ★ {ar.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-base font-black leading-tight">{ar.name}</h3>
                      <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#0987CE] shrink-0" />
                        {ar.city}/{ar.state} · {ar.courts.length} quadras
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {ar.operatingHours.open} às {ar.operatingHours.close}
                      </span>
                      <span className="font-mono font-black text-[#12C7BB] text-sm">
                        A partir de R$ {minPrice}/h
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex gap-2">
                  <button
                    onClick={() => {
                      setTenantId(ar.id);
                      setArenaSubTab('agenda');
                      setActiveTab('scheduler');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs cursor-pointer text-center transition-colors shadow-md"
                  >
                    Agendar & Pagar (2 Cliques)
                  </button>
                  <button
                    onClick={() => {
                      setTenantId(ar.id);
                      setArenaSubTab('aulas');
                      setActiveTab('scheduler');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    Aulas
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

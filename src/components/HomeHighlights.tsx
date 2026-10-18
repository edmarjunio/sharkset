import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TOURNAMENT_CATEGORY_LABELS } from '../services/rankingValidator';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
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

    availableTenants.forEach((ar) => {
      ar.courts.forEach((court) => {
        (court.classSchedules || []).forEach((cls) => {
          const daysStr = (cls.daysOfWeek || ['ter', 'qui'])
            .map((d) => d.toUpperCase())
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* =================================================================== */}
      {/* BLOCO 1: 4 CARDS CHAMATIVOS DE CONVERSÃO RÁPIDA (SEM POLUIÇÃO)      */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Horários de Pico Livres */}
        <div className="bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-black text-[10px] uppercase">
                HORÁRIOS DE PICO LIVRES HOJE
              </span>
              <Flame className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-lg font-black text-slate-950 leading-tight">
              {freePeakSlots.length} Quadras Vagas no Horário Nobre (18h às 22h)
            </h2>
            <p className="text-xs text-slate-600">
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
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 font-mono font-black text-xs cursor-pointer transition-colors"
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
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            Reservar Horário em 2 Cliques
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Torneios Próximos & Tabela Oficial */}
        <div className="bg-slate-950 text-white border-2 border-amber-400 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                TORNEIOS PRÓXIMOS & TABELA
              </span>
              <Trophy className="w-4 h-4 text-amber-400" />
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
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-bold text-slate-200 truncate pr-2">{t.name}</span>
                    <span className="font-mono font-black text-amber-400 shrink-0">
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
              className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5" />
              Ver Tabela
            </button>
            <button
              onClick={() => setActiveTab('register_dupla')}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1"
            >
              Inscrever Dupla
            </button>
          </div>
        </div>

        {/* Card 3: Aulas com Vagas na Região */}
        <div className="bg-white border-2 border-indigo-500 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-950 font-black text-[10px] uppercase">
                AULAS COM VAGA NA REGIÃO
              </span>
              <GraduationCap className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-black text-slate-950 leading-tight">
              Turmas de Futevôlei & Beach Tennis Abertas
            </h2>
            <p className="text-xs text-slate-600">
              Filtre por dias (ex: <strong>Terça e Quinta 07h às 08h</strong>) e matricule-se na hora.
            </p>

            <div className="space-y-1.5 pt-1">
              {openClassesHighlight.slice(0, 2).map((item, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-[11px]"
                >
                  <span className="font-bold text-indigo-950 truncate pr-2">
                    {item.daysLabel} · {item.timeLabel}
                  </span>
                  <span className="font-mono font-black text-emerald-700 shrink-0">
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
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Ver Turmas & Mensalidades
          </button>
        </div>

        {/* Card 4: Conversão SaaS (R$ 20 Tabela / R$ 99 Arena) */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white border-2 border-emerald-400 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-black text-[10px] uppercase">
                PARA ARENAS & ORGANIZADORES
              </span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              Tabela Oficial R$ 20 ou Sistema Arena R$ 99/mês
            </h2>
            <p className="text-xs text-slate-300">
              Automatize campeonatos, agendamentos em 2 cliques e cobrança de mensalidades no WhatsApp 2 dias antes do vencimento.
            </p>

            <div className="space-y-1 text-[11px] text-emerald-300 font-bold pt-1">
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
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Contratar Tabela (R$ 20) ou Arena (R$ 99)
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
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">
              RESERVA RÁPIDA EM POUCOS CLIQUES
            </span>
            <h2 className="text-xl font-black text-slate-950">
              Arenas Parceiras com Horários de Pico Livres
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('arenas_directory')}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            Ver Todas as Arenas ({availableTenants.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {availableTenants.map((ar) => {
            const minPrice = Math.min(...ar.courts.map((c) => c.pricePerHour));
            return (
              <div
                key={ar.id}
                className="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl overflow-hidden shadow-xs transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-44 bg-slate-900 overflow-hidden">
                    <img
                      src={
                        ar.imageUrl ||
                        'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&auto=format&fit=crop&q=80'
                      }
                      alt={ar.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-slate-950 font-black text-[10px] uppercase">
                        ● Horários Livres Hoje
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 text-amber-400 font-mono font-bold text-xs">
                        ★ {ar.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-base font-black leading-tight">{ar.name}</h3>
                      <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        {ar.city}/{ar.state} · {ar.courts.length} quadras
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {ar.operatingHours.open} às {ar.operatingHours.close}
                      </span>
                      <span className="font-mono font-black text-slate-950 text-sm">
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
                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer text-center transition-colors"
                  >
                    Agendar & Pagar (2 Cliques)
                  </button>
                  <button
                    onClick={() => {
                      setTenantId(ar.id);
                      setArenaSubTab('aulas');
                      setActiveTab('scheduler');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
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

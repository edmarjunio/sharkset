import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AthleteLevel, ClassScheduleConfig, Court, TenantConfig } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import { WEEKDAY_SHORT_NAMES, WEEKDAY_FULL_NAMES } from '../data/initialData';
import {
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  CheckCircle2,
  Zap,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface RegionalAvailabilityFinderProps {
  compact?: boolean;
}

const TIME_INTERVALS = [
  { start: '06:00', end: '07:00', label: '06:00 às 07:00' },
  { start: '07:00', end: '08:00', label: '07:00 às 08:00' },
  { start: '08:00', end: '09:00', label: '08:00 às 09:00' },
  { start: '17:00', end: '18:00', label: '17:00 às 18:00' },
  { start: '18:00', end: '19:00', label: '18:00 às 19:00 (Pico)' },
  { start: '19:00', end: '20:00', label: '19:00 às 20:00 (Pico)' },
  { start: '20:00', end: '21:00', label: '20:00 às 21:00 (Pico)' },
];

export const RegionalAvailabilityFinder: React.FC<RegionalAvailabilityFinderProps> = ({
  compact = false,
}) => {
  const {
    availableTenants,
    radiusKm,
    userProfile,
    enrollStudentInClass,
    setTenantId,
    setArenaSubTab,
    setActiveTab,
    classStudents,
  } = useApp();

  const [selectedDays, setSelectedDays] = useState<number[]>([2, 4]);
  const [selectedTimeStart, setSelectedTimeStart] = useState<string>('07:00');
  const [levelFilter, setLevelFilter] = useState<AthleteLevel | 'todos'>('iniciante');
  const [viewMode, setViewMode] = useState<'aulas' | 'quadras' | 'ambos'>('ambos');
  const [enrolledSuccessMsg, setEnrolledSuccessMsg] = useState<string | null>(null);

  const toggleDay = (dayIdx: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayIdx)) {
        return prev.length > 1 ? prev.filter((d) => d !== dayIdx) : prev;
      }
      if (prev.length >= 2) {
        return [prev[1], dayIdx].sort((a, b) => a - b);
      }
      return [...prev, dayIdx].sort((a, b) => a - b);
    });
  };

  const applyPreset = (days: number[], start: string, lvl: AthleteLevel | 'todos' = 'todos') => {
    setSelectedDays(days);
    setSelectedTimeStart(start);
    setLevelFilter(lvl);
  };

  const selectedDaysLabel = useMemo(() => {
    return selectedDays
      .map((d) => WEEKDAY_FULL_NAMES[d]?.split('-')[0] || WEEKDAY_SHORT_NAMES[d])
      .join(' e ');
  }, [selectedDays]);

  const selectedIntervalObj = useMemo(() => {
    return (
      TIME_INTERVALS.find((t) => t.start === selectedTimeStart) || {
        start: selectedTimeStart,
        end: `${String(parseInt(selectedTimeStart.split(':')[0], 10) + 1).padStart(2, '0')}:00`,
        label: `${selectedTimeStart} às ${String(parseInt(selectedTimeStart.split(':')[0], 10) + 1).padStart(2, '0')}:00`,
      }
    );
  }, [selectedTimeStart]);

  const regionalResults = useMemo(() => {
    const arenasInRegion = availableTenants.filter((a) => a.distanceKm <= Math.max(radiusKm, 50));

    const matchingClasses: {
      arena: TenantConfig;
      court: Court;
      cls: ClassScheduleConfig;
      spotsLeft: number;
      enrolledTotal: number;
    }[] = [];

    const matchingVacantCourts: {
      arena: TenantConfig;
      court: Court;
      hourlyPrice: number;
      isPeak: boolean;
    }[] = [];

    const targetHour = parseInt(selectedTimeStart.split(':')[0], 10) || 7;

    for (const arena of arenasInRegion) {
      const arenaOpenHour =
        parseInt((arena.operatingHours.open || '06:00').split(':')[0], 10) || 6;
      const arenaCloseHour =
        parseInt((arena.operatingHours.close || '23:00').split(':')[0], 10) || 23;

      if (targetHour < arenaOpenHour || targetHour >= arenaCloseHour) {
        continue;
      }

      for (const court of arena.courts) {
        const courtOpen =
          parseInt((court.openTime || arena.operatingHours.open || '06:00').split(':')[0], 10) ||
          6;
        const courtClose =
          parseInt((court.closeTime || arena.operatingHours.close || '23:00').split(':')[0], 10) ||
          23;
        if (targetHour < courtOpen || targetHour >= courtClose) continue;

        const schedules = court.classSchedules || [];
        let hasClassAtSelectedTimeAndDays = false;

        for (const cls of schedules) {
          const rawDays = Array.isArray(cls.daysOfWeek) ? cls.daysOfWeek : [2, 4];
          const clsDays = rawDays.map((d) => Number(d)).filter((n) => !Number.isNaN(n));
          const matchesDays = selectedDays.some((d) => clsDays.includes(d));
          const matchesTime = cls.startTime === selectedTimeStart;

          if (matchesDays && matchesTime) {
            hasClassAtSelectedTimeAndDays = true;
            const matchesLevel =
              levelFilter === 'todos' ||
              !cls.level ||
              cls.level === 'todos' ||
              cls.level === levelFilter;

            const dynamicEnrolled = classStudents.filter(
              (s) => s.tenantId === arena.id && s.classId === cls.id
            ).length;
            const totalEnrolled = Math.max(cls.enrolledCount || 0, dynamicEnrolled);
            const spotsLeft = Math.max(1, cls.maxStudents - totalEnrolled);

            if (matchesLevel && spotsLeft > 0) {
              matchingClasses.push({
                arena,
                court,
                cls,
                spotsLeft,
                enrolledTotal: totalEnrolled,
              });
            }
          }
        }

        if (!hasClassAtSelectedTimeAndDays) {
          const isPeak = targetHour >= 18 && targetHour < 22;
          const hourlyPrice = isPeak ? court.peakHourlyRate ?? court.hourlyRate : court.hourlyRate;
          matchingVacantCourts.push({
            arena,
            court,
            hourlyPrice,
            isPeak,
          });
        }
      }
    }

    return {
      matchingClasses: matchingClasses.sort((a, b) => a.arena.distanceKm - b.arena.distanceKm),
      matchingVacantCourts: matchingVacantCourts.sort(
        (a, b) => a.arena.distanceKm - b.arena.distanceKm
      ),
    };
  }, [availableTenants, radiusKm, selectedDays, selectedTimeStart, levelFilter, classStudents]);

  const handleQuickEnrollInClass = (arena: TenantConfig, court: Court, cls: ClassScheduleConfig) => {
    setTenantId(arena.id);
    const enrolled = enrollStudentInClass({
      courtId: court.id,
      classConfig: cls,
      studentName: userProfile.name,
      studentPhone: userProfile.phone,
      billingType: 'mensal',
      enrolledByRole: 'aluno',
      enrolledByName: 'Busca Regional por Horário',
    });

    setEnrolledSuccessMsg(
      `Vaga garantida! ${enrolled.studentName} matriculado em "${cls.title}" na ${arena.name} (${selectedDaysLabel} · ${cls.startTime} às ${cls.endTime}). Ciclo mensal iniciado hoje!`
    );
    setTimeout(() => setEnrolledSuccessMsg(null), 5000);
  };

  const handleQuickBookCourt = (arena: TenantConfig) => {
    setTenantId(arena.id);
    setArenaSubTab('agenda');
    setActiveTab('scheduler');
  };

  return (
    <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 text-white">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#145A9B]/60">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-black uppercase tracking-wider text-[#12C7BB]">
              BUSCA INTELIGENTE · MATRÍCULA E AGENDAMENTO NA REGIÃO
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Seu Nível Atual:{' '}
              <strong className="text-white">{ATHLETE_LEVEL_LABELS[userProfile.level]}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Quero Fazer Aula ou Jogar: <span className="text-[#12C7BB]">{selectedDaysLabel}</span>{' '}
            das <span className="text-[#5BC3FA] font-mono">{selectedIntervalObj.label}</span>
          </h2>
          <p className="text-xs text-slate-300">
            Selecione os dias da semana, o horário e seu nível para encontrar turmas com vaga e quadras livres nas arenas da região.
          </p>
        </div>

        {/* 1-Click Popular Search Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset([2, 4], '07:00', 'iniciante')}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
              selectedDays.includes(2) && selectedDays.includes(4) && selectedTimeStart === '07:00'
                ? 'bg-[#0987CE] text-white border-[#0987CE] shadow-xs'
                : 'bg-[#030B17] text-slate-300 border-[#145A9B] hover:bg-[#0B254E]'
            }`}
          >
            ⚡ Terça e Quinta · 07h às 08h (Iniciante)
          </button>
          <button
            type="button"
            onClick={() => applyPreset([2, 4], '18:00', 'todos')}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
              selectedDays.includes(2) && selectedDays.includes(4) && selectedTimeStart === '18:00'
                ? 'bg-[#0987CE] text-white border-[#0987CE] shadow-xs'
                : 'bg-[#030B17] text-slate-300 border-[#145A9B] hover:bg-[#0B254E]'
            }`}
          >
            🔥 Terça e Quinta · 18h às 19h
          </button>
          <button
            type="button"
            onClick={() => applyPreset([1, 3], '19:00', 'todos')}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
              selectedDays.includes(1) && selectedDays.includes(3) && selectedTimeStart === '19:00'
                ? 'bg-[#0987CE] text-white border-[#0987CE] shadow-xs'
                : 'bg-[#030B17] text-slate-300 border-[#145A9B] hover:bg-[#0B254E]'
            }`}
          >
            ⚡ Segunda e Quarta · 19h às 20h
          </button>
        </div>
      </div>

      {enrolledSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950 text-white border border-emerald-500 flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
            <span>{enrolledSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setEnrolledSuccessMsg(null)}
            className="text-slate-300 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Controls Row: 1. Days of Week | 2. Time Interval | 3. Level */}
      <div className="aquarium-glass grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#030B17] p-4 rounded-2xl border border-[#145A9B]">
        {/* Step 1: Select 2 Days of the Week */}
        <div className="md:col-span-5 space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#12C7BB]" />
            1. Escolha os Dias da Semana (Ex: Terça e Quinta):
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
              const isSelected = selectedDays.includes(dayIdx);
              return (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => toggleDay(dayIdx)}
                  className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0987CE] text-white shadow-xs'
                      : 'bg-[#071D3D] text-slate-300 border border-[#145A9B] hover:border-[#0987CE]'
                  }`}
                >
                  {WEEKDAY_SHORT_NAMES[dayIdx]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select Time Interval */}
        <div className="md:col-span-4 space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#0987CE]" />
            2. Intervalo de Horário (Ex: 07:00 às 08:00):
          </label>
          <select
            value={selectedTimeStart}
            onChange={(e) => setSelectedTimeStart(e.target.value)}
            className="w-full px-3 py-2 bg-[#071D3D] border border-[#145A9B] rounded-lg text-xs font-extrabold text-white"
          >
            {TIME_INTERVALS.map((ti) => (
              <option key={ti.start} value={ti.start}>
                {ti.label}
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Filter by Student Level */}
        <div className="md:col-span-3 space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-[#12C7BB]" />
            3. Nível da Aula:
          </label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as AthleteLevel | 'todos')}
            className="w-full px-3 py-2 bg-[#071D3D] border border-[#145A9B] rounded-lg text-xs font-extrabold text-white"
          >
            <option value="iniciante">Aula Iniciante (Meu Nível)</option>
            <option value="serie_c">Aula Série C</option>
            <option value="serie_b">Aula Série B / Avançado</option>
            <option value="todos">Todas as Turmas da Região</option>
          </select>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#030B17] p-1 rounded-xl border border-[#145A9B]">
          <button
            type="button"
            onClick={() => setViewMode('ambos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
              viewMode === 'ambos' ? 'bg-[#0987CE] text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Tudo ({regionalResults.matchingClasses.length} Turmas +{' '}
            {regionalResults.matchingVacantCourts.length} Quadras)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('aulas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
              viewMode === 'aulas' ? 'bg-[#0987CE] text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Aulas com Vaga ({regionalResults.matchingClasses.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('quadras')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
              viewMode === 'quadras' ? 'bg-[#0987CE] text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Quadras Livres p/ Alugar ({regionalResults.matchingVacantCourts.length})
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Filtrando automaticamente pelos horários de funcionamento das arenas na região
        </span>
      </div>

      {/* Results Section 1: Available Classes */}
      {(viewMode === 'ambos' || viewMode === 'aulas') && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#12C7BB] flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#12C7BB]" />
            Turmas de Aula Disponíveis em {selectedDaysLabel} ({selectedIntervalObj.label}):
          </h3>

          {regionalResults.matchingClasses.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#030B17] border border-[#145A9B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-white">
                  Nenhuma turma de aula cadastrada exatamente neste filtro ({selectedDaysLabel} ·{' '}
                  {selectedIntervalObj.label}).
                </p>
                <p className="text-slate-400 mt-0.5">
                  Experimente clicar em "Terça e Quinta · 07h às 08h" ou "Todas as Turmas da Região".
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyPreset([2, 4], '07:00', 'todos')}
                className="px-3.5 py-2 rounded-xl bg-[#0987CE] text-white font-black text-xs shrink-0 cursor-pointer"
              >
                Ver Terça e Quinta 07h às 08h
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regionalResults.matchingClasses.map(({ arena, court, cls, spotsLeft }) => {
                const rawDays = Array.isArray(cls.daysOfWeek) ? cls.daysOfWeek : [2, 4];
                const daysText = rawDays
                  .map((d) => WEEKDAY_SHORT_NAMES[Number(d)] || String(d))
                  .join(' e ');
                return (
                  <div
                    key={`${arena.id}-${cls.id}`}
                    className="aquarium-glass rounded-2xl border-2 border-[#145A9B] bg-[#030B17] p-4 flex flex-col justify-between gap-3 hover:border-[#0987CE] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                        <span className="font-bold text-[#5BC3FA] flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {arena.name} ({arena.distanceKm.toFixed(1)} km)
                        </span>
                        <span className="font-mono font-black text-[#12C7BB]">
                          {spotsLeft} vagas livres
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white leading-snug">{cls.title}</h4>

                      <div className="text-xs text-slate-300 space-y-0.5">
                        <p>
                          <strong>Dias e Horário:</strong> {daysText} · {cls.startTime} às{' '}
                          {cls.endTime}
                        </p>
                        <p>
                          <strong>Professor:</strong> {cls.coachName} · <strong>Quadra:</strong>{' '}
                          {court.name.split(' - ')[0]}
                        </p>
                        <p>
                          <strong>Nível:</strong>{' '}
                          <span className="font-extrabold text-[#12C7BB]">
                            {cls.level && cls.level !== 'todos'
                              ? ATHLETE_LEVEL_LABELS[cls.level]
                              : 'Iniciante / Geral'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#145A9B]/60 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Mensalidade
                        </span>
                        <span className="text-sm font-black text-white font-mono">
                          R$ {cls.monthlyPrice}/mês
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickEnrollInClass(arena, court, cls)}
                        className="px-3.5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Matricular em 1 Clique
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Results Section 2: Vacant Courts in those Days/Hours */}
      {(viewMode === 'ambos' || viewMode === 'quadras') && !compact && (
        <div className="space-y-3 pt-2 border-t border-[#145A9B]/60">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#5BC3FA] flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#0987CE]" />
            Quadras Vagas p/ Locação na Região em {selectedDaysLabel} ({selectedIntervalObj.label}):
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {regionalResults.matchingVacantCourts
              .slice(0, 8)
              .map(({ arena, court, hourlyPrice, isPeak }) => (
                <div
                  key={`${arena.id}-${court.id}`}
                  className="p-3.5 rounded-xl border border-[#145A9B] bg-[#030B17] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-bold text-white">{arena.name}</span>
                      <span className="font-mono font-bold text-[#12C7BB]">
                        {arena.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-[#5BC3FA]">{court.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {court.isCovered ? 'Coberta' : 'Aberta'} · Funcionamento{' '}
                      {court.openTime || arena.operatingHours.open}–
                      {court.closeTime || arena.operatingHours.close}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#145A9B]/60">
                    <span className="text-xs font-black text-white font-mono">
                      R$ {hourlyPrice}/h {isPeak ? '(Pico)' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickBookCourt(arena)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[11px] cursor-pointer flex items-center gap-1"
                    >
                      Agendar
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

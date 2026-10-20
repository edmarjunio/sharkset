import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Court, DayPricingRule, SportType } from '../types';
import {
  buildDefaultDayOfWeekPricing,
  WEEKDAY_FULL_NAMES,
  WEEKDAY_SHORT_NAMES,
} from '../services/courtSlotPricing';
import {
  Check,
  Clock,
  Copy,
  DollarSign,
  Flame,
  Plus,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';

interface CourtPricingAdminPanelProps {
  onTriggerToast: (msg: string) => void;
}

const ORDERED_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Seg, Ter, Qua, Qui, Sex, Sáb, Dom

const HOUR_OPTIONS = Array.from({ length: 19 }, (_, idx) => {
  const h = idx + 5; // 05:00 to 23:00
  return `${String(h).padStart(2, '0')}:00`;
});

export const CourtPricingAdminPanel: React.FC<CourtPricingAdminPanelProps> = ({
  onTriggerToast,
}) => {
  const {
    tenant,
    updateCourtConfig,
    applyPricingToAllArenaCourts,
    addClassScheduleToCourt,
    removeClassScheduleFromCourt,
  } = useApp();

  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    tenant.courts[0]?.id || ''
  );
  const [previewDayIndex, setPreviewDayIndex] = useState<number>(5); // Default preview: Sexta-feira

  // Batch Quick-Apply state (Seg-Qui, Sexta, Sáb-Dom)
  const activeCourt: Court = useMemo(() => {
    return (
      tenant.courts.find((c) => c.id === selectedCourtId) || tenant.courts[0]
    );
  }, [tenant.courts, selectedCourtId]);

  const dayPricingMatrix = useMemo(() => {
    return buildDefaultDayOfWeekPricing(activeCourt);
  }, [activeCourt]);

  // Class Schedule creation form state
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassCoach, setNewClassCoach] = useState('');
  const [newClassStart, setNewClassStart] = useState('07:00');
  const [newClassEnd, setNewClassEnd] = useState('08:00');
  const [newClassSport, setNewClassSport] = useState<SportType>('futevolei');
  const [newClassMonthly, setNewClassMonthly] = useState(220);
  const [newClassDaily, setNewClassDaily] = useState(40);

  // Update a single day's rule inside dayOfWeekPricing
  const handleUpdateSingleDayRule = (
    dayIndex: number,
    updates: Partial<DayPricingRule>
  ) => {
    const currentMatrix = buildDefaultDayOfWeekPricing(activeCourt);
    const updatedDay: DayPricingRule = {
      ...currentMatrix[dayIndex],
      ...updates,
    };
    const nextMatrix: Record<number, DayPricingRule> = {
      ...currentMatrix,
      [dayIndex]: updatedDay,
    };

    // Keep base rates in sync with Monday (1) and Saturday (6) for summary display
    const nextHourlyRate = dayIndex === 1 ? updatedDay.normalRate : activeCourt.hourlyRate;
    const nextPeakHourlyRate =
      dayIndex === 1 ? updatedDay.peakRate : activeCourt.peakHourlyRate ?? activeCourt.hourlyRate + 15;
    const nextWeekendNormal =
      dayIndex === 6 || dayIndex === 0
        ? updatedDay.normalRate
        : activeCourt.weekendNormalRate ?? activeCourt.hourlyRate + 10;
    const nextWeekendPeak =
      dayIndex === 6 || dayIndex === 0
        ? updatedDay.peakRate
        : activeCourt.weekendPeakRate ?? (activeCourt.peakHourlyRate || 95) + 10;

    updateCourtConfig(activeCourt.id, {
      hourlyRate: nextHourlyRate,
      peakHourlyRate: nextPeakHourlyRate,
      weekendNormalRate: nextWeekendNormal,
      weekendPeakRate: nextWeekendPeak,
      dayOfWeekPricing: nextMatrix,
    });
  };

  // Batch apply to a group of days (e.g. Seg-Qui [1,2,3,4], Sex [5], Fim de Semana [6,0])
  const handleBatchApplyDays = (
    days: number[],
    normalRate: number,
    peakRate: number,
    label: string
  ) => {
    const currentMatrix = buildDefaultDayOfWeekPricing(activeCourt);
    const nextMatrix: Record<number, DayPricingRule> = { ...currentMatrix };

    days.forEach((d) => {
      nextMatrix[d] = {
        ...nextMatrix[d],
        enabled: true,
        normalRate,
        peakRate,
      };
    });

    const updates: Partial<Court> = {
      dayOfWeekPricing: nextMatrix,
    };

    if (days.includes(1)) {
      updates.hourlyRate = normalRate;
      updates.peakHourlyRate = peakRate;
    }
    if (days.includes(6) || days.includes(0)) {
      updates.weekendNormalRate = normalRate;
      updates.weekendPeakRate = peakRate;
    }

    updateCourtConfig(activeCourt.id, updates);
    onTriggerToast(
      `Valores de ${label} (Normal R$ ${normalRate}/h · Pico R$ ${peakRate}/h) aplicados na ${activeCourt.name.split(' - ')[0]}!`
    );
  };

  // Replicate active court's entire pricing configuration to all courts in the arena
  const handleReplicateToAllCourts = () => {
    applyPricingToAllArenaCourts(activeCourt.id);
    onTriggerToast(
      `Tabela de preços de horário normal, pico e dias da semana replicada para todas as ${tenant.courts.length} quadras da arena!`
    );
  };

  // Add fixed class schedule
  const handleAddClassSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassTitle.trim() || !newClassCoach.trim()) return;

    addClassScheduleToCourt(activeCourt.id, {
      title: newClassTitle.trim(),
      coachName: newClassCoach.trim(),
      startTime: newClassStart,
      endTime: newClassEnd,
      sport: newClassSport,
      monthlyPrice: newClassMonthly,
      dailyPrice: newClassDaily,
      maxStudents: 12,
    });

    setNewClassTitle('');
    setNewClassCoach('');
    onTriggerToast(`Horário fixo de aula adicionado à ${activeCourt.name}!`);
  };

  // Compute Hourly Preview for the selected previewDayIndex
  const hourlyPreviewSlots = useMemo(() => {
    const openHour = parseInt((activeCourt.openTime || '06:00').split(':')[0], 10) || 6;
    const closeHour = parseInt((activeCourt.closeTime || '23:00').split(':')[0], 10) || 23;
    const peakStartHour = parseInt((activeCourt.peakStartTime || '18:00').split(':')[0], 10) || 18;
    const peakEndHour = parseInt((activeCourt.peakEndTime || '22:00').split(':')[0], 10) || 22;

    const rule = dayPricingMatrix[previewDayIndex] || {
      enabled: true,
      normalRate: activeCourt.hourlyRate,
      peakRate: activeCourt.peakHourlyRate ?? activeCourt.hourlyRate + 15,
    };

    const items: { hourLabel: string; isPeak: boolean; price: number }[] = [];
    for (let h = openHour; h < closeHour; h++) {
      const isPeak = h >= peakStartHour && h < peakEndHour;
      items.push({
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        isPeak,
        price: isPeak ? rule.peakRate : rule.normalRate,
      });
    }
    return { items, isEnabled: rule.enabled };
  }, [activeCourt, dayPricingMatrix, previewDayIndex]);

  const segQuiRule = dayPricingMatrix[1];
  const sexRule = dayPricingMatrix[5];
  const wkndRule = dayPricingMatrix[6];

  return (
    <div className="space-y-6">
      {/* Top Banner: Court Selector & Global Replicate Button */}
      <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
              <DollarSign className="w-3.5 h-3.5" />
              PAINEL ADMINISTRATIVO DO PROPRIETÁRIO · PRECIFICAÇÃO DINÂMICA
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Valores de Aluguel por Hora, Horários de Pico e Dias da Semana
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl">
              Configure tarifas diferenciadas para <strong>Horário Normal</strong> e{' '}
              <strong>Horário de Pico</strong> em cada dia da semana (Segunda a Domingo). Todas as
              alterações atualizam instantaneamente os preços na agenda de reservas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReplicateToAllCourts}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Copiar a tabela de preços desta quadra para todas as quadras da arena"
          >
            <Copy className="w-4 h-4" />
            Aplicar Tabela em Todas as Quadras ({tenant.courts.length})
          </button>
        </div>

        {/* Court Selector Pills */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1">
            Selecionar Quadra para Configurar:
          </span>
          {tenant.courts.map((court) => {
            const isSelected = court.id === activeCourt.id;
            return (
              <button
                key={court.id}
                type="button"
                onClick={() => setSelectedCourtId(court.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-white text-slate-950 shadow-sm ring-2 ring-amber-400'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{court.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    isSelected ? 'bg-slate-900 text-amber-300' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  R$ {court.hourlyRate} / Pico R$ {court.peakHourlyRate ?? court.hourlyRate + 15}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1: Operating Hours & Peak Hour Window Configuration */}
      <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              1. Expediente da Quadra e Janela de Horário de Pico ({activeCourt.name})
            </h3>
            <p className="text-xs text-slate-500">
              Defina quando a quadra abre/fecha e qual faixa de horário cobra tarifa de <strong>Horário de Pico</strong>.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={activeCourt.isCovered}
              onChange={(e) => {
                updateCourtConfig(activeCourt.id, { isCovered: e.target.checked });
                onTriggerToast(
                  `${activeCourt.name.split(' - ')[0]} marcada como ${
                    e.target.checked ? 'Quadra Coberta' : 'Céu Aberto'
                  }!`
                );
              }}
              className="rounded border-slate-300"
            />
            Quadra Coberta
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-emerald-600" />
              Abertura do Expediente
            </label>
            <select
              value={activeCourt.openTime || '06:00'}
              onChange={(e) => {
                updateCourtConfig(activeCourt.id, { openTime: e.target.value });
                onTriggerToast(`Horário de abertura alterado para ${e.target.value}!`);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
            >
              {HOUR_OPTIONS.slice(0, 10).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              Fechamento do Expediente
            </label>
            <select
              value={activeCourt.closeTime || '23:00'}
              onChange={(e) => {
                updateCourtConfig(activeCourt.id, { closeTime: e.target.value });
                onTriggerToast(`Horário de fechamento alterado para ${e.target.value}!`);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
            >
              {HOUR_OPTIONS.slice(10).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
            <label className="font-black text-amber-950 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              Início do Horário de Pico
            </label>
            <select
              value={activeCourt.peakStartTime || '18:00'}
              onChange={(e) => {
                updateCourtConfig(activeCourt.id, { peakStartTime: e.target.value });
                onTriggerToast(`Início do Horário de Pico definido para ${e.target.value}!`);
              }}
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-black text-slate-900"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  A partir das {h}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
            <label className="font-black text-amber-950 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Término do Horário de Pico
            </label>
            <select
              value={activeCourt.peakEndTime || '22:00'}
              onChange={(e) => {
                updateCourtConfig(activeCourt.id, { peakEndTime: e.target.value });
                onTriggerToast(`Término do Horário de Pico definido para ${e.target.value}!`);
              }}
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-black text-slate-900"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  Até as {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Quick Batch Pricing (Segunda a Quinta · Sexta-Feira · Sábado e Domingo) */}
      <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            2. Configuração Rápida por Período da Semana (Edição em Lote)
          </h3>
          <p className="text-xs text-slate-500">
            Ajuste rapidamente os valores de <strong>Segunda a Quinta</strong>, <strong>Sexta-Feira</strong> e{' '}
            <strong>Fim de Semana (Sábado e Domingo)</strong>. Você também pode refinar cada dia individualmente na tabela abaixo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Segunda a Quinta */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-black text-[10px] uppercase">
                SEGUNDA A QUINTA
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">Dias Úteis</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Hora Normal (R$/h)
                </label>
                <input
                  type="number"
                  min={10}
                  value={segQuiRule.normalRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 60;
                    handleBatchApplyDays([1, 2, 3, 4], val, segQuiRule.peakRate, 'Segunda a Quinta');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-sm text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                  Hora Pico ({activeCourt.peakStartTime || '18:00'}+)
                </label>
                <input
                  type="number"
                  min={10}
                  value={segQuiRule.peakRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 80;
                    handleBatchApplyDays([1, 2, 3, 4], segQuiRule.normalRate, val, 'Segunda a Quinta');
                  }}
                  className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl font-mono font-black text-sm text-amber-950"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Sexta-Feira */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-900 text-white font-black text-[10px] uppercase">
                SEXTA-FEIRA
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">Alta Demanda / Rachão</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Hora Normal (R$/h)
                </label>
                <input
                  type="number"
                  min={10}
                  value={sexRule.normalRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 70;
                    handleBatchApplyDays([5], val, sexRule.peakRate, 'Sexta-Feira');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-sm text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                  Hora Pico ({activeCourt.peakStartTime || '18:00'}+)
                </label>
                <input
                  type="number"
                  min={10}
                  value={sexRule.peakRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 95;
                    handleBatchApplyDays([5], sexRule.normalRate, val, 'Sexta-Feira');
                  }}
                  className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl font-mono font-black text-sm text-amber-950"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Fim de Semana (Sábado e Domingo) */}
          <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                SÁBADO & DOMINGO
              </span>
              <span className="text-[11px] text-amber-900 font-bold">Fim de Semana / Day Use</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Hora Normal (R$/h)
                </label>
                <input
                  type="number"
                  min={10}
                  value={wkndRule.normalRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 90;
                    handleBatchApplyDays([6, 0], val, wkndRule.peakRate, 'Sábado e Domingo');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-sm text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                  Hora Pico ({activeCourt.peakStartTime || '18:00'}+)
                </label>
                <input
                  type="number"
                  min={10}
                  value={wkndRule.peakRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 110;
                    handleBatchApplyDays([6, 0], wkndRule.normalRate, val, 'Sábado e Domingo');
                  }}
                  className="w-full px-3 py-2 bg-amber-100/80 border border-amber-300 rounded-xl font-mono font-black text-sm text-amber-950"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Detailed Day-by-Day Pricing Matrix (Segunda a Domingo) */}
      <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              3. Matriz Individual por Dia da Semana (Segunda a Domingo)
            </h3>
            <p className="text-xs text-slate-500">
              Personalize o valor de aluguel por hora em cada dia da semana ou feche a quadra para manutenção em dias específicos.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 font-bold">
            ✓ Sincronizado com a Agenda da Quadra
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Dia da Semana</th>
                <th className="py-2.5 px-3">Funcionamento</th>
                <th className="py-2.5 px-3">
                  Hora Normal ({activeCourt.openTime || '06:00'} às {activeCourt.peakStartTime || '18:00'})
                </th>
                <th className="py-2.5 px-3">
                  Hora de Pico ({activeCourt.peakStartTime || '18:00'} às {activeCourt.peakEndTime || '22:00'})
                </th>
                <th className="py-2.5 px-3">Adicional de Pico</th>
                <th className="py-2.5 px-3 text-right">Simular Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ORDERED_WEEKDAYS.map((dayIdx) => {
                const rule = dayPricingMatrix[dayIdx];
                const isWeekend = dayIdx === 0 || dayIdx === 6;
                const diff = rule.peakRate - rule.normalRate;

                return (
                  <tr
                    key={dayIdx}
                    className={`transition-colors ${
                      !rule.enabled
                        ? 'bg-slate-50 opacity-60'
                        : isWeekend
                        ? 'bg-amber-50/20 hover:bg-amber-50/40'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-black text-[10px] ${
                            isWeekend
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {WEEKDAY_SHORT_NAMES[dayIdx]}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {WEEKDAY_FULL_NAMES[dayIdx]}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSingleDayRule(dayIdx, { enabled: !rule.enabled })
                        }
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                          rule.enabled
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {rule.enabled ? '✓ Aberta' : '✕ Fechada'}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-mono">R$</span>
                        <input
                          type="number"
                          min={10}
                          disabled={!rule.enabled}
                          value={rule.normalRate}
                          onChange={(e) =>
                            handleUpdateSingleDayRule(dayIdx, {
                              normalRate: parseInt(e.target.value, 10) || 60,
                            })
                          }
                          className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-black text-slate-900 focus:ring-2 focus:ring-slate-900"
                        />
                        <span className="text-slate-400 text-[11px]">/hora</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-700 font-mono font-bold">R$</span>
                        <input
                          type="number"
                          min={10}
                          disabled={!rule.enabled}
                          value={rule.peakRate}
                          onChange={(e) =>
                            handleUpdateSingleDayRule(dayIdx, {
                              peakRate: parseInt(e.target.value, 10) || 80,
                            })
                          }
                          className="w-24 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg font-mono font-black text-amber-950 focus:ring-2 focus:ring-amber-400"
                        />
                        <span className="text-amber-800 text-[11px] font-semibold">/hora</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {diff > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[11px]">
                          +R$ {diff}/h no pico
                        </span>
                      ) : diff === 0 ? (
                        <span className="text-slate-400 text-[11px]">Tarifa única</span>
                      ) : (
                        <span className="text-emerald-700 font-mono font-bold text-[11px]">
                          {diff}/h
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPreviewDayIndex(dayIdx)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          previewDayIndex === dayIdx
                            ? 'bg-slate-900 text-amber-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {previewDayIndex === dayIdx ? 'Visualizando ↓' : 'Simular Horários'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Live Hourly Price Simulator Timeline */}
      <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              SIMULADOR EM TEMPO REAL DA GRADE HORÁRIA
            </span>
            <h4 className="text-base font-black text-white">
               Valores por Hora em {WEEKDAY_FULL_NAMES[previewDayIndex]} · {activeCourt.name}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ORDERED_WEEKDAYS.map((dIdx) => (
              <button
                key={dIdx}
                type="button"
                onClick={() => setPreviewDayIndex(dIdx)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                  previewDayIndex === dIdx
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {WEEKDAY_SHORT_NAMES[dIdx]}
              </button>
            ))}
          </div>
        </div>

        {!hourlyPreviewSlots.isEnabled ? (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs font-bold">
            Quadra configurada como FECHADA às {WEEKDAY_FULL_NAMES[previewDayIndex]}s.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2">
            {hourlyPreviewSlots.items.map((slotItem) => (
              <div
                key={slotItem.hourLabel}
                className={`p-2.5 rounded-xl border text-center space-y-0.5 ${
                  slotItem.isPeak
                    ? 'bg-amber-400/15 border-amber-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <div className="font-mono text-xs font-black">{slotItem.hourLabel}</div>
                <div
                  className={`font-mono text-xs font-extrabold ${
                    slotItem.isPeak ? 'text-amber-300' : 'text-emerald-400'
                  }`}
                >
                  R$ {slotItem.price}
                </div>
                <div className="text-[9px] uppercase font-bold tracking-wider">
                  {slotItem.isPeak ? (
                    <span className="text-amber-400">⚡ Pico</span>
                  ) : (
                    <span className="text-slate-400">Normal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: Fixed Class Schedules Management on this Court */}
      <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">
              4. Horários Reservados para Aulas Fixas ({activeCourt.name})
            </h3>
            <p className="text-xs text-slate-500">
              Bloqueie horários fixos na agenda para turmas e professores (com cobrança mensal ou diária).
            </p>
          </div>
        </div>

        {(activeCourt.classSchedules || []).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(activeCourt.classSchedules || []).map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
              >
                <div>
                  <span className="font-mono font-black text-indigo-700">
                    {cls.startTime} às {cls.endTime}
                  </span>{' '}
                  · <strong className="text-slate-900">{cls.title}</strong> ({cls.coachName})
                  <div className="text-[11px] text-slate-500 font-mono">
                    Mensal: R$ {cls.monthlyPrice} · Diária: R$ {cls.dailyPrice}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeClassScheduleFromCourt(activeCourt.id, cls.id);
                    onTriggerToast(`Horário de aula "${cls.title}" removido da quadra.`);
                  }}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAddClassSchedule}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs pt-2"
        >
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nome da Turma / Aula:</label>
            <input
              type="text"
              required
              value={newClassTitle}
              onChange={(e) => setNewClassTitle(e.target.value)}
              placeholder="Ex: Turma Futevôlei Noite"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Professor(a):</label>
            <input
              type="text"
              required
              value={newClassCoach}
              onChange={(e) => setNewClassCoach(e.target.value)}
              placeholder="Ex: Prof. Tavinho"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Horário (Início):</label>
            <select
              value={newClassStart}
              onChange={(e) => {
                const h = parseInt(e.target.value.split(':')[0], 10);
                setNewClassStart(e.target.value);
                setNewClassEnd(`${String(h + 1).padStart(2, '0')}:00`);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
            >
              {['06:00', '07:00', '08:00', '09:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(
                (hr) => (
                  <option key={hr} value={hr}>
                    {hr} às {String(parseInt(hr.split(':')[0], 10) + 1).padStart(2, '0')}:00
                  </option>
                )
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mensal (R$):</label>
              <input
                type="number"
                value={newClassMonthly}
                onChange={(e) => setNewClassMonthly(parseInt(e.target.value, 10) || 200)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Diária (R$):</label>
              <input
                type="number"
                value={newClassDaily}
                onChange={(e) => setNewClassDaily(parseInt(e.target.value, 10) || 40)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Salvar Aula Fixa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

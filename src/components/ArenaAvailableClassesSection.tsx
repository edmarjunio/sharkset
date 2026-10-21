import React, { useState, useMemo } from 'react';
import { GraduationCap, Clock, Calendar, Check, AlertTriangle, ArrowRight, Flame, Users, Sparkles } from 'lucide-react';
import { ClassScheduleConfig, Court, TenantConfig } from '../types';

interface ClassItemInfo {
  court: Court;
  cls: ClassScheduleConfig;
  maxStudents: number;
  enrolled: number;
  spotsRemaining: number;
  isAvailable: boolean;
}

interface Props {
  arena: TenantConfig;
  classesWithSpotsInfo: ClassItemInfo[];
  onEnrollClass: (courtId: string, cls: ClassScheduleConfig) => void;
}

const WEEKDAYS = [
  { day: 1, label: 'Segunda', short: 'Seg' },
  { day: 2, label: 'Terça', short: 'Ter' },
  { day: 3, label: 'Quarta', short: 'Qua' },
  { day: 4, label: 'Quinta', short: 'Qui' },
  { day: 5, label: 'Sexta', short: 'Sex' },
  { day: 6, label: 'Sábado', short: 'Sáb' },
  { day: 0, label: 'Domingo', short: 'Dom' },
];

export const ArenaAvailableClassesSection: React.FC<Props> = ({
  arena,
  classesWithSpotsInfo,
  onEnrollClass,
}) => {
  // Only classes with spots available
  const availableClasses = useMemo(() => {
    return classesWithSpotsInfo.filter((c) => c.isAvailable && c.spotsRemaining > 0);
  }, [classesWithSpotsInfo]);

  // Selected days filter (supports multiple days e.g. Terça e Quinta!)
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedHour, setSelectedHour] = useState<string>('all');

  // Confirmation modal when selecting multiple days from different turmas
  const [differentTurmasPrompt, setDifferentTurmasPrompt] = useState<{
    classes: ClassItemInfo[];
    isOpen: boolean;
  } | null>(null);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Filtered classes by selected days and hour
  const filteredClasses = useMemo(() => {
    return availableClasses.filter(({ cls }) => {
      // Days filter: if days selected, class must have at least one of them
      const matchesDay =
        selectedDays.length === 0 ||
        (cls.daysOfWeek || []).some((d) => selectedDays.includes(d));

      // Hour filter
      const matchesHour =
        selectedHour === 'all' || cls.startTime.startsWith(selectedHour);

      return matchesDay && matchesHour;
    });
  }, [availableClasses, selectedDays, selectedHour]);

  // Check if multiple selected days correspond to different turmas
  const handleSelectClassWithDayCheck = (item: ClassItemInfo) => {
    if (selectedDays.length > 1) {
      // Check if this class covers all chosen days
      const coversAllChosenDays = selectedDays.every((d) =>
        (item.cls.daysOfWeek || []).includes(d)
      );

      if (!coversAllChosenDays) {
        // Find other classes that cover the other selected days at similar hours
        const otherMatching = availableClasses.filter(
          (other) =>
            other.cls.id !== item.cls.id &&
            (other.cls.daysOfWeek || []).some((d) => selectedDays.includes(d))
        );

        if (otherMatching.length > 0) {
          setDifferentTurmasPrompt({
            classes: [item, otherMatching[0]],
            isOpen: true,
          });
          return;
        }
      }
    }

    onEnrollClass(item.court.id, item.cls);
  };

  if (availableClasses.length === 0) return null;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#05182C] via-[#041224] to-[#020b17] border border-cyan-800/60 shadow-xl text-white space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-black shadow-lg">
            <GraduationCap size={22} className="text-indigo-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
              Vagas Abertas na Arena
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Aulas & Treinos Disponíveis ({availableClasses.length} turmas com vaga)
            </h3>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase">
          🔥 Capacidade Limitada
        </span>
      </div>

      {/* Multi-day Selector Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Calendar size={14} className="text-cyan-400" />
            <span>Selecione os dias da semana desejados (pode marcar mais de um, ex: Terça e Quinta):</span>
          </span>
          {selectedDays.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDays([])}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
            >
              Limpar seleção
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {WEEKDAYS.map((w) => {
            const isSelected = selectedDays.includes(w.day);
            return (
              <button
                key={w.day}
                type="button"
                onClick={() => toggleDay(w.day)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md ring-2 ring-indigo-400/50 scale-105'
                    : 'bg-[#031326] text-slate-300 hover:text-white border border-cyan-800/60 hover:border-cyan-500'
                }`}
              >
                {isSelected && <Check size={12} />}
                <span>{w.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Classes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredClasses.map((item) => {
          const { court, cls, maxStudents, enrolled, spotsRemaining } = item;
          const dayLabels = (cls.daysOfWeek || [])
            .map((d) => WEEKDAYS.find((w) => w.day === d)?.short)
            .filter(Boolean)
            .join(' e ');

          return (
            <div
              key={cls.id}
              className="p-4 rounded-2xl bg-[#031326] border border-cyan-800/60 hover:border-indigo-400/70 transition-all flex flex-col justify-between gap-3.5 shadow-sm group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase">
                    {cls.sport === 'futevolei' ? '⚽ Futevôlei' : cls.sport === 'beach_tennis' ? '🎾 Beach Tennis' : '🏐 Vôlei de Praia'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase animate-pulse">
                    🟢 {spotsRemaining} vaga(s) restante(s)
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">
                    {cls.title}
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold mt-0.5">
                    Prof. {cls.coachName} · {court.name}
                  </p>
                  <p className="text-xs font-mono text-cyan-300 font-bold mt-1">
                    {dayLabels ? `${dayLabels} · ` : ''}{cls.startTime} às {cls.endTime}
                  </p>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Ocupação da Turma:</span>
                    <span className="text-emerald-400">
                      {enrolled}/{maxStudents} inscritos
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, (enrolled / maxStudents) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-cyan-900/60">
                <div>
                  <span className="text-xs font-mono font-black text-white block">
                    R$ {cls.monthlyPrice || 220}/mês
                  </span>
                  {cls.dailyPrice && (
                    <span className="text-[10px] text-slate-400">
                      R$ {cls.dailyPrice} avulsa
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectClassWithDayCheck(item)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 text-white font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <span>Quero Fazer Aula</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Different Turmas Confirmation Dialog */}
      {differentTurmasPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#05182C] border-2 border-amber-400/90 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400 font-black text-base">
              <AlertTriangle size={22} className="shrink-0" />
              <span>Aviso de Múltiplas Turmas</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Você escolheu horários que pertencem a <strong className="text-amber-300">duas turmas diferentes</strong> na arena:
            </p>

            <div className="space-y-2">
              {differentTurmasPrompt.classes.map(({ court, cls }) => (
                <div key={cls.id} className="p-3 rounded-xl bg-[#030D1A] border border-cyan-800/80 text-xs">
                  <div className="font-bold text-white text-sm">{cls.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Prof. {cls.coachName} · {cls.startTime} às {cls.endTime} ({court.name})
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 font-bold">
              Você entraria em duas turmas diferentes. Você tem problema com isso?
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDifferentTurmasPrompt(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-all"
              >
                Escolher apenas uma turma
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = differentTurmasPrompt.classes[0];
                  setDifferentTurmasPrompt(null);
                  onEnrollClass(target.court.id, target.cls);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 text-xs font-black cursor-pointer transition-all shadow-md"
              >
                Sem problema, quero continuar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

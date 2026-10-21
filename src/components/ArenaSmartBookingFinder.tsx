import React, { useState, useMemo } from 'react';
import { Calendar, Clock, DollarSign, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Court, TenantConfig, TimeSlot } from '../types';
import { buildArenaAvailability, arenaDate } from '../services/bookingAvailability';
import { useApp } from '../context/AppContext';

interface Props {
  arena: TenantConfig;
  onBookSlot: (slot: TimeSlot, court: Court) => void;
  onSelectCourt?: (courtId: string) => void;
}

export const ArenaSmartBookingFinder: React.FC<Props> = ({
  arena,
  onBookSlot,
  onSelectCourt,
}) => {
  const { bookings } = useApp();
  const todayStr = useMemo(() => arenaDate(), []);

  // Filter state
  const [desiredDate, setDesiredDate] = useState<string>(todayStr);
  const [desiredHour, setDesiredHour] = useState<string>('18:00');

  // Compute availability for desired date & hour
  const slotResults = useMemo(() => {
    const cells = buildArenaAvailability(arena, desiredDate, bookings);
    const atHour = cells.filter((c) => c.startTime === desiredHour);
    return atHour;
  }, [arena, desiredDate, desiredHour, bookings]);

  // Find next alternative free hour if desired hour is full on all courts
  const nextAvailableAlternative = useMemo(() => {
    const isAnyFree = slotResults.some((s) => s.isAvailable);
    if (isAnyFree) return null;

    const cells = buildArenaAvailability(arena, desiredDate, bookings);
    const futureFree = cells
      .filter((c) => c.isAvailable && c.startTime > desiredHour)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (futureFree.length > 0) {
      const best = futureFree[0];
      const court = arena.courts.find((c) => c.id === best.courtId);
      return { slot: best, court };
    }
    return null;
  }, [arena, desiredDate, desiredHour, bookings, slotResults]);

  // Hours options from opening to closing
  const hourOptions = useMemo(() => {
    const openH = parseInt((arena.operatingHours.open || '06:00').split(':')[0], 10) || 6;
    const rawClose = arena.operatingHours.close || '00:00';
    const closeH = rawClose === '00:00' ? 24 : (parseInt(rawClose.split(':')[0], 10) || 23);

    const list: string[] = [];
    for (let h = openH; h < closeH; h++) {
      list.push(`${String(h).padStart(2, '0')}:00`);
    }
    return list;
  }, [arena.operatingHours]);

  const handleSelectSlot = (cell: typeof slotResults[0]) => {
    const court = arena.courts.find((c) => c.id === cell.courtId) || arena.courts[0];
    onBookSlot(
      {
        id: cell.id,
        courtId: cell.courtId,
        date: cell.date,
        startTime: cell.startTime,
        endTime: cell.endTime,
        price: cell.price,
        isAvailable: true,
      },
      court
    );
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#061e38] via-[#041629] to-[#020b16] border-2 border-cyan-500/40 shadow-2xl text-white space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center font-black shadow-lg">
            <Sparkles size={20} className="text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
              Agendamento Instantâneo
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Qual horário você deseja jogar?
            </h3>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 text-[11px] font-bold">
          {arena.courts.length} Quadras Disponíveis
        </span>
      </div>

      {/* Date & Hour Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-cyan-400" />
            <span>Escolha a Data:</span>
          </label>
          <input
            type="date"
            min={todayStr}
            value={desiredDate}
            onChange={(e) => setDesiredDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-[#030D1A] border border-cyan-700/60 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Clock size={14} className="text-amber-400" />
            <span>Qual Horário Desejado?</span>
          </label>
          <select
            value={desiredHour}
            onChange={(e) => setDesiredHour(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-[#030D1A] border border-cyan-700/60 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {h} ({parseInt(h, 10) >= 18 && parseInt(h, 10) <= 22 ? 'Horário Nobre / Pico' : 'Horário Padrão'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Instant Availability Results for that exact time */}
      <div className="pt-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Disponibilidade para às {desiredHour} em {new Date(`${desiredDate}T12:00:00Z`).toLocaleDateString('pt-BR')}:
        </span>

        {slotResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {slotResults.map((cell) => {
              const court = arena.courts.find((c) => c.id === cell.courtId);
              const isFree = cell.isAvailable;

              return (
                <div
                  key={cell.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isFree
                      ? 'bg-gradient-to-br from-emerald-950/70 to-[#041a30] border-emerald-500/60 shadow-lg'
                      : 'bg-slate-900/60 border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-white text-xs">
                      {court?.name || 'Quadra'}
                    </span>
                    {isFree ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1">
                        <CheckCircle2 size={11} /> Livre
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase">
                        Ocupado
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <p>{court?.surface || 'Areia Quartzosa'} · {court?.isCovered ? 'Coberta' : 'Aberta'}</p>
                    <p className="font-mono text-xs font-black text-amber-300">
                      R$ {cell.price || court?.hourlyRate || 80} / hora
                    </p>
                  </div>

                  {isFree ? (
                    <button
                      type="button"
                      onClick={() => handleSelectSlot(cell)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span>Reservar Este Horário</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic text-center py-1">
                      Horário reservado nesta quadra
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
            Nenhuma quadra disponível para este dia.
          </div>
        )}

        {/* Alternative suggestion if desired hour is full on all courts */}
        {nextAvailableAlternative && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertCircle size={16} />
              <span>
                Às {desiredHour} está lotado. Sugestão mais próxima livre:{' '}
                <strong className="text-white">
                  {nextAvailableAlternative.slot.startTime} na {nextAvailableAlternative.court?.name} (R$ {nextAvailableAlternative.slot.price})
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (nextAvailableAlternative.court) {
                  onBookSlot(nextAvailableAlternative.slot, nextAvailableAlternative.court);
                }
              }}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Reservar Próximo Livre →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

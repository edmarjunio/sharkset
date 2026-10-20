import React, { useCallback } from 'react';
import type { TenantConfig } from '../types';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import { useModalFocus } from '../hooks/useModalFocus';
import { STATE_LABELS, type AvailabilityCell } from '../services/bookingAvailability';
import { BookingDatePicker } from './BookingDatePicker';
import { useBookingSelection } from '../store/useBookingSelection';

export function ArenaScheduleModal({ arena, onClose, onViewArena, onSelect }: {
  arena: TenantConfig; onClose: () => void; onViewArena: () => void; onSelect: (slot: AvailabilityCell) => void;
}) {
  const { date } = useBookingSelection();
  const { cells, loading, error, maxDate } = useArenaAvailability(arena, date);
  const close = useCallback(onClose, [onClose]);
  const ref = useModalFocus(close);
  return <dialog ref={ref} aria-labelledby="arena-schedule-title" className="m-auto w-[96vw] max-w-6xl max-h-[92dvh] rounded-3xl border border-cyan-700 bg-slate-950 p-5 text-white backdrop:bg-black/75">
    <header className="flex flex-wrap justify-between items-start gap-3 mb-4">
      <div><h2 id="arena-schedule-title" className="font-black text-xl">{arena.name}</h2><p className="text-sm text-slate-300">{arena.city}/{arena.state} · {arena.courts.length} quadras · {cells.filter(c => c.state === 'free').length} horários livres</p></div>
      <div className="flex gap-3"><button onClick={onViewArena} className="text-cyan-300">Ver Arena</button><button onClick={onClose} aria-label="Fechar agenda" className="rounded-xl border px-3 py-2">Fechar ×</button></div>
      <BookingDatePicker maxDate={maxDate} />
    </header>
    <p className="text-xs text-slate-400 mb-3">Livre · Reservado · Aula · Bloqueado · Indisponível. Dados pessoais das reservas são privados.</p>
    {loading ? <p role="status">Consultando agenda…</p> : error ? <p role="alert">{error}</p> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {arena.courts.map(court => <section key={court.id} className="rounded-2xl border border-slate-700 p-3">
        <h3 className="font-black mb-2">{court.name}</h3>
        <p className="text-xs text-slate-400 mb-2">Funcionamento: {court.openTime || arena.operatingHours.open}–{court.closeTime || arena.operatingHours.close}</p>
        <div className="space-y-2">{cells.filter(c => c.courtId === court.id).map(cell => <button key={cell.id} type="button" disabled={cell.state !== 'free'} onClick={() => onSelect(cell)}
          className={`w-full flex justify-between gap-2 rounded-xl border p-3 text-sm ${cell.state === 'free' ? 'border-emerald-600 bg-emerald-950 hover:bg-emerald-900' : cell.state === 'class' ? 'border-indigo-700 bg-indigo-950' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
          <span className="font-mono font-bold">{cell.startTime}–{cell.endTime}</span><span>{STATE_LABELS[cell.state]}{cell.state === 'free' ? ` · R$ ${cell.price.toFixed(2)}` : ''}</span>
        </button>)}</div>
        {!cells.some(c => c.courtId === court.id) && <p className="text-slate-400 text-sm">Indisponível nesta data.</p>}
      </section>)}
    </div>}
  </dialog>;
}

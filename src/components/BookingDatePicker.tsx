import React, { useEffect } from 'react';
import { addDays, arenaDate, validDate } from '../services/bookingAvailability';
import { useBookingSelection } from '../store/useBookingSelection';

export function BookingDatePicker({ maxDate = addDays(arenaDate(), 6) }: { maxDate?: string }) {
  const { date, setDate } = useBookingSelection();
  const today = arenaDate();
  useEffect(() => { if (date < today) setDate(today); }, [date, today, setDate]);
  return <div className="flex flex-wrap items-center gap-2">
    <label className="font-bold text-sm">Data <input aria-label="Data do agendamento" type="date" min={today} max={maxDate} value={date}
      onChange={event => { const value = event.target.value; if (validDate(value) && value >= today && value <= maxDate) setDate(value); }}
      className="ml-2 rounded-xl border border-cyan-600 bg-slate-900 p-2 text-white [color-scheme:dark]" /></label>
    <button type="button" className="rounded-xl border border-cyan-700 px-3 py-2 text-sm" onClick={() => setDate(today)}>Hoje</button>
    {date !== today && <span className="text-xs text-amber-300">Consultando {date.split('-').reverse().join('/')}</span>}
  </div>;
}

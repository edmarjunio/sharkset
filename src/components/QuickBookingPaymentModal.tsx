import React, { useCallback, useState } from 'react';
import type { SportType, TenantConfig } from '../types';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import { useModalFocus } from '../hooks/useModalFocus';

export interface QuickBookingSlotData {
  arena: TenantConfig; courtId: string; courtName: string; date: string; time: string;
  endTime?: string; price: number; sport?: SportType;
}
interface Props { slotData: QuickBookingSlotData | null; onClose: () => void; onSuccess?: (bookingId: string) => void }
export function QuickBookingPaymentModal({ slotData, onClose }: Props) {
  return slotData ? <BookingReview key={`${slotData.arena.id}-${slotData.courtId}-${slotData.date}-${slotData.time}`} data={slotData} onClose={onClose} /> : null;
}
function BookingReview({ data, onClose }: { data: QuickBookingSlotData; onClose: () => void }) {
  const close = useCallback(onClose, [onClose]);
  const ref = useModalFocus(close);
  const { cells, loading, error } = useArenaAvailability(data.arena, data.date);
  const court = data.arena.courts.find(c => c.id === data.courtId);
  const [sport, setSport] = useState<SportType>(data.sport || court?.sports[0] || 'futevolei');
  const slot = cells.find(c => c.courtId === data.courtId && c.startTime === data.time);
  const available = slot?.state === 'free';
  const phone = data.arena.whatsapp?.replace(/\D/g, '');
  const contact = phone && /^\d{10,15}$/.test(phone) && available && !BOOKING_DEMO
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Gostaria de consultar a reserva na ${data.arena.name}, ${data.courtName}, em ${data.date}, ${slot.startTime}–${slot.endTime}, ${sport}. Valor consultado: R$ ${slot.price.toFixed(2)}. Pode confirmar disponibilidade e pagamento?`)}` : null;
  return <dialog ref={ref} aria-labelledby="booking-review-title" className="m-auto w-[95vw] max-w-lg rounded-3xl border border-cyan-700 bg-slate-950 p-6 text-white backdrop:bg-black/75">
    <header className="flex justify-between gap-3"><h2 id="booking-review-title" className="font-black text-xl">Revisar horário</h2><button onClick={onClose} aria-label="Fechar reserva">Fechar ×</button></header>
    <div className="space-y-4 mt-4">
      <p className="font-bold">{data.arena.name} · {data.courtName}</p><p>{data.date.split('-').reverse().join('/')} · {data.time}–{slot?.endTime || data.endTime}</p>
      {loading ? <p role="status">Revalidando disponibilidade…</p> : error ? <p role="alert">{error}</p> : !available ? <p role="alert">Este horário não está mais disponível. Escolha outro horário.</p> : <>
        <p className="text-emerald-300 text-xl font-black">R$ {slot.price.toFixed(2)}</p>
        <label className="block">Modalidade <select value={sport} onChange={e => setSport(e.target.value as SportType)} className="ml-2 rounded-lg bg-slate-800 p-2">{court?.sports.map(s => <option key={s} value={s}>{s === 'futevolei' ? 'Futevôlei' : s === 'beach_tennis' ? 'Beach Tennis' : 'Vôlei de praia'}</option>)}</select></label>
      </>}
      <p className="rounded-xl bg-amber-950 p-3 text-amber-200" role="status">{BOOKING_DEMO ? 'Demonstração com dados locais. Nenhuma reserva ou cobrança será criada.' : 'Pagamento online ainda não disponível. A arena precisa confirmar disponibilidade, preço e pagamento. Este horário ainda não está reservado.'}</p>
      <button disabled className="w-full rounded-xl bg-slate-800 p-3 text-slate-400">Pagamento online indisponível</button>
      {contact && <a href={contact} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-emerald-700 p-3 text-center font-bold">Consultar reserva com a arena</a>}
    </div>
  </dialog>;
}

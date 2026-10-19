import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { SportType, TenantConfig } from '../types';
import { calculateHaversineDistance, type GeoCoordinates } from '../utils/geoUtils';
import { useBookingSelection } from '../store/useBookingSelection';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import type { AvailabilityCell } from '../services/bookingAvailability';
import { BookingDatePicker } from './BookingDatePicker';
import { ArenaScheduleModal } from './ArenaScheduleModal';
import { QuickBookingPaymentModal, type QuickBookingSlotData } from './QuickBookingPaymentModal';

interface Props {
  userCoords?: GeoCoordinates | null;
  className?: string; defaultSport?: SportType | 'all';
}
export function FreeSlotsDateTimeFilter({ userCoords, className = '', defaultSport = 'all' }: Props) {
  const { availableTenants, setTenantId, setArenaSubTab, setActiveTab } = useApp();
  const { date } = useBookingSelection();
  const location = useBookingLocation();
  const coords = userCoords ?? location.coords;
  const [time, setTime] = useState('');
  const [sport, setSport] = useState<SportType | 'all'>(defaultSport);
  const [arena, setArena] = useState<TenantConfig | null>(null);
  const [checkout, setCheckout] = useState<QuickBookingSlotData | null>(null);
  const closeArena = useCallback(() => setArena(null), []);
  const closeCheckout = useCallback(() => setCheckout(null), []);
  const sorted = useMemo(() => availableTenants.map(ar => ({ arena: ar, distance: validCoordinates(coords) && validCoordinates({ lat: ar.lat!, lng: ar.lng! })
    ? calculateHaversineDistance(coords.lat, coords.lng, ar.lat!, ar.lng!) : ar.distanceKm })).sort((a, b) => a.distance - b.distance), [availableTenants, coords]);
  const viewArena = (selected: TenantConfig) => { setTenantId(selected.id); setArenaSubTab('agendamentos'); setActiveTab('scheduler'); setArena(null); };
  const selectSlot = (selected: TenantConfig, slot: AvailabilityCell) => {
    const court = selected.courts.find(c => c.id === slot.courtId);
    if (!court || slot.state !== 'free') return;
    setCheckout({ arena: selected, courtId: court.id, courtName: court.name, date: slot.date, time: slot.startTime, endTime: slot.endTime, price: slot.price, sport: sport === 'all' ? court.sports[0] : sport });
    setArena(null);
  };
  return <section className={`rounded-3xl border border-cyan-800 bg-slate-950 p-4 sm:p-6 text-white space-y-4 ${className}`} aria-labelledby="free-slots-title">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 id="free-slots-title" className="font-black text-xl">Horários disponíveis</h2><BookingDatePicker /></header>
    <div className="flex flex-wrap gap-3 items-center">
      <button type="button" disabled={location.status === 'locating'} onClick={() => void location.request()} className="rounded-xl border border-cyan-700 p-2 text-sm">{location.status === 'locating' ? 'Localizando…' : 'Usar minha localização'}</button>
      <label>Horário <input aria-label="Filtrar horário inicial" type="time" value={time} onChange={e => setTime(e.target.value)} className="rounded-xl bg-slate-800 p-2 [color-scheme:dark]" /></label>
      <button type="button" onClick={() => setTime('')} className="rounded-xl border border-slate-600 p-2 text-sm">Limpar horário</button>
      <label>Esporte <select value={sport} onChange={e => setSport(e.target.value as SportType | 'all')} className="rounded-xl bg-slate-800 p-2"><option value="all">Todos</option><option value="futevolei">Futevôlei</option><option value="beach_tennis">Beach Tennis</option><option value="volei_praia">Vôlei de praia</option></select></label>
    </div>
    <p className="text-xs text-slate-400">{coords ? 'Ordenado pela distância das coordenadas autorizadas, quando disponíveis.' : location.status === 'denied' ? 'Localização indisponível ou não autorizada. Usando distâncias de referência.' : 'Distâncias de referência. Autorize a localização para calcular a distância por GPS.'} {time ? `Início às ${time}.` : 'Todos os horários futuros da data selecionada.'}</p>
    {BOOKING_DEMO && <p className="text-sm text-amber-300">Demonstração: dados locais de exemplo. Sem disponibilidade ou pagamento real.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sorted.map(({ arena: item, distance }) => <ArenaSlotCard key={`${item.id}-${date}`} arena={item} date={date} time={time} sport={sport} distance={distance}
      onOpen={() => setArena(item)} onView={() => viewArena(item)} onSelect={slot => selectSlot(item, slot)} />)}</div>
    {!sorted.length && <p>Nenhuma arena cadastrada nesta região.</p>}
    {arena && <ArenaScheduleModal arena={arena} onClose={closeArena} onViewArena={() => viewArena(arena)} onSelect={slot => selectSlot(arena, slot)} />}
    <QuickBookingPaymentModal slotData={checkout} onClose={closeCheckout} />
  </section>;
}
function ArenaSlotCard({ arena, date, time, sport, distance, onOpen, onView, onSelect }: {
  arena: TenantConfig; date: string; time: string; sport: SportType | 'all'; distance: number;
  onOpen: () => void; onView: () => void; onSelect: (cell: AvailabilityCell) => void;
}) {
  const { cells, loading, error } = useArenaAvailability(arena, date);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [date, time, sport]);
  const free = cells.filter(c => c.state === 'free' && (!time || c.startTime === time) &&
    (sport === 'all' || arena.courts.find(court => court.id === c.courtId)?.sports.includes(sport))).sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (!loading && !error && !free.length && time) return null;
  return <article className="rounded-2xl border border-cyan-900 bg-slate-900 p-3 space-y-3">
    <button onClick={onOpen} className="w-full text-left"><span className="font-black block">{arena.name}</span><span className="text-xs text-slate-400">{arena.city}/{arena.state} · {Number.isFinite(distance) ? `${distance.toFixed(1)} km` : 'Distância indisponível'} · Abrir agenda completa</span></button>
    {loading ? <p role="status" className="text-sm">Consultando horários…</p> : error ? <p role="alert" className="text-xs text-amber-200">{error}</p> : <>
      <div className="flex flex-wrap gap-2">{free.slice(0, expanded ? undefined : 6).map(slot => <button key={slot.id} onClick={() => onSelect(slot)} className="rounded-xl border border-emerald-700 bg-emerald-950 p-2 text-left hover:bg-emerald-900">
        <strong className="block font-mono text-emerald-200">{slot.startTime}–{slot.endTime}</strong><span className="block text-xs">{arena.courts.find(c => c.id === slot.courtId)?.name}</span><span className="text-xs">R$ {slot.price.toFixed(2)}</span>
      </button>)}</div>
      {free.length > 6 && <button className="text-xs text-cyan-300" onClick={() => setExpanded(!expanded)}>{expanded ? 'Recolher horários' : `Ver todos os ${free.length} horários livres`}</button>}
      {!free.length && <p className="text-sm text-slate-400">Sem horários livres nesta data.</p>}
    </>}
    <button onClick={onView} className="text-sm font-bold text-cyan-300">Ver Arena →</button>
  </article>;
}

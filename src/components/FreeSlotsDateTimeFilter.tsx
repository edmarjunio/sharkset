import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { SportType, TenantConfig } from '../types';
import { calculateHaversineDistance, type GeoCoordinates } from '../utils/geoUtils';
import { useBookingSelection } from '../store/useBookingSelection';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import { arenaDate, minutes, type AvailabilityCell } from '../services/bookingAvailability';
import { newlyFreedSlots, slotsInWindow } from '../services/nearbySlots';
import { BookingDatePicker } from './BookingDatePicker';
import { QuickBookingPaymentModal, type QuickBookingSlotData } from './QuickBookingPaymentModal';
import { ChevronLeft, ChevronRight, Clock, MapPin, Pause, Play, X, Zap } from 'lucide-react';

interface Props { userCoords?: GeoCoordinates | null; className?: string; defaultSport?: SportType | 'all'; homeTop?: boolean }
interface ArenaData { cells: AvailabilityCell[]; loading: boolean; error: string }
function localClock() { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); }

export function FreeSlotsDateTimeFilter({ userCoords, className = '', defaultSport = 'all', homeTop = false }: Props) {
  const { availableTenants, radiusKm, activeTab, setTenantId, setArenaSubTab, setActiveTab } = useApp();
  const selection = useBookingSelection();
  const location = useBookingLocation();
  const coords = userCoords ?? location.coords;
  const [now, setNow] = useState(localClock);
  const [today, setToday] = useState(arenaDate);
  const date = homeTop ? today : selection.date;
  const [arenaFilter, setArenaFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Record<string, ArenaData>>({});
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const previous = useRef(new Map<string, AvailabilityCell[]>());
  const [checkout, setCheckout] = useState<QuickBookingSlotData | null>(null);
  const closeCheckout = useCallback(() => setCheckout(null), []);
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { const timer = window.setInterval(() => { setNow(localClock()); setToday(arenaDate()); }, 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!homeTop || activeTab !== 'home' || !section.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(section.current); return () => observer.disconnect();
  }, [homeTop, activeTab]);
  const receive = useCallback((key: string, state: ArenaData) => {
    setData(prev => ({ ...prev, [key]: state }));
    if (state.loading || state.error) return;
    const freed = newlyFreedSlots(previous.current.get(key), state.cells);
    previous.current.set(key, state.cells);
    if (freed.length) { setFresh(prev => ({ ...prev, ...Object.fromEntries(freed.map(cell => [cell.id, Date.now()])) })); setDismissed(false); }
  }, []);
  const arenas = useMemo(() => availableTenants.map(arena => ({ arena,
    distance: validCoordinates(coords) && validCoordinates({ lat: arena.lat!, lng: arena.lng! })
      ? calculateHaversineDistance(coords.lat, coords.lng, arena.lat!, arena.lng!) : arena.distanceKm,
  })).filter(item => Number.isFinite(item.distance) && item.distance <= radiusKm).sort((a, b) => a.distance - b.distance), [availableTenants, coords, radiusKm]);
  const groups = arenas.map(item => {
    const state = data[item.arena.id + ':' + date];
    const cells = state?.cells || [];
    const free = date === today ? slotsInWindow(cells, now, from, to) : cells.filter(c => c.state === 'free' && (!from || c.startTime >= from) && (!to || c.endTime <= to));
    return { ...item, state, free: free.filter(cell => defaultSport === 'all' || item.arena.courts.find(c => c.id === cell.courtId)?.sports.includes(defaultSport)) };
  });
  const shown = groups.filter(group => (arenaFilter === 'all' || arenaFilter === group.arena.id) && (!group.state || group.state.loading || group.state.error || group.free.length));
  // Notificações dos horários que acabaram de livrar ou horários livres nas próximas horas na direita da tela
  const alerts = groups.map(group => {
    const rawFree = slotsInWindow(group.state?.cells || [], now);
    const relevantFree = rawFree.filter(cell => fresh[cell.id] > Date.now() - 300000 || cell.isPeakHour || true);
    return { ...group, free: relevantFree };
  }).filter(group => group.free.length && !group.state?.loading && !group.state?.error);
  const alertKey = alerts.map(group => group.arena.id).join('|');
  useEffect(() => { setCarouselIndex(0); }, [alertKey]);
  useEffect(() => { if (paused || hovered || alerts.length < 2) return; const timer = window.setInterval(() => { if (!document.hidden) setCarouselIndex(index => index + 1); }, 6000); return () => window.clearInterval(timer); }, [paused, hovered, alertKey]);
  const selectedAlert = alerts[carouselIndex % Math.max(1, alerts.length)];
  const viewArena = (arena: TenantConfig) => { selection.setDate(date); setTenantId(arena.id); setArenaSubTab('agendamentos'); setActiveTab('scheduler'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const selectSlot = (arena: TenantConfig, slot: AvailabilityCell) => {
    const court = arena.courts.find(c => c.id === slot.courtId);
    if (!court || slot.state !== 'free') return;
    selection.setDate(slot.date);
    setCheckout({ arena, courtId: court.id, courtName: court.name, date: slot.date, time: slot.startTime, endTime: slot.endTime, price: slot.price, sport: defaultSport === 'all' ? court.sports[0] : defaultSport });
  };
  const badRange = !!from && !!to && minutes(from) >= minutes(to);
  return <>
    {arenas.map(({ arena }) => <ArenaSubscription key={arena.id + ':' + date} arena={arena} date={date} receive={receive} />)}
    {(!homeTop || activeTab === 'home') && <section ref={section} data-nearby-availability className={'max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 ' + className} aria-label="Horários livres nas próximas horas">
      <div className="vacancy-promo rounded-3xl border border-cyan-400/50 bg-[#041529] p-4 sm:p-5 text-white space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm sm:text-base font-black uppercase text-amber-300"><Zap className="w-4 h-4 text-orange-500" />Horários livres nas próximas horas · Arenas próximas</h2>
          <button type="button" disabled={location.status === 'locating'} onClick={() => void location.request()} className="text-xs text-cyan-200 p-2 rounded-lg hover:bg-white/10">{location.status === 'locating' ? 'Localizando…' : 'Usar minha localização'}</button>
        </header>
        <div className="flex flex-wrap items-end gap-3 text-xs font-bold">
          <label className="space-y-1">Arena<select aria-label="Filtrar por arena" value={arenaFilter} onChange={event => setArenaFilter(event.target.value)} className="block max-w-full min-h-10 rounded-xl border border-cyan-700 bg-slate-900 px-3 py-2"><option value="all">Todas as arenas próximas</option>{arenas.map(({ arena }) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>
          <label className="space-y-1">Hora inicial<input aria-label="Hora inicial da busca" type="time" value={from} onChange={event => setFrom(event.target.value)} className="block min-h-10 rounded-xl border border-cyan-700 bg-slate-900 px-3 py-2 [color-scheme:dark]" /></label>
          <label className="space-y-1">Hora final<input aria-label="Hora final da busca" type="time" value={to} onChange={event => setTo(event.target.value)} className="block min-h-10 rounded-xl border border-cyan-700 bg-slate-900 px-3 py-2 [color-scheme:dark]" /></label>
          <button type="button" onClick={() => { setArenaFilter('all'); setFrom(''); setTo(''); }} className="min-h-10 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Limpar filtros</button>
          {!homeTop && <BookingDatePicker />}
        </div>
        <p className="text-[11px] text-slate-300">{coords ? 'Distâncias por coordenadas quando disponíveis.' : location.status === 'denied' ? 'Localização não autorizada ou indisponível. Distâncias de referência.' : 'Distâncias de referência; autorize a localização para calcular pelo GPS.'} {!from && !to ? 'Disponibilidade nas próximas 4 horas.' : 'Horários completos dentro do intervalo selecionado.'}</p>
        {BOOKING_DEMO && <p className="text-xs text-amber-300">Demonstração · dados locais, sem reservas ou cobranças reais.</p>}
        {badRange ? <p role="alert" className="text-amber-200 text-sm">A hora final precisa ser posterior à hora inicial.</p> : <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {shown.map(group => <ArenaMiniCard key={group.arena.id} {...group} onOpen={() => viewArena(group.arena)} onSelect={slot => selectSlot(group.arena, slot)} />)}
          {!shown.length && <p className="text-sm text-slate-300 p-3">Nenhum horário livre no intervalo e na região selecionados.</p>}
        </div>}
      </div>
    </section>}
    {homeTop && (activeTab !== 'home' || !visible) && selectedAlert && !dismissed && <aside aria-label="Carrossel de horários livres próximos" aria-roledescription="carrossel" className="fixed right-3 bottom-5 z-30 w-[min(320px,calc(100vw-24px))] max-h-[65dvh] overflow-y-auto rounded-2xl border border-cyan-400/60 bg-[#041529]/95 text-white shadow-2xl backdrop-blur-md"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHovered(false); }}>
      <div className="flex items-center justify-between px-3 pt-3 gap-2">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          {selectedAlert.free.some(cell => fresh[cell.id] > Date.now() - 300000)
            ? '🔥 Acabou de livrar horário!'
            : '⏰ Horários livres próximas horas'}
        </span>
        <button type="button" aria-label="Fechar horários laterais" onClick={() => setDismissed(true)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      {BOOKING_DEMO && <p className="px-3 text-[10px] text-amber-200">Demonstração · disponibilidade de exemplo</p>}
      <div className="p-2"><ArenaMiniCard {...selectedAlert} compact onOpen={() => viewArena(selectedAlert.arena)} onSelect={slot => selectSlot(selectedAlert.arena, slot)} /></div>
      <div className="flex justify-between items-center px-3 pb-3"><button type="button" aria-label="Arena anterior" onClick={() => setCarouselIndex(index => (index - 1 + alerts.length) % alerts.length)} className="p-2 rounded-lg hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button><span className="text-xs">{carouselIndex % alerts.length + 1} / {alerts.length}</span><button type="button" aria-label={paused ? 'Retomar carrossel' : 'Pausar carrossel'} onClick={() => setPaused(!paused)} className="p-2 rounded-lg hover:bg-white/10">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button><button type="button" aria-label="Próxima arena" onClick={() => setCarouselIndex(index => index + 1)} className="p-2 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button></div>
    </aside>}
    <QuickBookingPaymentModal slotData={checkout} onClose={closeCheckout} />
  </>;
}
function ArenaSubscription({ arena, date, receive }: { arena: TenantConfig; date: string; receive: (key: string, state: ArenaData) => void }) {
  const { cells, loading, error } = useArenaAvailability(arena, date);
  useEffect(() => { receive(arena.id + ':' + date, { cells, loading, error }); }, [arena.id, date, cells, loading, error, receive]);
  return null;
}
function ArenaMiniCard({ arena, distance, free, state, onOpen, onSelect, compact = false }: {
  arena: TenantConfig; distance: number; free: AvailabilityCell[]; state?: ArenaData; onOpen: () => void; onSelect: (cell: AvailabilityCell) => void; compact?: boolean;
}) {
  return <article onClick={onOpen} className={'rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-3 space-y-3 shadow-md cursor-pointer hover:border-cyan-300/60 ' + (compact ? 'w-full' : 'w-[300px] sm:w-[330px] shrink-0 snap-start')}>
    <button type="button" onClick={event => { event.stopPropagation(); onOpen(); }} className="w-full text-left space-y-1"><strong className="text-sm font-black block">{arena.name}</strong><span className="text-[10px] text-slate-300 flex items-center gap-1"><MapPin className="w-3 h-3" />{arena.city}/{arena.state} · {distance.toFixed(1)} km</span></button>
    {!state || state.loading ? <p role="status" className="text-xs text-slate-400">Consultando horários…</p> : state.error ? <p role="alert" className="text-xs text-amber-200">{state.error}</p> : <div className="space-y-2 max-h-56 overflow-y-auto">
      {arena.courts.map(court => { const slots = free.filter(cell => cell.courtId === court.id); return slots.length ? <div key={court.id} className="space-y-1.5 border-t border-white/10 pt-2"><h3 className="text-[11px] font-black text-cyan-200">{court.name}</h3><div className="flex flex-wrap gap-1.5">{slots.map(slot => <button key={slot.id} type="button" onClick={event => { event.stopPropagation(); onSelect(slot); }} className="rounded-lg border border-emerald-500/40 bg-black/30 px-2 py-2 text-left hover:bg-emerald-900/50 focus-visible:ring-2 focus-visible:ring-cyan-300"><strong className="block text-xs font-mono text-emerald-200">{slot.startTime}–{slot.endTime}</strong><span className="text-[10px] text-slate-200">R$ {slot.price.toFixed(2)}</span></button>)}</div></div> : null; })}
    </div>}
    <div className="flex justify-between gap-2 border-t border-white/10 pt-2 text-[10px]"><span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{free.length} horários livres</span><span className="text-orange-400 font-black">Ver Arena →</span></div>
  </article>;
}

import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { TenantConfig } from '../types';
import { addDays, arenaDate, buildArenaAvailability, type AvailabilityCell } from '../services/bookingAvailability';
import { getArenaSchedule } from '../services/db';
import { subscribeAvailability } from '../services/availabilityLive';
import { BOOKING_DEMO } from '../services/bookingMode';
export { BOOKING_DEMO };
const EMPTY_CELLS: AvailabilityCell[] = [];

export function useArenaAvailability(arena: TenantConfig, date: string, refreshKey = 0) {
  const { bookings, slots, tenant } = useApp();
  const queryKey = `${arena.id}:${date}`;
  const [state, setState] = useState({ queryKey: '', cells: EMPTY_CELLS, loading: true, error: '', maxDate: addDays(arenaDate(), 6) });
  useEffect(() => {
    if (BOOKING_DEMO) {
      setState({ queryKey, cells: buildArenaAvailability(arena, date, bookings, { slots: tenant.id === arena.id ? slots : undefined }), loading: false, error: '', maxDate: addDays(arenaDate(), 6) });
      return;
    }
    const controller = new AbortController();
    let revision = 0;
    let stream: ReturnType<typeof subscribeAvailability> | undefined;
    let running = false;
    const apply = (result: { cells: AvailabilityCell[]; maxDate: string; stale?: boolean }) => {
      if (!controller.signal.aborted) setState({ queryKey, cells: result.cells, maxDate: result.maxDate, loading: false,
        error: result.stale ? 'Agenda salva offline. Reconecte para confirmar a disponibilidade.' : '' });
    };
    const load = async (force = false) => {
      if (running || controller.signal.aborted) return;
      running = true;
      const requestRevision = revision;
      try {
        let result;
        try { result = await getArenaSchedule(arena, date, force); }
        catch {
          const response = await fetch(`/api/booking/availability?tenantId=${encodeURIComponent(arena.id)}&date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: 'no-store' });
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Agenda online indisponível. Tente novamente mais tarde.');
          result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a agenda.');
        }
        if (!Array.isArray(result.cells)) throw new Error('Resposta inválida da agenda.');
        if (requestRevision === revision) apply(result);
      } catch (error) {
        if (!controller.signal.aborted && requestRevision === revision) setState(prev => ({ ...prev, queryKey, cells: [], loading: false,
          error: error instanceof Error ? error.message : 'Não foi possível consultar a agenda.' }));
      } finally { running = false; }
    };
    setState(prev => ({ ...prev, queryKey, cells: [], loading: true, error: '' }));
    void load(refreshKey > 0);
    // Live server projection revalidates cache data; polling is only a disconnected fallback.
    try {
      stream = subscribeAvailability(arena.id, date, result => { revision++; apply(result); }, () => {
        revision++;
        setState(prev => ({ ...prev, cells: [], loading: false, error: 'A conexão com a agenda foi interrompida. Reconectando.' }));
      });
    } catch { /* polling remains available */ }
    const timer = window.setInterval(() => { if (!stream?.isConnected()) void load(true); }, 60_000);
    const onFocus = () => { if (!stream?.isConnected()) void load(true); };
    window.addEventListener('focus', onFocus);
    return () => { controller.abort(); stream?.unsubscribe(); window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [arena, date, bookings, slots, tenant.id, refreshKey]);
  return state.queryKey === queryKey ? state : { ...state, cells: EMPTY_CELLS, loading: true, error: '' };
}

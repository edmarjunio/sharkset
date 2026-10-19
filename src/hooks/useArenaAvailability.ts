import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { TenantConfig } from '../types';
import { addDays, arenaDate, buildArenaAvailability, type AvailabilityCell } from '../services/bookingAvailability';

// Demo data must be explicitly enabled; never fall back after a server error.
import { BOOKING_DEMO } from '../services/bookingMode';
export { BOOKING_DEMO };
const EMPTY_CELLS: AvailabilityCell[] = [];
export function useArenaAvailability(arena: TenantConfig, date: string, refreshKey = 0) {
  const { bookings, slots, tenant } = useApp();
  const queryKey = `${arena.id}:${date}`;
  const [state, setState] = useState<{ queryKey: string; cells: AvailabilityCell[]; loading: boolean; error: string; maxDate: string }>({ queryKey: '', cells: [], loading: true, error: '', maxDate: addDays(arenaDate(), 6) });
  useEffect(() => {
    if (BOOKING_DEMO) {
      setState({ queryKey, cells: buildArenaAvailability(arena, date, bookings, { slots: tenant.id === arena.id ? slots : undefined }), loading: false, error: '', maxDate: addDays(arenaDate(), 6) });
      return;
    }
    const controller = new AbortController();
    let sequence = 0;
    const load = async () => {
      const requestSequence = ++sequence;
      setState(prev => ({ ...prev, queryKey, cells: [], loading: true, error: '' }));
      try {
        const response = await fetch(`/api/booking/availability?tenantId=${encodeURIComponent(arena.id)}&date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a agenda.');
        if (!controller.signal.aborted && requestSequence === sequence) setState({ queryKey, cells: result.cells, loading: false, error: '', maxDate: result.maxDate });
      } catch (error) {
        if (!controller.signal.aborted && requestSequence === sequence) setState(prev => ({ ...prev, queryKey, cells: [], loading: false, error: error instanceof Error ? error.message : 'Falha ao consultar agenda.' }));
      }
    };
    void load();
    const stream = new EventSource('/api/booking/stream?tenantId=' + encodeURIComponent(arena.id) + '&date=' + encodeURIComponent(date));
    stream.addEventListener('availability', event => {
      if (controller.signal.aborted) return;
      try {
        const result = JSON.parse((event as MessageEvent).data);
        if (!Array.isArray(result.cells)) return;
        sequence++;
        setState({ queryKey, cells: result.cells, loading: false, error: '', maxDate: result.maxDate });
      } catch { setState(prev => ({ ...prev, queryKey, cells: EMPTY_CELLS, loading: false, error: 'Resposta inválida da agenda.' })); }
    });
    stream.addEventListener('availability-error', event => {
      if (controller.signal.aborted) return;
      sequence++;
      let error = 'Não foi possível atualizar a agenda.';
      try { error = JSON.parse((event as MessageEvent).data).error || error; } catch {}
      setState(prev => ({ ...prev, queryKey, cells: EMPTY_CELLS, loading: false, error }));
    });
    stream.onerror = () => { void load(); };
    const timer = window.setInterval(load, 60000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => { controller.abort(); stream.close(); window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [arena, date, bookings, slots, tenant.id, refreshKey]);
  return state.queryKey === queryKey ? state : { ...state, cells: EMPTY_CELLS, loading: true, error: '' };
}

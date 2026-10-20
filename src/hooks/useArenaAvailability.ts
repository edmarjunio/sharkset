import { useEffect, useState } from 'react';
import type { TenantConfig } from '../types';
import { addDays, arenaDate, type AvailabilityCell } from '../services/bookingAvailability';

// Return only availability received from the server; never synthesize free slots.
import { BOOKING_DEMO } from '../services/bookingMode';
export { BOOKING_DEMO };
const EMPTY_CELLS: AvailabilityCell[] = [];

export function useArenaAvailability(arena: TenantConfig, date: string, refreshKey = 0) {
  const queryKey = `${arena.id}:${date}`;
  const [state, setState] = useState<{ queryKey: string; cells: AvailabilityCell[]; loading: boolean; error: string; maxDate: string }>({
    queryKey: '',
    cells: [],
    loading: true,
    error: '',
    maxDate: addDays(arenaDate(), 6),
  });

  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    let stream: EventSource | null = null;
    const connectStream = () => {
      if (stream || controller.signal.aborted) return;
      try {
        stream = new EventSource('/api/booking/stream?tenantId=' + encodeURIComponent(arena.id) + '&date=' + encodeURIComponent(date));
        stream.addEventListener('availability', event => {
          if (controller.signal.aborted) return;
          try {
            const result = JSON.parse((event as MessageEvent).data);
            if (!Array.isArray(result.cells)) return;
            sequence++;
            setState({ queryKey, cells: result.cells, loading: false, error: '', maxDate: result.maxDate });
          } catch {
            // ignore stream parse failure on static host
          }
        });
        stream.addEventListener('availability-error', () => {
          if (stream) {
            stream.close();
            stream = null;
          }
        });
        stream.onerror = () => {
          if (stream) {
            stream.close();
            stream = null;
          }
        };
      } catch {
        // EventSource não suportado ou offline
      }
    };

    const load = async () => {
      const requestSequence = ++sequence;
      setState(prev => ({ ...prev, queryKey, cells: [], loading: true, error: '' }));
      try {
        const response = await fetch(
          `/api/booking/availability?tenantId=${encodeURIComponent(arena.id)}&date=${encodeURIComponent(date)}`,
          { signal: controller.signal, cache: 'no-store' }
        );
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          if (!controller.signal.aborted && requestSequence === sequence) {
            setState({ queryKey, cells: [], loading: false, error: 'Agenda indisponível: servidor não retornou dados reais.', maxDate: addDays(arenaDate(), 6) });
          }
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a agenda.');
        if (!controller.signal.aborted && requestSequence === sequence) {
          setState({ queryKey, cells: result.cells, loading: false, error: '', maxDate: result.maxDate });
          connectStream();
        }
      } catch {
        if (!controller.signal.aborted && requestSequence === sequence) {
          setState({ queryKey, cells: [], loading: false, error: 'Não foi possível consultar a agenda real. Tente novamente mais tarde.', maxDate: addDays(arenaDate(), 6) });
        }
      }
    };
    void load();

    const timer = window.setInterval(load, 60000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      controller.abort();
      if (stream) stream.close();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [arena, date, refreshKey]);

  return state.queryKey === queryKey ? state : { ...state, cells: EMPTY_CELLS, loading: true, error: '' };
}

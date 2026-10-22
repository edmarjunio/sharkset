import { createQueryResource } from './queryResource';
import { addDays, arenaDate, type AvailabilityCell } from './bookingAvailability';

type Availability = { cells: AvailabilityCell[]; maxDate: string };
const resources = new Map<string, ReturnType<typeof makeAvailabilityResource>>();

function makeAvailabilityResource(arenaId: string, date: string) {
  let stream: EventSource | undefined;
  let subscribers = 0;
  let heartbeat = 0;
  let eviction: ReturnType<typeof setTimeout> | undefined;
  const params = new URLSearchParams({ tenantId: arenaId, date });
  const close = () => { stream?.close(); stream = undefined; };
  const connect = () => {
    if (stream || !subscribers || typeof EventSource === 'undefined') return;
    stream = new EventSource(`/api/booking/stream?${params}`);
    stream.addEventListener('availability', event => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (!Array.isArray(data.cells) || typeof data.maxDate !== 'string') return;
        heartbeat = Date.now(); resource.publish(data);
      } catch { /* A malformed event cannot replace validated HTTP data. */ }
    });
    stream.addEventListener('availability-error', () => { close(); heartbeat = 0; resource.invalidate(); });
    stream.onerror = () => { close(); heartbeat = 0; };
  };
  const resource = createQueryResource<Availability>(async (signal): Promise<Availability> => {
    if (stream && Date.now() - heartbeat < 45_000 && resource.getSnapshot().data) return resource.getSnapshot().data!;
    const response = await fetch(`/api/booking/availability?${params}`, { signal, cache: 'no-store' });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Agenda indisponível: servidor não retornou dados reais.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a agenda.');
    if (!Array.isArray(data.cells) || typeof data.maxDate !== 'string') throw new Error('Resposta inválida da agenda.');
    connect();
    return data;
  }, { ttl: 60_000, maxAge: 120_000 });
  return {
    ...resource,
    subscribe(listener: () => void) {
      clearTimeout(eviction); subscribers++;
      const stop = resource.subscribe(listener);
      connect();
      return () => {
        stop(); subscribers--;
        if (!subscribers) {
          close(); heartbeat = 0; resource.cancel();
          eviction = setTimeout(() => { resource.clear(); resources.delete(`${arenaId}:${date}`); }, 120_000);
        }
      };
    },
  };
}

export function availabilityResource(arenaId: string, date: string) {
  const key = `${arenaId}:${date}`;
  let resource = resources.get(key);
  if (!resource) { resource = makeAvailabilityResource(arenaId, date); resources.set(key, resource); }
  return resource;
}
export const emptyAvailability = { cells: [] as AvailabilityCell[], maxDate: addDays(arenaDate(), 6) };

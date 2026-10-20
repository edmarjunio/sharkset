import type { AvailabilityCell } from './bookingAvailability';
export interface LiveAvailability { cells: AvailabilityCell[]; maxDate: string }

/** Share one live connection per arena/day across cards, schedule and checkout modal. */
export function createAvailabilitySubscriptions(createSource: (url: string) => EventSource = url => new EventSource(url)) {
  const connections = new Map<string, {
    source: EventSource; observers: Set<{ next: (value: LiveAvailability) => void; error: () => void }>;
    latest?: LiveAvailability;
  }>();
  return (arenaId: string, date: string, next: (value: LiveAvailability) => void, error: () => void) => {
    const key = `${arenaId}:${date}`;
    let connection = connections.get(key);
    if (!connection) {
      const source = createSource(`/api/booking/stream?tenantId=${encodeURIComponent(arenaId)}&date=${encodeURIComponent(date)}`);
      connection = { source, observers: new Set() };
      connections.set(key, connection);
      const current = connection;
      source.addEventListener('availability', event => {
        try {
          const value = JSON.parse((event as MessageEvent).data);
          if (!Array.isArray(value.cells) || typeof value.maxDate !== 'string') return;
          current.latest = value;
          current.observers.forEach(observer => observer.next(value));
        } catch { /* Invalid server event does not change availability. */ }
      });
      source.addEventListener('availability-error', () => {
        current.latest = undefined;
        current.observers.forEach(observer => observer.error());
      });
    }
    const observer = { next, error };
    connection.observers.add(observer);
    if (connection.latest) next(connection.latest);
    const current = connection;
    let released = false;
    return {
      isConnected: () => current.source.readyState === 1,
      unsubscribe: () => {
        if (released) return;
        released = true;
        current.observers.delete(observer);
        if (!current.observers.size) { current.source.close(); connections.delete(key); }
      },
    };
  };
}
export const subscribeAvailability = createAvailabilitySubscriptions();

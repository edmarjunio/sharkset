import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { TenantConfig } from '../types';
import { availabilityResource, emptyAvailability } from '../services/availabilityResources';
export { BOOKING_DEMO } from '../services/bookingMode';

export function useArenaAvailability(arena: TenantConfig, date: string, refreshKey = 0) {
  const resource = useMemo(() => availabilityResource(arena.id, date), [arena.id, date]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
  const previousRefresh = useRef(refreshKey);
  useEffect(() => {
    if (previousRefresh.current !== refreshKey) { previousRefresh.current = refreshKey; resource.invalidate(); }
  }, [resource, refreshKey]);
  const data = snapshot.data || emptyAvailability;
  return { ...data, queryKey: arena.id + ':' + date, loading: !snapshot.data && !snapshot.error, error: snapshot.error };
}

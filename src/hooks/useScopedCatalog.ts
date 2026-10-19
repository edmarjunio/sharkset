import { useMemo } from 'react';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { liveDistance, matchesLiveLocation, type LiveLocation } from '../services/liveDirectory';

export function useScopedCatalog<T>(items: T[], locationOf: (item: T) => LiveLocation) {
  const { filter } = useDirectoryScope();
  const { coords } = useBookingLocation();
  return useMemo(() => items.filter(item => {
    if (filter.mode === 'nearby' && !validCoordinates(coords)) return false;
    if (filter.mode === 'city' && !filter.city) return false;
    return matchesLiveLocation(locationOf(item), { ...filter, lat: coords?.lat, lng: coords?.lng });
  }).sort((a, b) => filter.mode === 'nearby' && coords ? (liveDistance(locationOf(a), coords.lat, coords.lng) ?? Infinity) - (liveDistance(locationOf(b), coords.lat, coords.lng) ?? Infinity) : 0), [items, locationOf, filter, coords]);
}

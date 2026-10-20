import { useEffect, useMemo } from 'react';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { liveDistance, matchesLiveLocation, type LiveLocation } from '../services/liveDirectory';

export interface ScopedLocation extends LiveLocation {
  distanceKm?: number;
}

export function useScopedCatalog<T>(items: T[], locationOf: (item: T) => ScopedLocation) {
  const { filter } = useDirectoryScope();
  const { coords, status, request } = useBookingLocation();

  useEffect(() => {
    if (filter.mode === 'nearby' && status === 'idle') {
      void request();
    }
  }, [filter.mode, status, request]);

  const maxRadiusKm = filter.radiusKm ?? 50;

  return useMemo(
    () =>
      items
        .filter((item) => {
          const loc = locationOf(item);
          if (filter.mode === 'city') {
            if (!filter.city) return false;
            return matchesLiveLocation(loc, filter);
          }
          if (filter.mode === 'nearby') {
            if (validCoordinates(coords)) {
              return matchesLiveLocation(loc, {
                ...filter,
                lat: coords.lat,
                lng: coords.lng,
                radiusKm: maxRadiusKm,
              });
            }
            if (typeof loc.distanceKm === 'number' && Number.isFinite(loc.distanceKm)) {
              return loc.distanceKm <= maxRadiusKm;
            }
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (filter.mode !== 'nearby') return 0;
          const locA = locationOf(a);
          const locB = locationOf(b);
          if (validCoordinates(coords)) {
            const distA = liveDistance(locA, coords.lat, coords.lng) ?? locA.distanceKm ?? Infinity;
            const distB = liveDistance(locB, coords.lat, coords.lng) ?? locB.distanceKm ?? Infinity;
            return distA - distB;
          }
          return (locA.distanceKm ?? Infinity) - (locB.distanceKm ?? Infinity);
        }),
    [items, locationOf, filter, coords, maxRadiusKm]
  );
}

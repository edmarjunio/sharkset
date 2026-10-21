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
    () => {
      const filtered = items.filter((item) => {
        const loc = locationOf(item);
        if (filter.mode === 'city') {
          // Se nenhuma cidade estiver filtrada, exibe todas as opções disponíveis
          if (!filter.city) return true;
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
          return true;
        }
        return true;
      });

      // No modo "Perto de mim", se nenhuma arena estiver dentro do raio estrito selecionado,
      // não deixa a tela zerada: exibe as arenas mais próximas da localização do usuário!
      const effectiveItems =
        filter.mode === 'nearby' && filtered.length === 0 && items.length > 0
          ? [...items]
          : filtered;

      // Ordena por proximidade (mais próxima primeiro)
      return effectiveItems.sort((a, b) => {
        if (filter.mode !== 'nearby') return 0;
        const locA = locationOf(a);
        const locB = locationOf(b);
        if (validCoordinates(coords)) {
          const distA =
            liveDistance(locA, coords.lat, coords.lng) ??
            (typeof locA.distanceKm === 'number' ? locA.distanceKm : Infinity);
          const distB =
            liveDistance(locB, coords.lat, coords.lng) ??
            (typeof locB.distanceKm === 'number' ? locB.distanceKm : Infinity);
          return distA - distB;
        }
        return (locA.distanceKm ?? Infinity) - (locB.distanceKm ?? Infinity);
      });
    },
    [items, locationOf, filter, coords, maxRadiusKm]
  );
}

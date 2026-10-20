import { SportType, TenantConfig } from '../types';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type GeoCoordinates = Coordinates;

export type ArenaWithCalculatedDistance<T extends TenantConfig = TenantConfig> = T & {
  calculatedDistanceKm: number;
};

// Default base reference: Mineiros, Goiás (GMT-3)
export const DEFAULT_BASE_COORDS: Coordinates = {
  lat: -17.5689,
  lng: -52.5812,
};

export const DEFAULT_BASE_COORDINATES: Coordinates = DEFAULT_BASE_COORDS;

/**
 * Validates whether a coordinate pair contains finite latitude [-90, 90] and longitude [-180, 180].
 */
export function isValidGeoCoordinates(
  coords: Coordinates | null | undefined
): coords is Coordinates {
  return (
    Boolean(coords) &&
    typeof coords!.lat === 'number' &&
    Number.isFinite(coords!.lat) &&
    Math.abs(coords!.lat) <= 90 &&
    typeof coords!.lng === 'number' &&
    Number.isFinite(coords!.lng) &&
    Math.abs(coords!.lng) <= 180
  );
}

/**
 * Calculates real-world distance in kilometers between two GPS coordinates using the spherical Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusKm * c;
  return Math.round(distance * 10) / 10;
}

export const calculateHaversineDistance = calculateHaversineDistanceKm;

/**
 * Calculates distance in kilometers from the user's coordinates to a target arena.
 * Falls back to the arena's reference `distanceKm` (or Infinity) when GPS coordinates are unavailable.
 */
export function getArenaDistanceKm(
  arena: Pick<TenantConfig, 'lat' | 'lng' | 'distanceKm'>,
  userCoords?: Coordinates | null
): number {
  const arenaCoords =
    typeof arena.lat === 'number' && typeof arena.lng === 'number'
      ? { lat: arena.lat, lng: arena.lng }
      : null;

  if (isValidGeoCoordinates(userCoords) && isValidGeoCoordinates(arenaCoords)) {
    return calculateHaversineDistanceKm(
      userCoords.lat,
      userCoords.lng,
      arenaCoords.lat,
      arenaCoords.lng
    );
  }

  return typeof arena.distanceKm === 'number' && Number.isFinite(arena.distanceKm)
    ? arena.distanceKm
    : Infinity;
}

export const calculateArenaDistanceFromUser = getArenaDistanceKm;

/**
 * Attaches `calculatedDistanceKm` to each arena and sorts the collection by proximity (closest first).
 */
export function sortArenasByProximity<T extends TenantConfig>(
  arenas: T[],
  userCoords?: Coordinates | null
): Array<ArenaWithCalculatedDistance<T>> {
  return arenas
    .map((arena) => ({
      ...arena,
      calculatedDistanceKm: getArenaDistanceKm(arena, userCoords),
    }))
    .sort((a, b) => {
      if (a.calculatedDistanceKm !== b.calculatedDistanceKm) {
        return a.calculatedDistanceKm - b.calculatedDistanceKm;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
}

/**
 * Filters arenas by radius, sport, and search query, and returns them ordered by proximity.
 */
export function filterAndSortArenasByProximity<T extends TenantConfig>(
  arenas: T[],
  options: {
    userCoords?: Coordinates | null;
    maxRadiusKm?: number | null;
    sport?: SportType | 'all';
    searchQuery?: string;
  } = {}
): Array<ArenaWithCalculatedDistance<T>> {
  const { userCoords, maxRadiusKm, sport = 'all', searchQuery = '' } = options;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return sortArenasByProximity(arenas, userCoords).filter((arena) => {
    if (
      typeof maxRadiusKm === 'number' &&
      Number.isFinite(maxRadiusKm) &&
      maxRadiusKm > 0 &&
      arena.calculatedDistanceKm > maxRadiusKm
    ) {
      return false;
    }

    if (sport !== 'all') {
      const hasSport = arena.courts.some((court) => court.sports.includes(sport));
      if (!hasSport) return false;
    }

    if (normalizedQuery) {
      const matchName = arena.name.toLowerCase().includes(normalizedQuery);
      const matchCity = arena.city.toLowerCase().includes(normalizedQuery);
      const matchAddress = arena.address.toLowerCase().includes(normalizedQuery);
      if (!matchName && !matchCity && !matchAddress) return false;
    }

    return true;
  });
}

/**
 * Filters and sorts arenas by proximity within a given radius (in km).
 */
export function filterArenasByGeolocation(
  arenas: TenantConfig[],
  userCoords?: Coordinates | null,
  maxRadiusKm = 50
): Array<ArenaWithCalculatedDistance<TenantConfig>> {
  return filterAndSortArenasByProximity(arenas, {
    userCoords,
    maxRadiusKm,
  });
}

/**
 * Formats a calculated distance in kilometers for display in UI badges.
 */
export function formatArenaDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) {
    return 'Distância não informada';
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Requests browser geolocation with a Promise wrapper.
 */
export function requestBrowserGeolocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

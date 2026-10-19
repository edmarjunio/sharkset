import { TenantConfig } from '../types';

export interface Coordinates {
  lat: number;
  lng: number;
}

// Default base reference: Mineiros, Goiás (GMT-3)
export const DEFAULT_BASE_COORDS: Coordinates = {
  lat: -17.5689,
  lng: -52.5812,
};

/**
 * Calculates real-world distance in km using the spherical Haversine formula
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Calculates distance from user coordinates to an arena.
 * If user coordinates are absent or arena has no coordinates, falls back to arena's default distanceKm.
 */
export function getArenaDistanceKm(
  arena: TenantConfig,
  userCoords?: Coordinates | null
): number {
  if (!userCoords || !arena.lat || !arena.lng) {
    return arena.distanceKm || 2.0;
  }
  return calculateHaversineDistanceKm(
    userCoords.lat,
    userCoords.lng,
    arena.lat,
    arena.lng
  );
}

/**
 * Requests browser geolocation with a clean Promise and fallback
 */
export function requestBrowserGeolocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
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

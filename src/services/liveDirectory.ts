import { calculateHaversineDistance } from '../utils/geoUtils';

export interface LiveLocation { city?: string; state?: string; lat?: number; lng?: number }
export const normalizeCity = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function liveDistance(location: LiveLocation, lat: number, lng: number): number | null {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat!) > 90 || Math.abs(location.lng!) > 180) return null;
  return calculateHaversineDistance(lat, lng, location.lat!, location.lng!);
}
export function matchesLiveLocation(
  location: LiveLocation,
  filter: { mode: string; city?: string; state?: string; lat?: number; lng?: number; radiusKm?: number }
) {
  if (filter.mode === 'all') return true;
  if (filter.mode === 'city') {
    return (
      normalizeCity(location.city || '') === normalizeCity(filter.city || '') &&
      (!filter.state || normalizeCity(location.state || '') === normalizeCity(filter.state))
    );
  }
  const maxRadiusKm = typeof filter.radiusKm === 'number' && filter.radiusKm > 0 ? filter.radiusKm : 50;
  const distance = liveDistance(location, filter.lat!, filter.lng!);
  return distance !== null && distance <= maxRadiusKm;
}

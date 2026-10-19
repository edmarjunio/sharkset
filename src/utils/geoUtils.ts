/**
 * Geolocation & Distance Calculation Utilities
 * Implements the Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

// Default reference coordinates for Mineiros, Goiás (Tenant 0 base)
export const DEFAULT_BASE_COORDINATES: GeoCoordinates = {
  lat: -17.5689,
  lng: -52.5812,
};

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's mean radius in km
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

  // Round to 1 decimal place (e.g. 1.8 km)
  return Math.round(distance * 10) / 10;
}

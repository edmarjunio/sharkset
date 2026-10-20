import { create } from 'zustand';
import { requestBrowserGeolocation } from '../services/geoService';
import type { GeoCoordinates } from '../utils/geoUtils';

export const validCoordinates = (coords: GeoCoordinates | null | undefined): coords is GeoCoordinates => !!coords &&
  Number.isFinite(coords.lat) && Math.abs(coords.lat) <= 90 && Number.isFinite(coords.lng) && Math.abs(coords.lng) <= 180;
export const useBookingLocation = create<{
  coords: GeoCoordinates | null; status: 'idle' | 'locating' | 'granted' | 'denied';
  setCoords: (coords: GeoCoordinates | null) => void; request: () => Promise<void>;
}>((set, get) => ({
  coords: null, status: 'idle',
  setCoords: coords => set({ coords: validCoordinates(coords) ? coords : null, status: validCoordinates(coords) ? 'granted' : 'denied' }),
  request: async () => {
    if (get().status === 'locating') return;
    set({ status: 'locating' });
    try { get().setCoords(await requestBrowserGeolocation()); }
    catch { set({ coords: null, status: 'denied' }); }
  },
}));

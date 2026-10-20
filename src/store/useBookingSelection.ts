import { create } from 'zustand';
import { arenaDate } from '../services/bookingAvailability';

export const useBookingSelection = create<{ date: string; setDate: (date: string) => void }>(set => ({
  date: arenaDate(), setDate: date => set({ date }),
}));

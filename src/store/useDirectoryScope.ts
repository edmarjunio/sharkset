import { create } from 'zustand';

export interface DirectoryScope {
  mode: 'nearby' | 'city' | 'all';
  city: string;
  state: string;
  radiusKm?: number;
}

export const useDirectoryScope = create<{
  filter: DirectoryScope;
  setFilter: (filter: DirectoryScope) => void;
  setRadiusKm: (radiusKm: number) => void;
}>((set) => ({
  filter: { mode: 'nearby', city: '', state: '', radiusKm: 50 },
  setFilter: (filter) =>
    set((state) => ({
      filter: {
        ...filter,
        radiusKm: filter.radiusKm ?? state.filter.radiusKm ?? 50,
      },
    })),
  setRadiusKm: (radiusKm) =>
    set((state) => ({
      filter: { ...state.filter, radiusKm },
    })),
}));

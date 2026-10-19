import { create } from 'zustand';

export interface DirectoryScope { mode: 'nearby' | 'city' | 'all'; city: string; state: string }
export const useDirectoryScope = create<{ filter: DirectoryScope; setFilter: (filter: DirectoryScope) => void }>(set => ({
  filter: { mode: 'nearby', city: '', state: '' },
  setFilter: filter => set({ filter }),
}));

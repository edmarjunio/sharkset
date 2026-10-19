import { create } from 'zustand';

export type WatchSource = { kind: 'published' | 'booking' | 'match'; id: string; tournamentId?: string };
interface BroadcastNavigation {
  source: WatchSource | null;
  open: (source: WatchSource) => void;
  close: () => void;
}
export const useBroadcastNavigation = create<BroadcastNavigation>(set => ({
  source: null,
  open: source => set({ source }),
  close: () => set({ source: null }),
}));

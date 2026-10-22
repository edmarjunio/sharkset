import { useCallback, useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import { rankingCatalog } from '../services/catalogResources';

export function useRankingAthletes() {
  const { athletes } = useApp();
  const snapshot = useSyncExternalStore(rankingCatalog.subscribe, rankingCatalog.getSnapshot);
  const refresh = useCallback(() => rankingCatalog.refresh(true), []);
  return { sourceAthletes: snapshot.data?.length ? snapshot.data : athletes, isLoading: snapshot.loading, refresh };
}

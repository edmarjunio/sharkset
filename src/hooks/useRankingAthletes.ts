import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchTopAthletesFromFirestore } from '../lib/firebase';
import type { AthleteProfile } from '../types';

/** Home and ranking use the same source and local fallback. */
export function useRankingAthletes() {
  const { athletes } = useApp();
  const [remote, setRemote] = useState<AthleteProfile[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    setIsLoading(true);
    try {
      const result = await fetchTopAthletesFromFirestore(100);
      if (request === revision.current) setRemote(result.length ? result : null);
    } catch {
      if (request === revision.current) setRemote(null);
    } finally {
      if (request === revision.current) setIsLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); return () => { revision.current++; }; }, [refresh, athletes]);
  return { sourceAthletes: remote || athletes, isLoading, refresh };
}

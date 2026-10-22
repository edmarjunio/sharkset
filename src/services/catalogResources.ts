import { fetchArenasFromFirestore, fetchTournamentsFromFirestore, fetchTopAthletesFromFirestore, auth } from '../lib/firebase';
import { createQueryResource } from './queryResource';
import { onAuthStateChanged } from 'firebase/auth';

export const arenaCatalog = createQueryResource(() => fetchArenasFromFirestore(), { ttl: 300_000, maxAge: 1_800_000 });
export const tournamentCatalog = createQueryResource(() => fetchTournamentsFromFirestore(), { ttl: 120_000, maxAge: 600_000 });
export const rankingCatalog = createQueryResource(() => fetchTopAthletesFromFirestore(100), { ttl: 60_000, maxAge: 300_000 });

// The existing ranking query is owner-scoped; never retain it across account switches.
onAuthStateChanged(auth, () => { rankingCatalog.clear(); rankingCatalog.invalidate(); });

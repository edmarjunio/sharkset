import { collection, doc, getDocsFromServer, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import { ATHLETE_TIERS, getInitialFloorPointsForLevel } from './rankingValidator';
import type { AthleteLevel, AthleteProfile } from '../types';

export interface AccountProfile {
  name: string; phone: string; level: AthleteLevel | null; initialLevel?: AthleteLevel;
}
export function watchAccountProfile(uid: string, update: (profile: AccountProfile, athlete: AthleteProfile | null) => void, fail: (error: unknown) => void) {
  let profile: Record<string, any> | null = null, records: AthleteProfile[] = [];
  let profileReady = false, athletesReady = false;
  const emit = () => {
    if (!profileReady || !athletesReady) return;
    const athlete = records.find(record => record.id === uid) || (records.length === 1 ? records[0] : null);
    if (!athlete && records.length > 1) { fail(new Error('Há mais de uma ficha vinculada à conta. A organização precisa revisar o vínculo.')); return; }
    update({ name: profile?.displayName || auth.currentUser?.displayName || '', phone: auth.currentUser?.phoneNumber || '',
      level: athlete?.level || profile?.level || null, initialLevel: profile?.initialLevel || profile?.level || athlete?.level }, athlete);
  };
  const stopProfile = onSnapshot(doc(db, 'user_profiles', uid), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.exists() && snapshot.metadata.fromCache) return;
    profile = snapshot.data() || null; profileReady = true; emit();
  }, fail);
  const stopAthlete = onSnapshot(query(collection(db, 'athletes_public'), where('ownerId', '==', uid)), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.empty && snapshot.metadata.fromCache) return;
    records = snapshot.docs.map(item => ({ ...item.data(), id: item.id, phone: '', preferredSport: item.data().preferredSport || 'futevolei' } as AthleteProfile));
    athletesReady = true; emit();
  }, fail);
  return () => { stopProfile(); stopAthlete(); };
}

/** A single server transaction binds the permanent first category to the authenticated account. */
export async function registerInitialCategory(level: AthleteLevel) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Entre com uma conta Google verificada para definir sua categoria.');
  if (!ATHLETE_TIERS.some(tier => tier.level === level)) throw new Error('Categoria inválida.');
  const owned = await getDocsFromServer(query(collection(db, 'athletes_public'), where('ownerId', '==', user.uid)));
  await runTransaction(db, async tx => {
    const profileRef = doc(db, 'user_profiles', user.uid), athleteRef = doc(db, 'athletes_public', user.uid);
    const [profile, athlete] = await Promise.all([tx.get(profileRef), tx.get(athleteRef)]);
    if (profile.exists()) {
      if ((profile.data().initialLevel || profile.data().level) !== level) throw new Error('Sua categoria inicial já está fixada. A evolução ocorre automaticamente por MMR.');
      return; // Safe retry: never reset accumulated MMR or statistics.
    }
    if (athlete.exists() || !owned.empty) throw new Error('Esta conta já possui categoria registrada. Recarregue sua ficha; não é permitido refazer o cadastro.');
    const name = (user.displayName || 'Atleta SHARKSET').slice(0, 120);
    tx.set(profileRef, { id: user.uid, ownerId: user.uid, displayName: name, email: user.email,
      photoURL: user.photoURL || '', level, initialLevel: level, categoryLockedAt: serverTimestamp(), experienceCategory: 'amador', role: 'athlete' });
    tx.set(athleteRef, { id: user.uid, ownerId: user.uid, name, level, highestHistoricalLevel: level,
      points: getInitialFloorPointsForLevel(level), wins: 0, matchesPlayed: 0, titlesCount: 0,
      levelMatches: 0, levelWins: 0, levelPoints: 0, experienceCategory: 'amador',
      country: 'Não informado', state: '--', city: 'Não informado', arenaId: 'unassigned', arenaName: '' });
  });
}

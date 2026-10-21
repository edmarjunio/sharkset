import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import {
  AcademyPost,
  AthleteProfile,
  DiscountCoupon,
  MatchMvpVoteRecord,
  TenantConfig,
  Tournament,
  BracketMatch,
  BracketSource,
  TeamPair,
} from '../types';
import {
  app,
  db,
  auth,
  googleProvider,
  enableFirestoreOfflinePersistence,
  offlinePersistenceReady,
  isOfflinePersistenceEnabled,
} from '../firebase-config';

export {
  app,
  db,
  auth,
  googleProvider,
  enableFirestoreOfflinePersistence,
  offlinePersistenceReady,
  isOfflinePersistenceEnabled,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  operationType: OperationType;
  collection: string | null;
  errorCode: string;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errorCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || 'unknown')
      : 'unknown';
  const errInfo: FirestoreErrorInfo = {
    operationType,
    collection: path?.split('/')[0] || null,
    errorCode,
  };
  console.error('Firestore operation failed:', JSON.stringify(errInfo));
  throw new Error(`Firestore ${operationType} failed (${errorCode}).`);
}

/**
 * Validates connection to Firestore on boot without blocking UI rendering (Zero Loading Screen).
 */
export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithGoogleRedirect() {
  return signInWithRedirect(auth, googleProvider);
}

export async function getGoogleRedirectResult() {
  return getRedirectResult(auth);
}

export async function signOutFirebase() {
  return signOut(auth);
}

export interface UserProfileDocument {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phone?: string;
  level?: AthleteProfile['level'];
  experienceCategory?: 'amador' | 'profissional';
  role: 'athlete';
  ownerId: string;
}

/**
 * Loads the authenticated user's profile from the Firestore source of truth.
 */
export async function getUserProfileFromFirestore(uid: string): Promise<UserProfileDocument | null> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) return null;

  const profileRef = doc(db, 'user_profiles', uid);
  try {
    const profileSnapshot = await getDoc(profileRef);
    if (!profileSnapshot.exists()) return null;

    const data = profileSnapshot.data();
    if (data.ownerId !== uid || data.id !== uid || data.role !== 'athlete') return null;
    const allowedLevels: AthleteProfile['level'][] = [
      'iniciante',
      'serie_c',
      'serie_b',
      'serie_a',
      'profissional',
    ];
    if (data.level !== undefined && !allowedLevels.includes(data.level as AthleteProfile['level'])) return null;

    return {
      id: uid,
      displayName: String(data.displayName || currentUser.displayName || 'Atleta').slice(0, 120),
      email: String(data.email || currentUser.email || '').slice(0, 160),
      ...(typeof data.photoURL === 'string' ? { photoURL: data.photoURL.slice(0, 500) } : {}),
      ...(typeof data.phone === 'string' ? { phone: data.phone.slice(0, 30) } : {}),
      ...(data.level && allowedLevels.includes(data.level as AthleteProfile['level'])
        ? { level: data.level as AthleteProfile['level'] }
        : {}),
      ...(data.experienceCategory === 'amador' || data.experienceCategory === 'profissional'
        ? { experienceCategory: data.experienceCategory }
        : {}),
      role: 'athlete',
      ownerId: uid,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `user_profiles/${uid}`);
  }
}

/**
 * Creates or updates the authenticated user's own profile. Privileged roles are never client-writable.
 */
export async function persistUserProfileToFirestore(profile: {
  displayName: string;
  phone: string;
  level: AthleteProfile['level'] | null;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified || !currentUser.email) return;

  const cleanName = profile.displayName.trim().slice(0, 120);
  if (!cleanName) throw new Error('O nome do perfil não pode ficar vazio.');
  const allowedLevels: AthleteProfile['level'][] = [
    'iniciante',
    'serie_c',
    'serie_b',
    'serie_a',
    'profissional',
  ];
  if (profile.level && !allowedLevels.includes(profile.level)) throw new Error('Nível de atleta inválido.');

  const path = `user_profiles/${currentUser.uid}`;
  try {
    const profileRef = doc(db, 'user_profiles', currentUser.uid);
    const existing = await getDoc(profileRef);
    if (existing.exists() && existing.data().ownerId !== currentUser.uid) {
      throw new Error('O perfil encontrado não pertence à conta autenticada.');
    }

    await setDoc(
      profileRef,
      {
        id: currentUser.uid,
        displayName: cleanName,
        email: String(existing.exists() ? existing.data().email : currentUser.email).slice(0, 160),
        ...(currentUser.photoURL ? { photoURL: currentUser.photoURL.slice(0, 500) } : {}),
        ...(profile.phone.trim() ? { phone: profile.phone.trim().slice(0, 30) } : {}),
        ...(profile.level ? { level: profile.level } : {}),
        role: existing.exists() && existing.data().role === 'admin' ? 'admin' : 'athlete',
        ownerId: currentUser.uid,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Non-blocking Firestore persistence helpers (FinOps-aware: writes only when user is authenticated & verified).
 */
export async function persistBookingToFirestore(booking: {
  id: string;
  tenantId: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  sport: string;
  customerName: string;
  price: number;
  status: 'confirmed' | 'cancelled';
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = booking.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `bookings/${cleanId}`;
  try {
    await setDoc(doc(db, 'bookings', cleanId), {
      id: cleanId,
      tenantId: booking.tenantId.slice(0, 64),
      courtId: booking.courtId.slice(0, 64),
      courtName: booking.courtName.slice(0, 120),
      date: booking.date.slice(0, 20),
      startTime: booking.startTime.slice(0, 10),
      endTime: booking.endTime.slice(0, 10),
      sport: booking.sport,
      customerName: booking.customerName.slice(0, 120),
      price: Number(booking.price) || 0,
      status: booking.status,
      ownerId: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistNotificationToFirestore(notif: {
  id: string;
  type:
    | 'vacant_2h'
    | 'waitlist_freed'
    | 'match_10pts_left'
    | 'booking_15min'
    | 'tuition_due_today'
    | 'tuition_due_2days'
    | 'match_starting'
    | 'match_modified'
    | 'tournament_started'
    | 'bracket_result_published';
  title: string;
  body: string;
  recipientName?: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = notif.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `notifications/${cleanId}`;
  try {
    await setDoc(doc(db, 'notifications', cleanId), {
      id: cleanId,
      type: notif.type,
      title: notif.title.slice(0, 160),
      body: notif.body.slice(0, 400),
      recipientName: (notif.recipientName || 'Atleta SHARK SET').slice(0, 120),
      ownerId: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Listens in real time to Firestore notifications for the authenticated player.
 * Alerts immediately when a match on a specific court is about to start or has been modified.
 * Follows zero-trust error logging with handleFirestoreError.
 */
export function listenToPlayerNotifications(
  onUpdate: (
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      recipientName?: string;
    }>
  ) => void
): () => void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return () => {};
  }

  const path = 'notifications';
  try {
    const collRef = collection(db, path);
    const q = query(collRef, where('ownerId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Array<{
          id: string;
          type: string;
          title: string;
          body: string;
          recipientName?: string;
        }> = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: d.id || docSnap.id,
            type: d.type,
            title: d.title,
            body: d.body,
            recipientName: d.recipientName,
          });
        });
        onUpdate(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Helper to notify players via Firestore when a match is called to court or has its court/time modified.
 */
export async function notifyMatchScheduleEvent(params: {
  matchNumber: number;
  courtName: string;
  scheduledTime: string;
  team1Names: string;
  team2Names: string;
  tournamentName: string;
  eventType: 'match_starting' | 'match_modified';
}): Promise<string> {
  const isStarting = params.eventType === 'match_starting';
  const title = isStarting
    ? `🚨 Quadra Chamada! Jogo #${params.matchNumber} na ${params.courtName}`
    : `⚠️ Horário/Quadra Alterado: Jogo #${params.matchNumber}`;

  const body = isStarting
    ? `Atenção ${params.team1Names} e ${params.team2Names}: Dirijam-se imediatamente à ${params.courtName}. Horário: ${params.scheduledTime} (${params.tournamentName}).`
    : `O Jogo #${params.matchNumber} (${params.team1Names} vs ${params.team2Names}) foi remarcado para ${params.scheduledTime} na ${params.courtName}.`;

  const notifId = `match-notif-${Date.now()}-${params.matchNumber}`;

  await persistNotificationToFirestore({
    id: notifId,
    type: params.eventType,
    title,
    body,
    recipientName: `${params.team1Names} / ${params.team2Names}`,
  });

  return `${title} • ${body}`;
}

/**
 * Fetches top-performing players from the Firestore database (athletes_public collection).
 * Follows zero-trust error logging with handleFirestoreError.
 */
export async function fetchTopAthletesFromFirestore(
  limitCount = 50
): Promise<AthleteProfile[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return [];
  }
  const path = 'athletes_public';
  try {
    const collRef = collection(db, path);
    const q = query(collRef, where('ownerId', '==', currentUser.uid), limit(limitCount));

    const snap = await getDocs(q);
    if (snap.empty) {
      return [];
    }

    const items: AthleteProfile[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({
        id: data.id || docSnap.id,
        name: data.name || 'Atleta SHARK SET',
        phone: '(64) 99999-0000',
        level: data.level || 'serie_c',
        lastMatchAt: data.lastMatchAt,
        rankingInactive: data.rankingInactive,
        highestHistoricalLevel: data.highestHistoricalLevel,
        levelMatches: data.levelMatches,
        levelWins: data.levelWins,
        levelPoints: data.levelPoints,
        experienceCategory: data.experienceCategory || 'amador',
        points: Number(data.points) || 0,
        wins: Number(data.wins) || 0,
        matchesPlayed: Number(data.matchesPlayed) || 0,
        titlesCount: Number(data.titlesCount) || 0,
        country: data.country || 'Brasil',
        state: data.state || 'GO',
        city: data.city || 'Mineiros',
        arenaId: data.arenaId || '',
        arenaName: data.arenaName || 'SHARK SET Arena',
        preferredSport: 'futevolei',
      });
    });

    items.sort((a, b) => (b.points || 0) - (a.points || 0));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Persists an athlete public ranking profile to Firestore.
 */
export async function persistAthleteToFirestore(athlete: AthleteProfile): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = athlete.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `athletes_public/${cleanId}`;
  try {
    await setDoc(doc(db, 'athletes_public', cleanId), {
      id: cleanId,
      name: athlete.name.slice(0, 120),
      level: athlete.level,
      ...(athlete.lastMatchAt ? { lastMatchAt: athlete.lastMatchAt } : {}),
      rankingInactive: athlete.rankingInactive || false,
      highestHistoricalLevel: athlete.highestHistoricalLevel || athlete.level,
      levelMatches: athlete.levelMatches || 0,
      levelWins: athlete.levelWins || 0,
      levelPoints: athlete.levelPoints || 0,
      experienceCategory: athlete.experienceCategory || 'amador',
      points: Number(athlete.points) || 0,
      wins: Number(athlete.wins) || 0,
      matchesPlayed: Number(athlete.matchesPlayed) || 0,
      titlesCount: Number(athlete.titlesCount) || 0,
      country: (athlete.country || 'Brasil').slice(0, 60),
      state: (athlete.state || 'GO').slice(0, 10),
      city: (athlete.city || 'Mineiros').slice(0, 80),
      arenaId: (athlete.arenaId || '').slice(0, 64),
      arenaName: (athlete.arenaName || 'SHARK SET Arena Matriz').slice(0, 120),
      ownerId: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Seeds a batch of athletes to Firestore under the authenticated user's ID.
 */
export async function seedAthletesToFirestore(athletes: AthleteProfile[]): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Usuário precisa estar autenticado e verificado com Google para sincronizar com o Firestore.');
  }

  let count = 0;
  for (const ath of athletes) {
    await persistAthleteToFirestore(ath);
    count++;
  }
  return count;
}

const LOCAL_MVP_VOTES_KEY = 'sharkset_v2_mvp_votes';

const EMPTY_LOCAL_MVP_VOTES: MatchMvpVoteRecord[] = [];

export function getLocalMvpVotes(): MatchMvpVoteRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_MVP_VOTES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_MVP_VOTES_KEY, JSON.stringify(EMPTY_LOCAL_MVP_VOTES));
      return EMPTY_LOCAL_MVP_VOTES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY_LOCAL_MVP_VOTES;
  } catch {
    return EMPTY_LOCAL_MVP_VOTES;
  }
}

export function saveLocalMvpVote(vote: MatchMvpVoteRecord): MatchMvpVoteRecord[] {
  const existing = getLocalMvpVotes();
  const updated = [vote, ...existing.filter((v) => v.id !== vote.id)];
  try {
    localStorage.setItem(LOCAL_MVP_VOTES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota
  }
  return updated;
}

/**
 * Persists an MVP Vote at the end of a match to Firestore (/match_mvp_votes/{voteId})
 * and synchronizes with local cache for instant UI feedback.
 */
export async function persistMvpVoteToFirestore(vote: {
  id: string;
  matchId: string;
  tournamentId: string;
  tournamentName?: string;
  playerName: string;
  pairNames: string;
  voterName: string;
  votedAt?: string;
}): Promise<MatchMvpVoteRecord> {
  const cleanId = vote.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `mvp-${Date.now()}`;
  const votedAtStr = (vote.votedAt || new Date().toLocaleString('pt-BR')).slice(0, 40);
  const record: MatchMvpVoteRecord = {
    id: cleanId,
    matchId: vote.matchId.slice(0, 64),
    tournamentId: vote.tournamentId.slice(0, 64),
    tournamentName: (vote.tournamentName || 'Torneio Oficial SHARK SET').slice(0, 120),
    playerName: vote.playerName.slice(0, 120),
    pairNames: vote.pairNames.slice(0, 160),
    voterName: (vote.voterName || 'Atleta SHARK SET').slice(0, 120),
    votedAt: votedAtStr,
    ownerId: auth.currentUser?.uid || 'local-user',
  };

  saveLocalMvpVote(record);

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return record;
  }

  const path = `match_mvp_votes/${cleanId}`;
  try {
    await setDoc(doc(db, 'match_mvp_votes', cleanId), {
      id: record.id,
      matchId: record.matchId,
      tournamentId: record.tournamentId,
      tournamentName: record.tournamentName,
      playerName: record.playerName,
      pairNames: record.pairNames,
      voterName: record.voterName,
      votedAt: record.votedAt,
      ownerId: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  return record;
}

/**
 * Fetches MVP votes from Firestore (/match_mvp_votes) merged with local votes.
 */
export async function fetchMvpVotesFromFirestore(matchId?: string): Promise<MatchMvpVoteRecord[]> {
  const localVotes = getLocalMvpVotes();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return matchId ? localVotes.filter((v) => v.matchId === matchId) : localVotes;
  }

  const path = 'match_mvp_votes';
  try {
    const collRef = collection(db, path);
    const q = query(collRef, where('ownerId', '==', currentUser.uid), limit(100));
    const snap = await getDocs(q);
    const firestoreVotes: MatchMvpVoteRecord[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      firestoreVotes.push({
        id: d.id || docSnap.id,
        matchId: d.matchId,
        tournamentId: d.tournamentId,
        tournamentName: d.tournamentName,
        playerName: d.playerName,
        pairNames: d.pairNames,
        voterName: d.voterName,
        votedAt: d.votedAt,
        ownerId: d.ownerId,
      });
    });

    const mergedMap = new Map<string, MatchMvpVoteRecord>();
    [...localVotes, ...firestoreVotes].forEach((v) => mergedMap.set(v.id, v));
    const allVotes = Array.from(mergedMap.values());
    return matchId ? allVotes.filter((v) => v.matchId === matchId) : allVotes;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Persists a tactical training post to Firestore (/academy_posts/{postId}).
 */
export async function persistAcademyPostToFirestore(post: AcademyPost): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = post.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `academy_posts/${cleanId}`;
  try {
    await setDoc(doc(db, 'academy_posts', cleanId), {
      id: cleanId,
      title: post.title.slice(0, 140),
      category: post.category,
      mediaType: post.mediaType,
      mediaUrl: (post.mediaUrl || '').slice(0, 500),
      summary: post.summary.slice(0, 600),
      authorName: post.authorName.slice(0, 100),
      level: post.level,
      likesCount: Number(post.likesCount) || 0,
      ownerId: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Persists the entire athlete model to both `user_profiles/{uid}` (private) and `athletes_public/{uid}` (ranking).
 */
export async function persistFullAthleteProfileToFirestore(
  athlete: Partial<AthleteProfile> & { id: string; name: string }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const uid = currentUser.uid;
  const path = `user_profiles/${uid}`;

  try {
    const userDocRef = doc(db, 'user_profiles', uid);
    const existing = await getDoc(userDocRef);
    const existingData = existing.exists() ? existing.data() : {};

    const profileData = {
      id: uid,
      displayName: athlete.name.slice(0, 120),
      email: currentUser.email || athlete.email || '',
      photoURL: athlete.photoURL || athlete.photoUrl || currentUser.photoURL || '',
      phone: athlete.phone || '',
      level: athlete.level || 'iniciante',
      experienceCategory: athlete.experienceCategory || 'amador',
      courtSide: athlete.courtSide || 'Ambos',
      dominantFoot: athlete.dominantFoot || 'Destro',
      bio: athlete.bio || '',
      points: Number(athlete.points) || 0,
      wins: Number(athlete.wins) || 0,
      matchesPlayed: Number(athlete.matchesPlayed) || 0,
      titlesCount: Number(athlete.titlesCount) || 0,
      tournamentsPlayed: Number(athlete.tournamentsPlayed) || 0,
      tournamentTokens:
        athlete.tournamentTokens !== undefined
          ? athlete.tournamentTokens
          : (existingData.tournamentTokens ?? 0),
      preferredSport: athlete.preferredSport || 'futevolei',
      country: athlete.country || 'Brasil',
      state: athlete.state || 'GO',
      city: athlete.city || 'Mineiros',
      arenaId: athlete.arenaId || '',
      arenaName: athlete.arenaName || '',
      stats: athlete.stats || { aces: 0, errors: 0, sharkAttacks: 0, pingoPoints: 0, defenses: 0 },
      achievements: athlete.achievements || [],
      role: existingData.role === 'admin' ? 'admin' : 'athlete',
      ownerId: uid,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userDocRef, profileData, { merge: true });

    // Also sync to public athlete ranking collection
    const publicRef = doc(db, 'athletes_public', uid);
    await setDoc(
      publicRef,
      {
        id: uid,
        name: athlete.name.slice(0, 120),
        level: athlete.level || 'iniciante',
        experienceCategory: athlete.experienceCategory || 'amador',
        points: Number(athlete.points) || 0,
        wins: Number(athlete.wins) || 0,
        matchesPlayed: Number(athlete.matchesPlayed) || 0,
        titlesCount: Number(athlete.titlesCount) || 0,
        country: athlete.country || 'Brasil',
        state: athlete.state || 'GO',
        city: athlete.city || 'Mineiros',
        arenaId: athlete.arenaId || '',
        arenaName: athlete.arenaName || 'Arena',
        ownerId: uid,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Adds tournament tokens to a user's account in Firestore.
 */
export async function addTournamentTokensInFirestore(uid: string, quantity: number): Promise<number> {
  const userDocRef = doc(db, 'user_profiles', uid);
  await updateDoc(userDocRef, {
    tournamentTokens: increment(quantity),
  });
  const updated = await getDoc(userDocRef);
  return updated.data()?.tournamentTokens ?? quantity;
}

/**
 * Spends 1 tournament token when creating a tournament.
 */
export async function spendTournamentTokenInFirestore(uid: string): Promise<boolean> {
  const userDocRef = doc(db, 'user_profiles', uid);
  const snap = await getDoc(userDocRef);
  const currentTokens = snap.data()?.tournamentTokens ?? 0;
  if (currentTokens <= 0) {
    return false;
  }
  await updateDoc(userDocRef, {
    tournamentTokens: increment(-1),
  });
  return true;
}

/**
 * Persists an arena to Firestore.
 */
export async function persistArenaToFirestore(arena: TenantConfig): Promise<void> {
  const currentUser = auth.currentUser;
  const path = `arenas/${arena.id}`;
  if (!currentUser) throw new Error('Entre com sua conta para salvar a arena.');
  try {
    await setDoc(
      doc(db, 'arenas', arena.id),
      {
        ...arena,
        ownerId: currentUser.uid,
        managers: arena.managers || [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getArenaCreationAccess(uid: string): Promise<{ allowed: boolean; reason: 'login' | 'plan' | 'granted' }> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return { allowed: false, reason: 'login' };
  if (auth.currentUser.email?.toLowerCase() === 'edmarjuniob@gmail.com') {
    return { allowed: true, reason: 'granted' };
  }
  const access = await getDoc(doc(db, 'arena_access', uid));
  const data = access.data();
  if (data?.active === true && ['arena_pro_99', 'arena_pro_149'].includes(data.plan)) {
    return { allowed: true, reason: 'plan' };
  }
  if (data?.adminGranted === true) return { allowed: true, reason: 'granted' };
  return { allowed: false, reason: 'plan' };
}

export async function hasActiveTournamentSubscription(uid: string): Promise<boolean> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  const access = await getDoc(doc(db, 'arena_access', uid));
  const data = access.data();
  return data?.active === true && ['arena_pro_99', 'arena_pro_149'].includes(data.plan);
}

/**
 * Fetches all arenas from Firestore.
 */
export async function fetchArenasFromFirestore(): Promise<TenantConfig[]> {
  const path = 'arenas';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return [];
    const list: TenantConfig[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as TenantConfig);
    });
    return list;
  } catch (error) {
    console.warn('Fallback to local arenas cache:', error);
    return [];
  }
}

/**
 * Adds a manager to an arena in Firestore.
 */
export async function addManagerToArenaInFirestore(
  arenaId: string,
  managerEmailOrUid: string
): Promise<string[]> {
  const arenaRef = doc(db, 'arenas', arenaId);
  const snap = await getDoc(arenaRef);
  const existingManagers: string[] = snap.data()?.managers || [];
  const clean = managerEmailOrUid.trim().toLowerCase();
  if (!clean || existingManagers.includes(clean)) return existingManagers;

  const nextManagers = [...existingManagers, clean];
  await updateDoc(arenaRef, {
    managers: nextManagers,
  });
  return nextManagers;
}

/**
 * Removes a manager from an arena in Firestore.
 */
export async function removeManagerFromArenaInFirestore(
  arenaId: string,
  managerEmailOrUid: string
): Promise<string[]> {
  const arenaRef = doc(db, 'arenas', arenaId);
  const snap = await getDoc(arenaRef);
  const existingManagers: string[] = snap.data()?.managers || [];
  const clean = managerEmailOrUid.trim().toLowerCase();
  const nextManagers = existingManagers.filter((m) => m.toLowerCase() !== clean);

  await updateDoc(arenaRef, {
    managers: nextManagers,
  });
  return nextManagers;
}

/**
 * Persists a tournament to Firestore.
 */
export async function persistTournamentToFirestore(
  tourn: Tournament,
  options: { spendToken?: boolean } = {}
): Promise<void> {
  const currentUser = auth.currentUser;
  const path = `tournaments/${tourn.id}`;
  if (!currentUser?.emailVerified) throw new Error('Entre com uma conta verificada para salvar o torneio.');
  try {
    const tournamentRef = doc(db, 'tournaments', tourn.id);
    const tournamentData = {
      ...tourn,
      ownerId: currentUser.uid,
      updatedAt: new Date().toISOString(),
    };

    if (!options.spendToken) {
      await setDoc(tournamentRef, tournamentData);
      return;
    }

    const profileRef = doc(db, 'user_profiles', currentUser.uid);
    await runTransaction(db, async (transaction) => {
      const [profileSnapshot, tournamentSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(tournamentRef),
      ]);
      if (!profileSnapshot.exists()) {
        throw new Error('Você precisa de 1 Token de Campeonato ou de uma assinatura ativa para criar um campeonato.');
      }
      if (tournamentSnapshot.exists()) throw new Error('Este campeonato já existe. Atualize a tela e tente novamente.');

      const currentTokens = profileSnapshot.data().tournamentTokens;
      if (typeof currentTokens !== 'number' || currentTokens < 1) {
        throw new Error('Você precisa de 1 Token de Campeonato ou de uma assinatura ativa para criar um campeonato.');
      }

      transaction.update(profileRef, { tournamentTokens: currentTokens - 1 });
      transaction.set(tournamentRef, tournamentData);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Você precisa de 1 Token de Campeonato ou de uma assinatura ativa para criar um campeonato.') {
      throw error;
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
      throw new Error('Para criar um campeonato, assine um plano de R$ 99 ou R$ 149, ou adquira 1 Token de Campeonato.');
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function publicTeamPair(team?: TeamPair): Record<string, unknown> | undefined {
  if (!team) return undefined;
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    player1: team.player1,
    player1Level: team.player1Level,
    player2: team.player2,
    player2Level: team.player2Level,
    category: team.category,
    seed: team.seed,
    enrollmentStatus: team.enrollmentStatus || 'confirmed',
    isPresent: team.isPresent !== false,
  };
}

function publicBracketSource(source?: BracketSource): Record<string, unknown> | undefined {
  if (!source) return undefined;
  if (source.kind === 'team') {
    return { kind: 'team', team: publicTeamPair(source.team), slot: source.slot };
  }
  return { kind: source.kind, matchId: source.matchId };
}

function publicBracketMatch(match: BracketMatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: match.id,
    tournamentId: match.tournamentId,
    matchNumber: match.matchNumber,
    stage: match.stage,
    round: match.round,
    stageName: match.stageName,
    status: match.status,
    revision: match.revision || 0,
  };

  const optional: Record<string, unknown> = {
    source1: publicBracketSource(match.source1),
    source2: publicBracketSource(match.source2),
    initialLowerSource: publicBracketSource(match.initialLowerSource),
    region: match.region,
    rules: match.rules,
    sets: match.sets,
    resultMode: match.resultMode,
    officialAt: match.officialAt,
    team1: publicTeamPair(match.team1),
    team2: publicTeamPair(match.team2),
    score1: match.score1,
    score2: match.score2,
    winnerId: match.winnerId,
    loserId: match.loserId,
    courtId: match.courtId,
    courtName: match.courtName,
    scheduledTime: match.scheduledTime,
    nextMatchWinnerId: match.nextMatchWinnerId,
    winnerDestinationSlot: match.winnerDestinationSlot,
    nextMatchLoserId: match.nextMatchLoserId,
    loserDestinationSlot: match.loserDestinationSlot,
    linkedBroadcastId: match.linkedBroadcastId,
    semifinalDecision: match.semifinalDecision,
    serverValidatedRevision: match.serverValidatedRevision,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

/** Persists changed public bracket records without publishing athlete contact data. */
export async function persistTournamentMatchChanges(
  tournamentId: string,
  nextMatches: BracketMatch[],
  previousMatches: BracketMatch[]
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) throw new Error('Entre com uma conta verificada para sincronizar a tabela.');
  if (!/^[\w-]{1,64}$/.test(tournamentId)) throw new Error('Identificador de campeonato inválido.');

  const previousById = new Map(previousMatches.map((match) => [match.id, match]));
  const nextById = new Map(nextMatches.map((match) => [match.id, match]));
  const changed = nextMatches.filter((match) =>
    JSON.stringify(publicBracketMatch(match)) !== JSON.stringify(publicBracketMatch(previousById.get(match.id) || ({} as BracketMatch)))
  );
  const removed = previousMatches.filter((match) => !nextById.has(match.id));
  const operations: Array<{ id: string; data?: Record<string, unknown> }> = [
    ...changed.map((match) => ({ id: match.id, data: publicBracketMatch(match) })),
    ...removed.map((match) => ({ id: match.id })),
  ];

  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(offset, offset + 450)) {
      if (!/^[\w-]{1,64}$/.test(operation.id)) throw new Error('Identificador de partida inválido.');
      const matchRef = doc(db, 'tournaments', tournamentId, 'matches', operation.id);
      if (operation.data) batch.set(matchRef, operation.data);
      else batch.delete(matchRef);
    }
    await batch.commit();
  }
}

export function listenToTournamentMatches(
  tournamentId: string,
  onUpdate: (matches: BracketMatch[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const matchesRef = collection(db, 'tournaments', tournamentId, 'matches');
  return onSnapshot(
    matchesRef,
    (snapshot) => {
      const matches = snapshot.docs
        .map((matchDoc) => {
          const match = matchDoc.data() as BracketMatch;
          if (match.status === 'completed' && match.serverValidatedRevision !== match.revision) {
            return { ...match, status: 'scheduled' as const };
          }
          return match;
        })
        .sort((left, right) => left.matchNumber - right.matchNumber);
      onUpdate(matches);
    },
    (error) => onError?.(error)
  );
}

export type TournamentResultEvent = {
  eventId: string;
  kind: 'result_confirmed' | 'result_corrected';
  tournamentId: string;
  matchId: string;
  revision: number;
  matchNumber: number;
  stage: string;
  stageName: string;
  courtName: string;
  tournamentName: string;
  team1: { id: string; name: string };
  team2: { id: string; name: string };
  winnerId: string;
  sets: Array<{ score1: number; score2: number }>;
  resultMode: 'played' | 'walkover';
  officialAt: string;
};

export function listenToTournamentResultEvents(
  tournamentId: string,
  onUpdate: (events: TournamentResultEvent[], changes: Array<{ type: string; id: string }>) => void,
  onError?: (error: unknown) => void
): () => void {
  const eventsRef = collection(db, 'tournaments', tournamentId, 'result_events');
  return onSnapshot(
    query(eventsRef, orderBy('createdAt', 'desc'), limit(20)),
    (snapshot) => {
      const events = snapshot.docs.map((eventDoc) => ({ ...eventDoc.data(), eventId: eventDoc.id } as TournamentResultEvent));
      const changes = snapshot.docChanges().map((change) => ({ type: change.type, id: change.doc.id }));
      onUpdate(events, changes);
    },
    (error) => onError?.(error)
  );
}

export function listenToBroadcastTournamentId(
  broadcastId: string,
  onUpdate: (tournamentId: string | null) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!/^[\w-]{1,64}$/.test(broadcastId)) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(doc(db, 'broadcast_tournament_links', broadcastId), (snapshot) => {
    const tournamentId = snapshot.data()?.tournamentId;
    onUpdate(typeof tournamentId === 'string' ? tournamentId : null);
  }, (error) => onError?.(error));
}

/**
 * Fetches tournaments from Firestore.
 */
export async function fetchTournamentsFromFirestore(): Promise<Tournament[]> {
  const path = 'tournaments';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return [];
    const list: Tournament[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Tournament);
    });
    return list;
  } catch (error) {
    console.warn('Fallback to local tournaments cache:', error);
    return [];
  }
}

/**
 * Persists a discount coupon to Firestore (/coupons/{couponId}).
 */
export async function persistCouponToFirestore(coupon: DiscountCoupon): Promise<void> {
  const currentUser = auth.currentUser;
  const path = `coupons/${coupon.id}`;
  try {
    await setDoc(
      doc(db, 'coupons', coupon.id),
      {
        ...coupon,
        code: coupon.code.trim().toUpperCase(),
        ownerId: currentUser?.uid || 'admin',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches active discount coupons from Firestore.
 */
export async function fetchCouponsFromFirestore(arenaId?: string): Promise<DiscountCoupon[]> {
  const path = 'coupons';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return [];
    const list: DiscountCoupon[] = [];
    snap.forEach((docSnap) => {
      const c = docSnap.data() as DiscountCoupon;
      if (!arenaId || c.scope === 'global' || c.arenaId === arenaId) {
        list.push(c);
      }
    });
    return list;
  } catch (error) {
    console.warn('Fallback to local coupons:', error);
    return [];
  }
}

/**
 * Validates and calculates discount for a given coupon code.
 */
export async function validateAndApplyCouponInFirestore(params: {
  code: string;
  arenaId: string;
  originalPrice: number;
}): Promise<{
  valid: boolean;
  coupon?: DiscountCoupon;
  discountAmount: number;
  finalPrice: number;
  message: string;
}> {
  const cleanCode = params.code.trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: params.originalPrice,
      message: 'Insira um código de cupom.',
    };
  }

  try {
    const coupons = await fetchCouponsFromFirestore(params.arenaId);
    const target = coupons.find((c) => c.code.toUpperCase() === cleanCode && c.active);

    if (!target) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: params.originalPrice,
        message: 'Cupom inválido ou expirado.',
      };
    }

    if (target.scope === 'arena' && target.arenaId && target.arenaId !== params.arenaId) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: params.originalPrice,
        message: `Este cupom é exclusivo da arena ${target.arenaName || 'específica'}.`,
      };
    }

    if (target.minBookingValue && params.originalPrice < target.minBookingValue) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: params.originalPrice,
        message: `Valor mínimo da reserva para usar este cupom é R$ ${target.minBookingValue.toFixed(2)}.`,
      };
    }

    if (target.maxUses && target.usedCount >= target.maxUses) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: params.originalPrice,
        message: 'Limite de utilização deste cupom esgotado.',
      };
    }

    if (target.expiresAt && new Date(target.expiresAt) < new Date()) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: params.originalPrice,
        message: 'Este cupom já expirou.',
      };
    }

    let discount = 0;
    if (target.discountType === 'percent') {
      discount = (params.originalPrice * target.discountValue) / 100;
    } else {
      discount = target.discountValue;
    }
    discount = Math.min(discount, params.originalPrice);
    const finalPrice = Math.max(0, params.originalPrice - discount);

    return {
      valid: true,
      coupon: target,
      discountAmount: discount,
      finalPrice,
      message: `Cupom "${target.code}" aplicado! Economia de R$ ${discount.toFixed(2)}.`,
    };
  } catch {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: params.originalPrice,
      message: 'Falha ao validar cupom.',
    };
  }
}




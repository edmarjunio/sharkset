import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { AthleteProfile } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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

export async function signOutFirebase() {
  return signOut(auth);
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
    | 'match_modified';
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
  const path = 'athletes_public';
  try {
    const collRef = collection(db, path);
    // If user is authenticated, query their owned athletes or collection
    const q = currentUser
      ? query(collRef, where('ownerId', '==', currentUser.uid), limit(limitCount))
      : query(collRef, limit(limitCount));

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
        experienceCategory: data.experienceCategory || 'amador',
        points: Number(data.points) || 0,
        wins: Number(data.wins) || 0,
        matchesPlayed: Number(data.matchesPlayed) || 0,
        titlesCount: Number(data.titlesCount) || 0,
        country: data.country || 'Brasil',
        state: data.state || 'GO',
        city: data.city || 'Mineiros',
        arenaId: data.arenaId || 'conflora',
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
      experienceCategory: athlete.experienceCategory || 'amador',
      points: Number(athlete.points) || 0,
      wins: Number(athlete.wins) || 0,
      matchesPlayed: Number(athlete.matchesPlayed) || 0,
      titlesCount: Number(athlete.titlesCount) || 0,
      country: (athlete.country || 'Brasil').slice(0, 60),
      state: (athlete.state || 'GO').slice(0, 10),
      city: (athlete.city || 'Mineiros').slice(0, 80),
      arenaId: (athlete.arenaId || 'conflora').slice(0, 64),
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


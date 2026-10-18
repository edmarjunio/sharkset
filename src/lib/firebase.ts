import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
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
    | 'tuition_due_2days';
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

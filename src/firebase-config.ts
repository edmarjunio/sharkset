import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  Firestore,
  getFirestore,
} from 'firebase/firestore';
import rawAppletConfig from '../firebase-applet-config.json';

export interface ExtendedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | undefined>);

export const firebaseConfig: ExtendedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (rawAppletConfig as ExtendedFirebaseConfig).apiKey,
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN || (rawAppletConfig as ExtendedFirebaseConfig).authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || (rawAppletConfig as ExtendedFirebaseConfig).projectId,
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET || (rawAppletConfig as ExtendedFirebaseConfig).storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    (rawAppletConfig as ExtendedFirebaseConfig).messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || (rawAppletConfig as ExtendedFirebaseConfig).appId,
  measurementId:
    env.VITE_FIREBASE_MEASUREMENT_ID || (rawAppletConfig as ExtendedFirebaseConfig).measurementId,
  firestoreDatabaseId:
    env.VITE_FIRESTORE_DATABASE_ID ||
    (rawAppletConfig as ExtendedFirebaseConfig).firestoreDatabaseId,
};

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

let offlinePersistenceActive = false;

/**
 * Enables IndexedDB offline persistence on the Firestore instance so court scheduling
 * and arena availability queries continue to work without an active internet connection.
 */
export async function enableFirestoreOfflinePersistence(
  firestoreInstance: Firestore = db
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return false;
  }

  try {
    await enableIndexedDbPersistence(firestoreInstance);
    offlinePersistenceActive = true;
    return true;
  } catch (error: unknown) {
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : '';

    if (errorCode === 'failed-precondition') {
      // Multiple tabs open: try multi-tab IndexedDB persistence fallback
      try {
        await enableMultiTabIndexedDbPersistence(firestoreInstance);
        offlinePersistenceActive = true;
        return true;
      } catch {
        console.warn(
          'Firestore offline persistence already active in another tab (failed-precondition).'
        );
        return false;
      }
    }

    if (errorCode === 'unimplemented') {
      console.warn(
        'Current browser environment does not support IndexedDB persistence (unimplemented).'
      );
      return false;
    }

    return false;
  }
}

// Whole-database persistence may contain private profiles. Keep it opt-in on trusted
// devices; the public shell and redacted arena catalogue have their own bounded caches.
export const offlinePersistenceReady: Promise<boolean> = Promise.resolve(false);

export function isOfflinePersistenceEnabled(): boolean {
  return offlinePersistenceActive;
}

export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

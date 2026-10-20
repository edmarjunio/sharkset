import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';
import rawAppletConfig from '../firebase-applet-config.json';

export interface ExtendedFirebaseConfig {
  apiKey: string; authDomain: string; projectId: string; storageBucket?: string;
  messagingSenderId?: string; appId: string; measurementId?: string; firestoreDatabaseId?: string;
}
const env = import.meta.env || {};
export const firebaseConfig: ExtendedFirebaseConfig = {
  ...rawAppletConfig,
  apiKey: env.VITE_FIREBASE_API_KEY || rawAppletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || rawAppletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || rawAppletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || rawAppletConfig.storageBucket,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || rawAppletConfig.measurementId,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || (rawAppletConfig as ExtendedFirebaseConfig).messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || rawAppletConfig.appId,
  firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID || (rawAppletConfig as ExtendedFirebaseConfig).firestoreDatabaseId,
};
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const supportsPersistence = typeof indexedDB !== 'undefined';
export const db = initializeFirestore(app, {
  localCache: supportsPersistence
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
}, firebaseConfig.firestoreDatabaseId || '(default)');
// Persistence is selected before the first read. The SDK falls back to memory if IndexedDB fails.
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request } from 'express';
import config from '../firebase-applet-config.json';

function adminApp() {
  return getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || config.projectId });
}
export const adminDatabase = () => getFirestore(adminApp(), process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId);
export async function authenticatedUser(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');
  return getAuth(adminApp()).verifyIdToken(token, true);
}

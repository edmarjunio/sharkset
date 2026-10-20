import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request } from 'express';
import config from '../firebase-applet-config.json';

function adminApp() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || config.projectId;
  if (projectId !== 'sharkset-70de4' || config.projectId !== 'sharkset-70de4') throw new Error('PROJECT_MISMATCH');
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  if (app.options.projectId !== projectId) throw new Error('PROJECT_MISMATCH');
  return app;
}
export const adminDatabase = () => getFirestore(adminApp(), process.env.FIRESTORE_DATABASE_ID || (config as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)');
export async function authenticatedUser(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');
  return getAuth(adminApp()).verifyIdToken(token, true);
}

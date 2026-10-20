/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import config from '../firebase-applet-config.json';
const worker = self as unknown as ServiceWorkerGlobalScope;
worker.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = new URL(event.notification.data?.link || '/', worker.location.origin);
  if (link.origin === worker.location.origin) event.waitUntil(worker.clients.openWindow(link.toString()));
});
const env = import.meta.env;
const app = initializeApp({ ...config, apiKey: env.VITE_FIREBASE_API_KEY || config.apiKey,
  projectId: env.VITE_FIREBASE_PROJECT_ID || config.projectId, appId: env.VITE_FIREBASE_APP_ID || config.appId,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId });
onBackgroundMessage(getMessaging(app), async payload => {
  const data = payload.data;
  if (!data?.title || !data.body || !data.link) return;
  const link = new URL(data.link, worker.location.origin);
  if (link.origin !== worker.location.origin) return;
  await worker.registration.showNotification(data.title, { body: data.body, tag: data.eventId, data: { link: link.toString() } });
});

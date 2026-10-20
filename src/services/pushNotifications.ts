import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, isSupported, onMessage } from 'firebase/messaging';
import { app, auth, db } from '../firebase-config';
import messagingWorkerUrl from '../firebase-messaging-sw?worker&url';

export interface NotificationPreferences {
  favoriteArenaIds: string[]; pushEnabled: boolean; whatsappEnabled: boolean; phone: string;
  bookingCancelled: boolean; tournamentOpened: boolean;
}
export const defaultPreferences: NotificationPreferences = { favoriteArenaIds: [], pushEnabled: false, whatsappEnabled: false,
  phone: '', bookingCancelled: true, tournamentOpened: true };
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const user = auth.currentUser;
  if (!user) throw new Error('Entre na sua conta para configurar os avisos.');
  const snap = await getDoc(doc(db, 'notification_preferences', user.uid));
  return { ...defaultPreferences, ...snap.data() };
}
export async function saveNotificationPreferences(preferences: NotificationPreferences) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Entre com uma conta verificada.');
  await setDoc(doc(db, 'notification_preferences', user.uid), preferences);
}
export async function enablePush() {
  // Called only from the explicit enable button, never on application boot.
  if (!auth.currentUser?.emailVerified) throw new Error('Entre com uma conta verificada.');
  if (!await isSupported()) throw new Error('Este navegador não oferece suporte a notificações push.');
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('As notificações push ainda não foram configuradas.');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Autorize as notificações nas configurações do navegador.');
  const workerDirectory = new URL('.', new URL(messagingWorkerUrl, location.href)).pathname;
  const worker = await navigator.serviceWorker.register(messagingWorkerUrl, { type: 'module', scope: `${workerDirectory}firebase-cloud-messaging-push-scope` });
  // Wait for this registration, not serviceWorker.ready (the worker has a dedicated scope).
  if (!worker.active) await new Promise<void>((resolve, reject) => {
    const installing = worker.installing || worker.waiting;
    if (!installing) { reject(new Error('Não foi possível ativar o serviço de notificações.')); return; }
    const timer = window.setTimeout(() => reject(new Error('Tempo esgotado ao ativar notificações.')), 15000);
    installing.addEventListener('statechange', () => {
      if (installing.state === 'activated') { window.clearTimeout(timer); resolve(); }
      else if (installing.state === 'redundant') { window.clearTimeout(timer); reject(new Error('Falha ao instalar notificações.')); }
    });
  });
  const storedDevice = localStorage.getItem('sharkset_push_device');
  if (storedDevice && storedDevice.split(':')[0] !== auth.currentUser?.uid) await deleteToken(getMessaging(app));
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: worker });
  if (!token) throw new Error('Não foi possível registrar este dispositivo.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const deviceId = Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
  const uid = auth.currentUser?.uid;
  if (!uid) { await deleteToken(getMessaging(app)); throw new Error('Sua sessão expirou. Entre novamente.'); }
  // Replace the device's previous account association before registering another account.
  const previous = localStorage.getItem('sharkset_push_device');
  if (previous) {
    const [previousUid, previousId] = previous.split(':');
    if (previousUid === uid && previousId !== deviceId) await deleteDoc(doc(db, 'notification_preferences', uid, 'devices', previousId));
  }
  await setDoc(doc(db, 'notification_preferences', uid, 'devices', deviceId), { token, updatedAt: new Date().toISOString() });
  localStorage.setItem('sharkset_push_device', `${uid}:${deviceId}`);
}
export async function disableDevicePush() {
  const stored = localStorage.getItem('sharkset_push_device');
  const uid = auth.currentUser?.uid;
  if (stored && uid) {
    const [owner, deviceId] = stored.split(':');
    if (owner === uid) await deleteDoc(doc(db, 'notification_preferences', uid, 'devices', deviceId));
  }
  if (stored && await isSupported()) await deleteToken(getMessaging(app));
  localStorage.removeItem('sharkset_push_device');
}
export async function listenToForegroundPush(receive: (data: { title: string; body: string; link: string }) => void) {
  if (!await isSupported()) return () => {};
  return onMessage(getMessaging(app), message => {
    const data = message.data;
    if (data?.title && data.body && data.link) {
      const link = new URL(data.link, location.origin);
      if (link.origin === location.origin) receive({ title: data.title, body: data.body, link: link.toString() });
    }
  });
}

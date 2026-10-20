import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { publicArena, publicTournament, projectSchedule } from './catalog';
import { hash, notificationEvent, queueRecipients, deliverJob } from './notifications';
import { PROJECT_ID, REGION } from './policy';

const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
const trigger = { region: REGION, database: databaseId, retry: true, maxInstances: 3 };
const siteOrigin = defineString('NOTIFICATION_SITE_ORIGIN', { default: 'https://sharkset.web.app' });
const whatsappToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const whatsappPhoneId = defineString('WHATSAPP_PHONE_NUMBER_ID', { default: '' });
const whatsappGraphVersion = defineString('WHATSAPP_GRAPH_VERSION', { default: '' });
const bookingTemplate = defineString('WHATSAPP_BOOKING_CANCELLED_TEMPLATE', { default: '' });
const tournamentTemplate = defineString('WHATSAPP_TOURNAMENT_OPENED_TEMPLATE', { default: '' });
function database() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (project && project !== PROJECT_ID) throw new Error('PROJECT_MISMATCH');
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  if (getApps()[0].options.projectId !== PROJECT_ID) throw new Error('PROJECT_MISMATCH');
  return getFirestore(getApps()[0], databaseId);
}
async function recordEvent(source: string, id: string, before: Record<string, any> | undefined, after: Record<string, any> | undefined, eventId: string) {
  const event = notificationEvent(source, id, before, after);
  if (!event) return;
  const key = event.kind === 'tournament_opened' ? hash(`tournament:${id}`) : hash(eventId);
  const db = database();
  await db.runTransaction(async tx => {
    const ref = db.collection('notification_events').doc(key);
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { ...event, createdAt: new Date().toISOString() });
  });
}
export const projectPublicArena = onDocumentWritten({ ...trigger, document: 'arenas/{arenaId}' }, async event => {
  const db = database();
  // Read current data instead of the event snapshot so out-of-order events cannot restore old state.
  const source = await db.collection('arenas').doc(event.params.arenaId).get();
  const destination = db.collection('arenas_public').doc(event.params.arenaId);
  if (!source.exists) { await destination.delete(); return; }
  await db.runTransaction(async tx => {
    const current = await tx.get(source.ref);
    if (current.exists) tx.set(destination, publicArena(current.data()!, current.id));
    else tx.delete(destination);
  });
  const data = source.data()!;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: data.timeZone || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const horizon = Math.min(90, Math.max(1, Math.floor(data.bookingHorizonDays || 7)));
  for (let day = 0; day < horizon; day++) {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + day);
    await projectSchedule(db, event.params.arenaId, date.toISOString().slice(0, 10));
  }
});
export const notifyBookingCancelled = onDocumentWritten({ ...trigger, document: 'bookings/{bookingId}' }, async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  await recordEvent('bookings', event.params.bookingId, before, after, event.id);
  const keys = new Map([before, after].filter(Boolean).map(data => [`${data!.tenantId}:${data!.date}`, data!]));
  for (const data of keys.values()) await projectSchedule(database(), data.tenantId, data.date);
});
export const projectPublicBookingBlocks = onDocumentWritten({ ...trigger, document: 'booking_blocks/{blockId}' }, async event => {
  const keys = new Map([event.data?.before.data(), event.data?.after.data()].filter(Boolean).map(data => [`${data!.tenantId}:${data!.date}`, data!]));
  for (const data of keys.values()) await projectSchedule(database(), data.tenantId, data.date);
});
export const notifyTournamentOpened = onDocumentWritten({ ...trigger, document: 'tournaments/{tournamentId}' }, async event => {
  const db = database();
  await db.runTransaction(async tx => {
    const current = await tx.get(db.collection('tournaments').doc(event.params.tournamentId));
    const destination = db.collection('tournaments_public').doc(event.params.tournamentId);
    if (current.exists) tx.set(destination, publicTournament(current.data()!, current.id));
    else tx.delete(destination);
  });
  await recordEvent('tournaments', event.params.tournamentId, event.data?.before.data(), event.data?.after.data(), event.id);
});
export const queueArenaNotifications = onDocumentCreated({ ...trigger, document: 'notification_events/{eventId}' }, async event => {
  const data = event.data?.data();
  if (data) await queueRecipients(database(), event.params.eventId, data as Parameters<typeof queueRecipients>[2]);
});
export const sendArenaPush = onDocumentCreated({ ...trigger, document: 'notification_jobs/{jobId}' }, async event => {
  if (event.data?.data().channel === 'push') await deliverJob(database(), event.params.jobId, { origin: siteOrigin.value() });
});
export const sendArenaWhatsApp = onDocumentCreated({ ...trigger, document: 'notification_jobs/{jobId}', secrets: [whatsappToken] }, async event => {
  if (event.data?.data().channel === 'whatsapp') await deliverJob(database(), event.params.jobId, { origin: siteOrigin.value(),
    whatsappToken: whatsappToken.value(), phoneId: whatsappPhoneId.value(), graphVersion: whatsappGraphVersion.value(),
    bookingTemplate: bookingTemplate.value(), tournamentTemplate: tournamentTemplate.value() });
});

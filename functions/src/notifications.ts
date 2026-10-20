import { createHash } from 'node:crypto';
import { getMessaging } from 'firebase-admin/messaging';
import type { Firestore } from 'firebase-admin/firestore';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Data = Record<string, any>;
export interface NotificationEvent {
  kind: 'booking_cancelled' | 'tournament_opened'; arenaId: string; recordId: string;
  ownerId?: string; date?: string; courtId?: string; startTime?: string; name?: string;
}
export function notificationEvent(collection: string, id: string, before: Data | undefined, after: Data | undefined): NotificationEvent | null {
  if (!after || after.demo === true || !/^[\w-]{1,64}$/.test(after.tenantId || '') || !/^[\w-]{1,64}$/.test(id)) return null;
  if (collection === 'bookings' && before && ['confirmed', 'pending'].includes(before.status) && after.status === 'cancelled' &&
    after.tenantId === before.tenantId && after.date === before.date && after.courtId === before.courtId && after.startTime === before.startTime &&
    /^\d{4}-\d{2}-\d{2}$/.test(after.date || '') && /^[\w-]{1,64}$/.test(after.courtId || '') && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(after.startTime || '')) {
    return { kind: 'booking_cancelled', arenaId: after.tenantId, recordId: id,
      ...(typeof before.ownerId === 'string' && before.ownerId ? { ownerId: before.ownerId } : {}),
      date: after.date, courtId: after.courtId, startTime: after.startTime };
  }
  // Opening is announced once per tournament, even if it is later closed and reopened.
  if (collection === 'tournaments' && after.isOpenForRegistration === true && after.isFinished !== true && before?.isOpenForRegistration !== true) {
    return { kind: 'tournament_opened', arenaId: after.tenantId, recordId: id, name: String(after.name || 'Novo torneio').slice(0, 140) };
  }
  return null;
}
export function eventLink(event: NotificationEvent, origin: string) {
  const url = new URL('/', origin);
  url.searchParams.set('arena', event.arenaId);
  if (event.kind === 'tournament_opened') url.searchParams.set('tournament', event.recordId);
  else {
    url.searchParams.set('date', event.date!); url.searchParams.set('court', event.courtId!);
    url.searchParams.set('time', event.startTime!); url.searchParams.set('payment', 'pix');
  }
  return url.toString();
}
export function messageFor(event: NotificationEvent, owner: boolean) {
  return event.kind === 'tournament_opened'
    ? { title: 'Inscrições abertas na sua arena favorita', body: `${event.name}. Veja os detalhes e participe.` }
    : owner
      ? { title: 'Sua reserva foi cancelada', body: `A reserva de ${event.date} às ${event.startTime} foi cancelada. Consulte outro horário.` }
      : { title: 'Um horário foi liberado na sua arena favorita', body: `${event.date} às ${event.startTime}. Consulte a disponibilidade e agende.` };
}
export async function queueRecipients(db: Firestore, eventId: string, event: NotificationEvent) {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  // Pages bound memory and allow retries to resume safely via deterministic job IDs.
  do {
    let query = db.collection('notification_preferences').where('favoriteArenaIds', 'array-contains', event.arenaId).orderBy('__name__').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) await queueUser(db, eventId, event, doc.id);
    cursor = page.size === 100 ? page.docs.at(-1) : undefined;
  } while (cursor);
  if (event.ownerId) await queueUser(db, eventId, event, event.ownerId);
}
async function queueUser(db: Firestore, eventId: string, event: NotificationEvent, uid: string) {
  const prefRef = db.collection('notification_preferences').doc(uid);
  const pref = (await prefRef.get()).data();
  if (!pref || (event.kind === 'booking_cancelled' ? pref.bookingCancelled !== true : pref.tournamentOpened !== true)) return;
  const channels: { channel: string; deviceId?: string }[] = [];
  if (pref.pushEnabled === true) {
    const devices = await prefRef.collection('devices').limit(20).get();
    channels.push(...devices.docs.map(doc => ({ channel: 'push', deviceId: doc.id })));
  }
  if (pref.whatsappEnabled === true && /^\d{10,15}$/.test(pref.phone || '')) channels.push({ channel: 'whatsapp' });
  for (const channel of channels) {
    const ref = db.collection('notification_jobs').doc(hash(`${eventId}:${uid}:${channel.channel}:${channel.deviceId || ''}`));
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, { event, eventId, uid, ...channel, status: 'queued', createdAt: new Date().toISOString() });
    });
  }
}
export interface DeliveryConfig { origin: string; whatsappToken?: string; phoneId?: string; graphVersion?: string; bookingTemplate?: string; tournamentTemplate?: string }
export async function deliverJob(db: Firestore, id: string, config: DeliveryConfig) {
  const ref = db.collection('notification_jobs').doc(id);
  // No automatic retry after entering sending: the provider may accept a request before a timeout/crash.
  const job = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.status !== 'queued') return null;
    tx.update(ref, { status: 'sending', startedAt: new Date().toISOString() });
    return record;
  });
  if (!job) return;
  try {
    const event = job.event as NotificationEvent;
    const current = (await db.collection(event.kind === 'booking_cancelled' ? 'bookings' : 'tournaments').doc(event.recordId).get()).data();
    if (!current || current.tenantId !== event.arenaId ||
      (event.kind === 'booking_cancelled' ? current.status !== 'cancelled' : current.isOpenForRegistration !== true || current.isFinished === true)) {
      await ref.update({ status: 'skipped' }); return;
    }
    const prefRef = db.collection('notification_preferences').doc(job.uid);
    const pref = (await prefRef.get()).data();
    const subscribed = event.ownerId === job.uid || pref?.favoriteArenaIds?.includes(event.arenaId);
    const enabled = event.kind === 'booking_cancelled' ? pref?.bookingCancelled : pref?.tournamentOpened;
    if (!pref || !subscribed || !enabled || pref[job.channel === 'push' ? 'pushEnabled' : 'whatsappEnabled'] !== true) {
      await ref.update({ status: 'skipped' }); return;
    }
    const message = messageFor(event, event.ownerId === job.uid);
    const link = eventLink(event, config.origin);
    let providerId: string;
    if (job.channel === 'push') {
      const device = prefRef.collection('devices').doc(job.deviceId);
      const token = (await device.get()).data()?.token;
      if (!token) { await ref.update({ status: 'skipped' }); return; }
      try {
        providerId = await getMessaging().send({ token, data: { ...message, link, eventId: job.eventId },
          webpush: { headers: { TTL: '3600', Urgency: 'normal' } } });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') await device.delete();
        throw error;
      }
    } else {
      const template = event.kind === 'booking_cancelled' ? config.bookingTemplate : config.tournamentTemplate;
      if (!config.whatsappToken || !config.phoneId || !/^v\d+\.\d+$/.test(config.graphVersion || '') || !template) {
        await ref.update({ status: 'not_configured' }); return;
      }
      if (!/^\d{10,15}$/.test(pref.phone || '')) { await ref.update({ status: 'skipped' }); return; }
      // Approved templates carry two body parameters: message text and full scheduling URL.
      const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneId}/messages`, {
        method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${config.whatsappToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: pref.phone, type: 'template', template: {
          name: template, language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: [
            { type: 'text', text: `${message.title}. ${message.body}` }, { type: 'text', text: link },
          ] }],
        } }),
      });
      const result = await response.json() as { messages?: { id: string }[] };
      if (!response.ok || !result.messages?.[0]?.id) { await ref.update({ status: 'failed', httpStatus: response.status }); return; }
      providerId = result.messages[0].id;
    }
    await ref.update({ status: 'accepted', providerId, completedAt: new Date().toISOString() });
  } catch {
    // Unknown delivery must be reviewed, never resent blindly. No phone/token/provider body in logs.
    await ref.update({ status: 'unknown_delivery', completedAt: new Date().toISOString() });
  }
}

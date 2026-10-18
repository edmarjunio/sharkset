import type { Express } from 'express';
import { FieldPath } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';
import { adminDatabase, authenticatedUser } from './firebaseAdmin';
import { DAY_MS, getInactivityDays, INACTIVITY_DAYS, REMINDER_DAYS } from '../src/services/rankingActivity';

function whatsappConfig() {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId,
    WHATSAPP_GRAPH_VERSION: version, WHATSAPP_INACTIVITY_TEMPLATE: template } = process.env;
  return token && phoneId && version && template ? { token, phoneId, version, template } : null;
}

async function checkAthlete(athleteId: string, now: number) {
  const db = adminDatabase();
  const ref = db.collection('athletes_public').doc(athleteId);
  const config = whatsappConfig();
  const reminder = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const athlete = snapshot.data();
    if (!athlete) return null;
    const days = getInactivityDays(athlete.lastMatchAt, now);
    if (days === null || days < REMINDER_DAYS) return null;
    if (days >= INACTIVITY_DAYS) {
      if (!athlete.rankingInactive) transaction.update(ref, { points: 0, rankingInactive: true,
        levelPoints: 0, levelMatches: 0, levelWins: 0, lastPointsDelta: 0,
        highestHistoricalLevel: athlete.highestHistoricalLevel || athlete.level });
      return null;
    }
    if (!config) return null;
    const contact = (await transaction.get(db.collection('athlete_contacts').doc(athleteId))).data();
    if (!contact?.whatsappOptIn || !/^\d{10,15}$/.test(contact.phone || '')) return null;
    const key = `${athleteId}_${Date.parse(athlete.lastMatchAt)}`;
    const dispatchRef = db.collection('inactivity_dispatches').doc(key);
    const previous = (await transaction.get(dispatchRef)).data();
    // A timeout has uncertain delivery; never automatically resend it.
    if (previous) return null;
    transaction.create(dispatchRef, { status: 'sending', athleteId, lastMatchAt: athlete.lastMatchAt, createdAt: new Date(now).toISOString() });
    return { key, phone: contact.phone, name: athlete.name, remaining: INACTIVITY_DAYS - days };
  });
  if (!reminder || !config) return;
  const dispatchRef = db.collection('inactivity_dispatches').doc(reminder.key);
  try {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneId}/messages`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: reminder.phone, type: 'template',
        template: { name: config.template, language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: [
          { type: 'text', text: reminder.name }, { type: 'text', text: String(reminder.remaining) },
        ] }] } }),
    });
    const result = await response.json() as { messages?: { id: string }[] };
    const providerId = result.messages?.[0]?.id;
    await dispatchRef.update({ status: response.ok && providerId ? 'accepted' : 'failed',
      providerId: providerId || null, httpStatus: response.status });
  } catch {
    await dispatchRef.update({ status: 'unknown_delivery' });
  }
}

export function registerInactivityRoutes(app: Express) {
  app.post('/api/ranking/inactivity/check', async (req, res) => {
    try {
      const user = await authenticatedUser(req);
      const db = adminDatabase();
      // One check per account per day across tabs/devices. The scheduled job covers absent users.
      const due = await db.runTransaction(async transaction => {
        const ref = db.collection('inactivity_checks').doc(user.uid);
        const previous = (await transaction.get(ref)).data();
        if (previous && Date.now() - previous.checkedAt < DAY_MS) return false;
        transaction.set(ref, { checkedAt: Date.now() });
        return true;
      });
      if (!due) { res.json({ checked: 0 }); return; }
      const profiles = await db.collection('athletes_public').where('ownerId', '==', user.uid).limit(100).get();
      for (const profile of profiles.docs) await checkAthlete(profile.id, Date.now());
      res.json({ checked: profiles.size, whatsappConfigured: Boolean(whatsappConfig()) });
    } catch (error) {
      res.status(error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 503)
        .json({ error: 'Não foi possível verificar a atividade. Tente novamente mais tarde.' });
    }
  });

  app.post('/api/jobs/ranking-inactivity', async (req, res) => {
    const expected = process.env.INACTIVITY_JOB_SECRET;
    const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
    if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      res.status(401).json({ error: 'Não autorizado.' }); return;
    }
    const cursor = typeof req.body.cursor === 'string' ? req.body.cursor : '';
    if (cursor.length > 64 || (cursor && !/^[\w-]+$/.test(cursor))) { res.status(400).json({ error: 'Cursor inválido.' }); return; }
    try {
      // Page by document ID so newly active players and resets cannot skip the remaining page.
      let query = adminDatabase().collection('athletes_public').orderBy(FieldPath.documentId()).limit(100);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const profile of page.docs) await checkAthlete(profile.id, Date.now());
      res.json({ checked: page.size, nextCursor: page.size === 100 ? page.docs.at(-1)!.id : null });
    } catch {
      res.status(503).json({ error: 'Verificação indisponível.' });
    }
  });
}

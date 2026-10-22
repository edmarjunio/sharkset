import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest, type Request } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onUserCreated } from 'firebase-functions/v2/identity';
import { FieldValue } from 'firebase-admin/firestore';
import { WebhookReceiver } from 'livekit-server-sdk';
import { LiveService, applyWebhook } from './service';
import { listBroadcasts } from './directory';
import { LiveError, PROJECT_ID, REGION, validId } from './policy';
import { didOfficialResultChange, validateOfficialResult } from './tournament-results';
import { createTokenOrder, processMercadoPagoNotification } from './mercado-pago';
import { createTournamentWithEntitlement } from './tournaments';

const apiKey = defineSecret('LIVEKIT_API_KEY');
const apiSecret = defineSecret('LIVEKIT_API_SECRET');
const serverUrl = defineSecret('LIVEKIT_URL');
const mercadoPagoAccessToken = defineSecret('MERCADO_PAGO_ACCESS_TOKEN');
const mercadoPagoWebhookSecret = defineSecret('MERCADO_PAGO_WEBHOOK_SECRET');
// Keep this default aligned with firebase-applet-config.json and firebase.json.
const firestoreDatabaseId = defineString('FIRESTORE_DATABASE_ID', {
  default: '(default)',
});
// A standard LiveKit JWT discloses its API-key identifier as `iss`. Explicit acceptance is required.
const allowIssuerDisclosure = defineBoolean('LIVEKIT_ALLOW_JWT_ISSUER_DISCLOSURE', { default: false });
const origins = ['https://sharkset.web.app', 'https://sharkset.firebaseapp.com', 'http://localhost:369', 'http://localhost:5173'];
// Only the gateway identity may invoke these services; never allUsers/allAuthenticatedUsers.
const common = { region: REGION, invoker: [`livekit-gateway@${PROJECT_ID}.iam.gserviceaccount.com`], minInstances: 0, maxInstances: 2, concurrency: 20, memory: '256MiB' as const, timeoutSeconds: 30, cors: origins };

/** Creates a pending token order and a Mercado Pago Checkout Pro preference. */
export const createTournamentTokenCheckout = onCall({
  region: REGION,
  secrets: [mercadoPagoAccessToken],
  maxInstances: 2,
  cors: origins,
}, async (request) => {
  if (!request.auth || request.auth.token.email_verified !== true) {
    throw new HttpsError('unauthenticated', 'Entre com uma conta verificada para comprar tokens.');
  }
  const quantity = Number(request.data?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new HttpsError('invalid-argument', 'Escolha entre 1 e 10 tokens por compra.');
  }
  try {
    return await createTokenOrder(database(), mercadoPagoAccessToken.value(), {
      uid: request.auth.uid,
      email: typeof request.auth.token.email === 'string' ? request.auth.token.email : '',
      quantity,
    });
  } catch {
    throw new HttpsError('unavailable', 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
});

/** Creates a championship and consumes one paid token atomically when the account has no plan. */
export const createArenaTournament = onCall({ region: REGION, maxInstances: 4, cors: origins }, async (request) => {
  if (!request.auth || request.auth.token.email_verified !== true) {
    throw new HttpsError('unauthenticated', 'Entre com uma conta verificada para criar um campeonato.');
  }
  if (!request.data?.tournament || typeof request.data.tournament !== 'object' || Array.isArray(request.data.tournament)) {
    throw new HttpsError('invalid-argument', 'Dados do campeonato inválidos.');
  }
  try {
    const result = await createTournamentWithEntitlement(database(), {
      uid: request.auth.uid,
      email: typeof request.auth.token.email === 'string' ? request.auth.token.email : '',
      isPlatformAdmin: String(request.auth.token.email || '').toLowerCase() === 'edmarjuniob@gmail.com' || request.auth.token.platformAdmin === true,
      payload: request.data.tournament as Record<string, unknown>,
    });
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      ARENA_REQUIRED: 'Escolha uma arena para sediar o campeonato.',
      INVALID_TOURNAMENT: 'Confira os dados do campeonato.',
      ARENA_NOT_FOUND: 'A arena selecionada não existe mais.',
      TOURNAMENT_EXISTS: 'Este campeonato já foi criado. Atualize a tela.',
      PROFILE_REQUIRED: 'Seu perfil ainda está sendo preparado. Tente novamente em alguns instantes.',
      ARENA_FORBIDDEN: 'Você não tem permissão para criar campeonatos nesta arena.',
      TOKEN_REQUIRED: 'Compre um token ou ative um plano para criar este campeonato.',
    };
    if (messages[code]) throw new HttpsError(code === 'ARENA_FORBIDDEN' ? 'permission-denied' : 'failed-precondition', messages[code]);
    throw new HttpsError('unavailable', 'Não foi possível salvar o campeonato. Tente novamente.');
  }
});

/** Initializes a private profile when Firebase Authentication creates an account. */
export const initializeUserProfile = onUserCreated({ region: REGION, maxInstances: 4 }, async (event) => {
  const user = event.data;
  if (!user?.uid) return;
  const profileRef = database().doc(`user_profiles/${user.uid}`);
  await profileRef.create({
    id: user.uid,
    displayName: String(user.displayName || 'Atleta').slice(0, 120),
    ...(user.email ? { email: user.email.slice(0, 160) } : {}),
    ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 500) } : {}),
    role: 'athlete',
    ownerId: user.uid,
    level: 'iniciante',
    experienceCategory: 'amador',
    tournamentTokens: 0,
    points: 0,
    wins: 0,
    matchesPlayed: 0,
    titlesCount: 0,
    tournamentsPlayed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).catch(async error => {
    if ((error as { code?: number }).code !== 6) throw error;
    await profileRef.set({
      displayName: String(user.displayName || 'Atleta').slice(0, 120),
      ...(user.email ? { email: user.email.slice(0, 160) } : {}),
      ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 500) } : {}),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
});

export const likeAcademyPost = onCall({ region: REGION, maxInstances: 4, cors: origins }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para curtir uma publicação.');
  const postId = request.data?.postId;
  if (typeof postId !== 'string' || !/^[\w-]{1,64}$/.test(postId)) {
    throw new HttpsError('invalid-argument', 'Publicação inválida.');
  }
  const db = database();
  const postRef = db.doc(`academy_posts/${postId}`);
  const likeRef = db.doc(`academy_post_likes/${postId}/users/${request.auth.uid}`);
  try {
    return await db.runTransaction(async transaction => {
      const [postSnapshot, likeSnapshot] = await Promise.all([transaction.get(postRef), transaction.get(likeRef)]);
      if (!postSnapshot.exists) throw new HttpsError('not-found', 'A publicação não existe mais.');
      const count = Number(postSnapshot.data()?.likesCount || 0);
      if (!likeSnapshot.exists) {
        transaction.create(likeRef, { ownerId: request.auth!.uid, createdAt: FieldValue.serverTimestamp() });
        transaction.update(postRef, { likesCount: count + 1, updatedAt: new Date().toISOString() });
        return { likesCount: count + 1, liked: true };
      }
      return { likesCount: count, liked: true };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'Não foi possível atualizar a curtida.');
  }
});

/** Public provider callback. Credits are granted only after signature and payment API verification. */
export const mercadoPagoWebhook = onRequest({
  region: REGION,
  secrets: [mercadoPagoAccessToken, mercadoPagoWebhookSecret],
  maxInstances: 4,
  timeoutSeconds: 30,
  cors: false,
}, async (req, res) => {
  if (req.method !== 'POST') { res.sendStatus(405); return; }
  try {
    await processMercadoPagoNotification(database(), {
      accessToken: mercadoPagoAccessToken.value(),
      webhookSecret: mercadoPagoWebhookSecret.value(),
      signature: String(req.get('x-signature') || ''),
      requestId: String(req.get('x-request-id') || ''),
      dataId: typeof req.query['data.id'] === 'string' ? req.query['data.id'] : '',
    });
    res.sendStatus(200);
  } catch {
    // Provider retries transient errors; invalid signatures return without mutation above.
    res.sendStatus(503);
  }
});

function database() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (project !== PROJECT_ID) throw new LiveError(503, 'PROJECT_MISMATCH');
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  if (getApps()[0].options.projectId !== PROJECT_ID) throw new LiveError(503, 'PROJECT_MISMATCH');
  return getFirestore(getApps()[0], firestoreDatabaseId.value());
}
function authorization(req: Request) {
  // API Gateway preserves the original bearer/signature in this header while authenticating to private functions.
  return req.get('X-Forwarded-Authorization') || req.get('Authorization') || '';
}
function respondError(res: { status: (status: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  const known = error instanceof LiveError;
  res.status(known ? error.status : 503).json({ error: known ? error.code : 'LIVE_UNAVAILABLE' });
}

export const livekitSession = onRequest({ ...common, serviceAccount: `livekit-session@${PROJECT_ID}.iam.gserviceaccount.com`, secrets: [apiKey, apiSecret, serverUrl] }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  try {
    const db = database();
    const bearer = authorization(req).match(/^Bearer (\S+)$/)?.[1];
    if (!bearer) throw new LiveError(401, 'AUTH_REQUIRED');
    let uid: string;
    try { uid = (await getAuth().verifyIdToken(bearer, true)).uid; }
    catch { throw new LiveError(401, 'AUTH_REQUIRED'); }
    const action = req.path.split('/').filter(Boolean).pop();
    if (!['start', 'viewer', 'confirm', 'stop', 'status'].includes(action || '')) throw new LiveError(404, 'NOT_FOUND');
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['arenaId', 'sessionId'].includes(key))) throw new LiveError(400, 'INVALID_REQUEST');
    if (['start', 'viewer', 'status'].includes(action!) && !validId(body.arenaId)) throw new LiveError(400, 'INVALID_ARENA');
    if ((action === 'confirm' || action === 'stop') && typeof body.sessionId !== 'string') throw new LiveError(400, 'INVALID_SESSION');
    if ((action === 'start' || action === 'viewer') && !allowIssuerDisclosure.value()) throw new LiveError(503, 'ISSUER_DISCLOSURE_DISABLED');
    const live = new LiveService(db, { key: apiKey.value(), secret: apiSecret.value(), url: serverUrl.value() });
    const result = action === 'start' ? await live.start(uid, body.arenaId) : action === 'status' ? await live.status(uid, body.arenaId) : action === 'viewer' ? await live.viewer(uid, body.arenaId) : action === 'confirm' ? await live.confirm(uid, body.sessionId) : await live.stop(uid, body.sessionId);
    res.json(result);
  } catch (error) { respondError(res, error); }
});

export const livekitDirectory = onRequest({ ...common, serviceAccount: `livekit-directory@${PROJECT_ID}.iam.gserviceaccount.com`, secrets: [] }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  try { res.json(await listBroadcasts(database(), req.query)); }
  catch (error) { respondError(res, error); }
});

export const livekitWebhook = onRequest({ ...common, serviceAccount: `livekit-webhook@${PROJECT_ID}.iam.gserviceaccount.com`, secrets: [apiKey, apiSecret], cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.sendStatus(405); return; }
  if (!req.rawBody || req.rawBody.length > 262144) { res.sendStatus(400); return; }
  let event;
  try { event = await new WebhookReceiver(apiKey.value(), apiSecret.value()).receive(req.rawBody.toString('utf8'), authorization(req)); }
  catch { res.sendStatus(401); return; }
  try { await applyWebhook(database(), event); res.sendStatus(204); }
  catch { res.sendStatus(503); } // Provider can retry. Never log body, Authorization, SDK errors or secrets.
});

export const tournamentResultNotification = onDocumentWritten({
  document: 'tournaments/{tournamentId}/matches/{matchId}',
  region: REGION,
  maxInstances: 4,
  retry: true,
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || after.status !== 'completed' || !didOfficialResultChange(before, after)) return;

  const { tournamentId, matchId } = event.params;
  if (!validId(tournamentId) || !validId(matchId)) return;

  const db = database();
  const tournamentSnapshot = await db.doc(`tournaments/${tournamentId}`).get();
  if (!tournamentSnapshot.exists) return;
  const tournamentName = typeof tournamentSnapshot.data()?.name === 'string' ? tournamentSnapshot.data()!.name : '';
  const notification = validateOfficialResult({
    tournamentId,
    matchId,
    match: after,
    tournamentName,
    isCorrection: before?.status === 'completed',
  });
  if (!notification) return;

  const matchRef = db.doc(`tournaments/${tournamentId}/matches/${matchId}`);
  const notificationRef = db.doc(`tournaments/${tournamentId}/result_events/${notification.eventId}`);
  await db.runTransaction(async (transaction) => {
    const [latestSnapshot, notificationSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(notificationRef),
    ]);
    const latest = latestSnapshot.data();
    if (!latest || latest.status !== 'completed' || latest.revision !== notification.revision) return;
    if (!didOfficialResultChange(before, latest)) return;

    transaction.set(matchRef, { serverValidatedRevision: notification.revision }, { merge: true });
    if (!notificationSnapshot.exists) {
      transaction.set(notificationRef, { ...notification, createdAt: FieldValue.serverTimestamp() });
    }
  });
});

// Public, server-managed lookup lets viewers connect a broadcast directory entry
// to the tournament whose official result events they should receive.
export const tournamentBroadcastLink = onDocumentWritten({
  document: 'tournaments/{tournamentId}/matches/{matchId}',
  region: REGION,
  maxInstances: 4,
  retry: true,
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const { tournamentId, matchId } = event.params;
  if (!validId(tournamentId) || !validId(matchId)) return;
  const db = database();
  const previousId = typeof before?.linkedBroadcastId === 'string' && validId(before.linkedBroadcastId)
    ? before.linkedBroadcastId
    : '';
  const nextId = typeof after?.linkedBroadcastId === 'string' && validId(after.linkedBroadcastId)
    ? after.linkedBroadcastId
    : '';
  if (previousId === nextId) return;

  const matchRef = db.doc(`tournaments/${tournamentId}/matches/${matchId}`);
  const previousRef = previousId ? db.doc(`broadcast_tournament_links/${previousId}`) : null;
  const nextRef = nextId ? db.doc(`broadcast_tournament_links/${nextId}`) : null;
  await db.runTransaction(async (transaction) => {
    const currentMatchSnapshot = await transaction.get(matchRef);
    const currentLink = currentMatchSnapshot.data()?.linkedBroadcastId;
    const currentId = typeof currentLink === 'string' && validId(currentLink) ? currentLink : '';
    // Firestore may deliver an older write after a newer one. Only project the
    // current link, so a delayed trigger cannot recreate a stale mapping.
    if (currentId !== nextId) return;

    const previousSnapshot = previousRef ? await transaction.get(previousRef) : null;
    const nextSnapshot = nextRef && nextRef.path !== previousRef?.path ? await transaction.get(nextRef) : null;
    const previous = previousSnapshot?.data();
    const next = nextSnapshot?.data();
    if (previousRef && previous?.tournamentId === tournamentId && previous?.matchId === matchId) {
      transaction.delete(previousRef);
    }
    if (nextRef && (next?.tournamentId !== tournamentId || next?.matchId !== matchId)) {
      transaction.set(nextRef, { tournamentId, matchId });
    }
  });
});

// Expose only safe display fields for active, pinned, global coupons.
export const pinnedCouponPromotion = onDocumentWritten({
  document: 'coupons/{couponId}',
  region: REGION,
  maxInstances: 2,
  retry: true,
}, async (event) => {
  const { couponId } = event.params;
  if (!validId(couponId)) return;
  const db = database();
  const couponRef = db.doc(`coupons/${couponId}`);
  const promotionRef = db.doc(`public_promotions/${couponId}`);
  const current = await couponRef.get();
  const coupon = current.data();
  if (!current.exists || coupon?.scope !== 'global' || coupon?.active !== true || coupon?.pinned !== true) {
    await promotionRef.delete().catch(() => undefined);
    return;
  }

  const expiresAt = typeof coupon.expiresAt === 'string' ? coupon.expiresAt : '';
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
    await promotionRef.delete().catch(() => undefined);
    return;
  }
  if (typeof coupon.code !== 'string' || coupon.code.length > 40) {
    await promotionRef.delete().catch(() => undefined);
    return;
  }

  await promotionRef.set({
    id: couponId,
    code: coupon.code,
    discountType: coupon.discountType === 'percent' ? 'percent' : 'fixed',
    discountValue: typeof coupon.discountValue === 'number' ? coupon.discountValue : 0,
    title: 'CUPOM: DEU A LOUCA NO SHARKINHO!',
    message: typeof coupon.bannerMessage === 'string' && coupon.bannerMessage.length <= 160
      ? coupon.bannerMessage
      : coupon.discountType === 'percent'
        ? `TODOS OS HORÁRIOS COM ${coupon.discountValue}% DE DESCONTO`
        : `TODOS OS HORÁRIOS COM R$ ${coupon.discountValue} DE DESCONTO`,
    expiresAt: expiresAt || null,
    updatedAt: FieldValue.serverTimestamp(),
  });
});

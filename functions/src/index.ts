import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { WebhookReceiver } from 'livekit-server-sdk';
import { LiveService, applyWebhook } from './service';
import { listBroadcasts } from './directory';
import { LiveError, PROJECT_ID, REGION, validId } from './policy';

const apiKey = defineSecret('LIVEKIT_API_KEY');
const apiSecret = defineSecret('LIVEKIT_API_SECRET');
const serverUrl = defineSecret('LIVEKIT_URL');
// Keep this default aligned with firebase-applet-config.json and firebase.json.
const firestoreDatabaseId = defineString('FIRESTORE_DATABASE_ID', {
  default: 'ai-studio-izibolaarenabeac-fbe2fcd6-71ad-48a2-8b43-55c4f4c3b2c2',
});
// A standard LiveKit JWT discloses its API-key identifier as `iss`. Explicit acceptance is required.
const allowIssuerDisclosure = defineBoolean('LIVEKIT_ALLOW_JWT_ISSUER_DISCLOSURE', { default: false });
const origins = ['https://sharkset.web.app', 'https://sharkset.firebaseapp.com', 'http://localhost:369', 'http://localhost:5173'];
// Only the gateway identity may invoke these services; never allUsers/allAuthenticatedUsers.
const common = { region: REGION, invoker: [`livekit-gateway@${PROJECT_ID}.iam.gserviceaccount.com`], minInstances: 0, maxInstances: 2, concurrency: 20, memory: '256MiB' as const, timeoutSeconds: 30, cors: origins };

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

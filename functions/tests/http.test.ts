import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { livekitSession, livekitWebhook, livekitDirectory } from '../src/index';

process.env.GCLOUD_PROJECT = 'sharkset-70de4';
process.env.LIVEKIT_ALLOW_JWT_ISSUER_DISCLOSURE = 'false';
if (!getApps().length) initializeApp({ projectId: 'sharkset-70de4' });

async function invoke(handler: any, body: any, authorization = '', webhook = false) {
  let status = 200, result: any;
  const headers = new Map<string, string>();
  const res: any = new EventEmitter();
  res.setHeader = (key: string, value: string) => { headers.set(key.toLowerCase(), value); };
  res.getHeader = (key: string) => headers.get(key.toLowerCase());
  res.set = res.setHeader;
  res.status = (value: number) => { status = value; return res; };
  res.json = (value: unknown) => { result = value; res.emit('finish'); return res; };
  res.sendStatus = (value: number) => { status = value; res.emit('finish'); return res; };
  res.end = () => res.emit('finish');
  const req: any = { method: 'POST', path: '/api/livekit/start', headers: { authorization }, body, rawBody: webhook ? Buffer.from('{}') : undefined, get: (key: string) => key.toLowerCase() === 'authorization' ? authorization : '' };
  await handler(req, res);
  return { status, data: result };
}

test('HTTP denies unauthenticated token issuance and wrong-project operation without reading secrets', async () => {
  const unauthenticated = await invoke(livekitSession, { arenaId: 'arena' });
  assert.equal(unauthenticated.status, 401); assert.equal(unauthenticated.data.error, 'AUTH_REQUIRED');
  process.env.GCLOUD_PROJECT = 'other-project-test';
  try {
    const wrongProject = await invoke(livekitSession, {});
    assert.equal(wrongProject.status, 503); assert.equal(wrongProject.data.error, 'PROJECT_MISMATCH');
  } finally { process.env.GCLOUD_PROJECT = 'sharkset-70de4'; }
});

test('HTTP blocks issuer disclosure by default, rejects role injection and denies invalid webhook signatures', async () => {
  const auth = getAuth(), original = auth.verifyIdToken;
  auth.verifyIdToken = (async () => ({ uid: 'owner' })) as any;
  try {
    assert.equal((await invoke(livekitSession, { arenaId: 'arena', role: 'publisher' }, 'Bearer unit-test-identity')).status, 400);
    const blocked = await invoke(livekitSession, { arenaId: 'arena' }, 'Bearer unit-test-identity');
    assert.equal(blocked.status, 503); assert.equal(blocked.data.error, 'ISSUER_DISCLOSURE_DISABLED'); assert.equal(blocked.data.token, undefined);
    process.env.LIVEKIT_API_KEY = 'synthetic-http-test'; process.env.LIVEKIT_API_SECRET = 'synthetic-http-test-secret';
    assert.equal((await invoke(livekitWebhook, {}, 'invalid', true)).status, 401);
  } finally { auth.verifyIdToken = original; delete process.env.LIVEKIT_API_KEY; delete process.env.LIVEKIT_API_SECRET; }
});

test('Gen 2 manifest binds secrets only where needed and grants invocation only to the gateway identity', () => {
  const endpoint = (fn: any) => fn.__endpoint;
  for (const fn of [livekitSession, livekitWebhook, livekitDirectory]) {
    assert.equal(endpoint(fn).platform, 'gcfv2');
    const invoker = JSON.stringify(endpoint(fn).httpsTrigger);
    assert.ok(invoker.includes('livekit-gateway@sharkset-70de4.iam.gserviceaccount.com'));
    assert.equal(invoker.includes('public'), false);
  }
  const secrets = (fn: any) => (endpoint(fn).secretEnvironmentVariables || []).map((item: any) => item.key).sort();
  assert.deepEqual(secrets(livekitSession), ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL']);
  assert.deepEqual(secrets(livekitWebhook), ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']); assert.deepEqual(secrets(livekitDirectory), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { AccessToken, TokenVerifier, TrackSource, TrackType, WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';
import { issueToken, requireManager, publicLive, validateServerUrl, LiveError } from '../src/policy';
import { LiveService, applyWebhook } from '../src/service';
import { listBroadcasts } from '../src/directory';

const credentials = { key: 'unit-test-not-a-production-key', secret: randomBytes(32).toString('hex'), url: 'wss://unit-test.invalid' };
class MemoryDatabase {
  data = new Map<string, any>();
  limits: number[] = [];
  queue = Promise.resolve();
  doc(path: string): any { return { path, id: path.split('/').pop(), get: async () => this.snapshot(path) }; }
  snapshot(path: string): any { return { id: path.split('/').pop(), exists: this.data.has(path), data: () => structuredClone(this.data.get(path)) }; }
  async getAll(...refs: any[]) { return refs.map(ref => this.snapshot(ref.path)); }
  async runTransaction(fn: Function) {
    let finish: Function = () => {};
    const previous = this.queue; this.queue = new Promise(resolve => { finish = resolve; });
    await previous;
    const writes: Function[] = []; let writing = false;
    const tx: any = {
      get: async (ref: any) => { assert.equal(writing, false, 'Firestore transactions must read before writing'); return this.snapshot(ref.path); },
      getAll: async (...refs: any[]) => { assert.equal(writing, false); return refs.map(ref => this.snapshot(ref.path)); },
      set: (ref: any, value: any) => { writing = true; writes.push(() => this.data.set(ref.path, structuredClone(value))); },
      update: (ref: any, value: any) => { writing = true; writes.push(() => { assert.ok(this.data.has(ref.path)); this.data.set(ref.path, { ...this.data.get(ref.path), ...structuredClone(value) }); }); },
      create: (ref: any, value: any) => { writing = true; writes.push(() => { assert.equal(this.data.has(ref.path), false); this.data.set(ref.path, structuredClone(value)); }); },
    };
    try { const result = await fn(tx); for (const write of writes) write(); return result; }
    finally { finish(); }
  }
  collection(name: string) {
    let count = 0, after = '';
    const chain: any = {
      where: () => chain, orderBy: () => chain, limit: (value: number) => { count = value; this.limits.push(value); return chain; },
      startAfter: (value: string) => { after = value; return chain; },
      get: async () => { const docs = [...this.data.keys()].filter(path => path.startsWith(name + '/') && this.data.get(path).isLive && path.split('/').pop()! > after).sort().slice(0, count).map(path => this.snapshot(path)); return { docs, size: docs.length }; },
    };
    return chain;
  }
}
function fixture() {
  const db = new MemoryDatabase(); db.data.set('arenas/arena', { ownerId: 'owner', name: 'Arena', city: 'Mineiros', state: 'GO', lat: -17.5689, lng: -52.5812 });
  let hasCamera = false, unavailable = false, deleteFails = false, removed = 0, sid = ''; 
  const rooms: any = {
    createRoom: async () => { if (unavailable) throw Error('Provider failure with confidential context'); return {}; },
    getParticipant: async () => ({ sid, tracks: hasCamera ? [{ type: TrackType.VIDEO, source: TrackSource.CAMERA, muted: false }] : [] }),
    removeParticipant: async () => { removed++; },
    deleteRoom: async () => { if (deleteFails) throw Error('Network failure'); },
  };
  const service = new LiveService(db as any, credentials, rooms);
  return { db, service, camera: (value: boolean) => { hasCamera = value; }, offline: () => { unavailable = true; }, failDelete: () => { deleteFails = true; }, removed: () => removed, setSid: (value: string) => { sid = value; } };
}
async function live(f = fixture()) { const ticket = await f.service.start('owner', 'arena'); f.camera(true); await f.service.confirm('owner', ticket.sessionId); return { ...f, ticket }; }
function event(room: string, type: string, identity?: string, id = randomBytes(8).toString('hex')): WebhookEvent {
  return { id, event: type, room: { name: room }, participant: { identity }, createdAt: BigInt(Math.floor(Date.now() / 1000)) } as any;
}

test('official SDK grants are scoped to one room, two minutes, and distinct publisher/viewer capabilities', async () => {
  const verify = new TokenVerifier(credentials.key, credentials.secret);
  const publisher = await verify.verify(await issueToken(credentials, 'private-room', 'manager', 'publisher'));
  const viewer = await verify.verify(await issueToken(credentials, 'private-room', 'spectator', 'viewer'));
  assert.equal(publisher.iss, credentials.key, 'LiveKit exposes its key identifier as the standard JWT issuer');
  assert.equal(publisher.video?.room, 'private-room'); assert.equal(publisher.video?.canPublish, true); assert.equal(publisher.video?.canSubscribe, false);
  assert.deepEqual(publisher.video?.canPublishSources, ['camera', 'microphone']);
  assert.equal(viewer.video?.canPublish, false); assert.equal(viewer.video?.canSubscribe, true);
  for (const claims of [publisher, viewer]) { assert.equal(claims.video?.roomAdmin, false); assert.equal(claims.video?.canPublishData, false); assert.equal(claims.video?.canUpdateOwnMetadata, false); assert.ok(Number(claims.exp) - Number(claims.nbf) <= 120); }
});

test('arena ownership or server-managed active membership is mandatory', () => {
  assert.throws(() => requireManager('intruder', { ownerId: 'owner' }), /ARENA_FORBIDDEN/);
  assert.throws(() => requireManager('intruder', { ownerId: 'owner' }, { role: 'manager', active: false }), /ARENA_FORBIDDEN/);
  requireManager('member', { ownerId: 'owner' }, { role: 'manager', active: true });
  assert.throws(() => requireManager('any', undefined), /ARENA_NOT_FOUND/);
});

test('start is private preparation; only provider-confirmed camera appears publicly and returns no secret URL or credentials', async () => {
  const f = fixture(), ticket = await f.service.start('owner', 'arena');
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
  assert.equal(Object.hasOwn(ticket, 'serverUrl'), false);
  assert.equal(Object.values(ticket).some(value => value === credentials.key || value === credentials.secret || value === credentials.url), false);
  await assert.rejects(f.service.confirm('owner', ticket.sessionId), /CAMERA_NOT_PUBLISHED/);
  await assert.rejects(f.service.viewer('viewer', 'arena'), /LIVE_NOT_FOUND/);
  f.camera(true); await f.service.confirm('owner', ticket.sessionId);
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, true);
  const response = await f.service.viewer('viewer', 'arena');
  assert.equal(Object.hasOwn(response, 'serverUrl'), false);
  const claims = await new TokenVerifier(credentials.key, credentials.secret).verify(response.token);
  assert.equal(claims.video?.canPublish, false);
});

test('concurrent starts cannot create two active rooms; a foreign arena cannot be managed', async () => {
  const f = fixture();
  const attempts = await Promise.allSettled([f.service.start('owner', 'arena'), f.service.start('owner', 'arena')]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  await assert.rejects(f.service.start('intruder', 'arena'), /ARENA_FORBIDDEN/);
});

test('failed provider start never announces a live', async () => {
  const f = fixture(); f.offline();
  await assert.rejects(f.service.start('owner', 'arena'), /LIVEKIT_UNAVAILABLE/);
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
});

test('stop is idempotent, revokes publisher, blocks viewing and confirmation; a manager can stop another manager session', async () => {
  const f = await live();
  f.db.data.set('arena_members/arena/users/member', { active: true, role: 'manager' });
  await assert.rejects(f.service.confirm('member', f.ticket.sessionId), /PUBLISHER_FORBIDDEN/);
  await f.service.stop('member', f.ticket.sessionId); await f.service.stop('owner', f.ticket.sessionId);
  assert.ok(f.removed() >= 1); assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
  await assert.rejects(f.service.confirm('owner', f.ticket.sessionId), /LIVE_EXPIRED/);
  await assert.rejects(f.service.viewer('spectator', 'arena'), /LIVE_NOT_FOUND/);
});

test('provider outage during stop suspends discovery and allows stop retry without advertising success', async () => {
  const f = await live(); f.failDelete();
  await assert.rejects(f.service.stop('owner', f.ticket.sessionId), /STOP_RETRY_REQUIRED/);
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
  assert.equal(f.db.data.get(`livekit_rooms/${f.ticket.sessionId}`).status, 'stopping');
});

test('signed webhook validates exact raw bytes; altered body, invalid key and missing signature are rejected', async () => {
  const body = JSON.stringify({ event: 'room_finished', id: 'event', createdAt: Math.floor(Date.now() / 1000), room: { name: 'room' } });
  const token = new AccessToken(credentials.key, credentials.secret, { ttl: '1m' });
  token.sha256 = createHash('sha256').update(body).digest('base64');
  const signed = await token.toJwt(), receiver = new WebhookReceiver(credentials.key, credentials.secret);
  assert.equal((await receiver.receive(body, signed)).event, 'room_finished');
  await assert.rejects(receiver.receive(body + ' ', signed));
  await assert.rejects(receiver.receive(body, 'not-a-signature'));
  await assert.rejects(receiver.receive(body, undefined));
});

test('webhooks are deduplicated, viewer disconnects are harmless and terminal sessions never revive', async () => {
  const f = await live(), initial = f.db.data.get('broadcasts/lk_arena');
  await applyWebhook(f.db as any, event(f.ticket.sessionId, 'participant_left', 'viewer:spectator'));
  assert.deepEqual(f.db.data.get('broadcasts/lk_arena'), initial);
  const stopped = event(f.ticket.sessionId, 'participant_left', f.db.data.get(`livekit_rooms/${f.ticket.sessionId}`).publisherIdentity);
  await applyWebhook(f.db as any, stopped); const snapshot = structuredClone([...f.db.data.entries()]);
  await applyWebhook(f.db as any, stopped); assert.deepEqual([...f.db.data.entries()], snapshot);
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
  await assert.rejects(f.service.confirm('owner', f.ticket.sessionId), /LIVE_EXPIRED/);
});

test('old room events and out-of-order events cannot stop a newer broadcast', async () => {
  const f = await live(), old = f.ticket.sessionId;
  await f.service.stop('owner', old);
  const next = await f.service.start('owner', 'arena'); await f.service.confirm('owner', next.sessionId);
  await applyWebhook(f.db as any, event(old, 'room_finished'));
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, true);
  const session = f.db.data.get(`livekit_rooms/${next.sessionId}`); session.lastEventAt = Date.now() + 10000;
  await applyWebhook(f.db as any, event(next.sessionId, 'room_finished'));
  assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, true);
});

test('expired and camera-less lives cannot receive viewer tokens; rate limit is enforced', async () => {
  const f = await live();
  f.camera(false); await assert.rejects(f.service.viewer('viewer', 'arena'), /CAMERA_NOT_PUBLISHED/); f.camera(true);
  for (let i = 0; i < 10; i++) await f.service.viewer('limited', 'arena');
  await assert.rejects(f.service.viewer('limited', 'arena'), /RATE_LIMITED/);
  f.db.data.get('livekit_arena_locks/arena').expiresAt = 0;
  await assert.rejects(f.service.viewer('viewer', 'arena'), /LIVE_NOT_FOUND/);
  assert.equal(publicLive({ provider: 'livekit', isLive: true, liveExpiresAt: 0 }), false);
});

test('directory pages exclude stale sessions and strip all private room and identity metadata', async () => {
  const f = await live();
  f.db.data.set('broadcasts/stale', { arenaId: 'arena', provider: 'livekit', isLive: true, liveExpiresAt: 0 });
  const result = await listBroadcasts(f.db as any, { mode: 'city', city: 'mineiros', state: 'go' });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].id, 'lk_arena'); assert.deepEqual(f.db.limits, [12]);
  assert.equal(Object.hasOwn(result.items[0], 'publisherUid'), false); assert.equal(Object.hasOwn(result.items[0], 'room'), false);
  await assert.rejects(listBroadcasts(f.db as any, { mode: 'nearby', lat: 'NaN', lng: '0' }), /INVALID_FILTER/);
  assert.throws(() => validateServerUrl('https://unsafe.invalid'), /LIVEKIT_CONFIGURATION/);
});

test('a delayed disconnect from an older participant SID cannot end a reconnected publisher', async () => {
  const f = fixture(), ticket = await f.service.start('owner', 'arena');
  f.camera(true); f.setSid('PA_old'); await f.service.confirm('owner', ticket.sessionId);
  f.setSid('PA_new'); await f.service.confirm('owner', ticket.sessionId);
  const publisher = f.db.data.get('livekit_rooms/' + ticket.sessionId).publisherIdentity;
  const old = event(ticket.sessionId, 'participant_left', publisher); old.participant!.sid = 'PA_old';
  await applyWebhook(f.db as any, old); assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, true);
  const current = event(ticket.sessionId, 'participant_left', publisher); current.participant!.sid = 'PA_new';
  await applyWebhook(f.db as any, current); assert.equal(f.db.data.get('broadcasts/lk_arena').isLive, false);
});

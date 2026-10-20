import { randomUUID, createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { RoomServiceClient, TrackSource, type WebhookEvent } from 'livekit-server-sdk';
import { cameraPublished, isTerminal, issueToken, LEASE_MS, LiveError, requireManager, validId, validateServerUrl } from './policy';

interface Credentials { key: string; secret: string; url: string }
export class LiveService {
  private rooms: Pick<RoomServiceClient, 'createRoom' | 'deleteRoom' | 'removeParticipant' | 'getParticipant'>;
  private serverUrl: string;
  constructor(private db: Firestore, private credentials: Credentials, rooms?: Pick<RoomServiceClient, 'createRoom' | 'deleteRoom' | 'removeParticipant' | 'getParticipant'>) {
    this.serverUrl = validateServerUrl(credentials.url);
    this.rooms = rooms || new RoomServiceClient(this.serverUrl.replace('wss:', 'https:'), credentials.key, credentials.secret);
  }
  private async manager(uid: string, arenaId: string) {
    const [arena, member] = await this.db.getAll(this.db.doc(`arenas/${arenaId}`), this.db.doc(`arena_members/${arenaId}/users/${uid}`));
    requireManager(uid, arena.data(), member.data());
    return arena.data()!;
  }
  private async rate(tx: Transaction, uid: string, action: string, maximum: number) {
    const bucket = Math.floor(Date.now() / 60_000);
    const id = createHash('sha256').update(`${uid}:${action}:${bucket}`).digest('hex');
    const ref = this.db.doc(`livekit_rate/${id}`);
    const count = Number((await tx.get(ref)).data()?.count || 0);
    if (count >= maximum) throw new LiveError(429, 'RATE_LIMITED');
    // Caller must finish all reads before invoking this write.
    return () => tx.set(ref, { count: count + 1, expiresAt: new Date(Date.now() + 3_600_000) });
  }
  async start(uid: string, arenaId: string) {
    const arena = await this.manager(uid, arenaId);
    const room = `ss-${arenaId}-${randomUUID().replaceAll('-', '')}`;
    const publisherIdentity = `publisher:${uid}:${randomUUID()}`;
    const lockRef = this.db.doc(`livekit_arena_locks/${arenaId}`);
    const roomRef = this.db.doc(`livekit_rooms/${room}`);
    const broadcastRef = this.db.doc(`broadcasts/lk_${arenaId}`);
    let previousRoom = '';
    await this.db.runTransaction(async tx => {
      const lock = (await tx.get(lockRef)).data();
      if (lock && !isTerminal(lock.status) && Number(lock.expiresAt) > Date.now()) throw new LiveError(409, 'LIVE_ALREADY_ACTIVE');
      const writeRate = await this.rate(tx, uid, 'start', 3);
      previousRoom = typeof lock?.room === 'string' ? lock.room : '';
      const now = Date.now();
      const session = { room, arenaId, publisherIdentity, publisherUid: uid, status: 'starting', expiresAt: now + 120_000, createdAt: now, lastEventAt: 0 };
      writeRate(); tx.set(roomRef, session); tx.set(lockRef, session);
      tx.set(broadcastRef, { id: broadcastRef.id, arenaId, provider: 'livekit', title: `Ao vivo · ${String(arena.name || 'Arena').slice(0, 80)}`,
        isLive: false, status: 'starting', liveExpiresAt: 0, videoUrl: '', rankingEligible: false,
        team1: 'Dupla 1', team2: 'Dupla 2', score1: 0, score2: 0, sets1: 0, sets2: 0, bestOf: 1, revision: 0 });
    });
    try {
      if (previousRoom) await this.deleteRoom(previousRoom);
      await this.rooms.createRoom({ name: room, emptyTimeout: 120, departureTimeout: 30, maxParticipants: 51 });
      return { id: `lk_${arenaId}`, sessionId: room, token: await issueToken(this.credentials, room, publisherIdentity, 'publisher') };
    } catch {
      await this.finishState(room, 'failed');
      throw new LiveError(503, 'LIVEKIT_UNAVAILABLE');
    }
  }
  private async session(uid: string, sessionId: string, publisherOnly = true) {
    if (!/^ss-[\w-]{1,110}$/.test(sessionId)) throw new LiveError(400, 'INVALID_SESSION');
    const session = (await this.db.doc(`livekit_rooms/${sessionId}`).get()).data();
    if (!session) throw new LiveError(404, 'LIVE_NOT_FOUND');
    await this.manager(uid, session.arenaId);
    if (publisherOnly && session.publisherUid !== uid) throw new LiveError(403, 'PUBLISHER_FORBIDDEN');
    return session;
  }
  async status(uid: string, arenaId: string) {
    await this.manager(uid, arenaId);
    const active = (await this.db.doc(`livekit_arena_locks/${arenaId}`).get()).data();
    return active && !['ended', 'failed'].includes(active.status) ? { sessionId: active.room, status: active.status } : {};
  }
  async confirm(uid: string, sessionId: string) {
    const session = await this.session(uid, sessionId);
    if (isTerminal(session.status) || session.expiresAt <= Date.now()) throw new LiveError(409, 'LIVE_EXPIRED');
    await this.db.runTransaction(async tx => { const writeRate = await this.rate(tx, uid, 'confirm', 10); writeRate(); });
    let participant;
    try { participant = await this.rooms.getParticipant(sessionId, session.publisherIdentity); }
    catch { throw new LiveError(409, 'CAMERA_NOT_PUBLISHED'); }
    if (!cameraPublished(participant.tracks)) throw new LiveError(409, 'CAMERA_NOT_PUBLISHED');
    await this.db.runTransaction(async tx => {
      const ref = this.db.doc(`livekit_rooms/${sessionId}`), lock = this.db.doc(`livekit_arena_locks/${session.arenaId}`);
      const [current, active] = await tx.getAll(ref, lock);
      if (active.data()?.room !== sessionId || isTerminal(current.data()?.status)) throw new LiveError(409, 'LIVE_EXPIRED');
      const patch = { status: 'live', expiresAt: Date.now() + LEASE_MS, publisherSid: participant.sid || '' };
      tx.update(ref, patch); tx.update(lock, patch);
      tx.update(this.db.doc(`broadcasts/lk_${session.arenaId}`), { status: 'live', isLive: true, liveExpiresAt: patch.expiresAt });
    });
    return { isLive: true };
  }
  async viewer(uid: string, arenaId: string) {
    const [arena, lock] = await this.db.getAll(this.db.doc(`arenas/${arenaId}`), this.db.doc(`livekit_arena_locks/${arenaId}`));
    const session = lock.data();
    if (!arena.exists || arena.data()?.liveViewingDisabled === true || !session || session.status !== 'live' || session.expiresAt <= Date.now()) throw new LiveError(404, 'LIVE_NOT_FOUND');
    await this.db.runTransaction(async tx => {
      const active = (await tx.get(this.db.doc(`livekit_arena_locks/${arenaId}`))).data();
      if (active?.room !== session.room || active?.status !== 'live' || active.expiresAt <= Date.now()) throw new LiveError(409, 'LIVE_EXPIRED');
      const writeRate = await this.rate(tx, uid, 'viewer', 10); writeRate();
    });
    // Rate limiting precedes provider calls. Never issue a viewer token for a camera that has stopped.
    try {
      if (!cameraPublished((await this.rooms.getParticipant(session.room, session.publisherIdentity)).tracks)) throw new Error();
    } catch { throw new LiveError(409, 'CAMERA_NOT_PUBLISHED'); }
    return { token: await issueToken(this.credentials, session.room, `viewer:${uid}:${randomUUID()}`, 'viewer'), publisherIdentity: session.publisherIdentity };
  }
  private async deleteRoom(room: string) {
    try { await this.rooms.deleteRoom(room); }
    catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
  }
  async stop(uid: string, sessionId: string) {
    const session = await this.session(uid, sessionId, false);
    await this.finishState(sessionId, 'stopping');
    try {
      try { await this.rooms.removeParticipant(sessionId, session.publisherIdentity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }); }
      catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
      await this.deleteRoom(sessionId);
    }
    catch { throw new LiveError(503, 'STOP_RETRY_REQUIRED'); }
    await this.finishState(sessionId, 'ended');
    return { ended: true };
  }
  private async finishState(room: string, status: string) {
    await this.db.runTransaction(async tx => {
      const ref = this.db.doc(`livekit_rooms/${room}`), snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      const arenaId = snapshot.data()!.arenaId, lock = this.db.doc(`livekit_arena_locks/${arenaId}`);
      const active = await tx.get(lock);
      tx.update(ref, { status, expiresAt: 0 });
      if (active.data()?.room === room) {
        tx.update(lock, { status, expiresAt: 0 });
        tx.update(this.db.doc(`broadcasts/lk_${arenaId}`), { status, isLive: false, liveExpiresAt: 0 });
      }
    });
  }
}

/** Only receives events already verified by the SDK against rawBody + Authorization. */
export async function applyWebhook(db: Firestore, event: WebhookEvent) {
  if (!event.id || !event.room?.name || !/^ss-[\w-]{1,110}$/.test(event.room.name)) return;
  const room = event.room.name;
  const eventId = createHash('sha256').update(event.id).digest('hex');
  await db.runTransaction(async tx => {
    const ref = db.doc(`livekit_rooms/${room}`), receipt = db.doc(`livekit_events/${eventId}`);
    const [snapshot, duplicate] = await tx.getAll(ref, receipt);
    if (!snapshot.exists || duplicate.exists) return;
    const session = snapshot.data()!, lockRef = db.doc(`livekit_arena_locks/${session.arenaId}`);
    const lock = (await tx.get(lockRef)).data();
    tx.create(receipt, { receivedAt: Date.now(), expiresAt: new Date(Date.now() + 86_400_000) });
    const timestamp = Number(event.createdAt) * 1000;
    if (lock?.room !== room || isTerminal(session.status) || timestamp < session.lastEventAt) return;
    if (event.participant && session.publisherSid && event.participant.sid !== session.publisherSid) return;
    let status: string;
    if (event.event === 'room_finished' || (event.event === 'participant_left' && event.participant?.identity === session.publisherIdentity)) status = 'ended';
    else if (event.participant?.identity === session.publisherIdentity && event.track?.source === TrackSource.CAMERA && event.event === 'track_unpublished') status = 'reconnecting';
    else return; // Publication is announced only after server-side media confirmation.
    const liveExpiresAt = status === 'reconnecting' ? Date.now() + LEASE_MS : 0;
    const patch = { status, expiresAt: liveExpiresAt, lastEventAt: timestamp };
    tx.update(ref, patch); tx.update(lockRef, patch);
    tx.update(db.doc(`broadcasts/lk_${session.arenaId}`), { status, isLive: false, liveExpiresAt });
  });
}

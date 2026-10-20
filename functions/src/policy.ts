import { AccessToken, TrackSource, TrackType } from 'livekit-server-sdk';

export const PROJECT_ID = 'sharkset-70de4';
export const REGION = 'us-central1';
export const LEASE_MS = 90_000;
export class LiveError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function validId(value: unknown): value is string { return typeof value === 'string' && /^[\w-]{1,64}$/.test(value); }
export function requireManager(uid: string, arena: Record<string, unknown> | undefined, membership?: Record<string, unknown>) {
  if (!arena) throw new LiveError(404, 'ARENA_NOT_FOUND');
  if (arena.ownerId !== uid && !(membership?.active === true && ['owner', 'manager'].includes(String(membership.role)))) throw new LiveError(403, 'ARENA_FORBIDDEN');
}
export function isTerminal(status: unknown) { return ['ended', 'stopping', 'failed'].includes(String(status)); }
export function cameraPublished(tracks: { type?: TrackType; source?: TrackSource; muted?: boolean }[]) {
  return tracks.some(track => track.type === TrackType.VIDEO && track.source === TrackSource.CAMERA && !track.muted);
}
export async function issueToken(credentials: { key: string; secret: string }, room: string, identity: string, role: 'publisher' | 'viewer') {
  const token = new AccessToken(credentials.key, credentials.secret, { identity, ttl: '2m' });
  token.addGrant({ room, roomJoin: true, roomAdmin: false, canSubscribe: role === 'viewer', canPublish: role === 'publisher',
    canPublishData: false, canUpdateOwnMetadata: false,
    ...(role === 'publisher' ? { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] } : {}) });
  return token.toJwt();
}
export function publicLive(data: Record<string, unknown>, now = Date.now()) {
  return data.isLive === true && (data.provider !== 'livekit' || (typeof data.liveExpiresAt === 'number' && data.liveExpiresAt > now));
}
export function validateServerUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new LiveError(503, 'LIVEKIT_CONFIGURATION');
  return url.origin;
}

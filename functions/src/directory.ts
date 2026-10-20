import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { LiveError, publicLive } from './policy';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
function distance(lat: number, lng: number, arena: Record<string, unknown>) {
  if (typeof arena.lat !== 'number' || typeof arena.lng !== 'number' || !Number.isFinite(arena.lat) || !Number.isFinite(arena.lng) || Math.abs(arena.lat) > 90 || Math.abs(arena.lng) > 180) return null;
  const r = Math.PI / 180, a = Math.sin((arena.lat - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(arena.lat * r) * Math.sin((arena.lng - lng) * r / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
export async function listBroadcasts(db: Firestore, query: Record<string, unknown>) {
  const { mode = 'nearby', cursor, city = '', state = '' } = query;
  const lat = typeof query.lat === 'string' ? Number(query.lat) : NaN, lng = typeof query.lng === 'string' ? Number(query.lng) : NaN;
  if (!['nearby', 'city', 'all'].includes(String(mode)) || typeof city !== 'string' || typeof state !== 'string' || city.length > 100 || state.length > 50 ||
    (mode === 'city' && !city.trim()) || (mode === 'nearby' && (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180)) ||
    (cursor !== undefined && (typeof cursor !== 'string' || !/^[\w-]{1,128}$/.test(cursor)))) throw new LiveError(400, 'INVALID_FILTER');
  let pageQuery = db.collection('broadcasts').where('isLive', '==', true).orderBy(FieldPath.documentId()).limit(12);
  if (cursor) pageQuery = pageQuery.startAfter(cursor);
  const page = await pageQuery.get();
  const ids = [...new Set(page.docs.map(item => item.data().arenaId).filter(id => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)))];
  const arenas = ids.length ? await db.getAll(...ids.map(id => db.doc(`arenas/${id}`))) : [];
  const arenaMap = new Map(arenas.map(item => [item.id, item.data() || {}]));
  const items = page.docs.flatMap(item => {
    const data = item.data(), arena = arenaMap.get(data.arenaId) || {}, km = distance(lat, lng, arena);
    if (!publicLive(data) || (data.provider !== 'livekit' && (typeof data.videoUrl !== 'string' || !/^https:\/\//i.test(data.videoUrl)))) return [];
    if (mode === 'nearby' && (km === null || km > 50)) return [];
    if (mode === 'city' && (normalize(String(arena.city || '')) !== normalize(city) || (state && normalize(String(arena.state || '')) !== normalize(state)))) return [];
    return [{ id: item.id, title: String(data.title || 'Ao vivo'), city: String(arena.city || ''), state: String(arena.state || ''), arenaName: String(arena.name || ''), distanceKm: mode === 'nearby' ? km : null }];
  });
  return { items, nextCursor: page.size === 12 ? page.docs[page.docs.length - 1].id : null };
}

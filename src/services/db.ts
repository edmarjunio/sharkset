import { collection, doc, getDocFromCache, getDocFromServer, getDocsFromCache, getDocsFromServer, query, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import type { TenantConfig, Tournament } from '../types';
import { addDays, arenaDate, buildArenaAvailability, type Occupancy, type AvailabilityBlock } from './bookingAvailability';
import { createServerCache } from './serverCache';

export const GET_SERVER_CACHE = 'GET_SERVER_CACHE' as const;
const read = createServerCache();
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export async function publishTournament(tournament: Tournament) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Entre com uma conta verificada para publicar o torneio.');
  if (offline()) throw new Error('Conecte-se à internet para publicar o torneio e avisar os atletas.');
  const { description, format, tableLicenseStatus, tableLicenseFee, ...data } = tournament;
  // Firestore rules validate the schema and require ownership of the official arena.
  // Await the acknowledgement before announcing success or building local tournament state.
  await setDoc(doc(db, 'tournaments', tournament.id), { ...data, ownerId: user.uid });
}

export async function getArenas() {
  const ref = query(collection(db, 'arenas_public'));
  const result = await read('arenas_public', {
    cache: () => getDocsFromCache(ref), server: () => getDocsFromServer(ref),
    usable: () => true, maxAgeMs: 5 * 60_000, offline: offline(),
  });
  return result.value.docs.map(snap => ({ ...snap.data(), id: snap.id }) as TenantConfig);
}

export async function getTournaments(force = false) {
  const ref = query(collection(db, 'tournaments_public'));
  const result = await read('tournaments_public', {
    cache: () => getDocsFromCache(ref), server: () => getDocsFromServer(ref),
    usable: () => true, maxAgeMs: 60_000, force, offline: offline(),
  });
  return result.value.docs.map(snap => ({ ...snap.data(), id: snap.id }) as Tournament);
}

/** Only server-owned, redacted projections are cached. Private bookings are never queried. */
export async function getArenaSchedule(arena: TenantConfig, date: string, force = false) {
  const ref = doc(db, 'arena_schedules', `${arena.id}_${date}`);
  const result = await read(ref.path, {
    cache: () => getDocFromCache(ref), server: () => getDocFromServer(ref),
    usable: snap => snap.exists(), maxAgeMs: 30_000, force, offline: offline(),
  });
  const data = result.value.data();
  if (!data || data.arenaId !== arena.id || data.date !== date || !Array.isArray(data.occupancy) || !Array.isArray(data.blocks) || !data.arena) {
    throw new Error('Agenda pública ainda não sincronizada.');
  }
  const cells = buildArenaAvailability({ ...data.arena, id: arena.id } as TenantConfig, date, data.occupancy as Occupancy[], {
    blocks: data.blocks as AvailabilityBlock[], timeZone: data.timeZone, horizonDays: data.horizonDays,
  });
  // Cached schedules are useful offline, but cannot establish that a slot can be purchased.
  return { cells: result.stale ? cells.map(cell => ({ ...cell, state: 'unavailable' as const, isAvailable: false })) : cells,
    maxDate: addDays(arenaDate(new Date(), data.timeZone), (data.horizonDays || 7) - 1),
    stale: result.stale };
}

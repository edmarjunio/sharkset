import 'dotenv/config';
import { adminDatabase } from '../server/firebaseAdmin';
import { publicArena, publicTournament, projectSchedule } from '../functions/src/catalog';
import { addDays, arenaDate } from '../src/services/bookingAvailability';

// Explicit migration only. Does not open tournaments or queue historical notifications.
const apply = process.argv.includes('--apply');
const db = adminDatabase();
const arenas = await db.collection('arenas').get();
const tournaments = await db.collection('tournaments').get();
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', arenas: arenas.size, tournaments: tournaments.size }));
if (apply) {
  for (const record of arenas.docs) {
    const data = record.data();
    await db.collection('arenas_public').doc(record.id).set(publicArena(data, record.id));
    const today = arenaDate(new Date(), data.timeZone || 'America/Sao_Paulo');
    const horizon = Math.min(90, Math.max(1, Math.floor(data.bookingHorizonDays || 7)));
    for (let day = 0; day < horizon; day++) await projectSchedule(db, record.id, addDays(today, day));
  }
  for (const record of tournaments.docs) await db.collection('tournaments_public').doc(record.id).set(publicTournament(record.data(), record.id));
  console.log('Public projections synchronized. No historical notifications queued.');
}

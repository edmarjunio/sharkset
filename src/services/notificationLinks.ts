import { validDate, minutes } from './bookingAvailability';
export function parseNotificationLink(search: string) {
  const params = new URLSearchParams(search);
  const arenaId = params.get('arena');
  if (!arenaId || !/^[\w-]{1,64}$/.test(arenaId)) return null;
  const tournamentId = params.get('tournament');
  if (tournamentId && /^[\w-]{1,64}$/.test(tournamentId)) return { arenaId, tournamentId };
  const date = params.get('date'), courtId = params.get('court'), time = params.get('time');
  if (!date || !validDate(date) || !courtId || !/^[\w-]{1,64}$/.test(courtId) || !time || !Number.isFinite(minutes(time))) return null;
  return { arenaId, date, courtId, time };
}

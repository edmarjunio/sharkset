import type { Firestore } from 'firebase-admin/firestore';

type RecordData = Record<string, any>;
const pick = (data: RecordData, keys: string[]) => Object.fromEntries(keys.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
const primitivePick = (data: RecordData, keys: string[]) => Object.fromEntries(keys.filter(key => ['string', 'number', 'boolean'].includes(typeof data[key])).map(key => [key, data[key]]));

/** Explicit public allowlist, including nested court data. No owner/customer/contact records. */
export function publicArena(data: RecordData, id: string) {
  const arena = primitivePick(data, ['name', 'tagline', 'city', 'state', 'address', 'distanceKm', 'rating', 'whatsapp', 'primaryColor', 'accentColor', 'sandBg', 'imageUrl', 'logoUrl', 'lat', 'lng', 'whiteLabelEnabled']);
  return { name: '', tagline: '', city: '', state: '', address: '', whatsapp: '', rating: 0,
    primaryColor: '#0891b2', accentColor: '#10b981', sandBg: '#020617',
    ...arena, id, brandPalette: primitivePick(data.brandPalette || {}, ['primary', 'secondary', 'accent', 'headerBg', 'surfaceBg', 'textOnPrimary']),
    amenities: Array.isArray(data.amenities) ? data.amenities.filter((v: unknown) => typeof v === 'string') : [],
    operatingHours: primitivePick(data.operatingHours || {}, ['open', 'close']),
    courts: (Array.isArray(data.courts) ? data.courts : []).map((court: RecordData) => ({
      ...primitivePick(court, ['id', 'name', 'description', 'surface', 'isCovered', 'hasLighting', 'hourlyRate', 'peakHourlyRate', 'weekendNormalRate', 'weekendPeakRate', 'peakStartTime', 'peakEndTime', 'openTime', 'closeTime']),
      sports: Array.isArray(court.sports) ? court.sports.filter((s: unknown) => ['futevolei', 'beach_tennis', 'volei_praia'].includes(String(s))) : [],
      dayOfWeekPricing: Object.fromEntries(Object.entries(court.dayOfWeekPricing || {}).filter(([key]) => /^[0-6]$/.test(key)).map(([key, value]) => [key, primitivePick(value as RecordData, ['enabled', 'normalRate', 'peakRate'])])),
      classSchedules: (Array.isArray(court.classSchedules) ? court.classSchedules : []).map((s: RecordData) => ({
        coachName: '', ...primitivePick(s, ['id', 'title', 'coachName', 'level', 'startTime', 'endTime', 'sport', 'monthlyPrice', 'dailyPrice', 'maxStudents', 'enrolledCount']),
        daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek.filter((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6) : [],
      })),
    })),
  };
}
export function publicOccupancy(data: RecordData) {
  return pick(data, ['tenantId', 'courtId', 'date', 'startTime', 'endTime', 'status', 'expiresAt']);
}
export function publicTournament(data: RecordData, id: string) {
  return { ...primitivePick(data, ['tenantId', 'name', 'sport', 'category', 'modalityFormat', 'semiFormat', 'date', 'location', 'specificRules', 'maxPairs', 'registrationFee', 'isOpenForRegistration', 'isFinished']),
    id, format: 'double_elimination_buraco4', description: '', responsibleName: '', responsiblePhone: '' };
}
export function validScheduleArena(data: RecordData) {
  const time = (value: unknown) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value);
  return Array.isArray(data.courts) && data.operatingHours && time(data.operatingHours.open) && time(data.operatingHours.close) &&
    data.courts.every((court: RecordData) => typeof court.id === 'string' && typeof court.name === 'string' &&
      Array.isArray(court.sports) && court.sports.length > 0 && Number.isFinite(court.hourlyRate) && court.hourlyRate >= 0 &&
      time(court.openTime || data.operatingHours.open) && time(court.closeTime || data.operatingHours.close) &&
      (court.classSchedules || []).every((s: RecordData) => Array.isArray(s.daysOfWeek) &&
        s.daysOfWeek.every((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) &&
        time(s.startTime) && time(s.endTime) && s.startTime < s.endTime));
}
export async function projectSchedule(db: Firestore, arenaId: string, date: string) {
  if (!/^[\w-]{1,64}$/.test(arenaId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db.runTransaction(async tx => {
    const config = await tx.get(db.collection('arenas').doc(arenaId));
    const destination = db.collection('arena_schedules').doc(`${arenaId}_${date}`);
    if (!config.exists) { tx.delete(destination); return; }
    const data = config.data()!;
    if (!validScheduleArena(data)) { tx.delete(destination); return; }
    const [bookings, blocks] = await Promise.all(['bookings', 'booking_blocks'].map(name =>
      tx.get(db.collection(name).where('tenantId', '==', arenaId).where('date', '==', date))));
    const occupancy = bookings.docs.map(doc => publicOccupancy(doc.data()));
    // Fail closed for corrupted authoritative records, consistent with the HTTP availability API.
    const validTime = (value: unknown) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value);
    if (occupancy.some(b => !['confirmed', 'pending', 'cancelled', 'expired'].includes(b.status) ||
      ['confirmed', 'pending'].includes(b.status) && (typeof b.courtId !== 'string' || !validTime(b.startTime) || !validTime(b.endTime) || b.startTime >= b.endTime)) ||
      blocks.docs.some(doc => { const b = doc.data(); return typeof b.courtId !== 'string' || !validTime(b.startTime) || !validTime(b.endTime) || b.startTime >= b.endTime; })) {
      tx.delete(destination); return;
    }
    tx.set(destination, { arenaId, date, arena: publicArena(data, arenaId),
      timeZone: data.timeZone || 'America/Sao_Paulo', horizonDays: Math.min(90, Math.max(1, Math.floor(data.bookingHorizonDays || 7))),
      occupancy, blocks: blocks.docs.map(doc => pick(doc.data(), ['tenantId', 'courtId', 'date', 'startTime', 'endTime'])),
      updatedAt: new Date().toISOString() });
  });
}

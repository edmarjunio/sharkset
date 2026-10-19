import type { Court, TenantConfig, TimeSlot } from '../types';

export type AvailabilityState = 'free' | 'reserved' | 'class' | 'blocked' | 'unavailable';
export interface AvailabilityCell extends TimeSlot { state: AvailabilityState }
export interface Occupancy {
  tenantId: string; courtId: string; date: string; startTime: string; endTime: string;
  status: string; expiresAt?: string;
}
export interface AvailabilityBlock {
  tenantId: string; courtId: string; date: string; startTime: string; endTime: string;
}
export const STATE_LABELS: Record<AvailabilityState, string> = {
  free: 'Livre', reserved: 'Reservado', class: 'Aula', blocked: 'Bloqueado', unavailable: 'Indisponível',
};
export function arenaDate(now = new Date(), timeZone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && addDays(date, 0) === date;
}
export const minutes = (time: string) => {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const hour = Number(time.slice(0, 2)), minute = Number(time.slice(3));
  return hour <= 24 && minute < 60 && (hour !== 24 || minute === 0) ? hour * 60 + minute : NaN;
};
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const overlaps = (start: string, end: string, otherStart: string, otherEnd: string) => minutes(start) < minutes(otherEnd) && minutes(otherStart) < minutes(end);

export function slotPrice(court: Court, date: string, startTime: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const rule = court.dayOfWeekPricing?.[day];
  const peak = minutes(startTime) >= minutes(court.peakStartTime || '18:00') && minutes(startTime) < minutes(court.peakEndTime || '22:00');
  const weekend = day === 0 || day === 6;
  const normal = weekend ? court.weekendNormalRate ?? court.hourlyRate : court.hourlyRate;
  const peakRate = weekend ? court.weekendPeakRate ?? court.peakHourlyRate ?? normal + 15 : court.peakHourlyRate ?? normal;
  return { price: rule ? peak ? rule.peakRate : rule.normalRate : peak ? peakRate : normal, enabled: rule?.enabled !== false, peak };
}

/** Pure engine shared by server reads and explicitly labelled local previews. No personal data leaves this function. */
export function buildArenaAvailability(arena: TenantConfig, date: string, bookings: readonly Occupancy[], options: {
  now?: Date; horizonDays?: number; timeZone?: string; blocks?: readonly AvailabilityBlock[]; slots?: readonly TimeSlot[];
} = {}): AvailabilityCell[] {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? 'America/Sao_Paulo';
  const today = arenaDate(now, timeZone);
  const horizon = options.horizonDays ?? 7;
  if (!validDate(date) || date < today || date > addDays(today, horizon - 1)) return [];
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const cells: AvailabilityCell[] = [];
  for (const court of arena.courts) {
    const open = Math.max(minutes(arena.operatingHours.open), minutes(court.openTime ?? arena.operatingHours.open));
    const close = Math.min(minutes(arena.operatingHours.close), minutes(court.closeTime ?? arena.operatingHours.close));
    if (!Number.isFinite(open) || !Number.isFinite(close) || open < 0 || close > 1440 || close <= open) continue;
    for (let start = open; start + 60 <= close; start += 60) {
      const startTime = clock(start), endTime = clock(start + 60);
      const pricing = slotPrice(court, date, startTime);
      const source = options.slots?.find(s => s.courtId === court.id && s.date === date && s.startTime === startTime);
      const occupied = bookings.some(b => b.tenantId === arena.id && b.courtId === court.id && b.date === date &&
        (b.status === 'confirmed' || b.status === 'pending' && (!b.expiresAt || !Number.isFinite(Date.parse(b.expiresAt)) || Date.parse(b.expiresAt) > now.getTime())) &&
        overlaps(startTime, endTime, b.startTime, b.endTime));
      const lesson = court.classSchedules?.some(c => c.daysOfWeek?.includes(day) && overlaps(startTime, endTime, c.startTime, c.endTime));
      const blocked = options.blocks?.some(b => b.tenantId === arena.id && b.courtId === court.id && b.date === date && overlaps(startTime, endTime, b.startTime, b.endTime));
      const invalid = !pricing.enabled || !Number.isFinite(pricing.price) || pricing.price < 0 || date === today && start <= minutes(time);
      const state: AvailabilityState = occupied ? 'reserved' : lesson ? 'class' : blocked || source && !source.isAvailable && source.slotType !== 'class' ? 'blocked' : invalid ? 'unavailable' : 'free';
      cells.push({ id: `slot-${court.id}-${date}-${startTime}`, courtId: court.id, date, startTime, endTime,
        price: pricing.price, isAvailable: state === 'free', isPeakHour: pricing.peak, state, slotType: lesson ? 'class' : 'regular' });
    }
  }
  return cells;
}

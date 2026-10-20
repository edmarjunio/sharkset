import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, arenaDate, buildArenaAvailability, minutes, overlaps, slotPrice, validDate, type Occupancy } from '../src/services/bookingAvailability';
import type { TenantConfig, Court } from '../src/types';

const court: Court = { id: 'q1', name: 'Quadra 1', description: '', sports: ['futevolei'], surface: 'Areia Fina', isCovered: false, hasLighting: true,
  hourlyRate: 80, peakHourlyRate: 100, openTime: '16:00', closeTime: '23:00', classSchedules: [
    { id: 'lesson', title: 'Aula', coachName: 'Professor', sport: 'futevolei', startTime: '19:30', endTime: '20:30', daysOfWeek: [2], monthlyPrice: 100, dailyPrice: 20, maxStudents: 8 },
  ] };
const arena = { id: 'arena-a', courts: [court, { ...court, id: 'q2', classSchedules: [] }], operatingHours: { open: '06:00', close: '23:00' } } as TenantConfig;
const now = new Date('2026-10-19T20:30:00Z'); // Monday 17:30 in São Paulo.
const booking: Occupancy = { tenantId: 'arena-a', courtId: 'q1', date: '2026-10-19', startTime: '18:30', endTime: '19:30', status: 'confirmed' };
const get = (date = '2026-10-19', bookings: Occupancy[] = []) => buildArenaAvailability(arena, date, bookings, { now });

test('Brazilian dates stay local across UTC midnight and month/year boundaries', () => {
  assert.equal(arenaDate(new Date('2027-01-01T01:30:00Z')), '2026-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(arenaDate(new Date('2026-10-19T03:30:00Z'), 'America/Rio_Branco'), '2026-10-18');
});
test('invalid dates and malformed hours are rejected', () => {
  for (const date of ['2026-02-30', '2026-13-01', '../2026', '2026-1-1']) assert.equal(validDate(date), false);
  for (const time of ['25:00', '19:99', '', 'x']) assert.ok(Number.isNaN(minutes(time)));
  assert.equal(minutes('00:00'), 0);
});
test('today offers only future starts without a time filter', () => {
  const free = get().filter(c => c.state === 'free');
  assert.equal(free.length, 10);
  assert.ok(free.every(c => c.startTime >= '18:00'));
  assert.equal(get().find(c => c.startTime === '17:00')?.state, 'unavailable');
});
test('exact-hour filtering preserves every court and excludes other hours', () => {
  const matching = get().filter(c => c.state === 'free' && c.startTime === '18:00');
  assert.deepEqual(matching.map(c => c.courtId), ['q1', 'q2']);
});
test('future dates offer morning slots independently of current time', () => {
  assert.equal(get('2026-10-21').find(c => c.startTime === '16:00')?.state, 'free');
});
test('past and unsupported future dates never manufacture availability', () => {
  assert.equal(get('2026-10-18').length, 0);
  assert.ok(get('2026-10-25').length > 0);
  assert.equal(get('2026-10-26').length, 0);
});
test('overlapping booking blocks both affected hours but not an adjacent interval', () => {
  const cells = get(undefined, [booking]);
  assert.equal(cells.find(c => c.courtId === 'q1' && c.startTime === '18:00')?.state, 'reserved');
  assert.equal(cells.find(c => c.courtId === 'q1' && c.startTime === '19:00')?.state, 'reserved');
  assert.equal(cells.find(c => c.courtId === 'q1' && c.startTime === '20:00')?.state, 'free');
  assert.equal(overlaps('18:00', '19:00', '19:00', '20:00'), false);
});
test('another arena, court or date cannot block this court', () => {
  for (const other of [{ ...booking, tenantId: 'arena-b' }, { ...booking, courtId: 'q3' }, { ...booking, date: '2026-10-20' }]) {
    assert.equal(get(undefined, [other]).find(c => c.startTime === '18:00')?.state, 'free');
  }
  assert.equal(get(undefined, [booking]).find(c => c.courtId === 'q2' && c.startTime === '18:00')?.state, 'free');
});
test('valid pending reservations lock; expired and cancelled reservations release', () => {
  for (const expiresAt of [undefined, 'invalid', '2026-10-19T21:00:00Z']) {
    assert.equal(get(undefined, [{ ...booking, status: 'pending', expiresAt }]).find(c => c.startTime === '18:00')?.state, 'reserved');
  }
  for (const candidate of [{ ...booking, status: 'pending', expiresAt: now.toISOString() }, { ...booking, status: 'expired' }, { ...booking, status: 'cancelled' }]) {
    assert.equal(get(undefined, [candidate]).find(c => c.startTime === '18:00')?.state, 'free');
  }
});
test('recurring classes respect weekdays and overlapping intervals', () => {
  const tuesday = get('2026-10-20');
  assert.equal(tuesday.find(c => c.startTime === '19:00')?.state, 'class');
  assert.equal(tuesday.find(c => c.startTime === '20:00')?.state, 'class');
  assert.equal(get('2026-10-21').find(c => c.startTime === '19:00')?.state, 'free');
});
test('administrative blocks are isolated by arena and court', () => {
  const cells = buildArenaAvailability(arena, booking.date, [], { now, blocks: [booking] });
  assert.equal(cells.find(c => c.startTime === '18:00')?.state, 'blocked');
  assert.equal(cells.find(c => c.courtId === 'q2' && c.startTime === '18:00')?.state, 'free');
});
test('opening minutes and full duration remain exact', () => {
  const cells = buildArenaAvailability({ ...arena, courts: [{ ...court, openTime: '17:30', closeTime: '19:45' }] }, '2026-10-20', [], { now });
  assert.deepEqual(cells.map(c => [c.startTime, c.endTime]), [['17:30', '18:30'], ['18:30', '19:30']]);
});
test('pricing uses weekday overrides, weekends, minute-precise peaks and closed days', () => {
  const priced = { ...court, weekendNormalRate: 90, weekendPeakRate: 130, peakStartTime: '18:30', dayOfWeekPricing: { 2: { enabled: false, normalRate: 70, peakRate: 110 } } };
  assert.equal(slotPrice(priced, '2026-10-19', '18:00').price, 80);
  assert.equal(slotPrice(priced, '2026-10-19', '18:30').price, 100);
  assert.equal(slotPrice(priced, '2026-10-24', '18:30').price, 130);
  assert.equal(slotPrice(priced, '2026-10-20', '18:30').price, 110);
  const closedDay = buildArenaAvailability({ ...arena, courts: [priced] }, '2026-10-20', [], { now });
  assert.ok(closedDay.every(c => !c.isAvailable));
  assert.equal(closedDay.find(c => c.startTime === '18:00')?.state, 'unavailable');
  assert.equal(closedDay.find(c => c.startTime === '19:00')?.state, 'class');
});
test('invalid prices and closures never become free', () => {
  assert.ok(buildArenaAvailability({ ...arena, courts: [{ ...court, hourlyRate: NaN, peakHourlyRate: NaN }] }, '2026-10-21', [], { now }).every(c => !c.isAvailable));
});
test('public agenda contains no reservation personal or financial identifiers', () => {
  const cells = get(undefined, [{ ...booking, customerName: 'PRIVATE NAME', customerPhone: 'PRIVATE PHONE', paymentId: 'PRIVATE PAYMENT' } as Occupancy]);
  assert.equal(JSON.stringify(cells).includes('PRIVATE'), false);
  assert.ok(cells.every(c => !c.bookingId && c.isAvailable === (c.state === 'free')));
});

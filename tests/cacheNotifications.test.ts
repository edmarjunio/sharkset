import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerCache } from '../src/services/serverCache';
import { notificationEvent, eventLink, messageFor, deliverJob } from '../functions/src/notifications';
import { publicArena, publicOccupancy, validScheduleArena } from '../functions/src/catalog';
import { parseNotificationLink } from '../src/services/notificationLinks';
import { createAvailabilitySubscriptions } from '../src/services/availabilityLive';

test('GET_SERVER_CACHE reads persistence first and reuses fresh data without network', async () => {
  const read = createServerCache();
  const order: string[] = [];
  const options = { cache: async () => { order.push('cache'); return ['saved']; },
    server: async () => { order.push('server'); return ['fresh']; }, usable: (v: string[]) => v.length > 0, maxAgeMs: 30_000 };
  assert.equal((await read('arena/date', options)).source, 'server');
  assert.equal((await read('arena/date', options)).source, 'cache');
  assert.deepEqual(order, ['cache', 'server', 'cache']);
});
test('concurrent readers share one server query, including cached empty results', async () => {
  const read = createServerCache();
  let requests = 0;
  const options = { cache: async () => [] as string[], usable: () => true, maxAgeMs: 30_000,
    server: async () => { requests++; await new Promise(resolve => setTimeout(resolve, 5)); return [] as string[]; } };
  await Promise.all([read('same', options), read('same', options)]);
  await read('same', options);
  assert.equal(requests, 1);
});
test('offline cached data is explicitly stale; missing cache and permission failures are explicit', async () => {
  const read = createServerCache();
  let requests = 0;
  const options = { cache: async () => ['saved'], usable: (v: string[]) => v.length > 0,
    server: async (): Promise<string[]> => { requests++; throw Object.assign(new Error('denied'), { code: 'permission-denied' }); }, maxAgeMs: 0 };
  assert.equal((await read('offline', { ...options, offline: true })).stale, true);
  assert.equal(requests, 0);
  await assert.rejects(read('denied', options), /denied/);
  await assert.rejects(read('missing', { ...options, cache: async () => [], offline: true }), /Sem conexão/);
});
test('transient server failures may use stale cache, and forced refresh bypasses TTL', async () => {
  const read = createServerCache();
  let calls = 0;
  const options = { cache: async () => ['saved'], usable: () => true, maxAgeMs: 30_000, server: async () => { calls++; return ['fresh']; } };
  await read('force', options);
  await read('force', { ...options, force: true });
  assert.equal(calls, 2);
  const result = await read('failure', { ...options, server: async () => { throw { code: 'unavailable' }; } });
  assert.equal(result.stale, true);
});
const booking = { tenantId: 'arena', courtId: 'court', date: '2026-10-25', startTime: '18:00', status: 'confirmed', ownerId: 'customer' };
test('only real cancellation transitions and newly opened tournaments produce events', () => {
  assert.equal(notificationEvent('bookings', 'b', undefined, { ...booking, status: 'cancelled' }), null);
  assert.equal(notificationEvent('bookings', 'b', booking, { ...booking, status: 'confirmed' }), null);
  assert.equal(notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled', demo: true }), null);
  assert.equal(notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled', tenantId: 'another' }), null);
  const cancelled = notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled' });
  assert.equal(cancelled?.ownerId, 'customer');
  assert.ok(messageFor(cancelled!, true).title.includes('Sua reserva'));
  assert.equal(notificationEvent('tournaments', 't', { isOpenForRegistration: true }, { tenantId: 'arena', isOpenForRegistration: true }), null);
  assert.equal(notificationEvent('tournaments', 't', undefined, { tenantId: 'arena', isOpenForRegistration: true, isFinished: true }), null);
  assert.equal(notificationEvent('tournaments', 't', undefined, { tenantId: 'arena', isOpenForRegistration: true })?.kind, 'tournament_opened');
});
test('booking links round-trip arena/date/court/time/Pix without embedding prices or credentials', () => {
  const event = notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled' })!;
  const link = new URL(eventLink(event, 'https://sharkset.web.app'));
  assert.equal(link.searchParams.get('payment'), 'pix');
  assert.deepEqual(parseNotificationLink(link.search), { arenaId: 'arena', date: '2026-10-25', courtId: 'court', time: '18:00' });
  assert.equal(parseNotificationLink('?arena=../private'), null);
  assert.equal(parseNotificationLink('?arena=arena&date=2026-02-30&court=court&time=18:00'), null);
});
test('public projections redact private fields at every nested level', () => {
  const projected = publicArena({ name: 'Arena', ownerId: 'PRIVATE', customerPhone: 'PRIVATE',
    courts: [{ id: 'court', sports: ['futevolei'], secret: 'PRIVATE', classSchedules: [{ title: 'Aula', daysOfWeek: [0, 9], phone: 'PRIVATE' }] }],
    operatingHours: { open: '08:00', close: '22:00', secret: 'PRIVATE' }, amenities: ['Luz'] }, 'arena');
  assert.equal(JSON.stringify(projected).includes('PRIVATE'), false);
  assert.deepEqual(projected.courts[0].classSchedules[0].daysOfWeek, [0]);
  assert.equal(JSON.stringify(publicOccupancy({ ...booking, customerName: 'PRIVATE', pixKey: 'PRIVATE' })).includes('PRIVATE'), false);
});
test('delivery claims prevent resending a job after a configuration failure', async () => {
  const job: any = { status: 'queued', uid: 'customer', channel: 'whatsapp', event: notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled' }) };
  let claims = 0;
  const ref = { update: async (change: any) => Object.assign(job, change) };
  const db: any = {
    collection: (name: string) => ({ doc: () => name === 'notification_jobs' ? ref : {
      get: async () => ({ data: () => name === 'bookings' ? { ...booking, status: 'cancelled' } : { bookingCancelled: true, whatsappEnabled: true, phone: '5564999999999' } }),
    } }),
    runTransaction: async (action: Function) => action({ get: async () => ({ data: () => job }), update: (_ref: any, data: any) => { if (data.status === 'sending') claims++; Object.assign(job, data); } }),
  };
  await deliverJob(db, 'job', { origin: 'https://sharkset.web.app' });
  assert.equal(job.status, 'not_configured');
  await deliverJob(db, 'job', { origin: 'https://sharkset.web.app' });
  assert.equal(claims, 1);
});

test('invalid arena configuration cannot publish a falsely available cached schedule', () => {
  const arena = { courts: [{ id: 'court', name: 'Court', sports: ['futevolei'], hourlyRate: 50 }], operatingHours: { open: '08:00', close: '22:00' } };
  assert.ok(validScheduleArena(arena));
  assert.equal(validScheduleArena({ ...arena, courts: [{ ...arena.courts[0], hourlyRate: -1 }] }), false);
  assert.equal(validScheduleArena({ ...arena, courts: [{ ...arena.courts[0], classSchedules: [{ daysOfWeek: [8], startTime: '08:00', endTime: '09:00' }] }] }), false);
});

test('concurrent retries never resend after an uncertain provider response', async () => {
  const job: any = { status: 'queued', uid: 'customer', channel: 'whatsapp', event: notificationEvent('bookings', 'b', booking, { ...booking, status: 'cancelled' }) };
  const ref = { update: async (change: any) => Object.assign(job, change) };
  let transactionTail = Promise.resolve();
  const db: any = {
    collection: (name: string) => ({ doc: () => name === 'notification_jobs' ? ref : {
      get: async () => ({ data: () => name === 'bookings' ? { ...booking, status: 'cancelled' } : { bookingCancelled: true, whatsappEnabled: true, phone: '5564999999999' } }),
    } }),
    runTransaction: (action: Function) => {
      const pending = transactionTail.then(() => action({ get: async () => ({ data: () => ({ ...job }) }), update: (_ref: any, change: any) => Object.assign(job, change) }));
      transactionTail = pending.then(() => {});
      return pending;
    },
  };
  const previousFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => { sends++; throw new Error('timeout after possible acceptance'); };
  try {
    const config = { origin: 'https://sharkset.web.app', whatsappToken: 'test-token', phoneId: 'test-phone', graphVersion: 'v1.0', bookingTemplate: 'test-template' };
    await Promise.all([deliverJob(db, 'job', config), deliverJob(db, 'job', config)]);
    await deliverJob(db, 'job', config);
    assert.equal(sends, 1);
    assert.equal(job.status, 'unknown_delivery');
  } finally { globalThis.fetch = previousFetch; }
});

test('live schedules share one connection, replay current data and close after the final subscriber', () => {
  const events = new Map<string, Function>();
  let opened = 0, closed = 0, received = 0;
  const subscribe = createAvailabilitySubscriptions(() => {
    opened++;
    return { readyState: 1, addEventListener: (name: string, action: Function) => events.set(name, action), close: () => { closed++; } } as unknown as EventSource;
  });
  const first = subscribe('arena', '2026-10-25', () => { received++; }, () => {});
  events.get('availability')!({ data: JSON.stringify({ cells: [], maxDate: '2026-10-30' }) });
  const second = subscribe('arena', '2026-10-25', () => { received++; }, () => {});
  assert.equal(opened, 1);
  assert.equal(received, 2);
  assert.equal(second.isConnected(), true);
  first.unsubscribe(); first.unsubscribe();
  assert.equal(closed, 0);
  second.unsubscribe();
  assert.equal(closed, 1);
});

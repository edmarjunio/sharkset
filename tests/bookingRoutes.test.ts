import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Express } from 'express';
import { registerBookingRoutes } from '../server/bookings';
import { arenaDate } from '../src/services/bookingAvailability';

function routes(database?: Parameters<typeof registerBookingRoutes>[1]) {
  const handlers = new Map<string, Function>();
  registerBookingRoutes({ get: (path: string, handler: Function) => handlers.set(`GET ${path}`, handler), post: (path: string, handler: Function) => handlers.set(`POST ${path}`, handler) } as unknown as Express, database);
  return async (path: string, query = {}) => {
    let status = 200, data: any;
    const res = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { data = value; return this; } };
    await handlers.get(path)!({ query, body: { price: 0, paid: true } }, res);
    return { status, data };
  };
}
test('concurrent checkout attempts cannot create bookings or confirm fake payments', async () => {
  let writes = 0;
  const call = routes(() => { writes++; throw new Error('must not access database'); });
  const responses = await Promise.all([call('POST /api/booking/checkout'), call('POST /api/booking/checkout')]);
  assert.ok(responses.every(r => r.status === 503 && !r.data.bookingId && !r.data.paid));
  assert.equal(writes, 0);
});
test('invalid arena or date is rejected before accessing Firestore', async () => {
  const call = routes(() => { throw new Error('must not access database'); });
  for (const query of [{ tenantId: '../private', date: '2026-10-19' }, { tenantId: 'valid', date: '2026-02-30' }]) {
    assert.equal((await call('GET /api/booking/availability', query)).status, 400);
  }
});
test('unconfigured arena does not fall back to fictional free slots', async () => {
  const call = routes((() => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }) }) })) as any);
  const result = await call('GET /api/booking/availability', { tenantId: 'valid', date: '2026-10-19' });
  assert.equal(result.status, 503);
  assert.equal(result.data.cells, undefined);
});
test('Firestore failure is an explicit failure without a success response', async () => {
  const call = routes(() => { throw new Error('Firestore unavailable'); });
  const result = await call('GET /api/booking/availability', { tenantId: 'valid', date: '2026-10-19' });
  assert.equal(result.status, 503);
  assert.equal(result.data.cells, undefined);
});

function storedAgenda(records: Record<string, unknown>[]) {
  return (() => ({ collection: (name: string) => name === 'arenas' ? {
    doc: () => ({ get: async () => ({ exists: true, data: () => ({
      id: 'valid', courts: [{ id: 'court', name: 'Court', sports: ['futevolei'], hourlyRate: 50 }],
      operatingHours: { open: '00:00', close: '24:00' },
    }) }) }),
  } : { where() { return this; }, get: async () => ({ docs: name === 'bookings' ? records.map(record => ({ data: () => record })) : [] }) } })) as any;
}
test('server reads authoritative occupancy and strips reservation identities', async () => {
  const date = arenaDate();
  const call = routes(storedAgenda([{ tenantId: 'valid', courtId: 'court', date, startTime: '18:30', endTime: '19:30', status: 'confirmed', customerName: 'PRIVATE', customerPhone: 'PRIVATE' }]));
  const result = await call('GET /api/booking/availability', { tenantId: 'valid', date });
  assert.equal(result.status, 200);
  assert.equal(result.data.cells.find((c: any) => c.startTime === '18:00').state, 'reserved');
  assert.equal(result.data.cells.find((c: any) => c.startTime === '19:00').state, 'reserved');
  assert.equal(JSON.stringify(result.data).includes('PRIVATE'), false);
});
test('an incomplete active reservation fails closed instead of showing free time', async () => {
  const date = arenaDate();
  const call = routes(storedAgenda([{ tenantId: 'valid', courtId: 'court', date, startTime: '18:00', status: 'confirmed' }]));
  const result = await call('GET /api/booking/availability', { tenantId: 'valid', date });
  assert.equal(result.status, 503);
  assert.equal(result.data.cells, undefined);
});

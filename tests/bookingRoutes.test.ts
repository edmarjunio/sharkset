import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Express } from 'express';
import { registerBookingRoutes } from '../server/bookings';
import { arenaDate } from '../src/services/bookingAvailability';
import { EventEmitter } from 'node:events';

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

test('live availability observes real changes, redacts private data and releases subscriptions on disconnect', async () => {
  const handlers = new Map<string, Function>();
  const listeners: (() => void)[] = [];
  let reads = 0;
  let unsubscribed = 0;
  const date = arenaDate();
  const database: any = storedAgenda([{ tenantId: 'valid', courtId: 'court', date, startTime: '18:00', endTime: '19:00', status: 'confirmed', customerName: 'PRIVATE' }])();
  const collection = database.collection;
  database.collection = (name: string) => {
    const result = collection(name);
    const subscribe = (next: (snapshot: any) => void) => {
      listeners.push(async () => { next(name === 'arenas' ? await result.doc().get() : await result.get()); });
      return () => { unsubscribed++; };
    };
    if (name === 'arenas') {
      const doc = result.doc;
      result.doc = () => { const record = doc(); return { ...record, get: () => { reads++; return record.get(); }, onSnapshot: subscribe }; };
    } else {
      const get = result.get;
      result.get = () => { reads++; return get(); }; result.onSnapshot = subscribe;
    }
    return result;
  };
  registerBookingRoutes({ get: (path: string, handler: Function) => handlers.set(path, handler), post() {} } as unknown as Express, () => database);
  const req = Object.assign(new EventEmitter(), { query: { tenantId: 'valid', date } });
  const output: string[] = [];
  const res = { setHeader() {}, flushHeaders() {}, write(value: string) { output.push(value); }, end() { req.emit('close'); } };
  handlers.get('/api/booking/stream')!(req, res);
  const secondReq = Object.assign(new EventEmitter(), { query: { tenantId: 'valid', date } });
  const secondOutput: string[] = [];
  handlers.get('/api/booking/stream')!(secondReq, { ...res, write: (value: string) => secondOutput.push(value) });
  try {
    assert.equal(listeners.length, 3);
    await Promise.all(listeners.map(notify => notify()));
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.ok(output.some(message => message.includes('event: availability\n')));
    assert.ok(secondOutput.some(message => message.includes('event: availability\n')));
    assert.equal(reads, 3, 'publishing uses the three received snapshots without rereading Firestore');
    secondReq.emit('close'); assert.equal(unsubscribed, 0, 'the first viewer still owns the shared source');
    assert.equal(output.join('').includes('PRIVATE'), false);
    assert.ok(output.join('').includes('reserved'));
  } finally { secondReq.emit('close'); req.emit('close'); }
  assert.equal(unsubscribed, 3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Express } from 'express';
import { registerBroadcastRoutes } from '../server/broadcasts';
import { liveDistance, matchesLiveLocation } from '../src/services/liveDirectory';
import { watchSessionReducer } from '../src/services/watchSession';
import { enterDocumentFullscreen, leaveDocumentFullscreen, lockImmersiveScroll } from '../src/services/fullscreen';

function liveRoute(database: Parameters<typeof registerBroadcastRoutes>[1]) {
  let handler: Function;
  registerBroadcastRoutes({ get: (_path: string, callback: Function) => { handler = callback; }, post() {}, patch() {} } as unknown as Express, database);
  return async (query: Record<string, unknown>) => {
    let status = 200, data: any;
    await handler!({ query }, { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { data = value; } });
    return { status, data };
  };
}

test('LIVE rejects invalid geography and cursors before accessing storage', async () => {
  const call = liveRoute(() => { throw Error('Must not access storage'); });
  for (const query of [{ mode: 'nearby' }, { mode: 'nearby', lat: '91', lng: '0' }, { mode: 'city', city: '' }, { mode: 'all', cursor: '../secret' }, { mode: 'unknown' }]) assert.equal((await call(query)).status, 400);
});

test('LIVE scans bounded pages, filters only verified arena locations and returns a cursor even for an empty filtered page', async () => {
  const calls: any[] = [];
  const docs = Array.from({ length: 12 }, (_, i) => ({ id: 'live' + i, data: () => ({ title: 'Game', arenaId: 'arena', ownerId: 'private-owner', videoUrl: 'https://example.test/video', isLive: true }) }));
  const chain = { where(...args: unknown[]) { calls.push(['where', ...args]); return this; }, orderBy() { return this; }, limit(value: number) { calls.push(['limit', value]); return this; }, startAfter(value: string) { calls.push(['cursor', value]); return this; }, async get() { return { docs, size: docs.length }; }, doc(id: string) { return id; } };
  const call = liveRoute((() => ({ collection: () => chain, getAll: async () => [{ id: 'arena', data: () => ({ city: 'Goiânia', state: 'GO', lat: -16.68, lng: -49.25, name: 'Arena Real' }) }] })) as any);
  const nearby = await call({ mode: 'nearby', lat: '-17.5689', lng: '-52.5812' });
  assert.equal(nearby.status, 200); assert.deepEqual(nearby.data.items, []); assert.equal(nearby.data.nextCursor, 'live11');
  const city = await call({ mode: 'city', city: 'goiania', state: 'GO', cursor: 'previous' });
  assert.equal(city.data.items.length, 12); assert.equal(city.data.items[0].arenaName, 'Arena Real');
  assert.equal(city.data.items[0].ownerId, undefined); assert.equal(city.data.items[0].videoUrl, undefined);
  assert.ok(calls.some(call => call[0] === 'limit' && call[1] === 12)); assert.ok(calls.some(call => call[0] === 'cursor' && call[1] === 'previous'));
});

test('LIVE location filters exclude unknown locations nearby, accept accents and distinguish states', () => {
  assert.equal(matchesLiveLocation({}, { mode: 'nearby', lat: 0, lng: 0 }), false);
  assert.equal(liveDistance({}, 0, 0), null);
  assert.equal(matchesLiveLocation({ lat: 0, lng: 0 }, { mode: 'nearby', lat: 0, lng: 0.1 }), true);
  assert.equal(matchesLiveLocation({ lat: 0, lng: 1 }, { mode: 'nearby', lat: 0, lng: 0 }), false);
  assert.equal(matchesLiveLocation({ city: 'São Paulo', state: 'SP' }, { mode: 'city', city: 'sao paulo', state: 'RJ' }), false);
  assert.equal(matchesLiveLocation({ city: 'São Paulo', state: 'SP' }, { mode: 'city', city: ' SAO PAULO ', state: 'sp' }), true);
  assert.equal(matchesLiveLocation({}, { mode: 'all' }), true);
});

test('storage failure returns an explicit LIVE failure', async () => {
  const result = await liveRoute(() => { throw Error('Offline'); })({ mode: 'all' });
  assert.equal(result.status, 503); assert.equal(result.data.items, undefined);
});

test('switching table and video keeps the selected tournament without replacing the session', () => {
  let session = watchSessionReducer({ view: 'video', tournamentId: 'one' }, { type: 'table' });
  assert.deepEqual(session, { view: 'table', tournamentId: 'one' });
  session = watchSessionReducer(session, { type: 'select', tournamentId: 'two' });
  session = watchSessionReducer(session, { type: 'video' });
  assert.deepEqual(session, { view: 'video', tournamentId: 'two' });
});

test('fullscreen supports native requests and fallback; nested scroll locks restore the original overflow exactly once', async () => {
  let requests = 0, exits = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const fake = { fullscreenElement: null as unknown, documentElement: { requestFullscreen: async () => { requests++; throw Error('Not supported'); } }, exitFullscreen: async () => { exits++; }, body: { style: { overflow: 'clip' } } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fake });
  try {
    await enterDocumentFullscreen(); assert.equal(requests, 1);
    fake.fullscreenElement = {}; await enterDocumentFullscreen(); assert.equal(requests, 1);
    await leaveDocumentFullscreen(); assert.equal(exits, 1);
    const releaseOne = lockImmersiveScroll(), releaseTwo = lockImmersiveScroll();
    assert.equal(fake.body.style.overflow, 'hidden');
    releaseOne(); releaseOne(); assert.equal(fake.body.style.overflow, 'hidden');
    releaseTwo(); assert.equal(fake.body.style.overflow, 'clip');
  } finally { if (original) Object.defineProperty(globalThis, 'document', original); else delete (globalThis as any).document; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueryResource } from '../src/services/queryResource';
import { createSharedSubscription } from '../src/services/sharedSubscription';
import { publicArenaProjection, readPublicArenas, writePublicArenas } from '../src/services/publicArenaCache';
import type { TenantConfig } from '../src/types';
import { staticWorkerPlugin } from '../scripts/staticWorkerPlugin';
import vm from 'node:vm';
import { readLivePage } from '../src/services/livePageCache';

test('simultaneous consumers and route remounts reuse one request inside TTL', async () => {
  let reads = 0, clock = 1000;
  const resource = createQueryResource(async () => { reads++; return [{ id: 'arena' }]; }, { ttl: 100, maxAge: 300, now: () => clock });
  const stop1 = resource.subscribe(() => {}), stop2 = resource.subscribe(() => {});
  try {
    await Promise.all([resource.refresh(), resource.refresh()]);
    assert.equal(reads, 1);
    const data = resource.getSnapshot().data;
    clock += 50; await resource.refresh(); assert.equal(reads, 1);
    clock += 100; await resource.refresh(); assert.equal(reads, 2);
    assert.equal(resource.getSnapshot().data, data, 'identical results preserve object identity');
  } finally { stop1(); stop2(); }
});

test('SWR keeps bounded stale data and never treats a failed fetch as an empty catalogue', async () => {
  let clock = 1000, fail = false;
  const resource = createQueryResource(async () => { if (fail) throw Error('offline'); return ['real']; }, { ttl: 100, maxAge: 300, now: () => clock });
  await resource.refresh(); fail = true; clock += 150;
  await resource.refresh(); assert.deepEqual(resource.getSnapshot().data, ['real']); assert.equal(resource.getSnapshot().error, 'offline');
  clock += 301; await resource.refresh(); assert.equal(resource.getSnapshot().data, undefined);
});

test('account clear rejects a late response from the previous account', async () => {
  let resolve!: (value: string[]) => void;
  const resource = createQueryResource(() => new Promise<string[]>(done => { resolve = done; }), { ttl: 100, maxAge: 300 });
  const pending = resource.refresh(); await Promise.resolve(); resource.clear(); resolve(['private-old-account']); await pending;
  assert.equal(resource.getSnapshot().data, undefined);
});

test('a newer live snapshot wins over an older HTTP response', async () => {
  let resolve!: (value: string[]) => void;
  const resource = createQueryResource(() => new Promise<string[]>(done => { resolve = done; }), { ttl: 100, maxAge: 300 });
  const pending = resource.refresh(); await Promise.resolve(); resource.publish(['live']); resolve(['old-http']); await pending;
  assert.deepEqual(resource.getSnapshot().data, ['live']);
});

test('invalidation during a request forces a fresh request and ignores the invalidated response', async () => {
  const resolutions: Array<(value: string[]) => void> = [];
  const resource = createQueryResource(() => new Promise<string[]>(done => resolutions.push(done)), { ttl: 10000, maxAge: 30000 });
  const stop = resource.subscribe(() => {});
  try {
    const old = resource.refresh(); await Promise.resolve(); resource.invalidate(); await Promise.resolve();
    assert.equal(resolutions.length, 2);
    resolutions[1](['new']); await resource.refresh(); resolutions[0](['old']); await old;
    assert.deepEqual(resource.getSnapshot().data, ['new']);
  } finally { stop(); }
});

test('live subscriptions share snapshots, isolate tenants, and release only at last unsubscribe', () => {
  const subscribe = createSharedSubscription<number>();
  let starts = 0, stops = 0, notify!: (value: number) => void;
  const start = (next: (value: number) => void) => { starts++; notify = next; return () => { stops++; }; };
  const first: number[] = [], second: number[] = [];
  const stop1 = subscribe('arena1:day', start, value => first.push(value)); notify(1);
  const stop2 = subscribe('arena1:day', start, value => second.push(value)); notify(2);
  assert.equal(starts, 1); assert.deepEqual(second, [1, 2]);
  const stop3 = subscribe('arena2:day', start, () => {}); assert.equal(starts, 2);
  stop1(); assert.equal(stops, 0); stop2(); assert.equal(stops, 1); stop3(); assert.equal(stops, 2);
});

test('public persisted arena cache excludes permissions, contacts in schedules and financial data; expires', () => {
  const arena = { id: 'public', name: 'Arena', ownerId: 'PRIVATE', managers: ['PRIVATE'], courts: [{ id: 'court', name: 'Quadra', sports: ['futevolei'], hourlyRate: 50, classSchedules: [{ phone: 'PRIVATE' }] }] } as unknown as TenantConfig;
  let saved = '';
  writePublicArenas([arena], { setItem: (_key, value) => { saved = value; } }, 1000);
  assert.equal(saved.includes('PRIVATE'), false);
  assert.equal(publicArenaProjection(arena).managers, undefined);
  assert.equal(readPublicArenas({ getItem: () => saved }, 1001)?.public.name, 'Arena');
  assert.equal(readPublicArenas({ getItem: () => saved }, 301001), undefined);
  assert.equal(readPublicArenas({ getItem: () => saved }, 999), undefined);
  assert.equal(readPublicArenas({ getItem: () => '{bad' }, 1001), undefined);
});

test('static service worker intercepts only allowlisted immutable assets and shell navigations', async () => {
  const plugin = staticWorkerPlugin();
  let source = '';
  const hook = plugin.generateBundle as Function;
  hook.call({ emitFile: (item: { source: string }) => { source = item.source; } }, {}, {
    'assets/app-hash.js': { type: 'chunk', code: '/* app */' }, 'index.html': { type: 'asset', source: '<html>' },
  });
  const handlers: Record<string, Function> = {};
  vm.runInNewContext(source, { self: { location: { origin: 'https://sharkset.test' }, addEventListener: (name: string, handler: Function) => { handlers[name] = handler; } }, URL, Set });
  for (const [path, method, authorization, mode] of [
    ['/api/booking/availability', 'GET', false, 'cors'], ['/api/booking/checkout', 'POST', false, 'cors'],
    ['/__/auth/handler', 'GET', false, 'navigate'], ['/assets/app-hash.js', 'GET', true, 'cors'],
    ['https://firestore.googleapis.com/private', 'GET', false, 'cors'], ['/brand/logo.png', 'GET', false, 'cors'],
  ] as const) {
    let intercepted = false;
    handlers.fetch({ request: { url: new URL(path, 'https://sharkset.test').href, method, mode, headers: { has: () => authorization } }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
  assert.equal(source.includes('skipWaiting'), false, 'deploy must not interrupt an active session');
});

test('live directory shares identical page requests and isolates location/cursor filters', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = (async () => {
    reads++;
    return new Response(JSON.stringify({ items: [{ id: 'real-live', title: 'Ao vivo' }], nextCursor: null }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const [first, second] = await Promise.all([readLivePage('/api/broadcasts?mode=all'), readLivePage('/api/broadcasts?mode=all')]);
    assert.equal(reads, 1); assert.equal(first, second);
    await readLivePage('/api/broadcasts?mode=city&city=Mineiros');
    await readLivePage('/api/broadcasts?mode=all&cursor=next');
    assert.equal(reads, 3);
  } finally { globalThis.fetch = original; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32c, migrate, parseArgs } from './migrate-livekit-secrets.mjs';

function fixture({ conflict = false, disabled = false, corrupt = false } = {}) {
  const calls = [], logs = [], values = new Map(), containers = new Set();
  const original = Buffer.from([0, 255, 13, 10, 65, 0, 128]);
  const request = async (method, url, body) => {
    calls.push({ method, url });
    if (url.includes('cloudresourcemanager')) {
      const id = url.split('/').at(-1);
      return { projectId: id, projectNumber: id === 'sharkset-70de4' ? '677873825510' : '1', lifecycleState: 'ACTIVE' };
    }
    const path = new URL(url).pathname.replace('/v1/', '');
    const source = path.includes('projects/sharkset/');
    if (path.endsWith(':access')) {
      const bytes = source ? original : values.get(path.replace('/versions/1:access', ''));
      return { payload: { data: bytes.toString('base64'), dataCrc32c: corrupt ? '0' : crc32c(bytes) } };
    }
    if (method === 'POST' && path.endsWith(':addVersion')) {
      const target = path.replace(':addVersion', '');
      values.set(target, Buffer.from(body.payload.data, 'base64'));
      return { name: `${target}/versions/1` };
    }
    if (method === 'POST') {
      const target = `${path}/${new URL(url).searchParams.get('secretId')}`;
      containers.add(target);
      return { name: target };
    }
    if (path.endsWith('/versions')) {
      const parent = path.replace('/versions', '');
      return { versions: source ? [{ name: `${parent}/versions/1`, state: disabled ? 'DISABLED' : 'ENABLED' }] : (values.has(parent) || conflict) ? [{ name: `${parent}/versions/1`, state: 'ENABLED' }] : [] };
    }
    return containers.has(path) || conflict ? { name: path } : null;
  };
  return { request, calls, logs, values, original, log: msg => logs.push(msg) };
}

test('CRC32C uses the standard Castagnoli checksum', () => {
  assert.equal(crc32c(Buffer.from('123456789')), '3808858755');
});
test('dry run reads metadata only and never mutates', async () => {
  const f = fixture();
  await migrate(f);
  assert.ok(f.calls.every(c => c.method === 'GET' && !c.url.endsWith(':access')));
});
test('apply preserves exact bytes, verifies all copies and never changes source', async () => {
  const f = fixture();
  await migrate({ ...f, apply: true });
  assert.equal(f.values.size, 3);
  for (const bytes of f.values.values()) assert.deepEqual(bytes, f.original);
  assert.ok(f.calls.every(c => c.method === 'GET' || c.url.includes('projects/sharkset-70de4/')));
  assert.ok(!f.logs.join('\n').includes(f.original.toString('base64')));
});
test('existing destination stops before accessing any payload or writing', async () => {
  const f = fixture({ conflict: true });
  await assert.rejects(migrate({ ...f, apply: true }), /destino ja possui/);
  assert.ok(f.calls.every(c => c.method === 'GET' && !c.url.endsWith(':access')));
});
test('disabled source stops during metadata checks', async () => {
  const f = fixture({ disabled: true });
  await assert.rejects(migrate({ ...f, apply: true }), /sem versao habilitada/);
  assert.ok(f.calls.every(c => c.method === 'GET' && !c.url.endsWith(':access')));
});
test('checksum mismatch blocks writes', async () => {
  const f = fixture({ corrupt: true });
  await assert.rejects(migrate({ ...f, apply: true }), /integridade/);
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('selected missing secret migrates without accessing existing key or URL', async () => {
  const f = fixture();
  const request = async (...args) => {
    const path = new URL(args[1]).pathname;
    if (path.includes('/secrets/LIVEKIT_API_KEY') || path.includes('/secrets/LIVEKIT_URL')) throw new Error('Existing secrets must remain untouched');
    return f.request(...args);
  };
  await migrate({ ...f, request, only: 'LIVEKIT_API_SECRET', apply: true });
  assert.equal(f.values.size, 1);
  assert.deepEqual(f.values.get('projects/sharkset-70de4/secrets/LIVEKIT_API_SECRET'), f.original);
});

test('selected dry run never reads a value', async () => {
  const f = fixture();
  await migrate({ ...f, only: 'LIVEKIT_API_SECRET' });
  assert.ok(f.calls.every(c => c.method === 'GET' && !c.url.endsWith(':access')));
  assert.equal(f.logs.filter(line => line.startsWith('LIVEKIT_')).length, 1);
});

test('only argument is restricted to approved names before API access', async () => {
  assert.deepEqual(parseArgs(['--only', 'LIVEKIT_API_SECRET', '--apply']), { only: 'LIVEKIT_API_SECRET', apply: true });
  for (const args of [['--only'], ['--only', 'OTHER'], ['--force'], ['--apply', '--apply']]) assert.throws(() => parseArgs(args), /Uso:/);
  const f = fixture();
  await assert.rejects(migrate({ ...f, only: '../OTHER', apply: true }), /nao permitido/);
  assert.equal(f.calls.length, 0);
});

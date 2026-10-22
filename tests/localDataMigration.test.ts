import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalDataMigrationPreview } from '../src/services/localDataMigration';

function storageWith(entries: Record<string, string>): Pick<Storage, 'getItem' | 'length' | 'key'> {
  const keys = Object.keys(entries);
  return {
    get length() { return keys.length; },
    key(index: number) { return keys[index] ?? null; },
    getItem(key: string) {
      return entries[key] ?? null;
    },
  };
}

test('migration preview counts recognized cache entries without exposing content or writing', () => {
  const preview = buildLocalDataMigrationPreview(
    storageWith({
      sharkset_v2_bookings: JSON.stringify([{ id: 'b1' }, { id: 'b2' }]),
      sharkset_v5_matches: JSON.stringify({ first: { score: '18-10' } }),
    }),
    'uid-123'
  );

  assert.equal(preview.authenticatedUid, 'uid-123');
  assert.equal(preview.writePerformed, false);
  assert.equal(preview.totalItems, 3);
  assert.ok(preview.totalBytes > 0);
  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v2_bookings')?.status, 'requires_identity_review');
  assert.equal(JSON.stringify(preview).includes('18-10'), false);
});

test('migration preview finds current UID-scoped keys without exposing their suffix or content', () => {
  const preview = buildLocalDataMigrationPreview(
    storageWith({
      'sharkset_v3_bookings:uid-private-123': JSON.stringify([{ id: 'booking-private' }]),
      'sharkset_v6_tournaments:uid-private-123': JSON.stringify([{ id: 'tournament-private' }]),
      sharkset_locale: 'pt',
    }),
    'uid-authenticated'
  );

  const report = JSON.stringify(preview);
  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v3_bookings:')?.itemCount, 1);
  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v6_tournaments:')?.itemCount, 1);
  assert.equal(report.includes('uid-private-123'), false);
  assert.equal(report.includes('booking-private'), false);
  assert.equal(report.includes('sharkset_locale'), false);
  assert.equal(preview.writePerformed, false);
});

test('migration preview reports invalid and empty caches explicitly', () => {
  const preview = buildLocalDataMigrationPreview(
    storageWith({ sharkset_v2_bookings: '{invalid' }),
    null
  );

  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v2_bookings')?.status, 'invalid_json');
  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v5_matches')?.status, 'empty');
  assert.equal(preview.totalItems, 0);
});

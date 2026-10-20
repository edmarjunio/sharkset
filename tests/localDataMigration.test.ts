import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalDataMigrationPreview } from '../src/services/localDataMigration';

function storageWith(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return {
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

test('migration preview reports invalid and empty caches explicitly', () => {
  const preview = buildLocalDataMigrationPreview(
    storageWith({ sharkset_v2_bookings: '{invalid' }),
    null
  );

  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v2_bookings')?.status, 'invalid_json');
  assert.equal(preview.sources.find((source) => source.sourceKey === 'sharkset_v5_matches')?.status, 'empty');
  assert.equal(preview.totalItems, 0);
});

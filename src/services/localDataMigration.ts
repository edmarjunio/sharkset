export interface LocalDataMigrationSource {
  key: string;
  suggestedCollection: string;
  match: 'exact' | 'prefix';
}

export interface LocalDataMigrationPreviewItem {
  sourceKey: string;
  suggestedCollection: string;
  itemCount: number;
  byteLength: number;
  parseError: boolean;
  status: 'empty' | 'requires_identity_review' | 'invalid_json';
}

export interface LocalDataMigrationPreview {
  authenticatedUid: string | null;
  writePerformed: false;
  sources: LocalDataMigrationPreviewItem[];
  totalItems: number;
  totalBytes: number;
}

/** Current operational keys, plus legacy versions that may still exist in a browser. */
export const LOCAL_DATA_MIGRATION_SOURCES: readonly LocalDataMigrationSource[] = [
  { key: 'sharkset_v4_arenas', suggestedCollection: 'arenas', match: 'exact' },
  { key: 'sharkset_v3_arenas', suggestedCollection: 'arenas', match: 'exact' },
  { key: 'sharkset_v3_bookings:', suggestedCollection: 'bookings', match: 'prefix' },
  { key: 'sharkset_v2_bookings', suggestedCollection: 'bookings', match: 'exact' },
  { key: 'sharkset_v2_waitlist:', suggestedCollection: 'waitlist', match: 'prefix' },
  { key: 'sharkset_v1_waitlist', suggestedCollection: 'waitlist', match: 'exact' },
  { key: 'sharkset_v3_athletes:', suggestedCollection: 'athletes_public', match: 'prefix' },
  { key: 'sharkset_v2_athletes', suggestedCollection: 'athletes_public', match: 'exact' },
  { key: 'sharkset_v2_ranking_logs:', suggestedCollection: 'ranking_events', match: 'prefix' },
  { key: 'sharkset_v1_ranking_logs', suggestedCollection: 'ranking_events', match: 'exact' },
  { key: 'sharkset_v3_class_students:', suggestedCollection: 'arena students', match: 'prefix' },
  { key: 'sharkset_v2_class_students', suggestedCollection: 'arena students', match: 'exact' },
  { key: 'sharkset_v6_tournaments:', suggestedCollection: 'tournaments', match: 'prefix' },
  { key: 'sharkset_v5_tournaments', suggestedCollection: 'tournaments', match: 'exact' },
  { key: 'sharkset_v6_pairs:', suggestedCollection: 'tournament registrations', match: 'prefix' },
  { key: 'sharkset_v5_pairs', suggestedCollection: 'tournament registrations', match: 'exact' },
  { key: 'sharkset_v6_matches:', suggestedCollection: 'matches', match: 'prefix' },
  { key: 'sharkset_v5_matches', suggestedCollection: 'matches', match: 'exact' },
  { key: 'sharkset_v2_mvp_votes', suggestedCollection: 'match_mvp_votes', match: 'exact' },
  { key: 'sharkset_academy_posts', suggestedCollection: 'academy_posts', match: 'exact' },
  { key: 'sharkset_v6_academy_posts', suggestedCollection: 'academy_posts', match: 'exact' },
  { key: 'sharkset_integrity_reports', suggestedCollection: 'integrity_reports', match: 'exact' },
];

function countItems(raw: string): { itemCount: number; parseError: boolean } {
  try {
    const parsed: unknown = JSON.parse(raw);
    const itemCount = Array.isArray(parsed)
      ? parsed.length
      : parsed && typeof parsed === 'object'
        ? Object.keys(parsed).length
        : 1;
    return { itemCount, parseError: false };
  } catch {
    return { itemCount: 0, parseError: true };
  }
}

function getSourceKeys(storage: Pick<Storage, 'getItem' | 'length' | 'key'>, source: LocalDataMigrationSource): string[] {
  if (source.match === 'exact') return storage.getItem(source.key) === null ? [] : [source.key];
  const matches: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(source.key)) matches.push(key);
  }
  return matches;
}

/**
 * Counts recognized browser caches without returning record contents or writing to Firestore.
 * UID suffixes are used only to find account-scoped caches and are never returned in the report.
 */
export function buildLocalDataMigrationPreview(
  storage: Pick<Storage, 'getItem' | 'length' | 'key'>,
  authenticatedUid: string | null
): LocalDataMigrationPreview {
  const sources = LOCAL_DATA_MIGRATION_SOURCES.map(({ key, suggestedCollection, match }) => {
    let itemCount = 0;
    let byteLength = 0;
    let parseError = false;
    for (const storageKey of getSourceKeys(storage, { key, suggestedCollection, match })) {
      const raw = storage.getItem(storageKey);
      if (raw === null || raw.trim() === '') continue;
      byteLength += new TextEncoder().encode(raw).length;
      const parsed = countItems(raw);
      itemCount += parsed.itemCount;
      parseError ||= parsed.parseError;
    }

    return {
      sourceKey: key,
      suggestedCollection,
      itemCount,
      byteLength,
      parseError,
      status: parseError ? 'invalid_json' as const : itemCount > 0 ? 'requires_identity_review' as const : 'empty' as const,
    };
  });

  return {
    authenticatedUid,
    writePerformed: false,
    sources,
    totalItems: sources.reduce((total, source) => total + source.itemCount, 0),
    totalBytes: sources.reduce((total, source) => total + source.byteLength, 0),
  };
}

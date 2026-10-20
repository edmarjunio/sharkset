export interface LocalDataMigrationSource {
  key: string;
  suggestedCollection: string;
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

export const LOCAL_DATA_MIGRATION_SOURCES: readonly LocalDataMigrationSource[] = [
  { key: 'sharkset_v3_arenas', suggestedCollection: 'arenas' },
  { key: 'sharkset_v2_bookings', suggestedCollection: 'bookings' },
  { key: 'sharkset_v1_waitlist', suggestedCollection: 'waitlist' },
  { key: 'sharkset_v2_athletes', suggestedCollection: 'athletes_public' },
  { key: 'sharkset_v1_ranking_logs', suggestedCollection: 'ranking_events' },
  { key: 'sharkset_v2_class_students', suggestedCollection: 'arena students' },
  { key: 'sharkset_v5_tournaments', suggestedCollection: 'tournaments' },
  { key: 'sharkset_v5_pairs', suggestedCollection: 'tournament registrations' },
  { key: 'sharkset_v5_matches', suggestedCollection: 'matches' },
  { key: 'sharkset_v6_academy_posts', suggestedCollection: 'academy_posts' },
  { key: 'sharkset_integrity_reports', suggestedCollection: 'integrity_reports' },
];

/**
 * Counts recognized browser caches without returning record contents or writing to Firestore.
 * Every item remains unresolved until ownership and schema are reviewed by an authorized operator.
 */
export function buildLocalDataMigrationPreview(
  storage: Pick<Storage, 'getItem'>,
  authenticatedUid: string | null
): LocalDataMigrationPreview {
  const sources = LOCAL_DATA_MIGRATION_SOURCES.map(({ key, suggestedCollection }) => {
    const raw = storage.getItem(key);
    if (raw === null || raw.trim() === '') {
      return {
        sourceKey: key,
        suggestedCollection,
        itemCount: 0,
        byteLength: 0,
        parseError: false,
        status: 'empty' as const,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        sourceKey: key,
        suggestedCollection,
        itemCount: 0,
        byteLength: new TextEncoder().encode(raw).length,
        parseError: true,
        status: 'invalid_json' as const,
      };
    }

    const itemCount = Array.isArray(parsed)
      ? parsed.length
      : parsed && typeof parsed === 'object'
        ? Object.keys(parsed).length
        : 1;

    return {
      sourceKey: key,
      suggestedCollection,
      itemCount,
      byteLength: new TextEncoder().encode(raw).length,
      parseError: false,
      status: itemCount > 0 ? ('requires_identity_review' as const) : ('empty' as const),
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

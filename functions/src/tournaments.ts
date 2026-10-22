import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const TOKEN_PLANS = new Set(['arena_pro_99', 'arena_pro_149']);
const SPORTS = new Set(['futevolei', 'beach_tennis', 'volei_praia']);
const CATEGORIES = new Set(['iniciante', 'iniciante_serie_c', 'serie_c', 'serie_b_serie_c', 'serie_b', 'serie_a_pro', 'mista']);

interface CreateTournamentInput {
  uid: string;
  email: string;
  isPlatformAdmin: boolean;
  payload: Record<string, unknown>;
}

export async function createTournamentWithEntitlement(db: Firestore, input: CreateTournamentInput) {
  const data = input.payload;
  const tournamentId = typeof data.id === 'string' ? data.id : '';
  const arenaId = typeof data.tenantId === 'string' ? data.tenantId : '';
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!/^[\w-]{1,64}$/.test(tournamentId) || !/^[\w-]{1,64}$/.test(arenaId)) throw new Error('ARENA_REQUIRED');
  if (!name || name.length > 140 || !SPORTS.has(String(data.sport)) || !CATEGORIES.has(String(data.category))) throw new Error('INVALID_TOURNAMENT');
  if (typeof data.date !== 'string' || data.date.length < 1 || data.date.length > 30 ||
      (data.semiFormat !== undefined && !['semi_direta', 'semi_com_chance'].includes(String(data.semiFormat))) ||
      (data.modalityFormat !== undefined && !['duplas', 'simples'].includes(String(data.modalityFormat))) ||
      (data.registrationFee !== undefined && (!Number.isFinite(data.registrationFee) || Number(data.registrationFee) < 0)) ||
      (data.maxPairs !== undefined && (!Number.isInteger(data.maxPairs) || Number(data.maxPairs) < 2 || Number(data.maxPairs) > 128))) {
    throw new Error('INVALID_TOURNAMENT');
  }

  const arenaRef = db.doc(`arenas/${arenaId}`);
  const profileRef = db.doc(`user_profiles/${input.uid}`);
  const accessRef = db.doc(`arena_access/${input.uid}`);
  const tournamentRef = db.doc(`tournaments/${tournamentId}`);
  const adminRef = db.doc(`admins/${input.uid}`);

  return db.runTransaction(async transaction => {
    const [arenaSnapshot, profileSnapshot, accessSnapshot, tournamentSnapshot, adminSnapshot] = await transaction.getAll(
      arenaRef, profileRef, accessRef, tournamentRef, adminRef,
    );
    if (!arenaSnapshot.exists) throw new Error('ARENA_NOT_FOUND');
    if (tournamentSnapshot.exists) throw new Error('TOURNAMENT_EXISTS');
    if (!profileSnapshot.exists) throw new Error('PROFILE_REQUIRED');
    const arena = arenaSnapshot.data()!;
    const managers = Array.isArray(arena.managers) ? arena.managers : [];
    const isArenaManager = arena.ownerId === input.uid || managers.some(manager =>
      String(manager).toLowerCase() === input.uid.toLowerCase() || String(manager).toLowerCase() === input.email.toLowerCase());
    if (!isArenaManager && !input.isPlatformAdmin && !adminSnapshot.exists) throw new Error('ARENA_FORBIDDEN');

    const access = accessSnapshot.data();
    const hasSubscription = access?.adminGranted === true || (access?.active === true && TOKEN_PLANS.has(String(access.plan)));
    const isAdmin = input.isPlatformAdmin || adminSnapshot.exists;
    const consumesToken = !isAdmin && !hasSubscription;
    const currentTokens = Number(profileSnapshot.data()?.tournamentTokens || 0);
    if (consumesToken && currentTokens < 1) throw new Error('TOKEN_REQUIRED');

    const allowedFields = [
      'sport', 'category', 'modalityFormat', 'semiFormat', 'date', 'location',
      'specificRules', 'format', 'description', 'maxPairs', 'registrationFee',
      'responsibleName', 'responsiblePhone', 'isOpenForRegistration', 'isFinished',
    ];
    const safeData = Object.fromEntries(allowedFields
      .filter(key => data[key] !== undefined)
      .map(key => [key, data[key]]));
    const tournament = {
      ...safeData,
      id: tournamentId,
      tenantId: arenaId,
      name,
      ownerId: input.uid,
      creatorUid: input.uid,
      createdScope: 'arena',
      creatorTokensSpent: consumesToken ? 1 : 0,
      tableLicenseStatus: consumesToken ? 'unlocked_single_token' : 'unlocked_arena_pro_99',
      tableLicenseFee: consumesToken ? 19.9 : 0,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (consumesToken) {
      transaction.update(profileRef, { tournamentTokens: currentTokens - 1 });
      transaction.create(db.doc(`user_profiles/${input.uid}/token_ledger/${tournamentId}`), {
        id: tournamentId,
        type: 'consumption',
        quantity: -1,
        tournamentId,
        arenaId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.create(tournamentRef, tournament);
    return { tournamentId, tournament, creatorTokensSpent: consumesToken ? 1 : 0 };
  });
}

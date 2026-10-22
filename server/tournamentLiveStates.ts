import type { Express, Request } from 'express';
import { adminDatabase, authenticatedUser } from './firebaseAdmin';

type RecordValue = Record<string, unknown>;
type LiveState = RecordValue;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: RecordValue, keys: string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function isShortString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (allowEmpty || value.trim().length > 0);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isPointEvent(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'timestamp', 'scoringTeam', 'scorerName', 'serverName', 'skill', 'scoreAfter'])) return false;
  return isShortString(value.id, 64) && isIsoDate(value.timestamp) && [1, 2].includes(Number(value.scoringTeam)) &&
    isShortString(value.scorerName, 80) && isShortString(value.serverName, 80) &&
    ['normal', 'ace', 'shark_attack', 'pingo', 'erro_adv'].includes(String(value.skill)) && isShortString(value.scoreAfter, 20);
}

function isTimeoutEvent(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'timestamp', 'requestedBy', 'teamName', 'scoreAtTimeout'])) return false;
  return isShortString(value.id, 64) && isIsoDate(value.timestamp) &&
    ['team1', 'team2', 'technical'].includes(String(value.requestedBy)) &&
    isShortString(value.teamName, 80) && isShortString(value.scoreAtTimeout, 20);
}

function isCardEvent(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'timestamp', 'team', 'playerName', 'cardType', 'reason', 'scoreAtCard'])) return false;
  return isShortString(value.id, 64) && isIsoDate(value.timestamp) && [1, 2].includes(Number(value.team)) &&
    isShortString(value.playerName, 80) && ['yellow', 'red'].includes(String(value.cardType)) &&
    isShortString(value.reason, 160, true) && isShortString(value.scoreAtCard, 20);
}

function isActiveTimeout(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'label', 'startedAt'])) return false;
  return ['team1', 'team2', 'technical'].includes(String(value.type)) &&
    isShortString(value.label, 80) && isIsoDate(value.startedAt);
}

export function isValidLiveRefereeState(value: unknown): value is LiveState {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'refereeName', 'targetPoints', 'servingTeam', 'serverRotationIndex', 'serviceOrderLabels',
    'serviceOrderTeams', 'firstServers', 'team1TimeoutsUsed', 'team2TimeoutsUsed', 'maxTimeoutsPerTeam',
    'activeTimeout', 'courtSwapsCount', 'currentSidesSwapped', 'startedAt', 'updatedAt',
    'pointHistory', 'timeoutHistory', 'cardsHistory',
  ])) return false;

  if (!isShortString(value.refereeName, 80) || !Number.isInteger(value.targetPoints) || Number(value.targetPoints) < 1 || Number(value.targetPoints) > 99 ||
    ![1, 2].includes(Number(value.servingTeam)) || !Number.isInteger(value.serverRotationIndex) || Number(value.serverRotationIndex) < 0 || Number(value.serverRotationIndex) > 3 ||
    !Array.isArray(value.serviceOrderLabels) || value.serviceOrderLabels.length !== 4 || !value.serviceOrderLabels.every(item => isShortString(item, 80)) ||
    !Number.isInteger(value.team1TimeoutsUsed) || Number(value.team1TimeoutsUsed) < 0 || Number(value.team1TimeoutsUsed) > 5 ||
    !Number.isInteger(value.team2TimeoutsUsed) || Number(value.team2TimeoutsUsed) < 0 || Number(value.team2TimeoutsUsed) > 5 ||
    !Number.isInteger(value.maxTimeoutsPerTeam) || Number(value.maxTimeoutsPerTeam) < 0 || Number(value.maxTimeoutsPerTeam) > 5 ||
    Number(value.team1TimeoutsUsed) > Number(value.maxTimeoutsPerTeam) || Number(value.team2TimeoutsUsed) > Number(value.maxTimeoutsPerTeam) ||
    !Number.isInteger(value.courtSwapsCount) || Number(value.courtSwapsCount) < 0 || Number(value.courtSwapsCount) > 20 ||
    typeof value.currentSidesSwapped !== 'boolean' || !isIsoDate(value.updatedAt) ||
    !Array.isArray(value.pointHistory) || value.pointHistory.length > 300 || !value.pointHistory.every(isPointEvent) ||
    !Array.isArray(value.timeoutHistory) || value.timeoutHistory.length > 20 || !value.timeoutHistory.every(isTimeoutEvent) ||
    (value.cardsHistory !== undefined && (!Array.isArray(value.cardsHistory) || value.cardsHistory.length > 30 || !value.cardsHistory.every(isCardEvent))) ||
    (value.activeTimeout !== undefined && !isActiveTimeout(value.activeTimeout)) ||
    (value.startedAt !== undefined && !isIsoDate(value.startedAt))) return false;

  if (value.serviceOrderTeams !== undefined &&
    (!Array.isArray(value.serviceOrderTeams) || value.serviceOrderTeams.length !== 4 || !value.serviceOrderTeams.every(team => [1, 2].includes(Number(team))))) return false;

  if (value.firstServers !== undefined && (!isRecord(value.firstServers) || !hasOnlyKeys(value.firstServers, ['team1', 'team2']) ||
    Object.values(value.firstServers).some(server => ![0, 1].includes(Number(server))))) return false;

  return true;
}

function canManageTournament(uid: string, email: string | undefined, tournament: RecordValue, arena: RecordValue | undefined,
  membership: RecordValue | undefined, isAdmin: boolean): boolean {
  if (isAdmin || tournament.ownerId === uid) return true;
  const arenaId = tournament.arenaId || tournament.tenantId;
  if (typeof arenaId !== 'string') return false;
  if (membership && ['owner', 'manager', 'referee'].includes(String(membership.role))) return true;
  const managers = Array.isArray(arena?.managers) ? arena.managers : [];
  return arena?.ownerId === uid || managers.includes(uid) || Boolean(email && managers.includes(email));
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') return 401;
  if (message === 'FORBIDDEN') return 403;
  if (message === 'NOT_FOUND') return 404;
  if (message === 'CONFLICT') return 409;
  if (message === 'INVALID') return 400;
  return 503;
}

export function registerTournamentLiveStateRoutes(
  app: Express,
  getDatabase = adminDatabase,
  getUser = authenticatedUser,
) {
  app.put('/api/tournaments/:tournamentId/matches/:matchId/live-state', async (req, res) => {
    const { tournamentId, matchId } = req.params;
    const { expectedRevision, liveReferee } = req.body || {};
    if (!/^[\w-]{1,64}$/.test(tournamentId) || !/^[\w-]{1,64}$/.test(matchId) ||
      !Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0 || !isValidLiveRefereeState(liveReferee)) {
      res.status(400).json({ error: 'Estado da arbitragem inválido.' });
      return;
    }

    try {
      const user = await getUser(req as Request);
      if (user.email_verified !== true) { res.status(403).json({ error: 'Confirme seu e-mail para atualizar o placar.' }); return; }
      const db = getDatabase();
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const matchRef = tournamentRef.collection('matches').doc(matchId);
      const arenaId = db.collection('arenas');
      const membershipPath = db.collection('arena_members');
      const adminRef = db.collection('admins').doc(user.uid);

      const nextRevision = await db.runTransaction(async (transaction: any) => {
        const tournamentSnapshot = await transaction.get(tournamentRef);
        if (!tournamentSnapshot.exists) throw new Error('NOT_FOUND');
        const tournament = tournamentSnapshot.data() as RecordValue;
        if (tournament.id !== tournamentId) throw new Error('INVALID');
        const tenantId = typeof tournament.arenaId === 'string' ? tournament.arenaId : tournament.tenantId;
        if (typeof tenantId !== 'string' || !/^[\w-]{1,64}$/.test(tenantId)) throw new Error('INVALID');
        const matchSnapshot = await transaction.get(matchRef);
        if (!matchSnapshot.exists) throw new Error('NOT_FOUND');
        const arenaRef = arenaId.doc(tenantId);
        const memberRef = membershipPath.doc(tenantId).collection('users').doc(user.uid);
        const [arenaSnapshot, memberSnapshot, adminSnapshot] = await Promise.all([
          transaction.get(arenaRef), transaction.get(memberRef), transaction.get(adminRef),
        ]);
        const previous = matchSnapshot.data() as RecordValue;
        if (previous.tournamentId !== tournamentId || previous.id !== matchId || previous.status === 'completed') throw new Error('INVALID');
        if (!canManageTournament(user.uid, user.email, tournament, arenaSnapshot.data(), memberSnapshot.data(), adminSnapshot.exists)) throw new Error('FORBIDDEN');
        const currentRevision = Number.isSafeInteger(previous.liveStateRevision) ? Number(previous.liveStateRevision) : 0;
        if (currentRevision !== Number(expectedRevision)) throw new Error('CONFLICT');
        if (JSON.stringify(previous.liveReferee) === JSON.stringify(liveReferee)) return currentRevision;
        const revision = currentRevision + 1;
        transaction.update(matchRef, { liveReferee, liveStateRevision: revision });
        return revision;
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({ revision: nextRevision });
    } catch (error) {
      const status = statusFor(error);
      res.status(status).json({ error: status === 409 ? 'O placar foi atualizado em outro dispositivo. Recarregue a partida.' :
        status === 403 ? 'Você não tem permissão para esta partida.' :
          status === 404 ? 'Partida não encontrada.' : status === 400 ? 'Partida ou estado inválido.' :
            status === 401 ? 'Entre na sua conta.' : 'Não foi possível salvar o placar.' });
    }
  });
}

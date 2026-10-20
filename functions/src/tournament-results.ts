type UnknownRecord = Record<string, unknown>;

export type OfficialResultEvent = {
  eventId: string;
  kind: 'result_confirmed' | 'result_corrected';
  tournamentId: string;
  matchId: string;
  revision: number;
  matchNumber: number;
  stage: string;
  stageName: string;
  courtName: string;
  tournamentName: string;
  team1: { id: string; name: string };
  team2: { id: string; name: string };
  winnerId: string;
  sets: Array<{ score1: number; score2: number }>;
  resultMode: 'played' | 'walkover';
  officialAt: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getTeamName(team: unknown): { id: string; name: string } | null {
  if (!isRecord(team) || typeof team.id !== 'string' || !team.id) return null;
  const player1 = typeof team.player1 === 'string' ? team.player1.trim() : '';
  const player2 = typeof team.player2 === 'string' ? team.player2.trim() : '';
  if (!player1) return null;
  return { id: team.id, name: player2 && player2 !== 'Individual (1x1)' ? `${player1} & ${player2}` : player1 };
}

function validateSetResult(set: unknown, target: number, winBy: number): 1 | 2 | null {
  if (!isRecord(set)) return null;
  const score1 = set.score1;
  const score2 = set.score2;
  if (!Number.isSafeInteger(score1) || !Number.isSafeInteger(score2) || (score1 as number) < 0 || (score2 as number) < 0) return null;
  const high = Math.max(score1 as number, score2 as number);
  const low = Math.min(score1 as number, score2 as number);
  if (score1 === score2 || high < target || high - low < winBy || (high > target && high - low !== winBy)) return null;
  return (score1 as number) > (score2 as number) ? 1 : 2;
}

export function validateOfficialResult(params: {
  tournamentId: string;
  matchId: string;
  match: UnknownRecord;
  tournamentName: string;
  isCorrection: boolean;
}): OfficialResultEvent | null {
  const { tournamentId, matchId, match, tournamentName, isCorrection } = params;
  if (match.id !== matchId || match.tournamentId !== tournamentId || match.status !== 'completed') return null;
  if (typeof match.officialAt !== 'string' || !Number.isFinite(Date.parse(match.officialAt))) return null;
  const team1 = getTeamName(match.team1);
  const team2 = getTeamName(match.team2);
  if (!team1 || !team2 || team1.id === team2.id) return null;
  if (match.winnerId !== team1.id && match.winnerId !== team2.id) return null;

  const resultMode = match.resultMode === 'walkover' ? 'walkover' : match.resultMode === 'played' ? 'played' : null;
  if (!resultMode) return null;

  let sets: Array<{ score1: number; score2: number }> = [];
  if (resultMode === 'played') {
    const rules = match.rules;
    if (!isRecord(rules)) return null;
    const bestOf = rules.bestOf;
    const targetPoints = rules.targetPoints;
    const decidingPoints = rules.decidingPoints;
    const winBy = rules.winBy;
    if (![1, 3, 5].includes(bestOf as number) || ![targetPoints, decidingPoints, winBy].every((value) => Number.isInteger(value) && (value as number) > 0 && (value as number) <= 99)) return null;
    if (!Array.isArray(match.sets) || match.sets.length < 1 || match.sets.length > (bestOf as number)) return null;

    let wins1 = 0;
    let wins2 = 0;
    const needed = Math.ceil((bestOf as number) / 2);
    for (let index = 0; index < match.sets.length; index += 1) {
      if (wins1 >= needed || wins2 >= needed) return null;
      const target = (bestOf as number) > 1 && index === (bestOf as number) - 1 ? decidingPoints as number : targetPoints as number;
      const winner = validateSetResult(match.sets[index], target, winBy as number);
      if (!winner) return null;
      if (winner === 1) wins1 += 1;
      else wins2 += 1;
    }
    if (Math.max(wins1, wins2) !== needed) return null;
    const computedWinner = wins1 > wins2 ? team1.id : team2.id;
    sets = match.sets.map((set) => ({ score1: (set as UnknownRecord).score1 as number, score2: (set as UnknownRecord).score2 as number }));
    const score1 = sets.reduce((total, set) => total + set.score1, 0);
    const score2 = sets.reduce((total, set) => total + set.score2, 0);
    if (match.score1 !== score1 || match.score2 !== score2 || match.winnerId !== computedWinner) return null;
  }

  const matchNumber = match.matchNumber;
  const revision = match.revision;
  if (!Number.isSafeInteger(matchNumber) || (matchNumber as number) < 1 || !Number.isSafeInteger(revision) || (revision as number) < 1) return null;
  const stage = typeof match.stage === 'string' ? match.stage : '';
  const stageName = typeof match.stageName === 'string' ? match.stageName.trim().slice(0, 80) : '';
  const courtName = typeof match.courtName === 'string' ? match.courtName.trim().slice(0, 80) : '';
  if (!stage || !stageName) return null;

  return {
    eventId: `${matchId}_${revision}`,
    kind: isCorrection ? 'result_corrected' : 'result_confirmed',
    tournamentId,
    matchId,
    revision: revision as number,
    matchNumber: matchNumber as number,
    stage,
    stageName,
    courtName,
    tournamentName: tournamentName.trim().slice(0, 140) || 'Campeonato SHARKSET',
    team1,
    team2,
    winnerId: match.winnerId,
    sets,
    resultMode,
    officialAt: match.officialAt,
  };
}

export function didOfficialResultChange(before: UnknownRecord | undefined, after: UnknownRecord): boolean {
  if (!before || before.status !== 'completed') return true;
  const previousResult = JSON.stringify({
    winnerId: before.winnerId,
    loserId: before.loserId,
    sets: before.sets,
    score1: before.score1,
    score2: before.score2,
    resultMode: before.resultMode,
  });
  const nextResult = JSON.stringify({
    winnerId: after.winnerId,
    loserId: after.loserId,
    sets: after.sets,
    score1: after.score1,
    score2: after.score2,
    resultMode: after.resultMode,
  });
  return previousResult !== nextResult;
}

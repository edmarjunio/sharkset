import { generateBracket } from './bracketGraph';
import { resolveBracket, officializeMatch, resetBracketMatch, editMatchDetails } from './bracketOperations';
import {
  BracketMatch,
  RefereeMatchState,
  SemiFormat,
  TeamPair,
  TournamentStandingRow,
} from '../types';
import { calculateFutevoleiMatchPoints } from './rankingValidator';

/**
 * Builds the default Referee Console state for a match (4-player service rotation, timeouts, court swaps).
 */
export function buildDefaultRefereeState(
  match: BracketMatch,
  refereeName: string = 'Árbitro Oficial SHARK SET'
): RefereeMatchState {
  const t1p1 = match.team1?.player1 || 'Atleta 1 (Dupla A)';
  const t1p2 =
    match.team1?.player2 && match.team1.player2.toLowerCase() !== 'individual (1x1)'
      ? match.team1.player2
      : t1p1;
  const t2p1 = match.team2?.player1 || 'Atleta 1 (Dupla B)';
  const t2p2 =
    match.team2?.player2 && match.team2.player2.toLowerCase() !== 'individual (1x1)'
      ? match.team2.player2
      : t2p1;

  const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    refereeName,
    targetPoints: 18,
    servingTeam: 1,
    serverRotationIndex: 0,
    serviceOrderLabels: [
      `1º Sacador: ${t1p1} (Dupla 1)`,
      `2º Sacador: ${t2p1} (Dupla 2)`,
      `3º Sacador: ${t1p2} (Dupla 1)`,
      `4º Sacador: ${t2p2} (Dupla 2)`,
    ],
    team1TimeoutsUsed: 0,
    team2TimeoutsUsed: 0,
    maxTimeoutsPerTeam: 1,
    activeTimeout: null,
    courtSwapsCount: 0,
    currentSidesSwapped: false,
    startedAt: nowStr,
    updatedAt: nowStr,
    pointHistory: [],
    timeoutHistory: [],
  };
}

export { officializeMatch, resetBracketMatch, allowSemifinalException, changeMatchRules, declareWalkover, editRegisteredTeam, correctionImpact } from './bracketOperations';

export function createBracketForPresentPairs(tournamentId: string, presentPairs: TeamPair[], _semiFormat: SemiFormat = 'semi_direta', drawMode: 'seeded' | 'random' | 'manual' = 'seeded', manualSlotPairIds?: (string | '')[]): BracketMatch[] {
  let teams = presentPairs.filter(team => team.tournamentId === tournamentId && team.enrollmentStatus !== 'rejected' && team.isPresent !== false);
  let randomSeed: number | undefined;
  if (drawMode === 'manual') {
    const ids = manualSlotPairIds || [];
    if (ids.length !== teams.length || new Set(ids).size !== teams.length || ids.some(id => !teams.some(team => team.id === id))) throw new Error('A ordem manual deve conter cada dupla uma única vez, sem vagas vazias.');
    const byId = new Map(teams.map(team => [team.id, team]));
    teams = ids.map(id => byId.get(id)!);
  } else if (drawMode === 'random') {
    teams = [...teams];
    randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    let state = randomSeed;
    for (let i = teams.length - 1; i > 0; i--) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      const j = Math.floor((state >>> 0) / 4294967296 * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }
  } else teams = [...teams].sort((a, b) => a.seed - b.seed);
  const matches = generateBracket(tournamentId, teams, { directSlots: drawMode === 'manual' });
  Object.assign(matches[0].bracketStructure!, { drawMode, randomSeed });
  return matches;
}

export function createBuraco4Bracket(tournamentId: string, registeredPairs: TeamPair[], format: SemiFormat = 'semi_direta'): BracketMatch[] {
  return createBracketForPresentPairs(tournamentId, registeredPairs, format);
}
export function createFourPairsBracket(tournamentId: string, teams: (TeamPair | undefined)[], format: SemiFormat = 'semi_direta'): BracketMatch[] {
  return createBracketForPresentPairs(tournamentId, teams.filter((team): team is TeamPair => Boolean(team)), format);
}
export function autoAdvanceByesInRound1(matches: BracketMatch[]): BracketMatch[] { return resolveBracket(matches); }
export function advanceWinner(matches: BracketMatch[], id: string, winner: 1 | 2, score1: number, score2: number): BracketMatch[] {
  if (![1, 2].includes(winner) || (score1 > score2 ? 1 : 2) !== winner) throw new Error('Vencedor incompatível com o placar.');
  const target = matches.find(m => m.id === id);
  const neededWins = target?.rules?.bestOf ? Math.ceil(target.rules.bestOf / 2) : 1;
  const sets = Array.from({ length: neededWins }, () => ({ score1, score2 }));
  return officializeMatch(matches, id, sets);
}
export const resetMatch = resetBracketMatch;
export const overrideMatchDetails = editMatchDetails;

/**
 * Extrai o pódio final do campeonato (1º, 2º e 3º colocados)
 */
export function getPodium(matches: BracketMatch[]): {
  champion?: TeamPair;
  runnerUp?: TeamPair;
  thirdPlace?: TeamPair;
} {
  const grandFinal = matches.find((m) => m.stage === 'grand_final');
  if (!grandFinal || grandFinal.status !== 'completed' || !grandFinal.winnerId) {
    return {};
  }

  const champion = grandFinal.winnerId === grandFinal.team1?.id ? grandFinal.team1 : grandFinal.team2;
  const runnerUp = grandFinal.winnerId === grandFinal.team1?.id ? grandFinal.team2 : grandFinal.team1;

  const thirdPlaceMatch = matches.find(
    (m) => (m.stage === 'third_place' || m.stageName.toLowerCase().includes('3º lugar')) && m.status === 'completed'
  );

  let thirdPlace: TeamPair | undefined;
  if (thirdPlaceMatch && thirdPlaceMatch.winnerId) {
    thirdPlace =
      thirdPlaceMatch.winnerId === thirdPlaceMatch.team1?.id
        ? thirdPlaceMatch.team1
        : thirdPlaceMatch.team2;
  }

  return { champion, runnerUp, thirdPlace };
}

/**
 * Gera automaticamente a Tabela de Classificação Geral do Torneio a partir dos resultados dos jogos
 */
export function computeTournamentStandings(
  matches: BracketMatch[],
  registeredPairs: TeamPair[]
): TournamentStandingRow[] {
  const podium = getPodium(matches);
  const completedMatches = matches.filter(
    (m) => m.status === 'completed' && m.team1 && m.team2 && m.score1 !== undefined && m.score2 !== undefined
  );

  const statsMap: Record<
    string,
    {
      pair: TeamPair;
      matchesPlayed: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      rankingPointsEarned: number;
    }
  > = {};

  registeredPairs
    .filter((p) => p.enrollmentStatus !== 'rejected')
    .forEach((p) => {
      statsMap[p.id] = {
        pair: p,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    });

  completedMatches.forEach((m) => {
    const t1 = m.team1!;
    const t2 = m.team2!;
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;

    if (!statsMap[t1.id]) {
      statsMap[t1.id] = {
        pair: t1,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    }
    if (!statsMap[t2.id]) {
      statsMap[t2.id] = {
        pair: t2,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    }

    const t1Won = m.winnerId === t1.id;
    const winnerTeam = t1Won ? t1 : t2;
    const loserTeam = t1Won ? t2 : t1;
    const winScore = t1Won ? s1 : s2;
    const loseScore = t1Won ? s2 : s1;

    const ptsCalc = calculateFutevoleiMatchPoints({
      winnerLevels: [winnerTeam.player1Level, winnerTeam.player2Level],
      loserLevels: [loserTeam.player1Level, loserTeam.player2Level],
      winnerScore: winScore,
      loserScore: loseScore,
      stage: m.stage,
    });

    statsMap[t1.id].matchesPlayed += 1;
    statsMap[t1.id].pointsFor += s1;
    statsMap[t1.id].pointsAgainst += s2;

    statsMap[t2.id].matchesPlayed += 1;
    statsMap[t2.id].pointsFor += s2;
    statsMap[t2.id].pointsAgainst += s1;

    if (t1Won) {
      statsMap[t1.id].wins += 1;
      statsMap[t1.id].rankingPointsEarned += ptsCalc.winnerPoints;
      statsMap[t2.id].losses += 1;
      statsMap[t2.id].rankingPointsEarned += ptsCalc.loserPoints;
    } else {
      statsMap[t2.id].wins += 1;
      statsMap[t2.id].rankingPointsEarned += ptsCalc.winnerPoints;
      statsMap[t1.id].losses += 1;
      statsMap[t1.id].rankingPointsEarned += ptsCalc.loserPoints;
    }
  });

  const eliminationLosses = new Map<string, number>();
  for (const match of matches) if (match.status === 'completed' && match.loserId && ['winners', 'losers'].includes(match.stage)) {
    eliminationLosses.set(match.loserId, (eliminationLosses.get(match.loserId) || 0) + 1);
  }
  const third = matches.find(match => match.stage === 'third_place');
  const final = matches.find(match => match.stage === 'grand_final');
  const contains = (match: BracketMatch | undefined, id: string) => match?.team1?.id === id || match?.team2?.id === id;
  const rows = Object.values(statsMap).map((st) => {
    const pointsDiff = st.pointsFor - st.pointsAgainst;
    const winRate = st.matchesPlayed > 0 ? Math.round((st.wins / st.matchesPlayed) * 100) : 0;

    let statusBadge = 'Na Disputa';
    if (podium.champion?.id === st.pair.id) statusBadge = '🥇 Campeão';
    else if (podium.runnerUp?.id === st.pair.id) statusBadge = '🥈 Vice-Campeão';
    else if (podium.thirdPlace?.id === st.pair.id) statusBadge = '🥉 3º Colocado';
    else if (third?.status === 'completed' && third.loserId === st.pair.id) statusBadge = '4º Colocado';
    else if (contains(final, st.pair.id)) statusBadge = 'Finalista';
    else if (contains(third, st.pair.id)) statusBadge = 'Disputa de 3º lugar';
    else if (matches.some(match => match.stage === 'semifinals' && contains(match, st.pair.id))) statusBadge = 'Semifinalista';
    else if ((eliminationLosses.get(st.pair.id) || 0) >= 2) statusBadge = 'Eliminado (2D)';
    else if (eliminationLosses.get(st.pair.id) === 1) statusBadge = 'Na Repescagem';
    else if (st.wins > 0 && st.losses === 0) statusBadge = 'Invicto';

    return {
      pair: st.pair,
      position: 0,
      matchesPlayed: st.matchesPlayed,
      wins: st.wins,
      losses: st.losses,
      pointsFor: st.pointsFor,
      pointsAgainst: st.pointsAgainst,
      pointsDiff,
      winRate,
      rankingPointsEarned: st.rankingPointsEarned,
      statusBadge,
    };
  });

  rows.sort((a, b) => {
    if (podium.champion?.id === a.pair.id) return -1;
    if (podium.champion?.id === b.pair.id) return 1;
    if (podium.runnerUp?.id === a.pair.id) return -1;
    if (podium.runnerUp?.id === b.pair.id) return 1;
    if (podium.thirdPlace?.id === a.pair.id) return -1;
    if (podium.thirdPlace?.id === b.pair.id) return 1;

    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.pair.seed - b.pair.seed;
  });

  return rows.map((r, idx) => ({
    ...r,
    position: idx + 1,
  }));
}

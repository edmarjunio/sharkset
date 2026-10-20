import type { BracketMatch, RefereeMatchState } from '../types';

type ServiceOrder = Pick<RefereeMatchState, 'serviceOrderLabels' | 'serviceOrderTeams' | 'firstServers' | 'servingTeam'>;

/** Names of the athletes of a pair, in listed order. Singles (1x1) have one athlete. */
export function pairAthletes(pair?: { player1: string; player2: string }, fallback = 'Atleta'): [string, string] {
  const first = pair?.player1 || `${fallback} 1`;
  const second = pair && pair.player2 && pair.player2.toLowerCase() !== 'individual (1x1)' ? pair.player2 : first;
  return [first, second];
}

/** Team that serves at a given position of the rotation (legacy alternation when no order was configured). */
export function teamAtServiceIndex(ref: Pick<RefereeMatchState, 'serviceOrderTeams'>, index: number): 1 | 2 {
  return ref.serviceOrderTeams?.[index] ?? (index % 2 === 0 ? 1 : 2);
}

/**
 * Official futevôlei order: the team that serves first opens with the athlete chosen by the referee,
 * then the opponents' chosen opener, then the first team's second athlete, then the opponents' second athlete.
 */
export function buildServiceOrder(
  match: Pick<BracketMatch, 'team1' | 'team2'>,
  firstTeam: 1 | 2,
  openers: { team1: 0 | 1; team2: 0 | 1 }
): Pick<RefereeMatchState, 'serviceOrderLabels' | 'serviceOrderTeams' | 'firstServers'> {
  const athletes = { 1: pairAthletes(match.team1, 'Atleta (Dupla 1)'), 2: pairAthletes(match.team2, 'Atleta (Dupla 2)') };
  const opener = { 1: openers.team1, 2: openers.team2 };
  const other: 1 | 2 = firstTeam === 1 ? 2 : 1;
  const teams: [1 | 2, 1 | 2, 1 | 2, 1 | 2] = [firstTeam, other, firstTeam, other];
  const label = (team: 1 | 2, second: boolean, position: number) =>
    `${position}º Sacador: ${athletes[team][second ? 1 - opener[team] : opener[team]]} (Dupla ${team})`;
  return {
    serviceOrderTeams: teams,
    serviceOrderLabels: [
      label(firstTeam, false, 1), label(other, false, 2), label(firstTeam, true, 3), label(other, true, 4),
    ],
    firstServers: { team1: openers.team1, team2: openers.team2 },
  };
}

export function currentServiceSnapshot(ref: ServiceOrder, rotationIndex: number) {
  return { team: teamAtServiceIndex(ref, rotationIndex), label: ref.serviceOrderLabels[rotationIndex] ?? ref.serviceOrderLabels[0] };
}

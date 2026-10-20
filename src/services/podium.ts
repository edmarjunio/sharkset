import type { BracketMatch, TeamPair } from '../types';

export interface TopFivePodium {
  first?: TeamPair;
  second?: TeamPair;
  third?: TeamPair;
  fourth?: TeamPair;
  /** Up to two pairs can share 5th place (one per lower-bracket final). */
  fifth: TeamPair[];
}

function pairById(match: BracketMatch, id?: string): TeamPair | undefined {
  if (!id) return undefined;
  return [match.team1, match.team2].find(team => team?.id === id);
}

/** Pure, result-driven standings: only official (completed) matches produce a place. */
export function computeTopFive(matches: BracketMatch[]): TopFivePodium {
  const done = (match?: BracketMatch) => (match?.status === 'completed' ? match : undefined);
  const final = done(matches.find(m => m.stage === 'grand_final' || m.stage === 'super_final'));
  const third = done(matches.find(m => m.stage === 'third_place'));
  const lowerDone = matches.filter(m => m.stage === 'losers' && m.status === 'completed' && m.loserId);
  const lastRound = Math.max(0, ...lowerDone.map(m => m.round));
  const fifth = lowerDone
    .filter(m => m.round === lastRound)
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map(m => pairById(m, m.loserId))
    .filter((team): team is TeamPair => Boolean(team));
  // 5th place is only decided once both semifinal slots from the lower bracket are known.
  const lowerFinished = matches.filter(m => m.stage === 'semifinals').every(m => m.team1 && m.team2);
  return {
    first: final ? pairById(final, final.winnerId) : undefined,
    second: final ? pairById(final, final.loserId) : undefined,
    third: third ? pairById(third, third.winnerId) : undefined,
    fourth: third ? pairById(third, third.loserId) : undefined,
    fifth: lowerFinished ? fifth : [],
  };
}

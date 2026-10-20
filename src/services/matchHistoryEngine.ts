export interface HistoricalMatchRecord {
  id: string;
  tournamentId: string;
  tournamentName: string;
  stage: string;
  date: string;
  pair1Id: string;
  pair1Names: string;
  pair2Id: string;
  pair2Names: string;
  score1: number;
  score2: number;
  setScores: string; // e.g. "18x15" or "18x16, 21x19"
  winnerId: string;
  courtName: string;
  surface: string;
  durationMinutes: number;
  acesCount?: number;
  sharkAttacksCount?: number;
}

export interface HeadToHeadSummary {
  pair1Id: string;
  pair1Names: string;
  pair2Id: string;
  pair2Names: string;
  totalMatches: number;
  pair1Wins: number;
  pair2Wins: number;
  pair1WinRate: number; // 0 - 100
  pair2WinRate: number; // 0 - 100
  pair1TotalPoints: number;
  pair2TotalPoints: number;
  pointDifferential: number;
  recentFormPair1: ('W' | 'L')[];
  recentFormPair2: ('W' | 'L')[];
  lastWinnerId: string | null;
  lastEncounterDate: string | null;
  history: HistoricalMatchRecord[];
  performanceTrends: {
    date: string;
    tournament: string;
    pair1Score: number;
    pair2Score: number;
    margin: number; // positive if pair1 won, negative if pair2 won
  }[];
}

export const INITIAL_HISTORICAL_MATCHES: HistoricalMatchRecord[] = [];

/**
 * Computes the Head-to-Head summary between any two pairs
 */
export function computeHeadToHeadSummary(
  pair1Id: string,
  pair1Names: string,
  pair2Id: string,
  pair2Names: string,
  matchHistoryList: HistoricalMatchRecord[] = INITIAL_HISTORICAL_MATCHES
): HeadToHeadSummary {
  // Find all matches where either pair1 was team1 and pair2 was team2, OR vice versa
  const relevantMatches = matchHistoryList.filter((m) => {
    const isP1Team1 = m.pair1Id === pair1Id;
    const isP1Team2 = m.pair2Id === pair1Id;
    const isP2Team1 = m.pair1Id === pair2Id;
    const isP2Team2 = m.pair2Id === pair2Id;

    return (isP1Team1 && isP2Team2) || (isP1Team2 && isP2Team1);
  });

  // Sort chronological descending (most recent first)
  relevantMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let pair1Wins = 0;
  let pair2Wins = 0;
  let pair1TotalPoints = 0;
  let pair2TotalPoints = 0;
  const recentFormPair1: ('W' | 'L')[] = [];
  const recentFormPair2: ('W' | 'L')[] = [];

  const performanceTrends = relevantMatches.map((m) => {
    const isP1First = m.pair1Id === pair1Id;
    const p1Score = isP1First ? m.score1 : m.score2;
    const p2Score = isP1First ? m.score2 : m.score1;
    const didP1Win = m.winnerId === pair1Id;

    if (didP1Win) {
      pair1Wins++;
      recentFormPair1.push('W');
      recentFormPair2.push('L');
    } else {
      pair2Wins++;
      recentFormPair1.push('L');
      recentFormPair2.push('W');
    }

    pair1TotalPoints += p1Score;
    pair2TotalPoints += p2Score;

    return {
      date: m.date,
      tournament: m.tournamentName,
      pair1Score: p1Score,
      pair2Score: p2Score,
      margin: p1Score - p2Score,
    };
  });

  const totalMatches = relevantMatches.length;
  const pair1WinRate = totalMatches > 0 ? Math.round((pair1Wins / totalMatches) * 100) : 0;
  const pair2WinRate = totalMatches > 0 ? Math.round((pair2Wins / totalMatches) * 100) : 0;
  const pointDifferential = pair1TotalPoints - pair2TotalPoints;

  const lastEncounter = relevantMatches[0] || null;

  return {
    pair1Id,
    pair1Names,
    pair2Id,
    pair2Names,
    totalMatches,
    pair1Wins,
    pair2Wins,
    pair1WinRate,
    pair2WinRate,
    pair1TotalPoints,
    pair2TotalPoints,
    pointDifferential,
    recentFormPair1: recentFormPair1.slice(0, 5),
    recentFormPair2: recentFormPair2.slice(0, 5),
    lastWinnerId: lastEncounter ? lastEncounter.winnerId : null,
    lastEncounterDate: lastEncounter ? lastEncounter.date : null,
    history: relevantMatches,
    performanceTrends,
  };
}

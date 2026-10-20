import type { BracketMatch, TeamPair, Tournament } from '../types';

export interface PodiumCardEntry {
  place: 1 | 2 | 3;
  team: TeamPair;
  decision: BracketMatch;
}

function validDecision(match: BracketMatch): boolean {
  return match.status === 'completed' && Boolean(
    match.team1 && match.team2 && match.team1.id !== match.team2.id &&
    match.winnerId && match.loserId && match.winnerId !== match.loserId &&
    [match.team1.id, match.team2.id].includes(match.winnerId) &&
    [match.team1.id, match.team2.id].includes(match.loserId),
  );
}

/** Cards are a projection of results, never a source of placements or ranking points. */
export function getPodiumCards(tournament: Tournament, matches: BracketMatch[]) {
  const games = matches.filter(match => match.tournamentId === tournament.id);
  const finals = games.filter(match => match.stage === 'grand_final' || match.stage === 'super_final');
  const bronze = games.filter(match => match.stage === 'third_place');
  if (!games.length || games.some(match => match.status !== 'completed') ||
      finals.length !== 1 || bronze.length > 1 || !validDecision(finals[0]) ||
      (bronze.length === 1 && !validDecision(bronze[0]))) return null;
  const final = finals[0];
  const teamFor = (match: BracketMatch, id: string) =>
    [match.team1!, match.team2!].find(team => team.id === id)!;
  const entries: PodiumCardEntry[] = [
    { place: 1, team: teamFor(final, final.winnerId!), decision: final },
    { place: 2, team: teamFor(final, final.loserId!), decision: final },
  ];
  if (bronze.length) entries.push({ place: 3, team: teamFor(bronze[0], bronze[0].winnerId!), decision: bronze[0] });
  if (new Set(entries.map(entry => entry.team.id)).size !== entries.length) return null;
  // A correction invalidates the old photo draft and reopens the completion prompt.
  const revision = JSON.stringify(entries.map(({ place, team, decision }) => [
    place, team.id, team.player1, team.player2, decision.id, decision.revision,
    decision.winnerId, decision.loserId, decision.resultMode, decision.sets,
    decision.score1, decision.score2,
  ]));
  return { entries, revision };
}

export function decisionScore(match: BracketMatch): string {
  if (match.resultMode === 'walkover') return 'W.O. — sem placar de sets';
  if (match.sets?.length) return match.sets.map(set => `${set.score1} × ${set.score2}`).join(' / ');
  if (Number.isFinite(match.score1) && Number.isFinite(match.score2)) return `${match.score1} × ${match.score2}`;
  return 'Placar não informado';
}

export const PODIUM_LABELS = { 1: 'CAMPEÕES', 2: 'VICE-CAMPEÕES', 3: 'TERCEIRO LUGAR' } as const;

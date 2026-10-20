import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPodiumCards, decisionScore } from '../src/services/podiumCards';
import { generateBracket } from '../src/services/bracketGraph';
import { allowSemifinalException, officializeMatch } from '../src/services/bracketOperations';
import type { BracketMatch, TeamPair, Tournament } from '../src/types';

const tournament = { id: 'podium-test' } as Tournament;
function completedBracket(count: number, thirdPlace = true) {
  const teams: TeamPair[] = Array.from({ length: count }, (_, index) => ({
    id: `team-${index}`, tournamentId: tournament.id, player1: `A${index}`, player2: `B${index}`,
    player1Level: 'iniciante', player2Level: 'iniciante', category: 'iniciante', seed: index + 1,
    phone: '', isPaid: true, isPresent: true, registeredAt: '2026-10-20',
  }));
  let matches = generateBracket(tournament.id, teams, { thirdPlace });
  while (matches.some(match => match.status !== 'completed')) {
    if (matches.some(match => match.semifinalDecision === 'blocked')) {
      matches = allowSemifinalException(matches, tournament.id, 'Exceção de teste aprovada pela organização');
    }
    const next = matches.find(match => match.status !== 'completed' && match.team1 && match.team2)!;
    const sets = Array.from({ length: Math.ceil(next.rules!.bestOf / 2) }, () => ({ score1: 18, score2: 12 }));
    matches = officializeMatch(matches, next.id, sets);
  }
  return matches;
}

test('cards use the official final and bronze results across even and odd fields', () => {
  for (const count of [4, 5, 7, 9, 13, 16, 17, 32]) {
    const matches = completedBracket(count);
    const cards = getPodiumCards(tournament, matches)!;
    const final = matches.find(match => match.stage === 'grand_final')!;
    const bronze = matches.find(match => match.stage === 'third_place')!;
    assert.deepEqual(cards.entries.map(entry => entry.team.id), [final.winnerId, final.loserId, bronze.winnerId]);
    assert.equal(cards.entries.length, 3);
  }
});

test('no invented third place when bronze match is disabled', () => {
  const cards = getPodiumCards(tournament, completedBracket(7, false))!;
  assert.deepEqual(cards.entries.map(entry => entry.place), [1, 2]);
});

test('live, pending and inconsistent decisions cannot create collectible awards', () => {
  const matches = completedBracket(4);
  for (const stage of ['grand_final', 'third_place']) {
    assert.equal(getPodiumCards(tournament, matches.map(match => match.stage === stage ? { ...match, status: 'in_progress' } : match)), null);
  }
  assert.equal(getPodiumCards(tournament, matches.map(match => match.stage === 'grand_final' ? { ...match, winnerId: 'unknown' } : match)), null);
  assert.equal(getPodiumCards(tournament, []), null);
  assert.equal(getPodiumCards({ id: 'other' } as Tournament, matches), null);
});

test('corrections invalidate the draft identity without modifying results or points', () => {
  const matches = completedBracket(4);
  const before = JSON.stringify(matches);
  const original = getPodiumCards(tournament, matches)!;
  const corrected = matches.map(match => match.stage === 'grand_final' ? {
    ...match, winnerId: match.loserId, loserId: match.winnerId, revision: (match.revision || 0) + 1,
  } : match);
  assert.notEqual(getPodiumCards(tournament, corrected)!.revision, original.revision);
  assert.equal(JSON.stringify(matches), before);
  assert.equal(getPodiumCards(tournament, matches)!.revision, original.revision);
});

test('score preserves set order and never fabricates points for walkover or missing scores', () => {
  assert.equal(decisionScore({ resultMode: 'walkover', score1: 18, score2: 0 } as BracketMatch), 'W.O. — sem placar de sets');
  assert.equal(decisionScore({ sets: [{ score1: 18, score2: 16 }, { score1: 12, score2: 18 }, { score1: 15, score2: 13 }] } as BracketMatch), '18 × 16 / 12 × 18 / 15 × 13');
  assert.equal(decisionScore({} as BracketMatch), 'Placar não informado');
});

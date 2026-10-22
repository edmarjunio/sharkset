import test from 'node:test';
import assert from 'node:assert/strict';
import { didOfficialResultChange, validateOfficialResult } from '../src/tournament-results';

const baseMatch = {
  id: 'match-1',
  tournamentId: 'tournament-1',
  matchNumber: 3,
  stage: 'semifinals',
  stageName: 'Semifinal',
  courtName: 'Quadra 01',
  status: 'completed',
  officialAt: '2026-10-20T15:00:00.000Z',
  revision: 1,
  team1: { id: 'pair-a', player1: 'João', player2: 'Pedro', player1Email: 'private@example.com' },
  team2: { id: 'pair-b', player1: 'Lucas', player2: 'Rafael' },
  rules: { bestOf: 3, targetPoints: 18, decidingPoints: 15, winBy: 2 },
  sets: [{ score1: 18, score2: 20 }, { score1: 20, score2: 18 }, { score1: 13, score2: 15 }],
  score1: 51,
  score2: 53,
  winnerId: 'pair-b',
  loserId: 'pair-a',
  resultMode: 'played',
};

test('builds one public result event with official sets and no personal contact fields', () => {
  const event = validateOfficialResult({
    tournamentId: 'tournament-1',
    matchId: 'match-1',
    match: baseMatch,
    tournamentName: 'Open de Futevôlei',
    isCorrection: false,
  });

  assert.deepEqual(event, {
    eventId: 'match-1_1',
    kind: 'result_confirmed',
    tournamentId: 'tournament-1',
    matchId: 'match-1',
    revision: 1,
    matchNumber: 3,
    stage: 'semifinals',
    stageName: 'Semifinal',
    courtName: 'Quadra 01',
    tournamentName: 'Open de Futevôlei',
    team1: { id: 'pair-a', name: 'João & Pedro' },
    team2: { id: 'pair-b', name: 'Lucas & Rafael' },
    winnerId: 'pair-b',
    sets: [{ score1: 18, score2: 20 }, { score1: 20, score2: 18 }, { score1: 13, score2: 15 }],
    resultMode: 'played',
    officialAt: '2026-10-20T15:00:00.000Z',
  });
});

test('rejects a result with an invalid set, inconsistent winner, or wrong tournament link', () => {
  assert.equal(validateOfficialResult({ tournamentId: 'tournament-1', matchId: 'match-1', match: { ...baseMatch, sets: [{ score1: 18, score2: 17 }] }, tournamentName: 'Open', isCorrection: false }), null);
  assert.equal(validateOfficialResult({ tournamentId: 'tournament-1', matchId: 'match-1', match: { ...baseMatch, winnerId: 'pair-a' }, tournamentName: 'Open', isCorrection: false }), null);
  assert.equal(validateOfficialResult({ tournamentId: 'other-tournament', matchId: 'match-1', match: baseMatch, tournamentName: 'Open', isCorrection: false }), null);
});

test('marks changed official scores as corrections and identical retries as duplicates', () => {
  const before = { ...baseMatch };
  assert.equal(didOfficialResultChange(before, { ...baseMatch }), false);
  assert.equal(didOfficialResultChange(before, { ...baseMatch, revision: 2 }), false);
  assert.equal(didOfficialResultChange(before, { ...baseMatch, score1: 52, revision: 2 }), true);

  const correction = validateOfficialResult({
    tournamentId: 'tournament-1', matchId: 'match-1',
    match: { ...baseMatch, revision: 2 }, tournamentName: 'Open', isCorrection: true,
  });
  assert.equal(correction?.kind, 'result_corrected');
  assert.equal(correction?.eventId, 'match-1_2');
});

test('supports walkovers without fabricating a score', () => {
  const walkover = validateOfficialResult({
    tournamentId: 'tournament-1', matchId: 'match-1',
    match: { ...baseMatch, resultMode: 'walkover', sets: [], score1: undefined, score2: undefined, winnerId: 'pair-a', loserId: 'pair-b' },
    tournamentName: 'Open', isCorrection: false,
  });
  assert.equal(walkover?.resultMode, 'walkover');
  assert.deepEqual(walkover?.sets, []);
});

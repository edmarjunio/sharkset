import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateBracket, validateGraph } from '../src/services/bracketGraph';
import { allowSemifinalException, changeMatchRules, declareWalkover, editMatchDetails, editRegisteredTeam, officializeMatch, resetBracketMatch } from '../src/services/bracketOperations';
import { computeTournamentStandings, getPodium } from '../src/services/bracketEngine';
import { validateMatchSets, validateSet, EARLY_RULES, PLAYOFF_RULES } from '../src/services/tournamentRules';
import { layoutBracket, bracketEdges, CARD_HEIGHT, CARD_WIDTH } from '../src/services/bracketLayout';
import type { BracketMatch, TeamPair } from '../src/types';

function teams(count: number): TeamPair[] {
  return Array.from({ length: count }, (_, i) => ({ id: `S${String(i + 1).padStart(2, '0')}`, tournamentId: 'test', seed: i + 1,
    player1: `Atleta A${i}`, player2: `Atleta B${i}`, player1Id: `a${i}`, player2Id: `b${i}`,
    player1Level: 'iniciante', player2Level: 'iniciante', phone: '', category: 'iniciante', isPaid: true,
    isPresent: true, enrollmentStatus: 'confirmed', registeredAt: '2026-10-18' }));
}
function finish(matches: BracketMatch[], seed = 1) {
  let next = matches;
  while (next.some(match => match.status !== 'completed')) {
    if (next.some(match => match.semifinalDecision === 'blocked')) next = allowSemifinalException(next, 'test', 'Exceção técnica no cenário de teste');
    const ready = next.filter(match => match.status !== 'completed' && match.team1 && match.team2);
    assert.ok(ready.length, 'A tabela deve liberar pelo menos um jogo');
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const match = ready[seed % ready.length];
    const winner = seed % 2;
    const sets = Array.from({ length: Math.ceil(match.rules!.bestOf / 2) }, () => ({ score1: winner ? 18 : 10, score2: winner ? 10 : 18 }));
    next = officializeMatch(next, match.id, sets);
  }
  return next;
}

test('all supported counts 4..1024 generate the correct real match count and acyclic sources', () => {
  for (let count = 4; count <= 1024; count++) {
    const matches = generateBracket('test', teams(count));
    assert.equal(matches.length, 2 * count - 2, `N=${count}`);
    assert.equal(matches.filter(match => match.stage === 'winners').length, count - 2);
    assert.equal(matches.filter(match => match.stage === 'losers').length, count - 4);
    const known = new Set<string>(), participants = new Set<string>();
    for (const match of matches) {
      for (const source of [match.source1!, match.source2!]) {
        if (source.kind === 'team') participants.add(source.team.id);
        else assert.ok(known.has(source.matchId), 'Sources must precede dependents');
      }
      known.add(match.id);
      assert.equal(match.status, 'scheduled'); assert.equal(match.score1, undefined);
    }
    assert.equal(participants.size, count);
    assert.equal(generateBracket('test', teams(count), { thirdPlace: false }).length, 2 * count - 3);
  }
});

test('invalid participant counts and duplicate teams or athletes are rejected', () => {
  for (const count of [0, 1, 2, 3, 1025]) assert.throws(() => generateBracket('test', teams(count)));
  const duplicate = teams(4); duplicate[1].id = duplicate[0].id;
  assert.throws(() => generateBracket('test', duplicate));
  const duplicateAthlete = teams(4); duplicateAthlete[1].player1Id = duplicateAthlete[0].player1Id;
  assert.throws(() => generateBracket('test', duplicateAthlete));
});

test('private reference: all 30 nodes and sources match the 16-team oracle exactly', () => {
  const fixture = JSON.parse(fs.readFileSync('technical_table/template_16_duplas_30_jogos.json', 'utf8'));
  const matches = generateBracket('test', teams(16), { directSlots: true });
  matches.forEach((match, index) => {
    assert.equal(match.nodeKey, fixture.matches[index].id);
    for (const [source, key] of [[match.source1!, 'slotA'], [match.source2!, 'slotB']] as const) {
      const expected = fixture.matches[index][key];
      assert.equal(source.kind === 'team' ? 'seed' : source.kind, expected.kind);
      assert.equal(source.kind === 'team' ? source.team.id : source.matchId.replace('test-', ''), expected.id || expected.matchId);
    }
  });
});

test('private fixtures reproduce fixed, swapped and blocked semifinals', () => {
  const scenarios = JSON.parse(fs.readFileSync('technical_table/cenarios_teste.json', 'utf8'));
  for (const scenario of scenarios) {
    let matches = generateBracket('test', teams(16), { directSlots: true });
    for (const result of scenario.results) {
      const match = matches.find(item => item.nodeKey === result.matchId)!;
      matches = officializeMatch(matches, match.id, [{ score1: match.team1?.id === result.winnerId ? 18 : 10, score2: match.team2?.id === result.winnerId ? 18 : 10 }]);
    }
    assert.equal(matches.find(match => match.stage === 'semifinals')!.semifinalDecision, scenario.expectedSemifinalDecision);
    if (scenario.expectedSemifinalDecision === 'blocked') {
      const semi = matches.find(match => match.stage === 'semifinals')!;
      assert.throws(() => officializeMatch(matches, semi.id, [{ score1: 18, score2: 10 }, { score1: 18, score2: 10 }]));
      assert.throws(() => allowSemifinalException(matches, 'test', ''));
      matches = allowSemifinalException(matches, 'test', 'Decisão expressa da organização');
      assert.ok(matches.filter(match => match.stage === 'semifinals').every(match => match.team1 && match.team2));
    }
  }
});

test('complete every count 4..64 with two different result and execution orders', () => {
  for (let count = 4; count <= 64; count++) for (const seed of [1, 123456]) {
    const matches = finish(generateBracket('test', teams(count)), seed);
    assert.equal(matches.filter(match => match.status === 'completed').length, 2 * count - 2);
    assert.ok(getPodium(matches).champion); assert.ok(getPodium(matches).thirdPlace);
    const losses = new Map<string, number>();
    for (const match of matches.filter(match => match.stage === 'winners' || match.stage === 'losers')) {
      losses.set(match.loserId!, (losses.get(match.loserId!) || 0) + 1);
    }
    for (const semi of matches.filter(match => match.stage === 'semifinals')) {
      assert.equal(losses.get(semi.team1!.id) || 0, 0); assert.equal(losses.get(semi.team2!.id), 1);
    }
    assert.equal(computeTournamentStandings(matches, teams(count)).reduce((sum, row) => sum + row.matchesPlayed, 0), 2 * matches.length);
  }
});

test('sets stop at the first valid winning point; best-of-three stops after two wins', () => {
  for (const scores of [[18, 16], [19, 17], [18, 0], [16, 18]]) assert.doesNotThrow(() => validateSet({ score1: scores[0], score2: scores[1] }, 18, 2));
  for (const scores of [[18, 17], [19, 16], [0, 0], [-1, 18], [18.5, 10], [NaN, 18]]) assert.throws(() => validateSet({ score1: scores[0], score2: scores[1] }, 18, 2));
  assert.throws(() => validateMatchSets([{ score1: 18, score2: 10 }], PLAYOFF_RULES));
  assert.throws(() => validateMatchSets(Array(3).fill({ score1: 18, score2: 10 }), PLAYOFF_RULES));
  assert.equal(validateMatchSets([{ score1: 18, score2: 10 }, { score1: 10, score2: 18 }, { score1: 15, score2: 13 }], PLAYOFF_RULES).winningTeam, 1);
});

test('correction, reset, team swap and metadata edits after completed tournaments', () => {
  for (let count = 4; count <= 64; count++) {
    const completed = finish(generateBracket('test', teams(count)));
    const first = completed[0];
    const reverse = [{ score1: first.winnerId === first.team1!.id ? 10 : 18, score2: first.winnerId === first.team1!.id ? 18 : 10 }];
    const corrected = officializeMatch(completed, first.id, reverse, { reason: 'Correção do vencedor' });
    assert.notEqual(corrected[0].winnerId, first.winnerId);
    assert.ok(corrected.some(match => match.status === 'scheduled'));
    assert.ok(finish(corrected).every(match => match.status === 'completed'));
    const reset = resetBracketMatch(completed, first.id);
    assert.equal(reset[0].status, 'scheduled'); assert.ok(finish(reset).every(match => match.status === 'completed'));
    const swap = editMatchDetails(completed, first.id, { team1: first.team2, team2: first.team1 });
    assert.equal(swap[0].team1!.id, first.team2!.id); assert.equal(swap[0].team2!.id, first.team1!.id);
    const renamed = editRegisteredTeam(completed, { ...first.team1!, player1: 'Nome corrigido' });
    assert.ok(renamed.filter(match => match.team1?.id === first.team1!.id).every(match => match.team1!.player1 === 'Nome corrigido'));
    assert.ok(renamed.every(match => match.status === 'completed'));
    const agenda = editMatchDetails(completed, first.id, { courtName: 'Quadra 9', scheduledTime: '20:00' });
    assert.equal(agenda[0].courtName, 'Quadra 9'); assert.ok(agenda.every(match => match.status === 'completed'));
  }
});

test('same result or idempotency key does not credit twice; WO has no invented score', () => {
  const original = generateBracket('test', teams(8));
  const result = officializeMatch(original, original[0].id, [{ score1: 18, score2: 10 }], { operationId: 'same' });
  assert.equal(officializeMatch(result, result[0].id, [{ score1: 18, score2: 10 }]), result);
  assert.equal(officializeMatch(result, result[0].id, [{ score1: 10, score2: 18 }], { operationId: 'same' }), result);
  const wo = declareWalkover(original, original[0].id, 1, 'Dupla ausente na chamada');
  assert.equal(declareWalkover(wo, wo[0].id, 1, 'Dupla ausente na chamada'), wo);
  assert.equal(wo[0].score1, undefined); assert.equal(wo[0].sets, undefined);
  assert.equal(computeTournamentStandings(wo, teams(8)).reduce((sum, row) => sum + row.rankingPointsEarned, 0), 0);
  const rules = changeMatchRules(result, result[0].id, { ...EARLY_RULES, targetPoints: 21 });
  assert.equal(rules[0].status, 'scheduled');
});

test('graph validation rejects duplicate origins, cycles and foreign registrations', () => {
  const original = generateBracket('test', teams(8));
  const cycle = structuredClone(original); cycle[0].source1 = { kind: 'winner', matchId: cycle.at(-1)!.id };
  assert.throws(() => validateGraph(cycle));
  const duplicate = structuredClone(original); duplicate[1].source1 = duplicate[0].source1;
  assert.throws(() => validateGraph(duplicate));
  const foreign = teams(4); foreign[0].tournamentId = 'other';
  assert.throws(() => generateBracket('test', foreign));
  assert.throws(() => editMatchDetails(original, original[0].id, { team1: { ...teams(8)[0], id: 'unregistered' } }));
});

test('larger complete tournaments and reopening a live descendant', () => {
  for (const count of [65, 127, 128, 256]) assert.ok(finish(generateBracket('test', teams(count))).every(match => match.status === 'completed'));
  let matches = generateBracket('test', teams(8));
  for (const match of matches.filter(match => match.round === 1 && match.stage === 'winners')) matches = officializeMatch(matches, match.id, [{ score1: 18, score2: 10 }]);
  const next = matches.find(match => match.round === 2 && match.stage === 'winners')!;
  next.status = 'in_progress'; next.score1 = 7; next.score2 = 8;
  const source = next.source1!; assert.notEqual(source.kind, 'team');
  if (source.kind === 'team') return;
  const corrected = officializeMatch(matches, source.matchId, [{ score1: 10, score2: 18 }]);
  assert.equal(corrected.find(match => match.id === next.id)!.status, 'scheduled');
  assert.equal(corrected.find(match => match.id === next.id)!.score1, undefined);
});

test('panorama includes all rounds and keeps opposite brackets on their side', () => {
  for (const count of [4, 5, 16, 32, 64, 128]) {
    const matches = generateBracket('test', teams(count)), layout = layoutBracket(matches);
    assert.equal(layout.positions.size, matches.length);
    for (const match of matches) {
      const position = layout.positions.get(match.id)!;
      if (match.stage === 'winners') assert.ok(position.x < layout.centerX);
      if (match.stage === 'losers') assert.ok(position.x > layout.centerX);
      assert.ok(position.y + CARD_HEIGHT <= layout.height);
    }
  }
});

test('legacy layouts preserve every destination and never overlap cards', () => {
  for (const count of [4, 5, 8, 16, 32, 64, 128]) {
    const original = generateBracket('test', teams(count));
    const expected = bracketEdges(original);
    const legacy = original.map(({ source1, source2, region, ...match }) => match);
    assert.deepEqual(bracketEdges(legacy).sort((a, b) => a.from.localeCompare(b.from) || a.outcome.localeCompare(b.outcome)),
      expected.sort((a, b) => a.from.localeCompare(b.from) || a.outcome.localeCompare(b.outcome)));
    for (const list of [original, legacy]) {
      const layout = layoutBracket(list), positions = [...layout.positions.values()];
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i];
        assert.ok(a.x >= 0 && a.y >= 0 && a.x + CARD_WIDTH <= layout.width && a.y + CARD_HEIGHT <= layout.height);
        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j];
          assert.ok(a.x + CARD_WIDTH <= b.x || b.x + CARD_WIDTH <= a.x || a.y + CARD_HEIGHT <= b.y || b.y + CARD_HEIGHT <= a.y,
            `Cards overlap for ${count} teams`);
        }
      }
    }
  }
});

test('standings use sets won, not aggregate points, and preserve placement after a semifinal loss', () => {
  let matches = generateBracket('test', teams(4));
  matches = changeMatchRules(matches, matches[0].id, PLAYOFF_RULES);
  matches = officializeMatch(matches, matches[0].id, [{ score1: 18, score2: 0 }, { score1: 16, score2: 18 }, { score1: 13, score2: 15 }]);
  const first = matches[0];
  assert.equal(first.winnerId, first.team2!.id);
  assert.ok(first.score1! > first.score2!);
  assert.equal(computeTournamentStandings(matches, teams(4)).find(row => row.pair.id === first.team2!.id)!.wins, 1);
  const completed = finish(generateBracket('test', teams(8)));
  const third = completed.find(match => match.stage === 'third_place')!;
  assert.equal(computeTournamentStandings(completed, teams(8)).find(row => row.pair.id === third.loserId)!.statusBadge, '4º Colocado');
});

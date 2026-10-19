import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPhaseLabel } from '../src/services/bracketPresentation';
import { generateBracket } from '../src/services/bracketGraph';
import { bracketEdges, layoutBracket } from '../src/services/bracketLayout';
import type { TeamPair } from '../src/types';

test('final phase labels do not depend on legacy placement titles', () => {
  assert.equal(matchPhaseLabel({ stage: 'grand_final', stageName: 'Disputa de 1º/2º' }), 'FINAL');
  assert.equal(matchPhaseLabel({ stage: 'semifinals', stageName: 'Semifinal A' }), 'SEMI FINAL');
  assert.equal(matchPhaseLabel({ stage: 'third_place', stageName: 'Disputa de 3º/4º' }), 'DISPUTA DE 3º');
  assert.equal(matchPhaseLabel({ stage: 'winners', stageName: 'Principal R2' }), 'Principal R2');
});
test('later rounds align vertically with the actual incoming branch without changing the draw', () => {
  const teams = Array.from({ length: 16 }, (_, index) => ({ id: 'team-' + index, tournamentId: 'visual-test', player1: 'A' + index, player2: 'B' + index, seed: index + 1 })) as TeamPair[];
  const matches = generateBracket('visual-test', teams);
  const snapshot = JSON.stringify(matches);
  const layout = layoutBracket(matches);
  const edges = bracketEdges(matches);
  const byId = new Map(matches.map(match => [match.id, match]));
  let checked = 0;
  for (const match of matches.filter(m => m.stage === 'winners' || m.stage === 'losers')) {
    const incoming = edges.filter(edge => edge.to === match.id && edge.outcome === 'winner' && byId.get(edge.from)?.stage === match.stage && byId.get(edge.from)?.region === match.region);
    if (!incoming.length) continue;
    const averageY = incoming.reduce((sum, edge) => sum + layout.positions.get(edge.from)!.y, 0) / incoming.length;
    assert.equal(layout.positions.get(match.id)!.y, averageY);
    checked++;
  }
  assert.ok(checked > 5);
  const final = matches.find(match => match.stage === 'grand_final')!;
  const third = matches.find(match => match.stage === 'third_place')!;
  const winners = matches.filter(match => match.stage === 'winners').sort((a, b) => b.round - a.round)[0];
  const losers = matches.filter(match => match.stage === 'losers').sort((a, b) => b.round - a.round)[0];
  assert.equal(layout.positions.get(final.id)!.x, layout.positions.get(winners.id)!.x);
  assert.equal(layout.positions.get(third.id)!.x, layout.positions.get(losers.id)!.x);
  assert.equal(JSON.stringify(matches), snapshot);
});

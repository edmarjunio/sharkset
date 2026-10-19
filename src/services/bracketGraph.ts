import type { BracketMatch, BracketSource, TeamPair } from '../types';
import { EARLY_RULES, PLAYOFF_RULES } from './tournamentRules';

type Feed = BracketSource | undefined;
interface Outputs { winner: Feed; loser: Feed }
export interface GraphOptions { thirdPlace?: boolean; maxTeams?: number; directSlots?: boolean }

export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const complement = order.length * 2 + 1;
    order = order.flatMap(seed => [seed, complement - seed]);
  }
  return order;
}

export function generateBracket(tournamentId: string, teams: TeamPair[], options: GraphOptions = {}): BracketMatch[] {
  if (teams.length < 4) throw new Error('São necessárias pelo menos 4 duplas presentes e confirmadas.');
  if (teams.length > (options.maxTeams ?? 1024)) throw new Error('Quantidade de duplas acima do limite configurado.');
  if (new Set(teams.map(team => team.id)).size !== teams.length) throw new Error('Uma dupla não pode ocupar duas vagas.');
  const athleteIds = teams.flatMap(team => [team.player1Id, team.player2Id].filter((id): id is string => Boolean(id)));
  if (new Set(athleteIds).size !== athleteIds.length) throw new Error('O mesmo atleta está inscrito em mais de uma vaga desta categoria.');
  const size = 2 ** Math.ceil(Math.log2(teams.length));
  const order = options.directSlots && teams.length === size ? teams.map((_, i) => i + 1) : seedOrder(size);
  const seeds: Feed[] = order.map((seed, slot) => teams[seed - 1] ? { kind: 'team', team: teams[seed - 1], slot: slot + 1 } : undefined);
  const matches: BracketMatch[] = [];
  const contractedNodes: NonNullable<BracketMatch['bracketStructure']>['contractedNodes'] = [];
  let scaffoldNumber = 0;
  function node(a: Feed, b: Feed, stage: BracketMatch['stage'], round: number, index: number, count: number): Outputs {
    scaffoldNumber++;
    // Contract structural BYEs without inventing an opponent, result or loser.
    const id = `${tournamentId}-J${String(scaffoldNumber).padStart(2, '0')}`;
    if (!a || !b) {
      contractedNodes.push({ id, stage, round, source1: a, source2: b });
      return { winner: a || b, loser: undefined };
    }
    const region = stage === 'winners' ? (index < count / 2 ? 'left_top' : 'left_bottom') :
      stage === 'losers' ? (index < count / 2 ? 'right_top' : 'right_bottom') : 'center';
    const labels = { winners: 'Principal', losers: 'Repescagem', semifinals: 'Semifinal', third_place: '3º lugar', grand_final: 'Final', super_final: 'Final' };
    matches.push({ id, tournamentId, nodeKey: `J${String(scaffoldNumber).padStart(2, '0')}`, matchNumber: matches.length + 1,
      stage, round, region, stageName: `${labels[stage]}${stage === 'winners' || stage === 'losers' ? ` R${round}` : ''}`,
      source1: a, source2: b, team1: a.kind === 'team' ? a.team : undefined, team2: b.kind === 'team' ? b.team : undefined,
      status: 'scheduled', revision: 0, rules: { ...(stage === 'winners' || stage === 'losers' ? EARLY_RULES : PLAYOFF_RULES) } });
    return { winner: { kind: 'winner', matchId: id }, loser: { kind: 'loser', matchId: id } };
  }
  let upper = Array.from({ length: size / 2 }, (_, i) => node(seeds[2 * i], seeds[2 * i + 1], 'winners', 1, i, size / 2));
  let lower: Feed[];
  if (size === 4) {
    lower = [upper[1].loser, upper[0].loser];
  } else {
    const firstLosers = upper.map(match => match.loser);
    upper = Array.from({ length: size / 4 }, (_, i) => node(upper[2 * i].winner, upper[2 * i + 1].winner, 'winners', 2, i, size / 4));
    const groupCount = firstLosers.length / 2;
    const groups = Array.from({ length: groupCount }, (_, i) => i);
    const crossed = [...groups.slice(groupCount / 2), ...groups.slice(0, groupCount / 2).reverse()];
    lower = crossed.map((group, i) => node(firstLosers[group * 2], firstLosers[group * 2 + 1], 'losers', 1, i, groupCount).winner);
    lower = lower.map((feed, i) => node(feed, upper[i].loser, 'losers', 2, i, groupCount).winner);
    let upperRound = 3, lowerRound = 3;
    while (upper.length > 2) {
      upper = Array.from({ length: upper.length / 2 }, (_, i) => node(upper[i * 2].winner, upper[i * 2 + 1].winner, 'winners', upperRound, i, upper.length / 2));
      lower = Array.from({ length: lower.length / 2 }, (_, i) => node(lower[i * 2], lower[i * 2 + 1], 'losers', lowerRound, i, lower.length / 2).winner);
      lower = lower.map((feed, i) => {
        const incoming = upper[upper.length - 1 - i].loser;
        return (i === lower.length - 1 ? node(incoming, feed, 'losers', lowerRound + 1, i, lower.length) :
          node(feed, incoming, 'losers', lowerRound + 1, i, lower.length)).winner;
      });
      upperRound++; lowerRound += 2;
    }
  }
  const semi1 = node(upper[0].winner, lower[0], 'semifinals', 1, 0, 2);
  const semi2 = node(upper[1].winner, lower[1], 'semifinals', 1, 1, 2);
  for (const match of matches.filter(match => match.stage === 'semifinals')) {
    match.initialLowerSource = match.source2;
    match.semifinalDecision = 'waiting';
    match.team1 = undefined; match.team2 = undefined;
  }
  if (options.thirdPlace !== false) node(semi1.loser, semi2.loser, 'third_place', 1, 0, 1);
  node(semi1.winner, semi2.winner, 'grand_final', 1, 0, 1);
  if (matches.length !== 2 * teams.length - (options.thirdPlace === false ? 3 : 2)) throw new Error('Falha de integridade na geração da tabela.');
  matches[0].bracketStructure = { version: 2, seededTeamIds: order.map(seed => teams[seed - 1]?.id || null), contractedNodes };
  validateGraph(matches);
  return linkDestinations(matches);
}

export function validateGraph(matches: BracketMatch[]): void {
  const seen = new Map<string, BracketMatch>();
  const consumed = new Set<string>();
  const seeds = new Set<string>();
  for (const match of matches) {
    if (seen.has(match.id)) throw new Error('Identidade de jogo duplicada.');
    for (const source of [match.source1, match.source2]) {
      if (!source) throw new Error('Partida real sem origem definida.');
      if (source.kind === 'team') {
        const key = `${match.tournamentId}:${source.team.id}`;
        if (seeds.has(key) || source.team.tournamentId !== match.tournamentId) throw new Error('Inscrição duplicada ou de outra categoria.');
        seeds.add(key);
      } else {
        const origin = seen.get(source.matchId);
        if (!origin || origin.tournamentId !== match.tournamentId) throw new Error('Origem inválida, fora de ordem ou com ciclo.');
        const key = `${source.matchId}:${source.kind}`;
        if (consumed.has(key)) throw new Error('Uma classificação alimenta mais de uma partida.');
        consumed.add(key);
      }
    }
    seen.set(match.id, match);
  }
}

export function linkDestinations(matches: BracketMatch[]): BracketMatch[] {
  const byId = new Map(matches.map(match => [match.id, match]));
  for (const match of matches) {
    delete match.nextMatchWinnerId; delete match.nextMatchLoserId;
    delete match.winnerDestinationSlot; delete match.loserDestinationSlot;
  }
  for (const match of matches) for (const [source, slot] of [[match.source1, 'team1'], [match.source2, 'team2']] as const) {
    if (!source || source.kind === 'team') continue;
    const from = byId.get(source.matchId);
    if (!from) throw new Error('Origem da partida não encontrada.');
    if (source.kind === 'winner') { from.nextMatchWinnerId = match.id; from.winnerDestinationSlot = slot; }
    else { from.nextMatchLoserId = match.id; from.loserDestinationSlot = slot; }
  }
  return matches;
}

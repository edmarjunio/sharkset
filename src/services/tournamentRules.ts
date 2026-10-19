import type { BracketMatch, MatchRules, MatchSet } from '../types';

export const EARLY_RULES: MatchRules = { bestOf: 1, targetPoints: 18, decidingPoints: 18, winBy: 2 };
export const PLAYOFF_RULES: MatchRules = { bestOf: 3, targetPoints: 18, decidingPoints: 15, winBy: 2 };

export function matchRules(match: BracketMatch): MatchRules {
  return match.rules || (['semifinals', 'third_place', 'grand_final'].includes(match.stage) ? PLAYOFF_RULES : EARLY_RULES);
}

export function formatMatchResult(match: BracketMatch): string {
  if (match.resultMode === 'walkover') return 'W.O.';
  if (match.status !== 'completed') return 'Aguardando';
  return match.sets?.map(set => `${set.score1} x ${set.score2}`).join(' / ') || `${match.score1 ?? '—'} x ${match.score2 ?? '—'}`;
}

export function validateRules(rules: MatchRules): void {
  if (![1, 3, 5].includes(rules.bestOf) ||
    ![rules.targetPoints, rules.decidingPoints, rules.winBy].every(value => Number.isInteger(value) && value > 0 && value <= 99)) {
    throw new Error('Informe regras válidas: melhor de 1, 3 ou 5; pontos e vantagem entre 1 e 99.');
  }
}

export function validateSet(set: MatchSet, target: number, winBy: number): 1 | 2 {
  const { score1, score2 } = set;
  if (![score1, score2].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Pontos devem ser inteiros e não negativos.');
  const high = Math.max(score1, score2), low = Math.min(score1, score2);
  if (score1 === score2 || high < target || high - low < winBy || (high > target && high - low !== winBy)) {
    throw new Error(`Set inválido: alvo ${target}, diferença ${winBy}. O placar deve terminar no primeiro ponto que decide o set.`);
  }
  return score1 > score2 ? 1 : 2;
}

export function validateMatchSets(sets: MatchSet[], rules: MatchRules) {
  validateRules(rules);
  if (!sets.length || sets.length > rules.bestOf) throw new Error('Informe todos os sets disputados.');
  let wins1 = 0, wins2 = 0;
  const needed = Math.ceil(rules.bestOf / 2);
  sets.forEach((set, index) => {
    if (wins1 >= needed || wins2 >= needed) throw new Error('Não pode existir set após a decisão da partida.');
    const target = rules.bestOf > 1 && index === rules.bestOf - 1 ? rules.decidingPoints : rules.targetPoints;
    if (validateSet(set, target, rules.winBy) === 1) wins1++; else wins2++;
  });
  if (Math.max(wins1, wins2) !== needed) throw new Error(`A partida exige ${needed} set(s) vencido(s).`);
  return { winningTeam: (wins1 > wins2 ? 1 : 2) as 1 | 2, wins1, wins2,
    score1: sets.reduce((sum, set) => sum + set.score1, 0), score2: sets.reduce((sum, set) => sum + set.score2, 0) };
}

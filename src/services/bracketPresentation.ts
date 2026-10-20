import type { BracketMatch } from '../types';

export function matchPhaseLabel(match: Pick<BracketMatch, 'stage' | 'stageName'>) {
  if (match.stage === 'semifinals') return 'SEMI FINAL';
  if (match.stage === 'grand_final' || match.stage === 'super_final') return 'FINAL';
  if (match.stage === 'third_place') return 'DISPUTA DE 3º';
  return match.stageName;
}

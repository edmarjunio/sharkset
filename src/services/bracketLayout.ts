import type { BracketMatch } from '../types';
export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 220;

export function bracketEdges(matches: BracketMatch[]) {
  const byId = new Map(matches.map(match => [match.id, match]));
  const edges = new Map<string, { from: string; to: string; outcome: 'winner' | 'loser'; slot: number }>();
  for (const target of matches) [target.source1, target.source2].forEach((source, slot) => {
    if (!source || source.kind === 'team' || !byId.has(source.matchId)) return;
    edges.set(`${source.matchId}:${source.kind}`, { from: source.matchId, to: target.id, outcome: source.kind, slot });
  });
  // Read legacy destinations without rewriting any saved result.
  for (const match of matches) for (const outcome of ['winner', 'loser'] as const) {
    const to = outcome === 'winner' ? match.nextMatchWinnerId : match.nextMatchLoserId;
    const slot = outcome === 'winner' ? match.winnerDestinationSlot : match.loserDestinationSlot;
    if (to && byId.has(to) && !edges.has(`${match.id}:${outcome}`)) {
      edges.set(`${match.id}:${outcome}`, { from: match.id, to, outcome, slot: slot === 'team2' ? 1 : 0 });
    }
  }
  return [...edges.values()];
}

export function layoutBracket(matches: BracketMatch[]) {
  const stepX = 380, stepY = 280, margin = 120;
  const upperRounds = Math.max(1, ...matches.filter(m => m.stage === 'winners').map(m => m.round));
  const lowerRounds = Math.max(1, ...matches.filter(m => m.stage === 'losers').map(m => m.round));
  const centerX = margin + upperRounds * stepX;
  const width = centerX + (lowerRounds + 1) * stepX + margin;
  const groups = new Map<string, BracketMatch[]>();
  for (const match of matches) {
    const key = `${match.stage}:${match.round}`;
    groups.set(key, [...(groups.get(key) || []), match]);
  }
  const regions = new Map<string, string>();
  for (const group of groups.values()) group.sort((a, b) => a.matchNumber - b.matchNumber).forEach((match, index) => {
    const side = match.stage === 'winners' ? 'left' : 'right';
    regions.set(match.id, match.region || `${side}_${index < group.length / 2 ? 'top' : 'bottom'}`);
  });
  const rows = new Map<string, BracketMatch[]>();
  for (const match of matches.filter(m => m.stage === 'winners' || m.stage === 'losers')) {
    const key = `${regions.get(match.id)}:${match.round}`;
    rows.set(key, [...(rows.get(key) || []), match]);
  }
  const halfHeight = Math.max(300, ...[...rows.values()].map(group => group.length * stepY));
  const middleGap = CARD_HEIGHT * 2 + 100;
  const height = margin * 2 + halfHeight * 2 + middleGap;
  const positions = new Map<string, { x: number; y: number }>();
  for (const group of rows.values()) group.forEach((match, index) => {
    const bottom = regions.get(match.id)!.endsWith('bottom');
    positions.set(match.id, {
      x: match.stage === 'winners' ? margin + (match.round - 1) * stepX : centerX + (lowerRounds - match.round + 1) * stepX,
      y: margin + (bottom ? halfHeight + middleGap : 0) + (index + .5) * halfHeight / group.length - CARD_HEIGHT / 2,
    });
  });
  matches.filter(m => m.stage === 'semifinals').forEach((match, i) => positions.set(match.id, {
    x: centerX, y: margin + halfHeight / 2 - CARD_HEIGHT / 2 + (i ? halfHeight + middleGap : 0),
  }));
  matches.filter(m => !positions.has(m.id)).forEach((match, i) => positions.set(match.id, {
    x: centerX, y: margin + halfHeight + 20 + i * (CARD_HEIGHT + 40),
  }));
  return { positions, width, height, centerX };
}

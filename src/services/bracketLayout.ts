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
      const occupied = new Set([...edges.values()].filter(edge => edge.to === to).map(edge => edge.slot));
      const targetSlot = slot ? (slot === 'team2' ? 1 : 0) : occupied.has(0) ? 1 : 0;
      edges.set(`${match.id}:${outcome}`, { from: match.id, to, outcome, slot: targetSlot });
    }
  }
  return [...edges.values()];
}

/** Slot origins for saved draws that predate typed sources, without changing results. */
export function bracketSlotOrigins(matches: BracketMatch[]) {
  const origins = new Map<string, { kind: 'winner' | 'loser'; matchId: string }>();
  for (const edge of bracketEdges(matches)) {
    origins.set(`${edge.to}:${edge.slot}`, { kind: edge.outcome, matchId: edge.from });
  }
  return origins;
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
  const middleGap = CARD_HEIGHT + 140;
  const height = margin * 2 + halfHeight * 2 + middleGap;
  const positions = new Map<string, { x: number; y: number }>();
  for (const group of rows.values()) group.sort((a, b) => a.matchNumber - b.matchNumber).forEach((match, index) => {
    const bottom = regions.get(match.id)!.endsWith('bottom');
    positions.set(match.id, {
      x: match.stage === 'winners' ? margin + (match.round - 1) * stepX : centerX + (lowerRounds - match.round + 1) * stepX,
      y: margin + (bottom ? halfHeight + middleGap : 0) + (index + .5) * halfHeight / group.length - CARD_HEIGHT / 2,
    });
  });
  matches.filter(m => m.stage === 'semifinals').sort((a, b) => a.matchNumber - b.matchNumber).forEach((match, i) => positions.set(match.id, {
    x: centerX, y: margin + halfHeight / 2 - CARD_HEIGHT / 2 + (i ? halfHeight + middleGap : 0),
  }));
  // Independent decisions share the middle band: Gold Final on the left, Top 5 Podium in the center, Bronze 3rd place on the right.
  matches.filter(m => !positions.has(m.id)).forEach((match) => positions.set(match.id, {
    x: centerX + (match.stage === 'third_place' ? 420 : -420),
    y: margin + halfHeight + (middleGap - CARD_HEIGHT) / 2,
  }));
  // Free space between the two decision cards (and their local lines) reserved for the Top 5 podium.
  const podiumWidth = 310;
  const podiumHeight = 270;
  const podium = {
    x: centerX - 15,
    y: margin + halfHeight + (middleGap - podiumHeight) / 2,
    width: podiumWidth,
    height: podiumHeight,
  };
  return { positions, width, height, centerX, podium };
}


import type { BracketAuditEntry, BracketMatch, BracketSource, MatchRules, MatchSet, TeamPair } from '../types';
import { linkDestinations } from './bracketGraph';
import { matchRules, validateMatchSets, validateRules } from './tournamentRules';

export interface EditContext { actor?: string; reason?: string; operationId?: string; now?: string }
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
const clone = (matches: BracketMatch[]) => structuredClone(matches);

function clearResult(match: BracketMatch) {
  delete match.score1; delete match.score2; delete match.winnerId; delete match.loserId;
  delete match.sets; delete match.resultMode; delete match.officialAt; delete match.liveReferee;
  match.status = 'scheduled';
}

function sourceTeam(source: BracketSource | undefined, byId: Map<string, BracketMatch>): TeamPair | undefined {
  if (!source) return undefined;
  if (source.kind === 'team') return source.team;
  const match = byId.get(source.matchId);
  if (!match || match.status !== 'completed') return undefined;
  const id = source.kind === 'winner' ? match.winnerId : match.loserId;
  return match.team1?.id === id ? match.team1 : match.team2?.id === id ? match.team2 : undefined;
}

function assignTeams(match: BracketMatch, team1?: TeamPair, team2?: TeamPair) {
  if (match.team1?.id !== team1?.id || match.team2?.id !== team2?.id) clearResult(match);
  match.team1 = team1; match.team2 = team2;
  if (team1 && team2 && team1.id === team2.id) throw new Error('Uma dupla não pode enfrentar a si mesma.');
}

export function resolveBracket(matches: BracketMatch[]): BracketMatch[] {
  const next = clone(matches);
  const byId = new Map(next.map(match => [match.id, match]));
  // Generation is topologically ordered, including contracted structural BYEs.
  for (const match of next.filter(match => match.stage === 'winners' || match.stage === 'losers')) {
    if (match.source1 && match.source2) assignTeams(match, sourceTeam(match.source1, byId), sourceTeam(match.source2, byId));
  }
  const tournamentIds = new Set(next.map(match => match.tournamentId));
  for (const tournamentId of tournamentIds) {
    const tournament = next.filter(match => match.tournamentId === tournamentId);
    const semis = tournament.filter(match => match.stage === 'semifinals');
    if (semis.length !== 2 || !semis.every(match => match.initialLowerSource)) continue;
    const [first, second] = semis;
    const a = sourceTeam(first.source1, byId), b = sourceTeam(second.source1, byId);
    const x = sourceTeam(first.initialLowerSource, byId), y = sourceTeam(second.initialLowerSource, byId);
    const ready = a && b && x && y && tournament.filter(match => match.stage === 'winners' || match.stage === 'losers').every(match => match.status === 'completed');
    if (!ready) {
      for (const match of semis) { assignTeams(match); match.semifinalDecision = 'waiting'; delete match.exceptionReason; delete match.exceptionFingerprint; }
      continue;
    }
    const played = new Set(tournament.filter(match => (match.stage === 'winners' || match.stage === 'losers') &&
      match.status === 'completed' && match.resultMode !== 'walkover' && match.team1 && match.team2)
      .map(match => pairKey(match.team1!.id, match.team2!.id)));
    const fixed = !played.has(pairKey(a.id, x.id)) && !played.has(pairKey(b.id, y.id));
    const swap = !played.has(pairKey(a.id, y.id)) && !played.has(pairKey(b.id, x.id));
    const fingerprint = JSON.stringify([a.id, b.id, x.id, y.id, [...played].sort()]);
    const exception = semis.every(match => match.exceptionReason && match.exceptionFingerprint === fingerprint);
    if (!exception) semis.forEach(match => { delete match.exceptionReason; delete match.exceptionFingerprint; });
    const decision = fixed ? 'fixed' : swap ? 'swap' : exception ? 'exception' : 'blocked';
    first.source2 = decision === 'swap' ? second.initialLowerSource : first.initialLowerSource;
    second.source2 = decision === 'swap' ? first.initialLowerSource : second.initialLowerSource;
    for (const match of semis) match.semifinalDecision = decision;
    if (decision === 'blocked') { assignTeams(first); assignTeams(second); }
    else { assignTeams(first, a, decision === 'swap' ? y : x); assignTeams(second, b, decision === 'swap' ? x : y); }
  }
  for (const match of next.filter(match => match.stage === 'grand_final' || match.stage === 'third_place')) {
    if (match.source1 && match.source2) assignTeams(match, sourceTeam(match.source1, byId), sourceTeam(match.source2, byId));
  }
  return linkDestinations(next);
}

function auditChange(before: BracketMatch[], after: BracketMatch[], id: string, action: string, context: EditContext) {
  const match = after.find(item => item.id === id)!;
  const previous = before.find(item => item.id === id)!;
  const beforeMap = new Map(before.map(item => [item.id, item]));
  const affected = after.filter(item => JSON.stringify(item) !== JSON.stringify(beforeMap.get(item.id))).map(item => item.id);
  const audit: BracketAuditEntry = { id: context.operationId || crypto.randomUUID(), at: context.now || new Date().toISOString(),
    actor: context.actor || 'Organizador local', reason: context.reason?.trim() || 'Operação da tabela', action,
    before: JSON.stringify(previous), affectedMatchIds: affected };
  // Avoid recursive audit snapshots growing exponentially.
  const { audit: ignored, ...previousState } = previous;
  audit.before = JSON.stringify(previousState);
  match.audit = [...(previous.audit || []), audit];
  for (const item of after) if (affected.includes(item.id)) item.revision = (beforeMap.get(item.id)?.revision || 0) + 1;
  return after;
}

export function officializeMatch(matches: BracketMatch[], id: string, sets: MatchSet[], context: EditContext = {}): BracketMatch[] {
  const current = matches.find(match => match.id === id);
  if (!current) throw new Error('Partida não encontrada.');
  if (context.operationId && current.audit?.some(event => event.id === context.operationId)) return matches;
  if (!current.team1 || !current.team2 || current.semifinalDecision === 'blocked' || current.semifinalDecision === 'waiting') throw new Error('Aguarde a definição dos participantes ou resolva o cruzamento da semifinal.');
  const result = validateMatchSets(sets, matchRules(current));
  if (current.status === 'completed' && JSON.stringify(current.sets) === JSON.stringify(sets) && current.resultMode === 'played') return matches;
  const next = clone(matches), match = next.find(item => item.id === id)!;
  Object.assign(match, { sets: structuredClone(sets), score1: result.score1, score2: result.score2,
    winnerId: result.winningTeam === 1 ? match.team1!.id : match.team2!.id,
    loserId: result.winningTeam === 1 ? match.team2!.id : match.team1!.id,
    resultMode: 'played', status: 'completed', officialAt: context.now || new Date().toISOString() });
  return auditChange(matches, resolveBracket(next), id, current.status === 'completed' ? 'result.corrected' : 'result.officialized', context);
}

export function resetBracketMatch(matches: BracketMatch[], id: string, context: EditContext = {}): BracketMatch[] {
  const next = clone(matches), match = next.find(item => item.id === id);
  if (!match) throw new Error('Partida não encontrada.');
  clearResult(match);
  return auditChange(matches, resolveBracket(next), id, 'result.reset', context);
}

export function allowSemifinalException(matches: BracketMatch[], tournamentId: string, reason: string, context: EditContext = {}): BracketMatch[] {
  if (reason.trim().length < 5) throw new Error('Descreva o motivo da exceção de revanche (mínimo 5 caracteres).');
  const next = clone(matches), semis = next.filter(match => match.tournamentId === tournamentId && match.stage === 'semifinals');
  if (semis.length !== 2 || !semis.every(match => match.semifinalDecision === 'blocked')) throw new Error('Não existe cruzamento bloqueado para resolver.');
  const byId = new Map(next.map(match => [match.id, match]));
  const entrants = [semis[0].source1, semis[1].source1, semis[0].initialLowerSource, semis[1].initialLowerSource].map(source => sourceTeam(source, byId)?.id);
  const played = new Set(next.filter(match => match.tournamentId === tournamentId && ['winners', 'losers'].includes(match.stage) && match.status === 'completed' && match.resultMode !== 'walkover' && match.team1 && match.team2).map(match => pairKey(match.team1!.id, match.team2!.id)));
  const fingerprint = JSON.stringify([...entrants, [...played].sort()]);
  semis.forEach(match => { match.exceptionReason = reason.trim(); match.exceptionFingerprint = fingerprint; });
  return auditChange(matches, resolveBracket(next), semis[0].id, 'semifinal.exception', { ...context, reason });
}

export function changeMatchRules(matches: BracketMatch[], id: string, rules: MatchRules, context: EditContext = {}): BracketMatch[] {
  validateRules(rules);
  const next = clone(matches), match = next.find(item => item.id === id);
  if (!match) throw new Error('Partida não encontrada.');
  if (match.sets) {
    try { validateMatchSets(match.sets, rules); } catch { clearResult(match); }
  }
  match.rules = { ...rules };
  return auditChange(matches, resolveBracket(next), id, 'rules.changed', context);
}

export function declareWalkover(matches: BracketMatch[], id: string, winner: 1 | 2, reason: string, context: EditContext = {}): BracketMatch[] {
  if (reason.trim().length < 5) throw new Error('Informe o motivo do W.O.');
  const next = clone(matches), match = next.find(item => item.id === id);
  if (!match?.team1 || !match.team2 || ![1, 2].includes(winner)) throw new Error('Defina os dois participantes antes de registrar W.O.');
  if (context.operationId && match.audit?.some(event => event.id === context.operationId)) return matches;
  if (match.status === 'completed' && match.resultMode === 'walkover' && match.winnerId === (winner === 1 ? match.team1.id : match.team2.id)) return matches;
  clearResult(match);
  match.winnerId = winner === 1 ? match.team1.id : match.team2.id;
  match.loserId = winner === 1 ? match.team2.id : match.team1.id;
  match.status = 'completed'; match.resultMode = 'walkover'; match.officialAt = context.now || new Date().toISOString();
  return auditChange(matches, resolveBracket(next), id, 'result.walkover', { ...context, reason });
}

export function editMatchDetails(matches: BracketMatch[], id: string, updates: { team1?: TeamPair; team2?: TeamPair; courtName?: string; scheduledTime?: string }, context: EditContext = {}): BracketMatch[] {
  let next = clone(matches);
  const current = matches.find(match => match.id === id);
  if (!current) throw new Error('Partida não encontrada.');
  if (updates.team1 && updates.team2 && updates.team1.id === updates.team2.id) throw new Error('Selecione duas duplas diferentes.');
  const swaps: Array<[TeamPair, TeamPair]> = [];
  // Swapping registered teams changes their positions throughout the graph, never creates a duplicate qualifier.
  for (const slot of ['team1', 'team2'] as const) {
    if (!(slot in updates)) continue;
    const replacement = updates[slot], original = current[slot];
    const existing = swaps.reduce((team, [from, to]) => team?.id === from.id ? to : team?.id === to.id ? from : team, original);
    if (!replacement || !existing) {
      if (replacement?.id !== existing?.id) throw new Error('Para adicionar ou retirar vagas, edite as inscrições e gere uma nova versão da tabela.');
      continue;
    }
    if (replacement.tournamentId !== current.tournamentId) throw new Error('A dupla deve pertencer à mesma categoria.');
    const registered = matches.some(match => [match.source1, match.source2].some(source => source?.kind === 'team' && source.team.id === replacement.id));
    if (!registered) throw new Error('Essa dupla ainda não participa da chave. Atualize as inscrições e gere uma nova versão.');
    if (replacement.id === existing.id) continue;
    swaps.push([existing, replacement]);
    const replace = (source?: BracketSource): BracketSource | undefined => {
      if (source?.kind !== 'team') return source;
      if (source.team.id === existing.id) return { ...source, team: replacement };
      if (source.team.id === replacement.id) return { ...source, team: existing };
      return source;
    };
    next.forEach(match => {
      if (match.tournamentId !== current.tournamentId) return;
      match.source1 = replace(match.source1); match.source2 = replace(match.source2);
      match.initialLowerSource = replace(match.initialLowerSource);
    });
  }
  next = resolveBracket(next);
  const match = next.find(item => item.id === id)!;
  if (updates.courtName !== undefined) match.courtName = updates.courtName;
  if (updates.scheduledTime !== undefined) match.scheduledTime = updates.scheduledTime;
  return auditChange(matches, next, id, 'match.edited', context);
}

export function editRegisteredTeam(matches: BracketMatch[], team: TeamPair, context: EditContext = {}): BracketMatch[] {
  if (!team.player1.trim() || !team.player2.trim()) throw new Error('Informe os dois nomes da dupla.');
  const next = clone(matches);
  let firstId: string | undefined;
  for (const match of next) {
    if (match.tournamentId !== team.tournamentId) continue;
    for (const slot of ['source1', 'source2', 'initialLowerSource'] as const) {
      const source = match[slot];
      if (source?.kind === 'team' && source.team.id === team.id) { source.team = team; firstId ||= match.id; }
    }
  }
  if (!firstId) throw new Error('Dupla não encontrada nesta tabela.');
  return auditChange(matches, resolveBracket(next), firstId, 'team.edited', context);
}

export function correctionImpact(before: BracketMatch[], after: BracketMatch[]) {
  const previous = new Map(before.map(match => [match.id, match]));
  return after.filter(match => {
    const old = previous.get(match.id);
    return old && (old.status !== 'scheduled' && match.status === 'scheduled' || old.team1?.id !== match.team1?.id || old.team2?.id !== match.team2?.id);
  });
}

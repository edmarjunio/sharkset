import type { BracketMatch, MatchRules } from '../types';
import { validateRules, validateSet } from './tournamentRules';

export interface ScoreboardState {
  score1: number;
  score2: number;
  sets1?: number;
  sets2?: number;
  bestOf?: 1 | 3 | 5;
  elapsedSeconds?: number;
  clockStartedAt?: number | null;
  stageName?: string;
  stage?: string;
  targetPoints?: number;
  decidingPoints?: number;
  winBy?: number;
  setHistory?: Array<[number, number]>;
}
export type ScoreboardCommand =
  | { type: 'point'; team: 1 | 2; delta: 1 | -1; autoClose?: boolean }
  | { type: 'close_set' }
  | { type: 'format'; bestOf: 1 | 3 }
  | { type: 'clock_toggle' }
  | { type: 'clock_reset' }
  | { type: 'undo' };

export function elapsedTime(state: ScoreboardState, now = Date.now()) {
  return Math.max(0, state.elapsedSeconds || 0) +
    (state.clockStartedAt != null ? Math.max(0, Math.floor((now - state.clockStartedAt) / 1000)) : 0);
}

export function isSemiOrFinalStage(stage = '') {
  const text = stage.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(semifinals|grand_final)$/.test(text) || /\bsemi[ -]?fina(?:l|is)\b/.test(text) ||
    /^(?:grande[ -])?final(?:\s|$)/.test(text) || /^disputa (?:de |do )?1[ºo°]?\b/.test(text);
}

export function scoreboardRules(state: ScoreboardState): MatchRules {
  const bestOf = isSemiOrFinalStage(state.stage || state.stageName) ? 3 : state.bestOf || 1;
  return { bestOf, targetPoints: state.targetPoints || 18, decidingPoints: state.decidingPoints || 15, winBy: state.winBy || 2 };
}

export function scoreboardWinner(state: ScoreboardState): 1 | 2 | null {
  const needed = Math.ceil(scoreboardRules(state).bestOf / 2);
  return (state.sets1 || 0) >= needed ? 1 : (state.sets2 || 0) >= needed ? 2 : null;
}

export function restoreScoreSnapshot(state: ScoreboardState, before: ScoreboardState): ScoreboardState {
  return { ...state, score1: before.score1, score2: before.score2, sets1: before.sets1 || 0, sets2: before.sets2 || 0,
    bestOf: before.bestOf || 1, setHistory: before.setHistory || [] };
}

export function currentSetTarget(state: ScoreboardState) {
  const rules = scoreboardRules(state);
  return (state.setHistory?.length || 0) === rules.bestOf - 1 && rules.bestOf > 1 ? rules.decidingPoints : rules.targetPoints;
}

export function currentSetWinner(state: ScoreboardState): 1 | 2 | null {
  if (scoreboardWinner(state)) return null;
  try { return validateSet(state, currentSetTarget(state), scoreboardRules(state).winBy); }
  catch { return null; }
}

/** One scorer for the operator and the server. Counts always agree with archived partials. */
export function validateScoreboard(state: ScoreboardState) {
  const rules = scoreboardRules(state);
  validateRules(rules);
  if (![state.score1, state.score2, state.sets1 ?? 0, state.sets2 ?? 0, state.elapsedSeconds ?? 0]
    .every(value => Number.isSafeInteger(value) && value >= 0 && value <= 86400)) throw new Error('Placar ou tempo inválido.');
  if (state.clockStartedAt != null && (!Number.isSafeInteger(state.clockStartedAt) || state.clockStartedAt < 0)) throw new Error('Cronômetro inválido.');
  if (!Array.isArray(state.setHistory || []) || (state.setHistory?.length || 0) > rules.bestOf) throw new Error('Histórico de sets inválido.');
  let a = 0, b = 0;
  const needed = Math.ceil(rules.bestOf / 2);
  for (const [index, set] of (state.setHistory || []).entries()) {
    if (!Array.isArray(set) || set.length !== 2 || a >= needed || b >= needed) throw new Error('Não pode haver sets após a decisão da partida.');
    const target = rules.bestOf > 1 && index === rules.bestOf - 1 ? rules.decidingPoints : rules.targetPoints;
    if (validateSet({ score1: set[0], score2: set[1] }, target, rules.winBy) === 1) a++; else b++;
  }
  if (a !== (state.sets1 || 0) || b !== (state.sets2 || 0)) throw new Error('Os sets vencidos precisam corresponder às parciais registradas.');
  const high = Math.max(state.score1, state.score2), low = Math.min(state.score1, state.score2);
  if (scoreboardWinner(state)) {
    const last = state.setHistory?.at(-1);
    if (!last || state.score1 !== last[0] || state.score2 !== last[1]) throw new Error('O placar final precisa preservar a última parcial.');
  } else if (high > currentSetTarget(state) && high - low > rules.winBy) {
    throw new Error('O set já deveria ter sido encerrado. Corrija os pontos.');
  }
}

export function applyScoreboardCommand(input: ScoreboardState, command: Exclude<ScoreboardCommand, { type: 'undo' }>, now = Date.now()): ScoreboardState {
  const state: ScoreboardState = { ...input, bestOf: scoreboardRules(input).bestOf, setHistory: [...(input.setHistory || [])] };
  validateScoreboard(state);
  if (command.type === 'clock_reset') return { ...state, elapsedSeconds: 0, clockStartedAt: null };
  if (command.type === 'clock_toggle') {
    if (scoreboardWinner(state)) throw new Error('A partida já terminou.');
    return state.clockStartedAt != null ? { ...state, elapsedSeconds: elapsedTime(state, now), clockStartedAt: null } : { ...state, clockStartedAt: now };
  }
  if (command.type === 'format') {
    if (![1, 3].includes(command.bestOf)) throw new Error('Escolha 1 set ou melhor de 3.');
    if (state.score1 || state.score2 || state.setHistory!.length) throw new Error('Defina o formato antes do primeiro ponto.');
    if (isSemiOrFinalStage(state.stage || state.stageName) && command.bestOf !== 3) throw new Error('Semifinal e final usam melhor de 3.');
    return { ...state, bestOf: command.bestOf };
  }
  if (scoreboardWinner(state)) throw new Error('Partida encerrada. Desfaça a última ação para corrigir.');
  if (command.type === 'close_set') {
    const winner = currentSetWinner(state);
    if (!winner) throw new Error(`Set ainda aberto: alvo ${currentSetTarget(state)} com ${scoreboardRules(state).winBy} pontos de vantagem.`);
    const next = { ...state, setHistory: [...state.setHistory!, [state.score1, state.score2] as [number, number]],
      sets1: (state.sets1 || 0) + (winner === 1 ? 1 : 0), sets2: (state.sets2 || 0) + (winner === 2 ? 1 : 0) };
    return scoreboardWinner(next) ? { ...next, elapsedSeconds: elapsedTime(state, now), clockStartedAt: null } : { ...next, score1: 0, score2: 0 };
  }
  if (command.type !== 'point' || ![1, 2].includes(command.team) || ![1, -1].includes(command.delta)) throw new Error('Comando de placar inválido.');
  if (command.delta === 1 && currentSetWinner(state)) throw new Error('Feche o set atual antes de marcar outro ponto.');
  const key = command.team === 1 ? 'score1' : 'score2';
  if (command.delta === -1 && state[key] === 0) throw new Error('A pontuação já está em zero.');
  const next = { ...state, [key]: state[key] + command.delta };
  return command.autoClose && currentSetWinner(next) ? applyScoreboardCommand(next, { type: 'close_set' }, now) : next;
}

export function matchScoreboard(match: BracketMatch): ScoreboardState {
  const completed = match.status === 'completed';
  if (!completed && match.broadcastScoreboard) return { ...match.broadcastScoreboard, stage: match.stage, stageName: match.stageName };
  const history = completed ? (match.sets || []).map(set => [set.score1, set.score2] as [number, number]) : [];
  const last = history.at(-1);
  return { score1: completed ? last?.[0] || 0 : match.score1 || 0, score2: completed ? last?.[1] || 0 : match.score2 || 0,
    sets1: history.filter(([a, b]) => a > b).length, sets2: history.filter(([a, b]) => b > a).length,
    setHistory: history, stage: match.stage, stageName: match.stageName, ...match.rules,
    bestOf: isSemiOrFinalStage(match.stage) ? 3 : match.rules?.bestOf || (match.stage === 'third_place' ? 3 : 1) };
}

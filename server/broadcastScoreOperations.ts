import { applyScoreboardCommand, restoreScoreSnapshot, validateScoreboard, type ScoreboardCommand, type ScoreboardState } from '../src/services/broadcastScoreboard';

export interface ScoreUndo { id: string; before: ScoreboardState }
export function parseScoreCommand(value: unknown): ScoreboardCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID');
  const command = value as Record<string, unknown>;
  const fields: Record<string, string[]> = { point: ['type', 'team', 'delta', 'autoClose'], close_set: ['type'], format: ['type', 'bestOf'], clock_toggle: ['type'], clock_reset: ['type'], undo: ['type'] };
  const allowed = fields[String(command.type)];
  if (!allowed || Object.keys(command).some(key => !allowed.includes(key)) ||
    (command.type === 'point' && (![1, 2].includes(Number(command.team)) || typeof command.team !== 'number' || ![1, -1].includes(Number(command.delta)) || typeof command.delta !== 'number' || ('autoClose' in command && typeof command.autoClose !== 'boolean'))) ||
    (command.type === 'format' && command.bestOf !== 1 && command.bestOf !== 3)) throw new Error('INVALID');
  return command as unknown as ScoreboardCommand;
}

export function broadcastScoreState(data: Record<string, any>): ScoreboardState {
  const result: ScoreboardState = { score1: data.score1 ?? 0, score2: data.score2 ?? 0, sets1: data.sets1 ?? 0, sets2: data.sets2 ?? 0,
    bestOf: data.bestOf ?? 1, elapsedSeconds: data.elapsedSeconds ?? 0, clockStartedAt: data.clockStartedAt ?? null, setHistory: data.setHistory ?? [] };
  for (const key of ['stage', 'stageName', 'targetPoints', 'decidingPoints', 'winBy'] as const) if (data[key] !== undefined) (result as any)[key] = data[key];
  return result;
}

export function applyBroadcastScoreOperation(state: ScoreboardState, command: ScoreboardCommand, history: ScoreUndo[], id: string, now = Date.now()) {
  if (command.type === 'undo') {
    const last = history.at(-1);
    if (!last) throw new Error('Nenhuma ação disponível para desfazer.');
    const next = restoreScoreSnapshot(state, last.before);
    validateScoreboard(next);
    return { next, history: history.slice(0, -1), reversalOf: last.id };
  }
  const next = applyScoreboardCommand(state, command, now);
  return { next, history: command.type === 'point' || command.type === 'close_set' ? [...history.slice(-99), { id, before: state }] : history, reversalOf: null };
}

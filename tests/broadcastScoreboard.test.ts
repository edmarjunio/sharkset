import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { BroadcastOverlay } from '../src/components/BroadcastOverlay';
import { applyScoreboardCommand as apply, currentSetTarget, currentSetWinner, elapsedTime, isSemiOrFinalStage, matchScoreboard, scoreboardRules, scoreboardWinner, type ScoreboardState } from '../src/services/broadcastScoreboard';
import { applyBroadcastScoreOperation, parseScoreCommand } from '../server/broadcastScoreOperations';
import { registerBroadcastRoutes } from '../server/broadcasts';
import type { BracketMatch } from '../src/types';

const empty = (patch: Partial<ScoreboardState> = {}): ScoreboardState => ({ score1: 0, score2: 0, sets1: 0, sets2: 0, bestOf: 1, setHistory: [], elapsedSeconds: 0, clockStartedAt: null, ...patch });
const point = (team: 1 | 2, autoClose = false) => ({ type: 'point' as const, team, delta: 1 as const, autoClose });
const close = (state: ScoreboardState, score1: number, score2: number) => apply({ ...state, score1, score2 }, { type: 'close_set' });

test('semifinal/final detection never mistakes quarterfinals or qualifying rounds', () => {
  for (const stage of ['semifinals', 'grand_final', 'Semifinal', 'Semifinais', 'Semi-final 1', 'Final', 'Grande Final']) assert.equal(isSemiOrFinalStage(stage), true, stage);
  for (const stage of ['Quartas de final', 'Oitavas de final', 'Fase de Grupos', 'Jogo Livre', 'qualifying', 'winners', 'losers']) assert.equal(isSemiOrFinalStage(stage), false, stage);
  assert.equal(scoreboardRules(empty({ stage: 'semifinals', bestOf: 1 })).bestOf, 3);
});

test('sets close at the first winning point, never tied or short of target/advantage', () => {
  for (const [score1, score2] of [[0, 0], [12, 10], [18, 17], [19, 16]]) assert.throws(() => close(empty(), score1, score2));
  assert.equal(currentSetWinner(empty({ score1: 18, score2: 16 })), 1);
  assert.equal(currentSetWinner(empty({ score1: 20, score2: 18 })), 1);
  assert.throws(() => apply(empty({ score1: 18, score2: 16 }), point(1)), /Feche/);
  assert.equal(apply(empty({ score1: 18, score2: 16 }), { type: 'point', team: 1, delta: -1 }).score1, 17);
});

test('MD3 archives partials, resets only between sets, uses 15 in the third and stops after two wins', () => {
  let state = close(empty({ stage: 'semifinals' }), 18, 15);
  assert.deepEqual([state.score1, state.score2, state.sets1, state.sets2], [0, 0, 1, 0]);
  state = close(state, 14, 18);
  assert.equal(currentSetTarget(state), 15);
  state = close(state, 16, 14);
  assert.deepEqual(state.setHistory, [[18, 15], [14, 18], [16, 14]]);
  assert.equal(scoreboardWinner(state), 1);
  assert.equal(state.score1, 16);
  assert.throws(() => apply(state, point(2)), /encerrada/);
  assert.throws(() => apply(state, { type: 'close_set' }), /encerrada/);
});

test('straight sets require no third set; single set preserves the final score and pauses the clock', () => {
  const straight = close(close(empty({ bestOf: 3 }), 18, 0), 18, 0);
  assert.equal(straight.setHistory?.length, 2);
  assert.equal(scoreboardWinner(straight), 1);
  const single = apply(empty({ score1: 17, score2: 16, clockStartedAt: 1_000 }), point(1, true), 6_000);
  assert.deepEqual([single.score1, single.score2, single.sets1, single.clockStartedAt, single.elapsedSeconds], [18, 16, 1, null, 5]);
});

test('undo compensates the whole point, including an automatic set transition, without rewinding the clock', () => {
  const before = empty({ bestOf: 3, score1: 17, score2: 16 });
  const scored = applyBroadcastScoreOperation(before, point(1, true), [], 'point-id', 1000);
  assert.deepEqual([scored.next.score1, scored.next.sets1], [0, 1]);
  const undone = applyBroadcastScoreOperation({ ...scored.next, elapsedSeconds: 25 }, { type: 'undo' }, scored.history, 'undo-id');
  assert.deepEqual([undone.next.score1, undone.next.score2, undone.next.sets1], [17, 16, 0]);
  assert.equal(undone.reversalOf, 'point-id');
  assert.equal(undone.next.elapsedSeconds, 25);
  assert.throws(() => applyBroadcastScoreOperation(undone.next, { type: 'undo' }, undone.history, 'undo-empty'));
});

test('format cannot discard a running match or defeat automatic MD3, and points never go negative', () => {
  assert.throws(() => apply(empty({ score1: 1 }), { type: 'format', bestOf: 3 }));
  assert.throws(() => apply(empty({ stage: 'grand_final' }), { type: 'format', bestOf: 1 }));
  assert.throws(() => apply(empty(), { type: 'point', team: 2, delta: -1 }));
  assert.equal(apply(empty(), { type: 'format', bestOf: 3 }).bestOf, 3);
  for (const command of [{ type: 'point', team: '1', delta: 1 }, { type: 'point', team: 1, delta: 4 }, { type: 'point', team: 1, delta: 1, score1: 40 }, { type: 'format', bestOf: 5 }]) assert.throws(() => parseScoreCommand(command));
});

test('clock pause/resume is anchored to timestamps and reset works while paused', () => {
  let state = apply(empty(), { type: 'clock_toggle' }, 1000);
  assert.equal(elapsedTime(state, 4500), 3);
  state = apply(state, { type: 'clock_toggle' }, 4500);
  assert.equal(elapsedTime(state, 9000), 3);
  state = apply(state, { type: 'clock_toggle' }, 10000);
  assert.equal(elapsedTime(state, 15000), 8);
  assert.equal(elapsedTime(apply(state, { type: 'clock_reset' }), 90000), 0);
});

test('spectator markup has no operator buttons and finished matches show the last set instead of summed points', () => {
  const match = { status: 'completed', stage: 'grand_final', stageName: 'Final', sets: [{ score1: 18, score2: 16 }, { score1: 14, score2: 18 }, { score1: 15, score2: 13 }], score1: 47, score2: 47 } as BracketMatch;
  const state = matchScoreboard(match);
  assert.deepEqual([state.score1, state.score2, state.sets1, state.sets2], [15, 13, 2, 1]);
  const html = renderToStaticMarkup(React.createElement(BroadcastOverlay, { state, compact: true }));
  assert.ok(!html.includes('<button'));
  assert.ok(html.includes('ENCERRADO') && html.includes('18–16'));
});

function memoryStore(initial: Record<string, unknown>) {
  const data = new Map<string, any>([['broadcasts/live-one', structuredClone(initial)]]);
  const reference = (path: string): any => ({ path, collection: (name: string) => ({ doc: (id: string) => reference(`${path}/${name}/${id}`) }) });
  let chain = Promise.resolve();
  const db = { collection: (name: string) => ({ doc: (id: string) => reference(`${name}/${id}`) }), runTransaction: (callback: any) => {
    const operation = chain.then(async () => {
      const writes: Array<() => void> = [];
      const result = await callback({ get: async (ref: any) => ({ exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) }),
        update: (ref: any, value: any) => writes.push(() => data.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) })),
        set: (ref: any, value: any) => writes.push(() => data.set(ref.path, structuredClone(value))),
        create: (ref: any, value: any) => { if (data.has(ref.path)) throw Error('duplicate'); writes.push(() => data.set(ref.path, structuredClone(value))); } });
      writes.forEach(write => write()); return result;
    }); chain = operation.catch(() => {}); return operation;
  } };
  return { data, db };
}

test('server scoring checks owner/revision, deduplicates retries, records compensating undo and rejects raw score edits', async () => {
  const storage = memoryStore({ ...empty(), ownerId: 'owner', revision: 0, team1: 'A', team2: 'B', isLive: false, videoUrl: '', rankingEligible: false });
  const handlers = new Map<string, Function>();
  const app = { get: (path: string, handler: Function) => handlers.set('GET ' + path, handler), post: (path: string, handler: Function) => handlers.set('POST ' + path, handler), patch: (path: string, handler: Function) => handlers.set('PATCH ' + path, handler) };
  registerBroadcastRoutes(app as any, () => storage.db as any, async req => ({ uid: req.headers['x-test-user'] || 'owner' }) as any);
  const send = async (body: unknown, user = 'owner', method = 'POST') => {
    let status = 200, data: any;
    const response: any = { status: (value: number) => { status = value; return response; }, json: (value: any) => { data = value; return response; } };
    await handlers.get(method + ' /api/broadcasts/:id' + (method === 'POST' ? '/scoreboard' : ''))!({ params: { id: 'live-one' }, headers: { 'x-test-user': user }, body }, response);
    return { status, data };
  };
  try {
    const command = { revision: 0, operationId: 'point-operation-00001', command: point(1) };
    assert.equal((await send(command, 'other')).status, 403);
    const responses = await Promise.all([send(command), send(command)]);
    assert.deepEqual(responses.map(item => item.status), [200, 200]);
    assert.equal(storage.data.get('broadcasts/live-one').score1, 1);
    assert.equal([...storage.data.keys()].filter(key => key.includes('/score_events/')).length, 1);
    assert.equal((await send({ ...command, operationId: 'stale-operation-0002' })).status, 409);
    assert.equal((await send({ revision: 1, score1: 99 }, 'owner', 'PATCH')).status, 400);
    assert.equal((await send({ revision: 1, operationId: 'undo-operation-00001', command: { type: 'undo' } })).status, 200);
    assert.equal(storage.data.get('broadcasts/live-one').score1, 0);
    assert.equal(storage.data.get('broadcasts/live-one/score_events/undo-operation-00001').reversalOf, command.operationId);
    assert.equal(storage.data.get('broadcasts/live-one').rankingEligible, false);
    assert.equal((await send({ revision: 2, stage: 'semifinals', stageName: 'Semifinal', bestOf: 1 }, 'owner', 'PATCH')).status, 200);
    assert.equal(storage.data.get('broadcasts/live-one').bestOf, 3);
  } finally {}
});

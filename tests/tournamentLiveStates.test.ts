import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Express } from 'express';
import { createServer } from 'node:http';
import { isValidLiveRefereeState, registerTournamentLiveStateRoutes } from '../server/tournamentLiveStates';

const validState = {
  refereeName: 'Árbitro', targetPoints: 18, servingTeam: 1, serverRotationIndex: 0,
  serviceOrderLabels: ['A', 'B', 'C', 'D'], serviceOrderTeams: [1, 2, 1, 2],
  firstServers: { team1: 0, team2: 0 }, team1TimeoutsUsed: 0, team2TimeoutsUsed: 0,
  maxTimeoutsPerTeam: 1, activeTimeout: null, courtSwapsCount: 0, currentSidesSwapped: false,
  startedAt: '2026-10-22T12:00:00.000Z', updatedAt: '2026-10-22T12:00:00.000Z',
  pointHistory: [], timeoutHistory: [], cardsHistory: [],
};

test('live referee validator rejects oversized histories and unknown fields', () => {
  assert.equal(isValidLiveRefereeState(validState), true);
  assert.equal(isValidLiveRefereeState({ ...validState, pointHistory: Array(301).fill({}) }), false);
  assert.equal(isValidLiveRefereeState({ ...validState, internalToken: 'secret' }), false);
});

function createTestApi({ permitted = true } = {}) {
  const app = express();
  app.use(express.json());
  let match: Record<string, unknown> = { id: 'm-1', tournamentId: 't-1', status: 'in_progress', liveStateRevision: 0 };
  const values: Record<string, Record<string, unknown>> = {
    'tournaments/t-1': { id: 't-1', tenantId: 'a-1', ownerId: 'owner' },
    'arenas/a-1': { ownerId: 'owner' },
    'arena_members/a-1/users/referee': { role: permitted ? 'referee' : 'viewer' },
  };
  const reference = (path: string) => ({ path, collection: (child: string) => ({
    doc: (id: string) => reference(`${path}/${child}/${id}`),
  }) });
  const database = {
    collection: (name: string) => ({ doc: (id: string) => reference(`${name}/${id}`) }),
    runTransaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      get: async (ref: { path: string }) => {
        const data = ref.path === 'tournaments/t-1/matches/m-1' ? match : values[ref.path];
        return { exists: Boolean(data), data: () => data };
      },
      update: (ref: { path: string }, update: Record<string, unknown>) => {
        if (ref.path === 'tournaments/t-1/matches/m-1') match = { ...match, ...update };
      },
    }),
  };
  registerTournamentLiveStateRoutes(app as Express, () => database as any, async () => ({
    uid: 'referee', email: 'referee@example.com', email_verified: true,
  } as any));
  const server = createServer(app);
  return { server, getMatch: () => match };
}

test('live referee endpoint writes authorized states idempotently and rejects stale revisions', async () => {
  const { server, getMatch } = createTestApi();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/tournaments/t-1/matches/m-1/live-state`;
  try {
    const send = (expectedRevision: number) => fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision, liveReferee: validState }),
    });
    const first = await send(0);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { revision: 1 });
    assert.equal(getMatch().liveStateRevision, 1);

    const retry = await send(1);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), { revision: 1 });

    const stale = await send(0);
    assert.equal(stale.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('live referee endpoint rejects users without tournament referee access', async () => {
  const { server } = createTestApi({ permitted: false });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/tournaments/t-1/matches/m-1/live-state`;
  try {
    const response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0, liveReferee: validState }),
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

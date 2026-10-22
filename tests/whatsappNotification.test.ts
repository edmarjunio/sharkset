import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { normalizePhoneNumber, registerWhatsAppRoutes } from '../server/whatsapp';
import { extractDistinctRecipients } from '../src/services/whatsappNotificationService';
import { TeamPair } from '../src/types';

test('normalizePhoneNumber formats Brazilian numbers and validates E.164 without plus', () => {
  // 11 digits Brazilian cellphone (DDD 64 + 9 digits) -> prepends 55
  assert.equal(normalizePhoneNumber('(64) 99999-1234'), '5564999991234');

  // 10 digits Brazilian landline (DDD 11 + 8 digits) -> prepends 55
  assert.equal(normalizePhoneNumber('11 3456-7890'), '551134567890');

  // Already with DDI 55
  assert.equal(normalizePhoneNumber('+55 (64) 99999-1234'), '5564999991234');
  assert.equal(normalizePhoneNumber('5564999991234'), '5564999991234');

  // Valid international (e.g. US 10 digits + 1 DDI = 11 digits)
  assert.equal(normalizePhoneNumber('+1 (415) 555-2671'), '14155552671');

  // Invalid formats (too short, letters only, empty)
  assert.equal(normalizePhoneNumber('123'), null);
  assert.equal(normalizePhoneNumber(''), null);
  assert.equal(normalizePhoneNumber('abc-none'), null);
});

test('extractDistinctRecipients collects unique athlete phone numbers and names', () => {
  const pairs: TeamPair[] = [
    {
      id: 'pair-1',
      tournamentId: 't-1',
      player1: 'Atleta Alfa',
      player1Level: 'iniciante',
      player1Phone: '(64) 99999-1111',
      player2: 'Atleta Beta',
      player2Level: 'iniciante',
      player2Phone: '(64) 99999-2222',
      phone: '(64) 99999-1111', // duplicate of player1
      category: 'iniciante',
      seed: 1,
      isPaid: true,
      registeredAt: '2026-10-20',
    },
    {
      id: 'pair-2',
      tournamentId: 't-1',
      player1: 'Atleta Gama',
      player1Level: 'serie_c',
      player1Phone: '64999993333',
      player2: 'Individual (1x1)', // Single modality should not create individual recipient for player 2
      player2Level: 'serie_c',
      phone: '64999993333',
      category: 'serie_c',
      seed: 2,
      isPaid: true,
      registeredAt: '2026-10-20',
    },
  ];

  const recipients = extractDistinctRecipients(pairs);

  assert.equal(recipients.length, 3);
  assert.deepEqual(recipients.map((r) => r.phone), [
    '64999991111',
    '64999992222',
    '64999993333',
  ]);
  assert.equal(recipients[0].name, 'Atleta Alfa');
  assert.equal(recipients[1].name, 'Atleta Beta');
  assert.equal(recipients[2].name, 'Atleta Gama');
});

test('WhatsApp server reports automatic messaging unavailable without sending messages', async () => {
  const app = express();
  app.use(express.json());
  registerWhatsAppRoutes(app);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Status endpoint
    const statusRes = await fetch(`${baseUrl}/api/notifications/whatsapp/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(typeof statusData.configured, 'boolean');

    assert.equal(statusData.available, false);

    // Arbitrary recipients provided by clients are never dispatched.
    const tournStartRes = await fetch(`${baseUrl}/api/notifications/whatsapp/tournament-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: 'tourn-mock-123',
        tournamentName: 'Torneio Teste Mineiros',
        arenaName: 'Arena Central',
        pairsCount: 8,
        recipients: [
          { name: 'Gabriel', phone: '(64) 99999-8888' },
          { name: 'Rodrigo', phone: '(64) 98888-7777' },
        ],
      }),
    });

    assert.equal(tournStartRes.status, 503);
    const tournStartData = await tournStartRes.json();
    assert.equal(tournStartData.ok, false);
    assert.equal(tournStartData.available, false);

    // 4. Match result alert
    const matchRes = await fetch(`${baseUrl}/api/notifications/whatsapp/match-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: 'tourn-mock-123',
        tournamentName: 'Torneio Teste Mineiros',
        matchNumber: 1,
        stageName: '1ª Rodada',
        winnerName: 'Gabriel & Rodrigo',
        loserName: 'Carlos & Eduardo',
        scoreSummary: '18 x 14',
        recipients: [
          { name: 'Gabriel & Rodrigo', phone: '(64) 99999-8888' },
          { name: 'Carlos & Eduardo', phone: '(64) 97777-6666' },
        ],
      }),
    });

    assert.equal(matchRes.status, 503);
    const matchData = await matchRes.json();
    assert.equal(matchData.ok, false);
    assert.equal(matchData.available, false);
  } finally {
    server.close();
  }
});

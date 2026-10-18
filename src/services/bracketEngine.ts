import {
  BracketMatch,
  RefereeMatchState,
  SemiFormat,
  TeamPair,
  TournamentStandingRow,
} from '../types';
import { calculateFutevoleiMatchPoints } from './rankingValidator';

/**
 * Builds the default Referee Console state for a match (4-player service rotation, timeouts, court swaps).
 */
export function buildDefaultRefereeState(
  match: BracketMatch,
  refereeName: string = 'Árbitro Oficial SHARK SET'
): RefereeMatchState {
  const t1p1 = match.team1?.player1 || 'Atleta 1 (Dupla A)';
  const t1p2 =
    match.team1?.player2 && match.team1.player2.toLowerCase() !== 'individual (1x1)'
      ? match.team1.player2
      : t1p1;
  const t2p1 = match.team2?.player1 || 'Atleta 1 (Dupla B)';
  const t2p2 =
    match.team2?.player2 && match.team2.player2.toLowerCase() !== 'individual (1x1)'
      ? match.team2.player2
      : t2p1;

  const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    refereeName,
    targetPoints: 18,
    servingTeam: 1,
    serverRotationIndex: 0,
    serviceOrderLabels: [
      `1º Sacador: ${t1p1} (Dupla 1)`,
      `2º Sacador: ${t2p1} (Dupla 2)`,
      `3º Sacador: ${t1p2} (Dupla 1)`,
      `4º Sacador: ${t2p2} (Dupla 2)`,
    ],
    team1TimeoutsUsed: 0,
    team2TimeoutsUsed: 0,
    maxTimeoutsPerTeam: 1,
    activeTimeout: null,
    courtSwapsCount: 0,
    currentSidesSwapped: false,
    startedAt: nowStr,
    updatedAt: nowStr,
    pointHistory: [],
    timeoutHistory: [],
  };
}

/**
 * Cria chave enxuta de 4 duplas quando o torneio inicia com até 4 duplas presentes.
 */
export function createFourPairsBracket(
  tournamentId: string,
  orderedPairs: (TeamPair | undefined)[],
  semiFormat: SemiFormat = 'semi_direta'
): BracketMatch[] {
  const getPair = (idx: number) => orderedPairs[idx];

  if (semiFormat === 'semi_direta') {
    const matches: BracketMatch[] = [
      {
        id: `${tournamentId}-m1`,
        tournamentId,
        matchNumber: 1,
        stage: 'semifinals',
        round: 1,
        stageName: 'Semifinal Direta 1 - Jogo 1',
        team1: getPair(0),
        team2: getPair(3),
        status: 'scheduled',
        scheduledTime: '09:00',
        courtName: 'Quadra 1 - Central SHARK SET',
        nextMatchWinnerId: `${tournamentId}-m3`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m4`,
        loserDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m2`,
        tournamentId,
        matchNumber: 2,
        stage: 'semifinals',
        round: 1,
        stageName: 'Semifinal Direta 2 - Jogo 2',
        team1: getPair(1),
        team2: getPair(2),
        status: 'scheduled',
        scheduledTime: '09:45',
        courtName: 'Quadra 2 - SHARK SET Palmeiras',
        nextMatchWinnerId: `${tournamentId}-m3`,
        winnerDestinationSlot: 'team2',
        nextMatchLoserId: `${tournamentId}-m4`,
        loserDestinationSlot: 'team2',
      },
      {
        id: `${tournamentId}-m4`,
        tournamentId,
        matchNumber: 3,
        stage: 'third_place',
        round: 2,
        stageName: 'Disputa de 3º Lugar - Jogo 3',
        status: 'scheduled',
        scheduledTime: '10:45',
        courtName: 'Quadra 2 - SHARK SET Palmeiras',
      },
      {
        id: `${tournamentId}-m3`,
        tournamentId,
        matchNumber: 4,
        stage: 'grand_final',
        round: 2,
        stageName: 'Grande Final - Jogo 4',
        status: 'scheduled',
        scheduledTime: '11:30',
        courtName: 'Quadra 1 - Central SHARK SET',
      },
    ];
    return autoAdvanceByesInRound1(matches);
  }

  // 4 duplas com Repescagem (Dupla Eliminatória)
  const matches: BracketMatch[] = [
    {
      id: `${tournamentId}-m1`,
      tournamentId,
      matchNumber: 1,
      stage: 'winners',
      round: 1,
      stageName: 'Rodada 1 Principal - Jogo 1',
      team1: getPair(0),
      team2: getPair(3),
      status: 'scheduled',
      scheduledTime: '09:00',
      courtName: 'Quadra 1 - Central SHARK SET',
      nextMatchWinnerId: `${tournamentId}-m3`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m2`,
      loserDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m2-w`,
      tournamentId,
      matchNumber: 2,
      stage: 'winners',
      round: 1,
      stageName: 'Rodada 1 Principal - Jogo 2',
      team1: getPair(1),
      team2: getPair(2),
      status: 'scheduled',
      scheduledTime: '09:45',
      courtName: 'Quadra 2 - SHARK SET Palmeiras',
      nextMatchWinnerId: `${tournamentId}-m3`,
      winnerDestinationSlot: 'team2',
      nextMatchLoserId: `${tournamentId}-m2`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m2`,
      tournamentId,
      matchNumber: 3,
      stage: 'losers',
      round: 1,
      stageName: 'Repescagem R1 - Jogo 3',
      status: 'scheduled',
      scheduledTime: '10:30',
      courtName: 'Quadra 2 - SHARK SET Palmeiras',
      nextMatchWinnerId: `${tournamentId}-m4`,
      winnerDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m3`,
      tournamentId,
      matchNumber: 4,
      stage: 'winners',
      round: 2,
      stageName: 'Final dos Vencedores - Jogo 4',
      status: 'scheduled',
      scheduledTime: '11:15',
      courtName: 'Quadra 1 - Central SHARK SET',
      nextMatchWinnerId: `${tournamentId}-m5`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m4`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m4`,
      tournamentId,
      matchNumber: 5,
      stage: 'losers',
      round: 2,
      stageName: 'Final da Repescagem - Jogo 5',
      status: 'scheduled',
      scheduledTime: '12:00',
      courtName: 'Quadra 1 - Central SHARK SET',
      nextMatchWinnerId: `${tournamentId}-m5`,
      winnerDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m5`,
      tournamentId,
      matchNumber: 6,
      stage: 'grand_final',
      round: 3,
      stageName: 'Grande Final - Jogo 6',
      status: 'scheduled',
      scheduledTime: '13:00',
      courtName: 'Quadra 1 - Central SHARK SET',
    },
  ];
  return autoAdvanceByesInRound1(matches);
}

/**
 * Se uma partida da Rodada 1 tiver apenas 1 dupla (BYE por número ímpar de duplas presentes),
 * avança automaticamente a dupla presente para a fase seguinte sem precisar lançar placar.
 */
export function autoAdvanceByesInRound1(matches: BracketMatch[]): BracketMatch[] {
  const updated = matches.map((m) => ({ ...m }));
  const round1Matches = updated.filter((m) => m.round === 1 && (m.stage === 'winners' || m.stage === 'semifinals'));

  for (const m of round1Matches) {
    const hasT1 = !!m.team1;
    const hasT2 = !!m.team2;
    if ((hasT1 && !hasT2) || (!hasT1 && hasT2)) {
      const winner = hasT1 ? m.team1! : m.team2!;
      m.score1 = hasT1 ? 18 : 0;
      m.score2 = hasT2 ? 18 : 0;
      m.winnerId = winner.id;
      m.status = 'completed';

      if (m.nextMatchWinnerId) {
        const nextMatch = updated.find((nx) => nx.id === m.nextMatchWinnerId);
        if (nextMatch) {
          if (m.winnerDestinationSlot === 'team1') nextMatch.team1 = winner;
          else if (m.winnerDestinationSlot === 'team2') nextMatch.team2 = winner;
          else if (!nextMatch.team1) nextMatch.team1 = winner;
          else nextMatch.team2 = winner;
        }
      }
    }
  }

  return updated;
}

/**
 * Gera a chave de acordo com as duplas presentes no torneio, permitindo:
 * - 'random': Sorteio Aleatório
 * - 'manual': Posicionamento manual escolhido pelo organizador
 * - 'seeded': Ordem de cabeças de chave (Seed)
 */
export function createBracketForPresentPairs(
  tournamentId: string,
  presentPairs: TeamPair[],
  semiFormat: SemiFormat = 'semi_direta',
  drawMode: 'seeded' | 'random' | 'manual' = 'seeded',
  manualSlotPairIds?: (string | '')[]
): BracketMatch[] {
  const activePairs = presentPairs.filter((p) => p.enrollmentStatus !== 'rejected' && p.isPresent !== false);

  let orderedSlots: (TeamPair | undefined)[] = [];

  if (drawMode === 'manual' && manualSlotPairIds && manualSlotPairIds.length > 0) {
    orderedSlots = manualSlotPairIds.map((id) => activePairs.find((p) => p.id === id));
  } else if (drawMode === 'random') {
    const shuffled = [...activePairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    orderedSlots = shuffled.map((p, idx) => ({ ...p, seed: idx + 1 }));
  } else {
    orderedSlots = [...activePairs].sort((a, b) => a.seed - b.seed);
  }

  const slotCount = manualSlotPairIds ? manualSlotPairIds.length : activePairs.length;

  if (slotCount <= 4) {
    return createFourPairsBracket(tournamentId, orderedSlots, semiFormat);
  }

  const baseMatches = createBuraco4BracketWithSlots(tournamentId, orderedSlots, semiFormat);
  return autoAdvanceByesInRound1(baseMatches);
}

/**
 * Cria a chave de Eliminatória Dupla (até 8 duplas) suportando os dois formatos:
 * 1. 'semi_direta' (Padrão Futevôlei): Repescagem vai até definir os 2 classificados do Buraco.
 *    Na Semifinal (2 invictos vs 2 da repescagem), é mata-mata direto (ninguém pode perder mais).
 * 2. 'semi_com_chance' (Padrão Challonge hs5f5865): Quem está na chave dos vencedores ainda
 *    pode perder na semifinal ou final dos vencedores e cair para a repescagem.
 */
export function createBuraco4Bracket(
  tournamentId: string,
  registeredPairs: TeamPair[],
  semiFormat: SemiFormat = 'semi_direta'
): BracketMatch[] {
  const active = registeredPairs
    .filter((p) => p.enrollmentStatus !== 'rejected' && p.isPresent !== false)
    .sort((a, b) => a.seed - b.seed);

  if (active.length > 0 && active.length <= 4) {
    return createFourPairsBracket(tournamentId, active, semiFormat);
  }

  return autoAdvanceByesInRound1(createBuraco4BracketWithSlots(tournamentId, active, semiFormat));
}

function createBuraco4BracketWithSlots(
  tournamentId: string,
  slots: (TeamPair | undefined)[],
  semiFormat: SemiFormat = 'semi_direta'
): BracketMatch[] {
  const getPair = (index: number) => slots[index];

  if (semiFormat === 'semi_direta') {
    return [
      // RODADA 1: CHAVE PRINCIPAL (QUARTAS)
      {
        id: `${tournamentId}-m1`,
        tournamentId,
        matchNumber: 1,
        stage: 'winners',
        round: 1,
        stageName: 'R1 Principal - Jogo 1',
        team1: getPair(0),
        team2: getPair(7),
        status: 'scheduled',
        scheduledTime: '08:30',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m7`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m5`,
        loserDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m2`,
        tournamentId,
        matchNumber: 2,
        stage: 'winners',
        round: 1,
        stageName: 'R1 Principal - Jogo 2',
        team1: getPair(3),
        team2: getPair(4),
        status: 'scheduled',
        scheduledTime: '09:15',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m7`,
        winnerDestinationSlot: 'team2',
        nextMatchLoserId: `${tournamentId}-m5`,
        loserDestinationSlot: 'team2',
      },
      {
        id: `${tournamentId}-m3`,
        tournamentId,
        matchNumber: 3,
        stage: 'winners',
        round: 1,
        stageName: 'R1 Principal - Jogo 3',
        team1: getPair(2),
        team2: getPair(5),
        status: 'scheduled',
        scheduledTime: '10:00',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m8`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m6`,
        loserDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m4`,
        tournamentId,
        matchNumber: 4,
        stage: 'winners',
        round: 1,
        stageName: 'R1 Principal - Jogo 4',
        team1: getPair(1),
        team2: getPair(6),
        status: 'scheduled',
        scheduledTime: '10:45',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m8`,
        winnerDestinationSlot: 'team2',
        nextMatchLoserId: `${tournamentId}-m6`,
        loserDestinationSlot: 'team2',
      },

      // RODADA 2 PRINCIPAL: VALE VAGA DIRETA NA SEMIFINAL
      {
        id: `${tournamentId}-m7`,
        tournamentId,
        matchNumber: 7,
        stage: 'winners',
        round: 2,
        stageName: 'Qualificatória Vencedores - J7',
        status: 'scheduled',
        scheduledTime: '12:45',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m11`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m10`,
        loserDestinationSlot: 'team2',
      },
      {
        id: `${tournamentId}-m8`,
        tournamentId,
        matchNumber: 8,
        stage: 'winners',
        round: 2,
        stageName: 'Qualificatória Vencedores - J8',
        status: 'scheduled',
        scheduledTime: '13:30',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m12`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m9`,
        loserDestinationSlot: 'team2',
      },

      // REPESCAGEM / BURACO 4 (RODADA 1 E 2 DOS PERDEDORES)
      {
        id: `${tournamentId}-m5`,
        tournamentId,
        matchNumber: 5,
        stage: 'losers',
        round: 1,
        stageName: 'Buraco R1 (Repescagem) - J5',
        status: 'scheduled',
        scheduledTime: '11:30',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m9`,
        winnerDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m6`,
        tournamentId,
        matchNumber: 6,
        stage: 'losers',
        round: 1,
        stageName: 'Buraco R1 (Repescagem) - J6',
        status: 'scheduled',
        scheduledTime: '12:00',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m10`,
        winnerDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m9`,
        tournamentId,
        matchNumber: 9,
        stage: 'losers',
        round: 2,
        stageName: 'Buraco R2 (Vale Vaga na Semi) - J9',
        status: 'scheduled',
        scheduledTime: '14:15',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m11`,
        winnerDestinationSlot: 'team2',
      },
      {
        id: `${tournamentId}-m10`,
        tournamentId,
        matchNumber: 10,
        stage: 'losers',
        round: 2,
        stageName: 'Buraco R2 (Vale Vaga na Semi) - J10',
        status: 'scheduled',
        scheduledTime: '15:00',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m12`,
        winnerDestinationSlot: 'team2',
      },

      // SEMIFINAIS DIRETAS (MATA-MATA PURO: VENCEU VAI PRA FINAL · PERDEU VAI PRA DISPUTA DE 3º LUGAR)
      {
        id: `${tournamentId}-m11`,
        tournamentId,
        matchNumber: 11,
        stage: 'semifinals',
        round: 3,
        stageName: 'Semifinal Direta 1 (Mata-Mata) - J11',
        status: 'scheduled',
        scheduledTime: '16:00',
        courtName: 'Quadra 1 - Central',
        nextMatchWinnerId: `${tournamentId}-m13`,
        winnerDestinationSlot: 'team1',
        nextMatchLoserId: `${tournamentId}-m3rd`,
        loserDestinationSlot: 'team1',
      },
      {
        id: `${tournamentId}-m12`,
        tournamentId,
        matchNumber: 12,
        stage: 'semifinals',
        round: 3,
        stageName: 'Semifinal Direta 2 (Mata-Mata) - J12',
        status: 'scheduled',
        scheduledTime: '16:45',
        courtName: 'Quadra 2',
        nextMatchWinnerId: `${tournamentId}-m13`,
        winnerDestinationSlot: 'team2',
        nextMatchLoserId: `${tournamentId}-m3rd`,
        loserDestinationSlot: 'team2',
      },

      // DISPUTA DE 3º LUGAR
      {
        id: `${tournamentId}-m3rd`,
        tournamentId,
        matchNumber: 13,
        stage: 'third_place',
        round: 4,
        stageName: 'Disputa de 3º Lugar - J13',
        status: 'scheduled',
        scheduledTime: '17:30',
        courtName: 'Quadra 2',
      },

      // GRANDE FINAL
      {
        id: `${tournamentId}-m13`,
        tournamentId,
        matchNumber: 14,
        stage: 'grand_final',
        round: 4,
        stageName: 'Grande Final - J14',
        status: 'scheduled',
        scheduledTime: '18:15',
        courtName: 'Quadra 1 - Central',
      },
    ];
  }

  // MODO 2: SEMI COM CHANCE (PADRÃO CHALLONGE hs5f5865 COMPLETO)
  return [
    {
      id: `${tournamentId}-m1`,
      tournamentId,
      matchNumber: 1,
      stage: 'winners',
      round: 1,
      stageName: 'Quartas Vencedores - J1',
      team1: getPair(0),
      team2: getPair(7),
      status: 'scheduled',
      scheduledTime: '08:30',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m7`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m5`,
      loserDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m2`,
      tournamentId,
      matchNumber: 2,
      stage: 'winners',
      round: 1,
      stageName: 'Quartas Vencedores - J2',
      team1: getPair(3),
      team2: getPair(4),
      status: 'scheduled',
      scheduledTime: '09:15',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m7`,
      winnerDestinationSlot: 'team2',
      nextMatchLoserId: `${tournamentId}-m5`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m3`,
      tournamentId,
      matchNumber: 3,
      stage: 'winners',
      round: 1,
      stageName: 'Quartas Vencedores - J3',
      team1: getPair(2),
      team2: getPair(5),
      status: 'scheduled',
      scheduledTime: '10:00',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m8`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m6`,
      loserDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m4`,
      tournamentId,
      matchNumber: 4,
      stage: 'winners',
      round: 1,
      stageName: 'Quartas Vencedores - J4',
      team1: getPair(1),
      team2: getPair(6),
      status: 'scheduled',
      scheduledTime: '10:45',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m8`,
      winnerDestinationSlot: 'team2',
      nextMatchLoserId: `${tournamentId}-m6`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m7`,
      tournamentId,
      matchNumber: 7,
      stage: 'winners',
      round: 2,
      stageName: 'Semifinal Vencedores (Com Chance) - J7',
      status: 'scheduled',
      scheduledTime: '13:00',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m11`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m10`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m8`,
      tournamentId,
      matchNumber: 8,
      stage: 'winners',
      round: 2,
      stageName: 'Semifinal Vencedores (Com Chance) - J8',
      status: 'scheduled',
      scheduledTime: '13:45',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m11`,
      winnerDestinationSlot: 'team2',
      nextMatchLoserId: `${tournamentId}-m9`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m11`,
      tournamentId,
      matchNumber: 11,
      stage: 'winners',
      round: 3,
      stageName: 'Final dos Vencedores - J11',
      status: 'scheduled',
      scheduledTime: '16:00',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m14`,
      winnerDestinationSlot: 'team1',
      nextMatchLoserId: `${tournamentId}-m13`,
      loserDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m5`,
      tournamentId,
      matchNumber: 5,
      stage: 'losers',
      round: 1,
      stageName: 'Repescagem R1 - J5',
      status: 'scheduled',
      scheduledTime: '11:30',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m9`,
      winnerDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m6`,
      tournamentId,
      matchNumber: 6,
      stage: 'losers',
      round: 1,
      stageName: 'Repescagem R1 - J6',
      status: 'scheduled',
      scheduledTime: '12:15',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m10`,
      winnerDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m9`,
      tournamentId,
      matchNumber: 9,
      stage: 'losers',
      round: 2,
      stageName: 'Repescagem R2 (Recebe Perdedor Semi) - J9',
      status: 'scheduled',
      scheduledTime: '14:30',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m12`,
      winnerDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m10`,
      tournamentId,
      matchNumber: 10,
      stage: 'losers',
      round: 2,
      stageName: 'Repescagem R2 (Recebe Perdedor Semi) - J10',
      status: 'scheduled',
      scheduledTime: '15:15',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m12`,
      winnerDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m12`,
      tournamentId,
      matchNumber: 12,
      stage: 'losers',
      round: 3,
      stageName: 'Semifinal da Repescagem - J12',
      status: 'scheduled',
      scheduledTime: '16:45',
      courtName: 'Quadra 2',
      nextMatchWinnerId: `${tournamentId}-m13`,
      winnerDestinationSlot: 'team1',
    },
    {
      id: `${tournamentId}-m13`,
      tournamentId,
      matchNumber: 13,
      stage: 'losers',
      round: 4,
      stageName: 'Final da Repescagem - J13',
      status: 'scheduled',
      scheduledTime: '17:30',
      courtName: 'Quadra 1 - Central',
      nextMatchWinnerId: `${tournamentId}-m14`,
      winnerDestinationSlot: 'team2',
    },
    {
      id: `${tournamentId}-m14`,
      tournamentId,
      matchNumber: 14,
      stage: 'grand_final',
      round: 5,
      stageName: 'Grande Final - J14',
      status: 'scheduled',
      scheduledTime: '18:30',
      courtName: 'Quadra 1 - Central',
    },
  ];
}

/**
 * Avança o vencedor de uma partida e posiciona o perdedor na chave de repescagem assim que o resultado é confirmado.
 */
export function advanceWinner(
  matches: BracketMatch[],
  matchId: string,
  winningTeam: 1 | 2,
  score1: number,
  score2: number
): BracketMatch[] {
  const updated = matches.map((m) => ({ ...m }));
  const matchIndex = updated.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return matches;

  const current = updated[matchIndex];
  if (!current.team1 || !current.team2) return matches;

  const winner = winningTeam === 1 ? current.team1 : current.team2;
  const loser = winningTeam === 1 ? current.team2 : current.team1;

  current.score1 = score1;
  current.score2 = score2;
  current.winnerId = winner.id;
  current.loserId = loser.id;
  current.status = 'completed';

  // 1. Move WINNER to next match deterministically
  if (current.nextMatchWinnerId) {
    const nextWinnerMatch = updated.find((m) => m.id === current.nextMatchWinnerId);
    if (nextWinnerMatch) {
      if (current.winnerDestinationSlot === 'team1') {
        nextWinnerMatch.team1 = winner;
      } else if (current.winnerDestinationSlot === 'team2') {
        nextWinnerMatch.team2 = winner;
      } else {
        if (!nextWinnerMatch.team1 || nextWinnerMatch.team1.id === winner.id) {
          nextWinnerMatch.team1 = winner;
        } else {
          nextWinnerMatch.team2 = winner;
        }
      }
    }
  }

  // 2. Move LOSER to Buraco / Repescagem slot deterministically (if applicable)
  if (current.nextMatchLoserId) {
    const nextLoserMatch = updated.find((m) => m.id === current.nextMatchLoserId);
    if (nextLoserMatch) {
      if (current.loserDestinationSlot === 'team1') {
        nextLoserMatch.team1 = loser;
      } else if (current.loserDestinationSlot === 'team2') {
        nextLoserMatch.team2 = loser;
      } else {
        if (!nextLoserMatch.team1 || nextLoserMatch.team1.id === loser.id) {
          nextLoserMatch.team1 = loser;
        } else {
          nextLoserMatch.team2 = loser;
        }
      }
    }
  }

  return updated;
}

/**
 * Reseta o resultado de uma partida para permitir correção livre ("nada congelado")
 */
export function resetMatch(matches: BracketMatch[], matchId: string): BracketMatch[] {
  const updated = matches.map((m) => ({ ...m }));
  const matchIndex = updated.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return matches;

  const current = updated[matchIndex];
  const previousWinnerId = current.winnerId;
  const previousLoserId = current.loserId;

  current.score1 = undefined;
  current.score2 = undefined;
  current.winnerId = undefined;
  current.loserId = undefined;
  current.status = 'scheduled';

  if (current.nextMatchWinnerId && previousWinnerId) {
    const nextWinnerMatch = updated.find((m) => m.id === current.nextMatchWinnerId);
    if (nextWinnerMatch) {
      if (nextWinnerMatch.team1?.id === previousWinnerId) nextWinnerMatch.team1 = undefined;
      if (nextWinnerMatch.team2?.id === previousWinnerId) nextWinnerMatch.team2 = undefined;
    }
  }

  if (current.nextMatchLoserId && previousLoserId) {
    const nextLoserMatch = updated.find((m) => m.id === current.nextMatchLoserId);
    if (nextLoserMatch) {
      if (nextLoserMatch.team1?.id === previousLoserId) nextLoserMatch.team1 = undefined;
      if (nextLoserMatch.team2?.id === previousLoserId) nextLoserMatch.team2 = undefined;
    }
  }

  return updated;
}

/**
 * Permite edição manual livre de duplas, quadra e horário em qualquer confronto ("nada congelado")
 */
export function overrideMatchDetails(
  matches: BracketMatch[],
  matchId: string,
  updates: {
    team1?: TeamPair;
    team2?: TeamPair;
    courtName?: string;
    scheduledTime?: string;
  }
): BracketMatch[] {
  return matches.map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        ...updates,
      };
    }
    return m;
  });
}

/**
 * Extrai o pódio final do campeonato (1º, 2º e 3º colocados)
 */
export function getPodium(matches: BracketMatch[]): {
  champion?: TeamPair;
  runnerUp?: TeamPair;
  thirdPlace?: TeamPair;
} {
  const grandFinal = matches.find((m) => m.stage === 'grand_final');
  if (!grandFinal || grandFinal.status !== 'completed' || !grandFinal.winnerId) {
    return {};
  }

  const champion = grandFinal.winnerId === grandFinal.team1?.id ? grandFinal.team1 : grandFinal.team2;
  const runnerUp = grandFinal.winnerId === grandFinal.team1?.id ? grandFinal.team2 : grandFinal.team1;

  const thirdPlaceMatch = matches.find(
    (m) => (m.stage === 'third_place' || m.stageName.toLowerCase().includes('3º lugar')) && m.status === 'completed'
  );

  let thirdPlace: TeamPair | undefined;
  if (thirdPlaceMatch && thirdPlaceMatch.winnerId) {
    thirdPlace =
      thirdPlaceMatch.winnerId === thirdPlaceMatch.team1?.id
        ? thirdPlaceMatch.team1
        : thirdPlaceMatch.team2;
  } else {
    const semiOrRepescagem =
      matches.find((m) => m.stage === 'semifinals' && m.status === 'completed') ||
      matches.find((m) => m.matchNumber === 13 && m.stage === 'losers' && m.status === 'completed');

    if (semiOrRepescagem && semiOrRepescagem.loserId) {
      thirdPlace =
        semiOrRepescagem.loserId === semiOrRepescagem.team1?.id
          ? semiOrRepescagem.team1
          : semiOrRepescagem.team2;
    }
  }

  return { champion, runnerUp, thirdPlace };
}

/**
 * Gera automaticamente a Tabela de Classificação Geral do Torneio a partir dos resultados dos jogos
 */
export function computeTournamentStandings(
  matches: BracketMatch[],
  registeredPairs: TeamPair[]
): TournamentStandingRow[] {
  const podium = getPodium(matches);
  const completedMatches = matches.filter(
    (m) => m.status === 'completed' && m.team1 && m.team2 && m.score1 !== undefined && m.score2 !== undefined
  );

  const statsMap: Record<
    string,
    {
      pair: TeamPair;
      matchesPlayed: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      rankingPointsEarned: number;
    }
  > = {};

  registeredPairs
    .filter((p) => p.enrollmentStatus !== 'rejected')
    .forEach((p) => {
      statsMap[p.id] = {
        pair: p,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    });

  completedMatches.forEach((m) => {
    const t1 = m.team1!;
    const t2 = m.team2!;
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;

    if (!statsMap[t1.id]) {
      statsMap[t1.id] = {
        pair: t1,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    }
    if (!statsMap[t2.id]) {
      statsMap[t2.id] = {
        pair: t2,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingPointsEarned: 0,
      };
    }

    const t1Won = m.winnerId === t1.id || s1 > s2;
    const winnerTeam = t1Won ? t1 : t2;
    const loserTeam = t1Won ? t2 : t1;
    const winScore = t1Won ? s1 : s2;
    const loseScore = t1Won ? s2 : s1;

    const ptsCalc = calculateFutevoleiMatchPoints({
      winnerLevels: [winnerTeam.player1Level, winnerTeam.player2Level],
      loserLevels: [loserTeam.player1Level, loserTeam.player2Level],
      winnerScore: winScore,
      loserScore: loseScore,
      stage: m.stage,
    });

    statsMap[t1.id].matchesPlayed += 1;
    statsMap[t1.id].pointsFor += s1;
    statsMap[t1.id].pointsAgainst += s2;

    statsMap[t2.id].matchesPlayed += 1;
    statsMap[t2.id].pointsFor += s2;
    statsMap[t2.id].pointsAgainst += s1;

    if (t1Won) {
      statsMap[t1.id].wins += 1;
      statsMap[t1.id].rankingPointsEarned += ptsCalc.winnerPoints;
      statsMap[t2.id].losses += 1;
      statsMap[t2.id].rankingPointsEarned += ptsCalc.loserPoints;
    } else {
      statsMap[t2.id].wins += 1;
      statsMap[t2.id].rankingPointsEarned += ptsCalc.winnerPoints;
      statsMap[t1.id].losses += 1;
      statsMap[t1.id].rankingPointsEarned += ptsCalc.loserPoints;
    }
  });

  const rows = Object.values(statsMap).map((st) => {
    const pointsDiff = st.pointsFor - st.pointsAgainst;
    const winRate = st.matchesPlayed > 0 ? Math.round((st.wins / st.matchesPlayed) * 100) : 0;

    let statusBadge = 'Na Disputa';
    if (podium.champion?.id === st.pair.id) statusBadge = '🥇 Campeão';
    else if (podium.runnerUp?.id === st.pair.id) statusBadge = '🥈 Vice-Campeão';
    else if (podium.thirdPlace?.id === st.pair.id) statusBadge = '🥉 3º Colocado';
    else if (st.losses >= 2) statusBadge = 'Eliminado (2D)';
    else if (st.losses === 1) statusBadge = 'Na Repescagem';
    else if (st.wins > 0 && st.losses === 0) statusBadge = 'Invicto';

    return {
      pair: st.pair,
      position: 0,
      matchesPlayed: st.matchesPlayed,
      wins: st.wins,
      losses: st.losses,
      pointsFor: st.pointsFor,
      pointsAgainst: st.pointsAgainst,
      pointsDiff,
      winRate,
      rankingPointsEarned: st.rankingPointsEarned,
      statusBadge,
    };
  });

  rows.sort((a, b) => {
    if (podium.champion?.id === a.pair.id) return -1;
    if (podium.champion?.id === b.pair.id) return 1;
    if (podium.runnerUp?.id === a.pair.id) return -1;
    if (podium.runnerUp?.id === b.pair.id) return 1;
    if (podium.thirdPlace?.id === a.pair.id) return -1;
    if (podium.thirdPlace?.id === b.pair.id) return 1;

    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.pair.seed - b.pair.seed;
  });

  return rows.map((r, idx) => ({
    ...r,
    position: idx + 1,
  }));
}

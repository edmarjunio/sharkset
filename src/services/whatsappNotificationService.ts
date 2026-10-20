import { BracketMatch, TeamPair, Tournament } from '../types';

export interface WhatsAppServiceStatus {
  configured: boolean;
  phoneIdAvailable: boolean;
  graphVersion?: string;
}

export interface WhatsAppDispatchResponse {
  success: boolean;
  simulated: boolean;
  dispatchedCount: number;
  skippedCount: number;
  totalRecipients: number;
  failures?: Array<{ phone: string; error: string }>;
}

/**
 * Checks WhatsApp Cloud API credentials configuration on the backend server.
 */
export async function checkWhatsAppServiceStatus(): Promise<WhatsAppServiceStatus> {
  try {
    const res = await fetch('/api/notifications/whatsapp/status');
    if (!res.ok) return { configured: false, phoneIdAvailable: false };
    return await res.json();
  } catch {
    return { configured: false, phoneIdAvailable: false };
  }
}

/**
 * Extracts distinct phone recipients from a list of tournament pairs.
 */
export function extractDistinctRecipients(pairs: TeamPair[]): Array<{ name: string; phone: string }> {
  const recipients: Array<{ name: string; phone: string }> = [];
  const seenPhones = new Set<string>();

  const addRecipient = (name: string, rawPhone?: string) => {
    if (!rawPhone) return;
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length >= 10 && !seenPhones.has(digits)) {
      seenPhones.add(digits);
      recipients.push({ name: name.trim() || 'Atleta', phone: digits });
    }
  };

  for (const pair of pairs) {
    if (pair.player1Phone) {
      addRecipient(pair.player1, pair.player1Phone);
    }
    if (pair.player2Phone && pair.player2 && pair.player2.toLowerCase() !== 'individual (1x1)') {
      addRecipient(pair.player2, pair.player2Phone);
    }
    if (pair.phone) {
      const duoName =
        pair.player2 && pair.player2.toLowerCase() !== 'individual (1x1)'
          ? `${pair.player1} & ${pair.player2}`
          : pair.player1;
      addRecipient(duoName, pair.phone);
    }
  }

  return recipients;
}

/**
 * Dispatches WhatsApp kickoff alerts to all tournament participants.
 */
export async function sendTournamentStartWhatsAppAlert(params: {
  tournament: Tournament;
  pairs: TeamPair[];
  arenaName?: string;
}): Promise<WhatsAppDispatchResponse> {
  const recipients = extractDistinctRecipients(params.pairs);

  try {
    const response = await fetch('/api/notifications/whatsapp/tournament-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: params.tournament.id,
        tournamentName: params.tournament.name,
        arenaName: params.arenaName || params.tournament.location || 'Arena SHARK SET',
        pairsCount: params.pairs.length,
        recipients,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        simulated: true,
        dispatchedCount: 0,
        skippedCount: 0,
        totalRecipients: recipients.length,
      };
    }

    return await response.json();
  } catch {
    return {
      success: false,
      simulated: true,
      dispatchedCount: 0,
      skippedCount: 0,
      totalRecipients: recipients.length,
    };
  }
}

/**
 * Dispatches WhatsApp match result alerts to players of both duplas.
 */
export async function sendMatchResultWhatsAppAlert(params: {
  tournamentId?: string;
  tournamentName: string;
  match: BracketMatch;
  winnerTeam?: TeamPair;
  loserTeam?: TeamPair;
  scoreSummary: string;
}): Promise<WhatsAppDispatchResponse> {
  const pairList: TeamPair[] = [];
  if (params.winnerTeam) pairList.push(params.winnerTeam);
  if (params.loserTeam) pairList.push(params.loserTeam);

  const recipients = extractDistinctRecipients(pairList);

  const formatTeamLabel = (team?: TeamPair) => {
    if (!team) return '';
    return team.player2 && team.player2.toLowerCase() !== 'individual (1x1)'
      ? `${team.player1} & ${team.player2}`
      : team.player1;
  };

  const winnerName = formatTeamLabel(params.winnerTeam) || 'Vencedor';
  const loserName = formatTeamLabel(params.loserTeam) || '';

  try {
    const response = await fetch('/api/notifications/whatsapp/match-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: params.tournamentId || params.match.tournamentId,
        tournamentName: params.tournamentName,
        matchId: params.match.id,
        matchNumber: params.match.matchNumber,
        stageName: params.match.stageName,
        winnerName,
        loserName,
        scoreSummary: params.scoreSummary,
        recipients,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        simulated: true,
        dispatchedCount: 0,
        skippedCount: 0,
        totalRecipients: recipients.length,
      };
    }

    return await response.json();
  } catch {
    return {
      success: false,
      simulated: true,
      dispatchedCount: 0,
      skippedCount: 0,
      totalRecipients: recipients.length,
    };
  }
}

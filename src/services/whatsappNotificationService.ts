import { BracketMatch, TeamPair, Tournament } from '../types';

export interface WhatsAppServiceStatus {
  configured: boolean;
  available?: boolean;
  phoneIdAvailable?: boolean;
  graphVersion?: string;
}

export interface WhatsAppDispatchResponse {
  success: boolean;
  simulated: boolean;
  dispatchedCount: number;
  skippedCount: number;
  totalRecipients: number;
  error?: string;
}

const UNAVAILABLE_MESSAGE =
  'Envio automatico indisponivel ate os contatos e consentimentos serem mantidos no servidor.';

function unavailableResponse(totalRecipients: number): WhatsAppDispatchResponse {
  return {
    success: false,
    simulated: false,
    dispatchedCount: 0,
    skippedCount: 0,
    totalRecipients,
    error: UNAVAILABLE_MESSAGE,
  };
}

export async function checkWhatsAppServiceStatus(): Promise<WhatsAppServiceStatus> {
  try {
    const response = await fetch('/api/notifications/whatsapp/status');
    if (!response.ok) return { configured: false, available: false };
    return await response.json();
  } catch {
    return { configured: false, available: false };
  }
}

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
    if (pair.player1Phone) addRecipient(pair.player1, pair.player1Phone);
    if (pair.player2Phone && pair.player2 && pair.player2.toLowerCase() !== 'individual (1x1)') {
      addRecipient(pair.player2, pair.player2Phone);
    }
    if (pair.phone) {
      const duoName = pair.player2 && pair.player2.toLowerCase() !== 'individual (1x1)'
        ? `${pair.player1} & ${pair.player2}`
        : pair.player1;
      addRecipient(duoName, pair.phone);
    }
  }

  return recipients;
}

export async function sendTournamentStartWhatsAppAlert(params: {
  tournament: Tournament;
  pairs: TeamPair[];
  arenaName?: string;
}): Promise<WhatsAppDispatchResponse> {
  return unavailableResponse(extractDistinctRecipients(params.pairs).length);
}

export async function sendMatchResultWhatsAppAlert(params: {
  tournamentId?: string;
  tournamentName: string;
  match: BracketMatch;
  winnerTeam?: TeamPair;
  loserTeam?: TeamPair;
  scoreSummary: string;
}): Promise<WhatsAppDispatchResponse> {
  const teams = [params.winnerTeam, params.loserTeam].filter((team): team is TeamPair => Boolean(team));
  return unavailableResponse(extractDistinctRecipients(teams).length);
}

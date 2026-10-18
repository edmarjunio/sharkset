import { Booking, BracketMatch, WaitlistEntry } from '../types';

/**
 * Adapter para geração de links e mensagens do WhatsApp
 * Permite envio direto sem fricção (SHARK SET Platform)
 */
export function generateBookingWhatsAppLink(booking: Booking, arenaPhone: string, arenaName: string): string {
  const sportNames: Record<string, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  const message = [
    `*NOVA RESERVA DE QUADRA - ${arenaName.toUpperCase()}* 🦈🏖️`,
    `--------------------------------------`,
    `👤 *Atleta:* ${booking.customerName}`,
    `📞 *Contato:* ${booking.customerPhone}`,
    `🎾 *Esporte:* ${sportNames[booking.sport] || booking.sport}`,
    `🏟️ *Quadra:* ${booking.courtName}`,
    `📅 *Data:* ${booking.date}`,
    `⏰ *Horário:* ${booking.startTime} às ${booking.endTime}`,
    `💵 *Valor:* R$ ${booking.price.toFixed(2)}`,
    `--------------------------------------`,
    `_Reserva confirmada via SHARK SET_`,
  ].join('\n');

  const cleanPhone = arenaPhone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Mensagem para convocar atletas para entrar em quadra durante o campeonato
 */
export function generateMatchCallWhatsAppLink(
  match: BracketMatch,
  tournamentName: string,
  arenaName: string
): string {
  if (!match.team1 || !match.team2) return '#';

  const message = [
    `📢 *CHAMADA DE JOGO - ${arenaName.toUpperCase()}*`,
    `🏆 *Torneio:* ${tournamentName}`,
    `⚔️ *Fase:* ${match.stageName}`,
    `🏟️ *Quadra:* ${match.courtName || 'Quadra Principal'}`,
    `⏰ *Horário Estimado:* ${match.scheduledTime || 'Agora'}`,
    `--------------------------------------`,
    `🔴 *Dupla 1:* ${match.team1.player1} & ${match.team1.player2}`,
    `🔵 *Dupla 2:* ${match.team2.player1} & ${match.team2.player2}`,
    `--------------------------------------`,
    `_Favor se apresentarem à mesa de arbitragem para início do aquecimento._`,
  ].join('\n');

  const recipient = match.team1.phone ? match.team1.phone.replace(/\D/g, '') : '';
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

/**
 * Mensagem automática disparada para o próximo da Lista de Espera quando um horário é cancelado
 */
export function generateWaitlistWhatsAppLink(entry: WaitlistEntry): string {
  const sportNames: Record<string, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  const message = [
    `🔔 *VAGA LIBERADA NA LISTA DE ESPERA - ${entry.arenaName.toUpperCase()}* 🏖️`,
    `--------------------------------------`,
    `Olá *${entry.customerName}*, uma reserva acabou de ser cancelada e você é o *1º da fila*!`,
    `🏟️ *Quadra:* ${entry.courtName}`,
    `📅 *Data:* ${entry.date}`,
    `⏰ *Horário:* ${entry.startTime} às ${entry.endTime}`,
    `🎾 *Esporte:* ${sportNames[entry.sport] || entry.sport}`,
    `💵 *Valor:* R$ ${entry.price.toFixed(2)}`,
    `--------------------------------------`,
    `_Sua vaga está pré-reservada! Confirme no aplicativo ou responda esta mensagem para garantir a quadra._`,
  ].join('\n');

  const cleanPhone = entry.customerPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}


import {
  Booking,
  BracketMatch,
  ClassStudent,
  Court,
  SmartAlertType,
  SmartNotificationItem,
  TimeSlot,
  VacantSlotWithin2h,
  WaitlistEntry,
} from '../types';
import { generateWaitlistWhatsAppLink } from './whatsappAdapter';
import { persistNotificationToFirestore } from '../lib/firebase';

const TWO_HOURS_IN_MINUTES = 120;
const PRE_MATCH_REMINDER_MINUTES = 15;
const DEFAULT_SET_TARGET_POINTS = 18;
const POINTS_REMAINING_ALERT_THRESHOLD = 10;

/**
 * Converts "HH:mm" string into total minutes since midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  return hours * 60 + minutes;
}

export const timeStrToMinutes = parseTimeToMinutes;

/**
 * Returns a clean "HH:mm" string for the current local time,
 * or falls back to a prime evening hour (17:15) if current time is late night so the 2h window is always demonstrable.
 */
export function getEffectiveReferenceTime(customTime?: string): string {
  if (customTime) return customTime;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < 6 || h >= 22) {
    return '17:15';
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 1. HORÁRIO VAGO NAS PRÓXIMAS 2 HORAS:
 * Scans all regular slots for the given date and returns vacant slots starting within [1, 120] minutes.
 */
export function findVacantSlotsInNext2Hours(
  slots: TimeSlot[],
  courts: Court[],
  referenceTimeStr?: string,
  referenceDateStr?: string
): VacantSlotWithin2h[] {
  const targetDate = referenceDateStr || new Date().toISOString().split('T')[0];
  const effectiveTime = getEffectiveReferenceTime(referenceTimeStr);
  const currentMinutes = parseTimeToMinutes(effectiveTime);

  const courtsById = new Map<string, Court>(courts.map((c) => [c.id, c]));

  return slots
    .filter((slot) => {
      if (slot.date !== targetDate) return false;
      if (!slot.isAvailable || slot.slotType === 'class') return false;
      const slotStartMinutes = parseTimeToMinutes(slot.startTime);
      const diff = slotStartMinutes - currentMinutes;
      return diff > 0 && diff <= TWO_HOURS_IN_MINUTES;
    })
    .map((slot) => {
      const court = courtsById.get(slot.courtId) || courts[0];
      const minutesUntilStart = parseTimeToMinutes(slot.startTime) - currentMinutes;
      return {
        slot,
        court,
        minutesUntilStart,
      };
    })
    .sort((a, b) => a.minutesUntilStart - b.minutesUntilStart);
}

/**
 * 2. JOGO COMEÇA EM BREVE (FALTANDO <= 10 PONTOS NO JOGO ANTERIOR):
 * Evaluates whether a match is within 10 points of finishing and identifies the next match to notify.
 */
export function evaluateMatchNearCompletion(
  currentMatch: BracketMatch,
  allMatches: BracketMatch[],
  score1: number,
  score2: number,
  targetPoints: number = DEFAULT_SET_TARGET_POINTS
): {
  shouldNotifyNextMatch: boolean;
  pointsRemaining: number;
  nextMatch: BracketMatch | undefined;
} {
  const maxScore = Math.max(score1, score2);
  const pointsRemaining = Math.max(0, targetPoints - maxScore);
  const shouldNotifyNextMatch = pointsRemaining > 0 && pointsRemaining <= POINTS_REMAINING_ALERT_THRESHOLD;

  const nextMatch =
    allMatches.find((m) => m.id === currentMatch.nextMatchWinnerId) ||
    allMatches.find(
      (m) =>
        m.matchNumber === currentMatch.matchNumber + 1 &&
        m.status !== 'completed' &&
        (m.team1 || m.team2)
    );

  return {
    shouldNotifyNextMatch,
    pointsRemaining,
    nextMatch,
  };
}

/**
 * 3. PARTIDA COMEÇA EM 15 MINUTOS (ANTES DO HORÁRIO AGENDADO):
 * Finds confirmed bookings starting within ~15 minutes of the reference clock.
 */
export function findBookingsStartingSoon(
  bookings: Booking[],
  referenceTimeStr?: string,
  referenceDateStr?: string
): Booking[] {
  const targetDate = referenceDateStr || new Date().toISOString().split('T')[0];
  const effectiveTime = getEffectiveReferenceTime(referenceTimeStr);
  const currentMinutes = parseTimeToMinutes(effectiveTime);

  return bookings.filter((booking) => {
    if (booking.status !== 'confirmed' || booking.date !== targetDate) return false;
    const diff = parseTimeToMinutes(booking.startTime) - currentMinutes;
    return diff > 0 && diff <= PRE_MATCH_REMINDER_MINUTES + 5;
  });
}

/**
 * Requests browser Push Notification permission cleanly.
 */
export async function requestBrowserPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (window.Notification.permission === 'granted') {
    return 'granted';
  }
  return window.Notification.requestPermission();
}

/**
 * Dispatches native Browser Push Notification + non-blocking Backend API & Firestore sync.
 */
export async function dispatchPushNotificationChannel(item: SmartNotificationItem): Promise<boolean> {
  let pushSent = false;

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      try {
        new window.Notification(item.title, {
          body: item.body,
          tag: item.id,
        });
        pushSent = true;
      } catch {
        pushSent = false;
      }
    }
  }

  // Non-blocking backend dispatch
  fetch('/api/notifications/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: item.type,
      title: item.title,
      body: item.body,
      recipientName: item.recipientName,
      recipientPhone: item.recipientPhone,
    }),
  }).catch(() => {
    // Graceful fallback in preview
  });

  // Non-blocking Firestore persistence when user is authenticated
  persistNotificationToFirestore({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    recipientName: item.recipientName,
  }).catch(() => {
    // Ignore if unauthenticated
  });

  return pushSent;
}

/**
 * Clean Factory for all 4 Smart Notification types (Zero Duplication / DRY).
 */
export function buildSmartNotification(params: {
  type: SmartAlertType;
  title: string;
  body: string;
  badgeLabel: string;
  recipientName?: string;
  recipientPhone?: string;
  whatsappUrl?: string;
  actionLabel?: string;
  actionTargetTab?: 'scheduler' | 'tournaments' | 'my_bookings';
  slotId?: string;
  matchId?: string;
}): SmartNotificationItem {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    id: `notif-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    title: params.title,
    body: params.body,
    badgeLabel: params.badgeLabel,
    recipientName: params.recipientName,
    recipientPhone: params.recipientPhone,
    whatsappUrl: params.whatsappUrl,
    actionLabel: params.actionLabel,
    actionTargetTab: params.actionTargetTab,
    slotId: params.slotId,
    matchId: params.matchId,
    createdAt: timeStr,
    read: false,
    pushDelivered: typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted',
  };
}

export function buildWaitlistFreedPushNotification(entry: WaitlistEntry): SmartNotificationItem {
  const waUrl = generateWaitlistWhatsAppLink(entry);
  return buildSmartNotification({
    type: 'waitlist_freed',
    badgeLabel: 'PUSH · VAGA LIBERADA NA FILA',
    title: `🔔 Horário Livre p/ ${entry.customerName} (1º da Espera)!`,
    body: `A ${entry.courtName} ficou livre para ${entry.date} às ${entry.startTime}. Confirme em 1 clique!`,
    recipientName: entry.customerName,
    recipientPhone: entry.customerPhone,
    whatsappUrl: waUrl,
    actionLabel: 'Assumir Horário Agora',
    actionTargetTab: 'my_bookings',
    slotId: entry.slotId,
  });
}

export function buildMatch10PointsRemainingNotification(
  currentMatch: BracketMatch,
  nextMatch: BracketMatch | undefined,
  score1: number,
  score2: number,
  pointsRemaining: number,
  arenaName: string
): SmartNotificationItem {
  const nextTeamsLabel =
    nextMatch?.team1 && nextMatch?.team2
      ? `${nextMatch.team1.player1}/${nextMatch.team1.player2} vs ${nextMatch.team2.player1}/${nextMatch.team2.player2}`
      : nextMatch?.team1
      ? `${nextMatch.team1.player1}/${nextMatch.team1.player2} (aguardando adversário)`
      : 'Próxima dupla da chave';

  const recipientPhone = nextMatch?.team1?.phone || '';
  const message = [
    `⚡ *ATENÇÃO ATLETAS SHARK SET - SEU JOGO COMEÇA EM BREVE!*`,
    `🏟️ *Arena:* ${arenaName}`,
    `🏐 *Jogo Atual (#${currentMatch.matchNumber}):* Placar em *${score1} x ${score2}* (faltam apenas *${pointsRemaining} pontos* para encerrar!)`,
    `🔥 *Próximo Jogo (#${nextMatch?.matchNumber || currentMatch.matchNumber + 1}):* ${nextTeamsLabel}`,
    `_Dirijam-se à quadra para aquecimento imediato!_`,
  ].join('\n');

  const cleanPhone = recipientPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
  const whatsappUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return buildSmartNotification({
    type: 'match_10pts_left',
    badgeLabel: `FALTAM ${pointsRemaining} PTS NO JOGO ANTERIOR`,
    title: `⚡ Prepare-se! Jogo #${nextMatch?.matchNumber || currentMatch.matchNumber + 1} começa em instantes`,
    body: `O Jogo #${currentMatch.matchNumber} está ${score1}x${score2} (faltam ${pointsRemaining} pts). Duplas: ${nextTeamsLabel}, dirijam-se à quadra!`,
    recipientName: nextTeamsLabel,
    recipientPhone,
    whatsappUrl,
    actionLabel: 'Ver Jogo na Chave',
    actionTargetTab: 'tournaments',
    matchId: nextMatch?.id || currentMatch.id,
  });
}

export function buildBooking15MinReminderNotification(booking: Booking, arenaName: string): SmartNotificationItem {
  const message = [
    `⏰ *LEMBRETE SHARK SET: SUA PARTIDA COMEÇA EM 15 MINUTOS!*`,
    `👤 *Atleta:* ${booking.customerName}`,
    `🏟️ *Quadra:* ${booking.courtName} (${arenaName})`,
    `🕒 *Horário:* ${booking.startTime} às ${booking.endTime}`,
    `_Tudo pronto na areia! Bom jogo!_`,
  ].join('\n');

  const cleanPhone = booking.customerPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  return buildSmartNotification({
    type: 'booking_15min',
    badgeLabel: 'PARTIDA EM 15 MINUTOS',
    title: `⏰ ${booking.customerName}, sua partida começa em 15 minutos!`,
    body: `Quadra reservada: ${booking.courtName} às ${booking.startTime} (${arenaName}). Prepare-se para entrar em quadra!`,
    recipientName: booking.customerName,
    recipientPhone: booking.customerPhone,
    whatsappUrl: `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`,
    actionLabel: 'Ver Minha Reserva',
    actionTargetTab: 'my_bookings',
  });
}

export function buildVacantSlot2hNotification(
  vacant: VacantSlotWithin2h,
  arenaName: string
): SmartNotificationItem {
  const message = [
    `🔥 *HORÁRIO VAGO NAS PRÓXIMAS 2 HORAS - ${arenaName.toUpperCase()}*`,
    `🏟️ *Quadra:* ${vacant.court.name}`,
    `⏰ *Horário:* Hoje às ${vacant.slot.startTime} (em ${vacant.minutesUntilStart} min)`,
    `💵 *Valor:* R$ ${vacant.slot.price.toFixed(2)}`,
    `_Reserve em 1 clique no app SHARK SET!_`,
  ].join('\n');

  return buildSmartNotification({
    type: 'vacant_2h',
    badgeLabel: `QUADRA VAGA EM ${vacant.minutesUntilStart} MIN`,
    title: `⚡ Horário Vago nas Próximas 2h: ${vacant.court.name.split(' - ')[0]} às ${vacant.slot.startTime}`,
    body: `Faltam ${vacant.minutesUntilStart} min para o horário das ${vacant.slot.startTime} na ${vacant.court.name}. Preencha a agenda em 1 clique!`,
    recipientName: 'Atletas da Arena',
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
    actionLabel: 'Preencher Horário Agora',
    actionTargetTab: 'scheduler',
    slotId: vacant.slot.id,
  });
}

/**
 * 5. GESTÃO DE MENSALIDADES DE ALUNOS (INÍCIO NO DIA DA INSCRIÇÃO + NOTIFICAÇÃO NO DIA DO VENCIMENTO):
 * Calcula o ciclo mensal a partir do dia exato da inscrição (enrolledAt).
 */
export function calculateStudentTuitionCycle(
  enrolledAtDateStr: string,
  referenceTodayStr?: string
): {
  billingStartDate: string;
  dueDayOfMonth: number;
  nextDueDate: string;
  isDueToday: boolean;
} {
  const todayStr = referenceTodayStr || new Date().toISOString().split('T')[0];
  const parts = enrolledAtDateStr.split('-').map((n) => parseInt(n, 10));
  const todayParts = todayStr.split('-').map((n) => parseInt(n, 10));

  const enrollDay = parts[2] || new Date().getDate();
  const currentYear = todayParts[0] || new Date().getFullYear();
  const currentMonth = todayParts[1] || new Date().getMonth() + 1;
  const currentDay = todayParts[2] || new Date().getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  if (enrollDay < currentDay) {
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }

  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const clampedDay = Math.min(enrollDay, maxDaysInTargetMonth);
  const nextDueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  const isDueToday = nextDueDate === todayStr || enrollDay === currentDay;

  return {
    billingStartDate: enrolledAtDateStr,
    dueDayOfMonth: enrollDay,
    nextDueDate,
    isDueToday,
  };
}

/**
 * Filtra os alunos com mensalidade vencendo hoje (ou marcada para hoje) na arena.
 */
export function findStudentsWithTuitionDueToday(
  students: ClassStudent[],
  referenceTodayStr?: string
): ClassStudent[] {
  const todayStr = referenceTodayStr || new Date().toISOString().split('T')[0];
  const todayDay = parseInt(todayStr.split('-')[2] || '0', 10);

  return students.filter((s) => {
    if (s.billingType !== 'mensal') return false;
    if (s.paymentStatus === 'pago') return false;
    if (s.nextDueDate === todayStr) return true;
    if (s.dueDayOfMonth && s.dueDayOfMonth === todayDay) return true;
    const cycle = calculateStudentTuitionCycle(s.enrolledAt, todayStr);
    return cycle.isDueToday;
  });
}

/**
 * Gera o link direto de renovação de mensalidade para envio no WhatsApp / Push
 */
export function buildDirectTuitionRenewalLink(student: ClassStudent): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sharkset.app';
  return `${origin}/?renovar_mensalidade=${encodeURIComponent(student.id)}&turma=${encodeURIComponent(student.classId)}`;
}

/**
 * Filtra os alunos cuja mensalidade vence exatamente daqui a 2 dias (Disparo Automático Preventivo D-2).
 */
export function findStudentsWithTuitionDueIn2Days(
  students: ClassStudent[],
  referenceTodayStr?: string
): ClassStudent[] {
  const baseDate = referenceTodayStr ? new Date(`${referenceTodayStr}T12:00:00`) : new Date();
  const in2Days = new Date(baseDate);
  in2Days.setDate(baseDate.getDate() + 2);
  const in2DaysStr = in2Days.toISOString().split('T')[0];
  const in2DaysDayOfMonth = in2Days.getDate();

  return students.filter((s) => {
    if (s.billingType !== 'mensal') return false;
    if (s.paymentStatus === 'pago') return false;
    if (s.nextDueDate === in2DaysStr) return true;
    if (s.dueDayOfMonth && s.dueDayOfMonth === in2DaysDayOfMonth) return true;
    return false;
  });
}

/**
 * Gera a notificação automática (Push + WhatsApp) enviada ao aluno 2 DIAS ANTES do vencimento com Link Direto para Renovação.
 */
export function buildTuitionDueIn2DaysNotification(
  student: ClassStudent,
  arenaName: string
): SmartNotificationItem {
  const baseDate = new Date();
  const in2Days = new Date(baseDate);
  in2Days.setDate(baseDate.getDate() + 2);
  const dueDateFormatted = student.nextDueDate || in2Days.toISOString().split('T')[0];
  const renewalLink = buildDirectTuitionRenewalLink(student);

  const message = [
    `🔔 *LEMBRETE AUTOMÁTICO (FALTAM 2 DIAS) - ${arenaName.toUpperCase()}* 🦈`,
    `--------------------------------------`,
    `Olá *${student.studentName}*! Sua mensalidade vence daqui a *2 dias* (${dueDateFormatted}).`,
    `🏐 *Turma:* ${student.classTitle} (${student.classTime})`,
    `👨‍🏫 *Professor(a):* ${student.coachName}`,
    `💵 *Valor:* R$ ${student.amount.toFixed(2)}`,
    `--------------------------------------`,
    `⚡ *LINK DIRETO PARA RENOVAÇÃO EM 1 CLIQUE (PIX / CARTÃO):*`,
    `${renewalLink}`,
    `--------------------------------------`,
    `_Renovando pelo link sua vaga continua 100% garantida na turma!_`,
  ].join('\n');

  const cleanPhone = student.studentPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
  const whatsappUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return buildSmartNotification({
    type: 'tuition_due_2days',
    badgeLabel: 'VENCE EM 2 DIAS · LINK RENOVAÇÃO',
    title: `📲 Vence em 2 Dias: ${student.studentName} (${student.classTitle}) — Link de Renovação Enviado`,
    body: `Disparo automático D-2 para ${student.studentName} (vence em ${dueDateFormatted} · R$ ${student.amount.toFixed(2)}). Link direto de renovação pronto para envio via WhatsApp/Push!`,
    recipientName: student.studentName,
    recipientPhone: student.studentPhone,
    whatsappUrl,
    actionLabel: 'Renovar / Ver Mensalidade',
    actionTargetTab: 'scheduler',
  });
}

/**
 * Gera a notificação automática (Push + WhatsApp) enviada ao aluno no dia do vencimento da mensalidade.
 */
export function buildTuitionDueTodayNotification(
  student: ClassStudent,
  arenaName: string
): SmartNotificationItem {
  const dueDateFormatted = student.nextDueDate || new Date().toISOString().split('T')[0];
  const renewalLink = buildDirectTuitionRenewalLink(student);
  const message = [
    `📅 *AVISO DE VENCIMENTO DE MENSALIDADE HOJE - ${arenaName.toUpperCase()}*`,
    `👤 *Aluno(a):* ${student.studentName}`,
    `🏐 *Turma Vinculada:* ${student.classTitle} (${student.classTime})`,
    `👨‍🏫 *Professor(a):* ${student.coachName}`,
    `🗓️ *Início na Inscrição:* ${student.billingStartDate || student.enrolledAt} · *Vencimento Hoje:* ${dueDateFormatted}`,
    `💵 *Valor da Mensalidade:* R$ ${student.amount.toFixed(2)}`,
    `--------------------------------------`,
    `⚡ *LINK DIRETO PARA RENOVAÇÃO EM 1 CLIQUE:*`,
    `${renewalLink}`,
    `--------------------------------------`,
    `_Realize o pagamento pelo link acima via PIX ou na recepção da arena para manter sua vaga ativa na turma!_`,
  ].join('\n');

  const cleanPhone = student.studentPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
  const whatsappUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return buildSmartNotification({
    type: 'tuition_due_today',
    badgeLabel: 'MENSALIDADE VENCE HOJE',
    title: `📅 Mensalidade Vence Hoje: ${student.studentName} (${student.classTitle})`,
    body: `Olá ${student.studentName}! Sua mensalidade da turma "${student.classTitle}" (${student.coachName}) no valor de R$ ${student.amount.toFixed(2)} vence hoje (${dueDateFormatted}). Link direto enviado!`,
    recipientName: student.studentName,
    recipientPhone: student.studentPhone,
    whatsappUrl,
    actionLabel: 'Gerenciar Mensalidades',
    actionTargetTab: 'scheduler',
  });
}



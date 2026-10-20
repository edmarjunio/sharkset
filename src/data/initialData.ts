import {
  AthleteLevel,
  AthleteProfile,
  Booking,
  BracketMatch,
  ClassStudent,
  Court,
  HistoricalLegendVideo,
  LiveChatMessage,
  RankingMatchLog,
  SmartNotificationItem,
  TeamPair,
  TimeSlot,
  Tournament,
  WaitlistEntry,
} from '../types';

export const ATHLETE_LEVEL_LABELS: Record<AthleteLevel, string> = {
  iniciante: 'Iniciante',
  serie_c: 'Série C',
  serie_b: 'Série B',
  serie_a: 'Série A',
  profissional: 'Profissional',
};

export const INITIAL_ATHLETES: AthleteProfile[] = [];

export const INITIAL_RANKING_LOGS: RankingMatchLog[] = [];

export const INITIAL_PAIRS: TeamPair[] = [];

export function getInitialTournamentMatches(): BracketMatch[] {
  return [];
}

export const INITIAL_TOURNAMENTS: Tournament[] = [];

export const INITIAL_CLASS_STUDENTS: ClassStudent[] = [];

export const WEEKDAY_FULL_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export const WEEKDAY_SHORT_NAMES: Record<number, string> = {
  0: 'DOM',
  1: 'SEG',
  2: 'TER',
  3: 'QUA',
  4: 'QUI',
  5: 'SEX',
  6: 'SÁB',
};

export function buildDefaultDayOfWeekPricing(court: Court): Record<number, { enabled: boolean; normalRate: number; peakRate: number }> {
  const baseNormal = court.hourlyRate || 80;
  const basePeak = court.peakHourlyRate ?? baseNormal + 15;
  const wkndNormal = court.weekendNormalRate ?? baseNormal + 10;
  const wkndPeak = court.weekendPeakRate ?? basePeak + 10;

  return {
    1: court.dayOfWeekPricing?.[1] || { enabled: true, normalRate: baseNormal, peakRate: basePeak },
    2: court.dayOfWeekPricing?.[2] || { enabled: true, normalRate: baseNormal, peakRate: basePeak },
    3: court.dayOfWeekPricing?.[3] || { enabled: true, normalRate: baseNormal, peakRate: basePeak },
    4: court.dayOfWeekPricing?.[4] || { enabled: true, normalRate: baseNormal, peakRate: basePeak },
    5: court.dayOfWeekPricing?.[5] || { enabled: true, normalRate: baseNormal, peakRate: basePeak + 5 },
    6: court.dayOfWeekPricing?.[6] || { enabled: true, normalRate: wkndNormal, peakRate: wkndPeak },
    0: court.dayOfWeekPricing?.[0] || { enabled: true, normalRate: wkndNormal, peakRate: wkndPeak },
  };
}

export function calculateCourtSlotPrice(
  court: Court,
  dateStr: string,
  hour: number
): { price: number; isPeak: boolean; dayOfWeek: number; pricingLabel: string; isDayEnabled: boolean } {
  const d = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = isNaN(d.getDay()) ? 1 : d.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const peakStartHour = parseInt((court.peakStartTime || '18:00').split(':')[0], 10);
  const peakEndHour = parseInt((court.peakEndTime || '22:00').split(':')[0], 10);
  const validPeakStart = isNaN(peakStartHour) ? 18 : peakStartHour;
  const validPeakEnd = isNaN(peakEndHour) ? 22 : peakEndHour;

  const isPeak = hour >= validPeakStart && hour < validPeakEnd;

  const dayRule = court.dayOfWeekPricing?.[dayOfWeek];
  const isDayEnabled = dayRule ? dayRule.enabled !== false : true;

  let price: number;
  if (dayRule) {
    price = isPeak ? dayRule.peakRate : dayRule.normalRate;
  } else if (isWeekend) {
    const wkndNormal = court.weekendNormalRate ?? court.hourlyRate;
    const wkndPeak = court.weekendPeakRate ?? court.peakHourlyRate ?? wkndNormal + 15;
    price = isPeak ? wkndPeak : wkndNormal;
  } else {
    price = isPeak ? court.peakHourlyRate ?? court.hourlyRate : court.hourlyRate;
  }

  const dayShort = WEEKDAY_SHORT_NAMES[dayOfWeek] || '';
  const pricingLabel = isPeak ? `Pico · ${dayShort}` : `Normal · ${dayShort}`;

  return {
    price,
    isPeak,
    dayOfWeek,
    pricingLabel,
    isDayEnabled,
  };
}

export function generateWeeklySlots(courts: Court[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const baseDate = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + dayOffset);
    const dateStr = d.toISOString().split('T')[0];

    for (const court of courts) {
      const openHour = parseInt((court.openTime || '06:00').split(':')[0], 10) || 6;
      const closeHour = parseInt((court.closeTime || '23:00').split(':')[0], 10) || 23;

      for (let h = openHour; h < closeHour; h++) {
        const startTime = `${String(h).padStart(2, '0')}:00`;
        const endTime = `${String(h + 1).padStart(2, '0')}:00`;
        const { price, isPeak, dayOfWeek, pricingLabel, isDayEnabled } = calculateCourtSlotPrice(
          court,
          dateStr,
          h
        );

        if (!isDayEnabled) {
          continue;
        }

        const classObj = court.classSchedules?.find((c) => c.startTime === startTime);
        if (classObj) {
          slots.push({
            id: `slot-${court.id}-${dateStr}-${startTime}`,
            courtId: court.id,
            date: dateStr,
            startTime,
            endTime,
            price,
            isAvailable: false,
            isPeakHour: isPeak,
            dayOfWeek,
            pricingLabel,
            slotType: 'class',
            classConfig: classObj,
          });
          continue;
        }

        slots.push({
          id: `slot-${court.id}-${dateStr}-${startTime}`,
          courtId: court.id,
          date: dateStr,
          startTime,
          endTime,
          price,
          isAvailable: true,
          isPeakHour: isPeak,
          dayOfWeek,
          pricingLabel,
          slotType: 'regular',
        });
      }
    }
  }

  return slots;
}

export const INITIAL_BOOKINGS: Booking[] = [];

export const INITIAL_WAITLIST: WaitlistEntry[] = [];

export const INITIAL_SMART_NOTIFICATIONS: SmartNotificationItem[] = [];

export const HISTORICAL_LEGEND_VIDEOS: HistoricalLegendVideo[] = [];

export const INITIAL_LIVE_CHAT: LiveChatMessage[] = [];

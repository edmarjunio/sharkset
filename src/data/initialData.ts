import {
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

export const HISTORICAL_LEGEND_VIDEOS: HistoricalLegendVideo[] = [
  {
    id: 'leg-belo-vinicius',
    title: 'Belo & Vinícius — A Dupla Lendária e o Auge da Técnica no Futevôlei Mundial',
    legends: ['Belo', 'Vinícius'],
    era: 'Clássico Eterno · Era de Ouro',
    location: 'Arena Copacabana / Circuito Nacional',
    youtubeEmbedUrl: 'https://www.youtube.com/embed/videoseries?list=PL8fVUTBmJhHJmpP7s_9Jf7w0mG3K8c-0a',
    thumbnailUrl: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=900&q=85',
    viewsCount: '482 mil visualizações',
    spectatorsWatchingNow: 318,
    description:
      'Ralis antológicos de Belo e Vinícius, leitura fria de quadra, levantamentos perfeitos de peito e bolas cravadas na linha.',
    highlightTag: '👑 BELO & VINÍCIUS',
  },
  {
    id: 'leg-eduardinho',
    title: 'Eduardinho — O Mago das Diagonais Curtas, Pingo e Shark Attack',
    legends: ['Eduardinho'],
    era: 'Relíquia Histórica · Lendas da Areia',
    location: 'Praia de Boa Viagem / Rio de Janeiro',
    youtubeEmbedUrl: 'https://www.youtube.com/embed/5qap5aO4i9A',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=900&q=85',
    viewsCount: '395 mil visualizações',
    spectatorsWatchingNow: 245,
    description:
      'Compilado de jogos históricos de Eduardinho mostrando controle absoluto no pingo atrás do bloqueio e ataques indefensáveis.',
    highlightTag: '⚡ EDUARDINHO',
  },
  {
    id: 'leg-cabecao',
    title: 'Cabeção — Defesas Impossíveis, Cobertura de Quadra e Finais Históricas',
    legends: ['Cabeção'],
    era: 'Acervo Oficial · Clássicos do Futevôlei',
    location: 'Circuito Brasileiro de Futevôlei',
    youtubeEmbedUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
    viewsCount: '290 mil visualizações',
    spectatorsWatchingNow: 189,
    description:
      'Partidas memoráveis de Cabeção enfrentando a elite nacional em sets decididos ponto a ponto após o 18x18.',
    highlightTag: '🛡️ CABEÇÃO',
  },
  {
    id: 'leg-romario-renato',
    title: 'Romário & Renato Gaúcho — O Duelo dos Reis da Praia em Ipanema e Barra',
    legends: ['Romário', 'Renato Gaúcho'],
    era: 'Anos 90 / 2000 · Reis do Rio',
    location: 'Praia de Ipanema · Posto 9 (RJ)',
    youtubeEmbedUrl: 'https://www.youtube.com/embed/DWcJFNfaw9c',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=85',
    viewsCount: '610 mil visualizações',
    spectatorsWatchingNow: 412,
    description:
      'A rivalidade histórica na areia entre Romário (Baixinho) e Renato Gaúcho cercada por multidões nas praias cariocas.',
    highlightTag: '⚽ ROMÁRIO & RENATO GAÚCHO',
  },
];

export const INITIAL_LIVE_CHAT: LiveChatMessage[] = [];

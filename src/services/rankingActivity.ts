import type { AthleteProfile } from '../types';
import { ATHLETE_TIERS, getRankingPromotionSuggestion } from './rankingValidator';

export const DAY_MS = 86_400_000;
export const INACTIVITY_DAYS = 30;
export const REMINDER_DAYS = 25;

export function getInactivityDays(lastMatchAt: string | undefined, now = Date.now()): number | null {
  if (!lastMatchAt) return null;
  const timestamp = Date.parse(lastMatchAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  return Math.floor((now - timestamp) / DAY_MS);
}

export function resetInactiveProgress(athlete: AthleteProfile, now = Date.now()): AthleteProfile {
  const days = getInactivityDays(athlete.lastMatchAt, now);
  if (days === null || days < INACTIVITY_DAYS || athlete.rankingInactive) return athlete;
  return { ...athlete, points: 0, lastPointsDelta: 0, rankingInactive: true,
    levelMatches: 0, levelWins: 0, levelPoints: 0,
    highestHistoricalLevel: athlete.highestHistoricalLevel || athlete.level };
}

export function applyRankedActivity(athlete: AthleteProfile, points: number, won: boolean, now = Date.now()): AthleteProfile {
  const base = resetInactiveProgress(athlete, now);
  const levelMatches = (base.levelMatches || 0) + 1;
  const levelWins = (base.levelWins || 0) + Number(won);
  const levelPoints = (base.levelPoints || 0) + points;
  const tier = ATHLETE_TIERS.find(item => item.level === base.level)!;
  const promotion = getRankingPromotionSuggestion(tier.minPoints + levelPoints, 0, base.level, levelWins, levelMatches);
  return { ...base, points: base.points + points, matchesPlayed: base.matchesPlayed + 1,
    wins: base.wins + Number(won), lastPointsDelta: points, lastMatchAt: new Date(now).toISOString(),
    rankingInactive: false, level: promotion.recommendedLevel,
    highestHistoricalLevel: promotion.shouldPromote ? promotion.recommendedLevel : (base.highestHistoricalLevel || base.level),
    levelMatches: promotion.shouldPromote ? 0 : levelMatches,
    levelWins: promotion.shouldPromote ? 0 : levelWins,
    levelPoints: promotion.shouldPromote ? 0 : levelPoints };
}

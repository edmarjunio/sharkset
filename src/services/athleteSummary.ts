import type { AthleteCampaign, AthleteProfile } from '../types';
import { ATHLETE_TIERS, getRankingPromotionSuggestion } from './rankingValidator';

export function verifiedCampaigns(athlete: AthleteProfile): AthleteCampaign[] {
  const unique = new Map<string, AthleteCampaign>();
  for (const campaign of athlete.campaigns || []) {
    if (campaign.verified !== true || !campaign.tournamentId || !Number.isInteger(campaign.matches) || !Number.isInteger(campaign.wins) ||
      !Number.isInteger(campaign.losses) || campaign.wins < 0 || campaign.losses < 0 || campaign.matches !== campaign.wins + campaign.losses) continue;
    unique.set(campaign.tournamentId, campaign);
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export function athleteSummary(athlete: AthleteProfile) {
  const campaigns = verifiedCampaigns(athlete);
  const games = Math.max(0, Number(athlete.matchesPlayed) || 0);
  const wins = Math.min(games, Math.max(0, Number(athlete.wins) || 0));
  const titles = Math.max(0, Number(athlete.titlesCount) || 0);
  const medals = [1, 2, 3].map(place => campaigns.filter(campaign => campaign.placement === place).length);
  const podiums = Number.isInteger(athlete.podiumsCount) && athlete.podiumsCount! >= 0 ? athlete.podiumsCount! :
    campaigns.length ? medals.reduce((sum, value) => sum + value, 0) : games === 0 && titles === 0 ? 0 : null;
  const tier = ATHLETE_TIERS.find(item => item.level === athlete.level) || ATHLETE_TIERS[0];
  const categoryPoints = athlete.levelPoints !== undefined ? tier.minPoints + athlete.levelPoints : athlete.points;
  const promotion = getRankingPromotionSuggestion(categoryPoints, titles, athlete.level, athlete.levelWins ?? wins, athlete.levelMatches ?? games);
  return { games, wins, losses: games - wins, titles, campaigns, medals, podiums,
    winRate: games ? Math.round(wins / games * 100) : 0,
    tournaments: athlete.tournamentsPlayed ?? (campaigns.length || (games === 0 ? 0 : null)), tier, promotion };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { athleteSummary, verifiedCampaigns } from '../src/services/athleteSummary';
import { getInitialFloorPointsForLevel, getRankingPromotionSuggestion } from '../src/services/rankingValidator';
import type { AthleteCampaign, AthleteProfile } from '../src/types';
const athlete: AthleteProfile = { id: 'account-id', name: 'Atleta de teste', phone: '', level: 'serie_c', points: 400,
  titlesCount: 1, matchesPlayed: 10, wins: 6, city: 'Mineiros', preferredSport: 'futevolei' };
const campaign: AthleteCampaign = { tournamentId: 'official-event', tournamentName: 'Campeonato de teste', date: '2026-10-18',
  partner: 'Parceiro', placement: 1, matches: 4, wins: 3, losses: 1, mmrGained: 80, verified: true };

test('initial MMR is aligned to the five category floors', () => {
  assert.deepEqual((['iniciante', 'serie_c', 'serie_b', 'serie_a', 'profissional'] as const).map(getInitialFloorPointsForLevel), [0, 250, 550, 950, 1500]);
});
test('titles or dominant win rates alone cannot promote without reaching the MMR threshold', () => {
  assert.equal(getRankingPromotionSuggestion(200, 25, 'iniciante', 50, 55).shouldPromote, false);
  assert.equal(getRankingPromotionSuggestion(549, 25, 'serie_c', 50, 55).shouldPromote, false);
  assert.equal(getRankingPromotionSuggestion(550, 0, 'serie_c', 4, 6).recommendedLevel, 'serie_b');
  assert.equal(getRankingPromotionSuggestion(550, 0, 'serie_c', 3, 4).shouldPromote, false);
});
test('profile calculations use games actually recorded and never count manually entered achievements as official podiums', () => {
  const result = athleteSummary({ ...athlete, achievements: [{ id: 'manual', title: 'Manual', tournamentName: 'Manual', year: '2026', placement: '1º Lugar' }] });
  assert.equal(result.wins, 6); assert.equal(result.losses, 4); assert.equal(result.winRate, 60);
  assert.equal(result.podiums, null); assert.equal(result.campaigns.length, 0);
});
test('campaign corrections replace previous records instead of duplicating podiums', () => {
  const corrected = { ...campaign, placement: 2, wins: 2, losses: 2 };
  const result = athleteSummary({ ...athlete, campaigns: [campaign, corrected] });
  assert.equal(result.campaigns.length, 1); assert.deepEqual(result.medals, [0, 1, 0]); assert.equal(result.podiums, 1);
});
test('unverified and inconsistent campaigns are excluded, preserving legitimate historical results', () => {
  assert.deepEqual(verifiedCampaigns({ ...athlete, campaigns: [{ ...campaign, verified: false }, { ...campaign, wins: 99 }, { ...campaign, losses: -1 }, campaign] }), [campaign]);
});
test('an account without matches starts with empty results, independently of its starting category', () => {
  const result = athleteSummary({ ...athlete, points: 950, level: 'serie_a', wins: 0, matchesPlayed: 0, titlesCount: 0 });
  assert.equal(result.games, 0); assert.equal(result.winRate, 0); assert.equal(result.podiums, 0); assert.equal(result.tournaments, 0);
});
test('MMR progress follows the category cycle after inactivity, without manually downgrading the registered category', () => {
  const result = athleteSummary({ ...athlete, level: 'serie_b', points: 0, levelPoints: 200, levelMatches: 6, levelWins: 4 });
  assert.equal(result.tier.level, 'serie_b'); assert.equal(result.promotion.pointsToNext, 200); assert.equal(result.promotion.progressPercent, 50);
});

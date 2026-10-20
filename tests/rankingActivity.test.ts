import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRankedActivity, DAY_MS, getInactivityDays, resetInactiveProgress } from '../src/services/rankingActivity';
import { getRankingPromotionSuggestion } from '../src/services/rankingValidator';
import type { AthleteProfile } from '../src/types';

const now = Date.parse('2026-10-18T12:00:00Z');
const athlete: AthleteProfile = { id: 'test', name: 'Teste', phone: '', level: 'serie_c',
  points: 300, titlesCount: 0, matchesPlayed: 10, wins: 5, city: 'Mineiros', preferredSport: 'futevolei' };

test('missing, invalid and future activity dates do not reset an athlete', () => {
  for (const date of [undefined, 'invalid', new Date(now + DAY_MS).toISOString()]) {
    assert.equal(getInactivityDays(date, now), null);
    assert.equal(resetInactiveProgress({ ...athlete, lastMatchAt: date }, now).points, 300);
  }
});
test('reset occurs at 30 complete days, preserving historical category and results', () => {
  const lastMatchAt = new Date(now - 30 * DAY_MS).toISOString();
  assert.equal(resetInactiveProgress({ ...athlete, lastMatchAt }, now - 1).points, 300);
  const reset = resetInactiveProgress({ ...athlete, lastMatchAt }, now);
  assert.equal(reset.points, 0);
  assert.equal(reset.level, 'serie_c');
  assert.equal(reset.highestHistoricalLevel, 'serie_c');
  assert.equal(reset.matchesPlayed, 10);
  assert.equal(resetInactiveProgress(reset, now), reset);
});
test('first match after reset starts fresh progress and renews activity', () => {
  const result = applyRankedActivity({ ...athlete, lastMatchAt: new Date(now - 31 * DAY_MS).toISOString() }, 40, true, now);
  assert.equal(result.points, 40);
  assert.equal(result.levelMatches, 1);
  assert.equal(result.rankingInactive, false);
  assert.equal(result.lastMatchAt, new Date(now).toISOString());
});
test('promotion requires enough matches, wins and win rate, even with many points', () => {
  assert.equal(getRankingPromotionSuggestion(1000, 3, 'iniciante', 3, 3).shouldPromote, false);
  assert.equal(getRankingPromotionSuggestion(1000, 3, 'iniciante', 4, 8).shouldPromote, false);
  assert.equal(getRankingPromotionSuggestion(250, 0, 'iniciante', 4, 6).recommendedLevel, 'serie_c');
});
test('promotion advances one tier and starts a new category cycle', () => {
  const result = applyRankedActivity({ ...athlete, level: 'iniciante', levelMatches: 5, levelWins: 3, levelPoints: 230 }, 40, true, now);
  assert.equal(result.level, 'serie_c');
  assert.equal(result.levelMatches, 0);
  assert.equal(result.levelPoints, 0);
});

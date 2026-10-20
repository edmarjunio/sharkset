import type { BracketMatch, PointSkillType } from '../types';
import { buildDefaultRefereeState } from './bracketEngine';
import { teamAtServiceIndex } from './serviceOrder';
import { matchScoreboard, scoreboardRules, type ScoreboardState } from './broadcastScoreboard';

/** Local referee aids only. Officialization remains a separate validated operation. */
export function projectBroadcastMatch(previous: BracketMatch, next: ScoreboardState, skill: PointSkillType = 'normal'): BracketMatch {
  if (previous.status === 'completed') return previous;
  const before = matchScoreboard(previous), referee = previous.liveReferee || buildDefaultRefereeState(previous);
  const justClosed = (next.setHistory?.length || 0) === (before.setHistory?.length || 0) + 1;
  const afterPoints = justClosed ? next.setHistory!.at(-1)! : [next.score1, next.score2];
  const delta1 = afterPoints[0] - before.score1, delta2 = afterPoints[1] - before.score2;
  const team = delta1 === 1 && delta2 === 0 ? 1 : delta2 === 1 && delta1 === 0 ? 2 : null;
  const result: BracketMatch = { ...previous, score1: next.score1, score2: next.score2, broadcastScoreboard: next, rules: scoreboardRules(next), status: 'in_progress' };
  if (team) {
    const rotation = (team !== referee.servingTeam ? (referee.serverRotationIndex + 1) % 4 : referee.serverRotationIndex) as 0 | 1 | 2 | 3;
    const swap = (afterPoints[0] + afterPoints[1]) % 6 === 0;
    const pair = team === 1 ? previous.team1 : previous.team2;
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    result.liveReferee = { ...referee, servingTeam: teamAtServiceIndex(referee, rotation), serverRotationIndex: rotation,
      courtSwapsCount: referee.courtSwapsCount + (swap ? 1 : 0), currentSidesSwapped: swap ? !referee.currentSidesSwapped : referee.currentSidesSwapped,
      activeTimeout: null, updatedAt: timestamp, pointHistory: [{ id: crypto.randomUUID(), timestamp, scoringTeam: team as 1 | 2,
        scorerName: pair ? `${pair.player1} / ${pair.player2}` : `Dupla ${team}`, serverName: referee.serviceOrderLabels[referee.serverRotationIndex],
        skill, scoreAfter: `${afterPoints[0]} x ${afterPoints[1]}` }, ...referee.pointHistory].slice(0, 100) };
  }
  return result;
}

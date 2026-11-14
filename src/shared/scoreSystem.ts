import { GAME_RULES, TeamId, TEAM_DEFINITIONS } from './constants';

export interface PlayerScoreInput {
  correctAnswers: number;
  wrongAnswers: number;
  keysCollected: number;
  completedLevel: boolean;
  remainingSeconds: number;
}

export function calculatePlayerScore(input: PlayerScoreInput): number {
  const answerScore = input.correctAnswers * GAME_RULES.CORRECT_ANSWER_POINTS;
  const keyScore = input.keysCollected * GAME_RULES.KEY_COLLECTED_POINTS;
  const completionBonus = input.completedLevel ? GAME_RULES.LEVEL_COMPLETION_POINTS : 0;
  const timeBonus = input.completedLevel ? Math.max(0, Math.floor(input.remainingSeconds * 2)) : 0;
  return answerScore + keyScore + completionBonus + timeBonus;
}

export function calculateAccuracy(correctAnswers: number, wrongAnswers: number): number {
  const total = correctAnswers + wrongAnswers;
  if (total <= 0) return 0;
  return Math.round((correctAnswers / total) * 100);
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  characterId: string;
  outfitColor: string;
  teamId: TeamId | null;
  score: number;
  keysCollected: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  lives: number;
  status: string;
  completionTimeSeconds: number | null;
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: TeamId;
  teamName: string;
  color: string;
  memberCount: number;
  totalScore: number;
  keysCollected: number;
  targetKeys: number;
  correctAnswers: number;
  progressPercent: number;
}

export function buildIndividualLeaderboard(
  players: Omit<LeaderboardEntry, 'rank' | 'accuracy'>[]
): LeaderboardEntry[] {
  const withAccuracy = players.map((p) => ({
    ...p,
    accuracy: calculateAccuracy(p.correctAnswers, p.wrongAnswers),
  }));

  withAccuracy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.keysCollected !== a.keysCollected) return b.keysCollected - a.keysCollected;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const aTime = a.completionTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.completionTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return withAccuracy.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export function buildTeamLeaderboard(
  players: LeaderboardEntry[],
  teamKeysMap: Record<TeamId, number>,
  activeTeams: TeamId[],
  targetKeys: number
): TeamLeaderboardEntry[] {
  const entries: Omit<TeamLeaderboardEntry, 'rank'>[] = activeTeams.map((teamId) => {
    const def = TEAM_DEFINITIONS[teamId];
    const members = players.filter((p) => p.teamId === teamId);
    const totalScore = members.reduce((sum, m) => sum + m.score, 0);
    const correctAnswers = members.reduce((sum, m) => sum + m.correctAnswers, 0);
    const keysCollected = teamKeysMap[teamId] ?? 0;
    const progressPercent = Math.min(100, Math.round((keysCollected / Math.max(1, targetKeys)) * 100));

    return {
      teamId,
      teamName: def.name,
      color: def.color,
      memberCount: members.length,
      totalScore,
      keysCollected,
      targetKeys,
      correctAnswers,
      progressPercent,
    };
  });

  entries.sort((a, b) => {
    if (b.keysCollected !== a.keysCollected) return b.keysCollected - a.keysCollected;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.correctAnswers - a.correctAnswers;
  });

  return entries.map((e, idx) => ({
    ...e,
    rank: idx + 1,
  }));
}

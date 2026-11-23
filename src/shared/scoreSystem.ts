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

export type MvpBadgeId =
  | 'fastest_math'
  | 'true_explorer'
  | 'perfect_accuracy'
  | 'key_master';

export interface MvpBadge {
  id: MvpBadgeId;
  title: string;
  shortLabel: string;
  description: string;
  metricText: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

export interface LeaderboardEntryInput {
  playerId: string;
  name: string;
  characterId: string;
  outfitColor: string;
  teamId: TeamId | null;
  score: number;
  keysCollected: number;
  correctAnswers: number;
  wrongAnswers: number;
  lives: number;
  status: string;
  completionTimeSeconds: number | null;
  fastestAnswerMs?: number | null;
  tilesExploredCount?: number;
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
  fastestAnswerMs: number | null;
  tilesExploredCount: number;
  mvpBadges: MvpBadge[];
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

export function formatAnswerSpeedSeconds(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return 'Instan';
  return `${(ms / 1000).toFixed(1)}d`;
}

export function buildIndividualLeaderboard(
  players: LeaderboardEntryInput[]
): LeaderboardEntry[] {
  const withAccuracy = players.map((p) => {
    const accuracy =
      p.correctAnswers + p.wrongAnswers > 0
        ? calculateAccuracy(p.correctAnswers, p.wrongAnswers)
        : p.wrongAnswers === 0
        ? 100
        : 0;
    const rawAccuracy = calculateAccuracy(p.correctAnswers, p.wrongAnswers);
    return {
      ...p,
      accuracy: rawAccuracy,
      _effectiveZeroMistake: accuracy === 100,
      fastestAnswerMs: p.fastestAnswerMs ?? null,
      tilesExploredCount: Math.max(1, p.tilesExploredCount ?? 12),
      mvpBadges: [] as MvpBadge[],
    };
  });

  withAccuracy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.keysCollected !== a.keysCollected) return b.keysCollected - a.keysCollected;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const aTime = a.completionTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.completionTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const ranked: LeaderboardEntry[] = withAccuracy.map((entry, idx) => {
    const { _effectiveZeroMistake, ...rest } = entry;
    void _effectiveZeroMistake;
    return {
      ...rest,
      rank: idx + 1,
    };
  });

  if (ranked.length === 0) return ranked;

  // 1. "Si Kilat Matematika" — Fastest answer time (or fastest completion / rank #1 fallback)
  const candidatesWithSpeed = ranked.filter(
    (e) => e.fastestAnswerMs !== null && e.fastestAnswerMs > 0
  );
  let fastestWinner: LeaderboardEntry = ranked[0];
  if (candidatesWithSpeed.length > 0) {
    fastestWinner = candidatesWithSpeed.reduce((best, cur) =>
      (cur.fastestAnswerMs ?? Infinity) < (best.fastestAnswerMs ?? Infinity) ? cur : best
    );
  } else {
    const withCompletion = ranked.filter((e) => e.completionTimeSeconds !== null);
    if (withCompletion.length > 0) {
      fastestWinner = withCompletion.reduce((best, cur) =>
        (cur.completionTimeSeconds ?? Infinity) < (best.completionTimeSeconds ?? Infinity)
          ? cur
          : best
      );
    }
  }
  fastestWinner.mvpBadges.push({
    id: 'fastest_math',
    title: 'Si Kilat Matematika',
    shortLabel: 'SI KILAT',
    description: 'Waktu jawab soal matematika tercepat di kelas',
    metricText: fastestWinner.fastestAnswerMs
      ? `Jawab ${formatAnswerSpeedSeconds(fastestWinner.fastestAnswerMs)}`
      : fastestWinner.completionTimeSeconds
      ? `Selesai ${fastestWinner.completionTimeSeconds}d`
      : 'Respons Tercepat',
    color: '#38BDF8',
    borderColor: '#7DD3FC',
    bgColor: 'rgba(8, 47, 73, 0.85)',
  });

  // 2. "Penjelajah Sejati" — Highest tilesExploredCount (widest map explorer)
  const explorerWinner = ranked.reduce((best, cur) =>
    cur.tilesExploredCount > best.tilesExploredCount ? cur : best
  );
  explorerWinner.mvpBadges.push({
    id: 'true_explorer',
    title: 'Penjelajah Sejati',
    shortLabel: 'PENJELAJAH',
    description: 'Pembuka area dan ruangan labirin terluas',
    metricText: `${explorerWinner.tilesExploredCount} Tile Dijelajahi`,
    color: '#C084FC',
    borderColor: '#D8B4FE',
    bgColor: 'rgba(59, 7, 100, 0.85)',
  });

  // 3. "Akurasi Sempurna 100%" — Awarded to all players with 100% accuracy (correctAnswers >= 1),
  // or to top zero-mistake player if session ended before questions were answered
  const perfectPlayers = ranked.filter((e) => e.accuracy === 100 && e.correctAnswers >= 1);
  const accuracyRecipients =
    perfectPlayers.length > 0
      ? perfectPlayers
      : [ranked.find((e) => e.wrongAnswers === 0) ?? ranked[0]];

  for (const recipient of accuracyRecipients) {
    recipient.mvpBadges.push({
      id: 'perfect_accuracy',
      title: 'Akurasi Sempurna 100%',
      shortLabel: 'AKURASI 100%',
      description: 'Menjawab soal matematika dengan ketepatan sempurna',
      metricText:
        recipient.correctAnswers > 0
          ? `100% (${recipient.correctAnswers}/${recipient.correctAnswers} Benar)`
          : '100% Tanpa Salah',
      color: '#10B981',
      borderColor: '#6EE7B7',
      bgColor: 'rgba(6, 78, 59, 0.85)',
    });
  }

  // 4. "Kolektor Kunci Utama" — Top key collector when keysCollected >= 1
  const topKeyPlayer = ranked.reduce((best, cur) =>
    cur.keysCollected > best.keysCollected ? cur : best
  );
  if (topKeyPlayer.keysCollected >= 1) {
    topKeyPlayer.mvpBadges.push({
      id: 'key_master',
      title: 'Kolektor Kunci Utama',
      shortLabel: 'RAJA KUNCI',
      description: 'Pengumpul kunci labirin terbanyak',
      metricText: `${topKeyPlayer.keysCollected} Kunci Emas`,
      color: '#FACC15',
      borderColor: '#FEF08A',
      bgColor: 'rgba(66, 32, 6, 0.85)',
    });
  }

  return ranked;
}

export interface MvpHighlightCard {
  badge: MvpBadge;
  winner: LeaderboardEntry;
}

export function computeMvpHighlights(leaderboard: LeaderboardEntry[]): MvpHighlightCard[] {
  if (leaderboard.length === 0) return [];
  const targetIds: MvpBadgeId[] = ['fastest_math', 'true_explorer', 'perfect_accuracy'];
  const cards: MvpHighlightCard[] = [];

  for (const badgeId of targetIds) {
    const winner = leaderboard.find((entry) => entry.mvpBadges.some((b) => b.id === badgeId));
    const badge = winner?.mvpBadges.find((b) => b.id === badgeId);
    if (winner && badge) {
      cards.push({ badge, winner });
    }
  }
  return cards;
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

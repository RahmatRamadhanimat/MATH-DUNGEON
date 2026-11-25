export type StreakTierId = 'none' | 'combo_3' | 'on_fire_5' | 'blue_flame_7';

export interface StreakTierInfo {
  tier: StreakTierId;
  streakCount: number;
  multiplier: number;
  multiplierLabel: string;
  badgeLabel: string;
  shortLabel: string;
  auraType: 'none' | 'gold_flame' | 'blue_flame';
  primaryColor: string;
  secondaryColor: string;
  glowRgba: string;
  particleColors: string[];
}

export function evaluateStreakTier(rawStreakCount: number | null | undefined): StreakTierInfo {
  const streakCount = Math.max(0, Math.floor(Number(rawStreakCount) || 0));

  if (streakCount >= 7) {
    return {
      tier: 'blue_flame_7',
      streakCount,
      multiplier: 2.5,
      multiplierLabel: 'x2.5',
      badgeLabel: `API BIRU ${streakCount}x · Poin x2.5`,
      shortLabel: 'API BIRU x2.5',
      auraType: 'blue_flame',
      primaryColor: '#38BDF8',
      secondaryColor: '#E0F2FE',
      glowRgba: 'rgba(56, 189, 248, 0.48)',
      particleColors: ['#38BDF8', '#7DD3FC', '#C084FC', '#F8FAFC'],
    };
  }

  if (streakCount >= 5) {
    return {
      tier: 'on_fire_5',
      streakCount,
      multiplier: 2.0,
      multiplierLabel: 'x2.0',
      badgeLabel: `ON FIRE ${streakCount}x · Poin x2.0`,
      shortLabel: 'ON FIRE x2.0',
      auraType: 'gold_flame',
      primaryColor: '#F97316',
      secondaryColor: '#FACC15',
      glowRgba: 'rgba(249, 115, 22, 0.46)',
      particleColors: ['#FACC15', '#F97316', '#EF4444', '#FEF08A'],
    };
  }

  if (streakCount >= 3) {
    return {
      tier: 'combo_3',
      streakCount,
      multiplier: 1.5,
      multiplierLabel: 'x1.5',
      badgeLabel: `COMBO ${streakCount}x · Poin x1.5`,
      shortLabel: 'COMBO x1.5',
      auraType: 'gold_flame',
      primaryColor: '#FACC15',
      secondaryColor: '#FEF08A',
      glowRgba: 'rgba(250, 204, 21, 0.42)',
      particleColors: ['#FACC15', '#FDE047', '#F59E0B', '#FEF9C3'],
    };
  }

  return {
    tier: 'none',
    streakCount,
    multiplier: 1.0,
    multiplierLabel: 'x1.0',
    badgeLabel: streakCount > 0 ? `Streak ${streakCount}x` : '',
    shortLabel: streakCount > 0 ? `${streakCount}x` : '',
    auraType: 'none',
    primaryColor: '#94A3B8',
    secondaryColor: '#CBD5E1',
    glowRgba: 'rgba(148, 163, 184, 0)',
    particleColors: [],
  };
}

export function computeStreakQuestionPoints(params: {
  basePoints: number;
  newStreakCount: number;
}): {
  totalPoints: number;
  bonusStreakPoints: number;
  tierInfo: StreakTierInfo;
} {
  const base = Math.max(0, Math.round(params.basePoints));
  const tierInfo = evaluateStreakTier(params.newStreakCount);
  const totalPoints = Math.round(base * tierInfo.multiplier);
  const bonusStreakPoints = Math.max(0, totalPoints - base);

  return {
    totalPoints,
    bonusStreakPoints,
    tierInfo,
  };
}

export function buildStreakMilestoneAnnouncement(
  playerName: string,
  newStreakCount: number
): string | null {
  const cleanName = (playerName || 'Petualang').trim();
  if (newStreakCount === 3) {
    return `🔥 COMBO STREAK! ${cleanName} mencapai 3 Jawaban Benar Beruntun (COMBO x1.5 Poin)!`;
  }
  if (newStreakCount === 5) {
    return `🔥 ${cleanName} sedang ON FIRE (5 Jawaban Benar Beruntun · Poin x2.0)!`;
  }
  if (newStreakCount === 7 || (newStreakCount > 7 && newStreakCount % 2 === 1)) {
    return `🔥⚡ ${cleanName} menyalakan AURA API BIRU (${newStreakCount} Jawaban Benar Beruntun · Poin x2.5)!`;
  }
  return null;
}

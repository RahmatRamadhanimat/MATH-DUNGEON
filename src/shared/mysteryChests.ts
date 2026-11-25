export type MysteryPowerUpType = 'torch_sight' | 'speed_boots' | 'heart_shield';

export interface MysteryPowerUpDefinition {
  type: MysteryPowerUpType;
  label: string;
  shortLabel: string;
  description: string;
  durationSeconds: number;
  bonusPoints: number;
  accentColor: string;
  bannerText: string;
  subText: string;
}

export interface MazeChestObject {
  id: string;
  roomId: string;
  roomName: string;
  rewardType: MysteryPowerUpType;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  openedBy: string | null;
  openedByPlayers: string[];
}

export interface GrantedPowerUpPayload {
  chestId: string;
  roomName: string;
  type: MysteryPowerUpType;
  label: string;
  description: string;
  durationSeconds: number;
  bonusPoints: number;
  accentColor: string;
  bannerText: string;
  subText: string;
  torchExpiresAt: number | null;
  speedExpiresAt: number | null;
}

export interface ActivePowerUpBuffs {
  torchRemainingSeconds: number;
  speedRemainingSeconds: number;
  visionMultiplier: number;
  speedMultiplier: number;
}

export const MYSTERY_POWER_UP_ORDER: MysteryPowerUpType[] = [
  'torch_sight',
  'speed_boots',
  'heart_shield',
];

export const MYSTERY_POWER_UPS: Record<MysteryPowerUpType, MysteryPowerUpDefinition> = {
  torch_sight: {
    type: 'torch_sight',
    label: 'Obor Terang (20 Detik)',
    shortLabel: 'Obor Terang',
    description: 'Jarak pandang kabut meluas (+65% radius cahaya) selama 20 detik!',
    durationSeconds: 20,
    bonusPoints: 75,
    accentColor: '#FACC15',
    bannerText: '★ OBOR TERANG! ★',
    subText: 'JARAK PANDANG MELUAS 20D',
  },
  speed_boots: {
    type: 'speed_boots',
    label: 'Sepatu Kilat (15 Detik)',
    shortLabel: 'Sepatu Kilat',
    description: 'Kecepatan jalan meningkat (+45% lebih cepat) selama 15 detik!',
    durationSeconds: 15,
    bonusPoints: 75,
    accentColor: '#38BDF8',
    bannerText: '★ SEPATU KILAT! ★',
    subText: 'LARI +45% LEBIH CEPAT 15D',
  },
  heart_shield: {
    type: 'heart_shield',
    label: 'Perisai Hati (+1 HP)',
    shortLabel: 'Perisai Hati',
    description: 'Memulihkan +1 HP (atau memberikan +1 Hati Perisai ekstra)!',
    durationSeconds: 0,
    bonusPoints: 100,
    accentColor: '#F43F5E',
    bannerText: '★ PERISAI HATI! ★',
    subText: '+1 HP & BONUS 100 POIN',
  },
};

export const TORCH_VISION_MULTIPLIER = 1.65;
export const SPEED_BOOTS_MULTIPLIER = 1.45;

export function isMysteryChestId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('chest-'));
}

export function isChestAvailableForPlayer(chest: MazeChestObject, playerId: string): boolean {
  if (!playerId) return chest.openedBy === null;
  return !chest.openedByPlayers.includes(playerId);
}

export function evaluateActivePowerUps(params: {
  torchExpiresAt?: number | null;
  speedExpiresAt?: number | null;
  nowMs?: number;
}): ActivePowerUpBuffs {
  const now = params.nowMs ?? Date.now();
  const torchMs = Math.max(0, (params.torchExpiresAt ?? 0) - now);
  const speedMs = Math.max(0, (params.speedExpiresAt ?? 0) - now);

  const torchRemainingSeconds = torchMs > 0 ? Math.ceil(torchMs / 1000) : 0;
  const speedRemainingSeconds = speedMs > 0 ? Math.ceil(speedMs / 1000) : 0;

  return {
    torchRemainingSeconds,
    speedRemainingSeconds,
    visionMultiplier: torchRemainingSeconds > 0 ? TORCH_VISION_MULTIPLIER : 1,
    speedMultiplier: speedRemainingSeconds > 0 ? SPEED_BOOTS_MULTIPLIER : 1,
  };
}

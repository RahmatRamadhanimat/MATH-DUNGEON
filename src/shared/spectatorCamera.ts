import { PlayerStatus } from './constants';

export type SpectatorCameraMode = 'self' | 'follow_student' | 'free_cam';

export interface SpectatablePlayer {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  x: number;
  y: number;
  score: number;
  keysCollected: number;
  lives: number;
  status: PlayerStatus;
  characterId: string;
  outfitColor: string;
}

export interface SpectatorCameraResolution {
  activeMode: SpectatorCameraMode;
  targetX: number;
  targetY: number;
  followedPlayer: SpectatablePlayer | null;
}

/**
 * Resolves the world-space camera target (targetX, targetY) and active spectator state
 * for Teacher Free-Cam, Student Follow-Cam (via Leaderboard click), or normal Self camera.
 */
export function resolveSpectatorCameraTarget(params: {
  mode: SpectatorCameraMode;
  spectatedPlayerId: string | null;
  localPos: { x: number; y: number };
  freeCamPos: { x: number; y: number };
  players: SpectatablePlayer[];
  interpolatedPositions?: Map<string, { x: number; y: number }>;
}): SpectatorCameraResolution {
  const { mode, spectatedPlayerId, localPos, freeCamPos, players, interpolatedPositions } = params;

  if (mode === 'follow_student' && spectatedPlayerId) {
    const target = players.find((p) => p.id === spectatedPlayerId);
    if (target) {
      const interp = interpolatedPositions?.get(target.id);
      return {
        activeMode: 'follow_student',
        targetX: interp?.x ?? target.x,
        targetY: interp?.y ?? target.y,
        followedPlayer: target,
      };
    }
  }

  if (mode === 'free_cam') {
    return {
      activeMode: 'free_cam',
      targetX: freeCamPos.x,
      targetY: freeCamPos.y,
      followedPlayer: null,
    };
  }

  return {
    activeMode: 'self',
    targetX: localPos.x,
    targetY: localPos.y,
    followedPlayer: null,
  };
}

/**
 * Advances the Teacher/Spectator Free-Cam position smoothly across the maze without wall collision,
 * clamped to the maze world boundaries.
 */
export function stepFreeCamPosition(params: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  dt: number;
  mazeWidth: number;
  mazeHeight: number;
  tileSize?: number;
  speed?: number;
}): { x: number; y: number } {
  const tileSize = params.tileSize ?? 32;
  const speed = params.speed ?? 320;
  const minX = tileSize * 0.5;
  const maxX = Math.max(minX, (params.mazeWidth - 0.5) * tileSize);
  const minY = tileSize * 0.5;
  const maxY = Math.max(minY, (params.mazeHeight - 0.5) * tileSize);

  const nextX = Math.min(maxX, Math.max(minX, params.x + params.dx * speed * params.dt));
  const nextY = Math.min(maxY, Math.max(minY, params.y + params.dy * speed * params.dt));

  return { x: nextX, y: nextY };
}

/**
 * Cycles to the next (+1) or previous (-1) student in the leaderboard or room player list.
 */
export function cycleSpectatedStudentId(
  playerIds: string[],
  currentSpectatedId: string | null,
  delta: 1 | -1
): string | null {
  if (playerIds.length === 0) return null;
  if (!currentSpectatedId) {
    return delta > 0 ? playerIds[0] : playerIds[playerIds.length - 1];
  }
  const idx = playerIds.indexOf(currentSpectatedId);
  if (idx === -1) {
    return playerIds[0];
  }
  const nextIdx = (idx + delta + playerIds.length) % playerIds.length;
  return playerIds[nextIdx];
}

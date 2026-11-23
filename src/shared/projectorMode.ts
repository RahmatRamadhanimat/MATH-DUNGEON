import { GameMode, PlayerStatus, TeamId } from './constants';
import { LeaderboardEntry, TeamLeaderboardEntry } from './scoreSystem';

export interface FullMazeFitTransform {
  tileScale: number;
  mapPixelW: number;
  mapPixelH: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Computes an aspect-preserving fit transform so the entire maze (e.g. 35x35 up to 75x75)
 * renders crisply centered inside the Big Screen projector canvas with clean margins.
 */
export function computeFullMazeFitTransform(options: {
  canvasWidth: number;
  canvasHeight: number;
  mazeWidth: number;
  mazeHeight: number;
  paddingPx?: number;
}): FullMazeFitTransform {
  const padding = Math.max(0, options.paddingPx ?? 20);
  const safeCanvasW = Math.max(1, options.canvasWidth);
  const safeCanvasH = Math.max(1, options.canvasHeight);
  const safeMazeW = Math.max(1, options.mazeWidth);
  const safeMazeH = Math.max(1, options.mazeHeight);

  const availW = Math.max(1, safeCanvasW - padding * 2);
  const availH = Math.max(1, safeCanvasH - padding * 2);
  const tileScale = Math.min(availW / safeMazeW, availH / safeMazeH);
  const mapPixelW = tileScale * safeMazeW;
  const mapPixelH = tileScale * safeMazeH;

  return {
    tileScale,
    mapPixelW,
    mapPixelH,
    offsetX: (safeCanvasW - mapPixelW) / 2,
    offsetY: (safeCanvasH - mapPixelH) / 2,
  };
}

/**
 * Converts a world pixel coordinate (in maze tileSize units) to projector canvas pixel coordinates.
 */
export function worldPixelToProjectorPoint(options: {
  worldX: number;
  worldY: number;
  tileSize: number;
  transform: FullMazeFitTransform;
}): { x: number; y: number } {
  const tileX = options.worldX / Math.max(1, options.tileSize);
  const tileY = options.worldY / Math.max(1, options.tileSize);
  return {
    x: options.transform.offsetX + tileX * options.transform.tileScale,
    y: options.transform.offsetY + tileY * options.transform.tileScale,
  };
}

export type ProjectorClockUrgency = 'normal' | 'warning' | 'critical';

export interface ProjectorClockInfo {
  formatted: string;
  urgency: ProjectorClockUrgency;
}

export function formatProjectorClock(remainingSeconds: number): ProjectorClockInfo {
  const s = Math.max(0, Math.floor(remainingSeconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  const urgency: ProjectorClockUrgency =
    s <= 30 ? 'critical' : s <= 60 ? 'warning' : 'normal';
  return { formatted, urgency };
}

export interface ProjectorPlayerLike {
  id: string;
  role: 'teacher' | 'student';
  status: PlayerStatus;
  animState?: string;
  keysCollected: number;
}

export interface ProjectorBroadcastSummary {
  totalStudents: number;
  activeStudents: number;
  escapedStudents: number;
  answeringStudents: number;
  eliminatedStudents: number;
  collectedKeysDisplay: number;
  targetKeys: number;
  keyProgressPercent: number;
  isExitOpenForClass: boolean;
  podiumSlots: Array<{ place: 1 | 2 | 3; entry: LeaderboardEntry | null }>;
  runnerUps: LeaderboardEntry[];
  topTeams: TeamLeaderboardEntry[];
}

export function buildProjectorBroadcastSummary(options: {
  players: ProjectorPlayerLike[];
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  mode: GameMode;
  sharedKeysCollected: number;
  teamKeysCollected: Record<TeamId, number>;
  targetKeys: number;
}): ProjectorBroadcastSummary {
  const students = options.players.filter((p) => p.role !== 'teacher');
  const totalStudents = students.length;
  let activeStudents = 0;
  let escapedStudents = 0;
  let answeringStudents = 0;
  let eliminatedStudents = 0;

  for (const s of students) {
    if (s.status === 'escaped') escapedStudents++;
    else if (s.status === 'eliminated' || s.status === 'spectator') eliminatedStudents++;
    else activeStudents++;

    if (s.animState === 'answering' && s.status === 'active') {
      answeringStudents++;
    }
  }

  const targetKeys = Math.max(1, options.targetKeys);
  let collectedKeysDisplay = 0;
  if (options.mode === 'coop') {
    collectedKeysDisplay = options.sharedKeysCollected;
  } else if (options.mode === 'team') {
    const teamCounts = Object.values(options.teamKeysCollected || {});
    collectedKeysDisplay = teamCounts.length > 0 ? Math.max(...teamCounts) : 0;
  } else {
    collectedKeysDisplay =
      options.leaderboard.length > 0
        ? Math.max(...options.leaderboard.map((e) => e.keysCollected))
        : 0;
  }

  const keyProgressPercent = Math.min(
    100,
    Math.round((collectedKeysDisplay / targetKeys) * 100)
  );
  const isExitOpenForClass = collectedKeysDisplay >= targetKeys;

  const first = options.leaderboard[0] ?? null;
  const second = options.leaderboard[1] ?? null;
  const third = options.leaderboard[2] ?? null;

  // Classic championship podium order: #2 on left, #1 elevated in center, #3 on right
  const podiumSlots: Array<{ place: 1 | 2 | 3; entry: LeaderboardEntry | null }> = [
    { place: 2, entry: second },
    { place: 1, entry: first },
    { place: 3, entry: third },
  ];

  return {
    totalStudents,
    activeStudents,
    escapedStudents,
    answeringStudents,
    eliminatedStudents,
    collectedKeysDisplay,
    targetKeys,
    keyProgressPercent,
    isExitOpenForClass,
    podiumSlots,
    runnerUps: options.leaderboard.slice(3, 10),
    topTeams: options.teamLeaderboard.slice(0, 5),
  };
}

export interface ProjectorChatEvent {
  id: string;
  senderName: string;
  text: string;
  type: 'chat' | 'emoji' | 'system';
  timestamp: number;
}

export function selectProjectorFeedEvents(
  chatHistory: ProjectorChatEvent[],
  maxItems = 3
): ProjectorChatEvent[] {
  if (!chatHistory.length || maxItems <= 0) return [];
  return chatHistory.slice(-maxItems).reverse();
}

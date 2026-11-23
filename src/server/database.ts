import fs from 'node:fs';
import path from 'node:path';
import { GameMode, DifficultyLevel, MathCategoryId, RoomSettings } from '../shared/constants';
import { LeaderboardEntry, TeamLeaderboardEntry } from '../shared/scoreSystem';

export interface PersistedPlayerSnapshot {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  characterId: string;
  outfitColor: string;
  teamId: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | null;
  ready: boolean;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  score: number;
  lives: number;
  keysCollected: number;
  correctAnswers: number;
  wrongAnswers: number;
  status: 'active' | 'eliminated' | 'spectator' | 'escaped';
  completionTimeSeconds: number | null;
}

export interface PersistedKeyProgress {
  id: string;
  collectedBy: string | null;
  collectedByPlayers: string[];
  collectedByTeams: string[];
}

export interface PersistedChatItem {
  id: string;
  senderId: string;
  senderName: string;
  teamId: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | null;
  text: string;
  type: 'chat' | 'emoji' | 'system';
  timestamp: number;
}

export interface PersistedRoomSnapshot {
  code: string;
  teacherId: string;
  teacherName: string;
  locked: boolean;
  status: 'lobby' | 'playing' | 'paused' | 'ended';
  settings: RoomSettings;
  mazeSeed: number;
  remainingSeconds: number;
  startedAt: number | null;
  createdAt: number;
  sharedKeysCollected?: number;
  teamKeysCollected?: Record<'red' | 'blue' | 'green' | 'yellow' | 'purple', number>;
  doorOpen?: boolean;
  teamDoorOpen?: Record<'red' | 'blue' | 'green' | 'yellow' | 'purple', boolean>;
  playerDoorOpen?: string[];
  collectedKeys?: PersistedKeyProgress[];
  players?: PersistedPlayerSnapshot[];
  chatHistory?: PersistedChatItem[];
}

export interface StoredUserProfile {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  characterId: string;
  outfitColor: string;
  gamesPlayed: number;
  totalScore: number;
  totalKeys: number;
  totalCorrect: number;
  totalWrong: number;
  lastActiveAt: string;
}

export interface StoredGameResult {
  id: string;
  roomCode: string;
  teacherName: string;
  mode: GameMode;
  difficulty: DifficultyLevel;
  mapLevel: number;
  keyCount: number;
  playerCount: number;
  durationSeconds: number;
  completedAt: string;
  summaryText: string;
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
}

export interface CategoryLearningStat {
  category: MathCategoryId | 'custom';
  attempts: number;
  correct: number;
  wrong: number;
  totalResponseMs?: number;
}

export interface DatabaseSchema {
  users: Record<string, StoredUserProfile>;
  gameHistory: StoredGameResult[];
  categoryStats: Record<string, CategoryLearningStat>;
  activeRooms: Record<string, PersistedRoomSnapshot>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'math_maze_db.json');

const INITIAL_DB: DatabaseSchema = {
  users: {
    'teacher-1': {
      id: 'teacher-1',
      name: 'Budi Santoso, S.Pd.',
      role: 'teacher',
      characterId: 'scholar',
      outfitColor: '#0891B2',
      gamesPlayed: 12,
      totalScore: 0,
      totalKeys: 0,
      totalCorrect: 0,
      totalWrong: 0,
      lastActiveAt: new Date().toISOString(),
    },
    'student-siti': {
      id: 'student-siti',
      name: 'Siti Aminah',
      role: 'student',
      characterId: 'mage',
      outfitColor: '#7C3AED',
      gamesPlayed: 4,
      totalScore: 3450,
      totalKeys: 15,
      totalCorrect: 18,
      totalWrong: 2,
      lastActiveAt: new Date().toISOString(),
    },
    'student-rizky': {
      id: 'student-rizky',
      name: 'Rizky Pratama',
      role: 'student',
      characterId: 'knight',
      outfitColor: '#2563EB',
      gamesPlayed: 4,
      totalScore: 3120,
      totalKeys: 14,
      totalCorrect: 16,
      totalWrong: 3,
      lastActiveAt: new Date().toISOString(),
    },
  },
  gameHistory: [
    {
      id: 'match-seed-1',
      roomCode: 'MATH-4821',
      teacherName: 'Budi Santoso, S.Pd.',
      mode: 'team',
      difficulty: 'medium',
      mapLevel: 2,
      keyCount: 5,
      playerCount: 24,
      durationSeconds: 215,
      completedAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      summaryText: 'Team Blue menang dengan 5/5 Kunci & akurasi kelas 88%!',
      leaderboard: [
        {
          rank: 1,
          playerId: 'student-siti',
          name: 'Siti Aminah',
          characterId: 'mage',
          outfitColor: '#7C3AED',
          teamId: 'blue',
          score: 960,
          keysCollected: 3,
          correctAnswers: 5,
          wrongAnswers: 0,
          accuracy: 100,
          lives: 3,
          status: 'escaped',
          completionTimeSeconds: 185,
          fastestAnswerMs: 1650,
          tilesExploredCount: 142,
          mvpBadges: [],
        },
        {
          rank: 2,
          playerId: 'student-rizky',
          name: 'Rizky Pratama',
          characterId: 'knight',
          outfitColor: '#2563EB',
          teamId: 'red',
          score: 810,
          keysCollected: 2,
          correctAnswers: 4,
          wrongAnswers: 1,
          accuracy: 80,
          lives: 2,
          status: 'escaped',
          completionTimeSeconds: 204,
          fastestAnswerMs: 2400,
          tilesExploredCount: 168,
          mvpBadges: [],
        },
      ],
      teamLeaderboard: [
        {
          rank: 1,
          teamId: 'blue',
          teamName: 'Team Blue',
          color: '#3B82F6',
          memberCount: 6,
          totalScore: 4120,
          keysCollected: 5,
          targetKeys: 5,
          correctAnswers: 24,
          progressPercent: 100,
        },
        {
          rank: 2,
          teamId: 'red',
          teamName: 'Team Red',
          color: '#EF4444',
          memberCount: 6,
          totalScore: 3650,
          keysCollected: 4,
          targetKeys: 5,
          correctAnswers: 21,
          progressPercent: 80,
        },
      ],
    },
  ],
  categoryStats: {
    multiplication: {
      category: 'multiplication',
      attempts: 42,
      correct: 38,
      wrong: 4,
      totalResponseMs: 42 * 3400,
    },
    fractions: {
      category: 'fractions',
      attempts: 31,
      correct: 23,
      wrong: 8,
      totalResponseMs: 31 * 5900,
    },
    algebra: {
      category: 'algebra',
      attempts: 24,
      correct: 17,
      wrong: 7,
      totalResponseMs: 24 * 6800,
    },
    linear_equations: {
      category: 'linear_equations',
      attempts: 18,
      correct: 13,
      wrong: 5,
      totalResponseMs: 18 * 7400,
    },
    percentages: {
      category: 'percentages',
      attempts: 22,
      correct: 17,
      wrong: 5,
      totalResponseMs: 22 * 5300,
    },
    division: {
      category: 'division',
      attempts: 28,
      correct: 23,
      wrong: 5,
      totalResponseMs: 28 * 4200,
    },
    mixed_ops: {
      category: 'mixed_ops',
      attempts: 20,
      correct: 16,
      wrong: 4,
      totalResponseMs: 20 * 5100,
    },
  },
  activeRooms: {},
};

export class GameDatabase {
  private data: DatabaseSchema;
  private readonly dbFile: string;
  private readonly dataDir: string;

  constructor(dbFilePath: string = DB_FILE) {
    this.dbFile = dbFilePath;
    this.dataDir = path.dirname(dbFilePath);
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        const mergedCategoryStats: Record<string, CategoryLearningStat> = structuredClone(
          INITIAL_DB.categoryStats
        );
        for (const [key, stat] of Object.entries(parsed.categoryStats ?? {})) {
          const base = mergedCategoryStats[key];
          if (base && stat.attempts < base.attempts) {
            mergedCategoryStats[key] = {
              category: stat.category,
              attempts: base.attempts + stat.attempts,
              correct: base.correct + stat.correct,
              wrong: base.wrong + stat.wrong,
              totalResponseMs:
                (base.totalResponseMs ?? base.attempts * 4500) +
                (stat.totalResponseMs ?? stat.attempts * 4500),
            };
          } else {
            mergedCategoryStats[key] = stat;
          }
        }
        return {
          users: parsed.users ?? structuredClone(INITIAL_DB.users),
          gameHistory: parsed.gameHistory ?? structuredClone(INITIAL_DB.gameHistory),
          categoryStats: mergedCategoryStats,
          activeRooms: parsed.activeRooms ?? {},
        };
      }
    } catch (err) {
      console.error('Database load warning, using initial seed:', err);
    }
    const seed = structuredClone(INITIAL_DB);
    this.saveToDisk(seed);
    return seed;
  }

  private saveToDisk(state: DatabaseSchema = this.data): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const tmpFile = `${this.dbFile}.tmp-${process.pid}`;
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tmpFile, this.dbFile);
    } catch (err) {
      console.error('Database write warning:', err);
    }
  }

  public upsertUserProfile(profile: {
    id: string;
    name: string;
    role: 'teacher' | 'student';
    characterId: string;
    outfitColor: string;
  }): StoredUserProfile {
    const existing = this.data.users[profile.id];
    const updated: StoredUserProfile = {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      characterId: profile.characterId,
      outfitColor: profile.outfitColor,
      gamesPlayed: existing?.gamesPlayed ?? 0,
      totalScore: existing?.totalScore ?? 0,
      totalKeys: existing?.totalKeys ?? 0,
      totalCorrect: existing?.totalCorrect ?? 0,
      totalWrong: existing?.totalWrong ?? 0,
      lastActiveAt: new Date().toISOString(),
    };
    this.data.users[profile.id] = updated;
    this.saveToDisk();
    return updated;
  }

  public recordQuestionAttempt(
    category: MathCategoryId | 'custom',
    isCorrect: boolean,
    responseMs?: number
  ): void {
    const stat = this.data.categoryStats[category] ?? {
      category,
      attempts: 0,
      correct: 0,
      wrong: 0,
      totalResponseMs: 0,
    };
    stat.attempts += 1;
    if (isCorrect) stat.correct += 1;
    else stat.wrong += 1;
    const clampedMs =
      typeof responseMs === 'number' && Number.isFinite(responseMs) && responseMs > 0
        ? Math.min(60000, Math.max(180, Math.round(responseMs)))
        : 4200;
    stat.totalResponseMs = (stat.totalResponseMs ?? 0) + clampedMs;
    this.data.categoryStats[category] = stat;
    this.saveToDisk();
  }

  public saveGameResult(result: StoredGameResult): void {
    this.data.gameHistory.unshift(result);
    if (this.data.gameHistory.length > 50) {
      this.data.gameHistory.length = 50;
    }

    for (const entry of result.leaderboard) {
      const existing = this.data.users[entry.playerId];
      this.data.users[entry.playerId] = {
        id: entry.playerId,
        name: entry.name,
        role: 'student',
        characterId: entry.characterId,
        outfitColor: entry.outfitColor,
        gamesPlayed: (existing?.gamesPlayed ?? 0) + 1,
        totalScore: (existing?.totalScore ?? 0) + entry.score,
        totalKeys: (existing?.totalKeys ?? 0) + entry.keysCollected,
        totalCorrect: (existing?.totalCorrect ?? 0) + entry.correctAnswers,
        totalWrong: (existing?.totalWrong ?? 0) + entry.wrongAnswers,
        lastActiveAt: new Date().toISOString(),
      };
    }

    this.saveToDisk();
  }

  public saveActiveRoom(snapshot: PersistedRoomSnapshot): void {
    this.data.activeRooms[snapshot.code] = snapshot;
    // Prune rooms older than 12 hours
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const [code, r] of Object.entries(this.data.activeRooms)) {
      if (r.createdAt < cutoff) {
        delete this.data.activeRooms[code];
      }
    }
    this.saveToDisk();
  }

  public getActiveRooms(reloadFromDisk = false): PersistedRoomSnapshot[] {
    if (reloadFromDisk) {
      this.data = this.loadFromDisk();
    }
    const cutoff = Date.now() - 12 * 3600 * 1000;
    return Object.values(this.data.activeRooms).filter((r) => r.createdAt >= cutoff);
  }

  public getActiveRoomByCode(code: string, reloadFromDisk = false): PersistedRoomSnapshot | null {
    if (reloadFromDisk) {
      this.data = this.loadFromDisk();
    }
    const snap = this.data.activeRooms[code];
    if (!snap) return null;
    const cutoff = Date.now() - 12 * 3600 * 1000;
    if (snap.createdAt < cutoff) {
      delete this.data.activeRooms[code];
      this.saveToDisk();
      return null;
    }
    return snap;
  }

  public removeActiveRoom(code: string): void {
    if (this.data.activeRooms[code]) {
      delete this.data.activeRooms[code];
      this.saveToDisk();
    }
  }

  public getDashboardAnalytics() {
    return {
      gameHistory: this.data.gameHistory,
      categoryStats: Object.values(this.data.categoryStats),
      topStudents: Object.values(this.data.users)
        .filter((u) => u.role === 'student')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 20),
      databaseEngine: process.env.DATABASE_URL ? 'PostgreSQL + Persistent Mirror' : 'Server Persistent Storage (JSON/SQL-Ready)',
    };
  }
}

export const db = new GameDatabase();

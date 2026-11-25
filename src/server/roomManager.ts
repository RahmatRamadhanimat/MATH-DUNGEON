import {
  CHARACTER_PRESETS,
  DEFAULT_ROOM_SETTINGS,
  Direction,
  GAME_RULES,
  PlayerAnimState,
  PlayerStatus,
  RoomSettings,
  TEAM_DEFINITIONS,
  TEAM_ORDER,
  TeamId,
  TileType,
  normalizeRoomCode,
} from '../shared/constants';
import { normalizeMazeBiome } from '../shared/biomeThemes';
import { GeneratedMaze, generateProceduralMaze, isWalkableTile } from '../shared/mazeGenerator';
import { MathQuestion, sanitizeCustomQuestions } from '../shared/questionGenerator';
import {
  buildIndividualLeaderboard,
  buildTeamLeaderboard,
  LeaderboardEntry,
  TeamLeaderboardEntry,
} from '../shared/scoreSystem';
import { GameDatabase, PersistedRoomSnapshot } from './database';
import type { AnswerResultPayload } from './questionSubmission';

export interface ServerPlayer {
  id: string;
  socketId: string;
  name: string;
  role: 'teacher' | 'student';
  characterId: string;
  outfitColor: string;
  teamId: TeamId | null;
  ready: boolean;
  connected: boolean;
  x: number;
  y: number;
  direction: Direction;
  animState: PlayerAnimState;
  score: number;
  lives: number;
  keysCollected: number;
  correctAnswers: number;
  wrongAnswers: number;
  status: PlayerStatus;
  completionTimeSeconds: number | null;
  fastestAnswerMs?: number | null;
  tilesExploredCount?: number;
  visitedTiles?: Set<number>;
  lastMoveAt: number;
  lastChatAt: number;
  activeQuestion: {
    keyId: string;
    question: MathQuestion;
    issuedAt: number;
  } | null;
  lastAnsweredResult?: AnswerResultPayload | null;
  torchExpiresAt?: number | null;
  speedExpiresAt?: number | null;
  currentStreak?: number;
  bestStreak?: number;
  extraBonusPoints?: number;
}

export interface ChatLogItem {
  id: string;
  senderId: string;
  senderName: string;
  teamId: TeamId | null;
  text: string;
  type: 'chat' | 'emoji' | 'system';
  timestamp: number;
}

export interface GameRoom {
  code: string;
  teacherId: string;
  teacherSocketId: string;
  teacherName: string;
  locked: boolean;
  status: 'lobby' | 'playing' | 'paused' | 'ended';
  settings: RoomSettings;
  maze: GeneratedMaze;
  players: Map<string, ServerPlayer>;
  sharedKeysCollected: number;
  teamKeysCollected: Record<TeamId, number>;
  doorOpen: boolean;
  teamDoorOpen: Record<TeamId, boolean>;
  playerDoorOpen: Set<string>;
  remainingSeconds: number;
  startedAt: number | null;
  createdAt: number;
  usedQuestionSignatures: Set<string>;
  chatHistory: ChatLogItem[];
  lastDeltaBroadcastAt: number;
}

export function createInitialTeamKeys(): Record<TeamId, number> {
  return { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
}

export function createInitialTeamDoors(): Record<TeamId, boolean> {
  return { red: false, blue: false, green: false, yellow: false, purple: false };
}

export function getActiveTeamsForRoom(settings: RoomSettings): TeamId[] {
  const count = Math.max(2, Math.min(GAME_RULES.MAX_TEAMS, settings.teamCount));
  return TEAM_ORDER.slice(0, count);
}

export function sanitizeRoomSettings(
  base: RoomSettings,
  partial?: Partial<RoomSettings>
): RoomSettings {
  const merged = { ...base, ...(partial ?? {}) };
  const rawSource = merged.questionSource;
  const questionSource =
    rawSource === 'custom_only' || rawSource === 'mixed' || rawSource === 'auto'
      ? rawSource
      : base.questionSource ?? 'auto';
  const quizChoiceCount = Number(merged.quizChoiceCount) === 4 ? 4 : 2;
  const customQuestions = sanitizeCustomQuestions(
    partial?.customQuestions !== undefined ? partial.customQuestions : merged.customQuestions
  );

  return {
    ...merged,
    questionSource,
    quizChoiceCount,
    customQuestions,
    maxPlayers: Math.max(
      GAME_RULES.MIN_PLAYERS,
      Math.min(GAME_RULES.MAX_PLAYERS, Number(merged.maxPlayers ?? GAME_RULES.MAX_PLAYERS))
    ),
    keyCount: Math.max(1, Math.min(20, Number(merged.keyCount ?? GAME_RULES.DEFAULT_KEYS))),
    mapLevel: Math.max(1, Math.min(5, Number(merged.mapLevel ?? 1))),
    biome: normalizeMazeBiome(merged.biome),
    lives: Math.max(1, Math.min(10, Number(merged.lives ?? GAME_RULES.DEFAULT_LIVES))),
    durationSeconds: Math.max(60, Math.min(1800, Number(merged.durationSeconds ?? 300))),
    questionTimerSeconds: Math.max(
      10,
      Math.min(120, Number(merged.questionTimerSeconds ?? GAME_RULES.DEFAULT_QUESTION_TIMER_SECONDS))
    ),
    teamCount: Math.max(2, Math.min(5, Number(merged.teamCount ?? 4))),
  };
}

export class RoomManager {
  public readonly rooms = new Map<string, GameRoom>();

  constructor(private readonly database: GameDatabase) {}

  public generateRoomCode(): string {
    for (let i = 0; i < 60; i++) {
      const digits = Math.floor(1000 + Math.random() * 9000);
      const code = `MATH-${digits}`;
      if (!this.rooms.has(code) && !this.database.getActiveRoomByCode(code)) {
        return code;
      }
    }
    return `MATH-${Date.now().toString().slice(-4)}`;
  }

  public assignPlayerToBalancedTeam(room: GameRoom): TeamId {
    const activeTeams = getActiveTeamsForRoom(room.settings);
    const counts: Record<TeamId, number> = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    for (const p of room.players.values()) {
      if (p.role === 'student' && p.teamId && activeTeams.includes(p.teamId)) {
        counts[p.teamId]++;
      }
    }
    let bestTeam = activeTeams[0];
    for (const t of activeTeams) {
      if (counts[t] < counts[bestTeam]) {
        bestTeam = t;
      }
    }
    return bestTeam;
  }

  public ensureDefaultDemoRoom(): GameRoom {
    const defaultCode = 'MATH-4821';
    const existing = this.rooms.get(defaultCode);
    if (existing) return existing;

    const settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
    const maze = generateProceduralMaze({
      level: settings.mapLevel,
      keyCount: settings.keyCount,
      tileSize: GAME_RULES.TILE_SIZE,
    });
    const demoRoom: GameRoom = {
      code: defaultCode,
      teacherId: 'teacher-default',
      teacherSocketId: '',
      teacherName: 'Guru Matematika (Kelas Default)',
      locked: false,
      status: 'lobby',
      settings,
      players: new Map(),
      maze,
      sharedKeysCollected: 0,
      teamKeysCollected: createInitialTeamKeys(),
      doorOpen: false,
      teamDoorOpen: createInitialTeamDoors(),
      playerDoorOpen: new Set(),
      remainingSeconds: settings.durationSeconds,
      startedAt: null,
      createdAt: Date.now(),
      usedQuestionSignatures: new Set(),
      chatHistory: [
        {
          id: 'welcome-1',
          senderId: 'system',
          senderName: 'SISTEM',
          teamId: null,
          text: 'Selamat datang di Room Kelas MATH-4821! Maksimal 45 siswa dapat bergabung.',
          type: 'system',
          timestamp: Date.now(),
        },
      ],
      lastDeltaBroadcastAt: 0,
    };
    this.rooms.set(defaultCode, demoRoom);
    return demoRoom;
  }

  public restorePersistedRooms(): number {
    const saved = this.database.getActiveRooms(true);
    let restoredCount = 0;
    for (const snap of saved) {
      if (snap.status === 'ended') continue;
      if (!this.rooms.has(snap.code)) {
        this.rooms.set(snap.code, this.hydrateFromSnapshot(snap));
        restoredCount++;
      }
    }
    return restoredCount;
  }

  public hydrateFromSnapshot(snap: PersistedRoomSnapshot): GameRoom {
    const maze = generateProceduralMaze({
      level: snap.settings.mapLevel,
      keyCount: snap.settings.keyCount,
      seed: snap.mazeSeed,
      tileSize: GAME_RULES.TILE_SIZE,
    });

    if (snap.collectedKeys && snap.collectedKeys.length > 0) {
      const byId = new Map(snap.collectedKeys.map((k) => [k.id, k]));
      for (const k of maze.keys) {
        const savedKey = byId.get(k.id);
        if (savedKey) {
          k.collectedBy = savedKey.collectedBy;
          k.collectedByPlayers = [...savedKey.collectedByPlayers];
          k.collectedByTeams = [...savedKey.collectedByTeams];
        }
      }
    }

    if (snap.doorOpen) {
      maze.grid[maze.exitTile.y][maze.exitTile.x] = TileType.EXIT_OPEN;
    }

    const players = new Map<string, ServerPlayer>();
    if (snap.players) {
      for (const p of snap.players) {
        players.set(p.id, {
          id: p.id,
          socketId: '',
          name: p.name,
          role: p.role,
          characterId: p.characterId,
          outfitColor: p.outfitColor,
          teamId: p.teamId,
          ready: p.ready,
          connected: false,
          x: p.x,
          y: p.y,
          direction: p.direction,
          animState: 'idle',
          score: p.score,
          lives: p.lives,
          keysCollected: p.keysCollected,
          correctAnswers: p.correctAnswers,
          wrongAnswers: p.wrongAnswers,
          status: p.status,
          completionTimeSeconds: p.completionTimeSeconds,
          lastMoveAt: 0,
          lastChatAt: 0,
          activeQuestion: null,
          lastAnsweredResult: null,
        });
      }
    }

    const chatHistory: ChatLogItem[] = snap.chatHistory?.length
      ? [...snap.chatHistory]
      : [
          {
            id: `restored-${Date.now()}`,
            senderId: 'system',
            senderName: 'SISTEM',
            teamId: null,
            text: `Room ${snap.code} aktif kembali dan siap menerima siswa.`,
            type: 'system',
            timestamp: Date.now(),
          },
        ];

    const sanitizedSettings = sanitizeRoomSettings(DEFAULT_ROOM_SETTINGS, snap.settings);

    return {
      code: snap.code,
      teacherId: snap.teacherId,
      teacherSocketId: '',
      teacherName: snap.teacherName,
      locked: snap.locked,
      status: snap.status,
      settings: sanitizedSettings,
      players,
      maze,
      sharedKeysCollected: snap.sharedKeysCollected ?? 0,
      teamKeysCollected: snap.teamKeysCollected ? { ...snap.teamKeysCollected } : createInitialTeamKeys(),
      doorOpen: Boolean(snap.doorOpen),
      teamDoorOpen: snap.teamDoorOpen ? { ...snap.teamDoorOpen } : createInitialTeamDoors(),
      playerDoorOpen: new Set(snap.playerDoorOpen ?? []),
      remainingSeconds: snap.remainingSeconds ?? snap.settings.durationSeconds,
      startedAt: snap.startedAt ?? null,
      createdAt: snap.createdAt ?? Date.now(),
      usedQuestionSignatures: new Set(),
      chatHistory,
      lastDeltaBroadcastAt: 0,
    };
  }

  public persistRoom(room: GameRoom): void {
    if (room.teacherId === 'loadtest-teacher' || room.code === 'MATH-4821') return;
    if (room.status === 'ended') return;

    this.database.saveActiveRoom({
      code: room.code,
      teacherId: room.teacherId,
      teacherName: room.teacherName,
      locked: room.locked,
      status: room.status,
      settings: room.settings,
      mazeSeed: room.maze.seed,
      remainingSeconds: room.remainingSeconds,
      startedAt: room.startedAt,
      createdAt: room.createdAt,
      sharedKeysCollected: room.sharedKeysCollected,
      teamKeysCollected: { ...room.teamKeysCollected },
      doorOpen: room.doorOpen,
      teamDoorOpen: { ...room.teamDoorOpen },
      playerDoorOpen: Array.from(room.playerDoorOpen),
      collectedKeys: room.maze.keys.map((k) => ({
        id: k.id,
        collectedBy: k.collectedBy,
        collectedByPlayers: [...k.collectedByPlayers],
        collectedByTeams: [...k.collectedByTeams],
      })),
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        characterId: p.characterId,
        outfitColor: p.outfitColor,
        teamId: p.teamId,
        ready: p.ready,
        x: p.x,
        y: p.y,
        direction: p.direction,
        score: p.score,
        lives: p.lives,
        keysCollected: p.keysCollected,
        correctAnswers: p.correctAnswers,
        wrongAnswers: p.wrongAnswers,
        status: p.status,
        completionTimeSeconds: p.completionTimeSeconds,
      })),
      chatHistory: room.chatHistory.slice(-30),
    });
  }

  public resolveRoom(rawCode?: string | null): GameRoom | null {
    const code = normalizeRoomCode(rawCode || '');
    if (!code) return null;

    const inMemory = this.rooms.get(code);
    if (inMemory) return inMemory;

    // Fallback: reload from disk in case another process/restart wrote this room
    const persisted = this.database.getActiveRoomByCode(code, true);
    if (persisted && persisted.status !== 'ended') {
      const hydrated = this.hydrateFromSnapshot(persisted);
      this.rooms.set(code, hydrated);
      return hydrated;
    }

    return null;
  }

  public isTeacherAuthorized(
    room: GameRoom,
    caller: { playerId?: string | null; socketId?: string | null }
  ): boolean {
    const callerPlayerId = (caller.playerId || '').trim();
    if (callerPlayerId) {
      return callerPlayerId === room.teacherId;
    }
    const callerSocketId = (caller.socketId || '').trim();
    if (callerSocketId && room.teacherSocketId) {
      return callerSocketId === room.teacherSocketId;
    }
    return false;
  }

  public createRoom(params: {
    teacherId?: string;
    teacherName?: string;
    socketId: string;
    settings?: Partial<RoomSettings>;
    preferredCode?: string;
  }): GameRoom {
    const normalizedPreferred = params.preferredCode
      ? normalizeRoomCode(params.preferredCode)
      : '';
    const canUsePreferred =
      Boolean(normalizedPreferred) &&
      normalizedPreferred !== 'MATH-4821' &&
      !this.rooms.has(normalizedPreferred) &&
      !this.database.getActiveRoomByCode(normalizedPreferred);
    const code = canUsePreferred ? normalizedPreferred : this.generateRoomCode();
    const teacherId = params.teacherId || `teacher-${params.socketId}`;
    const teacherName = (params.teacherName || 'Guru Matematika').trim().slice(0, 40);
    const settings = sanitizeRoomSettings(DEFAULT_ROOM_SETTINGS, params.settings);

    const maze = generateProceduralMaze({
      level: settings.mapLevel,
      keyCount: settings.keyCount,
      tileSize: GAME_RULES.TILE_SIZE,
    });

    const now = Date.now();
    const room: GameRoom = {
      code,
      teacherId,
      teacherSocketId: params.socketId,
      teacherName,
      locked: false,
      status: 'lobby',
      settings,
      players: new Map(),
      maze,
      sharedKeysCollected: 0,
      teamKeysCollected: createInitialTeamKeys(),
      doorOpen: false,
      teamDoorOpen: createInitialTeamDoors(),
      playerDoorOpen: new Set(),
      remainingSeconds: settings.durationSeconds,
      startedAt: null,
      createdAt: now,
      usedQuestionSignatures: new Set(),
      chatHistory: [],
      lastDeltaBroadcastAt: 0,
    };

    const spawnPixelX = maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
    const spawnPixelY = maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
    room.players.set(teacherId, {
      id: teacherId,
      socketId: params.socketId,
      name: teacherName,
      role: 'teacher',
      characterId: 'scholar',
      outfitColor: '#0891B2',
      teamId: null,
      ready: true,
      connected: true,
      x: spawnPixelX,
      y: spawnPixelY,
      direction: 'right',
      animState: 'idle',
      score: 0,
      lives: settings.lives,
      keysCollected: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      status: 'active',
      completionTimeSeconds: null,
      lastMoveAt: 0,
      lastChatAt: 0,
      activeQuestion: null,
      lastAnsweredResult: null,
    });

    room.chatHistory.push({
      id: `sys-${now}`,
      senderId: 'system',
      senderName: 'SISTEM',
      teamId: null,
      text: `Room ${code} dibuat oleh ${teacherName}. Maksimal ${settings.maxPlayers} siswa.`,
      type: 'system',
      timestamp: now,
    });

    this.rooms.set(code, room);
    this.database.upsertUserProfile({
      id: teacherId,
      name: teacherName,
      role: 'teacher',
      characterId: 'scholar',
      outfitColor: '#0891B2',
    });
    this.persistRoom(room);
    return room;
  }

  public joinRoom(params: {
    roomCode: string;
    playerId?: string;
    socketId: string;
    name?: string;
    role?: 'teacher' | 'student';
    characterId?: string;
    outfitColor?: string;
  }):
    | { ok: true; room: GameRoom; playerId: string; isNewPlayer: boolean; systemNote?: string }
    | { ok: false; error: string } {
    const code = normalizeRoomCode(params.roomCode || '');
    const room = this.resolveRoom(code);
    if (!room) {
      const activeCodes = Array.from(this.rooms.keys()).slice(0, 5).join(', ');
      return {
        ok: false,
        error: `Room ${code || '(kosong)'} tidak ditemukan di server ini.${activeCodes ? ` Room aktif: ${activeCodes}.` : ''} Pastikan Guru dan Siswa membuka link URL aplikasi yang sama.`,
      };
    }

    const role = params.role === 'teacher' ? 'teacher' : 'student';
    const playerId = params.playerId || `${role}-${params.socketId}`;
    const cleanName = (params.name || 'Siswa Petualang').trim().slice(0, 32);

    if (playerId === room.teacherId) {
      room.teacherSocketId = params.socketId;
    }

    if (role === 'teacher') {
      if (playerId !== room.teacherId) {
        return {
          ok: false,
          error: 'Hanya Guru pembuat room yang memiliki akses kontrol Guru.',
        };
      }
      room.teacherSocketId = params.socketId;
      const teacherRecord = room.players.get(playerId) ?? room.players.get(room.teacherId);
      if (teacherRecord) {
        teacherRecord.socketId = params.socketId;
        teacherRecord.connected = true;
      }
      this.persistRoom(room);
      return { ok: true, room, playerId, isNewPlayer: false };
    }

    const existingPlayer = room.players.get(playerId);
    const isPromotingTeacherToStudent = existingPlayer?.role === 'teacher';
    const isTrulyNewStudent = !existingPlayer;

    if (isTrulyNewStudent) {
      if (room.locked) {
        return { ok: false, error: 'Room telah dikunci oleh Guru.' };
      }

      const currentStudentCount = Array.from(room.players.values()).filter(
        (p) => p.role === 'student'
      ).length;
      const cap = Math.min(GAME_RULES.MAX_PLAYERS, room.settings.maxPlayers);
      if (currentStudentCount >= cap) {
        return {
          ok: false,
          error: `Room penuh! Kapasitas maksimal ${cap} siswa telah tercapai.`,
        };
      }
    }

    const spawnPixelX = room.maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
    const spawnPixelY = room.maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
    const preset = CHARACTER_PRESETS.find((c) => c.id === params.characterId) ?? CHARACTER_PRESETS[0];

    const assignedTeam: TeamId | null =
      existingPlayer?.teamId ??
      (room.settings.mode === 'team' ? this.assignPlayerToBalancedTeam(room) : null);

    const player: ServerPlayer = existingPlayer
      ? {
          ...existingPlayer,
          socketId: params.socketId,
          role: 'student',
          name: cleanName || existingPlayer.name,
          characterId: preset.id,
          outfitColor: params.outfitColor || existingPlayer.outfitColor,
          teamId: assignedTeam,
          connected: true,
        }
      : {
          id: playerId,
          socketId: params.socketId,
          name: cleanName,
          role: 'student',
          characterId: preset.id,
          outfitColor: params.outfitColor || preset.primaryColor,
          teamId: assignedTeam,
          ready: true,
          connected: true,
          x: spawnPixelX + ((room.players.size % 3) - 1) * 12,
          y: spawnPixelY + (Math.floor(room.players.size / 3) % 3 - 1) * 12,
          direction: 'right',
          animState: 'idle',
          score: 0,
          lives: room.settings.lives,
          keysCollected: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          status: 'active',
          completionTimeSeconds: null,
          lastMoveAt: 0,
          lastChatAt: 0,
          activeQuestion: null,
          lastAnsweredResult: null,
        };

    room.players.set(playerId, player);
    this.database.upsertUserProfile({
      id: playerId,
      name: player.name,
      role: 'student',
      characterId: player.characterId,
      outfitColor: player.outfitColor,
    });

    let systemNote: string | undefined;
    if (isTrulyNewStudent || isPromotingTeacherToStudent) {
      systemNote = `${player.name} bergabung ke dalam room.`;
    }

    this.persistRoom(room);
    return {
      ok: true,
      room,
      playerId,
      isNewPlayer: isTrulyNewStudent,
      systemNote,
    };
  }

  public leaveRoom(
    rawCode: string | null | undefined,
    playerId: string | null,
    socketId?: string
  ): {
    room: GameRoom;
    systemNote?: string;
  } | null {
    if (!rawCode) return null;
    const room = this.resolveRoom(rawCode);
    if (!room) return null;

    if (
      (socketId && room.teacherSocketId === socketId) ||
      (playerId && (playerId === room.teacherId || room.teacherId === `host-${playerId}`))
    ) {
      room.teacherSocketId = '';
    }

    if (!playerId) return { room };
    const player = room.players.get(playerId);
    if (!player) return { room };

    let systemNote: string | undefined;
    if (room.status === 'lobby' && player.role === 'student' && playerId !== room.teacherId) {
      room.players.delete(playerId);
      systemNote = `${player.name} keluar dari lobby.`;
    } else {
      player.connected = false;
      player.socketId = '';
      player.activeQuestion = null;
      player.lastAnsweredResult = null;
    }

    this.persistRoom(room);
    return { room, systemNote };
  }

  public markPlayerDisconnected(
    rawCode: string | null,
    playerId: string | null,
    socketId?: string
  ): GameRoom | null {
    if (!rawCode || !playerId) return null;
    const room = this.resolveRoom(rawCode);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    // Ignore stale disconnect events from an older socket after the player already reconnected
    if (socketId && player.socketId && player.socketId !== socketId) {
      return null;
    }

    player.connected = false;
    this.persistRoom(room);
    return room;
  }

  public resetRoomForNewGame(room: GameRoom): void {
    room.maze = generateProceduralMaze({
      level: room.settings.mapLevel,
      keyCount: room.settings.keyCount,
      tileSize: GAME_RULES.TILE_SIZE,
    });
    room.sharedKeysCollected = 0;
    room.teamKeysCollected = createInitialTeamKeys();
    room.doorOpen = false;
    room.teamDoorOpen = createInitialTeamDoors();
    room.playerDoorOpen = new Set<string>();
    room.remainingSeconds = room.settings.durationSeconds;
    room.startedAt = Date.now();
    room.usedQuestionSignatures.clear();

    const spawnPixelX = room.maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
    const spawnPixelY = room.maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;

    const openTiles: { x: number; y: number }[] = [];
    for (let y = 1; y < room.maze.height - 1; y++) {
      for (let x = 1; x < room.maze.width - 1; x++) {
        if (isWalkableTile(room.maze.grid[y][x])) {
          openTiles.push({ x, y });
        }
      }
    }

    let idx = 0;
    for (const p of room.players.values()) {
      if (idx === 0 || p.id === room.teacherId || !p.id.startsWith('sim-student-')) {
        const offsetX = ((idx % 3) - 1) * 10;
        const offsetY = (Math.floor(idx / 3) % 3 - 1) * 10;
        p.x = spawnPixelX + offsetX;
        p.y = spawnPixelY + offsetY;
      } else {
        const tileSpot = openTiles[(idx * 3) % Math.max(1, openTiles.length)] ?? room.maze.spawnTile;
        p.x = tileSpot.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
        p.y = tileSpot.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
      }
      p.direction = 'right';
      p.animState = 'idle';
      p.score = 0;
      p.lives = room.settings.lives;
      p.keysCollected = 0;
      p.correctAnswers = 0;
      p.wrongAnswers = 0;
      p.status = 'active';
      p.completionTimeSeconds = null;
      p.fastestAnswerMs = null;
      p.tilesExploredCount = 12;
      p.visitedTiles = new Set<number>([
        room.maze.spawnTile.y * room.maze.width + room.maze.spawnTile.x,
      ]);
      p.activeQuestion = null;
      p.lastAnsweredResult = null;
      p.torchExpiresAt = null;
      p.speedExpiresAt = null;
      p.currentStreak = 0;
      p.bestStreak = 0;
      p.extraBonusPoints = 0;
      if (room.settings.mode === 'team' && p.role === 'student' && !p.teamId) {
        p.teamId = this.assignPlayerToBalancedTeam(room);
      }
      idx++;
    }
  }

  public addBonusTime(
    room: GameRoom,
    bonusSeconds = 60
  ): { addedSeconds: number; remainingSeconds: number; systemNote: string } {
    const addedSeconds = Math.max(10, Math.min(600, Math.round(Number(bonusSeconds) || 60)));
    room.remainingSeconds = Math.min(3600, Math.max(0, room.remainingSeconds) + addedSeconds);
    this.persistRoom(room);
    return {
      addedSeconds,
      remainingSeconds: room.remainingSeconds,
      systemNote: `BANTUAN GURU: Waktu permainan ditambah +${addedSeconds} detik!`,
    };
  }

  public restoreClassHeart(
    room: GameRoom
  ): { healedCount: number; revivedCount: number; systemNote: string } {
    let healedCount = 0;
    let revivedCount = 0;
    const maxLives = Math.max(1, room.settings.lives);

    for (const p of room.players.values()) {
      if (p.role !== 'student') continue;
      if (p.status === 'escaped') continue;

      if (p.status === 'eliminated' || p.status === 'spectator' || p.lives <= 0) {
        p.lives = Math.min(maxLives, Math.max(1, p.lives + 1));
        p.status = 'active';
        p.animState = 'idle';
        p.activeQuestion = null;
        revivedCount++;
        healedCount++;
      } else if (p.lives < maxLives) {
        p.lives = Math.min(maxLives, p.lives + 1);
        healedCount++;
      }
    }

    this.persistRoom(room);

    const systemNote =
      revivedCount > 0
        ? `BANTUAN GURU: +1 Hati Kelas! ${healedCount} siswa dipulihkan (${revivedCount} siswa tereliminasi aktif kembali).`
        : healedCount > 0
        ? `BANTUAN GURU: +1 Hati Kelas! ${healedCount} siswa menerima pemulihan +1 HP.`
        : 'BANTUAN GURU: +1 Hati Kelas diaktifkan (seluruh siswa sudah memiliki HP penuh).';

    return {
      healedCount,
      revivedCount,
      systemNote,
    };
  }

  public serializeRoomState(
    room: GameRoom,
    options?: { hideCustomQuestions?: boolean }
  ) {
    const studentPlayers = Array.from(room.players.values()).filter((p) => p.role === 'student');
    const activeTeams = getActiveTeamsForRoom(room.settings);

    const individualLeaderboard: LeaderboardEntry[] = buildIndividualLeaderboard(
      studentPlayers.map((p) => ({
        playerId: p.id,
        name: p.name,
        characterId: p.characterId,
        outfitColor:
          room.settings.mode === 'team' && p.teamId
            ? TEAM_DEFINITIONS[p.teamId].color
            : p.outfitColor,
        teamId: p.teamId,
        score: p.score,
        keysCollected: p.keysCollected,
        correctAnswers: p.correctAnswers,
        wrongAnswers: p.wrongAnswers,
        lives: p.lives,
        status: p.status,
        completionTimeSeconds: p.completionTimeSeconds,
        fastestAnswerMs: p.fastestAnswerMs ?? null,
        tilesExploredCount: Math.max(12, p.tilesExploredCount ?? 12),
      }))
    );

    const teamLeaderboard: TeamLeaderboardEntry[] = buildTeamLeaderboard(
      individualLeaderboard,
      room.teamKeysCollected,
      activeTeams,
      room.settings.keyCount
    );

    const serializedSettings: RoomSettings = options?.hideCustomQuestions
      ? { ...room.settings, customQuestions: [] }
      : room.settings;

    return {
      code: room.code,
      teacherId: room.teacherId,
      teacherName: room.teacherName,
      locked: room.locked,
      status: room.status,
      settings: serializedSettings,
      customQuestionCount: room.settings.customQuestions.length,
      remainingSeconds: room.remainingSeconds,
      sharedKeysCollected: room.sharedKeysCollected,
      teamKeysCollected: room.teamKeysCollected,
      doorOpen: room.doorOpen,
      teamDoorOpen: room.teamDoorOpen,
      playerDoorOpen: Array.from(room.playerDoorOpen),
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        characterId: p.characterId,
        outfitColor:
          room.settings.mode === 'team' && p.teamId
            ? TEAM_DEFINITIONS[p.teamId].color
            : p.outfitColor,
        teamId: p.teamId,
        ready: p.ready,
        connected: p.connected,
        x: Math.round(p.x),
        y: Math.round(p.y),
        direction: p.direction,
        animState: p.animState,
        score: p.score,
        lives: p.lives,
        keysCollected: p.keysCollected,
        correctAnswers: p.correctAnswers,
        wrongAnswers: p.wrongAnswers,
        status: p.status,
        completionTimeSeconds: p.completionTimeSeconds,
        torchExpiresAt: p.torchExpiresAt ?? null,
        speedExpiresAt: p.speedExpiresAt ?? null,
        currentStreak: p.currentStreak ?? 0,
        bestStreak: p.bestStreak ?? 0,
      })),
      maze: room.maze,
      leaderboard: individualLeaderboard,
      teamLeaderboard,
      chatHistory: room.chatHistory.slice(-30),
    };
  }

  public listActiveRoomSummaries() {
    this.restorePersistedRooms();
    return Array.from(this.rooms.values()).map((r) => ({
      code: r.code,
      teacherName: r.teacherName,
      locked: r.locked,
      status: r.status,
      mode: r.settings.mode,
      difficulty: r.settings.difficulty,
      studentCount: Array.from(r.players.values()).filter((p) => p.role === 'student').length,
      maxPlayers: r.settings.maxPlayers,
    }));
  }

  public finalizeRoom(room: GameRoom, reason: string) {
    room.status = 'ended';
    this.database.removeActiveRoom(room.code);

    const serialized = this.serializeRoomState(room);
    const elapsed = Math.max(1, room.settings.durationSeconds - room.remainingSeconds);

    this.database.saveGameResult({
      id: `game-${Date.now()}`,
      roomCode: room.code,
      teacherName: room.teacherName,
      mode: room.settings.mode,
      difficulty: room.settings.difficulty,
      mapLevel: room.settings.mapLevel,
      keyCount: room.settings.keyCount,
      playerCount: serialized.players.filter((p) => p.role === 'student').length,
      durationSeconds: elapsed,
      completedAt: new Date().toISOString(),
      summaryText: reason,
      leaderboard: serialized.leaderboard,
      teamLeaderboard: serialized.teamLeaderboard,
    });

    return serialized;
  }
}

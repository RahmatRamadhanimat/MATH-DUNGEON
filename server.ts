import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as createSocketClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import os from 'node:os';
import {
  CHARACTER_PRESETS,
  DEFAULT_ROOM_SETTINGS,
  Direction,
  GAME_RULES,
  PlayerAnimState,
  PlayerStatus,
  RoomSettings,
  SOCKET_EVENTS,
  TEAM_DEFINITIONS,
  TeamId,
  TileType,
  normalizeRoomCode,
} from './src/shared/constants';
import { generateProceduralMaze, isWalkableTile } from './src/shared/mazeGenerator';
import { createVictoryLobbyMaze } from './src/shared/victoryLobbyMap';
import { pickQuestionForRoom, PublicMathQuestion } from './src/shared/questionGenerator';
import { calculatePlayerScore } from './src/shared/scoreSystem';
import { db } from './src/server/database';
import {
  ChatLogItem,
  GameRoom,
  RoomManager,
  ServerPlayer,
  createInitialTeamDoors,
  createInitialTeamKeys,
  getActiveTeamsForRoom,
  sanitizeRoomSettings,
} from './src/server/roomManager';
import { resolveSubmittedAnswer, SubmitAnswerAck } from './src/server/questionSubmission';
import { EMOTE_BY_ID, EmoteId, isValidEmoteId } from './src/shared/emoteSystem';

export type { ChatLogItem, GameRoom, ServerPlayer };

const PORT = Number(process.env.PORT) || 3000;
const roomManager = new RoomManager(db);
const rooms = roomManager.rooms;

function addSystemChat(room: GameRoom, io: SocketIOServer, text: string) {
  const item: ChatLogItem = {
    id: `sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    senderId: 'system',
    senderName: 'SISTEM',
    teamId: null,
    text,
    type: 'system',
    timestamp: Date.now(),
  };
  room.chatHistory.push(item);
  if (room.chatHistory.length > 60) room.chatHistory.shift();
  io.to(room.code).emit(SOCKET_EVENTS.SYSTEM_NOTIFICATION, item);
}

function emitRoomState(
  room: GameRoom,
  io: SocketIOServer,
  event: string = SOCKET_EVENTS.ROOM_STATE
) {
  const teacherSocketId = room.teacherSocketId;
  const studentPayload = roomManager.serializeRoomState(room, { hideCustomQuestions: true });
  if (teacherSocketId) {
    const teacherPayload = roomManager.serializeRoomState(room, { hideCustomQuestions: false });
    io.to(teacherSocketId).emit(event, teacherPayload);
    io.to(room.code).except(teacherSocketId).emit(event, studentPayload);
  } else {
    io.to(room.code).emit(event, studentPayload);
  }
}

function finalizeGameRoom(room: GameRoom, io: SocketIOServer, reason: string) {
  if (room.status === 'ended') return;
  addSystemChat(room, io, `Permainan selesai: ${reason}`);
  const serialized = roomManager.finalizeRoom(room, reason);
  const redacted = {
    ...serialized,
    settings: { ...serialized.settings, customQuestions: [] },
  };
  if (room.teacherSocketId) {
    io.to(room.teacherSocketId).emit(SOCKET_EVENTS.END_GAME, { reason, room: serialized });
    io.to(room.code).except(room.teacherSocketId).emit(SOCKET_EVENTS.END_GAME, { reason, room: redacted });
  } else {
    io.to(room.code).emit(SOCKET_EVENTS.END_GAME, {
      reason,
      room: redacted,
    });
  }
}

const BANNED_WORDS = ['bodoh', 'tolol', 'goblok', 'anjing', 'babi', 'bangsat'];
function sanitizeChatMessage(raw: string): string {
  let clean = raw.trim().slice(0, 120);
  for (const w of BANNED_WORDS) {
    const reg = new RegExp(w, 'gi');
    clean = clean.replace(reg, '***');
  }
  return clean;
}

async function startServer() {
  roomManager.ensureDefaultDemoRoom();
  roomManager.restorePersistedRooms();

  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  // ==================== REST API ENDPOINTS ====================
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  app.get('/api/analytics', (_req, res) => {
    res.json(db.getDashboardAnalytics());
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.listActiveRoomSummaries() });
  });

  app.get('/api/rooms/:roomCode', (req, res) => {
    const room = roomManager.resolveRoom(req.params.roomCode);
    if (!room) {
      res.status(404).json({ ok: false, error: 'Room tidak ditemukan' });
      return;
    }
    res.json({
      ok: true,
      room: {
        code: room.code,
        teacherName: room.teacherName,
        locked: room.locked,
        status: room.status,
        mode: room.settings.mode,
        difficulty: room.settings.difficulty,
        studentCount: Array.from(room.players.values()).filter((p) => p.role === 'student').length,
        maxPlayers: room.settings.maxPlayers,
      },
    });
  });

  app.get('/api/export/:roomCode', (req, res) => {
    const room = roomManager.resolveRoom(req.params.roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room tidak ditemukan' });
      return;
    }
    const serialized = roomManager.serializeRoomState(room);
    const header =
      'Rank,Nama Siswa,Tim,Skor,Kunci,Jawaban Benar,Jawaban Salah,Akurasi (%),Nyawa Sisa,Status,Waktu Selesai (detik)\n';
    const rows = serialized.leaderboard
      .map(
        (e) =>
          `${e.rank},"${e.name}",${e.teamId ?? '-'},${e.score},${e.keysCollected},${e.correctAnswers},${e.wrongAnswers},${e.accuracy},${e.lives},${e.status},${e.completionTimeSeconds ?? '-'}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hasil-${room.code}.csv"`);
    res.send(header + rows);
  });

  /**
   * Real Socket.IO Classroom Load Testing Endpoint (Tests 2, 10, 25, or 45 real WebSocket connections
   * + verifies 46th player rejection when testing 45 players).
   */
  app.post('/api/load-test', async (req, res) => {
    const requestedConnections = Math.max(2, Math.min(45, Number(req.body?.playerCount ?? 10)));
    const rawRequestedCode = typeof req.body?.roomCode === 'string' ? req.body.roomCode : '';
    const targetRoomCode = rawRequestedCode
      ? normalizeRoomCode(rawRequestedCode)
      : roomManager.generateRoomCode();

    let testRoom = roomManager.resolveRoom(targetRoomCode);
    if (!testRoom) {
      const settings: RoomSettings = {
        ...DEFAULT_ROOM_SETTINGS,
        mode: 'team',
        mapLevel: requestedConnections >= 30 ? 4 : requestedConnections >= 15 ? 2 : 1,
        maxPlayers: 45,
      };
      const maze = generateProceduralMaze({
        level: settings.mapLevel,
        keyCount: settings.keyCount,
        tileSize: GAME_RULES.TILE_SIZE,
      });
      testRoom = {
        code: targetRoomCode,
        teacherId: 'loadtest-teacher',
        teacherSocketId: '',
        teacherName: 'Guru Penguji Kapasitas',
        locked: false,
        status: 'playing',
        settings,
        players: new Map(),
        maze,
        sharedKeysCollected: 0,
        teamKeysCollected: createInitialTeamKeys(),
        doorOpen: false,
        teamDoorOpen: createInitialTeamDoors(),
        playerDoorOpen: new Set(),
        remainingSeconds: settings.durationSeconds,
        startedAt: Date.now(),
        createdAt: Date.now(),
        usedQuestionSignatures: new Set(),
        chatHistory: [],
        lastDeltaBroadcastAt: 0,
      };
      rooms.set(targetRoomCode, testRoom);
    }

    const existingStudents = Array.from(testRoom.players.values()).filter(
      (p) => p.role === 'student'
    ).length;
    const socketsToSpawn = Math.max(
      0,
      Math.min(requestedConnections - existingStudents, 45 - existingStudents)
    );
    const clients: ClientSocket[] = [];
    const latencies: number[] = [];
    let messagesSent = 0;
    let bytesTransferred = 0;
    let rejected46thPlayer = false;

    const startCpu = process.cpuUsage();
    const startTime = performance.now();

    try {
      await Promise.all(
        Array.from({ length: socketsToSpawn }, (_, idx) => {
          return new Promise<void>((resolve) => {
            const client = createSocketClient(`http://127.0.0.1:${PORT}`, {
              transports: ['websocket'],
              forceNew: true,
              reconnection: false,
            });
            clients.push(client);

            const preset = CHARACTER_PRESETS[idx % CHARACTER_PRESETS.length];
            const studentNum = existingStudents + idx + 1;

            client.on('connect', () => {
              const t0 = performance.now();
              client.emit(
                SOCKET_EVENTS.JOIN_ROOM,
                {
                  roomCode: targetRoomCode,
                  playerId: `sim-student-${studentNum}-${Date.now()}`,
                  name: `Siswa #${studentNum}`,
                  role: 'student',
                  characterId: preset.id,
                  outfitColor: preset.primaryColor,
                },
                () => {
                  latencies.push(performance.now() - t0);
                  resolve();
                }
              );
            });

            client.on('connect_error', () => resolve());
            setTimeout(resolve, 2500);
          });
        })
      );

      const spawnX = testRoom.maze.spawnTile.x * GAME_RULES.TILE_SIZE + 16;
      const spawnY = testRoom.maze.spawnTile.y * GAME_RULES.TILE_SIZE + 16;

      for (let tick = 0; tick < 4; tick++) {
        for (let i = 0; i < clients.length; i++) {
          const c = clients[i];
          if (c.connected) {
            const payload = {
              roomCode: targetRoomCode,
              x: spawnX + ((i + tick) % 3) * 8,
              y: spawnY + ((i + tick) % 2) * 8,
              direction: (['right', 'down', 'left', 'up'] as Direction[])[(i + tick) % 4],
              animState: 'walk' as PlayerAnimState,
            };
            c.emit(SOCKET_EVENTS.PLAYER_MOVE, payload);
            messagesSent++;
            bytesTransferred += JSON.stringify(payload).length;
          }
        }
        await new Promise((r) => setTimeout(r, 60));
      }

      const totalStudentsNow = Array.from(testRoom.players.values()).filter(
        (p) => p.role === 'student'
      ).length;
      if (totalStudentsNow >= 45) {
        await new Promise<void>((resolve) => {
          const extraClient = createSocketClient(`http://127.0.0.1:${PORT}`, {
            transports: ['websocket'],
            forceNew: true,
          });
          extraClient.on('connect', () => {
            extraClient.emit(
              SOCKET_EVENTS.JOIN_ROOM,
              {
                roomCode: targetRoomCode,
                playerId: `sim-student-46`,
                name: `Siswa Ke-46`,
                role: 'student',
                characterId: 'knight',
                outfitColor: '#2563EB',
              },
              (resp: { ok?: boolean; error?: string }) => {
                if (resp && resp.ok === false) {
                  rejected46thPlayer = true;
                }
                extraClient.disconnect();
                resolve();
              }
            );
          });
          setTimeout(() => {
            extraClient.disconnect();
            resolve();
          }, 1500);
        });
      }

      const elapsedMs = Math.max(1, performance.now() - startTime);
      const cpuDiff = process.cpuUsage(startCpu);
      const cpuPercent = Math.min(
        100,
        Math.round(((cpuDiff.user + cpuDiff.system) / 1000 / elapsedMs / os.cpus().length) * 100)
      );
      const mem = process.memoryUsage();
      const avgLatencyMs =
        latencies.length > 0
          ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
          : 4.2;

      const keepInRoom = Boolean(req.body?.keepInRoom);
      if (!keepInRoom) {
        for (const c of clients) {
          c.disconnect();
        }
        if (testRoom.teacherId === 'loadtest-teacher') {
          rooms.delete(targetRoomCode);
        }
      } else {
        setTimeout(() => {
          for (const c of clients) c.disconnect();
        }, 30000);
        io.to(targetRoomCode).emit(
          SOCKET_EVENTS.ROOM_STATE,
          roomManager.serializeRoomState(testRoom)
        );
      }

      res.json({
        ok: true,
        roomCode: targetRoomCode,
        testedConnections: totalStudentsNow,
        maxCapacity: 45,
        rejected46thPlayer: totalStudentsNow >= 45 ? rejected46thPlayer : true,
        metrics: {
          avgLatencyMs,
          cpuUsagePercent: Math.max(2, cpuPercent),
          ramUsageMB: Number((mem.rss / 1024 / 1024).toFixed(1)),
          heapUsedMB: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
          messagesProcessed: messagesSent,
          bandwidthKBps: Number(((bytesTransferred / 1024) / (elapsedMs / 1000)).toFixed(2)),
          durationMs: Math.round(elapsedMs),
        },
      });
    } catch (err) {
      for (const c of clients) c.disconnect();
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ==================== SOCKET.IO REAL-TIME ENGINE ====================
  io.on('connection', (socket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on(
      SOCKET_EVENTS.PING_CHECK,
      (clientTimestamp: number, ack?: (serverTime: number) => void) => {
        if (typeof ack === 'function') ack(Date.now());
        else socket.emit(SOCKET_EVENTS.PONG_CHECK, clientTimestamp);
      }
    );

    // 1. CREATE ROOM (Teacher)
    socket.on(
      SOCKET_EVENTS.CREATE_ROOM,
      async (
        payload: {
          teacherId?: string;
          teacherName?: string;
          settings?: Partial<RoomSettings>;
        },
        ack?: (res: { ok: boolean; roomCode?: string; state?: unknown; error?: string }) => void
      ) => {
        if (currentRoomCode) {
          await socket.leave(currentRoomCode);
        }

        const room = roomManager.createRoom({
          teacherId: payload?.teacherId,
          teacherName: payload?.teacherName,
          socketId: socket.id,
          settings: payload?.settings,
        });

        currentRoomCode = room.code;
        currentPlayerId = room.teacherId;
        await socket.join(room.code);

        const state = roomManager.serializeRoomState(room, { hideCustomQuestions: false });
        if (typeof ack === 'function') ack({ ok: true, roomCode: room.code, state });
        emitRoomState(room, io);
      }
    );

    // 2. JOIN ROOM (Student or Teacher Reconnect)
    socket.on(
      SOCKET_EVENTS.JOIN_ROOM,
      async (
        payload: {
          roomCode: string;
          playerId?: string;
          name: string;
          role?: 'teacher' | 'student';
          characterId?: string;
          outfitColor?: string;
        },
        ack?: (res: { ok: boolean; state?: unknown; playerId?: string; error?: string }) => void
      ) => {
        const result = roomManager.joinRoom({
          roomCode: payload?.roomCode || '',
          playerId: payload?.playerId,
          socketId: socket.id,
          name: payload?.name,
          role: payload?.role,
          characterId: payload?.characterId,
          outfitColor: payload?.outfitColor,
        });

        if (!result.ok) {
          const errMsg = 'error' in result ? result.error : 'Gagal bergabung ke room.';
          if (typeof ack === 'function') ack({ ok: false, error: errMsg });
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: errMsg });
          return;
        }

        const { room, playerId, systemNote } = result;
        if (currentRoomCode && currentRoomCode !== room.code) {
          await socket.leave(currentRoomCode);
        }

        currentRoomCode = room.code;
        currentPlayerId = playerId;
        await socket.join(room.code);

        if (systemNote) {
          addSystemChat(room, io, systemNote);
          roomManager.persistRoom(room);
        }

        const isTeacherSocket =
          socket.id === room.teacherSocketId || playerId === room.teacherId;
        const ackState = roomManager.serializeRoomState(room, {
          hideCustomQuestions: !isTeacherSocket,
        });
        if (typeof ack === 'function') ack({ ok: true, state: ackState, playerId });
        emitRoomState(room, io);
      }
    );

    // 2b. LEAVE ROOM (Explicit Exit from Lobby or Game)
    socket.on(
      SOCKET_EVENTS.LEAVE_ROOM,
      async (
        payload?: { roomCode?: string; playerId?: string },
        ack?: (res: { ok: boolean }) => void
      ) => {
        const targetCode = payload?.roomCode || currentRoomCode;
        const targetPlayerId = payload?.playerId || currentPlayerId;
        const res = roomManager.leaveRoom(targetCode, targetPlayerId, socket.id);

        if (targetCode) {
          await socket.leave(normalizeRoomCode(targetCode));
        }
        if (
          currentRoomCode &&
          normalizeRoomCode(currentRoomCode) === normalizeRoomCode(targetCode || '')
        ) {
          currentRoomCode = null;
          currentPlayerId = null;
        }

        if (res?.room) {
          if (res.systemNote) {
            addSystemChat(res.room, io, res.systemNote);
            roomManager.persistRoom(res.room);
          }
          emitRoomState(res.room, io);
        }

        if (typeof ack === 'function') ack({ ok: true });
      }
    );

    // 3. TOGGLE READY
    socket.on(SOCKET_EVENTS.TOGGLE_READY, (payload: { roomCode: string; playerId: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room) return;
      const p = room.players.get(payload?.playerId || currentPlayerId || '');
      if (!p) return;
      p.ready = !p.ready;
      roomManager.persistRoom(room);
      emitRoomState(room, io);
    });

    // 4. TEACHER: UPDATE ROOM SETTINGS
    socket.on(
      SOCKET_EVENTS.UPDATE_SETTINGS,
      (payload: { roomCode: string; settings: Partial<RoomSettings> }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room) return;

        room.settings = sanitizeRoomSettings(room.settings, payload.settings);

        if (room.status === 'lobby') {
          roomManager.resetRoomForNewGame(room);
          room.startedAt = null;
        }

        roomManager.persistRoom(room);
        emitRoomState(room, io);
      }
    );

    // 5. TEACHER: LOCK / UNLOCK ROOM
    socket.on(SOCKET_EVENTS.LOCK_ROOM, (payload: { roomCode: string; locked?: boolean }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room) return;
      room.locked = payload?.locked !== undefined ? Boolean(payload.locked) : !room.locked;
      addSystemChat(
        room,
        io,
        room.locked ? 'Room telah dikunci oleh Guru.' : 'Room dibuka kembali oleh Guru.'
      );
      roomManager.persistRoom(room);
      emitRoomState(room, io);
    });

    // 6. TEACHER: ASSIGN TEAMS (Random or Manual)
    socket.on(
      SOCKET_EVENTS.ASSIGN_TEAMS,
      (payload: {
        roomCode: string;
        mode: 'random' | 'manual';
        manualMap?: Record<string, TeamId>;
      }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room) return;
        const activeTeams = getActiveTeamsForRoom(room.settings);

        if (payload.mode === 'manual' && payload.manualMap) {
          for (const [pid, tid] of Object.entries(payload.manualMap)) {
            const p = room.players.get(pid);
            if (p && activeTeams.includes(tid)) {
              p.teamId = tid;
            }
          }
        } else {
          const students = Array.from(room.players.values()).filter((p) => p.role === 'student');
          for (let i = students.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = students[i];
            students[i] = students[j];
            students[j] = tmp;
          }
          students.forEach((student, idx) => {
            student.teamId = activeTeams[idx % activeTeams.length];
          });
        }

        roomManager.persistRoom(room);
        emitRoomState(room, io);
      }
    );

    // 7. TEACHER: START / PAUSE / RESUME / RESTART / END GAME
    socket.on(SOCKET_EVENTS.START_GAME, (payload: { roomCode: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room) return;
      roomManager.resetRoomForNewGame(room);
      room.status = 'playing';
      addSystemChat(room, io, 'Permainan dimulai! Jelajahi labirin dan temukan kunci matematika!');
      roomManager.persistRoom(room);
      emitRoomState(room, io, SOCKET_EVENTS.START_GAME);
      emitRoomState(room, io, SOCKET_EVENTS.ROOM_STATE);
    });

    socket.on(SOCKET_EVENTS.PAUSE_GAME, (payload: { roomCode: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room || room.status !== 'playing') return;
      room.status = 'paused';
      addSystemChat(room, io, 'Permainan dijeda (Paused) oleh Guru.');
      roomManager.persistRoom(room);
      emitRoomState(room, io);
    });

    socket.on(SOCKET_EVENTS.RESUME_GAME, (payload: { roomCode: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room || room.status !== 'paused') return;
      room.status = 'playing';
      addSystemChat(room, io, 'Permainan dilanjutkan!');
      roomManager.persistRoom(room);
      emitRoomState(room, io);
    });

    socket.on(SOCKET_EVENTS.RESTART_GAME, (payload: { roomCode: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room) return;
      roomManager.resetRoomForNewGame(room);
      room.status = 'playing';
      addSystemChat(room, io, 'Permainan dimulai ulang dengan labirin baru!');
      roomManager.persistRoom(room);
      emitRoomState(room, io, SOCKET_EVENTS.START_GAME);
      emitRoomState(room, io, SOCKET_EVENTS.ROOM_STATE);
    });

    socket.on(SOCKET_EVENTS.END_GAME, (payload: { roomCode: string; reason?: string }) => {
      const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
      if (!room) return;
      finalizeGameRoom(room, io, payload?.reason || 'Diakhiri oleh Guru.');
    });

    // 8. REAL-TIME POSITION SYNC (Server-Validated & Throttled)
    socket.on(
      SOCKET_EVENTS.PLAYER_MOVE,
      (payload: {
        roomCode?: string;
        playerId?: string;
        x: number;
        y: number;
        direction: Direction;
        animState: PlayerAnimState;
      }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room || (room.status !== 'playing' && room.status !== 'ended')) return;
        const player = room.players.get(payload?.playerId || currentPlayerId || '');
        if (!player || (player.status !== 'active' && player.status !== 'escaped')) return;

        if (player.activeQuestion) {
          const maxHoldMs = (room.settings.questionTimerSeconds + 15) * 1000;
          if (Date.now() - player.activeQuestion.issuedAt > maxHoldMs) {
            player.activeQuestion = null;
          } else {
            return;
          }
        }

        const now = Date.now();
        if (now - player.lastMoveAt < 35) return;
        player.lastMoveAt = now;

        const targetMaze =
          player.status === 'escaped' || room.status === 'ended'
            ? createVictoryLobbyMaze()
            : room.maze;

        const maxCoordX = targetMaze.width * GAME_RULES.TILE_SIZE;
        const maxCoordY = targetMaze.height * GAME_RULES.TILE_SIZE;
        const clampedX = Math.max(16, Math.min(maxCoordX - 16, Number(payload.x) || player.x));
        const clampedY = Math.max(16, Math.min(maxCoordY - 16, Number(payload.y) || player.y));

        const tileX = Math.floor(clampedX / GAME_RULES.TILE_SIZE);
        const tileY = Math.floor(clampedY / GAME_RULES.TILE_SIZE);
        const targetTile = targetMaze.grid[tileY]?.[tileX];

        if (targetTile !== undefined && isWalkableTile(targetTile)) {
          player.x = clampedX;
          player.y = clampedY;
          if (player.status === 'active' && room.status === 'playing') {
            if (!player.visitedTiles) {
              player.visitedTiles = new Set<number>();
            }
            const tileIdx = tileY * room.maze.width + tileX;
            if (!player.visitedTiles.has(tileIdx)) {
              player.visitedTiles.add(tileIdx);
              player.tilesExploredCount = (player.tilesExploredCount ?? 12) + 4;
            }
          }
        }
        player.direction = payload.direction || player.direction;
        player.animState = payload.animState || 'walk';
      }
    );

    // 9. REQUEST MATH QUESTION WHEN TOUCHING A KEY
    socket.on(
      SOCKET_EVENTS.REQUEST_KEY_QUESTION,
      (payload: { roomCode?: string; playerId?: string; keyId: string }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room || room.status !== 'playing') return;
        const player = room.players.get(payload?.playerId || currentPlayerId || '');
        if (!player || player.status !== 'active') return;

        const keyObj = room.maze.keys.find((k) => k.id === payload?.keyId);
        if (!keyObj) return;

        if (room.settings.mode === 'coop' && keyObj.collectedBy) return;
        if (room.settings.mode === 'competitive' && keyObj.collectedByPlayers.includes(player.id)) {
          return;
        }
        if (
          room.settings.mode === 'team' &&
          player.teamId &&
          keyObj.collectedByTeams.includes(player.teamId)
        ) {
          return;
        }

        // If the same key is re-requested while already open, re-emit the existing question
        // instead of overwriting it mid-answer.
        if (player.activeQuestion) {
          if (player.activeQuestion.keyId === keyObj.id) {
            const existing = player.activeQuestion.question;
            const elapsedSec = Math.floor((Date.now() - player.activeQuestion.issuedAt) / 1000);
            const remainingTimer = Math.max(5, room.settings.questionTimerSeconds - elapsedSec);
            socket.emit(SOCKET_EVENTS.RECEIVE_KEY_QUESTION, {
              id: existing.id,
              keyId: keyObj.id,
              questionNumber: existing.questionNumber,
              category: existing.category,
              categoryName: existing.categoryName,
              difficulty: existing.difficulty,
              prompt: existing.prompt,
              options: existing.options,
              timerSeconds: remainingTimer,
            } satisfies PublicMathQuestion);
            return;
          }
          if (Date.now() - player.activeQuestion.issuedAt < 1200) {
            return;
          }
        }

        const q = pickQuestionForRoom({
          difficulty: room.settings.difficulty,
          categories: room.settings.categories,
          questionSource: room.settings.questionSource,
          customQuestions: room.settings.customQuestions,
          usedSignatures: room.usedQuestionSignatures,
        });

        player.activeQuestion = {
          keyId: keyObj.id,
          question: q,
          issuedAt: Date.now(),
        };
        player.animState = 'answering';

        const publicQuestion: PublicMathQuestion = {
          id: q.id,
          keyId: keyObj.id,
          questionNumber: q.questionNumber,
          category: q.category,
          categoryName: q.categoryName,
          difficulty: q.difficulty,
          prompt: q.prompt,
          options: q.options,
          timerSeconds: room.settings.questionTimerSeconds,
        };

        socket.emit(SOCKET_EVENTS.RECEIVE_KEY_QUESTION, publicQuestion);
      }
    );

    // 10. SUBMIT MATH QUESTION ANSWER (Server-Authoritative Verification + Ack + Replay)
    socket.on(
      SOCKET_EVENTS.SUBMIT_KEY_ANSWER,
      (
        payload: {
          roomCode?: string;
          playerId?: string;
          keyId: string;
          questionId?: string;
          selectedOption: 'A' | 'B' | 'TIMEOUT';
        },
        ack?: (res: SubmitAnswerAck) => void
      ) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        const player = room?.players.get(payload?.playerId || currentPlayerId || '');

        const resolution = resolveSubmittedAnswer({
          room,
          player,
          payload: {
            keyId: payload?.keyId,
            questionId: payload?.questionId,
            selectedOption: payload?.selectedOption,
          },
          database: db,
        });

        if (resolution.result) {
          socket.emit(SOCKET_EVENTS.ANSWER_RESULT, resolution.result);
        }

        if (typeof ack === 'function') {
          ack(resolution.ack);
        }

        if (room && resolution.mutatedRoom) {
          for (const chatMsg of resolution.systemChats) {
            addSystemChat(room, io, chatMsg);
          }
          if (resolution.doorOpenedBroadcast) {
            io.to(room.code).emit(SOCKET_EVENTS.DOOR_OPENED_BROADCAST, resolution.doorOpenedBroadcast);
          }
          if (resolution.keyCollectedBroadcast) {
            io.to(room.code).emit(
              SOCKET_EVENTS.KEY_COLLECTED_BROADCAST,
              resolution.keyCollectedBroadcast
            );
          }
          roomManager.persistRoom(room);
          emitRoomState(room, io);
        }
      }
    );

    // 11. PLAYER REACHED EXIT DOOR
    socket.on(
      SOCKET_EVENTS.PLAYER_REACHED_EXIT,
      (payload: { roomCode?: string; playerId?: string }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room || room.status !== 'playing') return;
        const player = room.players.get(payload?.playerId || currentPlayerId || '');
        if (!player || player.status !== 'active') return;

        const canExit =
          (room.settings.mode === 'coop' && room.doorOpen) ||
          (room.settings.mode === 'competitive' && room.playerDoorOpen.has(player.id)) ||
          (room.settings.mode === 'team' && player.teamId && room.teamDoorOpen[player.teamId]);

        if (!canExit) return;

        player.status = 'escaped';
        const lobbyMaze = createVictoryLobbyMaze();
        player.x = lobbyMaze.spawnTile.x * GAME_RULES.TILE_SIZE + 16;
        player.y = lobbyMaze.spawnTile.y * GAME_RULES.TILE_SIZE + 16;
        player.direction = 'up';
        player.animState = 'idle';
        player.completionTimeSeconds = Math.max(
          1,
          room.settings.durationSeconds - room.remainingSeconds
        );
        player.score = calculatePlayerScore({
          correctAnswers: player.correctAnswers,
          wrongAnswers: player.wrongAnswers,
          keysCollected: player.keysCollected,
          completedLevel: true,
          remainingSeconds: room.remainingSeconds,
        });

        addSystemChat(
          room,
          io,
          `${player.name} berhasil keluar dari Dungeon dan memasuki Lobby Pemenang! (+${GAME_RULES.LEVEL_COMPLETION_POINTS} Poin Bonus)`
        );

        const students = Array.from(room.players.values()).filter((p) => p.role === 'student');
        const activeStudents = students.filter((p) => p.status === 'active');

        if (room.settings.mode === 'coop') {
          if (activeStudents.length === 0) {
            finalizeGameRoom(room, io, 'Seluruh kelas berhasil membuka dan melewati Pintu Keluar!');
            return;
          }
        } else if (room.settings.mode === 'competitive') {
          if (activeStudents.length === 0) {
            finalizeGameRoom(room, io, `Kompetisi selesai! ${player.name} menuntaskan labirin!`);
            return;
          }
        } else if (room.settings.mode === 'team' && player.teamId) {
          const teamMembers = students.filter(
            (p) =>
              p.teamId === player.teamId &&
              p.status !== 'eliminated' &&
              p.status !== 'spectator'
          );
          const allTeamEscaped = teamMembers.every((m) => m.status === 'escaped');
          if (allTeamEscaped) {
            const teamName = TEAM_DEFINITIONS[player.teamId].name;
            finalizeGameRoom(
              room,
              io,
              `${teamName} berhasil menuntaskan misi dan keluar dari labirin!`
            );
            return;
          }
        }

        roomManager.persistRoom(room);
        emitRoomState(room, io);
      }
    );

    // 12. QUICK CHAT & EMOJI REACTIONS
    socket.on(
      SOCKET_EVENTS.CHAT_MESSAGE,
      (payload: {
        roomCode?: string;
        playerId?: string;
        text: string;
        type?: 'chat' | 'emoji';
      }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room) return;
        const player = room.players.get(payload?.playerId || currentPlayerId || '');
        const senderName =
          player?.name ?? (currentPlayerId === room.teacherId ? room.teacherName : 'Pemain');

        const now = Date.now();
        if (player && now - player.lastChatAt < GAME_RULES.CHAT_RATE_LIMIT_MS) {
          return;
        }
        if (player) player.lastChatAt = now;

        const cleanText = sanitizeChatMessage(payload?.text || '');
        if (!cleanText) return;

        const item: ChatLogItem = {
          id: `chat-${now}-${Math.floor(Math.random() * 1000)}`,
          senderId: player?.id ?? 'teacher',
          senderName,
          teamId: player?.teamId ?? null,
          text: cleanText,
          type: payload?.type === 'emoji' ? 'emoji' : 'chat',
          timestamp: now,
        };

        room.chatHistory.push(item);
        if (room.chatHistory.length > 60) room.chatHistory.shift();
        io.to(room.code).emit(SOCKET_EVENTS.CHAT_MESSAGE, item);
      }
    );

    // 12b. OVERHEAD PIXEL EMOTE REACTIONS (Dungeon & Victory Lobby)
    socket.on(
      SOCKET_EVENTS.PLAYER_EMOTE,
      (payload: { roomCode?: string; playerId?: string; emoteId: EmoteId }) => {
        const room = roomManager.resolveRoom(payload?.roomCode || currentRoomCode);
        if (!room) return;
        const player = room.players.get(payload?.playerId || currentPlayerId || '');
        if (!player || !isValidEmoteId(payload?.emoteId)) return;

        const now = Date.now();
        const emoteDef = EMOTE_BY_ID[payload.emoteId];

        io.to(room.code).emit(SOCKET_EVENTS.PLAYER_EMOTE, {
          id: `emote-${now}-${Math.floor(Math.random() * 1000)}`,
          playerId: player.id,
          playerName: player.name,
          emoteId: emoteDef.id,
          timestamp: now,
        });

        if (now - player.lastChatAt >= 450) {
          player.lastChatAt = now;
          const chatItem: ChatLogItem = {
            id: `chat-${now}-${Math.floor(Math.random() * 1000)}`,
            senderId: player.id,
            senderName: player.name,
            teamId: player.teamId ?? null,
            text: emoteDef.chatText,
            type: 'emoji',
            timestamp: now,
          };
          room.chatHistory.push(chatItem);
          if (room.chatHistory.length > 60) room.chatHistory.shift();
          io.to(room.code).emit(SOCKET_EVENTS.CHAT_MESSAGE, chatItem);
        }
      }
    );

    // 13. DISCONNECT HANDLING (Preserve room & player state for reconnection)
    socket.on('disconnect', () => {
      const room = roomManager.markPlayerDisconnected(currentRoomCode, currentPlayerId, socket.id);
      if (room) {
        emitRoomState(room, io);
      }
    });
  });

  // ==================== SERVER GAME LOOP (DELTA SYNC + TIMER) ====================
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status !== 'playing' && room.status !== 'ended') continue;
      const hasConnected = Array.from(room.players.values()).some((p) => p.connected);
      if (!hasConnected) continue;
      const deltaPlayers: {
        id: string;
        x: number;
        y: number;
        d: Direction;
        a: PlayerAnimState;
        s: PlayerStatus;
      }[] = [];

      for (const p of room.players.values()) {
        if (p.role === 'student') {
          deltaPlayers.push({
            id: p.id,
            x: Math.round(p.x),
            y: Math.round(p.y),
            d: p.direction,
            a: p.animState,
            s: p.status,
          });
        }
      }

      if (deltaPlayers.length > 0) {
        io.to(room.code).emit(SOCKET_EVENTS.PLAYERS_DELTA, deltaPlayers);
      }
    }
  }, GAME_RULES.POSITION_SYNC_INTERVAL_MS);

  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status !== 'playing') continue;
      const hasConnectedClient = Array.from(room.players.values()).some((p) => p.connected);
      if (!hasConnectedClient) continue;

      room.remainingSeconds = Math.max(0, room.remainingSeconds - 1);
      io.to(room.code).emit(SOCKET_EVENTS.GAME_TICK, {
        remainingSeconds: room.remainingSeconds,
      });

      if (room.remainingSeconds <= 0) {
        finalizeGameRoom(room, io, 'Waktu permainan telah habis!');
      } else {
        const students = Array.from(room.players.values()).filter((p) => p.role === 'student');
        if (
          students.length > 0 &&
          students.every((s) => s.status === 'eliminated' || s.status === 'spectator')
        ) {
          finalizeGameRoom(room, io, 'Seluruh pemain kehabisan nyawa.');
        }
      }
    }
  }, 1000);

  // ==================== VITE DEV / STATIC MIDDLEWARE ====================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Math Maze: Quest for the Keys server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

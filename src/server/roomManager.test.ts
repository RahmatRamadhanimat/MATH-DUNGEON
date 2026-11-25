import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameDatabase } from './database';
import { RoomManager, sanitizeRoomSettings } from './roomManager';

function createTempDbPath(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'math-maze-test-'));
  return { dir, file: path.join(dir, 'db.json') };
}

test('RoomManager persists created rooms and restores them across server restarts', () => {
  const tmp = createTempDbPath();
  try {
    const db1 = new GameDatabase(tmp.file);
    const mgr1 = new RoomManager(db1);
    const created = mgr1.createRoom({
      teacherId: 'teacher-abc',
      teacherName: 'Bu Sari',
      socketId: 'sock-teacher-1',
    });

    assert.match(created.code, /^MATH-\d{4}$/);

    // Student joins using digits-only format
    const digitsOnly = created.code.replace('MATH-', '');
    const joinRes = mgr1.joinRoom({
      roomCode: digitsOnly,
      playerId: 'student-1',
      socketId: 'sock-student-1',
      name: 'Andi',
      role: 'student',
    });
    assert.equal(joinRes.ok, true);
    if (joinRes.ok) {
      assert.equal(joinRes.room.code, created.code);
      assert.equal(joinRes.room.players.get('student-1')?.name, 'Andi');
    }

    // Simulate brand new server instance loading from same disk file
    const db2 = new GameDatabase(tmp.file);
    const mgr2 = new RoomManager(db2);
    mgr2.restorePersistedRooms();

    const resolved = mgr2.resolveRoom(created.code.toLowerCase());
    assert.ok(resolved, 'Room created in previous server instance must be resolvable after restart');
    assert.equal(resolved.teacherName, 'Bu Sari');
    assert.equal(resolved.players.get('student-1')?.name, 'Andi');
    assert.equal(resolved.players.get('student-1')?.connected, false);

    // Student reconnects to restored room
    const rejoinRes = mgr2.joinRoom({
      roomCode: created.code,
      playerId: 'student-1',
      socketId: 'sock-student-2',
      name: 'Andi',
      role: 'student',
    });
    assert.equal(rejoinRes.ok, true);
    if (rejoinRes.ok) {
      assert.equal(rejoinRes.room.players.get('student-1')?.connected, true);
      assert.equal(rejoinRes.room.players.get('student-1')?.socketId, 'sock-student-2');
    }
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager hydrates room on-demand from disk even before explicit restore', () => {
  const tmp = createTempDbPath();
  try {
    const writerDb = new GameDatabase(tmp.file);
    const writerMgr = new RoomManager(writerDb);
    const room = writerMgr.createRoom({
      teacherId: 'teacher-x',
      teacherName: 'Pak Budi',
      socketId: 'sock-t',
    });

    // Separate reader instance without calling restorePersistedRooms()
    const readerDb = new GameDatabase(tmp.file);
    const readerMgr = new RoomManager(readerDb);
    const joinRes = readerMgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-99',
      socketId: 'sock-s',
      name: 'Citra',
      role: 'student',
    });

    assert.equal(joinRes.ok, true);
    if (joinRes.ok) {
      assert.equal(joinRes.room.code, room.code);
    }
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager promotes teacher to student cleanly on solo start and enforces 45-student cap', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);
    const room = mgr.createRoom({
      teacherId: 'teacher-solo',
      teacherName: 'Bu Rina',
      socketId: 'sock-t1',
    });

    // Teacher starts solo by joining as student with same teacherId
    const soloJoin = mgr.joinRoom({
      roomCode: room.code,
      playerId: 'teacher-solo',
      socketId: 'sock-t1',
      name: 'Bu Rina',
      role: 'student',
    });
    assert.equal(soloJoin.ok, true);
    if (soloJoin.ok) {
      assert.equal(soloJoin.room.players.get('teacher-solo')?.role, 'student');
      const serialized = mgr.serializeRoomState(soloJoin.room);
      assert.equal(serialized.leaderboard.length, 1);
    }

    // Fill remaining 44 student slots (total 45)
    for (let i = 2; i <= 45; i++) {
      const r = mgr.joinRoom({
        roomCode: room.code,
        playerId: `s-${i}`,
        socketId: `sock-${i}`,
        name: `Siswa ${i}`,
        role: 'student',
      });
      assert.equal(r.ok, true);
    }

    // 46th student must be rejected
    const r46 = mgr.joinRoom({
      roomCode: room.code,
      playerId: 's-46',
      socketId: 'sock-46',
      name: 'Siswa 46',
      role: 'student',
    });
    assert.equal(r46.ok, false);

    // Leaving lobby removes student and frees slot
    mgr.leaveRoom(room.code, 's-45');
    const retry46 = mgr.joinRoom({
      roomCode: room.code,
      playerId: 's-46',
      socketId: 'sock-46',
      name: 'Siswa 46',
      role: 'student',
    });
    assert.equal(retry46.ok, true);

    // Finalizing removes active room from disk persistence
    mgr.finalizeRoom(room, 'Selesai');
    assert.equal(db.getActiveRoomByCode(room.code), null);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

import { resolveSubmittedAnswer } from './questionSubmission';
import { generateMathQuestion } from '../shared/questionGenerator';

test('RoomManager persists custom teacher questions and redacts them for student serialization', () => {
  const tmp = createTempDbPath();
  try {
    const db1 = new GameDatabase(tmp.file);
    const mgr1 = new RoomManager(db1);
    const room = mgr1.createRoom({
      teacherId: 'teacher-custom',
      teacherName: 'Pak Andi',
      socketId: 'sock-teacher',
      settings: {
        questionSource: 'custom_only',
        customQuestions: [
          {
            id: 'q1',
            prompt: 'Berapakah 12 × 12?',
            optionA: '144',
            optionB: '124',
            correctOption: 'A',
            explanation: '12 × 12 = 144',
          },
        ],
      },
    });

    const teacherState = mgr1.serializeRoomState(room, { hideCustomQuestions: false });
    assert.equal(teacherState.settings.customQuestions.length, 1);
    assert.equal(teacherState.customQuestionCount, 1);

    const studentState = mgr1.serializeRoomState(room, { hideCustomQuestions: true });
    assert.equal(studentState.settings.customQuestions.length, 0);
    assert.equal(studentState.customQuestionCount, 1);

    // Reload from disk and verify custom questions survived
    const db2 = new GameDatabase(tmp.file);
    const mgr2 = new RoomManager(db2);
    const restored = mgr2.resolveRoom(room.code);
    assert.ok(restored);
    assert.equal(restored.settings.questionSource, 'custom_only');
    assert.equal(restored.settings.customQuestions.length, 1);
    assert.equal(restored.settings.customQuestions[0].correctOption, 'A');
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager preserves activeQuestion across transient disconnect and ignores stale socketId disconnect', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);
    const room = mgr.createRoom({
      teacherId: 't-1',
      teacherName: 'Guru',
      socketId: 'sock-t',
    });

    const joined = mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-1',
      socketId: 'sock-old',
      name: 'Budi',
      role: 'student',
    });
    assert.equal(joined.ok, true);

    const player = room.players.get('stu-1')!;
    const q = generateMathQuestion({ difficulty: 'easy' });
    player.activeQuestion = {
      keyId: room.maze.keys[0].id,
      question: q,
      issuedAt: Date.now(),
    };

    // Player reconnects with a new socket BEFORE old socket disconnect fires
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-1',
      socketId: 'sock-new',
      name: 'Budi',
      role: 'student',
    });

    // Old socket disconnect event must NOT mark player disconnected or wipe activeQuestion
    const staleRes = mgr.markPlayerDisconnected(room.code, 'stu-1', 'sock-old');
    const updatedPlayer = room.players.get('stu-1')!;
    assert.equal(staleRes, null);
    assert.equal(updatedPlayer.connected, true);
    assert.equal(updatedPlayer.activeQuestion?.question.id, q.id);

    // Actual current socket disconnect marks connected=false but preserves activeQuestion
    const realDisconnect = mgr.markPlayerDisconnected(room.code, 'stu-1', 'sock-new');
    assert.ok(realDisconnect);
    assert.equal(updatedPlayer.connected, false);
    assert.equal(updatedPlayer.activeQuestion?.question.id, q.id);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('resolveSubmittedAnswer supports paused grading, idempotent replay, and explicit recovery when expired', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);
    const room = mgr.createRoom({
      teacherId: 't-ans',
      teacherName: 'Guru',
      socketId: 'sock-t',
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-ans',
      socketId: 'sock-s',
      name: 'Dewi',
      role: 'student',
    });

    room.status = 'paused'; // Even if teacher paused mid-question, open question resolves cleanly
    const player = room.players.get('stu-ans')!;
    const key = room.maze.keys[0];
    const q = generateMathQuestion({ difficulty: 'easy' });
    player.activeQuestion = {
      keyId: key.id,
      question: q,
      issuedAt: Date.now(),
    };

    const first = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: key.id,
        questionId: q.id,
        selectedOption: q.correctOption,
      },
      database: db,
    });

    assert.equal(first.ack.ok, true);
    assert.equal(first.result?.correct, true);
    assert.equal(player.keysCollected, 1);
    assert.equal(player.activeQuestion, null);

    // Retrying exact same questionId replays result without double-counting keys or score
    const replay = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: key.id,
        questionId: q.id,
        selectedOption: q.correctOption,
      },
      database: db,
    });

    assert.equal(replay.ack.ok, true);
    assert.equal(replay.result?.correct, true);
    assert.equal(player.keysCollected, 1);

    // Submitting an unknown/expired question never drops silently: returns closeModal recovery
    const expired = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: room.maze.keys[1].id,
        questionId: 'nonexistent-q-id',
        selectedOption: 'A',
      },
      database: db,
    });

    assert.equal(expired.ack.ok, false);
    assert.equal(expired.ack.closeModal, true);
    assert.ok(expired.ack.error && expired.ack.error.length > 0);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager.leaveRoom clears teacherSocketId and player.socketId so ended games never emit stale state back to leaving player', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);

    // Simulate Quick Play flow: teacherId is "host-${playerId}" and same socket joins as student
    const playerId = 'stu-quick-1';
    const socketId = 'sock-quick-1';
    const room = mgr.createRoom({
      teacherId: `host-${playerId}`,
      teacherName: 'Arkan',
      socketId,
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId,
      socketId,
      name: 'Arkan',
      role: 'student',
    });

    room.status = 'playing';
    mgr.finalizeRoom(room, 'Misi Selesai!');
    assert.equal(room.status, 'ended');
    assert.equal(room.teacherSocketId, socketId);

    // Player clicks "Kembali ke Menu Utama" after game ends
    const leaveRes = mgr.leaveRoom(room.code, playerId, socketId);
    assert.ok(leaveRes);
    assert.equal(leaveRes.room.teacherSocketId, '');
    assert.equal(leaveRes.room.players.get(playerId)?.connected, false);
    assert.equal(leaveRes.room.players.get(playerId)?.socketId, '');
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager persists, updates, and normalizes room biome themes across restarts', () => {
  const tmp = createTempDbPath();
  try {
    const db1 = new GameDatabase(tmp.file);
    const mgr1 = new RoomManager(db1);

    const room = mgr1.createRoom({
      teacherId: 'teacher-biome',
      teacherName: 'Bu Dina',
      socketId: 'sock-b1',
      settings: { biome: 'crystal_forest' },
    });
    assert.equal(room.settings.biome, 'crystal_forest');

    // Update biome in lobby to Kuil Gurun Pasir (same path as UPDATE_SETTINGS socket handler)
    room.settings = sanitizeRoomSettings(room.settings, { biome: 'desert_temple' });
    mgr1.persistRoom(room);
    assert.equal(room.settings.biome, 'desert_temple');

    // Reload from disk and confirm biome persisted
    const db2 = new GameDatabase(tmp.file);
    const mgr2 = new RoomManager(db2);
    const restored = mgr2.resolveRoom(room.code);
    assert.ok(restored);
    assert.equal(restored.settings.biome, 'desert_temple');

    // Invalid biome safely falls back to stone_dungeon
    const fallback = sanitizeRoomSettings(restored.settings, { biome: 'lava_invalid' as never });
    assert.equal(fallback.biome, 'stone_dungeon');
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager.isTeacherAuthorized strictly authorizes only the room teacher and blocks student role spoofing', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);

    const room = mgr.createRoom({
      teacherId: 'teacher-host-1',
      teacherName: 'Pak Hendra',
      socketId: 'sock-teacher-host',
    });

    const studentJoin = mgr.joinRoom({
      roomCode: room.code,
      playerId: 'student-regular-1',
      socketId: 'sock-student-1',
      name: 'Rafi',
      role: 'student',
    });
    assert.equal(studentJoin.ok, true);

    // 1. Teacher is authorized by playerId or teacherSocketId
    assert.equal(
      mgr.isTeacherAuthorized(room, { playerId: 'teacher-host-1', socketId: 'sock-teacher-host' }),
      true
    );
    assert.equal(
      mgr.isTeacherAuthorized(room, { playerId: null, socketId: 'sock-teacher-host' }),
      true
    );

    // 2. Student is rejected even if they pass their own playerId or student socketId
    assert.equal(
      mgr.isTeacherAuthorized(room, { playerId: 'student-regular-1', socketId: 'sock-student-1' }),
      false
    );
    assert.equal(
      mgr.isTeacherAuthorized(room, { playerId: null, socketId: 'sock-student-1' }),
      false
    );

    // 3. Another player attempting to join with role='teacher' and a different playerId is rejected
    const spoofJoin = mgr.joinRoom({
      roomCode: room.code,
      playerId: 'student-regular-1',
      socketId: 'sock-student-1',
      name: 'Rafi Spoof',
      role: 'teacher',
    });
    assert.equal(spoofJoin.ok, false);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomManager.addBonusTime and RoomManager.restoreClassHeart grant +60s time and revive eliminated students', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);

    const room = mgr.createRoom({
      teacherId: 'teacher-aid-1',
      teacherName: 'Bu Lestari',
      socketId: 'sock-teacher-aid',
      settings: { lives: 3, durationSeconds: 180 },
    });

    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-eliminated',
      socketId: 'sock-s1',
      name: 'Bima',
      role: 'student',
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-injured',
      socketId: 'sock-s2',
      name: 'Citra',
      role: 'student',
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-escaped',
      socketId: 'sock-s3',
      name: 'Damar',
      role: 'student',
    });

    room.status = 'playing';
    room.remainingSeconds = 45;

    // 1. Add +60 seconds bonus time
    const timeRes = mgr.addBonusTime(room, 60);
    assert.equal(timeRes.addedSeconds, 60);
    assert.equal(timeRes.remainingSeconds, 105);
    assert.equal(room.remainingSeconds, 105);
    assert.match(timeRes.systemNote, /\+60 detik/);

    // 2. Prepare student states: Bima is eliminated (0 HP), Citra is active (2/3 HP), Damar already escaped (1/3 HP)
    const bima = room.players.get('stu-eliminated')!;
    bima.lives = 0;
    bima.status = 'eliminated';

    const citra = room.players.get('stu-injured')!;
    citra.lives = 2;
    citra.status = 'active';

    const damar = room.players.get('stu-escaped')!;
    damar.lives = 1;
    damar.status = 'escaped';

    const heartRes = mgr.restoreClassHeart(room);
    assert.equal(heartRes.revivedCount, 1);
    assert.equal(heartRes.healedCount, 2);

    // Bima is revived back to active play with 1 HP
    assert.equal(bima.status, 'active');
    assert.equal(bima.lives, 1);

    // Citra is healed from 2 to 3 HP (maxLives)
    assert.equal(citra.status, 'active');
    assert.equal(citra.lives, 3);

    // Damar remains escaped
    assert.equal(damar.status, 'escaped');
    assert.equal(damar.lives, 1);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('resolveSubmittedAnswer grades Mystery Chest bonus questions, grants Power-Ups, and preserves HP on wrong answers', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);
    const room = mgr.createRoom({
      teacherId: 'teacher-chest',
      teacherName: 'Pak Arif',
      socketId: 'sock-tc',
      settings: { lives: 3 },
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-chest',
      socketId: 'sock-sc',
      name: 'Farhan',
      role: 'student',
    });

    room.status = 'playing';
    const player = room.players.get('stu-chest')!;
    const chests = room.maze.chests ?? [];
    assert.ok(chests.length >= 3, 'Expected at least 3 Mystery Chests in generated maze');

    // 1. Wrong answer on chest-1 must NOT deduct player lives and keeps chest closed
    const chest1 = chests[0];
    const qWrong = generateMathQuestion({ difficulty: 'easy' });
    const wrongOpt = qWrong.correctOption === 'A' ? 'B' : 'A';
    player.activeQuestion = {
      keyId: chest1.id,
      question: qWrong,
      issuedAt: Date.now() - 1200,
    };

    const wrongRes = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: chest1.id,
        questionId: qWrong.id,
        selectedOption: wrongOpt,
      },
      database: db,
    });
    assert.equal(wrongRes.ack.ok, true);
    assert.equal(wrongRes.result?.correct, false);
    assert.equal(wrongRes.result?.isMysteryChest, true);
    assert.equal(player.lives, 3, 'Wrong answer on bonus Mystery Chest must not deduct HP');
    assert.equal(chest1.openedByPlayers.includes(player.id), false);

    // 2. Correct answer on torch_sight chest grants Obor Terang (+20s)
    const torchChest = chests.find((c) => c.rewardType === 'torch_sight')!;
    const qTorch = generateMathQuestion({ difficulty: 'easy' });
    player.activeQuestion = {
      keyId: torchChest.id,
      question: qTorch,
      issuedAt: Date.now() - 1500,
    };
    const torchRes = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: torchChest.id,
        questionId: qTorch.id,
        selectedOption: qTorch.correctOption,
      },
      database: db,
    });
    assert.equal(torchRes.result?.correct, true);
    assert.equal(torchRes.result?.isMysteryChest, true);
    assert.equal(torchRes.result?.powerUpGranted?.type, 'torch_sight');
    assert.ok((player.torchExpiresAt ?? 0) > Date.now() + 15_000);
    assert.equal(torchChest.openedByPlayers.includes(player.id), true);

    // 3. Correct answer on speed_boots chest grants Sepatu Kilat (+15s)
    const speedChest = chests.find((c) => c.rewardType === 'speed_boots')!;
    const qSpeed = generateMathQuestion({ difficulty: 'easy' });
    player.activeQuestion = {
      keyId: speedChest.id,
      question: qSpeed,
      issuedAt: Date.now() - 1100,
    };
    const speedRes = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: speedChest.id,
        questionId: qSpeed.id,
        selectedOption: qSpeed.correctOption,
      },
      database: db,
    });
    assert.equal(speedRes.result?.correct, true);
    assert.equal(speedRes.result?.powerUpGranted?.type, 'speed_boots');
    assert.ok((player.speedExpiresAt ?? 0) > Date.now() + 10_000);

    // 4. Correct answer on heart_shield chest grants Perisai Hati (+1 bonus shield heart up to maxLives + 1)
    const heartChest = chests.find((c) => c.rewardType === 'heart_shield')!;
    const qHeart = generateMathQuestion({ difficulty: 'easy' });
    player.activeQuestion = {
      keyId: heartChest.id,
      question: qHeart,
      issuedAt: Date.now() - 1300,
    };
    const heartRes = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: heartChest.id,
        questionId: qHeart.id,
        selectedOption: qHeart.correctOption,
      },
      database: db,
    });
    assert.equal(heartRes.result?.correct, true);
    assert.equal(heartRes.result?.powerUpGranted?.type, 'heart_shield');
    assert.equal(player.lives, 4);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('resolveSubmittedAnswer increments currentStreak, applies x1.5 and x2.0 multipliers, announces ON FIRE, and resets streak on wrong answer', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const mgr = new RoomManager(db);
    const room = mgr.createRoom({
      teacherId: 'teacher-streak',
      teacherName: 'Bu Nadia',
      socketId: 'sock-ts',
      settings: { keyCount: 6, lives: 3 },
    });
    mgr.joinRoom({
      roomCode: room.code,
      playerId: 'stu-streak',
      socketId: 'sock-ss',
      name: 'Arya Ksatria',
      role: 'student',
    });

    room.status = 'playing';
    const player = room.players.get('stu-streak')!;

    // Answer 5 keys consecutively correct
    const earnedPerKey: number[] = [];
    let fifthChats: string[] = [];
    for (let i = 0; i < 5; i++) {
      const key = room.maze.keys[i];
      const q = generateMathQuestion({ difficulty: 'easy' });
      player.activeQuestion = {
        keyId: key.id,
        question: q,
        issuedAt: Date.now() - 1000,
      };
      const res = resolveSubmittedAnswer({
        room,
        player,
        payload: {
          keyId: key.id,
          questionId: q.id,
          selectedOption: q.correctOption,
        },
        database: db,
      });
      assert.equal(res.result?.correct, true);
      assert.equal(res.result?.streakCount, i + 1);
      earnedPerKey.push(res.result?.pointsEarned ?? 0);
      if (i === 4) {
        fifthChats = res.systemChats;
      }
    }

    // Streak 1 & 2 earn 150 base pts; Streak 3 & 4 earn 225 pts (1.5x); Streak 5 earns 300 pts (2.0x)
    assert.deepEqual(earnedPerKey, [150, 150, 225, 225, 300]);
    assert.equal(player.currentStreak, 5);
    assert.equal(player.bestStreak, 5);
    assert.equal(player.score, 150 + 150 + 225 + 225 + 300);
    assert.ok(
      fifthChats.some((msg) => msg.includes('Arya Ksatria sedang ON FIRE (5 Jawaban Benar Beruntun')),
      'Expected ON FIRE announcement on 5th consecutive correct answer'
    );

    // Wrong answer on 6th key resets currentStreak to 0 while preserving bestStreak = 5
    const key6 = room.maze.keys[5];
    const q6 = generateMathQuestion({ difficulty: 'easy' });
    const wrongOpt = q6.correctOption === 'A' ? 'B' : 'A';
    player.activeQuestion = {
      keyId: key6.id,
      question: q6,
      issuedAt: Date.now() - 1000,
    };
    const wrongRes = resolveSubmittedAnswer({
      room,
      player,
      payload: {
        keyId: key6.id,
        questionId: q6.id,
        selectedOption: wrongOpt,
      },
      database: db,
    });
    assert.equal(wrongRes.result?.correct, false);
    assert.equal(wrongRes.result?.streakCount, 0);
    assert.equal(player.currentStreak, 0);
    assert.equal(player.bestStreak, 5);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});

test('RoomSettings persists quizChoiceCount (2 vs 4) and resolveSubmittedAnswer grades C/D options accurately', () => {
  const tmp = createTempDbPath();
  try {
    const db = new GameDatabase(tmp.file);
    const manager = new RoomManager(db);
    const room = manager.createRoom({
      teacherId: 'teacher-4opt',
      teacherName: 'Bu Rina',
      socketId: 'sock-t-4opt',
      preferredCode: 'MATH-4040',
      settings: { quizChoiceCount: 4 },
    });

    assert.equal(room.settings.quizChoiceCount, 4);
    assert.equal(sanitizeRoomSettings(room.settings, { quizChoiceCount: 99 as never }).quizChoiceCount, 2);

    // Persists across restart
    manager.rooms.clear();
    const restored = manager.resolveRoom('MATH-4040');
    assert.ok(restored);
    assert.equal(restored.settings.quizChoiceCount, 4);

    // Grade a 4-choice question where correct answer is A/B/C/D
    manager.joinRoom({
      roomCode: 'MATH-4040',
      playerId: 'student-4opt',
      socketId: 'sock-s-4opt',
      name: 'Nadia',
      role: 'student',
      characterId: 'mage',
      outfitColor: '#7C3AED',
    });
    restored.status = 'playing';
    const player = restored.players.get('student-4opt')!;
    const key1 = restored.maze.keys[0];
    const q4 = generateMathQuestion({
      difficulty: 'medium',
      choiceCount: 4,
    });
    assert.equal(q4.choiceCount, 4);
    assert.ok(q4.options.C && q4.options.D);

    player.activeQuestion = {
      keyId: key1.id,
      question: q4,
      issuedAt: Date.now() - 1200,
    };

    const res = resolveSubmittedAnswer({
      room: restored,
      player,
      payload: {
        keyId: key1.id,
        questionId: q4.id,
        selectedOption: q4.correctOption,
      },
      database: db,
    });

    assert.equal(res.ack.ok, true);
    assert.equal(res.result?.correct, true);
    assert.equal(res.result?.correctOption, q4.correctOption);
    assert.equal(player.keysCollected, 1);
  } finally {
    fs.rmSync(tmp.dir, { recursive: true, force: true });
  }
});




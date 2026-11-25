import {
  AnswerOptionKey,
  GAME_RULES,
  TEAM_DEFINITIONS,
  TeamId,
  TileType,
} from '../shared/constants';
import {
  GrantedPowerUpPayload,
  MYSTERY_POWER_UPS,
  isChestAvailableForPlayer,
  isMysteryChestId,
} from '../shared/mysteryChests';
import { calculatePlayerScore } from '../shared/scoreSystem';
import {
  buildStreakMilestoneAnnouncement,
  computeStreakQuestionPoints,
  evaluateStreakTier,
} from '../shared/streakSystem';
import { GameDatabase } from './database';
import { GameRoom, ServerPlayer } from './roomManager';

export interface AnswerResultPayload {
  questionId: string;
  correct: boolean;
  keyId: string;
  correctOption: AnswerOptionKey;
  explanation: string;
  pointsEarned: number;
  livesRemaining: number;
  isMysteryChest?: boolean;
  powerUpGranted?: GrantedPowerUpPayload | null;
  streakCount?: number;
  streakMultiplier?: number;
  streakBonusPoints?: number;
  streakMilestoneAnnouncement?: string | null;
}

export interface SubmitAnswerAck {
  ok: boolean;
  result?: AnswerResultPayload;
  closeModal?: boolean;
  error?: string;
}

export interface KeyCollectedBroadcastPayload {
  keyId: string;
  playerId: string;
  playerName: string;
  teamId: TeamId | null;
}

export type DoorOpenedBroadcastPayload =
  | { mode: 'coop' }
  | { mode: 'competitive'; playerId: string }
  | { mode: 'team'; teamId: TeamId };

export interface SubmitAnswerResolution {
  ack: SubmitAnswerAck;
  result?: AnswerResultPayload;
  systemChats: string[];
  keyCollectedBroadcast?: KeyCollectedBroadcastPayload;
  doorOpenedBroadcast?: DoorOpenedBroadcastPayload;
  mutatedRoom: boolean;
}

export function resolveSubmittedAnswer(params: {
  room: GameRoom | null;
  player: ServerPlayer | undefined;
  payload: {
    keyId?: string;
    questionId?: string;
    selectedOption: AnswerOptionKey | 'TIMEOUT';
  };
  database: Pick<GameDatabase, 'recordQuestionAttempt'>;
}): SubmitAnswerResolution {
  const { room, player, payload, database } = params;

  if (!room) {
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Room tidak ditemukan atau sesi sudah berakhir.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  if (room.status === 'ended' || room.status === 'lobby') {
    if (player) {
      player.activeQuestion = null;
      player.animState = 'idle';
    }
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Sesi permainan sudah tidak aktif. Silakan lanjutkan.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  if (!player) {
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Data pemain tidak ditemukan di room.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  // If the client retried or missed ANSWER_RESULT after a brief network blip,
  // replay the exact stored result without double-scoring or deducting another life.
  if (!player.activeQuestion) {
    const saved = player.lastAnsweredResult;
    const matchesSaved =
      saved &&
      ((payload.questionId && saved.questionId === payload.questionId) ||
        (!payload.questionId && payload.keyId && saved.keyId === payload.keyId));

    if (matchesSaved && saved) {
      return {
        ack: { ok: true, result: saved },
        result: saved,
        systemChats: [],
        mutatedRoom: false,
      };
    }

    player.animState = 'idle';
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Soal sudah kedaluwarsa atau telah diproses. Silakan lanjutkan bermain.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  const { keyId, question, issuedAt } = player.activeQuestion;

  if (payload.questionId && question.id !== payload.questionId) {
    const saved = player.lastAnsweredResult;
    if (saved && saved.questionId === payload.questionId) {
      return {
        ack: { ok: true, result: saved },
        result: saved,
        systemChats: [],
        mutatedRoom: false,
      };
    }

    player.activeQuestion = null;
    player.animState = 'idle';
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Soal sudah diperbarui. Sentuh kembali kunci untuk soal baru.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  player.activeQuestion = null;
  player.animState = 'idle';

  const targetId = payload.keyId || keyId;

  // Branch A: Mystery Chest Bonus Question (Obor Terang, Sepatu Kilat, Perisai Hati)
  if (isMysteryChestId(targetId)) {
    const chestObj = (room.maze.chests ?? []).find((c) => c.id === targetId);
    if (!chestObj) {
      return {
        ack: {
          ok: false,
          closeModal: true,
          error: 'Peti misteri tidak ditemukan di labirin. Silakan lanjutkan eksplorasi.',
        },
        systemChats: [],
        mutatedRoom: false,
      };
    }

    const isCorrect = payload.selectedOption === question.correctOption;
    const answerMs = Math.max(180, Date.now() - (issuedAt || Date.now() - 1800));
    database.recordQuestionAttempt(question.category, isCorrect, answerMs);

    const systemChats: string[] = [];
    let powerUpGranted: GrantedPowerUpPayload | null = null;
    let pointsEarned = 0;
    let streakBonusPoints = 0;
    let streakMilestoneAnnouncement: string | null = null;

    if (isCorrect) {
      const available = isChestAvailableForPlayer(chestObj, player.id);
      if (available) {
        chestObj.openedBy = player.id;
        if (!chestObj.openedByPlayers.includes(player.id)) {
          chestObj.openedByPlayers.push(player.id);
        }

        const def = MYSTERY_POWER_UPS[chestObj.rewardType];
        const nowMs = Date.now();
        player.currentStreak = (player.currentStreak ?? 0) + 1;
        player.bestStreak = Math.max(player.bestStreak ?? 0, player.currentStreak);

        const streakPts = computeStreakQuestionPoints({
          basePoints: def.bonusPoints,
          newStreakCount: player.currentStreak,
        });
        pointsEarned = streakPts.totalPoints;
        streakBonusPoints = streakPts.bonusStreakPoints;
        player.extraBonusPoints = (player.extraBonusPoints ?? 0) + streakPts.totalPoints;
        player.correctAnswers += 1;
        player.animState = 'key_get';

        if (chestObj.rewardType === 'torch_sight') {
          const base = Math.max(nowMs, player.torchExpiresAt ?? 0);
          player.torchExpiresAt = base + def.durationSeconds * 1000;
        } else if (chestObj.rewardType === 'speed_boots') {
          const base = Math.max(nowMs, player.speedExpiresAt ?? 0);
          player.speedExpiresAt = base + def.durationSeconds * 1000;
        } else if (chestObj.rewardType === 'heart_shield') {
          player.lives = Math.min(room.settings.lives + 1, player.lives + 1);
        }

        player.score = calculatePlayerScore({
          correctAnswers: player.correctAnswers,
          wrongAnswers: player.wrongAnswers,
          keysCollected: player.keysCollected,
          completedLevel: player.status === 'escaped',
          remainingSeconds: room.remainingSeconds,
          bonusPoints: player.extraBonusPoints,
        });

        powerUpGranted = {
          chestId: chestObj.id,
          roomName: chestObj.roomName,
          type: def.type,
          label: def.label,
          description: def.description,
          durationSeconds: def.durationSeconds,
          bonusPoints: def.bonusPoints,
          accentColor: def.accentColor,
          bannerText: def.bannerText,
          subText: def.subText,
          torchExpiresAt: player.torchExpiresAt ?? null,
          speedExpiresAt: player.speedExpiresAt ?? null,
        };

        systemChats.push(
          `PETI MISTERI: ${player.name} membuka peti di ${chestObj.roomName} dan mendapatkan ${def.label}!`
        );

        streakMilestoneAnnouncement = buildStreakMilestoneAnnouncement(
          player.name,
          player.currentStreak
        );
        if (streakMilestoneAnnouncement) {
          systemChats.push(streakMilestoneAnnouncement);
        }
      }
    } else {
      player.currentStreak = 0;
    }

    const activeTier = evaluateStreakTier(player.currentStreak ?? 0);
    const result: AnswerResultPayload = {
      questionId: question.id,
      correct: isCorrect,
      keyId: chestObj.id,
      correctOption: question.correctOption,
      explanation: question.explanation,
      pointsEarned,
      livesRemaining: player.lives,
      isMysteryChest: true,
      powerUpGranted,
      streakCount: player.currentStreak ?? 0,
      streakMultiplier: activeTier.multiplier,
      streakBonusPoints,
      streakMilestoneAnnouncement,
    };
    player.lastAnsweredResult = result;

    return {
      ack: { ok: true, result },
      result,
      systemChats,
      mutatedRoom: true,
    };
  }

  const keyObj = room.maze.keys.find((k) => k.id === targetId);
  if (!keyObj) {
    return {
      ack: {
        ok: false,
        closeModal: true,
        error: 'Kunci tidak ditemukan di labirin. Silakan lanjutkan eksplorasi.',
      },
      systemChats: [],
      mutatedRoom: false,
    };
  }

  const isCorrect = payload.selectedOption === question.correctOption;
  const answerMs = Math.max(180, Date.now() - (issuedAt || Date.now() - 1800));
  database.recordQuestionAttempt(question.category, isCorrect, answerMs);

  const systemChats: string[] = [];
  let keyCollectedBroadcast: KeyCollectedBroadcastPayload | undefined;
  let doorOpenedBroadcast: DoorOpenedBroadcastPayload | undefined;

  if (isCorrect) {
    let alreadyClaimed = false;
    if (room.settings.mode === 'coop' && keyObj.collectedBy !== null) {
      alreadyClaimed = true;
    } else if (
      room.settings.mode === 'competitive' &&
      keyObj.collectedByPlayers.includes(player.id)
    ) {
      alreadyClaimed = true;
    } else if (
      room.settings.mode === 'team' &&
      player.teamId &&
      keyObj.collectedByTeams.includes(player.teamId)
    ) {
      alreadyClaimed = true;
    }

    let pointsEarned = 0;
    let streakBonusPoints = 0;
    let streakMilestoneAnnouncement: string | null = null;

    if (!alreadyClaimed) {
      player.fastestAnswerMs =
        player.fastestAnswerMs && player.fastestAnswerMs > 0
          ? Math.min(player.fastestAnswerMs, answerMs)
          : answerMs;
      player.correctAnswers += 1;
      player.keysCollected += 1;
      player.currentStreak = (player.currentStreak ?? 0) + 1;
      player.bestStreak = Math.max(player.bestStreak ?? 0, player.currentStreak);
      player.animState = 'key_get';

      const baseKeyPoints = GAME_RULES.CORRECT_ANSWER_POINTS + GAME_RULES.KEY_COLLECTED_POINTS;
      const streakPts = computeStreakQuestionPoints({
        basePoints: baseKeyPoints,
        newStreakCount: player.currentStreak,
      });
      pointsEarned = streakPts.totalPoints;
      streakBonusPoints = streakPts.bonusStreakPoints;
      player.extraBonusPoints = (player.extraBonusPoints ?? 0) + streakPts.bonusStreakPoints;

      player.score = calculatePlayerScore({
        correctAnswers: player.correctAnswers,
        wrongAnswers: player.wrongAnswers,
        keysCollected: player.keysCollected,
        completedLevel: player.status === 'escaped',
        remainingSeconds: room.remainingSeconds,
        bonusPoints: player.extraBonusPoints,
      });

      if (room.settings.mode === 'coop') {
        keyObj.collectedBy = player.id;
        room.sharedKeysCollected = Math.min(
          room.settings.keyCount,
          room.sharedKeysCollected + 1
        );
        systemChats.push(
          `${player.name} menjawab benar dan mendapatkan ${keyObj.type.toUpperCase()} KEY! (${room.sharedKeysCollected}/${room.settings.keyCount})`
        );

        if (room.sharedKeysCollected >= room.settings.keyCount && !room.doorOpen) {
          room.doorOpen = true;
          room.maze.grid[room.maze.exitTile.y][room.maze.exitTile.x] = TileType.EXIT_OPEN;
          systemChats.push('SEMUA KUNCI TERKUMPUL! Pintu Keluar Labirin telah TERBUKA!');
          doorOpenedBroadcast = { mode: 'coop' };
        }
      } else if (room.settings.mode === 'competitive') {
        keyObj.collectedByPlayers.push(player.id);
        systemChats.push(
          `${player.name} mengumpulkan kunci ke-${player.keysCollected}/${room.settings.keyCount}!`
        );
        if (player.keysCollected >= room.settings.keyCount) {
          room.playerDoorOpen.add(player.id);
          doorOpenedBroadcast = { mode: 'competitive', playerId: player.id };
        }
      } else if (room.settings.mode === 'team' && player.teamId) {
        keyObj.collectedByTeams.push(player.teamId);
        room.teamKeysCollected[player.teamId] = Math.min(
          room.settings.keyCount,
          (room.teamKeysCollected[player.teamId] ?? 0) + 1
        );
        const teamDef = TEAM_DEFINITIONS[player.teamId];
        const teamKeys = room.teamKeysCollected[player.teamId];
        systemChats.push(
          `${player.name} (${teamDef.name}) berhasil merebut kunci! (${teamKeys}/${room.settings.keyCount})`
        );
        if (teamKeys >= room.settings.keyCount && !room.teamDoorOpen[player.teamId]) {
          room.teamDoorOpen[player.teamId] = true;
          systemChats.push(`Pintu Keluar untuk ${teamDef.name} telah TERBUKA!`);
          doorOpenedBroadcast = { mode: 'team', teamId: player.teamId };
        }
      }

      streakMilestoneAnnouncement = buildStreakMilestoneAnnouncement(
        player.name,
        player.currentStreak
      );
      if (streakMilestoneAnnouncement) {
        systemChats.push(streakMilestoneAnnouncement);
      }

      keyCollectedBroadcast = {
        keyId: keyObj.id,
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
      };
    }

    const activeTier = evaluateStreakTier(player.currentStreak ?? 0);
    const result: AnswerResultPayload = {
      questionId: question.id,
      correct: true,
      keyId: keyObj.id,
      correctOption: question.correctOption,
      explanation: question.explanation,
      pointsEarned,
      livesRemaining: player.lives,
      streakCount: player.currentStreak ?? 0,
      streakMultiplier: activeTier.multiplier,
      streakBonusPoints,
      streakMilestoneAnnouncement,
    };
    player.lastAnsweredResult = result;

    return {
      ack: { ok: true, result },
      result,
      systemChats,
      keyCollectedBroadcast,
      doorOpenedBroadcast,
      mutatedRoom: true,
    };
  }

  player.wrongAnswers += 1;
  player.currentStreak = 0;
  player.lives = Math.max(0, player.lives - 1);
  if (player.lives <= 0) {
    player.status = room.settings.eliminatedBehavior;
    systemChats.push(
      `${player.name} kehabisan nyawa dan beralih ke mode ${player.status === 'spectator' ? 'Spectator' : 'Eliminated'}.`
    );
  }

  const result: AnswerResultPayload = {
    questionId: question.id,
    correct: false,
    keyId: keyObj.id,
    correctOption: question.correctOption,
    explanation: question.explanation,
    pointsEarned: 0,
    livesRemaining: player.lives,
    streakCount: 0,
    streakMultiplier: 1,
    streakBonusPoints: 0,
    streakMilestoneAnnouncement: null,
  };
  player.lastAnsweredResult = result;

  return {
    ack: { ok: true, result },
    result,
    systemChats,
    mutatedRoom: true,
  };
}

import { GAME_RULES, TEAM_DEFINITIONS, TeamId, TileType } from '../shared/constants';
import { calculatePlayerScore } from '../shared/scoreSystem';
import { GameDatabase } from './database';
import { GameRoom, ServerPlayer } from './roomManager';

export interface AnswerResultPayload {
  questionId: string;
  correct: boolean;
  keyId: string;
  correctOption: 'A' | 'B';
  explanation: string;
  pointsEarned: number;
  livesRemaining: number;
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
    selectedOption: 'A' | 'B' | 'TIMEOUT';
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

  const { keyId, question } = player.activeQuestion;

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

  const keyObj = room.maze.keys.find((k) => k.id === (payload.keyId || keyId));
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
  database.recordQuestionAttempt(question.category, isCorrect);

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

    if (!alreadyClaimed) {
      player.correctAnswers += 1;
      player.keysCollected += 1;
      player.animState = 'key_get';
      player.score = calculatePlayerScore({
        correctAnswers: player.correctAnswers,
        wrongAnswers: player.wrongAnswers,
        keysCollected: player.keysCollected,
        completedLevel: player.status === 'escaped',
        remainingSeconds: room.remainingSeconds,
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

      keyCollectedBroadcast = {
        keyId: keyObj.id,
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
      };
    }

    const result: AnswerResultPayload = {
      questionId: question.id,
      correct: true,
      keyId: keyObj.id,
      correctOption: question.correctOption,
      explanation: question.explanation,
      pointsEarned: alreadyClaimed
        ? 0
        : GAME_RULES.CORRECT_ANSWER_POINTS + GAME_RULES.KEY_COLLECTED_POINTS,
      livesRemaining: player.lives,
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
  };
  player.lastAnsweredResult = result;

  return {
    ack: { ok: true, result },
    result,
    systemChats,
    mutatedRoom: true,
  };
}

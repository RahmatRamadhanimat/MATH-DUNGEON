import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CHARACTER_PRESETS,
  DEFAULT_ROOM_SETTINGS,
  DifficultyLevel,
  Direction,
  GameMode,
  MATH_CATEGORIES,
  MazeBiomeId,
  PlayerAnimState,
  PlayerStatus,
  RoomSettings,
  SOCKET_EVENTS,
  TeamId,
  normalizeRoomCode,
} from './shared/constants';
import { DEFAULT_MAZE_BIOME } from './shared/biomeThemes';
import { extractRoomCodeFromSearch } from './shared/roomJoinLink';
import { GeneratedMaze, generateProceduralMaze } from './shared/mazeGenerator';
import { createVictoryLobbyMaze } from './shared/victoryLobbyMap';
import { SpectatorCameraMode, cycleSpectatedStudentId } from './shared/spectatorCamera';
import {
  ActiveOverheadEmote,
  EMOTE_DEFINITIONS,
  EmoteId,
  triggerPlayerEmote,
} from './shared/emoteSystem';
import { PublicMathQuestion } from './shared/questionGenerator';
import { LeaderboardEntry, TeamLeaderboardEntry } from './shared/scoreSystem';
import { ChatLogItem } from '../server';
import type {
  AnswerResultPayload,
  KeyCollectedBroadcastPayload,
  SubmitAnswerAck,
} from './server/questionSubmission';
import { FxTriggerPayload, MazeCanvasView, RenderPlayerState } from './components/MazeCanvasView';
import { GameplayHUD } from './components/GameplayHUD';
import { ProjectorBigScreenView } from './components/ProjectorBigScreenView';
import { QuestionFeedbackState, QuestionPopupModal } from './components/QuestionPopupModal';
import { MultiplayerLobbyView } from './components/MultiplayerLobbyView';
import { ResultVictoryModal } from './components/ResultVictoryModal';
import { TitleMenuScreen } from './components/TitleMenuScreen';
import { retroAudio } from './game/audio/RetroAudio';

interface ServerRoomState {
  code: string;
  teacherId: string;
  teacherName: string;
  locked: boolean;
  status: 'lobby' | 'playing' | 'paused' | 'ended';
  settings: RoomSettings;
  customQuestionCount?: number;
  remainingSeconds: number;
  sharedKeysCollected: number;
  teamKeysCollected: Record<TeamId, number>;
  doorOpen: boolean;
  teamDoorOpen: Record<TeamId, boolean>;
  playerDoorOpen: string[];
  players: (RenderPlayerState & {
    ready: boolean;
    connected: boolean;
    correctAnswers: number;
    wrongAnswers: number;
    completionTimeSeconds: number | null;
  })[];
  maze: GeneratedMaze;
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  chatHistory: ChatLogItem[];
}

function getOrCreatePlayerId(): string {
  try {
    const existing = sessionStorage.getItem('math_maze_player_id');
    if (existing) return existing;
    const created = `plr-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
    sessionStorage.setItem('math_maze_player_id', created);
    return created;
  } catch {
    return `plr-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export default function App() {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState<string>('Arya Ksatria');
  const [characterId, setCharacterId] = useState<string>(CHARACTER_PRESETS[0].id);
  const [outfitColor, setOutfitColor] = useState<string>(CHARACTER_PRESETS[0].primaryColor);
  const [selectedMode, setSelectedMode] = useState<GameMode>('coop');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('easy');
  const [selectedBiome, setSelectedBiome] = useState<MazeBiomeId>(DEFAULT_MAZE_BIOME);
  const [invitedRoomCode] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined'
        ? extractRoomCodeFromSearch(window.location.search)
        : null;
    } catch {
      return null;
    }
  });
  const [roomCodeInput, setRoomCodeInput] = useState<string>(() => invitedRoomCode ?? 'MATH-4821');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [screenView, setScreenView] = useState<'title' | 'lobby' | 'playing' | 'gameover'>('title');
  const [localRole, setLocalRole] = useState<'teacher' | 'student'>('student');
  const [roomState, setRoomState] = useState<ServerRoomState | null>(null);
  const [endReason, setEndReason] = useState<string>('Seluruh kunci berhasil dikumpulkan!');
  const [spectatorMode, setSpectatorMode] = useState<SpectatorCameraMode>('self');
  const [spectatedPlayerId, setSpectatedPlayerId] = useState<string | null>(null);

  // Active Math Question Popup State
  const [activeQuestion, setActiveQuestion] = useState<PublicMathQuestion | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedbackState | null>(null);
  const [questionSubmitError, setQuestionSubmitError] = useState<string | null>(null);
  const [questionWaitingRetry, setQuestionWaitingRetry] = useState<boolean>(false);

  // Audio state
  const [muted, setMuted] = useState<boolean>(() => retroAudio.isMuted());
  const [volume, setVolume] = useState<number>(() => retroAudio.getVolume());

  // Mini-map HUD toggle & expanded size state (persisted in localStorage)
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('math_maze_show_minimap');
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const [minimapExpandedSize, setMinimapExpandedSize] = useState<boolean>(false);
  const [projectorMode, setProjectorMode] = useState<boolean>(false);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('math_maze_show_minimap', next ? 'true' : 'false');
      } catch {
        // Ignore storage errors in restricted contexts
      }
      return next;
    });
  }, []);

  const handleToggleMinimapSize = useCallback(() => {
    setMinimapExpandedSize((prev) => !prev);
  }, []);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const leftRoomCodeRef = useRef<string | null>(null);
  const isJoiningOrCreatingRef = useRef<boolean>(false);
  const hasAutoStartedRef = useRef<boolean>(false);
  const hasConnectedOnceRef = useRef<boolean>(false);
  const justEscapedDungeonRef = useRef<boolean>(false);
  const profileRef = useRef({
    playerId,
    playerName,
    localRole,
    characterId,
    outfitColor,
  });
  profileRef.current = { playerId, playerName, localRole, characterId, outfitColor };

  const deltaBufferRef = useRef<
    Map<string, { x: number; y: number; d: Direction; a: PlayerAnimState; s: PlayerStatus }>
  >(new Map());
  const activeEmotesRef = useRef<Map<string, ActiveOverheadEmote>>(new Map());
  const fxTriggerRef = useRef<FxTriggerPayload>({ type: null });
  const roomStateRef = useRef<ServerRoomState | null>(null);
  roomStateRef.current = roomState;
  const lastCollectedKeyFxRef = useRef<{
    x?: number;
    y?: number;
    pointsEarned: number;
  } | null>(null);

  const activeQuestionRef = useRef<PublicMathQuestion | null>(null);
  const questionFeedbackRef = useRef<QuestionFeedbackState | null>(null);
  activeQuestionRef.current = activeQuestion;
  questionFeedbackRef.current = questionFeedback;

  const requestingQuestionRef = useRef<boolean>(false);
  const requestQuestionTimerRef = useRef<number | null>(null);
  const appliedAnswerKeyRef = useRef<string | null>(null);
  const pendingSubmitRef = useRef<{
    roomCode: string;
    playerId: string;
    keyId: string;
    questionId: string;
    selectedOption: 'A' | 'B' | 'TIMEOUT';
  } | null>(null);
  const submitWatchdogTimerRef = useRef<number | null>(null);
  const submitFallbackTimerRef = useRef<number | null>(null);

  const clearSubmitTimers = useCallback(() => {
    if (submitWatchdogTimerRef.current !== null) {
      window.clearTimeout(submitWatchdogTimerRef.current);
      submitWatchdogTimerRef.current = null;
    }
    if (submitFallbackTimerRef.current !== null) {
      window.clearTimeout(submitFallbackTimerRef.current);
      submitFallbackTimerRef.current = null;
    }
  }, []);

  const clearRequestLock = useCallback(() => {
    requestingQuestionRef.current = false;
    if (requestQuestionTimerRef.current !== null) {
      window.clearTimeout(requestQuestionTimerRef.current);
      requestQuestionTimerRef.current = null;
    }
  }, []);

  const resetQuestionModal = useCallback(() => {
    clearSubmitTimers();
    clearRequestLock();
    pendingSubmitRef.current = null;
    lastCollectedKeyFxRef.current = null;
    setActiveQuestion(null);
    setQuestionFeedback(null);
    setQuestionSubmitError(null);
    setQuestionWaitingRetry(false);
  }, [clearRequestLock, clearSubmitTimers]);

  const handleDismissQuestionModal = useCallback(() => {
    const celebrate = lastCollectedKeyFxRef.current;
    resetQuestionModal();
    if (celebrate) {
      fxTriggerRef.current = {
        type: 'key',
        x: celebrate.x,
        y: celebrate.y,
        bannerText: '★ KUNCI EMAS! ★',
        subText: `+${celebrate.pointsEarned} POIN`,
      };
    }
  }, [resetQuestionModal]);

  const applyAnswerResult = useCallback(
    (res: AnswerResultPayload) => {
      const currentQ = activeQuestionRef.current;
      if (currentQ && res.questionId && currentQ.id !== res.questionId) {
        return;
      }
      const dedupeKey = res.questionId || res.keyId;
      if (appliedAnswerKeyRef.current === dedupeKey && questionFeedbackRef.current) {
        return;
      }

      appliedAnswerKeyRef.current = dedupeKey;
      pendingSubmitRef.current = null;
      clearSubmitTimers();
      setQuestionSubmitError(null);
      setQuestionWaitingRetry(false);

      if (res.correct) {
        retroAudio.playKeyCollected();
        const keyObj = roomStateRef.current?.maze.keys.find((k) => k.id === res.keyId);
        lastCollectedKeyFxRef.current = {
          x: keyObj?.x,
          y: keyObj?.y,
          pointsEarned: res.pointsEarned,
        };
        fxTriggerRef.current = {
          type: 'key',
          x: keyObj?.x,
          y: keyObj?.y,
          bannerText: '★ KUNCI EMAS! ★',
          subText: `+${res.pointsEarned} POIN`,
        };
      } else {
        lastCollectedKeyFxRef.current = null;
        retroAudio.playWrongAnswer();
        fxTriggerRef.current = { type: 'wrong' };
      }

      setQuestionFeedback({
        correct: res.correct,
        correctOption: res.correctOption,
        explanation: res.explanation,
        pointsEarned: res.pointsEarned,
        livesRemaining: res.livesRemaining,
      });
    },
    [clearSubmitTimers]
  );

  const dispatchAnswerSubmission = useCallback(
    (submission: {
      roomCode: string;
      playerId: string;
      keyId: string;
      questionId: string;
      selectedOption: 'A' | 'B' | 'TIMEOUT';
    }) => {
      const socket = socketRef.current;
      if (!socket) return;

      clearSubmitTimers();
      setQuestionSubmitError(null);
      setQuestionWaitingRetry(false);

      const handleAck = (ack?: SubmitAnswerAck) => {
        if (!ack) return;
        if (ack.ok && ack.result) {
          applyAnswerResult(ack.result);
          return;
        }
        if (!ack.ok) {
          clearSubmitTimers();
          pendingSubmitRef.current = null;
          setQuestionWaitingRetry(false);
          setQuestionSubmitError(
            ack.error || 'Soal sudah tidak aktif. Klik Tutup & Lanjutkan untuk bermain.'
          );
        }
      };

      if (socket.connected) {
        socket.emit(SOCKET_EVENTS.SUBMIT_KEY_ANSWER, submission, handleAck);
      } else {
        socket.connect();
      }

      // Automatic single retry after 2.2s, followed by recoverable UI banner at 4.7s total
      submitWatchdogTimerRef.current = window.setTimeout(() => {
        if (questionFeedbackRef.current || !pendingSubmitRef.current) return;
        const sock = socketRef.current;
        if (sock?.connected) {
          sock.emit(SOCKET_EVENTS.SUBMIT_KEY_ANSWER, pendingSubmitRef.current, handleAck);
        }
        submitFallbackTimerRef.current = window.setTimeout(() => {
          if (questionFeedbackRef.current || !pendingSubmitRef.current) return;
          setQuestionWaitingRetry(true);
          setQuestionSubmitError(
            'Server belum merespons. Anda bisa Kirim Ulang jawaban atau Tutup & Lanjutkan bermain.'
          );
        }, 2500);
      }, 2200);
    },
    [applyAnswerResult, clearSubmitTimers]
  );

  // Mirror state to document.body.dataset.state per game_title_and_hud.md
  useEffect(() => {
    if (screenView === 'title' || screenView === 'lobby') {
      document.body.dataset.state = 'title';
    } else if (screenView === 'gameover') {
      document.body.dataset.state = 'gameover';
    } else if (roomState?.status === 'paused') {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [screenView, roomState?.status]);

  // Connect Socket.IO client
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (hasConnectedOnceRef.current && activeRoomCodeRef.current) {
        const prof = profileRef.current;
        socket.emit(
          SOCKET_EVENTS.JOIN_ROOM,
          {
            roomCode: activeRoomCodeRef.current,
            playerId: prof.playerId,
            name: prof.playerName.trim() || 'Petualang',
            role: prof.localRole,
            characterId: prof.characterId,
            outfitColor: prof.outfitColor,
          },
          () => {
            if (pendingSubmitRef.current && !questionFeedbackRef.current) {
              dispatchAnswerSubmission(pendingSubmitRef.current);
            }
          }
        );
      }
      hasConnectedOnceRef.current = true;
    });

    socket.on(SOCKET_EVENTS.ROOM_STATE, (state: ServerRoomState) => {
      const incomingCode = normalizeRoomCode(state.code);
      if (leftRoomCodeRef.current && incomingCode === leftRoomCodeRef.current) {
        return;
      }
      if (!activeRoomCodeRef.current && !isJoiningOrCreatingRef.current) {
        return;
      }
      if (
        activeRoomCodeRef.current &&
        normalizeRoomCode(activeRoomCodeRef.current) !== incomingCode
      ) {
        return;
      }
      activeRoomCodeRef.current = state.code;
      setRoomState(state);
      setErrorMessage(null);
      if (state.status === 'playing' || state.status === 'paused') {
        setScreenView('playing');
      } else if (state.status === 'ended') {
        resetQuestionModal();
        setScreenView((prev) => (prev === 'playing' ? 'playing' : 'gameover'));
      } else if (state.status === 'lobby') {
        resetQuestionModal();
        setScreenView((prev) => (prev === 'title' ? 'lobby' : prev));
      }
    });

    socket.on(SOCKET_EVENTS.START_GAME, (state: ServerRoomState) => {
      const incomingCode = normalizeRoomCode(state.code);
      if (leftRoomCodeRef.current && incomingCode === leftRoomCodeRef.current) {
        return;
      }
      if (!activeRoomCodeRef.current && !isJoiningOrCreatingRef.current) {
        return;
      }
      justEscapedDungeonRef.current = false;
      deltaBufferRef.current.clear();
      activeEmotesRef.current.clear();
      appliedAnswerKeyRef.current = null;
      resetQuestionModal();
      setSpectatorMode('self');
      setSpectatedPlayerId(null);
      setRoomState(state);
      setScreenView('playing');
      retroAudio.startBgm('exploration');
    });

    socket.on(
      SOCKET_EVENTS.PLAYERS_DELTA,
      (
        deltas: {
          id: string;
          x: number;
          y: number;
          d: Direction;
          a: PlayerAnimState;
          s: PlayerStatus;
        }[]
      ) => {
        for (const item of deltas) {
          deltaBufferRef.current.set(item.id, item);
        }
      }
    );

    socket.on(SOCKET_EVENTS.GAME_TICK, (payload: { remainingSeconds: number }) => {
      setRoomState((prev) => (prev ? { ...prev, remainingSeconds: payload.remainingSeconds } : prev));
    });

    socket.on(SOCKET_EVENTS.RECEIVE_KEY_QUESTION, (question: PublicMathQuestion) => {
      clearRequestLock();
      if (activeQuestionRef.current?.id === question.id) {
        return;
      }
      clearSubmitTimers();
      pendingSubmitRef.current = null;
      setQuestionSubmitError(null);
      setQuestionWaitingRetry(false);
      setQuestionFeedback(null);
      setActiveQuestion(question);
    });

    socket.on(SOCKET_EVENTS.ANSWER_RESULT, (res: AnswerResultPayload) => {
      applyAnswerResult(res);
    });

    socket.on(
      SOCKET_EVENTS.KEY_COLLECTED_BROADCAST,
      (payload: KeyCollectedBroadcastPayload) => {
        if (payload.playerId === profileRef.current.playerId) return;
        const keyObj = roomStateRef.current?.maze.keys.find((k) => k.id === payload.keyId);
        if (keyObj) {
          fxTriggerRef.current = {
            type: 'key',
            x: keyObj.x,
            y: keyObj.y,
            bannerText: '★ KUNCI TIM! ★',
            subText: payload.playerName,
          };
        }
      }
    );

    socket.on(SOCKET_EVENTS.DOOR_OPENED_BROADCAST, () => {
      retroAudio.playDoorOpening();
      fxTriggerRef.current = { type: 'door' };
    });

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg: ChatLogItem) => {
      setRoomState((prev) =>
        prev ? { ...prev, chatHistory: [...prev.chatHistory.slice(-29), msg] } : prev
      );
    });

    socket.on(SOCKET_EVENTS.SYSTEM_NOTIFICATION, (msg: ChatLogItem) => {
      setRoomState((prev) =>
        prev ? { ...prev, chatHistory: [...prev.chatHistory.slice(-29), msg] } : prev
      );
    });

    socket.on(
      SOCKET_EVENTS.PLAYER_EMOTE,
      (payload: {
        id: string;
        playerId: string;
        playerName: string;
        emoteId: EmoteId;
        timestamp: number;
      }) => {
        if (!payload?.playerId || !payload?.emoteId) return;
        triggerPlayerEmote(activeEmotesRef.current, {
          playerId: payload.playerId,
          playerName: payload.playerName || 'Pemain',
          emoteId: payload.emoteId,
          nowMs: performance.now(),
        });
      }
    );

    socket.on(SOCKET_EVENTS.END_GAME, (payload: { reason: string; room: ServerRoomState }) => {
      const incomingCode = normalizeRoomCode(payload.room?.code || '');
      if (leftRoomCodeRef.current && incomingCode === leftRoomCodeRef.current) {
        return;
      }
      if (!activeRoomCodeRef.current && !isJoiningOrCreatingRef.current) {
        return;
      }
      resetQuestionModal();
      setEndReason(payload.reason);
      setRoomState(payload.room);
      if (justEscapedDungeonRef.current) {
        // Player just walked through the Dungeon Exit Door — transition directly into the Victory Sanctuary Lobby!
        justEscapedDungeonRef.current = false;
        setScreenView('playing');
      } else {
        setScreenView('gameover');
      }
      retroAudio.playVictory();
    });

    socket.on(SOCKET_EVENTS.ROOM_ERROR, (payload: { message: string }) => {
      setErrorMessage(payload.message);
    });

    return () => {
      clearSubmitTimers();
      clearRequestLock();
      socket.disconnect();
    };
  }, [applyAnswerResult, clearRequestLock, clearSubmitTimers, dispatchAnswerSubmission, resetQuestionModal]);

  // Quick Play Handler: Creates a live room on the server, joins as student, and starts immediately
  const handleStartQuickPlay = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    leftRoomCodeRef.current = null;
    isJoiningOrCreatingRef.current = true;
    document.body.dataset.state = 'playing';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const cats = MATH_CATEGORIES.filter((c) => c.difficulty === selectedDifficulty).map((c) => c.id);

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit(
      SOCKET_EVENTS.CREATE_ROOM,
      {
        teacherId: `host-${playerId}`,
        teacherName: playerName || 'Petualang',
        settings: {
          ...DEFAULT_ROOM_SETTINGS,
          mode: selectedMode,
          difficulty: selectedDifficulty,
          categories: cats,
          keyCount: 5,
          mapLevel: 1,
          biome: selectedBiome,
        },
      },
      (res: { ok: boolean; roomCode?: string }) => {
        if (res?.ok && res.roomCode) {
          activeRoomCodeRef.current = res.roomCode;
          setLocalRole('student');
          socket.emit(
            SOCKET_EVENTS.JOIN_ROOM,
            {
              roomCode: res.roomCode,
              playerId,
              name: playerName || 'Petualang',
              role: 'student',
              characterId,
              outfitColor,
            },
            () => {
              isJoiningOrCreatingRef.current = false;
              socket.emit(SOCKET_EVENTS.START_GAME, { roomCode: res.roomCode });
            }
          );
        } else {
          isJoiningOrCreatingRef.current = false;
        }
      }
    );
  }, [playerId, playerName, selectedMode, selectedDifficulty, selectedBiome, characterId, outfitColor]);

  // Support ?autostart=1 once on initial mount and Enter/Space on Title screen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && screenView === 'title' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const t = window.setTimeout(() => {
        handleStartQuickPlay();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [screenView, handleStartQuickPlay]);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (screenView === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        handleStartQuickPlay();
      } else if (screenView === 'playing' && !activeQuestion) {
        if ((e.key === 't' || e.key === 'T') && localRole === 'teacher') {
          e.preventDefault();
          retroAudio.playButtonClick();
          setProjectorMode((prev) => !prev);
          return;
        }
        // When Big Screen Projector Mode is active, let ProjectorBigScreenView own Esc & F shortcuts
        if (projectorMode) return;

        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          e.preventDefault();
          handleTogglePause();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.key === 'n' || e.key === 'N' || e.key === 'Tab') {
          e.preventDefault();
          retroAudio.playButtonClick();
          handleToggleMinimap();
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          const inLobby = Boolean(
            roomState && (localPlayerObj?.status === 'escaped' || roomState.status === 'ended')
          );
          if (inLobby) {
            fxTriggerRef.current = { type: 'teleportToPodium' };
          } else {
            const doorOpen = isDoorOpenForLocalPlayer();
            fxTriggerRef.current = { type: doorOpen ? 'teleportToExit' : 'teleportToKey' };
          }
        } else if (e.key >= '1' && e.key <= '6') {
          const idx = Number(e.key) - 1;
          const emoteDef = EMOTE_DEFINITIONS[idx];
          if (emoteDef) {
            e.preventDefault();
            handleTriggerEmote(emoteDef.id);
          }
        }
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  });

  const handleJoinRoomAsStudent = (overrideCode?: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) {
      socket.connect();
    }
    const cleanCode = normalizeRoomCode(overrideCode ?? roomCodeInput);
    if (!cleanCode) {
      setErrorMessage('Masukkan kode room terlebih dahulu (contoh: MATH-4821).');
      return;
    }
    if (!playerName.trim()) {
      setErrorMessage('Masukkan nama siswa terlebih dahulu.');
      return;
    }

    setRoomCodeInput(cleanCode);
    setErrorMessage(null);
    setLocalRole('student');
    leftRoomCodeRef.current = null;
    isJoiningOrCreatingRef.current = true;
    activeRoomCodeRef.current = cleanCode;
    socket.emit(
      SOCKET_EVENTS.JOIN_ROOM,
      {
        roomCode: cleanCode,
        playerId,
        name: playerName.trim(),
        role: 'student',
        characterId,
        outfitColor,
      },
      (res: { ok: boolean; state?: ServerRoomState; error?: string }) => {
        isJoiningOrCreatingRef.current = false;
        if (!res?.ok) {
          activeRoomCodeRef.current = null;
          setErrorMessage(res?.error || 'Gagal bergabung ke room.');
        } else {
          if (res.state) setRoomState(res.state);
          setScreenView('lobby');
        }
      }
    );
  };

  const handleCreateRoomAsTeacher = () => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) {
      socket.connect();
    }
    if (!playerName.trim()) {
      setErrorMessage('Masukkan nama guru terlebih dahulu.');
      return;
    }

    setErrorMessage(null);
    setLocalRole('teacher');
    leftRoomCodeRef.current = null;
    isJoiningOrCreatingRef.current = true;
    const cats = MATH_CATEGORIES.filter((c) => c.difficulty === selectedDifficulty).map((c) => c.id);

    socket.emit(
      SOCKET_EVENTS.CREATE_ROOM,
      {
        teacherId: playerId,
        teacherName: playerName.trim(),
        settings: {
          ...DEFAULT_ROOM_SETTINGS,
          mode: selectedMode,
          difficulty: selectedDifficulty,
          categories: cats,
          biome: selectedBiome,
        },
      },
      (res: { ok: boolean; roomCode?: string; state?: ServerRoomState; error?: string }) => {
        isJoiningOrCreatingRef.current = false;
        if (res?.ok && res.roomCode) {
          activeRoomCodeRef.current = res.roomCode;
          if (res.state) setRoomState(res.state);
          setScreenView('lobby');
        } else {
          setErrorMessage(res?.error || 'Gagal membuat room.');
        }
      }
    );
  };

  const handleLeaveCurrentRoom = () => {
    retroAudio.stopBgm();
    const code = activeRoomCodeRef.current || roomState?.code;
    leftRoomCodeRef.current = code ? normalizeRoomCode(code) : null;
    isJoiningOrCreatingRef.current = false;
    activeRoomCodeRef.current = null;
    resetQuestionModal();
    setSpectatorMode('self');
    setSpectatedPlayerId(null);
    setProjectorMode(false);
    setRoomState(null);
    setScreenView('title');
    if (socketRef.current && code) {
      socketRef.current.emit(SOCKET_EVENTS.LEAVE_ROOM, {
        roomCode: code,
        playerId,
      });
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    retroAudio.setMuted(next);
    setMuted(next);
  };

  const handleChangeVolume = (vol: number) => {
    retroAudio.setVolume(vol);
    setVolume(vol);
  };

  const handleTogglePause = () => {
    if (!roomState || !socketRef.current) return;
    if (roomState.status === 'paused') {
      socketRef.current.emit(SOCKET_EVENTS.RESUME_GAME, { roomCode: roomState.code });
    } else if (roomState.status === 'playing') {
      socketRef.current.emit(SOCKET_EVENTS.PAUSE_GAME, { roomCode: roomState.code });
    }
  };

  const handleMoveSync = useCallback(
    (x: number, y: number, direction: Direction, animState: PlayerAnimState) => {
      if (!socketRef.current || !roomState) return;
      socketRef.current.emit(SOCKET_EVENTS.PLAYER_MOVE, {
        roomCode: roomState.code,
        playerId,
        x,
        y,
        direction,
        animState,
      });
    },
    [roomState, playerId]
  );

  const handleTouchKey = useCallback(
    (keyId: string) => {
      if (
        !socketRef.current ||
        !roomState ||
        activeQuestionRef.current ||
        requestingQuestionRef.current
      ) {
        return;
      }
      requestingQuestionRef.current = true;
      if (requestQuestionTimerRef.current !== null) {
        window.clearTimeout(requestQuestionTimerRef.current);
      }
      requestQuestionTimerRef.current = window.setTimeout(() => {
        requestingQuestionRef.current = false;
        requestQuestionTimerRef.current = null;
      }, 1500);

      socketRef.current.emit(SOCKET_EVENTS.REQUEST_KEY_QUESTION, {
        roomCode: roomState.code,
        playerId,
        keyId,
      });
    },
    [roomState, playerId]
  );

  const handleSelectAnswer = useCallback(
    (selectedOption: 'A' | 'B' | 'TIMEOUT') => {
      if (!socketRef.current || !roomState || !activeQuestionRef.current) return;
      const q = activeQuestionRef.current;
      const submission = {
        roomCode: roomState.code,
        playerId,
        keyId: q.keyId,
        questionId: q.id,
        selectedOption,
      };
      pendingSubmitRef.current = submission;
      dispatchAnswerSubmission(submission);
    },
    [roomState, playerId, dispatchAnswerSubmission]
  );

  const handleRetrySubmitAnswer = useCallback(() => {
    if (!pendingSubmitRef.current) return;
    dispatchAnswerSubmission(pendingSubmitRef.current);
  }, [dispatchAnswerSubmission]);

  const handleReachExit = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    justEscapedDungeonRef.current = true;
    fxTriggerRef.current = {
      type: 'key',
      x: 13.5 * 32,
      y: 15.5 * 32,
      bannerText: '★ LOBBY PEMENANG! ★',
      subText: 'KELUAR DUNGEON BERHASIL',
    };
    socketRef.current.emit(SOCKET_EVENTS.PLAYER_REACHED_EXIT, {
      roomCode: roomState.code,
      playerId,
    });
  }, [roomState, playerId]);

  const localPlayerObj = roomState?.players.find((p) => p.id === playerId);
  const spectatedPlayerName =
    roomState?.players.find((p) => p.id === spectatedPlayerId)?.name ??
    roomState?.leaderboard.find((e) => e.playerId === spectatedPlayerId)?.name ??
    null;

  const handleSelectSpectatePlayer = useCallback((targetPlayerId: string) => {
    setSpectatedPlayerId(targetPlayerId);
    setSpectatorMode('follow_student');
  }, []);

  const handleCycleSpectatePlayer = useCallback(
    (delta: 1 | -1) => {
      if (!roomState) return;
      const ids = roomState.leaderboard.map((e) => e.playerId);
      const nextId = cycleSpectatedStudentId(ids, spectatedPlayerId, delta);
      if (nextId) {
        setSpectatedPlayerId(nextId);
        setSpectatorMode('follow_student');
      }
    },
    [roomState, spectatedPlayerId]
  );

  const handleTriggerEmote = useCallback(
    (emoteId: EmoteId) => {
      const myName = localPlayerObj?.name ?? playerName;
      triggerPlayerEmote(activeEmotesRef.current, {
        playerId,
        playerName: myName,
        emoteId,
        nowMs: performance.now(),
      });
      if (emoteId === 'fireworks') {
        fxTriggerRef.current = {
          type: 'key',
          bannerText: '★ KEMBANG API! ★',
          subText: myName,
        };
      }
      if (socketRef.current && roomState) {
        socketRef.current.emit(SOCKET_EVENTS.PLAYER_EMOTE, {
          roomCode: roomState.code,
          playerId,
          emoteId,
        });
      }
    },
    [localPlayerObj?.name, playerId, playerName, roomState]
  );

  const isDoorOpenForLocalPlayer = (): boolean => {
    if (!roomState) return false;
    if (roomState.settings.mode === 'coop') return roomState.doorOpen;
    if (roomState.settings.mode === 'competitive') {
      return roomState.playerDoorOpen.includes(playerId);
    }
    if (roomState.settings.mode === 'team' && localPlayerObj?.teamId) {
      return Boolean(roomState.teamDoorOpen[localPlayerObj.teamId]);
    }
    return roomState.doorOpen;
  };

  // Fallback maze if needed before first room state arrives
  const activeMaze =
    roomState?.maze ?? generateProceduralMaze({ level: 1, keyCount: 5, seed: 4821 });
  const isInVictoryLobby = Boolean(
    roomState && (localPlayerObj?.status === 'escaped' || roomState.status === 'ended')
  );
  const displayedMaze = isInVictoryLobby ? createVictoryLobbyMaze() : activeMaze;

  return (
    <div className="min-h-[100dvh] w-full bg-[#090D15] text-slate-100">
      {screenView === 'title' && (
        <TitleMenuScreen
          playerName={playerName}
          characterId={characterId}
          outfitColor={outfitColor}
          selectedMode={selectedMode}
          selectedDifficulty={selectedDifficulty}
          selectedBiome={selectedBiome}
          roomCodeInput={roomCodeInput}
          invitedRoomCode={invitedRoomCode}
          errorMessage={errorMessage}
          muted={muted}
          volume={volume}
          onChangeName={setPlayerName}
          onChangeCharacter={(id, defaultColor) => {
            setCharacterId(id);
            setOutfitColor(defaultColor);
          }}
          onChangeOutfitColor={setOutfitColor}
          onChangeMode={setSelectedMode}
          onChangeDifficulty={setSelectedDifficulty}
          onChangeBiome={setSelectedBiome}
          onChangeRoomCodeInput={setRoomCodeInput}
          onStartQuickPlay={handleStartQuickPlay}
          onJoinRoomAsStudent={handleJoinRoomAsStudent}
          onCreateRoomAsTeacher={handleCreateRoomAsTeacher}
          onToggleMute={handleToggleMute}
          onChangeVolume={handleChangeVolume}
        />
      )}

      {screenView === 'lobby' && roomState && (
        projectorMode && localRole === 'teacher' ? (
          <ProjectorBigScreenView
            roomCode={roomState.code}
            roomStatus="lobby"
            teacherName={roomState.teacherName}
            level={roomState.settings.mapLevel}
            mode={roomState.settings.mode}
            biome={roomState.settings.biome}
            maze={displayedMaze}
            players={roomState.players}
            leaderboard={roomState.leaderboard}
            teamLeaderboard={roomState.teamLeaderboard}
            sharedKeysCollected={roomState.sharedKeysCollected}
            teamKeysCollected={roomState.teamKeysCollected}
            targetKeys={roomState.settings.keyCount}
            remainingSeconds={roomState.remainingSeconds}
            maxPlayers={roomState.settings.maxPlayers}
            chatHistory={roomState.chatHistory}
            deltaBufferRef={deltaBufferRef}
            activeEmotesRef={activeEmotesRef}
            onExitProjectorMode={() => setProjectorMode(false)}
            onStartGameFromLobby={() => {
              if (roomState.players.filter((p) => p.role === 'student').length === 0) {
                socketRef.current?.emit(
                  SOCKET_EVENTS.JOIN_ROOM,
                  {
                    roomCode: roomState.code,
                    playerId,
                    name: playerName || 'Guru Petualang',
                    role: 'student',
                    characterId,
                    outfitColor,
                  },
                  () => {
                    socketRef.current?.emit(SOCKET_EVENTS.START_GAME, { roomCode: roomState.code });
                  }
                );
              } else {
                socketRef.current?.emit(SOCKET_EVENTS.START_GAME, { roomCode: roomState.code });
              }
            }}
          />
        ) : (
          <MultiplayerLobbyView
            roomCode={roomState.code}
            teacherName={roomState.teacherName}
            locked={roomState.locked}
            settings={roomState.settings}
            customQuestionCount={roomState.customQuestionCount}
            players={roomState.players}
            leaderboard={roomState.leaderboard}
            localPlayerId={playerId}
            localRole={localRole}
            localReady={localPlayerObj?.ready ?? true}
            onToggleReady={() =>
              socketRef.current?.emit(SOCKET_EVENTS.TOGGLE_READY, {
                roomCode: roomState.code,
                playerId,
              })
            }
            onUpdateSettings={(partial) =>
              socketRef.current?.emit(SOCKET_EVENTS.UPDATE_SETTINGS, {
                roomCode: roomState.code,
                settings: partial,
              })
            }
            onToggleLockRoom={() =>
              socketRef.current?.emit(SOCKET_EVENTS.LOCK_ROOM, {
                roomCode: roomState.code,
              })
            }
            onAssignTeams={(mode, manualMap) =>
              socketRef.current?.emit(SOCKET_EVENTS.ASSIGN_TEAMS, {
                roomCode: roomState.code,
                mode,
                manualMap,
              })
            }
            onStartGame={() => {
              // If Teacher starts game and there are no students yet, join teacher as an explorer too so teacher can test or observe
              if (roomState.players.filter((p) => p.role === 'student').length === 0) {
                socketRef.current?.emit(
                  SOCKET_EVENTS.JOIN_ROOM,
                  {
                    roomCode: roomState.code,
                    playerId,
                    name: playerName || 'Guru Petualang',
                    role: 'student',
                    characterId,
                    outfitColor,
                  },
                  () => {
                    socketRef.current?.emit(SOCKET_EVENTS.START_GAME, { roomCode: roomState.code });
                  }
                );
              } else {
                socketRef.current?.emit(SOCKET_EVENTS.START_GAME, { roomCode: roomState.code });
              }
            }}
            onOpenProjectorMode={() => setProjectorMode(true)}
            onLeaveLobby={handleLeaveCurrentRoom}
          />
        )
      )}

      {screenView === 'playing' && roomState && (
        projectorMode && localRole === 'teacher' ? (
          <ProjectorBigScreenView
            roomCode={roomState.code}
            roomStatus={roomState.status}
            teacherName={roomState.teacherName}
            level={roomState.settings.mapLevel}
            mode={roomState.settings.mode}
            biome={roomState.settings.biome}
            maze={displayedMaze}
            players={roomState.players}
            leaderboard={roomState.leaderboard}
            teamLeaderboard={roomState.teamLeaderboard}
            sharedKeysCollected={roomState.sharedKeysCollected}
            teamKeysCollected={roomState.teamKeysCollected}
            targetKeys={roomState.settings.keyCount}
            remainingSeconds={roomState.remainingSeconds}
            maxPlayers={roomState.settings.maxPlayers}
            chatHistory={roomState.chatHistory}
            deltaBufferRef={deltaBufferRef}
            activeEmotesRef={activeEmotesRef}
            onExitProjectorMode={() => setProjectorMode(false)}
          />
        ) : (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden">
          <MazeCanvasView
            maze={displayedMaze}
            localPlayerId={playerId}
            localCharacterId={localPlayerObj?.characterId ?? characterId}
            localOutfitColor={localPlayerObj?.outfitColor ?? outfitColor}
            localPlayerName={localPlayerObj?.name ?? playerName}
            localTeamId={localPlayerObj?.teamId ?? null}
            localStatus={localPlayerObj?.status ?? 'active'}
            gameMode={roomState.settings.mode}
            biome={roomState.settings.biome}
            isPaused={roomState.status === 'paused'}
            isQuestionOpen={Boolean(activeQuestion)}
            isDoorOpenForMe={isDoorOpenForLocalPlayer()}
            players={roomState.players}
            leaderboard={roomState.leaderboard}
            spectatorMode={spectatorMode}
            spectatedPlayerId={spectatedPlayerId}
            onSelectSpectatePlayer={handleSelectSpectatePlayer}
            onChangeSpectatorMode={setSpectatorMode}
            activeEmotesRef={activeEmotesRef}
            deltaBufferRef={deltaBufferRef}
            fxTriggerRef={fxTriggerRef}
            onMoveSync={handleMoveSync}
            onTouchKey={handleTouchKey}
            onReachExit={handleReachExit}
            onOpenVictoryResults={() => setScreenView('gameover')}
            showMinimap={showMinimap}
            minimapExpandedSize={minimapExpandedSize}
            onToggleMinimap={handleToggleMinimap}
            onToggleMinimapSize={handleToggleMinimapSize}
          />

          <GameplayHUD
            roomCode={roomState.code}
            level={roomState.settings.mapLevel}
            mode={roomState.settings.mode}
            biome={roomState.settings.biome}
            localPlayerId={playerId}
            playerName={localPlayerObj?.name ?? playerName}
            playerRole={localRole}
            teamId={localPlayerObj?.teamId ?? null}
            lives={localPlayerObj?.lives ?? roomState.settings.lives}
            maxLives={roomState.settings.lives}
            score={localPlayerObj?.score ?? 0}
            myKeysCollected={localPlayerObj?.keysCollected ?? 0}
            sharedKeysCollected={roomState.sharedKeysCollected}
            teamKeysCollected={roomState.teamKeysCollected}
            targetKeys={roomState.settings.keyCount}
            doorOpenForMe={isDoorOpenForLocalPlayer()}
            remainingSeconds={roomState.remainingSeconds}
            playerStatus={localPlayerObj?.status ?? 'active'}
            isPaused={roomState.status === 'paused'}
            isVictoryLobby={isInVictoryLobby}
            muted={muted}
            showMinimap={showMinimap}
            minimapExpandedSize={minimapExpandedSize}
            leaderboard={roomState.leaderboard}
            teamLeaderboard={roomState.teamLeaderboard}
            chatHistory={roomState.chatHistory}
            spectatorMode={spectatorMode}
            spectatedPlayerId={spectatedPlayerId}
            spectatedPlayerName={spectatedPlayerName}
            onSelectSpectatePlayer={handleSelectSpectatePlayer}
            onChangeSpectatorMode={setSpectatorMode}
            onCycleSpectatePlayer={handleCycleSpectatePlayer}
            onToggleMute={handleToggleMute}
            onToggleMinimap={handleToggleMinimap}
            onTogglePause={handleTogglePause}
            onSendChat={(text, type) =>
              socketRef.current?.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
                roomCode: roomState.code,
                playerId,
                text,
                type,
              })
            }
            onTriggerEmote={handleTriggerEmote}
            onTeacherEndGame={() =>
              socketRef.current?.emit(SOCKET_EVENTS.END_GAME, {
                roomCode: roomState.code,
                reason: 'Permainan diselesaikan oleh Guru.',
              })
            }
            onTeacherRestartGame={() =>
              socketRef.current?.emit(SOCKET_EVENTS.RESTART_GAME, {
                roomCode: roomState.code,
              })
            }
            onOpenProjectorMode={() => setProjectorMode(true)}
            onLeaveRoom={handleLeaveCurrentRoom}
            onOpenVictoryResults={() => setScreenView('gameover')}
          />

          {activeQuestion && (
            <QuestionPopupModal
              key={activeQuestion.id}
              question={activeQuestion}
              feedback={questionFeedback}
              submitError={questionSubmitError}
              canRetryOrClose={questionWaitingRetry}
              onSelectAnswer={handleSelectAnswer}
              onRetrySubmit={handleRetrySubmitAnswer}
              onCloseFeedback={handleDismissQuestionModal}
            />
          )}
        </div>
        )
      )}

      {screenView === 'gameover' && roomState && (
        <ResultVictoryModal
          roomCode={roomState.code}
          mode={roomState.settings.mode}
          reason={endReason}
          localPlayerId={playerId}
          localRole={localRole}
          leaderboard={roomState.leaderboard}
          teamLeaderboard={roomState.teamLeaderboard}
          onExploreVictoryLobby={() => {
            setScreenView('playing');
          }}
          onPlayAgain={() => {
            socketRef.current?.emit(SOCKET_EVENTS.RESTART_GAME, {
              roomCode: roomState.code,
            });
          }}
          onReturnToMenu={handleLeaveCurrentRoom}
        />
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Trophy,
} from 'lucide-react';
import {
  Direction,
  GAME_RULES,
  GameMode,
  KEY_TYPES_INFO,
  MazeBiomeId,
  PlayerAnimState,
  PlayerStatus,
  TeamId,
  TileType,
} from '../shared/constants';
import { DEFAULT_MAZE_BIOME, getMazeBiomeTheme } from '../shared/biomeThemes';
import { GeneratedMaze, isWalkableTile } from '../shared/mazeGenerator';
import { computeWallShadowQuads, hasLineOfSight } from '../shared/lightingSystem';
import {
  DiscoveredMinimapState,
  MINIMAP_CELL_DISCOVERED,
  MINIMAP_CELL_VISIBLE,
  MinimapViewMode,
  MinimapViewport,
  ObjectiveCompassInfo,
  computeMinimapViewport,
  createDiscoveredMinimapState,
  getNearestObjectiveCompass,
  minimapPixelToWorldCoord,
  updateDiscoveredMinimap,
} from '../shared/minimapSystem';
import { MiniMapOverlay } from './MiniMapOverlay';
import {
  VICTORY_LOBBY_LANDMARKS,
  VictoryLobbyLandmark,
  getNearestLobbyLandmark,
  isVictoryLobbyMaze,
} from '../shared/victoryLobbyMap';
import {
  SpectatorCameraMode,
  resolveSpectatorCameraTarget,
  stepFreeCamPosition,
} from '../shared/spectatorCamera';
import {
  ActiveOverheadEmote,
  evaluatePlayerEmote,
  renderOverheadEmoteBalloon,
} from '../shared/emoteSystem';
import { LeaderboardEntry } from '../shared/scoreSystem';
import { getCharacterSprite, getKeySprite, getTileSprite } from '../game/assets/PixelArtSprites';
import { retroAudio } from '../game/audio/RetroAudio';
import {
  DpadInputState,
  clearDpadInput,
  createDpadInputState,
  moveDpadDirection,
  pressDpadDirection,
  releaseDpadInput,
  resolveDpadDirectionFromPoint,
  resolveMovementVector,
  triggerDpadTap,
} from '../shared/dpadLogic';
import {
  createParticleSystemState,
  hasActiveParticleEffects,
  renderParticleSystem,
  spawnGenericParticles,
  spawnGoldenKeyBurst,
  stepParticleSystem,
} from '../shared/particleSystem';

export interface RenderPlayerState {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  characterId: string;
  outfitColor: string;
  teamId: TeamId | null;
  ready?: boolean;
  connected?: boolean;
  x: number;
  y: number;
  direction: Direction;
  animState: PlayerAnimState;
  status: PlayerStatus;
  score: number;
  lives: number;
  keysCollected: number;
}

export interface FxTriggerPayload {
  type:
    | 'key'
    | 'correct'
    | 'wrong'
    | 'door'
    | 'teleportToPodium'
    | null;
  x?: number;
  y?: number;
  bannerText?: string;
  subText?: string;
}

interface MazeCanvasViewProps {
  maze: GeneratedMaze;
  localPlayerId: string;
  localCharacterId: string;
  localOutfitColor: string;
  localPlayerName: string;
  localTeamId: TeamId | null;
  localStatus: PlayerStatus;
  gameMode: GameMode;
  biome?: MazeBiomeId;
  isPaused: boolean;
  isQuestionOpen: boolean;
  isDoorOpenForMe: boolean;
  players: RenderPlayerState[];
  leaderboard?: LeaderboardEntry[];
  spectatorMode?: SpectatorCameraMode;
  spectatedPlayerId?: string | null;
  onSelectSpectatePlayer?: (playerId: string) => void;
  onChangeSpectatorMode?: (mode: SpectatorCameraMode) => void;
  activeEmotesRef?: React.MutableRefObject<Map<string, ActiveOverheadEmote>>;
  deltaBufferRef: React.MutableRefObject<
    Map<string, { x: number; y: number; d: Direction; a: PlayerAnimState; s: PlayerStatus }>
  >;
  fxTriggerRef: React.MutableRefObject<FxTriggerPayload>;
  onMoveSync: (x: number, y: number, direction: Direction, animState: PlayerAnimState) => void;
  onTouchKey: (keyId: string) => void;
  onReachExit: () => void;
  onOpenVictoryResults?: () => void;
  showMinimap?: boolean;
  minimapExpandedSize?: boolean;
  onToggleMinimap?: () => void;
  onToggleMinimapSize?: () => void;
}

export const MazeCanvasView: React.FC<MazeCanvasViewProps> = ({
  maze,
  localPlayerId,
  localCharacterId,
  localOutfitColor,
  localPlayerName,
  localTeamId,
  localStatus,
  gameMode,
  biome = DEFAULT_MAZE_BIOME,
  isPaused,
  isQuestionOpen,
  isDoorOpenForMe,
  players,
  leaderboard = [],
  spectatorMode = 'self',
  spectatedPlayerId = null,
  onSelectSpectatePlayer,
  onChangeSpectatorMode,
  activeEmotesRef,
  deltaBufferRef,
  fxTriggerRef,
  onMoveSync,
  onTouchKey,
  onReachExit,
  onOpenVictoryResults,
  showMinimap = true,
  minimapExpandedSize = false,
  onToggleMinimap,
  onToggleMinimapSize,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLobbyMaze = isVictoryLobbyMaze(maze);
  const [minimapViewMode, setMinimapViewMode] = useState<MinimapViewMode>(() =>
    !isLobbyMaze && (maze.width >= 55 || maze.height >= 55) ? 'radar' : 'full'
  );
  const minimapViewModeRef = useRef<MinimapViewMode>(minimapViewMode);
  const lastMinimapViewportRef = useRef<MinimapViewport>({
    startX: 0,
    startY: 0,
    spanX: maze.width,
    spanY: maze.height,
    isZoomed: false,
  });
  const [playerTile, setPlayerTile] = useState<{ x: number; y: number }>(() => ({
    x: maze.spawnTile.x,
    y: maze.spawnTile.y,
  }));
  const [minimapStats, setMinimapStats] = useState({
    discoveryPercent: isLobbyMaze ? 100 : 5,
    discoveredRoomsCount: isLobbyMaze ? maze.secretRooms.length : 0,
    totalRoomsCount: maze.secretRooms.length,
  });
  const [nearestLandmark, setNearestLandmark] = useState<VictoryLobbyLandmark | null>(null);
  const [activeDpadDir, setActiveDpadDir] = useState<Direction | null>(null);

  const objectiveCompass: ObjectiveCompassInfo | null = useMemo(() => {
    if (isLobbyMaze) return null;
    const availableKeys = maze.keys.filter((k) => {
      if (gameMode === 'coop') return k.collectedBy === null;
      if (gameMode === 'competitive') return !k.collectedByPlayers.includes(localPlayerId);
      if (gameMode === 'team' && localTeamId) return !k.collectedByTeams.includes(localTeamId);
      return k.collectedBy === null;
    });
    return getNearestObjectiveCompass({
      playerTileX: playerTile.x,
      playerTileY: playerTile.y,
      isDoorOpen: isDoorOpenForMe,
      exitTile: maze.exitTile,
      availableKeys,
    });
  }, [
    isLobbyMaze,
    maze.keys,
    maze.exitTile,
    gameMode,
    localPlayerId,
    localTeamId,
    playerTile.x,
    playerTile.y,
    isDoorOpenForMe,
  ]);

  useEffect(() => {
    minimapViewModeRef.current = minimapViewMode;
  }, [minimapViewMode]);

  // Automatically default to zoomed Radar mode on larger maps (55x55, 65x65, 75x75) and Full mode in Lobby
  useEffect(() => {
    const nextMode: MinimapViewMode =
      !isLobbyMaze && (maze.width >= 55 || maze.height >= 55) ? 'radar' : 'full';
    setMinimapViewMode(nextMode);
    minimapViewModeRef.current = nextMode;
    setPlayerTile({ x: maze.spawnTile.x, y: maze.spawnTile.y });
  }, [maze.seed, maze.width, maze.height, maze.spawnTile.x, maze.spawnTile.y, isLobbyMaze]);

  // Store latest props in refs so 60Hz loop never tears down canvas
  const propsRef = useRef({
    maze,
    localPlayerId,
    localCharacterId,
    localOutfitColor,
    localPlayerName,
    localTeamId,
    localStatus,
    gameMode,
    biome,
    isPaused,
    isQuestionOpen,
    isDoorOpenForMe,
    players,
    leaderboard,
    spectatorMode,
    spectatedPlayerId,
    onSelectSpectatePlayer,
    onChangeSpectatorMode,
    onMoveSync,
    onTouchKey,
    onReachExit,
    onOpenVictoryResults,
  });

  useEffect(() => {
    propsRef.current = {
      maze,
      localPlayerId,
      localCharacterId,
      localOutfitColor,
      localPlayerName,
      localTeamId,
      localStatus,
      gameMode,
      biome,
      isPaused,
      isQuestionOpen,
      isDoorOpenForMe,
      players,
      leaderboard,
      spectatorMode,
      spectatedPlayerId,
      onSelectSpectatePlayer,
      onChangeSpectatorMode,
      onMoveSync,
      onTouchKey,
      onReachExit,
      onOpenVictoryResults,
    };
  }, [
    maze,
    localPlayerId,
    localCharacterId,
    localOutfitColor,
    localPlayerName,
    localTeamId,
    localStatus,
    gameMode,
    biome,
    isPaused,
    isQuestionOpen,
    isDoorOpenForMe,
    players,
    leaderboard,
    spectatorMode,
    spectatedPlayerId,
    onSelectSpectatePlayer,
    onChangeSpectatorMode,
    onMoveSync,
    onTouchKey,
    onReachExit,
    onOpenVictoryResults,
  ]);

  // Persistent local simulation state
  const localPosRef = useRef<{
    x: number;
    y: number;
    dir: Direction;
    anim: PlayerAnimState;
    walkDist: number;
    seed: number;
    lastKeyTouchedId: string | null;
    lastKeyTouchTime: number;
    exitTriggered: boolean;
    screenFlashColor: string | null;
    screenFlashTimer: number;
    cameraShake: number;
  }>({
    x: maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2,
    y: maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2,
    dir: 'right',
    anim: 'idle',
    walkDist: 0,
    seed: maze.seed,
    lastKeyTouchedId: null,
    lastKeyTouchTime: 0,
    exitTriggered: false,
    screenFlashColor: null,
    screenFlashTimer: 0,
    cameraShake: 0,
  });

  const cameraPosRef = useRef<{ x: number; y: number }>({
    x: localPosRef.current.x,
    y: localPosRef.current.y,
  });
  const freeCamPosRef = useRef<{ x: number; y: number }>({
    x: localPosRef.current.x,
    y: localPosRef.current.y,
  });
  const prevSpectatorModeRef = useRef<SpectatorCameraMode>(spectatorMode);

  useEffect(() => {
    if (spectatorMode === 'free_cam' && prevSpectatorModeRef.current !== 'free_cam') {
      freeCamPosRef.current = {
        x: cameraPosRef.current.x,
        y: cameraPosRef.current.y,
      };
    }
    prevSpectatorModeRef.current = spectatorMode;
  }, [spectatorMode]);

  const keysHeldRef = useRef<Set<string>>(new Set());
  const dpadStateRef = useRef<DpadInputState>(createDpadInputState());
  const dpadPadRef = useRef<HTMLDivElement | null>(null);
  const dpadPointerIdRef = useRef<number | null>(null);
  const lastPointerTapAtRef = useRef<number>(0);

  // Reset local spawn position when a new maze seed arrives
  useEffect(() => {
    if (localPosRef.current.seed !== maze.seed) {
      const enteringLobby = isVictoryLobbyMaze(maze);
      localPosRef.current.seed = maze.seed;
      localPosRef.current.x = maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
      localPosRef.current.y = maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
      localPosRef.current.dir = enteringLobby ? 'up' : 'right';
      localPosRef.current.anim = 'idle';
      localPosRef.current.lastKeyTouchedId = null;
      localPosRef.current.exitTriggered = false;
      freeCamPosRef.current = { x: localPosRef.current.x, y: localPosRef.current.y };
      cameraPosRef.current = { x: localPosRef.current.x, y: localPosRef.current.y };
      setMinimapStats({
        discoveryPercent: enteringLobby ? 100 : 5,
        discoveredRoomsCount: enteringLobby ? maze.secretRooms.length : 0,
        totalRoomsCount: maze.secretRooms.length,
      });
    }
  }, [maze]);

  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pre-allocate Zero-GC Particle, Golden Shockwave Ring & Floating Banner State
    const particleState = createParticleSystemState();
    canvas.dataset.goldenBurstCount = '0';

    // Remote players interpolated coordinates map
    const remoteInterp = new Map<
      string,
      { x: number; y: number; dir: Direction; anim: PlayerAnimState; walkDist: number }
    >();

    // Reusable offscreen darkness & wall-shadow buffer (0.5x scale for 4x lower fill rate)
    const LIGHT_BUFFER_SCALE = 0.5;
    const lightCanvas = document.createElement('canvas');
    const lctx = lightCanvas.getContext('2d');

    // Discovered fog-of-war state for the top-right transparent mini-map
    let discoveredMinimap: DiscoveredMinimapState = createDiscoveredMinimapState(
      propsRef.current.maze
    );
    let lastPlayerTileX = -1;
    let lastPlayerTileY = -1;
    let lastLandmarkId: string | null = null;

    // ResizeObserver & visualViewport for crisp mobile/desktop sizing
    const updateSize = () => {
      if (!canvas) return;
      const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const vh = Math.round(window.visualViewport?.height ?? window.innerHeight);
      canvas.width = vw;
      canvas.height = vh;
      lightCanvas.width = Math.max(1, Math.ceil(canvas.width * LIGHT_BUFFER_SCALE));
      lightCanvas.height = Math.max(1, Math.ceil(canvas.height * LIGHT_BUFFER_SCALE));
      ctx.imageSmoothingEnabled = false;
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    window.visualViewport?.addEventListener('resize', updateSize);

    // Keyboard input handlers
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysHeldRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };
    const clearKeys = () => {
      keysHeldRef.current.clear();
      clearDpadInput(dpadStateRef.current);
      dpadPointerIdRef.current = null;
      setActiveDpadDir(null);
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearKeys();
    };
    const onGlobalPointerUp = (e: PointerEvent) => {
      if (dpadPointerIdRef.current === e.pointerId) {
        dpadPointerIdRef.current = null;
        releaseDpadInput(dpadStateRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let lastTime = performance.now();
    let lastSyncSentAt = 0;
    let lastFootstepAt = 0;
    let cameraX = localPosRef.current.x;
    let cameraY = localPosRef.current.y;
    let rafId = 0;

    // Collision check helper (circle/box radius against tile grid)
    const canMoveTo = (nx: number, ny: number, currentMaze: GeneratedMaze): boolean => {
      const r = 9; // half-box radius inside 32px tile
      const corners = [
        { cx: nx - r, cy: ny - r },
        { cx: nx + r, cy: ny - r },
        { cx: nx - r, cy: ny + r },
        { cx: nx + r, cy: ny + r },
      ];
      for (const c of corners) {
        const tx = Math.floor(c.cx / GAME_RULES.TILE_SIZE);
        const ty = Math.floor(c.cy / GAME_RULES.TILE_SIZE);
        if (ty < 0 || ty >= currentMaze.height || tx < 0 || tx >= currentMaze.width) {
          return false;
        }
        if (!isWalkableTile(currentMaze.grid[ty][tx])) {
          return false;
        }
      }
      return true;
    };

    const isKeyAvailableForMe = (
      k: GeneratedMaze['keys'][number],
      mode: GameMode,
      myId: string,
      myTeam: TeamId | null
    ): boolean => {
      if (mode === 'coop') return k.collectedBy === null;
      if (mode === 'competitive') return !k.collectedByPlayers.includes(myId);
      if (mode === 'team' && myTeam) return !k.collectedByTeams.includes(myTeam);
      return k.collectedBy === null;
    };

    const drawCrownBadge = (targetCtx: CanvasRenderingContext2D, cx: number, cy: number) => {
      targetCtx.save();
      targetCtx.fillStyle = '#FACC15';
      targetCtx.strokeStyle = '#090D15';
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.moveTo(cx - 5, cy);
      targetCtx.lineTo(cx - 6, cy - 5);
      targetCtx.lineTo(cx - 2.5, cy - 2);
      targetCtx.lineTo(cx, cy - 6.5);
      targetCtx.lineTo(cx + 2.5, cy - 2);
      targetCtx.lineTo(cx + 6, cy - 5);
      targetCtx.lineTo(cx + 5, cy);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.restore();
    };

    let modalRenderedOnce = false;
    let wasQuestionOpen = false;
    let lastUiDpadDir: Direction | null = null;
    let lastMinimapDrawAt = 0;
    let lastMinimapMode: MinimapViewMode | null = null;
    let lastMinimapCanvasEl: HTMLCanvasElement | null = null;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamped dt per ultra-mode rules

      const state = propsRef.current;
      const lp = localPosRef.current;

      if (wasQuestionOpen && !state.isQuestionOpen) {
        // Give the player a clean 1.8s grace window after closing a wrong-answer or recovered modal
        // so standing on the same key does not immediately re-open it on the next frame.
        lp.lastKeyTouchTime = now;
      }
      wasQuestionOpen = state.isQuestionOpen;

      const fxActive =
        hasActiveParticleEffects(particleState) ||
        lp.screenFlashTimer > 0 ||
        lp.cameraShake > 0;

      if ((state.isQuestionOpen || state.isPaused) && !fxTriggerRef.current.type && !fxActive) {
        if (modalRenderedOnce) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        modalRenderedOnce = true;
      } else {
        modalRenderedOnce = false;
      }

      const currentMaze = state.maze;
      const isLobbyMap = isVictoryLobbyMaze(currentMaze);

      // Handle external FX / assist triggers
      if (fxTriggerRef.current.type) {
        const trig = fxTriggerRef.current;
        if (trig.type === 'key' || trig.type === 'correct') {
          const burstX = trig.x ?? lp.x;
          const burstY = trig.y ?? lp.y - 6;
          spawnGoldenKeyBurst(particleState, burstX, burstY, {
            bannerText: trig.bannerText ?? '★ KUNCI EMAS! ★',
            subText: trig.subText ?? '+KUNCI DIDAPAT',
          });
          canvas.dataset.goldenBurstCount = String(particleState.goldenBurstCount);
          lp.screenFlashColor = 'rgba(250, 204, 21, 0.24)';
          lp.screenFlashTimer = 0.32;
        } else if (trig.type === 'wrong') {
          spawnGenericParticles(
            particleState,
            lp.x,
            lp.y,
            22,
            ['#EF4444', '#F97316', '#FCA5A5'],
            110,
            0.5,
            'square'
          );
          lp.screenFlashColor = 'rgba(239, 68, 68, 0.28)';
          lp.screenFlashTimer = 0.3;
          lp.cameraShake = 0.35;
        } else if (trig.type === 'door') {
          const ex = currentMaze.exitTile.x * GAME_RULES.TILE_SIZE + 16;
          const ey = currentMaze.exitTile.y * GAME_RULES.TILE_SIZE + 16;
          spawnGoldenKeyBurst(particleState, ex, ey, {
            bannerText: '★ EXIT TERBUKA! ★',
            subText: 'MENUJU PINTU KELUAR',
          });
          canvas.dataset.goldenBurstCount = String(particleState.goldenBurstCount);
          lp.cameraShake = 0.25;
        } else if (trig.type === 'teleportToPodium') {
          if (!state.isQuestionOpen && !state.isPaused) {
            lp.x = 13.5 * GAME_RULES.TILE_SIZE;
            lp.y = 4.5 * GAME_RULES.TILE_SIZE;
            lp.dir = 'down';
            lp.anim = 'idle';
            spawnGoldenKeyBurst(particleState, lp.x, lp.y - 6, {
              bannerText: '★ PODIUM JUARA! ★',
              subText: 'AULA PEMENANG',
            });
            canvas.dataset.goldenBurstCount = String(particleState.goldenBurstCount);
            lp.screenFlashColor = 'rgba(250, 204, 21, 0.22)';
            lp.screenFlashTimer = 0.28;
            state.onMoveSync(lp.x, lp.y, lp.dir, 'idle');
          }
        }
        fxTriggerRef.current = { type: null };
      }

      // 1. Update Free-Cam or Local Player Movement
      const isFreeCamMode =
        !state.isPaused && !state.isQuestionOpen && state.spectatorMode === 'free_cam';
      const canControl =
        !state.isPaused &&
        !state.isQuestionOpen &&
        !isFreeCamMode &&
        (state.localStatus === 'active' || state.localStatus === 'escaped' || isLobbyMap);

      if (isFreeCamMode) {
        const movement = resolveMovementVector(keysHeldRef.current, dpadStateRef.current, now);
        if (movement.activeDpadDir !== lastUiDpadDir) {
          lastUiDpadDir = movement.activeDpadDir;
          setActiveDpadDir(movement.activeDpadDir);
        }
        if (movement.dx !== 0 || movement.dy !== 0) {
          freeCamPosRef.current = stepFreeCamPosition({
            x: freeCamPosRef.current.x,
            y: freeCamPosRef.current.y,
            dx: movement.dx,
            dy: movement.dy,
            dt,
            mazeWidth: currentMaze.width,
            mazeHeight: currentMaze.height,
            tileSize: GAME_RULES.TILE_SIZE,
            speed: 340,
          });
        }
        if (lp.anim === 'walk') {
          lp.anim = 'idle';
          state.onMoveSync(lp.x, lp.y, lp.dir, 'idle');
        }
      } else if (canControl) {
        const movement = resolveMovementVector(keysHeldRef.current, dpadStateRef.current, now);
        if (movement.activeDpadDir !== lastUiDpadDir) {
          lastUiDpadDir = movement.activeDpadDir;
          setActiveDpadDir(movement.activeDpadDir);
        }
        const { dx, dy } = movement;

        if (dx !== 0 || dy !== 0) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            lp.dir = dx > 0 ? 'right' : 'left';
          } else {
            lp.dir = dy > 0 ? 'down' : 'up';
          }
          lp.anim = 'walk';

          const step = GAME_RULES.PLAYER_SPEED * dt;
          const nextX = lp.x + dx * step;
          const nextY = lp.y + dy * step;

          // Axis-separated collision with smooth corner assist
          if (canMoveTo(nextX, lp.y, currentMaze)) {
            lp.x = nextX;
          }
          if (canMoveTo(lp.x, nextY, currentMaze)) {
            lp.y = nextY;
          }

          lp.walkDist += step;
          if (now - lastFootstepAt > 260) {
            lastFootstepAt = now;
            retroAudio.playFootstep();
          }

          if (now - lastSyncSentAt >= GAME_RULES.POSITION_SYNC_INTERVAL_MS) {
            lastSyncSentAt = now;
            state.onMoveSync(lp.x, lp.y, lp.dir, lp.anim);
          }
        } else {
          if (lp.anim === 'walk') {
            lp.anim = 'idle';
            state.onMoveSync(lp.x, lp.y, lp.dir, 'idle');
          }
        }

        if (isLobbyMap) {
          const lm = getNearestLobbyLandmark(lp.x, lp.y, GAME_RULES.TILE_SIZE, 2.2);
          const lmId = lm?.id ?? null;
          if (lmId !== lastLandmarkId) {
            lastLandmarkId = lmId;
            setNearestLandmark(lm);
          }
        } else {
          if (lastLandmarkId !== null) {
            lastLandmarkId = null;
            setNearestLandmark(null);
          }

          // Check proximity to uncollected Keys
          for (const k of currentMaze.keys) {
            if (!isKeyAvailableForMe(k, state.gameMode, state.localPlayerId, state.localTeamId)) {
              continue;
            }
            const dist = Math.hypot(lp.x - k.x, lp.y - k.y);
            if (dist < 22) {
              // Avoid re-triggering the exact same key within 1.8s if player just closed/answered it
              if (lp.lastKeyTouchedId !== k.id || now - lp.lastKeyTouchTime > 1800) {
                lp.lastKeyTouchedId = k.id;
                lp.lastKeyTouchTime = now;
                keysHeldRef.current.clear();
                clearDpadInput(dpadStateRef.current);
                dpadPointerIdRef.current = null;
                if (lastUiDpadDir !== null) {
                  lastUiDpadDir = null;
                  setActiveDpadDir(null);
                }
                state.onTouchKey(k.id);
                break;
              }
            } else if (lp.lastKeyTouchedId === k.id && dist > 30) {
              lp.lastKeyTouchedId = null;
            }
          }

          // Check proximity to Open Exit Door
          if (state.isDoorOpenForMe && !lp.exitTriggered) {
            const exitPx = currentMaze.exitTile.x * GAME_RULES.TILE_SIZE + 16;
            const exitPy = currentMaze.exitTile.y * GAME_RULES.TILE_SIZE + 16;
            if (Math.hypot(lp.x - exitPx, lp.y - exitPy) < 24) {
              lp.exitTriggered = true;
              retroAudio.playVictory();
              state.onReachExit();
            }
          }
        }
      } else {
        clearDpadInput(dpadStateRef.current);
        dpadPointerIdRef.current = null;
        if (lastUiDpadDir !== null) {
          lastUiDpadDir = null;
          setActiveDpadDir(null);
        }
        if (state.isQuestionOpen) {
          lp.anim = 'answering';
        }
      }

      // 1b. Update Remote Player Interpolations before resolving camera target
      remoteInterp.set(state.localPlayerId, {
        x: lp.x,
        y: lp.y,
        dir: lp.dir,
        anim: lp.anim,
        walkDist: lp.walkDist,
      });

      for (const rp of state.players) {
        if (rp.id === state.localPlayerId || rp.role === 'teacher') continue;
        const delta = deltaBufferRef.current.get(rp.id);
        const targetX = delta?.x ?? rp.x;
        const targetY = delta?.y ?? rp.y;
        const targetDir = delta?.d ?? rp.direction;
        const targetAnim = delta?.a ?? rp.animState;

        let interp = remoteInterp.get(rp.id);
        if (!interp) {
          interp = { x: targetX, y: targetY, dir: targetDir, anim: targetAnim, walkDist: 0 };
          remoteInterp.set(rp.id, interp);
        } else {
          const dist = Math.hypot(targetX - interp.x, targetY - interp.y);
          if (dist > 160) {
            interp.x = targetX;
            interp.y = targetY;
          } else {
            const stepX = (targetX - interp.x) * Math.min(1, dt * 12);
            const stepY = (targetY - interp.y) * Math.min(1, dt * 12);
            interp.x += stepX;
            interp.y += stepY;
            interp.walkDist += Math.hypot(stepX, stepY);
          }
          interp.dir = targetDir;
          interp.anim = dist > 1.5 ? 'walk' : targetAnim;
        }
      }

      // 2. Resolve Camera Target (Self, Follow Student, or Free-Cam) & Smooth Interpolation
      const camResolution = resolveSpectatorCameraTarget({
        mode: state.spectatorMode ?? 'self',
        spectatedPlayerId: state.spectatedPlayerId ?? null,
        localPos: lp,
        freeCamPos: freeCamPosRef.current,
        players: state.players,
        interpolatedPositions: remoteInterp,
      });

      const vw = canvas.width;
      const vh = canvas.height;
      const zoom = vw < 640 ? 1.25 : 1.5; // Wider dungeon view on portrait phones & desktop
      cameraX += (camResolution.targetX - cameraX) * Math.min(1, dt * 10);
      cameraY += (camResolution.targetY - cameraY) * Math.min(1, dt * 10);
      cameraPosRef.current = { x: cameraX, y: cameraY };

      canvas.dataset.spectatorMode = camResolution.activeMode;
      canvas.dataset.spectatedPlayer = camResolution.followedPlayer?.id ?? '';
      canvas.dataset.cameraX = String(Math.round(cameraX));
      canvas.dataset.cameraY = String(Math.round(cameraY));

      const focusX = camResolution.activeMode === 'self' ? lp.x : camResolution.targetX;
      const focusY = camResolution.activeMode === 'self' ? lp.y : camResolution.targetY;

      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (lp.cameraShake > 0) {
        lp.cameraShake = Math.max(0, lp.cameraShake - dt);
        const mag = lp.cameraShake * lp.cameraShake * 18;
        shakeOffsetX = (Math.random() - 0.5) * mag;
        shakeOffsetY = (Math.random() - 0.5) * mag;
      }

      // 3. Render Main Viewport
      const activeBiomeId: MazeBiomeId = isLobbyMap ? DEFAULT_MAZE_BIOME : state.biome;
      const biomeTheme = getMazeBiomeTheme(activeBiomeId);
      canvas.dataset.biome = biomeTheme.id;

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = biomeTheme.voidBgHex;
      ctx.fillRect(0, 0, vw, vh);

      const camOffX = Math.floor(vw / 2 - cameraX * zoom + shakeOffsetX);
      const camOffY = Math.floor(vh / 2 - cameraY * zoom + shakeOffsetY);

      ctx.save();
      ctx.translate(camOffX, camOffY);
      ctx.scale(zoom, zoom);

      const globalAnimFrame = Math.floor(now / 180) % 4;
      const halfViewWorldW = vw / (2 * zoom) + 48;
      const halfViewWorldH = vh / (2 * zoom) + 48;

      const startTileX = Math.max(0, Math.floor((cameraX - halfViewWorldW) / GAME_RULES.TILE_SIZE));
      const endTileX = Math.min(
        currentMaze.width - 1,
        Math.ceil((cameraX + halfViewWorldW) / GAME_RULES.TILE_SIZE)
      );
      const startTileY = Math.max(0, Math.floor((cameraY - halfViewWorldH) / GAME_RULES.TILE_SIZE));
      const endTileY = Math.min(
        currentMaze.height - 1,
        Math.ceil((cameraY + halfViewWorldH) / GAME_RULES.TILE_SIZE)
      );

      // Draw visible tiles (Camera Culling)
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          let tileType = currentMaze.grid[ty][tx];
          if (!isLobbyMap && tx === currentMaze.exitTile.x && ty === currentMaze.exitTile.y) {
            tileType = state.isDoorOpenForMe ? TileType.EXIT_OPEN : TileType.EXIT_LOCKED;
          }
          const sprite = getTileSprite(
            tileType,
            globalAnimFrame,
            (tx * 7 + ty * 13) & 3,
            activeBiomeId
          );
          ctx.drawImage(
            sprite,
            tx * GAME_RULES.TILE_SIZE,
            ty * GAME_RULES.TILE_SIZE,
            GAME_RULES.TILE_SIZE,
            GAME_RULES.TILE_SIZE
          );

          // Biome-tinted sconce radial light glow
          if (tileType === TileType.TORCH_WALL) {
            const torchCx = tx * GAME_RULES.TILE_SIZE + 16;
            const torchCy = ty * GAME_RULES.TILE_SIZE + 20;
            const radius = 38 + Math.sin(now / 140 + tx) * 4;
            const grad = ctx.createRadialGradient(torchCx, torchCy, 2, torchCx, torchCy, radius);
            grad.addColorStop(0, biomeTheme.torchGlowRgbaStart);
            grad.addColorStop(1, biomeTheme.torchGlowRgbaEnd);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(torchCx, torchCy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (isLobbyMap) {
        // Draw Post-Dungeon Victory Sanctuary Landmarks (Champion Podium #1/#2/#3, Scoreboard Monument, Fountain, Lounge)
        const sortedStudents = [...state.players]
          .filter((p) => p.role === 'student')
          .sort((a, b) => b.score - a.score);
        const lbEntries = state.leaderboard ?? [];

        const podiums = [
          {
            rank: 1,
            tileX: 13,
            tileY: 4,
            fill: '#FACC15',
            border: '#FEF08A',
            dark: '#854D0E',
            label: 'JUARA #1',
            playerName: lbEntries[0]?.name ?? sortedStudents[0]?.name ?? state.localPlayerName,
            mvpTitle: lbEntries[0]?.mvpBadges?.[0]?.title ?? 'Si Kilat Matematika',
          },
          {
            rank: 2,
            tileX: 10,
            tileY: 5,
            fill: '#E2E8F0',
            border: '#F8FAFC',
            dark: '#334155',
            label: 'JUARA #2',
            playerName: lbEntries[1]?.name ?? sortedStudents[1]?.name ?? 'Ksatria Perak',
            mvpTitle: lbEntries[1]?.mvpBadges?.[0]?.title ?? 'Penjelajah Sejati',
          },
          {
            rank: 3,
            tileX: 16,
            tileY: 5,
            fill: '#FB923C',
            border: '#FED7AA',
            dark: '#7C2D12',
            label: 'JUARA #3',
            playerName: lbEntries[2]?.name ?? sortedStudents[2]?.name ?? 'Ksatria Perunggu',
            mvpTitle: lbEntries[2]?.mvpBadges?.[0]?.title ?? 'Akurasi Sempurna 100%',
          },
        ];

        // Grand Sanctuary Carpet Gold Trim around North Podium Stage
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          9 * GAME_RULES.TILE_SIZE + 2,
          3 * GAME_RULES.TILE_SIZE + 2,
          9 * GAME_RULES.TILE_SIZE - 4,
          4 * GAME_RULES.TILE_SIZE - 4
        );

        for (const pod of podiums) {
          const px = pod.tileX * GAME_RULES.TILE_SIZE + 16;
          const py = pod.tileY * GAME_RULES.TILE_SIZE + 16;

          // Radial pedestal glow
          const pGrad = ctx.createRadialGradient(px, py, 2, px, py, 28);
          pGrad.addColorStop(0, `${pod.fill}44`);
          pGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(px, py, 28, 0, Math.PI * 2);
          ctx.fill();

          // Stepped pedestal block
          ctx.fillStyle = pod.dark;
          ctx.fillRect(px - 14, py - 10, 28, 22);
          ctx.fillStyle = pod.fill;
          ctx.fillRect(px - 12, py - 12, 24, 20);
          ctx.strokeStyle = pod.border;
          ctx.lineWidth = 1;
          ctx.strokeRect(px - 12, py - 12, 24, 20);

          // Rank badge on pedestal
          ctx.font = 'bold 6px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#090D15';
          ctx.fillText(`#${pod.rank}`, px, py + 1);

          // Podium title, champion name & MVP Badge plaque below pedestal
          ctx.fillStyle = 'rgba(9, 13, 21, 0.92)';
          ctx.fillRect(px - 32, py + 13, 64, 15);
          ctx.strokeStyle = pod.fill;
          ctx.lineWidth = 0.75;
          ctx.strokeRect(px - 32, py + 13, 64, 15);
          ctx.fillStyle = pod.fill;
          ctx.font = 'bold 4.2px "IBM Plex Mono", monospace';
          ctx.fillText(pod.label, px, py + 17.5);
          ctx.fillStyle = '#F8FAFC';
          ctx.fillText(pod.playerName.slice(0, 12), px, py + 22);
          ctx.fillStyle = '#34D399';
          ctx.font = 'bold 3.8px "IBM Plex Mono", monospace';
          ctx.fillText(pod.mvpTitle.slice(0, 18), px, py + 26.5);
        }

        // Center Scoreboard Monument at (13, 9)
        const monX = 13 * GAME_RULES.TILE_SIZE + 16;
        const monY = 9 * GAME_RULES.TILE_SIZE + 16;
        const monRadius = 24 + Math.sin(now / 180) * 3;
        const monGrad = ctx.createRadialGradient(monX, monY, 3, monX, monY, monRadius);
        monGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        monGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = monGrad;
        ctx.beginPath();
        ctx.arc(monX, monY, monRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(monX - 11, monY - 9, 22, 18);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(monX - 11, monY - 9, 22, 18);
        drawCrownBadge(ctx, monX, monY + 3);

        ctx.font = 'bold 5px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#38BDF8';
        ctx.fillText('MONUMEN KLASEMEN', monX, monY - 12);

        // West Crystal Fountain (4, 9) & East Champions Lounge (22, 9) Labels
        const westX = 4 * GAME_RULES.TILE_SIZE + 16;
        const westY = 9 * GAME_RULES.TILE_SIZE;
        ctx.fillStyle = '#C084FC';
        ctx.fillText('TAMAN KRISTAL', westX, westY - 3);

        const eastX = 22 * GAME_RULES.TILE_SIZE + 16;
        const eastY = 9 * GAME_RULES.TILE_SIZE;
        ctx.fillStyle = '#34D399';
        ctx.fillText('BALAI PEMENANG', eastX, eastY - 3);

        // South Arrival Gate Label at (13, 15)
        const gateX = 13 * GAME_RULES.TILE_SIZE + 16;
        const gateY = 15 * GAME_RULES.TILE_SIZE + 34;
        ctx.fillStyle = '#38BDF8';
        ctx.fillText('GERBANG KELUAR DUNGEON', gateX, gateY);
        ctx.restore();
      } else {
        // Draw Royal Spawn Courtyard & Secret Chamber Plaques
        ctx.save();
        ctx.font = 'bold 4.8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';

        const spawnWorldX = currentMaze.spawnTile.x * GAME_RULES.TILE_SIZE + 16;
        const spawnWorldY = (currentMaze.spawnTile.y - 2) * GAME_RULES.TILE_SIZE + 8;
        ctx.fillStyle = 'rgba(9, 13, 21, 0.88)';
        ctx.fillRect(spawnWorldX - 30, spawnWorldY - 7, 60, 8.5);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(spawnWorldX - 30, spawnWorldY - 7, 60, 8.5);
        ctx.fillStyle = '#7DD3FC';
        ctx.fillText('PELATARAN AWAL', spawnWorldX, spawnWorldY - 1.2);

        for (let rIdx = 0; rIdx < currentMaze.secretRooms.length; rIdx++) {
          const room = currentMaze.secretRooms[rIdx];
          if (!room.name) continue;
          const roomCenterX = (room.x + room.width / 2) * GAME_RULES.TILE_SIZE;
          const roomTopY = room.y * GAME_RULES.TILE_SIZE + 7;
          if (
            roomCenterX < cameraX - halfViewWorldW ||
            roomCenterX > cameraX + halfViewWorldW ||
            roomTopY < cameraY - halfViewWorldH ||
            roomTopY > cameraY + halfViewWorldH
          ) {
            continue;
          }
          const badgeColor =
            room.theme === 'secret_treasury'
              ? '#FACC15'
              : room.theme === 'crystal_sanctum'
              ? '#38BDF8'
              : '#4ADE80';
          const textW = Math.max(48, room.name.length * 3.1 + 10);
          ctx.fillStyle = 'rgba(9, 13, 21, 0.88)';
          ctx.fillRect(roomCenterX - textW / 2, roomTopY - 6.5, textW, 8.5);
          ctx.strokeStyle = badgeColor;
          ctx.lineWidth = 0.65;
          ctx.strokeRect(roomCenterX - textW / 2, roomTopY - 6.5, textW, 8.5);
          ctx.fillStyle = badgeColor;
          ctx.fillText(room.name.toUpperCase(), roomCenterX, roomTopY - 0.8);
        }
        ctx.restore();

        // Draw Keys in visible viewport
        for (const k of currentMaze.keys) {
          if (!isKeyAvailableForMe(k, state.gameMode, state.localPlayerId, state.localTeamId)) {
            continue;
          }
          if (
            k.x < cameraX - halfViewWorldW ||
            k.x > cameraX + halfViewWorldW ||
            k.y < cameraY - halfViewWorldH ||
            k.y > cameraY + halfViewWorldH
          ) {
            continue;
          }

          const keyInfo = KEY_TYPES_INFO[k.type];
          const glowRadius = 20 + Math.sin(now / 160) * 3;
          const grad = ctx.createRadialGradient(k.x, k.y, 2, k.x, k.y, glowRadius);
          grad.addColorStop(0, `${keyInfo.glow}55`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(k.x, k.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          const keySprite = getKeySprite(k.type, globalAnimFrame);
          ctx.drawImage(keySprite, Math.round(k.x - 16), Math.round(k.y - 16), 32, 32);
        }

        // Draw Exit Door Label
        const exitWorldX = currentMaze.exitTile.x * GAME_RULES.TILE_SIZE + 16;
        const exitWorldY = currentMaze.exitTile.y * GAME_RULES.TILE_SIZE;
        ctx.font = 'bold 6px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = state.isDoorOpenForMe ? '#34D399' : '#F87171';
        ctx.fillText(
          state.isDoorOpenForMe ? 'EXIT TERBUKA!' : 'EXIT TERKUNCI',
          exitWorldX,
          exitWorldY - 3
        );
      }

      // 4. Draw Remote Players
      const LIGHT_RADIUS = 300;
      for (const rp of state.players) {
        if (rp.id === state.localPlayerId || rp.role === 'teacher') continue;
        // Inside the active dungeon, hide players who have already escaped to the Victory Lobby.
        // Inside the Victory Lobby, show escaped players (and all classmates once session ended)!
        if (!isLobbyMap && rp.status === 'escaped') continue;

        const interp = remoteInterp.get(rp.id);
        if (!interp) continue;

        // Camera culling for up to 45 players
        if (
          interp.x < cameraX - halfViewWorldW ||
          interp.x > cameraX + halfViewWorldW ||
          interp.y < cameraY - halfViewWorldH ||
          interp.y > cameraY + halfViewWorldH
        ) {
          continue;
        }

        const isBeingSpectated =
          camResolution.activeMode === 'follow_student' &&
          camResolution.followedPlayer?.id === rp.id;

        // In standard self mode, hide remote players enclosed behind walls or beyond sight radius.
        // In Free-Cam mode or when spectating this student, keep them visible!
        if (
          !isLobbyMap &&
          camResolution.activeMode !== 'free_cam' &&
          !isBeingSpectated &&
          (Math.hypot(interp.x - focusX, interp.y - focusY) > LIGHT_RADIUS ||
            !hasLineOfSight(
              currentMaze.grid,
              focusX,
              focusY,
              interp.x,
              interp.y,
              GAME_RULES.TILE_SIZE
            ))
        ) {
          continue;
        }

        const walkFrame = interp.anim === 'walk' ? Math.floor(interp.walkDist / 10) % 4 : 0;
        const sprite = getCharacterSprite({
          characterId: rp.characterId,
          outfitColor: rp.outfitColor,
          direction: interp.dir,
          animState: interp.anim,
          frame: walkFrame,
        });

        const remoteEmote = activeEmotesRef
          ? evaluatePlayerEmote(activeEmotesRef.current, rp.id, now)
          : null;
        const bounceY = remoteEmote ? remoteEmote.characterBounceY : 0;

        ctx.save();
        if (!isLobbyMap && (rp.status === 'spectator' || rp.status === 'eliminated')) {
          ctx.globalAlpha = 0.45;
        }
        ctx.drawImage(
          sprite,
          Math.round(interp.x - 17),
          Math.round(interp.y - 18 + bounceY),
          34,
          34
        );

        // Nameplate above remote character
        ctx.font = 'bold 5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(9, 13, 20, 0.85)';
        const labelWidth = Math.max(24, rp.name.length * 3.6 + 6);
        ctx.fillRect(
          Math.round(interp.x - labelWidth / 2),
          Math.round(interp.y - 25 + bounceY),
          labelWidth,
          7
        );
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(
          rp.name.slice(0, 12),
          Math.round(interp.x),
          Math.round(interp.y - 20 + bounceY)
        );

        if (remoteEmote) {
          renderOverheadEmoteBalloon(ctx, interp.x, interp.y + bounceY, remoteEmote);
        } else if (isLobbyMap && interp.y <= 6.8 * GAME_RULES.TILE_SIZE) {
          drawCrownBadge(ctx, Math.round(interp.x), Math.round(interp.y - 27));
        } else if (interp.anim === 'answering') {
          ctx.fillStyle = '#FACC15';
          ctx.fillText('SOAL...', Math.round(interp.x), Math.round(interp.y - 28));
        }
        ctx.restore();
      }
      ctx.restore();

      // 4b. Dynamic Wall Shadow & Enclosed-Room Darkness Mask (Skipped in the illuminated Victory Lobby!)
      if (!isLobbyMap && lctx && lightCanvas.width > 0 && lightCanvas.height > 0) {
        lctx.save();
        lctx.scale(LIGHT_BUFFER_SCALE, LIGHT_BUFFER_SCALE);
        lctx.globalCompositeOperation = 'source-over';
        lctx.fillStyle = biomeTheme.shadowTintHex;
        lctx.fillRect(0, 0, vw, vh);

        const focusScreenX = camOffX + focusX * zoom;
        const focusScreenY = camOffY + focusY * zoom;
        const activeLightRadius =
          camResolution.activeMode === 'free_cam' ? LIGHT_RADIUS * 1.35 : LIGHT_RADIUS;
        const screenRadius = activeLightRadius * zoom;

        lctx.globalCompositeOperation = 'destination-out';
        const lightGrad = lctx.createRadialGradient(
          focusScreenX,
          focusScreenY,
          16 * zoom,
          focusScreenX,
          focusScreenY,
          screenRadius
        );
        lightGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        lightGrad.addColorStop(0.56, 'rgba(0, 0, 0, 0.94)');
        lightGrad.addColorStop(0.84, 'rgba(0, 0, 0, 0.48)');
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lctx.fillStyle = lightGrad;
        lctx.beginPath();
        lctx.arc(focusScreenX, focusScreenY, screenRadius, 0, Math.PI * 2);
        lctx.fill();

        if (camResolution.activeMode !== 'free_cam') {
          const shadowQuads = computeWallShadowQuads({
            grid: currentMaze.grid,
            width: currentMaze.width,
            height: currentMaze.height,
            tileSize: GAME_RULES.TILE_SIZE,
            lightX: focusX,
            lightY: focusY,
            radius: LIGHT_RADIUS,
            shadowLength: LIGHT_RADIUS * 1.8,
          });

          if (shadowQuads.length > 0) {
            lctx.globalCompositeOperation = 'source-over';
            lctx.translate(camOffX, camOffY);
            lctx.scale(zoom, zoom);
            lctx.fillStyle = biomeTheme.shadowTintHex;
            lctx.beginPath();
            for (const q of shadowQuads) {
              lctx.moveTo(q.x1, q.y1);
              lctx.lineTo(q.x2, q.y2);
              lctx.lineTo(q.x3, q.y3);
              lctx.lineTo(q.x4, q.y4);
              lctx.closePath();
            }
            lctx.fill();
          }
        }
        lctx.restore();

        ctx.save();
        ctx.globalAlpha =
          camResolution.activeMode === 'free_cam'
            ? 0.34
            : camResolution.activeMode === 'follow_student'
            ? 0.78
            : 0.9;
        ctx.drawImage(lightCanvas, 0, 0, vw, vh);
        ctx.restore();
      }

      // 5. Draw Local Player, Spectator Target Reticle & Pooled Particles above shadow layer
      ctx.save();
      ctx.translate(camOffX, camOffY);
      ctx.scale(zoom, zoom);

      const myWalkFrame = lp.anim === 'walk' ? Math.floor(lp.walkDist / 10) % 4 : globalAnimFrame % 2;
      const mySprite = getCharacterSprite({
        characterId: state.localCharacterId,
        outfitColor: state.localOutfitColor,
        direction: lp.dir,
        animState: lp.anim,
        frame: myWalkFrame,
      });

      ctx.save();
      if (!isLobbyMap && (state.localStatus === 'spectator' || state.localStatus === 'eliminated')) {
        ctx.globalAlpha = 0.5;
      }

      const onPodiumStage =
        isLobbyMap &&
        lp.y <= 6.8 * GAME_RULES.TILE_SIZE &&
        lp.x >= 9 * GAME_RULES.TILE_SIZE &&
        lp.x <= 18 * GAME_RULES.TILE_SIZE;

      // Heroic dual-tone aura ring under local player (golden champion aura when standing on Podium!)
      ctx.fillStyle = onPodiumStage ? 'rgba(250, 204, 21, 0.28)' : 'rgba(56, 189, 248, 0.16)';
      ctx.beginPath();
      ctx.ellipse(Math.round(lp.x), Math.round(lp.y + 11), 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = onPodiumStage ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      const myEmote = activeEmotesRef
        ? evaluatePlayerEmote(activeEmotesRef.current, state.localPlayerId, now)
        : null;
      const myBounceY = myEmote ? myEmote.characterBounceY : 0;
      canvas.dataset.activeEmote = myEmote?.emote.id ?? '';

      ctx.drawImage(mySprite, Math.round(lp.x - 17), Math.round(lp.y - 18 + myBounceY), 34, 34);

      // Local player nameplate
      ctx.font = 'bold 5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(9, 13, 21, 0.92)';
      const myLabelW = Math.max(28, state.localPlayerName.length * 3.8 + 8);
      const myLabelX = Math.round(lp.x - myLabelW / 2);
      const myLabelY = Math.round(lp.y - 26 + myBounceY);
      ctx.fillRect(myLabelX, myLabelY, myLabelW, 8);
      ctx.strokeStyle = onPodiumStage ? 'rgba(250, 204, 21, 0.8)' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(myLabelX, myLabelY, myLabelW, 8);
      ctx.fillStyle = onPodiumStage ? '#FACC15' : '#38BDF8';
      ctx.fillText(state.localPlayerName.slice(0, 14), Math.round(lp.x), myLabelY + 5.5);

      if (myEmote) {
        renderOverheadEmoteBalloon(ctx, lp.x, lp.y + myBounceY, myEmote);
      } else if (onPodiumStage) {
        drawCrownBadge(ctx, Math.round(lp.x), myLabelY - 2);
      }
      ctx.restore();

      // 5b. Draw Spectator Target Reticle (Follow Student Mode) or Free-Cam Crosshair
      if (camResolution.activeMode === 'follow_student' && camResolution.followedPlayer) {
        const tx = Math.round(camResolution.targetX);
        const ty = Math.round(camResolution.targetY);
        const pulse = 19 + Math.sin(now / 150) * 2;

        ctx.save();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tactical badge below spectated student
        const tagText = `DIPANTAU · ${camResolution.followedPlayer.name.slice(0, 12).toUpperCase()}`;
        ctx.font = 'bold 4.8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        const tagW = Math.max(46, tagText.length * 3.2 + 8);
        ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
        ctx.fillRect(tx - tagW / 2, ty + 16, tagW, 8);
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(tx - tagW / 2, ty + 16, tagW, 8);
        ctx.fillStyle = '#A7F3D0';
        ctx.fillText(tagText, tx, ty + 21.5);
        ctx.restore();
      } else if (camResolution.activeMode === 'free_cam') {
        const fx = Math.round(freeCamPosRef.current.x);
        const fy = Math.round(freeCamPosRef.current.y);
        const pulse = 14 + Math.sin(now / 160) * 1.5;

        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(fx, fy, pulse, 0, Math.PI * 2);
        ctx.moveTo(fx - 20, fy);
        ctx.lineTo(fx - 8, fy);
        ctx.moveTo(fx + 8, fy);
        ctx.lineTo(fx + 20, fy);
        ctx.moveTo(fx, fy - 20);
        ctx.lineTo(fx, fy - 8);
        ctx.moveTo(fx, fy + 8);
        ctx.lineTo(fx, fy + 20);
        ctx.stroke();

        const tileCoordText = `FREE-CAM (${Math.floor(fx / GAME_RULES.TILE_SIZE)},${Math.floor(
          fy / GAME_RULES.TILE_SIZE
        )})`;
        ctx.font = 'bold 4.8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(8, 22, 39, 0.9)';
        ctx.fillRect(fx - 30, fy + 16, 60, 8);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(fx - 30, fy + 16, 60, 8);
        ctx.fillStyle = '#7DD3FC';
        ctx.fillText(tileCoordText, fx, fy + 21.5);
        ctx.restore();
      }

      // 6. Update & Draw Golden Key Particles, Shockwave Rings & Floating Banners
      stepParticleSystem(particleState, dt);
      renderParticleSystem(ctx, particleState);
      ctx.restore();

      // Screen Flash Feedback (Radial Golden Bloom on Key Collect / Red Vignette on Wrong Answer)
      if (lp.screenFlashTimer > 0 && lp.screenFlashColor) {
        lp.screenFlashTimer = Math.max(0, lp.screenFlashTimer - dt);
        const cx = camOffX + lp.x * zoom;
        const cy = camOffY + lp.y * zoom;
        const bloomRadius = Math.max(180, LIGHT_RADIUS * zoom * 0.9);
        const flashGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, bloomRadius);
        flashGrad.addColorStop(0, lp.screenFlashColor);
        flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, vw, vh);
      }

      // 7. Render Top-Right Transparent Mini-Map Overlay (Discovered Rooms, Fog-of-War, Player & Keys)
      if (discoveredMinimap.seed !== currentMaze.seed) {
        discoveredMinimap = createDiscoveredMinimapState(currentMaze);
        lastPlayerTileX = -1;
        lastPlayerTileY = -1;
      }

      const curTileX = Math.floor(focusX / GAME_RULES.TILE_SIZE);
      const curTileY = Math.floor(focusY / GAME_RULES.TILE_SIZE);
      if (curTileX !== lastPlayerTileX || curTileY !== lastPlayerTileY) {
        lastPlayerTileX = curTileX;
        lastPlayerTileY = curTileY;
        const localTileX = Math.max(
          0,
          Math.min(currentMaze.width - 1, Math.floor(lp.x / GAME_RULES.TILE_SIZE))
        );
        const localTileY = Math.max(
          0,
          Math.min(currentMaze.height - 1, Math.floor(lp.y / GAME_RULES.TILE_SIZE))
        );
        setPlayerTile({ x: localTileX, y: localTileY });

        const summary = updateDiscoveredMinimap(
          discoveredMinimap,
          currentMaze,
          focusX,
          focusY,
          GAME_RULES.TILE_SIZE,
          camResolution.activeMode === 'free_cam' ? 10 : 8
        );
        if (summary.changed) {
          setMinimapStats({
            discoveryPercent: summary.discoveryPercent,
            discoveredRoomsCount: summary.discoveredRoomsCount,
            totalRoomsCount: summary.totalRoomsCount,
          });
        }
      }

      const mini = minimapCanvasRef.current;
      if (mini) {
        const activeMode = isLobbyMap ? 'full' : minimapViewModeRef.current;
        const shouldRedrawMinimap =
          mini !== lastMinimapCanvasEl ||
          activeMode !== lastMinimapMode ||
          now - lastMinimapDrawAt >= 65;

        if (shouldRedrawMinimap) {
          lastMinimapCanvasEl = mini;
          lastMinimapMode = activeMode;
          lastMinimapDrawAt = now;
        }
        const mctx = shouldRedrawMinimap ? mini.getContext('2d') : null;
        if (mctx) {
          const mw = mini.width;
          const mh = mini.height;
          const viewport = computeMinimapViewport({
            mazeWidth: currentMaze.width,
            mazeHeight: currentMaze.height,
            focusTileX: focusX / GAME_RULES.TILE_SIZE,
            focusTileY: focusY / GAME_RULES.TILE_SIZE,
            viewMode: activeMode,
            radarSpanTiles: 25,
          });
          lastMinimapViewportRef.current = viewport;

          const scaleX = mw / viewport.spanX;
          const scaleY = mh / viewport.spanY;
          const toMiniX = (tileX: number) => (tileX - viewport.startX) * scaleX;
          const toMiniY = (tileY: number) => (tileY - viewport.startY) * scaleY;

          // Clear canvas and apply biome-tinted semi-transparent radar glass backing
          const mmTheme = biomeTheme.minimap;
          mctx.clearRect(0, 0, mw, mh);
          mctx.fillStyle = mmTheme.backdrop;
          mctx.fillRect(0, 0, mw, mh);

          // Render tiles within the active viewport (Full Overview or Zoomed Radar)
          const minRenderX = Math.max(0, Math.floor(viewport.startX));
          const maxRenderX = Math.min(currentMaze.width - 1, Math.ceil(viewport.startX + viewport.spanX));
          const minRenderY = Math.max(0, Math.floor(viewport.startY));
          const maxRenderY = Math.min(currentMaze.height - 1, Math.ceil(viewport.startY + viewport.spanY));

          for (let y = minRenderY; y <= maxRenderY; y++) {
            for (let x = minRenderX; x <= maxRenderX; x++) {
              const t = currentMaze.grid[y][x];
              const cellState = discoveredMinimap.cells[y * currentMaze.width + x];
              const walkable = isWalkableTile(t);
              const px = Math.floor(toMiniX(x));
              const py = Math.floor(toMiniY(y));
              const pw = Math.ceil(scaleX);
              const ph = Math.ceil(scaleY);

              if (cellState === 0) {
                if (walkable) {
                  mctx.fillStyle = mmTheme.unexploredWalkable;
                  mctx.fillRect(px, py, pw, ph);
                }
                continue;
              }

              if (walkable) {
                if (t === TileType.SECRET_FLOOR) {
                  mctx.fillStyle =
                    cellState === MINIMAP_CELL_VISIBLE
                      ? mmTheme.secretVisible
                      : mmTheme.secretDiscovered;
                } else {
                  mctx.fillStyle =
                    cellState === MINIMAP_CELL_VISIBLE
                      ? mmTheme.floorVisible
                      : mmTheme.floorDiscovered;
                }
                mctx.fillRect(px, py, pw, ph);
              } else if (cellState >= MINIMAP_CELL_DISCOVERED) {
                mctx.fillStyle = mmTheme.wallDiscovered;
                mctx.fillRect(px, py, Math.max(1, pw), Math.max(1, ph));
              }
            }
          }

          // Highlight perimeter of discovered rooms so students can clearly identify room layouts
          mctx.strokeStyle = mmTheme.roomBorder;
          mctx.lineWidth = 1.2;
          discoveredMinimap.discoveredRoomIndices.forEach((roomIdx) => {
            const room = currentMaze.secretRooms[roomIdx];
            if (!room) return;
            const rx = Math.floor(toMiniX(room.x));
            const ry = Math.floor(toMiniY(room.y));
            const rw = Math.ceil(room.width * scaleX);
            const rh = Math.ceil(room.height * scaleY);
            if (rx + rw >= 0 && rx <= mw && ry + rh >= 0 && ry <= mh) {
              mctx.strokeRect(rx, ry, rw, rh);
            }
          });

          const drawEdgeBeacon = (targetMiniX: number, targetMiniY: number, color: string) => {
            const clampedX = Math.max(6, Math.min(mw - 6, targetMiniX));
            const clampedY = Math.max(6, Math.min(mh - 6, targetMiniY));
            const angle = Math.atan2(targetMiniY - mh / 2, targetMiniX - mw / 2);
            mctx.save();
            mctx.translate(clampedX, clampedY);
            mctx.rotate(angle);
            mctx.fillStyle = color;
            mctx.beginPath();
            mctx.moveTo(5, 0);
            mctx.lineTo(-3, -3.5);
            mctx.lineTo(-3, 3.5);
            mctx.closePath();
            mctx.fill();
            mctx.restore();
          };

          if (isLobbyMap) {
            // Highlight Landmarks in Victory Lobby Mini-Map
            for (const lm of VICTORY_LOBBY_LANDMARKS) {
              mctx.fillStyle = lm.accentColor;
              mctx.fillRect(
                Math.floor(toMiniX(lm.tileX)) - 1,
                Math.floor(toMiniY(lm.tileY)) - 1,
                Math.max(4, Math.ceil(scaleX)),
                Math.max(4, Math.ceil(scaleY))
              );
            }
          } else {
            // Keys on minimap (with edge beacons when zoomed in Radar mode!)
            for (const k of currentMaze.keys) {
              if (!isKeyAvailableForMe(k, state.gameMode, state.localPlayerId, state.localTeamId)) {
                continue;
              }
              const kx = toMiniX(k.tileX + 0.5);
              const ky = toMiniY(k.tileY + 0.5);
              if (kx < 0 || kx > mw || ky < 0 || ky > mh) {
                if (viewport.isZoomed) {
                  drawEdgeBeacon(kx, ky, 'rgba(250, 204, 21, 0.9)');
                }
                continue;
              }
              const keyDiscovered =
                discoveredMinimap.cells[k.tileY * currentMaze.width + k.tileX] >=
                MINIMAP_CELL_DISCOVERED;
              if (keyDiscovered) {
                mctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
                mctx.fillRect(
                  Math.round(kx - 4),
                  Math.round(ky - 4),
                  Math.max(8, Math.ceil(scaleX) + 2),
                  Math.max(8, Math.ceil(scaleY) + 2)
                );
              }
              mctx.fillStyle = keyDiscovered ? '#FACC15' : 'rgba(250, 204, 21, 0.78)';
              const markerSz = Math.max(5, Math.min(9, Math.ceil(scaleX)));
              mctx.fillRect(
                Math.round(kx - markerSz / 2),
                Math.round(ky - markerSz / 2),
                markerSz,
                markerSz
              );
            }

            // Exit Door on minimap (with edge beacon when zoomed in Radar mode!)
            const exitMx = toMiniX(currentMaze.exitTile.x + 0.5);
            const exitMy = toMiniY(currentMaze.exitTile.y + 0.5);
            const exitColor = state.isDoorOpenForMe ? '#10B981' : '#EF4444';
            if (exitMx < 0 || exitMx > mw || exitMy < 0 || exitMy > mh) {
              if (viewport.isZoomed) {
                drawEdgeBeacon(exitMx, exitMy, exitColor);
              }
            } else {
              mctx.fillStyle = exitColor;
              const exitSz = Math.max(6, Math.min(10, Math.ceil(scaleX) + 1));
              mctx.fillRect(
                Math.round(exitMx - exitSz / 2),
                Math.round(exitMy - exitSz / 2),
                exitSz,
                exitSz
              );
              mctx.strokeStyle = '#FFFFFF';
              mctx.lineWidth = 0.8;
              mctx.strokeRect(
                Math.round(exitMx - exitSz / 2),
                Math.round(exitMy - exitSz / 2),
                exitSz,
                exitSz
              );
            }
          }

          // Remote players on minimap
          for (const rp of state.players) {
            if (rp.id === state.localPlayerId || rp.role === 'teacher') continue;
            if (!isLobbyMap && rp.status === 'escaped') continue;
            const interp = remoteInterp.get(rp.id);
            const rx = toMiniX((interp?.x ?? rp.x) / GAME_RULES.TILE_SIZE);
            const ry = toMiniY((interp?.y ?? rp.y) / GAME_RULES.TILE_SIZE);
            if (rx < -4 || rx > mw + 4 || ry < -4 || ry > mh + 4) continue;
            mctx.fillStyle = rp.outfitColor || '#94A3B8';
            mctx.fillRect(Math.floor(rx - 2), Math.floor(ry - 2), 4.5, 4.5);
          }

          // Local player directional vision cone + pulsing beacon on minimap
          const myPx = toMiniX(lp.x / GAME_RULES.TILE_SIZE);
          const myPy = toMiniY(lp.y / GAME_RULES.TILE_SIZE);
          const dirAngle =
            lp.dir === 'right'
              ? 0
              : lp.dir === 'down'
              ? Math.PI / 2
              : lp.dir === 'left'
              ? Math.PI
              : -Math.PI / 2;

          mctx.save();
          if (myPx >= -12 && myPx <= mw + 12 && myPy >= -12 && myPy <= mh + 12) {
            mctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
            mctx.beginPath();
            mctx.moveTo(myPx, myPy);
            mctx.arc(myPx, myPy, viewport.isZoomed ? 22 : 16, dirAngle - 0.55, dirAngle + 0.55);
            mctx.closePath();
            mctx.fill();

            const pulseRadius = (viewport.isZoomed ? 7 : 5.5) + Math.sin(now / 180) * 1.5;
            mctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
            mctx.lineWidth = 1.3;
            mctx.beginPath();
            mctx.arc(myPx, myPy, pulseRadius, 0, Math.PI * 2);
            mctx.stroke();

            mctx.fillStyle = '#38BDF8';
            mctx.fillRect(Math.round(myPx - 3), Math.round(myPy - 3), 6, 6);
            mctx.strokeStyle = '#FFFFFF';
            mctx.lineWidth = 1;
            mctx.strokeRect(Math.round(myPx - 3), Math.round(myPy - 3), 6, 6);
          }

          // Spectator / Free-Cam Camera Focus Reticle on Minimap
          if (camResolution.activeMode !== 'self') {
            const camMiniX = toMiniX(focusX / GAME_RULES.TILE_SIZE);
            const camMiniY = toMiniY(focusY / GAME_RULES.TILE_SIZE);
            mctx.strokeStyle =
              camResolution.activeMode === 'follow_student' ? '#10B981' : '#38BDF8';
            mctx.lineWidth = 1.5;
            mctx.strokeRect(Math.round(camMiniX - 6), Math.round(camMiniY - 6), 12, 12);
          }
          mctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateSize);
      window.visualViewport?.removeEventListener('resize', updateSize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [deltaBufferRef, fxTriggerRef]);

  const canUseDpad =
    !isPaused &&
    !isQuestionOpen &&
    (spectatorMode === 'free_cam' ||
      localStatus === 'active' ||
      localStatus === 'escaped' ||
      isLobbyMaze);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mini = minimapCanvasRef.current;
    if (!mini) return;
    const rect = mini.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const clickRatioX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickRatioY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const worldPos = minimapPixelToWorldCoord({
      clickRatioX,
      clickRatioY,
      viewport: lastMinimapViewportRef.current,
      tileSize: GAME_RULES.TILE_SIZE,
      mazeWidth: maze.width,
      mazeHeight: maze.height,
    });

    freeCamPosRef.current = worldPos;
    onChangeSpectatorMode?.('free_cam');
  };

  // Clear D-pad state when modal or pause opens
  useEffect(() => {
    if (!canUseDpad) {
      clearDpadInput(dpadStateRef.current);
      dpadPointerIdRef.current = null;
      setActiveDpadDir(null);
    }
  }, [canUseDpad]);

  // Virtual D-Pad handlers: supports quick taps (180ms step), continuous hold, thumb-slide, and accessible clicks
  const handleDpadContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canUseDpad) return;
    const rect = dpadPadRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    dpadPointerIdRef.current = e.pointerId;
    lastPointerTapAtRef.current = performance.now();
    try {
      dpadPadRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointerId
    }
    const dir = resolveDpadDirectionFromPoint(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height
    );
    if (dir) {
      pressDpadDirection(dpadStateRef.current, dir, performance.now());
      setActiveDpadDir(dir);
    }
  };

  const handleDpadContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dpadPointerIdRef.current !== e.pointerId) return;
    const rect = dpadPadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dir = resolveDpadDirectionFromPoint(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height
    );
    moveDpadDirection(dpadStateRef.current, dir, performance.now());
    setActiveDpadDir(dir);
  };

  const handleDpadContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dpadPointerIdRef.current === e.pointerId) {
      dpadPointerIdRef.current = null;
      try {
        dpadPadRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture already ended
      }
      releaseDpadInput(dpadStateRef.current);
    }
  };

  const dpadBtnProps = (dir: Direction) => ({
    'aria-pressed': activeDpadDir === dir,
    'data-dir': dir,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!canUseDpad) return;
      e.preventDefault();
      e.stopPropagation();
      const nowMs = performance.now();
      lastPointerTapAtRef.current = nowMs;
      dpadPointerIdRef.current = e.pointerId;
      try {
        dpadPadRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture isn't supported for synthetic pointers
      }
      pressDpadDirection(dpadStateRef.current, dir, nowMs);
      setActiveDpadDir(dir);
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!canUseDpad) return;
      e.currentTarget.blur();
      const nowMs = performance.now();
      // Fallback for assistive / keyboard Enter / bare synthetic click without preceding pointerdown
      if (nowMs - lastPointerTapAtRef.current > 280) {
        triggerDpadTap(dpadStateRef.current, dir, nowMs);
        setActiveDpadDir(dir);
      }
    },
    onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault(),
  });

  const dpadButtonClass = (dir: Direction, extra = '') =>
    `w-12 h-12 sm:w-10 sm:h-10 rounded-md font-bold border flex items-center justify-center touch-none select-none transition-colors ${
      activeDpadDir === dir
        ? 'bg-amber-400 text-slate-950 border-amber-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] translate-y-[1px]'
        : 'bg-[#1a2438]/95 hover:bg-[#23314b] text-slate-100 border-slate-500/80 shadow-[inset_0_-2px_0_rgba(9,13,21,0.85)]'
    } ${extra}`;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#090D15] touch-none">
      <canvas
        ref={mainCanvasRef}
        data-testid="maze-canvas"
        data-lobby-map={isLobbyMaze ? 'true' : 'false'}
        data-spectator-mode={spectatorMode}
        data-spectated-player={spectatedPlayerId ?? ''}
        className="block w-full h-full touch-none"
      />

      {/* Modular Toggleable Mini-Map Overlay Component */}
      <MiniMapOverlay
        visible={showMinimap}
        isLobbyMaze={isLobbyMaze}
        mazeWidth={maze.width}
        mazeHeight={maze.height}
        viewMode={isLobbyMaze ? 'full' : minimapViewMode}
        expandedSize={minimapExpandedSize}
        discoveryPercent={minimapStats.discoveryPercent}
        discoveredRoomsCount={minimapStats.discoveredRoomsCount}
        totalRoomsCount={minimapStats.totalRoomsCount}
        playerTile={playerTile}
        objectiveCompass={objectiveCompass}
        canvasRef={minimapCanvasRef}
        onChangeViewMode={(mode) => {
          setMinimapViewMode(mode);
          minimapViewModeRef.current = mode;
        }}
        onToggleExpandedSize={() => onToggleMinimapSize?.()}
        onClose={() => onToggleMinimap?.()}
        onCanvasClick={handleMinimapClick}
      />

      {/* Victory Lobby Landmark Proximity Plaque (Bottom-Center) */}
      {isLobbyMaze && nearestLandmark && (
        <div
          data-testid="lobby-landmark-banner"
          className="fixed bottom-20 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto rounded-lg bg-[#090D15]/88 border border-amber-400/60 px-4 py-2 text-center shadow-[0_8px_24px_rgba(0,0,0,0.65)] flex items-center gap-3"
        >
          <Crown
            className="w-4 h-4 shrink-0"
            style={{ color: nearestLandmark.accentColor }}
            aria-hidden="true"
          />
          <div className="text-left">
            <div
              className="font-code text-xs font-bold tracking-wider"
              style={{ color: nearestLandmark.accentColor }}
            >
              {nearestLandmark.title}
            </div>
            <div className="text-[11px] text-slate-300">{nearestLandmark.subtitle}</div>
          </div>
          {nearestLandmark.id === 'scoreboard_monument' && onOpenVictoryResults && (
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                onOpenVictoryResults();
              }}
              className="ml-2 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] whitespace-nowrap"
            >
              Buka Klasemen
            </button>
          )}
        </div>
      )}

      {/* On-Screen Virtual D-Pad Overlay & Quick Navigation Assist (Bottom-Left Thumb Zone) */}
      <div className="fixed bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 z-20 pointer-events-auto flex flex-col-reverse sm:flex-row items-start sm:items-end gap-2 pb-[env(safe-area-inset-bottom)]">
        <div
          ref={dpadPadRef}
          data-testid="virtual-dpad"
          data-active-direction={activeDpadDir ?? 'none'}
          role="group"
          aria-label="Kontrol Arah Karakter"
          onPointerDown={handleDpadContainerPointerDown}
          onPointerMove={handleDpadContainerPointerMove}
          onPointerUp={handleDpadContainerPointerUp}
          onPointerCancel={handleDpadContainerPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="rpg-panel grid grid-cols-3 gap-1 p-1.5 touch-none select-none"
        >
          <div />
          <button
            type="button"
            aria-label="Gerak Atas"
            {...dpadBtnProps('up')}
            className={dpadButtonClass('up')}
          >
            <ChevronUp className="w-5 h-5" aria-hidden="true" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Gerak Kiri"
            {...dpadBtnProps('left')}
            className={dpadButtonClass('left')}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div
            aria-hidden="true"
            className="w-12 h-12 sm:w-10 sm:h-10 rounded-md bg-[#0b101b] border border-slate-700/80 flex items-center justify-center pointer-events-none"
          >
            <span
              className={`w-2.5 h-2.5 rounded-xs border transition-colors ${
                activeDpadDir
                  ? 'bg-amber-400 border-amber-200'
                  : 'bg-slate-700 border-slate-500'
              }`}
            />
          </div>
          <button
            type="button"
            aria-label="Gerak Kanan"
            {...dpadBtnProps('right')}
            className={dpadButtonClass('right')}
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Gerak Bawah"
            {...dpadBtnProps('down')}
            className={dpadButtonClass('down')}
          >
            <ChevronDown className="w-5 h-5" aria-hidden="true" />
          </button>
          <div />
        </div>

        {isLobbyMaze && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              data-testid="teleport-podium-btn"
              onClick={() => {
                retroAudio.playButtonClick();
                fxTriggerRef.current = { type: 'teleportToPodium' };
              }}
              className="rpg-btn-gold min-h-[42px] sm:min-h-[38px] px-3 py-2 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Ke Podium Juara</span>
              <span className="hidden sm:inline">Ke Podium Juara [E]</span>
            </button>
            {onOpenVictoryResults && (
              <button
                type="button"
                data-testid="lobby-open-results-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onOpenVictoryResults();
                }}
                className="rpg-btn-emerald min-h-[42px] sm:min-h-[38px] px-3 py-2 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Tabel Skor Akhir</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

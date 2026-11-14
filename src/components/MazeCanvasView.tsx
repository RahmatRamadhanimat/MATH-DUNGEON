import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  DoorOpen,
  KeyRound,
  Minus,
  Plus,
} from 'lucide-react';
import {
  Direction,
  GAME_RULES,
  GameMode,
  KEY_TYPES_INFO,
  PlayerAnimState,
  PlayerStatus,
  TeamId,
  TileType,
} from '../shared/constants';
import { GeneratedMaze, isWalkableTile } from '../shared/mazeGenerator';
import { computeWallShadowQuads, hasLineOfSight } from '../shared/lightingSystem';
import {
  DiscoveredMinimapState,
  MINIMAP_CELL_DISCOVERED,
  MINIMAP_CELL_VISIBLE,
  createDiscoveredMinimapState,
  updateDiscoveredMinimap,
} from '../shared/minimapSystem';
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
  type: 'key' | 'correct' | 'wrong' | 'door' | 'teleportToKey' | 'teleportToExit' | null;
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
  isPaused: boolean;
  isQuestionOpen: boolean;
  isDoorOpenForMe: boolean;
  players: RenderPlayerState[];
  deltaBufferRef: React.MutableRefObject<
    Map<string, { x: number; y: number; d: Direction; a: PlayerAnimState; s: PlayerStatus }>
  >;
  fxTriggerRef: React.MutableRefObject<FxTriggerPayload>;
  onMoveSync: (x: number, y: number, direction: Direction, animState: PlayerAnimState) => void;
  onTouchKey: (keyId: string) => void;
  onReachExit: () => void;
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
  isPaused,
  isQuestionOpen,
  isDoorOpenForMe,
  players,
  deltaBufferRef,
  fxTriggerRef,
  onMoveSync,
  onTouchKey,
  onReachExit,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [minimapExpanded, setMinimapExpanded] = useState(true);
  const [minimapStats, setMinimapStats] = useState({
    discoveryPercent: 5,
    discoveredRoomsCount: 0,
    totalRoomsCount: maze.secretRooms.length,
  });
  const [activeDpadDir, setActiveDpadDir] = useState<Direction | null>(null);

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
    isPaused,
    isQuestionOpen,
    isDoorOpenForMe,
    players,
    onMoveSync,
    onTouchKey,
    onReachExit,
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
      isPaused,
      isQuestionOpen,
      isDoorOpenForMe,
      players,
      onMoveSync,
      onTouchKey,
      onReachExit,
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
    isPaused,
    isQuestionOpen,
    isDoorOpenForMe,
    players,
    onMoveSync,
    onTouchKey,
    onReachExit,
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

  const keysHeldRef = useRef<Set<string>>(new Set());
  const dpadStateRef = useRef<DpadInputState>(createDpadInputState());
  const dpadPadRef = useRef<HTMLDivElement | null>(null);
  const dpadPointerIdRef = useRef<number | null>(null);
  const lastPointerTapAtRef = useRef<number>(0);

  // Reset local spawn position when a new maze seed arrives
  useEffect(() => {
    if (localPosRef.current.seed !== maze.seed) {
      localPosRef.current.seed = maze.seed;
      localPosRef.current.x = maze.spawnTile.x * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
      localPosRef.current.y = maze.spawnTile.y * GAME_RULES.TILE_SIZE + GAME_RULES.TILE_SIZE / 2;
      localPosRef.current.dir = 'right';
      localPosRef.current.anim = 'idle';
      localPosRef.current.lastKeyTouchedId = null;
      localPosRef.current.exitTriggered = false;
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

    let modalRenderedOnce = false;
    let wasQuestionOpen = false;
    let lastUiDpadDir: Direction | null = null;

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
        } else if (trig.type === 'teleportToKey') {
          if (!state.isQuestionOpen && !state.isPaused && state.localStatus === 'active') {
            // Move local player adjacent to nearest uncollected key and trigger its question
            const available = currentMaze.keys.filter((k) =>
              isKeyAvailableForMe(k, state.gameMode, state.localPlayerId, state.localTeamId)
            );
            if (available.length > 0) {
              available.sort(
                (a, b) =>
                  Math.hypot(a.x - lp.x, a.y - lp.y) - Math.hypot(b.x - lp.x, b.y - lp.y)
              );
              const targetKey = available[0];
              lp.x = targetKey.x;
              lp.y = targetKey.y;
              lp.lastKeyTouchedId = targetKey.id;
              lp.lastKeyTouchTime = now;
              state.onMoveSync(lp.x, lp.y, lp.dir, 'answering');
              state.onTouchKey(targetKey.id);
            }
          }
        } else if (trig.type === 'teleportToExit') {
          if (
            state.isDoorOpenForMe &&
            !state.isQuestionOpen &&
            !state.isPaused &&
            state.localStatus === 'active'
          ) {
            lp.x = currentMaze.exitTile.x * GAME_RULES.TILE_SIZE + 16;
            lp.y = currentMaze.exitTile.y * GAME_RULES.TILE_SIZE + 16;
            lp.exitTriggered = true;
            state.onMoveSync(lp.x, lp.y, lp.dir, 'idle');
            state.onReachExit();
          }
        }
        fxTriggerRef.current = { type: null };
      }

      // 1. Update Local Player Movement (frozen when paused or answering math question)
      const canControl =
        !state.isPaused &&
        !state.isQuestionOpen &&
        state.localStatus === 'active';

      if (canControl) {
        const movement = resolveMovementVector(keysHeldRef.current, dpadStateRef.current, now);
        if (movement.activeDpadDir !== lastUiDpadDir) {
          lastUiDpadDir = movement.activeDpadDir;
          setActiveDpadDir(movement.activeDpadDir);
        }
        let { dx, dy } = movement;

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

      // 2. Smooth Camera Interpolation Following Local Player
      const vw = canvas.width;
      const vh = canvas.height;
      const zoom = vw < 640 ? 1.25 : 1.5; // Wider dungeon view on portrait phones & desktop
      cameraX += (lp.x - cameraX) * Math.min(1, dt * 10);
      cameraY += (lp.y - cameraY) * Math.min(1, dt * 10);

      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (lp.cameraShake > 0) {
        lp.cameraShake = Math.max(0, lp.cameraShake - dt);
        const mag = lp.cameraShake * lp.cameraShake * 18;
        shakeOffsetX = (Math.random() - 0.5) * mag;
        shakeOffsetY = (Math.random() - 0.5) * mag;
      }

      // 3. Render Main Viewport
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#090D14';
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
          if (tx === currentMaze.exitTile.x && ty === currentMaze.exitTile.y) {
            tileType = state.isDoorOpenForMe ? TileType.EXIT_OPEN : TileType.EXIT_LOCKED;
          }
          const sprite = getTileSprite(tileType, globalAnimFrame);
          ctx.drawImage(
            sprite,
            tx * GAME_RULES.TILE_SIZE,
            ty * GAME_RULES.TILE_SIZE,
            GAME_RULES.TILE_SIZE,
            GAME_RULES.TILE_SIZE
          );

          // Warm torch radial light glow
          if (tileType === TileType.TORCH_WALL) {
            const torchCx = tx * GAME_RULES.TILE_SIZE + 16;
            const torchCy = ty * GAME_RULES.TILE_SIZE + 20;
            const radius = 38 + Math.sin(now / 140 + tx) * 4;
            const grad = ctx.createRadialGradient(torchCx, torchCy, 2, torchCx, torchCy, radius);
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
            grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(torchCx, torchCy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

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
      ctx.fillText(state.isDoorOpenForMe ? 'EXIT TERBUKA!' : 'EXIT TERKUNCI', exitWorldX, exitWorldY - 3);

      // 4. Interpolate & Draw Remote Players (with Camera Culling & Wall Line-of-Sight Check)
      const LIGHT_RADIUS = 300;
      for (const rp of state.players) {
        if (rp.id === state.localPlayerId || rp.role === 'teacher') continue;
        if (rp.status === 'escaped') continue;

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

        // Camera culling for up to 45 players
        if (
          interp.x < cameraX - halfViewWorldW ||
          interp.x > cameraX + halfViewWorldW ||
          interp.y < cameraY - halfViewWorldH ||
          interp.y > cameraY + halfViewWorldH
        ) {
          continue;
        }

        // Hide remote players enclosed behind walls or beyond sight radius
        if (
          Math.hypot(interp.x - lp.x, interp.y - lp.y) > LIGHT_RADIUS ||
          !hasLineOfSight(currentMaze.grid, lp.x, lp.y, interp.x, interp.y, GAME_RULES.TILE_SIZE)
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

        ctx.save();
        if (rp.status === 'spectator' || rp.status === 'eliminated') {
          ctx.globalAlpha = 0.45;
        }
        ctx.drawImage(sprite, Math.round(interp.x - 17), Math.round(interp.y - 18), 34, 34);

        // Nameplate above remote character
        ctx.font = 'bold 5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(9, 13, 20, 0.85)';
        const labelWidth = Math.max(24, rp.name.length * 3.6 + 6);
        ctx.fillRect(Math.round(interp.x - labelWidth / 2), Math.round(interp.y - 25), labelWidth, 7);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(rp.name.slice(0, 12), Math.round(interp.x), Math.round(interp.y - 20));

        if (interp.anim === 'answering') {
          ctx.fillStyle = '#FACC15';
          ctx.fillText('SOAL...', Math.round(interp.x), Math.round(interp.y - 28));
        }
        ctx.restore();
      }
      ctx.restore();

      // 4b. Dynamic Wall Shadow & Enclosed-Room Darkness Mask
      if (lctx && lightCanvas.width > 0 && lightCanvas.height > 0) {
        lctx.save();
        lctx.scale(LIGHT_BUFFER_SCALE, LIGHT_BUFFER_SCALE);
        lctx.globalCompositeOperation = 'source-over';
        lctx.fillStyle = '#05080F';
        lctx.fillRect(0, 0, vw, vh);

        const lpScreenX = camOffX + lp.x * zoom;
        const lpScreenY = camOffY + lp.y * zoom;
        const screenRadius = LIGHT_RADIUS * zoom;

        lctx.globalCompositeOperation = 'destination-out';
        const lightGrad = lctx.createRadialGradient(
          lpScreenX,
          lpScreenY,
          16 * zoom,
          lpScreenX,
          lpScreenY,
          screenRadius
        );
        lightGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        lightGrad.addColorStop(0.56, 'rgba(0, 0, 0, 0.94)');
        lightGrad.addColorStop(0.84, 'rgba(0, 0, 0, 0.48)');
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lctx.fillStyle = lightGrad;
        lctx.beginPath();
        lctx.arc(lpScreenX, lpScreenY, screenRadius, 0, Math.PI * 2);
        lctx.fill();

        const shadowQuads = computeWallShadowQuads({
          grid: currentMaze.grid,
          width: currentMaze.width,
          height: currentMaze.height,
          tileSize: GAME_RULES.TILE_SIZE,
          lightX: lp.x,
          lightY: lp.y,
          radius: LIGHT_RADIUS,
          shadowLength: LIGHT_RADIUS * 1.8,
        });

        if (shadowQuads.length > 0) {
          lctx.globalCompositeOperation = 'source-over';
          lctx.translate(camOffX, camOffY);
          lctx.scale(zoom, zoom);
          lctx.fillStyle = '#05080F';
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
        lctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(lightCanvas, 0, 0, vw, vh);
        ctx.restore();
      }

      // 5. Draw Local Player & Pooled Particles above shadow layer
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
      if (state.localStatus === 'spectator' || state.localStatus === 'eliminated') {
        ctx.globalAlpha = 0.5;
      }
      // Heroic dual-tone aura ring under local player
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.beginPath();
      ctx.ellipse(Math.round(lp.x), Math.round(lp.y + 11), 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      ctx.drawImage(mySprite, Math.round(lp.x - 17), Math.round(lp.y - 18), 34, 34);

      // Local player nameplate
      ctx.font = 'bold 5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(9, 13, 21, 0.92)';
      const myLabelW = Math.max(28, state.localPlayerName.length * 3.8 + 8);
      const myLabelX = Math.round(lp.x - myLabelW / 2);
      const myLabelY = Math.round(lp.y - 26);
      ctx.fillRect(myLabelX, myLabelY, myLabelW, 8);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(myLabelX, myLabelY, myLabelW, 8);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(state.localPlayerName.slice(0, 14), Math.round(lp.x), myLabelY + 5.5);
      ctx.restore();

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

      const curTileX = Math.floor(lp.x / GAME_RULES.TILE_SIZE);
      const curTileY = Math.floor(lp.y / GAME_RULES.TILE_SIZE);
      if (curTileX !== lastPlayerTileX || curTileY !== lastPlayerTileY) {
        lastPlayerTileX = curTileX;
        lastPlayerTileY = curTileY;
        const summary = updateDiscoveredMinimap(
          discoveredMinimap,
          currentMaze,
          lp.x,
          lp.y,
          GAME_RULES.TILE_SIZE,
          8
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
        const mctx = mini.getContext('2d');
        if (mctx) {
          const mw = mini.width;
          const mh = mini.height;
          const scaleX = mw / currentMaze.width;
          const scaleY = mh / currentMaze.height;

          // Clear canvas and apply semi-transparent radar glass backing
          mctx.clearRect(0, 0, mw, mh);
          mctx.fillStyle = 'rgba(9, 13, 21, 0.42)';
          mctx.fillRect(0, 0, mw, mh);

          // Render tiles based on discovery state (Undiscovered Blueprint vs Discovered Corridors & Secret Rooms)
          for (let y = 0; y < currentMaze.height; y++) {
            for (let x = 0; x < currentMaze.width; x++) {
              const t = currentMaze.grid[y][x];
              const cellState = discoveredMinimap.cells[y * currentMaze.width + x];
              const walkable = isWalkableTile(t);

              if (cellState === 0) {
                if (walkable) {
                  mctx.fillStyle = 'rgba(51, 65, 85, 0.16)';
                  mctx.fillRect(
                    Math.floor(x * scaleX),
                    Math.floor(y * scaleY),
                    Math.ceil(scaleX),
                    Math.ceil(scaleY)
                  );
                }
                continue;
              }

              if (walkable) {
                if (t === TileType.SECRET_FLOOR) {
                  mctx.fillStyle =
                    cellState === MINIMAP_CELL_VISIBLE
                      ? 'rgba(192, 132, 252, 0.86)'
                      : 'rgba(168, 85, 247, 0.56)';
                } else {
                  mctx.fillStyle =
                    cellState === MINIMAP_CELL_VISIBLE
                      ? 'rgba(125, 211, 252, 0.66)'
                      : 'rgba(56, 189, 248, 0.34)';
                }
                mctx.fillRect(
                  Math.floor(x * scaleX),
                  Math.floor(y * scaleY),
                  Math.ceil(scaleX),
                  Math.ceil(scaleY)
                );
              } else if (cellState >= MINIMAP_CELL_DISCOVERED) {
                mctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
                mctx.fillRect(
                  Math.floor(x * scaleX),
                  Math.floor(y * scaleY),
                  Math.max(1, Math.ceil(scaleX)),
                  Math.max(1, Math.ceil(scaleY))
                );
              }
            }
          }

          // Highlight perimeter of discovered rooms so students can clearly identify room layouts
          mctx.strokeStyle = 'rgba(216, 180, 254, 0.85)';
          mctx.lineWidth = 1;
          discoveredMinimap.discoveredRoomIndices.forEach((roomIdx) => {
            const room = currentMaze.secretRooms[roomIdx];
            if (!room) return;
            mctx.strokeRect(
              Math.floor(room.x * scaleX),
              Math.floor(room.y * scaleY),
              Math.ceil(room.width * scaleX),
              Math.ceil(room.height * scaleY)
            );
          });

          // Keys on minimap
          for (const k of currentMaze.keys) {
            if (!isKeyAvailableForMe(k, state.gameMode, state.localPlayerId, state.localTeamId)) {
              continue;
            }
            const keyDiscovered =
              discoveredMinimap.cells[k.tileY * currentMaze.width + k.tileX] >=
              MINIMAP_CELL_DISCOVERED;
            const kx = Math.floor(k.tileX * scaleX);
            const ky = Math.floor(k.tileY * scaleY);
            if (keyDiscovered) {
              mctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
              mctx.fillRect(kx - 2, ky - 2, Math.max(6, Math.ceil(scaleX) + 3), Math.max(6, Math.ceil(scaleY) + 3));
            }
            mctx.fillStyle = keyDiscovered ? '#FACC15' : 'rgba(250, 204, 21, 0.72)';
            mctx.fillRect(
              kx - 1,
              ky - 1,
              Math.max(4, Math.ceil(scaleX) + 1),
              Math.max(4, Math.ceil(scaleY) + 1)
            );
          }

          // Exit Door on minimap
          mctx.fillStyle = state.isDoorOpenForMe ? '#10B981' : '#EF4444';
          mctx.fillRect(
            Math.floor(currentMaze.exitTile.x * scaleX) - 2,
            Math.floor(currentMaze.exitTile.y * scaleY) - 2,
            Math.max(5, Math.ceil(scaleX) + 2),
            Math.max(5, Math.ceil(scaleY) + 2)
          );

          // Remote players on minimap
          for (const rp of state.players) {
            if (rp.id === state.localPlayerId || rp.role === 'teacher') continue;
            const interp = remoteInterp.get(rp.id);
            const rx = (interp?.x ?? rp.x) / GAME_RULES.TILE_SIZE;
            const ry = (interp?.y ?? rp.y) / GAME_RULES.TILE_SIZE;
            mctx.fillStyle = rp.outfitColor || '#94A3B8';
            mctx.fillRect(Math.floor(rx * scaleX) - 1, Math.floor(ry * scaleY) - 1, 3.5, 3.5);
          }

          // Local player directional vision cone + pulsing beacon on minimap
          const myPx = (lp.x / GAME_RULES.TILE_SIZE) * scaleX;
          const myPy = (lp.y / GAME_RULES.TILE_SIZE) * scaleY;
          const dirAngle =
            lp.dir === 'right'
              ? 0
              : lp.dir === 'down'
              ? Math.PI / 2
              : lp.dir === 'left'
              ? Math.PI
              : -Math.PI / 2;

          mctx.save();
          mctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
          mctx.beginPath();
          mctx.moveTo(myPx, myPy);
          mctx.arc(myPx, myPy, 15, dirAngle - 0.55, dirAngle + 0.55);
          mctx.closePath();
          mctx.fill();

          const pulseRadius = 5 + Math.sin(now / 180) * 1.5;
          mctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          mctx.lineWidth = 1.2;
          mctx.beginPath();
          mctx.arc(myPx, myPy, pulseRadius, 0, Math.PI * 2);
          mctx.stroke();

          mctx.fillStyle = '#38BDF8';
          mctx.fillRect(Math.round(myPx - 2.5), Math.round(myPy - 2.5), 5, 5);
          mctx.strokeStyle = '#FFFFFF';
          mctx.lineWidth = 1;
          mctx.strokeRect(Math.round(myPx - 2.5), Math.round(myPy - 2.5), 5, 5);
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

  // Clear D-pad state when modal or pause opens
  useEffect(() => {
    if (isPaused || isQuestionOpen || localStatus !== 'active') {
      clearDpadInput(dpadStateRef.current);
      dpadPointerIdRef.current = null;
      setActiveDpadDir(null);
    }
  }, [isPaused, isQuestionOpen, localStatus]);

  // Virtual D-Pad handlers: supports quick taps (180ms step), continuous hold, thumb-slide, and accessible clicks
  const handleDpadContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPaused || isQuestionOpen || localStatus !== 'active') return;
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
      if (isPaused || isQuestionOpen || localStatus !== 'active') return;
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
      if (isPaused || isQuestionOpen || localStatus !== 'active') return;
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
        className="block w-full h-full touch-none"
      />

      {/* Transparent Top-Right Mini-Map Overlay (Shows Player Position & Discovered Rooms/Corridors) */}
      <div
        data-testid="minimap-overlay"
        className="fixed top-[92px] right-2 sm:top-[54px] sm:right-3 z-20 pointer-events-auto rounded-lg bg-[#090D15]/58 hover:bg-[#090D15]/82 border border-sky-400/35 shadow-[0_8px_24px_rgba(0,0,0,0.55)] p-1.5 sm:p-2 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-sky-200">
              Peta Labirin
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              data-testid="minimap-discovery-badge"
              className="font-code text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-sky-950/75 border border-sky-400/35 text-sky-300 tabular-nums"
              title="Ruangan Rahasia ditemukan & persentase area dijelajahi"
            >
              Ruang {minimapStats.discoveredRoomsCount}/{minimapStats.totalRoomsCount} ·{' '}
              {minimapStats.discoveryPercent}%
            </span>
            <button
              type="button"
              aria-label={minimapExpanded ? 'Perkecil Minimap' : 'Tampilkan Minimap'}
              onClick={() => setMinimapExpanded((v) => !v)}
              className="w-5 h-5 rounded bg-[#1e293b]/80 hover:bg-[#283548] border border-slate-600/80 text-slate-200 flex items-center justify-center"
            >
              {minimapExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <canvas
          ref={minimapCanvasRef}
          width={168}
          height={168}
          data-testid="minimap-canvas"
          className={`${
            minimapExpanded ? 'block mt-1.5' : 'hidden'
          } w-32 h-32 sm:w-44 sm:h-44 rounded border border-sky-400/25 bg-transparent`}
        />
        {minimapExpanded && (
          <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] font-medium text-slate-200/90">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-xs bg-sky-400 border border-white/80" aria-hidden="true" />
              Anda
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-xs bg-purple-400" aria-hidden="true" />
              Ruang
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-xs bg-amber-400" aria-hidden="true" />
              Kunci
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-xs bg-emerald-400" aria-hidden="true" />
              Exit
            </span>
          </div>
        )}
      </div>

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

        <div className="flex flex-col gap-1.5">
          {!isDoorOpenForMe ? (
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                fxTriggerRef.current = { type: 'teleportToKey' };
              }}
              className="rpg-btn-gold min-h-[42px] sm:min-h-[38px] px-3 py-2 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Ke Kunci Terdekat</span>
              <span className="hidden sm:inline">Ke Kunci Terdekat [E]</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                fxTriggerRef.current = { type: 'teleportToExit' };
              }}
              className="rpg-btn-emerald min-h-[42px] sm:min-h-[38px] px-3 py-2 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <DoorOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Ke Pintu Keluar</span>
              <span className="hidden sm:inline">Masuk Pintu Keluar [E]</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

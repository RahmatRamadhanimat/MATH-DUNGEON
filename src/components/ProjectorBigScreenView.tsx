import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crown,
  DoorOpen,
  KeyRound,
  Maximize,
  Minimize,
  MonitorOff,
  Play,
  Smartphone,
  Tag,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Direction,
  GAME_RULES,
  GameMode,
  MazeBiomeId,
  PlayerAnimState,
  PlayerStatus,
  TEAM_DEFINITIONS,
  TeamId,
  TileType,
} from '../shared/constants';
import { DEFAULT_MAZE_BIOME, getMazeBiomeTheme } from '../shared/biomeThemes';
import { GeneratedMaze, isWalkableTile } from '../shared/mazeGenerator';
import { LeaderboardEntry, TeamLeaderboardEntry } from '../shared/scoreSystem';
import { ActiveOverheadEmote, evaluatePlayerEmote, renderOverheadEmoteBalloon } from '../shared/emoteSystem';
import {
  buildProjectorBroadcastSummary,
  computeFullMazeFitTransform,
  formatProjectorClock,
  ProjectorChatEvent,
  selectProjectorFeedEvents,
  worldPixelToProjectorPoint,
} from '../shared/projectorMode';
import { isVictoryLobbyMaze } from '../shared/victoryLobbyMap';
import {
  getCharacterAvatarDataUrl,
  getCharacterSprite,
  getKeySprite,
} from '../game/assets/PixelArtSprites';
import { retroAudio } from '../game/audio/RetroAudio';
import { RenderPlayerState } from './MazeCanvasView';
import { RoomJoinQrCode } from './RoomJoinQrCode';

export interface ProjectorBigScreenViewProps {
  roomCode: string;
  roomStatus: 'lobby' | 'playing' | 'paused' | 'ended';
  teacherName: string;
  level: number;
  mode: GameMode;
  biome?: MazeBiomeId;
  maze: GeneratedMaze;
  players: RenderPlayerState[];
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  sharedKeysCollected: number;
  teamKeysCollected: Record<TeamId, number>;
  targetKeys: number;
  remainingSeconds: number;
  maxPlayers: number;
  chatHistory: ProjectorChatEvent[];
  deltaBufferRef: React.MutableRefObject<
    Map<string, { x: number; y: number; d: Direction; a: PlayerAnimState; s: PlayerStatus }>
  >;
  activeEmotesRef: React.MutableRefObject<Map<string, ActiveOverheadEmote>>;
  onExitProjectorMode: () => void;
  onStartGameFromLobby?: () => void;
}

function getModeLabel(mode: GameMode): string {
  if (mode === 'coop') return 'Co-op Adventure';
  if (mode === 'competitive') return 'Class Competition';
  return 'Team Battle';
}

function getStatusLabel(status: string): string {
  if (status === 'escaped') return 'Selesai';
  if (status === 'eliminated' || status === 'spectator') return 'Spectator';
  return 'Aktif';
}

/**
 * Renders the static architectural base of the entire maze into an offscreen buffer
 * once per maze seed so the 60 FPS live student overlay runs smoothly even on 75x75 maps.
 */
function bakeStaticMazeLayer(
  maze: GeneratedMaze,
  tileScale: number,
  biome: MazeBiomeId = DEFAULT_MAZE_BIOME
): HTMLCanvasElement {
  const off = document.createElement('canvas');
  const pxW = Math.max(1, Math.ceil(maze.width * tileScale));
  const pxH = Math.max(1, Math.ceil(maze.height * tileScale));
  off.width = pxW;
  off.height = pxH;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  const pTheme = getMazeBiomeTheme(isVictoryLobbyMaze(maze) ? DEFAULT_MAZE_BIOME : biome).projector;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = pTheme.backdrop;
  ctx.fillRect(0, 0, pxW, pxH);

  const cellW = Math.max(1, Math.ceil(tileScale + 0.35));
  const cellH = Math.max(1, Math.ceil(tileScale + 0.35));

  for (let y = 0; y < maze.height; y++) {
    const row = maze.grid[y];
    const py = Math.floor(y * tileScale);
    for (let x = 0; x < maze.width; x++) {
      const tile = row[x];
      const px = Math.floor(x * tileScale);

      if (tile === TileType.WALL || tile === TileType.TORCH_WALL) {
        ctx.fillStyle = pTheme.wallBase;
        ctx.fillRect(px, py, cellW, cellH);

        // Subtle stone top highlight if walkable corridor sits below this wall
        const hasWalkableBelow = y + 1 < maze.height && isWalkableTile(maze.grid[y + 1][x]);
        if (hasWalkableBelow) {
          ctx.fillStyle = pTheme.wallHighlight;
          ctx.fillRect(
            px,
            py + Math.max(1, Math.floor(tileScale * 0.65)),
            cellW,
            Math.max(1, Math.ceil(tileScale * 0.35))
          );
        }

        if (tile === TileType.TORCH_WALL) {
          ctx.fillStyle = pTheme.torchDot;
          const sz = Math.max(2, Math.floor(tileScale * 0.32));
          ctx.fillRect(
            Math.floor(px + (tileScale - sz) / 2),
            Math.floor(py + (tileScale - sz) / 2),
            sz,
            sz
          );
        }
      } else if (tile === TileType.SECRET_FLOOR) {
        ctx.fillStyle = (x + y) % 2 === 0 ? pTheme.secretEven : pTheme.secretOdd;
        ctx.fillRect(px, py, cellW, cellH);
      } else if (tile === TileType.WOOD_DOOR) {
        ctx.fillStyle = pTheme.door;
        ctx.fillRect(px, py, cellW, cellH);
      } else if (tile === TileType.PORTAL_SPAWN) {
        ctx.fillStyle = pTheme.spawn;
        ctx.fillRect(px, py, cellW, cellH);
      } else if (tile === TileType.EXIT_LOCKED || tile === TileType.EXIT_OPEN) {
        ctx.fillStyle = pTheme.exit;
        ctx.fillRect(px, py, cellW, cellH);
      } else {
        // Regular walkable biome corridor with subtle checkerboard masonry
        ctx.fillStyle = (x + y) % 2 === 0 ? pTheme.floorEven : pTheme.floorOdd;
        ctx.fillRect(px, py, cellW, cellH);
      }
    }
  }

  // Highlight secret rooms with crisp luminous biome border & room title
  for (const room of maze.secretRooms) {
    const rx = Math.floor(room.x * tileScale);
    const ry = Math.floor(room.y * tileScale);
    const rw = Math.ceil(room.width * tileScale);
    const rh = Math.ceil(room.height * tileScale);

    ctx.strokeStyle = pTheme.roomBorder;
    ctx.lineWidth = Math.max(1, Math.min(2, tileScale * 0.14));
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

    if (room.name && tileScale >= 6.5) {
      ctx.save();
      ctx.font = `700 ${Math.max(9, Math.min(12, Math.floor(tileScale * 0.72)))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = pTheme.roomLabel;
      ctx.fillText(room.name, rx + rw / 2, ry + rh / 2);
      ctx.restore();
    }
  }

  // Subtle outer frame border around entire maze
  ctx.strokeStyle = pTheme.outerBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, pxW - 2, pxH - 2);

  return off;
}

export const ProjectorBigScreenView: React.FC<ProjectorBigScreenViewProps> = ({
  roomCode,
  roomStatus,
  teacherName,
  level,
  mode,
  biome = DEFAULT_MAZE_BIOME,
  maze,
  players,
  leaderboard,
  teamLeaderboard,
  sharedKeysCollected,
  teamKeysCollected,
  targetKeys,
  remainingSeconds,
  maxPlayers,
  chatHistory,
  deltaBufferRef,
  activeEmotesRef,
  onExitProjectorMode,
  onStartGameFromLobby,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showNameTags, setShowNameTags] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    Boolean(typeof document !== 'undefined' && document.fullscreenElement)
  );

  const isLobbyWaiting = roomStatus === 'lobby';
  const isVictoryMap = isVictoryLobbyMaze(maze);
  const clock = formatProjectorClock(remainingSeconds);

  const summary = useMemo(
    () =>
      buildProjectorBroadcastSummary({
        players,
        leaderboard,
        teamLeaderboard,
        mode,
        sharedKeysCollected,
        teamKeysCollected,
        targetKeys,
      }),
    [players, leaderboard, teamLeaderboard, mode, sharedKeysCollected, teamKeysCollected, targetKeys]
  );

  const recentEvents = useMemo(() => selectProjectorFeedEvents(chatHistory, 3), [chatHistory]);

  const studentPlayers = useMemo(
    () => players.filter((p) => p.role !== 'teacher'),
    [players]
  );

  // Sync fullscreen state & support F (fullscreen) and Escape (exit projector mode)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onExitProjectorMode();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onExitProjectorMode]);

  const handleToggleFullscreen = () => {
    retroAudio.playButtonClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const biomeTheme = getMazeBiomeTheme(biome);

  // Store latest live props in ref so animation loop stays uninterrupted
  const livePropsRef = useRef({
    maze,
    mode,
    biome,
    players,
    leaderboard,
    isExitOpenForClass: summary.isExitOpenForClass,
    showNameTags,
  });
  livePropsRef.current = {
    maze,
    mode,
    biome,
    players,
    leaderboard,
    isExitOpenForClass: summary.isExitOpenForClass,
    showNameTags,
  };

  // Real-time Full-Maze Broadcast Canvas Loop
  useEffect(() => {
    if (isLobbyWaiting) return;
    const canvas = canvasRef.current;
    const container = stageContainerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const interpMap = new Map<
      string,
      { x: number; y: number; dir: Direction; anim: PlayerAnimState; walkPhase: number }
    >();

    let cachedMazeSeed = -1;
    let cachedTileScale = -1;
    let cachedBiome: MazeBiomeId | null = null;
    let bakedLayer: HTMLCanvasElement | null = null;
    let cssW = 800;
    let cssH = 600;
    let rafId = 0;
    let lastDrawAt = 0;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      cssW = Math.max(320, Math.floor(rect.width));
      cssH = Math.max(240, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      cachedTileScale = -1; // Re-bake crisp maze layer for new viewport dimensions
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    const drawFrame = (now: number) => {
      // Smooth ~30 FPS cap for big-screen overview keeps CPU ultra-low even with 45 students on 75x75 maps
      if (now - lastDrawAt < 30) {
        rafId = requestAnimationFrame(drawFrame);
        return;
      }
      const dt = Math.min((now - (lastDrawAt || now)) / 1000, 0.08);
      lastDrawAt = now;

      const {
        maze: curMaze,
        mode: curMode,
        biome: curBiome,
        players: curPlayers,
        leaderboard: curLb,
        isExitOpenForClass,
        showNameTags: drawNames,
      } = livePropsRef.current;

      const fit = computeFullMazeFitTransform({
        canvasWidth: cssW,
        canvasHeight: cssH,
        mazeWidth: curMaze.width,
        mazeHeight: curMaze.height,
        paddingPx: 14,
      });

      if (
        !bakedLayer ||
        cachedMazeSeed !== curMaze.seed ||
        cachedBiome !== curBiome ||
        Math.abs(cachedTileScale - fit.tileScale) > 0.05
      ) {
        bakedLayer = bakeStaticMazeLayer(curMaze, fit.tileScale, curBiome);
        cachedMazeSeed = curMaze.seed;
        cachedBiome = curBiome;
        cachedTileScale = fit.tileScale;
      }

      // Clear broadcast stage & blit pre-baked full maze
      const stageTheme = getMazeBiomeTheme(isVictoryLobbyMaze(curMaze) ? DEFAULT_MAZE_BIOME : curBiome);
      ctx.fillStyle = stageTheme.projector.backdrop;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.drawImage(bakedLayer, fit.offsetX, fit.offsetY, fit.mapPixelW, fit.mapPixelH);

      const tileSize = curMaze.tileSize || GAME_RULES.TILE_SIZE;
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      const animFrame = Math.floor(now / 180) % 4;

      // Draw Keys across the entire maze
      for (const k of curMaze.keys) {
        const isCollectedGlobal = curMode === 'coop' && k.collectedBy !== null;
        if (isCollectedGlobal) continue;

        const pt = worldPixelToProjectorPoint({
          worldX: k.x,
          worldY: k.y,
          tileSize,
          transform: fit,
        });

        // Subtle golden pulse aura so keys pop from the back of the classroom
        const auraR = Math.max(6, fit.tileScale * (0.72 + pulse * 0.2));
        ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, auraR, 0, Math.PI * 2);
        ctx.fill();

        const keySprite = getKeySprite(k.type, animFrame);
        const keyDrawSz = Math.max(12, Math.min(26, fit.tileScale * 1.15));
        ctx.drawImage(keySprite, pt.x - keyDrawSz / 2, pt.y - keyDrawSz / 2, keyDrawSz, keyDrawSz);
      }

      // Draw Exit Portal Beacon (unless Victory Lobby)
      if (!isVictoryLobbyMaze(curMaze)) {
        const exitPt = worldPixelToProjectorPoint({
          worldX: (curMaze.exitTile.x + 0.5) * tileSize,
          worldY: (curMaze.exitTile.y + 0.5) * tileSize,
          tileSize,
          transform: fit,
        });
        const exitColor = isExitOpenForClass ? '#10B981' : '#EF4444';
        const exitR = Math.max(8, fit.tileScale * (0.85 + pulse * 0.22));
        ctx.save();
        ctx.fillStyle = isExitOpenForClass
          ? 'rgba(16, 185, 129, 0.28)'
          : 'rgba(239, 68, 68, 0.24)';
        ctx.beginPath();
        ctx.arc(exitPt.x, exitPt.y, exitR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = exitColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(exitPt.x, exitPt.y, Math.max(5, fit.tileScale * 0.55), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(isExitOpenForClass ? 'EXIT' : 'LOCKED', exitPt.x, exitPt.y - exitR - 2);
        ctx.restore();
      }

      // Determine rank #1 player for live Golden Crown indicator
      const leaderId = curLb[0]?.playerId ?? null;
      const visibleStudents = curPlayers.filter((p) => p.role !== 'teacher');
      const compactLabelMode = visibleStudents.length > 14;

      // Update interpolation & render every student simultaneously
      for (const p of visibleStudents) {
        const delta = deltaBufferRef.current.get(p.id);
        const targetX = delta?.x ?? p.x;
        const targetY = delta?.y ?? p.y;
        const targetDir = delta?.d ?? p.direction;
        const targetAnim = delta?.a ?? p.animState;
        const liveStatus = delta?.s ?? p.status;

        let cur = interpMap.get(p.id);
        if (!cur) {
          cur = { x: targetX, y: targetY, dir: targetDir, anim: targetAnim, walkPhase: 0 };
          interpMap.set(p.id, cur);
        } else {
          const blend = Math.min(1, dt * 14);
          const dist = Math.hypot(targetX - cur.x, targetY - cur.y);
          if (dist > 180) {
            cur.x = targetX;
            cur.y = targetY;
          } else {
            cur.x += (targetX - cur.x) * blend;
            cur.y += (targetY - cur.y) * blend;
          }
          cur.dir = targetDir;
          cur.anim = targetAnim;
          if (targetAnim === 'walk') {
            cur.walkPhase += dt * 10;
          }
        }

        const pt = worldPixelToProjectorPoint({
          worldX: cur.x,
          worldY: cur.y,
          tileSize,
          transform: fit,
        });

        const ringColor =
          p.teamId && TEAM_DEFINITIONS[p.teamId]
            ? TEAM_DEFINITIONS[p.teamId].color
            : p.outfitColor || '#38BDF8';
        const markerR = Math.max(7, Math.min(15, fit.tileScale * 0.72));

        // Emote bounce evaluation
        const activeEmote = evaluatePlayerEmote(activeEmotesRef.current, p.id, now);
        const bounceOffset = activeEmote ? activeEmote.characterBounceY * 0.65 : 0;

        // Ground halo / status ring
        ctx.save();
        ctx.fillStyle = 'rgba(7, 11, 20, 0.78)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + bounceOffset, markerR + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle =
          liveStatus === 'escaped'
            ? '#10B981'
            : cur.anim === 'answering'
            ? '#FACC15'
            : ringColor;
        ctx.lineWidth = p.id === leaderId ? 2.6 : 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + bounceOffset, markerR + 1, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp pixel character sprite inside marker
        const sprite = getCharacterSprite({
          characterId: p.characterId,
          outfitColor: p.outfitColor,
          direction: cur.dir,
          animState: cur.anim,
          frame: Math.floor(cur.walkPhase) % 4,
        });
        const spriteSz = Math.max(16, Math.min(30, fit.tileScale * 1.45));
        ctx.drawImage(
          sprite,
          pt.x - spriteSz / 2,
          pt.y - spriteSz / 2 + bounceOffset,
          spriteSz,
          spriteSz
        );

        // Answering math question golden badge
        if (cur.anim === 'answering' && liveStatus === 'active') {
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(pt.x + markerR * 0.75, pt.y - markerR * 0.75 + bounceOffset, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090D15';
          ctx.font = '800 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', pt.x + markerR * 0.75, pt.y - markerR * 0.75 + bounceOffset + 0.5);
        }

        // Leader #1 Golden Crown above avatar
        if (p.id === leaderId) {
          const cy = pt.y - spriteSz / 2 - 4 + bounceOffset;
          ctx.fillStyle = '#FACC15';
          ctx.strokeStyle = '#090D15';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(pt.x - 6, cy);
          ctx.lineTo(pt.x - 7, cy - 6);
          ctx.lineTo(pt.x - 2.5, cy - 2.5);
          ctx.lineTo(pt.x, cy - 8);
          ctx.lineTo(pt.x + 2.5, cy - 2.5);
          ctx.lineTo(pt.x + 7, cy - 6);
          ctx.lineTo(pt.x + 6, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Overhead pixel emote balloon if triggered
        if (activeEmote) {
          renderOverheadEmoteBalloon(ctx, pt.x, pt.y + bounceOffset, activeEmote);
        }

        // Student name tag (clean crisp label)
        if (drawNames) {
          const shortName =
            compactLabelMode && p.name.length > 9 ? `${p.name.slice(0, 8)}…` : p.name.slice(0, 14);
          ctx.font = `700 ${compactLabelMode ? 9 : 11}px "Plus Jakarta Sans", sans-serif`;
          const textW = ctx.measureText(shortName).width;
          const labelY = pt.y + spriteSz / 2 + 10;
          ctx.fillStyle = 'rgba(7, 11, 20, 0.85)';
          ctx.fillRect(pt.x - textW / 2 - 4, labelY - 7, textW + 8, 13);
          ctx.fillStyle = p.id === leaderId ? '#FDE047' : '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(shortName, pt.x, labelY);
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isLobbyWaiting, deltaBufferRef, activeEmotesRef]);

  return (
    <div
      data-testid="projector-bigscreen-view"
      data-room-status={roomStatus}
      data-biome={biomeTheme.id}
      className="fixed inset-0 z-40 w-full h-[100dvh] bg-[#070B14] text-slate-100 flex flex-col overflow-hidden select-none"
    >
      {/* ==================== TOP BROADCAST HEADER (Clean 3-Zone Classroom Bar) ==================== */}
      <header className="shrink-0 h-20 px-5 xl:px-7 border-b border-slate-800/90 bg-[#0B1120] flex items-center justify-between gap-6">
        {/* Zone 1: Room Code & Session Metadata (Unboxed typography, zero pill clutter) */}
        <div className="min-w-0 flex items-center gap-5">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wide">
              Mode Proyektor Kelas
            </div>
            <div className="flex items-baseline gap-3">
              <span
                data-testid="projector-room-code"
                className="font-code text-2xl xl:text-3xl font-bold tracking-wider text-amber-400 whitespace-nowrap"
              >
                {roomCode}
              </span>
              <span className="hidden md:inline text-sm text-slate-400 whitespace-nowrap">
                {getModeLabel(mode)} · Level {level} ({maze.width}×{maze.height}) ·{' '}
                <span style={{ color: biomeTheme.accentHex }} className="font-semibold">
                  {biomeTheme.name}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Giant Classroom Countdown Timer & Class Key Progress */}
        <div className="flex items-center gap-6 xl:gap-8 shrink-0">
          {!isLobbyWaiting && (
            <div className="hidden sm:flex items-center gap-3 border-r border-slate-800 pr-6">
              {summary.isExitOpenForClass ? (
                <DoorOpen className="w-6 h-6 text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <KeyRound className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
              )}
              <div>
                <div className="text-[11px] font-semibold text-slate-400">
                  {summary.isExitOpenForClass
                    ? 'Gerbang Keluar'
                    : mode === 'coop'
                    ? 'Kunci Kelas'
                    : 'Kunci Tertinggi'}
                </div>
                <div
                  data-testid="projector-keys-progress"
                  className={`font-code text-xl xl:text-2xl font-bold tabular-nums leading-tight ${
                    summary.isExitOpenForClass ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {summary.isExitOpenForClass
                    ? 'TERBUKA'
                    : `${summary.collectedKeysDisplay} / ${summary.targetKeys}`}
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <div className="text-[11px] font-semibold text-slate-400">
              {isLobbyWaiting
                ? 'Menunggu Siswa'
                : roomStatus === 'paused'
                ? 'Permainan Dijeda'
                : 'Sisa Waktu'}
            </div>
            <div
              data-testid="projector-giant-timer"
              className={`font-code text-4xl xl:text-5xl font-bold tabular-nums leading-none tracking-tight ${
                isLobbyWaiting
                  ? 'text-sky-300'
                  : roomStatus === 'paused'
                  ? 'text-amber-300'
                  : clock.urgency === 'critical'
                  ? 'text-red-400'
                  : clock.urgency === 'warning'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {isLobbyWaiting ? `${studentPlayers.length}/${maxPlayers}` : clock.formatted}
            </div>
          </div>
        </div>

        {/* Zone 3: Minimal, Unobtrusive TV Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {!isLobbyWaiting && (
            <button
              type="button"
              data-testid="projector-toggle-names-btn"
              aria-pressed={showNameTags}
              onClick={() => {
                retroAudio.playButtonClick();
                setShowNameTags((v) => !v);
              }}
              className={`min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                showNameTags
                  ? 'bg-sky-950/90 border-sky-400/70 text-sky-200'
                  : 'bg-[#131b2b] border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">Label Nama</span>
            </button>
          )}

          <button
            type="button"
            data-testid="projector-fullscreen-btn"
            onClick={handleToggleFullscreen}
            title="Layar Penuh [F]"
            className="min-h-[40px] px-3 py-2 rounded-md bg-[#131b2b] hover:bg-[#1e293b] border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Maximize className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden xl:inline">{isFullscreen ? 'Keluar Full' : 'Layar Penuh [F]'}</span>
          </button>

          <button
            type="button"
            data-testid="projector-exit-btn"
            onClick={() => {
              retroAudio.playButtonClick();
              if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
              }
              onExitProjectorMode();
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-md bg-[#1e293b] hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <MonitorOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Keluar Mode TV</span>
          </button>
        </div>
      </header>

      {/* ==================== MAIN BROADCAST BODY ==================== */}
      {isLobbyWaiting ? (
        /* ---------- LOBBY BIG-SCREEN JOIN BOARD ---------- */
        <main className="flex-1 min-h-0 p-6 xl:p-10 flex flex-col items-center justify-center gap-7 overflow-y-auto">
          <div className="text-center space-y-3 max-w-4xl">
            <div className="text-sm font-semibold text-amber-300 tracking-wide">
              Guru: {teacherName} · {getModeLabel(mode)} · Labirin Level {level} ({maze.width}×{maze.height})
            </div>
            <h1 className="text-3xl xl:text-5xl font-bold text-white tracking-tight">
              Gabung ke Ruang Kelas Math Maze
            </h1>
            <p className="text-base xl:text-lg text-slate-300">
              Scan QR Code dengan kamera HP/tablet atau masukkan kode room di bawah ini:
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-5">
              <div className="rounded-xl bg-[#0F172A] border-2 border-amber-400/80 px-10 py-6 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                  Kode Room
                </span>
                <span
                  data-testid="projector-lobby-room-code"
                  className="font-code text-5xl sm:text-6xl xl:text-7xl font-bold tracking-[0.14em] text-amber-400"
                >
                  {roomCode}
                </span>
              </div>

              <div className="rounded-xl bg-[#0F172A] border-2 border-sky-400/75 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col items-center gap-2.5">
                <div className="p-2.5 rounded-lg bg-white">
                  <RoomJoinQrCode
                    roomCode={roomCode}
                    sizePx={176}
                    testId="projector-lobby-qr-img"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-200">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                  <span>Scan Kamera HP / Tablet</span>
                </div>
              </div>
            </div>
          </div>

          <section className="w-full max-w-5xl rounded-xl bg-[#0E1525] border border-slate-800 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <Users className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                <span>Siswa Bergabung ({studentPlayers.length} / {maxPlayers})</span>
              </div>
              {onStartGameFromLobby && (
                <button
                  type="button"
                  data-testid="projector-lobby-start-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onStartGameFromLobby();
                  }}
                  className="rpg-btn-gold min-h-[46px] px-6 py-2.5 font-bold text-sm flex items-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  <span>Mulai Permainan Sekarang</span>
                </button>
              )}
            </div>

            {studentPlayers.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-base">
                Menunggu siswa scan QR Code atau memasukkan kode{' '}
                <span className="font-code text-amber-300 font-bold">{roomCode}</span>...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[34vh] overflow-y-auto rpg-scroll pr-1">
                {studentPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg bg-[#131C30] border border-slate-800 px-3 py-2.5 flex items-center gap-2.5 min-w-0"
                  >
                    <img
                      src={getCharacterAvatarDataUrl(p.characterId, p.outfitColor)}
                      alt={p.name}
                      className="w-9 h-9 shrink-0 rounded bg-[#090D15] border border-slate-700"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">{p.name}</div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        {p.ready === false ? 'Menyiapkan...' : 'Siap'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      ) : (
        /* ---------- LIVE FULL-MAZE + PODIUM BROADCAST GRID ---------- */
        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_370px] xl:grid-cols-[1fr_410px] overflow-hidden">
          {/* LEFT: FULL-MAZE LIVE ARENA STAGE */}
          <section className="relative min-h-0 flex flex-col bg-[#070B14] border-r border-slate-800/90">
            <div ref={stageContainerRef} className="relative flex-1 min-h-0 w-full overflow-hidden">
              <canvas
                ref={canvasRef}
                data-testid="projector-maze-canvas"
                className="block w-full h-full"
              />

              {roomStatus === 'paused' && (
                <div className="absolute inset-0 bg-[#070B14]/70 flex items-center justify-center">
                  <div className="rounded-xl bg-[#0F172A] border-2 border-amber-400 px-8 py-5 text-center shadow-2xl">
                    <div className="font-code text-3xl font-bold text-amber-300 tracking-wider">
                      PERMAINAN DIJEDA
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Menunggu Guru melanjutkan sesi kelas
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quiet Bottom Broadcast Legend & Latest Classroom Milestone */}
            <div className="shrink-0 h-11 px-4 xl:px-6 border-t border-slate-800/90 bg-[#0B1120] flex items-center justify-between gap-4 text-xs text-slate-300 overflow-hidden">
              <div className="flex items-center gap-4 shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-xs bg-amber-400" aria-hidden="true" />
                  Kunci
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-xs ${
                      summary.isExitOpenForClass ? 'bg-emerald-400' : 'bg-red-500'
                    }`}
                    aria-hidden="true"
                  />
                  {summary.isExitOpenForClass ? 'Exit Terbuka' : 'Exit Terkunci'}
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-xs bg-purple-400" aria-hidden="true" />
                  {isVictoryMap ? 'Lobby Pemenang' : 'Ruang Rahasia'}
                </span>
                <span className="hidden md:flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-amber-400" aria-hidden="true" />
                  Menjawab Soal
                </span>
              </div>

              {recentEvents[0] && (
                <div
                  data-testid="projector-live-ticker"
                  className="truncate text-right text-slate-300 min-w-0"
                >
                  <span className="font-semibold text-amber-300">
                    {recentEvents[0].type === 'system' ? 'Info Kelas' : recentEvents[0].senderName}:
                  </span>{' '}
                  <span>{recentEvents[0].text}</span>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: LIVE CLASSROOM PODIUM & LEADERBOARD SIDEBAR */}
          <aside
            data-testid="projector-podium-panel"
            className="min-h-0 flex flex-col bg-[#0B1120] overflow-hidden"
          >
            {/* Live Podium Header */}
            <div className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-800/90 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-bold text-white tracking-wide">Podium Live Kelas</h2>
              </div>
              <span className="font-code text-xs text-slate-400 tabular-nums">
                {summary.totalStudents} Siswa
              </span>
            </div>

            {/* Stepped Championship Podium (#2 | #1 | #3) */}
            <div className="shrink-0 px-4 pt-5 pb-4 border-b border-slate-800/90 bg-[#0D1426]">
              <div className="grid grid-cols-3 items-end gap-2.5">
                {summary.podiumSlots.map(({ place, entry }) => {
                  const isFirst = place === 1;
                  const pedestalHeight = isFirst ? 'h-24' : place === 2 ? 'h-16' : 'h-12';
                  const accentText = isFirst
                    ? 'text-amber-300'
                    : place === 2
                    ? 'text-slate-200'
                    : 'text-orange-300';
                  const pedestalBorder = isFirst
                    ? 'border-amber-400/70 bg-amber-950/35'
                    : place === 2
                    ? 'border-slate-500/60 bg-slate-800/45'
                    : 'border-orange-500/50 bg-orange-950/30';

                  return (
                    <div
                      key={place}
                      data-testid={`projector-podium-place-${place}`}
                      className="flex flex-col items-center text-center min-w-0"
                    >
                      {entry ? (
                        <>
                          {isFirst && (
                            <Crown
                              className="w-5 h-5 text-amber-400 mb-1"
                              aria-hidden="true"
                            />
                          )}
                          <img
                            src={getCharacterAvatarDataUrl(entry.characterId, entry.outfitColor)}
                            alt={entry.name}
                            className={`${
                              isFirst ? 'w-14 h-14 border-amber-400' : 'w-11 h-11 border-slate-600'
                            } rounded-md bg-[#070B14] border-2 mb-1.5`}
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <div className="w-full text-xs font-bold text-white truncate px-1">
                            {entry.name}
                          </div>
                          <div className="font-code text-xs font-bold text-emerald-400 tabular-nums mb-1.5">
                            {entry.score} pt
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-600 mb-2">Menunggu</div>
                      )}

                      <div
                        className={`w-full ${pedestalHeight} rounded-t-md border-t border-x ${pedestalBorder} flex flex-col items-center justify-center px-1`}
                      >
                        <div className={`font-code text-lg font-bold ${accentText}`}>#{place}</div>
                        {entry && (
                          <div className="font-code text-[10px] text-slate-300 tabular-nums">
                            {entry.keysCollected} kunci · {entry.accuracy}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team Battle Standings (when in Team Battle mode) */}
            {mode === 'team' && summary.topTeams.length > 0 && (
              <div className="shrink-0 px-4 py-3 border-b border-slate-800/90 space-y-2">
                <div className="text-xs font-semibold text-slate-400">Klasemen Tim</div>
                <div className="space-y-1.5">
                  {summary.topTeams.map((t) => (
                    <div key={t.teamId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold truncate" style={{ color: t.color }}>
                          #{t.rank} {t.teamName}
                        </span>
                        <span className="font-code text-slate-200 tabular-nums">
                          {t.keysCollected}/{t.targetKeys} kunci · {t.totalScore} pt
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${t.progressPercent}%`, backgroundColor: t.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Class Rankings (#4 - #10) */}
            <div className="flex-1 min-h-0 overflow-y-auto rpg-scroll px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-1">
                <span>Peringkat Berikutnya</span>
                <span>Kunci / Skor</span>
              </div>

              {summary.runnerUps.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  {leaderboard.length > 0
                    ? 'Seluruh peserta saat ini berada di Podium Top 3.'
                    : 'Skor siswa akan tampil secara real-time di sini.'}
                </div>
              ) : (
                summary.runnerUps.map((entry) => (
                  <div
                    key={entry.playerId}
                    className="rounded-md bg-[#11192B] border border-slate-800/90 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-code text-slate-400 font-bold w-6 shrink-0 tabular-nums">
                        #{entry.rank}
                      </span>
                      <span className="font-semibold text-slate-100 truncate">{entry.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        · {getStatusLabel(entry.status)}
                      </span>
                    </div>
                    <div className="font-code font-bold text-slate-200 shrink-0 tabular-nums">
                      <span className="text-amber-300">{entry.keysCollected}k</span>
                      <span className="text-slate-600 mx-1.5">/</span>
                      <span className="text-emerald-400">{entry.score}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Clean Unboxed Class Status Footer */}
            <div className="shrink-0 h-11 px-5 border-t border-slate-800/90 bg-[#090F1D] flex items-center justify-between text-xs text-slate-400 tabular-nums">
              <span>Aktif: <strong className="text-slate-100">{summary.activeStudents}</strong></span>
              <span>Menjawab: <strong className="text-amber-300">{summary.answeringStudents}</strong></span>
              <span>Selesai: <strong className="text-emerald-400">{summary.escapedStudents}</strong></span>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
};

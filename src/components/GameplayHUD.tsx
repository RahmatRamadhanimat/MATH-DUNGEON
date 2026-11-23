import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  Flag,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Tv,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  GameMode,
  MazeBiomeId,
  PlayerStatus,
  QUICK_CHAT_MESSAGES,
  TEAM_DEFINITIONS,
  TeamId,
} from '../shared/constants';
import { DEFAULT_MAZE_BIOME, getMazeBiomeTheme } from '../shared/biomeThemes';
import { LeaderboardEntry, TeamLeaderboardEntry } from '../shared/scoreSystem';
import { SpectatorCameraMode } from '../shared/spectatorCamera';
import { EMOTE_DEFINITIONS, EmoteId } from '../shared/emoteSystem';
import { StudentAnalyticsPanel } from './StudentAnalyticsPanel';
import { ChatLogItem } from '../../server';
import { getCharacterAvatarDataUrl } from '../game/assets/PixelArtSprites';
import { retroAudio } from '../game/audio/RetroAudio';

interface GameplayHUDProps {
  roomCode: string;
  level: number;
  mode: GameMode;
  biome?: MazeBiomeId;
  localPlayerId?: string;
  playerName: string;
  playerRole: 'teacher' | 'student';
  teamId: TeamId | null;
  lives: number;
  maxLives: number;
  score: number;
  myKeysCollected: number;
  sharedKeysCollected: number;
  teamKeysCollected: Record<TeamId, number>;
  targetKeys: number;
  doorOpenForMe: boolean;
  remainingSeconds: number;
  playerStatus: PlayerStatus;
  isPaused: boolean;
  isVictoryLobby?: boolean;
  showMinimap?: boolean;
  minimapExpandedSize?: boolean;
  muted: boolean;
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  chatHistory: ChatLogItem[];
  spectatorMode?: SpectatorCameraMode;
  spectatedPlayerId?: string | null;
  spectatedPlayerName?: string | null;
  onSelectSpectatePlayer?: (playerId: string) => void;
  onChangeSpectatorMode?: (mode: SpectatorCameraMode) => void;
  onCycleSpectatePlayer?: (delta: 1 | -1) => void;
  onToggleMinimap?: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onSendChat: (text: string, type: 'chat' | 'emoji') => void;
  onTriggerEmote?: (emoteId: EmoteId) => void;
  onTeacherEndGame: () => void;
  onTeacherRestartGame: () => void;
  onOpenProjectorMode?: () => void;
  onLeaveRoom: () => void;
  onOpenVictoryResults?: () => void;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({
  roomCode,
  level,
  mode,
  biome = DEFAULT_MAZE_BIOME,
  playerName,
  playerRole,
  teamId,
  lives,
  maxLives,
  score,
  myKeysCollected,
  sharedKeysCollected,
  teamKeysCollected,
  targetKeys,
  doorOpenForMe,
  remainingSeconds,
  playerStatus,
  isPaused,
  isVictoryLobby = false,
  showMinimap = true,
  minimapExpandedSize = false,
  muted,
  leaderboard,
  teamLeaderboard,
  chatHistory,
  spectatorMode = 'self',
  spectatedPlayerId = null,
  spectatedPlayerName = null,
  onSelectSpectatePlayer,
  onChangeSpectatorMode,
  onCycleSpectatePlayer,
  onToggleMinimap,
  onToggleMute,
  onTogglePause,
  onSendChat,
  onTriggerEmote,
  onTeacherEndGame,
  onTeacherRestartGame,
  onOpenProjectorMode,
  onLeaveRoom,
  onOpenVictoryResults,
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [liveFeedExpanded, setLiveFeedExpanded] = useState(true);
  const [customChat, setCustomChat] = useState('');
  const [seenChatCount, setSeenChatCount] = useState(chatHistory.length);
  const prevChatLenRef = useRef(chatHistory.length);

  useEffect(() => {
    if (showChat) {
      setSeenChatCount(chatHistory.length);
    } else if (chatHistory.length > prevChatLenRef.current) {
      // Automatically expand the live notification feed when a new chat or system event arrives
      setLiveFeedExpanded(true);
    }
    prevChatLenRef.current = chatHistory.length;
  }, [chatHistory.length, showChat]);

  const unreadChatCount = showChat ? 0 : Math.max(0, chatHistory.length - seenChatCount);
  const recentFeedMessages = chatHistory.slice(-4);

  const effectiveKeys =
    mode === 'coop'
      ? sharedKeysCollected
      : mode === 'team' && teamId
      ? teamKeysCollected[teamId] ?? 0
      : myKeysCollected;

  const modeTitle =
    mode === 'coop'
      ? 'Co-op Adventure'
      : mode === 'competitive'
      ? 'Class Competition'
      : 'Team Battle';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customChat.trim()) return;
    onSendChat(customChat.trim(), 'chat');
    setCustomChat('');
  };

  const minimapClearanceClass = !showMinimap
    ? ''
    : minimapExpandedSize
    ? 'sm:mr-[280px]'
    : 'sm:mr-[220px]';

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {/* Low HP Critical Peripheral Vignette */}
      {lives === 1 && playerStatus === 'active' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none shadow-[inset_0_0_90px_rgba(220,38,38,0.45)]"
        />
      )}

      {/* TOP-LEFT PERIMETER CLUSTER: Vitality Hearts, Score, Keys, + Mobile Timer */}
      <div className="fixed top-2 left-2 right-2 sm:right-auto sm:top-3 sm:left-3 pointer-events-auto flex flex-col gap-1.5 sm:max-w-lg">
        <div className="rpg-panel px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center justify-between sm:justify-start gap-2.5 sm:gap-5">
          {/* Player Identity & Vitality Pips */}
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
              <span className="truncate max-w-[78px] sm:max-w-[140px] font-semibold text-white">
                {playerName}
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-code text-amber-300 shrink-0">Lvl {level}</span>
              <span className="lg:hidden text-slate-500" aria-hidden="true">·</span>
              <span className="lg:hidden font-code text-amber-300 font-semibold shrink-0">
                {roomCode}
              </span>
              {teamId && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-500">·</span>
                  <span
                    className="hidden sm:inline font-semibold shrink-0"
                    style={{ color: TEAM_DEFINITIONS[teamId].color }}
                  >
                    {TEAM_DEFINITIONS[teamId].name}
                  </span>
                </>
              )}
            </div>

            {/* Code-Authored SVG Heart Vitality Pips */}
            <div
              className="flex items-center gap-0.5 sm:gap-1 mt-1"
              aria-label={`Nyawa: ${lives} dari ${maxLives}`}
            >
              <span className="text-[10px] font-semibold text-slate-400 mr-1">HP</span>
              {Array.from({ length: maxLives }, (_, i) => {
                const isFull = i < lives;
                return (
                  <svg
                    key={i}
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 21s-7.5-4.65-9.75-9.2C.6 8.45 2.7 4.5 6.6 4.5c2.1 0 3.9 1.2 5.4 3 1.5-1.8 3.3-3 5.4-3 3.9 0 6 3.95 4.35 7.3C19.5 16.35 12 21 12 21z"
                      fill={isFull ? '#EF4444' : '#1E293B'}
                      stroke="#090D15"
                      strokeWidth="2"
                    />
                    {isFull && (
                      <path
                        d="M6.5 7.5c1.2 0 2.1.5 2.7 1.3"
                        stroke="#FCA5A5"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill="none"
                      />
                    )}
                  </svg>
                );
              })}
            </div>
          </div>

          {/* Score Readout */}
          <div className="border-l border-slate-700/80 pl-2.5 sm:pl-4 shrink-0">
            <div className="text-[10px] font-medium text-slate-400 leading-none">Skor</div>
            <div
              data-testid="hud-score"
              className="font-code text-sm sm:text-xl font-bold text-white tabular-nums leading-tight mt-0.5"
            >
              {Math.round(score)}
            </div>
          </div>

          {/* Keys Collected Counter */}
          <div className="border-l border-slate-700/80 pl-2.5 sm:pl-4 shrink-0">
            <div className="text-[10px] font-medium text-amber-300 leading-none">
              <span className="sm:hidden">Kunci</span>
              <span className="hidden sm:inline">
                {mode === 'coop' ? 'Kunci Kelas' : mode === 'team' ? 'Kunci Tim' : 'Kunci Saya'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" aria-hidden="true">
                <circle cx="8" cy="12" r="5" fill="#FBBF24" stroke="#090D15" strokeWidth="2" />
                <path d="M13 12h8v3h-2v2h-3v-2h-3z" fill="#FBBF24" stroke="#090D15" strokeWidth="1.5" />
              </svg>
              <span
                data-testid="hud-keys"
                className="font-code text-sm sm:text-xl font-bold text-amber-400 tabular-nums leading-tight"
              >
                {effectiveKeys}/{targetKeys}
              </span>
            </div>
          </div>

          {/* Mobile & Tablet Inline Countdown Timer */}
          <div className="lg:hidden border-l border-slate-700/80 pl-2.5 sm:pl-4 shrink-0">
            <div className="text-[10px] font-medium text-slate-400 leading-none">Waktu</div>
            <div
              className={`font-code text-sm sm:text-lg font-bold tabular-nums leading-tight mt-0.5 ${
                remainingSeconds <= 30 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {formatTimer(remainingSeconds)}
            </div>
          </div>
        </div>

        {/* Status Banner when Door Opens, Victory Sanctuary Lobby, or Spectator Mode (Desktop/Tablet) */}
        {isVictoryLobby ? (
          <div
            data-testid="victory-lobby-banner"
            className="pointer-events-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-amber-950/90 border border-amber-400/80 px-3 py-2 text-xs text-amber-100 shadow-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-bold text-amber-300 tracking-wide">
                  AULA PEMENANG · LOBBY KELUAR DUNGEON
                </div>
                <div className="text-[11px] text-amber-100/90">
                  Anda telah keluar dari dungeon! Bebas berkeliling bersama pemain lain.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {onOpenVictoryResults && (
                <button
                  type="button"
                  data-testid="open-victory-results-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onOpenVictoryResults();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Trophy className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Tabel Hasil Akhir</span>
                </button>
              )}
              <button
                type="button"
                data-testid="victory-lobby-play-again-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onTeacherRestartGame();
                }}
                className="px-2.5 py-1 rounded bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/60 text-emerald-100 font-semibold text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Main Lagi</span>
              </button>
              <button
                type="button"
                data-testid="return-to-menu-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onLeaveRoom();
                }}
                className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-500/70 text-slate-100 font-semibold text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Menu Utama</span>
              </button>
            </div>
          </div>
        ) : (
          doorOpenForMe &&
          playerStatus === 'active' && (
            <div className="hidden sm:flex items-center gap-2 rounded-md bg-emerald-950/95 border border-emerald-400/90 px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" aria-hidden="true" />
              <span>Pintu Keluar Terbuka — capai gerbang hijau di labirin untuk menang!</span>
            </div>
          )
        )}
        {!isVictoryLobby && (playerStatus === 'spectator' || playerStatus === 'eliminated') && (
          <div className="hidden sm:block rounded-md bg-red-950/95 border border-red-400/90 px-3 py-1.5 text-xs font-semibold text-red-100 shadow-lg">
            Mode Spectator — Nyawa habis. Anda tetap dapat memantau jalannya permainan.
          </div>
        )}

        {/* LIVE FLOATING CHAT & SYSTEM NOTIFICATION OVERLAY (Shows Other Players & System Messages Automatically) */}
        <div
          data-testid="live-chat-feed"
          className="mt-9 sm:mt-0.5 w-[238px] sm:w-[320px] pointer-events-none flex flex-col gap-1"
        >
          <div className="pointer-events-auto flex items-center justify-between gap-1.5 rounded-md bg-[#090D15]/75 border border-slate-600/60 px-2.5 py-1 shadow-md">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 truncate">
                Pesan Pemain &amp; Sistem ({chatHistory.length})
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="open-chat-from-feed-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  setShowChat(true);
                  setShowLeaderboard(false);
                }}
                className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-[10px] font-semibold text-sky-200 transition-colors"
              >
                Balas
              </button>
              <button
                type="button"
                aria-label={liveFeedExpanded ? 'Sembunyikan Feed Pesan' : 'Tampilkan Feed Pesan'}
                onClick={() => setLiveFeedExpanded((v) => !v)}
                className="w-5 h-5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                {liveFeedExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {liveFeedExpanded && (
            <div data-testid="live-chat-items" className="flex flex-col gap-1">
              {recentFeedMessages.length === 0 ? (
                <div className="rounded-md bg-[#090D15]/65 border border-slate-700/60 px-2.5 py-1.5 text-[10px] text-slate-400">
                  Belum ada pesan baru. Pesan pemain lain &amp; sistem akan muncul di sini.
                </div>
              ) : (
                recentFeedMessages.map((msg, idx) => {
                  const isSystem = msg.type === 'system';
                  const isEmoji = msg.type === 'emoji';
                  const isMe = !isSystem && msg.senderName === playerName;
                  const isLatest = idx === recentFeedMessages.length - 1;

                  return (
                    <div
                      key={msg.id}
                      data-testid="live-chat-item"
                      data-message-type={msg.type}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] leading-snug shadow-md transition-all ${
                        isSystem
                          ? 'bg-[#171208]/82 border border-amber-400/45 border-l-4 border-l-amber-400 text-amber-100'
                          : isEmoji
                          ? 'bg-[#0b1919]/82 border border-emerald-400/45 border-l-4 border-l-emerald-400 text-slate-100'
                          : 'bg-[#0c1526]/82 border border-sky-400/45 border-l-4 border-l-sky-400 text-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          {isSystem ? (
                            <>
                              <Bell className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                              <span className="text-[9px] font-bold tracking-wider uppercase px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                SISTEM
                              </span>
                            </>
                          ) : (
                            <>
                              <MessageSquare
                                className="w-3 h-3 text-sky-300 shrink-0"
                                aria-hidden="true"
                              />
                              <span
                                className="font-bold truncate max-w-[125px]"
                                style={{
                                  color: msg.teamId
                                    ? TEAM_DEFINITIONS[msg.teamId].color
                                    : isMe
                                    ? '#38BDF8'
                                    : '#7DD3FC',
                                }}
                              >
                                {msg.senderName}
                              </span>
                              <span className="text-[9px] font-semibold px-1 rounded bg-slate-800/90 text-slate-300 border border-slate-600/70 shrink-0">
                                {isMe
                                  ? 'ANDA'
                                  : msg.teamId
                                  ? TEAM_DEFINITIONS[msg.teamId].name
                                  : 'PEMAIN'}
                              </span>
                            </>
                          )}
                        </div>
                        {isLatest && (
                          <span className="font-code text-[9px] font-bold text-emerald-300 shrink-0">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className={isSystem ? 'text-amber-100/95 font-medium' : 'text-slate-100'}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* TOP-CENTER COMPACT TIMER & ROOM CODE (Desktop lg+) */}
      <div className="hidden lg:flex fixed top-3 left-1/2 -translate-x-1/2 pointer-events-auto rpg-panel px-4 py-2 items-center gap-4">
        <div className="text-xs text-slate-300 whitespace-nowrap">
          <span className="font-code text-amber-400 font-bold">{roomCode}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="font-medium">{modeTitle}</span>
          {!isVictoryLobby && (
            <>
              <span className="mx-2 text-slate-600">·</span>
              <span
                data-testid="hud-biome-label"
                className="font-semibold"
                style={{ color: getMazeBiomeTheme(biome).accentHex }}
              >
                {getMazeBiomeTheme(biome).name}
              </span>
            </>
          )}
        </div>
        <div className="border-l border-slate-700/80 pl-4 flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Waktu</span>
          <span
            data-testid="hud-timer"
            className={`font-code text-lg font-bold tabular-nums ${
              remainingSeconds <= 30 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {formatTimer(remainingSeconds)}
          </span>
        </div>
      </div>

      {/* TOP-RIGHT UTILITY CONTROLS & TEACHER ACTION BAR */}
      <div className="fixed top-[54px] left-2 right-2 sm:left-auto sm:top-3 sm:right-3 pointer-events-none flex flex-col items-end gap-1 sm:gap-2">
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 pointer-events-auto">
          {/* Mobile Team / Mode Micro Tag */}
          <div className="sm:hidden rounded-md bg-[#131b2b]/95 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 truncate max-w-[130px]">
            {teamId ? (
              <span style={{ color: TEAM_DEFINITIONS[teamId].color }}>
                {TEAM_DEFINITIONS[teamId].name}
              </span>
            ) : (
              <span>{mode === 'coop' ? 'Co-op' : mode === 'competitive' ? 'Kompetisi' : 'Tim'}</span>
            )}
          </div>

          <div className="rpg-panel flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 ml-auto">
            {onToggleMinimap && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-minimap-toggle-btn"
                aria-pressed={showMinimap}
                aria-label={showMinimap ? 'Sembunyikan Peta Mini' : 'Tampilkan Peta Mini'}
                title={showMinimap ? 'Sembunyikan Peta Mini [N]' : 'Tampilkan Peta Mini [N]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  retroAudio.playButtonClick();
                  onToggleMinimap();
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  showMinimap
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-[#1e293b] text-slate-200 hover:bg-[#283548]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Peta</span>
                <span className="hidden sm:inline">Peta [N]</span>
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              aria-label="Tampilkan Leaderboard"
              onClick={(e) => {
                e.currentTarget.blur();
                retroAudio.playButtonClick();
                setShowLeaderboard((v) => {
                  const next = !v;
                  if (next) setShowChat(false);
                  return next;
                });
              }}
              className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                showLeaderboard
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#1e293b] text-slate-200 hover:bg-[#283548]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Rank ({leaderboard.length})</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-chat-toggle-btn"
              aria-label="Tampilkan Quick Chat"
              onClick={(e) => {
                e.currentTarget.blur();
                retroAudio.playButtonClick();
                setShowChat((v) => {
                  const next = !v;
                  if (next) {
                    setShowLeaderboard(false);
                    setSeenChatCount(chatHistory.length);
                  }
                  return next;
                });
              }}
              className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                showChat
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-[#1e293b] text-slate-200 hover:bg-[#283548]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Chat</span>
              {unreadChatCount > 0 && (
                <span className="font-code text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-amber-400 text-slate-950">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-[34px] h-[34px] rounded bg-[#1e293b] hover:bg-[#283548] text-slate-200 flex items-center justify-center shrink-0 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Menu Pause"
              onClick={(e) => {
                e.currentTarget.blur();
                retroAudio.playButtonClick();
                onTogglePause();
              }}
              className="min-h-[34px] px-2.5 py-1 rounded bg-[#1e293b] hover:bg-[#283548] text-amber-300 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span className="sm:hidden">{isPaused ? 'Lanjut' : 'Pause'}</span>
              <span className="hidden sm:inline">{isPaused ? 'Lanjut [P]' : 'Pause [P]'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Status Banner below utility row */}
        {doorOpenForMe && playerStatus === 'active' && (
          <div className="sm:hidden w-full pointer-events-auto rounded-md bg-emerald-950/95 border border-emerald-400/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
            Pintu Keluar Terbuka! Capai gerbang hijau untuk menang!
          </div>
        )}
        {(playerStatus === 'spectator' || playerStatus === 'eliminated') && (
          <div className="sm:hidden w-full pointer-events-auto rounded-md bg-red-950/95 border border-red-400/90 px-2.5 py-1 text-[11px] font-semibold text-red-100">
            Mode Spectator — Nyawa habis. Anda memantau permainan.
          </div>
        )}

        {/* Teacher Live Control Strip (Positioned to the left of the Top-Right Mini-Map when visible) */}
        {playerRole === 'teacher' && (
          <div className={`rpg-panel pointer-events-auto ${minimapClearanceClass} flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 border-amber-500/60 px-1.5 py-1 sm:p-1.5 max-w-full transition-[margin] duration-150`}>
            <span className="hidden sm:inline text-[11px] font-semibold text-amber-300 px-1.5">
              Kontrol Guru
            </span>
            {onOpenProjectorMode && (
              <button
                type="button"
                data-testid="hud-projector-mode-btn"
                title="Mode Proyektor / TV Kelas (Big Screen View) [T]"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onOpenProjectorMode();
                }}
                className="min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] sm:text-xs font-bold flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <Tv className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Mode TV</span>
                <span className="hidden sm:inline">Mode TV [T]</span>
              </button>
            )}
            <button
              type="button"
              data-testid="hud-teacher-analytics-btn"
              onClick={() => {
                retroAudio.playButtonClick();
                setShowAnalyticsModal(true);
              }}
              className="min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 py-1 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-400/70 text-[11px] sm:text-xs font-semibold text-sky-200 flex items-center gap-1 whitespace-nowrap"
            >
              <BarChart3 className="w-3 h-3 text-sky-300" aria-hidden="true" />
              <span>Student Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                onTeacherRestartGame();
              }}
              className="min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 py-1 rounded bg-[#1e293b] hover:bg-[#283548] text-[11px] sm:text-xs font-medium text-sky-300 flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Labirin Baru</span>
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                onTeacherEndGame();
              }}
              className="min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 py-1 rounded bg-red-950/90 hover:bg-red-900 border border-red-500/70 text-[11px] sm:text-xs font-medium text-red-100 flex items-center gap-1 whitespace-nowrap"
            >
              <Flag className="w-3 h-3" aria-hidden="true" />
              <span>Akhiri Sesi</span>
            </button>
            <a
              href={`/api/export/${roomCode}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-[30px] sm:min-h-[32px] flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/70 text-[11px] sm:text-xs font-medium text-emerald-100 whitespace-nowrap"
            >
              <Download className="w-3 h-3" aria-hidden="true" />
              <span className="sm:hidden">CSV</span>
              <span className="hidden sm:inline">Unduh CSV</span>
            </a>
          </div>
        )}

        {/* Teacher & Spectator Free-Cam / Student Follow Control Bar */}
        {(playerRole === 'teacher' ||
          playerStatus === 'spectator' ||
          playerStatus === 'eliminated' ||
          spectatorMode !== 'self') && (
          <div
            data-testid="spectator-camera-bar"
            data-spectator-mode={spectatorMode}
            className={`rpg-panel pointer-events-auto ${minimapClearanceClass} flex flex-wrap items-center justify-between sm:justify-end gap-1.5 px-2.5 py-1.5 max-w-full transition-[margin] duration-150 ${
              spectatorMode === 'follow_student'
                ? 'border-emerald-400/80 bg-[#071c18]/92'
                : spectatorMode === 'free_cam'
                ? 'border-sky-400/80 bg-[#081627]/92'
                : 'border-slate-600/80'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {spectatorMode === 'follow_student' ? (
                <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              )}
              <span
                data-testid="spectator-status-label"
                className="text-[11px] font-bold truncate max-w-[175px] sm:max-w-[230px]"
              >
                {spectatorMode === 'follow_student' ? (
                  <span className="text-emerald-300">
                    MEMANTAU: {spectatedPlayerName || 'Siswa'}
                  </span>
                ) : spectatorMode === 'free_cam' ? (
                  <span className="text-sky-300">FREE-CAM BEBAS (WASD / Klik Peta)</span>
                ) : (
                  <span className="text-slate-200">Kamera Guru · Pilih Siswa di Rank</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="spectator-prev-btn"
                aria-label="Pantau Siswa Sebelumnya"
                title="Pantau Siswa Sebelumnya"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onCycleSpectatePlayer?.(-1);
                }}
                className="min-h-[28px] px-1.5 py-0.5 rounded bg-[#1e293b] hover:bg-[#283548] border border-slate-600/70 text-[11px] font-semibold text-slate-200 flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Siswa</span>
              </button>
              <button
                type="button"
                data-testid="spectator-next-btn"
                aria-label="Pantau Siswa Berikutnya"
                title="Pantau Siswa Berikutnya"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onCycleSpectatePlayer?.(1);
                }}
                className="min-h-[28px] px-1.5 py-0.5 rounded bg-[#1e293b] hover:bg-[#283548] border border-slate-600/70 text-[11px] font-semibold text-slate-200 flex items-center gap-0.5"
              >
                <span className="hidden sm:inline">Siswa</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="spectator-freecam-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onChangeSpectatorMode?.(spectatorMode === 'free_cam' ? 'self' : 'free_cam');
                }}
                className={`min-h-[28px] px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                  spectatorMode === 'free_cam'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-200'
                }`}
              >
                <Camera className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Free-Cam</span>
              </button>
              {spectatorMode !== 'self' && (
                <button
                  type="button"
                  data-testid="spectator-self-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onChangeSpectatorMode?.('self');
                  }}
                  className="min-h-[28px] px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/60 text-amber-200 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <UserCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Kamera Saya</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsible Live Leaderboard Panel (Docked to the left of the Top-Right Mini-Map when visible) */}
        {showLeaderboard && (
          <div className={`rpg-panel pointer-events-auto ${minimapClearanceClass} w-full sm:w-80 max-w-sm max-h-[52dvh] sm:max-h-96 overflow-y-auto rpg-scroll p-3.5 text-slate-100 transition-[margin] duration-150`}>
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Klasemen Real-Time</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="leaderboard-freecam-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onChangeSpectatorMode?.(spectatorMode === 'free_cam' ? 'self' : 'free_cam');
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                    spectatorMode === 'free_cam'
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-sky-950/90 hover:bg-sky-900 border border-sky-400/60 text-sky-200'
                  }`}
                >
                  <Camera className="w-3 h-3" aria-hidden="true" />
                  <span>Free-Cam</span>
                </button>
                <button
                  type="button"
                  aria-label="Tutup Leaderboard"
                  onClick={() => setShowLeaderboard(false)}
                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-2.5 flex items-center justify-between gap-2 rounded bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 text-[10px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Klik nama siswa untuk mengarahkan kamera ke posisinya</span>
              </span>
              {spectatorMode !== 'self' && (
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onChangeSpectatorMode?.('self');
                  }}
                  className="px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/50 text-amber-300 font-semibold shrink-0"
                >
                  Reset
                </button>
              )}
            </div>

            {mode === 'team' && teamLeaderboard.length > 0 && (
              <div className="mb-3 space-y-1.5 border-b border-slate-700/80 pb-2.5">
                <div className="text-[11px] font-medium text-slate-400">Klasemen Tim</div>
                {teamLeaderboard.map((t) => (
                  <div
                    key={t.teamId}
                    className="rpg-well flex items-center justify-between text-xs px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-code font-bold text-slate-400">#{t.rank}</span>
                      <span style={{ color: t.color }} className="font-bold">
                        {t.teamName}
                      </span>
                      <span className="text-[11px] text-slate-400">({t.memberCount})</span>
                    </div>
                    <div className="font-code tabular-nums text-right">
                      <span className="text-amber-300 font-bold">
                        {t.keysCollected}/{t.targetKeys}K
                      </span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span>{t.totalScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {leaderboard.slice(0, 15).map((entry) => {
                const isSpectated =
                  spectatorMode === 'follow_student' && spectatedPlayerId === entry.playerId;

                return (
                  <button
                    key={entry.playerId}
                    type="button"
                    data-testid={`leaderboard-spectate-${entry.playerId}`}
                    data-spectate-row="true"
                    data-spectated={isSpectated ? 'true' : 'false'}
                    aria-label={`Pantau siswa ${entry.name}`}
                    onClick={() => {
                      retroAudio.playButtonClick();
                      onSelectSpectatePlayer?.(entry.playerId);
                    }}
                    className={`w-full text-left flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      isSpectated
                        ? 'bg-emerald-950/75 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.28)]'
                        : 'bg-[#0b101b] hover:bg-[#172236] border-slate-700/80 hover:border-sky-400/60 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span className="font-code text-slate-400 w-5 tabular-nums shrink-0">
                        #{entry.rank}
                      </span>
                      <img
                        src={getCharacterAvatarDataUrl(entry.characterId, entry.outfitColor)}
                        alt={entry.name}
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded shrink-0"
                      />
                      <span className="truncate max-w-[100px] font-semibold text-slate-100">
                        {entry.name}
                      </span>
                      {isSpectated ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-400/20 border border-emerald-400/60 text-[9px] font-bold text-emerald-300 shrink-0">
                          <Eye className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>DIPANTAU</span>
                        </span>
                      ) : (
                        <Eye
                          className="w-3 h-3 text-slate-500 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-code tabular-nums shrink-0 ml-1">
                      <span className="text-amber-400">{entry.keysCollected}K</span>
                      <span className="font-bold text-white w-10 text-right">{entry.score}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Quick Chat & System Log Drawer (Docked to the left of the Top-Right Mini-Map when visible) */}
        {showChat && (
          <div className={`rpg-panel pointer-events-auto ${minimapClearanceClass} w-full sm:w-80 max-w-sm p-3.5 text-slate-100 transition-[margin] duration-150`}>
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2.5">
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Komunikasi Kelas</span>
              </span>
              <button
                type="button"
                aria-label="Tutup Quick Chat"
                onClick={() => setShowChat(false)}
                className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chat Feed */}
            <div className="rpg-well h-32 sm:h-36 overflow-y-auto rpg-scroll space-y-1.5 p-2.5 mb-2 text-xs">
              {chatHistory.slice(-15).map((msg) => (
                <div key={msg.id} className="leading-snug">
                  {msg.type === 'system' ? (
                    <span className="text-amber-300 font-medium">{msg.text}</span>
                  ) : (
                    <>
                      <span className="font-semibold text-sky-300">{msg.senderName}: </span>
                      <span className="text-slate-200">{msg.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Overhead Pixel Emote Reaction Bar in Chat Drawer */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {EMOTE_DEFINITIONS.map((em) => (
                <button
                  key={em.id}
                  type="button"
                  data-testid={`chat-emote-btn-${em.id}`}
                  onClick={() => {
                    retroAudio.playButtonClick();
                    if (onTriggerEmote) {
                      onTriggerEmote(em.id);
                    } else {
                      onSendChat(em.chatText, 'emoji');
                    }
                  }}
                  className="rpg-btn-slate min-h-[32px] px-1.5 py-1 text-[10px] font-bold flex items-center justify-center gap-1 truncate"
                  style={{ color: em.accentColor }}
                >
                  <span>{em.shortTag}</span>
                </button>
              ))}
            </div>

            {/* Quick Chat Presets */}
            <div className="grid grid-cols-1 gap-1 mb-2">
              {QUICK_CHAT_MESSAGES.slice(0, 3).map((qText) => (
                <button
                  key={qText}
                  type="button"
                  onClick={() => onSendChat(qText, 'chat')}
                  className="rpg-btn-slate text-left min-h-[34px] px-2.5 py-1 text-[11px] text-slate-200 truncate"
                >
                  {qText}
                </button>
              ))}
            </div>

            {/* Custom Message Form */}
            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={customChat}
                onChange={(e) => setCustomChat(e.target.value)}
                placeholder="Ketik pesan singkat..."
                maxLength={80}
                className="rpg-well flex-1 min-h-[38px] px-2.5 py-1 text-base sm:text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                aria-label="Kirim pesan"
                className="min-h-[38px] px-3 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Kirim</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* BOTTOM-RIGHT OVERHEAD PIXEL EMOTE REACTION BAR (Lompat Gembira, Mahkota, Kembang Api, dll.) */}
      <div
        data-testid="quick-emote-bar"
        className="fixed bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-20 pointer-events-auto rpg-panel px-2 py-1.5 flex flex-col items-end gap-1 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between w-full gap-2 px-0.5">
          <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Emote Karakter</span>
          </span>
          <span className="hidden sm:inline font-code text-[9px] text-slate-400">Tombol [1-6]</span>
        </div>
        <div className="grid grid-cols-3 sm:flex items-center gap-1">
          {EMOTE_DEFINITIONS.map((emote, idx) => (
            <button
              key={emote.id}
              type="button"
              tabIndex={-1}
              data-testid={`emote-btn-${emote.id}`}
              title={`${emote.label} [${idx + 1}]`}
              onClick={(e) => {
                e.currentTarget.blur();
                retroAudio.playButtonClick();
                if (onTriggerEmote) {
                  onTriggerEmote(emote.id);
                } else {
                  onSendChat(emote.chatText, 'emoji');
                }
              }}
              className="min-h-[32px] px-2 py-1 rounded bg-[#141e30] hover:bg-[#1f2e47] active:translate-y-[1px] border text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap"
              style={{
                borderColor: `${emote.accentColor}66`,
                color: emote.accentColor,
              }}
            >
              <span>{emote.shortTag}</span>
              <span className="hidden md:inline font-code text-[9px] text-slate-400">
                [{idx + 1}]
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* PAUSE MODAL CARD (Single Focused Modal per game_title_and_hud.md) */}
      {isPaused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Jeda Permainan"
          className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4 pointer-events-auto"
        >
          <div className="rpg-modal w-full max-w-md p-6 text-center">
            <h2 className="font-display text-base sm:text-lg text-amber-400 mb-2">
              PERMAINAN DIJEDA
            </h2>
            <p className="text-xs text-slate-300 mb-5">
              Room <span className="font-code text-amber-300">{roomCode}</span> · Level {level} · {modeTitle}
            </p>

            <div className="rpg-well grid grid-cols-3 gap-2 p-3.5 mb-6">
              <div>
                <div className="text-[11px] text-slate-400">Skor</div>
                <div className="font-code text-lg font-bold text-white tabular-nums">{score}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Kunci</div>
                <div className="font-code text-lg font-bold text-amber-400 tabular-nums">
                  {effectiveKeys}/{targetKeys}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Sisa Waktu</div>
                <div className="font-code text-lg font-bold text-emerald-400 tabular-nums">
                  {formatTimer(remainingSeconds)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onTogglePause();
                }}
                className="rpg-btn-gold w-full py-2.5 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Lanjutkan Permainan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onTeacherRestartGame();
                }}
                className="rpg-btn-slate w-full py-2.5 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Mulai Ulang Labirin</span>
              </button>
              <button
                type="button"
                data-testid="pause-end-game-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onTeacherEndGame();
                }}
                className="rpg-btn-slate w-full py-2.5 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2"
              >
                <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Selesaikan Sesi &amp; Lihat Hasil</span>
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className="rpg-btn-slate w-full py-2 text-slate-200 font-medium text-xs flex items-center justify-center gap-2"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>Audio: {muted ? 'Mati (Muted)' : 'Aktif'}</span>
              </button>
              <button
                type="button"
                data-testid="pause-leave-room-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onLeaveRoom();
                }}
                className="w-full py-2.5 rounded-md bg-red-950/90 hover:bg-red-900 text-red-100 border border-red-600/80 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Keluar ke Menu Utama</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER LIVE STUDENT ANALYTICS MODAL */}
      {showAnalyticsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Student Analytics"
          className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-3.5 sm:p-6 overflow-y-auto rpg-scroll pointer-events-auto"
        >
          <div className="rpg-modal w-full max-w-5xl p-4 sm:p-6 text-slate-100 space-y-4 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-sky-300">
                <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Student Analytics · Pemantauan Langsung Guru</span>
              </div>
              <button
                type="button"
                aria-label="Tutup Student Analytics"
                onClick={() => setShowAnalyticsModal(false)}
                className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <StudentAnalyticsPanel roomCode={roomCode} liveLeaderboard={leaderboard} />
          </div>
        </div>
      )}
    </div>
  );
};

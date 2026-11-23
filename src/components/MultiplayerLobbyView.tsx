import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Lock,
  LogOut,
  Maximize2,
  Play,
  QrCode,
  Shuffle,
  SlidersHorizontal,
  Tv,
  Unlock,
  Users,
} from 'lucide-react';
import {
  DifficultyLevel,
  GameMode,
  MAP_LEVELS,
  MATH_CATEGORIES,
  MathCategoryId,
  RoomSettings,
  TEAM_DEFINITIONS,
  TEAM_ORDER,
  TeamId,
} from '../shared/constants';
import { getMazeBiomeTheme, MAZE_BIOME_LIST } from '../shared/biomeThemes';
import { buildTeacherTransferUrl, isDevPreviewOrigin } from '../shared/roomJoinLink';
import { LeaderboardEntry } from '../shared/scoreSystem';
import { RenderPlayerState } from './MazeCanvasView';
import { QuestionBankManager } from './QuestionBankManager';
import { RoomJoinQrCode, RoomJoinQrModal, useEffectiveRoomJoinUrl } from './RoomJoinQrCode';
import { StudentAnalyticsPanel } from './StudentAnalyticsPanel';
import { getCharacterAvatarDataUrl } from '../game/assets/PixelArtSprites';
import { retroAudio } from '../game/audio/RetroAudio';

interface LoadTestMetrics {
  testedConnections: number;
  maxCapacity: number;
  rejected46thPlayer: boolean;
  metrics: {
    avgLatencyMs: number;
    cpuUsagePercent: number;
    ramUsageMB: number;
    heapUsedMB: number;
    messagesProcessed: number;
    bandwidthKBps: number;
    durationMs: number;
  };
}

interface MultiplayerLobbyViewProps {
  roomCode: string;
  teacherName: string;
  locked: boolean;
  settings: RoomSettings;
  customQuestionCount?: number;
  players: RenderPlayerState[];
  leaderboard?: LeaderboardEntry[];
  localPlayerId: string;
  localRole: 'teacher' | 'student';
  localReady: boolean;
  onToggleReady: () => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onToggleLockRoom: () => void;
  onAssignTeams: (mode: 'random' | 'manual', manualMap?: Record<string, TeamId>) => void;
  onStartGame: () => void;
  onOpenProjectorMode?: () => void;
  onLeaveLobby: () => void;
}

export const MultiplayerLobbyView: React.FC<MultiplayerLobbyViewProps> = ({
  roomCode,
  teacherName,
  locked,
  settings,
  customQuestionCount,
  players,
  leaderboard,
  localPlayerId,
  localRole,
  localReady,
  onToggleReady,
  onUpdateSettings,
  onToggleLockRoom,
  onAssignTeams,
  onStartGame,
  onOpenProjectorMode,
  onLeaveLobby,
}) => {
  const [activeLobbyTab, setActiveLobbyTab] = useState<'setup' | 'analytics'>('setup');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestResult, setLoadTestResult] = useState<LoadTestMetrics | null>(null);
  const [keepBotsInRoom, setKeepBotsInRoom] = useState(true);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isDevPreviewHost = isDevPreviewOrigin(currentOrigin);
  const { joinUrl: effectiveJoinUrl } = useEffectiveRoomJoinUrl(roomCode);
  const sharedTransferUrl = isDevPreviewHost
    ? buildTeacherTransferUrl(currentOrigin, {
        roomCode,
        teacherName,
        mode: settings.mode,
        difficulty: settings.difficulty,
        biome: settings.biome,
      })
    : '';

  const studentPlayers = players.filter((p) => p.role === 'student');
  const activeTeams = TEAM_ORDER.slice(0, settings.teamCount);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard?.writeText(effectiveJoinUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDifficultyChange = (diff: DifficultyLevel) => {
    const defaultCatsForDiff = MATH_CATEGORIES.filter((c) => c.difficulty === diff).map((c) => c.id);
    onUpdateSettings({
      difficulty: diff,
      categories: defaultCatsForDiff,
    });
  };

  const handleToggleCategory = (catId: MathCategoryId) => {
    const exists = settings.categories.includes(catId);
    let next = exists
      ? settings.categories.filter((c) => c !== catId)
      : [...settings.categories, catId];
    if (next.length === 0) {
      next = [catId];
    }
    onUpdateSettings({ categories: next });
  };

  const runSocketLoadTest = async (count: number) => {
    setLoadTestRunning(true);
    try {
      const resp = await fetch('/api/load-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          playerCount: count,
          keepInRoom: keepBotsInRoom,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setLoadTestResult(data);
      }
    } catch (e) {
      console.error('Load test error:', e);
    } finally {
      setLoadTestRunning(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#090D15] text-slate-100 p-3.5 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        {isDevPreviewHost && localRole === 'teacher' && (
          <div className="rounded-md bg-amber-950/85 border border-amber-400/80 p-3.5 sm:p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Scan QR di HP Memerlukan Shared App URL atau Aplikasi Ter-Deploy
              </div>
              <p className="text-amber-100/90 leading-relaxed">
                Anda sedang berada di <strong>Preview Editor (ais-dev)</strong> yang akan menampilkan{' '}
                <strong>404</strong> jika di-scan langsung dari HP. Agar QR Code bisa di-scan siswa pada
                versi game terbaru, klik <strong>Share</strong> / <strong>Deploy</strong> di kanan atas
                terlebih dahulu untuk memperbarui <strong>Shared App URL (ais-pre)</strong>, lalu buka
                room <strong className="font-code">{roomCode}</strong> lewat tombol di kanan.
              </p>
            </div>
            <a
              href={sharedTransferUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rpg-btn-gold min-h-[40px] px-4 py-2 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Buka Room di Shared URL</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* Lobby Header Command Bar */}
        <header className="rpg-panel p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-amber-300">
                <span>Lobby Kelas Multiplayer</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-slate-300">Guru: {teacherName}</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className={locked ? 'text-red-300' : 'text-emerald-400'}>
                  {locked ? 'Room Terkunci' : 'Terbuka untuk Siswa'}
                </span>
              </div>

              <h1 className="text-xl sm:text-3xl font-bold tracking-wide text-white whitespace-nowrap leading-none">
                Kode:{' '}
                <span className="font-code text-amber-400 tracking-wider" data-testid="lobby-room-code">
                  {roomCode}
                </span>
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rpg-btn-slate min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kode Disalin' : 'Salin Kode'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="min-h-[36px] px-3 py-1.5 rounded-md bg-sky-950/90 hover:bg-sky-900 border border-sky-400/70 text-xs font-medium text-sky-100 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  <span>{copiedLink ? 'Link Disalin' : 'Salin Link'}</span>
                </button>
                {localRole === 'teacher' && (
                  <button
                    type="button"
                    data-testid="lobby-qr-enlarge-btn"
                    onClick={() => {
                      retroAudio.playButtonClick();
                      setShowQrModal(true);
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-md bg-amber-950/80 hover:bg-amber-900/90 border border-amber-400/70 text-xs font-semibold text-amber-200 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                    <span>Perbesar QR</span>
                  </button>
                )}
              </div>
            </div>

            {localRole === 'teacher' && (
              <button
                type="button"
                data-testid="lobby-qr-tile-btn"
                aria-label={`Scan atau perbesar QR Code room ${roomCode}`}
                title="Klik untuk memperbesar QR Code agar mudah di-scan siswa"
                onClick={() => {
                  retroAudio.playButtonClick();
                  setShowQrModal(true);
                }}
                className="group shrink-0 rounded-lg bg-[#0b101b] hover:bg-[#131b2b] border border-amber-400/75 hover:border-amber-300 p-1.5 flex items-center gap-2.5 text-left transition-colors"
              >
                <div className="p-1 rounded-md bg-white shadow-sm shrink-0">
                  <RoomJoinQrCode
                    roomCode={roomCode}
                    sizePx={72}
                    testId="lobby-room-qr-img"
                  />
                </div>
                <div className="hidden xl:flex flex-col justify-center pr-1.5 max-w-[104px]">
                  <span className="text-[11px] font-bold text-amber-300 leading-tight flex items-center gap-1">
                    <span>Scan QR</span>
                    <Maximize2 className="w-3 h-3 opacity-80 group-hover:scale-110 transition-transform" aria-hidden="true" />
                  </span>
                  <span className="text-[10px] text-slate-300 leading-snug mt-0.5">
                    Kamera HP / tablet langsung masuk
                  </span>
                </div>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-stretch sm:items-center gap-2.5">
            <div className="rpg-well px-3.5 py-2 text-left sm:text-right flex-1 sm:flex-initial">
              <div className="text-[11px] text-slate-400 font-medium">Kapasitas Kelas</div>
              <div
                data-testid="lobby-player-count"
                className="font-code text-base sm:text-lg font-bold text-emerald-400 tabular-nums"
              >
                {studentPlayers.length} / {settings.maxPlayers} Siswa
              </div>
            </div>

            {localRole === 'teacher' ? (
              <>
                {onOpenProjectorMode && (
                  <button
                    type="button"
                    data-testid="lobby-projector-mode-btn"
                    title="Tampilkan Layar Proyektor / TV Kelas"
                    onClick={() => {
                      retroAudio.playButtonClick();
                      onOpenProjectorMode();
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-md font-semibold text-xs border bg-sky-950/90 hover:bg-sky-900 border-sky-400/70 text-sky-100 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Tv className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden="true" />
                    <span>Mode TV Kelas</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onToggleLockRoom();
                  }}
                  className={`min-h-[44px] px-3.5 py-2 rounded-md font-semibold text-xs border flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                    locked
                      ? 'bg-red-950/90 border-red-400 text-red-100'
                      : 'rpg-btn-slate text-slate-200'
                  }`}
                >
                  {locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{locked ? 'Buka Kunci' : 'Kunci Room'}</span>
                </button>

                <button
                  type="button"
                  data-testid="teacher-start-game-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onStartGame();
                  }}
                  className="rpg-btn-gold w-full sm:w-auto min-h-[46px] px-5 py-2.5 font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  <span>Mulai Permainan Sekarang</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="student-ready-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onToggleReady();
                }}
                className={`w-full sm:w-auto min-h-[46px] px-5 py-2.5 font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap ${
                  localReady ? 'rpg-btn-emerald' : 'rpg-btn-slate text-white'
                }`}
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{localReady ? 'Status: Siap Bermain' : 'Klik Untuk Siap (Ready)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLeaveLobby}
              className="rpg-btn-slate min-h-[44px] px-3.5 py-2 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Teacher View Navigation Tabs: Room Setup vs Student Analytics */}
        <nav
          aria-label="Navigasi Panel Guru"
          className="rpg-panel p-2 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="teacher-setup-tab"
              aria-selected={activeLobbyTab === 'setup'}
              onClick={() => {
                retroAudio.playButtonClick();
                setActiveLobbyTab('setup');
              }}
              className={`min-h-[40px] px-4 py-2 rounded-md text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
                activeLobbyTab === 'setup'
                  ? 'bg-amber-400 text-slate-950 shadow-[0_2px_0_#92400E]'
                  : 'bg-[#0b101b] text-slate-300 hover:text-white border border-slate-700/80'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Pengaturan &amp; Daftar Siswa</span>
            </button>

            <button
              type="button"
              data-testid="teacher-analytics-tab"
              aria-selected={activeLobbyTab === 'analytics'}
              onClick={() => {
                retroAudio.playButtonClick();
                setActiveLobbyTab('analytics');
              }}
              className={`min-h-[40px] px-4 py-2 rounded-md text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
                activeLobbyTab === 'analytics'
                  ? 'bg-sky-400 text-slate-950 shadow-[0_2px_0_#0369A1]'
                  : 'bg-[#0b101b] text-sky-200 hover:text-white border border-sky-500/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Student Analytics</span>
              <span className="font-code text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 border border-amber-400/40">
                Learning Gaps
              </span>
            </button>
          </div>

          <span className="hidden md:inline text-xs text-slate-400 px-2">
            Pantau waktu respons rata-rata &amp; topik kesalahan matematika siswa dengan grafik interaktif
          </span>
        </nav>

        {activeLobbyTab === 'analytics' ? (
          <StudentAnalyticsPanel roomCode={roomCode} liveLeaderboard={leaderboard} />
        ) : (
        /* Main 2-Column Content Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* LEFT COLUMN: Configuration, Custom Question Bank & Load Test */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            <section className="rpg-panel p-4 sm:p-5 space-y-5">
              <div className="border-b border-slate-700/70 pb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Pengaturan Mode & Kurikulum Matematika</span>
                </h2>
                <span className="text-xs text-slate-400">
                  {localRole === 'teacher' ? 'Kontrol Penuh Guru' : 'Dikonfigurasi oleh Guru'}
                </span>
              </div>

              {/* Game Mode Selector */}
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-2">
                  Mode Permainan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'coop',
                        title: 'Co-op Adventure',
                        desc: 'Seluruh kelas bekerja sama mengumpulkan kunci & membuka pintu keluar bersama.',
                      },
                      {
                        id: 'competitive',
                        title: 'Class Competition',
                        desc: 'Setiap siswa bersaing mengumpulkan kunci dan mencetak skor tertinggi.',
                      },
                      {
                        id: 'team',
                        title: 'Team Battle',
                        desc: 'Maksimal 5 tim (hingga 9 siswa/tim) berlomba mengumpulkan kunci tim.',
                      },
                    ] as const
                  ).map((m) => {
                    const active = settings.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={active}
                        disabled={localRole !== 'teacher'}
                        onClick={() => onUpdateSettings({ mode: m.id as GameMode })}
                        className={`rounded-md p-3 text-left border transition-colors ${
                          active
                            ? 'bg-amber-500/16 border-amber-400 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500 disabled:opacity-75'
                        }`}
                      >
                        <div
                          className={`text-xs sm:text-sm font-bold mb-1 ${
                            active ? 'text-amber-300' : 'text-slate-100'
                          }`}
                        >
                          {m.title}
                        </div>
                        <p className="text-xs text-slate-400 leading-snug">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty Tier Selector */}
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-2">
                  Tingkat Kesulitan Soal
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'easy', label: 'Mudah', sub: 'Tambah, Kurang, Kali, Bagi' },
                      { id: 'medium', label: 'Sedang', sub: 'Pecahan, Persen, Negatif, Akar' },
                      { id: 'hard', label: 'Sulit', sub: 'Aljabar, Persamaan Linear, Logika' },
                    ] as const
                  ).map((d) => {
                    const active = settings.difficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={active}
                        disabled={localRole !== 'teacher'}
                        onClick={() => handleDifficultyChange(d.id)}
                        className={`rounded-md min-h-[52px] p-2.5 text-left border transition-colors ${
                          active
                            ? 'bg-sky-500/18 border-sky-400 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500 disabled:opacity-75'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-bold">{d.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{d.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Maze Biome Theme Selector */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Tema Bioma Labirin
                  </span>
                  <span
                    data-testid="lobby-active-biome-label"
                    className="text-xs font-semibold"
                    style={{ color: getMazeBiomeTheme(settings.biome).accentHex }}
                  >
                    {getMazeBiomeTheme(settings.biome).name}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MAZE_BIOME_LIST.map((b) => {
                    const active = (settings.biome ?? 'stone_dungeon') === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`lobby-biome-btn-${b.id}`}
                        aria-pressed={active}
                        disabled={localRole !== 'teacher'}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onUpdateSettings({ biome: b.id });
                        }}
                        className={`rounded-md p-2.5 text-left border transition-colors ${
                          active
                            ? 'bg-slate-800/95 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500 disabled:opacity-75'
                        }`}
                        style={active ? { borderColor: b.accentHex } : undefined}
                      >
                        <div className="flex items-center gap-1 mb-2" aria-hidden="true">
                          {b.swatchColors.map((hex, idx) => (
                            <span
                              key={idx}
                              className="h-2.5 flex-1 rounded-[2px] border border-black/35"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <div className="text-xs font-bold leading-tight">{b.name}</div>
                        <div className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                          {b.tagline}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Math Categories Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Kategori Materi Matematika Aktif
                  </span>
                  <span className="font-code text-xs text-amber-300 tabular-nums">
                    {settings.categories.length} dipilih
                  </span>
                </div>
                <div className="rpg-well grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 max-h-56 overflow-y-auto rpg-scroll">
                  {MATH_CATEGORIES.map((cat) => {
                    const checked = settings.categories.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`rounded flex items-start gap-2 p-2 text-xs cursor-pointer border transition-colors ${
                          checked
                            ? 'bg-[#182236] border-amber-400/60 text-white'
                            : 'border-transparent text-slate-400 hover:bg-[#131b2b]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={localRole !== 'teacher'}
                          checked={checked}
                          onChange={() => handleToggleCategory(cat.id)}
                          className="mt-0.5 accent-amber-400"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold leading-tight">{cat.name}</div>
                          <div className="font-code text-[10px] text-slate-400 mt-0.5 truncate">
                            {cat.sample}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Numeric Game Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 pt-1">
                <div>
                  <label htmlFor="select-map-level" className="block text-[11px] font-medium text-slate-400 mb-1">
                    Ukuran Labirin
                  </label>
                  <select
                    id="select-map-level"
                    disabled={localRole !== 'teacher'}
                    value={settings.mapLevel}
                    onChange={(e) => onUpdateSettings({ mapLevel: Number(e.target.value) })}
                    className="rpg-well w-full min-h-[40px] px-2.5 py-2 text-xs font-medium text-white outline-none focus:border-amber-400"
                  >
                    {Object.values(MAP_LEVELS).map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        Lvl {lvl.level} · {lvl.size}×{lvl.size}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="select-key-count" className="block text-[11px] font-medium text-slate-400 mb-1">
                    Jumlah Kunci
                  </label>
                  <select
                    id="select-key-count"
                    disabled={localRole !== 'teacher'}
                    value={settings.keyCount}
                    onChange={(e) => onUpdateSettings({ keyCount: Number(e.target.value) })}
                    className="rpg-well w-full min-h-[40px] px-2.5 py-2 text-xs font-medium text-white outline-none focus:border-amber-400"
                  >
                    {[3, 5, 7, 10, 12, 15].map((k) => (
                      <option key={k} value={k}>
                        {k} Kunci
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="select-lives" className="block text-[11px] font-medium text-slate-400 mb-1">
                    Nyawa Pemain
                  </label>
                  <select
                    id="select-lives"
                    disabled={localRole !== 'teacher'}
                    value={settings.lives}
                    onChange={(e) => onUpdateSettings({ lives: Number(e.target.value) })}
                    className="rpg-well w-full min-h-[40px] px-2.5 py-2 text-xs font-medium text-white outline-none focus:border-amber-400"
                  >
                    {[1, 2, 3, 4, 5].map((lv) => (
                      <option key={lv} value={lv}>
                        {lv} Nyawa
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="select-duration" className="block text-[11px] font-medium text-slate-400 mb-1">
                    Durasi Game
                  </label>
                  <select
                    id="select-duration"
                    disabled={localRole !== 'teacher'}
                    value={settings.durationSeconds}
                    onChange={(e) => onUpdateSettings({ durationSeconds: Number(e.target.value) })}
                    className="rpg-well w-full min-h-[40px] px-2.5 py-2 text-xs font-medium text-white outline-none focus:border-amber-400"
                  >
                    <option value={180}>3 Menit</option>
                    <option value={300}>5 Menit</option>
                    <option value={480}>8 Menit</option>
                    <option value={600}>10 Menit</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="select-q-timer" className="block text-[11px] font-medium text-slate-400 mb-1">
                    Waktu / Soal
                  </label>
                  <select
                    id="select-q-timer"
                    disabled={localRole !== 'teacher'}
                    value={settings.questionTimerSeconds}
                    onChange={(e) =>
                      onUpdateSettings({ questionTimerSeconds: Number(e.target.value) })
                    }
                    className="rpg-well w-full min-h-[40px] px-2.5 py-2 text-xs font-medium text-white outline-none focus:border-amber-400"
                  >
                    {[15, 25, 35, 45, 60].map((sec) => (
                      <option key={sec} value={sec}>
                        {sec} Detik
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Team Battle Settings when mode === 'team' */}
              {settings.mode === 'team' && (
                <div className="rpg-well p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-amber-300">
                        Manajemen Tim (Maks 5 Tim · Hingga 9 Siswa/Tim)
                      </div>
                      <div className="text-xs text-slate-400">
                        Setiap anggota tim tampil dengan warna jubah timnya di labirin.
                      </div>
                    </div>
                    {localRole === 'teacher' && (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Jumlah Tim"
                          value={settings.teamCount}
                          onChange={(e) => onUpdateSettings({ teamCount: Number(e.target.value) })}
                          className="rounded-md bg-[#131b2b] border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-white"
                        >
                          {[2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} Tim Aktif
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onAssignTeams('random')}
                          className="px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Acak Tim</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {activeTeams.map((tid) => {
                      const def = TEAM_DEFINITIONS[tid];
                      const count = studentPlayers.filter((p) => p.teamId === tid).length;
                      return (
                        <div
                          key={tid}
                          className="rounded p-2.5 border border-slate-800 bg-[#131b2b] text-xs"
                        >
                          <div className="font-bold" style={{ color: def.color }}>
                            {def.name}
                          </div>
                          <div className="font-code text-[11px] text-slate-400 tabular-nums mt-0.5">
                            {count}/9 Siswa
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Custom Question Bank Manager */}
            <QuestionBankManager
              localRole={localRole}
              questionSource={settings.questionSource}
              customQuestions={settings.customQuestions ?? []}
              studentVisibleCount={customQuestionCount}
              onChangeQuestionSource={(source) => onUpdateSettings({ questionSource: source })}
              onUpdateCustomQuestions={(questions, nextSource) =>
                onUpdateSettings({
                  customQuestions: questions,
                  ...(nextSource ? { questionSource: nextSource } : {}),
                })
              }
            />

            {/* Real 45-Player Socket.IO Load Testing Panel */}
            {localRole === 'teacher' && (
              <section className="rpg-panel p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-sky-300 flex items-center gap-2">
                      <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Simulasi Beban Kelas (Hingga 45 Siswa)</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Buka koneksi WebSocket nyata untuk menguji sinkronisasi pemain secara simultan.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={keepBotsInRoom}
                      onChange={(e) => setKeepBotsInRoom(e.target.checked)}
                      className="accent-sky-400 w-4 h-4"
                    />
                    <span>Sertakan Siswa Simulasi</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                  {[2, 10, 25, 45].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={loadTestRunning}
                      data-testid={`load-test-btn-${cnt}`}
                      onClick={() => runSocketLoadTest(cnt)}
                      className="rpg-btn-slate min-h-[40px] px-3.5 py-2 disabled:opacity-50 border-sky-400/40 text-xs font-semibold text-sky-200 whitespace-nowrap"
                    >
                      {loadTestRunning ? 'Menguji...' : `Uji ${cnt} Koneksi`}
                    </button>
                  ))}
                </div>

                {loadTestResult && (
                  <div
                    data-testid="load-test-metrics"
                    className="rpg-well border-emerald-500/50 p-3.5 text-xs space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-emerald-300 font-bold">
                      <span>
                        Hasil Uji Beban: {loadTestResult.testedConnections}/{loadTestResult.maxCapacity} Koneksi Aktif
                      </span>
                      <span>
                        Tolak Pemain Ke-46: {loadTestResult.rejected46thPlayer ? 'Terverifikasi' : 'Siap'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-slate-300 font-code tabular-nums">
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">Latensi Rata-rata</span>
                        <span className="font-bold text-white">{loadTestResult.metrics.avgLatencyMs} ms</span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">CPU Server</span>
                        <span className="font-bold text-white">{loadTestResult.metrics.cpuUsagePercent}%</span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">RAM Server</span>
                        <span className="font-bold text-white">{loadTestResult.metrics.ramUsageMB} MB</span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">Bandwidth</span>
                        <span className="font-bold text-white">{loadTestResult.metrics.bandwidthKBps} KB/s</span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">Paket Posisi</span>
                        <span className="font-bold text-white">{loadTestResult.metrics.messagesProcessed} pkt</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Connected Classroom Students Roster */}
          <aside className="lg:col-span-5 rpg-panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Daftar Siswa ({studentPlayers.length}/45)</span>
              </h2>
              <span className="font-code text-xs font-semibold text-emerald-400 tabular-nums">
                {studentPlayers.filter((p) => p.ready).length} Siap
              </span>
            </div>

            {studentPlayers.length === 0 ? (
              <div className="rpg-well p-6 sm:p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-200">Belum ada siswa yang bergabung.</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bagikan kode <strong className="font-code text-amber-300">{roomCode}</strong> kepada siswa,
                  atau langsung tekan <strong>Mulai Permainan Sekarang</strong> untuk mencoba solo.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1 rpg-scroll">
                {studentPlayers.map((student, idx) => (
                  <div
                    key={student.id}
                    className={`rpg-well flex items-center justify-between p-2.5 text-xs ${
                      student.id === localPlayerId ? 'border-sky-400/80' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-code text-slate-500 w-5 tabular-nums">{idx + 1}.</span>
                      <img
                        src={getCharacterAvatarDataUrl(student.characterId, student.outfitColor)}
                        alt={student.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded border border-slate-700 bg-[#131b2b] shrink-0"
                      />
                      <div className="truncate">
                        <div className="font-semibold text-sm text-white truncate">
                          {student.name} {student.id === localPlayerId ? '(Anda)' : ''}
                        </div>
                        <div className={`text-[11px] ${student.ready ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {student.ready ? 'Siap bermain' : 'Menunggu'}
                        </div>
                      </div>
                    </div>

                    {settings.mode === 'team' && (
                      <div className="shrink-0 ml-2">
                        {localRole === 'teacher' ? (
                          <select
                            aria-label={`Pilih tim untuk ${student.name}`}
                            value={student.teamId ?? 'red'}
                            onChange={(e) =>
                              onAssignTeams('manual', { [student.id]: e.target.value as TeamId })
                            }
                            className="rounded bg-[#131b2b] border border-slate-700 px-2 py-1 text-xs text-white"
                          >
                            {activeTeams.map((tid) => (
                              <option key={tid} value={tid}>
                                {TEAM_DEFINITIONS[tid].name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          student.teamId && (
                            <span
                              style={{ color: TEAM_DEFINITIONS[student.teamId].color }}
                              className="font-bold text-xs"
                            >
                              {TEAM_DEFINITIONS[student.teamId].name}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
        )}
      </div>

      {localRole === 'teacher' && (
        <RoomJoinQrModal
          open={showQrModal}
          roomCode={roomCode}
          teacherName={teacherName}
          sharedTransferUrl={sharedTransferUrl || undefined}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};

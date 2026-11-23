import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Info,
  KeyRound,
  Play,
  QrCode,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CHARACTER_PRESETS,
  DifficultyLevel,
  GameMode,
  MATH_CATEGORIES,
  MazeBiomeId,
  OUTFIT_COLORS,
  TileType,
} from '../shared/constants';
import { getMazeBiomeTheme, MAZE_BIOME_LIST } from '../shared/biomeThemes';
import { generateProceduralMaze } from '../shared/mazeGenerator';
import {
  getCharacterAvatarDataUrl,
  getCharacterSprite,
  getKeySprite,
  getTileSprite,
} from '../game/assets/PixelArtSprites';
import { StudentAnalyticsPanel } from './StudentAnalyticsPanel';
import { retroAudio } from '../game/audio/RetroAudio';

interface AnalyticsData {
  databaseEngine: string;
  gameHistory: {
    id: string;
    roomCode: string;
    teacherName: string;
    mode: GameMode;
    difficulty: DifficultyLevel;
    playerCount: number;
    durationSeconds: number;
    completedAt: string;
    summaryText: string;
  }[];
  categoryStats: {
    category: string;
    attempts: number;
    correct: number;
    wrong: number;
  }[];
  topStudents: {
    id: string;
    name: string;
    characterId: string;
    outfitColor: string;
    gamesPlayed: number;
    totalScore: number;
    totalKeys: number;
  }[];
}

interface TitleMenuScreenProps {
  playerName: string;
  characterId: string;
  outfitColor: string;
  selectedMode: GameMode;
  selectedDifficulty: DifficultyLevel;
  selectedBiome: MazeBiomeId;
  roomCodeInput: string;
  invitedRoomCode?: string | null;
  errorMessage: string | null;
  muted: boolean;
  volume: number;
  onChangeName: (name: string) => void;
  onChangeCharacter: (id: string, defaultColor: string) => void;
  onChangeOutfitColor: (hex: string) => void;
  onChangeMode: (mode: GameMode) => void;
  onChangeDifficulty: (diff: DifficultyLevel) => void;
  onChangeBiome: (biome: MazeBiomeId) => void;
  onChangeRoomCodeInput: (code: string) => void;
  onStartQuickPlay: () => void;
  onJoinRoomAsStudent: (overrideCode?: string) => void;
  onCreateRoomAsTeacher: () => void;
  onToggleMute: () => void;
  onChangeVolume: (vol: number) => void;
}

interface ActiveRoomSummary {
  code: string;
  teacherName: string;
  locked: boolean;
  status: string;
  mode: GameMode;
  studentCount: number;
  maxPlayers: number;
}

export const TitleMenuScreen: React.FC<TitleMenuScreenProps> = ({
  playerName,
  characterId,
  outfitColor,
  selectedMode,
  selectedDifficulty,
  selectedBiome,
  roomCodeInput,
  invitedRoomCode,
  errorMessage,
  muted,
  volume,
  onChangeName,
  onChangeCharacter,
  onChangeOutfitColor,
  onChangeMode,
  onChangeDifficulty,
  onChangeBiome,
  onChangeRoomCodeInput,
  onStartQuickPlay,
  onJoinRoomAsStudent,
  onCreateRoomAsTeacher,
  onToggleMute,
  onChangeVolume,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedBiomeRef = useRef<MazeBiomeId>(selectedBiome);
  selectedBiomeRef.current = selectedBiome;
  const [activeModal, setActiveModal] = useState<'none' | 'howto' | 'settings' | 'history' | 'credits'>('none');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);

  const fetchActiveRooms = async () => {
    try {
      const r = await fetch('/api/rooms');
      const data = await r.json();
      if (Array.isArray(data?.rooms)) {
        setActiveRooms(data.rooms.filter((rm: ActiveRoomSummary) => rm.status !== 'ended'));
      }
    } catch {
      // Ignore network hiccup
    }
  };

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  useEffect(() => {
    if (activeModal === 'none') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveModal('none');
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [activeModal]);

  // Live Pixel Art Dungeon Camera Tour on the Title Screen background
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const demoMaze = generateProceduralMaze({ level: 1, keyCount: 6, seed: 4821 });
    let rafId = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const renderBg = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const bgBiome = selectedBiomeRef.current;
      const bgTheme = getMazeBiomeTheme(bgBiome);

      ctx.fillStyle = bgTheme.voidBgHex;
      ctx.fillRect(0, 0, w, h);

      const zoom = 2;
      const camX = 400 + Math.sin(now / 5000) * 180;
      const camY = 400 + Math.cos(now / 6000) * 180;
      const frame = Math.floor(now / 200) % 4;

      ctx.save();
      ctx.translate(Math.floor(w / 2 - camX * zoom), Math.floor(h / 2 - camY * zoom));
      ctx.scale(zoom, zoom);

      for (let y = 0; y < demoMaze.height; y++) {
        for (let x = 0; x < demoMaze.width; x++) {
          const tile = demoMaze.grid[y][x];
          const sprite = getTileSprite(tile, frame, (x * 7 + y * 13) & 3, bgBiome);
          ctx.drawImage(sprite, x * 32, y * 32, 32, 32);
          if (tile === TileType.TORCH_WALL) {
            const grad = ctx.createRadialGradient(
              x * 32 + 16,
              y * 32 + 16,
              2,
              x * 32 + 16,
              y * 32 + 16,
              36
            );
            grad.addColorStop(0, bgTheme.torchGlowRgbaStart);
            grad.addColorStop(1, bgTheme.torchGlowRgbaEnd);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x * 32 + 16, y * 32 + 16, 36, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (const k of demoMaze.keys) {
        const ks = getKeySprite(k.type, frame);
        ctx.drawImage(ks, k.x - 16, k.y - 16, 32, 32);
      }

      CHARACTER_PRESETS.slice(0, 4).forEach((preset, idx) => {
        const px = (3 + idx * 4) * 32 + Math.sin(now / 900 + idx) * 20;
        const py = (3 + idx * 4) * 32;
        const sp = getCharacterSprite({
          characterId: preset.id,
          outfitColor: preset.primaryColor,
          direction: Math.cos(now / 900 + idx) >= 0 ? 'right' : 'left',
          animState: 'walk',
          frame,
        });
        ctx.drawImage(sp, Math.round(px - 16), Math.round(py - 16), 32, 32);
      });

      ctx.restore();

      // Atmospheric dark radial vignette + obsidian scrim for crisp readability
      const vig = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.15,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.78
      );
      vig.addColorStop(0, 'rgba(9, 13, 21, 0.72)');
      vig.addColorStop(1, 'rgba(5, 8, 15, 0.90)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      rafId = requestAnimationFrame(renderBg);
    };

    rafId = requestAnimationFrame(renderBg);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const openHistoryModal = async () => {
    setActiveModal('history');
    try {
      const r = await fetch('/api/analytics');
      const data = await r.json();
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const selectedPreset =
    CHARACTER_PRESETS.find((c) => c.id === characterId) ?? CHARACTER_PRESETS[0];

  return (
    <div className="relative min-h-[100dvh] w-full text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Animated Pixel Art Dungeon Background */}
      <canvas
        ref={bgCanvasRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Main Centered RPG Stage */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-7 my-auto">
        {/* Game Emblem Title Lockup & Quick Utility Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 sm:pb-5 mb-4 sm:mb-5 border-b border-slate-700/70">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Custom Inline SVG Pixel Shield & Golden Key Crest */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-md border-2 border-amber-400/90 bg-[#0d1422] p-1 shadow-[0_6px_20px_rgba(245,158,11,0.22)] flex items-center justify-center">
              <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
                <rect x="6" y="6" width="52" height="52" rx="4" fill="#131B2B" stroke="#F59E0B" strokeWidth="3" />
                <rect x="12" y="12" width="40" height="40" fill="#090D15" />
                <circle cx="23" cy="32" r="8" fill="#FBBF24" />
                <circle cx="23" cy="32" r="3" fill="#090D15" />
                <rect x="31" y="29" width="19" height="6" fill="#FBBF24" />
                <rect x="39" y="35" width="4" height="6" fill="#FBBF24" />
                <rect x="45" y="35" width="4" height="9" fill="#FBBF24" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-amber-300/90 tracking-wide mb-1.5">
                Petualangan Labirin Matematika · Hingga 45 Siswa
              </p>
              <h1 className="font-display text-sm sm:text-2xl lg:text-[26px] text-white leading-snug tracking-tight drop-shadow-[0_3px_0_#05080F] [text-wrap:balance]">
                MATH MAZE
                <span className="block sm:inline sm:ml-2.5 mt-1 sm:mt-0 text-amber-400 text-xs sm:text-lg lg:text-xl font-sans font-extrabold tracking-normal">
                  Quest for the Keys
                </span>
              </h1>
            </div>
          </div>

          {/* Utility Actions (Clean RPG Slate Tabs, Single-Line) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                setActiveModal('howto');
              }}
              className="rpg-btn-slate min-h-[40px] px-3 py-2 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
              <span>Cara Bermain</span>
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                openHistoryModal();
              }}
              className="rpg-btn-slate min-h-[40px] px-3 py-2 text-xs font-semibold text-sky-200 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span>Riwayat Kelas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                setActiveModal('settings');
              }}
              className="rpg-btn-slate min-h-[40px] px-3 py-2 text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              )}
              <span>Audio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playButtonClick();
                setActiveModal('credits');
              }}
              className="rpg-btn-slate min-h-[40px] px-3 py-2 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Tentang</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-md px-4 py-3 bg-red-950/90 border border-red-400/80 text-red-100 text-sm font-medium flex items-center gap-2.5 shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Two-Column Interactive Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {/* LEFT COLUMN: Adventurer Identity & Hero Roster */}
          <section className="lg:col-span-5 rpg-panel p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/70">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Identitas Petualang</span>
                </h2>
                <span className="text-xs font-medium text-slate-400 shrink-0">8 Hero Pixel</span>
              </div>

              <div>
                <label
                  htmlFor="player-name-input"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Nama Siswa atau Guru
                </label>
                <input
                  id="player-name-input"
                  type="text"
                  value={playerName}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Masukkan nama Anda..."
                  maxLength={28}
                  className="rpg-well w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm font-medium text-white placeholder:text-slate-500 focus:border-amber-400 outline-none transition-colors"
                />
              </div>

              {/* 8 Pixel Art Heroes Grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">Pilih Karakter</span>
                  <span className="text-xs text-amber-300 font-semibold">{selectedPreset.title}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {CHARACTER_PRESETS.map((preset) => {
                    const isSelected = characterId === preset.id;
                    const previewColor = isSelected ? outfitColor : preset.primaryColor;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onChangeCharacter(preset.id, preset.primaryColor);
                        }}
                        className={`rounded-md p-2 min-h-[78px] border flex flex-col items-center justify-center text-center transition-all ${
                          isSelected
                            ? 'bg-amber-500/18 border-amber-400 text-white shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-400 hover:border-slate-500 hover:bg-[#111827]'
                        }`}
                      >
                        <img
                          src={getCharacterAvatarDataUrl(preset.id, previewColor)}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
                        />
                        <span className="text-[11px] font-bold text-slate-100 leading-tight truncate w-full">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outfit Color Swatches */}
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-2">
                  Warna Jubah Petualang
                </span>
                <div className="grid grid-cols-8 sm:flex sm:flex-wrap gap-2">
                  {OUTFIT_COLORS.map((c) => {
                    const active = outfitColor === c.hex;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-label={`Warna ${c.name}`}
                        aria-pressed={active}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onChangeOutfitColor(c.hex);
                        }}
                        style={{ backgroundColor: c.hex }}
                        className={`h-8 sm:w-8 sm:h-8 rounded-md border-2 transition-transform ${
                          active
                            ? 'border-white scale-110 shadow-[0_0_0_2px_rgba(251,191,36,0.75)]'
                            : 'border-slate-900/90 opacity-85 hover:opacity-100 hover:scale-105'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Character Preview Pedestal */}
            <div className="rpg-well p-3 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-md border-2 border-amber-400/80 bg-[#131b2b] shadow-[inset_0_0_12px_rgba(250,204,21,0.18)] flex items-center justify-center shrink-0">
                <img
                  src={getCharacterAvatarDataUrl(characterId, outfitColor)}
                  alt={playerName || 'Petualang'}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 drop-shadow-[0_3px_4px_rgba(0,0,0,0.8)]"
                />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate">
                  {playerName.trim() || 'Petualang'}
                </div>
                <div className="text-xs text-amber-300 font-semibold leading-snug">
                  {selectedPreset.name} · {selectedPreset.title}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Siap mengumpulkan kunci di labirin
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Game Mode, Quick Play & Classroom Join/Host */}
          <section className="lg:col-span-7 rpg-panel p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700/70">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Mode & Ruang Kelas</span>
                </h2>
                <span className="text-xs font-medium text-emerald-400 shrink-0">
                  Multiplayer Real-Time · Siap
                </span>
              </div>

              {invitedRoomCode && (
                <div
                  data-testid="qr-invited-join-banner"
                  className="rounded-md bg-gradient-to-r from-sky-500/20 via-sky-950/60 to-[#0b101b] border border-sky-400/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-sky-500/20 border border-sky-400/60 flex items-center justify-center shrink-0 mt-0.5">
                      <QrCode className="w-5 h-5 text-sky-300" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-sky-300">
                        Scan QR Terdeteksi · Tanpa Ketik Kode
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                        Undangan Room{' '}
                        <span className="font-code text-amber-300 tracking-wider">
                          {invitedRoomCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                        Pastikan nama & karakter di kiri sudah sesuai, lalu ketuk untuk langsung masuk ke lobby.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="qr-invited-join-btn"
                    onClick={() => {
                      retroAudio.playButtonClick();
                      onJoinRoomAsStudent(invitedRoomCode);
                    }}
                    className="min-h-[46px] px-4 py-2.5 rounded-md bg-sky-400 hover:bg-sky-300 active:translate-y-[1px] text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Gabung {invitedRoomCode}</span>
                  </button>
                </div>
              )}

              {/* 3 Game Modes */}
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
                        sub: 'Kerja sama kelas mengumpulkan kunci bersama',
                      },
                      {
                        id: 'competitive',
                        title: 'Class Competition',
                        sub: 'Beradu cepat & skor tertinggi individu',
                      },
                      {
                        id: 'team',
                        title: 'Team Battle',
                        sub: 'Hingga 5 tim (9 siswa per tim) berlomba',
                      },
                    ] as const
                  ).map((m) => {
                    const active = selectedMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onChangeMode(m.id);
                        }}
                        className={`rounded-md p-3 min-h-[60px] text-left border transition-colors ${
                          active
                            ? 'bg-amber-500/16 border-amber-400 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            active ? 'text-amber-300' : 'text-slate-100'
                          }`}
                        >
                          {m.title}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 leading-snug">{m.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty Segmented Bar */}
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-2">
                  Tingkat Kesulitan Soal
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'easy', label: 'Mudah', desc: 'Operasi Dasar' },
                      { id: 'medium', label: 'Sedang', desc: 'Pecahan & Akar' },
                      { id: 'hard', label: 'Sulit', desc: 'Aljabar & Logika' },
                    ] as const
                  ).map((d) => {
                    const active = selectedDifficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onChangeDifficulty(d.id);
                        }}
                        className={`rounded-md min-h-[52px] py-2 px-2.5 sm:px-3 border text-left transition-colors ${
                          active
                            ? 'bg-sky-500/18 border-sky-400 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-bold leading-tight">{d.label}</div>
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{d.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Maze Biome Theme Selector (Live previews in background!) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">
                    Tema Bioma Labirin
                  </span>
                  <span
                    className="text-[11px] font-medium truncate"
                    style={{ color: getMazeBiomeTheme(selectedBiome).accentHex }}
                  >
                    {getMazeBiomeTheme(selectedBiome).tagline}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MAZE_BIOME_LIST.map((b) => {
                    const active = selectedBiome === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`title-biome-btn-${b.id}`}
                        aria-pressed={active}
                        onClick={() => {
                          retroAudio.playButtonClick();
                          onChangeBiome(b.id);
                        }}
                        className={`rounded-md p-2 border text-left transition-colors ${
                          active
                            ? 'bg-slate-800/90 text-white'
                            : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500'
                        }`}
                        style={active ? { borderColor: b.accentHex } : undefined}
                      >
                        <div className="flex items-center gap-1 mb-1.5" aria-hidden="true">
                          {b.swatchColors.map((hex, i) => (
                            <span
                              key={i}
                              className="h-2 flex-1 rounded-[2px] border border-black/30"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <div className="text-xs font-bold leading-tight truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                          {b.shortTag}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary CTA: Quick Play */}
              <div className="rounded-md bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-[#0b101b] border border-amber-400/70 p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white">
                    Mulai Petualangan Labirin
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                    Langsung masuk ke arena labirin 2D dengan soal matematika pilihan A atau B.
                  </p>
                </div>
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-quick-play-btn"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onStartQuickPlay();
                  }}
                  className="rpg-btn-gold w-full sm:w-auto min-h-[48px] px-5 py-3 font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  <span>Main Sekarang</span>
                </button>
              </div>

              {/* Split Student Join vs Teacher Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                {/* Student Join Card */}
                <div className="rpg-well p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold text-sky-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Gabung Room Kelas</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchActiveRooms}
                      className="min-h-[32px] px-1.5 text-xs font-medium text-slate-400 hover:text-sky-300 flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>Segarkan</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      aria-label="Kode Room Kelas"
                      value={roomCodeInput}
                      onChange={(e) => onChangeRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="MATH-4821"
                      maxLength={12}
                      className="w-full min-h-[44px] rounded-md bg-[#131b2b] border border-slate-600 focus:border-sky-400 px-3 py-2 text-base sm:text-sm font-code font-semibold text-white uppercase outline-none"
                    />
                    <button
                      type="button"
                      data-testid="join-room-btn"
                      onClick={() => {
                        retroAudio.playButtonClick();
                        onJoinRoomAsStudent();
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 active:translate-y-[1px] text-slate-950 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors"
                    >
                      Gabung
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Masukkan kode dari guru (mis. <span className="font-code text-slate-200">MATH-4821</span>).
                  </p>

                  {activeRooms.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-28 overflow-y-auto rpg-scroll">
                      <div className="text-[11px] font-medium text-slate-400">
                        Room aktif ({activeRooms.length})
                      </div>
                      {activeRooms.slice(0, 4).map((rm) => (
                        <button
                          key={rm.code}
                          type="button"
                          onClick={() => {
                            retroAudio.playButtonClick();
                            onChangeRoomCodeInput(rm.code);
                            onJoinRoomAsStudent(rm.code);
                          }}
                          className="w-full min-h-[38px] rounded px-2.5 py-1.5 bg-[#131b2b] hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between gap-2 text-xs text-left transition-colors"
                        >
                          <span className="font-code font-bold text-amber-300 shrink-0">{rm.code}</span>
                          <span className="text-slate-300 truncate">{rm.teacherName}</span>
                          <span className="font-code text-emerald-400 tabular-nums shrink-0">
                            {rm.studentCount}/{rm.maxPlayers}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Teacher Dashboard Card */}
                <div className="rpg-well p-3.5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Panel Guru</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Buat room hingga 45 siswa, atur materi atau soal kustom sendiri, bagi tim, dan pantau skor live.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="create-teacher-room-btn"
                    onClick={() => {
                      retroAudio.playButtonClick();
                      onCreateRoomAsTeacher();
                    }}
                    className="rpg-btn-emerald w-full min-h-[44px] px-3 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap text-center"
                  >
                    Buat Room Guru
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Single Flat Control Hint Line in Safe Margin */}
      <div className="relative z-10 text-center pb-3.5 px-4 text-xs text-slate-400">
        <span className="hidden sm:inline">
          WASD / Panah Bergerak · Sentuh Kunci untuk Soal A/B · P Pause · M Audio · N Peta
        </span>
        <span className="sm:hidden">
          D-Pad Sentuh Bergerak · Sentuh Kunci untuk Jawab Soal A/B
        </span>
      </div>

      {/* ==================== SECONDARY MODALS ==================== */}
      {activeModal !== 'none' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div
            className={`rpg-modal w-full ${
              activeModal === 'history' ? 'max-w-5xl' : 'max-w-2xl'
            } p-5 sm:p-6 text-slate-100 max-h-[88dvh] overflow-y-auto rpg-scroll space-y-4`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/80 pb-3">
              <h2 className="text-lg font-bold text-amber-300">
                {activeModal === 'howto' && 'Cara Bermain Math Maze'}
                {activeModal === 'settings' && 'Pengaturan Audio'}
                {activeModal === 'history' && 'Riwayat Kelas & Student Analytics'}
                {activeModal === 'credits' && 'Tentang Math Maze'}
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setActiveModal('none')}
                className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeModal === 'howto' && (
              <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
                <p>
                  1. <strong className="text-white">Eksplorasi Labirin</strong>: Gunakan tombol{' '}
                  <span className="font-code text-amber-300">WASD</span>, tombol panah, atau D-Pad sentuh untuk menjelajahi lorong dan ruangan rahasia.
                </p>
                <p>
                  2. <strong className="text-white">Kumpulkan Kunci Matematika</strong>: Dekati kunci bercahaya untuk memunculkan soal matematika.
                </p>
                <p>
                  3. <strong className="text-white">Pilih Jawaban A atau B</strong>: Jawaban benar memberi{' '}
                  <span className="text-emerald-300 font-semibold">+100 Poin</span> dan kunci (+50 Poin). Jawaban salah mengurangi{' '}
                  <span className="text-red-300 font-semibold">1 Nyawa</span>.
                </p>
                <p>
                  4. <strong className="text-white">Buka Pintu Keluar</strong>: Setelah kunci target terkumpul, gerbang hijau terbuka (+300 Poin Bonus saat keluar).
                </p>
                <div className="rpg-well p-3 text-xs text-slate-300 space-y-1">
                  <div>
                    <strong className="text-amber-300">Co-op Adventure:</strong> Progres kunci dikumpulkan bersama sekelas.
                  </div>
                  <div>
                    <strong className="text-sky-300">Class Competition:</strong> Adu cepat & skor tertinggi antar siswa.
                  </div>
                  <div>
                    <strong className="text-emerald-300">Team Battle:</strong> Hingga 5 tim berlomba membuka pintu timnya.
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'settings' && (
              <div className="space-y-3.5 text-sm">
                <div className="rpg-well p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">Musik & Efek Suara 16-Bit</div>
                    <div className="text-xs text-slate-400">Efek langkah, kunci, dan notifikasi soal</div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`min-h-[38px] px-4 py-1.5 rounded-md font-bold text-xs whitespace-nowrap ${
                      muted
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {muted ? 'Mati (Muted)' : 'Aktif'}
                  </button>
                </div>

                <div className="rpg-well p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="audio-volume-slider" className="font-semibold text-white">
                      Volume Utama
                    </label>
                    <span className="font-code font-bold text-amber-300 tabular-nums">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <input
                    id="audio-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>
            )}

            {activeModal === 'history' && (
              <div className="space-y-4 text-sm">
                <StudentAnalyticsPanel />

                {analytics && (
                  <div>
                    <div className="text-xs font-semibold text-amber-300 mb-2">
                      Riwayat Sesi Terakhir ({analytics.databaseEngine})
                    </div>
                    <div className="space-y-2">
                      {analytics.gameHistory.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="rpg-well p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-xs sm:text-sm">
                              <span className="font-code text-amber-300">{item.roomCode}</span> ·{' '}
                              {item.mode.toUpperCase()} ({item.playerCount} Siswa)
                            </div>
                            <div className="text-xs text-slate-400 truncate">{item.summaryText}</div>
                          </div>
                          <span className="font-code text-xs text-slate-400 shrink-0 tabular-nums">
                            {item.durationSeconds}d
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeModal === 'credits' && (
              <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-white">Math Maze: Quest for the Keys</strong> dirancang untuk pembelajaran matematika interaktif sekelas hingga 45 siswa secara bersamaan.
                </p>
                <div className="rpg-well p-3.5 space-y-1.5 text-xs">
                  <p>
                    • <strong className="text-amber-300">Procedural Maze Engine:</strong> Labirin dinamis dengan ruang rahasia, pencahayaan bayangan dinding, dan validasi jalur otomatis.
                  </p>
                  <p>
                    • <strong className="text-sky-300">Bank Soal Adaptif & Kustom Guru:</strong> 17 kategori materi matematika plus pembuat soal dan unggah CSV/JSON khusus guru.
                  </p>
                  <p>
                    • <strong className="text-emerald-300">Sinkronisasi Real-Time:</strong> Status permainan otoritatif server dengan latensi rendah untuk komputer maupun ponsel.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="rpg-btn-gold px-5 py-2 font-bold text-xs sm:text-sm"
              >
                Tutup [Esc]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

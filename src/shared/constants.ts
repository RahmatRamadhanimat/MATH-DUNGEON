import { DEFAULT_MAZE_BIOME, MazeBiomeId } from './biomeThemes';

export type { MazeBiomeId };

export type GameMode = 'coop' | 'competitive' | 'team';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type KeyType = 'bronze' | 'silver' | 'golden' | 'crystal';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type PlayerAnimState = 'idle' | 'walk' | 'key_get' | 'answering';
export type PlayerStatus = 'active' | 'eliminated' | 'spectator' | 'escaped';
export type TeamId = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export type QuestionSourceMode = 'auto' | 'custom_only' | 'mixed';

export interface CustomQuestionItem {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
  correctOption: 'A' | 'B';
  explanation?: string;
}

export type MathCategoryId =
  // Mudah (Easy)
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'basic_ops'
  // Sedang (Medium)
  | 'fractions'
  | 'percentages'
  | 'negative_numbers'
  | 'mixed_ops'
  | 'exponents'
  | 'square_roots'
  // Sulit (Hard)
  | 'algebra'
  | 'linear_equations'
  | 'math_equations'
  | 'powers_advanced'
  | 'roots_advanced'
  | 'math_logic';

export interface MathCategoryInfo {
  id: MathCategoryId;
  name: string;
  difficulty: DifficultyLevel;
  description: string;
  sample: string;
}

export const MATH_CATEGORIES: MathCategoryInfo[] = [
  // TINGKAT MUDAH
  { id: 'addition', name: 'Penjumlahan', difficulty: 'easy', description: 'Penjumlahan bilangan bulat positif', sample: '48 + 37 = ?' },
  { id: 'subtraction', name: 'Pengurangan', difficulty: 'easy', description: 'Pengurangan bilangan bulat', sample: '92 − 45 = ?' },
  { id: 'multiplication', name: 'Perkalian', difficulty: 'easy', description: 'Perkalian dasar hingga menengah', sample: '25 × 4 = ?' },
  { id: 'division', name: 'Pembagian', difficulty: 'easy', description: 'Pembagian habis tanpa sisa', sample: '144 ÷ 12 = ?' },
  { id: 'basic_ops', name: 'Operasi Hitung Sederhana', difficulty: 'easy', description: 'Kombinasi tambah, kurang, kali sederhana', sample: '15 + 8 × 2 = ?' },

  // TINGKAT SEDANG
  { id: 'fractions', name: 'Pecahan', difficulty: 'medium', description: 'Operasi dan penyederhanaan pecahan', sample: '3/4 + 1/2 = ?' },
  { id: 'percentages', name: 'Persentase', difficulty: 'medium', description: 'Menghitung nilai persentase dari bilangan', sample: '25% dari 240 = ?' },
  { id: 'negative_numbers', name: 'Bilangan Negatif', difficulty: 'medium', description: 'Operasi hitung bilangan bulat positif & negatif', sample: '-18 + 32 − (-7) = ?' },
  { id: 'mixed_ops', name: 'Operasi Campuran', difficulty: 'medium', description: 'Urutan operasi hitung campuran (KURKABATAKU)', sample: '(18 + 6) ÷ 3 × 4 = ?' },
  { id: 'exponents', name: 'Perpangkatan', difficulty: 'medium', description: 'Kuadrat dan pangkat tiga dasar', sample: '7² + 3³ = ?' },
  { id: 'square_roots', name: 'Akar Kuadrat Sederhana', difficulty: 'medium', description: 'Akar kuadrat bilangan kuadrat sempurna', sample: '√196 + √64 = ?' },

  // TINGKAT SULIT
  { id: 'algebra', name: 'Aljabar', difficulty: 'hard', description: 'Substitusi dan penyederhanaan bentuk aljabar', sample: 'Jika a = 4, b = -3, nilai 3a² + 2b = ?' },
  { id: 'linear_equations', name: 'Persamaan Linear', difficulty: 'hard', description: 'Mencari nilai variabel x pada persamaan satu variabel', sample: '4x − 7 = 2x + 15, maka x = ?' },
  { id: 'math_equations', name: 'Persamaan Matematika', difficulty: 'hard', description: 'Sistem persamaan dan proporsi bertingkat', sample: '(2x + 4) / 3 = 10, maka x = ?' },
  { id: 'powers_advanced', name: 'Bilangan Berpangkat', difficulty: 'hard', description: 'Sifat eksponen dan operasi bilangan berpangkat', sample: '(2³ × 2⁴) ÷ 2⁵ = ?' },
  { id: 'roots_advanced', name: 'Akar', difficulty: 'hard', description: 'Operasi akar kuadrat dan akar pangkat tiga', sample: '∛216 × √81 = ?' },
  { id: 'math_logic', name: 'Logika Matematika', difficulty: 'hard', description: 'Pola barisan bilangan dan penalaran logika', sample: 'Pola: 3, 7, 15, 31, ... suku berikutnya?' },
];

export const MAP_LEVELS: Record<number, { level: number; size: number; label: string; recommendedPlayers: string }> = {
  1: { level: 1, size: 35, label: 'Level 1 — 35×35 Tile (Labirin Luas)', recommendedPlayers: '1–10 Siswa' },
  2: { level: 2, size: 45, label: 'Level 2 — 45×45 Tile (Aula Kelas)', recommendedPlayers: '10–20 Siswa' },
  3: { level: 3, size: 55, label: 'Level 3 — 55×55 Tile (Benteng Kuno)', recommendedPlayers: '20–30 Siswa' },
  4: { level: 4, size: 65, label: 'Level 4 — 65×65 Tile (Katakomba Agung)', recommendedPlayers: '30–40 Siswa' },
  5: { level: 5, size: 75, label: 'Level 5 — 75×75 Tile (Citadel 45 Siswa)', recommendedPlayers: '35–45 Siswa' },
};

export interface CharacterPreset {
  id: string;
  name: string;
  title: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hatStyle: 'helm' | 'wizard' | 'hood' | 'goggles' | 'bandana' | 'circlet' | 'crest' | 'feather';
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'knight',
    name: 'Arkan',
    title: 'Ksatria Geometri',
    primaryColor: '#2563EB',
    secondaryColor: '#93C5FD',
    accentColor: '#F59E0B',
    hatStyle: 'helm',
  },
  {
    id: 'mage',
    name: 'Lyra',
    title: 'Penyihir Aljabar',
    primaryColor: '#7C3AED',
    secondaryColor: '#C4B5FD',
    accentColor: '#38BDF8',
    hatStyle: 'wizard',
  },
  {
    id: 'ranger',
    name: 'Kael',
    title: 'Penjelajah Vektor',
    primaryColor: '#059669',
    secondaryColor: '#6EE7B7',
    accentColor: '#FBBF24',
    hatStyle: 'hood',
  },
  {
    id: 'alchemist',
    name: 'Pyra',
    title: 'Alkemis Pecahan',
    primaryColor: '#DC2626',
    secondaryColor: '#FCA5A5',
    accentColor: '#FDE047',
    hatStyle: 'goggles',
  },
  {
    id: 'rogue',
    name: 'Zeph',
    title: 'Pengintai Logika',
    primaryColor: '#D97706',
    secondaryColor: '#FCD34D',
    accentColor: '#10B981',
    hatStyle: 'bandana',
  },
  {
    id: 'scholar',
    name: 'Nyx',
    title: 'Cendekia Akar',
    primaryColor: '#0891B2',
    secondaryColor: '#67E8F9',
    accentColor: '#F472B6',
    hatStyle: 'circlet',
  },
  {
    id: 'paladin',
    name: 'Toren',
    title: 'Penjaga Eksponen',
    primaryColor: '#EA580C',
    secondaryColor: '#FDBA74',
    accentColor: '#FEF08A',
    hatStyle: 'crest',
  },
  {
    id: 'bard',
    name: 'Vesper',
    title: 'Penyair Harmoni',
    primaryColor: '#DB2777',
    secondaryColor: '#F9A8D4',
    accentColor: '#A7F3D0',
    hatStyle: 'feather',
  },
];

export const OUTFIT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'cobalt', name: 'Biru Kobalt', hex: '#2563EB' },
  { id: 'emerald', name: 'Hijau Zamrud', hex: '#059669' },
  { id: 'crimson', name: 'Merah Kirmizi', hex: '#DC2626' },
  { id: 'amethyst', name: 'Ungu Kecubung', hex: '#7C3AED' },
  { id: 'amber', name: 'Emas Amber', hex: '#D97706' },
  { id: 'cyan', name: 'Biru Sian', hex: '#0891B2' },
  { id: 'orange', name: 'Jingga Surya', hex: '#EA580C' },
  { id: 'rose', name: 'Merah Muda', hex: '#DB2777' },
];

export interface TeamDefinition {
  id: TeamId;
  name: string;
  color: string;
  lightColor: string;
  badge: string;
}

export const TEAM_DEFINITIONS: Record<TeamId, TeamDefinition> = {
  red: { id: 'red', name: 'Team Red', color: '#EF4444', lightColor: '#FCA5A5', badge: 'MERAH' },
  blue: { id: 'blue', name: 'Team Blue', color: '#3B82F6', lightColor: '#93C5FD', badge: 'BIRU' },
  green: { id: 'green', name: 'Team Green', color: '#10B981', lightColor: '#6EE7B7', badge: 'HIJAU' },
  yellow: { id: 'yellow', name: 'Team Yellow', color: '#F59E0B', lightColor: '#FCD34D', badge: 'KUNING' },
  purple: { id: 'purple', name: 'Team Purple', color: '#8B5CF6', lightColor: '#C4B5FD', badge: 'UNGU' },
};

export const TEAM_ORDER: TeamId[] = ['red', 'blue', 'green', 'yellow', 'purple'];

export const KEY_TYPES_INFO: Record<KeyType, { name: string; color: string; glow: string; bonusPoints: number }> = {
  bronze: { name: 'Bronze Key', color: '#CD7F32', glow: '#FDBA74', bonusPoints: 50 },
  silver: { name: 'Silver Key', color: '#CBD5E1', glow: '#F8FAFC', bonusPoints: 50 },
  golden: { name: 'Golden Key', color: '#FACC15', glow: '#FEF08A', bonusPoints: 50 },
  crystal: { name: 'Crystal Key', color: '#38BDF8', glow: '#BAE6FD', bonusPoints: 50 },
};

export const GAME_RULES = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 45,
  MAX_TEAMS: 5,
  DEFAULT_KEYS: 5,
  DEFAULT_LIVES: 3,
  DEFAULT_DURATION_SECONDS: 300,
  DEFAULT_QUESTION_TIMER_SECONDS: 25,
  TILE_SIZE: 32,
  PLAYER_SPEED: 150, // pixels per second
  POSITION_SYNC_INTERVAL_MS: 80, // ~12.5 updates/sec
  CORRECT_ANSWER_POINTS: 100,
  KEY_COLLECTED_POINTS: 50,
  LEVEL_COMPLETION_POINTS: 300,
  CHAT_RATE_LIMIT_MS: 1200,
};

export const QUICK_CHAT_MESSAGES = [
  'Kunci ditemukan di sini!',
  'Ayo berkumpul di Pintu Keluar!',
  'Butuh bantuan di area utara!',
  'Kerja bagus teman-teman!',
  'Hati-hati saat menghitung soal!',
  'Satu kunci lagi, semangat!',
];

export const EMOJI_REACTIONS = [
  { id: 'key', label: 'Kunci!', symbol: 'KEY' },
  { id: 'check', label: 'Benar!', symbol: 'OK!' },
  { id: 'fire', label: 'Semangat!', symbol: 'GO!' },
  { id: 'help', label: 'Bantu!', symbol: 'SOS' },
  { id: 'star', label: 'Hebat!', symbol: 'GG!' },
];

export const SOCKET_EVENTS = {
  // Room & Lobby
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_ERROR: 'room:error',
  TOGGLE_READY: 'player:ready',
  UPDATE_SETTINGS: 'room:update_settings',
  LOCK_ROOM: 'room:lock',
  ASSIGN_TEAMS: 'room:assign_teams',

  // Game Lifecycle
  START_GAME: 'game:start',
  PAUSE_GAME: 'game:pause',
  RESUME_GAME: 'game:resume',
  END_GAME: 'game:end',
  RESTART_GAME: 'game:restart',
  GAME_TICK: 'game:tick',

  // Real-time Gameplay
  PLAYER_MOVE: 'player:move',
  PLAYERS_DELTA: 'players:delta',
  REQUEST_KEY_QUESTION: 'key:request_question',
  RECEIVE_KEY_QUESTION: 'key:question',
  SUBMIT_KEY_ANSWER: 'key:submit_answer',
  ANSWER_RESULT: 'key:answer_result',
  KEY_COLLECTED_BROADCAST: 'key:collected',
  DOOR_OPENED_BROADCAST: 'door:opened',
  PLAYER_REACHED_EXIT: 'player:exit',

  // Communication & Overhead Emotes
  CHAT_MESSAGE: 'chat:message',
  PLAYER_EMOTE: 'player:emote',
  SYSTEM_NOTIFICATION: 'system:notification',

  // Heartbeat
  PING_CHECK: 'net:ping',
  PONG_CHECK: 'net:pong',
} as const;

export enum TileType {
  WALL = 0,
  FLOOR = 1,
  SECRET_FLOOR = 2,
  TORCH_WALL = 3,
  CHEST_DECOR = 4,
  CRYSTAL_DECOR = 5,
  GRASS_DECOR = 6,
  TRAP_DECOR = 7,
  WOOD_DOOR = 8,
  PORTAL_SPAWN = 9,
  EXIT_LOCKED = 10,
  EXIT_OPEN = 11,
}

export interface RoomSettings {
  mode: GameMode;
  difficulty: DifficultyLevel;
  categories: MathCategoryId[];
  questionSource: QuestionSourceMode;
  customQuestions: CustomQuestionItem[];
  keyCount: number;
  mapLevel: number; // 1..5
  biome: MazeBiomeId;
  maxPlayers: number; // up to 45
  lives: number;
  durationSeconds: number;
  questionTimerSeconds: number;
  teamCount: number; // 2..5
  teamAssignmentMode: 'random' | 'manual';
  eliminatedBehavior: 'spectator' | 'eliminated';
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  mode: 'coop',
  difficulty: 'easy',
  categories: ['addition', 'subtraction', 'multiplication', 'division', 'basic_ops'],
  questionSource: 'auto',
  customQuestions: [],
  keyCount: 5,
  mapLevel: 1,
  biome: DEFAULT_MAZE_BIOME,
  maxPlayers: 45,
  lives: 3,
  durationSeconds: 300,
  questionTimerSeconds: 25,
  teamCount: 4,
  teamAssignmentMode: 'random',
  eliminatedBehavior: 'spectator',
};

export function normalizeRoomCode(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^#/, '')
    .replace(/[\u2010-\u2015\u2212_]+/g, '-')
    .replace(/\s+/g, '');
  if (!cleaned) return '';
  if (/^\d{4,6}$/.test(cleaned)) {
    return `MATH-${cleaned}`;
  }
  if (/^MATH-?\d{4,6}$/.test(cleaned)) {
    const digits = cleaned.replace(/^MATH-?/, '');
    return `MATH-${digits}`;
  }
  return cleaned;
}


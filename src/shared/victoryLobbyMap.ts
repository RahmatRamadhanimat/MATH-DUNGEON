import { TileType } from './constants';
import { GeneratedMaze } from './mazeGenerator';

export const VICTORY_LOBBY_SEED = 999999;
export const VICTORY_LOBBY_WIDTH = 27;
export const VICTORY_LOBBY_HEIGHT = 19;

export interface VictoryLobbyLandmark {
  id: 'podium_1' | 'podium_2' | 'podium_3' | 'scoreboard_monument' | 'crystal_fountain' | 'social_lounge' | 'arrival_gate';
  title: string;
  subtitle: string;
  tileX: number;
  tileY: number;
  accentColor: string;
}

export const VICTORY_LOBBY_LANDMARKS: VictoryLobbyLandmark[] = [
  {
    id: 'podium_1',
    title: 'PODIUM JUARA #1',
    subtitle: 'Tahta Emas Sang Penakluk Labirin',
    tileX: 13,
    tileY: 4,
    accentColor: '#FACC15',
  },
  {
    id: 'podium_2',
    title: 'PODIUM JUARA #2',
    subtitle: 'Kehormatan Ksatria Perak',
    tileX: 10,
    tileY: 5,
    accentColor: '#E2E8F0',
  },
  {
    id: 'podium_3',
    title: 'PODIUM JUARA #3',
    subtitle: 'Kehormatan Ksatria Perunggu',
    tileX: 16,
    tileY: 5,
    accentColor: '#F97316',
  },
  {
    id: 'scoreboard_monument',
    title: 'MONUMEN KLASEMEN',
    subtitle: 'Piala Kebijaksanaan Matematika',
    tileX: 13,
    tileY: 9,
    accentColor: '#38BDF8',
  },
  {
    id: 'crystal_fountain',
    title: 'TAMAN KRISTAL',
    subtitle: 'Paviliun Barat · Air Mancur Arkana',
    tileX: 4,
    tileY: 9,
    accentColor: '#C084FC',
  },
  {
    id: 'social_lounge',
    title: 'BALAI DISKUSI PEMENANG',
    subtitle: 'Paviliun Timur · Area Berkumpul Kelas',
    tileX: 22,
    tileY: 9,
    accentColor: '#34D399',
  },
  {
    id: 'arrival_gate',
    title: 'GERBANG KELUAR DUNGEON',
    subtitle: 'Titik Kedatangan Penjelajah',
    tileX: 13,
    tileY: 15,
    accentColor: '#38BDF8',
  },
];

let cachedVictoryLobby: GeneratedMaze | null = null;

/**
 * Generates the post-dungeon Victory Sanctuary Lobby ("Aula Pemenang") where players who
 * have escaped the dungeon (or completed the session) can freely walk around together.
 */
export function createVictoryLobbyMaze(): GeneratedMaze {
  if (cachedVictoryLobby) return cachedVictoryLobby;

  const width = VICTORY_LOBBY_WIDTH;
  const height = VICTORY_LOBBY_HEIGHT;

  const grid: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.WALL)
  );

  // 1. Carve Main Central Grand Hall (x: 8..18, y: 2..16)
  for (let y = 2; y <= 16; y++) {
    for (let x = 8; x <= 18; x++) {
      grid[y][x] = TileType.FLOOR;
    }
  }

  // 2. Carve West Crystal Pavilion (x: 2..6, y: 4..14) & connecting archways at x=7
  for (let y = 4; y <= 14; y++) {
    for (let x = 2; x <= 6; x++) {
      grid[y][x] = TileType.FLOOR;
    }
  }
  // Wide twin corridors connecting West Pavilion to Central Hall
  for (const archY of [6, 7, 11, 12]) {
    grid[archY][7] = TileType.WOOD_DOOR;
  }

  // 3. Carve East Champions Lounge (x: 20..24, y: 4..14) & connecting archways at x=19
  for (let y = 4; y <= 14; y++) {
    for (let x = 20; x <= 24; x++) {
      grid[y][x] = TileType.FLOOR;
    }
  }
  for (const archY of [6, 7, 11, 12]) {
    grid[archY][19] = TileType.WOOD_DOOR;
  }

  // 4. Lay Royal Sanctuary Carpets (SECRET_FLOOR)
  // North Champion Podium stage (x: 9..17, y: 3..6)
  for (let y = 3; y <= 6; y++) {
    for (let x = 9; x <= 17; x++) {
      grid[y][x] = TileType.SECRET_FLOOR;
    }
  }

  // Grand Processional Carpet Runner from Arrival Portal (y=15) up to Podium (y=7)
  for (let y = 7; y <= 15; y++) {
    for (let x = 12; x <= 14; x++) {
      grid[y][x] = TileType.SECRET_FLOOR;
    }
  }

  // Horizontal Royal Carpet cross-walkway connecting West Pavilion -> Monument -> East Lounge (y: 8..10)
  for (let y = 8; y <= 10; y++) {
    for (let x = 9; x <= 17; x++) {
      grid[y][x] = TileType.SECRET_FLOOR;
    }
  }

  // West Pavilion Crystal Carpet (x: 3..5, y: 6..12)
  for (let y = 6; y <= 12; y++) {
    for (let x = 3; x <= 5; x++) {
      grid[y][x] = TileType.SECRET_FLOOR;
    }
  }

  // East Pavilion Lounge Carpet (x: 21..23, y: 6..12)
  for (let y = 6; y <= 12; y++) {
    for (let x = 21; x <= 23; x++) {
      grid[y][x] = TileType.SECRET_FLOOR;
    }
  }

  // 5. Decorative Pillars, Torches & Arcane Crystals (Walkable or Scenic Accents)
  // Wall torches along the north wall & pavilion borders
  const torchCoords: Array<[number, number]> = [
    [9, 1],
    [13, 1],
    [17, 1],
    [3, 3],
    [5, 3],
    [21, 3],
    [23, 3],
    [7, 4],
    [7, 9],
    [7, 14],
    [19, 4],
    [19, 9],
    [19, 14],
    [9, 17],
    [17, 17],
  ];
  for (const [tx, ty] of torchCoords) {
    if (grid[ty]?.[tx] === TileType.WALL) {
      grid[ty][tx] = TileType.TORCH_WALL;
    }
  }

  // Glowing Arcane Crystals in West Pavilion & Flanking Podium
  grid[9][4] = TileType.CRYSTAL_DECOR;
  grid[3][8] = TileType.CRYSTAL_DECOR;
  grid[3][18] = TileType.CRYSTAL_DECOR;
  grid[15][8] = TileType.CRYSTAL_DECOR;
  grid[15][18] = TileType.CRYSTAL_DECOR;

  // Arrival Portal at South-Center (13, 15)
  grid[15][13] = TileType.PORTAL_SPAWN;

  const created: GeneratedMaze = {
    width,
    height,
    tileSize: 32,
    level: 0,
    seed: VICTORY_LOBBY_SEED,
    grid,
    spawnTile: { x: 13, y: 15 },
    exitTile: { x: 13, y: 4 },
    keys: [],
    secretRooms: [
      { id: 'room-podium', x: 9, y: 3, width: 9, height: 4, theme: 'secret_treasury' },
      { id: 'room-west-pavilion', x: 2, y: 4, width: 5, height: 11, theme: 'crystal_sanctum' },
      { id: 'room-east-lounge', x: 20, y: 4, width: 5, height: 11, theme: 'moss_courtyard' },
    ],
    torches: torchCoords.map(([x, y]) => ({ x, y })),
  };

  cachedVictoryLobby = created;
  return created;
}

export function isVictoryLobbyMaze(maze: GeneratedMaze): boolean {
  return maze.seed === VICTORY_LOBBY_SEED;
}

export function getNearestLobbyLandmark(
  worldX: number,
  worldY: number,
  tileSize = 32,
  maxDistTiles = 2.1
): VictoryLobbyLandmark | null {
  const tx = worldX / tileSize;
  const ty = worldY / tileSize;
  let best: VictoryLobbyLandmark | null = null;
  let bestDist = maxDistTiles;

  for (const lm of VICTORY_LOBBY_LANDMARKS) {
    const d = Math.hypot(tx - (lm.tileX + 0.5), ty - (lm.tileY + 0.5));
    if (d <= bestDist) {
      bestDist = d;
      best = lm;
    }
  }
  return best;
}

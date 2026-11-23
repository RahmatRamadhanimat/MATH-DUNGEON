import { KeyType, MAP_LEVELS, TileType } from './constants';

export interface MazeKeyObject {
  id: string;
  type: KeyType;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  // In CO-OP mode: collectedBy is playerId who collected it for the class
  collectedBy: string | null;
  // In COMPETITIVE mode: list of playerIds who collected this key
  collectedByPlayers: string[];
  // In TEAM mode: list of teamIds who collected this key
  collectedByTeams: string[];
}

export interface MazeRoomRegion {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: 'secret_treasury' | 'crystal_sanctum' | 'moss_courtyard';
}

export interface GeneratedMaze {
  seed: number;
  level: number;
  width: number;
  height: number;
  tileSize: number;
  grid: TileType[][];
  spawnTile: { x: number; y: number };
  exitTile: { x: number; y: number };
  keys: MazeKeyObject[];
  secretRooms: MazeRoomRegion[];
  torches: { x: number; y: number }[];
}

// Seeded PRNG (Mulberry32) for deterministic & reproducible procedural mazes
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isWalkableTile(tile: TileType): boolean {
  return tile !== TileType.WALL && tile !== TileType.TORCH_WALL;
}

/**
 * Validates via Breadth-First Search (BFS) that all target coordinates are reachable
 * from the start coordinate on walkable tiles.
 */
export function validateMazeReachability(
  grid: TileType[][],
  start: { x: number; y: number },
  targets: { x: number; y: number }[]
): { valid: boolean; reachableCount: number; distances: Map<string, number> } {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const distances = new Map<string, number>();

  if (
    start.y < 0 ||
    start.y >= height ||
    start.x < 0 ||
    start.x >= width ||
    !isWalkableTile(grid[start.y][start.x])
  ) {
    return { valid: false, reachableCount: 0, distances };
  }

  const queue: { x: number; y: number; dist: number }[] = [{ x: start.x, y: start.y, dist: 0 }];
  distances.set(`${start.x},${start.y}`, 0);

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    for (const d of dirs) {
      const nx = curr.x + d.dx;
      const ny = curr.y + d.dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 1 &&
        nx < width - 1 &&
        ny >= 1 &&
        ny < height - 1 &&
        !distances.has(key) &&
        isWalkableTile(grid[ny][nx])
      ) {
        distances.set(key, curr.dist + 1);
        queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
      }
    }
  }

  let reachableCount = 0;
  for (const t of targets) {
    if (distances.has(`${t.x},${t.y}`)) {
      reachableCount++;
    }
  }

  return {
    valid: reachableCount === targets.length,
    reachableCount,
    distances,
  };
}

const SECRET_CHAMBER_CATALOG: {
  name: string;
  theme: MazeRoomRegion['theme'];
}[] = [
  { name: 'Ruang Harta Emas', theme: 'secret_treasury' },
  { name: 'Sanctum Kristal Arkana', theme: 'crystal_sanctum' },
  { name: 'Taman Lumut Kuno', theme: 'moss_courtyard' },
  { name: 'Observatorium Aljabar', theme: 'crystal_sanctum' },
  { name: 'Perpustakaan Geometri', theme: 'secret_treasury' },
  { name: 'Kuil Logika Kuno', theme: 'moss_courtyard' },
  { name: 'Bilik Mahkota Raja', theme: 'secret_treasury' },
  { name: 'Aula Prisma Bintang', theme: 'crystal_sanctum' },
];

/**
 * Generates a procedural dungeon maze using Recursive Backtracking + Secret Room carving
 * + Grand Spawn Courtyard + Central Crossroads Plaza + BFS pathfinding guarantee.
 */
export function generateProceduralMaze(options: {
  level?: number;
  keyCount?: number;
  seed?: number;
  tileSize?: number;
}): GeneratedMaze {
  const level = Math.max(1, Math.min(5, options.level ?? 1));
  const size = MAP_LEVELS[level]?.size ?? 25;
  // Ensure odd dimensions for clean maze grid
  const width = size % 2 === 0 ? size + 1 : size;
  const height = size % 2 === 0 ? size + 1 : size;
  const tileSize = options.tileSize ?? 32;
  const keyCount = Math.max(1, Math.min(25, options.keyCount ?? 5));
  const seed = options.seed ?? Math.floor(Math.random() * 999999999) + 1;
  const rng = createSeededRng(seed);

  // 1. Initialize solid wall grid
  const grid: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.WALL)
  );

  // 2. Recursive Backtracker Maze Carving on odd coordinates
  const startCellX = 3;
  const startCellY = 3;
  grid[startCellY][startCellX] = TileType.FLOOR;

  const stack: { x: number; y: number }[] = [{ x: startCellX, y: startCellY }];
  const carveDirs = [
    { dx: 0, dy: -2 },
    { dx: 2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: -2, dy: 0 },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const unvisitedNeighbors: { nx: number; ny: number; wx: number; wy: number }[] = [];

    for (const d of carveDirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && grid[ny][nx] === TileType.WALL) {
        unvisitedNeighbors.push({
          nx,
          ny,
          wx: current.x + d.dx / 2,
          wy: current.y + d.dy / 2,
        });
      }
    }

    if (unvisitedNeighbors.length > 0) {
      const chosen = unvisitedNeighbors[Math.floor(rng() * unvisitedNeighbors.length)];
      grid[chosen.wy][chosen.wx] = TileType.FLOOR;
      grid[chosen.ny][chosen.nx] = TileType.FLOOR;
      stack.push({ x: chosen.nx, y: chosen.ny });
    } else {
      stack.pop();
    }
  }

  // 3. Carve Royal Spawn Courtyard (5x5 open courtyard with royal carpet cross-runner)
  const spawnTile = { x: 3, y: 3 };
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const sx = spawnTile.x + dx;
      const sy = spawnTile.y + dy;
      if (sx >= 1 && sx < width - 1 && sy >= 1 && sy < height - 1) {
        const isCarpetRunner = dx === 0 || dy === 0;
        const isCornerGarden = Math.abs(dx) === 2 && Math.abs(dy) === 2;
        grid[sy][sx] = isCornerGarden
          ? TileType.GRASS_DECOR
          : isCarpetRunner
          ? TileType.SECRET_FLOOR
          : TileType.FLOOR;
      }
    }
  }
  // Ensure clear rightward and downward archways from spawn courtyard
  if (spawnTile.x + 3 < width - 1) grid[spawnTile.y][spawnTile.x + 3] = TileType.WOOD_DOOR;
  if (spawnTile.y + 3 < height - 1) grid[spawnTile.y + 3][spawnTile.x] = TileType.WOOD_DOOR;
  if (spawnTile.x + 4 < width - 1) grid[spawnTile.y][spawnTile.x + 4] = TileType.FLOOR;
  if (spawnTile.y + 4 < height - 1) grid[spawnTile.y + 4][spawnTile.x] = TileType.FLOOR;
  grid[spawnTile.y][spawnTile.x] = TileType.PORTAL_SPAWN;

  // 4. Carve Named Enclosed Secret Chambers (4x4 to 5x5 rooms framed by walls + doorways)
  const secretRooms: MazeRoomRegion[] = [];
  const roomWallSet = new Set<string>();
  const roomCount = Math.max(4, level + 3);

  for (let i = 0; i < roomCount; i++) {
    const rw = i % 2 === 0 ? 5 : 4;
    const rh = i % 2 === 0 ? 4 : 5;
    const rx = 7 + Math.floor(rng() * Math.max(1, width - rw - 10));
    const ry = 7 + Math.floor(rng() * Math.max(1, height - rh - 10));
    const catalogEntry = SECRET_CHAMBER_CATALOG[i % SECRET_CHAMBER_CATALOG.length];
    const theme = catalogEntry.theme;

    // Frame room perimeter with solid walls so the room is genuinely enclosed until entered
    for (let y = ry - 1; y <= ry + rh; y++) {
      for (let x = rx - 1; x <= rx + rw; x++) {
        if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
          const isBorder = y === ry - 1 || y === ry + rh || x === rx - 1 || x === rx + rw;
          if (isBorder) {
            grid[y][x] = TileType.WALL;
            roomWallSet.add(`${x},${y}`);
          } else {
            grid[y][x] = TileType.SECRET_FLOOR;
          }
        }
      }
    }

    // Place decorative centerpiece & corner accents inside the chamber
    const cx = rx + Math.floor(rw / 2);
    const cy = ry + Math.floor(rh / 2);
    if (cx > 1 && cx < width - 2 && cy > 1 && cy < height - 2) {
      if (theme === 'secret_treasury') grid[cy][cx] = TileType.CHEST_DECOR;
      else if (theme === 'crystal_sanctum') grid[cy][cx] = TileType.CRYSTAL_DECOR;
      else grid[cy][cx] = TileType.GRASS_DECOR;
    }

    // Subtle corner ornament inside larger chambers
    if (rx > 1 && ry > 1 && rx + rw - 1 < width - 1 && ry + rh - 1 < height - 1) {
      grid[ry][rx] = theme === 'moss_courtyard' ? TileType.GRASS_DECOR : TileType.TRAP_DECOR;
    }

    // Carve 1 primary doorway (WOOD_DOOR) and 1 side archway so room stays reachable yet enclosed
    const doors = [
      { dx: cx, dy: ry - 1, outX: cx, outY: ry - 2 },
      { dx: rx - 1, dy: cy, outX: rx - 2, outY: cy },
    ];
    for (const dr of doors) {
      if (dr.dy > 0 && dr.dy < height - 1 && dr.dx > 0 && dr.dx < width - 1) {
        grid[dr.dy][dr.dx] = TileType.WOOD_DOOR;
        roomWallSet.delete(`${dr.dx},${dr.dy}`);
        if (dr.outY > 0 && dr.outY < height - 1 && dr.outX > 0 && dr.outX < width - 1) {
          grid[dr.outY][dr.outX] = TileType.FLOOR;
        }
      }
    }

    secretRooms.push({
      id: `room-${i + 1}`,
      name: catalogEntry.name,
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      theme,
    });
  }

  // 4b. Carve Central Crossroads Rotunda (Compass Rose Landmark at map center if not overlapping secretRooms[0])
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const overlapsFirstRoom =
     secretRooms[0] &&
    Math.abs(midX - (secretRooms[0].x + 2)) <= 4 &&
    Math.abs(midY - (secretRooms[0].y + 2)) <= 4;

  if (!overlapsFirstRoom && midX > 6 && midY > 6) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = midX + dx;
        const py = midY + dy;
        if (!roomWallSet.has(`${px},${py}`)) {
          grid[py][px] = dx === 0 && dy === 0 ? TileType.TRAP_DECOR : TileType.SECRET_FLOOR;
        }
      }
    }
  }

  // 5. Add wider braided corridors & halls (preserving enclosed room perimeter walls)
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (grid[y][x] === TileType.WALL && !roomWallSet.has(`${x},${y}`)) {
        const horizFloor = isWalkableTile(grid[y][x - 1]) && isWalkableTile(grid[y][x + 1]);
        const vertFloor = isWalkableTile(grid[y - 1][x]) && isWalkableTile(grid[y + 1][x]);
        const widenCorridor =
          (isWalkableTile(grid[y][x - 1]) || isWalkableTile(grid[y - 1][x])) && rng() < 0.08;
        if (((horizFloor || vertFloor) && rng() < 0.22) || widenCorridor) {
          grid[y][x] =
            rng() < 0.14
              ? TileType.GRASS_DECOR
              : rng() < 0.08
              ? TileType.TRAP_DECOR
              : TileType.FLOOR;
        }
      }
    }
  }

  // 6. Run BFS from spawnTile to get all reachable floor tiles and their shortest path distances
  const initialBfs = validateMazeReachability(grid, spawnTile, []);
  const reachableTiles: { x: number; y: number; dist: number }[] = [];

  initialBfs.distances.forEach((dist, coord) => {
    const [tx, ty] = coord.split(',').map(Number);
    // Exclude immediate spawn courtyard (distance < 4)
    if (dist >= 4 && !(tx === spawnTile.x && ty === spawnTile.y)) {
      reachableTiles.push({ x: tx, y: ty, dist });
    }
  });

  // Sort by distance descending to place Exit Door at one of the furthest reachable points
  reachableTiles.sort((a, b) => b.dist - a.dist);

  const exitCandidate = reachableTiles[0] ?? { x: width - 2, y: height - 2, dist: 10 };
  const exitTile = { x: exitCandidate.x, y: exitCandidate.y };
  grid[exitTile.y][exitTile.x] = TileType.EXIT_LOCKED;

  // 7. Place Keys across the maze (spread out so they aren't clumped together)
  const keyTypesOrder: KeyType[] = ['bronze', 'silver', 'golden', 'crystal'];
  const candidatePool = reachableTiles.slice(1);
  // Shuffle candidate pool with seeded RNG
  for (let i = candidatePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidatePool[i];
    candidatePool[i] = candidatePool[j];
    candidatePool[j] = tmp;
  }

  const keys: MazeKeyObject[] = [];
  const minKeySeparation = Math.max(2, Math.floor(width / (keyCount + 2)));

  for (const cand of candidatePool) {
    if (keys.length >= keyCount) break;
    if (cand.x === exitTile.x && cand.y === exitTile.y) continue;
    const tooClose = keys.some(
      (k) => Math.abs(k.tileX - cand.x) + Math.abs(k.tileY - cand.y) < minKeySeparation
    );
    if (!tooClose) {
      const kType = keyTypesOrder[keys.length % keyTypesOrder.length];
      keys.push({
        id: `key-${keys.length + 1}`,
        type: kType,
        tileX: cand.x,
        tileY: cand.y,
        x: cand.x * tileSize + tileSize / 2,
        y: cand.y * tileSize + tileSize / 2,
        collectedBy: null,
        collectedByPlayers: [],
        collectedByTeams: [],
      });
    }
  }

  // Fallback if minKeySeparation was too strict for high keyCount on small map
  if (keys.length < keyCount) {
    for (const cand of candidatePool) {
      if (keys.length >= keyCount) break;
      if (cand.x === exitTile.x && cand.y === exitTile.y) continue;
      if (!keys.some((k) => k.tileX === cand.x && k.tileY === cand.y)) {
        const kType = keyTypesOrder[keys.length % keyTypesOrder.length];
        keys.push({
          id: `key-${keys.length + 1}`,
          type: kType,
          tileX: cand.x,
          tileY: cand.y,
          x: cand.x * tileSize + tileSize / 2,
          y: cand.y * tileSize + tileSize / 2,
          collectedBy: null,
          collectedByPlayers: [],
          collectedByTeams: [],
        });
      }
    }
  }

  // 8. Place wall torches on wall tiles adjacent to walkable corridors
  const torches: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] === TileType.WALL && isWalkableTile(grid[y + 1]?.[x] ?? TileType.WALL)) {
        if ((x + y) % 5 === 0 && rng() < 0.45) {
          grid[y][x] = TileType.TORCH_WALL;
          torches.push({ x, y });
        }
      }
    }
  }

  // 9. Final verification check that every key + exitTile is reachable
  const allTargets = [exitTile, ...keys.map((k) => ({ x: k.tileX, y: k.tileY }))];
  const validation = validateMazeReachability(grid, spawnTile, allTargets);
  if (!validation.valid) {
    // Carve direct safety corridor if needed (guaranteed fallback)
    for (const t of allTargets) {
      let cx = spawnTile.x;
      let cy = spawnTile.y;
      while (cx !== t.x) {
        cx += cx < t.x ? 1 : -1;
        if (grid[cy][cx] === TileType.WALL || grid[cy][cx] === TileType.TORCH_WALL) {
          grid[cy][cx] = TileType.FLOOR;
        }
      }
      while (cy !== t.y) {
        cy += cy < t.y ? 1 : -1;
        if (grid[cy][cx] === TileType.WALL || grid[cy][cx] === TileType.TORCH_WALL) {
          grid[cy][cx] = TileType.FLOOR;
        }
      }
    }
    grid[exitTile.y][exitTile.x] = TileType.EXIT_LOCKED;
  }

  return {
    seed,
    level,
    width,
    height,
    tileSize,
    grid,
    spawnTile,
    exitTile,
    keys,
    secretRooms,
    torches,
  };
}

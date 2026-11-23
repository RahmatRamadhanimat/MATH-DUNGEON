import { TileType } from './constants';
import { hasLineOfSight } from './lightingSystem';
import { GeneratedMaze, isWalkableTile } from './mazeGenerator';
import { isVictoryLobbyMaze } from './victoryLobbyMap';

export const MINIMAP_CELL_UNDISCOVERED = 0;
export const MINIMAP_CELL_DISCOVERED = 1;
export const MINIMAP_CELL_VISIBLE = 2;

export interface DiscoveredMinimapState {
  seed: number;
  width: number;
  height: number;
  cells: Uint8Array;
  discoveredRoomIndices: Set<number>;
  discoveredWalkableCount: number;
  totalWalkableCount: number;
}

export interface MinimapUpdateSummary {
  changed: boolean;
  discoveryPercent: number;
  discoveredRoomsCount: number;
  totalRoomsCount: number;
}

export function createDiscoveredMinimapState(maze: GeneratedMaze): DiscoveredMinimapState {
  let totalWalkableCount = 0;
  const cells = new Uint8Array(maze.width * maze.height);
  const discoveredRoomIndices = new Set<number>();
  const isLobby = isVictoryLobbyMaze(maze);

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (isWalkableTile(maze.grid[y][x])) {
        totalWalkableCount++;
        if (isLobby) {
          cells[y * maze.width + x] = MINIMAP_CELL_VISIBLE;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const wx = x + dx;
              const wy = y + dy;
              if (wx >= 0 && wx < maze.width && wy >= 0 && wy < maze.height) {
                const wIdx = wy * maze.width + wx;
                if (cells[wIdx] === 0) cells[wIdx] = MINIMAP_CELL_DISCOVERED;
              }
            }
          }
        }
      }
    }
  }

  if (isLobby) {
    maze.secretRooms.forEach((_, idx) => discoveredRoomIndices.add(idx));
  }

  return {
    seed: maze.seed,
    width: maze.width,
    height: maze.height,
    cells,
    discoveredRoomIndices,
    discoveredWalkableCount: isLobby ? Math.max(1, totalWalkableCount) : 0,
    totalWalkableCount: Math.max(1, totalWalkableCount),
  };
}

export function getMinimapCellState(
  state: DiscoveredMinimapState,
  x: number,
  y: number
): number {
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) {
    return MINIMAP_CELL_UNDISCOVERED;
  }
  return state.cells[y * state.width + x];
}

export function updateDiscoveredMinimap(
  state: DiscoveredMinimapState,
  maze: GeneratedMaze,
  playerX: number,
  playerY: number,
  tileSize = 32,
  visionRadiusTiles = 8
): MinimapUpdateSummary {
  if (isVictoryLobbyMaze(maze)) {
    return {
      changed: false,
      discoveryPercent: 100,
      discoveredRoomsCount: maze.secretRooms.length,
      totalRoomsCount: maze.secretRooms.length,
    };
  }

  let changed = false;

  // Demote previous frame's active-vision cells to discovered memory
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i] === MINIMAP_CELL_VISIBLE) {
      state.cells[i] = MINIMAP_CELL_DISCOVERED;
    }
  }

  const ptx = Math.floor(playerX / tileSize);
  const pty = Math.floor(playerY / tileSize);

  const minX = Math.max(0, ptx - visionRadiusTiles);
  const maxX = Math.min(maze.width - 1, ptx + visionRadiusTiles);
  const minY = Math.max(0, pty - visionRadiusTiles);
  const maxY = Math.min(maze.height - 1, pty + visionRadiusTiles);

  const visibleWalkable: Array<{ x: number; y: number }> = [];

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dist = Math.hypot(tx - ptx, ty - pty);
      if (dist > visionRadiusTiles) continue;

      const tile = maze.grid[ty][tx];
      const walkable = isWalkableTile(tile);
      if (!walkable) continue;

      const targetWorldX = (tx + 0.5) * tileSize;
      const targetWorldY = (ty + 0.5) * tileSize;
      const canSee =
        dist <= 2.2 ||
        hasLineOfSight(maze.grid, playerX, playerY, targetWorldX, targetWorldY, tileSize);

      if (canSee) {
        const idx = ty * maze.width + tx;
        if (state.cells[idx] === MINIMAP_CELL_UNDISCOVERED) {
          state.discoveredWalkableCount++;
          changed = true;
        }
        state.cells[idx] = MINIMAP_CELL_VISIBLE;
        visibleWalkable.push({ x: tx, y: ty });
      }
    }
  }

  // Reveal bounding walls immediately adjacent to any visible walkable tile so corridor & room walls are crisp
  for (const pos of visibleWalkable) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const wx = pos.x + dx;
        const wy = pos.y + dy;
        if (wx < 0 || wx >= maze.width || wy < 0 || wy >= maze.height) continue;
        const wIdx = wy * maze.width + wx;
        if (state.cells[wIdx] === MINIMAP_CELL_UNDISCOVERED) {
          changed = true;
        }
        if (state.cells[wIdx] < MINIMAP_CELL_VISIBLE) {
          state.cells[wIdx] = MINIMAP_CELL_VISIBLE;
        }
      }
    }
  }

  // When a player enters or glimpses any tile of a secret room, reveal that entire room's layout + walls
  maze.secretRooms.forEach((room, roomIdx) => {
    let roomTouched = state.discoveredRoomIndices.has(roomIdx);
    if (!roomTouched) {
      for (let ry = room.y; ry < room.y + room.height && !roomTouched; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (ry >= 0 && ry < maze.height && rx >= 0 && rx < maze.width) {
            const cState = state.cells[ry * maze.width + rx];
            if (
              cState !== MINIMAP_CELL_UNDISCOVERED &&
              maze.grid[ry][rx] === TileType.SECRET_FLOOR
            ) {
              roomTouched = true;
              break;
            }
          }
        }
      }
    }

    if (roomTouched) {
      if (!state.discoveredRoomIndices.has(roomIdx)) {
        state.discoveredRoomIndices.add(roomIdx);
        changed = true;
      }
      const rMinY = Math.max(0, room.y - 1);
      const rMaxY = Math.min(maze.height - 1, room.y + room.height);
      const rMinX = Math.max(0, room.x - 1);
      const rMaxX = Math.min(maze.width - 1, room.x + room.width);

      for (let ry = rMinY; ry <= rMaxY; ry++) {
        for (let rx = rMinX; rx <= rMaxX; rx++) {
          const idx = ry * maze.width + rx;
          if (state.cells[idx] === MINIMAP_CELL_UNDISCOVERED) {
            if (isWalkableTile(maze.grid[ry][rx])) {
              state.discoveredWalkableCount++;
            }
            state.cells[idx] = MINIMAP_CELL_DISCOVERED;
            changed = true;
          }
        }
      }
    }
  });

  const discoveryPercent = Math.min(
    100,
    Math.max(1, Math.round((state.discoveredWalkableCount / state.totalWalkableCount) * 100))
  );

  return {
    changed,
    discoveryPercent,
    discoveredRoomsCount: state.discoveredRoomIndices.size,
    totalRoomsCount: maze.secretRooms.length,
  };
}

export type MinimapViewMode = 'full' | 'radar';

export interface MinimapViewport {
  startX: number;
  startY: number;
  spanX: number;
  spanY: number;
  isZoomed: boolean;
}

/**
 * Computes the tile-space viewport window rendered by the mini-map.
 * - In 'full' mode, displays the entire maze.
 * - In 'radar' mode, displays a zoomed local window centered on the player/camera focus,
 *   clamped cleanly to maze boundaries so large mazes (55x55, 65x65, 75x75) stay legible.
 */
export function computeMinimapViewport(options: {
  mazeWidth: number;
  mazeHeight: number;
  focusTileX: number;
  focusTileY: number;
  viewMode: MinimapViewMode;
  radarSpanTiles?: number;
}): MinimapViewport {
  const { mazeWidth, mazeHeight, focusTileX, focusTileY, viewMode } = options;
  const targetSpan = Math.max(15, options.radarSpanTiles ?? 25);

  if (viewMode === 'full' || (mazeWidth <= targetSpan && mazeHeight <= targetSpan)) {
    return {
      startX: 0,
      startY: 0,
      spanX: mazeWidth,
      spanY: mazeHeight,
      isZoomed: false,
    };
  }

  const spanX = Math.min(mazeWidth, targetSpan);
  const spanY = Math.min(mazeHeight, targetSpan);
  const halfX = spanX / 2;
  const halfY = spanY / 2;

  const startX = Math.max(0, Math.min(mazeWidth - spanX, focusTileX - halfX));
  const startY = Math.max(0, Math.min(mazeHeight - spanY, focusTileY - halfY));

  return {
    startX,
    startY,
    spanX,
    spanY,
    isZoomed: true,
  };
}

/**
 * Converts a normalized click ratio [0..1] on the mini-map canvas back to world pixel coordinates,
 * accurately respecting both full-map and zoomed radar viewports.
 */
export function minimapPixelToWorldCoord(options: {
  clickRatioX: number;
  clickRatioY: number;
  viewport: MinimapViewport;
  tileSize: number;
  mazeWidth: number;
  mazeHeight: number;
}): { x: number; y: number } {
  const rx = Math.max(0, Math.min(1, options.clickRatioX));
  const ry = Math.max(0, Math.min(1, options.clickRatioY));
  const tileX = options.viewport.startX + rx * options.viewport.spanX;
  const tileY = options.viewport.startY + ry * options.viewport.spanY;

  return {
    x: Math.max(0, Math.min(options.mazeWidth * options.tileSize, tileX * options.tileSize)),
    y: Math.max(0, Math.min(options.mazeHeight * options.tileSize, tileY * options.tileSize)),
  };
}

export interface ObjectiveCompassInfo {
  label: string;
  directionLabel: string;
  distanceTiles: number;
  targetTileX: number;
  targetTileY: number;
  kind: 'key' | 'exit';
}

const COMPASS_DIRECTIONS = ['T', 'TG', 'S', 'BD', 'B', 'BL', 'U', 'TL'] as const;

/**
 * Computes direction & tile distance from the player to the nearest active objective
 * (either the nearest uncollected key or the unlocked Exit Door).
 */
export function getNearestObjectiveCompass(options: {
  playerTileX: number;
  playerTileY: number;
  isDoorOpen: boolean;
  exitTile: { x: number; y: number };
  availableKeys: Array<{ tileX: number; tileY: number }>;
}): ObjectiveCompassInfo | null {
  let targetX: number;
  let targetY: number;
  let kind: 'key' | 'exit';
  let label: string;

  if (options.isDoorOpen || options.availableKeys.length === 0) {
    targetX = options.exitTile.x;
    targetY = options.exitTile.y;
    kind = 'exit';
    label = options.isDoorOpen ? 'Exit Terbuka' : 'Pintu Keluar';
  } else {
    let best = options.availableKeys[0];
    let bestDist = Infinity;
    for (const k of options.availableKeys) {
      const d = Math.hypot(k.tileX - options.playerTileX, k.tileY - options.playerTileY);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    targetX = best.tileX;
    targetY = best.tileY;
    kind = 'key';
    label = 'Kunci Terdekat';
  }

  const dx = targetX - options.playerTileX;
  const dy = targetY - options.playerTileY;
  const distanceTiles = Math.round(Math.hypot(dx, dy));

  let directionLabel = 'Dekat';
  if (distanceTiles > 0) {
    const angle = Math.atan2(dy, dx); // 0 = East (T), PI/2 = South (S), -PI/2 = North (U)
    const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    directionLabel = COMPASS_DIRECTIONS[octant] ?? 'U';
  }

  return {
    label,
    directionLabel,
    distanceTiles,
    targetTileX: targetX,
    targetTileY: targetY,
    kind,
  };
}


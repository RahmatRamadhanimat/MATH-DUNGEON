import { TileType } from './constants';
import { hasLineOfSight } from './lightingSystem';
import { GeneratedMaze, isWalkableTile } from './mazeGenerator';

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
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (isWalkableTile(maze.grid[y][x])) {
        totalWalkableCount++;
      }
    }
  }

  return {
    seed: maze.seed,
    width: maze.width,
    height: maze.height,
    cells: new Uint8Array(maze.width * maze.height),
    discoveredRoomIndices: new Set<number>(),
    discoveredWalkableCount: 0,
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

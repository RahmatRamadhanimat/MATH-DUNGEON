import { TileType } from './constants';

export interface ShadowQuad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export function isOpaqueTile(
  tile: TileType,
  tileX: number,
  tileY: number,
  lightX: number,
  lightY: number,
  tileSize = 32
): boolean {
  if (tile === TileType.WALL || tile === TileType.TORCH_WALL) {
    return true;
  }
  if (tile === TileType.WOOD_DOOR) {
    const cx = tileX * tileSize + tileSize / 2;
    const cy = tileY * tileSize + tileSize / 2;
    const dist = Math.hypot(cx - lightX, cy - lightY);
    return dist > tileSize * 1.6;
  }
  return false;
}

/**
 * Checks if there is an unobstructed line of sight from (x0, y0) to (x1, y1)
 * without passing through opaque wall tiles.
 */
export function hasLineOfSight(
  grid: TileType[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize = 32
): boolean {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;

  const stepSize = Math.max(4, tileSize / 6);
  const steps = Math.ceil(dist / stepSize);
  const targetTx = Math.floor(x1 / tileSize);
  const targetTy = Math.floor(y1 / tileSize);

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const tx = Math.floor(px / tileSize);
    const ty = Math.floor(py / tileSize);

    if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
      return false;
    }
    if (tx === targetTx && ty === targetTy) {
      continue;
    }
    if (isOpaqueTile(grid[ty][tx], tx, ty, x0, y0, tileSize)) {
      return false;
    }
  }
  return true;
}

/**
 * Computes unified 2D cast-shadow quads from exposed silhouette edges of contiguous
 * multi-tile wall blocks within the player's light radius.
 * - Eliminates internal shared edges between adjacent opaque wall tiles so a multi-block wall
 *   never casts 1-block-by-1-block jagged triangular shadows onto itself or behind it.
 * - Merges contiguous horizontal/vertical exposed edges into continuous spans.
 * - Subdivides only wide-angle spans (>0.65 rad) during projection so long walls near the player
 *   never suffer inward chord sag.
 */
export function computeWallShadowQuads(params: {
  grid: TileType[][];
  width: number;
  height: number;
  tileSize: number;
  lightX: number;
  lightY: number;
  radius: number;
  shadowLength?: number;
}): ShadowQuad[] {
  const { grid, width, height, tileSize, lightX, lightY, radius } = params;
  const farDist = Math.max(params.shadowLength ?? radius * 1.8, radius * 2.2);
  const quads: ShadowQuad[] = [];

  const minTx = Math.max(0, Math.floor((lightX - radius - tileSize) / tileSize));
  const maxTx = Math.min(width - 1, Math.ceil((lightX + radius + tileSize) / tileSize));
  const minTy = Math.max(0, Math.floor((lightY - radius - tileSize) / tileSize));
  const maxTy = Math.min(height - 1, Math.ceil((lightY + radius + tileSize) / tileSize));

  const isOpaque = (tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
    return isOpaqueTile(grid[ty][tx], tx, ty, lightX, lightY, tileSize);
  };

  const projectVertex = (vx: number, vy: number): [number, number] => {
    const dx = vx - lightX;
    const dy = vy - lightY;
    const len = Math.max(1, Math.hypot(dx, dy));
    return [vx + (dx / len) * farDist, vy + (dy / len) * farDist];
  };

  // Emit one or more seamless quads along segment (ax, ay) -> (bx, by)
  const emitSegmentQuads = (ax: number, ay: number, bx: number, by: number) => {
    const adx = ax - lightX;
    const ady = ay - lightY;
    const bdx = bx - lightX;
    const bdy = by - lightY;
    const dot = adx * bdx + ady * bdy;
    const mags = Math.max(1e-6, Math.hypot(adx, ady) * Math.hypot(bdx, bdy));
    const cosAngle = Math.max(-1, Math.min(1, dot / mags));
    const angle = Math.acos(cosAngle);

    const splits = angle > 0.65 ? Math.min(6, Math.ceil(angle / 0.65)) : 1;
    for (let s = 0; s < splits; s++) {
      const t0 = s / splits;
      const t1 = (s + 1) / splits;
      const sx1 = ax + (bx - ax) * t0;
      const sy1 = ay + (by - ay) * t0;
      const sx2 = ax + (bx - ax) * t1;
      const sy2 = ay + (by - ay) * t1;
      const [x3, y3] = projectVertex(sx2, sy2);
      const [x4, y4] = projectVertex(sx1, sy1);
      quads.push({ x1: sx1, y1: sy1, x2: sx2, y2: sy2, x3, y3, x4, y4 });
    }
  };

  // 1. Horizontal Top & Bottom Exposed Silhouette Edges (merged across contiguous tx)
  for (let ty = minTy; ty <= maxTy; ty++) {
    const topY = ty * tileSize;
    const bottomY = topY + tileSize;

    // Top edge (normal 0, -1): back-facing when lightY > topY
    if (lightY > topY) {
      let tx = minTx;
      while (tx <= maxTx) {
        if (isOpaque(tx, ty) && !isOpaque(tx, ty - 1)) {
          const startTx = tx;
          while (tx + 1 <= maxTx && isOpaque(tx + 1, ty) && !isOpaque(tx + 1, ty - 1)) {
            tx++;
          }
          const xStart = startTx * tileSize;
          const xEnd = (tx + 1) * tileSize;
          const closestX = Math.max(xStart, Math.min(lightX, xEnd));
          if (Math.hypot(closestX - lightX, topY - lightY) <= radius + tileSize) {
            emitSegmentQuads(xStart, topY, xEnd, topY);
          }
        }
        tx++;
      }
    }

    // Bottom edge (normal 0, 1): back-facing when lightY < bottomY
    if (lightY < bottomY) {
      let tx = minTx;
      while (tx <= maxTx) {
        if (isOpaque(tx, ty) && !isOpaque(tx, ty + 1)) {
          const startTx = tx;
          while (tx + 1 <= maxTx && isOpaque(tx + 1, ty) && !isOpaque(tx + 1, ty + 1)) {
            tx++;
          }
          const xStart = startTx * tileSize;
          const xEnd = (tx + 1) * tileSize;
          const closestX = Math.max(xStart, Math.min(lightX, xEnd));
          if (Math.hypot(closestX - lightX, bottomY - lightY) <= radius + tileSize) {
            emitSegmentQuads(xEnd, bottomY, xStart, bottomY);
          }
        }
        tx++;
      }
    }
  }

  // 2. Vertical Left & Right Exposed Silhouette Edges (merged across contiguous ty)
  for (let tx = minTx; tx <= maxTx; tx++) {
    const leftX = tx * tileSize;
    const rightX = leftX + tileSize;

    // Left edge (normal -1, 0): back-facing when lightX > leftX
    if (lightX > leftX) {
      let ty = minTy;
      while (ty <= maxTy) {
        if (isOpaque(tx, ty) && !isOpaque(tx - 1, ty)) {
          const startTy = ty;
          while (ty + 1 <= maxTy && isOpaque(tx, ty + 1) && !isOpaque(tx - 1, ty + 1)) {
            ty++;
          }
          const yStart = startTy * tileSize;
          const yEnd = (ty + 1) * tileSize;
          const closestY = Math.max(yStart, Math.min(lightY, yEnd));
          if (Math.hypot(leftX - lightX, closestY - lightY) <= radius + tileSize) {
            emitSegmentQuads(leftX, yEnd, leftX, yStart);
          }
        }
        ty++;
      }
    }

    // Right edge (normal 1, 0): back-facing when lightX < rightX
    if (lightX < rightX) {
      let ty = minTy;
      while (ty <= maxTy) {
        if (isOpaque(tx, ty) && !isOpaque(tx + 1, ty)) {
          const startTy = ty;
          while (ty + 1 <= maxTy && isOpaque(tx, ty + 1) && !isOpaque(tx + 1, ty + 1)) {
            ty++;
          }
          const yStart = startTy * tileSize;
          const yEnd = (ty + 1) * tileSize;
          const closestY = Math.max(yStart, Math.min(lightY, yEnd));
          if (Math.hypot(rightX - lightX, closestY - lightY) <= radius + tileSize) {
            emitSegmentQuads(rightX, yStart, rightX, yEnd);
          }
        }
        ty++;
      }
    }
  }

  return quads;
}

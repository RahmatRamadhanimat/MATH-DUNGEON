import {
  CHARACTER_PRESETS,
  Direction,
  KEY_TYPES_INFO,
  KeyType,
  MazeBiomeId,
  PlayerAnimState,
  TileType,
} from '../../shared/constants';
import { DEFAULT_MAZE_BIOME, getMazeBiomeTheme } from '../../shared/biomeThemes';
import { MysteryPowerUpType } from '../../shared/mysteryChests';

const tileCache = new Map<string, HTMLCanvasElement>();
const characterSpriteCache = new Map<string, HTMLCanvasElement>();
const avatarDataUrlCache = new Map<string, string>();

function createPixelCanvas(width = 32, height = 32): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Helper to draw a 2x2 pixel block on a 32x32 canvas (representing 1 pixel in a 16x16 art grid for tiles/keys)
 */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
}

/**
 * High-resolution 1x1 pixel helper on a 32x32 canvas for 16-bit JRPG character sprites
 */
function p1(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * Computes darker and lighter shades from a hex color (#RRGGBB) for 16-bit pixel shading
 */
export function shadeHexColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return hex;
  const ratio = Math.abs(percent) > 1 ? percent / 100 : percent;
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * (1 + ratio))));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * (1 + ratio))));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * (1 + ratio))));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

export function getTileSprite(
  tile: TileType,
  frame = 0,
  variant = 0,
  biome: MazeBiomeId = DEFAULT_MAZE_BIOME
): HTMLCanvasElement {
  const animFrame =
    tile === TileType.TORCH_WALL ||
    tile === TileType.CRYSTAL_DECOR ||
    tile === TileType.EXIT_OPEN ||
    tile === TileType.PORTAL_SPAWN
      ? frame % 4
      : 0;
  const tileVariant = Math.abs(variant) % 4;
  const theme = getMazeBiomeTheme(biome);
  const t = theme.tiles;
  const key = `v4:${theme.id}:${tile}:${animFrame}:${tileVariant}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createPixelCanvas(32, 32);

  // Base floor for non-wall tiles (Rich 32x32 16-bit Biome Paving & Secret Sanctum Floor)
  if (tile !== TileType.WALL && tile !== TileType.TORCH_WALL) {
    const isSecret =
      tile === TileType.SECRET_FLOOR ||
      tile === TileType.CHEST_DECOR ||
      tile === TileType.CRYSTAL_DECOR;

    if (isSecret) {
      // Biome Secret Chamber / Sanctum Floor
      p1(ctx, 0, 0, t.secretOuter, 32, 32);
      p1(ctx, 1, 1, t.secretFrameMid, 30, 30);
      p1(ctx, 2, 2, t.secretFrameLight, 28, 28);
      p1(ctx, 4, 4, tileVariant % 2 === 0 ? t.secretCarpetEven : t.secretCarpetOdd, 24, 24);
      p1(ctx, 5, 5, tileVariant % 2 === 0 ? t.secretInnerEven : t.secretInnerOdd, 22, 22);
      // Ornate filigree border
      p1(ctx, 3, 3, t.secretTrimLight, 26, 1);
      p1(ctx, 3, 28, t.secretTrimDark, 26, 1);
      p1(ctx, 3, 3, t.secretTrimLight, 1, 26);
      p1(ctx, 28, 3, t.secretTrimDark, 1, 26);
      // Corner studs
      p1(ctx, 3, 3, t.secretStud, 2, 2);
      p1(ctx, 27, 3, t.secretStud, 2, 2);
      p1(ctx, 3, 27, t.secretStud, 2, 2);
      p1(ctx, 27, 27, t.secretStud, 2, 2);
      // Center geometric diamond motif
      p1(ctx, 15, 13, t.secretMotif, 2, 6);
      p1(ctx, 13, 15, t.secretMotif, 6, 2);
      if (tileVariant === 1 || tileVariant === 3) {
        p1(ctx, 15, 15, t.secretCenterGem, 2, 2);
      }
    } else {
      // Biome Corridor Paving: 32x32 16-bit Sculpted Flagstone Slabs with 4 Seamless Variants
      p1(ctx, 0, 0, t.floorMortar, 32, 32);

      // Top-left slab (14x14)
      const tlBase = tileVariant === 1 ? t.floorSlabB : t.floorSlabA;
      p1(ctx, 1, 1, tlBase, 14, 14);
      p1(ctx, 1, 1, t.floorBevelLight, 13, 1);
      p1(ctx, 1, 2, t.floorBevelLight, 1, 12);
      p1(ctx, 2, 14, t.floorBevelShadow, 13, 1);
      p1(ctx, 14, 2, t.floorBevelShadow, 1, 13);

      // Top-right slab (15x14)
      const trBase = tileVariant === 2 ? t.floorSlabB : t.floorSlabC;
      p1(ctx, 16, 1, trBase, 15, 14);
      p1(ctx, 16, 1, t.floorBevelLightAlt, 14, 1);
      p1(ctx, 16, 2, t.floorBevelLightAlt, 1, 12);
      p1(ctx, 17, 14, t.floorBevelShadow, 14, 1);

      // Bottom-left slab (9x15)
      p1(ctx, 1, 16, t.floorSlabD, 9, 15);
      p1(ctx, 1, 16, t.floorBevelLight, 8, 1);
      p1(ctx, 1, 17, t.floorBevelLight, 1, 13);
      p1(ctx, 2, 30, t.floorBevelShadow, 8, 1);

      // Bottom-right wide slab (20x15)
      const brBase = tileVariant === 3 ? t.floorSlabB : t.floorSlabA;
      p1(ctx, 11, 16, brBase, 20, 15);
      p1(ctx, 11, 16, t.floorBevelLight, 19, 1);
      p1(ctx, 11, 17, t.floorBevelLight, 1, 13);
      p1(ctx, 12, 30, t.floorBevelShadow, 19, 1);

      // Biome & variant-specific architectural floor details
      if (theme.id === 'crystal_forest') {
        if (tileVariant === 0) {
          // Soft emerald moss tuft in mortar seam
          p1(ctx, 14, 14, '#15803D', 3, 2);
          p1(ctx, 15, 13, '#4ADE80', 2, 1);
        } else if (tileVariant === 1) {
          // Tiny glowing teal crystal shard in floor crevice
          p1(ctx, 6, 7, '#0F766E', 3, 2);
          p1(ctx, 7, 6, t.floorAccent1, 2, 2);
          p1(ctx, 22, 21, t.floorAccent2, 2, 2);
        } else if (tileVariant === 2) {
          // Bioluminescent spore specks
          p1(ctx, 19, 6, t.floorAccent1, 2, 1);
          p1(ctx, 13, 24, '#22C55E', 3, 2);
          p1(ctx, 14, 23, '#86EFAC', 1, 1);
        } else {
          // Root vine across bottom stone
          p1(ctx, 16, 22, '#14532D', 7, 2);
          p1(ctx, 17, 21, '#22C55E', 4, 1);
        }
      } else if (theme.id === 'desert_temple') {
        if (tileVariant === 0) {
          // Wind-blown golden sand drift
          p1(ctx, 4, 12, '#D9A760', 6, 2);
          p1(ctx, 6, 11, '#FDE68A', 3, 1);
          p1(ctx, 20, 26, '#C28F4A', 7, 2);
        } else if (tileVariant === 1) {
          // Carved turquoise scarab inlay
          p1(ctx, 19, 21, '#92400E', 4, 4);
          p1(ctx, 20, 22, t.floorAccent2, 2, 2);
        } else if (tileVariant === 2) {
          // Sun-baked sandstone hairline crack
          p1(ctx, 19, 5, t.floorDetailDark, 1, 4);
          p1(ctx, 20, 8, t.floorDetailDark, 3, 1);
          p1(ctx, 5, 22, '#D9A760', 3, 1);
        } else {
          // Ancient gold floor glyph
          p1(ctx, 18, 21, '#B45309', 5, 3);
          p1(ctx, 19, 22, '#FACC15', 3, 1);
        }
      } else if (theme.id === 'ice_fortress') {
        if (tileVariant === 0) {
          // Specular glacier ice sheen diagonal
          p1(ctx, 4, 5, '#7DD3FC', 4, 1);
          p1(ctx, 5, 6, '#BAE6FD', 3, 1);
          p1(ctx, 21, 22, '#7DD3FC', 5, 1);
        } else if (tileVariant === 1) {
          // Frosted snow-crystal flake
          p1(ctx, 7, 6, '#E0F2FE', 1, 3);
          p1(ctx, 6, 7, '#E0F2FE', 3, 1);
          p1(ctx, 22, 21, '#7DD3FC', 2, 2);
        } else if (tileVariant === 2) {
          // Deep glacial ice fissure
          p1(ctx, 19, 4, '#0C1E2E', 1, 5);
          p1(ctx, 20, 8, '#0C1E2E', 3, 1);
          p1(ctx, 20, 7, '#BAE6FD', 2, 1);
        } else {
          // Shimmering prism frost glint
          p1(ctx, 19, 21, '#38BDF8', 3, 3);
          p1(ctx, 20, 22, '#FFFFFF', 1, 1);
        }
      } else {
        // Classic Stone Dungeon details
        if (tileVariant === 0) {
          p1(ctx, 5, 6, t.floorDetailDark, 3, 1);
          p1(ctx, 21, 22, t.floorDetailDark, 4, 1);
          p1(ctx, 22, 23, t.floorBevelLight, 3, 1);
        } else if (tileVariant === 1) {
          p1(ctx, 7, 7, '#3B4252', 2, 2);
          p1(ctx, 15, 15, t.floorAccent1, 2, 2);
          p1(ctx, 16, 14, '#22C55E', 1, 1);
        } else if (tileVariant === 2) {
          p1(ctx, 19, 5, t.floorDetailDark, 1, 3);
          p1(ctx, 20, 7, t.floorDetailDark, 2, 1);
          p1(ctx, 15, 24, t.floorBevelLight, 4, 1);
        } else {
          p1(ctx, 20, 22, '#78350F', 3, 3);
          p1(ctx, 21, 23, t.floorAccent2, 1, 1);
        }
      }
    }
  }

  switch (tile) {
    case TileType.WALL:
    case TileType.TORCH_WALL: {
      // 32x32 2.5D 16-bit Biome Wall Masonry (Cornice Cap + Sculpted Blocks + Base Plinth)
      p1(ctx, 0, 0, t.wallMortar, 32, 32);

      // 1. Top Roof Cornice Cap (y: 0..6)
      p1(ctx, 0, 0, t.wallCorniceTop, 32, 2);
      p1(ctx, 1, 2, t.wallCorniceBody, 14, 4);
      p1(ctx, 16, 2, t.wallCorniceBody, 15, 4);
      p1(ctx, 2, 2, t.wallCorniceHighlight, 12, 1);
      p1(ctx, 17, 2, t.wallCorniceHighlight, 13, 1);
      p1(ctx, 0, 6, t.wallCorniceShadow, 32, 1);

      // 2. Upper Brick Course (y: 7..14)
      p1(ctx, 1, 7, t.wallUpperA, 9, 7);
      p1(ctx, 2, 7, t.wallUpperHiA, 7, 1);
      p1(ctx, 11, 7, t.wallUpperB, 11, 7);
      p1(ctx, 12, 7, t.wallUpperHiB, 9, 1);
      p1(ctx, 23, 7, t.wallUpperA, 8, 7);
      p1(ctx, 24, 7, t.wallUpperHiA, 6, 1);

      // 3. Middle Brick Course (y: 15..22)
      p1(ctx, 1, 15, t.wallMidA, 14, 7);
      p1(ctx, 2, 15, t.wallMidHi, 12, 1);
      p1(ctx, 16, 15, t.wallMidB, 15, 7);
      p1(ctx, 17, 15, t.wallUpperHiB, 13, 1);

      // 4. Lower Base Plinth Course (y: 23..28)
      p1(ctx, 1, 23, t.wallPlinthA, 8, 5);
      p1(ctx, 10, 23, t.wallPlinthB, 12, 5);
      p1(ctx, 23, 23, t.wallPlinthA, 8, 5);
      p1(ctx, 2, 23, t.wallPlinthHi, 6, 1);
      p1(ctx, 11, 23, t.wallPlinthHi, 10, 1);

      // 5. Deep Ground Occlusion Shadow (y: 29..31)
      p1(ctx, 0, 29, t.wallGroundShadow, 32, 3);

      // Biome-specific signature wall architecture (makes every biome unmistakable at a glance)
      if (theme.id === 'crystal_forest') {
        // Hanging emerald moss overhang on top cornice
        p1(ctx, 3, 5, '#16A34A', 5, 2);
        p1(ctx, 4, 7, '#15803D', 3, 2);
        p1(ctx, 22, 5, '#22C55E', 6, 2);
        p1(ctx, 24, 7, '#16A34A', 3, 3);
        if (tile === TileType.WALL && (tileVariant === 1 || tileVariant === 3)) {
          // Embedded glowing amethyst/cyan crystal cluster protruding from mossy wall
          p1(ctx, 6, 16, t.wallOrnamentDark, 5, 7);
          p1(ctx, 7, 14, t.wallOrnamentMid, 3, 8);
          p1(ctx, 8, 15, t.wallOrnamentBright, 1, 5);
          p1(ctx, 22, 18, '#0F766E', 4, 6);
          p1(ctx, 23, 17, '#2DD4BF', 2, 5);
        } else if (tile === TileType.WALL && tileVariant === 2) {
          // Creeping vine & bioluminescent buds
          p1(ctx, 13, 8, '#15803D', 2, 16);
          p1(ctx, 12, 12, '#4ADE80', 4, 2);
          p1(ctx, 14, 18, '#5EEAD4', 2, 2);
        }
      } else if (theme.id === 'desert_temple') {
        // Golden temple frieze stripe under cornice
        p1(ctx, 1, 6, '#B45309', 30, 1);
        p1(ctx, 3, 6, '#FACC15', 4, 1);
        p1(ctx, 14, 6, '#FACC15', 4, 1);
        p1(ctx, 25, 6, '#FACC15', 4, 1);
        if (tile === TileType.WALL && (tileVariant === 1 || tileVariant === 2)) {
          // Carved turquoise & gold pharaoh hieroglyph band
          p1(ctx, 3, 17, '#5C3919', 26, 4);
          p1(ctx, 5, 18, t.wallOrnamentBright, 3, 2);
          p1(ctx, 10, 18, t.wallOrnamentMid, 4, 2);
          p1(ctx, 16, 18, t.wallOrnamentBright, 2, 2);
          p1(ctx, 20, 18, t.wallOrnamentMid, 4, 2);
          p1(ctx, 26, 18, t.wallOrnamentBright, 2, 2);
        } else if (tile === TileType.WALL && tileVariant === 3) {
          // Sun-weathered sandstone notch
          p1(ctx, 15, 9, t.wallMortar, 2, 5);
          p1(ctx, 24, 24, '#D9A760', 5, 3);
        }
      } else if (theme.id === 'ice_fortress') {
        // Hanging translucent glacial icicles along the cornice lip!
        p1(ctx, 4, 6, '#BAE6FD', 2, 4);
        p1(ctx, 4, 10, '#E0F2FE', 1, 2);
        p1(ctx, 15, 6, '#E0F2FE', 3, 3);
        p1(ctx, 16, 9, '#7DD3FC', 1, 3);
        p1(ctx, 26, 6, '#BAE6FD', 2, 5);
        p1(ctx, 27, 11, '#FFFFFF', 1, 2);
        if (tile === TileType.WALL && (tileVariant === 1 || tileVariant === 2)) {
          // Diagonal frost refraction sheen across glacial bricks
          p1(ctx, 5, 16, '#7DD3FC', 5, 1);
          p1(ctx, 6, 17, '#E0F2FE', 4, 1);
          p1(ctx, 19, 18, '#7DD3FC', 6, 1);
          p1(ctx, 20, 19, '#BAE6FD', 4, 1);
        }
      } else {
        // Classic Stone Dungeon variant wall details
        if (tileVariant === 1 && tile === TileType.WALL) {
          p1(ctx, 3, 25, t.wallOrnamentDark, 4, 3);
          p1(ctx, 4, 24, t.wallOrnamentMid, 3, 2);
          p1(ctx, 5, 23, t.wallOrnamentBright, 1, 1);
        } else if (tileVariant === 2 && tile === TileType.WALL) {
          p1(ctx, 4, 18, '#78350F', 8, 2);
          p1(ctx, 5, 18, '#D97706', 6, 1);
          p1(ctx, 19, 18, '#78350F', 8, 2);
          p1(ctx, 20, 18, '#D97706', 6, 1);
        } else if (tileVariant === 3 && tile === TileType.WALL) {
          p1(ctx, 14, 9, '#0F172A', 1, 5);
          p1(ctx, 15, 12, '#0F172A', 2, 1);
        }
      }

      if (tile === TileType.TORCH_WALL) {
        // Biome Wall Light Fixture (Torch / Crystal Lantern / Solar Brazier / Frost Lantern)
        p1(ctx, 13, 18, t.sconceDark, 6, 9);
        p1(ctx, 14, 19, t.sconceBody, 4, 7);
        p1(ctx, 12, 16, t.sconceBracketDark, 8, 3);
        p1(ctx, 13, 16, t.sconceBracketBright, 6, 2);

        // Multi-layered flickering flame or pulsing crystal/frost light
        const shiftX = animFrame === 1 ? -1 : animFrame === 3 ? 1 : 0;
        const stretchY = animFrame % 2 === 0 ? 0 : -1;
        p1(ctx, 12 + shiftX, 8 + stretchY, t.flameOuter, 8, 8);
        p1(ctx, 13 + shiftX, 6 + stretchY, t.flameMid, 6, 9);
        p1(ctx, 14 + shiftX, 7 + stretchY, t.flameInner, 4, 7);
        p1(ctx, 15, 10, t.flameCore, 2, 4);
        p1(ctx, 15, 11, '#FFFFFF', 2, 2);

        if (animFrame === 0 || animFrame === 2) {
          p1(ctx, 12, 4, t.spark1, 2, 2);
          p1(ctx, 18, 5, t.spark2, 1, 1);
        } else {
          p1(ctx, 14, 3, t.flameCore, 2, 2);
          p1(ctx, 11, 6, t.spark1, 1, 1);
        }
      }
      break;
    }

    case TileType.CHEST_DECOR: {
      // 32x32 Ornate Royal Treasure Chest on Pedestal Mat
      p1(ctx, 5, 9, '#090D16', 22, 16);
      p1(ctx, 6, 10, '#78350F', 20, 6);
      p1(ctx, 7, 11, '#B45309', 18, 4);
      p1(ctx, 8, 11, '#D97706', 16, 2);
      p1(ctx, 6, 17, '#451A03', 20, 7);
      p1(ctx, 7, 18, '#92400E', 18, 5);
      p1(ctx, 9, 10, '#FACC15', 2, 14);
      p1(ctx, 21, 10, '#FACC15', 2, 14);
      p1(ctx, 6, 15, '#F59E0B', 20, 2);
      p1(ctx, 14, 14, '#FDE047', 4, 5);
      p1(ctx, 15, 15, '#EF4444', 2, 3);
      break;
    }

    case TileType.CRYSTAL_DECOR: {
      // 32x32 Biome-Tuned Arcane Floating Crystal Cluster
      const pulse = animFrame % 2 === 0;
      const cMain = pulse ? t.crystalMainA : t.crystalMainB;
      const cBright = pulse ? t.crystalBrightA : t.crystalBrightB;
      p1(ctx, 7, 22, t.crystalBaseDark, 18, 6);
      p1(ctx, 8, 23, t.crystalBaseLight, 16, 4);
      p1(ctx, 8, 12, t.crystalSpireDark, 5, 11);
      p1(ctx, 9, 13, cMain, 3, 9);
      p1(ctx, 10, 14, cBright, 1, 6);
      p1(ctx, 19, 11, t.crystalSpireDark, 5, 12);
      p1(ctx, 20, 12, cMain, 3, 10);
      p1(ctx, 21, 13, cBright, 1, 7);
      p1(ctx, 13, 5, t.crystalSpireDark, 6, 19);
      p1(ctx, 14, 6, cMain, 4, 17);
      p1(ctx, 15, 7, cBright, 2, 14);
      p1(ctx, 15, 8, '#FFFFFF', 1, 6);
      if (pulse) {
        p1(ctx, 6, 8, t.crystalSpark, 2, 2);
        p1(ctx, 24, 7, cBright, 2, 2);
      } else {
        p1(ctx, 10, 4, cBright, 2, 2);
        p1(ctx, 22, 10, t.crystalSpark, 2, 2);
      }
      break;
    }

    case TileType.GRASS_DECOR: {
      // Biome-Adapted Courtyard Flora (Ferns / Glowing Crystals / Desert Oasis Palms / Frost Blooms)
      if (theme.id === 'desert_temple') {
        p1(ctx, 4, 19, '#92400E', 10, 7);
        p1(ctx, 5, 18, '#D97706', 8, 5);
        p1(ctx, 7, 15, '#15803D', 4, 6);
        p1(ctx, 8, 14, '#22C55E', 2, 4);
        p1(ctx, 18, 9, '#92400E', 10, 7);
        p1(ctx, 19, 8, '#F59E0B', 8, 5);
        p1(ctx, 21, 6, '#16A34A', 4, 5);
      } else if (theme.id === 'ice_fortress') {
        p1(ctx, 4, 18, '#0284C7', 9, 8);
        p1(ctx, 5, 17, '#38BDF8', 7, 6);
        p1(ctx, 6, 16, '#E0F2FE', 4, 3);
        p1(ctx, 18, 8, '#0284C7', 9, 8);
        p1(ctx, 19, 7, '#7DD3FC', 7, 6);
        p1(ctx, 20, 6, '#FFFFFF', 4, 3);
      } else {
        p1(ctx, 4, 18, '#14532D', 9, 8);
        p1(ctx, 5, 17, '#16A34A', 7, 6);
        p1(ctx, 6, 16, '#4ADE80', 4, 3);
        p1(ctx, 18, 8, '#14532D', 9, 8);
        p1(ctx, 19, 7, '#16A34A', 7, 6);
        p1(ctx, 20, 6, '#4ADE80', 4, 3);
        p1(ctx, 12, 22, '#15803D', 8, 5);
        p1(ctx, 13, 21, '#22C55E', 6, 3);
        p1(ctx, 7, 17, theme.id === 'crystal_forest' ? '#5EEAD4' : '#FACC15', 2, 2);
        p1(ctx, 21, 8, theme.id === 'crystal_forest' ? '#E879F9' : '#F472B6', 2, 2);
      }
      break;
    }

    case TileType.TRAP_DECOR: {
      // 32x32 Ornate Compass Rose & Floor Medallion (Walkable Landmark Mosaic)
      p1(ctx, 4, 4, t.wallMortar, 24, 24);
      p1(ctx, 5, 5, t.floorSlabB, 22, 22);
      p1(ctx, 6, 6, t.secretTrimDark, 20, 20);
      p1(ctx, 7, 7, t.floorSlabA, 18, 18);
      p1(ctx, 15, 5, t.secretStud, 2, 22);
      p1(ctx, 5, 15, t.secretStud, 22, 2);
      p1(ctx, 10, 10, t.secretTrimLight, 12, 12);
      p1(ctx, 11, 11, t.floorSlabB, 10, 10);
      p1(ctx, 13, 13, t.secretTrimLight, 6, 6);
      p1(ctx, 14, 14, theme.accentHex, 4, 4);
      p1(ctx, 15, 15, '#FFFFFF', 2, 2);
      break;
    }

    case TileType.WOOD_DOOR: {
      // 32x32 Biome-Styled Threshold Archway (Walkable Room Entrance)
      p1(ctx, 0, 0, t.doorDark, 6, 32);
      p1(ctx, 26, 0, t.doorDark, 6, 32);
      p1(ctx, 1, 1, t.doorMid, 4, 30);
      p1(ctx, 27, 1, t.doorMid, 4, 30);
      p1(ctx, 2, 2, t.doorLight, 2, 28);
      p1(ctx, 28, 2, t.doorLight, 2, 28);
      p1(ctx, 0, 0, t.doorLintelDark, 32, 5);
      p1(ctx, 1, 1, t.doorLintelMid, 30, 3);
      p1(ctx, 6, 2, t.doorStud, 2, 2);
      p1(ctx, 15, 2, t.doorStud, 2, 2);
      p1(ctx, 24, 2, t.doorStud, 2, 2);
      p1(ctx, 6, 14, t.doorThresholdDark, 20, 4);
      p1(ctx, 7, 15, t.doorThresholdLight, 18, 2);
      break;
    }

    case TileType.PORTAL_SPAWN: {
      // 32x32 Grand Arcane Teleportation Circle
      const pulse = animFrame % 2 === 0;
      const ringColor = pulse ? '#38BDF8' : '#818CF8';
      const coreColor = pulse ? '#BAE6FD' : '#C7D2FE';
      p1(ctx, 3, 3, '#0F172A', 26, 26);
      p1(ctx, 4, 4, '#1E3A8A', 24, 24);
      p1(ctx, 6, 6, ringColor, 20, 20);
      p1(ctx, 8, 8, '#172554', 16, 16);
      p1(ctx, 15, 4, coreColor, 2, 24);
      p1(ctx, 4, 15, coreColor, 24, 2);
      p1(ctx, 11, 11, ringColor, 10, 10);
      p1(ctx, 13, 13, coreColor, 6, 6);
      p1(ctx, 15, 15, '#FFFFFF', 2, 2);
      break;
    }

    case TileType.EXIT_LOCKED: {
      // 32x32 Heavy Fortress Portcullis Gate with Royal Padlock (Biome Archway Header)
      p1(ctx, 0, 0, t.wallMortar, 32, 32);
      p1(ctx, 0, 0, t.wallCorniceBody, 32, 6);
      p1(ctx, 2, 1, t.wallCorniceHighlight, 28, 2);
      for (let bx = 4; bx <= 26; bx += 5) {
        p1(ctx, bx, 6, '#334155', 3, 26);
        p1(ctx, bx, 6, '#94A3B8', 1, 26);
      }
      p1(ctx, 2, 11, '#475569', 28, 3);
      p1(ctx, 2, 22, '#475569', 28, 3);
      p1(ctx, 11, 12, '#090D16', 10, 12);
      p1(ctx, 13, 9, '#FACC15', 6, 4);
      p1(ctx, 14, 10, '#090D16', 4, 3);
      p1(ctx, 12, 13, '#DC2626', 8, 10);
      p1(ctx, 13, 14, '#EF4444', 6, 8);
      p1(ctx, 15, 16, '#FEF08A', 2, 4);
      break;
    }

    case TileType.EXIT_OPEN: {
      // 32x32 Illuminated Emerald Sanctuary Portal Archway (Biome Archway Frame)
      p1(ctx, 0, 0, t.wallMortar, 32, 32);
      p1(ctx, 0, 0, t.wallCorniceBody, 32, 6);
      p1(ctx, 2, 1, '#FACC15', 28, 2);
      p1(ctx, 0, 6, t.wallUpperA, 4, 26);
      p1(ctx, 28, 6, t.wallUpperA, 4, 26);
      const pulse = animFrame % 2 === 0;
      p1(ctx, 4, 6, '#064E3B', 24, 26);
      p1(ctx, 6, 8, pulse ? '#10B981' : '#059669', 20, 22);
      p1(ctx, 9, 11, pulse ? '#34D399' : '#6EE7B7', 14, 16);
      p1(ctx, 12, 14, '#A7F3D0', 8, 10);
      p1(ctx, 14, 16, '#ECFDF5', 4, 6);
      break;
    }

    default:
      break;
  }

  tileCache.set(key, canvas);
  return canvas;
}

export function getKeySprite(keyType: KeyType, frame = 0): HTMLCanvasElement {
  const animFrame = frame % 4;
  const cacheKey = `key:${keyType}:${animFrame}`;
  const cached = tileCache.get(cacheKey);
  if (cached) return cached;

  const { canvas, ctx } = createPixelCanvas(32, 32);
  const info = KEY_TYPES_INFO[keyType];
  const bobY = animFrame === 1 ? -1 : animFrame === 3 ? 1 : 0;

  // Key Bow (Ring)
  px(ctx, 5, 3 + bobY, '#0F172A', 6, 6);
  px(ctx, 6, 4 + bobY, info.color, 4, 4);
  px(ctx, 6, 4 + bobY, info.glow, 2, 1);
  px(ctx, 7, 5 + bobY, '#0F172A', 2, 2);

  // Key Shaft
  px(ctx, 7, 9 + bobY, '#0F172A', 3, 6);
  px(ctx, 7, 9 + bobY, info.color, 2, 5);
  px(ctx, 7, 9 + bobY, info.glow, 1, 5);

  // Key Teeth
  if (animFrame !== 2) {
    px(ctx, 9, 11 + bobY, info.color, 2, 1);
    px(ctx, 9, 13 + bobY, info.color, 3, 1);
  } else {
    // Spinning profile frame
    px(ctx, 6, 11 + bobY, info.glow, 2, 3);
  }

  // Sparkle pixels
  if (animFrame % 2 === 0) {
    px(ctx, 3, 3, '#FFFFFF', 1, 1);
    px(ctx, 12, 10, info.glow, 1, 1);
  } else {
    px(ctx, 12, 4, '#FFFFFF', 1, 1);
    px(ctx, 4, 12, info.glow, 1, 1);
  }

  tileCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Renders an animated 32x32 16-bit Mystery Treasure Chest sprite for Secret Rooms.
 * Closed chests pulse with arcane purple/gold runes and a floating sparkle; opened chests
 * reveal gleaming golden treasure inside.
 */
export function getMysteryChestSprite(
  rewardType: MysteryPowerUpType,
  opened: boolean,
  frame = 0
): HTMLCanvasElement {
  const animFrame = frame % 4;
  const cacheKey = `mystery_chest:${rewardType}:${opened ? 'open' : 'closed'}:${animFrame}`;
  const cached = tileCache.get(cacheKey);
  if (cached) return cached;

  const { canvas, ctx } = createPixelCanvas(32, 32);
  const bobY = !opened && (animFrame === 1 || animFrame === 3) ? -1 : 0;
  const gemColor =
    rewardType === 'torch_sight'
      ? '#FACC15'
      : rewardType === 'speed_boots'
      ? '#38BDF8'
      : '#F43F5E';

  // Ground shadow
  p1(ctx, 4, 25, 'rgba(5, 8, 15, 0.6)', 24, 4);

  if (opened) {
    // Open Chest Base + Raised Lid + Overflowing Gold & Gems
    p1(ctx, 5, 6, '#090D16', 22, 20);
    // Open Lid (tilted back at top)
    p1(ctx, 6, 7, '#4C1D95', 20, 5);
    p1(ctx, 7, 8, '#6D28D9', 18, 3);
    p1(ctx, 6, 11, '#FACC15', 20, 1);
    // Glowing Treasure Interior
    p1(ctx, 7, 12, '#FEF08A', 18, 4);
    p1(ctx, 9, 13, '#FACC15', 14, 3);
    p1(ctx, 13, 12, gemColor, 6, 3);
    // Lower Chest Box
    p1(ctx, 6, 16, '#581C87', 20, 9);
    p1(ctx, 7, 17, '#7E22CE', 18, 7);
    p1(ctx, 9, 16, '#FACC15', 2, 9);
    p1(ctx, 21, 16, '#FACC15', 2, 9);
    p1(ctx, 14, 16, '#FDE047', 4, 4);
  } else {
    // Closed Arcane Mystery Chest with pulsing gem lock & floating sparkles
    p1(ctx, 5, 9 + bobY, '#090D16', 22, 17);
    // Domed Royal Purple & Gold Lid
    p1(ctx, 6, 10 + bobY, '#581C87', 20, 6);
    p1(ctx, 7, 11 + bobY, '#7E22CE', 18, 4);
    p1(ctx, 8, 11 + bobY, '#A855F7', 16, 2);
    // Lower Chest Body
    p1(ctx, 6, 17 + bobY, '#3B0764', 20, 8);
    p1(ctx, 7, 18 + bobY, '#6B21A8', 18, 6);
    // Gold Straps & Trim
    p1(ctx, 9, 10 + bobY, '#FACC15', 2, 15);
    p1(ctx, 21, 10 + bobY, '#FACC15', 2, 15);
    p1(ctx, 6, 15 + bobY, '#F59E0B', 20, 2);
    // Center Emblem Lock
    p1(ctx, 13, 13 + bobY, '#090D16', 6, 7);
    p1(ctx, 14, 14 + bobY, '#FDE047', 4, 5);
    p1(ctx, 15, 15 + bobY, gemColor, 2, 3);

    // Floating '?' / Sparkle particles above closed chest
    if (animFrame % 2 === 0) {
      p1(ctx, 7, 5, '#FDE047', 2, 2);
      p1(ctx, 23, 6, gemColor, 2, 2);
      p1(ctx, 15, 3, '#FFFFFF', 2, 2);
    } else {
      p1(ctx, 9, 6, gemColor, 2, 2);
      p1(ctx, 21, 4, '#FDE047', 2, 2);
      p1(ctx, 15, 4, '#FDE047', 2, 2);
    }
  }

  tileCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Renders a 32x32 high-detail 16-bit JRPG chibi adventurer sprite with:
 * - Dynamic 3-tone shading derived from the player's chosen outfit color
 * - Flowing cape/cloak behind torso
 * - Expressive directional eyes with white catchlights, eyebrows, and cheek shading
 * - Class-specific headgear, hair silhouettes, and iconic weapons/relics
 * - Smooth 4-frame walk cycle, idle breathing bob, and victory/answering poses
 */
export function getCharacterSprite(options: {
  characterId: string;
  outfitColor: string;
  direction: Direction;
  animState: PlayerAnimState;
  frame: number;
}): HTMLCanvasElement {
  const f = options.frame % 4;
  const cacheKey = `v2:${options.characterId}:${options.outfitColor}:${options.direction}:${options.animState}:${f}`;
  const cached = characterSpriteCache.get(cacheKey);
  if (cached) return cached;

  const { canvas, ctx } = createPixelCanvas(32, 32);
  const preset =
    CHARACTER_PRESETS.find((c) => c.id === options.characterId) ?? CHARACTER_PRESETS[0];

  const primary = options.outfitColor || preset.primaryColor;
  const primaryDark = shadeHexColor(primary, -0.35);
  const primaryLight = shadeHexColor(primary, 0.28);
  const accent = preset.accentColor;
  const accentLight = shadeHexColor(accent, 0.25);
  const outline = '#090D16';

  const isWalking = options.animState === 'walk';
  const isCelebrating = options.animState === 'key_get';
  const isAnswering = options.animState === 'answering';

  // Vertical bounce: crisp stride bounce on walk frames 1 & 3, subtle breathing on idle frame 1
  const bobY = isWalking
    ? f === 1 || f === 3
      ? -1
      : 0
    : f % 2 === 1
    ? -1
    : 0;

  // 1. Ground Elliptical Drop Shadow
  p1(ctx, 8, 28, 'rgba(5, 8, 15, 0.55)', 16, 2);
  p1(ctx, 10, 27, 'rgba(5, 8, 15, 0.38)', 12, 4);

  // 2. Flowing Adventurer Cape / Cloak (drawn behind legs & torso)
  const capeSway = isWalking ? (f === 1 ? -1 : f === 3 ? 1 : 0) : 0;
  p1(ctx, 8 + capeSway, 16 + bobY, outline, 16, 10);
  p1(ctx, 9 + capeSway, 17 + bobY, primaryDark, 14, 8);
  p1(ctx, 10 + capeSway, 24 + bobY, primary, 12, 1);

  // 3. Boots & Animated Stride Legs
  const leftLegY = isWalking ? (f === 1 ? 24 : f === 3 ? 26 : 25) : 25;
  const rightLegY = isWalking ? (f === 1 ? 26 : f === 3 ? 24 : 25) : 25;

  // Left boot
  p1(ctx, 10, leftLegY, outline, 5, 4);
  p1(ctx, 11, leftLegY, '#334155', 3, 3);
  p1(ctx, 11, leftLegY, '#64748B', 2, 1); // steel/leather toe highlight
  p1(ctx, 11, leftLegY + 2, '#1E293B', 3, 1);

  // Right boot
  p1(ctx, 17, rightLegY, outline, 5, 4);
  p1(ctx, 18, rightLegY, '#334155', 3, 3);
  p1(ctx, 18, rightLegY, '#64748B', 2, 1);
  p1(ctx, 18, rightLegY + 2, '#1E293B', 3, 1);

  // 4. Layered Tunic / Armor Torso
  p1(ctx, 9, 16 + bobY, outline, 14, 10);
  p1(ctx, 10, 17 + bobY, primaryDark, 12, 8);
  p1(ctx, 10, 17 + bobY, primary, 12, 6);
  p1(ctx, 11, 17 + bobY, primaryLight, 10, 2); // chest highlight

  // Class Tabard / Surcoat Center Detail
  p1(ctx, 14, 17 + bobY, primaryDark, 4, 6);
  p1(ctx, 15, 17 + bobY, accent, 2, 5);

  // Shoulder Pauldrons
  p1(ctx, 8, 16 + bobY, outline, 4, 4);
  p1(ctx, 9, 17 + bobY, primaryLight, 2, 2);
  p1(ctx, 20, 16 + bobY, outline, 4, 4);
  p1(ctx, 21, 17 + bobY, primaryLight, 2, 2);

  // Utility Belt & Golden/Accent Buckle
  p1(ctx, 10, 22 + bobY, '#291507', 12, 2);
  p1(ctx, 14, 22 + bobY, accent, 4, 2);
  p1(ctx, 15, 22 + bobY, accentLight, 2, 1);

  // 5. Arms & Hands (with walk swing or celebration raise)
  if (isCelebrating) {
    // Raised arms celebrating key collection
    p1(ctx, 6, 11 + bobY, outline, 4, 7);
    p1(ctx, 7, 12 + bobY, primary, 2, 5);
    p1(ctx, 7, 10 + bobY, '#FDE68A', 2, 2);

    p1(ctx, 22, 11 + bobY, outline, 4, 7);
    p1(ctx, 23, 12 + bobY, primary, 2, 5);
    p1(ctx, 23, 10 + bobY, '#FDE68A', 2, 2);
  } else {
    const leftArmSwing = isWalking ? (f === 1 ? -1 : f === 3 ? 1 : 0) : 0;
    const rightArmSwing = isWalking ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;

    // Left Arm + Gauntlet/Hand
    p1(ctx, 6, 17 + bobY + leftArmSwing, outline, 4, 7);
    p1(ctx, 7, 18 + bobY + leftArmSwing, primary, 2, 4);
    p1(ctx, 7, 22 + bobY + leftArmSwing, '#FDE68A', 2, 2);

    // Right Arm + Gauntlet/Hand
    p1(ctx, 22, 17 + bobY + rightArmSwing, outline, 4, 7);
    p1(ctx, 23, 18 + bobY + rightArmSwing, primary, 2, 4);
    p1(ctx, 23, 22 + bobY + rightArmSwing, '#FDE68A', 2, 2);
  }

  // 6. Head & Expressive Chibi Face
  p1(ctx, 8, 6 + bobY, outline, 16, 11);
  p1(ctx, 9, 7 + bobY, '#FDE68A', 14, 9); // warm skin base
  p1(ctx, 10, 7 + bobY, '#FEF3C7', 12, 2); // forehead highlight
  p1(ctx, 9, 14 + bobY, '#F59E0B', 14, 2); // soft chin/cheek shadow

  // Ears
  p1(ctx, 7, 10 + bobY, outline, 2, 4);
  p1(ctx, 8, 11 + bobY, '#FCD34D', 1, 2);
  p1(ctx, 23, 10 + bobY, outline, 2, 4);
  p1(ctx, 23, 11 + bobY, '#FCD34D', 1, 2);

  // Hair Base Color per Hero
  const hairColors: Record<string, { main: string; shade: string }> = {
    knight: { main: '#78350F', shade: '#451A03' },
    mage: { main: '#E2E8F0', shade: '#94A3B8' },
    ranger: { main: '#92400E', shade: '#451A03' },
    alchemist: { main: '#B91C1C', shade: '#7F1D1D' },
    rogue: { main: '#475569', shade: '#1E293B' },
    scholar: { main: '#1E3A8A', shade: '#172554' },
    paladin: { main: '#FACC15', shade: '#CA8A04' },
    bard: { main: '#D97706', shade: '#92400E' },
  };
  const hair = hairColors[preset.id] ?? hairColors.knight;

  if (options.direction === 'up') {
    // Facing Up: Full back-of-head hair with texture
    p1(ctx, 9, 7 + bobY, hair.shade, 14, 9);
    p1(ctx, 10, 7 + bobY, hair.main, 12, 7);
    p1(ctx, 12, 8 + bobY, primaryLight, 8, 1);
    // Cloak clasp on upper back
    p1(ctx, 12, 17 + bobY, accent, 8, 2);
  } else {
    // Side-locks & Bangs framing the face
    p1(ctx, 9, 7 + bobY, hair.main, 2, 6);
    p1(ctx, 21, 7 + bobY, hair.main, 2, 6);
    p1(ctx, 10, 7 + bobY, hair.shade, 12, 2);

    // Directional Eyes (3px tall with white catchlight + iris color + eyebrows + blush)
    const eyeShiftX = options.direction === 'left' ? -2 : options.direction === 'right' ? 2 : 0;
    const leftEyeX = 11 + eyeShiftX;
    const rightEyeX = 18 + eyeShiftX;
    const eyeY = 10 + bobY;

    // Eyebrows
    p1(ctx, leftEyeX, eyeY - 1, hair.shade, 3, 1);
    p1(ctx, rightEyeX, eyeY - 1, hair.shade, 3, 1);

    // Left Eye
    p1(ctx, leftEyeX, eyeY, '#0F172A', 3, 3);
    p1(ctx, leftEyeX, eyeY, '#FFFFFF', 1, 1); // catchlight sparkle
    p1(ctx, leftEyeX + 1, eyeY + 2, accent, 2, 1); // colored lower iris

    // Right Eye
    p1(ctx, rightEyeX, eyeY, '#0F172A', 3, 3);
    p1(ctx, rightEyeX, eyeY, '#FFFFFF', 1, 1);
    p1(ctx, rightEyeX + 1, eyeY + 2, accent, 2, 1);

    // Rosy RPG Cheek Blush
    p1(ctx, leftEyeX - 1, eyeY + 3, 'rgba(244, 63, 94, 0.45)', 2, 1);
    p1(ctx, rightEyeX + 2, eyeY + 3, 'rgba(244, 63, 94, 0.45)', 2, 1);

    // Confident smile pixel when celebrating
    if (isCelebrating) {
      p1(ctx, 15 + Math.sign(eyeShiftX), eyeY + 3, '#9A3412', 2, 1);
    }
  }

  // 7. Signature Class Headgear & Iconic Handheld Weapon / Relic
  switch (preset.hatStyle) {
    case 'helm': {
      // ARKAN — Knight Winged Steel Visor Helm + Golden Plume + Broadsword & Shield
      p1(ctx, 7, 3 + bobY, outline, 18, 6);
      p1(ctx, 8, 4 + bobY, '#94A3B8', 16, 4);
      p1(ctx, 9, 4 + bobY, '#E2E8F0', 14, 2); // polished steel brow
      p1(ctx, 14, 5 + bobY, accent, 4, 3); // golden noseguard crest
      // Side wings on helm
      p1(ctx, 6, 4 + bobY, '#F8FAFC', 2, 3);
      p1(ctx, 24, 4 + bobY, '#F8FAFC', 2, 3);
      // Flowing Golden Plume on top
      p1(ctx, 13, 0 + bobY, outline, 6, 4);
      p1(ctx, 14, 1 + bobY, accent, 4, 3);
      p1(ctx, 15, 1 + bobY, '#FEF08A', 2, 2);

      // Right-hand Steel Broadsword (held upright at side)
      p1(ctx, 26, 8 + bobY, outline, 4, 15);
      p1(ctx, 27, 9 + bobY, '#E2E8F0', 2, 10);
      p1(ctx, 27, 9 + bobY, '#FFFFFF', 1, 9);
      p1(ctx, 25, 19 + bobY, '#FACC15', 6, 2); // golden crossguard
      p1(ctx, 27, 21 + bobY, '#78350F', 2, 2);

      // Left-hand Knight Shield
      p1(ctx, 3, 17 + bobY, outline, 5, 7);
      p1(ctx, 4, 18 + bobY, '#FACC15', 3, 5);
      p1(ctx, 5, 19 + bobY, primary, 1, 3);
      break;
    }

    case 'wizard': {
      // LYRA — Pointed Arcane Wizard Hat with Star Brim + Glowing Crystal Staff
      p1(ctx, 5, 6 + bobY, outline, 22, 3);
      p1(ctx, 6, 7 + bobY, primary, 20, 2);
      p1(ctx, 8, 3 + bobY, outline, 16, 4);
      p1(ctx, 9, 4 + bobY, primaryDark, 14, 3);
      p1(ctx, 10, 4 + bobY, primary, 12, 2);
      // Hat ribbon & golden buckle
      p1(ctx, 9, 6 + bobY, accent, 14, 1);
      p1(ctx, 15, 5 + bobY, '#FACC15', 2, 2);
      // Curved wizard tip
      p1(ctx, 11, 0 + bobY, outline, 11, 4);
      p1(ctx, 12, 1 + bobY, primary, 9, 3);
      p1(ctx, 20, 2 + bobY, '#FACC15', 2, 2);

      // Arcane Crystal Staff in right hand
      p1(ctx, 26, 9 + bobY, outline, 4, 16);
      p1(ctx, 27, 13 + bobY, '#92400E', 2, 11);
      // Glowing cyan crystal orb at staff tip
      p1(ctx, 25, 8 + bobY, '#0284C7', 6, 5);
      p1(ctx, 26, 9 + bobY, '#38BDF8', 4, 3);
      p1(ctx, 27, 9 + bobY, '#E0F2FE', 2, 2);
      break;
    }

    case 'hood': {
      // KAEL — Woodland Ranger Hood with Feather Brooch + Recurve Bow
      p1(ctx, 7, 3 + bobY, outline, 18, 6);
      p1(ctx, 8, 4 + bobY, primary, 16, 4);
      p1(ctx, 9, 4 + bobY, primaryLight, 14, 2);
      // Hood sides framing head
      p1(ctx, 7, 8 + bobY, primaryDark, 2, 7);
      p1(ctx, 23, 8 + bobY, primaryDark, 2, 7);
      // Golden Leaf Clasp & Feather
      p1(ctx, 15, 5 + bobY, '#FACC15', 2, 2);
      p1(ctx, 21, 1 + bobY, '#34D399', 3, 4);
      p1(ctx, 22, 1 + bobY, '#A7F3D0', 2, 2);

      // Recurve Wooden Bow in hand
      p1(ctx, 26, 10 + bobY, outline, 4, 14);
      p1(ctx, 27, 11 + bobY, '#B45309', 2, 12);
      p1(ctx, 28, 12 + bobY, '#FBBF24', 1, 10);
      p1(ctx, 26, 12 + bobY, '#E2E8F0', 1, 10); // taut bowstring
      break;
    }

    case 'goggles': {
      // PYRA — Alchemist Steampunk Goggles + Spiky Hair + Glowing Potion Flask
      // Spiky hair crest
      p1(ctx, 8, 1 + bobY, outline, 16, 6);
      p1(ctx, 9, 2 + bobY, hair.main, 14, 4);
      p1(ctx, 11, 1 + bobY, '#EF4444', 3, 2);
      p1(ctx, 17, 1 + bobY, '#EF4444', 3, 2);
      // Brass Goggle Strap & Twin Cyan Lenses on Forehead
      p1(ctx, 8, 5 + bobY, '#451A03', 16, 3);
      p1(ctx, 9, 4 + bobY, '#F59E0B', 6, 4);
      p1(ctx, 10, 5 + bobY, '#38BDF8', 4, 2);
      p1(ctx, 10, 5 + bobY, '#E0F2FE', 1, 1);
      p1(ctx, 17, 4 + bobY, '#F59E0B', 6, 4);
      p1(ctx, 18, 5 + bobY, '#38BDF8', 4, 2);
      p1(ctx, 18, 5 + bobY, '#E0F2FE', 1, 1);

      // Bubbling Alchemist Potion Flask in hand
      p1(ctx, 25, 15 + bobY, outline, 6, 8);
      p1(ctx, 27, 14 + bobY, '#D97706', 2, 2); // cork stopper
      p1(ctx, 26, 16 + bobY, '#BAE6FD', 4, 6); // glass flask
      p1(ctx, 26, 18 + bobY, '#10B981', 4, 4); // glowing emerald elixir
      p1(ctx, 27, 19 + bobY, '#A7F3D0', 2, 2);
      break;
    }

    case 'bandana': {
      // ZEPH — Ninja/Rogue Headband with Flowing Tails + Masked Scarf + Twin Daggers
      p1(ctx, 8, 2 + bobY, outline, 16, 6);
      p1(ctx, 9, 2 + bobY, hair.main, 14, 3);
      p1(ctx, 8, 5 + bobY, primary, 16, 3);
      p1(ctx, 9, 5 + bobY, primaryLight, 14, 1);
      // Metal forehead plate
      p1(ctx, 13, 5 + bobY, '#CBD5E1', 6, 2);
      p1(ctx, 15, 5 + bobY, accent, 2, 2);
      // Flowing headband tails on right
      p1(ctx, 24, 5 + bobY, outline, 5, 4);
      p1(ctx, 24, 6 + bobY, accent, 4, 2);
      // Rogue Shadow Scarf over lower face/neck
      p1(ctx, 10, 15 + bobY, '#1E293B', 12, 3);
      p1(ctx, 11, 15 + bobY, accent, 10, 1);

      // Twin Gleaming Daggers
      p1(ctx, 2, 18 + bobY, outline, 5, 4);
      p1(ctx, 3, 19 + bobY, '#E2E8F0', 4, 2);
      p1(ctx, 25, 18 + bobY, outline, 5, 4);
      p1(ctx, 25, 19 + bobY, '#38BDF8', 4, 2);
      break;
    }

    case 'circlet': {
      // NYX — Celestial Scholar Tiara Crown + Floating Open Math Grimoire
      p1(ctx, 7, 2 + bobY, outline, 18, 6);
      p1(ctx, 8, 3 + bobY, hair.main, 16, 4);
      // Golden Royal Tiara Circlet
      p1(ctx, 8, 5 + bobY, '#FACC15', 16, 2);
      p1(ctx, 10, 4 + bobY, '#FEF08A', 12, 1);
      // Center Rose-Crystal Gem
      p1(ctx, 14, 3 + bobY, '#0F172A', 4, 4);
      p1(ctx, 15, 4 + bobY, accent, 2, 2);
      p1(ctx, 15, 4 + bobY, '#FFFFFF', 1, 1);

      // Floating Open Grimoire Book
      p1(ctx, 24, 14 + bobY, outline, 7, 7);
      p1(ctx, 25, 15 + bobY, accent, 5, 5);
      p1(ctx, 25, 15 + bobY, '#FEF3C7', 5, 3); // open parchment pages
      p1(ctx, 27, 13 + bobY, '#38BDF8', 2, 1); // floating rune spark
      break;
    }

    case 'crest': {
      // TOREN — Radiant Paladin Sun-Crest Valkyrie Helm + Golden Sun Warhammer
      p1(ctx, 7, 3 + bobY, outline, 18, 6);
      p1(ctx, 8, 4 + bobY, '#F8FAFC', 16, 4);
      p1(ctx, 9, 6 + bobY, '#FACC15', 14, 2);
      // Sun Crest Halo Wings
      p1(ctx, 11, 0 + bobY, outline, 10, 5);
      p1(ctx, 12, 1 + bobY, '#FACC15', 8, 3);
      p1(ctx, 14, 1 + bobY, '#FEF08A', 4, 3);
      p1(ctx, 6, 2 + bobY, '#FACC15', 3, 3);
      p1(ctx, 23, 2 + bobY, '#FACC15', 3, 3);

      // Golden Sun Warhammer
      p1(ctx, 26, 9 + bobY, outline, 4, 15);
      p1(ctx, 27, 13 + bobY, '#92400E', 2, 10);
      p1(ctx, 24, 9 + bobY, outline, 8, 5);
      p1(ctx, 25, 10 + bobY, '#FACC15', 6, 3);
      p1(ctx, 26, 10 + bobY, '#FEF08A', 4, 2);
      break;
    }

    case 'feather':
    default: {
      // VESPER — Royal Bard Cavalier Beret + Sweeping Emerald Plume + Lute
      p1(ctx, 6, 3 + bobY, outline, 20, 6);
      p1(ctx, 7, 4 + bobY, primary, 18, 4);
      p1(ctx, 8, 4 + bobY, primaryLight, 14, 2);
      p1(ctx, 8, 7 + bobY, '#FACC15', 16, 1); // golden hat trim
      // Sweeping Feather Plume
      p1(ctx, 19, 0 + bobY, outline, 7, 5);
      p1(ctx, 20, 1 + bobY, accent, 5, 3);
      p1(ctx, 21, 1 + bobY, '#ECFDF5', 3, 2);

      // Royal Lute / Harp in hand
      p1(ctx, 24, 14 + bobY, outline, 7, 8);
      p1(ctx, 25, 16 + bobY, '#D97706', 5, 5);
      p1(ctx, 26, 17 + bobY, '#FDE68A', 3, 3);
      p1(ctx, 27, 12 + bobY, '#92400E', 2, 4);
      break;
    }
  }

  // 8. Special Status Floating Emblem (Golden Key on key_get, Math Rune on answering)
  if (isCelebrating) {
    p1(ctx, 13, 0, '#FACC15', 6, 3);
    p1(ctx, 14, 1, '#FEF08A', 4, 1);
  } else if (isAnswering) {
    p1(ctx, 24, 1, outline, 6, 6);
    p1(ctx, 25, 2, '#FACC15', 4, 4);
    p1(ctx, 26, 3, '#090D16', 2, 2);
  }

  characterSpriteCache.set(cacheKey, canvas);
  return canvas;
}

export function getCharacterAvatarDataUrl(characterId: string, outfitColor?: string): string {
  const preset = CHARACTER_PRESETS.find((c) => c.id === characterId) ?? CHARACTER_PRESETS[0];
  const color = outfitColor || preset.primaryColor;
  const key = `v2:${preset.id}:${color}`;
  const cached = avatarDataUrlCache.get(key);
  if (cached) return cached;

  const sprite = getCharacterSprite({
    characterId: preset.id,
    outfitColor: color,
    direction: 'down',
    animState: 'idle',
    frame: 0,
  });
  const url = sprite.toDataURL();
  avatarDataUrlCache.set(key, url);
  return url;
}

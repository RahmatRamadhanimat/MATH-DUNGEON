import {
  CHARACTER_PRESETS,
  Direction,
  KEY_TYPES_INFO,
  KeyType,
  PlayerAnimState,
  TileType,
} from '../../shared/constants';

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

export function getTileSprite(tile: TileType, frame = 0): HTMLCanvasElement {
  const animFrame =
    tile === TileType.TORCH_WALL ||
    tile === TileType.CRYSTAL_DECOR ||
    tile === TileType.EXIT_OPEN ||
    tile === TileType.PORTAL_SPAWN
      ? frame % 4
      : 0;
  const key = `${tile}:${animFrame}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createPixelCanvas(32, 32);

  // Base floor for non-wall tiles
  if (tile !== TileType.WALL && tile !== TileType.TORCH_WALL) {
    const isSecret =
      tile === TileType.SECRET_FLOOR ||
      tile === TileType.CHEST_DECOR ||
      tile === TileType.CRYSTAL_DECOR;
    px(ctx, 0, 0, isSecret ? '#29223A' : '#1E2430', 16, 16);
    // Cobblestone grid texture
    px(ctx, 0, 0, isSecret ? '#352B4B' : '#262E3D', 15, 7);
    px(ctx, 0, 8, isSecret ? '#312746' : '#232B38', 7, 7);
    px(ctx, 8, 8, isSecret ? '#352B4B' : '#262E3D', 7, 7);
    // Subtle stone highlights & mortar specks
    px(ctx, 1, 1, isSecret ? '#4C3D6B' : '#313B4E', 4, 1);
    px(ctx, 9, 9, isSecret ? '#4C3D6B' : '#313B4E', 4, 1);
    px(ctx, 3, 12, '#171C26', 2, 1);
  }

  switch (tile) {
    case TileType.WALL:
    case TileType.TORCH_WALL: {
      // 16-bit RPG Stone Brick Wall
      px(ctx, 0, 0, '#0F141D', 16, 16); // Dark mortar base
      // Top bevel highlight
      px(ctx, 0, 0, '#475569', 7, 3);
      px(ctx, 8, 0, '#475569', 7, 3);
      px(ctx, 1, 0, '#64748B', 5, 1);
      px(ctx, 9, 0, '#64748B', 5, 1);
      // Middle brick course
      px(ctx, 0, 4, '#334155', 3, 4);
      px(ctx, 4, 4, '#3B495E', 7, 4);
      px(ctx, 12, 4, '#334155', 4, 4);
      px(ctx, 5, 4, '#475569', 5, 1);
      // Lower brick course
      px(ctx, 0, 9, '#283344', 7, 4);
      px(ctx, 8, 9, '#2D3A4D', 7, 4);
      // Deep bottom shadow edge
      px(ctx, 0, 14, '#090D14', 16, 2);
      // Subtle moss pixel
      px(ctx, 2, 12, '#15803D', 2, 1);

      if (tile === TileType.TORCH_WALL) {
        // Iron wall sconce
        px(ctx, 7, 9, '#1E293B', 2, 4);
        px(ctx, 6, 8, '#78350F', 4, 2);
        // Animated flickering flame
        const flameOffset = animFrame % 2;
        px(ctx, 6, 4 + flameOffset, '#EA580C', 4, 4);
        px(ctx, 7, 3 + flameOffset, '#FACC15', 2, 4);
        px(ctx, 7, 5, '#FEF08A', 2, 2);
        if (animFrame === 1 || animFrame === 3) {
          px(ctx, 6, 2, '#F97316', 1, 1);
          px(ctx, 9, 3, '#FACC15', 1, 1);
        }
      }
      break;
    }

    case TileType.CHEST_DECOR: {
      // Pixel Art Treasure Chest
      px(ctx, 3, 5, '#451A03', 10, 8);
      px(ctx, 4, 6, '#92400E', 8, 6);
      px(ctx, 4, 5, '#B45309', 8, 2);
      // Gold trim & lock
      px(ctx, 3, 8, '#FACC15', 10, 1);
      px(ctx, 7, 7, '#FEF08A', 2, 3);
      break;
    }

    case TileType.CRYSTAL_DECOR: {
      // Glowing Crystal Cluster
      const glow = animFrame % 2 === 0 ? '#38BDF8' : '#7DD3FC';
      px(ctx, 6, 3, '#0284C7', 4, 10);
      px(ctx, 7, 2, glow, 2, 9);
      px(ctx, 4, 6, '#0369A1', 3, 7);
      px(ctx, 5, 7, glow, 1, 5);
      px(ctx, 9, 5, '#0369A1', 3, 8);
      px(ctx, 10, 6, glow, 1, 6);
      break;
    }

    case TileType.GRASS_DECOR: {
      // Dungeon Foliage & Vines
      px(ctx, 3, 10, '#15803D', 2, 3);
      px(ctx, 4, 9, '#22C55E', 2, 2);
      px(ctx, 10, 5, '#15803D', 3, 3);
      px(ctx, 11, 4, '#4ADE80', 2, 2);
      px(ctx, 7, 12, '#16A34A', 3, 2);
      break;
    }

    case TileType.TRAP_DECOR: {
      // Decorative Iron Spike Plate
      px(ctx, 2, 2, '#111827', 12, 12);
      px(ctx, 3, 3, '#374151', 10, 10);
      const spikes = [
        [4, 4],
        [10, 4],
        [7, 7],
        [4, 10],
        [10, 10],
      ];
      for (const [sx, sy] of spikes) {
        px(ctx, sx, sy, '#9CA3AF', 2, 2);
        px(ctx, sx, sy, '#F3F4F6', 1, 1);
      }
      break;
    }

    case TileType.WOOD_DOOR: {
      // Wooden Dungeon Archway (Walkable)
      px(ctx, 0, 0, '#451A03', 3, 16);
      px(ctx, 13, 0, '#451A03', 3, 16);
      px(ctx, 1, 1, '#78350F', 2, 14);
      px(ctx, 13, 1, '#78350F', 2, 14);
      px(ctx, 0, 0, '#92400E', 16, 2);
      break;
    }

    case TileType.PORTAL_SPAWN: {
      // Glowing Spawn Rune Circle
      const runeColor = animFrame % 2 === 0 ? '#38BDF8' : '#818CF8';
      px(ctx, 3, 3, '#1E3A8A', 10, 10);
      px(ctx, 4, 4, runeColor, 8, 8);
      px(ctx, 5, 5, '#1E2430', 6, 6);
      px(ctx, 7, 7, '#BAE6FD', 2, 2);
      break;
    }

    case TileType.EXIT_LOCKED: {
      // Locked Iron Portcullis Gate with Golden Padlock
      px(ctx, 0, 0, '#334155', 16, 3);
      px(ctx, 1, 0, '#0F172A', 14, 16);
      // Iron bars
      for (let bx = 2; bx <= 13; bx += 3) {
        px(ctx, bx, 2, '#64748B', 2, 14);
        px(ctx, bx, 2, '#94A3B8', 1, 14);
      }
      // Crossbars
      px(ctx, 1, 5, '#475569', 14, 2);
      px(ctx, 1, 11, '#475569', 14, 2);
      // Red/Gold Padlock in center
      px(ctx, 6, 6, '#DC2626', 4, 5);
      px(ctx, 7, 4, '#FACC15', 2, 2);
      px(ctx, 7, 8, '#FEF08A', 2, 2);
      break;
    }

    case TileType.EXIT_OPEN: {
      // Open Magical Exit Portal & Stairs
      px(ctx, 0, 0, '#475569', 16, 3);
      px(ctx, 2, 2, '#064E3B', 12, 13);
      const glow = animFrame % 2 === 0 ? '#10B981' : '#34D399';
      const inner = animFrame % 2 === 0 ? '#6EE7B7' : '#A7F3D0';
      px(ctx, 3, 3, glow, 10, 11);
      px(ctx, 5, 5, inner, 6, 7);
      px(ctx, 7, 7, '#ECFDF5', 2, 3);
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

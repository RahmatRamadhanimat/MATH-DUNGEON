export type ParticleShape = 'star' | 'diamond' | 'square' | 'spark';

export interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  color: string;
  secondaryColor: string;
  size: number;
  shape: ParticleShape;
  life: number;
  maxLife: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  life: number;
  maxLife: number;
}

export interface FloatingBanner {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  subText: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ParticleSystemState {
  particles: PooledParticle[];
  rings: ShockwaveRing[];
  banners: FloatingBanner[];
  writeIdx: number;
  ringWriteIdx: number;
  bannerWriteIdx: number;
  goldenBurstCount: number;
}

export const MAX_POOLED_PARTICLES = 180;
export const MAX_SHOCKWAVE_RINGS = 12;
export const MAX_FLOATING_BANNERS = 8;

export const GOLDEN_KEY_PALETTE = [
  '#FACC15', // Crown Gold
  '#FDE047', // Bright Sun Gold
  '#FEF08A', // Champagne Gold
  '#FFFBEB', // Gleaming White-Gold
  '#F59E0B', // Royal Amber Gold
  '#FB923C', // Warm Bronze-Gold
] as const;

export function createParticleSystemState(): ParticleSystemState {
  return {
    particles: Array.from({ length: MAX_POOLED_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      drag: 0.96,
      color: '#FACC15',
      secondaryColor: '#FFFBEB',
      size: 4,
      shape: 'star',
      life: 0,
      maxLife: 1,
      twinkleSpeed: 12,
      twinklePhase: 0,
    })),
    rings: Array.from({ length: MAX_SHOCKWAVE_RINGS }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 4,
      maxRadius: 42,
      color: '#FACC15',
      lineWidth: 2,
      life: 0,
      maxLife: 0.8,
    })),
    banners: Array.from({ length: MAX_FLOATING_BANNERS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -24,
      text: '',
      subText: '',
      color: '#FACC15',
      life: 0,
      maxLife: 1.2,
    })),
    writeIdx: 0,
    ringWriteIdx: 0,
    bannerWriteIdx: 0,
    goldenBurstCount: 0,
  };
}

export function spawnGenericParticles(
  state: ParticleSystemState,
  wx: number,
  wy: number,
  count: number,
  colors: readonly string[],
  speed = 95,
  life = 0.6,
  shape: ParticleShape = 'square'
): void {
  for (let i = 0; i < count; i++) {
    const p = state.particles[state.writeIdx];
    state.writeIdx = (state.writeIdx + 1) % MAX_POOLED_PARTICLES;
    const angle = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.35;
    const spd = speed * (0.45 + Math.random() * 0.75);
    p.active = true;
    p.x = wx;
    p.y = wy;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.ax = 0;
    p.ay = 25;
    p.drag = 0.94;
    p.color = colors[i % colors.length] ?? '#FACC15';
    p.secondaryColor = '#FFFBEB';
    p.size = i % 2 === 0 ? 4 : 6;
    p.shape = shape;
    p.life = life;
    p.maxLife = life;
    p.twinkleSpeed = 10 + (i % 5) * 3;
    p.twinklePhase = i * 0.7;
  }
}

/**
 * Spawns a rich multi-layered golden particle burst, dual expanding golden aura rings,
 * and a rising golden pixel banner when a key is collected in the maze.
 */
export function spawnGoldenKeyBurst(
  state: ParticleSystemState,
  wx: number,
  wy: number,
  options?: {
    bannerText?: string;
    subText?: string;
  }
): void {
  state.goldenBurstCount += 1;

  // Layer 1: Radial Golden Star & Diamond Nova (30 particles)
  const radialCount = 30;
  const shapes: ParticleShape[] = ['star', 'diamond', 'spark', 'square'];
  for (let i = 0; i < radialCount; i++) {
    const p = state.particles[state.writeIdx];
    state.writeIdx = (state.writeIdx + 1) % MAX_POOLED_PARTICLES;
    const baseAngle = (Math.PI * 2 * i) / radialCount;
    const angle = baseAngle + (Math.random() - 0.5) * 0.22;
    const tierSpeed = i % 3 === 0 ? 135 : i % 3 === 1 ? 92 : 58;
    const spd = tierSpeed * (0.75 + Math.random() * 0.45);
    const life = 0.85 + (i % 4) * 0.14;

    p.active = true;
    p.x = wx + Math.cos(baseAngle) * 3;
    p.y = wy + Math.sin(baseAngle) * 3;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd - 14;
    p.ax = 0;
    p.ay = 38; // gentle gravity arc after burst
    p.drag = 0.92;
    p.color = GOLDEN_KEY_PALETTE[i % GOLDEN_KEY_PALETTE.length];
    p.secondaryColor = '#FFFBEB';
    p.size = i % 3 === 0 ? 7 : i % 2 === 0 ? 5 : 4;
    p.shape = shapes[i % shapes.length];
    p.life = life;
    p.maxLife = life;
    p.twinkleSpeed = 14 + (i % 6) * 2.5;
    p.twinklePhase = i * 0.55;
  }

  // Layer 2: Rising Golden Fountain / Crown Glitter (20 particles)
  const fountainCount = 20;
  for (let i = 0; i < fountainCount; i++) {
    const p = state.particles[state.writeIdx];
    state.writeIdx = (state.writeIdx + 1) % MAX_POOLED_PARTICLES;
    const spreadX = ((i / (fountainCount - 1)) - 0.5) * 28;
    const life = 0.95 + (i % 5) * 0.12;

    p.active = true;
    p.x = wx + spreadX * 0.5;
    p.y = wy - 2;
    p.vx = spreadX * 2.1 + (Math.random() - 0.5) * 24;
    p.vy = -(68 + (i % 5) * 18 + Math.random() * 25);
    p.ax = (i % 2 === 0 ? 1 : -1) * 14;
    p.ay = 52;
    p.drag = 0.96;
    p.color = GOLDEN_KEY_PALETTE[(i + 1) % GOLDEN_KEY_PALETTE.length];
    p.secondaryColor = '#FEF08A';
    p.size = i % 2 === 0 ? 6 : 4;
    p.shape = i % 2 === 0 ? 'star' : 'diamond';
    p.life = life;
    p.maxLife = life;
    p.twinkleSpeed = 18;
    p.twinklePhase = i * 0.9;
  }

  // Layer 3: Dual Expanding Golden Shockwave Aura Rings
  const outerRing = state.rings[state.ringWriteIdx];
  state.ringWriteIdx = (state.ringWriteIdx + 1) % MAX_SHOCKWAVE_RINGS;
  outerRing.active = true;
  outerRing.x = wx;
  outerRing.y = wy;
  outerRing.radius = 5;
  outerRing.maxRadius = 46;
  outerRing.color = '#FACC15';
  outerRing.lineWidth = 2.5;
  outerRing.life = 0.75;
  outerRing.maxLife = 0.75;

  const innerRing = state.rings[state.ringWriteIdx];
  state.ringWriteIdx = (state.ringWriteIdx + 1) % MAX_SHOCKWAVE_RINGS;
  innerRing.active = true;
  innerRing.x = wx;
  innerRing.y = wy;
  innerRing.radius = 2;
  innerRing.maxRadius = 30;
  innerRing.color = '#FEF08A';
  innerRing.lineWidth = 1.8;
  innerRing.life = 0.6;
  innerRing.maxLife = 0.6;

  // Layer 4: Floating Golden Pixel Banner above key / player (replace any existing nearby banner to prevent overlap)
  for (let i = 0; i < state.banners.length; i++) {
    if (state.banners[i].active && Math.hypot(state.banners[i].x - wx, state.banners[i].y - (wy - 22)) < 48) {
      state.banners[i].active = false;
    }
  }
  const banner = state.banners[state.bannerWriteIdx];
  state.bannerWriteIdx = (state.bannerWriteIdx + 1) % MAX_FLOATING_BANNERS;
  banner.active = true;
  banner.x = wx;
  banner.y = wy - 24;
  banner.vy = -20;
  banner.text = (options?.bannerText ?? 'KUNCI EMAS!').replace(/★/g, '').trim();
  banner.subText = options?.subText ?? '+KUNCI DIDAPAT';
  banner.color = '#FACC15';
  banner.life = 1.25;
  banner.maxLife = 1.25;
}

export function hasActiveParticleEffects(state: ParticleSystemState): boolean {
  for (let i = 0; i < state.particles.length; i++) {
    if (state.particles[i].active) return true;
  }
  for (let i = 0; i < state.rings.length; i++) {
    if (state.rings[i].active) return true;
  }
  for (let i = 0; i < state.banners.length; i++) {
    if (state.banners[i].active) return true;
  }
  return false;
}

export function countActiveParticles(state: ParticleSystemState): number {
  let count = 0;
  for (let i = 0; i < state.particles.length; i++) {
    if (state.particles[i].active) count++;
  }
  return count;
}

export function stepParticleSystem(state: ParticleSystemState, dt: number): void {
  const frameDrag = Math.pow(0.92, dt * 60);

  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    if (!pt.active) continue;
    pt.life -= dt;
    if (pt.life <= 0) {
      pt.active = false;
      continue;
    }
    pt.vx = (pt.vx + pt.ax * dt) * (pt.drag < 1 ? frameDrag : 1);
    pt.vy = pt.vy + pt.ay * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.twinklePhase += pt.twinkleSpeed * dt;
  }

  for (let i = 0; i < state.rings.length; i++) {
    const ring = state.rings[i];
    if (!ring.active) continue;
    ring.life -= dt;
    if (ring.life <= 0) {
      ring.active = false;
      continue;
    }
    const progress = 1 - ring.life / ring.maxLife;
    const easeOut = 1 - Math.pow(1 - progress, 2.4);
    ring.radius = 4 + (ring.maxRadius - 4) * easeOut;
  }

  for (let i = 0; i < state.banners.length; i++) {
    const b = state.banners[i];
    if (!b.active) continue;
    b.life -= dt;
    if (b.life <= 0) {
      b.active = false;
      continue;
    }
    b.y += b.vy * dt;
    b.vy *= Math.pow(0.95, dt * 60);
  }
}

export function renderParticleSystem(
  ctx: CanvasRenderingContext2D,
  state: ParticleSystemState
): void {
  ctx.save();

  // 1. Expanding Golden Aura Rings
  for (let i = 0; i < state.rings.length; i++) {
    const ring = state.rings[i];
    if (!ring.active) continue;
    const alpha = Math.max(0, Math.min(1, ring.life / ring.maxLife));
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.lineWidth;
    ctx.beginPath();
    ctx.arc(Math.round(ring.x), Math.round(ring.y), ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. Pooled Particles (Stars, Diamonds, Sparks, Pixel Squares)
  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    if (!pt.active) continue;

    const lifeRatio = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    const twinkle = 0.65 + 0.35 * Math.sin(pt.twinklePhase);
    ctx.globalAlpha = lifeRatio * twinkle;

    const px = Math.round(pt.x);
    const py = Math.round(pt.y);
    const half = Math.max(1, Math.round(pt.size / 2));

    if (pt.shape === 'star') {
      // Crisp 4-point pixel star with gleaming center core
      ctx.fillStyle = pt.color;
      ctx.fillRect(px - half, py - 1, half * 2, 2);
      ctx.fillRect(px - 1, py - half, 2, half * 2);
      ctx.fillStyle = pt.secondaryColor;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    } else if (pt.shape === 'diamond') {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(px, py - half);
      ctx.lineTo(px + half, py);
      ctx.lineTo(px, py + half);
      ctx.lineTo(px - half, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pt.secondaryColor;
      ctx.fillRect(px, py, 1, 1);
    } else if (pt.shape === 'spark') {
      ctx.fillStyle = pt.color;
      ctx.fillRect(px - 1, py - half, 2, half * 2);
      ctx.fillStyle = pt.secondaryColor;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    } else {
      ctx.fillStyle = pt.color;
      ctx.fillRect(px - half / 2, py - half / 2, Math.max(2, half), Math.max(2, half));
    }
  }

  // 3. Floating Golden Celebration Banners
  for (let i = 0; i < state.banners.length; i++) {
    const b = state.banners[i];
    if (!b.active) continue;
    const ratio = Math.max(0, Math.min(1, b.life / b.maxLife));
    const alpha = ratio > 0.25 ? 1 : ratio / 0.25;
    ctx.globalAlpha = alpha;

    const bx = Math.round(b.x);
    const by = Math.round(b.y);

    // Dark pixel badge backing for crisp readability over dungeon tiles
    ctx.font = 'bold 6px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    const badgeW = Math.max(64, b.text.length * 4.4 + 14);
    const badgeH = b.subText ? 16 : 10;
    const boxX = Math.round(bx - badgeW / 2);
    const boxY = by - 11;

    ctx.fillStyle = 'rgba(9, 13, 21, 0.92)';
    ctx.fillRect(boxX, boxY, badgeW, badgeH);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, badgeW, badgeH);

    ctx.fillStyle = '#FEF08A';
    ctx.fillText(b.text, bx, boxY + 6.5);

    if (b.subText) {
      ctx.font = 'bold 5px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#34D399';
      ctx.fillText(b.subText, bx, boxY + 13);
    }
  }

  ctx.restore();
}

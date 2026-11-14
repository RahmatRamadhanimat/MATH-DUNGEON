import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralMaze, isWalkableTile, validateMazeReachability } from './mazeGenerator';
import { computeWallShadowQuads, hasLineOfSight, isOpaqueTile } from './lightingSystem';
import { generateMathQuestion, pickQuestionForRoom, sanitizeCustomQuestions } from './questionGenerator';
import { buildIndividualLeaderboard, buildTeamLeaderboard, calculateAccuracy, calculatePlayerScore } from './scoreSystem';
import {
  GOLDEN_KEY_PALETTE,
  countActiveParticles,
  createParticleSystemState,
  hasActiveParticleEffects,
  spawnGoldenKeyBurst,
  stepParticleSystem,
} from './particleSystem';
import { MATH_CATEGORIES, TileType, normalizeRoomCode } from './constants';

test('normalizeRoomCode normalizes digits, dashes, hashtags, spaces, and lowercase codes', () => {
  assert.equal(normalizeRoomCode('1586'), 'MATH-1586');
  assert.equal(normalizeRoomCode('math1586'), 'MATH-1586');
  assert.equal(normalizeRoomCode(' math-1586 '), 'MATH-1586');
  assert.equal(normalizeRoomCode('#math–1586'), 'MATH-1586');
  assert.equal(normalizeRoomCode('math_1586'), 'MATH-1586');
  assert.equal(normalizeRoomCode('MATH-4821'), 'MATH-4821');
});

test('Procedural Maze Generator creates wider, valid, reachable mazes across levels 1 to 5', () => {
  const expectedSizes: Record<number, number> = { 1: 35, 2: 45, 3: 55, 4: 65, 5: 75 };

  for (let level = 1; level <= 5; level++) {
    const maze = generateProceduralMaze({ level, keyCount: 6, seed: 1000 + level });
    assert.equal(maze.width, expectedSizes[level]);
    assert.equal(maze.height, expectedSizes[level]);
    assert.equal(maze.keys.length, 6);
    assert.ok(maze.secretRooms.length >= 4);
    assert.ok(maze.secretRooms[0].width >= 4 && maze.secretRooms[0].height >= 4);

    // Spawn tile must be walkable and have adjacent walkable tiles (not facing a wall)
    assert.equal(isWalkableTile(maze.grid[maze.spawnTile.y][maze.spawnTile.x]), true);
    assert.equal(isWalkableTile(maze.grid[maze.spawnTile.y][maze.spawnTile.x + 1]), true);

    // Every key must not be inside a wall
    for (const k of maze.keys) {
      assert.equal(isWalkableTile(maze.grid[k.tileY][k.tileX]), true, `Key ${k.id} on non-walkable tile`);
    }

    // BFS reachability must confirm all keys and exit door are reachable
    const targets = [maze.exitTile, ...maze.keys.map((k) => ({ x: k.tileX, y: k.tileY }))];
    const bfs = validateMazeReachability(maze.grid, maze.spawnTile, targets);
    assert.equal(bfs.valid, true, `Level ${level} maze failed reachability check`);
    assert.equal(bfs.reachableCount, targets.length);
  }
});

test('Lighting System blocks sight through walls and projects cast shadows behind enclosed rooms', () => {
  // 5x5 grid with a vertical wall at x=2 separating left room (x=1) and enclosed right room (x=3)
  const grid: TileType[][] = [
    [TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL],
    [TileType.WALL, TileType.FLOOR, TileType.WALL, TileType.SECRET_FLOOR, TileType.WALL],
    [TileType.WALL, TileType.FLOOR, TileType.WOOD_DOOR, TileType.SECRET_FLOOR, TileType.WALL],
    [TileType.WALL, TileType.FLOOR, TileType.WALL, TileType.SECRET_FLOOR, TileType.WALL],
    [TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL],
  ];

  // Open sight within left corridor
  assert.equal(hasLineOfSight(grid, 48, 48, 48, 112, 32), true);

  // Blocked sight across solid wall at (2,1) into enclosed right room (3,1)
  assert.equal(hasLineOfSight(grid, 48, 48, 112, 48, 32), false);

  // WOOD_DOOR blocks sight from far away (>1.6 tiles), opens when close
  assert.equal(isOpaqueTile(TileType.WOOD_DOOR, 2, 2, 16, 80, 32), true);
  assert.equal(isOpaqueTile(TileType.WOOD_DOOR, 2, 2, 56, 80, 32), false);

  // Shadow quads must be projected behind wall tile (2,1) toward x > 96
  const quads = computeWallShadowQuads({
    grid,
    width: 5,
    height: 5,
    tileSize: 32,
    lightX: 48,
    lightY: 48,
    radius: 200,
    shadowLength: 160,
  });
  assert.ok(quads.length > 0, 'Expected wall shadow quads');
  assert.ok(
    quads.some((q) => q.x3 > 96 || q.x4 > 96),
    'Expected shadow quad projecting behind the wall into the enclosed room'
  );
});

test('Lighting System merges multi-block wall edges without 1-block-by-1-block internal shadows', () => {
  // 9x7 grid with a 5-tile horizontal wall at y=2 (x=2..6) and player below at center (4.5, 4.5)
  const grid: TileType[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 9 }, () => TileType.FLOOR)
  );
  for (let x = 2; x <= 6; x++) {
    grid[2][x] = TileType.WALL;
  }

  const quads = computeWallShadowQuads({
    grid,
    width: 9,
    height: 7,
    tileSize: 32,
    lightX: 4.5 * 32,
    lightY: 4.5 * 32,
    radius: 300,
    shadowLength: 540,
  });

  // Top edge at y=64 spans x=64..224 (merged), with zero internal vertical edges at x=96, 128, 160, 192
  const internalVerticalSeams = quads.filter(
    (q) =>
      q.x1 === q.x2 &&
      q.x1 > 64 &&
      q.x1 < 224 &&
      Math.min(q.y1, q.y2) >= 64 &&
      Math.max(q.y1, q.y2) <= 96
  );
  assert.equal(internalVerticalSeams.length, 0, 'Multi-block horizontal wall must not emit internal vertical seams');

  // Verify shadow behind the top edge covers the full horizontal width x=64..224 without gaps
  const topEdgeQuads = quads.filter((q) => q.y1 === 64 && q.y2 === 64);
  assert.ok(topEdgeQuads.length >= 1 && topEdgeQuads.length <= 3);
  const minX = Math.min(...topEdgeQuads.map((q) => Math.min(q.x1, q.x2)));
  const maxX = Math.max(...topEdgeQuads.map((q) => Math.max(q.x1, q.x2)));
  assert.equal(minX, 64);
  assert.equal(maxX, 224);
});

test('Math Question Generator strictly produces 2 distinct choices (A and B) across all 17 categories', () => {
  const usedSignatures = new Set<string>();
  let countA = 0;
  let countB = 0;

  for (const cat of MATH_CATEGORIES) {
    for (let i = 0; i < 4; i++) {
      const q = generateMathQuestion({
        difficulty: cat.difficulty,
        categories: [cat.id],
        usedSignatures,
      });

      assert.ok(q.options.A.length > 0, `Empty option A for ${cat.id}`);
      assert.ok(q.options.B.length > 0, `Empty option B for ${cat.id}`);
      assert.notEqual(q.options.A, q.options.B, `Duplicate options for ${cat.id}: ${q.options.A}`);
      assert.equal(Object.keys(q.options).length, 2, 'Must have strictly 2 options');
      assert.ok(q.correctOption === 'A' || q.correctOption === 'B');

      if (q.correctOption === 'A') countA++;
      else countB++;
    }
  }

  // Both A and B must appear as correct answers across generated questions
  assert.ok(countA > 10, 'Expected option A to be correct multiple times');
  assert.ok(countB > 10, 'Expected option B to be correct multiple times');
});

test('sanitizeCustomQuestions filters invalid entries and pickQuestionForRoom respects teacher questions and answers', () => {
  const sanitized = sanitizeCustomQuestions([
    { id: 'c1', prompt: '  Berapakah 7 x 8?  ', optionA: ' 54 ', optionB: ' 56 ', correctOption: 'B', explanation: '7 × 8 = 56' },
    { id: 'bad1', prompt: '', optionA: '1', optionB: '2', correctOption: 'A' },
    { id: 'bad2', prompt: 'Sama?', optionA: '10', optionB: ' 10 ', correctOption: 'A' },
    { id: 'c2', prompt: 'Ibukota Jabar?', optionA: 'Bandung', optionB: 'Surabaya', correctOption: 'A' },
  ]);

  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].correctOption, 'B');
  assert.equal(sanitized[0].optionB, '56');
  assert.equal(sanitized[1].correctOption, 'A');

  const used = new Set<string>();
  const q1 = pickQuestionForRoom({
    difficulty: 'easy',
    questionSource: 'custom_only',
    customQuestions: sanitized,
    usedSignatures: used,
    rng: () => 0.1,
  });
  assert.equal(q1.category, 'custom');
  assert.equal(q1.categoryName, 'Soal Buatan Guru');
  assert.equal(q1.prompt, 'Berapakah 7 x 8?');
  assert.equal(q1.options.A, '54');
  assert.equal(q1.options.B, '56');
  assert.equal(q1.correctOption, 'B');

  const q2 = pickQuestionForRoom({
    difficulty: 'easy',
    questionSource: 'custom_only',
    customQuestions: sanitized,
    usedSignatures: used,
    rng: () => 0.1,
  });
  assert.equal(q2.category, 'custom');
  assert.equal(q2.prompt, 'Ibukota Jabar?');
  assert.equal(q2.correctOption, 'A');

  // Cycles cleanly once all custom questions are used
  const q3 = pickQuestionForRoom({
    difficulty: 'easy',
    questionSource: 'custom_only',
    customQuestions: sanitized,
    usedSignatures: used,
    rng: () => 0.1,
  });
  assert.equal(q3.category, 'custom');

  // Empty customQuestions falls back safely to auto-generated question
  const fallback = pickQuestionForRoom({
    difficulty: 'easy',
    questionSource: 'custom_only',
    customQuestions: [],
  });
  assert.notEqual(fallback.category, 'custom');
});

test('Score System and Leaderboards compute points, accuracy, and team ranks accurately', () => {
  const score1 = calculatePlayerScore({
    correctAnswers: 4,
    wrongAnswers: 1,
    keysCollected: 4,
    completedLevel: true,
    remainingSeconds: 50,
  });
  // 4*100 + 4*50 + 300 + 50*2 = 400 + 200 + 300 + 100 = 1000
  assert.equal(score1, 1000);
  assert.equal(calculateAccuracy(4, 1), 80);

  const lb = buildIndividualLeaderboard([
    {
      playerId: 'p1',
      name: 'Budi',
      characterId: 'knight',
      outfitColor: '#2563EB',
      teamId: 'red',
      score: 450,
      keysCollected: 3,
      correctAnswers: 3,
      wrongAnswers: 1,
      lives: 2,
      status: 'active',
      completionTimeSeconds: null,
    },
    {
      playerId: 'p2',
      name: 'Siti',
      characterId: 'mage',
      outfitColor: '#7C3AED',
      teamId: 'blue',
      score: 1000,
      keysCollected: 5,
      correctAnswers: 5,
      wrongAnswers: 0,
      lives: 3,
      status: 'escaped',
      completionTimeSeconds: 120,
    },
  ]);

  assert.equal(lb[0].name, 'Siti');
  assert.equal(lb[0].rank, 1);
  assert.equal(lb[0].accuracy, 100);
  assert.equal(lb[1].name, 'Budi');
  assert.equal(lb[1].rank, 2);
  assert.equal(lb[1].accuracy, 75);

  const teamLb = buildTeamLeaderboard(
    lb,
    { red: 3, blue: 5, green: 0, yellow: 0, purple: 0 },
    ['red', 'blue'],
    5
  );
  assert.equal(teamLb[0].teamId, 'blue');
  assert.equal(teamLb[0].progressPercent, 100);
  assert.equal(teamLb[1].teamId, 'red');
  assert.equal(teamLb[1].progressPercent, 60);
});

test('Golden Key Particle System spawns multi-layered gold sparkles, shockwave rings, and floating banner', () => {
  const state = createParticleSystemState();
  assert.equal(hasActiveParticleEffects(state), false);
  assert.equal(state.goldenBurstCount, 0);

  spawnGoldenKeyBurst(state, 160, 224, {
    bannerText: '★ KUNCI EMAS! ★',
    subText: '+150 POIN',
  });

  assert.equal(state.goldenBurstCount, 1);
  assert.equal(hasActiveParticleEffects(state), true);
  assert.equal(countActiveParticles(state), 50);

  const activeParticles = state.particles.filter((p) => p.active);
  const goldColors = new Set<string>(GOLDEN_KEY_PALETTE);
  assert.ok(
    activeParticles.every((p) => goldColors.has(p.color)),
    'Every key burst particle must use the golden palette'
  );
  assert.ok(activeParticles.some((p) => p.shape === 'star'));
  assert.ok(activeParticles.some((p) => p.shape === 'diamond'));

  const activeRings = state.rings.filter((r) => r.active);
  assert.equal(activeRings.length, 2);
  const initialOuterRadius = activeRings[0].radius;

  const activeBanners = state.banners.filter((b) => b.active);
  assert.equal(activeBanners.length, 1);
  assert.equal(activeBanners[0].text, 'KUNCI EMAS!');
  const initialBannerY = activeBanners[0].y;

  // Spawning a second burst at the same position replaces the existing banner cleanly without stacking
  spawnGoldenKeyBurst(state, 160, 224, {
    bannerText: '★ KUNCI EMAS! ★',
    subText: '+150 POIN',
  });
  assert.equal(state.banners.filter((b) => b.active).length, 1);

  // Step 0.25s forward and verify rings expand and banner floats upward
  stepParticleSystem(state, 0.25);
  assert.ok(activeRings[0].radius > initialOuterRadius, 'Golden shockwave ring should expand');
  assert.ok(
    state.banners.filter((b) => b.active)[0].y < initialBannerY,
    'Golden banner should float upward'
  );

  // Step past max lifetime and verify clean pool deactivation
  for (let i = 0; i < 15; i++) {
    stepParticleSystem(state, 0.2);
  }
  assert.equal(hasActiveParticleEffects(state), false);
  assert.equal(countActiveParticles(state), 0);
});

import { shadeHexColor } from '../game/assets/PixelArtSprites';
import {
  MINIMAP_CELL_DISCOVERED,
  MINIMAP_CELL_UNDISCOVERED,
  MINIMAP_CELL_VISIBLE,
  createDiscoveredMinimapState,
  getMinimapCellState,
  updateDiscoveredMinimap,
} from './minimapSystem';

test('shadeHexColor produces lighter and darker 6-digit hex shades for 3-tone character pixel art', () => {
  const base = '#2563EB';
  const darker = shadeHexColor(base, -0.28);
  const lighter = shadeHexColor(base, 0.25);

  assert.match(darker, /^#[0-9A-Fa-f]{6}$/);
  assert.match(lighter, /^#[0-9A-Fa-f]{6}$/);
  assert.notEqual(darker.toUpperCase(), base.toUpperCase());
  assert.notEqual(lighter.toUpperCase(), base.toUpperCase());
  assert.notEqual(darker, lighter);
});

test('DiscoveredMinimapState tracks player exploration, remembers visited corridors, and reveals discovered rooms', () => {
  const maze = generateProceduralMaze({ level: 1, keyCount: 5, seed: 4821 });
  const mState = createDiscoveredMinimapState(maze);

  assert.equal(getMinimapCellState(mState, maze.spawnTile.x, maze.spawnTile.y), MINIMAP_CELL_UNDISCOVERED);

  // Step 1: Discover around spawn tile
  const spawnX = (maze.spawnTile.x + 0.5) * 32;
  const spawnY = (maze.spawnTile.y + 0.5) * 32;
  const firstUpdate = updateDiscoveredMinimap(mState, maze, spawnX, spawnY, 32, 8);
  assert.equal(firstUpdate.changed, true);
  assert.ok(firstUpdate.discoveryPercent >= 1);
  assert.equal(getMinimapCellState(mState, maze.spawnTile.x, maze.spawnTile.y), MINIMAP_CELL_VISIBLE);

  // Step 2: Move player inside the first secret room and verify the entire room is revealed
  const room0 = maze.secretRooms[0];
  assert.ok(room0, 'Expected at least one secret room in generated maze');
  const roomCenterX = (room0.x + Math.floor(room0.width / 2) + 0.5) * 32;
  const roomCenterY = (room0.y + Math.floor(room0.height / 2) + 0.5) * 32;
  const secondUpdate = updateDiscoveredMinimap(mState, maze, roomCenterX, roomCenterY, 32, 8);

  assert.equal(secondUpdate.changed, true);
  assert.ok(secondUpdate.discoveredRoomsCount >= 1);
  assert.equal(mState.discoveredRoomIndices.has(0), true);

  // Every tile inside room0 must now be discovered (>= MINIMAP_CELL_DISCOVERED)
  for (let ry = room0.y; ry < room0.y + room0.height; ry++) {
    for (let rx = room0.x; rx < room0.x + room0.width; rx++) {
      assert.ok(
        getMinimapCellState(mState, rx, ry) >= MINIMAP_CELL_DISCOVERED,
        `Secret room tile (${rx},${ry}) should be revealed once room is discovered`
      );
    }
  }
});




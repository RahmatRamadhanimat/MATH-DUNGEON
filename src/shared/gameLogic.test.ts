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
  computeMinimapViewport,
  createDiscoveredMinimapState,
  getMinimapCellState,
  getNearestObjectiveCompass,
  minimapPixelToWorldCoord,
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

import {
  VICTORY_LOBBY_LANDMARKS,
  createVictoryLobbyMaze,
  getNearestLobbyLandmark,
  isVictoryLobbyMaze,
} from './victoryLobbyMap';

test('Post-Dungeon Victory Sanctuary Lobby Map has reachable landmarks and 100% illuminated minimap', () => {
  const lobby = createVictoryLobbyMaze();
  assert.equal(isVictoryLobbyMaze(lobby), true);
  assert.equal(lobby.width, 27);
  assert.equal(lobby.height, 19);
  assert.equal(lobby.keys.length, 0);
  assert.equal(lobby.secretRooms.length, 3);

  // Verify spawn tile (South Arrival Gate at 13,15) and all landmarks are walkable and reachable via BFS
  const landmarkTargets = VICTORY_LOBBY_LANDMARKS.map((lm) => ({ x: lm.tileX, y: lm.tileY }));
  const bfs = validateMazeReachability(lobby.grid, lobby.spawnTile, landmarkTargets);
  assert.equal(bfs.valid, true, 'All Victory Lobby landmarks must be reachable from Arrival Gate');
  assert.equal(bfs.reachableCount, landmarkTargets.length);

  // Verify getNearestLobbyLandmark detects #1 Podium and Scoreboard Monument
  const nearPodium1 = getNearestLobbyLandmark(13.5 * 32, 4.5 * 32, 32, 2.2);
  assert.equal(nearPodium1?.id, 'podium_1');
  const nearMonument = getNearestLobbyLandmark(13.5 * 32, 9.5 * 32, 32, 2.2);
  assert.equal(nearMonument?.id, 'scoreboard_monument');

  // Verify minimap starts and stays 100% illuminated in Victory Lobby
  const mState = createDiscoveredMinimapState(lobby);
  assert.equal(mState.discoveredRoomIndices.size, 3);
  const summary = updateDiscoveredMinimap(mState, lobby, 13.5 * 32, 15.5 * 32, 32, 8);
  assert.equal(summary.discoveryPercent, 100);
  assert.equal(summary.discoveredRoomsCount, 3);
});

import {
  cycleSpectatedStudentId,
  resolveSpectatorCameraTarget,
  stepFreeCamPosition,
} from './spectatorCamera';

test('Spectator Camera System resolves student follow targets, Free-Cam movement bounds, and student cycling', () => {
  const players = [
    {
      id: 'stu-1',
      name: 'Arya',
      role: 'student' as const,
      x: 120,
      y: 160,
      status: 'active' as const,
      score: 250,
      keysCollected: 2,
      lives: 3,
      characterId: 'knight',
      outfitColor: '#2563EB',
    },
    {
      id: 'stu-2',
      name: 'Lyra',
      role: 'student' as const,
      x: 420,
      y: 380,
      status: 'active' as const,
      score: 500,
      keysCollected: 4,
      lives: 3,
      characterId: 'mage',
      outfitColor: '#7C3AED',
    },
  ];
  const interp = new Map([
    ['stu-1', { x: 128, y: 164 }],
    ['stu-2', { x: 432, y: 390 }],
  ]);

  // 1. Follow Student mode locks onto the selected student's interpolated position
  const followRes = resolveSpectatorCameraTarget({
    mode: 'follow_student',
    spectatedPlayerId: 'stu-2',
    localPos: { x: 64, y: 64 },
    freeCamPos: { x: 200, y: 200 },
    players,
    interpolatedPositions: interp,
  });
  assert.equal(followRes.activeMode, 'follow_student');
  assert.equal(followRes.followedPlayer?.name, 'Lyra');
  assert.equal(followRes.targetX, 432);
  assert.equal(followRes.targetY, 390);

  // 2. Free-Cam mode uses freeCamPos and clamps within maze world bounds
  const steppedFreeCam = stepFreeCamPosition({
    x: 200,
    y: 200,
    dx: 1,
    dy: -0.5,
    dt: 0.5,
    mazeWidth: 35,
    mazeHeight: 35,
    tileSize: 32,
    speed: 300,
  });
  assert.equal(steppedFreeCam.x, 350);
  assert.equal(steppedFreeCam.y, 125);

  const clampedFreeCam = stepFreeCamPosition({
    x: 10,
    y: 10,
    dx: -1,
    dy: -1,
    dt: 1,
    mazeWidth: 35,
    mazeHeight: 35,
    tileSize: 32,
    speed: 500,
  });
  assert.equal(clampedFreeCam.x, 16);
  assert.equal(clampedFreeCam.y, 16);

  // 3. Student cycling wraps cleanly forward and backward
  const ids = ['stu-1', 'stu-2', 'stu-3'];
  assert.equal(cycleSpectatedStudentId(ids, null, 1), 'stu-1');
  assert.equal(cycleSpectatedStudentId(ids, 'stu-1', 1), 'stu-2');
  assert.equal(cycleSpectatedStudentId(ids, 'stu-3', 1), 'stu-1');
  assert.equal(cycleSpectatedStudentId(ids, 'stu-1', -1), 'stu-3');
});

import { computeMvpHighlights, formatAnswerSpeedSeconds } from './scoreSystem';
import {
  ActiveOverheadEmote,
  evaluatePlayerEmote,
  isValidEmoteId,
  triggerPlayerEmote,
} from './emoteSystem';

test('MVP Badges & End-of-Session Titles assign "Si Kilat Matematika", "Penjelajah Sejati", and "Akurasi Sempurna 100%" accurately', () => {
  assert.equal(formatAnswerSpeedSeconds(1850), '1.9d');

  const lb = buildIndividualLeaderboard([
    {
      playerId: 'stu-fast',
      name: 'Raka Kilat',
      characterId: 'ranger',
      outfitColor: '#16A34A',
      teamId: 'green',
      score: 920,
      keysCollected: 5,
      correctAnswers: 5,
      wrongAnswers: 0,
      lives: 3,
      status: 'escaped',
      completionTimeSeconds: 95,
      fastestAnswerMs: 1420,
      tilesExploredCount: 84,
    },
    {
      playerId: 'stu-explorer',
      name: 'Nadia Kompas',
      characterId: 'paladin',
      outfitColor: '#D97706',
      teamId: 'yellow',
      score: 780,
      keysCollected: 4,
      correctAnswers: 4,
      wrongAnswers: 1,
      lives: 2,
      status: 'active',
      completionTimeSeconds: null,
      fastestAnswerMs: 3600,
      tilesExploredCount: 196,
    },
  ]);

  const raka = lb.find((e) => e.playerId === 'stu-fast')!;
  const nadia = lb.find((e) => e.playerId === 'stu-explorer')!;

  assert.ok(raka.mvpBadges.some((b) => b.title === 'Si Kilat Matematika'));
  assert.ok(raka.mvpBadges.some((b) => b.title === 'Akurasi Sempurna 100%'));
  assert.ok(nadia.mvpBadges.some((b) => b.title === 'Penjelajah Sejati'));

  const highlights = computeMvpHighlights(lb);
  assert.equal(highlights.length, 3);
  assert.equal(highlights[0].badge.title, 'Si Kilat Matematika');
  assert.equal(highlights[0].winner.name, 'Raka Kilat');
  assert.equal(highlights[1].badge.title, 'Penjelajah Sejati');
  assert.equal(highlights[1].winner.name, 'Nadia Kompas');
  assert.equal(highlights[2].badge.title, 'Akurasi Sempurna 100%');
  assert.equal(highlights[2].winner.name, 'Raka Kilat');
});

test('Overhead Animated Pixel Emotes trigger, animate character jump bounce, and expire cleanly', () => {
  assert.equal(isValidEmoteId('happy_jump'), true);
  assert.equal(isValidEmoteId('crown'), true);
  assert.equal(isValidEmoteId('fireworks'), true);
  assert.equal(isValidEmoteId('unknown_emote'), false);

  const map = new Map<string, ActiveOverheadEmote>();
  const created = triggerPlayerEmote(map, {
    playerId: 'plr-1',
    playerName: 'Arya',
    emoteId: 'happy_jump',
    nowMs: 1000,
    durationMs: 2800,
  });

  assert.equal(created.emoteId, 'happy_jump');
  assert.equal(map.size, 1);

  // Mid-animation evaluation (t = 1650ms) produces popScale >= 1 and negative characterBounceY (jumping up)
  const evalMid = evaluatePlayerEmote(map, 'plr-1', 1650);
  assert.ok(evalMid, 'Emote should be active at 1650ms');
  assert.equal(evalMid.emote.id, 'happy_jump');
  assert.equal(evalMid.alpha, 1);
  assert.ok(evalMid.characterBounceY <= 0, 'Character bounce offset must be upward (<= 0)');

  // After expiration (t = 3900ms > 3800ms), evaluatePlayerEmote cleans up map and returns null
  const evalExpired = evaluatePlayerEmote(map, 'plr-1', 3900);
  assert.equal(evalExpired, null);
  assert.equal(map.size, 0);
});

import {
  buildStudentAnalyticsReport,
  resolveCategoryDisplayInfo,
} from './studentAnalytics';

test('buildStudentAnalyticsReport computes average response times, error rates, and learning gap severity', () => {
  const catInfo = resolveCategoryDisplayInfo('fractions');
  assert.equal(catInfo.shortName, 'Pecahan');
  assert.equal(catInfo.difficultyLabel, 'Sedang');

  const report = buildStudentAnalyticsReport({
    categoryStats: [
      {
        category: 'algebra',
        attempts: 20,
        correct: 12,
        wrong: 8,
        totalResponseMs: 20 * 7200, // 7.2s avg
      },
      {
        category: 'multiplication',
        attempts: 30,
        correct: 27,
        wrong: 3,
        totalResponseMs: 30 * 3200, // 3.2s avg
      },
    ],
    liveLeaderboard: [
      {
        rank: 1,
        playerId: 'stu-1',
        name: 'Siti Aminah',
        characterId: 'mage',
        outfitColor: '#7C3AED',
        teamId: 'blue',
        score: 900,
        keysCollected: 5,
        correctAnswers: 5,
        wrongAnswers: 1,
        accuracy: 83,
        lives: 2,
        status: 'escaped',
        completionTimeSeconds: 120,
        fastestAnswerMs: 1800,
        tilesExploredCount: 110,
        mvpBadges: [],
      },
    ],
  });

  assert.equal(report.topicAnalytics.length, 2);
  // Sorted by highest errorRatePercent first: algebra (40%) before multiplication (10%)
  assert.equal(report.topicAnalytics[0].category, 'algebra');
  assert.equal(report.topicAnalytics[0].errorRatePercent, 40);
  assert.equal(report.topicAnalytics[0].avgResponseSeconds, 7.2);
  assert.equal(report.topicAnalytics[0].severity, 'critical');

  assert.equal(report.topicAnalytics[1].category, 'multiplication');
  assert.equal(report.topicAnalytics[1].errorRatePercent, 10);
  assert.equal(report.topicAnalytics[1].avgResponseSeconds, 3.2);
  assert.equal(report.topicAnalytics[1].severity, 'mastered');

  assert.equal(report.summary.mostChallengingTopic?.category, 'algebra');
  assert.equal(report.summary.slowestTopic?.category, 'algebra');
  assert.equal(report.summary.totalAttemptsAnalyzed, 50);
  assert.equal(report.summary.totalErrorsAnalyzed, 11);
  assert.ok(report.studentResponses.some((s) => s.studentName === 'Siti Aminah'));
});

import { QUESTION_BANK_PRESET_PACKS, getAllPresetQuestions } from './questionBankPresets';

test('Question Bank Presets provide 50 curated curriculum questions across 5 packs and support up to 100 questions per room', () => {
  assert.equal(QUESTION_BANK_PRESET_PACKS.length, 5);
  const allPresets = getAllPresetQuestions();
  assert.equal(allPresets.length, 50);

  const sanitized = sanitizeCustomQuestions(allPresets);
  assert.equal(sanitized.length, 50);

  for (const q of sanitized) {
    assert.ok(q.prompt.length >= 10, `Prompt too short: ${q.prompt}`);
    assert.ok(q.optionA.length > 0);
    assert.ok(q.optionB.length > 0);
    assert.notEqual(q.optionA.toLowerCase(), q.optionB.toLowerCase());
    assert.ok(q.correctOption === 'A' || q.correctOption === 'B');
    assert.ok(q.explanation && q.explanation.length > 5);
  }

  // Verify redesigned procedural maze rooms have atmospheric Indonesian names
  const maze = generateProceduralMaze({ level: 2, keyCount: 6, seed: 2026 });
  assert.ok(maze.secretRooms.every((r) => typeof r.name === 'string' && r.name.length > 3));
  assert.equal(maze.grid[maze.spawnTile.y][maze.spawnTile.x], TileType.PORTAL_SPAWN);
});

test('Mini-map viewport, click-to-world projection, and objective compass support large 75x75 mazes', () => {
  // 1. Full mode covers entire 75x75 maze without zoom
  const fullVp = computeMinimapViewport({
    mazeWidth: 75,
    mazeHeight: 75,
    focusTileX: 37,
    focusTileY: 37,
    viewMode: 'full',
    radarSpanTiles: 25,
  });
  assert.equal(fullVp.isZoomed, false);
  assert.equal(fullVp.startX, 0);
  assert.equal(fullVp.startY, 0);
  assert.equal(fullVp.spanX, 75);
  assert.equal(fullVp.spanY, 75);

  // 2. Radar mode centers a 25x25 window around the focus tile and clamps cleanly at map corners
  const centerRadar = computeMinimapViewport({
    mazeWidth: 75,
    mazeHeight: 75,
    focusTileX: 40,
    focusTileY: 30,
    viewMode: 'radar',
    radarSpanTiles: 25,
  });
  assert.equal(centerRadar.isZoomed, true);
  assert.equal(centerRadar.spanX, 25);
  assert.equal(centerRadar.spanY, 25);
  assert.equal(centerRadar.startX, 27.5);
  assert.equal(centerRadar.startY, 17.5);

  const topLeftRadar = computeMinimapViewport({
    mazeWidth: 75,
    mazeHeight: 75,
    focusTileX: 3,
    focusTileY: 2,
    viewMode: 'radar',
    radarSpanTiles: 25,
  });
  assert.equal(topLeftRadar.startX, 0);
  assert.equal(topLeftRadar.startY, 0);

  const bottomRightRadar = computeMinimapViewport({
    mazeWidth: 75,
    mazeHeight: 75,
    focusTileX: 73,
    focusTileY: 74,
    viewMode: 'radar',
    radarSpanTiles: 25,
  });
  assert.equal(bottomRightRadar.startX, 50);
  assert.equal(bottomRightRadar.startY, 50);

  // 3. Clicking the center of a zoomed Radar viewport maps to the exact world coordinate of the focus tile
  const worldCenter = minimapPixelToWorldCoord({
    clickRatioX: 0.5,
    clickRatioY: 0.5,
    viewport: centerRadar,
    tileSize: 32,
    mazeWidth: 75,
    mazeHeight: 75,
  });
  assert.equal(worldCenter.x, 40 * 32);
  assert.equal(worldCenter.y, 30 * 32);

  // 4. Objective compass points to nearest available key when exit is locked, and switches to Exit when open
  const nearestKeyCompass = getNearestObjectiveCompass({
    playerTileX: 10,
    playerTileY: 10,
    isDoorOpen: false,
    exitTile: { x: 70, y: 70 },
    availableKeys: [
      { tileX: 50, tileY: 10 },
      { tileX: 18, tileY: 10 },
    ],
  });
  assert.ok(nearestKeyCompass);
  assert.equal(nearestKeyCompass.kind, 'key');
  assert.equal(nearestKeyCompass.distanceTiles, 8);
  assert.equal(nearestKeyCompass.directionLabel, 'T');

  const slightNorthEast = getNearestObjectiveCompass({
    playerTileX: 10,
    playerTileY: 10,
    isDoorOpen: false,
    exitTile: { x: 70, y: 70 },
    availableKeys: [{ tileX: 25, tileY: 9 }],
  });
  assert.equal(slightNorthEast?.directionLabel, 'T');

  const exitCompass = getNearestObjectiveCompass({
    playerTileX: 20,
    playerTileY: 20,
    isDoorOpen: true,
    exitTile: { x: 10, y: 10 },
    availableKeys: [{ tileX: 22, tileY: 20 }],
  });
  assert.ok(exitCompass);
  assert.equal(exitCompass.kind, 'exit');
  assert.equal(exitCompass.directionLabel, 'BL');
  assert.equal(exitCompass.distanceTiles, Math.round(Math.hypot(-10, -10)));
});

import {
  buildProjectorBroadcastSummary,
  computeFullMazeFitTransform,
  formatProjectorClock,
  selectProjectorFeedEvents,
  worldPixelToProjectorPoint,
} from './projectorMode';

test('Projector / Classroom TV Big Screen View computes full-maze fit, urgency timer, and live podium order accurately', () => {
  // 1. Aspect-preserving full-maze fit for 75x75 map inside 1000x760 stage with 20px padding
  const fit = computeFullMazeFitTransform({
    canvasWidth: 1000,
    canvasHeight: 760,
    mazeWidth: 75,
    mazeHeight: 75,
    paddingPx: 20,
  });
  assert.equal(fit.mapPixelH, 720);
  assert.equal(fit.mapPixelW, 720);
  assert.equal(fit.offsetX, 140);
  assert.equal(fit.offsetY, 20);

  // World center (37.5 tiles * 32px) maps cleanly to canvas center (500, 380)
  const centerPt = worldPixelToProjectorPoint({
    worldX: 37.5 * 32,
    worldY: 37.5 * 32,
    tileSize: 32,
    transform: fit,
  });
  assert.equal(Math.round(centerPt.x), 500);
  assert.equal(Math.round(centerPt.y), 380);

  // 2. Classroom timer formatting & urgency tiers
  assert.deepEqual(formatProjectorClock(185), { formatted: '03:05', urgency: 'normal' });
  assert.deepEqual(formatProjectorClock(55), { formatted: '00:55', urgency: 'warning' });
  assert.deepEqual(formatProjectorClock(24), { formatted: '00:24', urgency: 'critical' });

  // 3. Broadcast summary builds #2 | #1 | #3 championship podium order and live counts
  const lb = buildIndividualLeaderboard([
    {
      playerId: 's1',
      name: 'Budi',
      characterId: 'knight',
      outfitColor: '#2563EB',
      teamId: null,
      score: 900,
      keysCollected: 5,
      correctAnswers: 5,
      wrongAnswers: 0,
      lives: 3,
      status: 'escaped',
      completionTimeSeconds: 95,
    },
    {
      playerId: 's2',
      name: 'Citra',
      characterId: 'mage',
      outfitColor: '#7C3AED',
      teamId: null,
      score: 650,
      keysCollected: 4,
      correctAnswers: 4,
      wrongAnswers: 1,
      lives: 2,
      status: 'active',
      completionTimeSeconds: null,
    },
    {
      playerId: 's3',
      name: 'Dani',
      characterId: 'ranger',
      outfitColor: '#16A34A',
      teamId: null,
      score: 400,
      keysCollected: 2,
      correctAnswers: 2,
      wrongAnswers: 1,
      lives: 2,
      status: 'active',
      completionTimeSeconds: null,
    },
    {
      playerId: 's4',
      name: 'Eka',
      characterId: 'paladin',
      outfitColor: '#D97706',
      teamId: null,
      score: 150,
      keysCollected: 1,
      correctAnswers: 1,
      wrongAnswers: 0,
      lives: 3,
      status: 'active',
      completionTimeSeconds: null,
    },
  ]);

  const summary = buildProjectorBroadcastSummary({
    players: [
      { id: 't1', role: 'teacher', status: 'spectator', keysCollected: 0 },
      { id: 's1', role: 'student', status: 'escaped', animState: 'idle', keysCollected: 5 },
      { id: 's2', role: 'student', status: 'active', animState: 'answering', keysCollected: 4 },
      { id: 's3', role: 'student', status: 'active', animState: 'walk', keysCollected: 2 },
      { id: 's4', role: 'student', status: 'active', animState: 'idle', keysCollected: 1 },
    ],
    leaderboard: lb,
    teamLeaderboard: [],
    mode: 'coop',
    sharedKeysCollected: 5,
    teamKeysCollected: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
    targetKeys: 5,
  });

  assert.equal(summary.totalStudents, 4);
  assert.equal(summary.activeStudents, 3);
  assert.equal(summary.escapedStudents, 1);
  assert.equal(summary.answeringStudents, 1);
  assert.equal(summary.isExitOpenForClass, true);
  assert.equal(summary.keyProgressPercent, 100);
  // Classic stepped order: left=#2 (Citra), center=#1 (Budi), right=#3 (Dani)
  assert.equal(summary.podiumSlots[0].place, 2);
  assert.equal(summary.podiumSlots[0].entry?.name, 'Citra');
  assert.equal(summary.podiumSlots[1].place, 1);
  assert.equal(summary.podiumSlots[1].entry?.name, 'Budi');
  assert.equal(summary.podiumSlots[2].place, 3);
  assert.equal(summary.podiumSlots[2].entry?.name, 'Dani');
  assert.equal(summary.runnerUps.length, 1);
  assert.equal(summary.runnerUps[0].name, 'Eka');

  // 4. Ticker event selector returns latest events newest-first
  const feed = selectProjectorFeedEvents(
    [
      { id: '1', senderName: 'Sistem', text: 'Mulai!', type: 'system', timestamp: 1 },
      { id: '2', senderName: 'Budi', text: 'Dapat kunci!', type: 'chat', timestamp: 2 },
      { id: '3', senderName: 'Citra', text: 'Menuju exit!', type: 'chat', timestamp: 3 },
    ],
    2
  );
  assert.equal(feed.length, 2);
  assert.equal(feed[0].id, '3');
  assert.equal(feed[1].id, '2');
});

import {
  DEFAULT_MAZE_BIOME,
  MAZE_BIOME_LIST,
  MAZE_BIOMES,
  getMazeBiomeTheme,
  normalizeMazeBiome,
} from './biomeThemes';

test('Maze Biome Themes provide 4 distinct visual palettes with safe normalization', () => {
  assert.equal(DEFAULT_MAZE_BIOME, 'stone_dungeon');
  assert.equal(MAZE_BIOME_LIST.length, 4);

  const ids = MAZE_BIOME_LIST.map((b) => b.id);
  assert.deepEqual(ids, ['stone_dungeon', 'crystal_forest', 'desert_temple', 'ice_fortress']);

  // Every biome has a distinct wall & floor palette and valid 4-color swatch preview
  const wallColors = new Set(MAZE_BIOME_LIST.map((b) => b.tiles.wallUpperA));
  const floorColors = new Set(MAZE_BIOME_LIST.map((b) => b.tiles.floorSlabA));
  const projectorWalls = new Set(MAZE_BIOME_LIST.map((b) => b.projector.wallBase));
  assert.equal(wallColors.size, 4, 'All 4 biomes must have distinct wall colors');
  assert.equal(floorColors.size, 4, 'All 4 biomes must have distinct floor colors');
  assert.equal(projectorWalls.size, 4, 'All 4 biomes must have distinct projector wall tints');

  for (const b of MAZE_BIOME_LIST) {
    assert.equal(b.swatchColors.length, 4);
    assert.ok(b.name.length > 0);
    assert.ok(b.tagline.length > 0);
    assert.equal(MAZE_BIOMES[b.id].name, b.name);
  }

  assert.equal(normalizeMazeBiome('crystal_forest'), 'crystal_forest');
  assert.equal(normalizeMazeBiome('desert_temple'), 'desert_temple');
  assert.equal(normalizeMazeBiome('ice_fortress'), 'ice_fortress');
  assert.equal(normalizeMazeBiome('unknown_biome'), 'stone_dungeon');
  assert.equal(normalizeMazeBiome(undefined), 'stone_dungeon');
  assert.equal(getMazeBiomeTheme('desert_temple').name, 'Kuil Gurun Pasir');
  assert.equal(getMazeBiomeTheme('invalid').id, 'stone_dungeon');
});

import QRCode from 'qrcode';
import {
  buildRoomJoinUrl,
  extractRoomCodeFromSearch,
  formatDisplayJoinHost,
} from './roomJoinLink';

test('QR Code Room Join links normalize codes, extract ?room= params, and render valid scannable PNG QR data', async () => {
  // 1. Builds canonical join URL with normalized MATH-XXXX code and clean trailing slash handling
  assert.equal(
    buildRoomJoinUrl('https://kelas.mathmaze.app/', '4821'),
    'https://kelas.mathmaze.app/?room=MATH-4821'
  );
  assert.equal(
    buildRoomJoinUrl('http://localhost:3000', 'math-9012'),
    'http://localhost:3000/?room=MATH-9012'
  );
  assert.equal(buildRoomJoinUrl('', '7744'), '/?room=MATH-7744');

  // 2. Extracts and normalizes ?room= query params cleanly
  assert.equal(extractRoomCodeFromSearch('?room=MATH-4821'), 'MATH-4821');
  assert.equal(extractRoomCodeFromSearch('?foo=1&room=5532'), 'MATH-5532');
  assert.equal(extractRoomCodeFromSearch('?room=   '), null);
  assert.equal(extractRoomCodeFromSearch(''), null);

  // 3. Formats human-readable host + query for modal display
  assert.equal(
    formatDisplayJoinHost('https://kelas.mathmaze.app/?room=MATH-4821'),
    'kelas.mathmaze.app/?room=MATH-4821'
  );

  // 4. Generates real ISO/IEC 18004 PNG data URL for the room join link
  const joinUrl = buildRoomJoinUrl('http://localhost:3000', 'MATH-4821');
  const dataUrl = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
  });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR data URL must be a valid PNG base64 URI');
  assert.ok(dataUrl.length > 400, 'QR PNG payload must contain non-trivial encoded bitmap data');
});






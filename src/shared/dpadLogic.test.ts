import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAP_STEP_DURATION_MS,
  clearDpadInput,
  createDpadInputState,
  getActiveDpadDirection,
  moveDpadDirection,
  pressDpadDirection,
  releaseDpadInput,
  resolveDpadDirectionFromPoint,
  resolveMovementVector,
  triggerDpadTap,
} from './dpadLogic';

test('quick tap keeps direction active for TAP_STEP_DURATION_MS even after immediate release', () => {
  const state = createDpadInputState();
  pressDpadDirection(state, 'right', 1000);
  // Finger lifted 12ms later (before next rAF frame)
  releaseDpadInput(state);

  assert.equal(getActiveDpadDirection(state, 1020), 'right');
  const duringTap = resolveMovementVector(new Set(), state, 1020);
  assert.equal(duringTap.dx, 1);
  assert.equal(duringTap.dy, 0);
  assert.equal(duringTap.activeDpadDir, 'right');

  // Tap expires cleanly after duration
  assert.equal(getActiveDpadDirection(state, 1000 + TAP_STEP_DURATION_MS), null);
  const afterTap = resolveMovementVector(new Set(), state, 1000 + TAP_STEP_DURATION_MS);
  assert.equal(afterTap.dx, 0);
  assert.equal(afterTap.dy, 0);
});

test('holding D-pad continues moving past tap duration until released', () => {
  const state = createDpadInputState();
  pressDpadDirection(state, 'down', 500);

  const longHold = resolveMovementVector(new Set(), state, 2500);
  assert.equal(longHold.dx, 0);
  assert.equal(longHold.dy, 1);
  assert.equal(longHold.activeDpadDir, 'down');

  releaseDpadInput(state);
  const afterRelease = resolveMovementVector(new Set(), state, 2501);
  assert.equal(afterRelease.dx, 0);
  assert.equal(afterRelease.dy, 0);
});

test('triggerDpadTap and clearDpadInput handle synthetic clicks and modal/blur resets', () => {
  const state = createDpadInputState();
  triggerDpadTap(state, 'left', 200);
  assert.equal(getActiveDpadDirection(state, 250), 'left');

  clearDpadInput(state);
  assert.equal(getActiveDpadDirection(state, 250), null);
});

test('moveDpadDirection supports sliding thumb between directions', () => {
  const state = createDpadInputState();
  pressDpadDirection(state, 'up', 100);
  moveDpadDirection(state, 'right', 140);
  assert.equal(getActiveDpadDirection(state, 150), 'right');

  moveDpadDirection(state, null, 160);
  assert.equal(state.heldDirection, null);
});

test('resolveDpadDirectionFromPoint maps pad coordinates and center deadzone accurately', () => {
  const size = 156;
  assert.equal(resolveDpadDirectionFromPoint(78, 78, size, size), null);
  assert.equal(resolveDpadDirectionFromPoint(78, 20, size, size), 'up');
  assert.equal(resolveDpadDirectionFromPoint(78, 136, size, size), 'down');
  assert.equal(resolveDpadDirectionFromPoint(20, 78, size, size), 'left');
  assert.equal(resolveDpadDirectionFromPoint(136, 78, size, size), 'right');
});

test('resolveMovementVector normalizes keyboard diagonals and clamps combined input', () => {
  const state = createDpadInputState();
  pressDpadDirection(state, 'right', 1000);
  const combined = resolveMovementVector(new Set(['ArrowRight', 'ArrowUp']), state, 1010);
  assert.ok(Math.abs(Math.hypot(combined.dx, combined.dy) - 1) < 1e-6);
  assert.ok(combined.dx > 0 && combined.dy < 0);
});

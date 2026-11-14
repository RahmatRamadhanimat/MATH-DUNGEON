import { Direction } from './constants';

export const TAP_STEP_DURATION_MS = 180;

export interface DpadInputState {
  heldDirection: Direction | null;
  tapDirection: Direction | null;
  tapUntilMs: number;
}

export function createDpadInputState(): DpadInputState {
  return {
    heldDirection: null,
    tapDirection: null,
    tapUntilMs: 0,
  };
}

export function pressDpadDirection(
  state: DpadInputState,
  dir: Direction,
  nowMs: number
): void {
  state.heldDirection = dir;
  state.tapDirection = dir;
  state.tapUntilMs = nowMs + TAP_STEP_DURATION_MS;
}

export function moveDpadDirection(
  state: DpadInputState,
  dir: Direction | null,
  nowMs: number
): void {
  state.heldDirection = dir;
  if (dir !== null) {
    state.tapDirection = dir;
    state.tapUntilMs = nowMs + TAP_STEP_DURATION_MS;
  }
}

export function releaseDpadInput(state: DpadInputState): void {
  state.heldDirection = null;
}

export function triggerDpadTap(
  state: DpadInputState,
  dir: Direction,
  nowMs: number
): void {
  state.tapDirection = dir;
  state.tapUntilMs = nowMs + TAP_STEP_DURATION_MS;
}

export function clearDpadInput(state: DpadInputState): void {
  state.heldDirection = null;
  state.tapDirection = null;
  state.tapUntilMs = 0;
}

export function getActiveDpadDirection(
  state: DpadInputState,
  nowMs: number
): Direction | null {
  if (state.heldDirection) return state.heldDirection;
  if (state.tapDirection && nowMs < state.tapUntilMs) {
    return state.tapDirection;
  }
  return null;
}

export function resolveMovementVector(
  keysHeld: ReadonlySet<string>,
  dpadState: DpadInputState,
  nowMs: number
): { dx: number; dy: number; activeDpadDir: Direction | null } {
  let dx = 0;
  let dy = 0;

  if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) dy -= 1;
  if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) dy += 1;
  if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) dx -= 1;
  if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) dx += 1;

  const activeDpadDir = getActiveDpadDirection(dpadState, nowMs);
  if (activeDpadDir === 'up') dy -= 1;
  else if (activeDpadDir === 'down') dy += 1;
  else if (activeDpadDir === 'left') dx -= 1;
  else if (activeDpadDir === 'right') dx += 1;

  // Clamp individual axes so simultaneous keyboard + D-pad doesn't double-speed
  dx = Math.max(-1, Math.min(1, dx));
  dy = Math.max(-1, Math.min(1, dy));

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  return { dx, dy, activeDpadDir };
}

export function resolveDpadDirectionFromPoint(
  localX: number,
  localY: number,
  width: number,
  height: number,
  deadzoneRatio = 0.14
): Direction | null {
  if (width <= 0 || height <= 0) return null;
  const cx = width / 2;
  const cy = height / 2;
  const nx = (localX - cx) / (width / 2);
  const ny = (localY - cy) / (height / 2);

  if (Math.hypot(nx, ny) < deadzoneRatio) {
    return null;
  }

  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx >= 0 ? 'right' : 'left';
  }
  return ny >= 0 ? 'down' : 'up';
}

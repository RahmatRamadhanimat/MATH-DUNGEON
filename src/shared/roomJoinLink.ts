import { normalizeRoomCode } from './constants';

/**
 * Builds a clean, scannable student join URL containing the normalized room code
 * so students scanning the QR code on phone/tablet land directly with the room code pre-filled.
 */
export function buildRoomJoinUrl(origin: string, roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode);
  const cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    return cleanOrigin || '/';
  }
  const query = `?room=${encodeURIComponent(normalized)}`;
  return cleanOrigin ? `${cleanOrigin}/${query}` : `/${query}`;
}

/**
 * Extracts and normalizes the `?room=` query parameter from a URL search string.
 * Returns null if no valid room code is present.
 */
export function extractRoomCodeFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const raw = params.get('room');
    if (!raw) return null;
    const normalized = normalizeRoomCode(raw);
    return normalized || null;
  } catch {
    return null;
  }
}

/**
 * Formats a full join URL into a compact, readable host + query display string.
 */
export function formatDisplayJoinHost(joinUrl: string): string {
  try {
    const parsed = new URL(joinUrl);
    return `${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return joinUrl;
  }
}

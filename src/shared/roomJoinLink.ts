import {
  DifficultyLevel,
  GameMode,
  MazeBiomeId,
  normalizeRoomCode,
} from './constants';
import { normalizeMazeBiome } from './biomeThemes';

export const QR_CUSTOM_BASE_URL_STORAGE_KEY = 'math_maze_qr_public_base_url';
export const QR_BASE_URL_CHANGED_EVENT = 'math-maze-qr-base-url-changed';

export interface EffectiveQrBaseResult {
  baseUrl: string;
  source: 'custom' | 'shared-converted' | 'current';
  isDevPreview: boolean;
  isAiStudioPreview: boolean;
}

export interface HostTransferParams {
  roomCode: string;
  teacherName?: string;
  mode?: GameMode;
  difficulty?: DifficultyLevel;
  biome?: MazeBiomeId;
}

/**
 * Returns true if the URL/origin is Google AI Studio's private dev preview host (`ais-dev-*`),
 * which redirects direct external visits / mobile QR scans to `aistudio.google.com/404`.
 */
export function isDevPreviewOrigin(originOrUrl: string): boolean {
  try {
    const parsed = new URL(originOrUrl);
    return parsed.hostname.startsWith('ais-dev-');
  } catch {
    return /^https?:\/\/ais-dev-/i.test((originOrUrl || '').trim());
  }
}

/**
 * Returns true if the URL/origin is an AI Studio preview host (`ais-dev-*` or `ais-pre-*`).
 */
export function isAiStudioPreviewOrigin(originOrUrl: string): boolean {
  try {
    const parsed = new URL(originOrUrl);
    return parsed.hostname.startsWith('ais-dev-') || parsed.hostname.startsWith('ais-pre-');
  } catch {
    return /^https?:\/\/ais-(dev|pre)-/i.test((originOrUrl || '').trim());
  }
}

/**
 * Converts a private `ais-dev-*` dev preview origin into its corresponding Shared App origin (`ais-pre-*`).
 */
export function toSharedPreviewOrigin(originOrUrl: string): string {
  try {
    const parsed = new URL(originOrUrl);
    if (parsed.hostname.startsWith('ais-dev-')) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/, 'ais-pre-');
    }
    return parsed.origin;
  } catch {
    return (originOrUrl || '').replace(/\/\/ais-dev-/i, '//ais-pre-').replace(/\/+$/, '');
  }
}

/**
 * Validates and normalizes an optional teacher-configured public base URL (e.g. Cloud Run / custom domain).
 */
export function sanitizePublicBaseUrl(raw?: string | null): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    // Strip any ?room= or ?hostRoom= query params if the user pasted an old invite link
    parsed.searchParams.delete('room');
    parsed.searchParams.delete('hostRoom');
    const cleanPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    const cleanSearch = parsed.searchParams.toString();
    return `${parsed.origin}${cleanPath}${cleanSearch ? `?${cleanSearch}` : ''}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the safest public base URL to encode inside QR codes and invite links.
 * Never encodes private `ais-dev-*` hosts (which return 404 when scanned on phones/new tabs).
 */
export function resolveEffectiveQrBaseUrl(
  currentOrigin: string,
  customPublicUrl?: string | null
): EffectiveQrBaseResult {
  const isDev = isDevPreviewOrigin(currentOrigin);
  const isAiPreview = isAiStudioPreviewOrigin(currentOrigin);
  const sanitizedCustom = sanitizePublicBaseUrl(customPublicUrl);

  if (sanitizedCustom) {
    return {
      baseUrl: sanitizedCustom,
      source: 'custom',
      isDevPreview: isDev,
      isAiStudioPreview: isAiPreview,
    };
  }

  if (isDev) {
    return {
      baseUrl: toSharedPreviewOrigin(currentOrigin),
      source: 'shared-converted',
      isDevPreview: true,
      isAiStudioPreview: true,
    };
  }

  return {
    baseUrl: (currentOrigin || '').trim().replace(/\/+$/, ''),
    source: 'current',
    isDevPreview: false,
    isAiStudioPreview: isAiPreview,
  };
}

/**
 * Builds a clean, scannable student join URL containing the normalized room code
 * so students scanning the QR code on phone/tablet land directly with the room code pre-filled.
 */
export function buildRoomJoinUrl(originOrBaseUrl: string, roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode);
  const cleanBase = (originOrBaseUrl || '').trim();
  if (!normalized) {
    return cleanBase || '/';
  }

  if (/^https?:\/\//i.test(cleanBase)) {
    try {
      const parsed = new URL(cleanBase);
      parsed.searchParams.set('room', normalized);
      return parsed.toString();
    } catch {
      // Fall through to simple concatenation
    }
  }

  const trimmed = cleanBase.replace(/\/+$/, '');
  const query = `?room=${encodeURIComponent(normalized)}`;
  return trimmed ? `${trimmed}/${query}` : `/${query}`;
}

/**
 * Builds a 1-click transfer URL allowing a teacher on `ais-dev-*` to open the exact same
 * room code & settings on the Shared App URL (`ais-pre-*`) where QR scans connect to the same server.
 */
export function buildTeacherTransferUrl(
  targetOrigin: string,
  params: HostTransferParams
): string {
  const normalizedCode = normalizeRoomCode(params.roomCode);
  const base = toSharedPreviewOrigin(targetOrigin);
  try {
    const parsed = new URL(base);
    if (normalizedCode) parsed.searchParams.set('hostRoom', normalizedCode);
    if (params.teacherName?.trim()) {
      parsed.searchParams.set('teacher', params.teacherName.trim().slice(0, 32));
    }
    if (params.mode) parsed.searchParams.set('mode', params.mode);
    if (params.difficulty) parsed.searchParams.set('diff', params.difficulty);
    if (params.biome) parsed.searchParams.set('biome', params.biome);
    return parsed.toString();
  } catch {
    return base;
  }
}

/**
 * Extracts and normalizes the `?room=` query parameter (or `#room=` hash fallback) from a URL.
 * Returns null if no valid room code is present.
 */
export function extractRoomCodeFromSearch(search: string, hash?: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const raw = params.get('room');
    if (raw) {
      const normalized = normalizeRoomCode(raw);
      if (normalized) return normalized;
    }
  } catch {
    // Ignore malformed query string
  }

  if (hash) {
    try {
      const cleanHash = hash.replace(/^#\/?/, '');
      const hashQuery = cleanHash.includes('?') ? cleanHash.split('?')[1] : cleanHash;
      const hashParams = new URLSearchParams(hashQuery);
      const rawHashRoom = hashParams.get('room');
      if (rawHashRoom) {
        const normalized = normalizeRoomCode(rawHashRoom);
        if (normalized) return normalized;
      }
    } catch {
      // Ignore malformed hash
    }
  }

  return null;
}

/**
 * Extracts teacher room-transfer parameters (`?hostRoom=MATH-XXXX&...`) when opening a room
 * directly on the Shared App URL from the Preview Editor.
 */
export function extractHostTransferParams(search: string): HostTransferParams | null {
  try {
    const params = new URLSearchParams(search || '');
    const rawCode = params.get('hostRoom');
    if (!rawCode) return null;
    const roomCode = normalizeRoomCode(rawCode);
    if (!roomCode) return null;

    const teacherName = params.get('teacher')?.trim().slice(0, 32) || undefined;
    const rawMode = params.get('mode');
    const mode: GameMode | undefined =
      rawMode === 'coop' || rawMode === 'competitive' || rawMode === 'team' ? rawMode : undefined;
    const rawDiff = params.get('diff');
    const difficulty: DifficultyLevel | undefined =
      rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard' ? rawDiff : undefined;
    const rawBiome = params.get('biome');
    const biome: MazeBiomeId | undefined = rawBiome ? normalizeMazeBiome(rawBiome) : undefined;

    return {
      roomCode,
      teacherName,
      mode,
      difficulty,
      biome,
    };
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

export function getSavedCustomQrBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(QR_CUSTOM_BASE_URL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomQrBaseUrl(rawUrl: string | null): string {
  const sanitized = sanitizePublicBaseUrl(rawUrl) || '';
  if (typeof window !== 'undefined') {
    try {
      if (sanitized) {
        window.localStorage.setItem(QR_CUSTOM_BASE_URL_STORAGE_KEY, sanitized);
      } else {
        window.localStorage.removeItem(QR_CUSTOM_BASE_URL_STORAGE_KEY);
      }
      window.dispatchEvent(new Event(QR_BASE_URL_CHANGED_EVENT));
    } catch {
      // Ignore storage restrictions
    }
  }
  return sanitized;
}

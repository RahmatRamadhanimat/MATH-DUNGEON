export type EmoteId =
  | 'happy_jump'
  | 'crown'
  | 'fireworks'
  | 'key_found'
  | 'thumbs_up'
  | 'sos_help';

export interface EmoteDefinition {
  id: EmoteId;
  label: string;
  shortTag: string;
  chatText: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  hotkey: string;
}

export const EMOTE_DURATION_MS = 3400;

export const EMOTE_DEFINITIONS: EmoteDefinition[] = [
  {
    id: 'happy_jump',
    label: 'Lompat Gembira',
    shortTag: 'YAY!',
    chatText: '[YAY!] Lompat Gembira!',
    accentColor: '#FACC15',
    borderColor: '#FEF08A',
    bgColor: '#1E1B0A',
    hotkey: '1',
  },
  {
    id: 'crown',
    label: 'Mahkota Juara',
    shortTag: 'MAHKOTA',
    chatText: '[MAHKOTA] Sang Juara Labirin!',
    accentColor: '#F59E0B',
    borderColor: '#FDE68A',
    bgColor: '#231707',
    hotkey: '2',
  },
  {
    id: 'fireworks',
    label: 'Kembang Api',
    shortTag: 'MERIAH!',
    chatText: '[MERIAH!] Kembang Api Perayaan!',
    accentColor: '#EC4899',
    borderColor: '#F9A8D4',
    bgColor: '#230B1B',
    hotkey: '3',
  },
  {
    id: 'key_found',
    label: 'Kunci Ditemukan',
    shortTag: 'KUNCI!',
    chatText: '[KUNCI!] Kunci ditemukan di sini!',
    accentColor: '#38BDF8',
    borderColor: '#BAE6FD',
    bgColor: '#081C29',
    hotkey: '4',
  },
  {
    id: 'thumbs_up',
    label: 'Kerja Bagus',
    shortTag: 'MANTAP!',
    chatText: '[MANTAP!] Kerja bagus teman-teman!',
    accentColor: '#10B981',
    borderColor: '#6EE7B7',
    bgColor: '#072118',
    hotkey: '5',
  },
  {
    id: 'sos_help',
    label: 'Butuh Bantuan',
    shortTag: 'BANTU!',
    chatText: '[SOS] Butuh bantuan di posisi saya!',
    accentColor: '#EF4444',
    borderColor: '#FCA5A5',
    bgColor: '#260B0B',
    hotkey: '6',
  },
];

export const EMOTE_BY_ID: Record<EmoteId, EmoteDefinition> = {
  happy_jump: EMOTE_DEFINITIONS[0],
  crown: EMOTE_DEFINITIONS[1],
  fireworks: EMOTE_DEFINITIONS[2],
  key_found: EMOTE_DEFINITIONS[3],
  thumbs_up: EMOTE_DEFINITIONS[4],
  sos_help: EMOTE_DEFINITIONS[5],
};

export function isValidEmoteId(raw: unknown): raw is EmoteId {
  return (
    typeof raw === 'string' &&
    (raw === 'happy_jump' ||
      raw === 'crown' ||
      raw === 'fireworks' ||
      raw === 'key_found' ||
      raw === 'thumbs_up' ||
      raw === 'sos_help')
  );
}

export interface ActiveOverheadEmote {
  playerId: string;
  playerName: string;
  emoteId: EmoteId;
  startedAt: number;
  expiresAt: number;
}

export interface EvaluatedOverheadEmote {
  emote: EmoteDefinition;
  progress: number; // 0..1
  alpha: number; // 0..1
  bubbleScale: number; // pop-in & pulse scale
  characterBounceY: number; // negative pixel offset for joyful character jump
  floatOffsetY: number; // gentle floating offset for overhead balloon
  frameIndex: number; // 0..3 animation frame
}

export function triggerPlayerEmote(
  store: Map<string, ActiveOverheadEmote>,
  params: {
    playerId: string;
    playerName: string;
    emoteId: EmoteId;
    nowMs: number;
    durationMs?: number;
  }
): ActiveOverheadEmote {
  const duration = params.durationMs ?? EMOTE_DURATION_MS;
  const entry: ActiveOverheadEmote = {
    playerId: params.playerId,
    playerName: params.playerName,
    emoteId: params.emoteId,
    startedAt: params.nowMs,
    expiresAt: params.nowMs + duration,
  };
  store.set(params.playerId, entry);
  return entry;
}

export function evaluatePlayerEmote(
  store: Map<string, ActiveOverheadEmote>,
  playerId: string,
  nowMs: number
): EvaluatedOverheadEmote | null {
  const entry = store.get(playerId);
  if (!entry) return null;
  if (nowMs >= entry.expiresAt) {
    store.delete(playerId);
    return null;
  }

  const total = Math.max(1, entry.expiresAt - entry.startedAt);
  const elapsed = Math.max(0, nowMs - entry.startedAt);
  const progress = Math.min(1, elapsed / total);
  const emote = EMOTE_BY_ID[entry.emoteId] ?? EMOTE_DEFINITIONS[0];

  // Elastic pop-in during first 12% and smooth fade-out during last 15%
  let bubbleScale = 1;
  if (progress < 0.12) {
    const t = progress / 0.12;
    bubbleScale = 0.45 + 0.68 * Math.sin(t * (Math.PI / 2));
  } else {
    bubbleScale = 1 + Math.sin(elapsed / 120) * 0.05;
  }

  const alpha = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;

  // Character hop bounce when emote is happy_jump, fireworks, or crown
  let characterBounceY = 0;
  if (entry.emoteId === 'happy_jump') {
    characterBounceY = -Math.abs(Math.sin(elapsed / 95)) * 7.5;
  } else if (entry.emoteId === 'fireworks' || entry.emoteId === 'crown') {
    characterBounceY = -Math.abs(Math.sin(elapsed / 135)) * 4;
  }

  const floatOffsetY = Math.sin(elapsed / 160) * 2;
  const frameIndex = Math.floor(elapsed / 130) % 4;

  return {
    emote,
    progress,
    alpha,
    bubbleScale,
    characterBounceY,
    floatOffsetY,
    frameIndex,
  };
}

/**
 * Draws the animated 16-bit pixel speech balloon & pixel-art icon directly above a character's head
 */
export function renderOverheadEmoteBalloon(
  ctx: CanvasRenderingContext2D,
  charX: number,
  charY: number,
  evalEmote: EvaluatedOverheadEmote
): void {
  const { emote, alpha, bubbleScale, floatOffsetY, frameIndex } = evalEmote;
  const anchorX = Math.round(charX);
  const anchorY = Math.round(charY - 42 + floatOffsetY);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(anchorX, anchorY);
  ctx.scale(bubbleScale, bubbleScale);

  const boxW = 44;
  const boxH = 22;
  const halfW = boxW / 2;

  // Outer pixel shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-halfW + 1, -boxH + 1, boxW, boxH);

  // Main speech balloon body
  ctx.fillStyle = emote.bgColor;
  ctx.fillRect(-halfW, -boxH, boxW, boxH);

  // Crisp 16-bit double border
  ctx.strokeStyle = emote.borderColor;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(-halfW, -boxH, boxW, boxH);

  // Speech balloon pointer tail at bottom center
  ctx.fillStyle = emote.bgColor;
  ctx.beginPath();
  ctx.moveTo(-3.5, 0);
  ctx.lineTo(0, 4.5);
  ctx.lineTo(3.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = emote.borderColor;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-3.5, 0);
  ctx.lineTo(0, 4.5);
  ctx.lineTo(3.5, 0);
  ctx.stroke();

  // Draw animated pixel icon on left side of balloon (-13, -11)
  const iconCx = -13;
  const iconCy = -11;

  if (emote.id === 'happy_jump') {
    // Bouncing golden pixel happy face with cheering arms
    const hop = frameIndex % 2 === 0 ? -1 : 0;
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(iconCx - 5, iconCy - 5 + hop, 10, 10);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(iconCx - 4, iconCy - 4 + hop, 8, 2);
    // Eyes
    ctx.fillStyle = '#090D15';
    ctx.fillRect(iconCx - 3, iconCy - 2 + hop, 2, 2);
    ctx.fillRect(iconCx + 1, iconCy - 2 + hop, 2, 2);
    // Big smile
    ctx.fillRect(iconCx - 3, iconCy + 1 + hop, 6, 1.5);
    ctx.fillRect(iconCx - 2, iconCy + 2 + hop, 4, 1.5);
  } else if (emote.id === 'crown') {
    // Royal pixel crown with sparkling gems
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(iconCx - 6, iconCy + 4);
    ctx.lineTo(iconCx - 6, iconCy - 3);
    ctx.lineTo(iconCx - 3, iconCy);
    ctx.lineTo(iconCx, iconCy - 5);
    ctx.lineTo(iconCx + 3, iconCy);
    ctx.lineTo(iconCx + 6, iconCy - 3);
    ctx.lineTo(iconCx + 6, iconCy + 4);
    ctx.closePath();
    ctx.fill();
    // Crown jewel highlights
    ctx.fillStyle = frameIndex % 2 === 0 ? '#EF4444' : '#38BDF8';
    ctx.fillRect(iconCx - 1, iconCy, 2, 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(iconCx - 5, iconCy + 2, 10, 1.5);
  } else if (emote.id === 'fireworks') {
    // Multi-frame exploding pixel fireworks
    const r = 3 + frameIndex * 1.4;
    const colors = ['#FACC15', '#EC4899', '#38BDF8', '#34D399'];
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(iconCx - 1.5, iconCy - 1.5, 3, 3);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + frameIndex * 0.25;
      const px = iconCx + Math.cos(angle) * r;
      const py = iconCy + Math.sin(angle) * r;
      ctx.fillStyle = colors[(i + frameIndex) % colors.length];
      ctx.fillRect(px - 1, py - 1, 2.2, 2.2);
    }
  } else if (emote.id === 'key_found') {
    // Pixel Golden Key
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(iconCx - 2, iconCy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(iconCx + 1, iconCy - 1, 6, 2);
    ctx.fillRect(iconCx + 4, iconCy + 1, 2, 2);
  } else if (emote.id === 'thumbs_up') {
    // Emerald Pixel Star / Check Trophy
    ctx.fillStyle = '#10B981';
    ctx.fillRect(iconCx - 5, iconCy - 5, 10, 10);
    ctx.fillStyle = '#ECFDF5';
    ctx.beginPath();
    ctx.moveTo(iconCx - 3, iconCy);
    ctx.lineTo(iconCx - 1, iconCy + 2.5);
    ctx.lineTo(iconCx + 3.5, iconCy - 2.5);
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else {
    // SOS Beacon
    ctx.fillStyle = frameIndex % 2 === 0 ? '#EF4444' : '#FCA5A5';
    ctx.fillRect(iconCx - 5, iconCy - 5, 10, 10);
    ctx.fillStyle = '#090D15';
    ctx.fillRect(iconCx - 1, iconCy - 3.5, 2, 4.5);
    ctx.fillRect(iconCx - 1, iconCy + 2, 2, 2);
  }

  // Short pixel label on right side of balloon
  ctx.font = 'bold 4.8px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = emote.accentColor;
  ctx.fillText(emote.shortTag, -4, -9);

  ctx.restore();
}

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  QrCode,
  RotateCcw,
  Smartphone,
  X,
} from 'lucide-react';
import {
  buildRoomJoinUrl,
  formatDisplayJoinHost,
  getSavedCustomQrBaseUrl,
  QR_BASE_URL_CHANGED_EVENT,
  resolveEffectiveQrBaseUrl,
  sanitizePublicBaseUrl,
  saveCustomQrBaseUrl,
} from '../shared/roomJoinLink';

export interface RoomJoinQrCodeProps {
  roomCode: string;
  sizePx?: number;
  className?: string;
  testId?: string;
}

/**
 * Custom hook that stays synchronized across Lobby tile, Modal, and Projector view
 * whenever the teacher updates or resets the optional custom public/deploy base URL.
 */
export function useEffectiveRoomJoinUrl(roomCode: string) {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => getSavedCustomQrBaseUrl());

  useEffect(() => {
    const sync = () => setCustomBaseUrl(getSavedCustomQrBaseUrl());
    window.addEventListener(QR_BASE_URL_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(QR_BASE_URL_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const resolved = useMemo(
    () => resolveEffectiveQrBaseUrl(currentOrigin, customBaseUrl),
    [currentOrigin, customBaseUrl]
  );
  const joinUrl = useMemo(
    () => buildRoomJoinUrl(resolved.baseUrl, roomCode),
    [resolved.baseUrl, roomCode]
  );

  return {
    joinUrl,
    customBaseUrl,
    resolved,
  };
}

/**
 * Encodes text into a crisp, integer-scaled ISO/IEC 18004 QR PNG data URL using
 * `QRCode.create` + native HTMLCanvasElement (works reliably in Vite browser builds
 * with zero Node stream/pngjs dependency and zero async flicker).
 */
function renderQrMatrixToPngDataUrl(text: string, targetPx: number): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const quietZone = 2; // ISO quiet zone modules on each side
    const totalModules = moduleCount + quietZone * 2;
    const minCanvasPx = Math.max(220, targetPx * 2);
    const scale = Math.max(4, Math.ceil(minCanvasPx / totalModules));
    const canvasSize = totalModules * scale;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Pure white quiet zone background for maximum mobile camera contrast
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Crisp dark ink modules
    ctx.fillStyle = '#090D15';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.modules.get(row, col)) {
          ctx.fillRect(
            (col + quietZone) * scale,
            (row + quietZone) * scale,
            scale,
            scale
          );
        }
      }
    }

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Renders a crisp, ISO/IEC 18004 scannable QR Code with high-contrast pure white quiet zone
 * encoding the room's direct public student join URL (`/?room=MATH-XXXX`).
 */
export const RoomJoinQrCode: React.FC<RoomJoinQrCodeProps> = ({
  roomCode,
  sizePx = 88,
  className = '',
  testId = 'room-join-qr-img',
}) => {
  const { joinUrl, resolved } = useEffectiveRoomJoinUrl(roomCode);

  const dataUrl = useMemo(
    () => renderQrMatrixToPngDataUrl(joinUrl, sizePx),
    [joinUrl, sizePx]
  );

  if (!dataUrl) {
    return (
      <div
        style={{ width: sizePx, height: sizePx }}
        className={`rounded-md bg-white text-slate-900 flex flex-col items-center justify-center text-[10px] font-semibold p-2 text-center ${className}`}
      >
        <QrCode className="w-5 h-5 text-slate-600 mb-1" aria-hidden="true" />
        <span>{roomCode}</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR Code untuk bergabung ke room ${roomCode}`}
      width={sizePx}
      height={sizePx}
      data-testid={testId}
      data-join-url={joinUrl}
      data-url-source={resolved.source}
      style={{ width: sizePx, height: sizePx, imageRendering: 'pixelated' }}
      className={`block rounded-md bg-white shrink-0 select-none ${className}`}
    />
  );
};

interface RoomJoinQrModalProps {
  open: boolean;
  roomCode: string;
  teacherName: string;
  sharedTransferUrl?: string;
  onClose: () => void;
}

export const RoomJoinQrModal: React.FC<RoomJoinQrModalProps> = ({
  open,
  roomCode,
  teacherName,
  sharedTransferUrl,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [urlDraft, setUrlDraft] = useState(() => getSavedCustomQrBaseUrl());
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlSavedNotice, setUrlSavedNotice] = useState(false);

  const { joinUrl, customBaseUrl, resolved } = useEffectiveRoomJoinUrl(roomCode);
  const displayJoin = formatDisplayJoinHost(joinUrl);

  useEffect(() => {
    if (open) {
      setUrlDraft(customBaseUrl);
      setUrlError(null);
    }
  }, [open, customBaseUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(joinUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleSaveCustomUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      saveCustomQrBaseUrl(null);
      setUrlError(null);
      setUrlSavedNotice(true);
      setTimeout(() => setUrlSavedNotice(false), 1600);
      return;
    }
    const sanitized = sanitizePublicBaseUrl(trimmed);
    if (!sanitized) {
      setUrlError('Masukkan URL valid (mis. https://nama-app.run.app)');
      return;
    }
    saveCustomQrBaseUrl(sanitized);
    setUrlDraft(sanitized);
    setUrlError(null);
    setUrlSavedNotice(true);
    setTimeout(() => setUrlSavedNotice(false), 1600);
  };

  const handleResetCustomUrl = () => {
    saveCustomQrBaseUrl(null);
    setUrlDraft('');
    setUrlError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      data-testid="qr-join-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="rpg-panel w-full max-w-md p-5 sm:p-6 space-y-4 text-center shadow-[0_24px_64px_rgba(0,0,0,0.75)] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 text-left">
          <div>
            <div className="text-xs font-medium text-amber-300">
              Scan Kamera HP / Tablet · Guru: {teacherName}
            </div>
            <h2 id="qr-modal-title" className="text-xl font-bold text-white mt-0.5">
              QR Code Gabung Room
            </h2>
          </div>
          <button
            type="button"
            data-testid="qr-modal-close-btn"
            aria-label="Tutup QR Code"
            onClick={onClose}
            className="w-9 h-9 rounded-md bg-[#1e293b] hover:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* High-Contrast Scannable QR Frame */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="p-3.5 rounded-xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] border-2 border-amber-400/90">
            <RoomJoinQrCode
              roomCode={roomCode}
              sizePx={232}
              testId="room-join-qr-modal-img"
            />
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-slate-400">Kode Room Otomatis Terisi</div>
            <div
              data-testid="qr-modal-room-code"
              className="font-code text-3xl sm:text-4xl font-bold tracking-[0.14em] text-amber-400"
            >
              {roomCode}
            </div>
          </div>
        </div>

        {/* Dev Preview Warning & 1-Click Shared App Transfer */}
        {resolved.isDevPreview && (
          <div
            data-testid="qr-dev-preview-notice"
            className="rounded-md bg-amber-950/85 border border-amber-400/75 p-3 text-left space-y-2"
          >
            <div className="flex items-start gap-2 text-xs text-amber-100 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-amber-300">Mode Preview Editor (`ais-dev`)</strong> akan
                diarahkan ke 404 jika dibuka langsung dari HP. Klik <strong>Share</strong> /{' '}
                <strong>Deploy</strong> di kanan atas dulu jika ada update baru agar{' '}
                <strong>Shared App URL</strong> memakai versi terbaru, lalu buka room di sana.
              </div>
            </div>
            {sharedTransferUrl && (
              <a
                href={sharedTransferUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="qr-modal-open-shared-link"
                className="rpg-btn-gold w-full min-h-[38px] px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <span>Buka Room {roomCode} di Shared App URL</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>
        )}

        <div className="rounded-md bg-[#0b101b] border border-slate-800 px-3.5 py-2.5 text-left space-y-2">
          <div className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-xs text-slate-300 leading-relaxed">
              Arahkan kamera HP atau tablet siswa ke QR Code di atas untuk langsung membuka room tanpa mengetik kode.
              <div
                data-testid="qr-modal-display-url"
                className="font-code text-[11px] text-slate-400 mt-1 truncate"
                title={joinUrl}
              >
                {displayJoin}
              </div>
            </div>
          </div>

          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {resolved.source === 'custom'
                ? 'Menggunakan URL Publik Kustom'
                : resolved.source === 'shared-converted'
                  ? 'Otomatis diarahkan ke Shared App URL'
                  : 'Menggunakan URL aktif saat ini'}
            </span>
            <button
              type="button"
              data-testid="qr-custom-url-toggle"
              onClick={() => setShowUrlConfig((v) => !v)}
              className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 flex items-center gap-1 whitespace-nowrap"
            >
              <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{showUrlConfig ? 'Tutup Pengaturan URL' : 'Atur URL Deploy'}</span>
            </button>
          </div>

          {showUrlConfig && (
            <div className="pt-2 space-y-2 border-t border-slate-800/80">
              <label className="block text-[11px] text-slate-300">
                URL Publik / Hasil Deploy (opsional, agar semua HP siswa bisa scan tanpa login)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  data-testid="qr-custom-url-input"
                  value={urlDraft}
                  onChange={(e) => {
                    setUrlDraft(e.target.value);
                    setUrlError(null);
                  }}
                  placeholder="https://math-maze-anda.a.run.app"
                  className="flex-1 min-w-0 min-h-[36px] rounded bg-[#131b2b] border border-slate-600 focus:border-sky-400 px-2.5 py-1 text-xs font-code text-white outline-none"
                />
                <button
                  type="button"
                  data-testid="qr-custom-url-save-btn"
                  onClick={handleSaveCustomUrl}
                  className="min-h-[36px] px-3 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors"
                >
                  Simpan
                </button>
                {customBaseUrl && (
                  <button
                    type="button"
                    data-testid="qr-custom-url-reset-btn"
                    title="Reset ke URL otomatis"
                    aria-label="Reset ke URL otomatis"
                    onClick={handleResetCustomUrl}
                    className="min-h-[36px] px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              {urlError && <div className="text-[11px] text-red-300">{urlError}</div>}
              {urlSavedNotice && (
                <div className="text-[11px] text-emerald-400">
                  QR Code diperbarui dengan URL baru.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopyCode}
            className="rpg-btn-slate min-h-[42px] px-3 py-2 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{copiedCode ? 'Kode Disalin' : 'Salin Kode'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[42px] px-3 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{copiedLink ? 'Link Disalin' : 'Salin Link Room'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

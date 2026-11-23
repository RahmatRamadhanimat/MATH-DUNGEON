import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Link2, QrCode, Smartphone, X } from 'lucide-react';
import { buildRoomJoinUrl, formatDisplayJoinHost } from '../shared/roomJoinLink';

export interface RoomJoinQrCodeProps {
  roomCode: string;
  sizePx?: number;
  className?: string;
  testId?: string;
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
 * encoding the room's direct student join URL (`/?room=MATH-XXXX`).
 */
export const RoomJoinQrCode: React.FC<RoomJoinQrCodeProps> = ({
  roomCode,
  sizePx = 88,
  className = '',
  testId = 'room-join-qr-img',
}) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = buildRoomJoinUrl(origin, roomCode);

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
      style={{ width: sizePx, height: sizePx, imageRendering: 'pixelated' }}
      className={`block rounded-md bg-white shrink-0 select-none ${className}`}
    />
  );
};

interface RoomJoinQrModalProps {
  open: boolean;
  roomCode: string;
  teacherName: string;
  onClose: () => void;
}

export const RoomJoinQrModal: React.FC<RoomJoinQrModalProps> = ({
  open,
  roomCode,
  teacherName,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = buildRoomJoinUrl(origin, roomCode);
  const displayJoin = formatDisplayJoinHost(joinUrl);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      data-testid="qr-join-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rpg-panel w-full max-w-md p-6 space-y-5 text-center shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
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
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] border-2 border-amber-400/90">
            <RoomJoinQrCode
              roomCode={roomCode}
              sizePx={248}
              testId="room-join-qr-modal-img"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-400">Kode Room Otomatis Terisi</div>
            <div
              data-testid="qr-modal-room-code"
              className="font-code text-3xl sm:text-4xl font-bold tracking-[0.14em] text-amber-400"
            >
              {roomCode}
            </div>
          </div>
        </div>

        <div className="rounded-md bg-[#0b101b] border border-slate-800 px-3.5 py-2.5 text-left flex items-start gap-2.5">
          <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 text-xs text-slate-300 leading-relaxed">
            Arahkan kamera HP atau tablet siswa ke QR Code di atas untuk langsung membuka room tanpa mengetik kode.
            <div
              className="font-code text-[11px] text-slate-400 mt-1 truncate"
              title={joinUrl}
            >
              {displayJoin}
            </div>
          </div>
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

import React from 'react';
import {
  Compass,
  DoorOpen,
  KeyRound,
  Maximize2,
  Minimize2,
  Navigation,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MinimapViewMode, ObjectiveCompassInfo } from '../shared/minimapSystem';
import { retroAudio } from '../game/audio/RetroAudio';

export interface MiniMapOverlayProps {
  visible: boolean;
  isLobbyMaze: boolean;
  mazeWidth: number;
  mazeHeight: number;
  viewMode: MinimapViewMode;
  expandedSize: boolean;
  discoveryPercent: number;
  discoveredRoomsCount: number;
  totalRoomsCount: number;
  playerTile: { x: number; y: number };
  objectiveCompass: ObjectiveCompassInfo | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onChangeViewMode: (mode: MinimapViewMode) => void;
  onToggleExpandedSize: () => void;
  onClose: () => void;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const MiniMapOverlay: React.FC<MiniMapOverlayProps> = ({
  visible,
  isLobbyMaze,
  mazeWidth,
  mazeHeight,
  viewMode,
  expandedSize,
  discoveryPercent,
  discoveredRoomsCount,
  totalRoomsCount,
  playerTile,
  objectiveCompass,
  canvasRef,
  onChangeViewMode,
  onToggleExpandedSize,
  onClose,
  onCanvasClick,
}) => {
  if (!visible) return null;

  const isLargeMap = mazeWidth >= 55 || mazeHeight >= 55;

  return (
    <aside
      aria-label={isLobbyMaze ? 'Mini-Map Lobby Pemenang' : 'Mini-Map Navigasi Labirin'}
      data-testid="minimap-overlay"
      data-view-mode={viewMode}
      data-map-size={`${mazeWidth}x${mazeHeight}`}
      data-expanded-size={expandedSize ? 'true' : 'false'}
      className={`fixed top-[92px] right-2 sm:top-[56px] sm:right-3 z-20 pointer-events-auto rounded-lg bg-[#090D15]/86 hover:bg-[#090D15]/95 border border-sky-400/45 shadow-[0_10px_28px_rgba(0,0,0,0.62)] p-2 transition-[width,background-color] duration-150 ${
        expandedSize ? 'w-[216px] sm:w-[264px]' : 'w-[164px] sm:w-[204px]'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-bold tracking-wide text-sky-200 truncate">
            {isLobbyMaze ? 'Peta Lobby' : 'Peta Labirin'}
          </span>
          <span
            data-testid="minimap-size-badge"
            className="font-code text-[9px] px-1 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300 tabular-nums shrink-0"
          >
            {mazeWidth}×{mazeHeight}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            data-testid="minimap-size-toggle-btn"
            aria-label={expandedSize ? 'Perkecil Ukuran Peta' : 'Perbesar Ukuran Peta'}
            title={expandedSize ? 'Perkecil Ukuran Peta' : 'Perbesar Ukuran Peta'}
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playButtonClick();
              onToggleExpandedSize();
            }}
            className="w-6 h-6 rounded bg-[#1e293b]/90 hover:bg-[#283548] border border-slate-600/80 text-slate-200 flex items-center justify-center transition-colors"
          >
            {expandedSize ? (
              <Minimize2 className="w-3 h-3" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-3 h-3" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="minimap-close-btn"
            aria-label="Sembunyikan Peta"
            title="Sembunyikan Peta [N]"
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playButtonClick();
              onClose();
            }}
            className="w-6 h-6 rounded bg-[#1e293b]/90 hover:bg-red-950/90 border border-slate-600/80 hover:border-red-400/70 text-slate-300 hover:text-red-200 flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mode Switcher (Full Overview vs Zoomed Radar for Large Maps) & Discovery Stats */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <div
          role="group"
          aria-label="Mode Tampilan Mini-Map"
          className="flex items-center rounded bg-[#0b101b] border border-slate-700/80 p-0.5"
        >
          <button
            type="button"
            tabIndex={-1}
            data-testid="minimap-mode-full-btn"
            aria-pressed={viewMode === 'full'}
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playButtonClick();
              onChangeViewMode('full');
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              viewMode === 'full'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ZoomOut className="w-2.5 h-2.5" aria-hidden="true" />
            <span>Penuh</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            data-testid="minimap-mode-radar-btn"
            aria-pressed={viewMode === 'radar'}
            disabled={isLobbyMaze}
            onClick={(e) => {
              e.currentTarget.blur();
              retroAudio.playButtonClick();
              onChangeViewMode('radar');
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40 ${
              viewMode === 'radar'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ZoomIn className="w-2.5 h-2.5" aria-hidden="true" />
            <span>Radar</span>
          </button>
        </div>

        <span
          data-testid="minimap-discovery-badge"
          className="font-code text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-400/35 text-sky-300 tabular-nums"
          title="Ruangan Rahasia ditemukan & persentase area dijelajahi"
        >
          R {discoveredRoomsCount}/{totalRoomsCount} · {discoveryPercent}%
        </span>
      </div>

      {/* High-Resolution Interactive Mini-Map Canvas */}
      <div className="relative mt-1.5">
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          data-testid="minimap-canvas"
          title="Klik titik mana saja pada peta untuk mengarahkan Free-Cam"
          onClick={onCanvasClick}
          className="block w-full aspect-square rounded border border-sky-400/30 bg-transparent cursor-crosshair"
        />

        {/* Subtle Coordinate Chip in Bottom-Right of Canvas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 right-1 font-code text-[9px] px-1 py-0.2 rounded bg-[#090D15]/85 border border-slate-700/80 text-slate-300 tabular-nums"
        >
          ({playerTile.x},{playerTile.y})
        </div>
      </div>

      {/* Objective Compass Helper (Especially helpful on Large Maps 55x55 - 75x75) */}
      {!isLobbyMaze && objectiveCompass && (
        <div
          data-testid="minimap-objective-compass"
          className={`mt-1.5 rounded px-2 py-1 border flex items-center justify-between gap-2 text-[10px] ${
            objectiveCompass.kind === 'exit'
              ? 'bg-emerald-950/70 border-emerald-400/45 text-emerald-200'
              : 'bg-amber-950/60 border-amber-400/45 text-amber-200'
          }`}
        >
          <span className="flex items-center gap-1 font-semibold truncate">
            {objectiveCompass.kind === 'exit' ? (
              <DoorOpen className="w-3 h-3 text-emerald-300 shrink-0" aria-hidden="true" />
            ) : (
              <KeyRound className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{objectiveCompass.label}</span>
          </span>
          <span className="font-code font-bold flex items-center gap-1 shrink-0 tabular-nums">
            <Navigation className="w-2.5 h-2.5" aria-hidden="true" />
            <span>
              {objectiveCompass.directionLabel} · {objectiveCompass.distanceTiles}u
            </span>
          </span>
        </div>
      )}

      {/* Compact Legend */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] font-medium text-slate-200/90">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-xs bg-sky-400 border border-white/80"
            aria-hidden="true"
          />
          Anda
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-xs bg-purple-400" aria-hidden="true" />
          {isLobbyMaze ? 'Paviliun' : 'Ruang'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-xs bg-amber-400" aria-hidden="true" />
          {isLobbyMaze ? 'Podium' : 'Kunci'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-xs bg-emerald-400" aria-hidden="true" />
          {isLobbyMaze ? 'Lounge' : 'Exit'}
        </span>
      </div>

      {isLargeMap && viewMode === 'full' && !isLobbyMaze && (
        <div className="mt-1 text-[9px] leading-snug text-sky-300/90 text-center">
          Tip Peta Besar: Gunakan mode <strong className="text-amber-300">Radar</strong> untuk zoom sekitar pemain
        </div>
      )}
    </aside>
  );
};

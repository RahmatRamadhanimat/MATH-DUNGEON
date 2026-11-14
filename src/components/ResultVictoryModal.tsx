import React from 'react';
import { Award, Download, Home, RotateCcw, Trophy } from 'lucide-react';
import { GameMode, TEAM_DEFINITIONS } from '../shared/constants';
import { LeaderboardEntry, TeamLeaderboardEntry } from '../shared/scoreSystem';
import { getCharacterAvatarDataUrl } from '../game/assets/PixelArtSprites';
import { retroAudio } from '../game/audio/RetroAudio';

interface ResultVictoryModalProps {
  roomCode: string;
  mode: GameMode;
  reason: string;
  localPlayerId: string;
  localRole: 'teacher' | 'student';
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

export const ResultVictoryModal: React.FC<ResultVictoryModalProps> = ({
  roomCode,
  mode,
  reason,
  localPlayerId,
  localRole,
  leaderboard,
  teamLeaderboard,
  onPlayAgain,
  onReturnToMenu,
}) => {
  const myEntry = leaderboard.find((e) => e.playerId === localPlayerId) ?? leaderboard[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-screen-heading"
      className="fixed inset-0 z-50 bg-[#090D15]/95 overflow-y-auto rpg-scroll p-3.5 sm:p-8 flex items-start justify-center"
    >
      <div className="rpg-modal w-full max-w-5xl p-4 sm:p-7 text-slate-100 space-y-5 sm:space-y-6 my-auto">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4 sm:pb-5">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Room <span className="font-code">{roomCode}</span> · Hasil Akhir Sesi
              </span>
            </div>
            <h1
              id="victory-screen-heading"
              className="font-display text-base sm:text-xl text-white leading-snug tracking-tight"
            >
              MISI LABIRIN SELESAI
            </h1>
            <p className="text-xs sm:text-sm font-medium text-emerald-300">{reason}</p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
            <a
              href={`/api/export/${roomCode}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-[42px] rounded-md flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-400/80 font-semibold text-xs whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Ekspor CSV</span>
            </a>
            <button
              type="button"
              data-testid="return-to-menu-btn"
              onClick={() => {
                retroAudio.playButtonClick();
                onReturnToMenu();
              }}
              className="rpg-btn-slate min-h-[42px] px-3.5 py-2 text-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
              <span>Kembali ke Menu Utama</span>
            </button>
            <button
              type="button"
              data-start="true"
              data-testid="play-again-btn"
              onClick={() => {
                retroAudio.playButtonClick();
                onPlayAgain();
              }}
              className="rpg-btn-gold col-span-2 sm:col-span-1 min-h-[44px] px-5 py-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Main Lagi (Labirin Baru)</span>
            </button>
          </div>
        </div>

        {/* Personal Mastery Metrics Summary */}
        {myEntry && (
          <div className="rpg-well grid grid-cols-2 sm:grid-cols-5 gap-3 p-4">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Peringkat</div>
              <div className="font-code text-xl sm:text-2xl font-bold text-amber-400 tabular-nums mt-0.5">
                #{myEntry.rank}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Total Skor</div>
              <div className="font-code text-xl sm:text-2xl font-bold text-white tabular-nums mt-0.5">
                {myEntry.score}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Kunci Terkumpul</div>
              <div className="font-code text-xl sm:text-2xl font-bold text-sky-400 tabular-nums mt-0.5">
                {myEntry.keysCollected}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Jawaban Benar</div>
              <div className="font-code text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">
                {myEntry.correctAnswers}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 border-t border-slate-800 pt-2 sm:border-t-0 sm:pt-0">
              <div className="text-[11px] font-medium text-slate-400">Akurasi Matematika</div>
              <div className="font-code text-xl sm:text-2xl font-bold text-amber-300 tabular-nums mt-0.5">
                {myEntry.accuracy}%
              </div>
            </div>
          </div>
        )}

        {/* Team Battle Results Table */}
        {mode === 'team' && teamLeaderboard.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Peringkat Tim</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {teamLeaderboard.map((team) => (
                <div key={team.teamId} className="rpg-well p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: team.color }}>
                      #{team.rank} {team.teamName}
                    </span>
                    <span className="font-code text-xs text-slate-400 tabular-nums">
                      {team.memberCount} Siswa
                    </span>
                  </div>
                  <div className="font-code text-lg font-bold text-white tabular-nums">
                    {team.totalScore} Poin
                  </div>
                  <div className="font-code text-xs text-amber-300 tabular-nums mt-0.5">
                    Kunci: {team.keysCollected}/{team.targetKeys} ({team.progressPercent}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Classroom Individual Leaderboard Table */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-sky-300">
              Tabel Hasil Siswa (<span className="font-code">{leaderboard.length}</span> Pemain)
            </h2>
            {localRole === 'teacher' && (
              <span className="text-xs text-slate-400">
                Data otomatis tersimpan ke Riwayat Kelas
              </span>
            )}
          </div>

          <div className="rpg-well overflow-x-auto rpg-scroll">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#131b2b] border-b border-slate-700/80 text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Rank</th>
                  <th className="py-2.5 px-3 font-semibold">Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Tim</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Skor</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Kunci</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Benar</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Salah</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Akurasi</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {leaderboard.map((row) => (
                  <tr
                    key={row.playerId}
                    className={row.playerId === localPlayerId ? 'bg-sky-950/35' : 'hover:bg-slate-900/40'}
                  >
                    <td className="py-2.5 px-3 font-code font-bold text-amber-400 tabular-nums">
                      #{row.rank}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={getCharacterAvatarDataUrl(row.characterId, row.outfitColor)}
                          alt={row.name}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded"
                        />
                        <span className="font-semibold text-white">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {row.teamId ? (
                        <span className="font-semibold" style={{ color: TEAM_DEFINITIONS[row.teamId].color }}>
                          {TEAM_DEFINITIONS[row.teamId].name}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code font-bold text-white tabular-nums">
                      {row.score}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code text-amber-300 tabular-nums">
                      {row.keysCollected}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code text-emerald-400 tabular-nums">
                      {row.correctAnswers}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code text-red-400 tabular-nums">
                      {row.wrongAnswers}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code tabular-nums">{row.accuracy}%</td>
                    <td className="py-2.5 px-3 text-right font-code text-slate-400 tabular-nums">
                      {row.completionTimeSeconds ? `${row.completionTimeSeconds}d` : 'Aktif'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-700/80">
          <button
            type="button"
            data-testid="return-to-menu-footer-btn"
            onClick={() => {
              retroAudio.playButtonClick();
              onReturnToMenu();
            }}
            className="rpg-btn-slate min-h-[44px] px-4 py-2.5 text-slate-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            <span>Kembali ke Menu Utama</span>
          </button>
          <button
            type="button"
            onClick={() => {
              retroAudio.playButtonClick();
              onPlayAgain();
            }}
            className="rpg-btn-gold min-h-[44px] px-5 py-2.5 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Main Lagi (Labirin Baru)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

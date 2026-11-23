import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Compass,
  Download,
  Home,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Zap,
} from 'lucide-react';
import { GameMode, TEAM_DEFINITIONS } from '../shared/constants';
import {
  LeaderboardEntry,
  MvpBadgeId,
  TeamLeaderboardEntry,
  computeMvpHighlights,
} from '../shared/scoreSystem';
import { StudentAnalyticsPanel } from './StudentAnalyticsPanel';
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
  onExploreVictoryLobby?: () => void;
}

function renderMvpBadgeIcon(id: MvpBadgeId, className = 'w-3.5 h-3.5 shrink-0') {
  if (id === 'fastest_math') {
    return <Zap className={className} aria-hidden="true" />;
  }
  if (id === 'true_explorer') {
    return <Compass className={className} aria-hidden="true" />;
  }
  if (id === 'perfect_accuracy') {
    return <ShieldCheck className={className} aria-hidden="true" />;
  }
  return <Award className={className} aria-hidden="true" />;
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
  onExploreVictoryLobby,
}) => {
  const [activeTab, setActiveTab] = useState<'results' | 'analytics'>('results');
  const myEntry = leaderboard.find((e) => e.playerId === localPlayerId) ?? leaderboard[0];
  const mvpHighlights = computeMvpHighlights(leaderboard);

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
            {onExploreVictoryLobby && (
              <button
                type="button"
                data-testid="explore-victory-lobby-btn"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onExploreVictoryLobby();
                }}
                className="rpg-btn-emerald col-span-2 sm:col-span-1 min-h-[42px] px-4 py-2 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Keliling di Lobby Pemenang</span>
              </button>
            )}
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

        {/* Navigation Tabs: Podium & Score Table vs Student Analytics */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            data-testid="victory-results-tab"
            onClick={() => {
              retroAudio.playButtonClick();
              setActiveTab('results');
            }}
            className={`min-h-[38px] px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'results'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#0b101b] text-slate-300 hover:text-white border border-slate-700/80'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Podium &amp; Tabel Skor</span>
          </button>

          <button
            type="button"
            data-testid="victory-analytics-tab"
            onClick={() => {
              retroAudio.playButtonClick();
              setActiveTab('analytics');
            }}
            className={`min-h-[38px] px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'analytics'
                ? 'bg-sky-400 text-slate-950'
                : 'bg-[#0b101b] text-sky-200 hover:text-white border border-sky-500/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Student Analytics</span>
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <StudentAnalyticsPanel roomCode={roomCode} liveLeaderboard={leaderboard} />
        ) : (
        <>

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

        {/* PODIUM GELAR & LENCANA AKHIR SESI (MVP BADGES SHOWCASE) */}
        {mvpHighlights.length > 0 && (
          <div data-testid="mvp-podium-showcase" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Podium Gelar &amp; Lencana Akhir Sesi (MVP Badges)</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Diberikan otomatis berdasarkan statistik kecepatan, eksplorasi &amp; ketepatan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mvpHighlights.map((card) => (
                <div
                  key={card.badge.id}
                  data-testid={`mvp-card-${card.badge.id}`}
                  className="rpg-well p-3.5 flex flex-col justify-between gap-2.5 border"
                  style={{
                    borderColor: `${card.badge.color}66`,
                    backgroundColor: '#0c1322',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center border shrink-0"
                        style={{
                          color: card.badge.color,
                          backgroundColor: card.badge.bgColor,
                          borderColor: `${card.badge.color}77`,
                        }}
                      >
                        {renderMvpBadgeIcon(card.badge.id, 'w-4 h-4')}
                      </span>
                      <div className="min-w-0">
                        <div
                          className="text-xs font-bold leading-tight truncate"
                          style={{ color: card.badge.color }}
                        >
                          {card.badge.title}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          {card.badge.description}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/90">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getCharacterAvatarDataUrl(
                          card.winner.characterId,
                          card.winner.outfitColor
                        )}
                        alt={card.winner.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {card.winner.name}
                        </div>
                        <div className="text-[10px] font-medium text-emerald-300">
                          Penerima Gelar
                        </div>
                      </div>
                    </div>
                    <span
                      className="font-code text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 tabular-nums"
                      style={{
                        color: card.badge.color,
                        backgroundColor: card.badge.bgColor,
                        borderColor: `${card.badge.color}66`,
                      }}
                    >
                      {card.badge.metricText}
                    </span>
                  </div>
                </div>
              ))}
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
                  <th className="py-2.5 px-3 font-semibold">Gelar &amp; Lencana MVP</th>
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
                    <td className="py-2.5 px-3" data-testid="score-table-mvp-badges">
                      {row.mvpBadges && row.mvpBadges.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {row.mvpBadges.map((badge) => (
                            <span
                              key={badge.id}
                              data-testid={`table-badge-${badge.id}`}
                              title={`${badge.title} (${badge.metricText})`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap"
                              style={{
                                color: badge.color,
                                backgroundColor: badge.bgColor,
                                borderColor: `${badge.color}66`,
                              }}
                            >
                              {renderMvpBadgeIcon(badge.id, 'w-3 h-3 shrink-0')}
                              <span>{badge.title}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Petualang Labirin</span>
                      )}
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
        </>
        )}

        {/* Footer Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-700/80">
          {onExploreVictoryLobby && (
            <button
              type="button"
              data-testid="explore-victory-lobby-footer-btn"
              onClick={() => {
                retroAudio.playButtonClick();
                onExploreVictoryLobby();
              }}
              className="rpg-btn-emerald min-h-[44px] px-4 py-2.5 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Keliling di Lobby Pemenang</span>
            </button>
          )}
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

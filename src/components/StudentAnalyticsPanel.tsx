import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LeaderboardEntry } from '../shared/scoreSystem';
import {
  RawCategoryStatInput,
  StudentAnalyticsReport,
  buildStudentAnalyticsReport,
} from '../shared/studentAnalytics';

interface ApiAnalyticsResponse {
  databaseEngine?: string;
  categoryStats?: RawCategoryStatInput[];
  topStudents?: {
    id: string;
    name: string;
    gamesPlayed: number;
    totalScore: number;
    totalKeys: number;
    totalCorrect?: number;
    totalWrong?: number;
  }[];
}

interface StudentAnalyticsPanelProps {
  roomCode?: string;
  liveLeaderboard?: LeaderboardEntry[];
}

export const StudentAnalyticsPanel: React.FC<StudentAnalyticsPanelProps> = ({
  roomCode,
  liveLeaderboard,
}) => {
  const [apiData, setApiData] = useState<ApiAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [responseViewMode, setResponseViewMode] = useState<'topic' | 'student'>('topic');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/analytics');
      if (resp.ok) {
        const json = (await resp.json()) as ApiAnalyticsResponse;
        setApiData(json);
      }
    } catch {
      // Fallback handled by buildStudentAnalyticsReport
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const report: StudentAnalyticsReport = buildStudentAnalyticsReport({
    categoryStats: apiData?.categoryStats,
    liveLeaderboard,
    historicalTopStudents: apiData?.topStudents,
  });

  const { summary, topicAnalytics, studentResponses } = report;

  const responseChartDataByTopic = [...topicAnalytics].sort(
    (a, b) => b.avgResponseSeconds - a.avgResponseSeconds
  );

  return (
    <div
      data-testid="student-analytics-panel"
      className="space-y-4 sm:space-y-5 text-slate-100"
    >
      {/* Header & Refresh Action */}
      <div className="rpg-panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-300">
            <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Student Analytics · Diagnostik Kesenjangan Belajar (Learning Gaps)</span>
            {roomCode && (
              <>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-code text-sky-300">Room {roomCode}</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Visualisasi waktu respons rata-rata siswa dan topik matematika yang paling sering
            dijawab salah untuk membantu guru mengidentifikasi materi yang membutuhkan penguatan.
          </p>
        </div>

        <button
          type="button"
          data-testid="refresh-analytics-btn"
          onClick={fetchAnalytics}
          disabled={loading}
          className="rpg-btn-slate min-h-[38px] px-3.5 py-2 text-xs font-semibold text-sky-200 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-sky-400 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{loading ? 'Memperbarui...' : 'Segarkan Analitik'}</span>
        </button>
      </div>

      {/* 4 Diagnostic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Average Response Time */}
        <div className="rpg-panel p-3.5 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Waktu Respons Rata-rata</span>
            <Clock className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            data-testid="kpi-avg-response-time"
            className="font-code text-xl sm:text-2xl font-bold text-sky-300 tabular-nums"
          >
            {summary.classAvgResponseSeconds} dtk
          </div>
          <div className="text-[11px] text-slate-400">
            Kecepatan rata-rata menjawab soal kunci
          </div>
        </div>

        {/* Card 2: Highest Learning Gap Topic */}
        <div className="rpg-panel p-3.5 sm:p-4 space-y-1 border-red-500/40">
          <div className="flex items-center justify-between text-xs text-red-300 font-medium">
            <span>Kesenjangan Tertinggi (Top Gap)</span>
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            data-testid="kpi-top-error-topic"
            className="text-sm sm:text-base font-bold text-white truncate"
          >
            {summary.mostChallengingTopic?.topicName ?? 'Belum Ada Data'}
          </div>
          <div className="font-code text-xs font-semibold text-red-300 tabular-nums">
            {summary.mostChallengingTopic
              ? `${summary.mostChallengingTopic.errorRatePercent}% Salah (${summary.mostChallengingTopic.wrong}/${summary.mostChallengingTopic.attempts} soal)`
              : '0% Kesalahan'}
          </div>
        </div>

        {/* Card 3: Slowest Response Topic */}
        <div className="rpg-panel p-3.5 sm:p-4 space-y-1 border-amber-500/40">
          <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
            <span>Topik Waktu Terlama</span>
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            data-testid="kpi-slowest-topic"
            className="text-sm sm:text-base font-bold text-white truncate"
          >
            {summary.slowestTopic?.topicName ?? 'Belum Ada Data'}
          </div>
          <div className="font-code text-xs font-semibold text-amber-300 tabular-nums">
            {summary.slowestTopic
              ? `Rata-rata ${summary.slowestTopic.avgResponseSeconds} detik / soal`
              : '0 dtk'}
          </div>
        </div>

        {/* Card 4: Overall Class Accuracy & Attempts */}
        <div className="rpg-panel p-3.5 sm:p-4 space-y-1 border-emerald-500/40">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-medium">
            <span>Akurasi Kelas &amp; Sampel</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            data-testid="kpi-class-accuracy"
            className="font-code text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums"
          >
            {summary.classAccuracyPercent}%
          </div>
          <div className="text-[11px] text-slate-400">
            Dari <span className="font-code text-slate-200">{summary.totalAttemptsAnalyzed}</span>{' '}
            percobaan (<span className="font-code text-red-300">{summary.totalErrorsAnalyzed}</span>{' '}
            salah)
          </div>
        </div>
      </div>

      {/* Two-Column Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* CHART 1: Common Math Topic Errors & Error Rate % */}
        <section
          data-testid="topic-errors-chart"
          className="lg:col-span-6 rpg-panel p-4 sm:p-5 space-y-3"
        >
          <div className="border-b border-slate-700/70 pb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                <span>Distribusi Kesalahan Topik Matematika (Topic Errors)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Perbandingan Jawaban Salah vs Benar beserta Tingkat Kesalahan (%) per materi
              </p>
            </div>
            <span className="font-code text-[11px] px-2 py-0.5 rounded bg-red-950/90 border border-red-500/60 text-red-200">
              {summary.needsInterventionCount} Topik Perlu Penguatan
            </span>
          </div>

          <div className="w-full h-64 min-h-[250px] pt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={220}>
              <ComposedChart
                data={topicAnalytics}
                margin={{ top: 10, right: 12, left: -12, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="shortName"
                  stroke="#94A3B8"
                  tick={{ fill: '#CBD5E1', fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={46}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  stroke="#FACC15"
                  tick={{ fill: '#FACC15', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090D15',
                    borderColor: '#475569',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="wrong"
                  name="Jawaban Salah"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="correct"
                  name="Jawaban Benar"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errorRatePercent"
                  name="Rasio Kesalahan (%)"
                  stroke="#FACC15"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FACC15', stroke: '#090D15', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* CHART 2: Average Response Times (Seconds) by Math Topic or Student */}
        <section
          data-testid="response-times-chart"
          className="lg:col-span-6 rpg-panel p-4 sm:p-5 space-y-3"
        >
          <div className="border-b border-slate-700/70 pb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-sky-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                <span>Waktu Respons Rata-rata (Average Response Times)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Durasi rata-rata (detik) yang dibutuhkan siswa untuk menyelesaikan soal
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#0b101b] p-1 rounded border border-slate-700/80">
              <button
                type="button"
                data-testid="response-chart-by-topic-btn"
                onClick={() => setResponseViewMode('topic')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  responseViewMode === 'topic'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Per Topik
              </button>
              <button
                type="button"
                data-testid="response-chart-by-student-btn"
                onClick={() => setResponseViewMode('student')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  responseViewMode === 'student'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3 h-3" aria-hidden="true" />
                <span>Per Siswa</span>
              </button>
            </div>
          </div>

          <div className="w-full h-64 min-h-[250px] pt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={220}>
              {responseViewMode === 'topic' ? (
                <BarChart
                  data={responseChartDataByTopic}
                  margin={{ top: 10, right: 12, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="shortName"
                    stroke="#94A3B8"
                    tick={{ fill: '#CBD5E1', fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    height={46}
                  />
                  <YAxis
                    unit="d"
                    stroke="#38BDF8"
                    tick={{ fill: '#38BDF8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D15',
                      borderColor: '#475569',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar
                    dataKey="avgResponseSeconds"
                    name="Waktu Jawab Rata-rata (detik)"
                    fill="#38BDF8"
                    radius={[4, 4, 0, 0]}
                  >
                    {responseChartDataByTopic.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={
                          entry.avgResponseSeconds >= 6.0
                            ? '#F59E0B'
                            : entry.avgResponseSeconds >= 4.5
                            ? '#38BDF8'
                            : '#10B981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={studentResponses}
                  margin={{ top: 10, right: 12, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="studentName"
                    stroke="#94A3B8"
                    tick={{ fill: '#CBD5E1', fontSize: 11 }}
                    angle={-12}
                    textAnchor="end"
                    height={46}
                  />
                  <YAxis
                    unit="d"
                    stroke="#38BDF8"
                    tick={{ fill: '#38BDF8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D15',
                      borderColor: '#475569',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar
                    dataKey="avgResponseSeconds"
                    name="Rata-rata Jawab (detik)"
                    fill="#38BDF8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="fastestResponseSeconds"
                    name="Rekor Tercepat (detik)"
                    fill="#FACC15"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Actionable Learning Gaps & Pedagogical Recommendations Table */}
      <section
        data-testid="learning-gaps-table"
        className="rpg-panel p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-emerald-300 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
              <span>Identifikasi Kesenjangan Belajar &amp; Rekomendasi Pengajaran Guru</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Diurutkan berdasarkan rasio kesalahan tertinggi dan waktu respons untuk memprioritaskan materi remedial
            </p>
          </div>
        </div>

        <div className="rpg-well overflow-x-auto rpg-scroll">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#131b2b] border-b border-slate-700/80 text-slate-400">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Topik Matematika</th>
                <th className="py-2.5 px-3 font-semibold">Status Kesenjangan</th>
                <th className="py-2.5 px-3 text-right font-semibold">Waktu Rata-rata</th>
                <th className="py-2.5 px-3 text-right font-semibold">Salah / Total</th>
                <th className="py-2.5 px-3 text-right font-semibold">Error Rate</th>
                <th className="py-2.5 px-3 font-semibold">Rekomendasi Tindak Lanjut Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {topicAnalytics.map((item) => {
                const badgeStyle =
                  item.severity === 'critical'
                    ? 'bg-red-950/90 border-red-400/70 text-red-200'
                    : item.severity === 'moderate'
                    ? 'bg-amber-950/90 border-amber-400/70 text-amber-200'
                    : 'bg-emerald-950/90 border-emerald-400/70 text-emerald-200';
                const badgeText =
                  item.severity === 'critical'
                    ? 'Kesenjangan Kritis'
                    : item.severity === 'moderate'
                    ? 'Perlu Penguatan'
                    : 'Dikuasai Baik';

                return (
                  <tr key={item.category} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{item.topicName}</div>
                      <div className="text-[11px] text-slate-400">
                        Tingkat: {item.difficultyLabel}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${badgeStyle}`}
                      >
                        {badgeText}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-code font-bold text-sky-300 tabular-nums">
                      {item.avgResponseSeconds} dtk
                    </td>
                    <td className="py-2.5 px-3 text-right font-code text-slate-300 tabular-nums">
                      <span className="text-red-400 font-bold">{item.wrong}</span> / {item.attempts}
                    </td>
                    <td className="py-2.5 px-3 text-right font-code font-bold tabular-nums">
                      <span
                        className={
                          item.errorRatePercent >= 25
                            ? 'text-red-400'
                            : item.errorRatePercent >= 15
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }
                      >
                        {item.errorRatePercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 leading-relaxed max-w-md">
                      {item.recommendation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

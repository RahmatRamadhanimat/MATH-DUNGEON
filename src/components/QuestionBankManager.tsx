import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Check,
  Download,
  FileUp,
  FolderOpen,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CustomQuestionItem, QuestionSourceMode } from '../shared/constants';
import { sanitizeCustomQuestions } from '../shared/questionGenerator';
import {
  buildCustomQuestionsCsvTemplate,
  parseUploadedQuestionsText,
} from '../shared/questionBankParser';
import { retroAudio } from '../game/audio/RetroAudio';

const LOCAL_CUSTOM_BANK_KEY = 'math_maze_teacher_custom_questions';

function loadSavedTeacherBank(): CustomQuestionItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_BANK_KEY);
    if (!raw) return [];
    return sanitizeCustomQuestions(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveTeacherBank(items: CustomQuestionItem[]): void {
  try {
    localStorage.setItem(LOCAL_CUSTOM_BANK_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export interface QuestionBankManagerProps {
  localRole: 'teacher' | 'student';
  questionSource: QuestionSourceMode;
  customQuestions: CustomQuestionItem[];
  studentVisibleCount?: number;
  onChangeQuestionSource: (source: QuestionSourceMode) => void;
  onUpdateCustomQuestions: (
    questions: CustomQuestionItem[],
    nextSource?: QuestionSourceMode
  ) => void;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  localRole,
  questionSource,
  customQuestions,
  studentVisibleCount,
  onChangeQuestionSource,
  onUpdateCustomQuestions,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftOptionA, setDraftOptionA] = useState('');
  const [draftOptionB, setDraftOptionB] = useState('');
  const [draftCorrect, setDraftCorrect] = useState<'A' | 'B'>('A');
  const [draftExplanation, setDraftExplanation] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [savedLocalBank, setSavedLocalBank] = useState<CustomQuestionItem[]>(() =>
    loadSavedTeacherBank()
  );

  const resetForm = () => {
    setDraftPrompt('');
    setDraftOptionA('');
    setDraftOptionB('');
    setDraftCorrect('A');
    setDraftExplanation('');
    setEditingQuestionId(null);
    setFormError(null);
  };

  const commitQuestionList = (nextList: CustomQuestionItem[]) => {
    const nextSource: QuestionSourceMode =
      nextList.length === 0 && questionSource === 'custom_only'
        ? 'auto'
        : nextList.length > 0 && questionSource === 'auto'
        ? 'custom_only'
        : questionSource;

    saveTeacherBank(nextList);
    setSavedLocalBank(nextList);
    onUpdateCustomQuestions(nextList, nextSource);
  };

  const handleSaveCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = draftPrompt.trim();
    const optionA = draftOptionA.trim();
    const optionB = draftOptionB.trim();
    const explanation = draftExplanation.trim();

    if (!prompt) {
      setFormError('Tulis pertanyaan soal terlebih dahulu.');
      return;
    }
    if (!optionA || !optionB) {
      setFormError('Isi kedua pilihan jawaban (A dan B).');
      return;
    }
    if (optionA.toLowerCase() === optionB.toLowerCase()) {
      setFormError('Pilihan jawaban A dan B tidak boleh sama.');
      return;
    }

    const existingList = customQuestions ?? [];
    let nextList: CustomQuestionItem[];

    if (editingQuestionId) {
      nextList = existingList.map((q) =>
        q.id === editingQuestionId
          ? {
              ...q,
              prompt,
              optionA,
              optionB,
              correctOption: draftCorrect,
              ...(explanation ? { explanation } : { explanation: undefined }),
            }
          : q
      );
    } else {
      if (existingList.length >= 50) {
        setFormError('Maksimal 50 soal buatan guru per room.');
        return;
      }
      const newItem: CustomQuestionItem = {
        id: `cq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        prompt,
        optionA,
        optionB,
        correctOption: draftCorrect,
        ...(explanation ? { explanation } : {}),
      };
      nextList = [...existingList, newItem];
    }

    setUploadNotice(null);
    commitQuestionList(nextList);
    retroAudio.playButtonClick();
    resetForm();
  };

  const handleEditQuestion = (item: CustomQuestionItem) => {
    setEditingQuestionId(item.id);
    setDraftPrompt(item.prompt);
    setDraftOptionA(item.optionA);
    setDraftOptionB(item.optionB);
    setDraftCorrect(item.correctOption);
    setDraftExplanation(item.explanation ?? '');
    setFormError(null);
  };

  const handleDeleteQuestion = (id: string) => {
    const nextList = (customQuestions ?? []).filter((q) => q.id !== id);
    commitQuestionList(nextList);
    if (editingQuestionId === id) {
      resetForm();
    }
  };

  const handleClearAllQuestions = () => {
    commitQuestionList([]);
    setUploadNotice('Daftar soal guru di room ini telah dikosongkan.');
    resetForm();
  };

  const handleLoadFromLocalBank = () => {
    if (savedLocalBank.length === 0) return;
    setUploadNotice(`Memuat ${savedLocalBank.length} soal dari bank lokal.`);
    commitQuestionList(savedLocalBank);
    retroAudio.playButtonClick();
  };

  const handleFillSample = () => {
    setDraftPrompt(
      'Sebuah taman berbentuk persegi panjang berukuran 15 m × 8 m. Berapakah keliling taman tersebut?'
    );
    setDraftOptionA('46 m');
    setDraftOptionB('120 m');
    setDraftCorrect('A');
    setDraftExplanation('Keliling persegi panjang = 2 × (p + l) = 2 × (15 + 8) = 46 m');
    setFormError(null);
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = buildCustomQuestionsCsvTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-soal-math-maze.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseUploadedQuestionsText(text, file.name);
      if (!parsed.ok) {
        setFormError(parsed.error || 'Gagal membaca file soal.');
        setUploadNotice(null);
        return;
      }

      const existing = customQuestions ?? [];
      const remainingSlots = Math.max(0, 50 - existing.length);
      if (remainingSlots === 0) {
        setFormError('Kapasitas maksimal 50 soal per room sudah penuh.');
        return;
      }

      const imported = parsed.questions.slice(0, remainingSlots);
      const nextList = [...existing, ...imported];
      setFormError(null);
      setUploadNotice(
        `Berhasil mengunggah ${imported.length} soal dari "${file.name}"${
          parsed.skippedCount > 0 ? ` (${parsed.skippedCount} baris dilewati)` : ''
        }.`
      );
      commitQuestionList(nextList);
      retroAudio.playButtonClick();
    } catch {
      setFormError('Terjadi kesalahan saat membaca file yang diunggah.');
    }
  };

  const displayCount =
    localRole === 'teacher'
      ? customQuestions?.length ?? 0
      : studentVisibleCount ?? customQuestions?.length ?? 0;

  return (
    <section
      data-testid="question-bank-manager"
      className="rpg-panel p-4 sm:p-5 space-y-4"
    >
      <div className="border-b border-slate-700/70 pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-emerald-300 flex items-center gap-2">
            <BookMarked className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Bank Soal Guru & Kunci Jawaban</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Buat soal sendiri, unggah CSV/JSON, dan atur kunci jawaban A atau B.
          </p>
        </div>
        <span className="font-code text-xs font-semibold text-amber-300 tabular-nums">
          {displayCount} Soal Guru
        </span>
      </div>

      {/* Question Source Mode Selector */}
      <div>
        <span className="block text-xs font-semibold text-slate-300 mb-2">
          Sumber Soal Aktif
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              {
                id: 'auto',
                title: 'Otomatis (Sistem)',
                desc: 'Soal acak dari kategori materi yang dipilih.',
              },
              {
                id: 'mixed',
                title: 'Campuran (Guru + Sistem)',
                desc: 'Gabungan soal buatan guru & soal otomatis.',
              },
              {
                id: 'custom_only',
                title: 'Hanya Soal Guru',
                desc: 'Semua kunci memakai soal buatan guru.',
              },
            ] as const
          ).map((src) => {
            const active = questionSource === src.id;
            return (
              <button
                key={src.id}
                type="button"
                aria-pressed={active}
                disabled={localRole !== 'teacher'}
                data-testid={`question-source-${src.id}`}
                onClick={() => {
                  retroAudio.playButtonClick();
                  onChangeQuestionSource(src.id);
                }}
                className={`rounded-md min-h-[54px] p-2.5 text-left border transition-colors ${
                  active
                    ? 'bg-emerald-500/16 border-emerald-400 text-white'
                    : 'bg-[#0b101b] border-slate-700/80 text-slate-300 hover:border-slate-500 disabled:opacity-75'
                }`}
              >
                <div className={`text-xs sm:text-sm font-bold ${active ? 'text-emerald-300' : 'text-slate-100'}`}>
                  {src.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {src.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {localRole === 'teacher' ? (
        <>
          {questionSource === 'custom_only' && (customQuestions?.length ?? 0) === 0 && (
            <div className="rounded-md bg-amber-950/70 border border-amber-400/80 px-3.5 py-2.5 text-xs text-amber-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Mode <strong>Hanya Soal Guru</strong> aktif, namun daftar soal masih kosong. Tambahkan
                atau unggah minimal 1 soal di bawah (jika kosong saat mulai, sistem memakai soal
                otomatis sementara).
              </span>
            </div>
          )}

          {/* Upload / Import Toolbar */}
          <div className="rpg-well p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-sky-300">Unggah File Soal (CSV / JSON)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kolom CSV: <span className="font-code text-slate-300">pertanyaan, pilihan_a, pilihan_b, jawaban_benar (A/B), pembahasan</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                data-testid="question-upload-input"
                aria-label="Unggah file soal CSV atau JSON"
                onChange={handleUploadFile}
                className="hidden"
              />
              <button
                type="button"
                data-testid="question-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Unggah CSV / JSON</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="rpg-btn-slate min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Template CSV</span>
              </button>
            </div>
          </div>

          {uploadNotice && (
            <div
              data-testid="question-upload-notice"
              className="rounded-md bg-emerald-950/70 border border-emerald-400/80 px-3.5 py-2 text-xs text-emerald-100"
            >
              {uploadNotice}
            </div>
          )}

          {/* Create / Edit Question Form */}
          <form onSubmit={handleSaveCustomQuestion} className="rpg-well p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
                {editingQuestionId ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit Soal Guru</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Buat Soal Baru</span>
                  </>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {savedLocalBank.length > 0 && (customQuestions?.length ?? 0) === 0 && (
                  <button
                    type="button"
                    onClick={handleLoadFromLocalBank}
                    className="min-h-[34px] px-2.5 py-1 rounded-md bg-sky-900/70 hover:bg-sky-800 border border-sky-400/70 text-xs font-medium text-sky-100 flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Muat Bank Tersimpan ({savedLocalBank.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="rpg-btn-slate min-h-[34px] px-2.5 py-1 text-xs font-medium text-slate-200 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Isi Contoh Soal</span>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-question-prompt"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Pertanyaan Soal
              </label>
              <textarea
                id="custom-question-prompt"
                data-testid="custom-q-prompt"
                rows={2}
                maxLength={240}
                value={draftPrompt}
                onChange={(e) => {
                  setDraftPrompt(e.target.value);
                  setFormError(null);
                }}
                placeholder="Contoh: Berapakah luas persegi dengan sisi 9 cm?"
                className="w-full rounded-md bg-[#131b2b] border border-slate-600 focus:border-emerald-400 outline-none px-3 py-2 text-base sm:text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="custom-question-opt-a"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Pilihan Jawaban A
                </label>
                <input
                  id="custom-question-opt-a"
                  data-testid="custom-q-opt-a"
                  type="text"
                  maxLength={100}
                  value={draftOptionA}
                  onChange={(e) => {
                    setDraftOptionA(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Jawaban A..."
                  className="w-full min-h-[40px] rounded-md bg-[#131b2b] border border-slate-600 focus:border-emerald-400 outline-none px-3 py-2 text-base sm:text-sm font-code text-white placeholder:text-slate-500 placeholder:font-sans"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-question-opt-b"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Pilihan Jawaban B
                </label>
                <input
                  id="custom-question-opt-b"
                  data-testid="custom-q-opt-b"
                  type="text"
                  maxLength={100}
                  value={draftOptionB}
                  onChange={(e) => {
                    setDraftOptionB(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Jawaban B..."
                  className="w-full min-h-[40px] rounded-md bg-[#131b2b] border border-slate-600 focus:border-emerald-400 outline-none px-3 py-2 text-base sm:text-sm font-code text-white placeholder:text-slate-500 placeholder:font-sans"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">
                Kunci Jawaban Benar
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="custom-q-correct-a"
                  aria-pressed={draftCorrect === 'A'}
                  onClick={() => setDraftCorrect('A')}
                  className={`rounded-md min-h-[42px] px-3 py-2 font-bold text-xs sm:text-sm border flex items-center justify-center gap-1.5 transition-colors ${
                    draftCorrect === 'A'
                      ? 'bg-emerald-600 border-emerald-300 text-white'
                      : 'bg-[#131b2b] border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {draftCorrect === 'A' && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span>{draftCorrect === 'A' ? 'Jawaban A Benar' : 'Pilih A Benar'}</span>
                </button>
                <button
                  type="button"
                  data-testid="custom-q-correct-b"
                  aria-pressed={draftCorrect === 'B'}
                  onClick={() => setDraftCorrect('B')}
                  className={`rounded-md min-h-[42px] px-3 py-2 font-bold text-xs sm:text-sm border flex items-center justify-center gap-1.5 transition-colors ${
                    draftCorrect === 'B'
                      ? 'bg-emerald-600 border-emerald-300 text-white'
                      : 'bg-[#131b2b] border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {draftCorrect === 'B' && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span>{draftCorrect === 'B' ? 'Jawaban B Benar' : 'Pilih B Benar'}</span>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-question-explanation"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Pembahasan Singkat (Opsional)
              </label>
              <input
                id="custom-question-explanation"
                data-testid="custom-q-explanation"
                type="text"
                maxLength={240}
                value={draftExplanation}
                onChange={(e) => setDraftExplanation(e.target.value)}
                placeholder="Ditampilkan setelah menjawab (contoh: 9 × 9 = 81 cm²)"
                className="w-full min-h-[40px] rounded-md bg-[#131b2b] border border-slate-600 focus:border-emerald-400 outline-none px-3 py-2 text-base sm:text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-md bg-red-950/80 border border-red-400/80 px-3 py-2 text-xs text-red-100"
              >
                {formError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                data-testid="custom-q-save-btn"
                className="rpg-btn-emerald flex-1 sm:flex-initial min-h-[44px] px-4 py-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{editingQuestionId ? 'Simpan Perubahan Soal' : 'Tambah Soal ke Room'}</span>
              </button>
              {editingQuestionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rpg-btn-slate min-h-[44px] px-4 py-2 text-xs sm:text-sm font-medium text-slate-200"
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>

          {/* List of Added Teacher Questions */}
          {(customQuestions?.length ?? 0) > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">
                  Daftar Soal Room (<span className="font-code">{customQuestions.length}/50</span>)
                </span>
                <button
                  type="button"
                  onClick={handleClearAllQuestions}
                  className="text-xs text-red-300 hover:text-red-200 underline"
                >
                  Hapus Semua
                </button>
              </div>
              <div
                className="space-y-2 max-h-72 overflow-y-auto pr-1 rpg-scroll"
                data-testid="custom-q-list"
              >
                {customQuestions.map((cq, index) => (
                  <div
                    key={cq.id}
                    className="rpg-well p-3 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-white leading-snug break-words">
                        <span className="font-code text-amber-400 mr-1.5">#{index + 1}</span>
                        {cq.prompt}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditQuestion(cq)}
                          className="rpg-btn-slate min-h-[32px] px-2.5 py-1 text-xs text-sky-300 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(cq.id)}
                          aria-label={`Hapus soal nomor ${index + 1}`}
                          className="min-h-[32px] px-2.5 py-1 rounded-md bg-red-950/80 hover:bg-red-900 border border-red-500/60 text-xs text-red-200 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      <div
                        className={`rounded px-2.5 py-1.5 border flex items-center justify-between gap-2 ${
                          cq.correctOption === 'A'
                            ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-100'
                            : 'bg-[#131b2b] border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="truncate font-code">
                          <strong className="text-amber-300 font-sans">A.</strong> {cq.optionA}
                        </span>
                        {cq.correctOption === 'A' && (
                          <span className="text-[11px] font-bold text-emerald-300 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Benar</span>
                          </span>
                        )}
                      </div>
                      <div
                        className={`rounded px-2.5 py-1.5 border flex items-center justify-between gap-2 ${
                          cq.correctOption === 'B'
                            ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-100'
                            : 'bg-[#131b2b] border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="truncate font-code">
                          <strong className="text-amber-300 font-sans">B.</strong> {cq.optionB}
                        </span>
                        {cq.correctOption === 'B' && (
                          <span className="text-[11px] font-bold text-emerald-300 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Benar</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {cq.explanation && (
                      <p className="text-xs text-slate-400">Pembahasan: {cq.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rpg-well p-3.5 text-xs sm:text-sm text-slate-300">
          {questionSource === 'custom_only'
            ? `Guru menyiapkan ${studentVisibleCount ?? 0} soal khusus buatan guru untuk seluruh kunci di labirin.`
            : questionSource === 'mixed'
            ? `Permainan menggunakan kombinasi ${studentVisibleCount ?? 0} soal buatan guru dan soal matematika acak.`
            : 'Permainan menggunakan soal matematika acak sesuai kategori materi yang dipilih guru.'}
        </div>
      )}
    </section>
  );
};

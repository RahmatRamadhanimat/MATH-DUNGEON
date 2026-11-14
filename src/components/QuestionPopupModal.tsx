import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { PublicMathQuestion } from '../shared/questionGenerator';
import { retroAudio } from '../game/audio/RetroAudio';

export interface QuestionFeedbackState {
  correct: boolean;
  correctOption: 'A' | 'B';
  explanation: string;
  pointsEarned: number;
  livesRemaining: number;
}

interface QuestionPopupModalProps {
  question: PublicMathQuestion;
  feedback: QuestionFeedbackState | null;
  submitError?: string | null;
  canRetryOrClose?: boolean;
  onSelectAnswer: (option: 'A' | 'B' | 'TIMEOUT') => void;
  onRetrySubmit?: () => void;
  onCloseFeedback: () => void;
}

export const QuestionPopupModal: React.FC<QuestionPopupModalProps> = ({
  question,
  feedback,
  submitError = null,
  canRetryOrClose = false,
  onSelectAnswer,
  onRetrySubmit,
  onCloseFeedback,
}) => {
  const totalSeconds = question.timerSeconds || 25;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const [selectedChoice, setSelectedChoice] = useState<'A' | 'B' | null>(null);
  const [timedOut, setTimedOut] = useState<boolean>(false);

  useEffect(() => {
    setSecondsLeft(question.timerSeconds || 25);
    setSelectedChoice(null);
    setTimedOut(false);
  }, [question.id, question.timerSeconds]);

  // Question countdown timer (stops immediately once an answer is submitted)
  useEffect(() => {
    if (feedback || selectedChoice || timedOut) return;
    if (secondsLeft <= 0) {
      setTimedOut(true);
      onSelectAnswer('TIMEOUT');
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, feedback, selectedChoice, timedOut, onSelectAnswer]);

  const handleChoose = useCallback(
    (opt: 'A' | 'B') => {
      if (feedback || selectedChoice || timedOut) return;
      retroAudio.playButtonClick();
      setSelectedChoice(opt);
      onSelectAnswer(opt);
    },
    [feedback, selectedChoice, timedOut, onSelectAnswer]
  );

  // Keyboard shortcuts A / B or Enter/Escape to dismiss feedback or recovery banner
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (feedback || submitError) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          onCloseFeedback();
        }
        return;
      }
      if (selectedChoice || timedOut) return;
      if (e.key === 'a' || e.key === 'A' || e.key === '1') {
        e.preventDefault();
        handleChoose('A');
      } else if (e.key === 'b' || e.key === 'B' || e.key === '2') {
        e.preventDefault();
        handleChoose('B');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [feedback, submitError, selectedChoice, timedOut, handleChoose, onCloseFeedback]);

  const diffLabel =
    question.difficulty === 'easy'
      ? 'Mudah'
      : question.difficulty === 'medium'
      ? 'Sedang'
      : 'Sulit';

  const isWaitingServer = Boolean((selectedChoice || timedOut) && !feedback && !submitError);
  const timerPercent = Math.max(0, Math.min(100, Math.round((secondsLeft / totalSeconds) * 100)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="math-question-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-auto transition-colors duration-300 ${
        feedback?.correct ? 'bg-black/50' : 'bg-black/80'
      }`}
    >
      <div
        className={`rpg-modal w-full max-w-xl max-h-[92dvh] overflow-y-auto rpg-scroll p-4 sm:p-6 text-slate-100 ${
          feedback?.correct ? 'border-amber-300 shadow-[0_0_28px_rgba(250,204,21,0.35)]' : ''
        }`}
      >
        {/* Top Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-amber-300">
            <span id="math-question-title" className="font-bold">
              Soal #{question.questionNumber}
            </span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-200">{question.categoryName}</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-sky-300">
              {question.category === 'custom' ? 'Soal Guru' : `Tingkat ${diffLabel}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-code text-sm font-bold tabular-nums shrink-0">
            <Clock
              className={`w-3.5 h-3.5 ${secondsLeft <= 6 ? 'text-red-400' : 'text-emerald-400'}`}
              aria-hidden="true"
            />
            <span className={secondsLeft <= 6 ? 'text-red-400' : 'text-emerald-400'}>
              {secondsLeft}d
            </span>
          </div>
        </div>

        {/* Countdown Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-[#090D15] overflow-hidden mb-4">
          <div
            className={`h-full transition-all duration-300 ${
              secondsLeft <= 6 ? 'bg-red-500' : secondsLeft <= 12 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        {/* Question Prompt */}
        <div className="rpg-well p-4 sm:p-5 mb-4 sm:mb-5 text-center">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Jawab dengan tepat untuk membuka kunci labirin
          </p>
          <h2
            data-testid="question-prompt"
            className="text-lg sm:text-2xl font-bold text-white leading-snug break-words"
          >
            {question.prompt}
          </h2>
        </div>

        {/* Strictly Two Answer Choices: A and B */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-5">
          {(['A', 'B'] as const).map((optKey) => {
            const val = question.options[optKey];
            const isPicked = selectedChoice === optKey;
            const isCorrectChoice = feedback && feedback.correctOption === optKey;
            const isWrongPicked = feedback && isPicked && !feedback.correct;

            let btnStyle =
              'bg-[#1a2438] hover:bg-[#23314b] border-slate-500/80 text-white';
            if (isCorrectChoice) {
              btnStyle = 'bg-emerald-900/90 border-emerald-400 text-emerald-50';
            } else if (isWrongPicked) {
              btnStyle = 'bg-red-900/90 border-red-400 text-red-50';
            } else if (isPicked) {
              btnStyle = 'bg-amber-500/20 border-amber-400 text-amber-100';
            }

            return (
              <button
                key={optKey}
                type="button"
                disabled={Boolean(feedback) || Boolean(selectedChoice) || timedOut}
                data-testid={`answer-option-${optKey}`}
                onClick={() => handleChoose(optKey)}
                className={`rounded-md min-h-[60px] p-3.5 border-2 text-left transition-all active:scale-[0.98] flex items-center justify-between gap-2 ${btnStyle}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded bg-[#090D15] border border-amber-400/80 text-amber-300 font-code font-bold flex items-center justify-center text-base shrink-0">
                    {optKey}
                  </span>
                  <span className="font-code text-base sm:text-lg font-bold tabular-nums break-words">
                    {val}
                  </span>
                </div>
                <span className="hidden sm:inline text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                  Tombol {optKey}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback / Submitting / Recovery Banner */}
        {feedback ? (
          <div
            data-testid="question-feedback"
            className={`rounded-md p-3.5 sm:p-4 border ${
              feedback.correct
                ? 'bg-emerald-950/90 border-emerald-400/90 text-emerald-100'
                : 'bg-red-950/90 border-red-400/90 text-red-100'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  {feedback.correct ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                      <span>
                        Jawaban Benar! +{feedback.pointsEarned} Poin & Kunci Didapatkan
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-300 shrink-0" aria-hidden="true" />
                      <span>
                        Jawaban Salah — Nyawa Tersisa: {feedback.livesRemaining}
                      </span>
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-200/90 leading-relaxed">
                  Pembahasan: {feedback.explanation}
                </p>
              </div>
              <button
                type="button"
                data-testid="continue-after-question"
                onClick={() => {
                  retroAudio.playButtonClick();
                  onCloseFeedback();
                }}
                className="rpg-btn-gold w-full sm:w-auto min-h-[42px] px-4 py-2 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>Lanjutkan</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : submitError ? (
          <div
            data-testid="question-recovery-banner"
            className="rounded-md p-3.5 sm:p-4 border bg-amber-950/90 border-amber-400 text-amber-100"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{submitError}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {canRetryOrClose && onRetrySubmit && (
                  <button
                    type="button"
                    data-testid="retry-submit-question"
                    onClick={() => {
                      retroAudio.playButtonClick();
                      onRetrySubmit();
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Kirim Ulang</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="force-close-question"
                  onClick={() => {
                    retroAudio.playButtonClick();
                    onCloseFeedback();
                  }}
                  className="rpg-btn-gold min-h-[40px] px-4 py-2 font-bold text-xs whitespace-nowrap"
                >
                  Tutup & Lanjutkan
                </button>
              </div>
            </div>
          </div>
        ) : isWaitingServer ? (
          <div
            data-testid="question-submitting-banner"
            className="rounded-md p-3 border border-amber-400/60 bg-amber-950/40 text-center text-xs font-medium text-amber-200"
          >
            Memeriksa jawaban dengan server...
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Pilih A atau B · Benar membuka kunci · Salah mengurangi 1 nyawa
          </p>
        )}
      </div>
    </div>
  );
};

import { CustomQuestionItem } from './constants';
import { sanitizeCustomQuestions } from './questionGenerator';

export interface ParseQuestionsResult {
  ok: boolean;
  questions: CustomQuestionItem[];
  skippedCount: number;
  error?: string;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines[0] ?? '';
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

function isHeaderRow(cols: string[]): boolean {
  const first = (cols[0] ?? '').toLowerCase();
  const second = (cols[1] ?? '').toLowerCase();
  const fourth = (cols[3] ?? '').toLowerCase();
  return (
    first.includes('pertanyaan') ||
    first.includes('prompt') ||
    first.includes('soal') ||
    second.includes('pilihan_a') ||
    second.includes('optiona') ||
    fourth.includes('jawaban_benar') ||
    fourth.includes('correct')
  );
}

/**
 * Parses uploaded teacher question banks in JSON, CSV (comma/semicolon), or TSV format.
 * Preserves only valid 2-option (A/B) items with distinct choices.
 */
export function parseUploadedQuestionsText(
  rawText: string,
  fileName = ''
): ParseQuestionsResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      ok: false,
      questions: [],
      skippedCount: 0,
      error: 'File kosong. Pastikan berisi daftar soal format CSV atau JSON.',
    };
  }

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
        ? parsed.questions
        : null;
      if (!rawArray) {
        return {
          ok: false,
          questions: [],
          skippedCount: 0,
          error: 'Format JSON harus berupa array soal atau objek { "questions": [...] }.',
        };
      }
      const valid = sanitizeCustomQuestions(rawArray);
      const skipped = Math.max(0, rawArray.length - valid.length);
      if (valid.length === 0) {
        return {
          ok: false,
          questions: [],
          skippedCount: skipped,
          error: 'Tidak ada soal valid di file JSON (pastikan prompt, optionA, optionB berbeda, dan correctOption A/B terisi).',
        };
      }
      return { ok: true, questions: valid, skippedCount: skipped };
    } catch {
      if (lowerName.endsWith('.json')) {
        return {
          ok: false,
          questions: [],
          skippedCount: 0,
          error: 'File JSON tidak valid atau rusak.',
        };
      }
    }
  }

  // Parse CSV / Semicolon-CSV / TSV
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, questions: [], skippedCount: 0, error: 'Tidak ada baris soal ditemukan.' };
  }

  const delimiter = detectDelimiter(lines);
  const startIdx = isHeaderRow(parseDelimitedLine(lines[0], delimiter)) ? 1 : 0;
  const candidateRows: Partial<CustomQuestionItem>[] = [];
  let totalDataRows = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter);
    if (cols.length < 3) {
      totalDataRows++;
      continue;
    }
    totalDataRows++;
    const [prompt, optionA, optionB, rawCorrect = 'A', explanation = ''] = cols;
    const normCorrect = rawCorrect.trim().toUpperCase();
    const correctOption: 'A' | 'B' = normCorrect === 'B' || normCorrect === '2' ? 'B' : 'A';
    candidateRows.push({
      id: `up-${Date.now()}-${i}`,
      prompt,
      optionA,
      optionB,
      correctOption,
      explanation,
    });
  }

  const valid = sanitizeCustomQuestions(candidateRows);
  const skippedCount = Math.max(0, totalDataRows - valid.length);

  if (valid.length === 0) {
    return {
      ok: false,
      questions: [],
      skippedCount,
      error:
        'Tidak ada soal valid ditemukan. Gunakan kolom: pertanyaan,pilihan_a,pilihan_b,jawaban_benar(A/B),pembahasan',
    };
  }

  return { ok: true, questions: valid, skippedCount };
}

export function buildCustomQuestionsCsvTemplate(): string {
  return [
    'pertanyaan,pilihan_a,pilihan_b,jawaban_benar,pembahasan',
    '"Berapakah hasil dari 25 x 4?",100,80,A,"25 x 4 = 100"',
    '"Sebuah persegi memiliki sisi 9 cm. Berapakah luasnya?",36 cm2,81 cm2,B,"Luas = 9 x 9 = 81 cm2"',
    '"Hasil dari 144 : 12 adalah...",12,14,A,"144 : 12 = 12"',
  ].join('\n');
}

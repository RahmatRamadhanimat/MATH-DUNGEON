import { AnswerOptionKey, CustomQuestionItem, QuizChoiceCount } from './constants';
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
  const joined = cols.map((c) => c.toLowerCase()).join('|');
  return (
    first.includes('pertanyaan') ||
    first.includes('prompt') ||
    first.includes('soal') ||
    second.includes('pilihan_a') ||
    second.includes('optiona') ||
    joined.includes('jawaban_benar') ||
    joined.includes('correct')
  );
}

function isFourChoiceHeader(cols: string[]): boolean {
  const joined = cols.map((c) => c.toLowerCase()).join('|');
  return (
    joined.includes('pilihan_c') ||
    joined.includes('optionc') ||
    joined.includes('opsi_c') ||
    joined.includes('pilihan_d') ||
    joined.includes('optiond')
  );
}

function parseCorrectOptionKey(raw: string, allowFour: boolean): AnswerOptionKey {
  const norm = raw.trim().toUpperCase();
  if (allowFour) {
    if (norm === 'D' || norm === '4') return 'D';
    if (norm === 'C' || norm === '3') return 'C';
  }
  if (norm === 'B' || norm === '2') return 'B';
  return 'A';
}

function looksLikeAnswerKey(raw: string): boolean {
  return /^(A|B|C|D|1|2|3|4)$/i.test(raw.trim());
}

/**
 * Parses uploaded teacher question banks in JSON, CSV (comma/semicolon), or TSV format.
 * Supports both 2-option (A/B) and 4-option (A/B/C/D) items with distinct choices.
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
          error:
            'Tidak ada soal valid di file JSON (pastikan prompt, optionA, optionB berbeda — dan optionC/optionD untuk 4 pilihan — serta correctOption terisi).',
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
  const firstCols = parseDelimitedLine(lines[0], delimiter);
  const hasHeader = isHeaderRow(firstCols);
  const headerIsFourChoice = hasHeader && isFourChoiceHeader(firstCols);
  const startIdx = hasHeader ? 1 : 0;
  const candidateRows: Partial<CustomQuestionItem>[] = [];
  let totalDataRows = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter);
    if (cols.length < 3) {
      totalDataRows++;
      continue;
    }
    totalDataRows++;

    const rowIsFourChoice =
      headerIsFourChoice || (cols.length >= 6 && looksLikeAnswerKey(cols[5] ?? ''));

    if (rowIsFourChoice) {
      const [prompt, optionA, optionB, optionC, optionD, rawCorrect = 'A', explanation = ''] = cols;
      candidateRows.push({
        id: `up-${Date.now()}-${i}`,
        prompt,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: parseCorrectOptionKey(rawCorrect, true),
        explanation,
      });
    } else {
      const [prompt, optionA, optionB, rawCorrect = 'A', explanation = ''] = cols;
      candidateRows.push({
        id: `up-${Date.now()}-${i}`,
        prompt,
        optionA,
        optionB,
        correctOption: parseCorrectOptionKey(rawCorrect, false),
        explanation,
      });
    }
  }

  const valid = sanitizeCustomQuestions(candidateRows);
  const skippedCount = Math.max(0, totalDataRows - valid.length);

  if (valid.length === 0) {
    return {
      ok: false,
      questions: [],
      skippedCount,
      error:
        'Tidak ada soal valid ditemukan. Gunakan kolom 2 pilihan: pertanyaan,pilihan_a,pilihan_b,jawaban_benar(A/B),pembahasan — atau 4 pilihan: pertanyaan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawaban_benar(A/B/C/D),pembahasan',
    };
  }

  return { ok: true, questions: valid, skippedCount };
}

export function buildCustomQuestionsCsvTemplate(choiceCount: QuizChoiceCount = 2): string {
  if (choiceCount === 4) {
    return [
      'pertanyaan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawaban_benar,pembahasan',
      '"Berapakah hasil dari 25 x 4?",100,80,90,120,A,"25 x 4 = 100"',
      '"Sebuah persegi memiliki sisi 9 cm. Berapakah luasnya?",36 cm2,81 cm2,72 cm2,64 cm2,B,"Luas = 9 x 9 = 81 cm2"',
      '"Hasil dari 144 : 12 adalah...",10,14,12,16,C,"144 : 12 = 12"',
      '"Berapakah hasil dari 45 + 15 x 4 - 20?",220,75,95,85,D,"Perkalian dahulu: 15 x 4 = 60, lalu 45 + 60 - 20 = 85"',
      '"Sederhanakan pecahan 2/3 + 3/4!",17/12,5/7,11/12,13/12,A,"Samakan penyebut menjadi 12: 8/12 + 9/12 = 17/12"',
      '"Tas seharga Rp200.000 diskon 25%. Berapa harga setelah diskon?",Rp175.000,Rp150.000,Rp160.000,Rp140.000,B,"Diskon 25% = Rp50.000, harga bayar = Rp150.000"',
      '"Suhu kulkas awalnya -6 C lalu naik 14 C. Berapa suhu sekarang?",-20 C,6 C,8 C,20 C,C,"-6 + 14 = 8 C"',
      '"Berapakah hasil dari 9^2 - akar(144)?",6,57,72,69,D,"81 - 12 = 69"',
      '"Tentukan nilai x dari persamaan 5x - 9 = 2x + 12!",x = 7,x = 3,x = 6,x = 9,A,"3x = 21 maka x = 7"',
      '"Segitiga siku-siku memiliki alas 6 cm dan tinggi 8 cm. Berapa sisi miringnya?",14 cm,10 cm,12 cm,9 cm,B,"c = akar(36 + 64) = 10 cm"',
      '"Keliling lingkaran dengan jari-jari 7 m (pi = 22/7) adalah...",22 m,154 m,44 m,88 m,C,"Keliling = 2 x 22/7 x 7 = 44 m"',
      '"Sebuah kubus memiliki rusuk 5 cm. Berapakah volumenya?",25 cm3,150 cm3,75 cm3,125 cm3,D,"Volume = 5 x 5 x 5 = 125 cm3"',
      '"Lanjutkan pola bilangan Fibonacci: 2, 3, 5, 8, 13, 21, ...",34,32,35,29,A,"13 + 21 = 34"',
      '"Berapakah jumlah 10 bilangan asli pertama (1 + 2 + ... + 10)?",50,55,45,60,B,"10 x 11 / 2 = 55"',
      '"Jika 3 pekerja selesai dalam 8 hari, berapa hari untuk 6 pekerja?",16 hari,6 hari,4 hari,3 hari,C,"(3 x 8) : 6 = 4 hari"',
    ].join('\n');
  }

  return [
    'pertanyaan,pilihan_a,pilihan_b,jawaban_benar,pembahasan',
    '"Berapakah hasil dari 25 x 4?",100,80,A,"25 x 4 = 100"',
    '"Sebuah persegi memiliki sisi 9 cm. Berapakah luasnya?",36 cm2,81 cm2,B,"Luas = 9 x 9 = 81 cm2"',
    '"Hasil dari 144 : 12 adalah...",12,14,A,"144 : 12 = 12"',
    '"Berapakah hasil dari 45 + 15 x 4 - 20?",85,220,A,"Perkalian dahulu: 15 x 4 = 60, lalu 45 + 60 - 20 = 85"',
    '"Sederhanakan pecahan 2/3 + 3/4!",17/12,5/7,A,"Samakan penyebut menjadi 12: 8/12 + 9/12 = 17/12"',
    '"Tas seharga Rp200.000 diskon 25%. Berapa harga setelah diskon?",Rp150.000,Rp175.000,A,"Diskon 25% = Rp50.000, harga bayar = Rp150.000"',
    '"Suhu kulkas awalnya -6 C lalu naik 14 C. Berapa suhu sekarang?",-20 C,8 C,B,"-6 + 14 = 8 C"',
    '"Berapakah hasil dari 9^2 - akar(144)?",69,6,A,"81 - 12 = 69"',
    '"Tentukan nilai x dari persamaan 5x - 9 = 2x + 12!",x = 7,x = 3,A,"3x = 21 maka x = 7"',
    '"Segitiga siku-siku memiliki alas 6 cm dan tinggi 8 cm. Berapa sisi miringnya?",10 cm,14 cm,A,"c = akar(36 + 64) = 10 cm"',
    '"Keliling lingkaran dengan jari-jari 7 m (pi = 22/7) adalah...",44 m,154 m,A,"Keliling = 2 x 22/7 x 7 = 44 m"',
    '"Sebuah kubus memiliki rusuk 5 cm. Berapakah volumenya?",125 cm3,150 cm3,A,"Volume = 5 x 5 x 5 = 125 cm3"',
    '"Lanjutkan pola bilangan Fibonacci: 2, 3, 5, 8, 13, 21, ...",34,32,A,"13 + 21 = 34"',
    '"Berapakah jumlah 10 bilangan asli pertama (1 + 2 + ... + 10)?",55,50,A,"10 x 11 / 2 = 55"',
    '"Jika 3 pekerja selesai dalam 8 hari, berapa hari untuk 6 pekerja?",4 hari,16 hari,A,"(3 x 8) : 6 = 4 hari"',
  ].join('\n');
}

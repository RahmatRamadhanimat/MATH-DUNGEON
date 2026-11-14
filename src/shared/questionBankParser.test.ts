import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomQuestionsCsvTemplate, parseUploadedQuestionsText } from './questionBankParser';

test('parseUploadedQuestionsText parses CSV template with headers and quoted fields cleanly', () => {
  const csv = buildCustomQuestionsCsvTemplate();
  const res = parseUploadedQuestionsText(csv, 'soal-kelas.csv');
  assert.equal(res.ok, true);
  assert.equal(res.questions.length, 3);
  assert.equal(res.skippedCount, 0);
  assert.equal(res.questions[0].prompt, 'Berapakah hasil dari 25 x 4?');
  assert.equal(res.questions[0].optionA, '100');
  assert.equal(res.questions[0].optionB, '80');
  assert.equal(res.questions[0].correctOption, 'A');
  assert.equal(res.questions[1].correctOption, 'B');
  assert.equal(res.questions[1].explanation, 'Luas = 9 x 9 = 81 cm2');
});

test('parseUploadedQuestionsText parses semicolon-delimited CSV and skips duplicate options', () => {
  const raw = [
    'pertanyaan;pilihan_a;pilihan_b;jawaban_benar;pembahasan',
    'Berapa 8 + 7?;15;16;A;8 + 7 = 15',
    'Baris rusak dengan pilihan sama;10;10;A;',
    'Berapa 9 x 3?;24;27;B;9 x 3 = 27',
  ].join('\n');
  const res = parseUploadedQuestionsText(raw, 'materi.csv');
  assert.equal(res.ok, true);
  assert.equal(res.questions.length, 2);
  assert.equal(res.skippedCount, 1);
  assert.equal(res.questions[1].correctOption, 'B');
});

test('parseUploadedQuestionsText parses JSON array and rejects malformed files', () => {
  const json = JSON.stringify([
    {
      prompt: 'Nilai x jika 2x = 14 adalah...',
      optionA: '6',
      optionB: '7',
      correctOption: 'B',
    },
  ]);
  const res = parseUploadedQuestionsText(json, 'bank.json');
  assert.equal(res.ok, true);
  assert.equal(res.questions.length, 1);
  assert.equal(res.questions[0].correctOption, 'B');

  const bad = parseUploadedQuestionsText('{not valid json', 'broken.json');
  assert.equal(bad.ok, false);
  assert.ok(bad.error);
});

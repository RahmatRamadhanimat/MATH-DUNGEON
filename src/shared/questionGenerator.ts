import {
  CustomQuestionItem,
  DifficultyLevel,
  MATH_CATEGORIES,
  MathCategoryId,
  QuestionSourceMode,
} from './constants';

export interface MathQuestion {
  id: string;
  questionNumber: number;
  category: MathCategoryId | 'custom';
  categoryName: string;
  difficulty: DifficultyLevel;
  prompt: string;
  options: {
    A: string;
    B: string;
  };
  correctOption: 'A' | 'B';
  explanation: string;
  signature: string;
}

export interface PublicMathQuestion {
  id: string;
  keyId: string;
  questionNumber: number;
  category: MathCategoryId | 'custom';
  categoryName: string;
  difficulty: DifficultyLevel;
  prompt: string;
  options: {
    A: string;
    B: string;
  };
  timerSeconds: number;
}

function randInt(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

interface RawQuestionTemplate {
  prompt: string;
  correctAnswer: string;
  wrongAnswer: string;
  explanation: string;
  signature: string;
}

function buildCategoryQuestion(category: MathCategoryId, rng: () => number): RawQuestionTemplate {
  switch (category) {
    // ================= TINGKAT MUDAH =================
    case 'addition': {
      const a = randInt(12, 89, rng);
      const b = randInt(14, 78, rng);
      const ans = a + b;
      const delta = (rng() < 0.5 ? 1 : -1) * (rng() < 0.5 ? 10 : randInt(2, 9, rng));
      const wrong = ans + delta === ans ? ans + 5 : ans + delta;
      return {
        prompt: `BERAPAKAH HASIL DARI ${a} + ${b}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong),
        explanation: `${a} + ${b} = ${ans}`,
        signature: `add:${a}+${b}`,
      };
    }

    case 'subtraction': {
      const b = randInt(15, 65, rng);
      const ans = randInt(12, 75, rng);
      const a = b + ans;
      const delta = (rng() < 0.5 ? 1 : -1) * randInt(2, 10, rng);
      const wrong = Math.max(1, ans + delta === ans ? ans + 4 : ans + delta);
      return {
        prompt: `BERAPAKAH HASIL DARI ${a} − ${b}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 6 : wrong),
        explanation: `${a} − ${b} = ${ans}`,
        signature: `sub:${a}-${b}`,
      };
    }

    case 'multiplication': {
      const a = randInt(4, 25, rng);
      const b = randInt(3, 12, rng);
      const ans = a * b;
      const wrongOffset = (rng() < 0.5 ? 1 : -1) * (rng() < 0.5 ? a : b);
      const wrong = ans + wrongOffset <= 0 || ans + wrongOffset === ans ? ans + 10 : ans + wrongOffset;
      return {
        prompt: `BERAPAKAH HASIL DARI ${a} × ${b}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong),
        explanation: `${a} × ${b} = ${ans}`,
        signature: `mul:${a}x${b}`,
      };
    }

    case 'division': {
      const divisor = randInt(3, 12, rng);
      const quotient = randInt(4, 16, rng);
      const dividend = divisor * quotient;
      const wrong = quotient + (rng() < 0.5 ? 2 : -2) || quotient + 3;
      return {
        prompt: `BERAPAKAH HASIL DARI ${dividend} ÷ ${divisor}?`,
        correctAnswer: String(quotient),
        wrongAnswer: String(wrong === quotient ? quotient + 1 : wrong),
        explanation: `${dividend} ÷ ${divisor} = ${quotient}`,
        signature: `div:${dividend}/${divisor}`,
      };
    }

    case 'basic_ops': {
      const a = randInt(10, 35, rng);
      const b = randInt(3, 9, rng);
      const c = randInt(2, 6, rng);
      const ans = a + b * c;
      // Common student mistake: adding first (a + b) * c
      const trap = (a + b) * c;
      const wrong = trap !== ans ? trap : ans + 6;
      return {
        prompt: `BERAPAKAH HASIL DARI ${a} + ${b} × ${c}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong),
        explanation: `Kerjakan perkalian dahulu: ${b} × ${c} = ${b * c}, lalu ${a} + ${b * c} = ${ans}`,
        signature: `basic:${a}+${b}*${c}`,
      };
    }

    // ================= TINGKAT SEDANG =================
    case 'fractions': {
      const denom = [4, 6, 8, 10, 12][randInt(0, 4, rng)];
      const n1 = randInt(1, denom - 1, rng);
      const n2 = randInt(1, denom - 1, rng);
      const sumNum = n1 + n2;
      const g = gcd(sumNum, denom);
      const simpNum = sumNum / g;
      const simpDen = denom / g;
      const correctStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
      const wrongStr = `${sumNum}/${denom * 2}`;
      return {
        prompt: `SEDERHANAKAN HASIL DARI ${n1}/${denom} + ${n2}/${denom}!`,
        correctAnswer: correctStr,
        wrongAnswer: wrongStr === correctStr ? `${simpNum + 1}/${simpDen}` : wrongStr,
        explanation: `${n1}/${denom} + ${n2}/${denom} = ${sumNum}/${denom} = ${correctStr}`,
        signature: `frac:${n1}/${denom}+${n2}/${denom}`,
      };
    }

    case 'percentages': {
      const percents = [10, 15, 20, 25, 30, 40, 50, 75];
      const p = percents[randInt(0, percents.length - 1, rng)];
      const base = randInt(2, 12, rng) * 20;
      const ans = (p * base) / 100;
      const wrong = ans + (rng() < 0.5 ? base * 0.1 : -base * 0.05);
      return {
        prompt: `BERAPAKAH ${p}% DARI ${base}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 12 : Math.round(wrong)),
        explanation: `${p}% × ${base} = (${p}/100) × ${base} = ${ans}`,
        signature: `pct:${p}_of_${base}`,
      };
    }

    case 'negative_numbers': {
      const a = -randInt(8, 35, rng);
      const b = randInt(12, 40, rng);
      const c = -randInt(3, 18, rng);
      const ans = a + b - c; // subtracting negative c adds |c|
      const wrong = a + b + c; // classic sign error
      return {
        prompt: `HITUNGLAH HASIL DARI ${a} + ${b} − (${c})!`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans - 10 : wrong),
        explanation: `${a} + ${b} − (${c}) = ${a + b} + ${Math.abs(c)} = ${ans}`,
        signature: `neg:${a}+${b}-(${c})`,
      };
    }

    case 'mixed_ops': {
      const div = randInt(2, 6, rng);
      const q = randInt(3, 9, rng);
      const sum = div * q;
      const a = randInt(4, sum - 2, rng);
      const b = sum - a;
      const mult = randInt(3, 7, rng);
      const ans = ((a + b) / div) * mult;
      const wrong = ans + (rng() < 0.5 ? mult : -mult);
      return {
        prompt: `HITUNGLAH: (${a} + ${b}) ÷ ${div} × ${mult} = ?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 5 : wrong),
        explanation: `(${a} + ${b}) ÷ ${div} × ${mult} = ${sum} ÷ ${div} × ${mult} = ${q} × ${mult} = ${ans}`,
        signature: `mixed:(${a}+${b})/${div}*${mult}`,
      };
    }

    case 'exponents': {
      const a = randInt(3, 11, rng);
      const b = randInt(2, 5, rng);
      const ans = a * a + b * b * b;
      const wrong = a * 2 + b * 3;
      return {
        prompt: `BERAPAKAH HASIL DARI ${a}² + ${b}³?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 8 : wrong),
        explanation: `${a}² = ${a * a} dan ${b}³ = ${b * b * b}, maka ${a * a} + ${b * b * b} = ${ans}`,
        signature: `exp:${a}^2+${b}^3`,
      };
    }

    case 'square_roots': {
      const r1 = randInt(4, 15, rng);
      const r2 = randInt(3, 12, rng);
      const sq1 = r1 * r1;
      const sq2 = r2 * r2;
      const ans = r1 + r2;
      const wrong = ans + (rng() < 0.5 ? 2 : -2);
      return {
        prompt: `BERAPAKAH HASIL DARI √${sq1} + √${sq2}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 3 : wrong),
        explanation: `√${sq1} = ${r1} dan √${sq2} = ${r2}, maka ${r1} + ${r2} = ${ans}`,
        signature: `sqrt:${sq1}+${sq2}`,
      };
    }

    // ================= TINGKAT SULIT =================
    case 'algebra': {
      const x = randInt(2, 6, rng);
      const y = -randInt(2, 5, rng);
      const k1 = randInt(2, 4, rng);
      const k2 = randInt(2, 5, rng);
      const ans = k1 * x * x + k2 * y;
      const wrong = k1 * x * x - k2 * y;
      return {
        prompt: `JIKA x = ${x} DAN y = ${y}, NILAI DARI ${k1}x² + ${k2}y ADALAH...`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 6 : wrong),
        explanation: `${k1}(${x})² + ${k2}(${y}) = ${k1 * x * x} + (${k2 * y}) = ${ans}`,
        signature: `alg:${k1}x2+${k2}y_x${x}_y${y}`,
      };
    }

    case 'linear_equations': {
      const x = randInt(3, 14, rng);
      const a = randInt(4, 8, rng);
      const b = randInt(1, a - 1, rng);
      const c = randInt(3, 15, rng);
      // a*x - c = b*x + d  => d = (a - b)*x - c
      const d = (a - b) * x - c;
      const dSign = d >= 0 ? `+ ${d}` : `− ${Math.abs(d)}`;
      const wrong = x + (rng() < 0.5 ? 2 : -2);
      return {
        prompt: `TENTUKAN NILAI x DARI PERSAMAAN: ${a}x − ${c} = ${b}x ${dSign}`,
        correctAnswer: `x = ${x}`,
        wrongAnswer: `x = ${wrong === x ? x + 3 : wrong}`,
        explanation: `(${a} − ${b})x = ${d} + ${c} ⇒ ${a - b}x = ${d + c} ⇒ x = ${x}`,
        signature: `lineq:${a}x-${c}=${b}x+${d}`,
      };
    }

    case 'math_equations': {
      const x = randInt(3, 15, rng);
      const m = randInt(2, 5, rng);
      const k = randInt(2, 10, rng);
      const div = randInt(2, 4, rng);
      const rhs = m * x + k;
      // (m*x + k) / div = rhs / div -> ensure divisible
      const adjK = rhs % div === 0 ? k : k + (div - (rhs % div));
      const finalRhs = (m * x + adjK) / div;
      const wrong = x + (rng() < 0.5 ? 3 : -2);
      return {
        prompt: `JIKA (${m}x + ${adjK}) ÷ ${div} = ${finalRhs}, MAKA NILAI x ADALAH...`,
        correctAnswer: String(x),
        wrongAnswer: String(wrong === x ? x + 4 : wrong),
        explanation: `${m}x + ${adjK} = ${finalRhs * div} ⇒ ${m}x = ${finalRhs * div - adjK} ⇒ x = ${x}`,
        signature: `meq:(${m}x+${adjK})/${div}=${finalRhs}`,
      };
    }

    case 'powers_advanced': {
      const base = [2, 3, 5][randInt(0, 2, rng)];
      const p1 = randInt(3, 6, rng);
      const p2 = randInt(2, 5, rng);
      const netExp = randInt(2, 4, rng);
      const p3 = p1 + p2 - netExp;
      const ans = Math.pow(base, netExp);
      const wrong = Math.pow(base, netExp + (rng() < 0.5 ? 1 : -1));
      return {
        prompt: `HITUNGLAH NILAI DARI (${base}^${p1} × ${base}^${p2}) ÷ ${base}^${p3}!`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans * base : wrong),
        explanation: `${base}^(${p1} + ${p2} − ${p3}) = ${base}^${netExp} = ${ans}`,
        signature: `pow:${base}^${p1}*${base}^${p2}/${base}^${p3}`,
      };
    }

    case 'roots_advanced': {
      const cubeRoot = randInt(2, 6, rng);
      const cubeVal = cubeRoot * cubeRoot * cubeRoot;
      const sqRoot = randInt(4, 12, rng);
      const sqVal = sqRoot * sqRoot;
      const ans = cubeRoot * sqRoot;
      const wrong = cubeRoot + sqRoot;
      return {
        prompt: `BERAPAKAH HASIL DARI ∛${cubeVal} × √${sqVal}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + 6 : wrong),
        explanation: `∛${cubeVal} = ${cubeRoot} dan √${sqVal} = ${sqRoot}, maka ${cubeRoot} × ${sqRoot} = ${ans}`,
        signature: `rootadv:cbrt(${cubeVal})*sqrt(${sqVal})`,
      };
    }

    case 'math_logic':
    default: {
      const start = randInt(2, 9, rng);
      const diffBase = randInt(2, 5, rng);
      // Sequence where difference increases by diffBase each step: a1, a2, a3, a4, a5?
      const seq = [start];
      for (let i = 1; i <= 4; i++) {
        seq.push(seq[i - 1] + diffBase * i);
      }
      const ans = seq[4];
      const wrong = seq[3] + diffBase * 3;
      return {
        prompt: `TEMUKAN ANGKA BERIKUTNYA PADA POLA: ${seq[0]}, ${seq[1]}, ${seq[2]}, ${seq[3]}, ...`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans + diffBase : wrong),
        explanation: `Selisih bertambah +${diffBase}, +${diffBase * 2}, +${diffBase * 3}, +${diffBase * 4} ⇒ ${seq[3]} + ${diffBase * 4} = ${ans}`,
        signature: `logic:${seq.slice(0, 4).join(',')}`,
      };
    }
  }
}

export function getCategoriesForDifficulty(
  difficulty: DifficultyLevel,
  selectedCategories?: MathCategoryId[]
): MathCategoryId[] {
  const validSelected = (selectedCategories ?? []).filter((id) =>
    MATH_CATEGORIES.some((c) => c.id === id)
  );
  if (validSelected.length > 0) {
    return validSelected;
  }
  return MATH_CATEGORIES.filter((c) => c.difficulty === difficulty).map((c) => c.id);
}

/**
 * Generates a unique, mathematically verified 2-choice (A / B) math question.
 * Guarantees:
 * - Strictly 2 choices: A and B
 * - Randomized correct option ('A' or 'B')
 * - Options A and B are never identical
 * - Avoids repeating previously seen signatures in the same session
 */
export function generateMathQuestion(options: {
  difficulty: DifficultyLevel;
  categories?: MathCategoryId[];
  questionNumber?: number;
  usedSignatures?: Set<string>;
  rng?: () => number;
}): MathQuestion {
  const rng = options.rng ?? Math.random;
  const pool = getCategoriesForDifficulty(options.difficulty, options.categories);
  const usedSignatures = options.usedSignatures ?? new Set<string>();
  const questionNumber = options.questionNumber ?? usedSignatures.size + 1;

  let raw: RawQuestionTemplate | null = null;
  let chosenCategory: MathCategoryId = pool[0] ?? 'addition';

  for (let attempt = 0; attempt < 40; attempt++) {
    chosenCategory = pool[Math.floor(rng() * pool.length)] ?? 'addition';
    const candidate = buildCategoryQuestion(chosenCategory, rng);
    if (!usedSignatures.has(candidate.signature)) {
      raw = candidate;
      usedSignatures.add(candidate.signature);
      break;
    }
    raw = candidate;
  }

  if (!raw) {
    raw = buildCategoryQuestion(chosenCategory, rng);
  }

  // Ensure wrongAnswer never equals correctAnswer
  const correctStr = String(raw.correctAnswer).trim();
  let wrongStr = String(raw.wrongAnswer).trim();
  if (wrongStr === correctStr) {
    wrongStr = `${correctStr}0`;
  }

  // Randomize whether A or B holds the correct answer
  const correctIsA = rng() < 0.5;
  const correctOption: 'A' | 'B' = correctIsA ? 'A' : 'B';
  const catInfo = MATH_CATEGORIES.find((c) => c.id === chosenCategory);

  return {
    id: `q-${Date.now()}-${Math.floor(rng() * 100000)}`,
    questionNumber,
    category: chosenCategory,
    categoryName: catInfo?.name ?? 'Matematika',
    difficulty: catInfo?.difficulty ?? options.difficulty,
    prompt: raw.prompt,
    options: {
      A: correctIsA ? correctStr : wrongStr,
      B: correctIsA ? wrongStr : correctStr,
    },
    correctOption,
    explanation: raw.explanation,
    signature: raw.signature,
  };
}

export function sanitizeCustomQuestions(raw: unknown): CustomQuestionItem[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: CustomQuestionItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length && cleaned.length < 50; i++) {
    const item = raw[i] as Partial<CustomQuestionItem> | null | undefined;
    if (!item || typeof item !== 'object') continue;

    const prompt = String(item.prompt ?? '').trim().slice(0, 240);
    const optionA = String(item.optionA ?? '').trim().slice(0, 100);
    const optionB = String(item.optionB ?? '').trim().slice(0, 100);
    if (!prompt || !optionA || !optionB) continue;
    if (optionA.toLowerCase() === optionB.toLowerCase()) continue;

    const correctOption: 'A' | 'B' = item.correctOption === 'B' ? 'B' : 'A';
    const explanation = String(item.explanation ?? '').trim().slice(0, 240);
    let id = String(item.id ?? `cq-${i + 1}`).trim().slice(0, 48);
    if (!id || seenIds.has(id)) {
      id = `cq-${i + 1}-${cleaned.length + 1}`;
    }
    seenIds.add(id);

    cleaned.push({
      id,
      prompt,
      optionA,
      optionB,
      correctOption,
      ...(explanation ? { explanation } : {}),
    });
  }

  return cleaned;
}

function buildQuestionFromCustomItem(
  item: CustomQuestionItem,
  difficulty: DifficultyLevel,
  questionNumber: number,
  rng: () => number
): MathQuestion {
  const correctValue = item.correctOption === 'A' ? item.optionA : item.optionB;
  const fallbackExplanation = `Jawaban yang benar adalah ${item.correctOption}: ${correctValue}`;
  return {
    id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
    questionNumber,
    category: 'custom',
    categoryName: 'Soal Buatan Guru',
    difficulty,
    prompt: item.prompt,
    options: {
      A: item.optionA,
      B: item.optionB,
    },
    correctOption: item.correctOption,
    explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
    signature: `custom:${item.id}`,
  };
}

/**
 * Picks the next question for a key touch based on the room's questionSource:
 * - 'auto': generated math questions only
 * - 'custom_only': teacher-authored questions (cycles cleanly if > customQuestions.length keys)
 * - 'mixed': alternates / mixes teacher-authored questions with generated math questions
 */
export function pickQuestionForRoom(options: {
  difficulty: DifficultyLevel;
  categories?: MathCategoryId[];
  questionSource?: QuestionSourceMode;
  customQuestions?: CustomQuestionItem[];
  questionNumber?: number;
  usedSignatures?: Set<string>;
  rng?: () => number;
}): MathQuestion {
  const rng = options.rng ?? Math.random;
  const usedSignatures = options.usedSignatures ?? new Set<string>();
  const questionNumber = options.questionNumber ?? usedSignatures.size + 1;
  const source: QuestionSourceMode = options.questionSource ?? 'auto';
  const customList = sanitizeCustomQuestions(options.customQuestions ?? []);

  if (customList.length > 0 && (source === 'custom_only' || source === 'mixed')) {
    const unseenCustom = customList.filter((cq) => !usedSignatures.has(`custom:${cq.id}`));
    const shouldPickCustom =
      source === 'custom_only' ||
      (unseenCustom.length > 0 && (questionNumber % 2 === 1 || rng() < 0.5)) ||
      rng() < 0.45;

    if (shouldPickCustom) {
      const pool = unseenCustom.length > 0 ? unseenCustom : customList;
      const chosen = pool[Math.floor(rng() * pool.length)] ?? customList[0];
      usedSignatures.add(`custom:${chosen.id}`);
      return buildQuestionFromCustomItem(chosen, options.difficulty, questionNumber, rng);
    }
  }

  return generateMathQuestion({
    difficulty: options.difficulty,
    categories: options.categories,
    questionNumber,
    usedSignatures,
    rng,
  });
}

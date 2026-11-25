import {
  AnswerOptionKey,
  CustomQuestionItem,
  DifficultyLevel,
  MATH_CATEGORIES,
  MathCategoryId,
  QuestionSourceMode,
  QuizChoiceCount,
} from './constants';

export interface MathQuestionOptions {
  A: string;
  B: string;
  C?: string;
  D?: string;
}

export interface MathQuestion {
  id: string;
  questionNumber: number;
  category: MathCategoryId | 'custom';
  categoryName: string;
  difficulty: DifficultyLevel;
  prompt: string;
  choiceCount: QuizChoiceCount;
  options: MathQuestionOptions;
  correctOption: AnswerOptionKey;
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
  choiceCount: QuizChoiceCount;
  options: MathQuestionOptions;
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
  const variant = randInt(0, 2, rng);

  switch (category) {
    // ================= TINGKAT MUDAH =================
    case 'addition': {
      if (variant === 0) {
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
      if (variant === 1) {
        const a = randInt(25, 120, rng);
        const b = randInt(15, 85, rng);
        const c = randInt(10, 50, rng);
        const ans = a + b + c;
        const wrong = ans + (rng() < 0.5 ? 10 : -10);
        return {
          prompt: `HITUNGLAH PENJUMLAHAN BERUNTUN: ${a} + ${b} + ${c} = ?`,
          correctAnswer: String(ans),
          wrongAnswer: String(wrong === ans ? ans + 8 : wrong),
          explanation: `${a} + ${b} = ${a + b}, lalu ${a + b} + ${c} = ${ans}`,
          signature: `add3:${a}+${b}+${c}`,
        };
      }
      const k1 = randInt(35, 95, rng);
      const k2 = randInt(25, 75, rng);
      const ans = k1 + k2;
      return {
        prompt: `TIM MERAH MENGUMPULKAN ${k1} POIN DAN TIM BIRU ${k2} POIN. BERAPA TOTAL POIN KEDUA TIM?`,
        correctAnswer: `${ans} poin`,
        wrongAnswer: `${ans + (rng() < 0.5 ? 10 : -8)} poin`,
        explanation: `Total poin = ${k1} + ${k2} = ${ans} poin`,
        signature: `addword:${k1}+${k2}`,
      };
    }

    case 'subtraction': {
      if (variant === 0) {
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
      if (variant === 1) {
        const total = randInt(120, 260, rng);
        const used = randInt(45, 110, rng);
        const ans = total - used;
        return {
          prompt: `DARI ${total} KUNCI DI BENTENG, ${used} KUNCI TELAH DITEMUKAN. BERAPA KUNCI YANG TERSISA?`,
          correctAnswer: `${ans} kunci`,
          wrongAnswer: `${ans + (rng() < 0.5 ? 10 : -10)} kunci`,
          explanation: `Sisa kunci = ${total} − ${used} = ${ans} kunci`,
          signature: `subword:${total}-${used}`,
        };
      }
      const target = randInt(60, 150, rng);
      const known = randInt(18, target - 12, rng);
      const ans = target - known;
      return {
        prompt: `JIKA ${known} + n = ${target}, MAKA NILAI n ADALAH...`,
        correctAnswer: String(ans),
        wrongAnswer: String(ans + (rng() < 0.5 ? 8 : -6)),
        explanation: `n = ${target} − ${known} = ${ans}`,
        signature: `submiss:${target}-${known}`,
      };
    }

    case 'multiplication': {
      if (variant === 0) {
        const a = randInt(4, 25, rng);
        const b = randInt(3, 12, rng);
        const ans = a * b;
        const wrongOffset = (rng() < 0.5 ? 1 : -1) * (rng() < 0.5 ? a : b);
        const wrong =
          ans + wrongOffset <= 0 || ans + wrongOffset === ans ? ans + 10 : ans + wrongOffset;
        return {
          prompt: `BERAPAKAH HASIL DARI ${a} × ${b}?`,
          correctAnswer: String(ans),
          wrongAnswer: String(wrong),
          explanation: `${a} × ${b} = ${ans}`,
          signature: `mul:${a}x${b}`,
        };
      }
      if (variant === 1) {
        const p = randInt(8, 22, rng);
        const l = randInt(5, 14, rng);
        const ans = p * l;
        const perimTrap = 2 * (p + l);
        return {
          prompt: `RUANG LABIRIN BERUKURAN PANJANG ${p} M DAN LEBAR ${l} M. BERAPAKAH LUASNYA?`,
          correctAnswer: `${ans} m²`,
          wrongAnswer: `${perimTrap === ans ? ans + 12 : perimTrap} m²`,
          explanation: `Luas persegi panjang = ${p} × ${l} = ${ans} m²`,
          signature: `mularea:${p}x${l}`,
        };
      }
      const boxes = randInt(6, 15, rng);
      const each = randInt(8, 16, rng);
      const ans = boxes * each;
      return {
        prompt: `SETIAP PETI BERISI ${each} KOIN EMAS. BERAPA KOIN EMAS DALAM ${boxes} PETI?`,
        correctAnswer: `${ans} koin`,
        wrongAnswer: `${ans + each} koin`,
        explanation: `${boxes} × ${each} = ${ans} koin emas`,
        signature: `mulchest:${boxes}x${each}`,
      };
    }

    case 'division': {
      if (variant === 0) {
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
      const teams = randInt(4, 9, rng);
      const perTeam = randInt(6, 18, rng);
      const total = teams * perTeam;
      return {
        prompt: `SEBANYAK ${total} POIN DIBAGI RATA KEPADA ${teams} ANGGOTA TIM. BERAPA POIN PER ANGGOTA?`,
        correctAnswer: `${perTeam} poin`,
        wrongAnswer: `${perTeam + (rng() < 0.5 ? 2 : -2)} poin`,
        explanation: `${total} ÷ ${teams} = ${perTeam} poin`,
        signature: `divteam:${total}/${teams}`,
      };
    }

    case 'basic_ops': {
      if (variant === 0) {
        const a = randInt(10, 35, rng);
        const b = randInt(3, 9, rng);
        const c = randInt(2, 6, rng);
        const ans = a + b * c;
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
      const b = randInt(4, 9, rng);
      const c = randInt(3, 7, rng);
      const a = b * c + randInt(12, 45, rng);
      const ans = a - b * c;
      const trap = (a - b) * c;
      return {
        prompt: `HITUNGLAH DENGAN PRIORITAS OPERASI: ${a} − ${b} × ${c} = ?`,
        correctAnswer: String(ans),
        wrongAnswer: String(trap === ans ? ans + 10 : trap),
        explanation: `Perkalian didahulukan: ${b} × ${c} = ${b * c}, maka ${a} − ${b * c} = ${ans}`,
        signature: `basicsub:${a}-${b}*${c}`,
      };
    }

    // ================= TINGKAT SEDANG =================
    case 'fractions': {
      if (variant === 0) {
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
      const pairs: Array<[number, number, number, number]> = [
        [1, 2, 1, 4],
        [1, 3, 1, 6],
        [2, 3, 1, 6],
        [3, 4, 1, 8],
        [2, 5, 3, 10],
      ];
      const [a, b, c, d] = pairs[randInt(0, pairs.length - 1, rng)];
      const num = a * d + c * b;
      const den = b * d;
      const g = gcd(num, den);
      const sNum = num / g;
      const sDen = den / g;
      const correctStr = sDen === 1 ? `${sNum}` : `${sNum}/${sDen}`;
      const wrongStr = `${a + c}/${b + d}`;
      return {
        prompt: `BERAPAKAH HASIL PENJUMLAHAN PECAHAN BERBEDA PENYEBUT: ${a}/${b} + ${c}/${d}?`,
        correctAnswer: correctStr,
        wrongAnswer: wrongStr === correctStr ? `${sNum + 1}/${sDen}` : wrongStr,
        explanation: `Samakan penyebut: ${a}/${b} + ${c}/${d} = ${correctStr}`,
        signature: `fracdiff:${a}/${b}+${c}/${d}`,
      };
    }

    case 'percentages': {
      if (variant === 0) {
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
      const price = [80000, 100000, 120000, 150000, 200000][randInt(0, 4, rng)];
      const disc = [10, 20, 25, 30][randInt(0, 3, rng)];
      const cut = (price * disc) / 100;
      const finalPrice = price - cut;
      return {
        prompt: `HARGA BUKU RP${price.toLocaleString('id-ID')} DISKON ${disc}%. BERAPA HARGA SETELAH DISKON?`,
        correctAnswer: `Rp${finalPrice.toLocaleString('id-ID')}`,
        wrongAnswer: `Rp${(price - cut / 2).toLocaleString('id-ID')}`,
        explanation: `Potongan ${disc}% = Rp${cut.toLocaleString('id-ID')}, harga bayar = Rp${finalPrice.toLocaleString('id-ID')}`,
        signature: `pctdisc:${price}_${disc}`,
      };
    }

    case 'negative_numbers': {
      if (variant === 0) {
        const a = -randInt(8, 35, rng);
        const b = randInt(12, 40, rng);
        const c = -randInt(3, 18, rng);
        const ans = a + b - c;
        const wrong = a + b + c;
        return {
          prompt: `HITUNGLAH HASIL DARI ${a} + ${b} − (${c})!`,
          correctAnswer: String(ans),
          wrongAnswer: String(wrong === ans ? ans - 10 : wrong),
          explanation: `${a} + ${b} − (${c}) = ${a + b} + ${Math.abs(c)} = ${ans}`,
          signature: `neg:${a}+${b}-(${c})`,
        };
      }
      const m1 = -randInt(4, 12, rng);
      const m2 = -randInt(3, 9, rng);
      const sub = randInt(5, 20, rng);
      const ans = m1 * m2 - sub;
      const wrong = -(m1 * m2) - sub;
      return {
        prompt: `BERAPAKAH HASIL DARI (${m1}) × (${m2}) − ${sub}?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong),
        explanation: `Negatif dikali negatif menghasilkan positif: (${m1}) × (${m2}) = ${m1 * m2}, lalu dikurangi ${sub} = ${ans}`,
        signature: `negmul:${m1}*${m2}-${sub}`,
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
      if (variant === 0) {
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
      const a = randInt(6, 14, rng);
      const b = randInt(3, a - 1, rng);
      const ans = a * a - b * b;
      const wrong = (a - b) * (a - b);
      return {
        prompt: `HITUNGLAH SELISIH KUADRAT BERIKUT: ${a}² − ${b}² = ?`,
        correctAnswer: String(ans),
        wrongAnswer: String(wrong === ans ? ans - 10 : wrong),
        explanation: `${a}² = ${a * a} dan ${b}² = ${b * b}, maka ${a * a} − ${b * b} = ${ans}`,
        signature: `expdiff:${a}^2-${b}^2`,
      };
    }

    case 'square_roots': {
      if (variant === 0) {
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
      const side = randInt(6, 18, rng);
      const area = side * side;
      return {
        prompt: `LUAS SEBUAH RUANG PERSEGI ADALAH ${area} M². BERAPAKAH PANJANG SISINYA?`,
        correctAnswer: `${side} m`,
        wrongAnswer: `${side + 2} m`,
        explanation: `Sisi persegi = √${area} = ${side} m`,
        signature: `sqrtarea:${area}`,
      };
    }

    // ================= TINGKAT SULIT =================
    case 'algebra': {
      if (variant === 0) {
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
      const c1 = randInt(3, 7, rng);
      const c2 = randInt(2, 5, rng);
      const k = randInt(2, 6, rng);
      const netX = c1 - c2;
      const constTerm = c1 * k;
      return {
        prompt: `SEDERHANAKAN BENTUK ALJABAR: ${c1}(x + ${k}) − ${c2}x!`,
        correctAnswer: `${netX === 1 ? '' : netX}x + ${constTerm}`,
        wrongAnswer: `${netX === 1 ? '' : netX}x + ${k}`,
        explanation: `${c1}x + ${constTerm} − ${c2}x = ${netX === 1 ? '' : netX}x + ${constTerm}`,
        signature: `algsimp:${c1}(x+${k})-${c2}x`,
      };
    }

    case 'linear_equations': {
      const x = randInt(3, 14, rng);
      const a = randInt(4, 8, rng);
      const b = randInt(1, a - 1, rng);
      const c = randInt(3, 15, rng);
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
      if (variant === 0) {
        const start = randInt(2, 9, rng);
        const diffBase = randInt(2, 5, rng);
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
      const a1 = randInt(3, 8, rng);
      const b = randInt(3, 6, rng);
      const n = randInt(7, 12, rng);
      const un = a1 + (n - 1) * b;
      return {
        prompt: `SUKU KE-${n} DARI BARISAN ARITMETIKA: ${a1}, ${a1 + b}, ${a1 + 2 * b}, ${a1 + 3 * b}, ... ADALAH...`,
        correctAnswer: String(un),
        wrongAnswer: String(un + b),
        explanation: `Un = a + (n − 1)b = ${a1} + (${n} − 1)×${b} = ${un}`,
        signature: `logic_arith:${a1}_${b}_n${n}`,
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

const ALL_OPTION_KEYS: AnswerOptionKey[] = ['A', 'B', 'C', 'D'];

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Generates format-matched, mathematically plausible distractors for a given answer string.
 * Returns null if the answer is non-mathematical plain text and extra distractors cannot be
 * synthesized cleanly without inventing fake text.
 */
function synthesizePlausibleDistractors(
  correctStr: string,
  existingWrong: string[],
  neededCount: number,
  rng: () => number
): string[] | null {
  const seen = new Set<string>([correctStr.toLowerCase()]);
  const result: string[] = [];

  const tryAdd = (candidate: string) => {
    const clean = candidate.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  for (const w of existingWrong) {
    tryAdd(w);
    if (result.length >= neededCount) return result.slice(0, neededCount);
  }

  // 1. Indonesian Rupiah currency: Rp150.000
  const rupiahMatch = correctStr.match(/^Rp\s*([\d.]+)$/i);
  if (rupiahMatch) {
    const val = Number(rupiahMatch[1].replace(/\./g, ''));
    if (Number.isFinite(val)) {
      const step = val >= 100000 ? 10000 : val >= 20000 ? 5000 : 2000;
      const offsets = shuffleWithRng([-3, -2, -1, 1, 2, 3, 4], rng);
      for (const off of offsets) {
        const candidateVal = val + off * step;
        if (candidateVal > 0) {
          tryAdd(`Rp${candidateVal.toLocaleString('id-ID')}`);
        }
        if (result.length >= neededCount) return result.slice(0, neededCount);
      }
    }
  }

  // 2. Fraction: e.g. 3/4, -5/6, 17/12
  const fracMatch = correctStr.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      const candidates = shuffleWithRng(
        [
          `${num + 1}/${den}`,
          `${num > 1 ? num - 1 : num + 2}/${den}`,
          `${num}/${den + 1}`,
          `${num}/${den + 2}`,
          `${num + 2}/${den}`,
          `${num + 1}/${den + 1}`,
          `${num + 3}/${den + 2}`,
        ],
        rng
      );
      for (const c of candidates) {
        tryAdd(c);
        if (result.length >= neededCount) return result.slice(0, neededCount);
      }
    }
  }

  // 3. Linear equation result: e.g. x = 7, y = -3
  const eqMatch = correctStr.match(/^([a-zA-Z])\s*=\s*(-?\d+)$/);
  if (eqMatch) {
    const variable = eqMatch[1];
    const val = Number(eqMatch[2]);
    const deltas = shuffleWithRng([-4, -3, -2, -1, 1, 2, 3, 4, 5], rng);
    for (const d of deltas) {
      tryAdd(`${variable} = ${val + d}`);
      if (result.length >= neededCount) return result.slice(0, neededCount);
    }
  }

  // 4. Algebraic linear expression: e.g. 3x + 12 or x + 6 or 2x - 5
  const algMatch = correctStr.match(/^(-?\d*)([a-zA-Z])\s*([+−-])\s*(\d+)$/);
  if (algMatch) {
    const coeffStr = algMatch[1];
    const coeff = coeffStr === '' ? 1 : coeffStr === '-' ? -1 : Number(coeffStr);
    const variable = algMatch[2];
    const sign = algMatch[3];
    const constVal = Number(algMatch[4]);
    const fmtCoeff = (c: number) => (c === 1 ? '' : c === -1 ? '-' : String(c));
    const altSign = sign === '+' ? '−' : '+';
    const candidates = shuffleWithRng(
      [
        `${fmtCoeff(coeff)}${variable} ${sign} ${Math.max(1, constVal + 2)}`,
        `${fmtCoeff(coeff)}${variable} ${sign} ${Math.max(1, constVal - 2)}`,
        `${fmtCoeff(coeff + 1)}${variable} ${sign} ${constVal}`,
        `${fmtCoeff(Math.max(1, coeff - 1))}${variable} ${sign} ${constVal}`,
        `${fmtCoeff(coeff)}${variable} ${altSign} ${constVal}`,
        `${fmtCoeff(coeff + 2)}${variable} ${sign} ${constVal + 1}`,
      ],
      rng
    );
    for (const c of candidates) {
      tryAdd(c);
      if (result.length >= neededCount) return result.slice(0, neededCount);
    }
  }

  // 5. Pure integer or integer with unit/suffix (e.g. "42", "-15", "81 cm²", "44 m", "120 poin", "8 C")
  const numWithUnitMatch = correctStr.match(/^(-?\d+(?:[.,]\d+)?)(\s*.*)$/);
  if (numWithUnitMatch) {
    const rawNum = numWithUnitMatch[1].replace(',', '.');
    const suffix = numWithUnitMatch[2] ?? '';
    const isDecimal = rawNum.includes('.');
    const val = Number(rawNum);
    if (Number.isFinite(val)) {
      const absVal = Math.abs(val);
      const allowNegative = val < 0;
      const smallDeltas = isDecimal
        ? [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]
        : absVal <= 20
        ? [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6]
        : absVal <= 120
        ? [-12, -10, -8, -5, -4, -2, 2, 4, 5, 8, 10, 12]
        : [-25, -20, -15, -10, -5, 5, 10, 15, 20, 25];

      const pool: number[] = [];
      if (val < 0) {
        pool.push(-val); // classic sign-error trap
      }
      for (const d of shuffleWithRng(smallDeltas, rng)) {
        const next = isDecimal ? Number((val + d).toFixed(2)) : Math.round(val + d);
        if (!allowNegative && next <= 0) continue;
        pool.push(next);
      }

      for (const candidateNum of pool) {
        const formatted = isDecimal
          ? String(candidateNum).replace('.', numWithUnitMatch[1].includes(',') ? ',' : '.')
          : String(candidateNum);
        tryAdd(`${formatted}${suffix}`);
        if (result.length >= neededCount) return result.slice(0, neededCount);
      }

      // Guaranteed positive fallback offsets
      let step = 1;
      while (result.length < neededCount && step < 40) {
        tryAdd(`${Math.round(val + step)}${suffix}`);
        step++;
      }
      if (result.length >= neededCount) return result.slice(0, neededCount);
    }
  }

  return null;
}

function buildOptionsFromChoices(
  correctStr: string,
  distractors: string[],
  choiceCount: QuizChoiceCount,
  rng: () => number
): { options: MathQuestionOptions; correctOption: AnswerOptionKey; actualChoiceCount: QuizChoiceCount } {
  const uniqueDistractors = distractors.filter(
    (d, idx, arr) =>
      d.trim().length > 0 &&
      d.toLowerCase() !== correctStr.toLowerCase() &&
      arr.findIndex((x) => x.toLowerCase() === d.toLowerCase()) === idx
  );

  const effectiveCount: QuizChoiceCount =
    choiceCount === 4 && uniqueDistractors.length >= 3 ? 4 : 2;
  const chosenPool = [correctStr, ...uniqueDistractors.slice(0, effectiveCount - 1)];
  const shuffled = shuffleWithRng(chosenPool, rng);

  const options: MathQuestionOptions = {
    A: shuffled[0],
    B: shuffled[1],
    ...(effectiveCount === 4 ? { C: shuffled[2], D: shuffled[3] } : {}),
  };

  const correctIdx = shuffled.findIndex((s) => s === correctStr);
  const correctOption: AnswerOptionKey = ALL_OPTION_KEYS[Math.max(0, correctIdx)] ?? 'A';

  return { options, correctOption, actualChoiceCount: effectiveCount };
}

/**
 * Generates a unique, mathematically verified 2-choice (A/B) or 4-choice (A/B/C/D) math question.
 * Guarantees:
 * - Strictly 2 choices (A, B) or 4 choices (A, B, C, D) based on choiceCount
 * - Randomized correct option across active choices
 * - All answer options are strictly distinct
 * - Avoids repeating previously seen signatures in the same session
 */
export function generateMathQuestion(options: {
  difficulty: DifficultyLevel;
  categories?: MathCategoryId[];
  choiceCount?: QuizChoiceCount;
  questionNumber?: number;
  usedSignatures?: Set<string>;
  rng?: () => number;
}): MathQuestion {
  const rng = options.rng ?? Math.random;
  const pool = getCategoriesForDifficulty(options.difficulty, options.categories);
  const usedSignatures = options.usedSignatures ?? new Set<string>();
  const questionNumber = options.questionNumber ?? usedSignatures.size + 1;
  const targetChoiceCount: QuizChoiceCount = options.choiceCount === 4 ? 4 : 2;

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
  if (wrongStr.toLowerCase() === correctStr.toLowerCase()) {
    wrongStr = `${correctStr}0`;
  }

  let distractors: string[] = [wrongStr];
  if (targetChoiceCount === 4) {
    const generated = synthesizePlausibleDistractors(correctStr, [wrongStr], 3, rng);
    if (generated && generated.length >= 3) {
      distractors = generated;
    }
  }

  const { options: builtOptions, correctOption, actualChoiceCount } = buildOptionsFromChoices(
    correctStr,
    distractors,
    targetChoiceCount,
    rng
  );
  const catInfo = MATH_CATEGORIES.find((c) => c.id === chosenCategory);

  return {
    id: `q-${Date.now()}-${Math.floor(rng() * 100000)}`,
    questionNumber,
    category: chosenCategory,
    categoryName: catInfo?.name ?? 'Matematika',
    difficulty: catInfo?.difficulty ?? options.difficulty,
    prompt: raw.prompt,
    choiceCount: actualChoiceCount,
    options: builtOptions,
    correctOption,
    explanation: raw.explanation,
    signature: raw.signature,
  };
}

export function sanitizeCustomQuestions(raw: unknown): CustomQuestionItem[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: CustomQuestionItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length && cleaned.length < 100; i++) {
    const item = raw[i] as Partial<CustomQuestionItem> | null | undefined;
    if (!item || typeof item !== 'object') continue;

    const prompt = String(item.prompt ?? '').trim().slice(0, 240);
    const optionA = String(item.optionA ?? '').trim().slice(0, 100);
    const optionB = String(item.optionB ?? '').trim().slice(0, 100);
    const rawC = String(item.optionC ?? '').trim().slice(0, 100);
    const rawD = String(item.optionD ?? '').trim().slice(0, 100);
    if (!prompt || !optionA || !optionB) continue;
    if (optionA.toLowerCase() === optionB.toLowerCase()) continue;

    const hasValidFour =
      rawC.length > 0 &&
      rawD.length > 0 &&
      new Set([optionA, optionB, rawC, rawD].map((s) => s.toLowerCase())).size === 4;

    const rawCorrect = String(item.correctOption ?? 'A').trim().toUpperCase();
    let correctOption: AnswerOptionKey = 'A';
    if (hasValidFour && (rawCorrect === 'A' || rawCorrect === 'B' || rawCorrect === 'C' || rawCorrect === 'D')) {
      correctOption = rawCorrect;
    } else if (rawCorrect === 'B') {
      correctOption = 'B';
    } else {
      correctOption = 'A';
    }

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
      ...(hasValidFour ? { optionC: rawC, optionD: rawD } : {}),
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
  choiceCount: QuizChoiceCount,
  rng: () => number
): MathQuestion {
  const hasAuthoredFour = Boolean(item.optionC && item.optionD);
  const authoredMap: Record<AnswerOptionKey, string | undefined> = {
    A: item.optionA,
    B: item.optionB,
    C: item.optionC,
    D: item.optionD,
  };
  const correctValue = authoredMap[item.correctOption] ?? item.optionA;

  // Case 1: 4-choice room and teacher authored all 4 choices -> preserve exact A/B/C/D mapping
  if (choiceCount === 4 && hasAuthoredFour && item.optionC && item.optionD) {
    const fallbackExplanation = `Jawaban yang benar adalah ${item.correctOption}: ${correctValue}`;
    return {
      id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
      questionNumber,
      category: 'custom',
      categoryName: 'Soal Buatan Guru',
      difficulty,
      prompt: item.prompt,
      choiceCount: 4,
      options: {
        A: item.optionA,
        B: item.optionB,
        C: item.optionC,
        D: item.optionD,
      },
      correctOption: item.correctOption,
      explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
      signature: `custom:${item.id}`,
    };
  }

  // Case 2: 2-choice room and teacher authored 2 choices -> preserve exact A/B mapping
  if (choiceCount === 2 && !hasAuthoredFour) {
    const safeCorrect: 'A' | 'B' = item.correctOption === 'B' ? 'B' : 'A';
    const fallbackExplanation = `Jawaban yang benar adalah ${safeCorrect}: ${correctValue}`;
    return {
      id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
      questionNumber,
      category: 'custom',
      categoryName: 'Soal Buatan Guru',
      difficulty,
      prompt: item.prompt,
      choiceCount: 2,
      options: {
        A: item.optionA,
        B: item.optionB,
      },
      correctOption: safeCorrect,
      explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
      signature: `custom:${item.id}`,
    };
  }

  // Case 3: 2-choice room with 4-choice custom question -> keep correct + 1 teacher distractor
  if (choiceCount === 2 && hasAuthoredFour) {
    const wrongs = ALL_OPTION_KEYS.filter((k) => k !== item.correctOption)
      .map((k) => authoredMap[k])
      .filter((v): v is string => Boolean(v));
    const pickedWrong = wrongs[Math.floor(rng() * wrongs.length)] ?? item.optionB;
    const { options, correctOption } = buildOptionsFromChoices(
      correctValue,
      [pickedWrong],
      2,
      rng
    );
    const fallbackExplanation = `Jawaban yang benar adalah ${correctOption}: ${correctValue}`;
    return {
      id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
      questionNumber,
      category: 'custom',
      categoryName: 'Soal Buatan Guru',
      difficulty,
      prompt: item.prompt,
      choiceCount: 2,
      options,
      correctOption,
      explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
      signature: `custom:${item.id}`,
    };
  }

  // Case 4: 4-choice room with 2-choice custom/preset question -> synthesize 2 plausible math distractors if numeric/math
  const primaryWrong = item.correctOption === 'A' ? item.optionB : item.optionA;
  const synthesized = synthesizePlausibleDistractors(correctValue, [primaryWrong], 3, rng);
  if (synthesized && synthesized.length >= 3) {
    const { options, correctOption, actualChoiceCount } = buildOptionsFromChoices(
      correctValue,
      synthesized,
      4,
      rng
    );
    const fallbackExplanation = `Jawaban yang benar adalah ${correctOption}: ${correctValue}`;
    return {
      id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
      questionNumber,
      category: 'custom',
      categoryName: 'Soal Buatan Guru',
      difficulty,
      prompt: item.prompt,
      choiceCount: actualChoiceCount,
      options,
      correctOption,
      explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
      signature: `custom:${item.id}`,
    };
  }

  // Non-numeric custom 2-choice question: preserve authentic 2 options cleanly
  const safeCorrect: 'A' | 'B' = item.correctOption === 'B' ? 'B' : 'A';
  const fallbackExplanation = `Jawaban yang benar adalah ${safeCorrect}: ${correctValue}`;
  return {
    id: `q-custom-${item.id}-${Date.now()}-${Math.floor(rng() * 10000)}`,
    questionNumber,
    category: 'custom',
    categoryName: 'Soal Buatan Guru',
    difficulty,
    prompt: item.prompt,
    choiceCount: 2,
    options: {
      A: item.optionA,
      B: item.optionB,
    },
    correctOption: safeCorrect,
    explanation: item.explanation?.trim() ? item.explanation.trim() : fallbackExplanation,
    signature: `custom:${item.id}`,
  };
}

/**
 * Picks the next question for a key touch based on the room's questionSource and choiceCount:
 * - 'auto': generated math questions only
 * - 'custom_only': teacher-authored questions (cycles cleanly if > customQuestions.length keys)
 * - 'mixed': alternates / mixes teacher-authored questions with generated math questions
 */
export function pickQuestionForRoom(options: {
  difficulty: DifficultyLevel;
  categories?: MathCategoryId[];
  choiceCount?: QuizChoiceCount;
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
  const choiceCount: QuizChoiceCount = options.choiceCount === 4 ? 4 : 2;
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
      return buildQuestionFromCustomItem(chosen, options.difficulty, questionNumber, choiceCount, rng);
    }
  }

  return generateMathQuestion({
    difficulty: options.difficulty,
    categories: options.categories,
    choiceCount,
    questionNumber,
    usedSignatures,
    rng,
  });
}

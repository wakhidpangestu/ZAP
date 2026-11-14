/**
 * Zero-Answer Guardrail (ZAP core invariant #2).
 *
 * Semua balasan model wajib melewati `finalizeModelReply()` sebelum dikirim ke
 * klien. Fungsi ini menggabungkan dua lapis:
 *
 *   1. `cleanModelResponse()` — membuang blok penalaran mentah (`<think>`),
 *      monolog perencanaan, dan pembungkus markdown yang bocor dari model
 *      reasoning.
 *   2. `sanitizeZeroAnswer()` — mengganti pernyataan jawaban akhir dengan
 *      pertanyaan Sokrates.
 *
 * Catatan temuan audit 13 Nov 2026: versi lama `sanitizeZeroAnswer()` hanya
 * mencocokkan teks mentah, sehingga jawaban akhir yang ditulis dalam
 * matematika inline/display (`$$x = 4$$`, `$x=4$`, `\\(x=4\\)`) lolos tanpa
 * disaring. Model memang diminta menulis LaTeX, jadi hampir semua jawaban
 * akhir memakai delimiter tersebut — akibatnya Zero-Answer Policy bisa bocor
 * pada balasan yang sukses sekalipun. Perbaikan: normalisasi span matematika
 * lebih dulu (lihat `sanitizeMathSpans`), lalu pola lama tetap dijalankan.
 */

/** Satu pernyataan jawaban jadi: variabel tunggal = konstanta. */
const CONCLUSION_ASSIGNMENT =
  /^\s*([a-zA-Z])(?:\s*_\s*\{?([a-zA-Z0-9]+)\}?)?\s*=\s*([-+−]?\s*(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?|\\frac\s*\{\s*-?\d+(?:[.,]\d+)?\s*\}\s*\{\s*\d+(?:[.,]\d+)?\s*\}|√\s*\d+))\s*$/;

/** Placeholder Sokrates untuk jawaban jadi yang disensor. */
const SOCRATIC_REPLACEMENT = "[Berapakah nilainya menurut hitunganmu?]";

/** Opsi sanitasi: variabel target sesi (mis. "x") untuk pengecekan kontekstual. */
export interface ZeroAnswerOptions {
  targetVariable?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Menyensor bentuk "variabel = angka" yang muncul **di tengah kalimat**.
 *
 * Contoh yang dulu lolos: "coba hitung x = 4 dulu". Pola lama hanya mengenali
 * bentuk ber-delimiter, baris penuh, atau didahului kata kesimpulan.
 *
 * Sengaja dibatasi pada `targetVariable` (mis. "x") dan pada nilai yang SUDAH
 * final (angka/desimal/√), bukan ekspresi seperti `2x = 8`, `x = 8/2`, atau
 * `x = 4 + 2`. Dengan begitu langkah penalaran tetap utuh, sedangkan kunci
 * jawaban tidak bocor.
 */
function redactTargetAssignments(text: string, targetVariable: string): string {
  const variable = targetVariable.trim();
  if (!/^[a-zA-Z]$/.test(variable)) return text;
  const v = escapeRegExp(variable);
  // Prefix dijaga agar tidak menempel pada koefisien (2x) atau mata uang ($x).
  // Suffix dijaga agar pecahan/ekspresi yang belum selesai (`x = 8/2`,
  // `x = 4 + 2`, `x = 2^3`) tidak ikut tersensor setengah jalan.
  const pattern = new RegExp(
    `(^|[^\\w$\\\\])((?:${v})\\s*=\\s*[-+−]?\\s*(?:\\d+(?:[.,]\\d+)?|√\\s*\\d+))(?![\\d\\w/+*^−])`,
    "g"
  );
  return text.replace(pattern, (_match, prefix: string) => `${prefix}${SOCRATIC_REPLACEMENT}`);
}

/**
 * Menyensor span matematika (`$$…$$`, `$…$`, `\\(…\\)`, `\\[…\\]`) yang isinya
 * HANYA sebuah pernyataan jawaban jadi (mis. `x = 4`).
 *
 * Langkah turunan yang masih memuat operasi/koefisien (mis. `2x = 8`,
 * `2x + 6 = 14`) sengaja TIDAK disensor: itu bagian penalaran, bukan kunci
 * jawaban. Yang disensor hanya bentuk "variabel tunggal = konstanta".
 */
export function sanitizeMathSpans(text: string): string {
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) =>
      CONCLUSION_ASSIGNMENT.test(inner) ? SOCRATIC_REPLACEMENT : `$$${inner}$$`
    )
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) =>
      CONCLUSION_ASSIGNMENT.test(inner) ? SOCRATIC_REPLACEMENT : `\\[${inner}\\]`
    )
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) =>
      CONCLUSION_ASSIGNMENT.test(inner) ? SOCRATIC_REPLACEMENT : `\\(${inner}\\)`
    )
    .replace(/\$([^$\n]+?)\$/g, (_m, inner: string) =>
      CONCLUSION_ASSIGNMENT.test(inner) ? SOCRATIC_REPLACEMENT : `$${inner}$`
    );
}

export interface ZeroAnswerPattern {
  regex: RegExp;
  replacement: string;
}

export const ZERO_ANSWER_PATTERNS: ZeroAnswerPattern[] = [
  // 1. Deklarasi kunci / solusi aljabar eksplisit
  {
    regex:
      /(?:jawaban(?:nya)?(?:\s*akhir(?:nya)?)?|solusi(?:nya)?|hasil\s+akhir(?:nya)?|kunci\s+jawaban(?:nya)?)\s*(?:adalah|=|:)\s*(?:[a-zA-Z]\s*=\s*)?[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)/gi,
    replacement: "Bagaimanakah menurut analisismu?",
  },
  {
    regex:
      /(?:maka|jadi|kesimpulannya|sehingga|diperoleh|didapatkan),?\s+(?:nilai\s+)?[a-zA-Z]\s*=\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)/gi,
    replacement: "Coba tentukan nilai variabel tersebut berdasarkan penalaranmu",
  },
  {
    regex:
      /(?:nilai\s+(?:dari\s+|variabel\s+)?[a-zA-Z])\s*(?:adalah|=|:)\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)/gi,
    replacement: "Berapakah nilai yang menurutmu paling tepat?",
  },
  {
    regex:
      /(?:the\s+(?:final\s+)?answer\s+is|therefore\s+[a-zA-Z]\s*=|we\s+get\s+[a-zA-Z]\s*=)\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+)/gi,
    replacement: "What do you think the solution is?",
  },

  // 2. Evaluasi Geometri & Diagonal Jadi
  {
    regex:
      /(?:d(?:[_\s]*(?:bidang|ruang|sisi))?|diagonal(?:[_\s]*(?:bidang|ruang|sisi))?)\s*(?:\\approx|≈|=)\s*(?:[^\n=]*=)?\s*[-+−]?\s*\d+(?:[.,]\d+)?\s*(?:\\text\{\s*(?:cm|m|mm|satuan)\s*\}|cm|m|mm|satuan)?/gi,
    replacement: "diagonal [Berapakah hasil perhitungan yang kamu peroleh?]",
  },

  // 3. Rantai perkalian angka jadi
  {
    regex:
      /\b\d+(?:[.,]\d+)?\s*(?:\\times|\*|×)\s*\d+(?:[.,]\d+)?\s*=\s*[-+−]?\s*\d+(?:[.,]\d+)?\s*(?:\\text\{\s*(?:cm|m|mm|satuan)\s*\}|cm|m|mm|satuan)?/gi,
    replacement: "[Coba hitung hasil perkalian ini secara mandiri]",
  },

  // 4. Perhitungan aritmetika langsung jadi
  {
    regex: /\b(\d+\s*[-+*/−]\s*\d+\s*)=\s*[-+−]?\s*\d+(?:[.,]\d+)?\b/gi,
    replacement: "$1 = [Berapakah hasil hitunganmu?]",
  },

  // 5. Hasil geometri jadi: variabel = angka + satuan luas/volume
  {
    regex:
      /\b[a-zA-Z](?:_\{?[a-zA-Z]+\}?)?\s*(?:=|\\approx|≈)\s*[-+−]?\s*\d+(?:[.,]\d+)?\s*(?:\\text\{\s*(?:cm|m|mm|km|dm)\s*\^\s*[23]\s*\}|(?:cm|m|mm|km|dm)(?:\^?\s*[23]|²|³))/gi,
    replacement: "[Berapakah nilai yang kamu peroleh dari perhitunganmu?]",
  },

  // 6. Variabel hasil geometri (V / L) = angka polos atau angka + satuan panjang
  {
    regex:
      /\b(?:V|L)\s*(?:=|\\approx|≈)\s*[-+−]?\s*\d+(?:[.,]\d+)?\s*(?:\\text\{\s*(?:cm|m|mm|km|dm|satuan)\s*\}|cm|m|mm|km|dm|satuan)?\b(?!\s*[a-zA-Z(])/gi,
    replacement: "[Berapakah nilai yang kamu peroleh dari perhitunganmu?]",
  },

  // 7. Deklarasi verbal: "hasilnya 80.089" / "hasilnya adalah 12"
  {
    regex:
      /(?:hasil(?:nya)?|jawabannya)\s*(?:adalah|:|sama dengan)?\s*[-+−]?\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|m|mm|km|dm|satuan)(?:\^?\s*[23]|²|³)?)?/gi,
    replacement: "hasilnya [Berapakah hasil perhitunganmu?]",
  },

  // 8. Deklarasi verbal variabel: "x sama dengan 2"
  {
    regex: /\b[a-zA-Z]\s+sama\s+dengan\s*[-+−]?\s*(?:\d+(?:[.,]\d+)?|√\d+)/gi,
    replacement: "[variabel tersebut sama dengan berapa menurut hitunganmu?]",
  },

  // 9. Jawaban jadi tebal berdiri sendiri: "**x = 4**"
  {
    regex: /\*\*\s*[a-zA-Z]\s*=\s*[-+−]?\s*(?:\d+(?:[.,]\d+)?|√\d+)\s*\*\*/gi,
    replacement: "**[Berapakah nilainya menurut penalaranmu?]**",
  },

  // 10. Panah implikasi menuju jawaban jadi: "$\implies x = 3$", "→ x = 3"
  {
    regex:
      /\$?\s*(?:\\implies|\\Rightarrow|\\rightarrow|→|⇒)\s*[a-zA-Z]\s*=\s*[-+−]?\s*(?:\d+(?:[.,]\d+)?|√\d+)\s*\$?/gi,
    replacement: " [maka berapakah nilainya menurut hitunganmu?]",
  },

  // 11. Baris kesimpulan polos tanpa delimiter: "x = 4" sebagai satu baris penuh
  {
    regex: /^[ \t]*[a-zA-Z]\s*=\s*[-+−]?\s*(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|√\d+)[ \t]*$/gm,
    replacement: SOCRATIC_REPLACEMENT,
  },
];

/**
 * Menyensor jawaban akhir pada teks balasan model.
 * Urutan: span matematika -> bentuk "variabel target = angka" di tengah kalimat
 * -> pola deklarasi eksplisit.
 */
export function sanitizeZeroAnswer(text: string, options?: ZeroAnswerOptions): string {
  if (!text) return "";
  let result = sanitizeMathSpans(text);
  const targetVariable = options?.targetVariable?.trim();
  if (targetVariable) {
    result = redactTargetAssignments(result, targetVariable);
  }
  for (const item of ZERO_ANSWER_PATTERNS) {
    result = result.replace(item.regex, item.replacement);
  }
  return result;
}

/**
 * Membersihkan artefak penalaran model sebelum disanitasi:
 * blok `<think>`, monolog perencanaan, dan draf ganda.
 */
export function cleanModelResponse(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. Bersihkan tag <think>...</think> dan <thought>...</thought>
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  clean = clean.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

  // 2. Bersihkan monolog perencanaan bahasa Inggris jika bocor dari model reasoning
  const draftSplitters = [
    /\n(?:Halo|Hai|Hello|Hi)\s+[^\n]+!/i,
    /\n\*\*Balok\*\*/i,
    /\n\*\*Kubus\*\*/i,
    /\n###?\s+1\.\s+Volume/i,
    /Let's draft:?\s*\n*/i,
  ];

  for (const splitter of draftSplitters) {
    const match = clean.match(splitter);
    if (match && match.index !== undefined && match.index > 0) {
      const prefix = clean.slice(0, match.index);
      if (
        /providing the formulas|the system instruction|let me structure|so i should|let's write it in/i.test(
          prefix
        )
      ) {
        if (splitter.source.includes("Let's draft")) {
          clean = clean.slice(match.index + match[0].length).trim();
        } else {
          clean = clean.slice(match.index).trim();
        }
        break;
      }
    }
  }

  return clean;
}

/**
 * Satu pintu keluar untuk semua balasan model.
 *
 * @param text     teks mentah dari provider
 * @param fallback teks Sokrates pengganti bila balasan kosong setelah disensor
 * @param options  mis. `targetVariable` sesi ("x") agar bentuk "x = 4" di
 *                 tengah kalimat ikut disensor tanpa merusak langkah lain
 */
export function finalizeModelReply(
  text: string,
  fallback: string,
  options?: ZeroAnswerOptions
): string {
  const cleaned = cleanModelResponse(text || "");
  const guarded = sanitizeZeroAnswer(cleaned, options).trim();
  // Jangan pernah mengirim balasan kosong: klien akan menampilkannya sebagai
  // "tidak ada jawaban". Kalau seluruh balasan tersensor, pakai fallback.
  if (guarded.replace(/[^A-Za-z0-9\u00C0-\u024F]/g, "").length < 8) {
    return fallback;
  }
  return guarded;
}

/**
 * Ekstraksi langkah aljabar dan integrasi deterministik ke Backend SymPy CFL
 * (`POST /api/v1/diagnose`) dari pesan chat bebas.
 *
 * Memastikan alur chat utama tetap berlandaskan Strict Separation of Concerns:
 * SymPy memutuskan validitas langkah dan counter-example terlebih dahulu,
 * baru LLM menyusun bimbingan Sokratiknya.
 */

export interface ActiveProblemContext {
  steps?: string[];
  faultLine?: number;
  misconceptionType?: string;
  explanation?: string;
  socraticHint?: string;
  harnessMemoryContext?: string;
  workspaceMode?: "write" | "read";
  interactionMode?: "standard" | "strict" | "visual" | "cas";
  reasoningEffort?: "low" | "medium" | "high";
  autoLatexEnabled?: boolean;
  counterExample?: {
    test_variable?: string;
    test_value?: number;
    lhs_expected?: string;
    rhs_calculated?: string;
    contradiction_statement?: string;
  };
}

export interface SymPyDiagnoseApiResponse {
  status?: string;
  diagnosis?: {
    has_fault?: boolean;
    first_fault_line?: number | null;
    fault_type?: string | null;
    status?: string;
    human_explanation?: string;
    socratic_prompt?: string;
    counter_example?: ActiveProblemContext["counterExample"] | null;
  };
  guardrail_status?: string;
}

const ALLOWED_MATH_WORDS = new Set([
  "sin",
  "cos",
  "tan",
  "sqrt",
  "log",
  "exp",
  "pi",
  "frac",
  "cdot",
  "times",
  "pm",
]);

const PROMPT_PREFIX_RE =
  /^(?:(?:halo|hai|kak|tolong|bantu|coba|mohon|cek|koreksi|periksa|lihat|apakah(?:\s+benar)?|ini)\s+)*(?:coretan|langkah(?:-langkah)?|jawaban|persamaan|perhitungan|penyelesaian|soal|kerjaan)?(?:\s+saya|\s+ku|\s+aku|\s+berikut|\s+ini)?\s*[:\-]?\s*/i;

const VISUAL_GRAPH_INTENT_RE =
  /\b(tampilkan|buatkan|buatin|gambarkan|gambar|lukis|plot|papan tulis|smartboard|3d|2d|grafik|gelombang|pelana|kubus|balok|tabung|prisma|limas|kerucut|bola)\b/i;

function isAlgebraicEquationSegment(segment: string): boolean {
  const s = segment.trim();
  if (!s || s.length > 200 || !s.includes("=")) return false;
  if (/[_"'`;$]/.test(s)) return false;
  if (!/^[0-9A-Za-z\s+\-*/^().=,{}[\]\\]+$/.test(s)) return false;

  const [lhs, rhs, ...rest] = s.split("=");
  if (rest.length > 0 || !lhs.trim() || !rhs.trim()) return false;

  const words = s.match(/[A-Za-z]+/g) || [];
  if (words.length === 0) return false;
  return words.every((w) => w.length === 1 || ALLOWED_MATH_WORDS.has(w.toLowerCase()));
}

/**
 * Mengambil deret langkah persamaan aljabar (>= 2 langkah) dari pesan chat bebas.
 * Prosa penghubung (seperti "kedua ruas dibagi x") dilewati secara aman.
 */
export function extractAlgebraicStepsFromMessage(message: string): string[] {
  const raw = (message || "").trim();
  if (!raw || raw.length > 1500) return [];
  if (VISUAL_GRAPH_INTENT_RE.test(raw) && !raw.includes("\n") && !/->|=>|→|⇒/.test(raw)) {
    return [];
  }

  const parts = raw
    .split(/(?:\r?\n|->|=>|→|⇒|;)+/)
    .map((p) => p.replace(PROMPT_PREFIX_RE, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const steps: string[] = [];
  for (const part of parts) {
    // Jika satu segmen diawali sedikit teks pengantar sebelum ":"
    const colonIdx = part.indexOf(":");
    const candidate = colonIdx > 0 ? part.slice(colonIdx + 1).trim() : part;
    if (isAlgebraicEquationSegment(candidate)) {
      steps.push(candidate);
    }
  }

  return steps.length >= 2 ? steps.slice(0, 20) : [];
}

/**
 * Menebak variabel utama dari langkah aljabar jika masih default.
 */
export function inferTargetVariable(steps: string[], fallback: string = "x"): string {
  for (const step of steps) {
    const cleaned = step.replace(/\\(?:frac|sqrt|cdot|times|sin|cos|tan|log|exp|pm)\b/g, "");
    const vars = cleaned.match(/\b[a-zA-Z]\b/g);
    if (vars && vars.length > 0) {
      return vars[0];
    }
  }
  return fallback;
}

export interface SymPyBridgeResult {
  steps: string[];
  activeProblemPatch: Partial<ActiveProblemContext>;
  diagnosisSummary: {
    hasFault: boolean;
    faultLine?: number;
    faultType?: string;
    explanation?: string;
    socraticPrompt?: string;
    counterExample?: ActiveProblemContext["counterExample"];
  };
}

/**
 * Memanggil backend SymPy CAS (`/api/v1/diagnose`) untuk memverifikasi
 * langkah aljabar dari pesan chat secara deterministik.
 * Mengembalikan null bila pesan bukan deret aljabar >= 2 langkah atau backend offline.
 */
export async function diagnoseMessageWithSymPy(
  message: string,
  targetVariable: string,
  apiBase: string,
  fetchImpl: typeof fetch = fetch
): Promise<SymPyBridgeResult | null> {
  const steps = extractAlgebraicStepsFromMessage(message);
  if (steps.length < 2) return null;

  const effectiveVar =
    targetVariable && targetVariable !== "x" ? targetVariable : inferTargetVariable(steps, "x");

  try {
    const res = await fetchImpl(`${apiBase}/api/v1/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed_steps: steps,
        target_variable: effectiveVar,
      }),
      signal: AbortSignal.timeout(1800),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as SymPyDiagnoseApiResponse;
    const diag = data?.diagnosis;
    if (!diag) return null;

    const hasFault = Boolean(diag.has_fault);
    const faultLine =
      hasFault && typeof diag.first_fault_line === "number" ? diag.first_fault_line : undefined;
    const faultType = diag.fault_type || undefined;
    const explanation = diag.human_explanation || undefined;
    const socraticPrompt = diag.socratic_prompt || undefined;
    const counterExample = diag.counter_example || undefined;

    return {
      steps,
      activeProblemPatch: {
        steps,
        faultLine,
        misconceptionType: faultType,
        explanation,
        socraticHint: socraticPrompt,
        counterExample,
      },
      diagnosisSummary: {
        hasFault,
        faultLine,
        faultType,
        explanation,
        socraticPrompt,
        counterExample,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Menyusun balasan deterministik langsung dari diagnosis SymPy CAS
 * (dipakai saat pengguna memilih mode model `sympy-cfl`).
 */
export function formatDeterministicSymPyReply(result: SymPyBridgeResult): string {
  const { steps, diagnosisSummary } = result;
  const stepList = steps.map((s, idx) => `${idx + 1}. \`${s}\``).join("\n");

  if (diagnosisSummary.hasFault) {
    const lineInfo = diagnosisSummary.faultLine
      ? `**Baris #${diagnosisSummary.faultLine}**`
      : "salah satu langkah";
    const typeInfo = diagnosisSummary.faultType ? ` (\`${diagnosisSummary.faultType}\`)` : "";
    const counter = diagnosisSummary.counterExample?.contradiction_statement
      ? `\n\n**Kontra-contoh deterministik SymPy:** ${diagnosisSummary.counterExample.contradiction_statement}`
      : "";
    const hint = diagnosisSummary.socraticPrompt
      ? `\n\n**Pertanyaan penuntun:** ${diagnosisSummary.socraticPrompt}`
      : "";

    return `### Hasil Verifikasi Deterministik SymPy CAS\n${stepList}\n\nTerdeteksi ketidaksesuaian aljabar pada ${lineInfo}${typeInfo}.${diagnosisSummary.explanation ? `\n\n${diagnosisSummary.explanation}` : ""}${counter}${hint}`;
  }

  return `### Hasil Verifikasi Deterministik SymPy CAS\n${stepList}\n\nSemua transisi langkah di atas **ekuivalen dan valid secara aljabar** di SymPy CAS.${diagnosisSummary.socraticPrompt ? `\n\n${diagnosisSummary.socraticPrompt}` : " Langkahmu sudah konsisten!"}`;
}

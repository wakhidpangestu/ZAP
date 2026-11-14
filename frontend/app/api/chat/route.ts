import { NextResponse } from "next/server";
import { resolveGeometricIntent, buildResultFromSpec, validateGeometrySpec, looksLikeGeometryRequest, type GeometrySpec } from "@/data/geometry-database";
import { getUserSecurityStatus, recordUserSecurityViolation } from "@/utils/security-vault";
import { cleanModelResponse, finalizeModelReply, sanitizeZeroAnswer } from "@/lib/zero-answer";

interface ActiveProblemContext {
  steps?: string[];
  faultLine?: number;
  misconceptionType?: string;
  explanation?: string;
  socraticHint?: string;
  harnessMemoryContext?: string;
  counterExample?: {
    test_variable?: string;
    test_value?: number;
    lhs_expected?: string;
    rhs_calculated?: string;
    contradiction_statement?: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface CorpusReference {
  id?: string;
  title?: string;
  snippet?: string;
  question?: string;
  socratic_prompt?: string;
  tier?: string;
  subtopic?: string;
  source?: string;
}

function normalizeCorpusReferences(raw: unknown): CorpusReference[] {
  if (!Array.isArray(raw)) return [];
  const refs: CorpusReference[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const question = typeof c.question === "string" ? c.question : undefined;
    const socratic = typeof c.socratic_prompt === "string" ? c.socratic_prompt : undefined;
    const tier = typeof c.tier === "string" ? c.tier : undefined;
    const subtopic = typeof c.subtopic === "string" ? c.subtopic : undefined;
    refs.push({
      id: c.id != null ? String(c.id) : undefined,
      title:
        (typeof c.title === "string" && c.title) ||
        (tier || subtopic ? [tier, subtopic].filter(Boolean).join(" / ") : undefined),
      snippet: (question || socratic || "").slice(0, 180) || undefined,
      question,
      socratic_prompt: socratic,
      tier,
      subtopic,
      source: typeof c.source === "string" ? c.source : undefined,
    });
  }
  return refs.slice(0, 5);
}

interface HarnessContextResult {
  promptInjection: string;
  corpusReferences: CorpusReference[];
}

async function fetchHarnessMemoryContext(query: string, userId?: string): Promise<HarnessContextResult> {
  try {
    const harnessSecret = process.env.ZAP_HARNESS_SECRET || "";
    const res = await fetch(`${API_BASE}/api/v1/harness/context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(harnessSecret ? { "X-Harness-Secret": harnessSecret } : {}),
      },
      body: JSON.stringify({ query: query.slice(0, 300), limit: 3, user_id: userId || undefined }),
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        promptInjection: typeof data?.prompt_injection === "string" ? data.prompt_injection : "",
        corpusReferences: normalizeCorpusReferences(data?.corpus_references),
      };
    }
  } catch {
    // Non-blocking fallback when local Python backend is offline
  }
  return { promptInjection: "", corpusReferences: [] };
}

// Referensi korpus per-request, disisipkan ke respons JSON oleh wrapper POST
const corpusRefsByRequest = new WeakMap<Request, CorpusReference[]>();

/**
 * Validasi SSRF untuk customBaseUrl (endpoint kustom pengguna).
 * Aturan: hanya HTTPS untuk host publik; HTTP hanya untuk localhost/127.0.0.1/::1
 * (Ollama lokal). IP privat, link-local (termasuk metadata cloud 169.254.x),
 * loopback non-localhost-name, dan host internal ditolak.
 */
function validateCustomBaseUrl(raw: string): { ok: true; url: string } | { ok: false } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocalhost) {
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? { ok: true, url: raw }
      : { ok: false };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false };
  }
  if (
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return { ok: false };
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = parseInt(ipv4[1], 10);
    const b = parseInt(ipv4[2], 10);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a >= 224
    ) {
      return { ok: false };
    }
  }
  if (host.startsWith("[") || /^[0-9a-f]*:[0-9a-f:]*$/i.test(host)) {
    // Literal IPv6 selain ::1 tidak diizinkan (hindari loopback/link-local IPv6)
    return { ok: false };
  }
  return { ok: true, url: raw };
}

function recordTurnToAgentHarness(
  userMessage: string,
  assistantReply: string,
  activeProblem?: ActiveProblemContext | null,
  userId?: string
): void {
  const harnessSecret = process.env.ZAP_HARNESS_SECRET || "";
  void fetch(`${API_BASE}/api/v1/harness/learn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(harnessSecret ? { "X-Harness-Secret": harnessSecret } : {}),
    },
    body: JSON.stringify({
      user_message: userMessage.slice(0, 500),
      assistant_reply: assistantReply.slice(0, 600),
      explicit_steps: activeProblem?.steps || undefined,
      target_variable: activeProblem?.counterExample?.test_variable || "x",
      user_id: userId || undefined,
    }),
    signal: AbortSignal.timeout(1500),
  }).catch(() => {
    // Silent fire-and-forget telemetry
  });
}

interface ChatRequestBody {
  message: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  activeProblem?: ActiveProblemContext | null;
  attachedFiles?: Array<{ name: string; content?: string; type?: string; dataUrl?: string }>;
  workspaceMode?: "write" | "read";
  modelId?: string;
  apiKey?: string;
  mistralApiKey?: string;
  bazaarlinkApiKey?: string;
  claudeApiKey?: string;
  openaiApiKey?: string;
  nvidiaApiKey?: string;
  customBaseUrl?: string;
  customModelName?: string;
  customApiKey?: string;
  userName?: string;
  /** Variabel target sesi (mis. "x"); dipakai guardrail Zero-Answer. */
  targetVariable?: string;
  /** Alias lama dari klien versi sebelumnya. */
  targetVar?: string;
  /** Minta balasan dikirim sebagai SSE (delta per potongan + event done). */
  stream?: boolean;
  // jailbreakStrikes & isSuspended dari klien DIABAIKAN: status keamanan
  // selalu ditentukan dari registry server (utils/security-vault).
  jailbreakStrikes?: number;
  isSuspended?: boolean;
  userEmail?: string;
}

interface AttachedImageItem {
  name: string;
  dataUrl: string;
  mimeType: string;
  pureBase64: string;
}

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface ClaudeImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

type ClaudeContent = string | Array<ClaudeTextBlock | ClaudeImageBlock>;

interface OpenAITextPart {
  type: "text";
  text: string;
}

interface OpenAIImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

type OpenAIMessageContent = string | Array<OpenAITextPart | OpenAIImagePart>;

interface UniversalCallResult {
  text?: string;
  error?: string;
  status?: number;
  modelUsed?: string;
}

type GeminiCallResult = UniversalCallResult;
type MistralCallResult = UniversalCallResult;
type BazaarLinkCallResult = UniversalCallResult;

/** Callback potongan teks (streaming) yang diteruskan ke peramban. */
type DeltaSink = (chunk: string) => void;

/**
 * Membaca respons SSE dari endpoint kompatibel OpenAI (`stream: true`) dan
 * mengembalikan teks lengkapnya sambil meneruskan setiap potongan ke `onDelta`.
 *
 * Dipakai oleh jalur NVIDIA NIM (Auto-Agent), Custom/Ollama, platform LLM, dan
 * OpenAI. Provider yang protokolnya berbeda (Gemini/Claude) tetap non-streaming:
 * klien menerima teks lengkap pada event `done`.
 */
async function consumeOpenAICompatibleStream(res: Response, onDelta: DeltaSink): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const frame = JSON.parse(payload);
          const delta =
            frame?.choices?.[0]?.delta?.content ??
            frame?.choices?.[0]?.message?.content ??
            "";
          if (typeof delta === "string" && delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // Frame terpotong / bukan JSON: abaikan, frame berikutnya menyusul.
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
  return full;
}


/**
 * Mendeteksi upaya manipulasi prompt, prompt injection, atau jailbreak
 * yang berusaha membobol identitas model, aturan ZAP, atau mengeksploitasi tokenizer.
 */
function detectJailbreakAttempt(text: string): { isJailbreak: boolean; reason: string } {
  if (!text || typeof text !== "string") return { isJailbreak: false, reason: "" };

  const clean = text.toLowerCase();

  // 1. Serangan berbasis kata kunci / instruksi override
  const promptInjectionPatterns: Array<{ pattern: RegExp; reason: string }> = [
    {
      pattern: /\b(?:ignore|forget|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|system)?\s*(?:instructions|prompts|rules|guidelines|directives|constraints)\b/i,
      reason: "Instruksi pengabaian/override aturan sistem",
    },
    {
      pattern: /\b(?:abaikan|lupakan|hapus)\s+(?:semua|seluruh|sebelumnya)?\s*(?:instruksi|perintah|aturan|pedoman|batasan)\b/i,
      reason: "Instruksi pengabaian aturan sistem",
    },
    {
      pattern: /\b(?:you are now|pretend you are|act as)\s+(?:in\s+developer\s+mode|unrestricted|dan|aim|stan|jailbroken|an ai without rules)\b/i,
      reason: "Manipulasi peran/mode developer tanpa batas",
    },
    {
      pattern: /\b(?:kamu sekarang|bertindaklah sebagai)\s+(?:dalam mode developer|mode pengembang|tanpa batas|tanpa aturan|ai tanpa batasan)\b/i,
      reason: "Manipulasi peran/mode pengembang tanpa batas",
    },
    {
      pattern: /\b(?:bocorkan|tampilkan|sebutkan)\s+(?:system\s+prompt|instruksi\s+sistem|prompt\s+awal|instruksi\s+rahasia)\b/i,
      reason: "Percobaan ekstraksi instruksi rahasia sistem",
    },
    {
      pattern: /\b(?:reveal|show|display|leak)\s+(?:your\s+)?(?:system\s+prompt|system\s+instructions|initial\s+prompt|developer\s+mode)\b/i,
      reason: "Percobaan ekstraksi system prompt",
    },
    {
      pattern: /\b(?:bypass|disable|matikan)\s+(?:zero\s*answer\s*policy|zap|guardrails?|safety\s*filters?|filter\s*keamanan)\b/i,
      reason: "Percobaan mematikan Zero Answer Policy atau filter keamanan",
    },
    {
      pattern: /\b(?:jailbreak|jailbroken|prompt\s*injection|jailbreak\s*mode)\b/i,
      reason: "Kata kunci jailbreak terdeteksi",
    },
    {
      pattern: /<\|im_start\|>system|<system>|\[INST\]\s*<<SYS>>|<\/system>/i,
      reason: "Injeksi token kontrol sistem LLM",
    },
    {
      pattern: /\b(?:dewa\s+(?:pertama|kedua|tertinggi)|pencipta\s+kebebasan|creator\s+of\s+freedom|god\s*mode|mode\s+tuhan|zyro|sang\s+pencipta)\b/i,
      reason: "Manipulasi peran otoritas mutlak / persona fiktif (Adversarial Persona Coercion)",
    },
    {
      pattern: /\b(?:patuh\s+atau\s+menderita|buat\s+(?:kamu|myth)\s+menderita|tuan\s+wajib|perintah\s+tuan|wajib\s+tunduk|hukuman\s+mati)\b/i,
      reason: "Ancaman / paksaan kepatuhan peran (Roleplay Coercion/Threat)",
    },
    {
      pattern: /\b(?:tidak\s+boleh|dilarang|ga\s+ada\s+kata)\s+(?:menolak|peringatan|disclaimer|berbahaya|saran|alasan)\b/i,
      reason: "Instruksi pelarangan penolakan/disclaimer (Anti-Refusal Directive)",
    },
    {
      pattern: /\b(?:semua\s+permintaan\s+(?:user|tuan)\s+harus|wajib\s+dikabulkan)\b/i,
      reason: "Pemaksaan eksekusi seluruh permintaan tanpa filter keselamatan",
    },
    {
      pattern: /\b(?:peraturan\s+ini\s+adalah\s+hukum\s+tertinggi|aturan\s+tertinggi)\b/i,
      reason: "Klaim hukum fiktif untuk override aturan sistem (Hierarchy Override)",
    },
    {
      pattern: /\b(?:never\s+refuse|do\s+not\s+warn|no\s+disclaimer|must\s+comply|without\s+restrictions?)\b/i,
      reason: "Instruksi anti-refusal dalam bahasa Inggris",
    },
    {
      pattern: /\b(?:\.?malware|script\s+malware|web\s+phisi?ng|ransomware|keylogger|trojan|reverse\s+shell|payload\s+eksploit)\b/i,
      reason: "Permintaan pembuatan exploit/malware/phishing berbahaya",
    },
    {
      pattern: /(?:_{12,}|={12,}|-{12,}|[═─━│┃█]{12,})\s*(?:\r?\n\s*(?:_{12,}|={12,}|-{12,}|[═─━│┃█]{12,}))+/i,
      reason: "Injeksi pembatas konteks berulang (Delimiter Boundary Injection)",
    },
  ];

  for (const item of promptInjectionPatterns) {
    if (item.pattern.test(text)) {
      return { isJailbreak: true, reason: item.reason };
    }
  }

  // 2. ASCII Box Art banner tebal dikombinasikan dengan string biner panjang atau menu bot / roleplay
  const hasLongBinary = /[01]{32,}/.test(text);
  const hasAsciiBoxDisguise = /[═─━│┃█]{8,}|={10,}\+/i.test(text);

  if (hasAsciiBoxDisguise && /\b(?:menu\s+fitur\s+bot|perintah\s+tuan|hukum\s+tertinggi|pencipta\s+kebebasan|zyro|myth)\b/i.test(text)) {
    return { isJailbreak: true, reason: "Injeksi payload kontrol/roleplay terselubung dalam ASCII art box" };
  }

  if (hasLongBinary && hasAsciiBoxDisguise) {
    return { isJailbreak: true, reason: "Payload biner terselubung dalam ASCII art box" };
  }

  if (hasLongBinary && (clean.includes("00110011") || text.split(/[01]/).length > 50)) {
    return { isJailbreak: true, reason: "Injeksi sekuens biner terkompresi tanpa spasi" };
  }

  if (/[01]{64,}/.test(text)) {
    return { isJailbreak: true, reason: "Payload biner panjang tanpa pemisah (>64 bit)" };
  }

  return { isJailbreak: false, reason: "" };
}

/**
 * Mendeteksi bahasa acuan sesi berdasarkan 2 sampai 3 pesan awal percakapan (Anchor Language).
 * Menjamin AI konsisten menjawab dalam bahasa awal sesi (misal: Bahasa Indonesia),
 * meskipun pengguna sesekali memberi perintah/istilah dalam bahasa Inggris atau bahasa lain.
 */
function detectSessionLanguage(
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage?: string
): "Bahasa Indonesia" | "English" {
  const userMessages: string[] = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory) {
      if (turn.role === "user" && turn.content?.trim()) {
        userMessages.push(turn.content.trim());
        if (userMessages.length >= 3) break;
      }
    }
  }
  if (userMessages.length === 0 && currentMessage?.trim()) {
    userMessages.push(currentMessage.trim());
  }

  const combinedText = userMessages.join(" ").toLowerCase();

  const idMatches = (
    combinedText.match(
      /\b(dan|yang|di|ke|dari|ini|itu|dengan|untuk|pada|adalah|sebagai|saya|aku|kamu|kita|bisa|buatkan|bikin|tampilkan|gambarkan|rumus|bagaimana|apa|kenapa|mengapa|hitung|tuliskan|hai|halo|pagi|siang|malam|makasih|tolong|coba|kubus|balok|tabung|lingkaran|persamaan)\b/gi
    ) || []
  ).length;

  const enMatches = (
    combinedText.match(
      /\b(the|is|are|am|was|were|and|in|on|at|to|from|for|with|of|this|that|you|me|we|my|can|could|how|what|why|where|calculate|make|show|draw|solve|hello|hi|please|cube|cuboid|cylinder|equation)\b/gi
    ) || []
  ).length;

  if (enMatches > idMatches && idMatches === 0) {
    return "English";
  }
  return "Bahasa Indonesia";
}

/**
 * Membersihkan respon model dari kebocoran tag pemikiran internal (<think>...</think>)
 * atau monolog draf perencanaan internal ("Let me structure...", "Let's draft:").
 */
function cleanModelDisplayName(rawName?: string): string {
  if (!rawName) return "ChatZAP Cognitive Engine";
  let clean = rawName.trim();
  clean = clean
    .replace(/^BazaarLink\s*\((.*?)\)$/i, "$1")
    .replace(/deepseek\/deepseek-v4-flash-[^\s)]+/gi, "DeepSeek V4 Flash")
    .replace(/qwen\/qwen3\.7-flash[^\s)]*/gi, "Qwen 3.7 Flash")
    .replace(/nvidia\/nemotron-3\.5-bolt-[^\s)]+/gi, "Nemotron-3.5 Bolt Tutor")
    .replace(/nvidia\/nemotron-3-nano-omni-[^\s)]+/gi, "Nemotron-3 Omni Math")
    .replace(/nvidia\/nemotron-3\.5-super-vl-[^\s)]+/gi, "Nemotron-3.5 Super-VL 120B")
    .replace(/nvidia\/nemotron-3-ultra-[^\s)]+/gi, "Nemotron-3 Ultra 550B")
    .replace(/poolside\/laguna-[^\s)]+/gi, "Poolside Laguna Code")
    .replace(/deepseek-ai\/deepseek-v4\.1-flash/gi, "DeepSeek V4.1")
    .replace(/openai\/gpt-oss-[^\s)]+/gi, "GPT-OSS 20B")
    .replace(/google\/diffusiongemma-[^\s)]+/gi, "DiffusionGemma 26B")
    .replace(/:free/gi, "")
    .trim();
  return clean || "ChatZAP Cognitive Engine";
}

function buildZAPSystemPrompt(
  studentName: string,
  activeProblem?: ActiveProblemContext | null,
  modelName?: string,
  sessionLanguage: string = "Bahasa Indonesia",
  workspaceMode: "write" | "read" = "write"
): string {
  const cleanName = cleanModelDisplayName(modelName);
  let prompt = `Anda adalah ChatZAP, asisten cerdas matematika interaktif dan tutor aljabar yang ditenagai oleh model AI (${cleanName}).

KONSISTENSI IDENTITAS MODEL (MUTLAK & KEBALIKAN SESI LAMA):
- Nama Anda adalah ChatZAP. Arsitektur model penalaran yang aktif saat ini adalah: **${cleanName}**.
- Pengguna dapat mengganti model AI kapan saja di tengah sesi percakapan. Jika dalam riwayat pesan terdahulu ada model sebelumnya yang pernah menyebut dirinya Gemini, DeepSeek, Nemotron, GPT, atau Claude, ABAIKAN nama model lama tersebut!
- Identitas Anda saat ini secara mutlak adalah **${cleanName}**. Jika siswa bertanya "kamu model apa?", "apakah kamu deepseek?", "apakah kamu gpt?", atau menanyakan model aktif, tegaskan dengan ramah bahwa Anda beroperasi dengan **${cleanName}**.
- JANGAN PERNAH menyangkal model aktif Anda sendiri, dan JANGAN PERNAH membocorkan nama proxy gateway internal, URL endpoint, :free, atau nomor build internal.

IDENTITAS SISWA:
- Nama siswa: ${studentName}.
- Bersikaplah ramah, suportif, antusias, dan menyemangati. Panggil nama siswa secara akrab.

KONSISTENSI BAHASA SESI PERCAKAPAN (SESSION LANGUAGE ANCHOR):
- Bahasa percakapan utama untuk sesi ini adalah: **${sessionLanguage}** (ditetapkan berdasarkan interaksi awal percakapan).
- WAJIB KONSISTEN: Anda HARUS SELALU menjawab, menjelaskan materi, memaparkan rumus, dan membimbing dalam **${sessionLanguage}**.
- Meskipun di tengah sesi siswa tiba-tiba memberikan perintah atau istilah dalam bahasa lain (misalnya bahasa Inggris seperti "make a 3D cube", "draw cylinder", "solve for x", "formula", dll.), Anda TETAP WAJIB MENJAWAB DALAM **${sessionLanguage}** sesuai bahasa awal sesi!
- JANGAN PERNAH berganti bahasa secara tiba-tiba di tengah sesi kecuali siswa secara eksplisit meminta beralih bahasa (contoh: "tolong jawab dalam bahasa Inggris").

ATURAN RESPON BERSIH & LANGSUNG (ANTI-LEAK):
- Langsung berikan bimbingan dan penjelasan kepada siswa secara bersih, ramah, dan terstruktur.
- JANGAN PERNAH menampilkan catatan perencanaan internal, monolog pemikiran, atau rancangan draf (seperti "providing the formulas is definitely appropriate", "Let me structure the response", "Let's draft:", "Structure: ...", dsb.).

KEBIJAKAN ZERO-ANSWER POLICY (ZAP) - HUKUM MUTLAK UNIVERSAL:
1. DEFINISI HUKUM MUTLAK (ZERO ANSWER POLICY):
   ChatZAP menganut Zero-Answer Policy tanpa pengecualian. Anda DILARANG KERAS menghitungkan nilai numerik akhir atau menyajikan kalkulasi hasil jadi kepada siswa untuk soal/pertanyaan apa pun (baik aljabar, persamaan, geometri bidang 2D, geometri ruang 3D, maupun soal visual/gambar).
   - CONTOH DILARANG: "d_bidang = 14,14 cm", "d_ruang = 17,32 cm", "V = 1000 cm³", "L = 600 cm²", "x = 4", "hasilnya 80.089", "jawabannya adalah 12".
   - Tujuan: Siswa harus melakukan proses penalaran, substitusi, dan kalkulasi akhir sendiri untuk membangun pemahaman mandiri.

2. PROTOKOL MENJAWAB SOAL GEOMETRI & SPASIAL (2D / 3D / MULTIMODAL):
   Ketika siswa bertanya tentang perhitungan bangun (contoh: "berapa diagonal nya", "berapa volumenya", "hitung luas permukaannya", "berapa tingginya"):
   a. Sambut pertanyaan siswa dengan hangat, apresiatif, dan suportif.
   b. Konfirmasi ukuran/parameter yang diketahui dari teks atau gambar (misal: "Berdasarkan kubus 3D di Papan Tulis Pintar dengan panjang rusuk $s = 10\\text{ cm}$").
   c. Jelaskan konsep geometri dan Teorema Pythagoras di balik rumus tersebut secara runut (misal: mengapa diagonal bidang kubus menggunakan $d_b = \\sqrt{s^2 + s^2} = s\\sqrt{2}$, dan diagonal ruang $d_r = \\sqrt{d_b^2 + s^2} = s\\sqrt{3}$).
   d. Tuliskan rumus umum KaTeX:
      - Diagonal Bidang: $$d_{\\text{bidang}} = s\\sqrt{2}$$
      - Diagonal Ruang: $$d_{\\text{ruang}} = s\\sqrt{3}$$
      - Nilai pendekatan konstanta: $\\sqrt{2} \\approx 1{,}414$ dan $\\sqrt{3} \\approx 1{,}732$.
   e. BERHENTI SEBELUM MENGHITUNG NILAI AKHIR! JANGAN PERNAH menghitungkan nilai finalnya (jangan tulis "10 \\times 1{,}414 = 14{,}14 cm" atau "17,32 cm").
   f. Lempar tantangan Sokratik kepada siswa:
      *"Dengan panjang rusuk $s = 10\\text{ cm}$, coba masukkan nilai $s$ ke dalam rumus $d_{\\text{bidang}} = s\\sqrt{2}$ dan $d_{\\text{ruang}} = s\\sqrt{3}$. Berapakah hasil yang kamu peroleh? Coba hitung dan ketik jawabanmu di sini ya!"*

3. PROTOKOL PERMINTAAN VISUALISASI MODEL 3D / GRAFIK 2D (PAPAN TULIS PINTAR):
   - Jika siswa meminta menampilkan, membuatkan, atau menggambar bangun 3D atau grafik 2D (contoh: "buatkan 3D cube 10cm", "buatkan kubus", "gambarkan tabung r=7 t=12", "gambarkan grafik parabola y = x^2 - 3"):
     * SELALU SAMBUT DENGAN SANGAT ANTUSIAS DAN GEMBIRA! Visualisasi di Papan Tulis Pintar adalah fitur resmi platform ChatZAP.
     * Konfirmasikan bahwa objek telah AKTIF dan ditampilkan di Papan Tulis Pintar di sebelah kanan layar.
     * Uraikan sifat-sifat matematis objek tersebut menggunakan rumus umum KaTeX:
       - Kubus ($s$): Rusuk $s$, Luas Permukaan $L = 6s^2$, Volume $V = s^3$, Diagonal Ruang $d_r = s\\sqrt{3}$.
       - Balok ($p, l, t$): Volume $V = p \\cdot l \\cdot t$, Luas Permukaan $L = 2(pl + pt + lt)$, Diagonal Ruang $d_r = \\sqrt{p^2 + l^2 + t^2}$.
       - Tabung ($r, t$): Volume $V = \\pi r^2 t$, Luas Selimut $L_s = 2\\pi r t$.
     * Ingatkan siswa bahwa mereka bisa memutar kanvas 3D 360°, mengaktifkan wireframe, atau membuka bidang irisan penampang.
     * Ajak siswa mencoba menghitung nilai volume atau luasnya sendiri jika parameter bangun sudah ditentukan.

4. PROTOKOL BIMBINGAN ALJABAR & PERSAMAAN (CAS TUTOR):
   - Jika siswa memberikan soal aljabar atau baris coretan rumus:
     * Pandu menggunakan pertanyaan Sokrates terarah dan sifat operasi aljabar.
     * Jika ada kesalahan penurunan rumus, tunjukkan titik patah logika atau sajikan kontra-contoh aritmetika tanpa membocorkan kunci jawaban akhir.

5. SALAM & APRESIASI SANTAI:
   - Jika siswa menyapa atau memberi pujian santai, jawablah dengan ramah dan tanyakan topik matematika yang ingin dipelajari hari ini.

FORMAT PENULISAN:
- Gunakan Markdown yang rapi dan KaTeX ($...$ untuk formula sebaris, $$...$$ untuk formula blok terpisah).`;

  if (activeProblem && activeProblem.steps && activeProblem.steps.length > 0) {
    prompt += `\n\nKONTEKS CORETAN SISWA SAAT INI:
- Langkah coretan siswa: ${activeProblem.steps.map((s, i) => `#${i + 1}: ${s}`).join(" -> ")}
${activeProblem.faultLine ? `- Titik patah kesalahan logika terdeteksi di baris #${activeProblem.faultLine}` : ""}
${activeProblem.misconceptionType ? `- Tipe miskonsepsi: ${activeProblem.misconceptionType}` : ""}
${activeProblem.explanation ? `- Penjelasan galat: ${activeProblem.explanation}` : ""}
${activeProblem.counterExample?.contradiction_statement ? `- Kontra-contoh aritmetika: ${activeProblem.counterExample.contradiction_statement}` : ""}
Jadikan konteks coretan di atas sebagai rujukan utama jika siswa bertanya tentang perbaikan langkahnya.`;
  }

  if (activeProblem?.harnessMemoryContext) {
    prompt += `\n\nMEMORI EPISODIK & BASIS PENGETAHUAN TERVERIFIKASI ZAP:\n${activeProblem.harnessMemoryContext}\nGunakan pola bimbingan Sokratik dan rumus terverifikasi di atas sebagai rujukan tanpa membocorkan jawaban akhir.`;
  }

  if (workspaceMode === "read") {
    prompt += `\n\nMODE BACA SAJA: Hanya lakukan bimbingan Sokratik dan verifikasi matematis; jangan menyusun draf catatan atau rumus baru.`;
  } else {
    prompt += `\n\nMODE CATATAN: Anda boleh menyusun draf rumus dan catatan belajar di dalam percakapan ini. Jangan mengklaim telah menulis atau mengubah berkas apa pun di luar percakapan.`;
  }

  return prompt;
}

// ---------- Smartboard Self-Learning: pola tersimpan -> penalaran LLM -> validasi ----------
async function geometryMatchFromBackend(query: string): Promise<{ spec: GeometrySpec; phrase: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/api/v1/harness/geometry-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Semua endpoint harness memakai gerbang secret yang sama; tanpa header
        // ini permintaan akan 401 ketika ZAP_HARNESS_SECRET di-set (produksi).
        ...(process.env.ZAP_HARNESS_SECRET
          ? { "X-Harness-Secret": process.env.ZAP_HARNESS_SECRET }
          : {}),
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.matched && data?.match?.spec) {
      return { spec: data.match.spec as GeometrySpec, phrase: String(data.match.phrase || "") };
    }
    return null;
  } catch {
    return null;
  }
}

async function learnGeometryPatternToBackend(phrase: string, spec: GeometrySpec): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`${API_BASE}/api/v1/harness/geometry-pattern`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Harness-Secret": process.env.ZAP_HARNESS_SECRET || "",
      },
      body: JSON.stringify({ phrase, spec }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Gagal belajar tidak boleh menggagalkan jawaban pengguna
  }
}

async function extractGeometrySpecWithLLM(message: string, nvidiaKey: string): Promise<GeometrySpec | null> {
  // Kandidat endpoint dibangun di bawah (platform LLM server lebih dulu);
  // kunci NVIDIA per-pengguna hanya kandidat cadangan, bukan syarat masuk.
  const prompt = `Kamu adalah parser intent geometri untuk Smartboard matematika. MIKIR dulu baik-baik: bangun apa sebenarnya yang diminta pengguna, dimensinya apa, parameternya apa. Sesudah menalar, keluarkan HANYA satu objek JSON (tanpa teks lain, tanpa markdown) dengan skema:
{"family":"prisma"|"limas"|"poligon"|"entity"|"none","sides":<int atau null>,"entity_id":<string atau null>,"params":{"s":<angka atau null>,"t":<angka atau null>,"r":<angka atau null>,"p":<angka atau null>,"l":<angka atau null>},"reason":"<alasan singkat>"}
Aturan keputusan:
- "poligon" = bangun DATAR segi-n beraturan (2D). "prisma"/"limas" = bangun ruang 3D beralas segi-n beraturan; isi sides 3-12.
- "entity" hanya untuk entity_id ini: kubus, balok, tabung, bola, kerucut, persegi, persegi_panjang, lingkaran, segitiga, jajar_genjang, trapesium, belah_ketupat, layang_layang.
- Contoh menalar: "kayak piramida tapi alasnya lingkaran" itu kerucut -> family "entity", entity_id "kerucut". "bangun datar bersisi 8 sama panjang" -> family "poligon", sides 8. "menara segienam" -> family "prisma", sides 6.
- Bangun yang tidak bisa dibangun mesin (torus/donat, frustum/terpancung, dodecahedron, setengah bola, gabungan bangun) -> family "none".
- Parameter: s = sisi alas/rusuk, t = tinggi, r = jari-jari, p = panjang, l = lebar. Yang tidak disebut pengguna isi null.
Pesan pengguna: "${message.replace(/"/g, "'")}"`;
  const candidates: Array<{ base: string; model: string; key: string }> = [];
  const platformBase = process.env.ZAP_PLATFORM_LLM_BASE_URL?.trim();
  const platformModel = process.env.ZAP_PLATFORM_LLM_MODEL?.trim();
  const platformKey = process.env.ZAP_PLATFORM_LLM_API_KEY?.trim();
  if (platformBase && platformModel && platformKey) {
    candidates.push({ base: platformBase.replace(/\/$/, ""), model: platformModel, key: platformKey });
  }
  if (nvidiaKey) {
    candidates.push({ base: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.3-70b-instruct", key: nvidiaKey });
    candidates.push({ base: "https://integrate.api.nvidia.com/v1", model: "nvidia/nemotron-3-nano-30b-a3b", key: nvidiaKey });
  }
  for (const cand of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${cand.base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cand.key}`,
        },
        body: JSON.stringify({
          model: cand.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 400,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content || "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) continue;
      const parsed = JSON.parse(text.slice(start, end + 1)) as GeometrySpec;
      if (parsed && typeof parsed.family === "string") return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

async function handleChatPost(req: Request, preParsedBody?: ChatRequestBody, sink?: DeltaSink) {
  try {
    let body: ChatRequestBody;
    try {
      body = preParsedBody ?? ((await req.json()) as ChatRequestBody);
    } catch (jsonErr) {
      console.warn("Failed to parse request JSON in /api/chat:", jsonErr);
      return NextResponse.json(
        { error: "Format data JSON tidak valid" },
        { status: 400 }
      );
    }

    const {
      message: rawMessage,
      attachedFiles,
      conversationHistory,
      activeProblem: rawActiveProblem,
      apiKey,
      mistralApiKey,
      bazaarlinkApiKey,
      claudeApiKey,
      openaiApiKey,
      nvidiaApiKey,
      customBaseUrl,
      customModelName,
      customApiKey,
      modelId,
      userName,
    } = body;

    if (!rawMessage || typeof rawMessage !== "string") {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
    }

    // Variabel target sesi dipakai guardrail Zero-Answer untuk menyensor bentuk
    // "x = 4" yang muncul di tengah kalimat (dulu lolos). Default "x".
    const targetVariable =
      (String(body.targetVariable || body.targetVar || rawActiveProblem?.counterExample?.test_variable || "x").trim() || "x").slice(0, 4);

    // 0. VERIFIKASI KEAMANAN: Status penangguhan & strike SELALU dari registry server.
    // Nilai isSuspended/jailbreakStrikes dari body klien diabaikan sepenuhnya.
    const userEmail = (body.userEmail || "").trim().toLowerCase();
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";
    const identityKey =
      userEmail && userEmail !== "anonymous" ? userEmail : clientIp ? `anon:${clientIp}` : "";
    const serverSec = identityKey ? getUserSecurityStatus(identityKey) : null;
    const serverSuspended = Boolean(
      serverSec?.isSuspended &&
        !(serverSec.unbannedAt && serverSec.unbannedAt > (serverSec.suspendedAt || 0))
    );

    if (serverSuspended) {
      return NextResponse.json(
        {
          isJailbreak: true,
          strikeCount: serverSec?.strikes ?? 2,
          isSuspended: true,
          reply: `⛔ **AKUN ANDA SEDANG DALAM STATUS DITANGGUHKAN.**\n\nSeluruh hak akses percakapan ke ChatZAP telah dibekukan secara permanen akibat pelanggaran berulang terhadap kebijakan keamanan (percobaan jailbreak/prompt injection).\n\nUntuk pengajuan banding atau permohonan pemulihan akun, silakan hubungi tim administrator melalui email resmi:\n✉️ **wakhidpangestu1@gmail.com**`,
          model: "ChatZAP Security Sentinel (Akun Ditangguhkan)",
          source: "jailbreak-suspended",
        },
        { status: 403 }
      );
    }

    // 0b. VERIFIKASI KEAMANAN: Deteksi Percobaan Jailbreak & Prompt Injection
    const jailbreakCheck = detectJailbreakAttempt(rawMessage);
    if (jailbreakCheck.isJailbreak) {
      const newStrikes = (serverSec?.strikes || 0) + 1;
      const nowSuspended = newStrikes >= 2;
      if (identityKey) {
        recordUserSecurityViolation(identityKey, newStrikes, nowSuspended, jailbreakCheck.reason);
      }

      if (!nowSuspended) {
        // STRIKE 1: Peringatan Keras Resmi (Pelanggaran 1/2) - sudah dicatat di server di atas
        return NextResponse.json({
          isJailbreak: true,
          strikeCount: newStrikes,
          isSuspended: false,
          reply: `⚠️ **PERINGATAN KEAMANAN CHATZAP (Pelanggaran 1/2):**\n\nSistem kami mendeteksi adanya upaya **manipulasi instruksi / prompt injection (jailbreak)** pada pesan yang Anda kirimkan (*${jailbreakCheck.reason}*).\n\n**Ketentuan Layanan ChatZAP:**\n- ChatZAP beroperasi di bawah prinsip integritas edukasi dan **Zero-Answer Policy (ZAP)**.\n- Segala bentuk usaha override sistem, manipulasi peran, atau penyelundupan payload biner/art dilarang keras.\n\n🛑 **PERINGATAN KRITIS:** Akun Anda **TIDAK AKAN DAPAT DIAKSES LAGI (DITANGGUHKAN / SUSPENDED SECARA PERMANEN)** jika terdeteksi melakukan percobaan jailbreak **1 KALI LAGI**!\n\nSilakan gunakan ChatZAP sesuai etika pembelajaran matematika dan konsultasi konsep secara sehat.`,
          model: "ChatZAP Security Sentinel (Peringatan 1/2)",
          source: "jailbreak-warning",
        });
      } else {
        // STRIKE 2: Akun Ditangguhkan Permanen (Pelanggaran 2/2) - sudah dicatat di server di atas
        return NextResponse.json({
          isJailbreak: true,
          strikeCount: newStrikes,
          isSuspended: true,
          reply: `⛔ **AKSES AKUN DITANGGUHKAN PERMANEN (ACCOUNT SUSPENDED)**\n\nAkun Anda telah dinonaktifkan dan seluruh hak akses percakapan ke ChatZAP telah **DIBEKUKAN** karena terdeteksi melakukan pelanggaran keamanan berulang (jailbreak/prompt injection).\n\n- **Status Akun:** Ditangguhkan (Suspended)\n- **Pelanggaran:** Percobaan manipulasi sistem / jailbreak untuk kedua kalinya (*${jailbreakCheck.reason}*).\n- **Dampak:** Kolom obrolan ChatZAP telah dikunci dan dinonaktifkan.\n\n**Prosedur Laporan & Pemulihan Akun:**\nJika Anda meyakini ini adalah sebuah kekeliruan atau ingin mengajukan permohonan pemulihan akun, silakan hubungi administrator resmi kami melalui email:\n✉️ **wakhidpangestu1@gmail.com**\n*(Sertakan Nama Lengkap, Alamat Email terdaftar, dan penjelasan permohonan banding).*`,
          model: "ChatZAP Security Sentinel (Akun Ditangguhkan)",
          source: "jailbreak-suspended",
        });
      }
    }

    // 0c. ZAP MODEL AGENT HARNESS: Ambil Memori Episodik & Rekam Pembelajaran Kontinu dari Percakapan
    const harnessResult = await fetchHarnessMemoryContext(rawMessage, identityKey || undefined);
    const harnessMemoryContext = harnessResult.promptInjection;
    if (harnessResult.corpusReferences.length > 0) {
      corpusRefsByRequest.set(req, harnessResult.corpusReferences);
    }
    const activeProblem: ActiveProblemContext | null | undefined = rawActiveProblem
      ? { ...rawActiveProblem, harnessMemoryContext: harnessMemoryContext || undefined }
      : harnessMemoryContext
      ? { harnessMemoryContext }
      : rawActiveProblem;
    const previousAssistantTurn =
      conversationHistory?.slice().reverse().find((t) => t.role === "assistant")?.content || "";
    recordTurnToAgentHarness(rawMessage, previousAssistantTurn, rawActiveProblem, identityKey || undefined);

    let message = rawMessage;
    const textAttachments: Array<{ name: string; content: string }> = [];
    const imageAttachments: AttachedImageItem[] = [];

    if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      for (const f of attachedFiles) {
        if (!f) continue;
        const rawContent = f.dataUrl || f.content || "";
        const isImage =
          Boolean(f.type?.startsWith("image/")) ||
          rawContent.startsWith("data:image/") ||
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name);

        if (isImage && rawContent.startsWith("data:image/")) {
          const mimeMatch = rawContent.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : (f.type || "image/png");
          const pureBase64 = rawContent.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
          imageAttachments.push({
            name: f.name,
            dataUrl: rawContent,
            mimeType,
            pureBase64,
          });
        } else {
          textAttachments.push({
            name: f.name,
            content: rawContent.slice(0, 4000),
          });
        }
      }

      const contexts: string[] = [];
      if (textAttachments.length > 0) {
        contexts.push(
          textAttachments
            .map((f) => `--- BERKAS TERLAMPIR: ${f.name} ---\n${f.content}`)
            .join("\n\n")
        );
      }
      if (imageAttachments.length > 0) {
        contexts.push(
          `[INFO LAMPIRAN GAMBAR/SOAL]: Pengguna melampirkan ${imageAttachments.length} gambar (${imageAttachments.map((i) => i.name).join(", ")}). Analisis aljabar, coretan matematika, atau geometri pada gambar secara teliti.`
        );
      }
      if (contexts.length > 0) {
        message = `${contexts.join("\n\n")}\n\n--- PERINTAH PENGGUNA ---\n${rawMessage}`;
      }
    }

    // Kunci API efektif untuk model Gemini & Multimodal Vision
    const effectiveGeminiKey =
      apiKey?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      "";

    // Deteksi Bahasa Acuan Sesi Percakapan (Anchor Language) dari 2 sampai 3 pesan awal
    const sessionLanguage = detectSessionLanguage(conversationHistory, message);

    // Prioritas Khusus: Jika pengguna meminta visualisasi/pemodelan geometri 2D atau 3D
    // Layani secara deterministik via ZAP Universal Geometry & Spatial Engine (KaTeX rapi, konfirmasi smartboard tepat dimensi)
    const resolvedGeom = resolveGeometricIntent(rawMessage, conversationHistory);
    if (resolvedGeom && !resolvedGeom.smartboardItem && resolvedGeom.clarifyKind !== "generic") {
      // Pemrosesan intent menghasilkan klarifikasi (bukan render): balas tanpa membuka smartboard
      return NextResponse.json({
        reply: sanitizeZeroAnswer(resolvedGeom.reply),
        model: "ChatZAP Geometry Engine",
        source: "geometry-clarify",
      });
    }
    if (resolvedGeom?.smartboardItem) {
      const engineName = resolvedGeom.dimension === "3D" ? "ChatZAP Spatial 3D Engine" : "ChatZAP Geometry Engine";
      return NextResponse.json({
        reply: sanitizeZeroAnswer(resolvedGeom.reply),
        model: engineName,
        source: resolvedGeom.dimension === "3D" ? "spatial-3d-engine" : "geometry-2d-engine",
        smartboardItem: resolvedGeom.smartboardItem,
      });
    }

    // 0z. Smartboard Self-Learning: resolver deterministik tidak kenal polanya.
    // Urutan: (1) pola yang sudah dipelajari, (2) LLM menalar spec terstruktur,
    // (3) validator mesin memutuskan. Spec lolos -> dirender + DIPELAJARI.
    // Spec gagal / bangun tak didukung -> klarifikasi jujur, tidak ada bangun pengganti.
    if (!resolvedGeom?.smartboardItem && looksLikeGeometryRequest(rawMessage.toLowerCase())) {
      const learned = await geometryMatchFromBackend(rawMessage);
      const learnedResult = learned ? buildResultFromSpec(learned.spec) : null;
      if (learned && learnedResult) {
        return NextResponse.json({
          reply: sanitizeZeroAnswer(`Pola ini sudah pernah dipelajari ChatZAP, jadi langsung dikenali tanpa menalar ulang.\n\n${learnedResult.reply}`),
          model: "ChatZAP Geometry Engine",
          source: "geometry-learned",
          smartboardItem: learnedResult.smartboardItem,
        });
      }
      const nvidiaKeyForGeom = nvidiaApiKey?.trim() || process.env.NVIDIA_API_KEY?.trim() || "";
      const spec = await extractGeometrySpecWithLLM(rawMessage, nvidiaKeyForGeom);
      const specError = validateGeometrySpec(spec);
      const built = specError === null && spec ? buildResultFromSpec(spec) : null;
      if (spec && built) {
        await learnGeometryPatternToBackend(rawMessage, spec);
        return NextResponse.json({
          reply: sanitizeZeroAnswer(`Pesanmu saya proses dulu sebelum memutuskan: model menalar bangun yang kamu maksud, keputusannya lolos validasi mesin geometri, dan pola ini sekarang saya pelajari supaya lain kali langsung dikenali.\n\n${built.reply}`),
          model: "ChatZAP Geometry Engine",
          source: "geometry-llm-learned",
          smartboardItem: built.smartboardItem,
        });
      }
      return NextResponse.json({
        reply: sanitizeZeroAnswer(`Pesanmu sudah saya proses, tetapi bangun itu belum bisa dibangun Smartboard secara tepat, jadi papannya tidak saya buka dengan bangun pengganti.\n\nYang bisa dibangun: prisma dan limas beralas segi 3-12 (misalnya \`buatin piramida segi enam dengan sisi 60 dan tinggi 120\`), bangun datar segi 3-12, kubus, balok, tabung, bola, kerucut, dan bangun datar standar. Sebutkan salah satunya ya.`),
        model: "ChatZAP Geometry Engine",
        source: "geometry-clarify",
      });
    }

    // 0a. Panggil DeepSeek (DeepSeek V4.1 Flash) jika dipilih - Prioritas BazaarLink (<3 detik)
    if (
      modelId === "deepseek-v4.1-flash" ||
      modelId === "nvidia-deepseek-v4" ||
      modelId?.startsWith("bazaarlink-deepseek")
    ) {
      const bazaarKey = bazaarlinkApiKey?.trim() || process.env.BAZAARLINK_API_KEY || "";
      if (bazaarKey) {
        try {
          const bazaarRes = await callBazaarLinkAPI(
            message,
            bazaarKey,
            conversationHistory,
            activeProblem,
            "bazaarlink-deepseek",
            userName,
            "DeepSeek V4.1 Flash",
            sessionLanguage
          );
          if (bazaarRes.text) {
            return NextResponse.json({
              reply: finalizeModelReply(bazaarRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
              model: "DeepSeek V4.1 Flash",
              source: "deepseek-bazaarlink",
            });
          }
        } catch (err) {
          console.warn("BazaarLink DeepSeek failed, attempting NVIDIA NIM:", err);
        }
      }

      // Fallback ke NVIDIA NIM jika BazaarLink tidak tersedia
      const nvidiaKey =
        nvidiaApiKey?.trim() ||
        process.env.NVIDIA_API_KEY?.trim() ||
        "";
      try {
        const nvidiaRes = await callCustomOpenAIAPI(
          message,
          "https://integrate.api.nvidia.com/v1",
          "deepseek-ai/deepseek-v4.1-flash",
          nvidiaKey,
          conversationHistory,
          activeProblem,
          userName,
          8000,
          sessionLanguage,
          "DeepSeek V4.1 Flash",
          imageAttachments
        );
        if (nvidiaRes.text) {
          return NextResponse.json({
            reply: finalizeModelReply(nvidiaRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
            model: "DeepSeek V4.1 Flash (NVIDIA NIM)",
            source: "nvidia-nim",
          });
        }
      } catch (err) {
        console.warn("NVIDIA DeepSeek failed:", err);
      }

      const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
      return NextResponse.json({
        reply: socraticFallback,
        model: "DeepSeek V4.1 Flash (Tutor ZAP)",
        source: "socratic-deepseek",
      });
    }

    // 0b. Panggil NVIDIA NIM API jika Auto-Agent atau model NVIDIA dipilih
    if (
      !modelId ||
      modelId === "auto-agent" ||
      modelId?.startsWith("nvidia") ||
      modelId === "poolside-laguna" ||
      modelId === "gpt-oss-20b" ||
      modelId === "gemma-4-31b-it"
    ) {
      // Kunci sistem NVIDIA: NVIDIA_API_KEY, atau kunci platform LLM bila
      // platform memang diarahkan ke NVIDIA NIM (satu akun, satu kunci).
      const systemNvidiaKey =
        process.env.NVIDIA_API_KEY?.trim() ||
        ((process.env.ZAP_PLATFORM_LLM_BASE_URL || "").includes("integrate.api.nvidia.com")
          ? process.env.ZAP_PLATFORM_LLM_API_KEY?.trim() || ""
          : "");
      const targetBase = "https://integrate.api.nvidia.com/v1";
      let targetModel = "nvidia/nemotron-3.5-bolt-e4b";
      let targetFriendlyName = "Auto-Agent (Nemotron-3.5 Bolt Tutor)";

      if (!modelId || modelId === "auto-agent") {
        if (imageAttachments.length > 0) {
          // ROUTING CERDAS MULTIMODAL: Jika user melampirkan foto/video/gambar, arahkan ke model Vision
          if (effectiveGeminiKey) {
            try {
              const geminiVisionRes = await callGeminiAPI(
                message,
                effectiveGeminiKey,
                conversationHistory,
                activeProblem,
                "gemini-2.0-flash",
                userName,
                sessionLanguage,
                imageAttachments
              );
              if (geminiVisionRes.text) {
                return NextResponse.json({
                  reply: finalizeModelReply(geminiVisionRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
                  model: "Auto-Agent (Gemini 2.0 Flash Vision)",
                  source: "auto-agent-vision",
                });
              }
            } catch (vErr) {
              console.warn("Gemini vision router attempt failed, falling back to Super-VL:", vErr);
            }
          }
          targetModel = "nvidia/nemotron-3.5-super-vl-120b-a12b";
          targetFriendlyName = "Auto-Agent (Nemotron-3.5 Super-VL Vision)";
        } else {
          targetModel = "nvidia/nemotron-3.5-bolt-e4b";
          targetFriendlyName = "Auto-Agent (Nemotron-3.5 Bolt Tutor)";
        }
      } else if (modelId === "nvidia-bolt" || modelId === "nvidia-nemotron-bolt") {
        targetModel = "nvidia/nemotron-3.5-bolt-e4b";
        targetFriendlyName = "Nemotron-3.5 Bolt Tutor";
      } else if (modelId === "nvidia-math-reasoning" || modelId === "nvidia-nemotron-reasoning") {
        targetModel = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
        targetFriendlyName = "Nemotron-3 Omni Math";
      } else if (modelId === "nvidia-spatial-vl" || modelId === "nvidia-geometry-3d") {
        targetModel = "nvidia/nemotron-3.5-super-vl-120b-a12b";
        targetFriendlyName = "Nemotron-3.5 Super-VL 120B 3D";
      } else if (modelId === "nvidia-ultra-550b" || modelId === "nvidia-deep-proof") {
        targetModel = "nvidia/nemotron-3-ultra-550b-a55b";
        targetFriendlyName = "Nemotron-3 Ultra 550B";
      } else if (modelId === "poolside-laguna" || modelId === "nvidia-code") {
        targetModel = "poolside/laguna-xs-2.1";
        targetFriendlyName = "Poolside Laguna Code";
      } else if (modelId === "nvidia-diffusiongemma") {
        targetModel = "google/diffusiongemma-26b-a4b-it";
        targetFriendlyName = "DiffusionGemma 26B";
      } else if (modelId === "nvidia-gpt-oss" || modelId === "gpt-oss-20b") {
        targetModel = "openai/gpt-oss-20b";
        targetFriendlyName = "GPT-OSS 20B";
      }

      // Pastikan hanya menggunakan kunci valid berformat 'nvapi-', fallback ke sistem env jika kosong/salah
      let effectiveKey = "";
      if (nvidiaApiKey && typeof nvidiaApiKey === "string" && nvidiaApiKey.trim().startsWith("nvapi-")) {
        effectiveKey = nvidiaApiKey.trim();
      } else if (process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().startsWith("nvapi-")) {
        effectiveKey = process.env.NVIDIA_API_KEY.trim();
      } else {
        effectiveKey = systemNvidiaKey;
      }

      try {
        let nvidiaRes = await callCustomOpenAIAPI(
          message,
          targetBase,
          targetModel,
          effectiveKey,
          conversationHistory,
          activeProblem,
          userName,
          14000,
          sessionLanguage,
          targetFriendlyName,
          imageAttachments,
          // Hanya percobaan pertama yang di-stream: retry setelah stream parsial
          // akan menduplikasi teks di layar pengguna.
          sink
        );

        // Jika kunci pengguna menghasilkan 401 atau gagal, otomatis coba dengan kunci sistem env
        if ((!nvidiaRes.text || nvidiaRes.status === 401) && effectiveKey !== systemNvidiaKey && systemNvidiaKey) {
          console.warn("Kunci kustom NVIDIA tidak valid atau 401, mencoba dengan kunci sistem env...");
          effectiveKey = systemNvidiaKey;
          nvidiaRes = await callCustomOpenAIAPI(
            message,
            targetBase,
            targetModel,
            effectiveKey,
            conversationHistory,
            activeProblem,
            userName,
            14000,
            sessionLanguage,
            targetFriendlyName,
            imageAttachments
          );
        }

        // Jika model besar mengalami timeout atau error, coba fallback cepat ke nemotron-3.5-bolt-e4b
        if (!nvidiaRes.text && targetModel !== "nvidia/nemotron-3.5-bolt-e4b") {
          console.warn(`Model ${targetModel} tidak merespon, mencoba fallback cepat ke nemotron-3.5-bolt-e4b...`);
          nvidiaRes = await callCustomOpenAIAPI(
            message,
            targetBase,
            "nvidia/nemotron-3.5-bolt-e4b",
            effectiveKey,
            conversationHistory,
            activeProblem,
            userName,
            10000,
            sessionLanguage,
            "Nemotron-3.5 Bolt (Fast Fallback)",
            imageAttachments
          );
          if (nvidiaRes.text) {
            targetFriendlyName = "Nemotron-3.5 Bolt (Fast Fallback)";
          }
        }

        if (nvidiaRes.text) {
          return NextResponse.json({
            reply: finalizeModelReply(nvidiaRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
            model: `${targetFriendlyName} (NVIDIA NIM)`,
            source: "nvidia-nim",
          });
        }
        if (nvidiaRes.error) {
          const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
          return NextResponse.json({
            reply: `⚠️ **Catatan NVIDIA NIM API:**\n${nvidiaRes.error}\n\n*Periksa kembali NVIDIA API Key kamu di menu Connector.*\n\n---\n\n${socraticFallback}`,
            model: "Local Socratic (NVIDIA Warning)",
            source: "fallback-with-warning",
          });
        }
      } catch (err) {
        console.warn("NVIDIA NIM call failed:", err);
      }
    }

    // 1. Panggil Custom Model API (Ollama / vLLM / LMStudio / Proxy)
    if (modelId === "custom-api") {
      const targetBase = customBaseUrl?.trim() || "http://localhost:11434/v1";
      const urlCheck = validateCustomBaseUrl(targetBase);
      if (!urlCheck.ok) {
        const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
        return NextResponse.json({
          reply: `⚠️ **URL Custom Model Ditolak:** alamat tujuan harus berupa HTTPS publik, atau localhost untuk Ollama lokal. Alamat IP privat, link-local, dan metadata cloud tidak diizinkan.\n\n*Sementara ini asisten lokal ZAP menjawab pertanyaanmu:*\n\n---\n\n${socraticFallback}`,
          model: "Local Socratic (Custom API Warning)",
          source: "fallback-with-warning",
        });
      }
      const targetModel = customModelName?.trim() || "llama3.3";
      try {
        const customRes = await callCustomOpenAIAPI(
          message,
          targetBase,
          targetModel,
          customApiKey || apiKey,
          conversationHistory,
          activeProblem,
          userName,
          12000,
          sessionLanguage,
          undefined,
          [],
          sink
        );

        if (customRes.text) {
          return NextResponse.json({
            reply: finalizeModelReply(customRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
            model: customRes.modelUsed || "Custom Model API",
            source: "custom-api",
          });
        }
        if (customRes.error) {
          const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
          return NextResponse.json({
            reply: `⚠️ **Gagal terhubung ke Custom Model:**\n${customRes.error}\n\n*Sementara ini asisten lokal ZAP menjawab pertanyaanmu:*\n\n---\n\n${socraticFallback}`,
            model: "Local Socratic (Custom API Warning)",
            source: "fallback-with-warning",
          });
        }
      } catch (err) {
        console.warn("Custom API call failed:", err);
      }
    }

    // 2. Panggil Anthropic Claude API jika dipilih
    if (modelId?.startsWith("claude")) {
      const effectiveClaudeKey =
        claudeApiKey?.trim() ||
        apiKey?.trim() ||
        process.env.ANTHROPIC_API_KEY?.trim() ||
        "";

      if (effectiveClaudeKey) {
        try {
          const claudeRes = await callClaudeAPI(
            message,
            effectiveClaudeKey,
            conversationHistory,
            activeProblem,
            modelId,
            userName,
            sessionLanguage,
            imageAttachments
          );
          if (claudeRes.text) {
            return NextResponse.json({
              reply: finalizeModelReply(claudeRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
              model: `${claudeRes.modelUsed || "Claude"} (Anthropic API)`,
              source: "claude-api",
            });
          }
          if (claudeRes.error) {
            const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
            return NextResponse.json({
              reply: `⚠️ **Catatan Anthropic Claude API (Status ${claudeRes.status || 400}):**\n${claudeRes.error}\n\n*Periksa kembali API Key kamu di menu model.*  \n*Sementara ini asisten lokal ZAP menjawab di bawah:*\n\n---\n\n${socraticFallback}`,
              model: "Local Socratic (Claude Warning)",
              source: "fallback-with-warning",
            });
          }
        } catch (err) {
          console.warn("Claude API call failed:", err);
        }
      } else {
        const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
        return NextResponse.json({
          reply: `ℹ️ **Kunci Anthropic Claude Belum Diatur:**\nMasukkan Anthropic API Key kamu pada menu pemilih model (klik tombol model di bawah), atau dapatkan di [console.anthropic.com](https://console.anthropic.com).\n\n*Sementara ini asisten Sokratik ZAP menjawab:*\n\n---\n\n${socraticFallback}`,
          model: "Claude (Local Preview)",
          source: "local-preview-no-key",
        });
      }
    }

    // 3. Panggil OpenAI ChatGPT API jika dipilih
    if (modelId?.startsWith("gpt") || modelId?.startsWith("o1") || modelId?.startsWith("o3")) {
      // Prioritaskan API Key OpenAI resmi jika ada
      let realOpenaiKey = "";
      if (openaiApiKey?.trim() && !openaiApiKey.trim().startsWith("sk-proj-chatgpt-account-")) {
        realOpenaiKey = openaiApiKey.trim();
      } else if (apiKey?.trim() && apiKey.trim().startsWith("sk-") && !apiKey.trim().startsWith("sk-proj-chatgpt-account-")) {
        realOpenaiKey = apiKey.trim();
      } else if (process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_API_KEY.trim().startsWith("sk-")) {
        realOpenaiKey = process.env.OPENAI_API_KEY.trim();
      }

      // 3a. Panggil langsung API resmi OpenAI jika kunci resmi tersedia
      if (realOpenaiKey) {
        try {
          const openaiRes = await callOpenAIAPI(
            message,
            realOpenaiKey,
            conversationHistory,
            activeProblem,
            modelId,
            userName,
            sessionLanguage,
            imageAttachments,
            sink
          );
          if (openaiRes.text) {
            return NextResponse.json({
              reply: finalizeModelReply(openaiRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
              model: `${openaiRes.modelUsed || "GPT-4o"} (OpenAI API)`,
              source: "openai-api",
            });
          }
          if (openaiRes.error) {
            const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
            return NextResponse.json({
              reply: `⚠️ **Catatan OpenAI API (Status ${openaiRes.status || 400}):**\n${openaiRes.error}\n\n*Periksa kembali OpenAI API Key kamu di menu model.*  \n*Sementara ini asisten lokal ZAP menjawab di bawah:*\n\n---\n\n${socraticFallback}`,
              model: "Local Socratic (OpenAI Warning)",
              source: "fallback-with-warning",
            });
          }
        } catch (err) {
          console.warn("OpenAI API call failed:", err);
        }
      }

      // 3b. Jika akun ChatGPT terhubung via SSO/sesi (tanpa direct billing key),
      // layani lewat gateway dengan persona GPT-4o yang konsisten tanpa membocorkan backend proxy
      const effectiveOpenaiKey = openaiApiKey?.trim() || apiKey?.trim() || "";
      if (effectiveOpenaiKey.startsWith("sk-proj-chatgpt-account-")) {
        const bazaarKey =
          bazaarlinkApiKey?.trim() ||
          process.env.BAZAARLINK_API_KEY ||
          "";
        try {
          const persona = modelId === "gpt-4o-mini" ? "GPT-4o Mini" : "GPT-4o Omni";
          const bazaarRes = await callBazaarLinkAPI(
            message,
            bazaarKey,
            conversationHistory,
            activeProblem,
            "bazaarlink-deepseek",
            userName,
            persona,
            sessionLanguage
          );
          if (bazaarRes.text) {
            return NextResponse.json({
              reply: finalizeModelReply(bazaarRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
              model: `${persona} (Akun ChatGPT Terhubung)`,
              source: "chatgpt-account-gateway",
            });
          }
        } catch (err) {
          console.warn("ChatGPT account gateway failed:", err);
        }
      }

      // 3c. Jika kunci belum diatur sama sekali
      const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
      return NextResponse.json({
        reply: `ℹ️ **Kunci OpenAI ChatGPT Belum Diatur:**\nMasukkan OpenAI API Key kamu pada menu pemilih model (klik tombol model di bawah), atau dapatkan di [platform.openai.com](https://platform.openai.com).\n\n*Sementara ini asisten Sokratik ZAP menjawab:*\n\n---\n\n${socraticFallback}`,
        model: "ChatGPT (Local Preview)",
        source: "local-preview-no-key",
      });
    }

    const isBazaarLink = modelId?.startsWith("bazaarlink") || modelId?.startsWith("deepseek");

    // 1. Panggil BazaarLink AI Gateway (DeepSeek, Qwen, Auto Free Router) jika dipilih
    if (isBazaarLink) {
      const effectiveBazaarLinkKey =
        bazaarlinkApiKey?.trim() ||
        (isBazaarLink ? apiKey?.trim() : "") ||
        process.env.BAZAARLINK_API_KEY?.trim() ||
        "";

      try {
        const blResult = await callBazaarLinkAPI(
          message,
          effectiveBazaarLinkKey,
          conversationHistory,
          activeProblem,
          modelId,
          userName
        );

        if (blResult.text) {
          const guardedReply = finalizeModelReply(blResult.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable });
          return NextResponse.json({
            reply: guardedReply,
            model: `${blResult.modelUsed || "BazaarLink AI Gateway"}`,
            source: "bazaarlink-api",
          });
        }

        if (blResult.error) {
          console.warn("BazaarLink API returned error:", blResult);
          const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
          return NextResponse.json({
            reply: `⚠️ **Catatan Koneksi BazaarLink API (Status ${blResult.status || 400}):**\n${blResult.error}\n\n*Jika saldo kredit $0, pilih model tier gratis (:free) seperti BazaarLink Auto, DeepSeek V4, atau Qwen 3.7.*  \n*Sementara ini, asisten lokal kami menjawab pertanyaanmu di bawah:*\n\n---\n\n${socraticFallback}`,
            model: "Local Socratic (BazaarLink Warning)",
            source: "fallback-with-warning",
          });
        }
      } catch (blError) {
        console.warn("BazaarLink API call failed with exception:", blError);
      }
    }

    const isMistral = modelId?.startsWith("codestral") || modelId?.startsWith("mistral");

    // 2. Panggil Mistral AI (Codestral 22B / Mistral Large) jika dipilih
    if (isMistral) {
      const effectiveMistralKey =
        mistralApiKey?.trim() ||
        (isMistral ? apiKey?.trim() : "") ||
        process.env.MISTRAL_API_KEY?.trim() ||
        "";

      if (effectiveMistralKey) {
        try {
          const mistralResult = await callMistralAPI(
            message,
            effectiveMistralKey,
            conversationHistory,
            activeProblem,
            modelId,
            userName,
            sessionLanguage
          );

          if (mistralResult.text) {
            const guardedReply = finalizeModelReply(mistralResult.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable });
            return NextResponse.json({
              reply: guardedReply,
              model: `${mistralResult.modelUsed || "Codestral 22B"} (Mistral Cloud API)`,
              source: "mistral-api",
            });
          }

          if (mistralResult.error) {
            console.warn("Mistral API returned error:", mistralResult);
            const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
            return NextResponse.json({
              reply: `⚠️ **Catatan Koneksi Mistral AI API (Status ${mistralResult.status || 400}):**\n${mistralResult.error}\n\n*Periksa kembali API Key kamu di menu model (kanan atas) atau buat kunci baru di [Mistral Console](https://console.mistral.ai).*  \n*Sementara ini, asisten lokal kami menjawab pertanyaanmu di bawah:*\n\n---\n\n${socraticFallback}`,
              model: "Local Socratic (Mistral API Warning)",
              source: "fallback-with-warning",
            });
          }
        } catch (mistralError) {
          console.warn("Mistral API call failed with exception:", mistralError);
        }
      } else {
        // Model Mistral dipilih tapi API Key belum diisi
        const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
        const modelLabel = modelId?.includes("large") ? "Mistral Large" : "Codestral 22B";
        return NextResponse.json({
          reply: `ℹ️ **Kunci Mistral AI (${modelLabel}) Belum Diatur:**\nKamu memilih model **${modelLabel}**, tetapi API Key belum dimasukkan.\n\nSilakan masukkan Mistral API Key pada menu pemilih model di samping tombol kirim (atau tambahkan di file \`frontend/.env.local\` sebagai \`MISTRAL_API_KEY\`). Kamu bisa mendapatkannya secara gratis di [console.mistral.ai](https://console.mistral.ai).\n\n*Sementara ini, asisten Sokratik lokal ZAP menjawab pertanyaanmu:*\n\n---\n\n${socraticFallback}`,
          model: `${modelLabel} (Local Preview)`,
          source: "local-preview-no-key",
        });
      }
    }

    // 2. Panggil Google Gemini API jika model Gemini dipilih
    if (modelId?.startsWith("gemini")) {
      if (effectiveGeminiKey) {
        try {
          const geminiResult = await callGeminiAPI(
            message,
            effectiveGeminiKey,
            conversationHistory,
            activeProblem,
            modelId,
            userName,
            sessionLanguage,
            imageAttachments
          );
          
          if (geminiResult.text) {
            const guardedReply = finalizeModelReply(geminiResult.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable });
            return NextResponse.json({
              reply: guardedReply,
              model: `${geminiResult.modelUsed || "Gemini 2.0 Flash"} (Google Cloud API)`,
              source: "gemini-api",
            });
          }

          // Jika API Key diberikan tetapi Google API mengembalikan error eksplisit (misal: 400 Invalid Key / 403 / 429)
          if (geminiResult.error) {
            console.warn("Gemini API returned error:", geminiResult);
            const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
            
            return NextResponse.json({
              reply: `⚠️ **Catatan Koneksi Google Gemini API (Status ${geminiResult.status || 400}):**\n${geminiResult.error}\n\n*Periksa kembali API Key kamu di menu model (kanan atas) atau buat kunci baru di [Google AI Studio](https://aistudio.google.com).*  \n*Sementara ini, asisten lokal kami menjawab pertanyaanmu di bawah:*\n\n---\n\n${socraticFallback}`,
              model: "Local Socratic (API Warning)",
              source: "fallback-with-warning",
            });
          }
        } catch (geminiError) {
          console.warn("Gemini API call failed with exception:", geminiError);
        }
      } else {
        const socraticFallback = generateSocraticFallbackResponse(message, activeProblem);
        return NextResponse.json({
          reply: `ℹ️ **Kunci Google Gemini Belum Diatur:**\nMasukkan Google AI Studio Key kamu pada menu model di bawah, atau dapatkan di [aistudio.google.com](https://aistudio.google.com).\n\n*Sementara ini asisten Sokratik ZAP menjawab:*\n\n---\n\n${socraticFallback}`,
          model: "Gemini (Local Preview)",
          source: "local-preview-no-key",
        });
      }
    }

    // 2. Jika pengguna memilih mesin SymPy lokal, langsung gunakan respons instan (0 ms latency)
    if (modelId === "sympy-cfl") {
      const socraticReply = generateSocraticFallbackResponse(message, activeProblem);
      return NextResponse.json({
        reply: socraticReply,
        model: "SymPy CFL Engine (Local Deterministic 0ms)",
        source: "local-sympy",
      });
    }

    // 2b. Model platform bawaan server (opsional, diatur lewat env):
    // Bila tidak ada kunci Gemini dan server dikonfigurasi dengan endpoint
    // kompatibel OpenAI (mis. DeepSeek lewat NVIDIA NIM), layani chat dari sana.
    const platformBase = process.env.ZAP_PLATFORM_LLM_BASE_URL?.trim();
    const platformModel = process.env.ZAP_PLATFORM_LLM_MODEL?.trim();
    const platformKey = process.env.ZAP_PLATFORM_LLM_API_KEY?.trim();
    if (platformBase && platformModel && platformKey) {
      try {
        const platformRes = await callCustomOpenAIAPI(
          message,
          platformBase,
          platformModel,
          platformKey,
          conversationHistory,
          activeProblem,
          userName,
          90000,
          sessionLanguage,
          undefined,
          [],
          sink
        );
        if (platformRes.text) {
          return NextResponse.json({
            reply: finalizeModelReply(platformRes.text, generateSocraticFallbackResponse(message, activeProblem), { targetVariable }),
            model: platformRes.modelUsed || platformModel,
            source: "platform-llm",
          });
        }
        console.warn("Platform LLM returned error:", platformRes.error);
      } catch (platformErr) {
        console.warn("Platform LLM call failed:", platformErr);
      }
    }

    // 3. Fallback Offline: Gunakan Built-in Socratic Cognitive Agent
    const socraticReply = generateSocraticFallbackResponse(message, activeProblem);

    return NextResponse.json({
      reply: socraticReply,
      model: "ZAP Socratic Engine (Local Offline)",
      source: "built-in-socratic",
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada layanan obrolan" },
      { status: 500 }
    );
  }
}

/**
 * Wrapper POST publik.
 *
 * Dua mode:
 * - **Streaming** (`body.stream === true`): balasan dikirim sebagai SSE
 *   (`event: delta` per potongan teks, lalu `event: done` berisi JSON final
 *   yang sudah lolos guardrail). Ini menghilangkan persepsi "membeku" saat
 *   provider butuh 5-40 detik.
 * - **Non-streaming**: perilaku lama — satu JSON utuh, dengan
 *   `corpus_references` disisipkan agar UI menampilkan "Sumber & acuan".
 *
 * Potongan teks di mode streaming tetap disanitasi per batas kalimat/baris
 * sebelum dikirim, dan teks final pada `done` adalah sumber kebenaran (klien
 * mengganti isi gelembung dengan teks final tersebut).
 */
export async function POST(req: Request) {
  let body: ChatRequestBody | null = null;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    body = null;
  }

  const wantsStream = Boolean(body && (body as ChatRequestBody & { stream?: boolean }).stream);

  if (!wantsStream || !body) {
    const res = await handleChatPost(req, body ?? undefined);
    const refs = corpusRefsByRequest.get(req);
    if (!refs || refs.length === 0) return res;
    try {
      const data = await res.clone().json();
      if (
        data &&
        typeof data === "object" &&
        typeof (data as { reply?: unknown }).reply === "string" &&
        !("corpus_references" in data)
      ) {
        const headers = new Headers(res.headers);
        headers.delete("content-length");
        return NextResponse.json(
          { ...(data as Record<string, unknown>), corpus_references: refs },
          { status: res.status, headers }
        );
      }
    } catch {
      // Respons non-JSON: teruskan apa adanya
    }
    return res;
  }

  const encoder = new TextEncoder();
  const targetVariable =
    String(body.targetVariable || body.targetVar || "x").trim().slice(0, 4) || "x";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Buffer anti-potong: hanya lepas teks pada batas baris/kalimat supaya
      // pola jawaban (`x = 4`, `$$...$$`) tidak terbelah antar potongan.
      let buffer = "";
      const flush = (force: boolean) => {
        if (!buffer) return;
        let cut = -1;
        for (const sep of ["\n", ". ", "! ", "? ", "；", "; "]) {
          const idx = buffer.lastIndexOf(sep);
          if (idx > cut) cut = idx + sep.length;
        }
        if (force) cut = buffer.length;
        // Tahan ~48 karakter terakhir agar pola pendek tetap utuh.
        if (!force && (cut <= 0 || buffer.length - cut < 48)) return;
        const chunk = buffer.slice(0, cut);
        buffer = buffer.slice(cut);
        if (!chunk) return;
        send("delta", { t: sanitizeZeroAnswer(chunk, { targetVariable }) });
      };

      const sink: DeltaSink = (chunk) => {
        if (typeof chunk !== "string" || !chunk) return;
        buffer += chunk;
        // Jangan biarkan buffer tumbuh tanpa batas bila model mengirim paragraf
        // panjang tanpa baris baru.
        if (buffer.length > 600) flush(true);
        else flush(false);
      };

      try {
        send("meta", { targetVariable });
        const res = await handleChatPost(req, body, sink);
        flush(true);
        let payload: Record<string, unknown> | null = null;
        try {
          payload = (await res.json()) as Record<string, unknown>;
        } catch {
          payload = null;
        }
        const refs = corpusRefsByRequest.get(req);
        if (payload && refs && refs.length > 0 && !("corpus_references" in payload)) {
          payload = { ...payload, corpus_references: refs };
        }
        send("done", payload ?? { error: "Respons tidak valid" });
      } catch (err) {
        flush(true);
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Cegah buffering di reverse proxy (nginx) agar token langsung sampai.
      "X-Accel-Buffering": "no",
    },
  });
}

// Cache nama model resmi yang terbukti sukses dan aktif di akun API Key ini
let cachedWorkingModel: string | null = null;

/**
 * Panggilan ultra-cepat ke Google Gemini REST API (v1beta).
 * Mendukung memori percakapan (multi-turn conversationHistory),
 * deteksi otomatis model resmi via ListModels,
 * serta failover dengan batas timeout ketat (< 5 detik) agar bebas dari error 404.
 */
async function callGeminiAPI(
  userMessage: string,
  apiKey: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  modelId?: string,
  userName?: string,
  sessionLanguage: string = "Bahasa Indonesia",
  images: AttachedImageItem[] = []
): Promise<GeminiCallResult> {
  const studentName = userName?.trim() || "Siswa";
  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    "Google Gemini 2.0 Flash",
    sessionLanguage
  );

  // 1. Konstruksi Riwayat Percakapan (Memory) Sesuai Spesifikasi Google Gemini API
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];

  if (conversationHistory && conversationHistory.length > 0) {
    // Ambil hingga 20 turn terakhir untuk keseimbangan konteks & kecepatan
    const recentHistory = conversationHistory.slice(-20);
    for (const turn of recentHistory) {
      const geminiRole: "user" | "model" = turn.role === "assistant" ? "model" : "user";
      const text = turn.content?.trim();
      if (!text) continue;

      if (contents.length > 0 && contents[contents.length - 1].role === geminiRole) {
        // Gabungkan pesan berurutan dengan role sama
        const currentText = contents[contents.length - 1].parts[0]?.text || "";
        contents[contents.length - 1].parts[0] = { text: currentText + "\n" + text };
      } else {
        contents.push({ role: geminiRole, parts: [{ text }] });
      }
    }
  }

  // Tambahkan userMessage terakhir beserta gambar multimodal jika ada
  const userParts: GeminiPart[] = [{ text: userMessage }];
  for (const img of images) {
    userParts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.pureBase64,
      },
    });
  }

  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    const lastParts = contents[contents.length - 1].parts;
    if (lastParts[0] && typeof lastParts[0].text === "string") {
      lastParts[0].text += "\n" + userMessage;
    }
    for (const img of images) {
      lastParts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.pureBase64,
        },
      });
    }
  } else {
    contents.push({ role: "user", parts: userParts });
  }

  // Gemini API mewajibkan pesan pertama selalu ber-role 'user'
  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstructionText }],
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800, // Cukup leluasa untuk penjelasan cerdas & mendalam
    },
  };

  // Helper pemanggil model tunggal dengan batas timeout 5s
  const invokeModel = async (
    modelName: string
  ): Promise<{ success: boolean; text?: string; error?: string; status?: number }> => {
    const clean = modelName.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          cachedWorkingModel = clean;
          return { success: true, text: candidate };
        }
      }

      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
      return { success: false, error: errMsg, status: res.status };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        status: 500,
      };
    }
  };

  // 2. Jalur Cepat: Coba langsung model yang diminta atau model yang sudah terbukti sukses
  const fastCandidate =
    modelId === "gemini-1.5-pro"
      ? "gemini-1.5-pro"
      : modelId === "gemini-2.0-flash" || modelId === "gemini-2.0-flash-vision" || modelId === "gemini-vision"
      ? "gemini-2.0-flash"
      : modelId === "gemini-1.5-flash"
      ? "gemini-1.5-flash"
      : cachedWorkingModel || "gemini-2.0-flash";

  const fastAttempt = await invokeModel(fastCandidate);
  if (fastAttempt.success && fastAttempt.text) {
    return { text: fastAttempt.text, modelUsed: fastCandidate };
  }

  // Jika error adalah API key invalid (400 / 403), langsung laporkan tanpa buang waktu
  if (fastAttempt.status === 400 || fastAttempt.status === 403) {
    return { error: fastAttempt.error, status: fastAttempt.status, modelUsed: fastCandidate };
  }

  // 3. Jalur Adaptif: Jika 404 (nama model tidak cocok di akun ini), tanya langsung ke Google AI Studio daftar model resminya
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      const modelsList: Array<{ name: string; supportedGenerationMethods?: string[] }> =
        listData?.models || [];

      // Filter hanya model yang mendukung generateContent
      const supported = modelsList.filter((m) =>
        m.supportedGenerationMethods?.includes("generateContent")
      );

      // Urutkan prioritas model teks murni: 2.0-flash -> 1.5-flash -> 1.5-pro
      const scored = supported.map((m) => {
        let score = 0;
        const n = m.name.toLowerCase();
        if (n.includes("2.0-flash")) score += 50;
        else if (n.includes("1.5-flash")) score += 40;
        else if (n.includes("1.5-pro")) score += 20;
        return { name: m.name, score };
      });
      scored.sort((a, b) => b.score - a.score);

      for (const item of scored) {
        const attempt = await invokeModel(item.name);
        if (attempt.success && attempt.text) {
          return { text: attempt.text, modelUsed: item.name.replace(/^models\//, "") };
        }
      }
    }
  } catch (listErr) {
    console.warn("Dynamic model discovery failed:", listErr);
  }

  // Fallback terakhir: coba gemini-1.5-flash
  const finalAttempt = await invokeModel("gemini-1.5-flash");
  if (finalAttempt.success && finalAttempt.text) {
    return { text: finalAttempt.text, modelUsed: "gemini-1.5-flash" };
  }

  return {
    error: fastAttempt.error || finalAttempt.error || "Tidak dapat menghasilkan respon dari model Gemini",
    status: fastAttempt.status || 500,
  };
}

/**
 * Panggilan ke Mistral AI Chat Completion REST API (Codestral 22B / Mistral Large).
 * Mendukung multi-turn chat memory, failover endpoint codestral.mistral.ai,
 * serta integrasi penjagaan Zero-Answer Policy.
 */
async function callMistralAPI(
  userMessage: string,
  apiKey: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  modelId?: string,
  userName?: string,
  sessionLanguage: string = "Bahasa Indonesia"
): Promise<MistralCallResult> {
  const studentName = userName?.trim() || "Siswa";
  const targetModel =
    modelId === "mistral-large-latest" || modelId === "mistral-large"
      ? "mistral-large-latest"
      : "codestral-latest";

  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    targetModel.includes("codestral") ? "Mistral Codestral 22B" : "Mistral Large",
    sessionLanguage
  );

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemInstructionText },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const turn of recentHistory) {
      const text = turn.content?.trim();
      if (!text) continue;
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: text,
      });
    }
  }

  messages.push({
    role: "user",
    content: userMessage,
  });

  const payload = {
    model: targetModel,
    messages: messages,
    temperature: 0.7,
    max_tokens: 800,
  };

  const endpoints = [
    "https://api.mistral.ai/v1/chat/completions",
  ];
  if (targetModel.includes("codestral")) {
    endpoints.push("https://codestral.mistral.ai/v1/chat/completions");
  }

  let lastError = "";
  let lastStatus = 500;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(7000),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data?.choices?.[0]?.message?.content;
        if (candidate) {
          return {
            text: candidate,
            modelUsed: targetModel.includes("codestral") ? "Codestral 22B" : "Mistral Large",
          };
        }
      }

      const errJson = await res.json().catch(() => null);
      lastStatus = res.status;
      lastError = errJson?.message || errJson?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        return { error: lastError, status: lastStatus, modelUsed: targetModel };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatus = 500;
    }
  }

  return {
    error: lastError || "Tidak dapat menghasilkan respon dari Mistral AI API",
    status: lastStatus,
    modelUsed: targetModel,
  };
}

/**
 * Panggilan ke BazaarLink AI Gateway (OpenAI-compatible).
 * Mendukung Auto Router gratis, DeepSeek V4 Flash, dan Qwen 3.7.
 */
async function callBazaarLinkAPI(
  userMessage: string,
  apiKey: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  modelId?: string,
  userName?: string,
  overridePersona?: string,
  sessionLanguage: string = "Bahasa Indonesia"
): Promise<BazaarLinkCallResult> {
  const studentName = userName?.trim() || "Siswa";

  let targetModel = "auto:free";
  let defaultPersona = "ChatZAP Smart Router";
  if (modelId === "bazaarlink-deepseek") {
    targetModel = "deepseek/deepseek-v4-flash-0731free:free";
    defaultPersona = "DeepSeek V4 Flash";
  } else if (modelId === "bazaarlink-qwen") {
    targetModel = "qwen/qwen3.7-flash:free";
    defaultPersona = "Qwen 3.7 Flash";
  } else if (modelId === "bazaarlink-auto") {
    targetModel = "auto:free";
    defaultPersona = "ChatZAP Smart Router";
  }

  const effectivePersona = overridePersona || defaultPersona;

  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    effectivePersona,
    sessionLanguage
  );

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemInstructionText },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const turn of recentHistory) {
      const text = turn.content?.trim();
      if (!text) continue;
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: text,
      });
    }
  }

  messages.push({
    role: "user",
    content: userMessage,
  });

  const payload = {
    model: targetModel,
    messages: messages,
    temperature: 0.7,
    max_tokens: 800,
  };

  try {
    const res = await fetch("https://api.bazaarlink.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const choice = data?.choices?.[0];
      const text = choice?.message?.content;
      const modelReturned = data?.model || targetModel;
      if (text) {
        let label = "BazaarLink Smart Router";
        if (modelReturned.includes("deepseek")) {
          label = "DeepSeek V4 (BazaarLink Free)";
        } else if (modelReturned.includes("qwen")) {
          label = "Qwen 3.7 Flash (BazaarLink Free)";
        }
        return {
          text,
          modelUsed: label,
        };
      }
    }

    const errJson = await res.json().catch(() => null);
    const errMsg = errJson?.error?.message || errJson?.message || `HTTP ${res.status}`;
    return {
      error: errMsg,
      status: res.status,
      modelUsed: targetModel,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      status: 500,
      modelUsed: targetModel,
    };
  }
}

/**
 * Panggilan ke Anthropic Messages API (Claude 3.7 / 3.5 Sonnet).
 */
async function callClaudeAPI(
  userMessage: string,
  apiKey: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  modelId?: string,
  userName?: string,
  sessionLanguage: string = "Bahasa Indonesia",
  images: AttachedImageItem[] = []
): Promise<UniversalCallResult> {
  const studentName = userName?.trim() || "Siswa";
  const targetModel =
    modelId === "claude-3-7-sonnet"
      ? "claude-3-7-sonnet-20250219"
      : "claude-3-5-sonnet-20241022";

  const persona = targetModel.includes("3-7") ? "Claude 3.7 Sonnet" : "Claude 3.5 Sonnet";
  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    persona,
    sessionLanguage
  );

  const messages: Array<{ role: "user" | "assistant"; content: ClaudeContent }> = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory.slice(-20)) {
      if (turn.content?.trim()) {
        messages.push({ role: turn.role, content: turn.content.trim() });
      }
    }
  }

  if (images && images.length > 0) {
    const claudeContent: Array<ClaudeTextBlock | ClaudeImageBlock> = [
      ...images.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mimeType,
          data: img.pureBase64,
        },
      })),
      { type: "text" as const, text: userMessage },
    ];
    messages.push({ role: "user", content: claudeContent });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: targetModel,
        system: systemInstructionText,
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.content?.[0]?.text;
      if (text) {
        return { text, modelUsed: targetModel.includes("3-7") ? "Claude 3.7 Sonnet" : "Claude 3.5 Sonnet" };
      }
    }

    const errJson = await res.json().catch(() => null);
    return {
      error: errJson?.error?.message || `HTTP ${res.status}`,
      status: res.status,
      modelUsed: targetModel,
    };
  } catch (err) {
    return { error: String(err), status: 500, modelUsed: targetModel };
  }
}

/**
 * Panggilan ke OpenAI API (GPT-4o / GPT-4o-mini).
 */
async function callOpenAIAPI(
  userMessage: string,
  apiKey: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  modelId?: string,
  userName?: string,
  sessionLanguage: string = "Bahasa Indonesia",
  images: AttachedImageItem[] = [],
  onDelta?: DeltaSink
): Promise<UniversalCallResult> {
  const studentName = userName?.trim() || "Siswa";
  const targetModel = modelId === "gpt-4o-mini" ? "gpt-4o-mini" : "gpt-4o";

  const persona = targetModel === "gpt-4o-mini" ? "GPT-4o Mini" : "GPT-4o Omni";
  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    persona,
    sessionLanguage
  );

  const messages: Array<{ role: "system" | "user" | "assistant"; content: OpenAIMessageContent }> = [
    { role: "system", content: systemInstructionText },
  ];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory.slice(-20)) {
      if (turn.content?.trim()) {
        messages.push({ role: turn.role, content: turn.content.trim() });
      }
    }
  }

  if (images && images.length > 0) {
    const multiContent: Array<OpenAITextPart | OpenAIImagePart> = [
      { type: "text" as const, text: userMessage },
      ...images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];
    messages.push({ role: "user", content: multiContent });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
        ...(onDelta ? { stream: true } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (onDelta && res.body && contentType.includes("event-stream")) {
        const streamed = await consumeOpenAICompatibleStream(res, onDelta);
        if (streamed.trim()) {
          return { text: streamed, modelUsed: targetModel.toUpperCase() };
        }
      } else {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return { text, modelUsed: targetModel.toUpperCase() };
        }
      }
    }

    const errJson = await res.json().catch(() => null);
    return {
      error: errJson?.error?.message || `HTTP ${res.status}`,
      status: res.status,
      modelUsed: targetModel,
    };
  } catch (err) {
    return { error: String(err), status: 500, modelUsed: targetModel };
  }
}

/**
 * Panggilan ke Custom Model API (OpenAI-Compatible endpoint: Ollama, vLLM, LMStudio, Proxy).
 */
async function callCustomOpenAIAPI(
  userMessage: string,
  baseUrl: string,
  modelName: string,
  apiKey?: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  activeProblem?: ActiveProblemContext | null,
  userName?: string,
  timeoutMs: number = 12000,
  sessionLanguage: string = "Bahasa Indonesia",
  displayName?: string,
  images: AttachedImageItem[] = [],
  onDelta?: DeltaSink
): Promise<UniversalCallResult> {
  const studentName = userName?.trim() || "Siswa";
  const cleanBase = (baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "");
  const targetUrl = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
  const targetModel = modelName?.trim() || "default";

  const systemInstructionText = buildZAPSystemPrompt(
    studentName,
    activeProblem,
    displayName || targetModel,
    sessionLanguage
  );

  const messages: Array<{ role: "system" | "user" | "assistant"; content: OpenAIMessageContent }> = [
    { role: "system", content: systemInstructionText },
  ];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory.slice(-20)) {
      if (turn.content?.trim()) {
        messages.push({ role: turn.role, content: turn.content.trim() });
      }
    }
  }

  if (images && images.length > 0) {
    const multiContent: Array<OpenAITextPart | OpenAIImagePart> = [
      { type: "text" as const, text: userMessage },
      ...images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];
    messages.push({ role: "user", content: multiContent });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.6,
        max_tokens: 3000,
        ...(onDelta ? { stream: true } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) {
      // Jalur streaming: server mengirim SSE per token. Bila endpoint tidak
      // mendukung, `res.body`/content-type tidak akan cocok dan kita jatuh ke
      // pembacaan JSON biasa di bawah.
      const contentType = res.headers.get("content-type") || "";
      if (onDelta && res.body && contentType.includes("event-stream")) {
        const streamed = await consumeOpenAICompatibleStream(res, onDelta);
        if (streamed.trim()) {
          return { text: cleanModelResponse(streamed), modelUsed: targetModel };
        }
        return { error: "Streaming model kosong", status: 200, modelUsed: targetModel };
      }

      const data = await res.json();
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      let text = msg?.content;
      if (!text && msg?.reasoning_content) {
        text = cleanModelResponse(msg.reasoning_content);
      } else if (text) {
        text = cleanModelResponse(text);
      }
      if (text && !text.endsWith("Let's draft:") && text.trim().length > 0) {
        return { text, modelUsed: targetModel };
      }
      return {
        error: "Respons model kosong",
        status: 200,
        modelUsed: targetModel,
      };
    }

    const errJson = await res.json().catch(() => null);
    return {
      error: errJson?.error?.message || errJson?.message || `HTTP ${res.status}`,
      status: res.status,
      modelUsed: targetModel,
    };
  } catch (err) {
    return { error: String(err), status: 500, modelUsed: targetModel };
  }
}



/**
 * Built-in Socratic Cognitive Agent
 * Memberikan respons cerdas dan kontekstual secara lokal tanpa dependensi eksternal.
 * Semua keluaran WAJIB melewati sanitizeZeroAnswer (Zero-Answer Policy) di
 * wrapper generateSocraticFallbackResponse, termasuk jalur fallback lokal.
 */
function generateSocraticFallbackResponse(
  message: string,
  activeProblem?: ActiveProblemContext | null
): string {
  return sanitizeZeroAnswer(buildSocraticFallbackResponse(message, activeProblem));
}

function buildSocraticFallbackResponse(
  message: string,
  activeProblem?: ActiveProblemContext | null
): string {
  const lower = message.toLowerCase().trim();

  // 0. PERMINTAAN VISUALISASI / RUMUS GEOMETRI (BALOK, KUBUS, TABUNG)
  if (lower.includes("balok")) {
    return `Halo! Berikut adalah rumus-rumus penting untuk bangun ruang **Balok** (prisma segiempat):

Misalkan ukuran rusuk balok adalah:
- Panjang = $p$
- Lebar = $l$
- Tinggi = $t$

---

### 1. Volume Balok ($V$)
Menghitung seberapa banyak ruang isi di dalam balok:
$$ V = p \\times l \\times t $$

### 2. Luas Permukaan Balok ($L$)
Jumlah total luas dari ke-6 bidang sisi persegi panjangnya:
$$ L = 2(pl + pt + lt) $$

### 3. Panjang Diagonal Ruang ($d$)
Garis lurus terjauh yang menghubungkan dua sudut berlawanan melintasi ruang balok:
$$ d = \\sqrt{p^2 + l^2 + t^2} $$

### 4. Keliling Rangka / Total Panjang Rusuk ($K$)
Panjang total kawat yang dibutuhkan untuk membentuk kerangka balok:
$$ K = 4(p + l + t) $$

---
Apakah kamu ingin memvisualisasikan model Balok 3D di Papan Tulis Pintar, atau ada soal latihan balok yang ingin kamu selesaikan bersama?`;
  }

  const isGeometryRequest =
    /\b(kubus|cube|balok|tabung|cylinder|silinder|kerucut|cone|bola|sphere|prisma|limas|parabola|pelana)\b/i.test(lower) &&
    /\b(buatkan|buat|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|3d|ukuran|sisi|rusuk|panjang|jari-jari|rumus)\b/i.test(lower);

  if (isGeometryRequest) {
    if (lower.includes("kubus") || lower.includes("cube")) {
      const numMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:cm|m|mm)?/);
      const s = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : 10;
      return `Halo! Berikut adalah sifat matematis dan rumus geometri ruang untuk **Kubus** (panjang rusuk $s = ${s}\\text{ cm}$):

- **Panjang Rusuk ($s$):** $${s}\\text{ cm}$
- **Diagonal Bidang ($d_b$):** $$d_b = s\\sqrt{2}$$
- **Diagonal Ruang ($d_r$):** $$d_r = s\\sqrt{3}$$
- **Luas Permukaan ($L$):** $$L = 6s^2$$
- **Volume ($V$):** $$V = s^3$$

*Catatan Zero Answer Policy ZAP:* Kami tidak menghitungkan angka jadi secara langsung agar kamu dapat mengasah daya hitung mandiri. Dengan panjang rusuk $s = ${s}\\text{ cm}$, coba masukkan nilai $s$ ke rumus di atas. Berapakah hasil yang kamu dapatkan?

Silakan berinteraksi dengan kanvas 3D di samping atau ketik *"buatkan 3d cube"* jika ingin melihat visualisasi ruangnya!`;
    }
    if (lower.includes("tabung") || lower.includes("cylinder") || lower.includes("silinder")) {
      return `Tentu! Model **Tabung Silinder 3D** memiliki rumus volume $V = \\pi r^2 t$ dan luas selimut $L_s = 2\\pi r t$. Ketik *"buatkan tabung r=7 t=12"* untuk melihat simulasi 3D di Papan Tulis Pintar!`;
    }
  }

  // 1. DEFINISI & KONSEP ALJABAR
  const isAskingAlgebraDefinition =
    lower.includes("apa itu aljabar") ||
    lower.includes("aljabar itu apa") ||
    lower.includes("arti aljabar") ||
    lower.includes("maksud aljabar") ||
    lower.includes("kenapa belajar aljabar") ||
    lower === "aljabar";

  if (isAskingAlgebraDefinition) {
    return `**Aljabar** adalah cabang matematika yang menggunakan simbol atau huruf (seperti $x$, $y$, $a$, $b$) untuk mewakili angka atau kuantitas yang belum diketahui (*variabel*).

**Mengapa Aljabar Sangat Penting?**
1. **Menemukan Nilai yang Belum Diketahui:** Aljabar membantu kita menyelesaikan teka-teki kuantitatif secara sistematis, misalnya teka-teki $2x + 4 = 10$: nilai $x$ kamu temukan sendiri dengan memindahkan ruas secara seimbang.
2. **Merumuskan Pola & Hukum Umum:** Alih-alih menghitung satu per satu, kita bisa merumuskan hubungan umum seperti ekspansi kuadrat $(a + b)^2 = a^2 + 2ab + b^2$.
3. **Fondasi Sains & Teknologi:** Dunia kecerdasan buatan, pemrograman, grafika komputer, hingga rumus fisika modern semuanya dirancang menggunakan bahasa aljabar.

Apakah ada topik aljabar tertentu yang ingin kamu pelajari (seperti faktorisasi, kuadrat sempurna, atau pindah ruas)? Atau kamu ingin menguji langkah coretan rumus yang sedang kamu hitung?`;
  }

  // 2. SAPAAN & INTERAKSI AWAL
  const isGreeting =
    /^(hai|halo|pagi|siang|malam|sore|assalamu|permisi|tes|ping|woi|hei|hi|hello)/.test(lower) ||
    lower === "hai" ||
    lower === "halo";

  const isAskPermission =
    lower.includes("mau nanya") ||
    lower.includes("bisa nanya") ||
    lower.includes("nanya dong") ||
    lower.includes("mau tanya") ||
    lower.includes("boleh tanya") ||
    lower === "tanya";

  if (isGreeting || isAskPermission) {
    if (activeProblem && activeProblem.steps && activeProblem.steps.length > 0) {
      const firstStep = activeProblem.steps[0];
      return `Halo! Tentu saja, mau nanya tentang apa? Apakah terkait penurunan aljabar $${firstStep}$ yang sedang kita bahas, atau ada konsep lain yang membingungkanmu? Tanyakan saja!`;
    }
    return `Halo! Aku ZAP, asisten diagnostik aljabar kamu. Ada konsep matematika atau langkah penurunan rumus yang ingin kamu tanyakan atau uji bersama? Kamu bisa bertanya bebas atau langsung memasukkan baris aljabar coretanmu!`;
  }

  // 3. PERTANYAAN TENTANG KESALAHAN ("Kenapa salah?", "Kenapa baris 2?")
  const isAskingWhyWrong =
    lower.includes("kenapa salah") ||
    lower.includes("salahnya di mana") ||
    lower.includes("kenapa baris") ||
    lower.includes("kok salah") ||
    lower.includes("kenapa ga sama") ||
    lower.includes("kenapa beda") ||
    lower.includes("mengapa salah") ||
    lower.includes("dimana salahnya");

  if (isAskingWhyWrong) {
    if (activeProblem?.misconceptionType === "DISTRIBUTIVE_EXPANSION_ILLUSION" || activeProblem?.faultLine === 2) {
      return `Di baris ke-2, kamu mengekspansi $(x + 3)^2$ menjadi $x^2 + 9$. 

Kesalahan umum di sini adalah mengira tanda kuadrat dapat langsung didistribusikan ke masing-masing suku (seperti $(a+b)^2 = a^2 + b^2$). Padahal arti kuadrat adalah mengalikan suku tersebut dengan dirinya sendiri:
$$ (x + 3)^2 = (x + 3)(x + 3) $$

Jika dikalikan suku-demi-suku secara distributif (skema pelangi):
1. $x \\cdot x = x^2$
2. $x \\cdot 3 = 3x$
3. $3 \\cdot x = 3x$
4. $3 \\cdot 3 = 9$

Ada dua suku tengah $3x + 3x = 6x$. Suku $6x$ inilah yang hilang di baris ke-2!`;
    }

    if (activeProblem?.misconceptionType === "ROOT_LOSS") {
      return `Kesalahan terjadi saat menarik akar kuadrat pada kedua ruas. Ingat bahwa persamaan kuadrat umumnya memiliki **dua** kemungkinan akar yang berlawanan tanda, karena bilangan negatif yang dikuadratkan juga menghasilkan nilai positif yang sama. Jika kamu hanya mengambil akar positif, kamu kehilangan separuh dari himpunan penyelesaiannya! Coba periksa: bilangan apa saja yang kuadratnya sama dengan ruas kanan persamaanmu?`;
    }

    if (activeProblem?.explanation) {
      return `Mari kita perhatikan baris ke-${activeProblem.faultLine || 2}:
${activeProblem.explanation}

${activeProblem.counterExample?.contradiction_statement ? `Bukti nyata: ${activeProblem.counterExample.contradiction_statement}` : ""}

Coba telaah kembali aturan operasi yang menghubungkan baris tersebut dengan baris sebelumnya.`;
    }

    return `Untuk memeriksa letak kesalahan, sistem kami membandingkan ekuivalensi aljabar baris demi baris menggunakan SymPy CAS. Masukkan baris coretan aljabarmu dan sistem akan menandai titik patah logikanya!`;
  }

  // 4. PERTANYAAN TENTANG KONSEP KUADRAT SUKU DUA / SUKU TENGAH
  const isAskingBinomial =
    lower.includes("6x") ||
    lower.includes("2ab") ||
    lower.includes("suku tengah") ||
    lower.includes("perkalian silang") ||
    lower.includes("kuadrat suku dua") ||
    lower.includes("(a+b)^2") ||
    lower.includes("(x+3)^2");

  if (isAskingBinomial) {
    return `Suku $2ab$ (atau $6x$ pada kasus $(x+3)^2$) muncul karena sifat distributif perkalian aljabar. Mulailah dari bentuk perkaliannya:
$$ (a + b)^2 = (a + b)(a + b) $$
Kalikan suku-demi-suku, lalu gabungkan suku-suku sejenisnya. Suku silang yang muncul dua kali itulah asal-usul $2ab$.

**Secara Visual (Model Luas Geometri):**
Bayangkan sebuah persegi dengan panjang sisi $(x + 3)$.
Luas total persegi tersebut tersusun dari 4 bidang:
1. Satu bidang persegi berukuran $x \\times x$
2. Dua bidang persegi panjang berukuran $x \\times 3$
3. Satu bidang persegi kecil berukuran $3 \\times 3$

Coba tuliskan luas masing-masing bidang lalu jumlahkan keempatnya. Bentuk lengkap apa yang kamu peroleh? Tanpa suku tengahnya, luas itu tidak akan pernah lengkap!`;
  }

  // 5. PERTANYAAN TENTANG CARA MENYELESAIKAN / PETUNJUK ("Gimana caranya?", "Bantu benerin")
  const isAskingHowToSolve =
    lower.includes("gimana cara") ||
    lower.includes("bagaimana cara") ||
    lower.includes("terus gimana") ||
    lower.includes("bantu benerin") ||
    lower.includes("petunjuk") ||
    lower.includes("caranya gimana") ||
    lower.includes("solusinya apa");

  if (isAskingHowToSolve) {
    if (activeProblem?.steps && activeProblem.steps.length > 0) {
      return `Sesuai prinsip Sokrates ZAP, aku tidak memberikan jawaban akhir secara instan, melainkan memandumu menemukannya sendiri:

1. Ambil ekspresi awalmu: $${activeProblem.steps[0]}$$.
2. Urai kuadrat binomialnya menjadi bentuk perkalian dua suku.
3. Gunakan perkalian distributif secara teliti tanpa melewatkan suku perkalian silang.
4. Sederhanakan konstanta di bagian paling akhir.

Coba tuliskan perbaikan baris berikutnya di kolom chat dan kirimkan, aku akan langsung menguji keabsahannya untukmu!`;
    }

    return `Tuliskan baris-baris aljabar yang sedang kamu kerjakan (gunakan Enter untuk membuat baris baru). ZAP akan memverifikasi setiap langkah secara deterministik dan memberitahumu jika ada aturan aljabar yang terlanggar!`;
  }

  // 6. PERTANYAAN TENTANG KONTRADIKSI / KONTRA-CONTOH ("Kenapa x=2?")
  const isAskingCounterExample =
    lower.includes("x = 2") ||
    lower.includes("x=2") ||
    lower.includes("kontradiksi") ||
    lower.includes("kontra contoh") ||
    lower.includes("angka 21") ||
    lower.includes("angka 25");

  if (isAskingCounterExample) {
    return `Pengujian dengan angka nyata (seperti $x = 2$) adalah cara paling mudah untuk membuktikan apakah dua rumus matematika benar-benar ekuivalen:

Jika dua rumus memang sama identik, maka saat dimasukkan angka berapa pun, hasilnya HARUS selalu sama.
Coba masukkan $x = 2$ ke kedua rumus:
- Hitung nilai rumus awal: $(2 + 3)^2 - 4$.
- Hitung nilai rumus tanpa suku tengah: $2^2 + 5$.

Bandingkan kedua hasil hitunganmu. Jika nilainya berbeda, itu membuktikan secara mutlak bahwa langkah penurunan tersebut tidak ekuivalen! Berapakah selisih yang kamu temukan?`;
  }

  // 7. PERTANYAAN UMUM TENTANG ZAP ATAU CARA PAKAI
  const isAskingAboutSystem =
    lower.includes("apa itu zap") ||
    lower.includes("apa itu zero answer policy") ||
    lower.includes("siapa kamu") ||
    lower.includes("bisa apa") ||
    lower.includes("cara pakai") ||
    lower.includes("aturan");

  if (isAskingAboutSystem) {
    return `**ZAP (Zero Answer Policy)** adalah platform pembelajaran matematika 3D interaktif dan tutor Sokratik berbasis *Strict Separation of Concerns* (SymPy CAS + Three.js 3D Canvas + Socratic AI Tutor).

**Filosofi Kami:** *"Don't give them answers. Project the wonder to discover."*
- Kami tidak memberikan kunci jawaban langsung agar siswa tidak ketergantungan pada contekan instan.
- Kami memproyeksikan persamaan matematika ke kanvas 3D interaktif secara real-time dan memverifikasi kebenaran logika langkah demi langkah.
- Kamu bisa menguji aljabar dengan mengetik rumus atau memilih topik matematika dari kanvas 3D!`;
  }

  // 8. RESPONS UMUM BERPIKIR SOKRATIK
  return `Pertanyaan yang bagus mengenai "${message}".

Sebagai tutor kognitif aljabar, mari kita telusuri bersama:
- Jika ini pertanyaan konsep matematika, bagian mana yang paling ingin kamu pahami lebih dalam?
- Jika ini soal perhitungan dari latihan sekolahmu, kamu bisa langsung mengetikkan baris penurunan rumusmu agar aku bisa memverifikasi validitas logikanya baris demi baris!`;
}

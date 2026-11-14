/**
 * Potongan kode & contoh respons untuk halaman dokumentasi.
 * Semua isi di sini dikutip dari kode sumber yang berjalan di repositori ini.
 */

export const chatFlowDiagram = String.raw`Peramban (app/chat/page.tsx)
  │  POST /api/chat  { message, stream: true, targetVariable: "x", ... }
  ▼
Next.js route handler  (app/api/chat/route.ts)
  ├─ 1. parse JSON ......................... 400 bila body kosong / bukan JSON
  ├─ 2. cek strike & suspend ............... registry server, bukan nilai dari klien
  ├─ 3. POST /api/v1/harness/context ....... timeout 1.200 ms
  │      └─ FastAPI → memori episodik + korpus + rumus geometri
  ├─ 4. pilih provider LLM ................. Gemini / NVIDIA NIM / BazaarLink /
  │      (hanya untuk bahasa)               OpenAI / Anthropic / Mistral / lokal
  ├─ 5. finalizeModelReply() ............... cleanModelResponse + sanitizeZeroAnswer
  └─ 6. kirim balasan ...................... JSON utuh ATAU SSE:
         event: meta → delta* → done
  ▼
Peramban
  │  (fire-and-forget) POST /api/v1/harness/learn ... timeout 1.500 ms
  ▼
FastAPI  backend/main.py
  └─ ZAPAgentHarness.learn_from_conversation()
       redaksi PII → ekstraksi langkah → gerbang CFL SymPy
       → upsert memori episodik → promosi korpus (hanya ALL_STEPS_VALID)`;

export const parserCode = String.raw`# backend/cfl/parser.py
ALLOWED_FUNCS = {"sin", "cos", "tan", "sqrt", "log", "exp"}
ALLOWED_VARS  = {"x", "y", "z", "a", "b", "c", "d", "m", "n", "t"}
ALLOWED_CONSTS = {"pi", "E"}
ALLOWED_LATEX_CMDS = {"frac", "sqrt", "cdot", "times", "sin", "cos",
                      "tan", "log", "exp", "pm"}

def parse_single_side(side_str: str) -> sp.Expr:
    cleaned = side_str.strip()
    if not cleaned:
        raise ValueError("Ekspresi matematika tidak boleh kosong.")

    # 1. Whitelist DULU, baru parse.
    if _is_plain_algebra(cleaned):
        if _has_dangerous_exponents(cleaned):
            raise ValueError("Eksponen melebihi batas aman (maks 100) ...")
        try:
            return parse_expr(cleaned, transformations=TRANSFORMATIONS)
        except AssertionError:
            raise                      # Anti-Masking: jangan ditelan except generik
        except Exception as err:
            raise ValueError(f"Gagal mengurai aljabar '{side_str}': {err}")

    if "\\" in cleaned and _is_safe_latex(cleaned):
        if _has_dangerous_exponents(cleaned):
            raise ValueError("Eksponen/indeks akar melebihi batas aman ...")
        try:
            return parse_latex(cleaned)
        except AssertionError:
            raise
        except Exception as err:
            raise ValueError(f"Gagal mengurai LaTeX '{side_str}': {err}")

    # 3. Di luar whitelist = ditolak, bukan ditebak.
    raise ValueError(f"Ekspresi tidak valid atau di luar whitelist aljabar: '{side_str}'")`;

export const cflEngineCode = String.raw`# backend/cfl/cfl_engine.py
MAX_SOLVESET_DEGREE = 12   # x^100 + x^99 = 1 sempat > 15 detik, jadi dibatasi

def steps_equivalent(prev, nxt, var=sp.Symbol("x")) -> bool | None:
    if isinstance(prev, sp.Eq) and isinstance(nxt, sp.Eq):
        if prev.lhs == nxt.lhs:
            if sp.simplify(nxt.rhs - prev.rhs) == 0:
                return True
        degrees = (_polynomial_degree(prev.lhs - prev.rhs, var),
                   _polynomial_degree(nxt.lhs - nxt.rhs, var))
        if any(d is not None and d > MAX_SOLVESET_DEGREE for d in degrees):
            return None                       # UNDECIDABLE_STEP, bukan vonis
        s1 = sp.solveset(prev.lhs - prev.rhs, var, domain=sp.S.Reals)
        s2 = sp.solveset(nxt.lhs - nxt.rhs, var, domain=sp.S.Reals)
        if isinstance(s1, sp.ConditionSet) or isinstance(s2, sp.ConditionSet):
            return None
        if s1 == sp.EmptySet and s2 == sp.EmptySet:
            return sp.simplify((prev.lhs - prev.rhs) - (nxt.lhs - nxt.rhs)) == 0
        return s1 == s2
    if not isinstance(prev, sp.Eq) and not isinstance(nxt, sp.Eq):
        return sp.simplify(nxt - prev) == 0
    return False`;

export const diagnoseRequest = String.raw`POST http://127.0.0.1:8000/api/v1/diagnose
Content-Type: application/json

{
  "confirmed_steps": [
    "2x + 6 = 14",
    "2x = 20",
    "x = 10"
  ],
  "target_variable": "x"
}`;

export const diagnoseResponse = String.raw`HTTP/1.1 200 OK

{
  "status": "success",
  "session_id": "sess_5733145a",
  "transcription": {
    "total_lines": 3,
    "lines": [
      { "line_number": 1, "raw_latex": "2x + 6 = 14", "is_valid": true },
      { "line_number": 2, "raw_latex": "2x = 20",     "is_valid": false },
      { "line_number": 3, "raw_latex": "x = 10",      "is_valid": false }
    ]
  },
  "diagnosis": {
    "has_fault": true,
    "first_fault_line": 2,
    "fault_type": "SIGN_INVERSION_OR_TRANSPOSITION_ERROR",
    "status": "FAULT_DETECTED",
    "human_explanation": "Terdapat kekeliruan pembalikan tanda atau transposisi suku saat memindahkan ruas persamaan.",
    "socratic_prompt": "Perhatikan baris ke-2. Operasi aljabar apa yang kamu terapkan pada kedua ruas persamaan? Coba periksa kembali apakah tanda positif atau negatifnya sudah seimbang.",
    "counter_example": {
      "test_variable": "x",
      "test_value": 2,
      "lhs_expected": "-4",
      "rhs_calculated": "-16",
      "contradiction_statement": "Ketika x = 2, rumus awal bernilai -4, tetapi langkahmu menghasilkan -16."
    }
  },
  "guardrail_status": {
    "final_answer_suppressed": true
  }
}`;

export const verifyResponse = String.raw`POST http://127.0.0.1:8000/api/v1/verify
Content-Type: application/json

{ "left": "(x+3)^2", "right": "x^2 + 6x + 9" }

HTTP/1.1 200 OK
{
  "isEquivalent": true,
  "verified": true,
  "method": "symbolic_simplify",
  "message": "Selisih kedua ekspresi disederhanakan SymPy menjadi 0; keduanya ekuivalen."
}`;

export const guardrailCode = String.raw`// frontend/lib/zero-answer.ts
export function sanitizeZeroAnswer(text: string, options?: ZeroAnswerOptions): string {
  if (!text) return "";
  // 1. Seluruh span matematika dinormalisasi lebih dulu:
  //    $$…$$, \[…\], \(…\), lalu $…$
  let result = sanitizeMathSpans(text);
  // 2. Bila variabel target sesi diketahui, sensor "x = 4" di tengah kalimat.
  const targetVariable = options?.targetVariable?.trim();
  if (targetVariable) {
    result = redactTargetAssignments(result, targetVariable);
  }
  // 3. Baru jalankan 11 pola deklarasi jawaban.
  for (const item of ZERO_ANSWER_PATTERNS) {
    result = result.replace(item.regex, item.replacement);
  }
  return result;
}

export function finalizeModelReply(text, fallback, options) {
  const cleaned = cleanModelResponse(text || "");
  const guarded = sanitizeZeroAnswer(cleaned, options).trim();
  // Balasan yang seluruhnya tersensor tidak boleh dikirim kosong.
  if (guarded.replace(/[^A-Za-z0-9\u00C0-\u024F]/g, "").length < 8) {
    return fallback;
  }
  return guarded;
}`;

export const backendGuardrailCode = String.raw`# backend/cfl/guardrail.py
class RobustZeroAnswerGuardrail:
    DECLARATIVE_ANSWER_PATTERNS = [ ... ]   # 11 regex: deklaratif + domain non-matematika

    @classmethod
    def sanitize(cls, text: str, final_solution: str | None = None) -> str:
        sanitized = text
        for pattern in cls.DECLARATIVE_ANSWER_PATTERNS:
            sanitized = re.sub(pattern, "Bagaimanakah menurut analisismu?",
                               sanitized, flags=re.IGNORECASE)

        if final_solution and str(final_solution).strip():
            sol_escaped = re.escape(str(final_solution).strip())
            target_pattern = (
                rf"(?:kunci|nilai\s+akhir)\s*(?:adalah|=|:)\s*"
                rf"(?:[a-zA-Z]\s*=\s*)?{sol_escaped}\b"
            )
            sanitized = re.sub(target_pattern, "kunci adalah [DIRAHASIAKAN]",
                               sanitized, flags=re.IGNORECASE)
        return sanitized`;

export const harnessKeyCode = String.raw`# backend/data_engine/agent_harness.py
@classmethod
def _user_key(cls, user_id: Optional[str]) -> str:
    if user_id and str(user_id).strip():
        return cls._profile_key(str(user_id))
    return "anonymous"          # keranjang eksplisit, bukan NULL

@staticmethod
def _profile_key(user_id: str) -> str:
    digest = hashlib.sha256(
        user_id.strip().lower().encode("utf-8")
    ).hexdigest()[:16]
    return f"u_{digest}"        # identitas mentah tidak pernah disimpan`;

export const harnessMemoryIdCode = String.raw`# backend/data_engine/agent_harness.py
@staticmethod
def _compute_memory_id(topic, normalized_query, steps, user_key="anonymous"):
    parts = [topic.lower(), normalized_query.lower().strip(), "||".join(steps)]
    if user_key and user_key != "anonymous":
        parts.insert(0, user_key)        # dedup terpisah per pemilik
    payload = "|".join(parts)
    return "mem_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]`;

export const harnessPromotionCode = String.raw`# backend/data_engine/agent_harness.py — langkah 3 (gerbang CFL)
if len(steps) >= 2:
    fault_idx, diag = isolate_first_fault_breakpoint(steps, target_var=target_var)
    cfl_status = diag.get("status", "UNKNOWN")
    if cfl_status == "FAULT_DETECTED":
        # Diagnosis BUKAN verifikasi. Turunan salah tidak boleh dipromosikan.
        misconception_type = diag.get("misconception_type")
        counter_example = diag.get("counter_example")
        sympy_verified = False
    elif cfl_status == "ALL_STEPS_VALID":
        sympy_verified = True
elif len(steps) == 1:
    try:
        parse_step_to_symbolic(steps[0])
        cfl_status = "SINGLE_EXPRESSION_VALID"
        sympy_verified = True
    except Exception:
        cfl_status = "CONCEPTUAL_QUERY"

# langkah 6 — promosi ke MathCorpusStore permanen
promoted_to_corpus = False
if cfl_status == "ALL_STEPS_VALID" and sympy_verified and len(steps) >= 2:
    corpus_item = {
        "id": f"conv_{memory_id}",
        "tier": tier,
        "topic": f"Pembelajaran Percakapan ({topic.capitalize()})",
        "question": clean_user[:500],
        "steps": steps,
        "target_variable": target_var,
        "sympy_verification": {"cfl_status": cfl_status, "is_valid": True},
        "socratic_prompt": socratic_resolution,
        "source": "ZAP Continuous User Conversation Memory",
    }
    self.corpus_store.insert_batch([corpus_item])
    promoted_to_corpus = True`;

export const harnessRetrievalCode = String.raw`# backend/data_engine/agent_harness.py
def retrieve_relevant_memories(self, query, limit=3, user_id=None):
    user_key = self._user_key(user_id)
    terms = _query_terms(query)
    rows = conn.execute(
        "SELECT * FROM agent_episodic_memory WHERE user_key = ? "
        "ORDER BY updated_at DESC LIMIT 2000",
        (user_key,),
    ).fetchall()

    ranked = sorted(rows, key=lambda r: str(r.get("updated_at") or ""), reverse=True)
    scored = [(_score_memory(row, terms, query), row) for row in ranked]
    scored.sort(key=lambda pair: (
        -pair[0],                                  # skor tumpang tindih istilah
        -int(pair[1].get("sympy_verified") or 0),  # lalu status terverifikasi
        -int(pair[1].get("hit_count") or 0),       # lalu frekuensi
    ))
    matched = [row for score, row in scored if score > 0]
    return matched[:limit] if matched else [row for _, row in scored[:limit]]`;

export const harvesterStateCode = String.raw`// data/harvest_state.json — ringkasan 20 putaran terakhir
{
  "runs": [
    {
      "finished_at": "2026-11-13T18:00:43.528860+00:00",
      "max_items_per_source": 10,
      "inserted_verified": 28,
      "per_source": {
        "gsm8k_sample":            { "fetched": 10, "verified": 10, "rejected_unverified": 0 },
        "hf_gsm8k_api":            { "fetched": 10, "verified": 10, "rejected_unverified": 0 },
        "wikimedia_math_theorems": { "fetched": 8,  "verified": 8,  "rejected_unverified": 0 }
      },
      "disabled_sources": {
        "indo_kurikulum_sd": "HTTP 404 - URL kurikulum tidak tersedia (perlu sumber resmi baru)"
      }
    }
  ],
  "last_run_at": "2026-11-13T18:00:43.528860+00:00",
  "last_inserted_verified": 28
}`;

export const vaultCode = String.raw`// frontend/lib/vault-crypto.ts
export const VAULT_ENVELOPE_VERSION = 1;
export const PBKDF2_ITERATIONS = 310_000;   // rekomendasi OWASP 2023
const SALT_BYTES = 16;
const IV_BYTES = 12;                        // nonce AES-GCM 96-bit
const KEY_BITS = 256;

export interface VaultEnvelope {
  v: number;
  alg: "AES-GCM";
  kdf: { name: "PBKDF2-SHA256"; iterations: number; saltB64: string };
  ivB64: string;
  ctB64: string;
}

// passphrase + salt → PBKDF2-SHA256 (310.000 iterasi) → AES-GCM-256
const key = await subtle.deriveKey(
  { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
  baseKey,
  { name: "AES-GCM", length: KEY_BITS },
  false,                 // tidak extractable untuk kunci normal
  ["encrypt", "decrypt"]
);`;

export const vaultEnvelopeExample = String.raw`{
  "v": 1,
  "alg": "AES-GCM",
  "kdf": {
    "name": "PBKDF2-SHA256",
    "iterations": 310000,
    "saltB64": "…16 byte salt…"
  },
  "ivB64": "…12 byte nonce…",
  "ctB64": "…ciphertext + authentication tag…"
}`;

export const vaultFlowDiagram = String.raw`Perangkat A                                      Server Next.js
──────────                                       ─────────────
passphrase vault
   │ PBKDF2-SHA256 × 310.000
   ▼
KEK AES-256  (hanya di memori + sessionStorage tab)
   │ AES-GCM-256, IV acak 12 byte
   ▼
envelope { v, alg, kdf, ivB64, ctB64 }  ─────────►  simpan envelope + metadata:
                                                   email, nama, avatar, provider,
                                                   tier, updatedAt
                                                   (tanpa passphrase / KEK / plaintext)

Perangkat B
   │ GET /api/user/sync  (Bearer token)
   ▼
envelope yang sama  ──► passphrase yang sama ──► KEK yang sama ──► dekripsi lokal`;

export const curlChatSse = String.raw`curl -N http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bantu cek coretan saya: 2x + 6 = 14 -> 2x = 20 -> x = 10",
    "stream": true,
    "targetVariable": "x"
  }'

# Potongan SSE yang diterima:
# event: meta
# data: {"targetVariable":"x"}
#
# event: delta
# data: {"t":"…potongan teks yang sudah disanitasi…"}
#
# event: done
# data: {"reply":"…teks final…","model":"…","source":"…"}`;

export const curlChatJson = String.raw`curl http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bantu cek coretan saya: 2x + 6 = 14 -> 2x = 20 -> x = 10",
    "targetVariable": "x"
  }'

# HTTP/1.1 200 OK
# {
#   "reply": "…pertanyaan Sokratik yang sudah lolos guardrail…",
#   "model": "…",
#   "source": "…"
# }
# Bila ada referensi korpus, respons juga memuat "corpus_references".`;

export const curlDiagnose = String.raw`curl http://127.0.0.1:8000/api/v1/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_steps": ["2x + 6 = 14", "2x = 20", "x = 10"],
    "target_variable": "x"
  }'`;

export const curlVerify = String.raw`curl http://127.0.0.1:8000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"left": "(x+3)^2", "right": "x^2 + 6x + 9"}'`;

export const curlSync = String.raw`# Token = token sesi akun ZAP (HMAC) atau Google ID token.
curl http://localhost:3000/api/user/sync \
  -H "Authorization: Bearer $ZAP_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "email": "siswa@example.com",
      "name": "Siswa Contoh"
    },
    "encrypted": {
      "v": 1,
      "alg": "AES-GCM",
      "kdf": {
        "name": "PBKDF2-SHA256",
        "iterations": 310000,
        "saltB64": "…"
      },
      "ivB64": "…",
      "ctB64": "…"
    }
  }'

# 200 OK
# {
#   "success": true,
#   "encrypted": true,
#   "message": "Vault terenkripsi tersimpan (server tidak dapat membacanya).",
#   "updatedAt": 1763000000000
# }`;

export const curlShare = String.raw`curl http://localhost:3000/api/chat/share \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123",
    "title": "Latihan persamaan linear",
    "messages": [
      { "sender": "user", "rawText": "2x + 6 = 14" },
      { "sender": "assistant", "replyText": "Operasi apa yang kamu terapkan pada kedua ruas?" }
    ],
    "authorEmail": "siswa@example.com",
    "isPublic": true
  }'

# 200 OK
# {
#   "success": true,
#   "shareId": "…uuid…",
#   "isPublic": true,
#   "sharePath": "/a/chat/s/…uuid…",
#   "altSharePath": "/chat/s/…uuid…",
#   "title": "Latihan persamaan linear"
# }`;

export const runCommands = String.raw`# 1. Backend FastAPI (port 8000)
cd backend
uvicorn main:app --reload --port 8000
#    Swagger: http://127.0.0.1:8000/docs

# 2. Frontend Next.js (port 3000)
cd frontend
npm run dev

# 3. Docker Compose (production-like)
docker compose up -d --build

# 4. Pengujian backend
python -m pytest -v -p no:cacheprovider tests/

# 5. Audit 5 pilar + verifikasi suite (satu CLI)
python .agents/skills/zap-skills/scripts/train_zap_sources.py --audit --verify

# 6. Latih korpus prosedural multi-domain
python .agents/skills/zap-skills/scripts/train_zap_sources.py \
  --train --tier ALL --domain ALL --count 25`;

export const addDomainCode = String.raw`# 1. backend/data_engine/taxonomy.py
DOMAIN_TAXONOMY["baru"] = KnowledgeDomainDefinition(
    domain="baru",
    label="…",
    description="…",
    verification_engine="…",   # mesin deterministik yang memutuskan benar/salah
    topics=[DomainTopicDefinition(...)],
)
DOMAIN_NAMES = ("matematika", "pemrograman", "fisika", "kimia", "baru")

# 2. backend/data_engine/generators.py
_DOMAIN_ENGINE["baru"] = "…"

def generate_domain_sample(domain: str, idx: int) -> Dict[str, Any]:
    # hitung jawaban lebih dulu, lalu rakit item lewat _build_domain_item()
    ...

# 3. Tambahkan pemeriksaan zero-answer: _answer_absent(answer, *teks_terlihat)
# 4. Rebuild korpus, lalu jalankan audit:
python .agents/skills/zap-skills/scripts/train_zap_sources.py --train --domain baru --count 25 --audit`;

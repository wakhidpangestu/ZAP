"""
ZAP (Zero Answer Policy) - Backend API Gateway & CFL Orchestrator
Framework: FastAPI (Production-Ready Spec)
Rubrik LOGICODIX 2026: Anti-Halusinasi, Zero-Answer Policy, dan Human-in-the-Loop LaTeX Confirmation
"""

import hmac
import os
import re
import sys
import uuid
from typing import Any
import sympy as sp
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from cfl import (
    isolate_first_fault_breakpoint,
    RobustZeroAnswerGuardrail
)
from cfl.parser import ALLOWED_VARS, parse_single_side
from data_engine.agent_harness import ZAPAgentHarness, redact_pii

agent_harness = ZAPAgentHarness()

app = FastAPI(
    title="ZAP Cognitive Diagnostics API",
    description="Autonomous Cognitive Diagnostics Engine for Student Scratchpads (LOGICODIX 2026)",
    version="2.2.0"
)

# CORS Middleware: bawaan HANYA localhost dev/demo; domain lain wajib
# dinyatakan eksplisit lewat env CORS_ORIGINS (wildcard hanya bila env
# secara eksplisit berisi "*").
cors_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
if cors_origins_env == "*":
    allowed_origins = ["*"]
elif cors_origins_env:
    allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    # 127.0.0.1 ikut didaftarkan: default NEXT_PUBLIC_BACKEND_URL di frontend
    # memakai 127.0.0.1, dan origin halaman bisa jadi 127.0.0.1:3000 juga.
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3105",
        "http://127.0.0.1:3105",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ==========================================
# Pydantic Request & Response Schemas
# ==========================================

class DiagnoseRequest(BaseModel):
    confirmed_steps: list[str] | None = Field(
        default=None,
        description="Daftar baris matematika hasil ekstraksi/konfirmasi coretan siswa"
    )
    lines: list[str] | None = Field(
        default=None,
        description="Alias backward-compatible untuk confirmed_steps"
    )
    target_variable: str | None = Field(
        default=None,
        max_length=5,
        description="Variabel aljabar utama (misal: 'x', 'y', 'a')"
    )
    target_var: str | None = Field(
        default=None,
        max_length=5,
        description="Alias backward-compatible untuk target_variable"
    )
    image: str | None = Field(
        default=None,
        description="Base64 encoded gambar coretan siswa (opsional jika sudah dikonfirmasi)"
    )
    client_timestamp: str | None = Field(
        default=None,
        description="ISO 8601 timestamp dari klien"
    )


class TranscriptionLine(BaseModel):
    line_number: int
    raw_latex: str
    is_valid: bool


class TranscriptionResult(BaseModel):
    total_lines: int
    lines: list[TranscriptionLine]


class CounterExampleResult(BaseModel):
    test_variable: str
    test_value: Any
    lhs_expected: Any
    rhs_calculated: Any
    contradiction_statement: str


class DiagnosisResult(BaseModel):
    has_fault: bool
    first_fault_line: int | None = None
    fault_type: str | None = None
    status: str
    human_explanation: str
    socratic_prompt: str
    counter_example: CounterExampleResult | None = None


class GuardrailStatus(BaseModel):
    final_answer_suppressed: bool


class DiagnoseResponse(BaseModel):
    status: str
    session_id: str
    transcription: TranscriptionResult
    diagnosis: DiagnosisResult
    guardrail_status: GuardrailStatus


# ==========================================
# API Endpoints
# ==========================================

@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint untuk monitoring service."""
    return {
        "status": "online",
        "service": "ZAP Diagnostic Gateway",
        "engine": "SymPy CFL Symbolic Reasoning",
        "version": "2.2.0"
    }


class VerifyRequest(BaseModel):
    left: str = Field(..., max_length=200, description="Ekspresi ruas kiri")
    right: str = Field(..., max_length=200, description="Ekspresi ruas kanan")


class VerifyResponse(BaseModel):
    isEquivalent: bool
    verified: bool
    method: str
    message: str


@app.post("/api/v1/verify", response_model=VerifyResponse, status_code=status.HTTP_200_OK, tags=["Diagnostics"])
def verify_expression_equivalence(request: VerifyRequest):
    """
    Memverifikasi ekuivalensi dua ekspresi aljabar secara deterministik:
    parsing whitelist CFL terlebih dahulu, lalu SymPy simplify(left - right).
    Bila simplify tidak memutuskan, dipakai pembuktian numerik pada beberapa
    titik uji. Input di luar whitelist ditolak aman (verified=False).
    """
    try:
        lhs = parse_single_side(request.left)
        rhs = parse_single_side(request.right)
    except AssertionError:
        raise
    except Exception as err:
        return VerifyResponse(
            isEquivalent=False,
            verified=False,
            method="rejected",
            message=f"Input ditolak pada tahap parsing whitelist: {err}",
        )

    diff = lhs - rhs
    try:
        simplified = sp.simplify(diff)
    except Exception:
        simplified = None

    if simplified is not None and simplified == 0:
        return VerifyResponse(
            isEquivalent=True,
            verified=True,
            method="symbolic_simplify",
            message="Selisih kedua ekspresi disederhanakan SymPy menjadi 0; keduanya ekuivalen.",
        )

    # Pembuktian numerik cadangan pada beberapa titik uji
    symbols = sorted(diff.free_symbols, key=lambda s: s.name)
    test_values = [2, 3, 5, 7, sp.Rational(1, 2), sp.Rational(3, 2), 11]
    try:
        numeric_decided = True
        for i, val in enumerate(test_values):
            subs = {sym: test_values[(i + j) % len(test_values)] for j, sym in enumerate(symbols)}
            value = complex(diff.subs(subs).evalf())
            if abs(value) > 1e-6:
                return VerifyResponse(
                    isEquivalent=False,
                    verified=True,
                    method="numeric_sampling",
                    message=f"Pembuktian numerik menemukan selisih {value.real:.6g} pada titik uji {subs}; kedua ekspresi tidak ekuivalen.",
                )
    except Exception:
        numeric_decided = False

    if numeric_decided:
        if simplified is not None:
            # simplify() SUDAH menyimpulkan selisih bukan 0. Sampel numerik yang
            # kebetulan semuanya 0 (mis. polinomial berakar tepat di titik uji)
            # tidak boleh dipakai untuk mengklaim ekuivalen.
            return VerifyResponse(
                isEquivalent=False,
                verified=False,
                method="undecided",
                message=(
                    "SymPy menyederhanakan selisih menjadi "
                    f"{str(simplified)[:120]} (bukan 0), tetapi seluruh titik uji "
                    "numerik bernilai 0; ekuivalensi tidak dapat dipastikan."
                ),
            )
        return VerifyResponse(
            isEquivalent=True,
            verified=True,
            method="numeric_sampling",
            message="Selisih kedua ekspresi bernilai 0 pada seluruh titik uji numerik; keduanya ekuivalen.",
        )

    return VerifyResponse(
        isEquivalent=False,
        verified=False,
        method="undecided",
        message="SymPy tidak dapat memutuskan ekuivalensi kedua ekspresi ini secara simbolik maupun numerik.",
    )


@app.post("/api/v1/diagnose", response_model=DiagnoseResponse, status_code=status.HTTP_200_OK, tags=["Diagnostics"])
def diagnose_student_scratchpad(request: DiagnoseRequest):
    """
    Menganalisis coretan aljabar siswa baris-demi-baris secara deterministik.
    - Mengidentifikasi titik patah logika pertama (First Fault Breakpoint).
    - Menghasilkan kontra-contoh aritmetika terkecil.
    - Menyusun petunjuk Sokrates berpegang teguh pada Robust Zero-Answer Guardrail.
    """
    steps_input = request.confirmed_steps if request.confirmed_steps is not None else (request.lines or [])
    raw_steps = [s.strip() for s in steps_input if s.strip()]
    if not raw_steps:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Daftar langkah aljabar tidak boleh kosong."
        )
    if len(raw_steps) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Jumlah langkah aljabar melebihi batas maksimum (maksimal 50 langkah per sesi)."
        )

    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    chosen_var = (request.target_variable or request.target_var or "x").strip() or "x"
    if chosen_var not in ALLOWED_VARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Variabel target '{chosen_var}' tidak diizinkan. Variabel yang didukung: {', '.join(sorted(ALLOWED_VARS))}."
        )
    target_var = chosen_var

    # Jalankan Symbolic CFL Engine
    fault_idx, diag = isolate_first_fault_breakpoint(raw_steps, target_var=target_var)

    # Tangani Parsing Error jika salah satu baris mengandung sintaks tidak valid / injeksi
    if diag.get("status") == "PARSING_ERROR":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=diag.get("message", "Format aljabar tidak valid.")
        )

    # Bangun status baris transkripsi
    transcription_lines: list[TranscriptionLine] = []
    fault_line_num = diag.get("fault_line") if fault_idx != -1 else None

    for i, step_str in enumerate(raw_steps):
        line_num = i + 1
        # Baris sebelum titik galat adalah valid; baris pada dan setelah galat ditandai tidak valid
        if fault_line_num is not None:
            is_valid = line_num < fault_line_num
        else:
            is_valid = True
            
        transcription_lines.append(TranscriptionLine(
            line_number=line_num,
            raw_latex=step_str,
            is_valid=is_valid
        ))

    # Konstruksi Diagnosis & Scaffolding Sokrates
    cfl_status = diag.get("status", "UNKNOWN")
    counter_example_obj = None

    if cfl_status == "FAULT_DETECTED":
        has_fault = True
        fault_type = diag.get("misconception_type", "GENERAL_ALGEBRAIC_DERIVATION_ERROR")
        ce = diag.get("counter_example")
        # ce may legitimately be None (fault without a counter-example):
        # read test_value defensively BEFORE any ce.get(...) call.
        ce_test_value = ce.get("test_value", 2) if ce else 2

        if fault_type == "DISTRIBUTIVE_EXPANSION_ILLUSION":
            human_explanation = "Terdapat indikasi hilangnya suku perkalian silang saat mengekspansi kuadrat aljabar."
            raw_prompt = (
                f"Di baris ke-{fault_line_num}, kamu mengekspansi kuadrat bentuk aljabar. "
                f"Coba uji jika {target_var} = {ce_test_value}: "
                f"berapakah nilai ekspresi awal dan berapakah nilai yang kamu tulis? "
                "Mengapa kedua hasil perhitungan tersebut tidak sama?"
            )
        elif fault_type == "SIGN_INVERSION_OR_TRANSPOSITION_ERROR":
            human_explanation = "Terdapat kekeliruan pembalikan tanda atau transposisi suku saat memindahkan ruas persamaan."
            raw_prompt = (
                f"Perhatikan baris ke-{fault_line_num}. "
                "Operasi aljabar apa yang kamu terapkan pada kedua ruas persamaan? "
                "Coba periksa kembali apakah tanda positif atau negatifnya sudah seimbang."
            )
        elif fault_type == "ROOT_LOSS":
            human_explanation = "Penarikan akar kuadrat pada kedua ruas menyebabkan kehilangan solusi akar negatif."
            raw_prompt = (
                f"Di baris ke-{fault_line_num}, kamu menarik akar kuadrat. "
                "Ingatlah bahwa bilangan kuadrat memiliki dua kemungkinan nilai akar (positif dan negatif). "
                "Apakah kamu sudah mempertimbangkan kedua kemungkinan tersebut?"
            )
        else:
            human_explanation = "Terdeteksi inkonsistensi matematis antara baris ini dengan langkah sebelumnya."
            raw_prompt = (
                f"Di baris ke-{fault_line_num}, periksa kembali operasi matematis yang menghubungkannya "
                "dengan baris sebelumnya. Apakah aturan aljabar sudah terpenuhi?"
            )

        if ce:
            stmt = ce.get("contradiction_statement")
            if not stmt and ce.get("lhs_expected") is not None:
                stmt = (
                    f"Ketika {target_var} = {ce.get('test_value')}, rumus awal bernilai "
                    f"{ce.get('lhs_expected')}, tetapi langkahmu menghasilkan {ce.get('rhs_calculated')}."
                )
            elif not stmt:
                stmt = ce.get("note", "Periksa kembali aturan aljabar secara teliti.")

            counter_example_obj = CounterExampleResult(
                test_variable=target_var,
                test_value=ce.get("test_value"),
                lhs_expected=ce.get("lhs_expected"),
                rhs_calculated=ce.get("rhs_calculated"),
                contradiction_statement=stmt
            )

    elif cfl_status == "UNDECIDABLE_STEP":
        # Langkah berisiko / ConditionSet (bukan tuduhan salah kepada siswa)
        has_fault = False
        fault_type = "UNDECIDABLE_STEP"
        human_explanation = "Langkah ini berada pada domain transendental yang memerlukan telaah pembatasan syarat nilai."
        raw_prompt = (
            f"Di baris ke-{fault_line_num}, langkah ini melibatkan fungsi dengan batasan domain tertentu. "
            "Coba periksa apakah nilai variabel yang kamu gunakan memenuhi seluruh syarat keberlakuan fungsi."
        )

    else:  # ALL_STEPS_VALID
        has_fault = False
        fault_type = None
        human_explanation = "Seluruh langkah penurunan aljabar konsisten dan valid secara matematis."
        raw_prompt = (
            "Hebat! Seluruh langkah penurunan aljabarmu konsisten. "
            "Apakah kamu sudah memverifikasi solusi ini dengan mensubstitusikannya kembali ke persamaan asal?"
        )

    # Filter Sokrates Prompt melalui Robust Zero-Answer Guardrail
    sanitized_prompt = RobustZeroAnswerGuardrail.sanitize(raw_prompt)

    # Status guardrail dihitung dari hasil sanitasi NYATA: teks yang benar-benar
    # dikirim ke siswa diperiksa ulang terhadap pola deklarasi jawaban akhir.
    final_answer_suppressed = not any(
        re.search(pattern, sanitized_prompt, flags=re.IGNORECASE)
        for pattern in RobustZeroAnswerGuardrail.DECLARATIVE_ANSWER_PATTERNS
    )

    diagnosis_payload = DiagnosisResult(
        has_fault=has_fault,
        first_fault_line=fault_line_num if has_fault else (fault_line_num if cfl_status == "UNDECIDABLE_STEP" else None),
        fault_type=fault_type,
        status=cfl_status,
        human_explanation=human_explanation,
        socratic_prompt=sanitized_prompt,
        counter_example=counter_example_obj
    )

    return DiagnoseResponse(
        status="success",
        session_id=session_id,
        transcription=TranscriptionResult(
            total_lines=len(transcription_lines),
            lines=transcription_lines
        ),
        diagnosis=diagnosis_payload,
        guardrail_status=GuardrailStatus(
            final_answer_suppressed=final_answer_suppressed
        )
    )


# ==========================================
# ZAP Agent Harness - Continuous Memory & RAG Endpoints
# ==========================================

class HarnessLearnRequest(BaseModel):
    user_message: str = Field(..., max_length=8000, description="Pesan atau pertanyaan dari siswa/pengguna")
    assistant_reply: str = Field(default="", max_length=8000, description="Balasan Sokratik dari asisten")
    explicit_steps: list[str] | None = Field(
        default=None, max_length=50,
        description="Langkah aljabar eksplisit jika ada (maksimal 50, sama dengan /diagnose)")
    target_variable: str = Field(default="x", max_length=5, description="Variabel target")
    tier_hint: str | None = Field(default=None, description="Jenjang pendidikan opsional (TK s/d S3)")
    user_id: str | None = Field(default=None, max_length=320, description="Identitas pengguna (dihash di server menjadi kunci profil anonim)")


class HarnessContextRequest(BaseModel):
    query: str = Field(..., description="Kueri atau pesan pengguna yang akan diperkaya dengan memori")
    limit: int | None = Field(default=None, ge=1, le=10, description="Jumlah memori relevan maksimum")
    top_k: int | None = Field(default=None, ge=1, le=10, description="Alias untuk limit")
    user_id: str | None = Field(default=None, max_length=320, description="Identitas pengguna untuk profil belajar (dihash di server)")


@app.post("/api/v1/harness/learn", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_learn_from_conversation(req: HarnessLearnRequest, http_request: Request):
    """
    Mempelajari percakapan pengguna secara berkelanjutan (Continuous Learning from Memory):
    - Menyaring PII (Email, Telepon, NIK, API key).
    - Mengekstrak langkah aljabar dan memverifikasinya via SymPy CFL.
    - Menyaring petunjuk Sokratik dengan RobustZeroAnswerGuardrail.
    - Menyimpan ke Episodic Memory dan mempromosikan langkah valid ke MathCorpusStore.

    Keamanan: bila env ZAP_HARNESS_SECRET terisi, header X-Harness-Secret yang
    cocok wajib dikirim. Bila ZAP_ENV=production dan secret belum diatur,
    endpoint menolak dengan 503 (fail-closed). Di luar production tanpa secret,
    gerbang fail-open agar pengembangan lokal tetap nyaman.
    """
    _require_harness_secret(http_request)

    result = agent_harness.learn_from_conversation(
        user_id=req.user_id,
        user_message=req.user_message,
        assistant_reply=req.assistant_reply,
        explicit_steps=req.explicit_steps,
        target_var=req.target_variable,
        tier_hint=req.tier_hint,
    )
    return result


@app.post("/api/v1/harness/context", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_retrieve_context(req: HarnessContextRequest, http_request: Request):
    """
    Mengambil konteks memori relevan (<ZAP_AGENT_HARNESS_CONTEXT>) dari Episodic Memory,
    MathCorpusStore, dan 2D/3D Geometry Database untuk disuntikkan ke prompt agen.

    Keamanan: endpoint ini server-to-server dan secret-gated karena responsnya
    memuat cuplikan memori episodik pengguna (user_query dan langkah yang
    diekstrak). Rute chat Next.js adalah satu-satunya pemanggil yang sah.
    """
    _require_harness_secret(http_request)
    effective_limit = req.limit or req.top_k or 3
    return agent_harness.build_harness_context(query=req.query, limit=effective_limit, user_id=req.user_id)


@app.get("/api/v1/harness/profile", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_learner_profile(user_id: str, http_request: Request):
    """Ringkasan profil belajar per pengguna (agregat topik, langkah valid, dan miskonsepsi).

    Secret-gated: profil belajar adalah data per pengguna, bukan data publik.
    """
    _require_harness_secret(http_request)
    profile = agent_harness.get_learner_profile(user_id)
    return {"status": "success", "learner_profile": profile}


class GeometryPatternRequest(BaseModel):
    phrase: str = Field(..., max_length=500, description="Frasa pengguna yang resolusinya tervalidasi")
    spec: dict = Field(..., description="Spesifikasi bangun tervalidasi (family, sides, entity_id, params)")


class GeometryMatchRequest(BaseModel):
    query: str = Field(..., max_length=500, description="Pesan pengguna untuk dicocokkan ke pola geometri yang sudah dipelajari")


def _require_harness_secret(http_request: Request) -> None:
    """Gerbang bersama untuk semua endpoint /api/v1/harness/*.

    - Bila ZAP_HARNESS_SECRET terisi: header X-Harness-Secret wajib cocok (401).
    - Bila tidak terisi dan ZAP_ENV=production: 503 (fail-closed).
    - Bila tidak terisi dan bukan production: fail-open. Ini kenyamanan dev,
      bukan jaminan keamanan; production wajib mengisi secret.
    """
    harness_secret = os.environ.get("ZAP_HARNESS_SECRET", "").strip()
    if harness_secret:
        provided = http_request.headers.get("X-Harness-Secret", "")
        if not provided or not hmac.compare_digest(provided, harness_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Header X-Harness-Secret tidak ada atau tidak cocok.",
            )
    elif os.environ.get("ZAP_ENV", "").strip().lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ZAP_HARNESS_SECRET belum diatur; endpoint harness dinonaktifkan pada mode production.",
        )


class HarnessFeedbackRequest(BaseModel):
    rating: str | int = Field(..., description="Umpan balik: 'up'/'down' atau 1/-1")
    memory_id: str | None = Field(default=None, max_length=80, description="ID memori episodik yang dinilai")
    conversation_id: str | None = Field(default=None, max_length=80, description="ID percakapan opsional")
    user_id: str | None = Field(default=None, max_length=320, description="Identitas pengguna mentah (dihash di server)")
    user_key: str | None = Field(
        default=None, max_length=128,
        description="Kunci anonim yang SUDAH di-hash oleh rute chat Next.js (diutamakan bila ada)")
    comment: str | None = Field(default=None, max_length=1000, description="Komentar opsional")
    user_message: str | None = Field(default=None, max_length=500, description="Cuplikan pesan pengguna (opsional)")
    assistant_reply: str | None = Field(default=None, max_length=600, description="Cuplikan balasan asisten (opsional)")


@app.post("/api/v1/harness/feedback", status_code=status.HTTP_201_CREATED, tags=["Agent Harness"])
def harness_record_feedback(req: HarnessFeedbackRequest, http_request: Request):
    """Simpan umpan balik up/down siswa ke tabel agent_feedback.

    Secret-gated sama seperti endpoint harness lain: rute chat Next.js
    meneruskan X-Harness-Secret bila ZAP_HARNESS_SECRET diatur. Tanpa secret
    (non-production) gerbang fail-open, dan rute chat tetap membatasi 30
    permintaan/menit per IP.
    """
    _require_harness_secret(http_request)
    key = (req.user_key or "").strip() or agent_harness._user_key(req.user_id)
    context = req.comment or req.user_message or req.assistant_reply or None
    try:
        result = agent_harness.store_feedback(
            rating=req.rating,
            user_key=key,
            memory_id=req.memory_id,
            comment=redact_pii(context) if context else None,
            conversation_id=req.conversation_id,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(err),
        )
    return result


@app.post("/api/v1/harness/geometry-pattern", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_learn_geometry_pattern(req: GeometryPatternRequest, http_request: Request):
    """Simpan pola frasa -> spec geometri yang SUDAH tervalidasi mesin (self-learning, fail-closed, secret-gated)."""
    _require_harness_secret(http_request)
    return agent_harness.learn_geometry_pattern(phrase=req.phrase, spec=req.spec)


@app.get("/api/v1/harness/geometry-patterns", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_list_geometry_patterns(http_request: Request, limit: int = 200):
    """Daftar pola geometri yang sudah dipelajari agen dari resolusi tervalidasi (secret-gated)."""
    _require_harness_secret(http_request)
    patterns = agent_harness.list_geometry_patterns(limit=limit)
    return {"status": "success", "total": len(patterns), "patterns": patterns}


@app.post("/api/v1/harness/geometry-match", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_match_geometry_pattern(req: GeometryMatchRequest, http_request: Request):
    """Cocokkan pesan ke pola geometri yang sudah dipelajari (deterministik, tanpa LLM, secret-gated)."""
    _require_harness_secret(http_request)
    match = agent_harness.match_geometry_pattern(req.query)
    return {"status": "success", "matched": match is not None, "match": match}


@app.get("/api/v1/harness/stats", status_code=status.HTTP_200_OK, tags=["Agent Harness"])
def harness_memory_stats(http_request: Request):
    """Statistik memori agen dan korpus pembelajaran (secret-gated, agregat tanpa data per pengguna)."""
    _require_harness_secret(http_request)
    mem_stats = agent_harness.get_memory_stats()
    return {
        "status": "success",
        **mem_stats,
        "memory": mem_stats,
        "corpus": agent_harness.corpus_store.get_statistics(),
    }


# =========================================================================
# PAPAN KOLABORASI REALTIME (WebSocket relay + log sinkronisasi per ruang)
# Ruang bersifat sementara di memori server; kode ruang adalah satu-satunya
# kunci akses - siapa pun yang memegang kode dapat ikut menggambar.
# =========================================================================
BOARD_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]
_board_rooms: dict = {}


def _board_room(room_key: str) -> dict:
    return _board_rooms.setdefault(
        room_key, {"peers": {}, "strokes": [], "notes": [], "state": None, "seq": 0}
    )


@app.websocket("/api/v1/board/{room_id}")
async def board_socket(websocket: WebSocket, room_id: str):
    room_key = re.sub(r"[^A-Za-z0-9_-]", "", room_id)[:24] or "umum"
    room = _board_room(room_key)
    await websocket.accept()
    room["seq"] += 1
    peer_id = f"u{room['seq']}"
    color = BOARD_COLORS[(room["seq"] - 1) % len(BOARD_COLORS)]
    name = (websocket.query_params.get("name") or "Tamu")[:24]
    room["peers"][peer_id] = {"ws": websocket, "name": name, "color": color}
    peers_payload = [
        {"id": pid, "name": p["name"], "color": p["color"]}
        for pid, p in room["peers"].items()
    ]
    try:
        await websocket.send_json(
            {
                "t": "welcome",
                "id": peer_id,
                "color": color,
                "peers": peers_payload,
                "strokes": room["strokes"][-4000:],
                "notes": room["notes"],
                "state": room["state"],
            }
        )
    except Exception:
        room["peers"].pop(peer_id, None)
        return
    for pid, p in list(room["peers"].items()):
        if pid != peer_id:
            try:
                await p["ws"].send_json(
                    {"t": "join", "peer": {"id": peer_id, "name": name, "color": color}}
                )
            except Exception:
                pass
    try:
        while True:
            msg = await websocket.receive_json()
            if not isinstance(msg, dict):
                continue
            kind = msg.get("t")
            if kind == "seg":
                room["strokes"].append(msg)
                if len(room["strokes"]) > 6000:
                    del room["strokes"][:2000]
            elif kind == "clear":
                room["strokes"] = []
            elif kind == "notes":
                if isinstance(msg.get("notes"), list):
                    room["notes"] = msg["notes"][:60]
            elif kind == "state":
                room["state"] = msg
            out = dict(msg)
            out["from"] = peer_id
            for pid, p in list(room["peers"].items()):
                if pid != peer_id:
                    try:
                        await p["ws"].send_json(out)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        room["peers"].pop(peer_id, None)
        for p in list(room["peers"].values()):
            try:
                await p["ws"].send_json({"t": "leave", "id": peer_id})
            except Exception:
                pass
        if not room["peers"]:
            _board_rooms.pop(room_key, None)

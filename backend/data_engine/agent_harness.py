"""
ZAP Model Agent Harness & Continuous Conversation Memory Engine
===============================================================
Provides Claude-style agentic harness capabilities for ZAP:
  1. Continuous Learning from User Conversations (Episodic & Semantic Memory)
  2. Automatic Algebraic Step Extraction & Deterministic SymPy CFL Verification
  3. Zero-Answer Guardrail Sanitization & PII Redaction (Email, Phone, NIK, API Keys)
  4. Automatic Promotion of Verified User Derivations into MathCorpusStore
  5. Dynamic Few-Shot Memory & Knowledge Retrieval (<ZAP_AGENT_HARNESS_CONTEXT>)
"""

from __future__ import annotations

import os
import re
import json
import time
import sqlite3
import hashlib
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

try:
    from backend.cfl import (
        isolate_first_fault_breakpoint,
        parse_step_to_symbolic,
        RobustZeroAnswerGuardrail,
    )
    from backend.cfl.geometry_db import GeometryDatabase
    from backend.data_engine.store import MathCorpusStore, DEFAULT_DB_PATH
    from backend.zapcore.learning import classify_topic, infer_jenjang
except ImportError:  # dijalankan dengan backend/ langsung di sys.path
    from cfl import (
        isolate_first_fault_breakpoint,
        parse_step_to_symbolic,
        RobustZeroAnswerGuardrail,
    )
    from cfl.geometry_db import GeometryDatabase
    from data_engine.store import MathCorpusStore, DEFAULT_DB_PATH
    from zapcore.learning import classify_topic, infer_jenjang

DEFAULT_MEMORY_JSONL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "zap_agent_memory.jsonl",
)

# Lock proses untuk penulisan mirror JSONL: beberapa request FastAPI sinkron
# berjalan di thread pool yang sama dan bisa menulis berkas bersamaan.
_MEMORY_JSONL_LOCK = threading.Lock()

# Kata sandang/imbuhan umum yang tidak membantu pemeringkatan relevansi.
_QUERY_STOPWORDS = frozenset({
    "yang", "dan", "untuk", "dari", "dengan", "pada", "adalah", "itu", "ini",
    "aku", "saya", "kamu", "kita", "bisa", "bantu", "tolong", "coba", "kak",
    "bagaimana", "gimana", "cara", "apa", "apakah", "kenapa", "mengapa",
    "the", "and", "for", "with", "that", "this", "how", "what", "why",
})

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE_RE = re.compile(r"(?:\+62|0)8\d{7,11}")
_NIK_RE = re.compile(r"\b\d{16}\b")
_API_KEY_RES = [
    re.compile(r"sk-[A-Za-z0-9_\-]{10,}"),       # OpenAI-style secret keys
    re.compile(r"nvapi-[A-Za-z0-9_\-]{10,}"),    # NVIDIA NIM API keys
    re.compile(r"AIza[A-Za-z0-9_\-]{10,}"),      # Google / Gemini API keys
    re.compile(r"ghp_[A-Za-z0-9]{10,}"),         # GitHub personal access tokens
]

# Candidate mathematical line pattern inside natural language messages
_MATH_LINE_CANDIDATE_RE = re.compile(
    r"(?:[0-9a-zA-Z()]+\s*(?:[\^+\-*/=]\s*[0-9a-zA-Z()]+)+)"
)


def redact_pii(text: str) -> str:
    """Strip emails, phone numbers, 16-digit NIK identifiers, and API keys from user text."""
    if not text:
        return ""
    cleaned = text
    for key_re in _API_KEY_RES:
        cleaned = key_re.sub("[API_KEY_TERSEMBUNYI]", cleaned)
    cleaned = _EMAIL_RE.sub("[EMAIL_TERSEMBUNYI]", cleaned)
    cleaned = _PHONE_RE.sub("[TELEPON_TERSEMBUNYI]", cleaned)
    cleaned = _NIK_RE.sub("[NIK_TERSEMBUNYI]", cleaned)
    return cleaned.strip()


def extract_math_steps_from_text(text: str, max_steps: int = 8) -> List[str]:
    """
    Extract valid mathematical expressions/equations from a natural language chat message
    using ZAP's whitelist-safe SymPy parser.
    """
    if not text:
        return []

    steps: List[str] = []
    # Split by newlines, arrows (->, =>), or semicolons
    raw_chunks = re.split(r"[\n;]|->|=>|â†’", text)
    for chunk in raw_chunks:
        candidate = chunk.strip()
        if not candidate:
            continue
        # Remove leading bullet or step numbers like "1.", "Baris 1:", "-"
        candidate = re.sub(r"^(?:baris\s*\d+\s*[:.]?|\d+\s*[.)]|[-*â€¢])\s*", "", candidate, flags=re.IGNORECASE).strip()
        if ":" in candidate and re.search(r"[a-zA-Z]{3,}\s+[a-zA-Z]{3,}", candidate.split(":")[0]):
            candidate = candidate.split(":")[-1].strip()
        if len(candidate) < 3 or len(candidate) > 120:
            continue
        # Must contain at least one math operator or '=' or '^'
        if not any(op in candidate for op in ("=", "+", "-", "*", "/", "^")):
            continue
        # Reject plain prose sentences with more than 3 consecutive words
        if re.search(r"[a-zA-Z]{4,}\s+[a-zA-Z]{4,}", candidate):
            # Try extracting embedded math expression inside prose
            matches = _MATH_LINE_CANDIDATE_RE.findall(candidate)
            for m in matches:
                m_str = m.strip()
                if len(m_str) >= 3:
                    try:
                        parse_step_to_symbolic(m_str)
                        if m_str not in steps:
                            steps.append(m_str)
                    except Exception:
                        continue
            continue

        try:
            parse_step_to_symbolic(candidate)
            if candidate not in steps:
                steps.append(candidate)
        except Exception:
            continue

        if len(steps) >= max_steps:
            break

    return steps


def _query_terms(text: str) -> List[str]:
    """Pecah teks menjadi istilah unik yang layak dipakai untuk skor relevansi."""
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    terms: List[str] = []
    for token in tokens:
        if len(token) < 2 or token in _QUERY_STOPWORDS:
            continue
        if token not in terms:
            terms.append(token)
    return terms


def _score_memory(row: Dict[str, Any], terms: List[str], normalized_query: str) -> float:
    """Skor tumpang tindih istilah kueri terhadap satu baris memori episodik.

    Kolom FTS `agent_memory_fts` di database lama tidak dipelihara oleh kode,
    jadi pemeringkatan memakai pencocokan kata (LIKE di Python) yang
    deterministik: user_query dan extracted_steps berbobot lebih besar
    daripada topik, dan kecocokan frasa utuh mendapat bonus.
    """
    hay_query = (row.get("user_query") or "").lower()
    hay_steps = (row.get("extracted_steps") or "").lower()
    hay_topic = (row.get("topic") or "").lower()
    hay_resolution = (row.get("socratic_resolution") or "").lower()
    score = 0.0
    for term in terms:
        if term in hay_query:
            score += 2.0
        elif term in hay_steps:
            score += 1.25
        elif term in hay_topic:
            score += 0.75
        elif term in hay_resolution:
            score += 0.25
    phrase = (normalized_query or "").strip().lower()
    if len(phrase) >= 6:
        if phrase in hay_query:
            score += 6.0
        elif phrase[:40] and phrase[:40] in hay_query:
            score += 2.0
    return score


class ZAPAgentHarness:
    """
    Central Harness for training, continuous conversation learning, and memory retrieval.
    """

    def __init__(
        self,
        db_path: str = DEFAULT_DB_PATH,
        memory_jsonl_path: str = DEFAULT_MEMORY_JSONL_PATH,
        corpus_store: Optional[MathCorpusStore] = None,
    ):
        self.db_path = db_path
        self.memory_jsonl_path = memory_jsonl_path
        self.corpus_store = corpus_store or MathCorpusStore(db_path=db_path)
        self.geo_db = GeometryDatabase()
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.memory_jsonl_path), exist_ok=True)
        self._init_memory_table()

    def _connect(self) -> sqlite3.Connection:
        """Koneksi SQLite dengan busy_timeout: penulis paralel menunggu, bukan gagal.

        Endpoint FastAPI sinkron berjalan di thread pool, jadi dua request bisa
        menulis bersamaan. Tanpa busy_timeout SQLite langsung melempar
        "database is locked" dan satu giliran belajar hilang.
        """
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn

    def _init_memory_table(self) -> None:
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS agent_episodic_memory (
                    memory_id TEXT PRIMARY KEY,
                    user_key TEXT,
                    conversation_id TEXT,
                    tier TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    shape_kind TEXT,
                    user_query TEXT NOT NULL,
                    extracted_steps TEXT NOT NULL,
                    cfl_status TEXT NOT NULL,
                    misconception_type TEXT,
                    counter_example TEXT,
                    socratic_resolution TEXT NOT NULL,
                    sympy_verified INTEGER DEFAULT 0,
                    hit_count INTEGER DEFAULT 1,
                    upvotes INTEGER DEFAULT 0,
                    downvotes INTEGER DEFAULT 0,
                    quality_score REAL DEFAULT 0,
                    updated_at TEXT NOT NULL
                )
            """)
            # Migrasi aditif untuk database lama: kolom baru ditambahkan tanpa
            # menghapus data. Pola yang sama dipakai MathCorpusStore._init_db.
            existing_columns = {row[1] for row in cur.execute("PRAGMA table_info(agent_episodic_memory)").fetchall()}
            migrations = [
                ("user_key", "ALTER TABLE agent_episodic_memory ADD COLUMN user_key TEXT"),
                ("conversation_id", "ALTER TABLE agent_episodic_memory ADD COLUMN conversation_id TEXT"),
                ("upvotes", "ALTER TABLE agent_episodic_memory ADD COLUMN upvotes INTEGER DEFAULT 0"),
                ("downvotes", "ALTER TABLE agent_episodic_memory ADD COLUMN downvotes INTEGER DEFAULT 0"),
                ("quality_score", "ALTER TABLE agent_episodic_memory ADD COLUMN quality_score REAL DEFAULT 0"),
            ]
            for column, statement in migrations:
                if column not in existing_columns:
                    cur.execute(statement)
            # Baris lama belum punya pemilik. Masukkan ke keranjang "anonymous"
            # (bukan NULL) supaya predikat user_key selalu punya nilai yang bisa
            # diprediksi dan tidak ada baris yang lolos lewat IS NULL.
            cur.execute(
                "UPDATE agent_episodic_memory SET user_key = 'anonymous' "
                "WHERE user_key IS NULL OR TRIM(user_key) = ''"
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_mem_topic ON agent_episodic_memory(topic)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_mem_tier ON agent_episodic_memory(tier)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_mem_misconception ON agent_episodic_memory(misconception_type)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_mem_user ON agent_episodic_memory(user_key)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_mem_user_topic ON agent_episodic_memory(user_key, topic)")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS learner_profiles (
                    profile_key TEXT PRIMARY KEY,
                    turns INTEGER DEFAULT 0,
                    valid_turns INTEGER DEFAULT 0,
                    fault_turns INTEGER DEFAULT 0,
                    topics_json TEXT DEFAULT '{}',
                    strong_topics_json TEXT DEFAULT '{}',
                    misconceptions_json TEXT DEFAULT '{}',
                    recent_topics_json TEXT DEFAULT '[]',
                    first_seen TEXT,
                    updated_at TEXT
                )
            """)
            # Umpan balik up/down dari rute chat. Dipisah dari baris memori
            # supaya umpan balik untuk memori yang sudah dihapus tidak hilang.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS agent_feedback (
                    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    memory_id TEXT,
                    conversation_id TEXT,
                    user_key TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    comment TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_feedback_memory ON agent_feedback(memory_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_feedback_user ON agent_feedback(user_key)")
            conn.commit()

    @staticmethod
    def _compute_memory_id(
        topic: str,
        normalized_query: str,
        steps: List[str],
        user_key: str = "anonymous",
    ) -> str:
        """memory_id dedup per pemilik: pengguna berbeda tidak saling menimpa.

        Keranjang "anonymous" tetap memakai rumus lama (tanpa user) agar baris
        seed yang sudah ada diperbarui di tempat, bukan diduplikasi.
        """
        parts = [topic.lower(), normalized_query.lower().strip(), "||".join(steps)]
        if user_key and user_key != "anonymous":
            parts.insert(0, user_key)
        payload = "|".join(parts)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
        return f"mem_{digest}"

    def learn_from_conversation(
        self,
        user_message: str,
        assistant_reply: str = "",
        explicit_steps: Optional[List[str]] = None,
        target_var: str = "x",
        tier_hint: Optional[str] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Distill a single user-assistant conversation turn into ZAP's episodic memory
        and (when SymPy-verified) promote it to the permanent MathCorpusStore.

        `user_id` (opsional) di-hash menjadi `user_key` anonim: memori satu
        pengguna tidak pernah diambil atau ditimpa oleh pengguna lain.
        """
        clean_user = redact_pii(user_message)
        if not clean_user and not explicit_steps:
            return {"status": "skipped", "reason": "empty_input"}
        user_key = self._user_key(user_id)

        # 1. Extract or normalize algebraic steps
        steps = [s.strip() for s in (explicit_steps or []) if s and s.strip()]
        if not steps:
            steps = extract_math_steps_from_text(clean_user)

        # 2. Classify topic, tier, and 2D/3D geometric intent
        topic, _ = classify_topic(clean_user + " " + " ".join(steps))
        tier = infer_jenjang(topic, tier_hint, None)
        geo_match = self.geo_db.resolve_intent(clean_user)
        shape_kind = geo_match["id"] if geo_match else None

        # 3. Run Deterministic SymPy CFL Engine if steps exist
        cfl_status = "CONCEPTUAL_QUERY"
        misconception_type: Optional[str] = None
        counter_example: Optional[Dict[str, Any]] = None
        sympy_verified = False

        if len(steps) >= 2:
            fault_idx, diag = isolate_first_fault_breakpoint(steps, target_var=target_var)
            cfl_status = diag.get("status", "UNKNOWN")
            if cfl_status == "FAULT_DETECTED":
                misconception_type = diag.get("misconception_type")
                counter_example = diag.get("counter_example")
                # A detected fault is a diagnosis, NOT a verification: the
                # student's derivation is wrong, so it must never be flagged
                # sympy_verified nor promoted into the corpus.
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

        # 4. Build & Guardrail-Sanitize the Socratic Resolution
        raw_resolution = redact_pii(assistant_reply) if assistant_reply else ""
        if not raw_resolution:
            if misconception_type == "DISTRIBUTIVE_EXPANSION_ILLUSION":
                raw_resolution = (
                    "Perhatikan ekspansi kuadratmu. Coba kalikan suku demi suku pada (a + b)(a + b); "
                    "apakah ada suku perkalian silang 2ab yang terlewat?"
                )
            elif misconception_type == "SIGN_INVERSION_OR_TRANSPOSITION_ERROR":
                raw_resolution = (
                    "Saat memindahkan suku melewati tanda sama dengan (=), operasi kebalikan apa "
                    "yang harus diterapkan pada kedua ruas agar tetap seimbang?"
                )
            elif misconception_type == "ROOT_LOSS":
                raw_resolution = (
                    "Ketika menarik akar kuadrat dari kedua ruas, selain bilangan positif, "
                    "apakah ada bilangan negatif yang jika dikuadratkan menghasilkan nilai yang sama?"
                )
            elif geo_match:
                raw_resolution = (
                    f"Untuk memahami bangun {geo_match['name_id']}, perhatikan parameter ukurannya di kanvas. "
                    f"Bagaimana hubungan antar elemen tersebut membentuk rumus utamanya?"
                )
            else:
                raw_resolution = (
                    "Mari kita telaah hubungan antar besaran yang diketahui pada soal ini. "
                    "Langkah aljabar pertama apa yang menurutmu paling tepat?"
                )

        socratic_resolution = RobustZeroAnswerGuardrail.sanitize(raw_resolution)
        memory_id = self._compute_memory_id(topic, clean_user[:160], steps, user_key)
        now_iso = datetime.now(timezone.utc).isoformat()

        # 5. Upsert into SQLite agent_episodic_memory (atomik, aman untuk penulis paralel)
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO agent_episodic_memory (
                    memory_id, user_key, conversation_id, tier, topic, shape_kind,
                    user_query, extracted_steps, cfl_status, misconception_type,
                    counter_example, socratic_resolution, sympy_verified, hit_count,
                    upvotes, downvotes, quality_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?)
                ON CONFLICT(memory_id) DO UPDATE SET
                    hit_count = agent_episodic_memory.hit_count + 1,
                    socratic_resolution = excluded.socratic_resolution,
                    conversation_id = COALESCE(excluded.conversation_id, agent_episodic_memory.conversation_id),
                    updated_at = excluded.updated_at
                """,
                (
                    memory_id,
                    user_key,
                    conversation_id,
                    tier,
                    topic,
                    shape_kind,
                    clean_user[:500],
                    json.dumps(steps, ensure_ascii=False),
                    cfl_status,
                    misconception_type,
                    json.dumps(counter_example, ensure_ascii=False) if counter_example else None,
                    socratic_resolution,
                    1 if sympy_verified else 0,
                    now_iso,
                ),
            )
            row = cur.execute(
                "SELECT hit_count FROM agent_episodic_memory WHERE memory_id = ?",
                (memory_id,),
            ).fetchone()
            hit_count = int(row[0]) if row else 1
            conn.commit()

        memory_record = {
            "memory_id": memory_id,
            "user_key": user_key,
            "conversation_id": conversation_id,
            "tier": tier,
            "topic": topic,
            "shape_kind": shape_kind,
            "user_query": clean_user[:500],
            "extracted_steps": steps,
            "cfl_status": cfl_status,
            "misconception_type": misconception_type,
            "counter_example": counter_example,
            "socratic_resolution": socratic_resolution,
            "sympy_verified": sympy_verified,
            "hit_count": hit_count,
            "updated_at": now_iso,
        }

        self._sync_memory_jsonl(memory_record)

        # 6. Promote to permanent MathCorpusStore ONLY when the CFL verdict is
        # ALL_STEPS_VALID and the derivation is genuinely valid (is_valid True).
        promoted_to_corpus = False
        if cfl_status == "ALL_STEPS_VALID" and sympy_verified and len(steps) >= 2:
            corpus_item = {
                "id": f"conv_{memory_id}",
                "tier": tier,
                "topic": f"Pembelajaran Percakapan ({topic.capitalize()})",
                "subtopic": misconception_type or "Penurunan Aljabar Terverifikasi",
                "dimension": geo_match["dimension"] if geo_match else "Abstract",
                "shape_kind": shape_kind,
                "question": clean_user[:500],
                "steps": steps,
                "target_variable": target_var,
                "canvas_target": geo_match.get("smartboard") if geo_match else None,
                "sympy_verification": {
                    "cfl_status": cfl_status,
                    "misconception_type": misconception_type,
                    "is_valid": cfl_status == "ALL_STEPS_VALID",
                },
                "socratic_prompt": socratic_resolution,
                "source": "ZAP Continuous User Conversation Memory",
            }
            self.corpus_store.insert_batch([corpus_item])
            promoted_to_corpus = True

        learner_profile = None
        if user_id:
            learner_profile = self._update_learner_profile(
                user_id=user_id,
                topic=topic,
                cfl_status=cfl_status,
                misconception_type=misconception_type,
            )

        return {
            "status": "learned",
            "learned": True,
            "learner_profile": learner_profile,
            "memory_id": memory_id,
            "tier": tier,
            "topic": topic,
            "shape_kind": shape_kind,
            "cfl_status": cfl_status,
            "misconception_type": misconception_type,
            "sympy_verified": sympy_verified,
            "promoted_to_corpus": promoted_to_corpus,
            "hit_count": hit_count,
            "socratic_resolution": socratic_resolution,
        }

    def _fetch_memory_record(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """Baca ulang satu baris memori dari SQLite sebagai dict mirror JSONL."""
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM agent_episodic_memory WHERE memory_id = ?", (memory_id,)
            ).fetchone()
        if not row:
            return None
        data = dict(row)
        try:
            steps = json.loads(data.get("extracted_steps") or "[]")
        except (TypeError, ValueError):
            steps = []
        try:
            counter_example = json.loads(data["counter_example"]) if data.get("counter_example") else None
        except (TypeError, ValueError):
            counter_example = None
        return {
            "memory_id": data.get("memory_id"),
            "user_key": data.get("user_key"),
            "conversation_id": data.get("conversation_id"),
            "tier": data.get("tier"),
            "topic": data.get("topic"),
            "shape_kind": data.get("shape_kind"),
            "user_query": data.get("user_query"),
            "extracted_steps": steps,
            "cfl_status": data.get("cfl_status"),
            "misconception_type": data.get("misconception_type"),
            "counter_example": counter_example,
            "socratic_resolution": data.get("socratic_resolution"),
            "sympy_verified": bool(data.get("sympy_verified")),
            "hit_count": int(data.get("hit_count") or 0),
            "updated_at": data.get("updated_at"),
        }

    def _sync_memory_jsonl(self, latest_record: Dict[str, Any]) -> None:
        """Tulis mirror JSONL secara atomik (file sementara + os.replace).

        Catatan implementasi:
        - Lock proses mencegah dua request paralel saling menimpa.
        - Baris korup tidak menggagalkan seluruh penulisan; baris mentahnya
          disimpan ke `<path>.corrupt`, bukan hilang diam-diam.
        - Nilai terbaru dibaca ulang dari SQLite (sumber kebenaran) supaya
          hit_count yang ditulis bukan nilai basi dari penulis yang kalah balapan.
        """
        memory_id = latest_record.get("memory_id")
        if not memory_id:
            return
        tmp_path = f"{self.memory_jsonl_path}.{os.getpid()}.{threading.get_ident()}.tmp"
        with _MEMORY_JSONL_LOCK:
            fresh = self._fetch_memory_record(memory_id) or latest_record
            records: Dict[str, Dict[str, Any]] = {}
            corrupt_lines: List[str] = []
            if os.path.exists(self.memory_jsonl_path):
                with open(self.memory_jsonl_path, "r", encoding="utf-8") as f:
                    for raw_line in f:
                        line = raw_line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except (json.JSONDecodeError, ValueError):
                            corrupt_lines.append(raw_line)
                            continue
                        if isinstance(obj, dict) and obj.get("memory_id"):
                            records[obj["memory_id"]] = obj
            records[memory_id] = fresh
            with open(tmp_path, "w", encoding="utf-8", newline="\n") as f:
                for item in records.values():
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
            # os.replace bisa gagal sementara di Windows bila pembaca lain
            # masih memegang berkas; coba beberapa kali sebelum menyerah.
            for attempt in range(3):
                try:
                    os.replace(tmp_path, self.memory_jsonl_path)
                    break
                except PermissionError:
                    if attempt == 2:
                        raise
                    time.sleep(0.05)
            if corrupt_lines:
                with open(f"{self.memory_jsonl_path}.corrupt", "a", encoding="utf-8") as f:
                    for raw_line in corrupt_lines:
                        f.write(raw_line if raw_line.endswith("\n") else raw_line + "\n")

    def reconcile_memory_jsonl(self) -> Dict[str, Any]:
        """Tulis ulang mirror JSONL dari SQLite (sumber kebenaran) secara atomik.

        Dipakai untuk memulihkan baris yang hilang akibat versi lama yang
        menulis mirror di tempat tanpa lock. Mengembalikan jumlah baris yang
        ditulis; sidik jari tetap dihitung oleh get_memory_stats().
        """
        tmp_path = f"{self.memory_jsonl_path}.{os.getpid()}.{threading.get_ident()}.tmp"
        with _MEMORY_JSONL_LOCK:
            with self._connect() as conn:
                memory_ids = [
                    row[0]
                    for row in conn.execute(
                        "SELECT memory_id FROM agent_episodic_memory ORDER BY updated_at ASC"
                    ).fetchall()
                ]
            records: Dict[str, Dict[str, Any]] = {}
            for memory_id in memory_ids:
                fresh = self._fetch_memory_record(memory_id)
                if fresh:
                    records[memory_id] = fresh
            with open(tmp_path, "w", encoding="utf-8", newline="\n") as f:
                for item in records.values():
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
            for attempt in range(3):
                try:
                    os.replace(tmp_path, self.memory_jsonl_path)
                    break
                except PermissionError:
                    if attempt == 2:
                        raise
                    time.sleep(0.05)
        return {"jsonl_records": len(records)}


    # ------------------------------------------------------ Learner Profile
    # ------------------------------------------------------ Isolasi Pengguna
    @classmethod
    def _user_key(cls, user_id: Optional[str]) -> str:
        """Kunci anonim stabil untuk isolasi memori episodik per pengguna.

        Identitas mentah (email/IP) TIDAK pernah disimpan; hanya hash SHA-256
        terpotong 16 hex yang menjadi `user_key`. Tanpa user_id, pemanggil
        masuk keranjang "anonymous" (bukan NULL) supaya predikat user_key
        selalu punya nilai yang bisa diprediksi.
        """
        if user_id and str(user_id).strip():
            return cls._profile_key(str(user_id))
        return "anonymous"

    @staticmethod
    def _profile_key(user_id: str) -> str:
        """Kunci profil anonim: hash SHA-256 dari identitas pengguna.

        Identitas mentah (email/IP) TIDAK pernah disimpan; hanya hash
        terpotong yang menjadi kunci baris profil belajar.
        """
        digest = hashlib.sha256(user_id.strip().lower().encode("utf-8")).hexdigest()[:16]
        return f"u_{digest}"

    def _update_learner_profile(
        self,
        user_id: str,
        topic: str,
        cfl_status: str,
        misconception_type: Optional[str],
    ) -> Dict[str, Any]:
        """Perbarui agregat profil belajar satu pengguna dari satu giliran chat."""
        key = self._profile_key(user_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        is_valid = cfl_status in ("ALL_STEPS_VALID", "SINGLE_EXPRESSION_VALID")
        is_fault = cfl_status == "FAULT_DETECTED"
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM learner_profiles WHERE profile_key = ?", (key,))
            row = cur.fetchone()
            if row:
                cols = [d[0] for d in cur.description]
                data = dict(zip(cols, row))
                topics = json.loads(data.get("topics_json") or "{}")
                strong = json.loads(data.get("strong_topics_json") or "{}")
                misc = json.loads(data.get("misconceptions_json") or "{}")
                recent = json.loads(data.get("recent_topics_json") or "[]")
                turns = int(data.get("turns") or 0) + 1
                valid_turns = int(data.get("valid_turns") or 0) + (1 if is_valid else 0)
                fault_turns = int(data.get("fault_turns") or 0) + (1 if is_fault else 0)
                first_seen = data.get("first_seen") or now_iso
            else:
                topics, strong, misc, recent = {}, {}, {}, []
                turns, valid_turns, fault_turns = 1, (1 if is_valid else 0), (1 if is_fault else 0)
                first_seen = now_iso
            topics[topic] = topics.get(topic, 0) + 1
            if is_valid:
                strong[topic] = strong.get(topic, 0) + 1
            if is_fault and misconception_type:
                misc[misconception_type] = misc.get(misconception_type, 0) + 1
            recent = ([topic] + [t for t in recent if t != topic])[:5]
            cur.execute(
                """
                INSERT OR REPLACE INTO learner_profiles (
                    profile_key, turns, valid_turns, fault_turns, topics_json,
                    strong_topics_json, misconceptions_json, recent_topics_json,
                    first_seen, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    key, turns, valid_turns, fault_turns,
                    json.dumps(topics, ensure_ascii=False),
                    json.dumps(strong, ensure_ascii=False),
                    json.dumps(misc, ensure_ascii=False),
                    json.dumps(recent, ensure_ascii=False),
                    first_seen, now_iso,
                ),
            )
            conn.commit()
        return self.get_learner_profile(user_id) or {}

    def get_learner_profile(self, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Ambil ringkasan profil belajar (agregat saja, tanpa data mentah)."""
        if not user_id:
            return None
        key = self._profile_key(user_id)
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM learner_profiles WHERE profile_key = ?", (key,))
            row = cur.fetchone()
        if not row:
            return {"profile_key": key, "turns": 0, "valid_turns": 0, "fault_turns": 0,
                    "topics": {}, "strong_topics": {}, "misconceptions": {}, "recent_topics": []}
        data = dict(row)
        return {
            "profile_key": key,
            "turns": data.get("turns") or 0,
            "valid_turns": data.get("valid_turns") or 0,
            "fault_turns": data.get("fault_turns") or 0,
            "topics": json.loads(data.get("topics_json") or "{}"),
            "strong_topics": json.loads(data.get("strong_topics_json") or "{}"),
            "misconceptions": json.loads(data.get("misconceptions_json") or "{}"),
            "recent_topics": json.loads(data.get("recent_topics_json") or "[]"),
            "first_seen": data.get("first_seen"),
            "updated_at": data.get("updated_at"),
        }

    @staticmethod
    def _profile_context_lines(profile: Dict[str, Any]) -> List[str]:
        """Susun blok profil belajar untuk disuntikkan ke prompt tutor."""
        if not profile or not profile.get("turns"):
            return []
        strong = sorted((profile.get("strong_topics") or {}).items(), key=lambda kv: -kv[1])[:3]
        misc = sorted((profile.get("misconceptions") or {}).items(), key=lambda kv: -kv[1])[:3]
        lines = [
            f"  [LEARNER_PROFILE] Pengguna ini sudah berlatih {profile['turns']} giliran terdiagnosis "
            f"({profile.get('valid_turns', 0)} langkah valid, {profile.get('fault_turns', 0)} ada kesalahan terdeteksi)."
        ]
        if strong:
            lines.append(
                "    Topik yang pernah dikuasai (langkah terverifikasi valid): "
                + ", ".join(f"{t} ({n}x)" for t, n in strong)
                + ". Beri tantangan sedikit lebih tinggi pada topik ini."
            )
        if misc:
            lines.append(
                "    Pola miskonsepsi yang pernah muncul: "
                + ", ".join(f"{t} ({n}x)" for t, n in misc)
                + ". Beri scaffolding ekstra dan contoh penyeimbang bila pola ini muncul lagi."
            )
        lines.append("    (Profil ini konteks internal tutor; jangan menyebutkannya secara eksplisit ke pengguna.)")
        return lines

    # ---------------- Pola Geometri Self-Learning ----------------
    # Pola frasa -> spesifikasi bangun yang SUDAH lolos validasi mesin
    # geometri. Hanya resolusi LLM yang tervalidasi yang boleh masuk;
    # pola mentah / tebakan model tidak pernah disimpan (fail-closed).

    @staticmethod
    def _normalize_phrase(text: str) -> str:
        import re as _re
        lowered = (text or "").lower()
        cleaned = _re.sub(r"[^a-z0-9\s]", " ", lowered)
        return _re.sub(r"\s+", " ", cleaned).strip()

    def _init_geometry_patterns_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS geometry_patterns (
                pattern_key TEXT PRIMARY KEY,
                phrase TEXT NOT NULL,
                spec_json TEXT NOT NULL,
                hits INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    def learn_geometry_pattern(self, phrase: str, spec: Dict[str, Any]) -> Dict[str, Any]:
        normalized = self._normalize_phrase(phrase)
        if not normalized or not isinstance(spec, dict) or not spec.get("family"):
            return {"status": "rejected", "reason": "frasa kosong atau spec tidak valid"}
        key = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            self._init_geometry_patterns_table(conn)
            row = conn.execute(
                "SELECT hits FROM geometry_patterns WHERE pattern_key = ?", (key,)
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE geometry_patterns SET hits = hits + 1, spec_json = ?, updated_at = ? WHERE pattern_key = ?",
                    (json.dumps(spec, ensure_ascii=False), now, key),
                )
                hits = int(row[0]) + 1
                status = "updated"
            else:
                conn.execute(
                    "INSERT INTO geometry_patterns (pattern_key, phrase, spec_json, hits, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
                    (key, normalized, json.dumps(spec, ensure_ascii=False), now, now),
                )
                hits = 1
                status = "learned"
            conn.commit()
        return {"status": status, "pattern_key": key, "phrase": normalized, "hits": hits}

    def list_geometry_patterns(self, limit: int = 200) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            self._init_geometry_patterns_table(conn)
            rows = conn.execute(
                "SELECT phrase, spec_json, hits FROM geometry_patterns ORDER BY hits DESC, updated_at DESC LIMIT ?",
                (max(1, min(limit, 500)),),
            ).fetchall()
        out: List[Dict[str, Any]] = []
        for phrase, spec_json, hits in rows:
            try:
                spec = json.loads(spec_json)
            except (TypeError, ValueError):
                continue
            out.append({"phrase": phrase, "spec": spec, "hits": int(hits)})
        return out

    def match_geometry_pattern(self, query: str) -> Optional[Dict[str, Any]]:
        normalized = self._normalize_phrase(query)
        if not normalized:
            return None
        query_tokens = set(normalized.split())
        best: Optional[Dict[str, Any]] = None
        best_score = 0.0
        for item in self.list_geometry_patterns(limit=500):
            phrase = item["phrase"]
            if phrase in normalized:
                score = 1.0 + len(phrase) / 1000.0
            else:
                tokens = set(phrase.split())
                if not tokens:
                    continue
                # Angka adalah identitas bangun (segi 8 != segi 9): pola yang
                # mengandung angka hanya boleh cocok bila angkanya persis sama.
                pattern_digits = {tok for tok in tokens if tok.isdigit()}
                query_digits = {tok for tok in query_tokens if tok.isdigit()}
                if pattern_digits and pattern_digits != query_digits:
                    continue
                overlap = len(tokens & query_tokens) / len(tokens)
                if overlap < 0.8:
                    continue
                score = overlap
            if score > best_score:
                best_score = score
                best = item
        if best is None:
            return None
        return {"phrase": best["phrase"], "spec": best["spec"], "hits": best["hits"], "score": round(best_score, 3)}

    def retrieve_relevant_memories(
        self, query: str, limit: int = 3, user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Ambil memori episodik MILIK satu pengguna, diurutkan relevansi.

        Sebelumnya query difilter dengan `topic = ? OR user_query LIKE ?` lalu
        diurutkan `sympy_verified, hit_count` sehingga frasa unik yang baru
        dipelajari jarang sekali muncul. Sekarang:
          1. hanya baris dengan user_key milik pemanggil (isolasi pengguna),
          2. skor tumpang tindih istilah kueri (lihat _score_memory),
          3. seri dipecah sympy_verified DESC, hit_count DESC, updated_at DESC.
        Bila tidak ada istilah yang cocok, kembalikan baris milik pengguna itu
        saja (fallback personal, bukan baris acak lintas pengguna).
        """
        user_key = self._user_key(user_id)
        terms = _query_terms(query)
        normalized = (query or "").strip()
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM agent_episodic_memory WHERE user_key = ? "
                    "ORDER BY updated_at DESC LIMIT 2000",
                    (user_key,),
                ).fetchall()
            ]
        if not rows:
            return []

        # Urutkan dulu berdasarkan updated_at DESC, lalu stable-sort skor;
        # updated_at DESC tetap menjadi tiebreak terakhir.
        ranked = sorted(rows, key=lambda r: str(r.get("updated_at") or ""), reverse=True)
        scored = [(_score_memory(row, terms, normalized), row) for row in ranked]
        scored.sort(
            key=lambda pair: (
                -pair[0],
                -int(pair[1].get("sympy_verified") or 0),
                -int(pair[1].get("hit_count") or 0),
            )
        )
        matched = [row for score, row in scored if score > 0]
        if matched:
            return matched[:limit]
        return [row for _, row in scored[:limit]]

    def _filter_corpus_references(
        self, corpus_matches: List[Dict[str, Any]], user_key: str
    ) -> List[Dict[str, Any]]:
        """Saring referensi korpus hasil promosi percakapan milik pengguna lain.

        Item korpus sintetis/harvester bersifat global (pengetahuan terverifikasi),
        tetapi item hasil promosi percakapan ber-ID `conv_<memory_id>` membawa
        pertanyaan asli pengguna. Item seperti itu hanya boleh muncul pada
        konteks pemiliknya.
        """
        if not corpus_matches:
            return []
        conv_memory_ids = [
            str(item.get("id"))[5:]
            for item in corpus_matches
            if str(item.get("id") or "").startswith("conv_")
        ]
        owners: Dict[str, str] = {}
        if conv_memory_ids:
            placeholders = ",".join("?" * len(conv_memory_ids))
            with self._connect() as conn:
                for memory_id, owner in conn.execute(
                    f"SELECT memory_id, user_key FROM agent_episodic_memory WHERE memory_id IN ({placeholders})",
                    conv_memory_ids,
                ).fetchall():
                    owners[str(memory_id)] = str(owner)
        filtered: List[Dict[str, Any]] = []
        for item in corpus_matches:
            corpus_id = str(item.get("id") or "")
            if corpus_id.startswith("conv_"):
                if owners.get(corpus_id[5:]) != user_key:
                    continue
            filtered.append(item)
        return filtered

    @staticmethod
    def _public_memory(row: Dict[str, Any]) -> Dict[str, Any]:
        """Bentuk aman satu memori untuk respons API (tanpa baris pengguna lain)."""
        return {
            "memory_id": row.get("memory_id"),
            "topic": row.get("topic"),
            "cfl_status": row.get("cfl_status"),
            "misconception_type": row.get("misconception_type"),
            "sympy_verified": bool(row.get("sympy_verified")),
            "hit_count": int(row.get("hit_count") or 0),
            "updated_at": row.get("updated_at"),
            "user_query_snippet": (row.get("user_query") or "")[:80],
            "socratic_resolution": row.get("socratic_resolution"),
        }

    def build_harness_context(self, query: str, limit: int = 3, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Construct the complete ZAP Agent Harness context for a user query:
        combines Episodic Memory, Verified Math Corpus, and 2D/3D Geometry formulas.

        Konteks hanya memuat memori episodik milik pemanggil; referensi korpus
        hasil promosi percakapan juga disaring ke pemiliknya. Referensi korpus
        sintetis/harvester tetap global karena berisi pengetahuan terverifikasi.
        """
        user_key = self._user_key(user_id)
        memories = self.retrieve_relevant_memories(query, limit=limit, user_id=user_id)

        corpus_matches = self.corpus_store.search_ranked(query, limit=max(limit, 5))
        if not corpus_matches:
            topic, _ = classify_topic(query)
            corpus_matches = self.corpus_store.search_ranked(topic, limit=max(limit, 5))
        corpus_matches = self._filter_corpus_references(corpus_matches, user_key)[:limit]

        geo_match = self.geo_db.resolve_intent(query)

        learner_profile = self.get_learner_profile(user_id) if user_id else None

        lines = ["<ZAP_AGENT_HARNESS_CONTEXT>"]
        if learner_profile:
            lines.extend(self._profile_context_lines(learner_profile))
        if geo_match:
            lines.append(
                f"  [GEOMETRY_INTENT] ID={geo_match['id']} ({geo_match['name_id']}, Dimensi={geo_match['dimension']})"
            )
            formulas_str = ", ".join(
                f"{k}: {v.get('katex', v.get('formula', ''))}"
                for k, v in geo_match.get("formulas", {}).items()
            )
            lines.append(f"  [VERIFIED_FORMULAS] {formulas_str}")

        if memories:
            lines.append("  [LEARNED_EPISODIC_MEMORIES]")
            for m in memories:
                misc = m.get("misconception_type") or m.get("cfl_status")
                snippet = (m.get("user_query") or "").replace("\n", " ")[:80]
                lines.append(
                    f"    - Topik={m['topic']} | Status={misc} (Hits={m['hit_count']}): "
                    f"Konteks=\"{snippet}\" | Scaffolding Sokratik -> \"{m['socratic_resolution']}\""
                )

        if corpus_matches:
            lines.append("  [VERIFIED_CORPUS_REFERENCES]")
            for c in corpus_matches[:2]:
                lines.append(
                    f"    - [{c['tier']}/{c['subtopic']}] Soal: \"{c['question'][:100]}\" | "
                    f"Socratic Hint: \"{c.get('socratic_prompt', '')}\""
                )

        lines.append("</ZAP_AGENT_HARNESS_CONTEXT>")

        joined_ctx = "\n".join(lines)
        return {
            "status": "success",
            "prompt_injection": joined_ctx,
            "harness_context": joined_ctx,
            "learner_profile": learner_profile,
            "geometry_intent": geo_match,
            "episodic_memories": [self._public_memory(m) for m in memories],
            "corpus_references": corpus_matches[:limit],
        }

    def store_feedback(
        self,
        rating: Any,
        user_id: Optional[str] = None,
        user_key: Optional[str] = None,
        memory_id: Optional[str] = None,
        comment: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Simpan umpan balik up/down satu pengguna ke tabel agent_feedback.

        Bila memory_id menunjuk baris milik pengguna yang sama, kolom
        upvotes/downvotes/quality_score ikut diperbarui. Umpan balik untuk
        memori pengguna lain tetap disimpan di agent_feedback, tetapi tidak
        mengubah baris memori tersebut (tidak ada penulisan lintas pengguna).
        """
        if rating in ("up", 1):
            value = 1
        elif rating in ("down", -1):
            value = -1
        else:
            raise ValueError("rating harus 'up'/'down' atau 1/-1")

        key = (user_key or "").strip() or self._user_key(user_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        clean_comment = redact_pii(comment)[:1000] if comment else None

        with self._connect() as conn:
            cur = conn.cursor()
            owner: Optional[str] = None
            if memory_id:
                row = cur.execute(
                    "SELECT user_key FROM agent_episodic_memory WHERE memory_id = ?",
                    (memory_id,),
                ).fetchone()
                owner = str(row[0]) if row and row[0] is not None else None
            cur.execute(
                """
                INSERT INTO agent_feedback (
                    memory_id, conversation_id, user_key, rating, comment, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (memory_id, conversation_id, key, value, clean_comment, now_iso),
            )
            feedback_id = cur.lastrowid
            applied_to_memory = bool(memory_id and owner == key)
            if applied_to_memory:
                up_inc = 1 if value == 1 else 0
                down_inc = 1 if value == -1 else 0
                cur.execute(
                    """
                    UPDATE agent_episodic_memory
                    SET upvotes = COALESCE(upvotes, 0) + ?,
                        downvotes = COALESCE(downvotes, 0) + ?,
                        quality_score = (COALESCE(upvotes, 0) + ?) - (COALESCE(downvotes, 0) + ?)
                    WHERE memory_id = ? AND user_key = ?
                    """,
                    (up_inc, down_inc, up_inc, down_inc, memory_id, key),
                )
            conn.commit()

        return {
            "status": "recorded",
            "feedback_id": feedback_id,
            "memory_id": memory_id,
            "rating": "up" if value == 1 else "down",
            "rating_value": value,
            "applied_to_memory": applied_to_memory,
            "created_at": now_iso,
        }

    def get_memory_stats(self) -> Dict[str, Any]:
        """Return telemetry on ZAP's episodic conversation memory."""
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*), COALESCE(SUM(hit_count), 0) FROM agent_episodic_memory")
            total_episodes, total_hits = cur.fetchone()

            cur.execute("SELECT COUNT(*) FROM agent_episodic_memory WHERE sympy_verified = 1")
            sympy_verified_count = cur.fetchone()[0]

            cur.execute(
                "SELECT tier, COUNT(*) FROM agent_episodic_memory GROUP BY tier"
            )
            by_tier = dict(cur.fetchall())

            cur.execute(
                "SELECT topic, COUNT(*) FROM agent_episodic_memory GROUP BY topic"
            )
            by_topic = dict(cur.fetchall())

            cur.execute(
                "SELECT misconception_type, COUNT(*) FROM agent_episodic_memory "
                "WHERE misconception_type IS NOT NULL GROUP BY misconception_type"
            )
            by_misconception = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM agent_episodic_memory WHERE user_key = 'anonymous'")
            anonymous_episodes = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM agent_episodic_memory WHERE user_key IS NULL")
            unowned_episodes = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*), COALESCE(SUM(rating = 1), 0), COALESCE(SUM(rating = -1), 0) FROM agent_feedback")
            feedback_total, feedback_up, feedback_down = cur.fetchone()

        jsonl_count = 0
        corrupt_count = 0
        if os.path.exists(self.memory_jsonl_path):
            with open(self.memory_jsonl_path, "r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        json.loads(line)
                    except (json.JSONDecodeError, ValueError):
                        corrupt_count += 1
                        continue
                    jsonl_count += 1

        return {
            "total_episodes": total_episodes,
            "total_episodic_memories": total_episodes,
            "total_interaction_hits": total_hits,
            "total_conversation_hits": total_hits,
            "sympy_verified_episodes": sympy_verified_count,
            "by_tier": by_tier,
            "by_topic": by_topic,
            "by_misconception": by_misconception,
            "anonymous_episodes": anonymous_episodes,
            "unowned_episodes": unowned_episodes,
            "feedback_total": feedback_total,
            "feedback_up": feedback_up,
            "feedback_down": feedback_down,
            # Rekonsiliasi DB (sumber kebenaran) vs mirror JSONL.
            "jsonl_records": jsonl_count,
            "jsonl_corrupt_lines": corrupt_count,
            "jsonl_db_delta": jsonl_count - total_episodes,
        }


def seed_foundational_agent_memories(harness: ZAPAgentHarness) -> int:
    """
    Seed the ZAP Agent Harness with foundational Socratic conversation episodes
    spanning classic student misconceptions and 2D/3D spatial queries.
    """
    seed_conversations = [
        {
            "user_message": "Kak aku ngitung (x + 3)^2 - 4 kok hasilnya x^2 + 9 - 4 terus jadi x^2 + 5 ya?",
            "explicit_steps": ["(x + 3)^2 - 4", "x^2 + 9 - 4", "x^2 + 5"],
            "assistant_reply": (
                "Di baris ke-2, kamu mengekspansi (x + 3)^2 menjadi x^2 + 9. "
                "Coba kita uji jika x = 2: berapakah nilai (2 + 3)^2 - 4, dan berapakah nilai 2^2 + 5? "
                "Mengapa hasilnya berbeda? Suku perkalian silang apa yang terlewat saat mengalikan (x + 3)(x + 3)?"
            ),
            "target_var": "x",
            "tier_hint": "SMP",
        },
        {
            "user_message": "Saya mengerjakan persamaan linear 2x + 3 = 7, lalu pindah ruas jadi 2x = 10.",
            "explicit_steps": ["2x + 3 = 7", "2x = 10"],
            "assistant_reply": (
                "Perhatikan langkah kedua saat memindahkan +3 dari ruas kiri ke ruas kanan. "
                "Operasi apa yang seharusnya kita lakukan pada kedua ruas persamaan agar +3 di kiri menjadi nol?"
            ),
            "target_var": "x",
            "tier_hint": "SMP",
        },
        {
            "user_message": "Kalau persamaan kuadrat x^2 = 4 berarti akarnya cuma x = 2 kan?",
            "explicit_steps": ["x^2 = 4", "x = 2"],
            "assistant_reply": (
                "Kamu sudah menemukan akar positifnya! Namun ingat, ketika suatu bilangan dikuadratkan menghasilkan 4, "
                "selain +2, apakah ada bilangan negatif yang jika dikalikan dengan dirinya sendiri juga bernilai +4?"
            ),
            "target_var": "x",
            "tier_hint": "SMA",
        },
        {
            "user_message": "Gimana cara nentuin rumus diagonal ruang dan diagonal bidang pada bangun ruang kubus 3D?",
            "explicit_steps": [],
            "assistant_reply": (
                "Mari amati model Kubus 3D di kanvas! Sebuah sisi alas kubus berbentuk persegi dengan rusuk s. "
                "Jika kita tarik garis diagonal bidang pada alas tersebut, segitiga siku-siku apa yang terbentuk, "
                "dan bagaimana Teorema Pythagoras menghubungkan rusuk s dengan diagonal bidang itu?"
            ),
            "target_var": "s",
            "tier_hint": "SMA",
        },
        {
            "user_message": "Bagaimana cara mencari luas jajar genjang jika diketahui alas dan tingginya?",
            "explicit_steps": [],
            "assistant_reply": (
                "Perhatikan visualisasi Jajar Genjang 2D di kanvas. Jika segitiga siku-siku di sisi miring kiri "
                "kita potong lalu digeser ke sisi kanan, bangun datar apa yang terbentuk? "
                "Dari situ, bagaimana kita merumuskan luasnya menggunakan alas (a) dan tinggi tegak lurus (t)?"
            ),
            "target_var": "L",
            "tier_hint": "SD",
        },
        {
            "user_message": "Aku sudah memfaktorkan x^2 - 5x + 6 = 0 menjadi (x - 2)(x - 3) = 0.",
            "explicit_steps": ["x^2 - 5x + 6 = 0", "(x - 2)(x - 3) = 0"],
            "assistant_reply": (
                "Langkah pemfaktoranmu sudah tepat dan ekuivalen secara aljabar! "
                "Sekarang, agar hasil kali (x - 2) dan (x - 3) bernilai nol, berapakah nilai pembuat nol dari masing-masing faktor tersebut?"
            ),
            "target_var": "x",
            "tier_hint": "SMA",
        },
    ]

    learned_count = 0
    for conv in seed_conversations:
        res = harness.learn_from_conversation(**conv)
        if res.get("status") == "learned":
            learned_count += 1
    return learned_count

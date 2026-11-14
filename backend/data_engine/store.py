"""
ZAP Math Database & Storage Engine
Stores mathematical corpus in SQLite and JSONL with indexed querying capabilities.

Sejak perluasan multi-domain, setiap item boleh membawa `domain`
("matematika" | "pemrograman" | "fisika" | "kimia") beserta `hints` dan
`verification`. Baris lama tanpa `domain` tetap dimuat dan diperlakukan
sebagai "matematika" (backward compatible).
"""

import os
import re
import json
import time
import sqlite3
import threading
from typing import List, Dict, Any, Optional

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "zap_math_corpus.db")
DEFAULT_JSONL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "zap_math_corpus.jsonl")

DEFAULT_DOMAIN = "matematika"
KNOWN_DOMAINS = ("matematika", "pemrograman", "fisika", "kimia")

# Lock proses untuk penulisan mirror korpus JSONL (endpoint sinkron FastAPI
# berjalan di thread pool yang sama).
_CORPUS_JSONL_LOCK = threading.Lock()

# Kata umum yang tidak membantu pemeringkatan relevansi korpus.
_SEARCH_STOPWORDS = frozenset({
    "yang", "dan", "untuk", "dari", "dengan", "pada", "adalah", "itu", "ini",
    "aku", "saya", "kamu", "kita", "bisa", "bantu", "tolong", "coba", "kak",
    "bagaimana", "gimana", "cara", "apa", "apakah", "kenapa", "mengapa",
    "the", "and", "for", "with", "that", "this", "how", "what", "why",
})

class MathCorpusStore:
    @staticmethod
    def normalize_domain(item: Dict[str, Any]) -> str:
        """Domain item dengan default 'matematika' untuk data lama tanpa domain."""
        domain = str(item.get("domain") or DEFAULT_DOMAIN).strip().lower()
        return domain or DEFAULT_DOMAIN

    def __init__(self, db_path: str = DEFAULT_DB_PATH, jsonl_path: str = DEFAULT_JSONL_PATH):
        self.db_path = db_path
        self.jsonl_path = jsonl_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Koneksi SQLite berkinerja tinggi: WAL mode, synchronous NORMAL, dan timeout 5000ms."""
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS math_corpus (
                    id TEXT PRIMARY KEY,
                    domain TEXT DEFAULT 'matematika',
                    tier TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    subtopic TEXT NOT NULL,
                    dimension TEXT DEFAULT 'Abstract',
                    shape_kind TEXT,
                    question TEXT NOT NULL,
                    steps TEXT NOT NULL,
                    hints TEXT,
                    target_variable TEXT,
                    canvas_target TEXT,
                    sympy_verification TEXT,
                    verification TEXT,
                    socratic_prompt TEXT,
                    source TEXT DEFAULT 'ZAP SymPy Procedural Synthesis',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Migrasi aditif untuk database lama: kolom baru ditambahkan tanpa
            # menghapus data. Baris lama otomatis bernilai 'matematika'.
            existing_columns = {row[1] for row in cur.execute("PRAGMA table_info(math_corpus)").fetchall()}
            migrations = [
                ("domain", "ALTER TABLE math_corpus ADD COLUMN domain TEXT DEFAULT 'matematika'"),
                ("hints", "ALTER TABLE math_corpus ADD COLUMN hints TEXT"),
                ("verification", "ALTER TABLE math_corpus ADD COLUMN verification TEXT"),
            ]
            for column, statement in migrations:
                if column not in existing_columns:
                    cur.execute(statement)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_math_tier ON math_corpus(tier)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_math_shape ON math_corpus(shape_kind)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_math_topic ON math_corpus(topic)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_math_domain ON math_corpus(domain)")
            conn.commit()

    def insert_batch(self, items: List[Dict[str, Any]]):
        with self._get_connection() as conn:
            cur = conn.cursor()
            for it in items:
                cur.execute("""
                    INSERT OR REPLACE INTO math_corpus 
                    (id, domain, tier, topic, subtopic, dimension, shape_kind, question, steps, hints,
                     target_variable, canvas_target, sympy_verification, verification, socratic_prompt, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    it["id"],
                    self.normalize_domain(it),
                    it["tier"],
                    it.get("topic", "General"),
                    it.get("subtopic", "General"),
                    it.get("dimension", "Abstract"),
                    it.get("shape_kind"),
                    it["question"],
                    json.dumps(it.get("steps", [])),
                    json.dumps(it.get("hints")) if it.get("hints") else None,
                    it.get("target_variable"),
                    json.dumps(it.get("canvas_target")) if it.get("canvas_target") else None,
                    json.dumps(it.get("sympy_verification")) if it.get("sympy_verification") else None,
                    json.dumps(it.get("verification")) if it.get("verification") else None,
                    it.get("socratic_prompt"),
                    it.get("source", "ZAP Procedural Engine")
                ))
            conn.commit()

        # Update JSONL tanpa duplikasi: muat ID yang sudah ada, lewati item
        # yang ID-nya sudah tercatat, lalu tulis ulang secara atomik
        # (file sementara unik + os.replace) hanya bila ada item baru.
        # Lock proses + nama tmp unik: dua penulis paralel (mis. dua giliran
        # belajar yang sama-sama mempromosikan langkah valid) tidak boleh
        # berebut berkas .tmp yang sama (PermissionError di Windows).
        with _CORPUS_JSONL_LOCK:
            existing_items: List[Dict[str, Any]] = []
            existing_ids = set()
            if os.path.exists(self.jsonl_path):
                with open(self.jsonl_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        existing_items.append(obj)
                        if obj.get("id"):
                            existing_ids.add(obj["id"])

            new_items = [it for it in items if it.get("id") not in existing_ids]
            if new_items:
                tmp_path = f"{self.jsonl_path}.{os.getpid()}.{threading.get_ident()}.tmp"
                with open(tmp_path, "w", encoding="utf-8", newline="\n") as f:
                    for obj in existing_items + new_items:
                        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
                for attempt in range(3):
                    try:
                        os.replace(tmp_path, self.jsonl_path)
                        break
                    except PermissionError:
                        if attempt == 2:
                            raise
                        time.sleep(0.05)

    def query_by_tier(self, tier: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM math_corpus WHERE tier = ? ORDER BY id LIMIT ?", (tier.upper(), limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def query_by_domain(self, domain: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Ambil item per domain; data lama tanpa domain dihitung sebagai matematika."""
        normalized = (domain or DEFAULT_DOMAIN).strip().lower()
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM math_corpus WHERE COALESCE(NULLIF(domain, ''), 'matematika') = ? "
                "ORDER BY id LIMIT ?",
                (normalized, limit),
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def load_jsonl_items(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Muat item JSONL dan isi domain default untuk baris lama yang belum punya domain."""
        items: List[Dict[str, Any]] = []
        if not os.path.exists(self.jsonl_path):
            return items
        with open(self.jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                obj["domain"] = self.normalize_domain(obj)
                items.append(obj)
                if limit is not None and len(items) >= limit:
                    break
        return items

    def query_by_shape(self, shape_kind: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM math_corpus WHERE shape_kind = ?", (shape_kind.lower(),))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def search_by_keyword(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        pattern = f"%{query}%"
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM math_corpus 
                WHERE question LIKE ? OR topic LIKE ? OR subtopic LIKE ? OR shape_kind LIKE ? OR domain LIKE ?
                LIMIT ?
            """, (pattern, pattern, pattern, pattern, pattern, limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def _keyword_terms(query: str, max_terms: int = 8) -> List[str]:
        """Pecah kueri menjadi istilah unik untuk pemeringkatan relevansi."""
        tokens = [t for t in re.findall(r"[a-z0-9]+", (query or "").lower()) if len(t) >= 2]
        terms: List[str] = []
        for token in tokens:
            if token in _SEARCH_STOPWORDS or token in terms:
                continue
            terms.append(token)
        return terms[:max_terms]

    def search_ranked(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Cari korpus dengan skor relevansi istilah, bukan urutan tabel.

        Pencarian lama memakai satu pola `%query[:30]%` tanpa ORDER BY sehingga
        baris pertama tabel (mis. GSM8K) bisa muncul untuk kueri apa pun.
        Di sini istilah kueri dicocokkan per kata, diberi bobot kolom, lalu
        diurutkan menurun; `id` menjadi tiebreak yang deterministik.
        """
        terms = self._keyword_terms(query)
        if not terms:
            return self.search_by_keyword(query, limit=limit) if (query or "").strip() else []

        clause = (
            "(question LIKE ? OR topic LIKE ? OR subtopic LIKE ? OR shape_kind LIKE ? OR domain LIKE ?)"
        )
        where = " OR ".join([clause] * len(terms))
        params: List[Any] = []
        for term in terms:
            pattern = f"%{term}%"
            params.extend([pattern] * 5)

        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            # Batas 500 kandidat cukup untuk korpus ribuan baris dan menjaga
            # biaya skoring tetap kecil.
            cur.execute(f"SELECT * FROM math_corpus WHERE {where} LIMIT 500", params)
            rows = [dict(r) for r in cur.fetchall()]

        phrase = (query or "").strip().lower()
        scored = []
        for row in rows:
            question = str(row.get("question") or "").lower()
            haystack = " ".join(
                str(row.get(key) or "").lower()
                for key in ("question", "topic", "subtopic", "shape_kind", "domain")
            )
            score = 0.0
            for term in terms:
                if term in question:
                    score += 2.0
                elif term in haystack:
                    score += 1.0
            if len(phrase) >= 6 and phrase in question:
                score += 5.0
            if score > 0:
                scored.append((score, row))
        scored.sort(key=lambda pair: (-pair[0], str(pair[1].get("id") or "")))
        return [row for _, row in scored[:limit]]

    def get_statistics(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM math_corpus")
            total = cur.fetchone()[0]

            cur.execute("SELECT tier, COUNT(*) FROM math_corpus GROUP BY tier")
            by_tier = dict(cur.fetchall())

            cur.execute("SELECT shape_kind, COUNT(*) FROM math_corpus WHERE shape_kind IS NOT NULL GROUP BY shape_kind")
            by_shape = dict(cur.fetchall())

            # Baris lama tanpa domain dihitung sebagai matematika.
            cur.execute(
                "SELECT COALESCE(NULLIF(domain, ''), 'matematika'), COUNT(*) "
                "FROM math_corpus GROUP BY COALESCE(NULLIF(domain, ''), 'matematika')"
            )
            by_domain = dict(cur.fetchall())

            return {
                "total_records": total,
                "by_tier": by_tier,
                "by_domain": by_domain,
                "by_shape": by_shape,
                "db_path": self.db_path,
                "jsonl_path": self.jsonl_path
            }

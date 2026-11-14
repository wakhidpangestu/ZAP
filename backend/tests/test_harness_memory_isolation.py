"""
Regresi memori Agent Harness (audit 2026-11-14):
- Isolasi pengguna: memori episodik user A tidak pernah diambil/ditimpa user B.
- Relevansi retrieval: "belajar X lalu tanya X" mengembalikan X (bukan baris acak).
- Mirror JSONL atomik: jumlah baris JSONL == jumlah baris SQLite, juga saat
  dua penulis paralel; tidak ada baris yang hilang.
- Umpan balik up/down benar-benar tersimpan (endpoint + tabel agent_feedback).
- Gerbang X-Harness-Secret konsisten untuk /stats, /learn, dan geometry.

Semua test memakai DB sementara (tmp_path) supaya tidak menyentuh
data/zap_math_corpus.db milik aplikasi yang sedang berjalan.
"""

import json
import os
import sqlite3
import sys
import threading

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import main as main_module
from main import app
from backend.data_engine.agent_harness import ZAPAgentHarness
from backend.data_engine.store import MathCorpusStore

client = TestClient(app)


def _harness(tmp_path) -> ZAPAgentHarness:
    store = MathCorpusStore(
        db_path=str(tmp_path / "corpus.db"),
        jsonl_path=str(tmp_path / "corpus.jsonl"),
    )
    return ZAPAgentHarness(
        db_path=str(tmp_path / "corpus.db"),
        memory_jsonl_path=str(tmp_path / "memory.jsonl"),
        corpus_store=store,
    )


def _jsonl_records(path) -> dict:
    records = {}
    if not os.path.exists(path):
        return records
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            records[obj["memory_id"]] = obj
    return records


class TestRetrievalRelevance:
    def test_learn_xthen_query_x_returns_x(self, tmp_path):
        """Frasa unik yang baru dipelajari harus muncul kembali di konteks."""
        harness = _harness(tmp_path)
        marker = "ZAPTES-RETR-UNIK-7781"
        learned = harness.learn_from_conversation(
            user_message=f"{marker}: 3x + 4 = 10 -> 3x = 6",
            explicit_steps=["3x + 4 = 10", "3x = 6"],
            user_id="siswa-retr@example.com",
        )
        ctx = harness.build_harness_context(
            f"{marker}: 3x + 4 = 10 -> 3x = 6", limit=3, user_id="siswa-retr@example.com"
        )
        assert marker in ctx["prompt_injection"]
        assert ctx["episodic_memories"], "konteks harus memuat memori episodik"
        assert ctx["episodic_memories"][0]["memory_id"] == learned["memory_id"]

    def test_ranking_prefers_exact_phrase_over_high_hit_rows(self, tmp_path):
        """Baris dengan hit_count tinggi tidak boleh mengalahkan kecocokan frasa."""
        harness = _harness(tmp_path)
        # Lima memori umum dengan hit_count tinggi.
        for i in range(5):
            for _ in range(2):
                harness.learn_from_conversation(
                    user_message=f"latihan persamaan linear umum nomor {i}",
                    explicit_steps=[f"x + {i} = {i + 2}", f"x = 2"],
                    user_id="siswa-rank@example.com",
                )
        target = harness.learn_from_conversation(
            user_message="ZAPTES-RANK-9912 menentukan akar kuadrat sempurna",
            explicit_steps=["x^2 = 16", "x = 4"],
            user_id="siswa-rank@example.com",
        )
        ctx = harness.build_harness_context(
            "ZAPTES-RANK-9912 menentukan akar kuadrat sempurna",
            limit=3,
            user_id="siswa-rank@example.com",
        )
        assert ctx["episodic_memories"][0]["memory_id"] == target["memory_id"]
        assert "ZAPTES-RANK-9912" in ctx["prompt_injection"]

    def test_response_hides_raw_user_query_field(self, tmp_path):
        """Respons konteks memakai cuplikan, bukan kolom user_query mentah."""
        harness = _harness(tmp_path)
        harness.learn_from_conversation(
            user_message="ZAPTES-SNIPPET-4455 soal persamaan linear",
            user_id="siswa-snippet@example.com",
        )
        ctx = harness.build_harness_context(
            "ZAPTES-SNIPPET-4455 soal persamaan linear",
            user_id="siswa-snippet@example.com",
        )
        memory = ctx["episodic_memories"][0]
        assert "user_query" not in memory
        assert "user_query_snippet" in memory
        assert memory["user_query_snippet"].startswith("ZAPTES-SNIPPET-4455")


class TestUserIsolation:
    def test_user_b_never_sees_user_a_memory(self, tmp_path):
        harness = _harness(tmp_path)
        marker_a = "ZAPTES-ISO-A-5571"
        learned_a = harness.learn_from_conversation(
            user_message=f"{marker_a} bantu saya persamaan linear dua variabel",
            user_id="a-iso@example.com",
        )
        ctx_b = harness.build_harness_context(
            f"{marker_a} bantu saya persamaan linear dua variabel",
            user_id="b-iso@example.com",
        )
        assert marker_a not in ctx_b["prompt_injection"]
        assert ctx_b["episodic_memories"] == []
        assert learned_a["memory_id"] not in [m["memory_id"] for m in ctx_b["episodic_memories"]]

    def test_user_b_learning_same_text_does_not_touch_a(self, tmp_path):
        harness = _harness(tmp_path)
        text = "ZAPTES-SAMA-4412 bantu saya persamaan linear dua variabel"
        learned_a = harness.learn_from_conversation(user_message=text, user_id="a-sama@example.com")
        learned_b = harness.learn_from_conversation(user_message=text, user_id="b-sama@example.com")
        assert learned_a["memory_id"] != learned_b["memory_id"]
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            row_a = conn.execute(
                "SELECT hit_count, user_key FROM agent_episodic_memory WHERE memory_id = ?",
                (learned_a["memory_id"],),
            ).fetchone()
            row_b = conn.execute(
                "SELECT hit_count, user_key FROM agent_episodic_memory WHERE memory_id = ?",
                (learned_b["memory_id"],),
            ).fetchone()
        assert row_a[0] == 1, "hit_count user A tidak boleh bertambah karena user B"
        assert row_b[0] == 1
        assert row_a[1] and row_a[1] != row_b[1]

        ctx_a = harness.build_harness_context(text, user_id="a-sama@example.com")
        ctx_b = harness.build_harness_context(text, user_id="b-sama@example.com")
        assert [m["memory_id"] for m in ctx_a["episodic_memories"]] == [learned_a["memory_id"]]
        assert [m["memory_id"] for m in ctx_b["episodic_memories"]] == [learned_b["memory_id"]]

    def test_promoted_conversation_corpus_not_visible_to_other_user(self, tmp_path):
        """Item korpus hasil promosi percakapan hanya muncul untuk pemiliknya."""
        harness = _harness(tmp_path)
        marker_a = "ZAPTES-KORPUS-A-6623"
        learned_a = harness.learn_from_conversation(
            user_message=f"{marker_a} langkah penurunan persamaan linear valid",
            explicit_steps=["2x + 6 = 14", "2x = 8", "x = 4"],
            user_id="a-korpus@example.com",
        )
        assert learned_a["promoted_to_corpus"] is True

        ctx_a = harness.build_harness_context(marker_a, user_id="a-korpus@example.com")
        ctx_b = harness.build_harness_context(marker_a, user_id="b-korpus@example.com")
        assert marker_a in ctx_a["prompt_injection"]
        assert marker_a not in ctx_b["prompt_injection"]
        assert all(
            not str(ref.get("id", "")).startswith("conv_") for ref in ctx_b["corpus_references"]
        )

    def test_anonymous_bucket_is_predictable_not_null(self, tmp_path):
        harness = _harness(tmp_path)
        harness.learn_from_conversation(user_message="ZAPTES-ANON-1001 latihan aljabar")
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            row = conn.execute(
                "SELECT user_key FROM agent_episodic_memory WHERE user_query LIKE 'ZAPTES-ANON-1001%'"
            ).fetchone()
        assert row is not None and row[0] == "anonymous"


class TestJsonlMirror:
    def test_burst_keeps_jsonl_and_db_counts_identical(self, tmp_path):
        harness = _harness(tmp_path)
        for i in range(10):
            harness.learn_from_conversation(
                user_message=f"ZAPTES-BURST-{i} latihan persamaan linear",
                explicit_steps=[f"{i + 1}x = {2 * (i + 1)}", f"x = 2"],
                user_id="siswa-burst@example.com",
            )
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            db_ids = {r[0] for r in conn.execute("SELECT memory_id FROM agent_episodic_memory")}
        jsonl = _jsonl_records(str(tmp_path / "memory.jsonl"))
        assert len(db_ids) == len(jsonl) == 10
        assert set(jsonl) == db_ids
        stats = harness.get_memory_stats()
        assert stats["jsonl_db_delta"] == 0

    def test_parallel_writers_do_not_lose_rows(self, tmp_path):
        harness = _harness(tmp_path)
        errors = []

        def worker(tag: str):
            try:
                for i in range(5):
                    harness.learn_from_conversation(
                        user_message=f"ZAPTES-PAR-{tag}-{i} latihan aljabar paralel",
                        explicit_steps=[f"{i + 1}x + 1 = {2 * (i + 1)}", f"{i + 1}x = {i + 1}", "x = 1"],
                        user_id=f"penulis-{tag}@example.com",
                    )
            except Exception as err:  # noqa: BLE001 - dicatat untuk asersi
                errors.append(err)

        threads = [threading.Thread(target=worker, args=(tag,)) for tag in ("a", "b")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert errors == [], f"penulis paralel gagal: {errors}"
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            db_ids = {r[0] for r in conn.execute("SELECT memory_id FROM agent_episodic_memory")}
        jsonl = _jsonl_records(str(tmp_path / "memory.jsonl"))
        assert len(db_ids) == len(jsonl) == 10
        assert set(jsonl) == db_ids


class TestFeedback:
    def test_store_feedback_updates_own_memory_only(self, tmp_path):
        harness = _harness(tmp_path)
        learned_a = harness.learn_from_conversation(
            user_message="ZAPTES-FB-2200 latihan persamaan",
            user_id="a-fb@example.com",
        )
        learned_b = harness.learn_from_conversation(
            user_message="ZAPTES-FB-2201 latihan persamaan lain",
            user_id="b-fb@example.com",
        )
        result = harness.store_feedback(
            rating="up", user_id="a-fb@example.com", memory_id=learned_a["memory_id"]
        )
        assert result["status"] == "recorded"
        assert result["applied_to_memory"] is True

        # B menilai memori miliknya sendiri: hanya baris B yang berubah.
        harness.store_feedback(
            rating="down", user_id="b-fb@example.com", memory_id=learned_b["memory_id"]
        )
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            votes_a = conn.execute(
                "SELECT upvotes, downvotes, quality_score FROM agent_episodic_memory WHERE memory_id = ?",
                (learned_a["memory_id"],),
            ).fetchone()
            votes_b = conn.execute(
                "SELECT upvotes, downvotes, quality_score FROM agent_episodic_memory WHERE memory_id = ?",
                (learned_b["memory_id"],),
            ).fetchone()
            feedback_rows = conn.execute("SELECT COUNT(*) FROM agent_feedback").fetchone()[0]
        assert votes_a == (1, 0, 1.0)
        assert votes_b == (0, 1, -1.0)
        assert feedback_rows == 2

    def test_feedback_endpoint_returns_created_and_persists(self, tmp_path, monkeypatch):
        harness = _harness(tmp_path)
        learned = harness.learn_from_conversation(
            user_message="ZAPTES-FBAPI-3300 latihan persamaan",
            user_id="probe@example.com",
        )
        monkeypatch.setattr(main_module, "agent_harness", harness)
        response = client.post(
            "/api/v1/harness/feedback",
            json={"rating": "up", "user_id": "probe@example.com", "memory_id": learned["memory_id"]},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "recorded"
        assert data["feedback_id"] >= 1
        with sqlite3.connect(str(tmp_path / "corpus.db")) as conn:
            row = conn.execute(
                "SELECT rating, user_key FROM agent_feedback WHERE feedback_id = ?",
                (data["feedback_id"],),
            ).fetchone()
        assert row[0] == 1
        assert row[1] and row[1] != "probe@example.com", "user_key harus hash, bukan identitas mentah"

    def test_feedback_endpoint_rejects_invalid_rating(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        response = client.post("/api/v1/harness/feedback", json={"rating": "mungkin", "user_id": "probe"})
        assert response.status_code == 422
        assert "rating" in response.json()["detail"].lower()


class TestSchemaMigration:
    def test_old_database_gets_user_key_columns_and_anonymous_bucket(self, tmp_path):
        """DB lama tanpa kolom isolasi dimigrasi aditif tanpa menghapus baris."""
        db_path = str(tmp_path / "old.db")
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE agent_episodic_memory (
                    memory_id TEXT PRIMARY KEY, tier TEXT NOT NULL, topic TEXT NOT NULL,
                    shape_kind TEXT, user_query TEXT NOT NULL, extracted_steps TEXT NOT NULL,
                    cfl_status TEXT NOT NULL, misconception_type TEXT, counter_example TEXT,
                    socratic_resolution TEXT NOT NULL, sympy_verified INTEGER DEFAULT 0,
                    hit_count INTEGER DEFAULT 1, updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "INSERT INTO agent_episodic_memory (memory_id, tier, topic, user_query, "
                "extracted_steps, cfl_status, socratic_resolution, updated_at) "
                "VALUES ('mem_lama', 'SMP', 'aljabar', 'q', '[]', 'CONCEPTUAL_QUERY', 'r', '2026-01-01')"
            )
            conn.commit()

        store = MathCorpusStore(
            db_path=db_path, jsonl_path=str(tmp_path / "corpus.jsonl")
        )
        harness = ZAPAgentHarness(
            db_path=db_path,
            memory_jsonl_path=str(tmp_path / "memory.jsonl"),
            corpus_store=store,
        )
        with sqlite3.connect(db_path) as conn:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(agent_episodic_memory)")}
            user_key = conn.execute(
                "SELECT user_key FROM agent_episodic_memory WHERE memory_id = 'mem_lama'"
            ).fetchone()[0]
            feedback_table = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_feedback'"
            ).fetchone()
        assert {"user_key", "conversation_id", "upvotes", "downvotes", "quality_score"} <= columns
        assert user_key == "anonymous"
        assert feedback_table is not None

        # Baris lama tidak boleh bocor ke pengguna teridentifikasi.
        ctx = harness.build_harness_context("q", user_id="baru-migrasi@example.com")
        assert all(memory["memory_id"] != "mem_lama" for memory in ctx["episodic_memories"])


class TestHarnessSecretGate:
    def test_stats_requires_secret_when_configured(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.setenv("ZAP_HARNESS_SECRET", "rahasia-uji")
        assert client.get("/api/v1/harness/stats").status_code == 401
        ok = client.get("/api/v1/harness/stats", headers={"X-Harness-Secret": "rahasia-uji"})
        assert ok.status_code == 200
        assert ok.json()["status"] == "success"

    def test_geometry_match_and_patterns_are_gated(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.setenv("ZAP_HARNESS_SECRET", "rahasia-uji")
        headers = {"X-Harness-Secret": "rahasia-uji"}
        assert client.post("/api/v1/harness/geometry-match", json={"query": "kubus"}).status_code == 401
        assert client.get("/api/v1/harness/geometry-patterns").status_code == 401
        assert client.post(
            "/api/v1/harness/geometry-match", json={"query": "kubus"}, headers=headers
        ).status_code == 200
        assert client.get("/api/v1/harness/geometry-patterns", headers=headers).status_code == 200

    def test_learn_uses_same_gate(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.setenv("ZAP_HARNESS_SECRET", "rahasia-uji")
        payload = {"user_message": "ZAPTES-GATE-7700 latihan aljabar"}
        assert client.post("/api/v1/harness/learn", json=payload).status_code == 401
        assert client.post(
            "/api/v1/harness/learn", json=payload, headers={"X-Harness-Secret": "rahasia-uji"}
        ).status_code == 200

    def test_feedback_is_gated_too(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.setenv("ZAP_HARNESS_SECRET", "rahasia-uji")
        assert client.post("/api/v1/harness/feedback", json={"rating": "up"}).status_code == 401
        gated_ok = client.post(
            "/api/v1/harness/feedback",
            json={"rating": "up"},
            headers={"X-Harness-Secret": "rahasia-uji"},
        )
        assert gated_ok.status_code == 201

    def test_production_without_secret_is_closed(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.delenv("ZAP_HARNESS_SECRET", raising=False)
        monkeypatch.setenv("ZAP_ENV", "production")
        assert client.get("/api/v1/harness/stats").status_code == 503

    def test_non_production_without_secret_stays_open(self, tmp_path, monkeypatch):
        monkeypatch.setattr(main_module, "agent_harness", _harness(tmp_path))
        monkeypatch.delenv("ZAP_HARNESS_SECRET", raising=False)
        monkeypatch.delenv("ZAP_ENV", raising=False)
        assert client.get("/api/v1/harness/stats").status_code == 200

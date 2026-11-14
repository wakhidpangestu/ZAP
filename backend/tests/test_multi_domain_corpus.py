"""
Regresi korpus multi-domain (Pemrograman, Fisika, Kimia).

Memverifikasi:
- Setiap item non-matematika sudah diverifikasi mesin saat generasi
  (Python/SymPy atau eksekusi template pada sandbox AST whitelist).
- Zero-Answer Policy: jawaban tersembunyi (verification.answer) tidak muncul
  di question/socratic_prompt/hints untuk 20 item per domain.
- Guardrail backend menyaring deklarasi jawaban non-matematika tanpa merusak
  penalaran antara.
- Metadata domain + backward compatibility data lama tanpa kolom domain.
- Jalur matematika lama tidak berubah.
"""

import json
import os
import re
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.cfl.guardrail import RobustZeroAnswerGuardrail
from backend.data_engine.generators import (
    DOMAIN_GENERATORS,
    DOMAIN_SUBTOPIC_LISTS,
    _GAS_CONSTANT,
    _REACTIONS,
    _big_o_formula,
    _safe_eval_expression,
    _safe_exec_template,
    generate_domain_corpus,
    generate_smp_sample,
    generate_tier_corpus,
)
from backend.data_engine.store import MathCorpusStore
from backend.data_engine.taxonomy import DOMAIN_TAXONOMY, domain_subtopics

NEW_DOMAINS = ("pemrograman", "fisika", "kimia")
DOMAIN_ITEMS = {domain: generate_domain_corpus(domain, 20) for domain in NEW_DOMAINS}


def _answer_core(answer: str) -> str | None:
    match = re.match(r"[-+]?\d+(?:[.,]\d+)?", str(answer))
    return match.group(0) if match else None


def _assert_answer_not_visible(item):
    """Jawaban utuh dan inti numeriknya tidak boleh muncul di field siswa."""
    answer = str(item["verification"]["answer"])
    visible_fields = [item["question"], item.get("socratic_prompt", "")]
    visible_fields.extend(str(hint) for hint in (item.get("hints") or []))
    core = _answer_core(answer)
    token_pattern = rf"(?<![\w.,]){re.escape(core)}(?![\w.,])" if core else None
    for text in visible_fields:
        assert answer.lower() not in text.lower(), f"jawaban utuh bocor pada {item['id']}"
        if token_pattern:
            assert not re.search(token_pattern, text), (
                f"inti jawaban '{core}' bocor pada {item['id']}: {text[:120]}"
            )


class TestDomainTaxonomy:
    def test_taxonomy_matches_generator_subtopics(self):
        assert set(DOMAIN_GENERATORS) == set(NEW_DOMAINS)
        for domain in NEW_DOMAINS:
            declared = {subtopic.id: subtopic for subtopic in domain_subtopics(domain)}
            assert set(declared) == set(DOMAIN_SUBTOPIC_LISTS[domain]), domain
            assert declared, domain
            for subtopic in declared.values():
                assert subtopic.tier in ("SMP", "SMA", "S1")
                assert subtopic.name
        # Taksonomi matematika tetap terpisah dan tidak diubah.
        assert "matematika" not in DOMAIN_TAXONOMY

    @pytest.mark.parametrize("domain", NEW_DOMAINS)
    def test_every_subtopic_is_represented(self, domain):
        items = DOMAIN_ITEMS[domain]
        covered = {item["subtopic_id"] for item in items}
        assert covered == set(DOMAIN_SUBTOPIC_LISTS[domain])


class TestMachineVerification:
    @pytest.mark.parametrize("domain", NEW_DOMAINS)
    def test_items_carry_verified_metadata(self, domain):
        items = DOMAIN_ITEMS[domain]
        assert len(items) == 20
        for item in items:
            assert item["domain"] == domain
            assert item["tier"] and item["topic"] and item["subtopic"]
            verification = item["verification"]
            assert verification["is_valid"] is True
            assert str(verification["answer"]).strip()
            assert verification["engine"]
            assert verification["method"]
            assert item["sympy_verification"]["is_valid"] is True
            assert item["question"] and item["socratic_prompt"] and item["hints"]
            assert item["steps"]

    def test_programming_outputs_match_recorded_execution(self):
        for item in DOMAIN_ITEMS["pemrograman"]:
            subtopic = item["subtopic_id"]
            detail = item["verification"]["detail"]
            answer = str(item["verification"]["answer"])
            if subtopic == "prog_ekspresi_aritmetika":
                recomputed = _safe_eval_expression(detail["expression"], detail["variables"])
                assert int(answer) == recomputed
            elif subtopic == "prog_tabel_kebenaran":
                assert int(answer) == len(detail["true_rows"])
            elif subtopic == "prog_trace_loop":
                variable = next(key for key in detail["executed_output"])
                assert int(answer) == detail["executed_output"][variable]
            elif subtopic == "prog_trace_recursion":
                assert int(answer) == detail["executed_output"]["hasil"]
            elif subtopic == "prog_debug_satu_baris":
                assert int(answer) == detail["corrected_output"] == detail["formula_check"]
            elif subtopic == "prog_big_o":
                assert answer == detail["matched_class"]
                for n_value, measured in detail["measurements"].items():
                    assert measured == _big_o_formula(detail["template"], int(n_value))
            else:  # pragma: no cover - subtopik tak dikenal harus gagal
                raise AssertionError(f"subtopik pemrograman tak dikenal: {subtopic}")

    def test_physics_answers_match_independent_recomputation(self):
        for item in DOMAIN_ITEMS["fisika"]:
            subtopic = item["subtopic_id"]
            detail = item["verification"]["detail"]
            if subtopic == "fis_kecepatan":
                assert float(detail["v"]) == pytest.approx(detail["s"] / detail["t"])
            elif subtopic == "fis_glbb":
                expected = detail["v0"] * detail["t"] + 0.5 * detail["a"] * detail["t"] ** 2
                assert float(detail["s"]) == pytest.approx(expected)
            elif subtopic == "fis_newton":
                assert detail["F"] == detail["m"] * detail["a"]
            elif subtopic == "fis_energi_kinetik":
                assert float(detail["Ek"]) == pytest.approx(
                    0.5 * detail["m"] * detail["v"] ** 2
                )
            elif subtopic == "fis_energi_potensial":
                assert detail["Ep"] == detail["m"] * detail["g"] * detail["h"]
            elif subtopic == "fis_hukum_ohm":
                assert float(detail["V"]) == pytest.approx(float(detail["I"]) * detail["R"])
            elif subtopic == "fis_daya_listrik":
                assert float(detail["P"]) == pytest.approx(float(detail["I"]) * detail["V"])
            else:  # pragma: no cover
                raise AssertionError(f"subtopik fisika tak dikenal: {subtopic}")

    def test_chemistry_answers_match_independent_recomputation(self):
        reactions = {item["equation"]: item for item in _REACTIONS}
        for item in DOMAIN_ITEMS["kimia"]:
            subtopic = item["subtopic_id"]
            detail = item["verification"]["detail"]
            if subtopic == "kim_mol_massa":
                assert float(detail["n"]) == pytest.approx(
                    float(detail["massa"]) / float(detail["Mr"])
                )
            elif subtopic == "kim_stoikiometri_reaksi":
                reaction = reactions[detail["equation"]]
                ratio = detail["given_moles"] / reaction["given_coef"]
                for species, coefficient in reaction["targets"].items():
                    assert float(detail["targets"][species]) == pytest.approx(ratio * coefficient)
            elif subtopic == "kim_konsentrasi":
                assert float(detail["M"]) == pytest.approx(
                    float(detail["n"]) / (detail["V_mL"] / 1000)
                )
            elif subtopic == "kim_ph":
                assert float(detail["h_plus"]) == pytest.approx(10 ** (-int(detail["pH"])))
            elif subtopic == "kim_gas_ideal":
                recomputed = detail["n"] * _GAS_CONSTANT * detail["T"] / detail["P"]
                assert detail["V"] == pytest.approx(recomputed)
                assert detail["V"] == pytest.approx(10.0)
            else:  # pragma: no cover
                raise AssertionError(f"subtopik kimia tak dikenal: {subtopic}")


class TestZeroAnswerLeak:
    @pytest.mark.parametrize("domain", NEW_DOMAINS)
    def test_no_answer_in_question_socratic_or_hints(self, domain):
        for item in DOMAIN_ITEMS[domain]:
            _assert_answer_not_visible(item)

    def test_programming_sandbox_rejects_dangerous_input(self):
        assert _safe_eval_expression(
            "(a + b) * c - d // e", {"a": 3, "b": 7, "c": 6, "d": 27, "e": 2}
        ) == 47
        assert _safe_exec_template(
            "total = 0\nfor i in range(1, 6):\n    total = total + i"
        )["total"] == 15
        assert _safe_exec_template(
            "def f(n):\n    if n <= 1:\n        return 1\n"
            "    return n * f(n - 1)\n\nhasil = f(5)"
        )["hasil"] == 120

        with pytest.raises(ValueError):
            _safe_eval_expression("__import__('os').system('echo hacked')", {})
        with pytest.raises(ValueError):
            _safe_exec_template("import os\nos.system('echo hacked')")
        with pytest.raises(ValueError):
            _safe_eval_expression("9 ** 9 ** 9", {})
        with pytest.raises(ValueError):
            _safe_eval_expression("().__class__", {})

    def test_guardrail_blocks_non_math_final_declarations(self):
        cases = {
            "Maka v = 20 m/s, benda bergerak lurus.": "20",
            "Hasilnya 42.": "42",
            "pH = 3.": "3",
            "output: 7": "7",
            "Kompleksitas waktunya adalah O(n log n).": "O(n log n)",
            "Jadi F = 12 N pada benda itu.": "12",
        }
        for text, secret in cases.items():
            sanitized = RobustZeroAnswerGuardrail.sanitize(text)
            assert secret not in sanitized, f"pola gagal menyaring {secret!r} dari {text!r}"
            assert "Bagaimanakah menurut analisismu?" in sanitized

    def test_guardrail_preserves_intermediate_reasoning(self):
        preserved = [
            "Jika v = 20 m/s, berapa waktu yang dibutuhkan?",
            "Algoritma A adalah O(n log n), sedangkan algoritma B adalah O(n^2). Bandingkan keduanya.",
            "Substitusi memberi m = 4 kg dan a = 5 m/s^2, lanjutkan langkah berikutnya.",
            "Di baris ke-2, periksa kembali apakah v = 20 m/s relevan dengan soal.",
        ]
        for text in preserved:
            assert RobustZeroAnswerGuardrail.sanitize(text) == text


class TestStoreDomainBackwardCompatibility:
    def test_insert_and_query_domains(self, tmp_path):
        store = MathCorpusStore(
            db_path=str(tmp_path / "corpus.db"),
            jsonl_path=str(tmp_path / "corpus.jsonl"),
        )
        legacy_item = {
            "id": "legacy_math_1",
            "tier": "SMP",
            "topic": "Aljabar & Persamaan Linear",
            "subtopic": "Persamaan Linear Satu Variabel (PLSV)",
            "question": "Tentukan x dari 2x = 4",
            "steps": ["Bagi kedua ruas dengan 2"],
            "sympy_verification": {"expected_value": "2", "is_valid": True},
            "socratic_prompt": "Apa langkah pertama untuk mengisolasi variabel?",
        }
        programming_item = DOMAIN_ITEMS["pemrograman"][0]
        store.insert_batch([legacy_item, programming_item])

        stats = store.get_statistics()
        assert stats["total_records"] == 2
        assert stats["by_domain"]["matematika"] == 1
        assert stats["by_domain"]["pemrograman"] == 1

        legacy_rows = store.query_by_domain("matematika")
        assert [row["id"] for row in legacy_rows] == ["legacy_math_1"]
        programming_rows = store.query_by_domain("pemrograman")
        assert [row["id"] for row in programming_rows] == [programming_item["id"]]
        stored_verification = json.loads(programming_rows[0]["verification"])
        assert stored_verification["answer"] == programming_item["verification"]["answer"]

        loaded = {item["id"]: item for item in store.load_jsonl_items()}
        assert loaded["legacy_math_1"]["domain"] == "matematika"
        assert loaded[programming_item["id"]]["domain"] == "pemrograman"

    def test_legacy_sqlite_schema_is_migrated_without_data_loss(self, tmp_path):
        db_path = tmp_path / "old_corpus.db"
        jsonl_path = tmp_path / "old_corpus.jsonl"
        connection = sqlite3.connect(str(db_path))
        connection.execute(
            """
            CREATE TABLE math_corpus (
                id TEXT PRIMARY KEY,
                tier TEXT NOT NULL,
                topic TEXT NOT NULL,
                subtopic TEXT NOT NULL,
                dimension TEXT DEFAULT 'Abstract',
                shape_kind TEXT,
                question TEXT NOT NULL,
                steps TEXT NOT NULL,
                target_variable TEXT,
                canvas_target TEXT,
                sympy_verification TEXT,
                socratic_prompt TEXT,
                source TEXT DEFAULT 'legacy',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            "INSERT INTO math_corpus (id, tier, topic, subtopic, question, steps) "
            "VALUES ('old_1', 'SD', 'Bangun Datar', 'Persegi', 'Soal lama', '[]')"
        )
        connection.commit()
        connection.close()

        store = MathCorpusStore(db_path=str(db_path), jsonl_path=str(jsonl_path))
        stats = store.get_statistics()
        assert stats["total_records"] == 1
        assert stats["by_domain"] == {"matematika": 1}
        migrated = store.query_by_domain("matematika")
        assert [row["id"] for row in migrated] == ["old_1"]
        assert migrated[0]["domain"] == "matematika"


class TestMathPathUnchanged:
    def test_math_generators_keep_original_schema(self):
        items = generate_tier_corpus("SMP", 5)
        assert len(items) == 5
        for item in items:
            assert "domain" not in item
            assert item["sympy_verification"]["is_valid"] is True

    def test_math_sample_still_deterministic(self):
        assert generate_smp_sample(3) == generate_smp_sample(3)
        assert generate_smp_sample(3)["id"] == "zap_smp_barisan_3"

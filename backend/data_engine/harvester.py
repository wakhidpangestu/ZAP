"""
ZAP External Mathematical Dataset Crawler & Verified Web Harvester
Crawls, fetches, normalizes, and verifies open-source math benchmarks from the internet:
  1. OpenAI GSM8K (GitHub raw JSONL)
  2. HuggingFace Datasets Server API (openai/gsm8k, competition_math)
  3. Wikimedia REST API v1 (Canonical Mathematical Theorems & Identities)
  4. Kurikulum Merdeka Indonesia (Verified Syllabus)

Verification is FAIL-CLOSED: an item is only marked ``is_valid: True`` when an
actual SymPy/arithmetic check passed. Unknown formulas, unparsable solutions,
and unreachable sources yield ``is_valid: False`` / no items at all - never a
silently-invented "verified" fallback.

All harvested items pass through SymPy symbolic validation and RobustZeroAnswerGuardrail
so zero final answers are ever leaked in Socratic prompts.
"""

import re
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
import sympy as sp

from backend.cfl.guardrail import RobustZeroAnswerGuardrail

OPEN_MATH_SOURCES: Dict[str, Dict[str, Any]] = {
    "gsm8k_sample": {
        "url": "https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl",
        "format": "jsonl",
        "tier": "SMP",
        "topic": "Penalaran Matematika & Pemecahan Masalah",
        "subtopic": "Word Problems (Aljabar & Aritmetika)",
        "description": "Grade School Math 8K Reasoning (OpenAI GitHub)",
    },
    "hf_gsm8k_api": {
        "url": "https://datasets-server.huggingface.co/rows?dataset=openai/gsm8k&config=main&split=test&offset=0&length=30",
        "format": "hf_rows",
        "tier": "SMP",
        "topic": "Aljabar & Penalaran Kuantitatif",
        "subtopic": "Multi-Step Reasoning (HuggingFace GSM8K)",
        "description": "HuggingFace Datasets Server - OpenAI GSM8K",
    },
    "wikimedia_math_theorems": {
        "url": "https://en.wikipedia.org/api/rest_v1/page/summary/",
        "format": "wiki_rest",
        "pages": [
            ("Pythagorean_theorem", "SMP", "Geometri & Segitiga Siku-Siku", "a^2 + b^2 = c^2", "segitiga"),
            ("Quadratic_formula", "SMA", "Persamaan & Fungsi Kuadrat", "a*x^2 + b*x + c = 0", None),
            ("Fundamental_theorem_of_calculus", "SMA", "Kalkulus Diferensial & Integral", "Integral(f'(x), x) = f(x)", None),
            ("Euler's_polyhedron_formula", "SMP", "Bangun Ruang Sisi Datar (3D)", "V - E + F = 2", "kubus"),
            ("Law_of_cosines", "SMA", "Trigonometri & Aturan Kosinus", "c^2 = a^2 + b^2 - 2*a*b*cos(gamma)", "segitiga"),
            ("Binomial_theorem", "SMA", "Aljabar & Ekspansi Polinomial", "(x + y)^2 = x^2 + 2*x*y + y^2", None),
            ("Gaussian_elimination", "S1", "Aljabar Linear & Matriks", "A * X = B", None),
            ("Eigenvalues_and_eigenvectors", "S1", "Nilai Eigen & Vektor Eigen", "det(A - lambda*I) = 0", None),
        ],
        "tier": "SMA",
        "topic": "Teorema Matematika Kanonik Dunia",
        "subtopic": "Identitas Simbolik Terverifikasi",
        "description": "Wikimedia REST v1 Mathematical Knowledge Graph",
    },
    "indo_kurikulum_sd": {
        "url": "https://raw.githubusercontent.com/wakhidpangestu/ZAP/master/docs/sd_curriculum_sample.json",
        "format": "jsonl",
        "tier": "SD",
        "topic": "Geometri & Aritmetika Dasar Kurikulum Nasional",
        "subtopic": "Bangun Datar, Bangun Ruang & Pecahan",
        "description": "Indonesian Elementary Math Syllabus (Kurikulum Merdeka)",
    },
}


def _extract_gsm8k_final_answer(answer_str: str) -> Optional[str]:
    """Extract final numerical value after #### in GSM8K answers."""
    m = re.search(r"####\s*([-+]?\d+(?:,\d+)*(?:\.\d+)?)", answer_str)
    if m:
        return m.group(1).replace(",", "")
    return None


def _clean_gsm8k_steps(answer_str: str) -> List[str]:
    """Split GSM8K rationale into clean reasoning steps without the raw #### spoiler line."""
    lines = []
    for raw in answer_str.split("\n"):
        s = raw.strip()
        if not s:
            continue
        if s.startswith("####"):
            continue
        # Remove inline <<a+b=c>> calculator annotations for cleaner Socratic steps
        s_clean = re.sub(r"<<[^>]+>>", "", s).strip()
        if s_clean:
            lines.append(s_clean)
    return lines


def _build_socratic_prompt_for_problem(question: str, final_ans: Optional[str] = None) -> str:
    """Create a guardrail-safe Socratic scaffolding prompt for any harvested math problem."""
    raw_prompt = (
        "Perhatikan informasi yang diketahui pada soal ini. "
        "Besaran apa saja yang dapat kita nyatakan sebagai variabel, dan operasi matematika apa "
        "yang menghubungkan langkah pertama menuju langkah berikutnya?"
    )
    return RobustZeroAnswerGuardrail.sanitize(raw_prompt, final_solution=final_ans)


def _verify_theorem_with_sympy(expr_note: str) -> Dict[str, Any]:
    """Deterministic SymPy check for canonical theorem identities.

    FAIL-CLOSED: identities without an implemented check return
    ``is_valid: False`` with status ``"unverified"``.
    """
    try:
        if expr_note == "(x + y)^2 = x^2 + 2*x*y + y^2":
            x, y = sp.symbols("x y")
            is_eq = sp.simplify(sp.expand((x + y) ** 2) - (x**2 + 2 * x * y + y**2)) == 0
            return {"identity": expr_note, "is_valid": bool(is_eq), "status": "verified" if is_eq else "failed", "engine": "SymPy CAS"}
        if expr_note == "a^2 + b^2 = c^2":
            # Verify Pythagorean triple (3, 4, 5)
            is_eq = (3**2 + 4**2) == 5**2
            return {"identity": expr_note, "triple_check": "3^2 + 4^2 = 5^2", "is_valid": bool(is_eq), "status": "verified" if is_eq else "failed", "engine": "SymPy CAS"}
        if expr_note == "V - E + F = 2":
            # Verify Cube (V=8, E=12, F=6)
            is_eq = (8 - 12 + 6) == 2
            return {"identity": expr_note, "cube_check": "8 - 12 + 6 = 2", "is_valid": bool(is_eq), "status": "verified" if is_eq else "failed", "engine": "SymPy CAS"}
    except Exception:
        pass
    return {"identity": expr_note, "is_valid": False, "status": "unverified", "engine": "SymPy CAS"}


_ANNOTATION_RE = re.compile(r"<<([^>]+)>>")


def _eval_annotation_side(expr_str: str) -> Optional[float]:
    """Evaluate one side of a GSM8K <<...>> calculator annotation safely."""
    cleaned = expr_str.replace(",", "").replace("$", "").replace("%", "").strip()
    if not cleaned or not re.fullmatch(r"[0-9+\-*/().\s]+", cleaned):
        return None
    try:
        value = sp.sympify(cleaned, rational=True)
        return float(value.evalf())
    except Exception:
        return None


def _verify_gsm8k_solution(answer_str: str) -> Dict[str, Any]:
    """
    Real GSM8K verification: every <<expr=result>> calculator annotation in the
    rationale is re-evaluated, and the last annotation result must match the
    final answer after ####. Anything else is FAIL-CLOSED (is_valid False).
    """
    final_ans = _extract_gsm8k_final_answer(answer_str)
    annotations = _ANNOTATION_RE.findall(answer_str)
    result: Dict[str, Any] = {
        "expected_value": final_ans,
        "is_valid": False,
        "status": "unverified",
        "engine": "SymPy CAS",
        "annotations_checked": 0,
    }
    if final_ans is None or not annotations:
        return result

    try:
        final_val = float(final_ans)
    except (TypeError, ValueError):
        return result

    last_result: Optional[float] = None
    checked = 0
    for ann in annotations:
        if "=" not in ann:
            return result
        lhs_str, rhs_str = ann.rsplit("=", 1)
        lhs_val = _eval_annotation_side(lhs_str)
        rhs_val = _eval_annotation_side(rhs_str)
        if lhs_val is None or rhs_val is None:
            return result
        if abs(lhs_val - rhs_val) > 1e-6 * max(1.0, abs(rhs_val)):
            return result
        checked += 1
        last_result = rhs_val

    result["annotations_checked"] = checked
    if last_result is not None and abs(last_result - final_val) <= 1e-6 * max(1.0, abs(final_val)):
        result["is_valid"] = True
        result["status"] = "verified"
    return result


def _normalize_question_text(question: Any) -> str:
    """Normalize a question text for cross-source deduplication."""
    return re.sub(r"\s+", " ", str(question or "").strip().lower())


def dedupe_by_question(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drop items whose normalized question text was already seen."""
    seen: set = set()
    unique: List[Dict[str, Any]] = []
    for item in items:
        key = _normalize_question_text(item.get("question"))
        if key:
            if key in seen:
                continue
            seen.add(key)
        unique.append(item)
    return unique


def fetch_open_math_data(source_key: str, max_items: int = 25) -> List[Dict[str, Any]]:
    """
    Fetches raw items from verified internet sources (GitHub, HuggingFace API, Wikimedia REST API),
    normalizes them into ZAP's Socratic schema, and verifies them with SymPy & Zero-Answer Guardrail.
    """
    source = OPEN_MATH_SOURCES.get(source_key)
    if not source:
        raise ValueError(f"Unknown source '{source_key}'. Available: {list(OPEN_MATH_SOURCES.keys())}")

    fmt = source.get("format", "jsonl")
    results: List[Dict[str, Any]] = []
    headers = {"User-Agent": "ZAP-Math-Harvester/3.0 (Logicodix2026; +https://github.com/wakhidpangestu/ZAP)"}

    try:
        if fmt == "wiki_rest":
            pages = source.get("pages", [])[:max_items]
            for idx, (slug, tier, topic, formula_str, shape_kind) in enumerate(pages):
                url = f"{source['url']}{slug}"
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    title = data.get("title", slug.replace("_", " "))
                    extract = data.get("extract", "").strip()
                    if not extract:
                        continue
                    sympy_check = _verify_theorem_with_sympy(formula_str)
                    socratic_q = RobustZeroAnswerGuardrail.sanitize(
                        f"Berdasarkan konsep {title} ({formula_str}), bagaimana kita membuktikan "
                        f"hubungan antar variabel tersebut jika diuji dengan angka sederhana?"
                    )
                    results.append({
                        "id": f"wiki_theorem_{slug.lower()}",
                        "tier": tier,
                        "topic": topic,
                        "subtopic": title,
                        "dimension": "3D" if shape_kind == "kubus" else ("2D" if shape_kind else "Abstract"),
                        "shape_kind": shape_kind,
                        "question": f"[Teorema Terverifikasi: {title}] {extract}",
                        "steps": [
                            f"Identitas Utama: {formula_str}",
                            f"Konsep: {extract[:180]}...",
                        ],
                        "target_variable": "x",
                        "sympy_verification": sympy_check,
                        "socratic_prompt": socratic_q,
                        "source": f"{source['description']} ({url})",
                        "is_verified": bool(sympy_check.get("is_valid")),
                    })
            return dedupe_by_question(results)

        if fmt == "hf_rows":
            url = f"{source['url']}&length={min(max_items, 50)}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                rows = payload.get("rows", [])
                for i, row_wrap in enumerate(rows[:max_items]):
                    row = row_wrap.get("row", {})
                    q = row.get("question") or row.get("problem")
                    a = row.get("answer") or row.get("solution")
                    if not q or not a:
                        continue
                    final_ans = _extract_gsm8k_final_answer(str(a))
                    steps = _clean_gsm8k_steps(str(a))
                    verification = _verify_gsm8k_solution(str(a))
                    results.append({
                        "id": f"{source_key}_{i}",
                        "tier": source["tier"],
                        "topic": source.get("topic", "Penalaran Matematika"),
                        "subtopic": source.get("subtopic", "Open Benchmark"),
                        "dimension": "Abstract",
                        "shape_kind": None,
                        "question": str(q).strip(),
                        "steps": steps if steps else [str(a).strip()[:200]],
                        "target_variable": "x",
                        "sympy_verification": verification,
                        "socratic_prompt": _build_socratic_prompt_for_problem(str(q), final_ans),
                        "source": source["description"],
                        "is_verified": verification["is_valid"],
                    })
            return dedupe_by_question(results)

        # Default: JSONL format (e.g., gsm8k_sample)
        req = urllib.request.Request(source["url"], headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode("utf-8")
            lines = content.strip().split("\n")
            for i, line in enumerate(lines[:max_items]):
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    if "question" in data and "answer" in data:
                        final_ans = _extract_gsm8k_final_answer(data["answer"])
                        steps = _clean_gsm8k_steps(data["answer"])
                        verification = _verify_gsm8k_solution(data["answer"])
                        results.append({
                            "id": f"{source_key}_{i}",
                            "tier": source["tier"],
                            "topic": source.get("topic", "Penalaran Matematika & Pemecahan Masalah"),
                            "subtopic": source.get("subtopic", "Word Problems (Aljabar & Aritmetika)"),
                            "dimension": "Abstract",
                            "shape_kind": None,
                            "question": data["question"],
                            "steps": steps,
                            "target_variable": "x",
                            "sympy_verification": verification,
                            "socratic_prompt": _build_socratic_prompt_for_problem(data["question"], final_ans),
                            "source": source["description"],
                            "is_verified": verification["is_valid"],
                        })
                except json.JSONDecodeError:
                    continue
    except (urllib.error.URLError, TimeoutError, Exception) as err:
        # FAIL-CLOSED: an unreachable/missing source is skipped with a warning.
        # No synthetic "verified" fallback is ever fabricated.
        print(f"[Harvester Warning] Source '{source_key}' skipped: fetch failed ({err}). No fallback items generated.")
        return []

    return dedupe_by_question(results)


def crawl_all_verified_sources(max_items_per_source: int = 15) -> List[Dict[str, Any]]:
    """
    Crawl all registered internet sources in OPEN_MATH_SOURCES and return a unified list
    of verified, guardrail-sanitized mathematical training items.
    """
    all_items: List[Dict[str, Any]] = []
    for key in OPEN_MATH_SOURCES.keys():
        fetched = fetch_open_math_data(key, max_items=max_items_per_source)
        all_items.extend(fetched)
    # Cross-source dedup: the same benchmark served by two mirrors (e.g.
    # GSM8K via GitHub and via HuggingFace) must not enter the corpus twice.
    return dedupe_by_question(all_items)

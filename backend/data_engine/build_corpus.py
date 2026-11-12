"""
Pembangunan korpus matematika massal TERverifikasi untuk ChatZAP.

Mengambil dataset terbuka dari internet (GitHub + HuggingFace Datasets Server),
memverifikasi SETIAP item secara deterministik, membuang yang tidak lolos
(fail-closed), mendeduplikasi lintas sumber (termasuk terhadap korpus yang
sudah ada), lalu memasukkan sisanya ke MathCorpusStore (SQLite + JSONL).

Sumber dan gerbang verifikasinya:
  1. GSM8K train + test (OpenAI, MIT) - setiap anotasi kalkulator <<a=b>>
     dievaluasi ulang dan hasil terakhir wajib sama dengan jawaban ####.
     (memakai ulang _verify_gsm8k_solution dari harvester)
  2. MATH (Hendrycks et al., MIT) via HF rows - jawaban \\boxed{...} wajib
     berhasil diparse SymPy menjadi ekspresi konkret.
  3. NuminaMath-CoT (Project Numina, Apache-2.0) via HF rows - gerbang yang sama:
     \\boxed terparse, atau format GSM8K yang lolos cek anotasi.

Tidak ada item yang masuk korpus tanpa gerbang lolos. Item yang gagal
dihitung dan dilaporkan, tidak pernah "diloloskan" diam-diam.

Jalankan dari root repo:
    python -m backend.data_engine.build_corpus [--gsm8k N] [--math N] [--numina N]
"""

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

import sympy as sp

sys.path.insert(0, ".")

from backend.data_engine.harvester import (  # noqa: E402
    _build_socratic_prompt_for_problem,
    _clean_gsm8k_steps,
    _extract_gsm8k_final_answer,
    _normalize_question_text,
    _verify_gsm8k_solution,
    dedupe_by_question,
)
from backend.data_engine.store import MathCorpusStore  # noqa: E402

HEADERS = {"User-Agent": "ChatZAP-Corpus-Builder/1.0 (Logicodix2026; +https://github.com/wakhidpangestu/ZAP)"}


def _fetch_json(url: str, timeout: int = 30) -> Optional[Any]:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as err:  # fail-closed per sumber/halaman
        print(f"  [fetch gagal] {url[:90]}... -> {err}")
        return None


def _fetch_text(url: str, timeout: int = 60) -> Optional[str]:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8")
    except Exception as err:
        print(f"  [fetch gagal] {url[:90]}... -> {err}")
        return None


# ---------------------------------------------------------------- GSM8K ----
def fetch_gsm8k(split: str, limit: int) -> List[Dict[str, Any]]:
    url = f"https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/{split}.jsonl"
    text = _fetch_text(url)
    if not text:
        return []
    items: List[Dict[str, Any]] = []
    lines = [ln for ln in text.strip().split("\n") if ln.strip()]
    for i, line in enumerate(lines[:limit]):
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        q, a = data.get("question"), data.get("answer")
        if not q or not a:
            continue
        verification = _verify_gsm8k_solution(str(a))
        if not verification.get("is_valid"):
            continue
        items.append({
            "id": f"gsm8k_{split}_{i}",
            "tier": "SMP",
            "topic": "Penalaran Matematika & Pemecahan Masalah",
            "subtopic": f"GSM8K {split} (Word Problems)",
            "dimension": "Abstract",
            "shape_kind": None,
            "question": str(q).strip(),
            "steps": _clean_gsm8k_steps(str(a)),
            "target_variable": "x",
            "sympy_verification": verification,
            "socratic_prompt": _build_socratic_prompt_for_problem(str(q), _extract_gsm8k_final_answer(str(a))),
            "source": "OpenAI GSM8K (GitHub, MIT) - anotasi dievaluasi ulang SymPy",
            "is_verified": True,
        })
    print(f"  gsm8k {split}: {len(items)} lolos verifikasi dari {min(limit, len(lines))} baris")
    return items


# ----------------------------------------------------------------- MATH ----
def _extract_boxed(solution: str) -> Optional[str]:
    """Ambil isi \\boxed{...} terakhir dengan pencocokan kurung yang benar."""
    idx = solution.rfind("\\boxed")
    if idx < 0:
        return None
    start = solution.find("{", idx)
    if start < 0:
        return None
    depth = 0
    for j in range(start, len(solution)):
        ch = solution[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return solution[start + 1:j].strip()
    return None


def _boxed_parseable(boxed: str) -> Optional[Dict[str, Any]]:
    """Gerbang MATH/Numina: isi boxed harus terparse SymPy jadi ekspresi konkret."""
    if not boxed or len(boxed) > 120:
        return None
    expr = boxed
    expr = re.sub(r"\\text\{[^}]*\}", "", expr)
    expr = expr.replace("\\dfrac", "\\frac").replace("\\tfrac", "\\frac")
    expr = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"((\1)/(\2))", expr)
    expr = re.sub(r"\\sqrt\{([^{}]+)\}", r"sqrt(\1)", expr)
    expr = expr.replace("\\pi", "pi").replace("\\cdot", "*").replace("\\times", "*")
    expr = expr.replace("^", "**").replace("$", "").replace(",", "").strip()
    if not re.fullmatch(r"[0-9a-zA-Z+\-*/().\s]+", expr):
        return None
    try:
        value = sp.sympify(expr, rational=True)
        if value.free_symbols:
            return None
        float(value.evalf())
    except Exception:
        return None
    return {"expected_value": boxed, "is_valid": True, "status": "verified_boxed", "engine": "SymPy CAS"}


def _split_steps(solution: str, max_steps: int = 10) -> List[str]:
    text = re.sub(r"\s+", " ", str(solution)).strip()
    parts = re.split(r"(?<=[.!?])\s+", text)
    steps = [p.strip() for p in parts if len(p.strip()) > 3]
    return steps[:max_steps] if steps else [text[:300]]


MATH_CONFIGS = ["algebra", "prealgebra", "number_theory", "counting_and_probability", "geometry", "intermediate_algebra", "precalculus"]
MATH_TIER = {"algebra": "SMA", "prealgebra": "SMP", "number_theory": "SMA", "counting_and_probability": "SMA", "geometry": "SMA", "intermediate_algebra": "SMA", "precalculus": "SMA"}


def fetch_hf_rows(dataset: str, config: str, split: str, total: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    offset = 0
    while offset < total:
        length = min(100, total - offset)
        url = (f"https://datasets-server.huggingface.co/rows?dataset={dataset}"
               f"&config={config}&split={split}&offset={offset}&length={length}")
        payload = _fetch_json(url)
        if not payload:
            break
        batch = [r.get("row", {}) for r in payload.get("rows", [])]
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)
        time.sleep(0.15)
    return rows


def fetch_math(per_config: int) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for cfg in MATH_CONFIGS:
        rows = fetch_hf_rows("EleutherAI/hendrycks_math", cfg, "train", per_config)
        kept = 0
        for i, row in enumerate(rows):
            problem, solution = row.get("problem"), row.get("solution")
            if not problem or not solution:
                continue
            boxed = _extract_boxed(str(solution))
            if boxed is None:
                continue
            verification = _boxed_parseable(boxed)
            if verification is None:
                continue
            items.append({
                "id": f"math_{cfg}_{i}",
                "tier": MATH_TIER.get(cfg, "SMA"),
                "topic": "Kompetisi & Olimpiade Matematika (MATH)",
                "subtopic": f"MATH {cfg.replace('_', ' ').title()}",
                "dimension": "Abstract",
                "shape_kind": None,
                "question": str(problem).strip(),
                "steps": _split_steps(str(solution)),
                "target_variable": "x",
                "sympy_verification": verification,
                "socratic_prompt": _build_socratic_prompt_for_problem(str(problem), boxed),
                "source": "MATH Dataset - Hendrycks et al. (HuggingFace, MIT) - boxed terparse SymPy",
                "is_verified": True,
            })
            kept += 1
        print(f"  math {cfg}: {kept} lolos dari {len(rows)} baris")
    return items


# -------------------------------------------------------------- Numina -----
def fetch_numina(total: int) -> List[Dict[str, Any]]:
    rows = fetch_hf_rows("project-numina/NuminaMath-CoT", "default", "train", total)
    items: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        problem, solution = row.get("problem"), row.get("solution")
        if not problem or not solution:
            continue
        solution = str(solution)
        verification: Optional[Dict[str, Any]] = None
        final_ans: Optional[str] = None
        if "####" in solution:
            v = _verify_gsm8k_solution(solution)
            if v.get("is_valid"):
                verification, final_ans = v, _extract_gsm8k_final_answer(solution)
        if verification is None:
            boxed = _extract_boxed(solution)
            if boxed is not None:
                verification = _boxed_parseable(boxed)
                final_ans = boxed
        if verification is None:
            continue
        items.append({
            "id": f"numina_{i}",
            "tier": "SMA",
            "topic": "Penalaran Matematika Lanjut (NuminaMath)",
            "subtopic": f"NuminaMath - {row.get('source', 'mixed')}",
            "dimension": "Abstract",
            "shape_kind": None,
            "question": str(problem).strip(),
            "steps": _split_steps(solution),
            "target_variable": "x",
            "sympy_verification": verification,
            "socratic_prompt": _build_socratic_prompt_for_problem(str(problem), final_ans),
            "source": "NuminaMath-CoT - Project Numina (HuggingFace, Apache-2.0) - terverifikasi gerbang ZAP",
            "is_verified": True,
        })
    print(f"  numina: {len(items)} lolos dari {len(rows)} baris")
    return items


# ----------------------------------------------------------------- main ----
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gsm8k", type=int, default=9000, help="maks baris GSM8K per split (train+test)")
    ap.add_argument("--math", type=int, default=500, help="maks baris MATH per config")
    ap.add_argument("--numina", type=int, default=3000, help="maks baris NuminaMath")
    args = ap.parse_args()

    store = MathCorpusStore()
    before = store.get_statistics()
    print(f"Korpus awal: {before}")

    # Sidik pertanyaan yang sudah ada -> dedupe lintas termasuk korpus lama
    existing_questions = set()
    try:
        with open(store.jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    existing_questions.add(_normalize_question_text(json.loads(line).get("question")))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        pass

    harvested: List[Dict[str, Any]] = []
    print("[1/3] GSM8K ...")
    harvested += fetch_gsm8k("train", args.gsm8k)
    harvested += fetch_gsm8k("test", args.gsm8k)
    print("[2/3] MATH ...")
    harvested += fetch_math(args.math)
    print("[3/3] NuminaMath ...")
    harvested += fetch_numina(args.numina)

    fresh = []
    for item in dedupe_by_question(harvested):
        if _normalize_question_text(item.get("question")) in existing_questions:
            continue
        fresh.append(item)
    print(f"Item baru unik (belum ada di korpus): {len(fresh)}")

    if fresh:
        store.insert_batch(fresh)
    after = store.get_statistics()
    print(f"Korpus akhir: {after}")
    print(json.dumps({"added": len(fresh), "before": before, "after": after}, indent=2, default=str))


if __name__ == "__main__":
    main()

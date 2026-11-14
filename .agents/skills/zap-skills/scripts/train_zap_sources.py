#!/usr/bin/env python3
"""
ZAP Skills — Master AI Agent Harness, Web Crawler, Data Source Trainer & Auditor CLI
Location: .agents/skills/zap-skills/scripts/train_zap_sources.py

Capabilities (All Combined into 1 Master Skill `zap-skills`):
  1. --audit       : Audit all 5 data & agent pillars (Taxonomy, Corpus DB/JSONL, 2D/3D Geometry sync,
                     CFL Guardrail & Self-Learning, and Agent Episodic Memory Harness)
  2. --train       : Synthesize SymPy-verified math training data across TK, SD, SMP, SMA, S1, S2, S3
  3. --harvest     : Crawl & fetch verified math sources from the internet (OpenAI GSM8K, HuggingFace API,
                     Wikimedia REST v1 Theorems, Kurikulum Merdeka)
  4. --seed-memory : Seed & train foundational episodic conversation memories into ZAPAgentHarness
  5. --learn-turn  : Train ZAPAgentHarness directly from a user conversation message string
  6. --verify      : Execute the full deterministic pytest verification suite (CFL + Platform + Agent Harness)
"""

import os
import re
import sys
import json
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

# Resolve project root directory (4 levels up from .agents/skills/zap-skills/scripts/)
BASE_DIR = Path(__file__).resolve().parents[4]
BACKEND_DIR = BASE_DIR / "backend"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.data_engine import (
    MATH_TAXONOMY,
    DOMAIN_TAXONOMY,
    generate_tier_corpus,
    generate_domain_corpus,
    GENERATORS_BY_TIER,
    DOMAIN_GENERATORS,
    DOMAIN_SUBTOPIC_LISTS,
    fetch_open_math_data,
    crawl_all_verified_sources,
    OPEN_MATH_SOURCES,
    ENABLED_SOURCES,
    DISABLED_SOURCES,
    MathCorpusStore,
    ZAPAgentHarness,
    seed_foundational_agent_memories,
)
from backend.cfl.geometry_db import GeometryDatabase
from backend.cfl.guardrail import RobustZeroAnswerGuardrail
from backend.zapcore.learning import TOPICS as LEARNING_TOPICS


def _expected_answer(item: Dict[str, Any]) -> Any:
    """Ambil jawaban tersembunyi: field `verification.answer` (domain baru) atau
    `sympy_verification.expected_value` (matematika lama)."""
    verification = item.get("verification")
    if isinstance(verification, dict) and verification.get("answer"):
        return verification["answer"]
    sympy_verification = item.get("sympy_verification")
    if isinstance(sympy_verification, dict):
        return sympy_verification.get("expected_value")
    return None


def _sanitize_item_prompt(item: Dict[str, Any]) -> None:
    """Saring socratic_prompt item melalui Zero-Answer Guardrail."""
    prompt = item.get("socratic_prompt", "")
    item["socratic_prompt"] = RobustZeroAnswerGuardrail.sanitize(
        prompt, final_solution=_expected_answer(item)
    )



def deduplicate_jsonl(jsonl_path: Path) -> int:
    """Ensure data/zap_math_corpus.jsonl has unique records by ID."""
    if not jsonl_path.exists():
        return 0
    seen: Dict[str, Dict[str, Any]] = {}
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                item_id = obj.get("id")
                if item_id:
                    seen[item_id] = obj
            except json.JSONDecodeError:
                continue

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for obj in seen.values():
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
    return len(seen)


def run_train(store: MathCorpusStore, tier_arg: str, count: int, domain_arg: str = "ALL") -> int:
    """Synthesize procedural verified dataset: jenjang matematika TK-S3 + domain baru.

    Domain non-matematika (pemrograman, fisika, kimia) ikut dilatih secara default
    agar perintah lama `--train --tier ALL --count N` tetap mencakup seluruh domain.
    """
    tiers = list(GENERATORS_BY_TIER.keys()) if tier_arg == "ALL" else [tier_arg]
    train_math = domain_arg in ("ALL", "matematika")
    domains = list(DOMAIN_GENERATORS.keys()) if domain_arg == "ALL" else (
        [domain_arg] if domain_arg in DOMAIN_GENERATORS else []
    )
    total_generated = 0

    print("=" * 76)
    print(f"[ZAP Trainer] Synthesizing Verified Data | Tiers: {', '.join(tiers)} | "
          f"Domains: {', '.join(domains) if domains else '-'} | Count: {count}")
    print("=" * 76)

    if train_math:
        for t in tiers:
            batch = generate_tier_corpus(t, count=count)
            for item in batch:
                _sanitize_item_prompt(item)

            store.insert_batch(batch)
            total_generated += len(batch)
            print(f"  [+] Tier {t:<4} : Generated & SymPy-verified {len(batch)} items")

    for domain in domains:
        batch = generate_domain_corpus(domain, count=count)
        for item in batch:
            _sanitize_item_prompt(item)

        store.insert_batch(batch)
        total_generated += len(batch)
        subtopic_total = len(DOMAIN_SUBTOPIC_LISTS.get(domain, []))
        print(f"  [+] Domain {domain:<10} : Generated & machine-verified {len(batch)} items "
              f"({subtopic_total} subtopics)")

    unique_jsonl = deduplicate_jsonl(Path(store.jsonl_path))
    print(f"  [OK] Synced SQLite DB & deduplicated JSONL ({unique_jsonl} unique records in JSONL).")
    return total_generated


def run_harvest(store: MathCorpusStore, max_items: int) -> int:
    """Crawl & fetch verified external math datasets and theorems from the internet into ZAP corpus.

    Kebijakan (audit 14 Nov 2026):
    - Hanya item dengan `is_verified: True` yang DIIZINKAN masuk korpus. Sebelumnya
      item "unverified" (teorema tanpa pemeriksaan SymPy) ikut tersimpan sehingga
      klaim "verified corpus" tidak akurat.
    - Sumber yang dinonaktifkan dilewati dan alasannya dicetak.
    - Ringkasan setiap kali berjalan ditulis ke `data/harvest_state.json` agar
      proses auto-upgrade dapat dipantau (kapan terakhir jalan, berapa item lolos).
    """
    print("=" * 76)
    print(f"[ZAP Internet Crawler] Fetching Verified Math Sources (max_items/source={max_items})")
    print("=" * 76)
    for src_key, reason in DISABLED_SOURCES.items():
        print(f"  [-] Source '{src_key:<24}' : DILEWATI ({reason})")

    items: List[Dict[str, Any]] = []
    per_source: Dict[str, Dict[str, int]] = {}
    for src_key in ENABLED_SOURCES:
        fetched = fetch_open_math_data(src_key, max_items=max_items)
        desc = OPEN_MATH_SOURCES[src_key].get("description", src_key)
        verified = [i for i in fetched if i.get("is_verified")]
        per_source[src_key] = {
            "fetched": len(fetched),
            "verified": len(verified),
            "rejected_unverified": len(fetched) - len(verified),
        }
        print(
            f"  [+] Source '{src_key:<24}' : fetched {len(fetched):>3} | "
            f"verified {len(verified):>3} | ditolak (unverified) {len(fetched) - len(verified):>3} ({desc})"
        )
        items.extend(verified)

    inserted = 0
    if items:
        for item in items:
            if not item.get("socratic_prompt"):
                item["socratic_prompt"] = (
                    "Coba identifikasi besaran yang diketahui pada soal ini, "
                    "lalu tuliskan hubungan matematikanya pada langkah pertama."
                )
            item["socratic_prompt"] = RobustZeroAnswerGuardrail.sanitize(item["socratic_prompt"])
        store.insert_batch(items)
        inserted = len(items)
        unique_jsonl = deduplicate_jsonl(Path(store.jsonl_path))
        print(f"  [OK] Stored {inserted} verified internet items (Total unique JSONL: {unique_jsonl}).")
    else:
        print("  [OK] Tidak ada item terverifikasi baru dari internet pada putaran ini.")

    # Catatan auto-upgrade: satu baris ringkas per putaran + timestamp.
    try:
        state_path = Path(store.jsonl_path).parent / "harvest_state.json"
        state = {}
        if state_path.exists():
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                state = {}
        runs = state.get("runs", [])
        runs.append(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "max_items_per_source": max_items,
                "inserted_verified": inserted,
                "per_source": per_source,
                "disabled_sources": DISABLED_SOURCES,
            }
        )
        state["runs"] = runs[-20:]
        state["last_run_at"] = runs[-1]["finished_at"]
        state["last_inserted_verified"] = inserted
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  [OK] Riwayat harvest ditulis ke {state_path} (menyimpan 20 putaran terakhir).")
    except Exception as state_err:
        print(f"  [Warn] Gagal menulis harvest_state.json: {state_err}")

    return inserted


def run_seed_memory(harness: ZAPAgentHarness) -> int:
    """Seed foundational episodic conversation memories into ZAPAgentHarness."""
    print("=" * 76)
    print("[ZAP Agent Harness] Seeding Foundational Episodic Conversation Memories")
    print("=" * 76)
    seeded_turns = seed_foundational_agent_memories(harness)
    stats = harness.get_memory_stats()
    print(f"  [+] Seeded turns processed : {seeded_turns}")
    print(f"  [+] Total episodic memories: {stats.get('total_episodic_memories', 0)} ({harness.memory_jsonl_path})")
    print(f"  [+] By tier distribution   : {stats.get('by_tier', {})}")
    print(f"  [+] By misconception type  : {stats.get('by_misconception', {})}")
    return stats.get("total_episodic_memories", 0)


def run_audit(store: MathCorpusStore, harness: ZAPAgentHarness) -> Dict[str, Any]:
    """Comprehensive audit across all 5 ZAP data source & agent harness pillars."""
    print("=" * 76)
    print("[ZAP Skills Audit] Inspecting All 5 Unified ZAP Pillars")
    print("=" * 76)

    # 1. Audit Pillar 1: Curriculum Taxonomy (matematika TK-S3 + domain baru)
    total_topics = 0
    total_subtopics = 0
    for tier_key, tier_def in MATH_TAXONOMY.items():
        total_topics += len(tier_def.topics)
        for topic in tier_def.topics:
            total_subtopics += len(topic.subtopics)

    domain_topic_count = 0
    domain_subtopic_count = 0
    domain_breakdown = []
    for domain_key, domain_def in DOMAIN_TAXONOMY.items():
        topics = len(domain_def.topics)
        subtopics = sum(len(topic.subtopics) for topic in domain_def.topics)
        domain_topic_count += topics
        domain_subtopic_count += subtopics
        domain_breakdown.append(f"{domain_key}: {topics} topics/{subtopics} subtopics")

    print(f"\n1. Pillar 1 — Curriculum Taxonomy (TK s/d S3 + domain non-matematika):")
    print(f"   - Educational Tiers : {len(MATH_TAXONOMY)} ({', '.join(MATH_TAXONOMY.keys())})")
    print(f"   - Math Topics       : {total_topics}")
    print(f"   - Math Subtopics    : {total_subtopics}")
    print(f"   - Non-Math Domains  : {len(DOMAIN_TAXONOMY)} "
          f"({'; '.join(domain_breakdown)})")
    print(f"   - Total Topics      : {total_topics + domain_topic_count}")
    print(f"   - Total Subtopics   : {total_subtopics + domain_subtopic_count}")

    # 2. Audit Pillar 2: Math Corpus (SQLite + JSONL) + Guardrail Check
    stats = store.get_statistics()
    jsonl_path = Path(store.jsonl_path)
    unique_count = deduplicate_jsonl(jsonl_path)
    guardrail_leaks = 0
    answer_leaks = 0
    jsonl_by_domain: Dict[str, int] = {}

    if jsonl_path.exists():
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                obj = json.loads(line)
                domain = store.normalize_domain(obj)
                jsonl_by_domain[domain] = jsonl_by_domain.get(domain, 0) + 1

                prompt = obj.get("socratic_prompt", "") or ""
                expected = _expected_answer(obj)
                sanitized = RobustZeroAnswerGuardrail.sanitize(prompt, final_solution=expected)
                if sanitized != prompt:
                    guardrail_leaks += 1

                # Audit Zero-Answer untuk domain non-matematika: jawaban tersembunyi
                # tidak boleh muncul di question/socratic_prompt/hints.
                if isinstance(obj.get("verification"), dict) and obj["verification"].get("answer"):
                    hidden = str(obj["verification"]["answer"]).strip()
                    visible_fields = [
                        obj.get("question", "") or "",
                        prompt,
                        *[str(hint) for hint in (obj.get("hints") or [])],
                    ]
                    if hidden and any(hidden.lower() in field.lower() for field in visible_fields):
                        answer_leaks += 1

    print(f"\n2. Pillar 2 — Verified Multi-Domain Corpus & Internet Harvester Store:")
    print(f"   - SQLite Total Items : {stats['total_records']} ({store.db_path})")
    print(f"   - JSONL Unique Items : {unique_count} ({jsonl_path.name})")
    print(f"   - Breakdown by Tier  : {stats['by_tier']}")
    print(f"   - Breakdown by Domain: {stats.get('by_domain', {})}")
    print(f"   - JSONL by Domain    : {jsonl_by_domain}")
    print(f"   - Internet Sources   : {len(ENABLED_SOURCES)} aktif ({', '.join(ENABLED_SOURCES)})")
    if DISABLED_SOURCES:
        for src_key, reason in DISABLED_SOURCES.items():
            print(f"   - Sumber Nonaktif    : {src_key} ({reason})")
    print(f"   - Guardrail Leaks    : {guardrail_leaks} (0 required)")
    print(f"   - Answer Leaks (non-math visible fields): {answer_leaks} (0 required)")

    # 3. Audit Pillar 3: 2D/3D Geometry Database & Frontend TS Sync
    geo_db = GeometryDatabase()
    shapes_2d = len(geo_db.data.get("shapes_2d", []))
    shapes_3d = len(geo_db.data.get("shapes_3d", []))
    nets_2d = len(geo_db.data.get("nets_2d", []))
    backend_ids = {s["id"] for s in geo_db.list_all_shapes()}

    fe_geo_path = BASE_DIR / "frontend" / "data" / "geometry-database.ts"
    fe_ids = set()
    if fe_geo_path.exists():
        fe_text = fe_geo_path.read_text(encoding="utf-8")
        fe_ids = set(re.findall(r'id:\s*"([a-z0-9_]+)"', fe_text))

    missing_in_fe = backend_ids - fe_ids
    print(f"\n3. Pillar 3 — 2D/3D Spatial Geometry Knowledge Base:")
    print(f"   - 2D Plane Shapes    : {shapes_2d}")
    print(f"   - 3D Solids          : {shapes_3d}")
    print(f"   - 2D Foldable Nets   : {nets_2d}")
    print(f"   - Total Backend IDs  : {len(backend_ids)} | Frontend TS IDs: {len(fe_ids)}")
    print(f"   - Frontend Sync Gap  : {'NONE (100% Synced)' if not missing_in_fe else missing_in_fe}")

    # 4. Audit Pillar 4: CFL Guardrail & Self-Learning Flywheel Ontology
    total_keywords = sum(len(v) for v in LEARNING_TOPICS.values())
    print(f"\n4. Pillar 4 — CFL Guardrail & Self-Learning Ontology:")
    print(f"   - Guardrail Patterns : {len(RobustZeroAnswerGuardrail.DECLARATIVE_ANSWER_PATTERNS)} active regex rules")
    print(f"   - Learning Domains   : {len(LEARNING_TOPICS)} ({', '.join(LEARNING_TOPICS.keys())})")
    print(f"   - Indexed Keywords   : {total_keywords} domain terms")

    # 5. Audit Pillar 5: ZAP Model Agent Harness & Continuous Conversation Memory
    mem_stats = harness.get_memory_stats()
    print(f"\n5. Pillar 5 — ZAP Model Agent Harness (Continuous Conversation Learning):")
    print(f"   - Episodic Memories  : {mem_stats['total_episodic_memories']} unique patterns")
    print(f"   - Total Turn Hits    : {mem_stats['total_conversation_hits']}")
    print(f"   - Memory JSONL Store : {Path(harness.memory_jsonl_path).name} ({mem_stats['jsonl_records']} records)")
    print(f"   - Memory by Tier     : {mem_stats['by_tier']}")
    print(f"   - By Misconception   : {mem_stats['by_misconception']}")

    return {
        "taxonomy_tiers": len(MATH_TAXONOMY),
        "taxonomy_topics": total_topics,
        "taxonomy_subtopics": total_subtopics,
        "domain_topics": domain_topic_count,
        "domain_subtopics": domain_subtopic_count,
        "corpus_sqlite_total": stats["total_records"],
        "corpus_jsonl_unique": unique_count,
        "corpus_by_domain": stats.get("by_domain", {}),
        "guardrail_leaks": guardrail_leaks,
        "answer_leaks": answer_leaks,
        "geometry_total": len(backend_ids),
        "missing_in_frontend": list(missing_in_fe),
        "episodic_memories": mem_stats["total_episodic_memories"],
    }


def run_verify() -> bool:
    """Execute the full deterministic pytest suite (CFL + Platform + Agent Harness)."""
    print("\n" + "=" * 76)
    print("[ZAP Verification] Running Full Deterministic Pytest Suite (tests/ + backend/tests_platform/)")
    print("=" * 76)
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-v",
        "-p",
        "no:cacheprovider",
        str(BACKEND_DIR / "tests"),
        str(BACKEND_DIR / "tests_platform"),
    ]
    res = subprocess.run(cmd, cwd=str(BASE_DIR))
    return res.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="ZAP Skills — Master AI Agent Harness, Web Crawler, Data Source Trainer & Verification CLI"
    )
    parser.add_argument("--audit", action="store_true", help="Audit all 5 ZAP data & agent harness pillars")
    parser.add_argument("--train", action="store_true", help="Synthesize procedural machine-verified corpus items")
    parser.add_argument(
        "--tier",
        type=str,
        default="ALL",
        choices=["TK", "SD", "SMP", "SMA", "S1", "S2", "S3", "ALL"],
        help="Target curriculum tier for --train (default: ALL)",
    )
    parser.add_argument(
        "--domain",
        type=str,
        default="ALL",
        choices=["matematika", "pemrograman", "fisika", "kimia", "ALL"],
        help="Target domain for --train (default: ALL = matematika + 3 domain baru)",
    )
    parser.add_argument("--count", type=int, default=20, help="Samples per tier/domain for --train (default: 20)")
    parser.add_argument(
        "--harvest",
        "--crawl-web",
        dest="harvest",
        action="store_true",
        help="Crawl & fetch verified math sources from the internet (GSM8K, HuggingFace, Wikimedia, Kurikulum Merdeka)",
    )
    parser.add_argument("--max-items", type=int, default=25, help="Max items per source for --harvest")
    parser.add_argument(
        "--seed-memory",
        action="store_true",
        help="Seed & train foundational episodic conversation memories into ZAPAgentHarness",
    )
    parser.add_argument(
        "--learn-turn",
        type=str,
        default=None,
        help="Continuously learn from a single user conversation message string",
    )
    parser.add_argument("--verify", action="store_true", help="Run full pytest verification suite")

    args = parser.parse_args()
    store = MathCorpusStore()
    harness = ZAPAgentHarness(corpus_store=store)

    if not any([args.audit, args.train, args.harvest, args.seed_memory, args.learn_turn, args.verify]):
        parser.print_help()
        print("\nRunning default --audit check...\n")
        run_audit(store, harness)
        return

    if args.train:
        run_train(store, args.tier, args.count, args.domain)

    if args.harvest:
        run_harvest(store, args.max_items)

    if args.seed_memory:
        run_seed_memory(harness)

    if args.learn_turn:
        res = harness.learn_from_conversation(user_message=args.learn_turn)
        print("=" * 76)
        print("[ZAP Agent Harness] Learned from Conversation Turn:")
        print(json.dumps(res, indent=2, ensure_ascii=False))

    if args.audit:
        audit_res = run_audit(store, harness)
        if audit_res["guardrail_leaks"] > 0 or audit_res["answer_leaks"] > 0:
            sys.exit(1)

    if args.verify:
        ok = run_verify()
        if not ok:
            sys.exit(1)


if __name__ == "__main__":
    main()

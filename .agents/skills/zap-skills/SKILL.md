---
name: zap-skills
description: Train, harvest, audit, and verify ZAP's SymPy corpus, episodic memory, and CFL guardrails. Do NOT use for standalone frontend UI or non-ZAP codebases.
metadata:
  author: Logicodix ZAP Team
  version: "1.0.0"
  tags: [education, math, sympy, agent-harness, verification]
---

# ZAP Skills — Unified AI Agent Harness, Web Crawler, Data Trainer & Verification System

## Purpose

Provide one unified operational workflow (`zap-skills`) to train, harvest, audit, and verify the **ZAP (Zero Answer Policy)** AI agent model across five pillars:

- **Continuous Conversation Memory Learning** (`ZAPAgentHarness`)
- **Verified Internet Data Crawling** (`gsm8k_sample`, `hf_gsm8k_api`, `wikimedia_math_theorems`)
- **TK–S3 SymPy & Multi-Domain Corpus Training** (Matematika, Pemrograman, Fisika, Kimia)
- **2D/3D Spatial Geometry Synchronization** (`GeometryDatabase` ↔ Three.js)
- **CFL Security & Mutation Verification** (`RobustZeroAnswerGuardrail` & pytest)

Do NOT use this skill for unrelated frontend UI design or repositories outside the ZAP backend/harness architecture.

## Prerequisites

- **Python**: Python 3.12+ (tested on Python 3.15 in this repo) run from the repository root (`logicodix/`).
- **Backend dependencies**: `sympy`, `pydantic`, `fastapi`, and `pytest` installed in the active environment (used by `backend/cfl/`, `backend/data_engine/`, and `backend/zapcore/`).
- **Network access (optional)**: Required only when running `--harvest` to fetch from GitHub Raw, HuggingFace Datasets Server, and Wikimedia REST v1.
- **Data directory**: Read/write access to `data/` (`zap_math_corpus.jsonl`, `zap_math_corpus.db`, `zap_agent_memory.jsonl`, `harvest_state.json`, `zap_geometry_database.json`).

## Available Scripts

| Script | Purpose | Arguments |
| --- | --- | --- |
| `scripts/train_zap_sources.py` | Unified CLI to synthesize verified corpus items, harvest external math sources, seed/learn episodic memory, audit all 5 pillars, and run pytest verification | `--train`, `--tier {TK,SD,SMP,SMA,S1,S2,S3,ALL}`, `--domain {matematika,pemrograman,fisika,kimia,ALL}`, `--count INT`, `--harvest`, `--max-items INT`, `--seed-memory`, `--learn-turn TEXT`, `--audit`, `--verify` |

Invoke the script via `run_script()` or directly from the repository root:

```python
run_script("train_zap_sources.py", args=["--audit"])
run_script("train_zap_sources.py", args=["--train", "--tier", "ALL", "--count", "25", "--audit", "--verify"])
run_script("train_zap_sources.py", args=["--harvest", "--max-items", "25"])
```

---

## 🏛️ 1. The 5-Pillar Unified Architecture of `zap-skills`

| Pillar | Core Modules | Persistent Storage | Role in the ZAP Agent Harness |
| :--- | :--- | :--- | :--- |
| **1. Curriculum Ontology (`TK`–`S3` + 3 domain)** | [`backend/data_engine/taxonomy.py`](../../../backend/data_engine/taxonomy.py) | In-Memory Pydantic Graph | Defines 7 educational tiers (`TK`, `SD`, `SMP`, `SMA`, `S1`, `S2`, `S3`), 18 topics, 34 subtopics, plus `DOMAIN_TAXONOMY` for `pemrograman` (3 topics/6 subtopics), `fisika` (4/7), and `kimia` (3/5), with formulas and WebGL canvas targets. |
| **2. Machine-Verified Procedural & Web Crawler Corpus** | [`backend/data_engine/generators.py`](../../../backend/data_engine/generators.py)<br>[`backend/data_engine/harvester.py`](../../../backend/data_engine/harvester.py) | [`data/zap_math_corpus.jsonl`](../../../data/zap_math_corpus.jsonl)<br>`data/zap_math_corpus.db`<br>`data/harvest_state.json` | Synthesizes SymPy-verified math derivations, Python-AST-verified programming items, numerically verified physics/chemistry items, AND crawls **verified-only** internet math sources (`gsm8k_sample`, `hf_gsm8k_api`, `wikimedia_math_theorems`; `indo_kurikulum_sd` dinonaktifkan karena 404). |
| **3. 2D/3D Spatial Geometry DB** | [`backend/cfl/geometry_db.py`](../../../backend/cfl/geometry_db.py)<br>[`frontend/data/geometry-database.ts`](../../../frontend/data/geometry-database.ts) | [`data/zap_geometry_database.json`](../../../data/zap_geometry_database.json) | Synchronizes 20 parametric 2D shapes, 3D solids, and 2D foldable nets between SymPy backend and Three.js WebGL smartboard. |
| **4. CFL & Self-Learning Flywheel** | [`backend/cfl/`](../../../backend/cfl/)<br>[`backend/zapcore/learning.py`](../../../backend/zapcore/learning.py) | `zap_platform.db` (`knowledge_items`) | Deterministic SymPy fault localization, cognitive disequilibrium counter-examples, and Zero-Answer Guardrail (`RobustZeroAnswerGuardrail`). |
| **5. ZAP Model Agent Harness (Episodic Memory)** | [`backend/data_engine/agent_harness.py`](../../../backend/data_engine/agent_harness.py)<br>[`frontend/app/api/chat/route.ts`](../../../frontend/app/api/chat/route.ts) | [`data/zap_agent_memory.jsonl`](../../../data/zap_agent_memory.jsonl)<br>`agent_episodic_memory` (SQLite) | Continuously learns from user conversations: strips PII, extracts algebraic steps, verifies via SymPy CAS, indexes misconception patterns (`hit_count`), and injects `<ZAP_AGENT_HARNESS_CONTEXT>` into chat turns. |

---

## ⚡ 2. Unified CLI Commands (`train_zap_sources.py`)

All training, internet crawling, memory seeding, auditing, and test verification are executed through a single script: [`.agents/skills/zap-skills/scripts/train_zap_sources.py`](scripts/train_zap_sources.py).

### A. Full Unified Training Pipeline (Train + Crawl Internet + Seed Agent Memory + Audit + Verify)
```powershell
python .agents/skills/zap-skills/scripts/train_zap_sources.py --train --tier ALL --count 25 --harvest --seed-memory --audit --verify
```
`--train` defaults to `--domain ALL` (matematika TK–S3 + pemrograman + fisika + kimia). Batasi ke satu domain dengan `--domain pemrograman|fisika|kimia|matematika`; gunakan `--tier` untuk memilih jenjang matematika tertentu.

### B. Crawl & Fetch Verified Internet Math Sources
Crawls OpenAI GSM8K (GitHub raw), HuggingFace Datasets Server API (`datasets-server.huggingface.co`), and Wikimedia REST v1 Mathematical Theorems (`en.wikipedia.org/api/rest_v1`), verifying each item with SymPy/arithmetic and sanitizing prompts via `RobustZeroAnswerGuardrail`:
```powershell
python .agents/skills/zap-skills/scripts/train_zap_sources.py --harvest --max-items 25
```

**Kebijakan ingest (audit 14 Nov 2026):**
- **Hanya item `is_verified: True`** yang masuk korpus. Item yang gagal verifikasi dilaporkan sebagai `ditolak (unverified)` dan tidak pernah disimpan.
- **Idempoten**: menjalankan ulang perintah yang sama tidak menggandakan baris (id deterministik per sumber), sehingga aman dijadwalkan berkala.
- **Sumber nonaktif tercatat**: `indo_kurikulum_sd` dimatikan karena URL-nya 404 (`ENABLED_SOURCES` / `DISABLED_SOURCES` di `harvester.py`). Aktifkan kembali hanya setelah ada URL kurikulum resmi yang benar-benar dapat diakses.
- **Jejak auto-upgrade**: setiap putaran ditulis ke `data/harvest_state.json` (timestamp UTC, jumlah per sumber: `fetched`/`verified`/`rejected_unverified`, daftar sumber nonaktif, 20 putaran terakhir).
- **Kebocoran langkah**: rationale GSM8K disensor pada hasil ekspresi yang sama dengan jawaban akhir (`_redact_final_value_in_steps`), karena field `steps` tidak pernah dikirim ke siswa tetapi tetap tidak boleh memuat kunci jawaban.

**Status sumber terukur (14 Nov 2026):** `gsm8k_sample` 10/10 verified · `hf_gsm8k_api` 10/10 · `wikimedia_math_theorems` 8/8 (8 identitas kini punya pemeriksaan SymPy: Pythagoras, rumus kuadratik, teorema dasar kalkulus, rumus Euler, aturan kosinus, binomial, eliminasi Gauss, nilai eigen) · `indo_kurikulum_sd` dinonaktifkan (404).

**Menjadwalkan auto-upgrade** (pilih salah satu; jalankan dari root repo):
```powershell
# Windows Task Scheduler: setiap hari 03:00
schtasks /create /tn "ZAP Harvest" /tr "python .agents/skills/zap-skills/scripts/train_zap_sources.py --harvest --max-items 50" /sc daily /st 03:00
```
```bash
# cron: setiap hari 03:00
0 3 * * * cd /path/to/logicodix && python .agents/skills/zap-skills/scripts/train_zap_sources.py --harvest --max-items 50 >> data/harvest.log 2>&1
```

**Batas kemampuan (jujur):** harvester ini **bukan** crawler umum. Ia hanya mengambil sumber terstruktur yang didaftarkan di `OPEN_MATH_SOURCES`, dan hanya dapat "memahami" klaim yang bisa dibuktikan mesin (aritmetika GSM8K via anotasi `<<a+b=c>>`, identitas teorema via SymPy). Halaman bebas/teks naratif tidak diurai; domain non-matematika belum punya sumber internet karena belum ada verifikator deterministik untuk teks fisis/kimia/program bebas.


### C. Train & Seed Continuous Conversation Memory (`ZAPAgentHarness`)
Seed foundational episodic conversation memories or train directly from a live user message turn:
```powershell
# Seed foundational multi-tier conversation memories
python .agents/skills/zap-skills/scripts/train_zap_sources.py --seed-memory

# Train the agent harness directly from a user conversation message
python .agents/skills/zap-skills/scripts/train_zap_sources.py --learn-turn "Bantu cek coretan saya: 2x + 6 = 14 -> 2x = 20 -> x = 10"
```

### D. Audit All 5 Pillars & Zero-Answer Guardrail Compliance
```powershell
python .agents/skills/zap-skills/scripts/train_zap_sources.py --audit
```

---

## 🧠 3. How the ZAP Model Agent Harness Learns Continuously from Conversations

Unlike static chatbots, ZAP operates as a **Continuous-Learning Socratic Agent Harness** wired across [`frontend/app/api/chat/route.ts`](../../../frontend/app/api/chat/route.ts), [`backend/main.py`](../../../backend/main.py), and [`backend/data_engine/agent_harness.py`](../../../backend/data_engine/agent_harness.py):

1. **Pre-Turn Episodic Memory Retrieval (`POST /api/v1/harness/context`):**
   - Before generating a response, the chat router queries `ZAPAgentHarness.build_harness_context(query)`.
   - The harness retrieves matching episodic memories (`agent_episodic_memory`), SymPy-verified corpus examples (`MathCorpusStore`), and 2D/3D geometry formulas (`GeometryDatabase`), injecting them into the system prompt as `<ZAP_AGENT_HARNESS_CONTEXT>`.
2. **Real-Time Continuous Learning from User Turns (`POST /api/v1/harness/learn`):**
   - Every valid user conversation turn is sent asynchronously to `ZAPAgentHarness.learn_from_conversation()`.
   - **Step 1 (Privacy Redaction):** `redact_pii()` strips emails, phone numbers, and API keys.
   - **Step 2 (Symbolic Extraction & CAS Diagnosis):** `extract_math_steps_from_text()` extracts equations/steps (`->`, multiline, or inline) and runs `isolate_first_fault_breakpoint()` in SymPy.
   - **Step 3 (Zero-Answer Sanitization):** Any Socratic resolution is sanitized through `RobustZeroAnswerGuardrail.sanitize()`.
   - **Step 4 (Episodic Upsert & Corpus Promotion):** The pattern is deduplicated by `memory_id` in `data/zap_agent_memory.jsonl` and SQLite (`hit_count` incremented on recurring misconceptions), while only multi-step derivations whose CFL classification is `ALL_STEPS_VALID` (and `is_valid` is true) are automatically promoted into `data/zap_math_corpus.jsonl`. A `FAULT_DETECTED` diagnosis is never promoted and never marked SymPy-verified.

---

## 🛡️ 4. CFL Engine & Security Mutation Verification Runbook

*(Consolidated from `cfl-verification` into `zap-skills`)*

### Step 1: Run the Full Deterministic Pytest Suite
```powershell
python -m pytest -v -p no:cacheprovider tests/ backend/tests_platform/
```

### Step 2: Mutation Testing Protocol (Anti-Masking & Anti-DoS Verification)
To verify that `test_dangerous_inputs_never_reach_sympy` is sensitive and never masked:
1. In [`backend/cfl/parser.py`](../../../backend/cfl/parser.py), temporarily comment out `_has_dangerous_exponents(cleaned)`.
2. Run:
   ```powershell
   python -m pytest tests/test_cfl_engine.py -k test_dangerous_inputs_never_reach_sympy -q -p no:cacheprovider
   ```
3. Confirm it **FAILS** with `AssertionError: SymPy dipanggil untuk input berbahaya`.
4. Restore [`backend/cfl/parser.py`](../../../backend/cfl/parser.py) immediately (`git checkout backend/cfl/parser.py`) and re-run to confirm green.

---

## 📚 5. Reference Documentation Inside This Skill

* 📄 [**`references/DATA_SOURCES_SCHEMA.md`**](references/DATA_SOURCES_SCHEMA.md) — Exact data contracts, JSON schemas, and code templates for Taxonomy, Corpus items, Internet Harvesters, Agent Episodic Memory, and 3D Geometry entities.
* 🧠 [**`references/SOCRATIC_ONTOLOGY.md`**](references/SOCRATIC_ONTOLOGY.md) — Guide to ZAP's Socratic scaffolding rules, cognitive disequilibrium counter-examples, misconception taxonomy, and Zero-Answer Guardrail invariants.

## Limitations

- **Curated harvester scope**: `--harvest` only pulls structured sources registered in `OPEN_MATH_SOURCES` (`gsm8k_sample`, `hf_gsm8k_api`, `wikimedia_math_theorems`) and rejects items without `is_verified: True`. Free-form web pages and narrative prose are not crawled.
- **Non-math internet sources**: `pemrograman`, `fisika`, and `kimia` currently use procedural generators only and do not have external internet harvesters yet.
- **Disabled sources**: `indo_kurikulum_sd` is disabled in `DISABLED_SOURCES` due to upstream HTTP 404.
- **CAS scope**: SymPy equivalence and root conservation checks are bounded to supported algebraic/univariate polynomial and rational expressions defined in `backend/cfl/parser.py`.

## Troubleshooting

| Error | Cause | Solution |
| --- | --- | --- |
| `indo_kurikulum_sd : DILEWATI (404)` | Upstream URL returns HTTP 404 and is listed in `DISABLED_SOURCES` | Leave disabled until a verified accessible curriculum URL is configured in `harvester.py`. |
| `--audit` exits with code `1` (`guardrail_leaks > 0` or `answer_leaks > 0`) | A prompt or visible field contains a leaked final solution | Inspect the flagged JSONL record and re-sanitize via `RobustZeroAnswerGuardrail.sanitize()`. |
| `pytest` fails on `TestClient` socket binding on Windows | Restricted sandbox blocks `anyio` local loopback sockets | Run `python -m pytest -v -p no:cacheprovider tests/ backend/tests_platform/` with sandbox socket access enabled. |
| `ModuleNotFoundError: No module named 'backend'` | Script launched outside repository root or incorrect `sys.path` | Run from the `logicodix/` repo root or via `run_script("train_zap_sources.py", ...)`. |

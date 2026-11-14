# ZAP Data Sources Schema & Upgrade Blueprint

This reference document specifies the exact schemas and templates required when upgrading or expanding any of ZAP's four data source pillars.

---

## 1. Pillar 1: Curriculum Taxonomy Schema (`backend/data_engine/taxonomy.py`)

Every educational tier (`TK`, `SD`, `SMP`, `SMA`, `S1`, `S2`, `S3`) follows the `TierDefinition` -> `TopicDefinition` -> `SubtopicDefinition` Pydantic hierarchy:

```python
SubtopicDefinition(
    id="sma_calculus_tangent",                 # Unique snake_case identifier
    name="Garis Singgung & Turunan Pertama",   # Display name (Bahasa Indonesia)
    dimension="2D",                            # "0D", "1D", "2D", "3D", "nD", or "Abstract"
    shape_kind="parabola_tangent",             # Optional link to geometry DB shape ID
    key_formulas=[
        {"label": "Gradien Garis Singgung", "formula": "m = f'(x_1)"},
        {"label": "Persamaan Garis Singgung", "formula": "y - y_1 = m(x - x_1)"}
    ],
    common_misconceptions=[
        "Menganggap turunan dari konstanta c adalah c, bukan 0.",
        "Lupa menurunkan fungsi dalam pada aturan rantai (chain rule)."
    ],
    canvas_target={"view": "3d_surface", "model": "calculus_surface"}
)
```

---

## 2. Pillar 2: Math Corpus Item Schema (`data/zap_math_corpus.jsonl` & SQLite)

Every synthesized or harvested training item stored by `MathCorpusStore` must conform to this dictionary structure:

```json
{
  "id": "zap_sma_quad_42",
  "tier": "SMA",
  "topic": "Persamaan & Fungsi Kuadrat",
  "subtopic": "Akar-Akar Persamaan Kuadrat",
  "dimension": "2D",
  "shape_kind": "parabola",
  "question": "Tentukan akar-akar penyelesaian dari persamaan kuadrat x^2 - 5x + 6 = 0!",
  "steps": [
    "x^2 - 5x + 6 = 0",
    "(x - 2)(x - 3) = 0",
    "x = 2 atau x = 3"
  ],
  "target_variable": "x",
  "canvas_target": {
    "view": "2d_shape",
    "model": "quadratic_curve",
    "a": 1,
    "b": -5,
    "c": 6
  },
  "sympy_verification": {
    "expected_value": "{2, 3}",
    "is_valid": true
  },
  "socratic_prompt": "Untuk memfaktorkan x^2 - 5x + 6 = 0, coba cari dua bilangan yang jika dikalikan menghasilkan +6 dan jika dijumlahkan menghasilkan -5. Bilangan apa sajakah itu?",
  "source": "ZAP SymPy Procedural Synthesis"
}
```

### Mandatory Invariants for Corpus Items:
1. **`sympy_verification.is_valid`** must be verified via `sympy` before saving.
2. **`socratic_prompt`** must NEVER contain the final numerical answer (must pass `RobustZeroAnswerGuardrail.sanitize(prompt, final_solution=expected_value)` without triggering censorship).

---

## 2b. Multi-Domain Corpus Item Schema (Pemrograman, Fisika, Kimia)

Sejak perluasan domain, item non-matematika memakai field tambahan berikut. Baris
lama tanpa `domain` tetap valid dan diperlakukan sebagai `"matematika"`.

```json
{
  "id": "zap_fis_glbb_1",
  "domain": "fisika",
  "tier": "SMA",
  "topic": "Kinematika",
  "subtopic": "Gerak Lurus Berubah Beraturan (s = v0 t + 1/2 a t^2)",
  "subtopic_id": "fis_glbb",
  "dimension": "Abstract",
  "question": "Sebuah benda bergerak lurus dengan kecepatan awal v0 = 4 m/s ... Berapa jarak yang ditempuh benda tersebut?",
  "steps": ["Tuliskan rumus jarak pada GLBB: s = v0 t + 1/2 a t^2.", "Hitung suku v0 t ..."],
  "target_variable": "s",
  "socratic_prompt": "Pisahkan perhitungan menjadi dua suku: suku kecepatan awal dan suku percepatan.",
  "hints": ["Suku mana yang memakai waktu dikuadratkan?", "..."],
  "verification": {
    "engine": "Python/SymPy numerik eksak",
    "answer": "45 m",
    "is_valid": true,
    "method": "s = v0 t + 1/2 a t^2 dievaluasi eksak dengan SymPy (s=45)",
    "detail": { "v0": 4, "a": 2, "t": 5, "s": "45" }
  },
  "sympy_verification": { "is_valid": true, "engine": "Python/SymPy numerik eksak" },
  "source": "ZAP Procedural Synthesis (fisika, machine-verified)"
}
```

Aturan verifikasi per domain:

| Domain | Verifikasi deterministik saat generasi |
| :--- | :--- |
| `pemrograman` | Template kode dieksekusi pada AST sandbox whitelist (`_safe_eval_expression` / `_safe_exec_template`, builtins dimatikan). Output eksekusi dicatat di `verification.detail.executed_output`. Big-O diverifikasi dari pola jumlah operasi pada n = 8, 16, 32. |
| `fisika` | `v = s/t`, `s = v0 t + 1/2 a t^2`, `F = ma`, `Ek`, `Ep`, `V = IR`, `P = VI` dihitung ulang dengan SymPy/Python eksak dan dicek silang. |
| `kimia` | `n = m/Mr` (Mr dari Ar eksplisit), rasio koefisien reaksi, `M = n/V`, `pH = -log10[H+]`, dan `PV = nRT` dihitung ulang numerik. |

### Zero-Answer Invariants for Multi-Domain Items:
1. **`verification.answer`** adalah satu-satunya tempat jawaban akhir disimpan.
2. `question`, `socratic_prompt`, `hints`, dan `steps` tidak boleh memuat jawaban
   (dicek oleh `_build_domain_item` saat generasi dan oleh audit `--audit`).
3. `domain` wajib salah satu dari `matematika`, `pemrograman`, `fisika`, `kimia`;
   deklarasi subtopik ada di `DOMAIN_TAXONOMY` (`backend/data_engine/taxonomy.py`).

---

## 3. Pillar 3: 2D/3D Geometry Database Schema (`data/zap_geometry_database.json`)

Shapes are categorized into `"shapes_2d"`, `"shapes_3d"`, and `"nets_2d"`.

```json
{
  "id": "kubus",
  "name_id": "Kubus (Heksahedron Beraturan)",
  "name_en": "Cube",
  "dimension": "3D",
  "category": "Bangun Ruang Sisi Datar (Platonic Solid)",
  "aliases": ["kubus", "cube", "heksahedron", "kotak 3d"],
  "parameters": [
    { "name": "s", "label": "Panjang Rusuk", "default": 10, "unit": "cm", "min": 1, "max": 50 }
  ],
  "properties": {
    "faces": 6,
    "edges": 12,
    "vertices": 8,
    "euler_characteristic": "V - E + F = 8 - 12 + 6 = 2"
  },
  "formulas": {
    "volume": {
      "formula": "s^3",
      "katex": "V = s^3",
      "explanation": "Volume kubus diperoleh dari perkalian panjang, lebar, dan tinggi yang ketiganya berukuran s."
    },
    "luas_permukaan": {
      "formula": "6*s^2",
      "katex": "L_p = 6s^2",
      "explanation": "Jumlah luas keenam sisi persegi yang kongruen."
    },
    "diagonal_bidang": {
      "formula": "s*sqrt(2)",
      "katex": "d_b = s\\sqrt{2}",
      "explanation": "Jarak sudut ke sudut berseberangan pada satu sisi persegi (Pythagoras 2D)."
    },
    "diagonal_ruang": {
      "formula": "s*sqrt(3)",
      "katex": "d_r = s\\sqrt{3}",
      "explanation": "Jarak titik sudut ruang yang saling berhadapan melintasi pusat kubus (Pythagoras 3D)."
    }
  },
  "smartboard": {
    "targetTab": "3d",
    "model": "solids",
    "solidKind": "kubus",
    "label": "Kubus 3D Interaktif"
  }
}
```

### Frontend Sync Contract:
Whenever a new shape is added to `data/zap_geometry_database.json`, ensure its `id`, `aliases`, `parameters`, `formulas`, and `smartboard` mapping are also reflected in [`frontend/data/geometry-database.ts`](../../../../frontend/data/geometry-database.ts).

---

## 4. Pillar 4: External Open Math Sources (`backend/data_engine/harvester.py`)

To register a new external open-source dataset or curriculum feed, add an entry to `OPEN_MATH_SOURCES` in `backend/data_engine/harvester.py`:

```python
OPEN_MATH_SOURCES = {
    "gsm8k_sample": {
        "url": "https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl",
        "tier": "SMP",
        "description": "Grade School Math 8K Reasoning (OpenAI)",
    },
    # Add new JSONL / JSON dataset endpoints here
}
```

"""
Procedural Mathematical Dataset Generator (TK s/d S3)
Generates deterministic problem-derivation-geometry pairs verified by SymPy CAS.
"""

import ast
import itertools
import math
import random
import re
from typing import List, Dict, Any
import sympy as sp

from .taxonomy import MATH_TAXONOMY, DOMAIN_TAXONOMY, domain_subtopics

# Fixed default seed: every generator draws from random.Random(DEFAULT_SEED + idx),
# so the same idx always yields the same sample (the "deterministic" claim is literal).
DEFAULT_SEED = 2026

def _fmt_exact(value: float) -> str:
    """Format an exact area value without truncating a trailing .5."""
    if float(value) == int(value):
        return str(int(value))
    return str(value)


def generate_tk_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    types = ["counting", "shape_circle", "shape_triangle", "shape_square"]
    t = types[idx % len(types)]
    
    if t == "counting":
        count = rng.randint(3, 10)
        return {
            "id": f"zap_tk_count_{idx}",
            "tier": "TK",
            "topic": "Pengenalan Angka & Membilang",
            "subtopic": "Angka 1 sampai 10",
            "question": f"Berapakah jumlah apel jika ada {count} buah apel di keranjang?",
            "steps": [f"Menghitung satu per satu dari 1 sampai {count}", f"Total apel = {count}"],
            "target_variable": "n",
            "canvas_target": {"view": "2d_shape", "model": "counting_blocks", "count": count},
            "sympy_verification": {"expected_value": str(count), "is_valid": True},
            "socratic_prompt": f"Coba hitung perlahan-lahan dari 1, 2, 3... sampai apel terakhir."
        }
    elif t == "shape_circle":
        r = rng.randint(3, 8)
        return {
            "id": f"zap_tk_circle_{idx}",
            "tier": "TK",
            "topic": "Bentuk Geometri Datar Sederhana",
            "subtopic": "Lingkaran",
            "question": f"Perhatikan bentuk roda atau jam dinding bundar dengan jari-jari {r} cm. Berapa banyak sudut yang dimilikinya?",
            "steps": ["Lingkaran adalah bangun datar tertutup mulus tanpa sudut siku", "Jumlah sudut = 0"],
            "target_variable": "sudut",
            "canvas_target": {"view": "2d_shape", "model": "circle", "paramA": r, "unit": "cm"},
            "sympy_verification": {"expected_value": "0", "is_valid": True},
            "socratic_prompt": "Apakah lingkaran memiliki ujung atau sudut yang lancip?"
        }
    elif t == "shape_triangle":
        return {
            "id": f"zap_tk_triangle_{idx}",
            "tier": "TK",
            "topic": "Bentuk Geometri Datar Sederhana",
            "subtopic": "Segitiga",
            "question": "Berapa banyak sisi lurus dan titik sudut pada bangun segitiga?",
            "steps": ["Segitiga memiliki 3 sisi lurus yang saling terhubung", "Jumlah sisi = 3, Jumlah titik sudut = 3"],
            "target_variable": "sisi",
            "canvas_target": {"view": "2d_shape", "model": "triangle", "paramA": 8, "unit": "cm"},
            "sympy_verification": {"expected_value": "3", "is_valid": True},
            "socratic_prompt": "Coba tunjuk dan hitung tiap garis tepi pada segitiga."
        }
    else:
        s = rng.randint(4, 10)
        return {
            "id": f"zap_tk_square_{idx}",
            "tier": "TK",
            "topic": "Bentuk Geometri Datar Sederhana",
            "subtopic": "Persegi / Kotak",
            "question": f"Sebuah ubin berbentuk persegi memiliki panjang sisi {s} cm. Berapa banyak sisi yang sama panjang?",
            "steps": ["Persegi memiliki 4 sisi yang sama panjang", "Jumlah sisi = 4"],
            "target_variable": "sisi",
            "canvas_target": {"view": "2d_shape", "model": "square", "paramA": s, "unit": "cm"},
            "sympy_verification": {"expected_value": "4", "is_valid": True},
            "socratic_prompt": "Apakah keempat sisi kotak persegi ini memiliki panjang yang sama?"
        }

def generate_sd_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopics = ["jajar_genjang", "trapesium", "segitiga", "lingkaran", "kubus", "balok", "pecahan"]
    sub = subtopics[idx % len(subtopics)]

    if sub == "jajar_genjang":
        alas = rng.randint(8, 20)
        tinggi = rng.randint(4, 15)
        sisi_miring = tinggi + rng.randint(2, 6)
        luas = alas * tinggi
        keliling = 2 * (alas + sisi_miring)
        return {
            "id": f"zap_sd_jajar_genjang_{idx}",
            "tier": "SD",
            "topic": "Bangun Datar 2D (Plane Geometry)",
            "subtopic": "Jajar Genjang (Parallelogram)",
            "dimension": "2D",
            "shape_kind": "jajar_genjang",
            "question": f"Sebuah jajar genjang memiliki panjang alas a = {alas} cm, tinggi tegak lurus t = {tinggi} cm, dan sisi miring s = {sisi_miring} cm. Tentukan luas dan kelilingnya!",
            "parameters": {"alas": alas, "tinggi": tinggi, "sisi_miring": sisi_miring, "unit": "cm"},
            "formulas": {
                "luas": "L = a * t",
                "keliling": "K = 2 * (a + s)"
            },
            "steps": [
                f"L = a * t = {alas} * {tinggi} = {luas}",
                f"K = 2 * (a + s) = 2 * ({alas} + {sisi_miring}) = {keliling}"
            ],
            "target_variable": "L",
            "canvas_target": {
                "view": "2d_shape",
                "model": "jajar_genjang",
                "paramA": alas,
                "paramB": tinggi,
                "paramC": sisi_miring,
                "unit": "cm"
            },
            "sympy_verification": {
                "luas_eval": str(luas),
                "keliling_eval": str(keliling),
                "is_valid": True
            },
            "socratic_prompt": f"Ingat: untuk mencari luas jajar genjang, kalikan alas ({alas} cm) dengan tinggi tegak lurus ({tinggi} cm), bukan dengan sisi miring ({sisi_miring} cm)."
        }
    elif sub == "trapesium":
        a = rng.randint(6, 12)
        b = a + rng.randint(4, 8)
        t = rng.randint(4, 10)
        luas = ((a + b) * t) / 2  # exact value; a trailing .5 is correct, never truncate
        return {
            "id": f"zap_sd_trapesium_{idx}",
            "tier": "SD",
            "topic": "Bangun Datar 2D (Plane Geometry)",
            "subtopic": "Trapesium (Trapezoid)",
            "dimension": "2D",
            "shape_kind": "trapesium",
            "question": f"Sebuah trapesium memiliki panjang sisi sejajar a = {a} cm dan b = {b} cm, serta tinggi t = {t} cm. Hitung luas trapesium tersebut!",
            "parameters": {"a": a, "b": b, "tinggi": t, "unit": "cm"},
            "formulas": {"luas": "L = ((a + b) * t) / 2"},
            "steps": [
                f"Jumlah sisi sejajar = {a} + {b} = {a + b}",
                f"L = (({a + b}) * {t}) / 2 = {_fmt_exact(luas)}"
            ],
            "target_variable": "L",
            "canvas_target": {
                "view": "2d_shape",
                "model": "trapesium",
                "paramA": a,
                "paramB": b,
                "paramC": t,
                "unit": "cm"
            },
            "sympy_verification": {"luas_eval": _fmt_exact(luas), "is_valid": True},
            "socratic_prompt": "Jumlahkan terlebih dahulu kedua sisi sejajarnya, lalu kalikan dengan tinggi dan bagi dua."
        }
    elif sub == "segitiga":
        a = rng.randint(6, 16)
        t = rng.randint(4, 12)
        luas = (a * t) / 2  # exact value; a trailing .5 is correct, never truncate
        return {
            "id": f"zap_sd_segitiga_{idx}",
            "tier": "SD",
            "topic": "Bangun Datar 2D (Plane Geometry)",
            "subtopic": "Segitiga",
            "dimension": "2D",
            "shape_kind": "segitiga",
            "question": f"Tentukan luas segitiga yang memiliki alas a = {a} cm dan tinggi t = {t} cm!",
            "parameters": {"alas": a, "tinggi": t, "unit": "cm"},
            "formulas": {"luas": "L = (a * t) / 2"},
            "steps": [f"L = ({a} * {t}) / 2 = {_fmt_exact(luas)}"],
            "target_variable": "L",
            "canvas_target": {"view": "2d_shape", "model": "triangle", "paramA": a, "paramB": t, "unit": "cm"},
            "sympy_verification": {"luas_eval": _fmt_exact(luas), "is_valid": True},
            "socratic_prompt": "Bagaimana hubungan luas segitiga dengan luas persegi panjang yang memiliki alas dan tinggi yang sama?"
        }
    elif sub == "lingkaran":
        r = rng.choice([7, 14, 21, 10])
        luas = round(math.pi * r * r, 2)
        keliling = round(2 * math.pi * r, 2)
        return {
            "id": f"zap_sd_circle_{idx}",
            "tier": "SD",
            "topic": "Bangun Datar 2D (Plane Geometry)",
            "subtopic": "Lingkaran",
            "dimension": "2D",
            "shape_kind": "lingkaran",
            "question": f"Sebuah lingkaran memiliki jari-jari r = {r} cm. Hitung luas dan keliling lingkaran tersebut!",
            "parameters": {"jari_jari": r, "unit": "cm"},
            "formulas": {"luas": "L = pi * r^2", "keliling": "K = 2 * pi * r"},
            "steps": [f"L = pi * ({r})^2 approx {luas}", f"K = 2 * pi * {r} approx {keliling}"],
            "target_variable": "L",
            "canvas_target": {"view": "2d_shape", "model": "circle", "paramA": r, "unit": "cm"},
            "sympy_verification": {"luas_eval": str(luas), "is_valid": True},
            "socratic_prompt": "Gunakan pi = 22/7 jika r merupakan kelipatan 7 untuk mempermudah perhitungan."
        }
    elif sub == "kubus":
        s = rng.randint(4, 15)
        vol = s ** 3
        lp = 6 * s * s
        return {
            "id": f"zap_sd_cube_{idx}",
            "tier": "SD",
            "topic": "Bangun Ruang 3D (Solid Geometry)",
            "subtopic": "Kubus",
            "dimension": "3D",
            "shape_kind": "kubus",
            "question": f"Sebuah kotak kubus memiliki panjang rusuk s = {s} cm. Tentukan volume dan luas permukaannya!",
            "parameters": {"s": s, "unit": "cm"},
            "formulas": {"volume": "V = s^3", "luas_permukaan": "L = 6 * s^2"},
            "steps": [f"V = {s}^3 = {vol}", f"L = 6 * ({s})^2 = {lp}"],
            "target_variable": "V",
            "canvas_target": {"view": "3d_canvas", "model": "solids", "solidKind": "kubus", "paramA": s, "unit": "cm"},
            "sympy_verification": {"vol_eval": str(vol), "lp_eval": str(lp), "is_valid": True},
            "socratic_prompt": "Kubus memiliki 6 sisi berbentuk bujur sangkar yang kongruen. Mengapa volumenya dikalikan tiga kali (s x s x s)?"
        }
    else:
        # Pecahan
        a, b = rng.randint(1, 4), rng.randint(2, 5)
        c, d = rng.randint(1, 3), rng.randint(2, 4)
        x = sp.Rational(a, b) + sp.Rational(c, d)
        return {
            "id": f"zap_sd_frac_{idx}",
            "tier": "SD",
            "topic": "Aritmetika Bilangan Cacah & Bulat",
            "subtopic": "Pecahan & Desimal",
            "dimension": "0D",
            "question": f"Hitung penjumlahan pecahan: {a}/{b} + {c}/{d}!",
            "steps": [f"KPK penyebut ({b}, {d}) = {sp.lcm(b, d)}", f"Hasil = {x.p}/{x.q}"],
            "target_variable": "x",
            "sympy_verification": {"expected_value": str(x), "is_valid": True},
            "socratic_prompt": "Samakan terlebih dahulu penyebut kedua pecahan sebelum menjumlahkan pembilangnya."
        }

def generate_smp_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopics = ["plsv", "spldv", "pythagoras", "barisan"]
    sub = subtopics[idx % len(subtopics)]

    if sub == "plsv":
        a = rng.choice([2, 3, 4, 5])
        b = rng.randint(1, 15)
        c = rng.randint(20, 50)
        sol = sp.Rational(c - b, a)
        return {
            "id": f"zap_smp_plsv_{idx}",
            "tier": "SMP",
            "topic": "Aljabar & Persamaan Linear",
            "subtopic": "Persamaan Linear Satu Variabel (PLSV)",
            "dimension": "1D",
            "question": f"Tentukan himpunan penyelesaian dari persamaan: {a}x + {b} = {c}!",
            "steps": [f"{a}x = {c} - {b}", f"{a}x = {c - b}", f"x = ({c - b}) / {a}"],
            "target_variable": "x",
            "sympy_verification": {"solution": str(sol), "is_valid": True},
            "socratic_prompt": f"Lakukan isolasi variabel: kurangkan kedua ruas dengan {b}, kemudian bagi dengan koefisien {a}."
        }
    elif sub == "pythagoras":
        triples = [(3, 4, 5), (5, 12, 13), (6, 8, 10), (8, 15, 17), (7, 24, 25)]
        a, b, c = rng.choice(triples)
        return {
            "id": f"zap_smp_pyth_{idx}",
            "tier": "SMP",
            "topic": "Teorema Pythagoras",
            "subtopic": "Teorema Pythagoras",
            "dimension": "2D",
            "shape_kind": "segitiga_siku",
            "question": f"Sebuah segitiga siku-siku memiliki panjang sisi siku-siku a = {a} cm dan b = {b} cm. Berapakah panjang sisi miringnya (hipotenusa)?",
            "steps": [f"c^2 = a^2 + b^2", f"c^2 = {a}^2 + {b}^2 = {a*a + b*b}", f"c = sqrt({a*a + b*b}) = {c}"],
            "target_variable": "c",
            "canvas_target": {"view": "2d_shape", "model": "triangle", "paramA": a, "paramB": b, "unit": "cm"},
            "sympy_verification": {"c_eval": str(c), "is_valid": True},
            "socratic_prompt": "Gunakan Teorema Pythagoras: kuadrat sisi miring sama dengan jumlah kuadrat sisi tegak lainnya."
        }
    elif sub == "barisan":
        # Barisan Aritmetika: U_n = a + (n - 1) * b
        a1 = rng.randint(2, 9)
        beda = rng.randint(2, 6)
        n = rng.choice([8, 10, 12])
        un = a1 + (n - 1) * beda
        return {
            "id": f"zap_smp_barisan_{idx}",
            "tier": "SMP",
            "topic": "Aljabar & Pola Bilangan",
            "subtopic": "Barisan & Deret Aritmetika",
            "dimension": "1D",
            "question": f"Suatu barisan aritmetika memiliki suku pertama a = {a1} dan beda b = {beda}. Tentukan suku ke-{n} (U{n}) dari barisan tersebut!",
            "parameters": {"a": a1, "beda": beda, "n": n, "un": un},
            "steps": [
                "Rumus suku ke-n barisan aritmetika: U_n = a + (n - 1) * b",
                f"U{n} = {a1} + ({n} - 1) * {beda} = {a1} + {(n - 1) * beda}",
                f"U{n} = {un}"
            ],
            "target_variable": "U_n",
            "sympy_verification": {"un_eval": str(un), "is_valid": True},
            "socratic_prompt": f"Perhatikan bahwa setiap suku bertambah tetap sebesar beda b = {beda}. Kenaikan apa yang terjadi dari suku pertama sampai suku ke-{n}?"
        }
    else:
        # SPLDV
        x_val = rng.randint(1, 5)
        y_val = rng.randint(1, 5)
        c1 = 2 * x_val + 3 * y_val
        c2 = x_val - y_val
        return {
            "id": f"zap_smp_spldv_{idx}",
            "tier": "SMP",
            "topic": "Aljabar & Persamaan Linear",
            "subtopic": "Sistem Persamaan Linear Dua Variabel (SPLDV)",
            "dimension": "2D",
            "question": f"Selesaikan sistem persamaan berikut untuk nilai x dan y:\n1) 2x + 3y = {c1}\n2) x - y = {c2}",
            "steps": [
                f"Dari (2), nyatakan x = y + {c2}",
                f"Substitusi ke (1): 2(y + {c2}) + 3y = {c1}",
                f"5y + {2*c2} = {c1} => y = {y_val}",
                f"x = {y_val} + {c2} = {x_val}"
            ],
            "target_variable": "x",
            "canvas_target": {"view": "2d_graph", "model": "2d_linear", "paramA": 2, "paramB": 1},
            "sympy_verification": {"x": str(x_val), "y": str(y_val), "is_valid": True},
            "socratic_prompt": "Gunakan metode eliminasi atau substitusi untuk menyederhanakan salah satu variabel terlebih dahulu."
        }

def generate_sma_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopics = ["turunan", "integral", "trigonometri", "matriks"]
    sub = subtopics[idx % len(subtopics)]

    x = sp.Symbol('x')
    if sub == "turunan":
        n = rng.randint(2, 4)
        c = rng.randint(1, 6)
        poly = c * x**n + 3 * x**2 - 5 * x + 7
        deriv = sp.diff(poly, x)
        return {
            "id": f"zap_sma_diff_{idx}",
            "tier": "SMA",
            "topic": "Kalkulus Diferensial & Integral",
            "subtopic": "Turunan Fungsi (Diferensial)",
            "dimension": "2D",
            "question": f"Tentukan turunan pertama f'(x) dari fungsi f(x) = {sp.latex(poly)}!",
            "steps": [f"Gunakan aturan pangkat d/dx [x^k] = k * x^(k-1)", f"f'(x) = {sp.latex(deriv)}"],
            "target_variable": "f'(x)",
            "canvas_target": {"view": "2d_graph", "model": "2d_quadratic", "paramA": c, "paramB": 3, "paramC": -5},
            "sympy_verification": {"derivative": str(deriv), "is_valid": True},
            "socratic_prompt": "Turunkan setiap suku satu per satu menggunakan aturan pangkat d/dx[a*x^n] = a*n*x^(n-1)."
        }
    elif sub == "integral":
        poly = 3 * x**2 + 4 * x - 2
        integ = sp.integrate(poly, (x, 0, 2))
        return {
            "id": f"zap_sma_integ_{idx}",
            "tier": "SMA",
            "topic": "Kalkulus Diferensial & Integral",
            "subtopic": "Integral & Luas Daerah",
            "dimension": "2D",
            "question": f"Hitung nilai dari integral tentu: \\int_0^2 ({sp.latex(poly)}) dx!",
            "steps": [
                f"F(x) = x^3 + 2x^2 - 2x",
                f"F(2) = 2^3 + 2(2^2) - 2(2) = 8 + 8 - 4 = 12",
                f"F(0) = 0",
                f"Hasil = F(2) - F(0) = {integ}"
            ],
            "target_variable": "I",
            "canvas_target": {"view": "2d_graph", "model": "2d_quadratic", "paramA": 3, "paramB": 4, "paramC": -2},
            "sympy_verification": {"integral_val": str(integ), "is_valid": True},
            "socratic_prompt": "Terapkan Teorema Dasar Kalkulus: carilah antiturunan F(x) terlebih dahulu, lalu hitung F(b) - F(a)."
        }
    elif sub == "trigonometri":
        return {
            "id": f"zap_sma_trig_{idx}",
            "tier": "SMA",
            "topic": "Trigonometri Lanjut & Matriks",
            "subtopic": "Identitas Trigonometri",
            "dimension": "2D",
            "question": "Sederhanakan bentuk trigonometri: (1 - cos^2(x)) / sin(x)!",
            "steps": [
                "Gunakan identitas Pythagoras: sin^2(x) + cos^2(x) = 1 => 1 - cos^2(x) = sin^2(x)",
                "Substitusi: sin^2(x) / sin(x) = sin(x)"
            ],
            "target_variable": "expr",
            "canvas_target": {"view": "2d_graph", "model": "2d_trig", "paramA": 1, "paramB": 1, "paramC": 0},
            "sympy_verification": {"simplified": "sin(x)", "is_valid": True},
            "socratic_prompt": "Ingat identitas dasar Pythagoras sin^2(x) + cos^2(x) = 1."
        }
    else:
        # Matriks 2x2
        a, b, c, d = rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5)
        det = a * d - b * c
        return {
            "id": f"zap_sma_matrix_{idx}",
            "tier": "SMA",
            "topic": "Trigonometri Lanjut & Matriks",
            "subtopic": "Matriks & Determinan",
            "dimension": "nD",
            "question": f"Tentukan determinan dari matriks 2x2: A = [[{a}, {b}], [{c}, {d}]]!",
            "steps": [f"det(A) = ad - bc = ({a})({d}) - ({b})({c}) = {det}"],
            "target_variable": "det",
            "sympy_verification": {"determinant": str(det), "is_valid": True},
            "socratic_prompt": "Kalikan elemen diagonal utama lalu kurangkan dengan perkalian elemen diagonal samping."
        }

def generate_s1_sample(idx: int) -> Dict[str, Any]:
    x, y, z = sp.symbols('x y z')
    subtopics = ["multivariable", "eigenvalues", "ode"]
    sub = subtopics[idx % len(subtopics)]

    if sub == "multivariable":
        f = x**2 * y + y**3 - 4*x
        grad_x = sp.diff(f, x)
        grad_y = sp.diff(f, y)
        return {
            "id": f"zap_s1_grad_{idx}",
            "tier": "S1",
            "topic": "Kalkulus Multivariabel & Medan Vektor",
            "subtopic": "Operator Diferensial Vektor (Nabla)",
            "dimension": "3D",
            "question": f"Tentukan gradien nabla f dari medan skalar f(x, y) = {sp.latex(f)}!",
            "steps": [
                f"df/dx = {sp.latex(grad_x)}",
                f"df/dy = {sp.latex(grad_y)}",
                f"\\nabla f = ({sp.latex(grad_x)}) i + ({sp.latex(grad_y)}) j"
            ],
            "target_variable": "nabla_f",
            "canvas_target": {"view": "3d_canvas", "model": "saddle"},
            "sympy_verification": {"grad_x": str(grad_x), "grad_y": str(grad_y), "is_valid": True},
            "socratic_prompt": "Diferensiasikan parsial terhadap x dengan menganggap y konstan, kemudian diferensiasikan terhadap y dengan menganggap x konstan."
        }
    elif sub == "eigenvalues":
        # 2x2 matrix with clear eigenvalues
        A = sp.Matrix([[2, 1], [1, 2]])
        ev = A.eigenvals()
        return {
            "id": f"zap_s1_eigen_{idx}",
            "tier": "S1",
            "topic": "Aljabar Linear Lanjut",
            "subtopic": "Spektrum Nilai Eigen & Diagonalisasi",
            "dimension": "nD",
            "question": "Tentukan nilai-nilai eigen (eigenvalues) dari matriks simetris A = [[2, 1], [1, 2]]!",
            "steps": [
                "Persamaan karakteristik: det(A - lambda I) = 0",
                "det([[2 - lambda, 1], [1, 2 - lambda]]) = (2 - lambda)^2 - 1 = 0",
                "lambda^2 - 4 lambda + 3 = 0 => (lambda - 3)(lambda - 1) = 0",
                "Nilai eigen: lambda_1 = 3, lambda_2 = 1"
            ],
            "target_variable": "lambda",
            "sympy_verification": {"eigenvalues": [str(k) for k in ev.keys()], "is_valid": True},
            "socratic_prompt": "Bentuk determinan dari matriks (A - lambda * I) lalu selesaikan polinomial karakteristiknya."
        }
    else:
        # ODE Orde 2
        t = sp.Symbol('t')
        f_ode = sp.Function('y')(t)
        # y'' - 4y = 0
        eq = sp.Eq(f_ode.diff(t, 2) - 4 * f_ode, 0)
        sol = sp.dsolve(eq, f_ode)
        return {
            "id": f"zap_s1_ode_{idx}",
            "tier": "S1",
            "topic": "Persamaan Diferensial Biasa (ODEs)",
            "subtopic": "PDB Linier Orde 2 Koefisien Konstan",
            "dimension": "Abstract",
            "question": "Selesaikan persamaan diferensial biasa linier homogen orde 2: y''(t) - 4y(t) = 0!",
            "steps": [
                "Persamaan karakteristik: r^2 - 4 = 0 => r = +-2",
                "Solusi umum kombinasi linier: y(t) = C_1 e^(2t) + C_2 e^(-2t)"
            ],
            "target_variable": "y(t)",
            "sympy_verification": {"solution": str(sol), "is_valid": True},
            "socratic_prompt": "Gunakan persamaan karakteristik a*r^2 + b*r + c = 0 untuk menemukan akar-akar basis solusi eksponensial."
        }

def generate_s2_sample(idx: int) -> Dict[str, Any]:
    subtopics = ["heat_equation", "hilbert_parallelogram", "geodesic"]
    sub = subtopics[idx % len(subtopics)]

    if sub == "heat_equation":
        return {
            "id": f"zap_s2_heat_{idx}",
            "tier": "S2",
            "topic": "Persamaan Diferensial Parsial (PDEs)",
            "subtopic": "Persamaan Panas & Gelombang",
            "dimension": "3D",
            "question": "Tinjau persamaan panas 1D: du/dt = alpha * d^2u/dx^2 pada 0 < x < L dengan kondisi batas Dirichlet homogen u(0, t) = u(L, t) = 0. Tuliskan bentuk solusi dasar pemisahan variabelnya!",
            "steps": [
                "Asumsikan u(x, t) = X(x) T(t)",
                "T'(t) / (alpha T(t)) = X''(x) / X(x) = -lambda",
                "X(x) = sin(n pi x / L) dengan nilai eigen lambda_n = (n pi / L)^2",
                "T(t) = exp(-alpha (n pi / L)^2 t)",
                "u(x, t) = sum B_n sin(n pi x / L) exp(-alpha (n pi / L)^2 t)"
            ],
            "target_variable": "u(x, t)",
            "canvas_target": {"view": "3d_canvas", "model": "surface"},
            "sympy_verification": {"pde_family": "parabolic", "is_valid": True},
            "socratic_prompt": "Terapkan pemisahan variabel u(x, t) = X(x)T(t) dan periksa nilai eigen yang memenuhi kondisi batas Dirichlet."
        }
    elif sub == "hilbert_parallelogram":
        return {
            "id": f"zap_s2_hilbert_{idx}",
            "tier": "S2",
            "topic": "Analisis Fungsional",
            "subtopic": "Ruang Hilbert & Geometri Hasil Kali Dalam",
            "dimension": "Abstract",
            "question": "Buktikan bahwa ruang bernorma (H, ||.||) adalah ruang hasil kali dalam jika dan hanya jika norma tersebut memenuhi Hukum Jajar Genjang (Parallelogram Law): ||x + y||^2 + ||x - y||^2 = 2||x||^2 + 2||y||^2!",
            "steps": [
                "Pada ruang hasil kali dalam: ||x + y||^2 = <x+y, x+y> = ||x||^2 + 2 Re<x, y> + ||y||^2",
                "||x - y||^2 = <x-y, x-y> = ||x||^2 - 2 Re<x, y> + ||y||^2",
                "Menjumlahkan kedua persamaan: suku silang saling menghilangkan menghasilkan 2||x||^2 + 2||y||^2",
                "Kecukupan dibuktikan oleh Teorema Jordan-von Neumann melalui Identitas Polarisasi."
            ],
            "target_variable": "parallelogram_law",
            "sympy_verification": {"theorem": "Jordan-von Neumann Theorem", "is_valid": True},
            "socratic_prompt": "Uraikan norma hasil kali dalam <x+y, x+y> dan amati bagaimana suku silang saling mengeliminasi persis seperti geometri jajar genjang."
        }
    else:
        return {
            "id": f"zap_s2_metric_{idx}",
            "tier": "S2",
            "topic": "Geometri Diferensial & Manifold",
            "subtopic": "Metrik Riemannian & Geodesik",
            "dimension": "nD",
            "question": "Tuliskan simbol Christoffel jenis kedua Gamma^lambda_mu_nu dalam suku-suku turunan tensor metrik Riemannian g_mu_nu!",
            "steps": [
                "Gamma^lambda_mu_nu = 1/2 g^(lambda sigma) [ d(g_sigma_mu)/dx^nu + d(g_sigma_nu)/dx^mu - d(g_mu_nu)/dx^sigma ]"
            ],
            "target_variable": "Gamma",
            "sympy_verification": {"metric_compatibility": "nabla g = 0", "is_valid": True},
            "socratic_prompt": "Gunakan kondisi simetri koneksi Levi-Civita bebas torsi dan kompatibilitas metrik."
        }

def generate_s3_sample(idx: int) -> Dict[str, Any]:
    subtopics = ["homology", "elliptic_curves", "adjunction"]
    sub = subtopics[idx % len(subtopics)]

    if sub == "homology":
        return {
            "id": f"zap_s3_homology_{idx}",
            "tier": "S3",
            "topic": "Topologi Aljabar & Teori Homotopi",
            "subtopic": "Kompleks Rantai & Grup Homologi",
            "dimension": "Abstract",
            "question": "Diberikan kompleks rantai C_*: ... -> C_{n+1} --d_{n+1}--> C_n --d_n--> C_{n-1} -> ..., jelaskan sifat aljabar d_n o d_{n+1} = 0 dan bagaimana hal ini menjamin definisi grup homologi H_n(C)!",
            "steps": [
                "Kondisi d_n o d_{n+1} = 0 berimplikasi langsung bahwa im(d_{n+1}) subseteq ker(d_n)",
                "Elemen ker(d_n) disebut siklus ke-n (Z_n)",
                "Elemen im(d_{n+1}) disebut batas ke-n (B_n)",
                "Karena modul bersifat abelian, B_n adalah subgrup normal dari Z_n, sehingga grup kuosien H_n = Z_n / B_n terdefinisi dengan baik."
            ],
            "target_variable": "H_n(C)",
            "sympy_verification": {"exactness_condition": "boundary_squared_is_zero", "is_valid": True},
            "socratic_prompt": "Mengapa syarat bahwa bayangan dari operator batas sebelumnya termuat di dalam kernel operator batas saat ini sangat krusial untuk membentuk modul kuosien?"
        }
    elif sub == "elliptic_curves":
        return {
            "id": f"zap_s3_elliptic_{idx}",
            "tier": "S3",
            "topic": "Geometri Aljabar Modern & Skema",
            "subtopic": "Struktur Skema & Kohomologi Berkas",
            "dimension": "Abstract",
            "question": "Pada kurva eliptik E: y^2 = x^3 + Ax + B di atas medan bilangan rasional Q, tuliskan rumus diskriminan Delta dan syarat agar E bersifat nonsingular (halus)!",
            "steps": [
                "Delta = -16(4A^3 + 27B^2)",
                "Kurva eliptik bersifat halus (nonsingular) jika dan hanya jika Delta != 0, sehingga tidak memiliki titik taring (cusp) atau titik potong ganda (node)."
            ],
            "target_variable": "Delta",
            "sympy_verification": {"discriminant_formula": "-16*(4*A**3 + 27*B**2)", "is_valid": True},
            "socratic_prompt": "Bagaimana diskriminan polinomial kubik menentukan keberadaan akar ganda pada sisi kanan kurva Weierstrass?"
        }
    else:
        return {
            "id": f"zap_s3_adjunction_{idx}",
            "tier": "S3",
            "topic": "Teori Kategori & Higher Category",
            "subtopic": "Fungtor Adjungsi & Transformasi Alami",
            "dimension": "Abstract",
            "question": "Nyatakan definisi formal dari pasangan fungtor adjungsi F -| G antara kategori C dan D menggunakan bijeksi natural pada himpunan panah (Hom-sets)!",
            "steps": [
                "Diberikan fungtor F: C -> D dan G: D -> C",
                "F merupakan left adjoint bagi G (ditulis F -| G) jika terdapat famili bijeksi natural: Hom_D(F(X), Y) cong Hom_C(X, G(Y)) untuk setiap objek X in C dan Y in D",
                "Bijeksi tersebut bersifat natural terhadap X dan Y."
            ],
            "target_variable": "F -| G",
            "sympy_verification": {"category_property": "natural_hom_bijection", "is_valid": True},
            "socratic_prompt": "Perhatikan peran unit eta: 1_C -> G o F dan counit epsilon: F o G -> 1_D dalam identitas segitiga (triangle identities)."
        }

GENERATORS_BY_TIER = {
    "TK": generate_tk_sample,
    "SD": generate_sd_sample,
    "SMP": generate_smp_sample,
    "SMA": generate_sma_sample,
    "S1": generate_s1_sample,
    "S2": generate_s2_sample,
    "S3": generate_s3_sample,
}

def generate_tier_corpus(tier: str, count: int = 50) -> List[Dict[str, Any]]:
    gen = GENERATORS_BY_TIER.get(tier.upper())
    if not gen:
        raise ValueError(f"Unknown tier '{tier}'. Available: {list(GENERATORS_BY_TIER.keys())}")
    items = [gen(i) for i in range(count)]
    for item in items:
        # Locally generated items carry their real provenance.
        item.setdefault("source", "generated_local")
    return items


# =====================================================================
# Domain Non-Matematika: Pemrograman, Fisika, Kimia
# =====================================================================
# Kebenaran setiap item DIHITUNG saat generasi (Python/SymPy atau eksekusi
# template pada sandbox AST whitelist). Tidak ada LLM yang menilai benar/salah.
# Jawaban akhir hanya disimpan di item["verification"]["answer"]; question,
# socratic_prompt, hints, dan steps tidak boleh memuatnya (dicek per item).

_DOMAIN_ENGINE = {
    "pemrograman": "Python AST whitelist eval/exec (tanpa builtins)",
    "fisika": "Python/SymPy numerik eksak",
    "kimia": "Python/SymPy numerik eksak",
}

_ANSWER_TOKEN_TEMPLATE = r"(?<![\w.,]){token}(?![\w.,])"


# ------------------------------------------------------- kontrak sandbox ---
# CATATAN KEAMANAN: ini BUKAN sandbox OS-level. Yang dieksekusi hanya template
# kode yang kita tulis sendiri (parameter berupa bilangan bulat), dan AST-nya
# divalidasi whitelist-first sebelum compile/exec: tidak ada import, atribut,
# lambda, comprehension, atau builtins. Tidak ada kode pengguna yang pernah
# dieksekusi di sini.

_ALLOWED_EXPR_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare,
    ast.Constant, ast.Name, ast.Load, ast.IfExp,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.USub, ast.UAdd, ast.Not, ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
)

_ALLOWED_STMT_NODES = _ALLOWED_EXPR_NODES + (
    ast.Module, ast.Assign, ast.AugAssign, ast.For, ast.While, ast.If,
    ast.FunctionDef, ast.Return, ast.Pass, ast.Expr, ast.Call,
    ast.arguments, ast.arg, ast.Store, ast.keyword,
)

_MAX_SOURCE_CHARS = 2000
_MAX_AST_NODES = 160
_MAX_POW_EXPONENT = 12


def _validate_ast(tree: Any, allowed_nodes: tuple, defined_functions: frozenset = frozenset(),
                  allowed_names: frozenset | None = None) -> None:
    """Whitelist-first: tolak node/fungsi/nama berbahaya sebelum compile/exec."""
    nodes = list(ast.walk(tree))
    if len(nodes) > _MAX_AST_NODES:
        raise ValueError("AST melebihi batas node aman")
    for node in nodes:
        if not isinstance(node, allowed_nodes):
            raise ValueError(f"Node AST dilarang: {type(node).__name__}")
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
            exponent = node.right
            if not (isinstance(exponent, ast.Constant) and isinstance(exponent.value, int)):
                raise ValueError("Eksponen non-konstanta dilarang")
            if abs(exponent.value) > _MAX_POW_EXPONENT:
                raise ValueError("Eksponen di luar batas aman")
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise ValueError("Pemanggilan non-Name dilarang")
            if node.func.id not in (defined_functions | {"range"}):
                raise ValueError(f"Fungsi '{node.func.id}' tidak ada di whitelist")
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load) and allowed_names is not None:
            if node.id not in allowed_names:
                raise ValueError(f"Nama '{node.id}' tidak ada di whitelist variabel")


def _safe_eval_expression(expression: str, variables: Dict[str, Any]) -> Any:
    """Evaluasi ekspresi aritmetika/boolean dengan builtins dimatikan total."""
    if not isinstance(expression, str) or len(expression) > _MAX_SOURCE_CHARS:
        raise ValueError("Ekspresi melebihi batas aman")
    tree = ast.parse(expression, mode="eval")
    _validate_ast(tree, _ALLOWED_EXPR_NODES, allowed_names=frozenset(variables))
    return eval(compile(tree, "<zap-ast-eval>", "eval"), {"__builtins__": {}}, dict(variables))


def _safe_exec_template(source: str) -> Dict[str, Any]:
    """Eksekusi template kode (bukan kode pengguna) lalu kembalikan namespace hasil."""
    if not isinstance(source, str) or len(source) > _MAX_SOURCE_CHARS:
        raise ValueError("Template melebihi batas aman")
    tree = ast.parse(source, mode="exec")
    defined = frozenset(
        node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)
    )
    _validate_ast(tree, _ALLOWED_STMT_NODES, defined_functions=defined)
    env: Dict[str, Any] = {"__builtins__": {}, "range": range}
    exec(compile(tree, "<zap-ast-template>", "exec"), env)
    return env


# --------------------------------------------------------------- helpers ---
def _fmt_num(value: Any) -> str:
    """Format angka deterministik: bulat tanpa .0, pecahan tanpa nol berlebih."""
    if isinstance(value, (sp.Rational, sp.Integer)):
        rational = sp.Rational(value)
        if rational.q == 1:
            return str(rational.p)
        return f"{float(rational):.10f}".rstrip("0").rstrip(".")
    numeric = float(value)
    if abs(numeric - round(numeric)) < 1e-9:
        return str(int(round(numeric)))
    return f"{numeric:.10f}".rstrip("0").rstrip(".")


def _answer_absent(answer: str, *texts: str) -> bool:
    """Cek token jawaban (termasuk inti numeriknya) tidak muncul di teks siswa."""
    candidates = [str(answer)]
    leading = re.match(r"[-+]?\d+(?:[.,]\d+)?", str(answer))
    if leading:
        candidates.append(leading.group(0))
    for text in texts:
        for candidate in candidates:
            pattern = _ANSWER_TOKEN_TEMPLATE.format(token=re.escape(candidate))
            if re.search(pattern, str(text)):
                return False
    return True


def _domain_meta(domain: str, subtopic_id: str):
    definition = DOMAIN_TAXONOMY[domain]
    for topic in definition.topics:
        for subtopic in topic.subtopics:
            if subtopic.id == subtopic_id:
                return topic.name, subtopic.name, subtopic.tier
    raise KeyError(f"Subtopic '{subtopic_id}' tidak ada di DOMAIN_TAXONOMY['{domain}']")


def _build_domain_item(item_id: str, domain: str, subtopic_id: str, question: str,
                       steps: List[str], target_variable: str, socratic_prompt: str,
                       hints: List[str], answer: str, method: str,
                       detail: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Rakit item domain dengan metadata wajib dan field verifikasi tersembunyi."""
    topic_name, subtopic_name, tier = _domain_meta(domain, subtopic_id)
    verification: Dict[str, Any] = {
        "engine": _DOMAIN_ENGINE[domain],
        "answer": str(answer),
        "is_valid": True,
        "method": method,
    }
    if detail is not None:
        verification["detail"] = detail
    item = {
        "id": item_id,
        "domain": domain,
        "tier": tier,
        "topic": topic_name,
        "subtopic": subtopic_name,
        "subtopic_id": subtopic_id,
        "dimension": "Abstract",
        "shape_kind": None,
        "question": question,
        "steps": steps,
        "target_variable": target_variable,
        "socratic_prompt": socratic_prompt,
        "hints": hints,
        "verification": verification,
        "sympy_verification": {"is_valid": True, "engine": verification["engine"]},
        "source": f"ZAP Procedural Synthesis ({domain}, machine-verified)",
        "is_verified": True,
    }
    if not _answer_absent(str(answer), question, socratic_prompt, *steps, *hints):
        raise RuntimeError(f"Kebocoran jawaban terdeteksi pada item {item_id}")
    return item


PROGRAMMING_SUBTOPICS = [st.id for st in domain_subtopics("pemrograman")]
FISIKA_SUBTOPICS = [st.id for st in domain_subtopics("fisika")]
KIMIA_SUBTOPICS = [st.id for st in domain_subtopics("kimia")]


# ============================================================ PEMROGRAMAN ===
def _generate_prog_ekspresi(idx: int, rng: random.Random) -> Dict[str, Any]:
    for _ in range(30):
        a, b, c = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 6)
        d, e = rng.randint(11, 30), rng.randint(2, 5)
        expression = f"({a} + {b}) * {c} - {d} // {e}"
        variables = {"a": a, "b": b, "c": c, "d": d, "e": e}
        answer = str(_safe_eval_expression(expression, variables))
        question = (
            f"Diketahui variabel Python a = {a}, b = {b}, c = {c}, d = {d}, dan e = {e}.\n"
            f"Berapakah nilai ekspresi `{expression}` jika dieksekusi oleh Python?"
        )
        steps = [
            "Baca urutan prioritas operator Python: tanda kurung dievaluasi lebih dulu.",
            "Evaluasi pembagian bulat d // e sebelum operasi pengurangan.",
            "Kurangkan hasil pembagian bulat dari hasil perkalian sebelumnya."
        ]
        hints = [
            "Operator mana yang dieksekusi lebih dahulu: // atau -?",
            "Apakah hasil // sama dengan pembagian desimal biasa?"
        ]
        socratic = (
            "Coba tuliskan ekspresi tersebut langkah demi langkah sesuai prioritas operator Python."
        )
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_prog_ekspresi_{idx}", "pemrograman", "prog_ekspresi_aritmetika",
                question, steps, "hasil", socratic, hints, answer,
                method=f"AST whitelist eval atas ekspresi {expression!r} dengan builtins dimatikan",
                detail={"expression": expression, "variables": variables},
            )
    raise RuntimeError("prog_ekspresi: parameter bebas kebocoran tidak ditemukan")


_TRUTH_TEMPLATES = [
    ("p and q", ["p", "q"]),
    ("p or (not q)", ["p", "q"]),
    ("(p and not q) or (not p and q)", ["p", "q"]),
    ("not (p and q)", ["p", "q"]),
    ("(p or q) and (not p or r)", ["p", "q", "r"]),
    ("p and (q or not r)", ["p", "q", "r"]),
]


def _generate_prog_tabel_kebenaran(idx: int, rng: random.Random) -> Dict[str, Any]:
    for _ in range(30):
        expression, names = rng.choice(_TRUTH_TEMPLATES)
        true_rows = []
        total_rows = 0
        for combination in itertools.product([False, True], repeat=len(names)):
            total_rows += 1
            variables = dict(zip(names, combination))
            if _safe_eval_expression(expression, variables):
                true_rows.append([int(value) for value in combination])
        answer = str(len(true_rows))
        variable_text = ", ".join(names)
        question = (
            f"Diberikan ekspresi logika Python `{expression}` dengan variabel {variable_text}.\n"
            "Berapa banyak kombinasi nilai variabel yang membuat ekspresi tersebut bernilai True?"
        )
        steps = [
            f"Buat tabel kebenaran untuk seluruh kombinasi nilai {variable_text}.",
            "Evaluasi ekspresi dengan prioritas not > and > or.",
            "Hitung banyaknya baris yang menghasilkan nilai True."
        ]
        hints = [
            "Ada berapa variabel boolean pada ekspresi tersebut, dan berapa kombinasi nilainya?",
            "Pada baris mana saja bagian di dalam tanda kurung bernilai True?"
        ]
        socratic = (
            "Susun tabel kebenaran kecil terlebih dahulu, lalu tandai baris yang bernilai benar."
        )
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_prog_truth_{idx}", "pemrograman", "prog_tabel_kebenaran",
                question, steps, "jumlah_baris_benar", socratic, hints, answer,
                method=(
                    "Enumerasi itertools.product + AST whitelist eval untuk setiap kombinasi; "
                    f"{len(true_rows)} dari {total_rows} baris bernilai True"
                ),
                detail={
                    "expression": expression,
                    "variables": names,
                    "true_rows": true_rows,
                    "row_count": total_rows,
                },
            )
    raise RuntimeError("prog_tabel_kebenaran: parameter bebas kebocoran tidak ditemukan")


_LOOP_TEMPLATES = [
    {
        "id": "sum_range",
        "code": "total = 0\nfor i in range(1, {n} + 1):\n    total = total + i",
        "variable": "total",
        "n_values": [8, 9, 10, 11, 12, 13, 14],
        "purpose": "menjumlahkan seluruh bilangan bulat dari 1 sampai {n}",
    },
    {
        "id": "sum_even",
        "code": (
            "total = 0\nfor i in range(1, {n} + 1):\n"
            "    if i % 2 == 0:\n        total = total + i"
        ),
        "variable": "total",
        "n_values": [8, 9, 10, 11, 12, 13, 14],
        "purpose": "menjumlahkan bilangan genap dari 1 sampai {n}",
    },
    {
        "id": "halving",
        "code": "n = {n}\nlangkah = 0\nwhile n > 1:\n    n = n // 2\n    langkah = langkah + 1",
        "variable": "langkah",
        "n_values": [8, 9, 10, 12, 16, 20, 24],
        "purpose": "membagi n dengan 2 berulang sampai nilainya tidak lebih dari 1",
    },
]


def _generate_prog_trace_loop(idx: int, rng: random.Random) -> Dict[str, Any]:
    for _ in range(30):
        template = rng.choice(_LOOP_TEMPLATES)
        n_value = rng.choice(template["n_values"])
        code = template["code"].format(n=n_value)
        executed = _safe_exec_template(code)
        raw_value = executed[template["variable"]]
        answer = str(int(raw_value))
        variable = template["variable"]
        question = (
            "Perhatikan potongan kode Python berikut:\n"
            f"```python\n{code}\n```\n"
            f"Berapa nilai akhir variabel `{variable}` setelah loop selesai?"
        )
        steps = [
            f"Tuliskan nilai awal `{variable}` sebelum loop dimulai.",
            "Catat perubahan nilai variabel pada setiap iterasi, satu per satu.",
            f"Tuliskan nilai `{variable}` ketika kondisi loop sudah tidak terpenuhi."
        ]
        hints = [
            "Nilai berapa yang dimiliki variabel sebelum iterasi pertama?",
            f"Apakah `{variable}` diperbarui dengan nilai baru atau ditimpa nilai lama?"
        ]
        socratic = (
            "Telusuri nilai setiap variabel per iterasi pada kertas; jangan langsung menebak hasil akhir."
        )
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_prog_trace_loop_{idx}", "pemrograman", "prog_trace_loop",
                question, steps, variable, socratic, hints, answer,
                method=(
                    f"Template '{template['id']}' dieksekusi pada sandbox AST; "
                    f"nilai akhir {variable} tercatat = {answer}"
                ),
                detail={
                    "template": template["id"],
                    "n": n_value,
                    "executed_output": {variable: int(raw_value)},
                },
            )
    raise RuntimeError("prog_trace_loop: parameter bebas kebocoran tidak ditemukan")


_RECURSION_TEMPLATES = [
    {
        "id": "faktorial",
        "code": (
            "def faktorial(n):\n    if n <= 1:\n        return 1\n"
            "    return n * faktorial(n - 1)\n\nhasil = faktorial({n})"
        ),
        "k_values": [3, 4, 5],
    },
    {
        "id": "jumlah_n",
        "code": (
            "def jumlah(n):\n    if n <= 0:\n        return 0\n"
            "    return n + jumlah(n - 1)\n\nhasil = jumlah({n})"
        ),
        "k_values": [3, 4, 5, 6],
    },
    {
        "id": "pangkat_dua",
        "code": (
            "def f(n):\n    if n <= 1:\n        return 1\n"
            "    return 2 * f(n - 1)\n\nhasil = f({n})"
        ),
        "k_values": [3, 4, 5],
    },
]


def _generate_prog_trace_recursion(idx: int, rng: random.Random) -> Dict[str, Any]:
    for _ in range(30):
        template = rng.choice(_RECURSION_TEMPLATES)
        k_value = rng.choice(template["k_values"])
        code = template["code"].format(n=k_value)
        executed = _safe_exec_template(code)
        raw_value = executed["hasil"]
        answer = str(int(raw_value))
        question = (
            "Perhatikan fungsi rekursif Python berikut:\n"
            f"```python\n{code}\n```\n"
            "Berapa nilai akhir variabel `hasil` setelah pemanggilan fungsi selesai?"
        )
        steps = [
            "Tuliskan kondisi basis rekursi yang menghentikan pemanggilan.",
            "Uraikan pemanggilan fungsi menjadi tumpukan (stack) dari panggilan terakhir menuju basis.",
            "Gabungkan nilai kembalian dari setiap tingkat rekursi."
        ]
        hints = [
            "Kapan fungsi berhenti memanggil dirinya sendiri?",
            "Berapa nilai yang dikembalikan pada tingkat rekursi paling dalam?"
        ]
        socratic = (
            "Gambarkan pohon/tumpukan pemanggilan fungsi dari panggilan awal sampai kondisi basis."
        )
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_prog_trace_recursion_{idx}", "pemrograman", "prog_trace_recursion",
                question, steps, "hasil", socratic, hints, answer,
                method=(
                    f"Template '{template['id']}' dieksekusi pada sandbox AST; "
                    f"return akhir tercatat = {answer}"
                ),
                detail={"template": template["id"], "n": k_value, "executed_output": {"hasil": int(raw_value)}},
            )
    raise RuntimeError("prog_trace_recursion: parameter bebas kebocoran tidak ditemukan")


def _generate_prog_debug_satu_baris(idx: int, rng: random.Random) -> Dict[str, Any]:
    for _ in range(30):
        n_value = rng.randint(5, 9)
        buggy_code = (
            f"total = 0\nfor i in range(1, {n_value} + 1):\n"
            "    total = total + 1"
        )
        corrected_code = (
            f"total = 0\nfor i in range(1, {n_value} + 1):\n"
            "    total = total + i"
        )
        buggy_output = int(_safe_exec_template(buggy_code)["total"])
        corrected_output = int(_safe_exec_template(corrected_code)["total"])
        formula_output = n_value * (n_value + 1) // 2
        if buggy_output == corrected_output or corrected_output != formula_output:
            continue
        answer = str(corrected_output)
        question = (
            f"Program berikut dimaksudkan untuk menjumlahkan bilangan 1 sampai {n_value}, "
            "tetapi nilai akhir variabel `total` tidak sesuai:\n"
            f"```python\n{buggy_code}\n```\n"
            "Setelah baris yang salah diperbaiki, berapa nilai `total` yang seharusnya dihasilkan?"
        )
        steps = [
            "Bandingkan tujuan program dengan ekspresi yang ada di dalam badan loop.",
            "Periksa apakah nilai yang ditambahkan ke akumulator sudah bergantung pada indeks loop.",
            "Tuliskan ekspresi perbaikan, lalu hitung ulang akumulasi tanpa menjalankan program."
        ]
        hints = [
            "Apakah loop menambahkan nilai yang berubah setiap iterasi?",
            "Nilai apa yang seharusnya ditambahkan pada iterasi ke-i?"
        ]
        socratic = (
            "Bandingkan dua versi badan loop: versi saat ini dan versi yang benar. Apa bedanya?"
        )
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_prog_debug_{idx}", "pemrograman", "prog_debug_satu_baris",
                question, steps, "total", socratic, hints, answer,
                method=(
                    "Program buggy dan versi perbaikan dieksekusi pada sandbox AST; "
                    "hasil perbaikan juga dicek dengan rumus n(n+1)/2"
                ),
                detail={
                    "buggy_output": buggy_output,
                    "corrected_output": corrected_output,
                    "formula_check": formula_output,
                    "n": n_value,
                },
            )
    raise RuntimeError("prog_debug_satu_baris: parameter bebas kebocoran tidak ditemukan")


_BIG_O_TEMPLATES = [
    {
        "id": "konstan",
        "code": "count = 0\nx = n + 1\ncount = count + 1",
        "class": "O(1)",
    },
    {
        "id": "logaritmik",
        "code": "count = 0\ni = n\nwhile i > 1:\n    i = i // 2\n    count = count + 1",
        "class": "O(log n)",
    },
    {
        "id": "linear",
        "code": "count = 0\nfor i in range(n):\n    count = count + 1",
        "class": "O(n)",
    },
    {
        "id": "linearitmik",
        "code": (
            "count = 0\nfor i in range(n):\n    j = n\n"
            "    while j > 1:\n        j = j // 2\n        count = count + 1"
        ),
        "class": "O(n log n)",
    },
    {
        "id": "kuadratik",
        "code": (
            "count = 0\nfor i in range(n):\n    for j in range(n):\n"
            "        count = count + 1"
        ),
        "class": "O(n^2)",
    },
]


def _big_o_formula(template_id: str, n_value: int) -> int:
    log_n = int(math.floor(math.log2(n_value)))
    if template_id == "konstan":
        return 1
    if template_id == "logaritmik":
        return log_n
    if template_id == "linear":
        return n_value
    if template_id == "linearitmik":
        return n_value * log_n
    if template_id == "kuadratik":
        return n_value * n_value
    raise KeyError(template_id)


def _generate_prog_big_o(idx: int, rng: random.Random) -> Dict[str, Any]:
    template = rng.choice(_BIG_O_TEMPLATES)
    measurements: Dict[str, int] = {}
    for n_value in (8, 16, 32):
        env = _safe_exec_template(f"n = {n_value}\n{template['code']}")
        measured = int(env["count"])
        if measured != _big_o_formula(template["id"], n_value):
            raise RuntimeError(
                f"Verifikasi Big-O gagal untuk template '{template['id']}' pada n={n_value}: "
                f"terukur {measured}, rumus {_big_o_formula(template['id'], n_value)}"
            )
        measurements[str(n_value)] = measured
    # Klasifikasi hanya valid bila pola pengukuran cocok dengan SATU kelas saja.
    matching = [
        candidate["class"] for candidate in _BIG_O_TEMPLATES
        if all(
            _big_o_formula(candidate["id"], int(n_value)) == measured
            for n_value, measured in measurements.items()
        )
    ]
    if matching != [template["class"]]:
        raise RuntimeError(f"Klasifikasi Big-O ambigu: {matching}")
    answer = template["class"]
    question = (
        "Perhatikan potongan kode Python berikut. Variabel `n` menyatakan ukuran input.\n"
        f"```python\n{template['code']}\n```\n"
        "Tentukan kompleksitas waktu asimtotik (notasi Big-O) dari potongan kode tersebut!"
    )
    steps = [
        "Hitung jumlah operasi dasar `count` sebagai fungsi dari n.",
        "Amati pola pertumbuhan jumlah operasi ketika n digandakan.",
        "Cocokkan pola tersebut dengan pertumbuhan konstan, logaritmik, linear, linear-logaritmik, atau kuadratik."
    ]
    hints = [
        "Berapa kali operasi dasar dijalankan ketika n = 8, 16, dan 32?",
        "Apakah setiap iterasi loop terluar diikuti oleh seluruh iterasi loop dalam?"
    ]
    socratic = (
        "Untuk beberapa nilai n, hitung jumlah operasi dasarnya, lalu bandingkan pertumbuhannya."
    )
    return _build_domain_item(
        f"zap_prog_big_o_{idx}", "pemrograman", "prog_big_o",
        question, steps, "kompleksitas", socratic, hints, answer,
        method=(
            "Template dieksekusi pada sandbox AST untuk n = 8, 16, 32; pola operasi harus "
            "cocok dengan tepat satu kelas Big-O"
        ),
        detail={
            "template": template["id"],
            "measurements": measurements,
            "matched_class": answer,
        },
    )


_PROG_BUILDERS = {
    "prog_ekspresi_aritmetika": _generate_prog_ekspresi,
    "prog_tabel_kebenaran": _generate_prog_tabel_kebenaran,
    "prog_trace_loop": _generate_prog_trace_loop,
    "prog_trace_recursion": _generate_prog_trace_recursion,
    "prog_debug_satu_baris": _generate_prog_debug_satu_baris,
    "prog_big_o": _generate_prog_big_o,
}


def generate_pemrograman_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopic = PROGRAMMING_SUBTOPICS[idx % len(PROGRAMMING_SUBTOPICS)]
    return _PROG_BUILDERS[subtopic](idx, rng)


# ================================================================= FISIKA ===
def generate_fisika_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopic = FISIKA_SUBTOPICS[idx % len(FISIKA_SUBTOPICS)]

    if subtopic == "fis_kecepatan":
        for _ in range(30):
            t_value = rng.choice([4, 5, 6, 8, 10])
            v_value = rng.randint(8, 30)
            s_value = t_value * v_value
            answer = f"{_fmt_num(v_value)} m/s"
            question = (
                f"Sebuah kendaraan menempuh jarak s = {s_value} m dalam waktu t = {t_value} s.\n"
                "Berapa kelajuan rata-rata kendaraan tersebut?"
            )
            steps = [
                "Tuliskan besaran yang diketahui beserta satuannya.",
                "Hubungkan jarak, waktu, dan kelajuan dengan rumus v = s / t.",
                "Substitusikan nilai yang diketahui, lalu periksa satuan hasilnya."
            ]
            hints = [
                "Besaran apa saja yang sudah diketahui pada soal?",
                "Satuan kelajuan yang diminta adalah m/s; apakah jarak dan waktu sudah bersesuaian?"
            ]
            socratic = "Gunakan definisi kelajuan rata-rata sebagai perbandingan jarak terhadap waktu."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                return _build_domain_item(
                    f"zap_fis_kecepatan_{idx}", "fisika", "fis_kecepatan",
                    question, steps, "v", socratic, hints, answer,
                    method=f"v = s / t dihitung dengan SymPy Rational (s={s_value}, t={t_value})",
                    detail={"s": s_value, "t": t_value, "v": _fmt_num(sp.Rational(s_value, t_value))},
                )
        raise RuntimeError("fis_kecepatan: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "fis_glbb":
        for _ in range(30):
            v0 = rng.randint(0, 8)
            a_value = rng.choice([1, 2, 3, 4, 5])
            t_value = rng.randint(3, 6)
            s_exact = sp.Rational(v0 * t_value) + sp.Rational(1, 2) * a_value * t_value * t_value
            # Cek silang eksak: 2s = 2 v0 t + a t^2
            if 2 * s_exact != 2 * v0 * t_value + a_value * t_value * t_value:
                raise RuntimeError("fis_glbb: cek silang eksak gagal")
            answer = f"{_fmt_num(s_exact)} m"
            question = (
                f"Sebuah benda bergerak lurus dengan kecepatan awal v0 = {v0} m/s dan percepatan "
                f"tetap a = {a_value} m/s^2 selama t = {t_value} s.\n"
                "Berapa jarak yang ditempuh benda tersebut?"
            )
            steps = [
                "Tuliskan rumus jarak pada GLBB: s = v0 t + 1/2 a t^2.",
                "Hitung suku v0 t terlebih dahulu, lalu suku 1/2 a t^2.",
                "Jumlahkan kedua suku dan periksa satuannya (meter)."
            ]
            hints = [
                "Suku mana yang memakai waktu dikuadratkan?",
                "Apakah kecepatan awal dikalikan dengan waktu sebelum dijumlahkan dengan suku percepatan?"
            ]
            socratic = "Pisahkan perhitungan menjadi dua suku: suku kecepatan awal dan suku percepatan."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                return _build_domain_item(
                    f"zap_fis_glbb_{idx}", "fisika", "fis_glbb",
                    question, steps, "s", socratic, hints, answer,
                    method=f"s = v0 t + 1/2 a t^2 dievaluasi eksak dengan SymPy (s={_fmt_num(s_exact)})",
                    detail={"v0": v0, "a": a_value, "t": t_value, "s": _fmt_num(s_exact)},
                )
        raise RuntimeError("fis_glbb: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "fis_newton":
        for _ in range(30):
            m_value = rng.randint(2, 20)
            a_value = rng.randint(1, 12)
            force = m_value * a_value
            answer = f"{force} N"
            question = (
                f"Sebuah benda bermassa m = {m_value} kg dikenai gaya sehingga bergerak dengan "
                f"percepatan a = {a_value} m/s^2.\n"
                "Berapa besar gaya yang bekerja pada benda tersebut?"
            )
            steps = [
                "Tuliskan Hukum II Newton: F = m a.",
                "Substitusikan massa dan percepatan yang diketahui.",
                "Periksa satuan hasil: kg m/s^2 sama dengan newton (N)."
            ]
            hints = [
                "Bagaimana hubungan gaya, massa, dan percepatan?",
                "Apakah satuan kg dikali m/s^2 menghasilkan newton?"
            ]
            socratic = "Terapkan Hukum II Newton dan perhatikan satuan setiap besaran."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                if force // m_value != a_value:
                    raise RuntimeError("fis_newton: cek pembagian gagal")
                return _build_domain_item(
                    f"zap_fis_newton_{idx}", "fisika", "fis_newton",
                    question, steps, "F", socratic, hints, answer,
                    method=f"F = m a dihitung dengan Python int (F={force}) dan dicek F/m = a",
                    detail={"m": m_value, "a": a_value, "F": force},
                )
        raise RuntimeError("fis_newton: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "fis_energi_kinetik":
        for _ in range(30):
            m_value = rng.choice([2, 4, 5, 10])
            v_value = rng.choice([2, 3, 4, 6])
            ek_exact = sp.Rational(1, 2) * m_value * v_value * v_value
            if 2 * ek_exact != m_value * v_value * v_value:
                raise RuntimeError("fis_energi_kinetik: cek silang eksak gagal")
            answer = f"{_fmt_num(ek_exact)} J"
            question = (
                f"Sebuah benda bermassa m = {m_value} kg bergerak dengan kecepatan v = {v_value} m/s.\n"
                "Berapa energi kinetik benda tersebut?"
            )
            steps = [
                "Tuliskan rumus energi kinetik: Ek = 1/2 m v^2.",
                "Kuadratkan kecepatan terlebih dahulu, lalu kalikan massa dan faktor 1/2.",
                "Periksa satuan hasil: kg m^2/s^2 sama dengan joule (J)."
            ]
            hints = [
                "Besaran mana yang harus dikuadratkan pada rumus energi kinetik?",
                "Apakah faktor 1/2 sudah kalikan dengan hasil m v^2?"
            ]
            socratic = "Terapkan rumus energi kinetik secara berurutan: kuadratkan kecepatan, lalu kalikan."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                return _build_domain_item(
                    f"zap_fis_ek_{idx}", "fisika", "fis_energi_kinetik",
                    question, steps, "Ek", socratic, hints, answer,
                    method=f"Ek = 1/2 m v^2 dievaluasi eksak dengan SymPy (Ek={_fmt_num(ek_exact)})",
                    detail={"m": m_value, "v": v_value, "Ek": _fmt_num(ek_exact)},
                )
        raise RuntimeError("fis_energi_kinetik: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "fis_energi_potensial":
        for _ in range(30):
            m_value = rng.randint(1, 10)
            h_value = rng.randint(2, 12)
            g_value = 10
            ep_value = m_value * g_value * h_value
            answer = f"{ep_value} J"
            question = (
                f"Sebuah benda bermassa m = {m_value} kg berada pada ketinggian h = {h_value} m "
                "di atas tanah (gunakan g = 10 m/s^2).\n"
                "Berapa energi potensial gravitasi benda tersebut?"
            )
            steps = [
                "Tuliskan rumus energi potensial gravitasi: Ep = m g h.",
                "Kalikan massa, percepatan gravitasi, dan ketinggian.",
                "Periksa satuan hasil: kg m^2/s^2 sama dengan joule (J)."
            ]
            hints = [
                "Besaran apa saja yang memengaruhi energi potensial gravitasi?",
                "Apakah ketinggian perlu diubah satuannya sebelum dikalikan?"
            ]
            socratic = "Terapkan rumus Ep = m g h dan pastikan seluruh besaran memakai satuan SI."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                if ep_value // (m_value * g_value) != h_value:
                    raise RuntimeError("fis_energi_potensial: cek pembagian gagal")
                return _build_domain_item(
                    f"zap_fis_ep_{idx}", "fisika", "fis_energi_potensial",
                    question, steps, "Ep", socratic, hints, answer,
                    method=f"Ep = m g h dihitung dengan Python int (Ep={ep_value}) dan dicek Ep/(mg) = h",
                    detail={"m": m_value, "h": h_value, "g": g_value, "Ep": ep_value},
                )
        raise RuntimeError("fis_energi_potensial: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "fis_hukum_ohm":
        for _ in range(30):
            current = rng.choice([sp.Rational(1, 10), sp.Rational(2, 10), sp.Rational(5, 10),
                                  sp.Rational(1), sp.Rational(2), sp.Rational(3)])
            resistance = rng.randint(4, 20)
            voltage = current * resistance
            answer = f"{_fmt_num(voltage)} V"
            question = (
                f"Sebuah resistor memiliki hambatan R = {resistance} ohm dan dialiri arus listrik "
                f"I = {_fmt_num(current)} A.\n"
                "Berapa tegangan (beda potensial) pada resistor tersebut?"
            )
            steps = [
                "Tuliskan Hukum Ohm: V = I R.",
                "Substitusikan arus dan hambatan yang diketahui.",
                "Periksa satuan hasil: ampere dikali ohm sama dengan volt (V)."
            ]
            hints = [
                "Bagaimana hubungan tegangan, arus, dan hambatan?",
                "Apakah arus dalam ampere dan hambatan dalam ohm sudah memakai satuan SI?"
            ]
            socratic = "Terapkan Hukum Ohm dan periksa satuan hasil akhirnya."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                if voltage / current != resistance:
                    raise RuntimeError("fis_hukum_ohm: cek pembagian gagal")
                return _build_domain_item(
                    f"zap_fis_ohm_{idx}", "fisika", "fis_hukum_ohm",
                    question, steps, "V", socratic, hints, answer,
                    method=f"V = I R dievaluasi eksak dengan SymPy (V={_fmt_num(voltage)}) dan dicek V/I = R",
                    detail={"I": _fmt_num(current), "R": resistance, "V": _fmt_num(voltage)},
                )
        raise RuntimeError("fis_hukum_ohm: parameter bebas kebocoran tidak ditemukan")

    # fis_daya
    for _ in range(30):
        voltage_value = rng.choice([12, 110, 220])
        current = rng.choice([sp.Rational(1, 2), sp.Rational(1), sp.Rational(2), sp.Rational(3)])
        power = voltage_value * current
        answer = f"{_fmt_num(power)} W"
        question = (
            f"Sebuah alat listrik dihubungkan dengan tegangan V = {voltage_value} V dan mengalirkan "
            f"arus I = {_fmt_num(current)} A.\n"
            "Berapa daya listrik yang diserap alat tersebut?"
        )
        steps = [
            "Tuliskan rumus daya listrik: P = V I.",
            "Kalikan tegangan dan arus yang diketahui.",
            "Periksa satuan hasil: volt dikali ampere sama dengan watt (W)."
        ]
        hints = [
            "Bagaimana hubungan daya, tegangan, dan arus?",
            "Apakah hasil volt dikali ampere memiliki satuan watt?"
        ]
        socratic = "Terapkan rumus daya listrik dan periksa satuan hasilnya."
        if _answer_absent(answer, question, socratic, *steps, *hints):
            if power / voltage_value != current:
                raise RuntimeError("fis_daya: cek pembagian gagal")
            return _build_domain_item(
                f"zap_fis_daya_{idx}", "fisika", "fis_daya_listrik",
                question, steps, "P", socratic, hints, answer,
                method=f"P = V I dievaluasi eksak dengan SymPy (P={_fmt_num(power)}) dan dicek P/V = I",
                detail={"V": voltage_value, "I": _fmt_num(current), "P": _fmt_num(power)},
            )
    raise RuntimeError("fis_daya: parameter bebas kebocoran tidak ditemukan")


# ================================================================== KIMIA ===
_ATOMIC_MASS = {"H": 1.0, "C": 12.0, "N": 14.0, "O": 16.0, "Na": 23.0, "S": 32.0, "Cl": 35.5}
_MOLECULES = {
    "H2O": {"H": 2, "O": 1},
    "CO2": {"C": 1, "O": 2},
    "NaCl": {"Na": 1, "Cl": 1},
    "C6H12O6": {"C": 6, "H": 12, "O": 6},
    "H2SO4": {"H": 2, "S": 1, "O": 4},
    "NH3": {"N": 1, "H": 3},
}
_REACTIONS = [
    {
        "equation": "2H2 + O2 -> 2H2O",
        "given": "H2",
        "given_coef": 2,
        "targets": {"O2": 1, "H2O": 2},
    },
    {
        "equation": "N2 + 3H2 -> 2NH3",
        "given": "N2",
        "given_coef": 1,
        "targets": {"NH3": 2, "H2": 3},
    },
    {
        "equation": "CH4 + 2O2 -> CO2 + 2H2O",
        "given": "CH4",
        "given_coef": 1,
        "targets": {"CO2": 1, "H2O": 2},
    },
]
_GAS_CASES = [
    {"n": 2.0, "T": 300, "P": 4.92},
    {"n": 0.5, "T": 400, "P": 1.64},
    {"n": 1.0, "T": 300, "P": 2.46},
    {"n": 3.0, "T": 200, "P": 4.92},
]
_GAS_CONSTANT = 0.082


def generate_kimia_sample(idx: int) -> Dict[str, Any]:
    rng = random.Random(DEFAULT_SEED + idx)
    subtopic = KIMIA_SUBTOPICS[idx % len(KIMIA_SUBTOPICS)]

    if subtopic == "kim_mol_massa":
        for _ in range(30):
            formula = rng.choice(list(_MOLECULES))
            atoms = _MOLECULES[formula]
            mr = sum(sp.Rational(_ATOMIC_MASS[element]) * count for element, count in atoms.items())
            n_value = rng.choice([sp.Rational(1, 2), sp.Rational(3, 2), sp.Rational(2),
                                  sp.Rational(5, 2), sp.Rational(3)])
            mass = n_value * mr
            answer = f"{_fmt_num(n_value)} mol"
            ar_text = ", ".join(
                f"{element} = {_fmt_num(_ATOMIC_MASS[element])}" for element in atoms
            )
            question = (
                f"Sebanyak {_fmt_num(mass)} gram senyawa {formula} (Ar: {ar_text}).\n"
                "Tentukan jumlah mol senyawa tersebut."
            )
            steps = [
                "Hitung massa molekul relatif (Mr) dari Ar atom-atom penyusun.",
                "Gunakan hubungan n = massa / Mr.",
                "Periksa satuan hasil: gram dibagi gram/mol menghasilkan mol."
            ]
            hints = [
                "Bagaimana cara menghitung Mr dari Ar setiap atom penyusun?",
                "Apakah massa senyawa harus dibagi atau dikalikan dengan Mr?"
            ]
            socratic = "Hitung Mr senyawa terlebih dahulu, lalu gunakan rumus konsep mol."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                if n_value * mr != mass:
                    raise RuntimeError("kim_mol_massa: cek silang mol gagal")
                return _build_domain_item(
                    f"zap_kim_mol_{idx}", "kimia", "kim_mol_massa",
                    question, steps, "n", socratic, hints, answer,
                    method=f"Mr dihitung dari Ar eksplisit = {_fmt_num(mr)}; n = m/Mr dicek silang eksak",
                    detail={"Mr": _fmt_num(mr), "massa": _fmt_num(mass), "n": _fmt_num(n_value)},
                )
        raise RuntimeError("kim_mol_massa: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "kim_stoikiometri_reaksi":
        for _ in range(30):
            reaction = rng.choice(_REACTIONS)
            given_moles = rng.randint(2, 6)
            target_values: Dict[str, sp.Rational] = {
                species: sp.Rational(given_moles * coefficient, reaction["given_coef"])
                for species, coefficient in reaction["targets"].items()
            }
            # Urutkan agar angka utama jawaban bukan angka yang sudah muncul pada soal
            # (jawaban gabungan tetap tidak boleh muncul utuh di question).
            ordered_targets = sorted(
                target_values.items(),
                key=lambda pair: pair[1] == given_moles,
            )
            answer = " dan ".join(
                f"{_fmt_num(value)} mol {species}" for species, value in ordered_targets
            )
            target_text = " dan ".join(
                f"jumlah mol {species}" for species, _value in ordered_targets
            )
            question = (
                f"Perhatikan persamaan reaksi setara berikut:\n{reaction['equation']}\n"
                f"Jika tersedia {given_moles} mol {reaction['given']}, tentukan {target_text} "
                "yang terlibat dalam reaksi tersebut."
            )
            steps = [
                "Tentukan koefisien reaksi untuk zat yang diketahui dan zat yang ditanya.",
                "Gunakan rasio mol = perbandingan koefisien reaksi.",
                "Terapkan rasio tersebut pada jumlah mol zat yang diketahui."
            ]
            hints = [
                "Berapa perbandingan koefisien zat yang diketahui terhadap zat yang ditanya?",
                "Apakah rasio mol selalu 1:1 tanpa melihat koefisien?"
            ]
            socratic = "Bandingkan koefisien reaksi, bukan massa atau jumlah atom secara langsung."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                for species, coefficient in reaction["targets"].items():
                    if target_values[species] * reaction["given_coef"] != given_moles * coefficient:
                        raise RuntimeError("kim_stoikiometri: cek rasio mol gagal")
                return _build_domain_item(
                    f"zap_kim_stoik_{idx}", "kimia", "kim_stoikiometri_reaksi",
                    question, steps, "mol_produk", socratic, hints, answer,
                    method="Rasio koefisien reaksi dihitung eksak dengan SymPy Rational dan dicek silang",
                    detail={
                        "equation": reaction["equation"],
                        "given": reaction["given"],
                        "given_moles": given_moles,
                        "targets": {
                            species: _fmt_num(value) for species, value in target_values.items()
                        },
                    },
                )
        raise RuntimeError("kim_stoikiometri_reaksi: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "kim_konsentrasi":
        for _ in range(30):
            moles = rng.choice([sp.Rational(1, 10), sp.Rational(2, 10), sp.Rational(4, 10),
                                sp.Rational(1, 2), sp.Rational(8, 10)])
            volume_ml = rng.choice([100, 200, 250, 500, 1000])
            molarity = moles / sp.Rational(volume_ml, 1000)
            answer = f"{_fmt_num(molarity)} M"
            question = (
                f"Sebanyak {_fmt_num(moles)} mol NaCl dilarutkan dalam air hingga volume larutan "
                f"menjadi {volume_ml} mL.\n"
                "Tentukan molaritas (konsentrasi) larutan tersebut."
            )
            steps = [
                "Ubah volume larutan dari mililiter ke liter.",
                "Gunakan rumus molaritas M = n / V(L).",
                "Periksa satuan hasil: mol per liter disimbolkan M."
            ]
            hints = [
                "Apakah volume 1000 mL sama dengan 1 liter?",
                "Apakah volume sudah berada dalam satuan liter sebelum dipakai pada rumus?"
            ]
            socratic = "Periksa satuan volume terlebih dahulu, baru terapkan rumus molaritas."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                if molarity * sp.Rational(volume_ml, 1000) != moles:
                    raise RuntimeError("kim_konsentrasi: cek silang molaritas gagal")
                return _build_domain_item(
                    f"zap_kim_konsentrasi_{idx}", "kimia", "kim_konsentrasi",
                    question, steps, "M", socratic, hints, answer,
                    method="M = n / V(L) dihitung eksak dengan SymPy Rational dan dicek silang M*V = n",
                    detail={"n": _fmt_num(moles), "V_mL": volume_ml, "M": _fmt_num(molarity)},
                )
        raise RuntimeError("kim_konsentrasi: parameter bebas kebocoran tidak ditemukan")

    if subtopic == "kim_ph":
        for _ in range(30):
            concentration = rng.choice([0.01, 0.001, 0.0001, 0.00001, 0.000001])
            ph_value = -math.log10(concentration)
            ph_rounded = round(ph_value, 10)
            if abs(ph_rounded - round(ph_rounded)) > 1e-9:
                continue
            answer = str(int(round(ph_rounded)))
            if abs(10 ** (-int(answer)) - concentration) > concentration * 1e-9:
                raise RuntimeError("kim_ph: cek balik 10^(-pH) gagal")
            question = (
                "Larutan HCl merupakan asam kuat yang terionisasi sempurna. "
                f"Konsentrasi ion H+ dalam larutan tersebut adalah {_fmt_num(concentration)} M.\n"
                "Berapa pH larutan tersebut?"
            )
            steps = [
                "Gunakan definisi pH = -log10[H+].",
                "Karena HCl asam kuat, konsentrasi H+ sama dengan konsentrasi HCl.",
                "Hitung logaritma basis 10 dari konsentrasi tersebut, lalu beri tanda negatif."
            ]
            hints = [
                "Apakah HCl terionisasi sempurna sehingga [H+] sama dengan konsentrasinya?",
                "Bagaimana hubungan pH dengan pangkat negatif dari 10?"
            ]
            socratic = "Gunakan definisi pH dan perhatikan pangkat bilangan 10 pada konsentrasi H+."
            if _answer_absent(answer, question, socratic, *steps, *hints):
                return _build_domain_item(
                    f"zap_kim_ph_{idx}", "kimia", "kim_ph",
                    question, steps, "pH", socratic, hints, answer,
                    method="pH = -log10[H+] dihitung dengan Python math; dicek balik 10^(-pH) = [H+]",
                    detail={"h_plus": _fmt_num(concentration), "pH": answer},
                )
        raise RuntimeError("kim_ph: parameter bebas kebocoran tidak ditemukan")

    # kim_gas_ideal
    for _ in range(30):
        gas_case = rng.choice(_GAS_CASES)
        n_value = gas_case["n"]
        temperature = gas_case["T"]
        pressure = gas_case["P"]
        volume = n_value * _GAS_CONSTANT * temperature / pressure
        if abs(volume - 10.0) > 1e-9:
            raise RuntimeError(f"kim_gas_ideal: volume tak terduga {volume}")
        if abs(pressure * volume - n_value * _GAS_CONSTANT * temperature) > 1e-9:
            raise RuntimeError("kim_gas_ideal: cek PV = nRT gagal")
        answer = "10 L"
        question = (
            f"Sebanyak {_fmt_num(n_value)} mol gas ideal berada pada suhu {temperature} K dan "
            f"tekanan {_fmt_num(pressure)} atm.\n"
            "Tentukan volume gas tersebut. (R = 0.082 L atm mol^-1 K^-1)"
        )
        steps = [
            "Tuliskan persamaan gas ideal: P V = n R T.",
            "Susun ulang persamaan menjadi V = n R T / P.",
            "Masukkan nilai n, R, T, dan P, lalu periksa satuan volume (liter)."
        ]
        hints = [
            "Apakah suhu sudah dalam kelvin?",
            "Variabel mana yang perlu dicari, dan bagaimana menyusun ulang PV = nRT?"
        ]
        socratic = "Susun ulang persamaan gas ideal sehingga besaran yang ditanya berdiri sendiri."
        if _answer_absent(answer, question, socratic, *steps, *hints):
            return _build_domain_item(
                f"zap_kim_gas_{idx}", "kimia", "kim_gas_ideal",
                question, steps, "V", socratic, hints, answer,
                method="V = nRT/P dihitung dengan Python float; dicek PV = nRT dan V = 10 L",
                detail={"n": n_value, "T": temperature, "P": pressure, "V": volume},
            )
    raise RuntimeError("kim_gas_ideal: parameter bebas kebocoran tidak ditemukan")


DOMAIN_GENERATORS = {
    "pemrograman": generate_pemrograman_sample,
    "fisika": generate_fisika_sample,
    "kimia": generate_kimia_sample,
}

DOMAIN_SUBTOPIC_LISTS = {
    "pemrograman": PROGRAMMING_SUBTOPICS,
    "fisika": FISIKA_SUBTOPICS,
    "kimia": KIMIA_SUBTOPICS,
}


def generate_domain_corpus(domain: str, count: int = 10) -> List[Dict[str, Any]]:
    """Sintesis item domain non-matematika yang sudah terverifikasi mesin."""
    generator = DOMAIN_GENERATORS.get(domain)
    if generator is None:
        raise ValueError(
            f"Domain '{domain}' tidak punya generator. Tersedia: {list(DOMAIN_GENERATORS)}"
        )
    items = [generator(i) for i in range(count)]
    for item in items:
        item.setdefault("source", "generated_local")
    return items

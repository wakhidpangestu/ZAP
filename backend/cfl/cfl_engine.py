"""
ZAP (Zero Answer Policy) - Core Cognitive Fault Localization (CFL) Engine
Memverifikasi invarian logika aljabar langkah demi langkah.
"""

import sympy as sp
from .parser import parse_step_to_symbolic
from .classifier import classify_misconception_robust
from .counter_example import synthesize_counter_example

# Batas derajat polinomial yang masih diserahkan ke sp.solveset. Diukur:
# x^100 + x^99 = 1 vs x^100 = 1 - x^99 tidak selesai dalam 15 detik, sehingga
# satu permintaan /diagnose dapat memblokir worker. Di luar batas ini langkah
# dinyatakan tidak dapat diputuskan (None), bukan dipaksa menjadi vonis.
MAX_SOLVESET_DEGREE = 12


def _polynomial_degree(expr: sp.Expr, var: sp.Symbol) -> int | None:
    """Derajat polinomial, atau None bila expr bukan polinomial pada var."""
    try:
        return int(sp.Poly(expr, var).degree())
    except (sp.PolynomialError, TypeError, ValueError):
        return None


def steps_equivalent(prev: sp.Expr | sp.Eq, nxt: sp.Expr | sp.Eq, var: sp.Symbol = sp.Symbol('x')) -> bool | None:
    """
    Memvalidasi ekuivalensi matematis antara dua langkah berurutan:
    - True  : Langkah valid
    - False : Langkah tidak ekuivalen / galat terdeteksi
    - None  : Tidak dapat diputuskan secara pasti (ConditionSet / di luar domain)
    """
    # Kasus 1: Kedua langkah adalah Persamaan (sp.Eq)
    if isinstance(prev, sp.Eq) and isinstance(nxt, sp.Eq):
        # Sub-kasus 1a: Transisi ekspresi fungsi f(x) = E1 ke f(x) = E2 dengan LHS identik
        if prev.lhs == nxt.lhs:
            if sp.simplify(nxt.rhs - prev.rhs) == 0:
                return True

        degrees = (
            _polynomial_degree(prev.lhs - prev.rhs, var),
            _polynomial_degree(nxt.lhs - nxt.rhs, var),
        )
        if any(d is not None and d > MAX_SOLVESET_DEGREE for d in degrees):
            return None

        s1 = sp.solveset(prev.lhs - prev.rhs, var, domain=sp.S.Reals)
        s2 = sp.solveset(nxt.lhs - nxt.rhs, var, domain=sp.S.Reals)

        # Jika salah satu menghasilkan ConditionSet, jangan paksa vonis
        if isinstance(s1, sp.ConditionSet) or isinstance(s2, sp.ConditionSet):
            return None

        # Jika kedua persamaan tidak memiliki solusi real (EmptySet),
        # pastikan ekspresinya identik/ekuivalen secara simbolik
        if s1 == sp.EmptySet and s2 == sp.EmptySet:
            return sp.simplify((prev.lhs - prev.rhs) - (nxt.lhs - nxt.rhs)) == 0

        return s1 == s2

    # Kasus 2: Kedua langkah adalah Ekspresi Aljabar Biasa (sp.Expr)
    if not isinstance(prev, sp.Eq) and not isinstance(nxt, sp.Eq):
        return sp.simplify(nxt - prev) == 0

    return False


def isolate_first_fault_breakpoint(raw_lines: list[str], target_var: str = 'x') -> tuple[int, dict]:
    """
    Mengevaluasi baris-baris aljabar siswa dan mengisolasi titik patah logika pertama.
    """
    var = sp.Symbol(target_var)
    parsed_steps = []

    for idx, line in enumerate(raw_lines):
        try:
            sym_obj = parse_step_to_symbolic(line)
            parsed_steps.append((sym_obj, line))
        except AssertionError:
            # Invariant 1 (anti-masking): jangan ubah AssertionError internal
            # / monkeypatch menjadi PARSING_ERROR yang tampak seperti input siswa.
            raise
        except Exception as err:
            return idx, {
                "status": "PARSING_ERROR",
                "fault_line": idx + 1,
                "message": f"Format baris {idx + 1} tidak dapat diurai: {err}"
            }

    for i in range(len(parsed_steps) - 1):
        prev_obj, prev_raw = parsed_steps[i]
        nxt_obj, nxt_raw = parsed_steps[i + 1]

        equiv = steps_equivalent(prev_obj, nxt_obj, var=var)

        if equiv is False:
            fault_idx = i + 1
            misconception = classify_misconception_robust(prev_obj, nxt_obj, var)
            counter_ex = synthesize_counter_example(prev_obj, nxt_obj, var)

            return fault_idx, {
                "status": "FAULT_DETECTED",
                "fault_line": fault_idx + 1,
                "prev_line": prev_raw,
                "fault_line_str": nxt_raw,
                "misconception_type": misconception,
                "counter_example": counter_ex
            }
        elif equiv is None:
            # Langkah berisiko / di luar cakupan evaluasi otomatis
            return i + 1, {
                "status": "UNDECIDABLE_STEP",
                "fault_line": i + 2,
                "note": "Langkah ini memerlukan verifikasi manual (domain tak tentu)."
            }

    return -1, {"status": "ALL_STEPS_VALID"}

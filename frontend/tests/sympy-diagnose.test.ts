import { describe, it, expect, vi } from "vitest";
import {
  diagnoseMessageWithSymPy,
  extractAlgebraicStepsFromMessage,
  formatDeterministicSymPyReply,
  inferTargetVariable,
} from "@/lib/sympy-diagnose";

describe("SymPy Chat Diagnostic Bridge (lib/sympy-diagnose)", () => {
  it("extracts algebraic steps separated by arrows while skipping Indonesian connectors", () => {
    const steps = extractAlgebraicStepsFromMessage(
      "Tolong cek langkah saya: x^2 = 5x -> kedua ruas dibagi x -> x = 5"
    );
    expect(steps).toEqual(["x^2 = 5x", "x = 5"]);
    expect(inferTargetVariable(steps)).toBe("x");
  });

  it("extracts multiline algebraic derivations", () => {
    const steps = extractAlgebraicStepsFromMessage(
      "Cek coretan saya:\n(x + 3)^2 - 4 = 0\nx^2 + 9 - 4 = 0\nx^2 + 5 = 0"
    );
    expect(steps).toEqual([
      "(x + 3)^2 - 4 = 0",
      "x^2 + 9 - 4 = 0",
      "x^2 + 5 = 0",
    ]);
  });

  it("ignores single-line 2D/3D visual plotting prompts", () => {
    expect(
      extractAlgebraicStepsFromMessage(
        "Tampilkan grafik gelombang sinus y = 2 sin(x) di papan tulis 2D"
      )
    ).toEqual([]);
    expect(
      extractAlgebraicStepsFromMessage(
        "Tampilkan permukaan pelana kuda 3D z = x^2 - y^2"
      )
    ).toEqual([]);
  });

  it("calls /api/v1/diagnose and maps ROOT_LOSS diagnosis into activeProblemPatch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        diagnosis: {
          has_fault: true,
          first_fault_line: 2,
          fault_type: "ROOT_LOSS",
          status: "FAULT_DETECTED",
          human_explanation: "Pembagian dengan x menghilangkan akar x = 0.",
          socratic_prompt: "Apa yang terjadi jika kita uji x = 0 ke persamaan awal?",
          counter_example: {
            test_variable: "x",
            test_value: 0,
            lhs_expected: "0",
            rhs_calculated: "0",
            contradiction_statement: "Untuk x = 0, persamaan awal terpenuhi tetapi x = 5 tidak.",
          },
        },
      }),
    });

    const result = await diagnoseMessageWithSymPy(
      "Tolong cek langkah saya: x^2 = 5x -> kedua ruas dibagi x -> x = 5",
      "x",
      "http://127.0.0.1:8000",
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.activeProblemPatch.faultLine).toBe(2);
    expect(result?.activeProblemPatch.misconceptionType).toBe("ROOT_LOSS");
    expect(result?.activeProblemPatch.counterExample?.test_value).toBe(0);

    const formatted = formatDeterministicSymPyReply(result!);
    expect(formatted).toContain("ROOT_LOSS");
    expect(formatted).toContain("Baris #2");
  });

  it("fails gracefully (returns null) when SymPy backend is offline", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await diagnoseMessageWithSymPy(
      "2x + 6 = 14 -> 2x = 20",
      "x",
      "http://127.0.0.1:8000",
      failingFetch as unknown as typeof fetch
    );
    expect(result).toBeNull();
  });
});

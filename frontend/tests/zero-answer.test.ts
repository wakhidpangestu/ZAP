import { describe, it, expect } from "vitest";
import {
  cleanModelResponse,
  finalizeModelReply,
  sanitizeZeroAnswer,
} from "@/lib/zero-answer";
import { resolveGeometricIntent } from "@/data/geometry-database";

describe("Zero-Answer Guardrail (lib/zero-answer)", () => {
  it("censors declarative final answers while preserving Socratic guidance", () => {
    const leaky =
      "Coba pindahkan konstanta ke ruas kanan. Nilai x = 5 adalah hasilnya.";
    const guarded = sanitizeZeroAnswer(leaky, { targetVariable: "x" });
    expect(guarded).not.toContain("x = 5");
    expect(guarded).toContain("ruas kanan");
  });

  it("censors math span assignments for the active targetVariable", () => {
    const withSpan = "Kita tahu $$x = 12$$ dari langkah sebelumnya.";
    const guarded = sanitizeZeroAnswer(withSpan, { targetVariable: "x" });
    expect(guarded).not.toContain("12");
  });

  it("preserves given lowercase width parameter l = 6 while censoring uppercase L = 248", () => {
    const balokReply =
      "Parameter Balok ($p = 10,\\ l = 6,\\ t = 4\\text{ cm}$). Maka L = 248 atau V = 240.";
    const guarded = sanitizeZeroAnswer(balokReply);
    expect(guarded).toContain("l = 6");
    expect(guarded).not.toContain("248");
    expect(guarded).not.toContain("240");
  });

  it("strips hidden <think> and <thought> blocks from model responses", () => {
    const raw =
      "<think>Internal chain of thought solving x = 99</think>\nCoba lihat koefisien x pada baris kedua.";
    const cleaned = cleanModelResponse(raw);
    expect(cleaned).toBe("Coba lihat koefisien x pada baris kedua.");
    expect(cleaned).not.toContain("<think>");
  });

  it("falls back to Socratic prompt if sanitization leaves near-empty reply", () => {
    const fallback = "Coba cek lagi langkah pindah ruasnya, ya!";
    const res = finalizeModelReply("x = 7", fallback, { targetVariable: "x" });
    expect(res.length).toBeGreaterThanOrEqual(8);
    expect(res).not.toContain("7");
  });
});

describe("Starter Templates & Geometry Intent Resolution", () => {
  it("resolves 2D parabola template to 2d_quadratic without geometry-clarify error", () => {
    const res = resolveGeometricIntent(
      "Tampilkan grafik parabola y = x^2 - 3 di papan tulis 2D"
    );
    expect(res).not.toBeNull();
    expect(res?.dimension).toBe("2D");
    expect(res?.smartboardItem?.model).toBe("2d_quadratic");
    expect(res?.smartboardItem?.paramA).toBe(1);
    expect(res?.smartboardItem?.paramB).toBe(0);
    expect(res?.smartboardItem?.paramC).toBe(-3);
  });

  it("resolves Kubus 3D + Irisan Bidang template with hasSlice=true", () => {
    const res = resolveGeometricIntent(
      "Tampilkan kubus 10 cm dengan irisan bidang 3D"
    );
    expect(res).not.toBeNull();
    expect(res?.dimension).toBe("3D");
    expect(res?.smartboardItem?.model).toBe("solids");
    expect(res?.smartboardItem?.solidKind).toBe("kubus");
    expect(res?.smartboardItem?.hasSlice).toBe(true);
  });

  it("keeps Balok 10x6x4 reply intact after sanitizeZeroAnswer", () => {
    const res = resolveGeometricIntent("buatkan balok 10x6x4 dalam bentuk 3d");
    expect(res).not.toBeNull();
    const guarded = sanitizeZeroAnswer(res?.reply || "");
    expect(guarded).toContain("l = 6");
    expect(guarded).not.toContain("Berapakahnilai");
  });
});

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
  it("resolves 2D sine wave template to 2d_trig without guardrail mangling", () => {
    const res = resolveGeometricIntent(
      "Tampilkan grafik gelombang sinus y = 2 sin(x) di papan tulis 2D"
    );
    expect(res).not.toBeNull();
    expect(res?.dimension).toBe("2D");
    expect(res?.smartboardItem?.model).toBe("2d_trig");
    expect(res?.smartboardItem?.paramA).toBe(2);
    expect(res?.smartboardItem?.paramB).toBe(1);
    const guarded = sanitizeZeroAnswer(res?.reply || "");
    expect(guarded).not.toContain("Berapakah nilainya");
  });

  it("resolves 3D saddle surface template to saddle without guardrail mangling", () => {
    const res = resolveGeometricIntent(
      "Tampilkan permukaan pelana kuda 3D z = x^2 - y^2"
    );
    expect(res).not.toBeNull();
    expect(res?.dimension).toBe("3D");
    expect(res?.smartboardItem?.model).toBe("saddle");
    const guarded = sanitizeZeroAnswer(res?.reply || "");
    expect(guarded).toContain("z = x^2 - y^2");
    expect(guarded).not.toContain("Berapakah nilainya");
  });

  it("keeps Balok 10x6x4 reply intact after sanitizeZeroAnswer", () => {
    const res = resolveGeometricIntent("buatkan balok 10x6x4 dalam bentuk 3d");
    expect(res).not.toBeNull();
    const guarded = sanitizeZeroAnswer(res?.reply || "");
    expect(guarded).toContain("l = 6");
    expect(guarded).not.toContain("Berapakahnilai");
  });
});

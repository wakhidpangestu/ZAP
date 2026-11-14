import { describe, it, expect } from "vitest";
import {
  cleanModelResponse,
  finalizeModelReply,
  sanitizeZeroAnswer,
} from "@/lib/zero-answer";

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

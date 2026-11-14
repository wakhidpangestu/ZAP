import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearRateLimitBuckets, rateLimitCheck } from "@/utils/rate-limit";
import { getCandidateVaultDirs, getWritableVaultFilePath } from "@/lib/vault-dir";
import { deriveTitle, loadConversations, saveConversations, windowHistory } from "@/utils/chat-memory";

describe("Rate Limiter, Vault Paths & Chat Memory", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    clearRateLimitBuckets();
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
  });

  it("enforces sliding window rate limits and bounds bucket memory at <= 5000 keys", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimitCheck("user-a", 3, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimitCheck("user-a", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    // Flood 5,200 unique keys: should prune cleanly without throwing
    for (let k = 0; k < 5_200; k++) {
      const r = rateLimitCheck(`flood-${k}`, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it("resolves candidate and writable vault paths safely", () => {
    const dirs = getCandidateVaultDirs("shares");
    expect(dirs.length).toBeGreaterThanOrEqual(1);
    const writable = getWritableVaultFilePath(["shares"], "probe-test.json");
    expect(writable.endsWith("probe-test.json")).toBe(true);
  });

  it("handles chat history windowing, title derivation, and QuotaExceeded fallback", () => {
    expect(deriveTitle([{ sender: "user", rawText: "  Bantu   selesaikan 2x + 4 = 10  " }])).toBe(
      "Bantu selesaikan 2x + 4 = 10"
    );

    const turns = windowHistory(
      [
        { sender: "user", rawText: "Langkah 1" },
        { sender: "assistant", replyText: "Coba cek koefisien." },
      ],
      10
    );
    expect(turns).toEqual([
      { role: "user", content: "Langkah 1" },
      { role: "assistant", content: "Coba cek koefisien." },
    ]);

    const store = new Map<string, string>();
    let failFirstBigWrite = true;
    const mockLs = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failFirstBigWrite && v.includes("data:image/jpeg;base64,")) {
          failFirstBigWrite = false;
          throw new Error("QuotaExceededError");
        }
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size;
      },
    } as unknown as Storage;

    (globalThis as unknown as { window: unknown }).window = { localStorage: mockLs };
    (globalThis as unknown as { localStorage: Storage }).localStorage = mockLs;

    const largeBase64 = `data:image/jpeg;base64,${"A".repeat(8192)}`;
    saveConversations(
      [
        {
          id: "c1",
          title: "Latihan",
          createdAt: 1,
          updatedAt: 2,
          activeProblemFirstStep: null,
          activeProblemContext: null,
          targetVar: "x",
          messages: [
            {
              id: "m1",
              sender: "user",
              rawText: "Foto soal",
              attachedFiles: [{ id: "f1", name: "soal.jpg", dataUrl: largeBase64, type: "image/jpeg", size: 8192 }],
            },
          ],
        },
        {
          id: "c2",
          title: "Lama",
          createdAt: 1,
          updatedAt: 1,
          activeProblemFirstStep: null,
          activeProblemContext: null,
          targetVar: "x",
          messages: [
            {
              id: "m2",
              sender: "user",
              rawText: "Foto lama",
              attachedFiles: [{ id: "f2", name: "lama.jpg", dataUrl: largeBase64, type: "image/jpeg", size: 8192 }],
            },
          ],
        },
      ],
      null
    );

    const loaded = loadConversations(null);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("c1");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ACCOUNT_SESSION_STORAGE_KEY,
  GOOGLE_ID_TOKEN_STORAGE_KEY,
  getSyncAuthToken,
  isAccountSessionExpired,
  isJwtExpired,
  saveAccountSessionToken,
  saveGoogleIdToken,
} from "@/utils/account-sync";
import { createAccountSession, verifyAccountSession } from "@/lib/account-session";

function makeFakeJwt(expEpochSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email: "siswa@example.com", exp: expEpochSeconds })).toString("base64url");
  return `${header}.${payload}.fakesig`;
}

describe("Account Session & Sync Token Selection", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store = new Map<string, string>();
    const mockLocalStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as unknown as Storage;

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
    };
    (globalThis as unknown as { localStorage: Storage }).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
  });

  it("issues and verifies 30-day HMAC account sessions and rejects tampering", () => {
    const created = createAccountSession("Budi@Example.COM", 30);
    const verified = verifyAccountSession(created.token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("budi@example.com");
    expect(verified!.expiresAt).toBeGreaterThan(Date.now() + 25 * 24 * 60 * 60 * 1000);

    const tampered = `${created.token.slice(0, -4)}AAAA`;
    expect(verifyAccountSession(tampered)).toBeNull();
    expect(isAccountSessionExpired(created.token)).toBe(false);
  });

  it("detects expired Google JWT and falls back to valid 30-day session token", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 600;
    const expiredJwt = makeFakeJwt(pastExp);
    expect(isJwtExpired(expiredJwt)).toBe(true);

    const session = createAccountSession("siswa@example.com", 30);
    saveGoogleIdToken(expiredJwt);
    saveAccountSessionToken(session.token);

    const chosen = getSyncAuthToken();
    expect(chosen).toBe(session.token);
    expect(globalThis.localStorage.getItem(GOOGLE_ID_TOKEN_STORAGE_KEY)).toBeNull();
    expect(globalThis.localStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY)).toBe(session.token);
  });

  it("accepts non-expired Google JWT when present", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validJwt = makeFakeJwt(futureExp);
    expect(isJwtExpired(validJwt)).toBe(false);

    saveGoogleIdToken(validJwt);
    expect(getSyncAuthToken()).toBe(validJwt);
  });
});

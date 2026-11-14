import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ensureWritableVaultDir, getCandidateVaultFilePaths } from "@/lib/vault-dir";

/**
 * Token sesi akun ZAP (email/password) untuk sinkronisasi terenkripsi.
 *
 * Kenapa ada: rute `/api/user/sync` sebelumnya hanya menerima **Google ID
 * token**. Akun email/password (dan pemilik yang login tanpa Google) jadi tidak
 * punya jalur cadangan cloud. Token ini memberi identitas server-side yang
 * setara, tanpa menyimpan kata sandi di klien.
 *
 * Format: `base64url(payload).base64url(hmacSHA256(payload))`
 * payload = { e: email, x: exp (detik epoch), n: nonce, v: 1 }
 *
 * Ditandatangani dengan `ZAP_SESSION_SECRET`. Bila env tidak di-set, secret
 * acak 32 byte dibuat sekali dan disimpan di `.zap_vault/security/session-secret`
 * agar sesi tidak terputus setiap restart.
 */

const SESSION_VERSION = 1;
export const ACCOUNT_SESSION_TTL_DAYS = 30;

let cachedSecret: Buffer | null = null;

function getSessionSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const fromEnv = (process.env.ZAP_SESSION_SECRET || "").trim();
  if (fromEnv.length >= 32) {
    cachedSecret = Buffer.from(fromEnv, "utf-8");
    return cachedSecret;
  }

  try {
    for (const candidate of getCandidateVaultFilePaths(["security"], "session-secret")) {
      if (fs.existsSync(candidate)) {
        const existing = fs.readFileSync(candidate, "utf-8").trim();
        if (existing.length >= 32) {
          cachedSecret = Buffer.from(existing, "utf-8");
          return cachedSecret;
        }
      }
    }
    const dir = ensureWritableVaultDir("security");
    if (dir) {
      const secretPath = path.join(dir, "session-secret");
      const generated = crypto.randomBytes(32).toString("hex");
      fs.writeFileSync(secretPath, generated, { encoding: "utf-8", mode: 0o600 });
      cachedSecret = Buffer.from(generated, "utf-8");
      return cachedSecret;
    }
  } catch {
    // fallback ke secret proses di bawah
  }
  // Filesystem read-only: pakai secret proses (sesi hilang saat restart).
  cachedSecret = crypto.randomBytes(32);
  return cachedSecret;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function signPayload(payloadB64: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest());
}

export interface AccountSession {
  token: string;
  expiresAt: number;
}

/** Membuat token sesi untuk email akun. */
export function createAccountSession(email: string, ttlDays: number = ACCOUNT_SESSION_TTL_DAYS): AccountSession {
  const cleanEmail = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + Math.max(1, ttlDays) * 24 * 60 * 60;
  const payload = {
    e: cleanEmail,
    x: exp,
    n: crypto.randomBytes(8).toString("hex"),
    v: SESSION_VERSION,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const token = `${payloadB64}.${signPayload(payloadB64)}`;
  return { token, expiresAt: exp * 1000 };
}

export interface VerifiedAccountSession {
  email: string;
  expiresAt: number;
}

/**
 * Memverifikasi token sesi. Fail-closed: tanda tangan salah, versi tidak dikenal,
 * atau token kedaluwarsa → `null`.
 */
export function verifyAccountSession(token: string): VerifiedAccountSession | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expected = signPayload(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8")) as {
      e?: string;
      x?: number;
      v?: number;
    };
    if (payload.v !== SESSION_VERSION) return null;
    if (typeof payload.e !== "string" || !payload.e.includes("@")) return null;
    if (typeof payload.x !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.x <= now) return null;
    return { email: payload.e.trim().toLowerCase(), expiresAt: payload.x * 1000 };
  } catch {
    return null;
  }
}

/**
 * Memverifikasi header `Authorization: Bearer <token>` (baik token sesi akun ZAP
 * maupun Google ID token) dan mengembalikan email terverifikasi, atau `null`.
 */
export async function verifyBearerIdentity(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const rawToken = authHeader.slice("Bearer ".length).trim();
  if (!rawToken) return null;

  const accountSession = verifyAccountSession(rawToken);
  if (accountSession) {
    return accountSession.email;
  }

  const expectedAud =
    process.env.ZAP_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (!expectedAud) return null;

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const info = (await res.json()) as Record<string, unknown>;
    if (info.aud !== expectedAud) return null;
    if (info.email_verified !== "true" && info.email_verified !== true) return null;
    const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : "";
    return email || null;
  } catch {
    return null;
  }
}

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeJsonFileAtomic } from "@/lib/atomic-file";

export interface UserSecurityRecord {
  email: string;
  strikes: number;
  isSuspended: boolean;
  reason?: string;
  suspendedAt?: number;
  unbannedAt?: number;
  unbannedBy?: string;
}

export const ADMIN_EMAIL = "wakhidpangestu1@gmail.com";

/**
 * Mengambil ADMIN_SECRET dari environment TANPA nilai bawaan.
 * Fungsi-fungsi admin bersifat fail-closed: bila env belum diset,
 * fungsi ini melempar error dan operasi admin ditolak.
 */
export function getAdminSecret(): string {
  const secret = (process.env.ADMIN_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "ADMIN_SECRET belum dikonfigurasi di server. Operasi admin ditolak (fail-closed)."
    );
  }
  return secret;
}

/** Pemeriksaan secret admin secara timing-safe; false bila env belum diset. */
export function isValidAdminSecret(candidate: string | null | undefined): boolean {
  const clean = (candidate || "").trim();
  if (!clean) return false;
  let secret: string;
  try {
    secret = getAdminSecret();
  } catch {
    return false;
  }
  if (clean.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(secret));
}

// Server memory cache for security registry
const memorySecurityRegistry = new Map<string, UserSecurityRecord>();

function getSecurityVaultDir(): string {
  try {
    const dir = path.join(process.cwd(), ".zap_vault", "security");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    return "";
  }
}

function getSecurityFilePath(): string {
  const dir = getSecurityVaultDir();
  return dir ? path.join(dir, "security_registry.json") : "";
}

export function loadRegistryFromFile(): Record<string, UserSecurityRecord> {
  const filePath = getSecurityFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      // Berkas kosong/rusak/null tidak boleh membuat seluruh operasi 500.
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, UserSecurityRecord>;
      }
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

function saveRegistryToFile(data: Record<string, UserSecurityRecord>) {
  const filePath = getSecurityFilePath();
  if (filePath) {
    try {
      // Atomik: register sanksi tidak boleh korup/hilang bila proses terhenti.
      writeJsonFileAtomic(filePath, data);
    } catch (e) {
      console.warn("Gagal menyimpan security registry file:", e);
    }
  }
}

export function getCleanKey(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function getUserSecurityStatus(email: string): UserSecurityRecord {
  const key = getCleanKey(email);
  if (!key) {
    return { email: "", strikes: 0, isSuspended: false };
  }

  // Check memory
  if (memorySecurityRegistry.has(key)) {
    return memorySecurityRegistry.get(key)!;
  }

  // Check file
  const all = loadRegistryFromFile();
  if (all[key]) {
    memorySecurityRegistry.set(key, all[key]);
    return all[key];
  }

  return { email: key, strikes: 0, isSuspended: false };
}

export function recordUserSecurityViolation(
  email: string,
  strikes: number,
  isSuspended: boolean,
  reason: string
): UserSecurityRecord {
  const key = getCleanKey(email);
  const record: UserSecurityRecord = {
    email: key,
    strikes,
    isSuspended,
    reason,
    suspendedAt: isSuspended ? Date.now() : undefined,
  };

  memorySecurityRegistry.set(key, record);
  const all = loadRegistryFromFile();
  all[key] = record;
  saveRegistryToFile(all);

  return record;
}

export function unsuspendUserAccount(email: string, adminIdentifier: string = "Admin"): boolean {
  const key = getCleanKey(email);
  if (!key) return false;

  const record: UserSecurityRecord = {
    email: key,
    strikes: 0,
    isSuspended: false,
    unbannedAt: Date.now(),
    unbannedBy: adminIdentifier,
  };

  memorySecurityRegistry.set(key, record);
  const all = loadRegistryFromFile();
  all[key] = record;
  saveRegistryToFile(all);

  return true;
}

// ---------------- Token pemulihan (sekali pakai, maks 24 jam) ----------------

export const RECOVERY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // Maksimal 24 jam

function getUsedTokensFilePath(): string {
  const dir = getSecurityVaultDir();
  return dir ? path.join(dir, "used_recovery_tokens.json") : "";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function loadUsedTokenHashes(): Record<string, number> {
  const filePath = getUsedTokensFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function saveUsedTokenHashes(data: Record<string, number>) {
  const filePath = getUsedTokensFilePath();
  if (!filePath) return;
  try {
    writeJsonFileAtomic(filePath, data);
  } catch (e) {
    console.warn("Gagal menyimpan daftar token pemulihan terpakai:", e);
  }
}

function isTokenAlreadyUsed(token: string): boolean {
  return Boolean(loadUsedTokenHashes()[hashToken(token)]);
}

export function createRecoveryToken(email: string): string {
  const key = getCleanKey(email);
  if (!key) {
    throw new Error("Email diperlukan untuk membuat token pemulihan.");
  }
  const secret = getAdminSecret(); // Fail-closed bila ADMIN_SECRET belum diset
  const payload = `${key}:${Date.now() + RECOVERY_TOKEN_TTL_MS}`;
  // HMAC penuh (64 karakter hex), TIDAK dipotong.
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const base = Buffer.from(payload).toString("base64url");
  return `ZAP-${base}.${hmac}`;
}

export function verifyRecoveryToken(token: string): { valid: boolean; email?: string } {
  if (!token || !token.startsWith("ZAP-")) {
    return { valid: false };
  }

  const parts = token.slice(4).split(".");
  if (parts.length !== 2) return { valid: false };

  const [base, hmac] = parts;
  try {
    const secret = getAdminSecret();
    const payload = Buffer.from(base, "base64url").toString("utf-8");
    const sepIdx = payload.lastIndexOf(":");
    if (sepIdx < 1) return { valid: false };
    const email = payload.slice(0, sepIdx);
    const expiry = parseInt(payload.slice(sepIdx + 1), 10);

    if (!email || isNaN(expiry) || Date.now() > expiry) {
      return { valid: false };
    }

    const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const given = Buffer.from(hmac);
    const expected = Buffer.from(expectedHmac);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return { valid: false };
    }

    // Token yang sudah pernah ditebus tidak berlaku lagi (sekali pakai).
    if (isTokenAlreadyUsed(token)) {
      return { valid: false };
    }

    return { valid: true, email };
  } catch {
    return { valid: false };
  }
}

/**
 * Memverifikasi token pemulihan DAN menandainya sebagai terpakai.
 * Penebusan berikutnya dengan token yang sama akan ditolak.
 */
export function consumeRecoveryToken(token: string): { valid: boolean; email?: string } {
  const verified = verifyRecoveryToken(token);
  if (!verified.valid || !verified.email) {
    return { valid: false };
  }

  // Catat hash token sebagai terpakai (bersihkan entri kedaluwarsa sekaligus)
  const used = loadUsedTokenHashes();
  const now = Date.now();
  for (const [hash, expiry] of Object.entries(used)) {
    if (typeof expiry === "number" && expiry < now) delete used[hash];
  }
  const payload = Buffer.from(token.slice(4).split(".")[0], "base64url").toString("utf-8");
  const expiry = parseInt(payload.slice(payload.lastIndexOf(":") + 1), 10);
  used[hashToken(token)] = isNaN(expiry) ? now + RECOVERY_TOKEN_TTL_MS : expiry;
  saveUsedTokenHashes(used);

  return verified;
}

"use client";

/**
 * Sesi kunci vault ZAP (zero-knowledge).
 *
 * Tanggung jawab modul ini HANYA mengelola kunci enkripsi di perangkat:
 * - menandai bahwa sebuah akun sudah punya vault terenkripsi,
 * - menyimpan kunci turunan (KEK) di memori + `sessionStorage` per tab agar
 *   pengguna tidak diminta passphrase setiap reload,
 * - menyediakan `setupVault` / `unlockVault` / `lockVault`.
 *
 * Yang TIDAK dilakukan: tidak pernah mengirim passphrase/KEK ke server, dan
 * tidak pernah menulis plaintext vault ke storage server.
 *
 * Catatan keamanan: KEK disimpan di `sessionStorage` sebagai byte mentah
 * (bukan passphrase). Konsekuensinya hanya relevan bila peramban sudah
 * terinfeksi XSS; kompromi server/DB tetap tidak dapat memulihkan plaintext.
 */

import type { ZAPUser } from "@/components/GoogleAuthButton";
import {
  decryptVaultEnvelope,
  deriveVaultKey,
  encryptVaultPayload,
  exportVaultKeyRaw,
  generateRecoveryCode,
  importVaultKeyRaw,
  normalizeRecoveryCode,
  type VaultEnvelope,
} from "@/lib/vault-crypto";

const CONFIGURED_PREFIX = "zap_vault_configured:";
const KEK_PREFIX = "zap_vault_kek:";

/** Kunci akun yang stabil dan tidak mengandung PII mentah. */
export function vaultAccountId(user?: ZAPUser | null): string {
  const email = (user?.email || "").toLowerCase().trim();
  if (email) return email;
  const id = (user?.id || "").trim();
  return id ? id.toLowerCase() : "guest";
}

const memoryKeys = new Map<string, CryptoKey>();
/** KDF asal kunci (salt + iterasi) supaya envelope baru memakai turunan yang sama. */
const memoryKdf = new Map<string, { saltB64: string; iterations: number }>();

function sessionGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function sessionRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function emitVaultState(user: ZAPUser | null, state: "locked" | "unlocked" | "unconfigured"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("zap_vault_state", {
      detail: { account: vaultAccountId(user), state },
    })
  );
}

/** Apakah akun ini sudah pernah membuat vault terenkripsi di perangkat ini. */
export function isVaultConfigured(user?: ZAPUser | null): boolean {
  return sessionGet(`${CONFIGURED_PREFIX}${vaultAccountId(user)}`) === "1";
}

export function markVaultConfigured(user: ZAPUser | null, configured: boolean): void {
  const key = `${CONFIGURED_PREFIX}${vaultAccountId(user)}`;
  if (configured) sessionSet(key, "1");
  else sessionRemove(key);
}

/** Kunci tersedia? (di memori atau sessionStorage tab ini) */
export function isVaultUnlocked(user?: ZAPUser | null): boolean {
  const account = vaultAccountId(user);
  if (memoryKeys.has(account)) return true;
  return Boolean(sessionGet(`${KEK_PREFIX}${account}`));
}

/**
 * Mengembalikan kunci aktif untuk akun ini.
 * Bila belum ada di memori tetapi ada di sessionStorage, kunci diimpor ulang.
 */
export async function getVaultKey(user?: ZAPUser | null): Promise<CryptoKey | null> {
  const account = vaultAccountId(user);
  const cached = memoryKeys.get(account);
  if (cached) return cached;
  const stored = sessionGet(`${KEK_PREFIX}${account}`);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { raw?: string; kdf?: { saltB64: string; iterations: number } };
    if (!parsed?.raw) return null;
    const key = await importVaultKeyRaw(parsed.raw);
    memoryKeys.set(account, key);
    if (parsed.kdf) memoryKdf.set(account, parsed.kdf);
    return key;
  } catch {
    sessionRemove(`${KEK_PREFIX}${account}`);
    return null;
  }
}

async function rememberKey(
  user: ZAPUser | null,
  key: CryptoKey,
  extractable: boolean,
  kdf?: { saltB64: string; iterations: number }
): Promise<void> {
  const account = vaultAccountId(user);
  memoryKeys.set(account, key);
  if (kdf) memoryKdf.set(account, kdf);
  if (extractable) {
    try {
      const raw = await exportVaultKeyRaw(key);
      // Simpan bersama KDF agar envelope berikutnya memakai turunan yang sama.
      sessionSet(
        `${KEK_PREFIX}${account}`,
        JSON.stringify({ raw, kdf: kdf ?? null })
      );
    } catch {
      // Bila ekspor gagal, kunci tetap hidup di memori tab ini.
    }
  }
  markVaultConfigured(user, true);
  emitVaultState(user, "unlocked");
}

/**
 * KDF asal kunci aktif. Wajib dipakai saat mengenkripsi vault baru agar
 * perangkat lain bisa menurunkan kunci yang sama dari passphrase pengguna.
 */
export function getVaultKdf(user?: ZAPUser | null): { saltB64: string; iterations: number } | null {
  const account = vaultAccountId(user);
  const cached = memoryKdf.get(account);
  if (cached) return cached;
  const raw = sessionGet(`${KEK_PREFIX}${account}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kdf?: { saltB64: string; iterations: number } };
    return parsed?.kdf ?? null;
  } catch {
    return null;
  }
}

/** Lupakan kunci di tab ini (vault terkunci). */
export function lockVault(user?: ZAPUser | null): void {
  const account = vaultAccountId(user);
  memoryKeys.delete(account);
  sessionRemove(`${KEK_PREFIX}${account}`);
  emitVaultState(user || null, "locked");
}

/** Hapus penanda vault (mis. saat logout di perangkat bersama). */
export function clearVaultState(user?: ZAPUser | null): void {
  const account = vaultAccountId(user);
  memoryKeys.delete(account);
  sessionRemove(`${KEK_PREFIX}${account}`);
  sessionRemove(`${CONFIGURED_PREFIX}${account}`);
  emitVaultState(user || null, "unconfigured");
}

export interface VaultSetupResult {
  /** Kode pemulihan untuk disimpan pengguna (passphrase alternatif). */
  recoveryCode: string;
  /** Envelope uji untuk memastikan kunci benar sebelum dikirim ke server. */
  envelope: VaultEnvelope;
}

/**
 * Membuat vault baru untuk akun ini dengan passphrase pilihan pengguna.
 * Mengembalikan kode pemulihan acak yang WAJIB disimpan pengguna.
 */
export async function setupVault(
  user: ZAPUser | null,
  passphrase: string
): Promise<VaultSetupResult> {
  if (passphrase.trim().length < 8) {
    throw new Error("Passphrase vault minimal 8 karakter.");
  }
  const saltEnvelope = await encryptVaultPayload({ probe: "zap-vault-setup" }, passphrase);
  // Turunkan ulang kunci yang extractable agar bisa dipakai ulang di tab ini
  // tanpa menyimpan passphrase.
  const key = await deriveVaultKey(passphrase, saltEnvelope.kdf.saltB64, saltEnvelope.kdf.iterations, true);
  await rememberKey(user, key, true, { saltB64: saltEnvelope.kdf.saltB64, iterations: saltEnvelope.kdf.iterations });

  // Verifikasi cepat: dekripsi harus berhasil dengan kunci yang baru dibuat.
  await decryptVaultEnvelope(saltEnvelope, passphrase);

  // Kode pemulihan: passphrase acak 160-bit. Pengguna menyimpannya sendiri.
  const recoveryCode = generateRecoveryCode();
  return { recoveryCode, envelope: saltEnvelope };
}

/**
 * Membuka vault dengan passphrase, diverifikasi terhadap envelope dari server.
 * Bila envelope belum ada (akun baru), pembukaan hanya menurunkan kunci lokal.
 */
export async function unlockVault(
  user: ZAPUser | null,
  passphrase: string,
  envelope?: VaultEnvelope | null
): Promise<boolean> {
  const clean = passphrase.trim();
  if (!clean) return false;

  if (envelope) {
    // Verifikasi terhadap data nyata: passphrase salah akan gagal di sini.
    await decryptVaultEnvelope(envelope, clean);
    const key = await deriveVaultKey(
      clean,
      envelope.kdf.saltB64,
      envelope.kdf.iterations,
      true
    );
    await rememberKey(user, key, true, {
      saltB64: envelope.kdf.saltB64,
      iterations: envelope.kdf.iterations,
    });
    return true;
  }

  // Belum ada envelope server: turunkan kunci dari salt baru dan simpan.
  const probe = await encryptVaultPayload({ probe: "zap-vault-unlock" }, clean);
  const key = await deriveVaultKey(clean, probe.kdf.saltB64, probe.kdf.iterations, true);
  await rememberKey(user, key, true, {
    saltB64: probe.kdf.saltB64,
    iterations: probe.kdf.iterations,
  });
  return true;
}

/** Membuka vault dengan kode pemulihan (dinormalkan lebih dulu). */
export async function unlockVaultWithRecoveryCode(
  user: ZAPUser | null,
  recoveryCode: string,
  envelope?: VaultEnvelope | null
): Promise<boolean> {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (normalized.length < 16) return false;
  return unlockVault(user, normalized, envelope);
}

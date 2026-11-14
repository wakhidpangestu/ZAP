"use client";

/**
 * Enkripsi vault ZAP — ZERO-KNOWLEDGE.
 *
 * Prinsip:
 * - Seluruh isi vault (percakapan, proyek, **API key provider**, preferensi)
 *   dienkripsi di peramban SEBELUM dikirim ke server.
 * - Server hanya menyimpan *envelope* terenkripsi + metadata non-rahasia
 *   (`user.id`, `user.email`, `updatedAt`). Server TIDAK PERNAH menerima
 *   passphrase, kunci turunan (KEK), atau plaintext.
 * - Kunci diturunkan dengan PBKDF2-SHA256 (310.000 iterasi) dari passphrase
 *   vault pengguna, yang tidak pernah dikirim ke mana pun.
 *
 * Catatan desain:
 * - Passphrase vault SENGAJA terpisah dari kata sandi login. Kata sandi login
 *   dikirim ke server saat autentikasi, sehingga tidak bisa dipakai untuk
 *   menjamin zero-knowledge.
 * - "Kode pemulihan" adalah passphrase acak 256-bit yang dihasilkan perangkat;
 *   user menyimpannya sendiri. Sama seperti passphrase, kode ini tidak pernah
 *   dikirim ke server.
 */

/** Versi format envelope. Naikkan bila algoritma berubah. */
export const VAULT_ENVELOPE_VERSION = 1;

/** Iterasi PBKDF2. 310k mengikuti rekomendasi OWASP 2023 untuk PBKDF2-SHA256. */
export const PBKDF2_ITERATIONS = 310_000;

const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM: 96-bit nonce
const KEY_BITS = 256;

export interface VaultEnvelope {
  v: number;
  alg: "AES-GCM";
  kdf: {
    name: "PBKDF2-SHA256";
    iterations: number;
    saltB64: string;
  };
  ivB64: string;
  ctB64: string;
}

export class VaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultCryptoError";
  }
}

function getCrypto(): Crypto {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!c || !c.subtle) {
    throw new VaultCryptoError("Web Crypto tidak tersedia di lingkungan ini.");
  }
  return c;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

/**
 * Menurunkan kunci AES-256 dari passphrase + salt.
 * Kunci ini hanya hidup di memori peramban (lihat vault-session).
 */
export async function deriveVaultKey(
  passphrase: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS,
  extractable: boolean = false
): Promise<CryptoKey> {
  if (!passphrase || passphrase.length < 8) {
    throw new VaultCryptoError("Passphrase vault minimal 8 karakter.");
  }
  const subtle = getCrypto().subtle;
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(saltB64) as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/**
 * Mengekspor kunci mentah (base64) untuk cache sesi per-tab.
 * Hanya dipakai oleh vault-session setelah unlock berhasil; server tidak pernah
 * menerima nilai ini.
 */
export async function exportVaultKeyRaw(key: CryptoKey): Promise<string> {
  const raw = await getCrypto().subtle.exportKey("raw", key);
  return toBase64(new Uint8Array(raw as ArrayBuffer));
}

/** Mengimpor kunci mentah hasil `exportVaultKeyRaw`. */
export async function importVaultKeyRaw(rawB64: string): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "raw",
    fromBase64(rawB64) as unknown as BufferSource,
    { name: "AES-GCM", length: KEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Mengenkripsi objek apa pun menjadi envelope siap-kirim. */
export async function encryptVaultPayload(
  payload: unknown,
  passphrase: string
): Promise<VaultEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const saltB64 = toBase64(salt);
  const key = await deriveVaultKey(passphrase, saltB64);
  const iv = randomBytes(IV_BYTES);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    plaintext
  );
  return {
    v: VAULT_ENVELOPE_VERSION,
    alg: "AES-GCM",
    kdf: { name: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, saltB64 },
    ivB64: toBase64(iv),
    ctB64: toBase64(new Uint8Array(cipher)),
  };
}

/** Mendekripsi envelope. Melempar `VaultCryptoError` bila passphrase salah/rusak. */
export async function decryptVaultEnvelope<T = unknown>(
  envelope: VaultEnvelope,
  passphrase: string
): Promise<T> {
  if (!isVaultEnvelope(envelope)) {
    throw new VaultCryptoError("Format vault terenkripsi tidak dikenali.");
  }
  const key = await deriveVaultKey(passphrase, envelope.kdf.saltB64, envelope.kdf.iterations);
  return decryptVaultEnvelopeWithKey<T>(envelope, key);
}

/**
 * Mengenkripsi payload memakai kunci yang SUDAH diturunkan.
 *
 * `kdf` wajib berisi salt+iterasi asal kunci tersebut, supaya perangkat lain
 * dapat menurunkan kunci yang sama dari passphrase yang sama.
 */
export async function encryptVaultPayloadWithKey(
  payload: unknown,
  key: CryptoKey,
  kdf: { saltB64: string; iterations: number }
): Promise<VaultEnvelope> {
  const iv = randomBytes(IV_BYTES);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    plaintext
  );
  return {
    v: VAULT_ENVELOPE_VERSION,
    alg: "AES-GCM",
    kdf: { name: "PBKDF2-SHA256", iterations: kdf.iterations, saltB64: kdf.saltB64 },
    ivB64: toBase64(iv),
    ctB64: toBase64(new Uint8Array(cipher)),
  };
}

/** Mendekripsi envelope memakai kunci yang sudah ada (tanpa menurunkan ulang). */
export async function decryptVaultEnvelopeWithKey<T = unknown>(
  envelope: VaultEnvelope,
  key: CryptoKey
): Promise<T> {
  if (!isVaultEnvelope(envelope)) {
    throw new VaultCryptoError("Format vault terenkripsi tidak dikenali.");
  }
  try {
    const plain = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.ivB64) as unknown as BufferSource },
      key,
      fromBase64(envelope.ctB64) as unknown as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new VaultCryptoError("Passphrase salah atau data vault rusak.");
  }
}

export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<VaultEnvelope>;
  return (
    v.v === VAULT_ENVELOPE_VERSION &&
    v.alg === "AES-GCM" &&
    !!v.kdf &&
    typeof v.kdf.saltB64 === "string" &&
    typeof v.ivB64 === "string" &&
    typeof v.ctB64 === "string"
  );
}

/** Alfabet Crockford base32 (tanpa I, L, O, U agar tidak ambigu). */
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Kode pemulihan acak 160-bit (32 karakter base32, dikelompokkan 4).
 * Dipakai sebagai passphrase alternatif bila pengguna lupa passphrase vault.
 */
export function generateRecoveryCode(groups: number = 8): string {
  const bytes = randomBytes(groups * 4);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  const chunks: string[] = [];
  for (let i = 0; i < out.length; i += 4) chunks.push(out.slice(i, i + 4));
  return chunks.join("-");
}

/** Menormalkan kode pemulihan (buang spasi/strip, samakan huruf besar). */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Sidik jari envelope untuk deteksi perubahan tanpa mendekripsi. */
export function vaultFingerprint(envelope: VaultEnvelope): string {
  const raw = `${envelope.v}:${envelope.kdf.iterations}:${envelope.kdf.saltB64}:${envelope.ivB64}:${envelope.ctB64.length}:${envelope.ctB64.slice(0, 24)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

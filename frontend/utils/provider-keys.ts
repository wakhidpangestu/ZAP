"use client";

/**
 * Penyimpanan API key provider — per akun, hanya di sesi peramban.
 *
 * Kebijakan (permintaan pemilik, 14 Nov 2026):
 * - Kunci provider milik pengguna TIDAK PERNAH dikirim ke server/vault.
 *   Sebelumnya `utils/account-sync.ts` mengunggah kunci dalam bentuk plaintext
 *   ke `.zap_vault/users/<email>.json` dan mengembalikannya ke peramban mana
 *   pun yang memegang token Google akun tersebut.
 * - Kunci disimpan di `sessionStorage` dengan namespace akun, sehingga:
 *   (a) berganti akun di peramban yang sama tidak membocorkan kunci akun lain,
 *   (b) menutup tab menghapus kunci dari perangkat.
 *
 * Catatan migrasi: versi lama memakai kunci global di `localStorage`
 * (`zap_gemini_api_key`, dst.) yang dipakai bersama semua akun. Saat pertama
 * kali dipakai, nilai lama dipindahkan ke namespace akun aktif lalu kunci
 * globalnya DIHAPUS agar tidak terbaca oleh akun berikutnya.
 */

export type ProviderId =
  | "gemini"
  | "nvidia"
  | "openai"
  | "claude"
  | "bazaarlink"
  | "mistral"
  | "custom";

export type ProviderSettingId = "customBaseUrl" | "customModelName";

export interface ZAPAccountLike {
  email?: string;
  id?: string;
  isGuest?: boolean;
  name?: string;
}

/** Urutan tampil di halaman Connector. */
export const PROVIDER_IDS: ProviderId[] = [
  "nvidia",
  "gemini",
  "openai",
  "claude",
  "bazaarlink",
  "mistral",
  "custom",
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  nvidia: "NVIDIA NIM",
  gemini: "Google Gemini",
  openai: "OpenAI ChatGPT",
  claude: "Anthropic Claude",
  bazaarlink: "BazaarLink Gateway",
  mistral: "Mistral AI",
  custom: "Custom / Ollama",
};

export const PROVIDER_SETTING_IDS: ProviderSettingId[] = ["customBaseUrl", "customModelName"];

/** Nama kunci localStorage warisan (sebelum scoping per akun). */
const LEGACY_STORAGE_KEYS: Record<ProviderId | ProviderSettingId, string> = {
  gemini: "zap_gemini_api_key",
  nvidia: "zap_nvidia_api_key",
  openai: "zap_openai_api_key",
  claude: "zap_claude_api_key",
  bazaarlink: "zap_bazaarlink_api_key",
  mistral: "zap_mistral_api_key",
  custom: "zap_custom_api_key",
  customBaseUrl: "zap_custom_base_url",
  customModelName: "zap_custom_model_name",
};

const STORAGE_PREFIX = "zap_pk";

/** Scope akun: email (huruf kecil) atau id; "guest" bila tidak diketahui. */
export function providerScope(user?: ZAPAccountLike | null): string {
  const email = (user?.email || "").toLowerCase().trim();
  if (email) return email;
  const id = (user?.id || "").trim();
  if (id) return id.toLowerCase();
  return "guest";
}

function storageKey(scope: string, field: string): string {
  return `${STORAGE_PREFIX}:${scope}:${field}`;
}

function readSession(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return sessionStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Mode privat / kuota penuh: kunci tetap hidup di memori pemanggil.
  }
}

function removeSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

/**
 * Memindahkan kunci lama (global, lintas akun) ke namespace akun aktif, lalu
 * menghapus salinan globalnya. Idempoten.
 *
 * @returns daftar field yang berhasil dimigrasikan (untuk pesan UI).
 */
export function migrateLegacyProviderKeys(user?: ZAPAccountLike | null): string[] {
  if (typeof window === "undefined") return [];
  const scope = providerScope(user);
  const migrated: string[] = [];

  for (const [field, legacyKey] of Object.entries(LEGACY_STORAGE_KEYS)) {
    let legacyValue: string | null = null;
    try {
      legacyValue = localStorage.getItem(legacyKey);
    } catch {
      legacyValue = null;
    }
    if (!legacyValue) continue;

    const target = storageKey(scope, field);
    // Jangan menimpa nilai sesi yang lebih baru.
    if (!readSession(target)) {
      writeSession(target, legacyValue);
    }
    try {
      localStorage.removeItem(legacyKey);
    } catch {}
    migrated.push(field);
  }

  return migrated;
}

export function getProviderKey(id: ProviderId, user?: ZAPAccountLike | null): string | undefined {
  return readSession(storageKey(providerScope(user), id))?.trim() || undefined;
}

export function setProviderKey(
  id: ProviderId,
  value: string,
  user?: ZAPAccountLike | null
): void {
  const scope = providerScope(user);
  const trimmed = value.trim();
  if (!trimmed) {
    removeSession(storageKey(scope, id));
    return;
  }
  writeSession(storageKey(scope, id), trimmed);
  // Bersihkan sisa kunci global agar tidak terbaca akun lain.
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEYS[id]);
  } catch {}
}

export function getProviderSetting(
  id: ProviderSettingId,
  user?: ZAPAccountLike | null
): string | undefined {
  return readSession(storageKey(providerScope(user), id))?.trim() || undefined;
}

export function setProviderSetting(
  id: ProviderSettingId,
  value: string,
  user?: ZAPAccountLike | null
): void {
  const scope = providerScope(user);
  const trimmed = value.trim();
  if (!trimmed) {
    removeSession(storageKey(scope, id));
    return;
  }
  writeSession(storageKey(scope, id), trimmed);
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEYS[id]);
  } catch {}
}

/** Menghapus seluruh kunci provider milik satu akun (mis. saat logout). */
export function clearProviderKeys(user?: ZAPAccountLike | null): void {
  const scope = providerScope(user);
  for (const field of Object.keys(LEGACY_STORAGE_KEYS)) {
    removeSession(storageKey(scope, field));
  }
}

/** Daftar provider yang punya kunci pada sesi akun ini (untuk indikator UI). */
export function listConfiguredProviders(user?: ZAPAccountLike | null): ProviderId[] {
  return PROVIDER_IDS.filter((id) => Boolean(getProviderKey(id, user)));
}

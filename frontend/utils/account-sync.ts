/**
 * ZAP Account Cloud Sync & Auto-Backup
 * Menghubungkan riwayat chat, workspaces, dan preferensi non-rahasia ke Akun Google.
 *
 * KEBIJAKAN KUNCI PROVIDER (14 Nov 2026): kunci API provider TIDAK PERNAH
 * diunggah ke vault server dan TIDAK PERNAH dipulihkan dari server. Kunci hanya
 * hidup di sesi peramban per akun melalui `utils/provider-keys.ts`.
 */

import { type ZAPUser } from "@/components/GoogleAuthButton";
import { type StoredConversation, getUserStorageKey } from "@/utils/chat-memory";
import {
  getProviderKey,
  getProviderSetting,
  setProviderKey,
  setProviderSetting,
  PROVIDER_IDS,
} from "@/utils/provider-keys";
import { encryptVaultPayloadWithKey, decryptVaultEnvelopeWithKey, type VaultEnvelope } from "@/lib/vault-crypto";
import { getVaultKdf, getVaultKey, isVaultConfigured, vaultAccountId } from "@/lib/vault-session";

/**
 * ZERO-KNOWLEDGE CLOUD SYNC (arsitektur sejak 14 Nov 2026)
 *
 * Isi vault — percakapan, proyek, preferensi, **dan kunci API provider** —
 * dienkripsi di peramban (AES-GCM 256, kunci diturunkan PBKDF2-SHA256 dari
 * passphrase vault pengguna) sebelum dikirim ke `/api/user/sync`.
 *
 * Server hanya menyimpan:
 *   - `user`: metadata identitas untuk pemetaan akun/avatar (email, nama, foto)
 *   - `encrypted`: envelope { v, alg, kdf, ivB64, ctB64 } yang tidak dapat dibaca
 *   - `updatedAt`
 *
 * Passphrase vault dan kunci turunannya (KEK) TIDAK PERNAH dikirim ke server.
 * Akibatnya sinkronisasi lintas perangkat memerlukan passphrase yang sama di
 * perangkat baru (atau kode pemulihan).
 */

/**
 * Konfigurasi akun yang boleh disinkronkan lintas perangkat.
 * Field rahasia (API key / token / secret) TIDAK di sini: kunci provider ikut
 * sinkron tetapi HANYA di dalam envelope terenkripsi (`providerKeys`).
 */
export interface AccountConfigs {
  selectedModelId?: string;
  reasoningEffort?: string;
  theme?: string;
}

/** Peta kunci provider (rahasia). Hanya boleh berada di dalam payload terenkripsi. */
export type ProviderKeyMap = Record<string, string>;

/** Field konfigurasi non-rahasia yang tetap disinkronkan lintas perangkat. */
const SYNCABLE_CONFIG_FIELDS: Array<keyof AccountConfigs> = [
  "selectedModelId",
  "reasoningEffort",
  "theme",
];

/**
 * Menyaring objek configs dari sumber mana pun (lokal maupun server) sehingga
 * hanya field non-rahasia yang lolos. Pertahanan berlapis: vault lama yang
 * masih menyimpan API key tidak akan pernah menuliskannya kembali ke peramban.
 */
export function pickSyncableConfigs(raw: unknown): AccountConfigs {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const picked: AccountConfigs = {};
  for (const field of SYNCABLE_CONFIG_FIELDS) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) {
      picked[field] = value;
    }
  }
  return picked;
}

export interface UserAccountBackupPayload {
  user: ZAPUser;
  updatedAt?: number;
  configs: AccountConfigs;
  conversations: StoredConversation<unknown, unknown>[];
  workspaces?: unknown[];
  workspaceFiles?: unknown[];
  /**
   * Kunci provider (rahasia). HANYA boleh berada di dalam payload yang
   * dienkripsi; jangan pernah mengirimnya sebagai field plaintext.
   */
  providerKeys?: ProviderKeyMap;
}

const STORAGE_KEY_PRIMARY = "zap_conversations";
const STORAGE_KEY_LEGACY = "zap_conversations_v1";

/**
 * Kunci localStorage untuk Google ID token (JWT kredensial GSI).
 * Token ini WAJIB disimpan saat login oleh komponen autentikasi:
 *   saveGoogleIdToken(response.credential)
 * Endpoint /api/user/sync menolak semua permintaan tanpa token ini,
 * jadi syncAccountBackup/restoreAccountData bersifat fail-closed:
 * tanpa token, panggilan ke server TIDAK dilakukan sama sekali.
 */
export const GOOGLE_ID_TOKEN_STORAGE_KEY = "zap_google_id_token";
/** Token sesi akun email/password (HMAC, bukan kata sandi). */
export const ACCOUNT_SESSION_STORAGE_KEY = "zap_account_session_token";

export function saveGoogleIdToken(idToken: string): void {
  if (typeof window === "undefined" || !idToken) return;
  try {
    localStorage.setItem(GOOGLE_ID_TOKEN_STORAGE_KEY, idToken);
  } catch {}
}

export function getGoogleIdToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GOOGLE_ID_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearGoogleIdToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GOOGLE_ID_TOKEN_STORAGE_KEY);
  } catch {}
}

/** Menyimpan token sesi akun ZAP (diterbitkan /api/auth/credentials). */
export function saveAccountSessionToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, token);
  } catch {}
}

export function getAccountSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearAccountSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
  } catch {}
}

/**
 * Token untuk header Authorization sinkronisasi:
 * utamakan Google ID token (bila login Google), lalu token sesi akun ZAP.
 */
export function getSyncAuthToken(): string | null {
  return getGoogleIdToken() || getAccountSessionToken();
}

/**
 * Membersihkan working state sesi lokal saat pengguna keluar atau berganti akun
 */
export function clearLocalWorkingSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("zap_authenticated_user");
    localStorage.removeItem(GOOGLE_ID_TOKEN_STORAGE_KEY);
    localStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_PRIMARY);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    localStorage.removeItem("zap_active_conversation_id");
    localStorage.removeItem("zap_last_active_user_email");
  } catch {}
}

/**
 * Mengumpulkan data lokal saat ini khusus untuk akun pengguna yang bersangkutan
 */
export function collectLocalUserData(user: ZAPUser): UserAccountBackupPayload {
  if (typeof window === "undefined" || !user) {
    return {
      user,
      configs: {},
      conversations: [],
    };
  }

  const userEmail = (user.email || user.id || "").toLowerCase().trim();
  const userKey = getUserStorageKey(userEmail);
  let convs: StoredConversation<unknown, unknown>[] = [];

  try {
    const raw = localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter ketat: HANYA ambil percakapan yang eksplisit milik user ini
        convs = parsed.filter(
          (c: any) => c && c.userEmail && c.userEmail.toLowerCase().trim() === userEmail
        );
      }
    }
  } catch (e) {
    console.warn("Gagal membaca conversations lokal:", e);
  }

  // 2. Kumpulkan preferensi non-rahasia.
  const configs = pickSyncableConfigs({
    selectedModelId: localStorage.getItem("zap_selected_model_id") || undefined,
    reasoningEffort: localStorage.getItem("zap_reasoning_effort") || undefined,
    theme: localStorage.getItem("zap_theme_v2") || "light",
  });

  // 2b. Kumpulkan kunci provider dari penyimpanan sesi akun ini.
  //     Nilai ini HANYA dimasukkan ke payload yang dienkripsi (lihat
  //     syncAccountBackup); tidak pernah ditulis ke backup lokal/plaintext.
  const providerKeys: ProviderKeyMap = {};
  try {
    for (const providerId of PROVIDER_IDS) {
      const value = getProviderKey(providerId, user);
      if (value) providerKeys[providerId] = value;
    }
    const baseUrl = getProviderSetting("customBaseUrl", user);
    const modelName = getProviderSetting("customModelName", user);
    if (baseUrl) providerKeys.customBaseUrl = baseUrl;
    if (modelName) providerKeys.customModelName = modelName;
  } catch (e) {
    console.warn("Gagal membaca kunci provider untuk sinkronisasi:", e);
  }

  // 3. Workspaces & files (Filter out any legacy "default" or "Default workspace")
  let workspaces: unknown[] = [];
  let workspaceFiles: unknown[] = [];
  try {
    const wsRaw = localStorage.getItem("zap_workspaces");
    if (wsRaw) {
      const parsed = JSON.parse(wsRaw);
      if (Array.isArray(parsed)) {
        workspaces = parsed.filter((w: any) => w && w.id !== "default" && w.name !== "Default workspace");
      }
    }
    const filesRaw = localStorage.getItem("zap_workspace_files");
    if (filesRaw) {
      const parsed = JSON.parse(filesRaw);
      if (Array.isArray(parsed)) {
        workspaceFiles = parsed.filter((f: any) => f && f.workspaceId !== "default");
      }
    }
  } catch (e) {
    console.warn("Gagal membaca workspaces lokal:", e);
  }

  return {
    user,
    updatedAt: Date.now(),
    configs,
    conversations: convs,
    workspaces,
    workspaceFiles,
    providerKeys,
  };
}

export interface SyncBackupOverrides extends Partial<UserAccountBackupPayload> {
  deletedConversationId?: string;
  replaceConversations?: boolean;
}

/**
 * Mencatat ID percakapan yang dihapus ke dalam daftar penolakan lokal (Tombstone),
 * agar tidak pernah dibangkitkan kembali (anti-resurrection) saat sinkronisasi cloud.
 */
export function recordDeletedConversation(userEmailOrId: string, convId: string): void {
  if (typeof window === "undefined" || !userEmailOrId || !convId) return;
  try {
    const cleanKey = userEmailOrId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const key = `zap_deleted_convs_${cleanKey}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(convId)) {
      list.push(convId);
      localStorage.setItem(key, JSON.stringify(list.slice(-100)));
    }
  } catch {}
}

/**
 * Mengambil daftar ID percakapan yang telah dihapus untuk akun pengguna
 */
export function getDeletedConversations(userEmailOrId: string): Set<string> {
  if (typeof window === "undefined" || !userEmailOrId) return new Set();
  try {
    const cleanKey = userEmailOrId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const key = `zap_deleted_convs_${cleanKey}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/**
 * Menyimpan data backup akun ke penyimpanan lokal browser dan sinkronisasi ke server
 */
export async function syncAccountBackup(
  user: ZAPUser,
  overrides?: SyncBackupOverrides
): Promise<boolean> {
  if (typeof window === "undefined" || !user) return false;

  const userEmail = (user.email || user.id || "").toLowerCase().trim();
  const current = collectLocalUserData(user);
  const rawConvs = overrides?.conversations !== undefined ? overrides.conversations : current.conversations;

  // Berikan tag kepemilikan akun secara eksplisit pada setiap sesi percakapan
  const taggedConvs = rawConvs.map((c: any) => ({
    ...c,
    userEmail,
  }));

  const payload: UserAccountBackupPayload & {
    deletedConversationId?: string;
    replaceConversations?: boolean;
  } = {
    user,
    updatedAt: Date.now(),
    configs: {
      ...current.configs,
      ...(overrides?.configs || {}),
    },
    conversations: taggedConvs,
    workspaces: overrides?.workspaces !== undefined ? overrides.workspaces : current.workspaces,
    workspaceFiles: overrides?.workspaceFiles !== undefined ? overrides.workspaceFiles : current.workspaceFiles,
    // Kunci provider ikut payload, tetapi HANYA dikirim di dalam envelope
    // terenkripsi (lihat pemisahan `secretProviderKeys` di bawah).
    providerKeys: overrides?.providerKeys !== undefined ? overrides.providerKeys : current.providerKeys,
    deletedConversationId: overrides?.deletedConversationId,
    replaceConversations: overrides?.replaceConversations,
  };

  // Pisahkan rahasia: kunci provider HANYA boleh berada di payload terenkripsi.
  const { providerKeys: secretProviderKeys, ...publicPayload } = payload;

  // 1. Simpan salinan lokal terisolasi per akun pengguna (tanpa rahasia)
  try {
    const userStorageKey = `zap_user_backup_${userEmail}`;
    localStorage.setItem(userStorageKey, JSON.stringify(publicPayload));

    const userConvKey = getUserStorageKey(userEmail);
    const convsStr = JSON.stringify(taggedConvs);
    localStorage.setItem(userConvKey, convsStr);

    // Sinkronkan key aktif saat ini (tanpa mengotori key global)
    localStorage.setItem("zap_last_active_user_email", userEmail);
  } catch (e) {
    console.warn("Gagal menyimpan backup akun lokal:", e);
  }

  // 2. Kirim vault TERENKRIPSI ke server (zero-knowledge).
  // Fail-closed: tanpa Google ID token, panggilan sync TIDAK dilakukan.
  const idToken = getSyncAuthToken();
  if (!idToken) {
    console.warn(
      "Sinkronisasi cloud dilewati: tidak ada token sesi (Google atau akun ZAP) di perangkat ini."
    );
    return false;
  }

  // Fail-closed: bila vault terkunci, plaintext TIDAK dikirim sama sekali.
  const vaultKey = await getVaultKey(user);
  const vaultKdf = getVaultKdf(user);
  if (!vaultKey || !vaultKdf) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("zap_vault_state", {
          detail: { account: vaultAccountId(user), state: "locked" },
        })
      );
    }
    console.warn(
      "Sinkronisasi cloud ditunda: vault terkunci. Data tetap tersimpan lokal sampai kunci dibuka."
    );
    return false;
  }

  try {
    const envelope: VaultEnvelope = await encryptVaultPayloadWithKey(
      {
        ...publicPayload,
        providerKeys: secretProviderKeys,
      },
      vaultKey,
      vaultKdf
    );

    const res = await fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      // Hanya metadata identitas + envelope. Tidak ada percakapan/kunci plaintext.
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          provider: user.provider,
          tier: user.tier,
        },
        encrypted: envelope,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch (netErr) {
    console.warn("Gagal sinkronisasi cloud akun (offline mode):", netErr);
    return false;
  }
}

/**
 * Mengambil data akun dari server / backup lokal dan memulihkan sesi & konfigurasi ke browser
 */
export async function restoreAccountData<M = unknown, C = unknown, W = unknown, F = unknown>(user: ZAPUser): Promise<{
  user?: ZAPUser;
  conversations: StoredConversation<M, C>[];
  configs: AccountConfigs;
  workspaces: W[];
  workspaceFiles: F[];
  /** true bila server punya vault terenkripsi yang belum bisa dibuka di perangkat ini. */
  vaultLocked?: boolean;
}> {
  if (typeof window === "undefined" || !user) {
    return { conversations: [], configs: {}, workspaces: [], workspaceFiles: [], vaultLocked: false };
  }

  const userEmail = (user.email || user.id || "").toLowerCase().trim();
  let serverBackup: UserAccountBackupPayload | null = null;
  /** true bila server punya vault terenkripsi tetapi kuncinya belum terbuka. */
  let vaultLocked = false;
  let syncedAvatarUrl: string | undefined =
    user.avatar && !user.avatar.includes("default-user") ? user.avatar : undefined;

  // 1. Coba ambil dari cloud endpoint (wajib Google ID token; fail-closed)
  const idToken = getSyncAuthToken();
  if (!idToken) {
    console.warn(
      "Pemulihan dari cloud dilewati: tidak ada token sesi. Beralih ke cache lokal."
    );
  } else {
    try {
      const url = `/api/user/sync?email=${encodeURIComponent(user.email || "")}&userId=${encodeURIComponent(user.id || "")}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          const remote = json.data as UserAccountBackupPayload & { encrypted?: VaultEnvelope };
          if (remote.encrypted) {
            // ZERO-KNOWLEDGE: server hanya memberi ciphertext. Tanpa kunci,
            // kita TIDAK bisa (dan tidak boleh) meminta server membukanya.
            const vaultKey = await getVaultKey(user);
            if (vaultKey) {
              try {
                const decrypted = await decryptVaultEnvelopeWithKey<
                  UserAccountBackupPayload & { providerKeys?: ProviderKeyMap }
                >(remote.encrypted, vaultKey);
                serverBackup = decrypted;
                applyProviderKeysFromVault(decrypted.providerKeys, user);
              } catch (decryptErr) {
                vaultLocked = true;
                console.warn("Vault terenkripsi tidak dapat dibuka (kunci berbeda):", decryptErr);
              }
            } else {
              vaultLocked = true;
              console.warn(
                "Vault terenkripsi tersedia di server tetapi terkunci di perangkat ini. " +
                  "Buka dengan passphrase vault untuk memulihkan percakapan & kunci API."
              );
            }
          } else {
            // Vault lama (plaintext) — diadopsi lalu akan dienkripsi pada sync berikutnya.
            serverBackup = remote;
          }
        }
      }
    } catch (netErr) {
      console.warn("Tidak dapat menghubungi endpoint backup server, beralih ke cache lokal:", netErr);
    }
  }

  // 1b. Sinkronkan metadata foto profil Google dari vault server (tetap bekerja walau token 1-jam sudah kedaluwarsa)
  if (userEmail && userEmail.includes("@") && !userEmail.includes("@student.zap")) {
    try {
      const metaRes = await fetch(
        `/api/user/avatar?action=meta&email=${encodeURIComponent(userEmail)}&url=${encodeURIComponent(syncedAvatarUrl || "")}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson?.avatar && !String(metaJson.avatar).includes("default-user")) {
          syncedAvatarUrl = metaJson.avatar;
        }
        if (typeof metaJson?.dataUrl === "string" && metaJson.dataUrl.startsWith("data:image/") && metaJson.dataUrl.length < 300_000) {
          try {
            localStorage.setItem(`zap_avatar_dataurl_${userEmail}`, metaJson.dataUrl);
            window.dispatchEvent(
              new CustomEvent("zap_avatar_updated", { detail: { email: userEmail, dataUrl: metaJson.dataUrl } })
            );
          } catch {}
        }
      }
    } catch {
      // ignore offline error
    }
  }

  // 2. Jika server belum ada data atau offline, ambil HANYA dari cache akun ini
  if (!serverBackup) {
    try {
      const userStorageKey = `zap_user_backup_${userEmail}`;
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        serverBackup = JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Gagal membaca cache lokal akun:", e);
    }
  }

  // 3. Ambil percakapan lokal dari key terisolasi user ini
  const userConvKey = getUserStorageKey(userEmail);
  let localUserConvs: StoredConversation<unknown, unknown>[] = [];
  try {
    const raw = localStorage.getItem(userConvKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localUserConvs = parsed;
      }
    }
  } catch {}

  const deletedSet = getDeletedConversations(userEmail);

  // Kumpulkan HANYA percakapan milik akun ini yang BELUM dihapus
  const convMap = new Map<string, StoredConversation<unknown, unknown>>();
  if (serverBackup?.conversations && Array.isArray(serverBackup.conversations)) {
    for (const c of serverBackup.conversations) {
      if (c && c.id && !deletedSet.has(c.id)) {
        convMap.set(c.id, { ...c, userEmail });
      }
    }
  }
  if (localUserConvs && Array.isArray(localUserConvs)) {
    for (const c of localUserConvs) {
      if (
        c &&
        c.id &&
        !deletedSet.has(c.id) &&
        c.userEmail &&
        c.userEmail.toLowerCase().trim() === userEmail
      ) {
        const existing = convMap.get(c.id);
        const existingCount = Array.isArray(existing?.messages) ? existing.messages.length : 0;
        const localCount = Array.isArray(c.messages) ? c.messages.length : 0;
        if (!existing || localCount > existingCount) {
          convMap.set(c.id, { ...c, userEmail });
        } else if (localCount === existingCount && (c.updatedAt || 0) >= (existing.updatedAt || 0)) {
          convMap.set(c.id, { ...c, userEmail });
        }
      }
    }
  }

  const mergedConversations = Array.from(convMap.values()).sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );

  let cleanedWorkspaces: any[] = [];
  let cleanedFiles: any[] = [];

  // 4. Update localStorage secara bersih dan terisolasi untuk user ini
  try {
    localStorage.setItem("zap_last_active_user_email", userEmail);
    const convJson = JSON.stringify(mergedConversations);
    localStorage.setItem(userConvKey, convJson);

    // Pulihkan preferensi non-rahasia akun.
    // Kunci API provider TIDAK dipulihkan dari server: kunci hanya hidup di
    // sesi peramban per akun (utils/provider-keys.ts). Vault lama yang masih
    // memuat kunci diabaikan sepenuhnya.
    const mergedConfigs = pickSyncableConfigs(serverBackup?.configs);
    if (mergedConfigs.selectedModelId) localStorage.setItem("zap_selected_model_id", mergedConfigs.selectedModelId);
    if (!localStorage.getItem("zap_theme_v2")) {
      localStorage.setItem("zap_theme_v2", "light");
      if (typeof window !== "undefined") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.style.colorScheme = "light";
        window.dispatchEvent(
          new CustomEvent("zap_theme_change", {
            detail: { theme: "light", resolved: "light" },
          })
        );
      }
    }

    // Pulihkan workspaces & workspace files jika tersedia (abaikan "default" atau "Default workspace")
    if (serverBackup?.workspaces && Array.isArray(serverBackup.workspaces)) {
      cleanedWorkspaces = (serverBackup.workspaces as any[]).filter(
        (w: any) => w && w.id !== "default" && w.name !== "Default workspace"
      );
      localStorage.setItem("zap_workspaces", JSON.stringify(cleanedWorkspaces));
    }
    if (serverBackup?.workspaceFiles && Array.isArray(serverBackup.workspaceFiles)) {
      cleanedFiles = (serverBackup.workspaceFiles as any[]).filter(
        (f: any) => f && f.workspaceId !== "default"
      );
      localStorage.setItem("zap_workspace_files", JSON.stringify(cleanedFiles));
    }
  } catch (storageErr) {
    console.warn("Gagal memulihkan data ke localStorage:", storageErr);
  }

  const backupAvatar = serverBackup?.user?.avatar;
  const finalAvatar =
    syncedAvatarUrl ||
    (backupAvatar && !backupAvatar.includes("default-user") ? backupAvatar : undefined);

  const syncedUser: ZAPUser = {
    ...user,
    name: user.name || serverBackup?.user?.name || "Pengguna ChatZAP",
    avatar: finalAvatar,
  };

  try {
    localStorage.setItem("zap_authenticated_user", JSON.stringify(syncedUser));
  } catch {}

  return {
    user: syncedUser,
    conversations: mergedConversations as unknown as StoredConversation<M, C>[],
    configs: pickSyncableConfigs(serverBackup?.configs),
    workspaces: cleanedWorkspaces as unknown as W[],
    workspaceFiles: cleanedFiles as unknown as F[],
    vaultLocked,
  };
}

/**
 * Mengambil envelope vault terenkripsi dari server (tanpa mendekripsi).
 * Dipakai UI untuk memverifikasi passphrase saat membuka kunci.
 */
export async function fetchRemoteVaultEnvelope(user: ZAPUser): Promise<VaultEnvelope | null> {
  if (typeof window === "undefined" || !user) return null;
  const idToken = getSyncAuthToken();
  if (!idToken) return null;
  try {
    const url = `/api/user/sync?email=${encodeURIComponent(user.email || "")}&userId=${encodeURIComponent(user.id || "")}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const envelope = json?.data?.encrypted;
    return envelope && typeof envelope === "object" ? (envelope as VaultEnvelope) : null;
  } catch {
    return null;
  }
}

/**
 * Menuliskan kunci provider hasil dekripsi vault ke penyimpanan sesi akun ini.
 * Ini yang membuat kunci "ikut pindah" ke perangkat lain tanpa server pernah
 * melihat plaintext-nya.
 */
function applyProviderKeysFromVault(keys: ProviderKeyMap | undefined, user: ZAPUser): void {
  if (!keys || typeof keys !== "object") return;
  try {
    for (const providerId of PROVIDER_IDS) {
      const value = keys[providerId];
      if (typeof value === "string" && value.trim()) {
        setProviderKey(providerId, value, user);
      }
    }
    if (typeof keys.customBaseUrl === "string" && keys.customBaseUrl.trim()) {
      setProviderSetting("customBaseUrl", keys.customBaseUrl, user);
    }
    if (typeof keys.customModelName === "string" && keys.customModelName.trim()) {
      setProviderSetting("customModelName", keys.customModelName, user);
    }
  } catch (e) {
    console.warn("Gagal menerapkan kunci provider dari vault:", e);
  }
}

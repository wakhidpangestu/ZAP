/**
 * Memory chat ZAP (sisi klien).
 *
 * Menyimpan riwayat percakapan di localStorage agar sesi tidak hilang
 * saat halaman dimuat ulang, dan menyediakan jendela konteks (windowing)
 * untuk riwayat yang dikirim ke model agar tetap ringkas.
 *
 * Data yang disimpan di sini adalah salinan kerja di perangkat pengguna.
 * Penyimpanan otoritatif yang terenkripsi ada di backend platform
 * (lihat docs/BACKEND_SYSTEM.md).
 */

export interface StoredConversation<M, C> {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: M[];
  activeProblemFirstStep: string | null;
  activeProblemContext: C | null;
  targetVar: string;
  userEmail?: string;
  userId?: string;
  archived?: boolean;
}

const STORAGE_KEY = "zap_conversations_v1";
const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export function getUserStorageKey(userEmailOrId?: string | null): string {
  if (!userEmailOrId) return "zap_conversations_guest";
  const clean = userEmailOrId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
  return `zap_conversations_${clean}`;
}

interface MessageLike {
  sender: "user" | "assistant";
  rawText?: string;
  steps?: string[];
  replyText?: string;
}

export function deriveTitle<M extends MessageLike>(messages: M[]): string {
  const firstUser = messages.find((m) => m.sender === "user");
  if (!firstUser) return "Percakapan baru";
  const raw =
    firstUser.rawText ||
    (firstUser.steps ? firstUser.steps.join("  ") : "") ||
    "Percakapan";
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean;
}

export function loadConversations<M, C>(userEmailOrId?: string | null): StoredConversation<M, C>[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getUserStorageKey(userEmailOrId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const cleanUser = (userEmailOrId || "guest").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const delRaw = window.localStorage.getItem(`zap_deleted_convs_${cleanUser}`);
    let deletedSet = new Set<string>();
    if (delRaw) {
      try {
        const arr = JSON.parse(delRaw);
        if (Array.isArray(arr)) deletedSet = new Set<string>(arr);
      } catch {}
    }

    const targetEmail = userEmailOrId?.toLowerCase().trim();
    if (!targetEmail) {
      // Guest: hanya item yang tidak memiliki userEmail spesifik
      return parsed.filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          !deletedSet.has(c.id) &&
          Array.isArray(c.messages) &&
          !c.userEmail
      ) as StoredConversation<M, C>[];
    }

    // Filter ketat: HANYA percakapan yang eksplisit memiliki userEmail sama persis dan belum dihapus
    return parsed.filter((c) => {
      if (!c || typeof c.id !== "string" || !Array.isArray(c.messages)) return false;
      if (deletedSet.has(c.id)) return false;
      return c.userEmail && c.userEmail.toLowerCase().trim() === targetEmail;
    }) as StoredConversation<M, C>[];
  } catch {
    return [];
  }
}

export function saveConversations<M, C>(
  list: StoredConversation<M, C>[],
  userEmailOrId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const targetEmail = userEmailOrId ? userEmailOrId.toLowerCase().trim() : undefined;
    const trimmed = [...list]
      .filter((c) => {
        if (!targetEmail) return !c.userEmail;
        return !c.userEmail || c.userEmail.toLowerCase().trim() === targetEmail;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS)
      .map((c) => ({
        ...c,
        messages: c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
        userEmail: targetEmail || c.userEmail,
      }));

    const key = getUserStorageKey(userEmailOrId);
    const jsonStr = JSON.stringify(trimmed);
    window.localStorage.setItem(key, jsonStr);

    if (targetEmail) {
      window.localStorage.setItem("zap_last_active_user_email", targetEmail);
    }
  } catch {
    // Kuota penuh atau mode privat: memory sesi tetap berjalan di state.
  }
}

export function clearUserConversations(userEmailOrId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = getUserStorageKey(userEmailOrId);
    window.localStorage.removeItem(key);
    window.localStorage.removeItem("zap_conversations");
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function upsertConversation<M, C>(
  list: StoredConversation<M, C>[],
  entry: StoredConversation<M, C>
): StoredConversation<M, C>[] {
  const next = list.filter((c) => c.id !== entry.id);
  next.push(entry);
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeConversation<M, C>(
  list: StoredConversation<M, C>[],
  id: string
): StoredConversation<M, C>[] {
  return list.filter((c) => c.id !== id);
}

/**
 * Jendela konteks: ambil N pesan terakhir dan ubah ke format riwayat
 * {role, content} untuk dikirim ke model.
 */
export function windowHistory<M extends MessageLike>(
  messages: M[],
  maxMessages = 20
): { role: "user" | "assistant"; content: string }[] {
  return messages.slice(-maxMessages).map((m) => ({
    role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
    content:
      m.rawText ||
      (m.steps ? m.steps.join("\n") : "") ||
      m.replyText ||
      "",
  }));
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} mnt`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari`;
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

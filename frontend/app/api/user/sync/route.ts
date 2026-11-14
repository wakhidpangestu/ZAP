import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { rateLimitByIp } from "@/utils/rate-limit";
import { writeJsonFileAtomic } from "@/lib/atomic-file";
import { verifyAccountSession } from "@/lib/account-session";

// Batas ukuran body sinkronisasi (backup terbesar di disk saat ini ~3 MB).
// Tanpa batas, satu klien dapat menulis berkas vault berukuran sembarang dan
// menghabiskan disk.
const MAX_SYNC_BODY_BYTES = 8 * 1024 * 1024;
// Batas per IP: mencegah fan-out panggilan verifikasi token Google (tokeninfo)
// dan penulisan berkas berulang oleh klien anonim.
const SYNC_LIMIT_PER_MINUTE = 120;

function rateLimitResponse(req: Request): NextResponse | null {
  const limit = rateLimitByIp(req, "user-sync", SYNC_LIMIT_PER_MINUTE);
  if (limit.allowed) return null;
  return NextResponse.json(
    { error: "Terlalu banyak permintaan sinkronisasi. Silakan coba lagi nanti." },
    { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
  );
}

interface SyncUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  jenjang?: string;
  provider?: string;
  tier?: string;
  isGuest?: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[];
  activeProblemFirstStep?: string | null;
  activeProblemContext?: unknown;
  targetVar?: string;
}

interface VaultData {
  user?: SyncUser;
  configs?: Record<string, string>;
  conversations?: ConversationItem[];
  workspaces?: unknown[];
  workspaceFiles?: unknown[];
  updatedAt?: number;
  /** Vault terenkripsi sisi klien (zero-knowledge). Bila ada, field plaintext diabaikan. */
  encrypted?: EncryptedVaultEnvelope;
}

interface SyncRequestBody {
  user: SyncUser;
  configs?: Record<string, string>;
  conversations?: ConversationItem[];
  workspaces?: unknown[];
  workspaceFiles?: unknown[];
  deletedConversationId?: string;
  replaceConversations?: boolean;
  /** Payload terenkripsi dari klien (zero-knowledge). */
  encrypted?: unknown;
}

// ---------------- Sanitasi configs: kunci provider tidak boleh masuk vault ----------------
// Kunci API/secret hanya boleh hidup di sesi peramban pengguna
// (utils/provider-keys.ts). Sanitasi diterapkan saat MENULIS dan saat MEMBACA,
// sehingga file vault lama yang masih memuat kunci tidak lagi bocor lewat GET
// dan kunci tersebut tidak ditulis ulang saat ada update berikutnya.
const SECRET_CONFIG_PATTERN = /(api[_-]?key|access[_-]?key|secret|token|password|credential|private[_-]?key)/i;

function isSecretConfigKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!normalized) return true;
  if (SECRET_CONFIG_PATTERN.test(key)) return true;
  return (
    normalized.endsWith("key") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token") ||
    normalized.endsWith("password") ||
    normalized.endsWith("credentials")
  );
}

/** Mengembalikan configs tanpa field rahasia + jumlah field yang dibuang. */
function sanitizeConfigs(input: unknown): { configs: Record<string, string>; stripped: number } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { configs: {}, stripped: 0 };
  }
  const configs: Record<string, string> = {};
  let stripped = 0;
  for (const [key, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (isSecretConfigKey(key)) {
      stripped++;
      continue;
    }
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    configs[key] = typeof rawValue === "string" ? rawValue : String(rawValue);
  }
  return { configs, stripped };
}

/**
 * Envelope vault terenkripsi (ZERO-KNOWLEDGE).
 *
 * Server hanya menyimpan dan mengembalikan byte ini apa adanya. Tidak ada jalur
 * kode di server yang mendekripsi, membaca, atau memvalidasi isi `ctB64`.
 */
interface EncryptedVaultEnvelope {
  v: number;
  alg: "AES-GCM";
  kdf: { name: "PBKDF2-SHA256"; iterations: number; saltB64: string };
  ivB64: string;
  ctB64: string;
}

const MAX_ENVELOPE_CT_CHARS = 12 * 1024 * 1024; // ~12 MB base64 (≈9 MB plaintext)

/**
 * Validasi bentuk envelope tanpa mendekripsi. Membatasi ukuran agar tidak bisa
 * dipakai untuk mengisi disk/memori server.
 */
function sanitizeEnvelope(input: unknown): EncryptedVaultEnvelope | null {
  if (!input || typeof input !== "object") return null;
  const env = input as Partial<EncryptedVaultEnvelope>;
  const kdf = env.kdf as Partial<EncryptedVaultEnvelope["kdf"]> | undefined;
  if (
    env.v !== 1 ||
    env.alg !== "AES-GCM" ||
    !kdf ||
    kdf.name !== "PBKDF2-SHA256" ||
    typeof kdf.iterations !== "number" ||
    kdf.iterations < 100_000 ||
    kdf.iterations > 2_000_000 ||
    typeof kdf.saltB64 !== "string" ||
    typeof env.ivB64 !== "string" ||
    typeof env.ctB64 !== "string"
  ) {
    return null;
  }
  if (env.ctB64.length > MAX_ENVELOPE_CT_CHARS || env.ivB64.length > 64 || kdf.saltB64.length > 128) {
    return null;
  }
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: { name: "PBKDF2-SHA256", iterations: Math.round(kdf.iterations), saltB64: kdf.saltB64 },
    ivB64: env.ivB64,
    ctB64: env.ctB64,
  };
}

/** Salinan VaultData dengan configs tersanitasi (objek cache tidak dimutasi). */
function sanitizeVaultData(data: VaultData): VaultData {
  const safe: VaultData = { ...data, configs: sanitizeConfigs(data.configs).configs };
  // Bila vault sudah terenkripsi, JANGAN pernah mengembalikan sisa plaintext
  // (file lama mungkin masih menyimpan conversations/configs).
  if (safe.encrypted) {
    safe.conversations = [];
    safe.configs = {};
    safe.workspaces = [];
    safe.workspaceFiles = [];
  }
  return safe;
}

// ---------------- Autentikasi wajib ----------------
// Semua method route ini WAJIB membawa header:
//   Authorization: Bearer <Google ID token | token sesi akun ZAP>
//
// Google ID token diverifikasi ke Google (tokeninfo): aud harus cocok, email
// terverifikasi, dan email token harus sama dengan email yang disinkronkan.
// Token sesi akun ZAP (HMAC-SHA256, diterbitkan `/api/auth/credentials`) dipakai
// oleh akun email/password agar juga bisa memakai sinkronisasi terenkripsi.
// Tidak ada jalur tanpa auth (fail-closed).

type AuthResult = { email: string; picture?: string; name?: string } | { errorResponse: NextResponse };

async function requireIdentity(req: Request): Promise<AuthResult> {
  const unauthorized = (message: string, status: number = 401) => ({
    errorResponse: NextResponse.json({ error: message }, { status }),
  });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized("Autentikasi diperlukan. Sertakan token pada header Authorization.");
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    return unauthorized("Autentikasi diperlukan. Sertakan token pada header Authorization.");
  }

  // 1) Token sesi akun ZAP (HMAC lokal, tanpa panggilan jaringan).
  const accountSession = verifyAccountSession(idToken);
  if (accountSession) {
    return { email: accountSession.email };
  }

  // 2) Fallback: Google ID token (perilaku lama).
  const expectedAud =
    process.env.ZAP_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (!expectedAud) {
    return unauthorized(
      "Server belum dikonfigurasi untuk verifikasi Google (ZAP_GOOGLE_CLIENT_ID kosong).",
      500
    );
  }

  let info: Record<string, unknown>;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) {
      return unauthorized("Token Google tidak valid atau sudah kedaluwarsa.");
    }
    info = (await res.json()) as Record<string, unknown>;
  } catch {
    return unauthorized("Gagal memverifikasi token Google. Silakan coba lagi.");
  }

  if (info.aud !== expectedAud) {
    return unauthorized("Token Google tidak diterbitkan untuk aplikasi ini.");
  }
  if (info.email_verified !== "true" && info.email_verified !== true) {
    return unauthorized("Email Google belum terverifikasi.");
  }
  const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : "";
  if (!email) {
    return unauthorized("Token Google tidak memuat email.");
  }

  const picture =
    typeof info.picture === "string" && !info.picture.includes("default-user")
      ? info.picture.trim()
      : undefined;
  const name = typeof info.name === "string" ? info.name.trim() : undefined;

  return { email, picture, name };
}

function assertEmailMatches(identityEmail: string, targetEmail: string): NextResponse | null {
  if (targetEmail && targetEmail.trim().toLowerCase() !== identityEmail) {
    return NextResponse.json(
      { error: "Email yang disinkronkan tidak cocok dengan identitas token." },
      { status: 403 }
    );
  }
  return null;
}

// Serverless-safe fallback in-memory store for environments with read-only filesystems (Vercel, Cloudflare, Lambda)
const memoryVault = new Map<string, VaultData>();

function getVaultDir(): string {
  try {
    const dir = path.join(process.cwd(), ".zap_vault", "users");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    return "";
  }
}

function getVaultSafeKey(email: string, userId: string): string {
  const rawKey = (email || userId || "anonymous").trim().toLowerCase();
  return rawKey
    .replace(/[\0/\\]/g, "")
    .replace(/\.+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
}

function getVaultFilePath(email: string, userId: string): string {
  const safeKey = getVaultSafeKey(email, userId);
  if (!safeKey) return "";
  const dir = getVaultDir();
  if (!dir) return "";
  const targetPath = path.resolve(dir, `${safeKey}.json`);
  const resolvedDir = path.resolve(dir);
  if (!targetPath.startsWith(resolvedDir + path.sep)) {
    return "";
  }
  return targetPath;
}

// GET: Ambil backup data pengguna (identitas diambil dari Google ID token)
export async function GET(req: Request) {
  try {
    const limited = rateLimitResponse(req);
    if (limited) return limited;

    const auth = await requireIdentity(req);
    if ("errorResponse" in auth) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || "";
    const mismatch = assertEmailMatches(auth.email, email);
    if (mismatch) return mismatch;

    // Identitas otoritatif = email dari token terverifikasi, bukan parameter.
    const identityEmail = auth.email;
    const safeKey = getVaultSafeKey(identityEmail, "");
    const filePath = getVaultFilePath(identityEmail, "");
    let data: VaultData | null = memoryVault.get(safeKey) || null;

    if (!data && filePath && fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        data = JSON.parse(raw);
        if (data) memoryVault.set(safeKey, data);
      } catch (err) {
        console.warn("Gagal membaca file vault:", err);
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          exists: false,
          message: "Belum ada backup untuk akun ini",
          data: auth.picture
            ? { user: { id: "", email: identityEmail, name: auth.name, avatar: auth.picture } }
            : undefined,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (auth.picture && data.user) {
      data.user.avatar = auth.picture;
    }

    // Jangan pernah mengembalikan kunci provider yang mungkin masih tersimpan
    // di vault lama; sekaligus bersihkan cache memori agar GET berikutnya aman.
    const sanitizedData = sanitizeVaultData(data);
    memoryVault.set(safeKey, sanitizedData);

    return NextResponse.json(
      {
        exists: true,
        data: sanitizedData,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.warn("Gagal membaca backup pengguna:", err);
    return NextResponse.json({ error: "Gagal memproses permintaan backup" }, { status: 500 });
  }
}

// POST: Simpan atau merge backup data pengguna (wajib Google ID token)
export async function POST(req: Request) {
  try {
    const limited = rateLimitResponse(req);
    if (limited) return limited;

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SYNC_BODY_BYTES) {
      return NextResponse.json(
        { error: "Ukuran data backup melebihi batas server." },
        { status: 413 }
      );
    }

    const auth = await requireIdentity(req);
    if ("errorResponse" in auth) return auth.errorResponse;

    let body: SyncRequestBody;
    try {
      body = (await req.json()) as SyncRequestBody;
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const {
      user,
      configs,
      conversations,
      workspaces,
      workspaceFiles,
      deletedConversationId,
      replaceConversations,
    } = body;

    if (!user || (!user.email && !user.id)) {
      return NextResponse.json({ error: "Data pengguna tidak valid" }, { status: 400 });
    }

    // Email pada body harus sama dengan email token terverifikasi.
    const mismatch = assertEmailMatches(auth.email, user.email || "");
    if (mismatch) return mismatch;
    user.email = auth.email;

    const safeKey = getVaultSafeKey(user.email, user.id);
    const filePath = getVaultFilePath(user.email, user.id);
    let existingData: VaultData = memoryVault.get(safeKey) || {};

    if ((!existingData || Object.keys(existingData).length === 0) && filePath && fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        existingData = JSON.parse(raw);
      } catch (parseErr) {
        console.warn("Gagal membaca data existing, akan ditimpa:", parseErr);
      }
    }

    // ---- Jalur ZERO-KNOWLEDGE -------------------------------------------------
    // Klien mengirim vault yang sudah dienkripsi (AES-GCM) dengan kunci yang
    // tidak pernah sampai ke server. Server hanya menyimpan envelope + metadata
    // identitas non-rahasia. Tidak ada plaintext percakapan/kunci di jalur ini.
    if (body.encrypted !== undefined) {
      const envelope = sanitizeEnvelope(body.encrypted);
      if (!envelope) {
        return NextResponse.json(
          { error: "Envelope vault terenkripsi tidak valid." },
          { status: 400 }
        );
      }
      const cleanIncomingAvatar = typeof user.avatar === "string" && !user.avatar.includes("default-user")
        ? user.avatar
        : undefined;
      const cleanExistingAvatar =
        existingData.user?.avatar && !existingData.user.avatar.includes("default-user")
          ? existingData.user.avatar
          : undefined;
      const encryptedPayload: VaultData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || auth.name || existingData.user?.name || "Pengguna ChatZAP",
          avatar: auth.picture || cleanIncomingAvatar || cleanExistingAvatar,
          provider: user.provider || "google",
          tier: user.tier || "standard",
        },
        encrypted: envelope,
        updatedAt: Date.now(),
      };
      memoryVault.set(safeKey, encryptedPayload);
      if (filePath) {
        try {
          writeJsonFileAtomic(filePath, encryptedPayload);
        } catch (fsErr) {
          console.warn("Serverless environment: disk write skipped (encrypted vault):", fsErr);
        }
      }
      return NextResponse.json({
        success: true,
        encrypted: true,
        message: "Vault terenkripsi tersimpan (server tidak dapat membacanya).",
        updatedAt: encryptedPayload.updatedAt,
      });
    }

    // Bersihkan sesi percakapan yang dihapus jika ada
    let existingConvs: ConversationItem[] = Array.isArray(existingData.conversations)
      ? existingData.conversations
      : [];
    if (deletedConversationId) {
      existingConvs = existingConvs.filter((c) => c.id !== deletedConversationId);
    }

    const incomingConvs: ConversationItem[] = Array.isArray(conversations)
      ? conversations.filter((c) => c.id !== deletedConversationId)
      : [];

    let mergedConversations: ConversationItem[];

    if (replaceConversations || deletedConversationId) {
      // Jika instruksi replaceConversations atau setelah delete:
      // Gunakan incomingConvs secara persis tanpa membangkitkan kembali obrolan yang dihapus
      mergedConversations = incomingConvs
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 50);
    } else {
      const convMap = new Map<string, ConversationItem>();
      for (const c of existingConvs) {
        if (c && c.id) convMap.set(c.id, c);
      }
      for (const c of incomingConvs) {
        if (c && c.id) {
          const prev = convMap.get(c.id);
          // Selalu pertahankan percakapan dengan jumlah pesan terbanyak untuk mencegah race condition
          const prevCount = Array.isArray(prev?.messages) ? prev.messages.length : 0;
          const incomingCount = Array.isArray(c.messages) ? c.messages.length : 0;
          if (!prev) {
            convMap.set(c.id, c);
          } else if (incomingCount > prevCount) {
            convMap.set(c.id, c);
          } else if (incomingCount === prevCount && (c.updatedAt || 0) >= (prev.updatedAt || 0)) {
            convMap.set(c.id, c);
          }
        }
      }
      mergedConversations = Array.from(convMap.values())
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 50);
    }

    // Merge configs (preferensi non-rahasia saja)
    // Kunci provider yang mungkin masih ada di vault lama dibuang di sini
    // (defense in depth) dan tidak pernah ditulis ulang ke disk.
    const existingSanitized = sanitizeConfigs(existingData.configs);
    const mergedConfigs: Record<string, string> = { ...existingSanitized.configs };
    let rejectedConfigKeys = existingSanitized.stripped;

    if (configs && typeof configs === "object") {
      const incomingSanitized = sanitizeConfigs(configs);
      rejectedConfigKeys += incomingSanitized.stripped;
      for (const [k, v] of Object.entries(incomingSanitized.configs)) {
        mergedConfigs[k] = v;
      }
    }

    // Merge workspaces & workspace files (Tanpa workspace bawaan "default")
    const mergedWorkspaces = (
      workspaces && Array.isArray(workspaces)
        ? workspaces
        : existingData.workspaces || []
    ).filter((w: unknown) => {
      const item = w as Record<string, unknown> | null;
      return item && item.id !== "default" && item.name !== "Default workspace";
    });

    const mergedFiles = (
      workspaceFiles && Array.isArray(workspaceFiles)
        ? workspaceFiles
        : existingData.workspaceFiles || []
    ).filter((f: unknown) => {
      const file = f as Record<string, unknown> | null;
      return file && file.workspaceId !== "default";
    });

    const isGuest = user.isGuest === true || (user.provider === "zap" && (user.email?.includes("@student.zap") || user.name?.toLowerCase().includes("tamu")));

    const cleanIncomingAvatar =
      user.avatar && !user.avatar.includes("default-user") ? user.avatar : undefined;
    const cleanExistingAvatar =
      existingData.user?.avatar && !existingData.user.avatar.includes("default-user")
        ? existingData.user.avatar
        : undefined;

    const payloadToSave: VaultData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || auth.name || existingData.user?.name || "Pengguna ChatZAP",
        avatar: auth.picture || cleanIncomingAvatar || cleanExistingAvatar,
        role: isGuest ? (user.role || existingData.user?.role || "Tamu") : undefined,
        jenjang: isGuest ? (user.jenjang || existingData.user?.jenjang || "Tamu") : undefined,
        provider: user.provider || "google",
        tier: user.tier || "standard",
      },
      configs: mergedConfigs,
      conversations: mergedConversations,
      workspaces: mergedWorkspaces,
      workspaceFiles: mergedFiles,
      updatedAt: Date.now(),
    };

    memoryVault.set(safeKey, payloadToSave);

    if (filePath) {
      try {
        // Atomik (tmp + rename): kegagalan di tengah penulisan tidak boleh
        // meninggalkan JSON terpotong yang membuat seluruh vault tak terbaca.
        writeJsonFileAtomic(filePath, payloadToSave);
      } catch (fsErr) {
        console.warn("Serverless environment: disk write skipped, saved to memory vault:", fsErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Data akun berhasil dicadangkan secara otomatis",
      updatedAt: payloadToSave.updatedAt,
      stats: {
        conversations: mergedConversations.length,
        // Selalu false: kunci provider tidak pernah disimpan di vault.
        hasNvidiaKey: false,
        hasGeminiKey: false,
        rejectedConfigKeys,
      },
    });
  } catch (err) {
    console.error("Gagal menyimpan backup akun:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pencadangan akun ke server" },
      { status: 500 }
    );
  }
}

// DELETE: Hapus percakapan tertentu secara permanen dari cloud vault (wajib token)
export async function DELETE(req: Request) {
  try {
    const limited = rateLimitResponse(req);
    if (limited) return limited;

    const auth = await requireIdentity(req);
    if ("errorResponse" in auth) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || "";
    const convId = searchParams.get("convId") || "";

    if (!convId) {
      return NextResponse.json(
        { error: "convId diperlukan untuk penghapusan" },
        { status: 400 }
      );
    }

    const mismatch = assertEmailMatches(auth.email, email);
    if (mismatch) return mismatch;

    const identityEmail = auth.email;
    const safeKey = getVaultSafeKey(identityEmail, "");
    const memData = memoryVault.get(safeKey);
    if (memData && Array.isArray(memData.conversations)) {
      memData.conversations = memData.conversations.filter((c) => c.id !== convId);
      memData.updatedAt = Date.now();
      memoryVault.set(safeKey, memData);
    }

    const filePath = getVaultFilePath(identityEmail, "");
    if (filePath && fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data: VaultData = JSON.parse(raw);
        if (Array.isArray(data.conversations)) {
          data.conversations = data.conversations.filter((c) => c.id !== convId);
          data.updatedAt = Date.now();
          // Jangan menulis ulang kunci provider lama ke disk.
          writeJsonFileAtomic(filePath, sanitizeVaultData(data));
        }
      } catch (fileErr) {
        console.warn("Gagal memperbarui file vault saat delete:", fileErr);
      }
    }

    // Bersihkan juga jika percakapan ini pernah dibagikan publik.
    // KEAMANAN: hanya tautan milik pemanggil yang boleh dihapus. Sebelumnya
    // pencocokan hanya memakai conversationId — yang ikut terekspos pada
    // respons publik /api/chat/share — sehingga pengguna terautentikasi mana
    // pun dapat menghapus tautan publik pengguna lain. Tautan lama tanpa
    // authorEmail sengaja dilewati (tidak dapat dibuktikan kepemilikannya).
    try {
      const sharesDir = path.join(process.cwd(), ".zap_vault", "shares");
      if (fs.existsSync(sharesDir)) {
        const shareFiles = fs.readdirSync(sharesDir);
        for (const sf of shareFiles) {
          if (!sf.endsWith(".json")) continue;
          try {
            const sPath = path.join(sharesDir, sf);
            const sRaw = fs.readFileSync(sPath, "utf-8");
            const sData = JSON.parse(sRaw);
            const ownerEmail =
              typeof sData?.authorEmail === "string"
                ? sData.authorEmail.trim().toLowerCase()
                : "";
            if (sData?.conversationId === convId && ownerEmail && ownerEmail === identityEmail) {
              fs.unlinkSync(sPath);
            }
          } catch {}
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Percakapan ${convId} berhasil dihapus permanen`,
    });
  } catch (err) {
    console.error("Gagal menghapus percakapan dari vault:", err);
    return NextResponse.json(
      { error: "Gagal memproses penghapusan percakapan dari server" },
      { status: 500 }
    );
  }
}

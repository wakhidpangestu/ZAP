import { NextResponse } from "next/server";
import fs from "fs";
import crypto from "crypto";
import { writeJsonFileAtomic } from "@/lib/atomic-file";
import { getCandidateVaultFilePaths, getWritableVaultFilePath } from "@/lib/vault-dir";
import { rateLimitByIp } from "@/utils/rate-limit";
import { verifyBearerIdentity } from "@/lib/account-session";
import { kvGet, kvSet } from "@/lib/kv-store";

interface ShareMessage {
  id: string;
  sender: "user" | "assistant";
  steps?: string[];
  rawText?: string;
  diagnosis?: unknown;
  replyText?: string;
  modelName?: string;
  timestamp: string;
  smartboardItem?: unknown;
  feedback?: "up" | "down" | null;
  attachedFiles?: unknown[];
}

interface SharedConversationPayload {
  shareId: string;
  conversationId?: string;
  title: string;
  authorName?: string;
  authorEmail?: string;
  ownerSecretHash?: string;
  isPublic: boolean;
  sharedAt: number;
  updatedAt: number;
  messages: ShareMessage[];
  targetVar?: string;
  active3DModel?: string;
}

interface ShareRequestBody {
  conversationId?: string;
  title?: unknown;
  messages?: unknown;
  authorName?: unknown;
  authorEmail?: unknown;
  ownerSecret?: unknown;
  includeAuthor?: boolean;
  isPublic?: boolean;
  targetVar?: string;
  active3DModel?: string;
  shareId?: unknown;
}

function hashOwnerSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

// Fallback penyimpanan memori & /tmp agar tetap berfungsi di lingkungan read-only
// (Vercel serverless, container dengan permission volume terbatas).
const memoryShares = new Map<string, SharedConversationPayload>();
const MAX_MEMORY_SHARES = 1000;

function rememberShare(shareId: string, payload: SharedConversationPayload): void {
  if (memoryShares.size >= MAX_MEMORY_SHARES && !memoryShares.has(shareId)) {
    const oldestKey = memoryShares.keys().next().value;
    if (oldestKey) memoryShares.delete(oldestKey);
  }
  memoryShares.set(shareId, payload);
}

function getCandidateSharePaths(cleanId: string): string[] {
  if (!cleanId) return [];
  return getCandidateVaultFilePaths(["shares"], `${cleanId}.json`);
}

// Batas payload share: mencegah penulisan berkas share berukuran sembarang.
const MAX_SHARE_BODY_BYTES = 4 * 1024 * 1024;
const MAX_SHARE_MESSAGES = 500;
const MAX_SHARE_TITLE_CHARS = 200;

function getShareFilePath(shareId: string): string {
  const cleanId = shareId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!cleanId) return "";
  return getWritableVaultFilePath(["shares"], `${cleanId}.json`);
}

function loadSharePayload(cleanId: string): SharedConversationPayload | null {
  for (const candidatePath of getCandidateSharePaths(cleanId)) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, "utf-8");
        const parsed = JSON.parse(raw) as SharedConversationPayload;
        if (parsed && typeof parsed === "object") {
          rememberShare(cleanId, parsed);
          return parsed;
        }
      }
    } catch {
      // Abaikan berkas rusak atau tidak terbaca; coba sumber berikutnya
    }
  }
  return memoryShares.get(cleanId) || null;
}

async function loadSharePayloadAsync(cleanId: string): Promise<SharedConversationPayload | null> {
  const local = loadSharePayload(cleanId);
  if (local) return local;
  const fromDb = await kvGet<SharedConversationPayload>("shares", cleanId);
  if (fromDb && typeof fromDb === "object") {
    rememberShare(cleanId, fromDb);
    return fromDb;
  }
  return null;
}

// GET /api/chat/share?id=<shareId>
export async function GET(req: Request) {
  try {
    const limit = rateLimitByIp(req, "chat-share-get", 120);
    if (!limit.allowed) {
      return NextResponse.json(
        { exists: false, error: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { exists: false, error: "ID tautan percakapan diperlukan" },
        { status: 400 }
      );
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
    if (!cleanId) {
      return NextResponse.json(
        { exists: false, error: "ID tautan percakapan tidak valid" },
        { status: 400 }
      );
    }

    const data = await loadSharePayloadAsync(cleanId);
    if (data) {
      // Verifikasi status publik: jika pemilik mematikan public share, blokir akses!
      if (!data.isPublic) {
        return NextResponse.json(
          {
            exists: false,
            isRevoked: true,
            error: "Tautan publik percakapan ini telah dinonaktifkan oleh pemiliknya.",
          },
          { status: 403 }
        );
      }

      // Jangan pernah mengekspos email pemilik atau hash rahasia ke pemegang tautan publik
      const publicData = { ...data } as Record<string, unknown>;
      delete publicData.authorEmail;
      delete publicData.ownerSecretHash;
      // no-store: tautan yang baru dinonaktifkan tidak boleh tersaji dari cache.
      return NextResponse.json(
        { exists: true, data: publicData },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // STRICT: Jangan pernah fallback mencari di vault percakapan privat!
    // Percakapan privat hanya boleh dilihat oleh akun pemiliknya di /chat.
    return NextResponse.json(
      { exists: false, error: "Tautan percakapan tidak ditemukan atau belum dipublikasikan oleh pemilik." },
      { status: 404 }
    );
  } catch (err) {
    console.warn("Gagal memuat percakapan yang dibagikan:", err);
    return NextResponse.json(
      { exists: false, error: "Terjadi kesalahan pada server saat memuat tautan" },
      { status: 500 }
    );
  }
}

// POST /api/chat/share
export async function POST(req: Request) {
  try {
    const limit = rateLimitByIp(req, "chat-share-post", 30);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan berbagi tautan. Silakan coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SHARE_BODY_BYTES) {
      return NextResponse.json(
        { error: "Ukuran data percakapan melebihi batas server." },
        { status: 413 }
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const body = (parsedBody ?? {}) as ShareRequestBody;
    const {
      conversationId,
      title,
      messages,
      authorName,
      authorEmail,
      ownerSecret: requestedOwnerSecret,
      includeAuthor = true,
      isPublic = true,
      targetVar,
      active3DModel,
      shareId: requestedShareId,
    } = body;

    const normalizedAuthorEmail = authorEmail ? authorEmail.toString().toLowerCase().trim() : undefined;
    const cleanOwnerSecret =
      typeof requestedOwnerSecret === "string" && requestedOwnerSecret.trim().length >= 16
        ? requestedOwnerSecret.trim().slice(0, 128)
        : undefined;

    // Pola shareId yang ketat: minimal 10 karakter alfanumerik + strip
    const SHARE_ID_PATTERN = /^[a-z0-9-]{10,64}$/i;
    if (
      requestedShareId !== undefined &&
      requestedShareId !== null &&
      (typeof requestedShareId !== "string" || !SHARE_ID_PATTERN.test(requestedShareId.trim()))
    ) {
      return NextResponse.json(
        { error: "shareId tidak valid: gunakan minimal 10 karakter alfanumerik atau strip" },
        { status: 400 }
      );
    }

    // Kepemilikan WAJIB untuk mengubah/menonaktifkan share yang sudah ada:
    // pemanggil harus membuktikan kepemilikan lewat ownerSecret (SHA-256 timing-safe)
    // ATAU Bearer token terverifikasi yang cocok dengan authorEmail berkas tersimpan.
    const assertOwnership = async (existing: SharedConversationPayload): Promise<NextResponse | null> => {
      if (cleanOwnerSecret && existing.ownerSecretHash) {
        const candidateHash = Buffer.from(hashOwnerSecret(cleanOwnerSecret), "utf-8");
        const storedHash = Buffer.from(existing.ownerSecretHash, "utf-8");
        if (
          candidateHash.length === storedHash.length &&
          crypto.timingSafeEqual(candidateHash, storedHash)
        ) {
          return null;
        }
      }

      const verifiedBearerEmail = await verifyBearerIdentity(req);
      if (
        verifiedBearerEmail &&
        existing.authorEmail &&
        existing.authorEmail.toLowerCase().trim() === verifiedBearerEmail
      ) {
        return null;
      }

      // Kompatibilitas berkas share lama yang dibuat sebelum ownerSecretHash ada:
      if (
        !existing.ownerSecretHash &&
        normalizedAuthorEmail &&
        existing.authorEmail &&
        existing.authorEmail.toLowerCase().trim() === normalizedAuthorEmail
      ) {
        return null;
      }

      return NextResponse.json(
        { error: "Akses ditolak: kepemilikan percakapan tidak dapat diverifikasi." },
        { status: 403 }
      );
    };

    // Jika ini adalah permintaan untuk menonaktifkan share yang sudah ada:
    if (requestedShareId && isPublic === false) {
      const cleanId = requestedShareId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
      const existing = await loadSharePayloadAsync(cleanId);
      if (existing) {
        const ownershipError = await assertOwnership(existing);
        if (ownershipError) return ownershipError;
        existing.isPublic = false;
        existing.updatedAt = Date.now();
        rememberShare(cleanId, existing);
        await kvSet("shares", cleanId, existing);
        const filePath = getShareFilePath(cleanId);
        // Atomik: tulis ke disk bila writable; pada filesystem read-only tetap tersimpan di memori/DB.
        if (filePath) {
          writeJsonFileAtomic(filePath, existing);
        }
        return NextResponse.json({
          success: true,
          shareId: cleanId,
          isPublic: false,
          message: "Tautan publik percakapan berhasil dinonaktifkan",
        });
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Percakapan tidak memiliki pesan untuk dibagikan" },
        { status: 400 }
      );
    }
    if (messages.length > MAX_SHARE_MESSAGES) {
      return NextResponse.json(
        { error: `Jumlah pesan melebihi batas (${MAX_SHARE_MESSAGES}).` },
        { status: 400 }
      );
    }

    // shareId dari klien sudah divalidasi pola ketat di atas; bila tidak ada, buat UUID acak.
    // Tabrakan ID ditolak lewat pemeriksaan kepemilikan wajib di bawah.
    let shareId = requestedShareId;
    if (!shareId || typeof shareId !== "string") {
      shareId = crypto.randomUUID();
    }
    shareId = shareId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
    if (!shareId) {
      return NextResponse.json({ error: "shareId tidak valid." }, { status: 400 });
    }

    // Jika share sudah ada (baik di disk, memori, maupun PostgreSQL), hanya pemilik terverifikasi yang bisa memperbarui
    const existingData = await loadSharePayloadAsync(shareId);
    if (existingData) {
      const ownershipError = await assertOwnership(existingData);
      if (ownershipError) return ownershipError;
    } else {
      for (const candidatePath of getCandidateSharePaths(shareId)) {
        if (fs.existsSync(candidatePath)) {
          return NextResponse.json(
            { error: "Data tautan yang sudah ada tidak dapat diverifikasi kepemilikannya." },
            { status: 403 }
          );
        }
      }
    }
    const filePath = getShareFilePath(shareId);
    const issuedOwnerSecret =
      existingData?.ownerSecretHash && cleanOwnerSecret
        ? cleanOwnerSecret
        : cleanOwnerSecret || crypto.randomBytes(24).toString("hex");
    const ownerSecretHash = existingData?.ownerSecretHash || hashOwnerSecret(issuedOwnerSecret);

    const cleanTitle = (title || "Percakapan ZAP").toString().trim().slice(0, MAX_SHARE_TITLE_CHARS);
    const finalAuthor = includeAuthor
      ? (authorName || "Pengguna ZAP").toString().trim().slice(0, 120)
      : "Anonim";

    // Bersihkan pesan dari data privat yang tidak relevan
    const sanitizedMessages: ShareMessage[] = messages.map((m: Record<string, unknown>) => ({
      id: (m.id as string) || crypto.randomUUID(),
      sender: m.sender === "user" ? "user" : "assistant",
      steps: Array.isArray(m.steps) ? (m.steps as string[]) : undefined,
      rawText: typeof m.rawText === "string" ? m.rawText : undefined,
      diagnosis: m.diagnosis as ShareMessage["diagnosis"],
      replyText: typeof m.replyText === "string" ? m.replyText : undefined,
      modelName: typeof m.modelName === "string" ? m.modelName : undefined,
      timestamp: (m.timestamp as string) || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      smartboardItem: m.smartboardItem as ShareMessage["smartboardItem"],
      feedback: (m.feedback as "up" | "down" | null) || null,
      attachedFiles: Array.isArray(m.attachedFiles) ? (m.attachedFiles as ShareMessage["attachedFiles"]) : undefined,
    }));

    const payload: SharedConversationPayload = {
      shareId,
      conversationId: conversationId || undefined,
      title: cleanTitle,
      authorName: finalAuthor,
      authorEmail: normalizedAuthorEmail,
      ownerSecretHash,
      isPublic: Boolean(isPublic),
      sharedAt: existingData?.sharedAt || Date.now(),
      updatedAt: Date.now(),
      messages: sanitizedMessages,
      targetVar: targetVar || "x",
      active3DModel: active3DModel || undefined,
    };

    rememberShare(shareId, payload);
    await kvSet("shares", shareId, payload);
    if (filePath) {
      writeJsonFileAtomic(filePath, payload);
    }

    return NextResponse.json({
      success: true,
      shareId,
      ownerSecret: issuedOwnerSecret,
      isPublic: payload.isPublic,
      sharePath: `/a/chat/s/${shareId}`,
      altSharePath: `/chat/s/${shareId}`,
      title: cleanTitle,
    });
  } catch (err) {
    console.warn("Gagal membuat tautan percakapan:", err);
    return NextResponse.json(
      { error: "Gagal memproses status publik percakapan ke server" },
      { status: 500 }
    );
  }
}

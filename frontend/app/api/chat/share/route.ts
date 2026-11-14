import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeJsonFileAtomic } from "@/lib/atomic-file";

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
  includeAuthor?: boolean;
  isPublic?: boolean;
  targetVar?: string;
  active3DModel?: string;
  shareId?: unknown;
}

function getSharesDir(): string {
  const dir = path.join(process.cwd(), ".zap_vault", "shares");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Batas payload share: mencegah penulisan berkas share berukuran sembarang.
const MAX_SHARE_BODY_BYTES = 4 * 1024 * 1024;
const MAX_SHARE_MESSAGES = 500;
const MAX_SHARE_TITLE_CHARS = 200;

function getShareFilePath(shareId: string): string {
  const cleanId = shareId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  if (!cleanId) return "";
  const dir = getSharesDir();
  if (!dir) return "";
  const targetPath = path.resolve(dir, `${cleanId}.json`);
  const resolvedDir = path.resolve(dir);
  if (!targetPath.startsWith(resolvedDir + path.sep)) {
    return "";
  }
  return targetPath;
}

// GET /api/chat/share?id=<shareId>
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { exists: false, error: "ID tautan percakapan diperlukan" },
        { status: 400 }
      );
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const filePath = getShareFilePath(cleanId);
    if (!cleanId || !filePath) {
      return NextResponse.json(
        { exists: false, error: "ID tautan percakapan tidak valid" },
        { status: 400 }
      );
    }

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data: SharedConversationPayload = JSON.parse(raw);

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

      // Jangan pernah mengekspos email pemilik ke pemegang tautan publik
      const publicData = { ...data } as Record<string, unknown>;
      delete publicData.authorEmail;
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
      includeAuthor = true,
      isPublic = true,
      targetVar,
      active3DModel,
      shareId: requestedShareId,
    } = body;

    const normalizedAuthorEmail = authorEmail ? authorEmail.toString().toLowerCase().trim() : undefined;

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
    // authorEmail harus disertakan dan cocok dengan berkas tersimpan.
    const assertOwnership = (existing: SharedConversationPayload): NextResponse | null => {
      if (
        !normalizedAuthorEmail ||
        !existing.authorEmail ||
        existing.authorEmail.toLowerCase().trim() !== normalizedAuthorEmail
      ) {
        return NextResponse.json(
          { error: "Akses ditolak: kepemilikan percakapan tidak dapat diverifikasi." },
          { status: 403 }
        );
      }
      return null;
    };

    // Jika ini adalah permintaan untuk menonaktifkan share yang sudah ada:
    if (requestedShareId && isPublic === false) {
      const cleanId = requestedShareId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      const filePath = getShareFilePath(cleanId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const existing: SharedConversationPayload = JSON.parse(raw);
        const ownershipError = assertOwnership(existing);
        if (ownershipError) return ownershipError;
        existing.isPublic = false;
        existing.updatedAt = Date.now();
        // Atomik: kegagalan penulisan tidak boleh meninggalkan berkas share rusak.
        if (!writeJsonFileAtomic(filePath, existing)) {
          return NextResponse.json(
            { error: "Gagal menyimpan status publik percakapan di server." },
            { status: 500 }
          );
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
    shareId = shareId.toLowerCase();

    // Jika file share sudah ada, hanya pemilik terverifikasi yang bisa memperbarui
    const filePath = getShareFilePath(shareId);
    if (!filePath) {
      return NextResponse.json({ error: "shareId tidak valid." }, { status: 400 });
    }
    if (fs.existsSync(filePath)) {
      let existingData: SharedConversationPayload | null = null;
      try {
        existingData = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SharedConversationPayload;
      } catch {
        existingData = null;
      }
      if (!existingData) {
        return NextResponse.json(
          { error: "Data tautan yang sudah ada tidak dapat diverifikasi kepemilikannya." },
          { status: 403 }
        );
      }
      const ownershipError = assertOwnership(existingData);
      if (ownershipError) return ownershipError;
    }

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
      isPublic: Boolean(isPublic),
      sharedAt: Date.now(),
      updatedAt: Date.now(),
      messages: sanitizedMessages,
      targetVar: targetVar || "x",
      active3DModel: active3DModel || undefined,
    };

    if (!writeJsonFileAtomic(filePath, payload)) {
      return NextResponse.json(
        { error: "Gagal menyimpan tautan percakapan di server." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shareId,
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

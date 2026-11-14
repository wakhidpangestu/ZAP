import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/utils/rate-limit";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface FeedbackRequestBody {
  userMessage?: string;
  assistantReply?: string;
  rating?: "up" | "down" | number;
  memoryId?: string;
  conversationId?: string;
  userEmail?: string;
  userName?: string;
}

export async function POST(req: Request) {
  try {
    // Batasi per IP: endpoint ini memicu panggilan ke backend Python (biaya/CPU).
    const limit = rateLimitByIp(req, "chat-feedback", 30);
    if (!limit.allowed) {
      return NextResponse.json(
        { status: "ignored", reason: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as FeedbackRequestBody;
    const rawRating = body.rating;
    const numericRating =
      rawRating === "up" || rawRating === 1
        ? 1
        : rawRating === "down" || rawRating === -1
        ? -1
        : 0;

    if (numericRating === 0) {
      return NextResponse.json({ status: "ignored", reason: "invalid_rating" }, { status: 400 });
    }

    const userEmail = (body.userEmail || "").trim().toLowerCase();
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";
    const identityKey =
      userEmail && userEmail !== "anonymous"
        ? userEmail
        : clientIp
        ? `anon:${clientIp}`
        : body.userName || "";

    let backendRes: Response;
    try {
      const harnessSecret = process.env.ZAP_HARNESS_SECRET || "";
      backendRes = await fetch(`${API_BASE}/api/v1/harness/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(harnessSecret ? { "X-Harness-Secret": harnessSecret } : {}),
        },
        body: JSON.stringify({
          // Kirim identitas yang sama dengan yang dipakai rute chat saat
          // /harness/learn; backend meng-hash-nya menjadi user_key anonim
          // sehingga umpan balik menempel pada memori pengguna yang benar.
          user_id: identityKey || undefined,
          conversation_id: body.conversationId ? String(body.conversationId).slice(0, 64) : undefined,
          memory_id: body.memoryId ? String(body.memoryId).slice(0, 64) : undefined,
          user_message: (body.userMessage || "").slice(0, 500),
          assistant_reply: (body.assistantReply || "").slice(0, 600),
          rating: numericRating,
        }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Backend tidak terjangkau: jangan pura-pura berhasil. Klien harus tahu
      // umpan baliknya tidak tersimpan.
      return NextResponse.json(
        {
          status: "unavailable",
          error: "Backend memori tidak dapat dijangkau; umpan balik belum tersimpan.",
        },
        { status: 503 }
      );
    }

    // Teruskan status asli backend (201/200/4xx) supaya UI tidak menampilkan
    // sukses palsu ketika endpoint tidak ada (404) atau payload ditolak.
    if (backendRes.status >= 500) {
      return NextResponse.json(
        {
          status: "unavailable",
          error: `Backend memori mengembalikan ${backendRes.status}; umpan balik belum tersimpan.`,
        },
        { status: 503 }
      );
    }

    const data = await backendRes
      .json()
      .catch(() => ({ status: "error", error: "Respons backend bukan JSON yang valid." }));
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

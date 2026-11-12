import { createHash } from "crypto";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

function deriveUserKey(identityKey: string): string | undefined {
  const clean = (identityKey || "").trim().toLowerCase();
  if (!clean) return undefined;
  return createHash("sha256").update(`chatzap-user-v1:${clean}`).digest("hex").slice(0, 32);
}

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

    const userKey = deriveUserKey(identityKey);

    try {
      const backendRes = await fetch(`${API_BASE}/api/v1/harness/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_key: userKey,
          conversation_id: body.conversationId ? String(body.conversationId).slice(0, 64) : undefined,
          memory_id: body.memoryId ? String(body.memoryId).slice(0, 64) : undefined,
          user_message: (body.userMessage || "").slice(0, 500),
          assistant_reply: (body.assistantReply || "").slice(0, 600),
          rating: numericRating,
        }),
        signal: AbortSignal.timeout(2000),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // Non-blocking fallback when local Python backend is offline
    }

    return NextResponse.json({
      status: "recorded_local_fallback",
      rating: numericRating,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

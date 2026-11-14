import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/utils/rate-limit";

interface VerifyRequestBody {
  apiKey: string;
}

// Batas: maksimal 10 permintaan per menit per IP (endpoint pemeriksa kunci
// tidak boleh menjadi oracle tebak-tebakan kunci tanpa batas).
const VERIFY_KEY_LIMIT_PER_MINUTE = 10;

export async function POST(req: Request) {
  const limit = rateLimitByIp(req, "verify-key", VERIFY_KEY_LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  try {
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json(
        { valid: false, error: "Payload JSON tidak valid" },
        { status: 400 }
      );
    }
    const body = (parsed ?? {}) as Partial<VerifyRequestBody>;

    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: "Google API Key tidak boleh kosong" },
        { status: 400 }
      );
    }

    // 1. Verifikasi langsung ke Google Generative Language API
    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    const latency = Date.now() - startTime;

    if (!res.ok) {
      // Pesan generik: jangan pantulkan pesan mentah dari Google ke klien.
      return NextResponse.json(
        {
          valid: false,
          error: "Kunci tidak valid atau tidak dapat diverifikasi. Periksa kembali kunci Anda.",
          statusCode: res.status,
          latencyMs: latency,
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const allModels: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }> =
      data?.models || [];

    // Filter model teks yang relevan
    const contentModels = allModels
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));

    const has20Flash = contentModels.some((m) => m.includes("2.0-flash"));
    const has15Pro = contentModels.some((m) => m.includes("1.5-pro"));

    return NextResponse.json({
      valid: true,
      message: "Kredensial Google AI Studio berhasil diverifikasi!",
      latencyMs: latency,
      totalModels: contentModels.length,
      sampleModels: contentModels.slice(0, 5),
      tier: has15Pro || has20Flash ? "Google Gemini Pro / Flash (Tier Aktif)" : "Google Gemini Standard",
    });
  } catch {
    return NextResponse.json(
      {
        valid: false,
        error: "Gagal menghubungi layanan verifikasi. Silakan coba lagi nanti.",
      },
      { status: 200 }
    );
  }
}

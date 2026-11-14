import { NextResponse } from "next/server";
import { createAccountSession } from "@/lib/account-session";
import { rateLimitByIp } from "@/utils/rate-limit";

/**
 * POST /api/auth/google
 * Menukar Google ID token terverifikasi (berdurasi ~1 jam) menjadi token sesi
 * akun ZAP berdurasi 30 hari (HMAC-SHA256) agar sinkronisasi & kepemilikan share
 * tidak terputus setelah 1 jam.
 */
export async function POST(req: Request) {
  try {
    const limit = rateLimitByIp(req, "auth-google", 30);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan autentikasi Google. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
    }

    const rawToken =
      typeof body.credential === "string"
        ? body.credential.trim()
        : typeof body.idToken === "string"
        ? body.idToken.trim()
        : "";
    if (!rawToken) {
      return NextResponse.json({ error: "Token ID Google wajib disertakan." }, { status: 400 });
    }

    const expectedAud =
      process.env.ZAP_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    if (!expectedAud) {
      return NextResponse.json(
        { error: "Server belum mengonfigurasi Client ID Google (ZAP_GOOGLE_CLIENT_ID)." },
        { status: 500 }
      );
    }

    let info: Record<string, unknown>;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: "Token Google tidak valid atau sudah kedaluwarsa." },
          { status: 401 }
        );
      }
      info = (await res.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Gagal menghubungi layanan verifikasi Google." },
        { status: 502 }
      );
    }

    if (info.aud !== expectedAud) {
      return NextResponse.json(
        { error: "Token Google tidak diterbitkan untuk aplikasi ini." },
        { status: 401 }
      );
    }
    if (info.email_verified !== "true" && info.email_verified !== true) {
      return NextResponse.json(
        { error: "Email Google belum terverifikasi." },
        { status: 401 }
      );
    }

    const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Token Google tidak memuat email." }, { status: 401 });
    }

    const session = createAccountSession(email);
    const picture =
      typeof info.picture === "string" && !info.picture.includes("default-user")
        ? info.picture.trim()
        : undefined;
    const name = typeof info.name === "string" ? info.name.trim() : undefined;
    const sub = typeof info.sub === "string" ? info.sub.trim() : email;

    return NextResponse.json(
      {
        success: true,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
        user: {
          id: sub,
          email,
          name,
          picture,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[auth/google] error:", err);
    return NextResponse.json(
      { error: "Gagal menerbitkan sesi akun." },
      { status: 500 }
    );
  }
}

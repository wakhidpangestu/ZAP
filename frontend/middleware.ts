import { NextRequest, NextResponse } from "next/server";

// Tamu tanpa sesi yang membuka /chat langsung diarahkan server ke /login.
// Sebelumnya pengalihan ini terjadi di klien sesudah bundle chat (besar)
// dimuat dan dihidrasi, sehingga halaman terasa lambat dan LCP buruk.
// Keberadaan sesi dibaca dari cookie cermin zap_session yang disetel saat
// sesi lokal dibuat (lihat lib/session-cookie.ts). Cookie bukan kredensial;
// gerbang autentikasi di halaman chat tetap berjalan seperti biasa.
//
// KEAMANAN: header proksi (X-Forwarded-Host / X-Forwarded-Proto) dikendalikan
// klien pada beberapa konfigurasi, sehingga nilai mentahnya tidak boleh
// dipakai apa adanya sebagai tujuan Location (open redirect / header
// injection). Hanya bentuk host:port dan skema http/https yang diterima, dan
// host hanya dipercaya bila konsisten dengan header Host (atau terdaftar di
// ZAP_ALLOWED_HOSTS untuk deployment di belakang reverse proxy).
const SAFE_HOST = /^[a-z0-9.\-]+(:\d{1,5})?$/i;

const allowedHosts = (process.env.ZAP_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function firstHeaderValue(value: string | null): string {
  return (value || "").split(",")[0].trim();
}

function resolvePublicHost(req: NextRequest): string {
  const originHost = req.nextUrl.host;
  const forwardedHost = firstHeaderValue(req.headers.get("x-forwarded-host"));
  const directHost = firstHeaderValue(req.headers.get("host"));

  if (allowedHosts.length > 0) {
    const matched = [forwardedHost, directHost, originHost].find(
      (candidate) => candidate && allowedHosts.includes(candidate.toLowerCase())
    );
    return matched || originHost;
  }

  if (SAFE_HOST.test(directHost)) {
    return forwardedHost && forwardedHost.toLowerCase() === directHost.toLowerCase()
      ? forwardedHost
      : directHost;
  }
  return originHost;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isChatPath = pathname === "/chat" || pathname.startsWith("/chat/");
  if (isChatPath && !req.cookies.get("zap_session")) {
    // Bangun URL publik dari header proksi: di belakang reverse proxy,
    // nextUrl bisa berisi alamat internal (localhost:port) yang tidak
    // bisa dibuka peramban pengguna.
    const host = resolvePublicHost(req);
    const forwardedProto = (req.headers.get("x-forwarded-proto") || "").trim().toLowerCase();
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : req.nextUrl.protocol.replace(":", "");
    return NextResponse.redirect(`${proto}://${host}/login`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*"],
};

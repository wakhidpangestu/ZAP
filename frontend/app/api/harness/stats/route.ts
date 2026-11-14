import { NextResponse } from "next/server";

/**
 * Proxy statistik harness ZAP.
 *
 * Sejak audit 14 Nov 2026, seluruh endpoint `/api/v1/harness/*` di backend
 * memakai gerbang `X-Harness-Secret`. Komponen klien (landing page, playground,
 * dokumentasi) tidak boleh memegang secret tersebut, jadi permintaan agregat
 * yang memang publik diteruskan dari server Next di sini.
 *
 * Yang dikembalikan hanya angka agregat (jumlah record per tier/domain dan
 * jumlah pola geometri). Tidak ada query pengguna, email, atau isi memori.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  const secret = process.env.ZAP_HARNESS_SECRET || "";
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/api/v1/harness/stats`, {
      headers: secret ? { "X-Harness-Secret": secret } : undefined,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Statistik harness tidak tersedia saat ini." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Statistik harness tidak tersedia saat ini." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

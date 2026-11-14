import { NextResponse } from "next/server";
import fs from "fs";
import { rateLimitByIp } from "@/utils/rate-limit";
import { writeJsonFileAtomic } from "@/lib/atomic-file";
import { kvGet, kvSet } from "@/lib/kv-store";
import { getCandidateVaultFilePaths, getWritableVaultFilePath } from "@/lib/vault-dir";

interface WaitlistEntry {
  name: string;
  email: string;
  product?: string;
  createdAt: number;
}

// Serverless-safe fallback in-memory store for environments with read-only filesystems (Vercel, Cloudflare, Lambda)
const memoryWaitlist: WaitlistEntry[] = [];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Batas atas entri agar berkas tidak tumbuh tanpa batas pada deployment terbuka.
const MAX_WAITLIST_ENTRIES = 20000;

function getWaitlistFilePath(): string {
  return getWritableVaultFilePath([], "waitlist.json");
}

function readEntries(): WaitlistEntry[] {
  for (const filePath of getCandidateVaultFilePaths([], "waitlist.json")) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // coba sumber berikutnya
    }
  }
  return [...memoryWaitlist];
}

function writeEntries(entries: WaitlistEntry[]): void {
  memoryWaitlist.length = 0;
  memoryWaitlist.push(...entries);
  const filePath = getWaitlistFilePath();
  if (!filePath) return;
  writeJsonFileAtomic(filePath, entries);
}

export async function POST(req: Request) {
  // Pendaftaran publik: batasi per IP agar daftar tidak dapat dibanjiri
  // (sebelumnya tanpa batas, sehingga satu klien dapat menumbuhkan
  // waitlist.json tanpa batas).
  const limit = rateLimitByIp(req, "waitlist", 5);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak pendaftaran. Silakan coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body permintaan tidak valid." },
      { status: 400 }
    );
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const product =
    typeof payload.product === "string"
      ? payload.product.trim().slice(0, 160)
      : undefined;

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Nama wajib diisi." },
      { status: 400 }
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Format alamat email tidak valid." },
      { status: 400 }
    );
  }

  const entries = readEntries();
  const existingDb = await kvGet<WaitlistEntry>("waitlist", email);
  const alreadyRegistered = Boolean(existingDb) || entries.some((entry) => entry.email === email);
  if (alreadyRegistered) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (entries.length >= MAX_WAITLIST_ENTRIES) {
    return NextResponse.json(
      { ok: false, error: "Daftar tunggu sudah mencapai batas kapasitas." },
      { status: 503 }
    );
  }

  const newEntry: WaitlistEntry = {
    name: name.slice(0, 120),
    email,
    ...(product ? { product } : {}),
    createdAt: Date.now(),
  };
  entries.push(newEntry);
  writeEntries(entries);
  await kvSet("waitlist", email, newEntry);

  return NextResponse.json({ ok: true });
}

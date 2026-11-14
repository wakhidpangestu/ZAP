import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { rateLimitByIp } from "@/utils/rate-limit";
import { writeJsonFileAtomic, writeBufferFileAtomic } from "@/lib/atomic-file";

function getSafeKey(emailOrId: string): string {
  return (emailOrId || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[\0/\\]/g, "")
    .replace(/\.+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
}

function getVaultDir(subdir: string): string {
  try {
    const dir = path.join(process.cwd(), ".zap_vault", subdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    return "";
  }
}

function isBogusAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.includes("default-user=s96-c") || trimmed.includes("/a/default-user")) {
    return true;
  }
  return false;
}

// KEAMANAN (SSRF): parameter `url` berasal dari klien, jadi server TIDAK boleh
// mengambil URL sembarang. Sebelumnya `fetch(url)` dapat dipakai memindai dan
// memanggil layanan internal (mis. http://127.0.0.1:*) lalu mengembalikan
// isinya sebagai data URL. Kini hanya foto Google yang diizinkan.
const ALLOWED_AVATAR_HOST_SUFFIXES = [".googleusercontent.com", ".ggpht.com"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MiB per foto
const MAX_DATA_URL_BYTES = 512 * 1024; // batas aman untuk respons JSON data URL
const MAX_CACHE_ENTRIES = 200;

function isAllowedAvatarUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_AVATAR_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function normalizeGoogleAvatarUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.includes("googleusercontent.com")) {
    // Pastikan ukuran gambar optimal (s128-c)
    return trimmed.replace(/=s\d+(-c)?$/, "=s128-c");
  }
  return trimmed;
}

// Kunci lama (sebelum normalisasi titik -> underscore) masih ada di beberapa vault.
function getLegacyKey(email: string): string {
  return (email || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 80);
}

function lookupVaultAvatarForEmail(email: string): { avatar?: string; name?: string } {
  if (!email) return {};
  const usersDir = getVaultDir("users");
  if (!usersDir) return {};

  let fallbackName: string | undefined;
  const candidates = Array.from(new Set([getSafeKey(email), getLegacyKey(email)]));
  for (const key of candidates) {
    const filePath = path.join(usersDir, `${key}.json`);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const vaultAvatar = parsed?.user?.avatar;
      const vaultName = parsed?.user?.name;
      if (!fallbackName && vaultName) fallbackName = vaultName;
      if (!isBogusAvatarUrl(vaultAvatar)) {
        return { avatar: normalizeGoogleAvatarUrl(vaultAvatar), name: vaultName };
      }
    } catch {
      // ignore corrupt file, try next candidate
    }
  }
  return fallbackName ? { name: fallbackName } : {};
}

function readDiskAvatar(cacheKey: string): { buffer: Buffer; contentType: string } | null {
  const avatarsDir = getVaultDir("avatars");
  if (!avatarsDir || !cacheKey) return null;
  const binPath = path.join(avatarsDir, `${cacheKey}.bin`);
  if (!fs.existsSync(binPath)) return null;
  try {
    const buffer = fs.readFileSync(binPath);
    if (buffer.length === 0) return null;
    let contentType = "image/png";
    const metaPath = path.join(avatarsDir, `${cacheKey}.meta.json`);
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (typeof meta?.contentType === "string" && meta.contentType.startsWith("image/")) {
        contentType = meta.contentType;
      }
    }
    return { buffer, contentType };
  } catch {
    return null;
  }
}

function writeDiskAvatar(cacheKey: string, buffer: Buffer, contentType: string, url: string): void {
  const avatarsDir = getVaultDir("avatars");
  if (!avatarsDir || !cacheKey || buffer.length === 0) return;
  try {
    // Atomik + meta lebih dulu: berkas .bin tanpa meta tetap dapat disajikan
    // (content-type default image/png), sedangkan meta tanpa .bin tidak.
    writeJsonFileAtomic(path.join(avatarsDir, `${cacheKey}.meta.json`), {
      contentType,
      url,
      updatedAt: Date.now(),
    });
    writeBufferFileAtomic(path.join(avatarsDir, `${cacheKey}.bin`), buffer);
  } catch {
    // read-only fs (serverless): memory cache still works
  }
}

async function fetchUpstreamAvatar(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  // Hanya host foto Google: memblokir SSRF ke jaringan internal / host lain.
  if (!isAllowedAvatarUrl(url)) return null;
  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_AVATAR_BYTES) {
      try {
        await upstream.body?.cancel();
      } catch {
        // abaikan
      }
      return null;
    }

    // Batasi pembacaan byte: respons raksasa tidak boleh memenuhi memori proses.
    const reader = upstream.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_AVATAR_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // abaikan
        }
        return null;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return buffer.length > 0 ? { buffer, contentType } : null;
  } catch {
    return null;
  }
}

// In-memory cache for fast binary serving
const avatarBinaryCache = new Map<string, { buffer: Buffer; contentType: string; updatedAt: number }>();

/** Cache dengan batas jumlah entri: kunci datang dari email klien, jadi Map
 *  tanpa batas sebelumnya bisa ditumbuhkan sampai memori habis. */
function setAvatarCache(
  key: string,
  value: { buffer: Buffer; contentType: string; updatedAt: number }
): void {
  if (!avatarBinaryCache.has(key) && avatarBinaryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = avatarBinaryCache.keys().next().value;
    if (oldest) avatarBinaryCache.delete(oldest);
  }
  avatarBinaryCache.set(key, value);
}

/**
 * Resolusi biner avatar berurutan: memori -> upstream (jika URL ada) -> disk cache.
 * Disk cache dipakai walau URL kosong, sehingga foto tetap tampil saat token Google kedaluwarsa.
 */
async function resolveAvatarBinary(
  cacheKey: string,
  resolvedUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const mem = avatarBinaryCache.get(cacheKey);
  if (mem && Date.now() - mem.updatedAt < 3600_000) return mem;

  if (resolvedUrl) {
    const fresh = await fetchUpstreamAvatar(resolvedUrl);
    if (fresh) {
      setAvatarCache(cacheKey, { ...fresh, updatedAt: Date.now() });
      writeDiskAvatar(cacheKey, fresh.buffer, fresh.contentType, resolvedUrl);
      return fresh;
    }
  }

  const disk = readDiskAvatar(cacheKey);
  if (disk) {
    setAvatarCache(cacheKey, { ...disk, updatedAt: Date.now() });
    return disk;
  }
  if (mem) return mem; // stale memory lebih baik daripada kosong
  return null;
}

function saveVaultAvatarForEmail(email: string, avatarUrl: string, name?: string): void {
  if (!email || isBogusAvatarUrl(avatarUrl)) return;
  const safeKey = getSafeKey(email);
  const usersDir = getVaultDir("users");
  if (!usersDir) return;

  const filePath = path.join(usersDir, `${safeKey}.json`);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existing: any = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    existing.user = {
      ...(existing.user || {}),
      email: email.trim().toLowerCase(),
      name: name || existing.user?.name || "Pengguna Google",
      avatar: normalizeGoogleAvatarUrl(avatarUrl),
      provider: existing.user?.provider || "google",
    };
    // Atomik: jangan pernah menimpa vault pengguna dengan JSON setengah jadi.
    writeJsonFileAtomic(filePath, existing);
  } catch {
    // ignore read-only fs errors
  }
}

const IMAGE_HEADERS = (contentType: string) => ({
  "Content-Type": contentType,
  // Cache pendek + revalidasi: foto baru dari Google cepat terlihat, tanpa memukul upstream tiap render.
  "Cache-Control": "private, max-age=300, stale-while-revalidate=86400",
});

function buildDataUrl(binary: { buffer: Buffer; contentType: string } | null): string | null {
  // Hanya kirim data URL untuk berkas kecil: respons meta tidak boleh membengkak.
  if (!binary || binary.buffer.length > MAX_DATA_URL_BYTES) return null;
  return `data:${binary.contentType};base64,${binary.buffer.toString("base64")}`;
}

export async function GET(req: Request) {
  try {
    const limit = rateLimitByIp(req, "user-avatar", 300);
    if (!limit.allowed) {
      return new NextResponse(null, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";
    const email = (searchParams.get("email") || "").trim().toLowerCase();
    const rawUrl = (searchParams.get("url") || "").trim();

    const vaultInfo = lookupVaultAvatarForEmail(email);
    const resolvedUrl = !isBogusAvatarUrl(rawUrl)
      ? normalizeGoogleAvatarUrl(rawUrl)
      : vaultInfo.avatar || "";

    if (!email && !resolvedUrl) {
      return action === "meta"
        ? NextResponse.json({ email, avatar: null, name: null, hasAvatar: false, dataUrl: null })
        : new NextResponse(null, { status: 404 });
    }

    // CATATAN KEAMANAN: GET tidak lagi menulis ke vault pengguna. Sebelumnya
    // siapa pun tanpa autentikasi dapat membuat/mengubah berkas vault milik
    // email mana pun hanya dengan memanggil endpoint ini (email + url).
    // Penulisan vault kini hanya lewat POST (alur login Google).

    const cacheKey = email ? getSafeKey(email) : getSafeKey(resolvedUrl);
    const binary = await resolveAvatarBinary(cacheKey, resolvedUrl);

    if (action === "meta") {
      return NextResponse.json(
        {
          email,
          // Jangan memantulkan URL yang tidak lolos allowlist ke klien.
          avatar: resolvedUrl && isAllowedAvatarUrl(resolvedUrl) ? resolvedUrl : null,
          name: vaultInfo.name || null,
          hasAvatar: Boolean(binary || resolvedUrl),
          // Data URL memungkinkan klien merender foto di frame pertama tanpa race cache/jaringan.
          dataUrl: buildDataUrl(binary),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!binary) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(binary.buffer), {
      status: 200,
      headers: IMAGE_HEADERS(binary.contentType),
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

// POST: Simpan & pre-warm cache foto profil saat pengguna login dengan Google
export async function POST(req: Request) {
  try {
    const limit = rateLimitByIp(req, "user-avatar-post", 20);
    if (!limit.allowed) {
      return NextResponse.json(
        { synced: false, error: "Terlalu banyak permintaan." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ synced: false, error: "Body permintaan tidak valid." }, { status: 400 });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const avatar = String(body.avatar || "").trim();
    const name = String(body.name || "").trim().slice(0, 120);

    if (!email || isBogusAvatarUrl(avatar)) {
      return NextResponse.json({ synced: false });
    }

    const normalized = normalizeGoogleAvatarUrl(avatar);
    // Hanya URL foto Google yang boleh disimpan/diambil (cegah SSRF + isi vault liar).
    if (!isAllowedAvatarUrl(normalized)) {
      return NextResponse.json({ synced: false });
    }
    saveVaultAvatarForEmail(email, normalized, name);

    const cacheKey = getSafeKey(email);
    const fresh = await fetchUpstreamAvatar(normalized);
    if (fresh) {
      setAvatarCache(cacheKey, { ...fresh, updatedAt: Date.now() });
      writeDiskAvatar(cacheKey, fresh.buffer, fresh.contentType, normalized);
    }

    return NextResponse.json({
      synced: true,
      avatar: normalized,
      dataUrl: buildDataUrl(fresh),
    });
  } catch {
    return NextResponse.json({ synced: false }, { status: 500 });
  }
}

/**
 * Rate limiter in-memory sederhana (sliding window per kunci, bawaan per IP).
 * Cocok untuk satu instans server; pada deployment multi-instans gunakan
 * penyimpanan bersama (Redis) agar batas berlaku global.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const MAX_BUCKETS = 5000;
const buckets = new Map<string, number[]>();

function pruneBuckets(now: number, windowMs: number) {
  const oldestAllowed = now - windowMs;
  buckets.forEach((timestamps, k) => {
    const recent = timestamps.filter((t: number) => t > oldestAllowed);
    if (recent.length === 0) {
      buckets.delete(k);
    } else if (recent.length !== timestamps.length) {
      buckets.set(k, recent);
    }
  });
  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function rateLimitCheck(
  key: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    pruneBuckets(now, windowMs);
  }
  const existing = buckets.get(key);
  const hits = existing ? existing.filter((t) => t > windowStart) : [];
  // Refresh insertion order for bounded LRU-style eviction
  if (existing) {
    buckets.delete(key);
  }

  if (hits.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((hits[0] + windowMs - now) / 1000)
    );
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}

/** Mengambil IP klien dari header proxy standar. */
export function clientIpFromRequest(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Jalan pintas: cek rate limit berdasarkan IP + nama rute. */
export function rateLimitByIp(
  req: Request,
  routeName: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  return rateLimitCheck(`${routeName}:${clientIpFromRequest(req)}`, limit, windowMs);
}

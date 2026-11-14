import type { Pool as PgPool } from "pg";

interface GlobalWithZapPg {
  __zapPgPool?: PgPool | null;
  __zapPgUrl?: string;
  __zapPgSchemaPromise?: Promise<boolean> | null;
}

const g = globalThis as unknown as GlobalWithZapPg;

export function isDatabaseConfigured(): boolean {
  return Boolean((process.env.DATABASE_URL || "").trim());
}

async function getPgPool(): Promise<PgPool | null> {
  const dbUrl = (process.env.DATABASE_URL || "").trim();
  if (!dbUrl) return null;

  if (g.__zapPgPool && g.__zapPgUrl === dbUrl) {
    return g.__zapPgPool;
  }

  try {
    const { Pool } = await import("pg");
    const useSsl =
      dbUrl.includes("sslmode=require") ||
      dbUrl.includes("neon.tech") ||
      dbUrl.includes("supabase");

    const pool = new Pool({
      connectionString: dbUrl,
      max: 8,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 3_000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    g.__zapPgPool = pool;
    g.__zapPgUrl = dbUrl;
    g.__zapPgSchemaPromise = null;
    return pool;
  } catch (err) {
    console.warn("[kv-store] Gagal inisialisasi PostgreSQL Pool, fallback ke vault file:", err);
    return null;
  }
}

async function ensureSchema(pool: PgPool): Promise<boolean> {
  if (!g.__zapPgSchemaPromise) {
    g.__zapPgSchemaPromise = pool
      .query(
        `
        CREATE TABLE IF NOT EXISTS zap_kv_store (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value JSONB NOT NULL,
          updated_at BIGINT NOT NULL,
          PRIMARY KEY (namespace, key)
        );
        CREATE INDEX IF NOT EXISTS idx_zap_kv_updated
          ON zap_kv_store (namespace, updated_at DESC);
      `
      )
      .then(() => true)
      .catch((err) => {
        console.warn("[kv-store] Gagal membuat tabel zap_kv_store:", err);
        g.__zapPgSchemaPromise = null;
        return false;
      });
  }
  return g.__zapPgSchemaPromise;
}

export async function kvGet<T>(namespace: string, key: string): Promise<T | null> {
  if (!namespace || !key || !isDatabaseConfigured()) return null;
  const pool = await getPgPool();
  if (!pool) return null;
  if (!(await ensureSchema(pool))) return null;

  try {
    const res = await pool.query<{ value: T }>(
      "SELECT value FROM zap_kv_store WHERE namespace = $1 AND key = $2 LIMIT 1",
      [namespace, key]
    );
    return res.rows[0]?.value ?? null;
  } catch (err) {
    console.warn(`[kv-store] kvGet(${namespace}, ${key}) fallback ke disk:`, err);
    return null;
  }
}

export async function kvSet<T>(namespace: string, key: string, value: T): Promise<boolean> {
  if (!namespace || !key || !isDatabaseConfigured()) return false;
  const pool = await getPgPool();
  if (!pool) return false;
  if (!(await ensureSchema(pool))) return false;

  try {
    await pool.query(
      `
      INSERT INTO zap_kv_store (namespace, key, value, updated_at)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT (namespace, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `,
      [namespace, key, JSON.stringify(value), Date.now()]
    );
    return true;
  } catch (err) {
    console.warn(`[kv-store] kvSet(${namespace}, ${key}) fallback ke disk:`, err);
    return false;
  }
}

export async function kvDelete(namespace: string, key: string): Promise<boolean> {
  if (!namespace || !key || !isDatabaseConfigured()) return false;
  const pool = await getPgPool();
  if (!pool) return false;
  if (!(await ensureSchema(pool))) return false;

  try {
    await pool.query("DELETE FROM zap_kv_store WHERE namespace = $1 AND key = $2", [
      namespace,
      key,
    ]);
    return true;
  } catch (err) {
    console.warn(`[kv-store] kvDelete(${namespace}, ${key}) gagal:`, err);
    return false;
  }
}

export async function kvListNamespace<T>(
  namespace: string
): Promise<Array<{ key: string; value: T }>> {
  if (!namespace || !isDatabaseConfigured()) return [];
  const pool = await getPgPool();
  if (!pool) return [];
  if (!(await ensureSchema(pool))) return [];

  try {
    const res = await pool.query<{ key: string; value: T }>(
      "SELECT key, value FROM zap_kv_store WHERE namespace = $1 ORDER BY updated_at DESC",
      [namespace]
    );
    return res.rows;
  } catch (err) {
    console.warn(`[kv-store] kvListNamespace(${namespace}) gagal:`, err);
    return [];
  }
}

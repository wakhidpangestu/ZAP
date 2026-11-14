import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { rateLimitByIp } from "@/utils/rate-limit";
import { writeJsonFileAtomic } from "@/lib/atomic-file";
import { createAccountSession } from "@/lib/account-session";

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
}

const memoryAccounts = new Map<string, StoredAccount>();

function getAccountsFilePath(): string {
  try {
    const dir = path.join(process.cwd(), ".zap_vault");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, "accounts.json");
  } catch {
    return "";
  }
}

function loadAccounts(): Record<string, StoredAccount> {
  const result: Record<string, StoredAccount> = {};
  memoryAccounts.forEach((val, key) => {
    result[key] = val;
  });

  const filePath = getAccountsFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, StoredAccount>;
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = v;
        memoryAccounts.set(k, v);
      }
    } catch {
      // ignore read errors on read-only fs
    }
  }
  return result;
}

function saveAccounts(accounts: Record<string, StoredAccount>): void {
  for (const [k, v] of Object.entries(accounts)) {
    memoryAccounts.set(k, v);
  }
  const filePath = getAccountsFilePath();
  if (filePath) {
    try {
      // Atomik: kegagalan di tengah penulisan tidak boleh mengosongkan accounts.json
      writeJsonFileAtomic(filePath, accounts);
    } catch {
      // serverless fallback uses memoryAccounts
    }
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

/** Perbandingan hash kata sandi yang timing-safe (panjang hash selalu 64 byte). */
function passwordMatches(password: string, account: StoredAccount): boolean {
  if (!account.passwordHash || !account.salt) return false;
  try {
    const candidate = Buffer.from(hashPassword(password, account.salt), "hex");
    const stored = Buffer.from(account.passwordHash, "hex");
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

// Batas per IP per menit: memperlambat brute force login/signup.
const ACTION_LIMITS: Record<string, number> = {
  signup: 5,
  login: 15,
};

export async function POST(req: Request) {
  try {
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json({ error: "Body permintaan tidak valid." }, { status: 400 });
    }
    const body = (parsed ?? {}) as Record<string, unknown>;
    const action = String(body.action || "login").trim().toLowerCase();
    const rawEmail = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 120);

    // Rate limit per IP per aksi (fail-open hanya untuk batas memori proses).
    const limit = rateLimitByIp(req, `auth-credentials:${action}`, ACTION_LIMITS[action] ?? 10);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Silakan tunggu sebentar lalu coba lagi." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json(
        { error: "Masukkan alamat email yang valid." },
        { status: 400 }
      );
    }

    const accounts = loadAccounts();

    if (action === "signup") {
      if (!name || name.length < 2) {
        return NextResponse.json(
          { error: "Nama lengkap minimal 2 karakter." },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Kata sandi minimal 6 karakter." },
          { status: 400 }
        );
      }
      if (accounts[rawEmail]) {
        return NextResponse.json(
          { error: "Email ini sudah terdaftar. Silakan masuk dengan kata sandi Anda." },
          { status: 409 }
        );
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPassword(password, salt);
      const now = Date.now();
      const newAccount: StoredAccount = {
        id: "usr_" + crypto.randomBytes(6).toString("hex"),
        name,
        email: rawEmail,
        passwordHash,
        salt,
        createdAt: now,
        updatedAt: now,
      };

      accounts[rawEmail] = newAccount;
      saveAccounts(accounts);

      // Token sesi untuk sinkronisasi vault terenkripsi (tanpa kata sandi).
      const session = createAccountSession(newAccount.email);

      return NextResponse.json({
        success: true,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
        user: {
          id: newAccount.id,
          name: newAccount.name,
          email: newAccount.email,
          provider: "zap",
          tier: "standard",
          isGuest: false,
        },
      });
    }

    if (action === "login") {
      if (!password) {
        return NextResponse.json(
          { error: "Masukkan kata sandi Anda." },
          { status: 400 }
        );
      }

      const existing = accounts[rawEmail];
      if (!existing) {
        return NextResponse.json(
          { error: "Akun dengan email ini belum terdaftar. Silakan daftar terlebih dahulu." },
          { status: 404 }
        );
      }

      // `passwordMatches` aman terhadap panjang hash yang berbeda (timing-safe,
      // tanpa melempar exception) — versi inline sebelumnya bisa 500 bila hash
      // tersimpan di file rusak/terpotong.
      if (!passwordMatches(password, existing)) {
        return NextResponse.json(
          { error: "Kata sandi yang Anda masukkan salah." },
          { status: 401 }
        );
      }

      const session = createAccountSession(existing.email);

      return NextResponse.json({
        success: true,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          provider: "zap",
          tier: "standard",
          isGuest: false,
        },
      });
    }


    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("Auth credentials error:", err);
    return NextResponse.json(
      { error: "Gagal memproses autentikasi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}

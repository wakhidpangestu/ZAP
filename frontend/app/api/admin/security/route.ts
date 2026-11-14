import { NextResponse } from "next/server";
import {
  isValidAdminSecret,
  getUserSecurityStatus,
  unsuspendUserAccount,
  createRecoveryToken,
  verifyRecoveryToken,
  consumeRecoveryToken,
  loadRegistryFromFile,
} from "@/utils/security-vault";

// GET Handler
// CATATAN KEAMANAN: GET tidak pernah mengeksekusi token pemulihan.
// Penebusan token hanya boleh lewat POST agar tautan di email tidak
// mengeksekusi aksi hanya karena dibuka/pra-render oleh klien email.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const email = searchParams.get("email") || "";
    const token = searchParams.get("token") || "";
    const adminKey = searchParams.get("secret") || "";

    // 1. Token pemulihan TIDAK dieksekusi via GET
    if (token && action !== "check") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Penebusan token pemulihan hanya dapat dilakukan melalui POST. Buka halaman pemulihan dan konfirmasikan di sana.",
        },
        { status: 405 }
      );
    }

    // 2. Cek status akun pengguna (wajib admin secret ATAU token valid milik email tsb)
    if (action === "check" && email) {
      const viaSecret = isValidAdminSecret(adminKey);
      let viaToken = false;
      if (!viaSecret && token) {
        const verified = verifyRecoveryToken(token);
        viaToken = Boolean(
          verified.valid &&
          verified.email &&
          verified.email.toLowerCase() === email.trim().toLowerCase()
        );
      }
      if (!viaSecret && !viaToken) {
        return NextResponse.json(
          { error: "Tidak terotorisasi. Sertakan secret admin atau token pemulihan yang valid." },
          { status: 401 }
        );
      }
      const status = getUserSecurityStatus(email);
      return NextResponse.json(status);
    }

    // 3. Admin: List suspended users (wajib admin secret, timing-safe)
    if (action === "list") {
      if (!isValidAdminSecret(adminKey)) {
        return NextResponse.json({ error: "Akses ditolak. Secret administrator tidak valid." }, { status: 403 });
      }
      const all = loadRegistryFromFile();
      const list = Object.values(all);
      return NextResponse.json({ list });
    }

    return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
  } catch (err) {
    // Jangan kembalikan isi error internal (path, konfigurasi env) ke klien.
    console.error("Admin security GET error:", err);
    return NextResponse.json({ error: "Gagal memproses permintaan keamanan." }, { status: 500 });
  }
}

// POST Handler: Admin Actions (Unban, Generate Token, Redeem Token)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, adminEmail, adminSecret, token } = body;

    // A. Siswa menebus token pemulihan dari email (SEKALI PAKAI)
    if (action === "verify_token" || action === "redeem_token") {
      const consumed = consumeRecoveryToken(token);
      if (!consumed.valid || !consumed.email) {
        return NextResponse.json(
          { success: false, message: "Kode pemulihan tidak valid, telah kedaluwarsa, atau sudah pernah dipakai." },
          { status: 400 }
        );
      }

      // Email target SELALU diambil dari token (terikat saat token dibuat),
      // tidak pernah dari input klien.
      const targetEmail = consumed.email;
      if (email && email.trim().toLowerCase() !== targetEmail.toLowerCase()) {
        return NextResponse.json(
          { success: false, message: "Token pemulihan tidak cocok dengan email yang diminta." },
          { status: 400 }
        );
      }

      unsuspendUserAccount(targetEmail, "Token Verifikasi");

      return NextResponse.json({
        success: true,
        message: "Akun berhasil dipulihkan! Akses ChatZAP Anda telah aktif kembali.",
        email: targetEmail,
      });
    }

    // B. Verifikasi hak admin (timing-safe, fail-closed bila env belum diset)
    if (!isValidAdminSecret(adminSecret)) {
      return NextResponse.json(
        { error: "Otorisasi ditolak. Tindakan ini hanya dapat dilakukan oleh Administrator resmi dengan kredensial valid." },
        { status: 403 }
      );
    }

    // C. Admin Unsuspend Akun secara langsung berdasarkan email
    if (action === "unban" || action === "unsuspend") {
      if (!email) {
        return NextResponse.json({ error: "Email pengguna yang ingin di-unban diperlukan." }, { status: 400 });
      }

      unsuspendUserAccount(email, adminEmail || "Superadmin Wakhid");
      const recoveryToken = createRecoveryToken(email);

      return NextResponse.json({
        success: true,
        message: `Akun ${email} berhasil dipulihkan secara resmi di server!`,
        email,
        recoveryToken,
        recoveryUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/unban?token=${encodeURIComponent(recoveryToken)}`,
      });
    }

    // D. Admin generate recovery link / token untuk dibalas ke email siswa
    if (action === "generate_recovery") {
      if (!email) {
        return NextResponse.json({ error: "Email diperlukan." }, { status: 400 });
      }

      const recoveryToken = createRecoveryToken(email);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const recoveryUrl = `${appUrl}/unban?token=${encodeURIComponent(recoveryToken)}`;

      return NextResponse.json({
        success: true,
        email,
        recoveryToken,
        recoveryUrl,
        emailTemplate: `Halo,\n\nPermohonan pemulihan akun ChatZAP Anda (${email}) telah disetujui oleh Administrator.\n\nKlik tautan berikut untuk memulihkan akun Anda:\n${recoveryUrl}\n\nAtau gunakan kode pemulihan berikut (berlaku maksimal 24 jam dan hanya dapat dipakai satu kali):\n${recoveryToken}\n\nSalam,\nWakhid Pangestu\nChatZAP Administrator`,
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (err) {
    console.error("Admin security POST error:", err);
    return NextResponse.json({ error: "Gagal memproses tindakan keamanan." }, { status: 500 });
  }
}

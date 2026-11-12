"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ZapLogo from "@/components/ZapLogo";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ArrowRight,
  ShieldCheck,
  Mail,
  KeyRound,
  Sparkles,
} from "lucide-react";

function UnbanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [unbannedEmail, setUnbannedEmail] = useState<string>("");

  const verifyToken = async (tokenToVerify: string) => {
    const cleanToken = tokenToVerify.trim();
    if (!cleanToken) return;

    setStatus("verifying");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/security?token=${encodeURIComponent(cleanToken)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        setMessage(data.message || "Akun Anda berhasil dipulihkan secara penuh oleh Administrator.");
        setUnbannedEmail(data.email || "");

        // Bersihkan status sanksi di peramban lokal
        if (typeof window !== "undefined") {
          localStorage.removeItem("zap_account_suspended");
          localStorage.removeItem("zap_jailbreak_strikes");
        }
      } else {
        setStatus("error");
        setMessage(data.message || data.error || "Token pemulihan tidak valid atau sudah kedaluwarsa.");
      }
    } catch {
      setStatus("error");
      setMessage("Terjadi kesalahan jaringan saat memverifikasi token pemulihan. Pastikan koneksi internet aktif.");
    }
  };

  useEffect(() => {
    const urlToken =
      searchParams.get("token") || searchParams.get("unban_token") || searchParams.get("code") || "";
    if (urlToken) {
      setTokenInput(urlToken);
      verifyToken(urlToken);
    } else {
      setStatus("idle");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-slate-900 dark:selection:text-white">
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />

      {/* Header bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2.5 py-1 group">
          <ZapLogo className="w-7 h-7 sm:w-8 sm:h-8 text-slate-900 dark:text-white transition-transform group-hover:scale-105" />
          <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">ChatZAP</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10">
            Account Recovery
          </span>
        </Link>
        <Link
          href="/chat"
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition py-1.5 px-2.5 min-h-[32px] rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/[0.06] flex items-center gap-1.5"
        >
          <span>Masuk ke Chat</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#14151a]/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 sm:p-7 shadow-xl dark:shadow-2xl dark:shadow-black/60 space-y-6">
          {/* VERIFYING STATE */}
          {status === "verifying" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <RotateCw className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">Memverifikasi Tautan Pemulihan...</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Menghubungkan ke server verifikasi keamanan ChatZAP. Mohon tunggu sejenak.
                </p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === "success" && (
            <div className="text-center py-4 space-y-5 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Akun Berhasil Dipulihkan!</h1>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                  Status penangguhan akun Anda telah resmi dicabut oleh Administrator resmi (Wakhid Pangestu).
                </p>
              </div>

              {/* Status card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-left text-xs space-y-2">
                {unbannedEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Email Akun:</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">{unbannedEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Status Akses:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Aktif Normal (0 Strike)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Zero Answer Policy:</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">Terproteksi CAS SymPy</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/chat")}
                className="w-full py-3 px-4 min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>Mulai Belajar di ChatZAP Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ERROR STATE */}
          {status === "error" && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">Tautan Pemulihan Tidak Valid</h1>
                <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                  {message || "Token ini mungkin sudah kedaluwarsa atau telah digunakan sebelumnya."}
                </p>
              </div>

              {/* Input fallback */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] space-y-3">
                <label htmlFor="unban-token-error-input" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Punya kode token pemulihan lain dari Admin?
                </label>
                <div className="flex gap-2">
                  <input
                    id="unban-token-error-input"
                    type="text"
                    aria-label="Kode token pemulihan dari Admin"
                    placeholder="Contoh: ZAP-..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="flex-1 px-3 py-2 min-h-[38px] text-xs rounded-lg bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => verifyToken(tokenInput)}
                    disabled={!tokenInput.trim()}
                    className="px-3.5 py-2 min-h-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-40 text-xs font-medium dark:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    Verifikasi
                  </button>
                </div>
              </div>

              <div className="pt-2 text-center space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Butuh bantuan permohonan baru? Silakan email langsung:
                </p>
                <a
                  href="mailto:wakhidpangestu1@gmail.com"
                  className="inline-flex items-center gap-1.5 py-1.5 px-2 min-h-[32px] text-xs text-rose-700 dark:text-rose-300 hover:text-slate-900 dark:hover:text-white font-mono underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>wakhidpangestu1@gmail.com</span>
                </a>
              </div>
            </div>
          )}

          {/* IDLE STATE: Buka langsung tanpa token di URL */}
          {status === "idle" && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white inline-flex items-center justify-center gap-2">
                  <KeyRound className="w-5 h-5 text-slate-700 dark:text-slate-200 shrink-0" />
                  <span>Pemulihan Akun ChatZAP</span>
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed text-pretty">
                  Masukkan token pemulihan yang Anda terima dari balasan email Administrator untuk membuka blokir akun Anda.
                </p>
              </div>

              <div className="space-y-3">
                <label htmlFor="unban-token-idle-input" className="sr-only">
                  Masukkan Kode Token Pemulihan
                </label>
                <input
                  id="unban-token-idle-input"
                  type="text"
                  aria-label="Masukkan Kode Token (ZAP-...)"
                  placeholder="Masukkan Kode Token (ZAP-...)"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-[40px] text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                />

                <button
                  type="button"
                  onClick={() => verifyToken(tokenInput)}
                  disabled={!tokenInput.trim()}
                  className="w-full py-2.5 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 disabled:opacity-40 dark:text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-slate-800" />
                  <span>Pulihkan Akun Sekarang</span>
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-slate-600 dark:text-slate-400">
                Permohonan pemulihan akun dapat diajukan ke:{" "}
                <a
                  href="mailto:wakhidpangestu1@gmail.com"
                  className="inline-flex items-center py-1 px-1 min-h-[28px] font-mono text-slate-800 dark:text-slate-300 underline"
                >
                  wakhidpangestu1@gmail.com
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-600 dark:text-slate-400">
        &copy; 2026 ChatZAP - Zero Answer Policy Socratic AI. Dilindungi Invarian CAS SymPy.
      </footer>
    </div>
  );
}

export default function UnbanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs">
          Memuat sistem pemulihan...
        </div>
      }
    >
      <UnbanContent />
    </Suspense>
  );
}

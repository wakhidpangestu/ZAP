"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { type ZAPUser } from "@/components/GoogleAuthButton";
import ZapLogo from "@/components/ZapLogo";
import { clearLocalWorkingSession } from "@/utils/account-sync";
import { markSessionCookie } from "@/lib/session-cookie";
import {
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  GraduationCap,
  LogOut,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [existingUser, setExistingUser] = useState<ZAPUser | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentRole, setStudentRole] = useState<"siswa" | "mahasiswa" | "pendidik">("siswa");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Periksa apakah user sudah login di localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zap_authenticated_user");
      if (saved) {
        try {
          const parsed: ZAPUser = JSON.parse(saved);
          if (parsed && parsed.name) {
            markSessionCookie();
            setExistingUser(parsed);
          }
        } catch (e) {
          console.warn("User parse error:", e);
        }
      }
    }
  }, []);

  const handleUserChange = (u: ZAPUser | null) => {
    if (u) {
      setExistingUser(u);
      if (typeof window !== "undefined") {
        window.location.href = "/chat";
      } else {
        router.push("/chat");
      }
    }
  };

  const handleSwitchAccount = () => {
    clearLocalWorkingSession();
    setExistingUser(null);
  };

  const handleDirectStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearLocalWorkingSession();

    const finalName = studentName.trim() || "Siswa Tamu";
    const newUser: ZAPUser = {
      id: "usr_" + Date.now().toString(36),
      name: finalName,
      email: `${finalName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@student.zap`,
      provider: "zap",
      tier: "standard",
      role: studentRole,
      jenjang: "Tamu",
      isGuest: true,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("zap_authenticated_user", JSON.stringify(newUser));
      markSessionCookie();
      window.location.href = "/chat";
    } else {
      router.push("/chat");
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col justify-between bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 selection:text-slate-900 dark:selection:text-white relative overflow-hidden">
      {/* Background radial atmosphere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[260px] bg-slate-900/[0.02] dark:bg-white/[0.02] blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#0f172a08_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Top Header (Compact & Crisp) */}
      <header className="h-12 sm:h-14 px-4 sm:px-8 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] relative z-10 backdrop-blur-md flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 py-1.5 px-1 min-h-[32px] hover:opacity-90 transition group">
          <ZapLogo className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 dark:text-white transition-transform group-hover:scale-105" />
          <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white">ChatZAP</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-white/[0.08] hidden sm:inline-block">
            Socratic CAS
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition py-1.5 px-2.5 min-h-[32px] rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/[0.05]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </Link>
      </header>

      {/* Main Login Area (Zero-Scroll Single Viewport) */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0 relative z-10">
        <div className="w-full max-w-[360px] sm:max-w-[390px] bg-white dark:bg-[#121317] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 sm:p-6 shadow-xl dark:shadow-2xl relative space-y-4">
          {/* Header Card (Compact) */}
          <div className="text-center space-y-1.5">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-white inline-flex items-center justify-center gap-2">
              <ZapLogo className="w-5 h-5 text-slate-900 dark:text-white shrink-0" />
              <span>Masuk ke ChatZAP</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-[280px] mx-auto leading-relaxed text-pretty">
              Bimbingan aljabar Sokratik bertenaga SymPy CAS tanpa membocorkan kunci jawaban.
            </p>
          </div>

          {/* KONDISI 1: User Sudah Memiliki Sesi Aktif */}
          {existingUser ? (
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] flex items-center gap-3">
                {existingUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={existingUser.avatar}
                    alt={existingUser.name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-700 dark:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {existingUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {existingUser.name}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                    {existingUser.email}
                  </div>
                  {(existingUser.isGuest === true || (existingUser.provider === "zap" && existingUser.email?.toLowerCase().includes("@student.zap"))) && (
                    <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase">
                      {existingUser.role || "Tamu"} • {existingUser.jenjang || "Tamu"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/chat";
                  }}
                  className="w-full py-2.5 px-3 min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Lanjutkan ke ChatZAP</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="w-full py-2 px-3 min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Ganti Akun</span>
                </button>
              </div>
            </div>
          ) : (
            /* KONDISI 2: Form Login Normal (1 Tombol Google + Opsi Tamu Cepat) */
            <div className="space-y-3.5">
              {/* Opsi Utama: Google Sign-In */}
              <div className="space-y-1.5">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center font-medium">
                  Masuk dengan Akun Google
                </div>
                <GoogleAuthButton onUserChange={handleUserChange} />
              </div>

              {/* Divider Pemisah Halus */}
              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
                <span className="flex-shrink mx-2.5 text-xs uppercase font-mono tracking-wider text-slate-500 dark:text-zinc-400">
                  atau coba mode tamu
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
              </div>

              {/* Form Masuk Cepat / Tamu Mandiri */}
              <form onSubmit={handleDirectStudentLogin} className="space-y-2.5">
                <div>
                  <label htmlFor="guest-student-name" className="sr-only">
                    Nama lengkap atau panggilan
                  </label>
                  <div className="relative">
                    <input
                      id="guest-student-name"
                      type="text"
                      aria-label="Nama kamu (misal: Budi / Siti)"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Nama kamu (misal: Budi / Siti)"
                      className="w-full bg-slate-50 dark:bg-[#17181d] border border-slate-200 dark:border-white/[0.1] focus:border-slate-500 dark:focus:border-white/40 focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-xl px-3 py-2.5 min-h-[38px] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400 transition outline-none"
                    />
                    <UserIcon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Peran Segmented Toggle */}
                <div
                  role="group"
                  aria-label="Pilih peran pengguna"
                  className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#17181d] border border-slate-200 dark:border-white/[0.08] rounded-xl"
                >
                  {[
                    { id: "siswa", label: "Siswa" },
                    { id: "mahasiswa", label: "Mahasiswa" },
                    { id: "pendidik", label: "Pendidik" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={studentRole === item.id}
                      onClick={() => setStudentRole(item.id as "siswa" | "mahasiswa" | "pendidik")}
                      className={`py-1.5 min-h-[32px] text-xs font-medium rounded-lg transition-all text-center select-none cursor-pointer ${
                        studentRole === item.id
                          ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/15"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-white/[0.02]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Tombol Submit Tamu */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-3 min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Menyiapkan Sesi..." : "Mulai Sesi Tamu"}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}

          {/* Jaminan Sistem & Kebijakan Nol Jawaban (Trust Footer) */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
            <span className="truncate">
              Zero-Answer Policy • CAS SymPy • Privasi Lokal
            </span>
          </div>
        </div>
      </main>

      {/* Footer Minimalis */}
      <footer className="h-9 sm:h-10 px-4 text-center flex items-center justify-center text-xs text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-white/[0.06] relative z-10 backdrop-blur-md flex-shrink-0">
        <span>© 2026 ChatZAP • Logicodix 2026 Hackathon • Zero Answer Policy</span>
      </footer>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { type ZAPUser } from "@/components/GoogleAuthButton";
import UserAvatar, { cleanAvatarUrl } from "@/components/UserAvatar";
import { SiteHeader } from "@/components/site/SiteHeader";
import { clearLocalWorkingSession, saveAccountSessionToken } from "@/utils/account-sync";
import { markSessionCookie } from "@/lib/session-cookie";
import {
  ArrowRight,
  CheckCircle2,
  LogOut,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";

/**
 * Catatan: alur "Lupa kata sandi?" sudah DIHAPUS (permintaan pemilik,
 * 14 Nov 2026). Penggantian kata sandi hanya bisa dilakukan administrator
 * lewat penerbitan kode pemulihan (POST /api/admin/security), bukan
 * self-service dari halaman ini.
 */
type AuthMode = "login" | "signup" | "guest";

export default function LoginPage() {
  const router = useRouter();

  const [existingUser, setExistingUser] = useState<ZAPUser | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zap_authenticated_user");
      if (saved) {
        try {
          const parsed: ZAPUser = JSON.parse(saved);
          if (parsed && parsed.name) {
            parsed.avatar = cleanAvatarUrl(parsed.avatar);
            markSessionCookie();
            setExistingUser(parsed);
          }
        } catch (e) {
          console.warn("User parse error:", e);
        }
      }
    }
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const completeSessionLogin = (userObj: ZAPUser) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("zap_authenticated_user", JSON.stringify(userObj));
      localStorage.setItem("zap_last_active_user_email", userObj.email.toLowerCase().trim());
      markSessionCookie();
      window.location.href = "/chat";
    } else {
      router.push("/chat");
    }
  };

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

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "signup" ? "signup" : "login",
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Gagal memproses autentikasi.");
        setIsSubmitting(false);
        return;
      }

      clearLocalWorkingSession();
      // Simpan token sesi (HMAC) agar sinkronisasi vault terenkripsi bisa
      // dipakai akun email/password tanpa Google ID token.
      if (typeof data.sessionToken === "string" && data.sessionToken.trim()) {
        saveAccountSessionToken(data.sessionToken);
      }
      completeSessionLogin(data.user as ZAPUser);
    } catch {
      setErrorMsg("Gagal terhubung ke server. Periksa koneksi Anda dan coba lagi.");
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    clearLocalWorkingSession();

    const finalName = guestName.trim() || "Tamu ChatZAP";
    const slug = finalName.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "") || "guest";
    const newUser: ZAPUser = {
      id: "usr_" + Date.now().toString(36),
      name: finalName,
      email: `${slug}@guest.chatzap.web.id`,
      provider: "zap",
      tier: "standard",
      isGuest: true,
    };

    completeSessionLogin(newUser);
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#fbf7f0] dark:bg-[#0d0907] text-slate-900 dark:text-zinc-100 font-sans selection:bg-[#d9772f]/20 selection:text-[#1c120c] dark:selection:text-[#f5e9dc]">
      {/* Ambient surface: static and cheap, no continuous animation */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(rgba(28,18,12,0.055)_0.7px,transparent_0.8px)] [background-size:24px_24px] dark:bg-[radial-gradient(rgba(255,247,236,0.06)_0.7px,transparent_0.8px)]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(240,122,30,0.14),transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(240,122,30,0.10),transparent_68%)]" />

      <SiteHeader />

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-5 pt-20 sm:pt-24">
        <div className="flex max-h-full w-full max-w-[410px] flex-col overflow-y-auto overscroll-contain rounded-[14px] border border-[#e6dacb] bg-[#fffdf8] p-5 shadow-[0_22px_60px_-32px_rgba(42,14,14,0.42)] [scrollbar-width:none] dark:border-[#2c2118] dark:bg-[#17110c] dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)] [&::-webkit-scrollbar]:hidden sm:p-6">
          {/* Brand Header */}
          <div className="text-center">
            <h1 className="text-[20px] font-bold tracking-[-0.03em] text-[#1c120c] dark:text-[#f5e9dc] sm:text-[22px]">
              {existingUser
                ? "Sesi Aktif Ditemukan"
                : mode === "login"
                ? "Masuk ke ChatZAP"
                : mode === "signup"
                ? "Buat Akun ChatZAP"
                : mode === "guest"
                ? "Masuk sebagai Tamu"
                : "Atur Ulang Kata Sandi"}
            </h1>
            <p className="mx-auto mt-1.5 max-w-[310px] text-[11.5px] leading-relaxed text-[#8a7969] dark:text-[#b7a28e]">
              {existingUser
                ? "Lanjutkan sesi penalaran matematika Anda"
                : mode === "login"
                ? "Gunakan akun Google, email, atau masuk cepat sebagai tamu"
                : mode === "signup"
                ? "Daftar gratis untuk menyimpan riwayat obrolan dan progres belajar"
                : mode === "guest"
                ? "Cukup isi nama panggilan Anda untuk langsung mencoba ChatZAP"
                : "Masukkan email akun Anda beserta kata sandi baru"}
            </p>
          </div>

          <div className="mt-4">
          {existingUser ? (
            /* ACTIVE SESSION VIEW */
            <div className="space-y-4 pt-1">
              <div className="p-3.5 rounded-[10px] bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-3">
                <UserAvatar
                  name={existingUser.name}
                  email={existingUser.email}
                  avatar={existingUser.avatar}
                  isGuest={existingUser.isGuest}
                  size="lg"
                />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {existingUser.name}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-[#8a7969] dark:text-[#b7a28e] truncate">
                    {existingUser.isGuest ? "Akun Tamu" : existingUser.email}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/chat";
                  }}
                  className="w-full py-2.5 px-4 min-h-[40px] rounded-[10px] bg-[#09090b] hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-[#09090b] font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                >
                  <span>Lanjutkan ke ChatZAP</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="w-full py-2.5 px-4 min-h-[38px] rounded-[10px] bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.09] text-slate-700 dark:text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Ganti Akun</span>
                </button>
              </div>
            </div>
          ) : (
            /* AUTHENTICATION FORMS */
            <div className="space-y-4">
              {/* Top Mode Switcher Tabs (Masuk / Daftar / Tamu) */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-[#f4ece1] dark:bg-white/[0.04] border border-[#e6dacb] dark:border-white/[0.07]">
                {(
                  [
                    { id: "login", label: "Masuk" },
                    { id: "signup", label: "Daftar" },
                    { id: "guest", label: "Akun Tamu" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchMode(tab.id)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      mode === tab.id
                        ? "bg-[#fffdf8] dark:bg-white/[0.10] text-[#1c120c] dark:text-[#f5e9dc] shadow-2xs"
                        : "text-[#8a7969] dark:text-[#b7a28e] hover:text-slate-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Alert Messages */}
              {errorMsg && (
                <div className="p-3 rounded-[10px] bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-[10px] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* MODE 1 & 2: LOGIN OR SIGNUP */}
              {(mode === "login" || mode === "signup") && (
                <>
                  {/* Google OAuth Button */}
                  <div className="pt-0.5 w-full flex items-center justify-center bg-transparent" style={{ colorScheme: "light" }}>
                    <GoogleAuthButton onUserChange={handleUserChange} />
                  </div>

                  {/* Divider */}
                  <div className="relative flex py-0.5 items-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
                    <span className="flex-shrink mx-3 text-[11px] text-[#a08d7c] dark:text-[#8f7864]">
                      atau dengan email
                    </span>
                    <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
                  </div>

                  {/* Email & Password Form */}
                  <form onSubmit={handleCredentialsSubmit} className="space-y-3">
                    {mode === "signup" && (
                      <div>
                        <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                          Nama Lengkap
                        </label>
                        <div className="relative">
                          <input
                            id="auth-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nama lengkap Anda"
                            className="w-full bg-[#fbf7f0] dark:bg-white/[0.035] border border-[#e6dacb] dark:border-white/[0.09] focus:border-[#d9772f] dark:focus:border-[#ffb35c]/60 rounded-[10px] pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition outline-none"
                          />
                          <UserIcon className="w-3.5 h-3.5 text-[#a08d7c] dark:text-[#8f7864] absolute left-3.5 top-3 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <input
                          id="auth-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@email.com"
                          className="w-full bg-[#fbf7f0] dark:bg-white/[0.035] border border-[#e6dacb] dark:border-white/[0.09] focus:border-[#d9772f] dark:focus:border-[#ffb35c]/60 rounded-[10px] pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition outline-none"
                        />
                        <Mail className="w-3.5 h-3.5 text-[#a08d7c] dark:text-[#8f7864] absolute left-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                          Kata Sandi
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === "signup" ? "Minimal 6 karakter" : "Masukkan kata sandi"}
                          className="w-full bg-[#fbf7f0] dark:bg-white/[0.035] border border-[#e6dacb] dark:border-white/[0.09] focus:border-[#d9772f] dark:focus:border-[#ffb35c]/60 rounded-[10px] pl-9 pr-9 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition outline-none"
                        />
                        <Lock className="w-3.5 h-3.5 text-[#a08d7c] dark:text-[#8f7864] absolute left-3.5 top-3 pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 min-h-[40px] rounded-[10px] bg-[#09090b] hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-[#09090b] font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer shadow-xs disabled:opacity-60 mt-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <span>{mode === "login" ? "Masuk" : "Buat Akun"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Bottom mode toggle */}
                  <div className="text-center text-xs text-[#8a7969] dark:text-[#b7a28e] pt-1">
                    {mode === "login" ? (
                      <>
                        Belum punya akun?{" "}
                        <button
                          type="button"
                          onClick={() => switchMode("signup")}
                          className="font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer"
                        >
                          Daftar sekarang
                        </button>
                      </>
                    ) : (
                      <>
                        Sudah punya akun?{" "}
                        <button
                          type="button"
                          onClick={() => switchMode("login")}
                          className="font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer"
                        >
                          Masuk di sini
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* MODE 3: GUEST ACCOUNT (ONLY NAME REQUIRED) */}
              {mode === "guest" && (
                <form onSubmit={handleGuestLogin} className="space-y-3.5 pt-1">
                  <div>
                    <label htmlFor="guest-name-input" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Nama Anda
                    </label>
                    <div className="relative">
                      <input
                        id="guest-name-input"
                        type="text"
                        autoFocus
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Masukkan nama Anda (misal: Budi)"
                        className="w-full bg-[#fbf7f0] dark:bg-white/[0.035] border border-[#e6dacb] dark:border-white/[0.09] focus:border-[#d9772f] dark:focus:border-[#ffb35c]/60 rounded-[10px] pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition outline-none"
                      />
                      <UserIcon className="w-3.5 h-3.5 text-[#a08d7c] dark:text-[#8f7864] absolute left-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 min-h-[40px] rounded-[10px] bg-[#09090b] hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-[#09090b] font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <span>{isSubmitting ? "Menyiapkan Sesi..." : "Masuk sebagai Tamu"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
                    <span className="flex-shrink mx-3 text-[11px] text-[#a08d7c] dark:text-[#8f7864]">
                      atau masuk permanen
                    </span>
                    <div className="flex-grow border-t border-slate-200 dark:border-white/[0.08]" />
                  </div>

                  <div className="w-full flex items-center justify-center bg-transparent" style={{ colorScheme: "light" }}>
                    <GoogleAuthButton onUserChange={handleUserChange} />
                  </div>
                </form>
              )}

            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}

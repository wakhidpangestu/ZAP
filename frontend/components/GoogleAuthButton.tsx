"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { GoogleLogo } from "@/components/CompanyLogos";
import { syncAccountBackup, restoreAccountData, clearLocalWorkingSession, saveGoogleIdToken } from "@/utils/account-sync";
import { markSessionCookie } from "@/lib/session-cookie";
import {
  LogOut,
  ChevronDown,
  User,
  Check,
  Sparkles,
} from "lucide-react";

export interface ZAPUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  jenjang?: string;
  provider: "google" | "zap";
  tier: "standard" | "pro";
  isGuest?: boolean;
}

interface GoogleAuthButtonProps {
  onUserChange?: (user: ZAPUser | null) => void;
  className?: string;
  variant?: "default" | "sidebar-profile" | "avatar-only";
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt?: () => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              shape?: string;
              text?: string;
              logo_alignment?: string;
              width?: number | string;
            }
          ) => void;
        };
      };
    };
  }
}

// Decode Google JWT
function decodeGoogleJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn("Gagal mengurai JWT Google:", e);
    return null;
  }
}

export default function GoogleAuthButton({
  onUserChange,
  className = "",
  variant = "default",
}: GoogleAuthButtonProps) {
  const [user, setUser] = useState<ZAPUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isGsiReady, setIsGsiReady] = useState(false);
  const [gsiBusy, setGsiBusy] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const gsiNativeBtnRef = useRef<HTMLDivElement>(null);

  // Handle Google Credential Response
  const handleGoogleCredentialResponse = useCallback(
    (response: { credential: string }) => {
      const payload = decodeGoogleJwt(response.credential);
      if (payload) {
        // Simpan ID token agar sinkronisasi vault bisa diautentikasi ke server.
        saveGoogleIdToken(response.credential);
        const realGoogleUser: ZAPUser = {
          id: payload.sub || "usr_" + Math.random().toString(36).substring(2, 9),
          name: payload.name || "Pengguna Google",
          email: payload.email || "user@gmail.com",
          avatar: payload.picture || undefined,
          provider: "google",
          tier: "standard",
          isGuest: false,
        };

        setUser(realGoogleUser);
        if (typeof window !== "undefined") {
          const lastEmail = localStorage.getItem("zap_last_active_user_email")?.toLowerCase().trim();
          if (lastEmail && lastEmail !== realGoogleUser.email.toLowerCase().trim()) {
            clearLocalWorkingSession();
          }
          localStorage.setItem("zap_authenticated_user", JSON.stringify(realGoogleUser));
          markSessionCookie();
          // Pulihkan data sesi & konfigurasi akun dari cloud
          restoreAccountData(realGoogleUser).finally(() => {
            if (window.location.pathname.includes("/login")) {
              window.location.href = "/chat";
            }
          });
        }
        onUserChange?.(realGoogleUser);
      }
    },
    [onUserChange]
  );

  // 1. Baca user tersimpan dari localStorage saat mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedUser = localStorage.getItem("zap_authenticated_user");
        if (savedUser) {
          const parsed: ZAPUser = JSON.parse(savedUser);
          setUser(parsed);
          // Catatan: Jangan panggil onUserChange di mount untuk menghindari redirect loop di halaman /login
        }
      } catch (e) {
        console.warn("Gagal membaca user dari localStorage:", e);
      }
    }
  }, []);

  // 2. Setup Google Identity Services (GSI) jika client ID tersedia di environment & bukan localhost yang belum terdaftar origin-nya
  useEffect(() => {
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!envClientId?.trim() || user) return;
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      return;
    }

    let timer: NodeJS.Timeout;

    // Muat skrip GSI secara malas: saat interaksi pertama pengguna, atau
    // sesudah 6 detik diam (pengguna yang membaca dulu tetap mendapat
    // tombol native tanpa perlu klik dua kali). Tombol kustom adalah
    // tampilan awal di semua halaman. Skrip tidak pernah dimuat dua kali.
    const idleHandle: { id?: ReturnType<typeof setTimeout> } = {};
    const ensureGsiScript = (onReady: () => void) => {
      if (typeof window === "undefined") return;
      if (window.google?.accounts?.id) {
        onReady();
        return;
      }
      const existing = document.getElementById("gsi-client-script") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", onReady, { once: true });
        return;
      }
      const s = document.createElement("script");
      s.id = "gsi-client-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.addEventListener("load", onReady, { once: true });
      document.head.appendChild(s);
    };

    const setupGoogleGSI = () => {
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: envClientId.trim(),
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          if (gsiNativeBtnRef.current) {
            gsiNativeBtnRef.current.innerHTML = "";
            window.google.accounts.id.renderButton(gsiNativeBtnRef.current, {
              theme: "outline",
              size: "large",
              shape: "pill",
              text: "signin_with",
              logo_alignment: "left",
              width: 320,
            });
            setIsGsiReady(true);
          }
        } catch (err) {
          console.warn("GSI initialization error:", err);
        }
      } else {
        timer = setTimeout(setupGoogleGSI, 300);
      }
    };

    const kickOff = () => ensureGsiScript(setupGoogleGSI);
    const interactionEvents: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "touchstart"];
    interactionEvents.forEach((ev) =>
      document.addEventListener(ev, kickOff, { once: true, passive: true })
    );
    idleHandle.id = setTimeout(kickOff, 6000);
    return () => {
      clearTimeout(timer);
      if (idleHandle.id) clearTimeout(idleHandle.id);
      interactionEvents.forEach((ev) => document.removeEventListener(ev, kickOff));
    };
  }, [user, handleGoogleCredentialResponse]);

  // Close dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Muat skrip GSI atas permintaan (dipakai jalur klik tombol fallback).
  // Resolve true bila library Google siap dipakai, false bila gagal/timeout.
  const loadGsiScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if (window.google?.accounts?.id) return resolve(true);
      const existing = document.getElementById("gsi-client-script") as HTMLScriptElement | null;
      const script = existing ?? document.createElement("script");
      let done = false;
      const finish = (ok: boolean) => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      script.addEventListener("load", () => finish(!!window.google?.accounts?.id), { once: true });
      script.addEventListener("error", () => finish(false), { once: true });
      setTimeout(() => finish(!!window.google?.accounts?.id), 5000);
      if (!existing) {
        script.id = "gsi-client-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  };

  // Inisialisasi GSI + render tombol native (cermin logika efek pemuatan).
  const initAndRenderGsi = () => {
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (typeof window === "undefined" || !window.google?.accounts?.id || !envClientId?.trim()) return;
    try {
      window.google.accounts.id.initialize({
        client_id: envClientId.trim(),
        callback: handleGoogleCredentialResponse,
        auto_select: false,
      });
      if (gsiNativeBtnRef.current) {
        gsiNativeBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(gsiNativeBtnRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          logo_alignment: "left",
          width: 320,
        });
        setIsGsiReady(true);
      }
    } catch (err) {
      console.warn("GSI initialization error:", err);
    }
  };

  // Jalan terakhir bila skrip Google benar-benar tidak terjangkau (offline):
  // profil lokal instan. BUKAN jalur normal tombol Google.
  const applyFastFallbackUser = (customName?: string) => {
    const defaultUser: ZAPUser = {
      id: "usr_google_" + Date.now().toString(36),
      name: customName || "Pengguna Google",
      email: "user@gmail.com",
      avatar: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      provider: "google",
      tier: "standard",
      isGuest: false,
    };

    if (typeof window !== "undefined") {
      const lastEmail = localStorage.getItem("zap_last_active_user_email")?.toLowerCase().trim();
      if (lastEmail && lastEmail !== defaultUser.email.toLowerCase().trim()) {
        clearLocalWorkingSession();
      }
      localStorage.setItem("zap_authenticated_user", JSON.stringify(defaultUser));
      markSessionCookie();
      // Pulihkan data sesi & konfigurasi akun dari cloud
      restoreAccountData(defaultUser).finally(() => {
        if (window.location.pathname.includes("/login")) {
          window.location.href = "/chat";
        }
      });
    }
    setUser(defaultUser);
    onUserChange?.(defaultUser);
    setDropdownOpen(false);
  };

  // Klik tombol fallback "Login dengan Google": jalur Google asli selalu
  // didahulukan. Bila library GSI belum termuat (pemuatan malas), muat
  // sekarang, render tombol native, dan picu One Tap. Profil instan hanya
  // dipakai bila skrip Google gagal dimuat sama sekali.
  const handleFastGoogleLogin = (customName?: string) => {
    if (typeof window === "undefined") return;
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      // Origin localhost tidak terdaftar di Google Cloud Console; pertahankan
      // kenyamanan dev dengan profil instan.
      applyFastFallbackUser(customName);
      return;
    }
    if (window.google?.accounts?.id) {
      initAndRenderGsi();
      try {
        window.google.accounts.id.prompt?.();
      } catch (e) {
        console.warn("One tap prompt:", e);
      }
      return;
    }
    setGsiBusy(true);
    loadGsiScript().then((ok) => {
      setGsiBusy(false);
      if (ok && window.google?.accounts?.id) {
        initAndRenderGsi();
        try {
          window.google.accounts.id.prompt?.();
        } catch (e) {
          console.warn("One tap prompt:", e);
        }
      } else {
        applyFastFallbackUser(customName);
      }
    });
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      if (user) {
        try {
          await syncAccountBackup(user);
        } catch (e) {
          console.warn("Gagal auto-backup sebelum logout:", e);
        }
      }
      clearLocalWorkingSession();
      window.location.href = "/login";
    }
    setUser(null);
    onUserChange?.(null);
    setDropdownOpen(false);
  };

  // VARIANT A: AVATAR ONLY (Untuk Header / Toolbar)
  if (variant === "avatar-only") {
    if (!user) {
      return (
        <Link
          href="/login"
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition"
        >
          Masuk
        </Link>
      );
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-7 h-7 rounded-full ring-1 ring-white/20 hover:ring-white/40 transition flex items-center justify-center overflow-hidden cursor-pointer"
          title={user.name}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-700 text-white flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 liquid-glass-popup rounded-2xl p-2 z-50 text-xs text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-top-right">
            <div className="px-2.5 py-2 border-b border-slate-100 dark:border-white/[0.08] mb-1">
              <div className="font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{user.email}</div>
              {/* Hanya tampilkan peran/jenjang untuk akun tamu non-Google */}
              {(user.isGuest === true || (user.provider === "zap" && user.email?.toLowerCase().includes("@student.zap"))) && (
                <div className="text-[9px] font-mono text-slate-400 dark:text-zinc-400 mt-0.5 uppercase">
                  {user.role || "Tamu"} • {user.jenjang || "Tamu"}
                </div>
              )}
            </div>
            <Link
              href="/connector"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
              <span>Model &amp; Connector</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition text-left mt-1 border-t border-slate-100 dark:border-white/[0.06] pt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // VARIANT B: SIDEBAR PROFILE CHIP
  if (variant === "sidebar-profile") {
    if (!user) {
      return (
        <Link
          href="/login"
          className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition"
        >
          <User className="w-3.5 h-3.5" />
          <span>Masuk Akun</span>
        </Link>
      );
    }

    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-label={`Menu profil ${user.name}`}
          className="flex items-center justify-between w-full px-2 py-1.5 min-h-[36px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer transition text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-700 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">{user.email}</div>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 bottom-full mb-2 w-full liquid-glass-popup rounded-2xl p-2 z-50 text-xs text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-bottom">
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-white/[0.08] mb-1">
              <div className="font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{user.email}</div>
            </div>
            <Link
              href="/connector"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
              <span>Connector &amp; API Keys</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition text-left mt-1 border-t border-slate-100 dark:border-white/[0.06] pt-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // VARIANT C: DEFAULT (Untuk Halaman Login)
  if (user) {
    return (
      <div className="w-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-700 text-white flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <div className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span>{user.name}</span>
              <Check className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="text-[11px] text-zinc-400">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full pt-1">
          <Link
            href="/chat"
            className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs text-center transition"
          >
            Lanjut ke ChatZAP
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition"
          >
            Ganti Akun
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      {/* 
        Native Google GSI Container:
        Menampilkan tombol resmi Google yang langsung memicu popup Google Account Chooser.
        Saat ready, hanya wadah ini yang aktif (1 single button).
      */}
      <div
        ref={gsiNativeBtnRef}
        className={isGsiReady ? "flex items-center justify-center w-full min-h-[44px]" : "hidden"}
      />

      {/* 
        Fallback Button:
        Hanya tampil jika skrip Google GSI sedang memuat atau offline.
        Begitu GSI siap, tombol ini otomatis digantikan oleh tombol resmi Google di atas.
      */}
      {!isGsiReady && (
        <button
          type="button"
          onClick={() => handleFastGoogleLogin()}
          disabled={gsiBusy}
          className="w-full max-w-[320px] min-h-[40px] flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 dark:bg-white dark:hover:bg-zinc-100 text-slate-900 font-medium text-xs transition shadow-sm active:scale-[0.98] cursor-pointer border border-slate-200 dark:border-zinc-200 select-none disabled:opacity-60 disabled:cursor-wait"
        >
          <GoogleLogo className="w-4 h-4 flex-shrink-0" />
          <span>{gsiBusy ? "Menghubungkan ke Google…" : "Login dengan Google"}</span>
        </button>
      )}
    </div>
  );
}

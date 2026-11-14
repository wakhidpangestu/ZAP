"use client";

import React from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Laptop,
  Lock as LockIcon,
  LogOut,
  Moon,
  RotateCw,
  Settings,
  ShieldAlert,
  Sun,
  X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { type ZAPUser } from "@/components/GoogleAuthButton";
import { ConnectorHubIcon } from "@/components/chat/PluginConnectorModal";
import { isGuestAccount, restoreAccountData, syncAccountBackup } from "@/utils/account-sync";

export interface AdminSuspendedRecord {
  email: string;
  strikes: number;
  isSuspended: boolean;
  reason?: string;
  suspendedAt?: number;
  unbannedAt?: number;
}

export interface AdminActionResult {
  success: boolean;
  message: string;
  token?: string;
  url?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ZAPUser | null;
  setCurrentUser: (user: ZAPUser | null) => void;
  conversationsCount: number;
  settingsTab: "appearance" | "general" | "sync" | "models" | "admin";
  setSettingsTab: (tab: "appearance" | "general" | "sync" | "models" | "admin") => void;
  vaultState: "unconfigured" | "locked" | "unlocked";
  vaultPassphrase: string;
  setVaultPassphrase: (v: string) => void;
  vaultRecoveryCode: string;
  vaultBusy: boolean;
  vaultError: string | null;
  vaultNotice: string | null;
  onVaultSetup: () => void;
  onVaultUnlock: () => void;
  onVaultLock: () => void;
  syncSuccessToast: boolean;
  setSyncSuccessToast: (v: boolean) => void;
  theme: string;
  setTheme: (nextTheme: "light" | "dark", anchorEl?: HTMLElement | null) => void;
  isProjectorMode: boolean;
  setIsProjectorMode: (v: boolean) => void;
  autoScrollChat: boolean;
  setAutoScrollChat: (v: boolean) => void;
  isAccountSuspended: boolean;
  jailbreakStrikes: number;
  onResetSecurityStatus: () => void;
  onLogout: () => void;
  adminSecretInput: string;
  setAdminSecretInput: (v: string) => void;
  adminTargetEmail: string;
  setAdminTargetEmail: (v: string) => void;
  adminUnbanLoading: boolean;
  onAdminUnbanUser: (email?: string) => void;
  adminActionResult: AdminActionResult | null;
  adminCopiedLink: boolean;
  setAdminCopiedLink: (v: boolean) => void;
  adminCopiedDraft: boolean;
  onAdminCopyDraft: (text: string) => void;
  adminSuspendedList: AdminSuspendedRecord[];
  adminLoadingList: boolean;
  onFetchAdminSuspendedList: () => void;
  notify: (text: string, tone?: "info" | "error") => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  setCurrentUser,
  conversationsCount,
  settingsTab,
  setSettingsTab,
  vaultState,
  vaultPassphrase,
  setVaultPassphrase,
  vaultRecoveryCode,
  vaultBusy,
  vaultError,
  vaultNotice,
  onVaultSetup,
  onVaultUnlock,
  onVaultLock,
  syncSuccessToast,
  setSyncSuccessToast,
  theme,
  setTheme,
  isProjectorMode,
  setIsProjectorMode,
  autoScrollChat,
  setAutoScrollChat,
  isAccountSuspended,
  jailbreakStrikes,
  onResetSecurityStatus,
  onLogout,
  adminSecretInput,
  setAdminSecretInput,
  adminTargetEmail,
  setAdminTargetEmail,
  adminUnbanLoading,
  onAdminUnbanUser,
  adminActionResult,
  adminCopiedLink,
  setAdminCopiedLink,
  adminCopiedDraft,
  onAdminCopyDraft,
  adminSuspendedList,
  adminLoadingList,
  onFetchAdminSuspendedList,
  notify,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const isSuperadmin =
    currentUser?.email?.toLowerCase().trim() === "wakhidpangestu1@gmail.com";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zap-settings-title"
        className="rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200/90 dark:border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] w-full max-w-[440px] max-h-[88vh] flex flex-col overflow-hidden animate-liquid-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <h2
              id="zap-settings-title"
              className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight"
            >
              Pengaturan Akun
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Profil, tampilan, dan preferensi sesi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pengaturan"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Superadmin Switcher */}
        {isSuperadmin && (
          <div className="px-5 pt-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setSettingsTab("general")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  settingsTab !== "admin"
                    ? "bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                Preferensi Akun
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("admin")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  settingsTab === "admin"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Superadmin</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-zinc-700 dark:text-zinc-300">
          {settingsTab !== "admin" && (
            <>
              {/* 0. VAULT TERENKRIPSI (ZERO-KNOWLEDGE) */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <LockIcon className="w-3.5 h-3.5" />
                      <span>Sinkronisasi Terenkripsi (Zero-Knowledge)</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                      {isGuestAccount(currentUser)
                        ? "Akun tamu tidak memakai sinkronisasi cloud."
                        : vaultState === "unlocked"
                        ? "Vault terbuka di perangkat ini. Percakapan & kunci API diunggah sebagai ciphertext."
                        : vaultState === "locked"
                        ? "Vault terkunci. Buka dengan passphrase untuk memuat percakapan & kunci API dari cloud."
                        : "Belum ada vault. Buat passphrase vault untuk mengaktifkan cadangan terenkripsi lintas perangkat."}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                      vaultState === "unlocked"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : vaultState === "locked"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-zinc-200 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300"
                    }`}
                  >
                    {vaultState === "unlocked"
                      ? "TERBUKA"
                      : vaultState === "locked"
                      ? "TERKUNCI"
                      : "BELUM ADA"}
                  </span>
                </div>

                {!isGuestAccount(currentUser) && vaultState !== "unlocked" && (
                  <div className="space-y-1.5">
                    <input
                      type="password"
                      autoComplete="new-password"
                      aria-label="Passphrase vault"
                      placeholder="Passphrase vault (min. 8 karakter)"
                      value={vaultPassphrase}
                      onChange={(e) => setVaultPassphrase(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onVaultSetup}
                        disabled={vaultBusy || vaultPassphrase.trim().length < 8}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {vaultBusy ? "Memproses…" : "Buat vault baru"}
                      </button>
                      <button
                        type="button"
                        onClick={onVaultUnlock}
                        disabled={vaultBusy || !vaultPassphrase.trim() || vaultState !== "locked"}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-[#ece6db] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        Buka vault
                      </button>
                    </div>
                    {vaultError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{vaultError}</p>
                    )}
                  </div>
                )}

                {vaultRecoveryCode && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Simpan kode pemulihan ini sekarang (hanya ditampilkan sekali):
                    </p>
                    <code className="block text-[11px] font-mono break-all text-amber-900 dark:text-amber-200">
                      {vaultRecoveryCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(vaultRecoveryCode).then(
                          () => notify("Kode pemulihan disalin. Simpan di tempat aman.", "info"),
                          () => notify("Gagal menyalin. Salin manual kode di atas.", "error")
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition cursor-pointer"
                    >
                      Salin kode
                    </button>
                  </div>
                )}

                {vaultNotice && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    {vaultNotice}
                  </p>
                )}

                {vaultState === "unlocked" && !isGuestAccount(currentUser) && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) return;
                        void syncAccountBackup(currentUser).then((ok) =>
                          notify(
                            ok
                              ? "Vault terenkripsi tersinkron ke cloud."
                              : "Sinkronisasi gagal/ditunda. Periksa koneksi atau status vault.",
                            ok ? "info" : "error"
                          )
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-semibold transition cursor-pointer"
                    >
                      Sinkronkan sekarang
                    </button>
                    <button
                      type="button"
                      onClick={onVaultLock}
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-[#ece6db] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Kunci vault
                    </button>
                  </div>
                )}
              </div>

              {/* 1. Profile Summary Card */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={currentUser?.name}
                    email={currentUser?.email}
                    avatar={currentUser?.avatar}
                    isGuest={isGuestAccount(currentUser)}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                        {currentUser?.name || "Pengguna ChatZAP"}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 shrink-0">
                        {isGuestAccount(currentUser)
                          ? "Tamu"
                          : currentUser?.provider === "google"
                          ? "Google"
                          : "Akun"}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {isGuestAccount(currentUser)
                        ? `${conversationsCount} percakapan tersimpan di perangkat`
                        : currentUser?.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                    onClick={() => {
                      if (!currentUser) return;
                      syncAccountBackup(currentUser);
                      restoreAccountData(currentUser).then((r) => {
                        if (r.user) setCurrentUser(r.user);
                      });
                      setSyncSuccessToast(true);
                      setTimeout(() => setSyncSuccessToast(false), 2500);
                    }}
                  title="Sinkronkan cadangan akun"
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#f3efe7] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-zinc-200/90 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 font-medium text-[11px] flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-2xs"
                >
                  {syncSuccessToast ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Tersinkron</span>
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-3 h-3" />
                      <span>Sinkron</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2. Clean Switch Rows (Tema, Proyektor, Auto-scroll) */}
              <div className="divide-y divide-zinc-100 dark:divide-white/[0.06] border-y border-zinc-100 dark:border-white/[0.06]">
                {/* Mode Gelap Switch */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                      {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-medium text-xs text-zinc-900 dark:text-white">Mode Gelap</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {theme === "dark" ? "Tampilan gelap aktif" : "Tampilan terang aktif"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Mode Gelap"
                    aria-checked={theme === "dark"}
                    onClick={(event) => {
                      const nextTheme = theme === "dark" ? "light" : "dark";
                      setTheme(nextTheme, event.currentTarget);
                      if (currentUser) syncAccountBackup(currentUser, { configs: { theme: nextTheme } });
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      theme === "dark" ? "bg-white" : "bg-zinc-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                        theme === "dark" ? "translate-x-4 bg-[#09090b]" : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>

                {/* Mode Proyektor Switch */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                      <Laptop className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-xs text-zinc-900 dark:text-white">
                        Mode Kontras Kanvas
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Pertebal garis koordinat 2D/3D untuk layar proyektor
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Mode Kontras Kanvas"
                    aria-checked={isProjectorMode}
                    onClick={() => setIsProjectorMode(!isProjectorMode)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isProjectorMode ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                        isProjectorMode ? "translate-x-4 bg-white dark:bg-[#09090b]" : "translate-x-0 bg-white dark:bg-zinc-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Auto-scroll Switch */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-xs text-zinc-900 dark:text-white">
                        Auto-scroll Pesan
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Gulir otomatis saat balasan baru tiba
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Gulir otomatis percakapan"
                    aria-checked={autoScrollChat}
                    onClick={() => setAutoScrollChat(!autoScrollChat)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoScrollChat ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                        autoScrollChat ? "translate-x-4 bg-white dark:bg-[#09090b]" : "translate-x-0 bg-white dark:bg-zinc-400"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. Security Strike Notice (Only if flagged) */}
              {(isAccountSuspended || jailbreakStrikes > 0) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300">
                    {isAccountSuspended
                      ? "Akun ditangguhkan"
                      : `Peringatan keamanan (${jailbreakStrikes}/2)`}
                  </span>
                  <button
                    type="button"
                    onClick={onResetSecurityStatus}
                    className="px-2.5 py-1 rounded-lg bg-[#09090b] text-white dark:bg-white dark:text-[#09090b] text-[11px] font-semibold cursor-pointer"
                  >
                    Reset Status
                  </button>
                </div>
              )}

              {/* 4. Quick Footer Actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Link
                  href="/connector"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-[#ece6db]/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <ConnectorHubIcon className="w-3.5 h-3.5" />
                  <span>Model &amp; API Keys</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-3.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </>
          )}

          {/* 5. SUPERADMIN SECURITY CONSOLE TAB */}
          {settingsTab === "admin" && isSuperadmin && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-900 dark:text-rose-200">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Pusat Kendali Keamanan Superadmin (Wakhid Pangestu)</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                    Superadmin Mode
                  </span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                  Kelola permohonan pemulihan akun siswa yang terkena sanksi penangguhan akibat percobaan jailbreak.
                  Anda dapat membuka blokir langsung berdasarkan email atau menghasilkan link/kode pemulihan 1-klik untuk dibalas ke email siswa.
                </p>
              </div>

              {/* Form Buka Blokir & Draf Balasan */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-white">
                  Buka Blokir Pengguna Berdasarkan Email
                </h3>
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-secret-input"
                    className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Admin Secret (disimpan sementara di tab ini)
                  </label>
                  <input
                    id="admin-secret-input"
                    type="password"
                    autoComplete="off"
                    aria-label="Admin secret untuk otorisasi aksi keamanan"
                    placeholder="Secret administrator (ADMIN_SECRET di server)"
                    value={adminSecretInput}
                    onChange={(e) => {
                      setAdminSecretInput(e.target.value);
                      try {
                        if (e.target.value.trim()) {
                          sessionStorage.setItem("zap_admin_secret", e.target.value.trim());
                        } else {
                          sessionStorage.removeItem("zap_admin_secret");
                        }
                      } catch {}
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Semua aksi di panel ini ditolak server tanpa secret yang valid. Secret tidak
                    pernah dikirim ke peramban lain dan hilang saat tab ditutup.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    aria-label="Email siswa yang ingin dibuka blokirnya"
                    placeholder="Masukkan email siswa (misal: user@gmail.com)"
                    value={adminTargetEmail}
                    onChange={(e) => setAdminTargetEmail(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => onAdminUnbanUser()}
                    disabled={adminUnbanLoading || !adminTargetEmail.trim() || !adminSecretInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5"
                  >
                    {adminUnbanLoading ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Buka Blokir Sekarang</span>
                  </button>
                </div>

                {/* Hasil Aksi Admin */}
                {adminActionResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-2 animate-fade-in ${
                      adminActionResult.success
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                        : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200"
                    }`}
                  >
                    <div className="font-semibold">{adminActionResult.message}</div>
                    {adminActionResult.token && (
                      <div className="space-y-1.5 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                        <div className="text-[11px]">
                          <strong>Kode Pemulihan:</strong>{" "}
                          <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 select-all">
                            {adminActionResult.token}
                          </span>
                        </div>
                        <div className="text-[11px] truncate">
                          <strong>Link 1-Klik:</strong>{" "}
                          <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300 underline select-all">
                            {adminActionResult.url}
                          </span>
                        </div>
                        <div className="pt-1 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (adminActionResult.url) {
                                navigator.clipboard.writeText(adminActionResult.url);
                                setAdminCopiedLink(true);
                                setTimeout(() => setAdminCopiedLink(false), 2500);
                              }
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            {adminCopiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{adminCopiedLink ? "Tautan Berhasil Disalin!" : "Salin Tautan 1-Klik"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const template = `Halo,\n\nPermohonan pemulihan akun ChatZAP Anda (${adminTargetEmail}) telah disetujui.\n\nKlik tautan berikut untuk langsung membuka blokir akun Anda secara otomatis:\n${adminActionResult.url}\n\nAtau masukkan kode pemulihan ini pada kotak banner ChatZAP:\n${adminActionResult.token}\n\nSalam,\nWakhid Pangestu\nChatZAP Administrator`;
                              onAdminCopyDraft(template);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            {adminCopiedDraft ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{adminCopiedDraft ? "Draf Balasan Tersalin!" : "Salin Draf Balasan Email"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Daftar Pengguna Terflag / Suspended di Server */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-xs text-zinc-900 dark:text-white">
                    Daftar Rekam Keamanan Pengguna ({adminSuspendedList.length})
                  </h5>
                  <button
                    type="button"
                    onClick={onFetchAdminSuspendedList}
                    disabled={adminLoadingList}
                    className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${adminLoadingList ? "animate-spin" : ""}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {adminSuspendedList.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic py-2">
                    Belum ada pengguna yang tercatat melakukan pelanggaran jailbreak.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {adminSuspendedList.map((rec) => (
                      <div
                        key={rec.email}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#15161b] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="font-mono font-medium text-zinc-900 dark:text-white truncate">
                            {rec.email}
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                rec.isSuspended
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                                  : rec.unbannedAt
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                              }`}
                            >
                              {rec.isSuspended
                                ? "DITANGGUHKAN"
                                : rec.unbannedAt
                                ? "DIPULIHKAN"
                                : `STRIKE ${rec.strikes}/2`}
                            </span>
                            {rec.reason && (
                              <span className="text-zinc-400 dark:text-zinc-400 truncate max-w-xs">
                                {rec.reason}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAdminUnbanUser(rec.email)}
                          disabled={adminUnbanLoading}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-medium transition cursor-pointer whitespace-nowrap shadow-xs"
                        >
                          Buka Blokir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ZapLogo from "@/components/ZapLogo";
import RichChatText from "@/components/RichChatText";
import { useTheme } from "@/utils/theme";
import {
  Share2,
  Check,
  ArrowRight,
  Sparkles,
  User,
  Clock,
  Box,
  Copy,
  Sun,
  Moon,
  ExternalLink,
  MessageSquare,
  Lock,
} from "lucide-react";

interface ShareMessage {
  id: string;
  sender: "user" | "assistant";
  steps?: string[];
  rawText?: string;
  diagnosis?: Record<string, unknown>;
  replyText?: string;
  modelName?: string;
  timestamp: string;
  smartboardItem?: Record<string, unknown>;
  feedback?: "up" | "down" | null;
  attachedFiles?: Array<{ name: string; size: number; type: string }>;
}

interface SharedData {
  shareId: string;
  conversationId?: string;
  title: string;
  authorName?: string;
  sharedAt: number;
  messages: ShareMessage[];
  targetVar?: string;
  active3DModel?: string;
}

export default function SharedChatView({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadShared() {
      try {
        setLoading(true);
        const res = await fetch(`/api/chat/share?id=${encodeURIComponent(shareId)}`);
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 403 || json.isRevoked) {
            throw new Error("Tautan publik percakapan ini telah dinonaktifkan oleh pemiliknya.");
          }
          if (res.status === 404) {
            throw new Error("Percakapan yang dibagikan tidak ditemukan atau belum dipublikasikan oleh pemilik.");
          }
          throw new Error(json.error || "Gagal memuat percakapan dari server.");
        }
        if (json.exists && json.data) {
          if (isMounted) setData(json.data);
        } else {
          throw new Error(json.error || "Data percakapan tidak valid.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat tautan.";
        if (isMounted) setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (shareId) {
      loadShared();
    }
    return () => {
      isMounted = false;
    };
  }, [shareId]);

  const handleCopyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleContinueChat = () => {
    router.push(`/chat?import=${encodeURIComponent(shareId)}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#0d0f12] text-slate-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mb-4 animate-pulse shadow-sm">
          <ZapLogo className="w-6 h-6 text-[#09090b] dark:text-white" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-zinc-400 animate-pulse">
          Memuat riwayat percakapan...
        </p>
      </main>
    );
  }

  if (error || !data) {
    const isRevoked = error?.includes("dinonaktifkan");

    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#0d0f12] text-slate-900 dark:text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div
          className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-5 ${
            isRevoked
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}
        >
          {isRevoked ? <Lock className="w-8 h-8" /> : <Share2 className="w-8 h-8" />}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
          {isRevoked ? "Akses Dibatasi: Tautan Dinonaktifkan" : "Percakapan Tidak Ditemukan"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
          {isRevoked
            ? "Pemilik percakapan ini telah mengunci atau menonaktifkan tautan publik. Percakapan ini tidak lagi dapat diakses oleh publik demi menjaga privasi dan keamanan data."
            : error ||
              "Tautan yang Anda tuju mungkin salah, telah dihapus, atau belum dipublikasikan oleh pemiliknya."}
        </p>
        <div className="flex gap-3">
          <Link
            href="/chat"
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-zinc-950 font-semibold text-sm transition-colors shadow-lg inline-flex items-center gap-2"
          >
            Mulai Chat di ChatZAP
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  const formattedDate = new Date(data.sharedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f12] text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-900 dark:selection:text-sky-200 overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-[#0d0f12]/80 border-b border-slate-200 dark:border-zinc-800/60 px-3 sm:px-8 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <Link href="/chat" className="flex items-center gap-2 py-1 group">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.1] flex items-center justify-center shadow-sm shrink-0">
              <ZapLogo className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
              ChatZAP
            </span>
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/50">
            <Share2 className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
            Shared Chat
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={(event) => toggleTheme(event.currentTarget)}
            aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            title={isDark ? "Mode Terang" : "Mode Gelap"}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            aria-label="Salin tautan percakapan"
            className={`px-2.5 sm:px-3.5 py-2 min-h-[36px] rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
              copied
                ? "bg-slate-200 dark:bg-white/[0.1] border-slate-300 dark:border-white/[0.2] text-slate-900 dark:text-white"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline sm:inline">Tautan Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Salin Tautan</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleContinueChat}
            className="px-3 sm:px-4 py-2 min-h-[36px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Buka di ZAP</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 pb-32">
        {/* Title Header */}
        <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800/60">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            {data.title || "Percakapan Tanpa Judul"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-zinc-300">
              <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              {data.authorName || "Anonim"}
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-zinc-500">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              {formattedDate}
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-zinc-500">•</span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              {data.messages.length} pesan
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="space-y-6">
          {data.messages.map((msg, index) => {
            const isUser = msg.sender === "user";

            if (isUser) {
              return (
                <div key={msg.id || index} className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 pr-1">
                    <span>{data.authorName || "Pengguna"}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-sm leading-relaxed border border-slate-800 dark:border-zinc-700/50 shadow-sm">
                    {msg.steps && msg.steps.length > 0 ? (
                      <div className="space-y-1">
                        {msg.steps.map((st, i) => (
                          <div key={i} className="font-mono text-xs">
                            {st}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.rawText || ""}</div>
                    )}
                  </div>
                </div>
              );
            }

            // Assistant Reply
            return (
              <div key={msg.id || index} className="flex gap-3.5 sm:gap-4 items-start">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <ZapLogo className="w-4 h-4 text-slate-900 dark:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-zinc-200">ChatZAP Socratic</span>
                    {msg.modelName && (
                      <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono">
                        {msg.modelName}
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#14171c]/90 border border-slate-200 dark:border-zinc-800/80 shadow-sm space-y-4">
                    {msg.replyText && (
                      <RichChatText
                        content={msg.replyText}
                        className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed"
                      />
                    )}

                    {/* 3D Smartboard divider section (flattened to avoid nested cards) */}
                    {msg.smartboardItem && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-slate-700 dark:text-zinc-300 shrink-0">
                            <Box className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex flex-wrap items-center gap-1.5">
                              <span>Papan Tulis Virtual 3D</span>
                              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 font-mono">
                                {String(msg.smartboardItem.solidKind || msg.smartboardItem.model || "Geometri 3D")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                              Model geometri interaktif tersedia di Smartboard ChatZAP
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleContinueChat}
                          className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.1] text-xs font-medium transition-colors inline-flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                        >
                          <span>Lihat 3D di ZAP</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-slate-50 via-slate-50/95 dark:from-[#0d0f12] dark:via-[#0d0f12]/95 to-transparent pt-6 pb-6 px-3 sm:px-4">
        <div className="max-w-2xl mx-auto rounded-2xl bg-white/95 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800/90 shadow-2xl backdrop-blur-xl p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-slate-700 dark:text-zinc-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-zinc-200 truncate">
                Lanjutkan percakapan ini
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                Eksplorasi langkah matematika &amp; visualisasi 3D sendiri di ChatZAP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueChat}
            className="px-3.5 sm:px-4 py-2.5 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-xs transition-all shadow-lg shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span>Lanjutkan di ZAP</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

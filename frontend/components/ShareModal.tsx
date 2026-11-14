"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  X,
  ExternalLink,
  Loader2,
  Lock,
  Globe,
  User,
} from "lucide-react";
import { type ZAPUser } from "@/components/GoogleAuthButton";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    id: string;
    title: string;
    messages: Array<unknown>;
    createdAt?: number;
    updatedAt?: number;
    targetVar?: string;
  } | null;
  currentUser: ZAPUser | null;
  active3DModel?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  conversation,
  currentUser,
  active3DModel,
}: ShareModalProps) {
  const [includeAuthor, setIncludeAuthor] = useState<boolean>(true);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [shareId, setShareId] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Escape menutup dialog dari papan tombol.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !conversation) return;

    let isMounted = true;
    async function createShareLink() {
      setIsGenerating(true);
      setError(null);
      setCopied(false);

      try {
        const res = await fetch("/api/chat/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversation?.id,
            title: conversation?.title || "Percakapan ChatZAP",
            messages: conversation?.messages || [],
            authorName: currentUser?.name || "Pengguna ChatZAP",
            authorEmail: currentUser?.email,
            includeAuthor,
            isPublic: true,
            targetVar: conversation?.targetVar || "x",
            active3DModel,
          }),
        });

        const json = await res.json();
        if (json.success && json.sharePath) {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          if (isMounted) {
            setShareId(json.shareId);
            setShareUrl(`${origin}${json.sharePath}`);
            setIsPublic(true);
          }
        } else {
          throw new Error(json.error || "Gagal membuat tautan percakapan");
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat membagikan percakapan.";
          setError(msg);
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setShareUrl(`${origin}/a/chat/s/${conversation?.id || "conv"}`);
        }
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    }

    createShareLink();

    return () => {
      isMounted = false;
    };
  }, [isOpen, conversation, includeAuthor, currentUser, active3DModel]);

  if (!isOpen || !conversation) return null;

  const handleTogglePublic = async (nextState: boolean) => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId,
          conversationId: conversation.id,
          title: conversation.title,
          messages: conversation.messages,
          authorName: currentUser?.name || "Pengguna ChatZAP",
          authorEmail: currentUser?.email,
          includeAuthor,
          isPublic: nextState,
          targetVar: conversation.targetVar,
          active3DModel,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsPublic(nextState);
      } else {
        throw new Error(json.error || "Gagal memperbarui status tautan.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status tautan.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl || !isPublic) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleOpenExternal = () => {
    if (shareUrl && isPublic) {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-[420px] rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200/90 dark:border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] p-5 text-zinc-900 dark:text-zinc-100 flex flex-col gap-4 relative animate-liquid-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Minimalist Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="share-modal-title" className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
              Bagikan Percakapan
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {conversation.title || "Percakapan ChatZAP"} • {conversation.messages.length} pesan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Integrated Link + Copy Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 p-1.5 pl-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/90 dark:border-white/[0.08]">
            <input
              type="text"
              readOnly
              aria-label="Tautan Percakapan"
              value={
                isGenerating
                  ? "Menyiapkan tautan..."
                  : isPublic
                  ? shareUrl
                  : "Tautan dikunci (Privat)"
              }
              className={`w-full bg-transparent text-xs font-mono select-all outline-none truncate ${
                isPublic
                  ? "text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            />
            {isGenerating ? (
              <div className="px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                disabled={!shareUrl || !isPublic}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : isPublic
                    ? "bg-[#09090b] hover:bg-zinc-800 text-white dark:bg-white dark:text-[#09090b] dark:hover:bg-zinc-200"
                    : "bg-zinc-200 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            )}
          </div>
          {error && (
          <p role="alert" className="text-[11px] text-rose-500 px-1">
            {error}
          </p>
        )}
        </div>

        {/* Clean Minimalist Toggle Controls */}
        <div className="divide-y divide-zinc-100 dark:divide-white/[0.06] border-y border-zinc-100 dark:border-white/[0.06]">
          {/* Public Access Switch */}
          <div className="py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Akses tautan publik
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {isPublic ? "Siapa pun dengan tautan dapat membaca" : "Hanya Anda yang dapat mengakses"}
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Akses tautan publik"
              aria-checked={isPublic}
              disabled={isGenerating}
              onClick={() => handleTogglePublic(!isPublic)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4956a] ${
                isPublic ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isPublic
                    ? "translate-x-4 bg-white dark:bg-[#09090b]"
                    : "translate-x-0 bg-white dark:bg-zinc-400"
                }`}
              />
            </button>
          </div>

          {/* Author Attribution Switch */}
          <div className="py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Tampilkan nama saya
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {includeAuthor ? currentUser?.name || "Pengguna ChatZAP" : "Dibagikan secara anonim"}
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Cantumkan nama penulis"
              aria-checked={includeAuthor}
              onClick={() => setIncludeAuthor(!includeAuthor)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4956a] ${
                includeAuthor ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                  includeAuthor
                    ? "translate-x-4 bg-white dark:bg-[#09090b]"
                    : "translate-x-0 bg-white dark:bg-zinc-400"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
          <span>API key &amp; sesi privat tetap aman</span>
          {isPublic && shareUrl && (
            <button
              type="button"
              onClick={handleOpenExternal}
              disabled={isGenerating}
              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium inline-flex items-center gap-1 transition cursor-pointer"
            >
              <span>Pratinjau</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

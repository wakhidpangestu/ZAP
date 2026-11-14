"use client";

import React from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function ConnectorHubIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="14.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="8.5" y="13.5" width="7" height="7" rx="1.8" />
      <path d="M6 10.5v2a2 2 0 0 0 2 2h0.5" />
      <path d="M18 10.5v2a2 2 0 0 1-2 2h-0.5" />
      <path d="M9.5 7h5" />
    </svg>
  );
}

interface PluginConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PluginConnectorModal({ isOpen, onClose }: PluginConnectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plugins dan konektor model"
        className="liquid-glass-popup rounded-3xl w-full max-w-lg p-5 space-y-4 animate-liquid-pop"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <ConnectorHubIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">
              Plugins &amp; Model Connectors
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Konfigurasikan API key untuk NVIDIA NIM, DeepSeek Cloud, ChatGPT OpenAI, Claude Anthropic, atau Custom Local Model (Ollama).
        </p>
        <div className="space-y-2 pt-1">
          <Link
            href="/connector"
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Buka Halaman Lengkap Connector Hub</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

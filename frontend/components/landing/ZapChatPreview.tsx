"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  Box,
  Check,
  ChevronDown,
  FlaskConical,
  History,
  MessageSquareQuote,
  Paperclip,
  Plus,
  Search,
  Send,
  Square,
} from "lucide-react";

import { ZapLogo } from "@/components/ZapLogo";
import LazyRichText from "@/components/chat/LazyRichText";
import LazyMathView from "@/components/chat/LazyMathView";

/**
 * Pratinjau produk ZAP untuk landing page.
 *
 * Prinsipnya: jangan menggambar ulang UI karangan. Panel kanan memakai
 * `InteractiveCanvas3D` — komponen Smartboard yang sama dengan halaman /chat.
 * Balasan asisten dirender `LazyRichText` (markdown + KaTeX) dan baris
 * diagnosis memakai `LazyMathView`, lagi-lagi komponen produksi. Markup kartu
 * diagnosis/CTA disalin dari app/chat/page.tsx agar kelas dan tampilannya
 * identik dengan aplikasi sebenarnya.
 *
 * Kanvas 3D di-lazy-load: three.js baru diunduh ketika pratinjau mendekati
 * viewport, dan render loop-nya dijeda (`paused`) saat keluar layar.
 */
const InteractiveCanvas3D = dynamic(() => import("@/components/InteractiveCanvas3D"), {
  ssr: false,
  loading: () => <CanvasPlaceholder />,
});

const SESSIONS = [
  { title: "Cek: 2x + 6 = 14 → 2x = 20", active: true },
  { title: "Luas permukaan kubus rusuk 6", active: false },
  { title: "Kenapa (a+b)² ≠ a²+b²?", active: false },
  { title: "Turunan x² − 3x + 2", active: false },
];

const USER_MESSAGE = "Cek coretan saya: 2x + 6 = 14 → 2x = 20 → x = 10";

const ASSISTANT_REPLY = [
  "Dari $2x + 6 = 14$, memindahkan $+6$ ke ruas kanan berarti **mengurangkan 6 pada kedua ruas**:",
  "",
  "$$2x = 14 - 6 = 8$$",
  "",
  "Bandingkan dengan barismu ($2x = 20$). Menurutmu, operasi apa yang seharusnya terjadi pada baris kedua?",
].join("\n");

const DIAGNOSIS_LINES = [
  { line_number: 1, raw_latex: "2x + 6 = 14", is_valid: true },
  { line_number: 2, raw_latex: "2x = 20", is_valid: false },
  { line_number: 3, raw_latex: "x = 10", is_valid: false },
];

function WindowChrome() {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-[#f4f1ea] px-4 py-2.5 dark:border-white/[0.07] dark:bg-[#0b0c0f]">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5a3a3]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8d19a]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#a8cfa8]" />
      </div>
      <div className="mx-auto flex max-w-[340px] flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-[10.5px] font-medium text-zinc-500 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="truncate">chatzap.web.id/chat/socratic-studio</span>
      </div>
      <div className="w-12" />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[172px] shrink-0 flex-col border-r border-zinc-200/80 bg-[#f8f6f1] px-3 py-4 dark:border-white/[0.06] dark:bg-[#0c0d10] xl:flex">
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#09090b] text-white dark:bg-white dark:text-[#09090b]">
          <ZapLogo className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-[#09090b] dark:text-white">
          ChatZAP
        </span>
      </div>

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="mb-4 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white text-[11.5px] font-medium text-zinc-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-200"
      >
        <Plus className="h-3.5 w-3.5" />
        Sesi Baru
      </button>

      <div className="mb-2 flex items-center justify-between px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        <span>Riwayat</span>
        <span className="flex items-center gap-1">
          <Search className="h-3 w-3" />
          <History className="h-3 w-3" />
        </span>
      </div>

      <div className="space-y-1">
        {SESSIONS.map((s) => (
          <div
            key={s.title}
            className={`flex items-center gap-2 truncate rounded-lg px-2.5 py-2 text-[11.5px] ${
              s.active
                ? "bg-[#ece6db] font-medium text-[#09090b] dark:bg-white/[0.08] dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <span className="h-1 w-1 shrink-0 rounded-full bg-[#c4956a]" />
            <span className="truncate">{s.title}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-lg border border-zinc-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c4956a] text-[10px] font-bold text-white">
          Z
        </span>
        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-medium text-[#09090b] dark:text-white">Zapyy</div>
          <div className="truncate text-[9.5px] text-zinc-400 dark:text-zinc-500">Akun Tamu</div>
        </div>
      </div>
    </aside>
  );
}

function ChatBody() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-4 py-2.5 dark:border-white/[0.05]">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <Square className="h-3 w-3" />
          <span>Sesi Sokratik</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px]">
          <span className="rounded-full border border-zinc-200/90 bg-white px-2.5 py-1 font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
            Connector
          </span>
          <span className="rounded-full border border-zinc-200/90 bg-white px-2.5 py-1 font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
            Bagikan
          </span>
        </div>
      </div>

      {/* Percakapan */}
      <div className="relative flex-1 overflow-hidden">
        <div className="space-y-2.5 px-4 py-3.5 sm:px-6">
          {/* Pesan siswa — markup & kelas dari app/chat/page.tsx */}
          <div className="group ml-auto flex min-w-0 max-w-[85%] flex-col items-end py-1.5 sm:max-w-[75%]">
            <div className="w-fit max-w-full overflow-hidden break-words rounded-[22px] border border-zinc-200/90 bg-[#f5f3ef] px-4 py-2.5 text-[13.5px] leading-relaxed text-[#09090b] shadow-sm backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.07] dark:text-zinc-100">
              {USER_MESSAGE}
            </div>
          </div>

          {/* Balasan asisten — renderer asli aplikasi */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#09090b] text-white dark:bg-white dark:text-[#09090b]">
                <ZapLogo className="h-3 w-3" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/90 bg-white px-2 py-[3px] text-[9.5px] font-medium text-zinc-600 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Auto-Agent Cerdas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-[3px] text-[9.5px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Check className="h-2.5 w-2.5" />
                SymPy CAS
              </span>
              <span className="ml-auto text-[9.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
                23.06
              </span>
            </div>

            <div className="max-w-full overflow-hidden break-words text-[13.5px] leading-relaxed text-zinc-800 [overflow-wrap:anywhere] dark:text-zinc-100">
              <LazyRichText content={ASSISTANT_REPLY} />
            </div>

            {/* Laporan diagnosis SymPy CAS — markup asli dari app/chat/page.tsx.
                Di bawah md kartu disembunyikan utuh: panel kanan belum tampil,
                ruang chat terlalu pendek, dan kartu akan terpotong composer. */}
            <div className="hidden space-y-2.5 rounded-2xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#14161f]/70 md:block">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Patah Logika Terdeteksi</span>
                </div>
                <span className="font-mono text-[9.5px] text-zinc-400 dark:text-zinc-400">SymPy CAS</span>
              </div>

              <div className="space-y-1">
                {DIAGNOSIS_LINES.map((line) => (
                  <div
                    key={line.line_number}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-mono ${
                      line.is_valid
                        ? "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/[0.06] dark:bg-black/30 dark:text-zinc-300"
                        : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-200"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                      <span className="shrink-0 text-[9.5px] text-zinc-400 dark:text-zinc-400">
                        #{line.line_number}
                      </span>
                      <LazyMathView math={line.raw_latex} />
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[8.5px] font-bold uppercase tracking-wider ${
                        line.is_valid
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {line.is_valid ? "Valid" : "Galat"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-100/80 p-2 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <MessageSquareQuote className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                  <span>Bimbingan Sokratik:</span>
                </div>
                <p className="mt-0.5 text-[10.5px] italic leading-snug text-zinc-800 dark:text-zinc-200">
                  Operasi apa yang seharusnya terjadi pada baris kedua?
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-white/[0.06] dark:bg-black/30">
                <div className="flex items-center gap-1 text-[9.5px] font-medium text-zinc-600 dark:text-zinc-300">
                  <FlaskConical className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                  <span>Kontra-Contoh Substitusi:</span>
                  <span className="ml-auto font-mono text-[9px] text-zinc-500 dark:text-zinc-400">x = 2</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Asal: <span className="font-bold text-emerald-600 dark:text-emerald-400">−4</span>
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Hasilmu: <span className="font-bold text-amber-600 dark:text-amber-400">−16</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 pt-1.5 dark:border-white/[0.06]">
                <span className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 px-2 py-1 text-[9.5px] font-medium text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-zinc-300">
                  <Box className="h-2.5 w-2.5" />
                  Lihat di Papan Tulis Virtual 3D
                </span>
                <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500">Kubus</span>
              </div>
            </div>

          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#101216] dark:via-[#101216]/40"
          />
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-[0_10px_30px_-18px_rgba(9,9,11,0.35)] dark:border-white/[0.08] dark:bg-[#14161b]">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-400 dark:text-zinc-500">
            Tulis soal atau langkah pengerjaanmu…
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#faf4ed] px-2 py-0.5 text-[9.5px] font-medium text-[#8f5e32] dark:bg-white/[0.06] dark:text-[#d4a574] sm:inline-flex">
            Auto-Agent Cerdas
            <ChevronDown className="h-2.5 w-2.5" />
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#09090b] text-white dark:bg-white dark:text-[#09090b]">
            <Send className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

function CanvasPlaceholder({ onActivate }: { onActivate?: () => void }) {
  return (
    <div
      onClick={onActivate}
      className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-50 p-6 text-zinc-500 transition-colors cursor-pointer select-none dark:bg-[#080a0f] dark:text-zinc-400"
    >
      {/* Background isometric grid lines */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40 dark:opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="iso-grid-bg" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 30 M 0 0 L 30 30" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#iso-grid-bg)" />
      </svg>

      {/* Isometric 3D Cube Preview (Identik dengan solid cube r=6cm Smartboard) */}
      <div className="relative z-10 transition-transform duration-500 group-hover:scale-105">
        <svg
          viewBox="0 0 280 240"
          className="h-44 w-52 drop-shadow-[0_12px_24px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_16px_32px_rgba(0,0,0,0.4)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top Face */}
          <polygon
            points="140,35 210,75 140,115 70,75"
            className="fill-amber-500/15 stroke-amber-500/70 dark:fill-amber-400/20 dark:stroke-amber-400/80"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Left Face */}
          <polygon
            points="70,75 140,115 140,195 70,155"
            className="fill-amber-600/25 stroke-amber-600/80 dark:fill-amber-500/30 dark:stroke-amber-400/90"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Right Face */}
          <polygon
            points="140,115 210,75 210,155 140,195"
            className="fill-amber-500/20 stroke-amber-500/75 dark:fill-amber-400/25 dark:stroke-amber-400/85"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Internal hidden dashed edges */}
          <line x1="70" y1="155" x2="140" y2="115" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.35" strokeWidth="1.2" />
          <line x1="210" y1="155" x2="140" y2="115" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.35" strokeWidth="1.2" />
          <line x1="140" y1="35" x2="140" y2="115" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.35" strokeWidth="1.2" />

          {/* Dimension Labels */}
          <text x="96" y="145" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight="600" className="fill-amber-700 dark:fill-amber-300">
            r = 6 cm
          </text>
          <text x="178" y="145" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight="600" className="fill-amber-700 dark:fill-amber-300">
            r = 6 cm
          </text>
          <text x="144" y="68" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight="600" className="fill-amber-700 dark:fill-amber-300">
            r = 6 cm
          </text>
        </svg>
      </div>

      {/* Floating Interactive Badge */}
      <div className="relative z-10 mt-2 flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/90 px-3 py-1 text-[10px] font-medium text-zinc-700 shadow-sm backdrop-blur-xs transition-colors group-hover:border-amber-400/60 group-hover:bg-amber-50/80 group-hover:text-amber-900 dark:border-white/10 dark:bg-black/50 dark:text-zinc-300 dark:group-hover:border-amber-400/40 dark:group-hover:bg-amber-950/40 dark:group-hover:text-amber-200">
        <Box className="h-3 w-3 text-amber-500" />
        <span>Papan Tulis Virtual 3D · Klik atau sentuh untuk memutar</span>
      </div>
    </div>
  );
}

/**
 * Tiga wajah Smartboard yang diperagakan di landing: kubus 3D (default),
 * grafik kurva 2D, lalu papan tulis dengan kursor kolaborator.
 */
const DEMO_SCENES = [
  { id: "3d", scene: { model: "solids" as const, solidKind: "kubus" as const, a: 6, b: 6, c: 6 } },
  { id: "2d", scene: { model: "2d_quadratic" as const, a: 1, b: 0, c: -3 } },
  { id: "papan", scene: { model: "empty" as const } },
] as const;

const DEMO_CURSORS = [
  { name: "Aisyah", color: "#f97316", anim: "zap-cursor-a", duration: 19 },
  { name: "Bima", color: "#0ea5e9", anim: "zap-cursor-b", duration: 24 },
  { name: "Citra", color: "#22c55e", anim: "zap-cursor-c", duration: 21 },
  { name: "Zapyy", color: "#a855f7", anim: "zap-cursor-d", duration: 27 },
];

/** Kursor kolaborator bergerak (gaya Figma). Animasi CSS transform saja. */
function DemoCursors({ paused }: { paused: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {DEMO_CURSORS.map((cursor) => (
        <div
          key={cursor.name}
          className="absolute inset-0 will-change-transform"
          style={{
            animation: `${cursor.anim} ${cursor.duration}s ease-in-out infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <path d="M4 2 L20 11.5 L12.2 13.2 L9.2 21 Z" fill={cursor.color} stroke="#ffffff" strokeWidth="1.7" />
          </svg>
          <span
            className="absolute left-3 top-3 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm"
            style={{ background: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Papan tulis contoh: coretan langkah aljabar di atas kertas berpetak. */
function DemoWhiteboard() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-[#fcfbf8] dark:bg-[#0a0c11]"
    >
      <div
        className="absolute inset-0 opacity-60 dark:opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.28) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center gap-3 px-6 py-10 text-slate-700 dark:text-zinc-200">
        <div className="-rotate-1 w-fit rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 font-mono text-[11px] text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          2x + 6 = 14
        </div>
        <div className="rotate-1 w-fit rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-1.5 font-mono text-[11px] text-rose-900 shadow-sm dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          2x = 20 <span className="ml-1 text-[9px] font-bold uppercase tracking-wider">galat</span>
        </div>
        <div className="-rotate-1 w-fit rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 font-mono text-[11px] text-emerald-900 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
          2x = 8 → x = 4 ✓
        </div>
        <p className="mt-1 w-fit max-w-[85%] -rotate-1 font-serif text-[11px] italic leading-relaxed text-slate-500 dark:text-zinc-400">
          “Operasi apa yang seharusnya terjadi pada baris kedua?”
        </p>
      </div>
    </div>
  );
}

/**
 * Panel kanan = Smartboard asli aplikasi (InteractiveCanvas3D).
 *
 * Komponen ini di-mount saat pratinjau mendekati viewport dan render loop-nya
 * dijeda saat keluar layar, supaya tiga.js tidak membebani halaman landing.
 * Scene berganti otomatis (kubus → kurva 2D → papan) sampai pengunjung
 * menyentuh panelnya, sehingga tidak melawan interaksi manual.
 */
function SmartboardPanel() {
  const ref = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  // Dinaikkan setiap kali pengunjung memilih scene, termasuk saat memilih scene
  // yang sama (mis. setelah menekan Reset). Tanpa ini, memilih ulang "3D" tidak
  // memulihkan kubus karena identitas prop scene tidak berubah.
  const [sceneToken, setSceneToken] = useState(0);
  const [userTookOver, setUserTookOver] = useState(false);

  // Panel hanya tampil mulai lg. Kanvas tidak di-mount di bawah itu: parent
  // berukuran 0 membuat ResizeObserver komponen gagal menyalin kanvas kosong.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setInView(visible);
        if (visible) {
          // Defer Three.js mounting to idle time so it doesn't block initial page load / TBT
          if (typeof window !== "undefined") {
            const win = window as unknown as {
              requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            };
            const idleFn =
              win.requestIdleCallback ||
              ((cb: () => void) => window.setTimeout(cb, 3200));
            idleFn(() => setMounted(true), { timeout: 4000 });
          }
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Peragaan bergantian hanya saat terlihat. Berhenti setelah satu putaran
  // (kubus → kurva → papan → kubus), sehingga perpindahan scene—yang paling
  // mahal karena memicu render ulang Smartboard—terjadi paling banyak 3 kali.
  useEffect(() => {
    if (!mounted || !inView || userTookOver) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let round = 0;
    const id = window.setInterval(() => {
      round += 1;
      setSceneIndex(round % DEMO_SCENES.length);
      if (round >= DEMO_SCENES.length) {
        window.clearInterval(id);
      }
    }, 9000);
    return () => window.clearInterval(id);
  }, [mounted, inView, userTookOver]);

  // Tab 3D / 2D / Papan di dalam Smartboard diarahkan ke preset yang sudah
  // terisi (bukan mode kosong), supaya objek tidak hilang saat berpindah tab.
  const handleSceneChange = useCallback((id: "3d" | "2d" | "papan") => {
    setMounted(true);
    const index = DEMO_SCENES.findIndex((item) => item.id === id);
    if (index >= 0) setSceneIndex(index);
    setSceneToken((token) => token + 1);
    setUserTookOver(true);
  }, []);

  const preview = useMemo(
    () => ({
      scene: { ...DEMO_SCENES[sceneIndex].scene },
      autoRotate: true,
      cameraZoom: 1.16,
      disableWheel: true,
      onSceneChange: handleSceneChange,
    }),
    [sceneIndex, sceneToken, handleSceneChange]
  );

  const isBoardScene = DEMO_SCENES[sceneIndex].id === "papan";

  return (
    <aside
      ref={ref}
      onPointerEnter={() => setMounted(true)}
      onPointerDownCapture={() => {
        setMounted(true);
        setUserTookOver(true);
      }}
      className="hidden w-[45%] min-w-[380px] max-w-[540px] shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50 lg:flex dark:border-white/[0.06] dark:bg-[#080a0f] cursor-pointer"
    >
      <div className="relative flex h-full w-full flex-col bg-zinc-50 dark:bg-[#080a0f]">
        {mounted && isDesktop ? (
          <InteractiveCanvas3D
            initialModel="solids"
            initialSolidKind="kubus"
            initialParamA={6}
            initialParamB={6}
            initialParamC={6}
            initialUnit="cm"
            paused={!inView}
            pauseOnScroll
            collabName="Zapyy"
            hideHud
            hideCopilot
            preview={preview}
          />
        ) : (
          <CanvasPlaceholder onActivate={() => setMounted(true)} />
        )}

        {isBoardScene && <DemoWhiteboard />}
        <DemoCursors paused={!inView} />
      </div>
    </aside>
  );
}

/** Jendela aplikasi ZAP (tajam, tanpa gambar). */
export function ZapChatPreview() {
  return (
    <div className="zap-preview-chrome overflow-hidden rounded-2xl border border-[#e7d8c7] bg-white shadow-[0_50px_120px_-50px_rgba(20,7,4,0.75)] dark:border-white/[0.09] dark:bg-[#101216]">
      <WindowChrome />
      <div className="flex h-[600px] md:h-[760px] lg:h-[790px]">
        <Sidebar />
        <ChatBody />
        <SmartboardPanel />
      </div>
    </div>
  );
}

/**
 * Bingkai pratinjau dengan animasi scroll yang ringan: hanya opacity dan
 * translasi kecil, tanpa tilt, agar jendela aplikasi tidak terasa goyah.
 */
export function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-6 h-[60%] rounded-[16px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,179,92,0.22),transparent_70%)] blur-2xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default ZapChatPreview;

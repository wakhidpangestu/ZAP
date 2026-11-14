"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUp,
  Braces,
  Check,
  ChevronRight,
  Copy,
  Database,
  Info,
  KeyRound,
  Network,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionVisual } from "@/components/docs/SectionVisual";
import {
  addDomainCode,
  backendGuardrailCode,
  chatFlowDiagram,
  cflEngineCode,
  curlChatJson,
  curlChatSse,
  curlDiagnose,
  curlShare,
  curlSync,
  curlVerify,
  diagnoseRequest,
  diagnoseResponse,
  guardrailCode,
  harnessKeyCode,
  harnessMemoryIdCode,
  harnessPromotionCode,
  harnessRetrievalCode,
  harvesterStateCode,
  parserCode,
  runCommands,
  vaultCode,
  vaultEnvelopeExample,
  vaultFlowDiagram,
  verifyResponse,
} from "./snippets";

const SECTIONS = [
  { id: "ringkasan", title: "Ringkasan & prinsip" },
  { id: "arsitektur", title: "Arsitektur" },
  { id: "zero-answer", title: "Zero-Answer Policy" },
  { id: "cfl", title: "Mesin CFL" },
  { id: "harness", title: "Agent harness" },
  { id: "pengetahuan", title: "Basis pengetahuan" },
  { id: "vault", title: "Vault terenkripsi" },
  { id: "api", title: "Referensi API" },
  { id: "konfigurasi", title: "Konfigurasi & self-hosting" },
  { id: "keamanan", title: "Model keamanan" },
  { id: "roadmap", title: "Keterbatasan & roadmap" },
] as const;

/* ------------------------------------------------------------------ atoms */

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[6px] border border-zinc-200/70 bg-white px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 shadow-[0_1px_0_rgba(28,18,12,0.03)] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-zinc-200">
      {children}
    </code>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    let copiedOk = false;
    try {
      await navigator.clipboard.writeText(code);
      copiedOk = true;
    } catch {
      // Sebagian peramban/konteks menolak Clipboard API. Pakai fallback
      // textarea + execCommand supaya tombol tetap berfungsi.
      try {
        const area = document.createElement("textarea");
        area.value = code;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        copiedOk = document.execCommand("copy");
        document.body.removeChild(area);
      } catch {
        copiedOk = false;
      }
    }
    if (!copiedOk) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 shadow-[0_24px_60px_-45px_rgba(28,18,12,0.55)] dark:border-white/[0.09] dark:bg-white/[0.02]">
      <div className="flex items-center gap-2.5 border-b border-zinc-200/70 bg-zinc-50/80 px-3.5 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#e5a3a3]" />
          <span className="h-2 w-2 rounded-full bg-[#e8d19a]" />
          <span className="h-2 w-2 rounded-full bg-[#a8cfa8]" />
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-[#c4956a]/60 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
          aria-label={copied ? "Kode tersalin" : "Salin kode"}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0b0c10] p-4 text-[12.5px] leading-[1.75] text-zinc-100 [scrollbar-width:thin]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function Callout({ kind = "note", children }: { kind?: "note" | "warning"; children: ReactNode }) {
  const isWarning = kind === "warning";
  const Icon = isWarning ? AlertTriangle : Info;
  return (
    <div
      className={`relative my-5 overflow-hidden rounded-xl border p-4 pl-5 ${
        isWarning
          ? "border-amber-500/25 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/[0.06]"
          : "border-zinc-200/80 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] ${
          isWarning
            ? "bg-gradient-to-b from-amber-400 to-amber-600/40"
            : "bg-gradient-to-b from-[#c4956a] to-[#c4956a]/20"
        }`}
      />
      <div className="flex gap-3">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
            isWarning
              ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-[#c4956a]/25 bg-[#c4956a]/10 text-[#a8794f] dark:text-[#d8b48c]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          <span className="mr-1.5 font-semibold text-zinc-900 dark:text-white">
            {isWarning ? "Peringatan" : "Catatan"}:
          </span>
          {children}
        </div>
      </div>
    </div>
  );
}

function MethodChip({ method }: { method: string }) {
  const tone =
    method === "GET"
      ? "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
      : method === "WS"
      ? "border-violet-600/25 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300"
      : "border-[#c4956a]/35 bg-[#c4956a]/10 text-[#8a5f39] dark:border-[#c4956a]/30 dark:text-[#e0bf9c]";
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${tone}`}>
      {method}
    </span>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  // Tabel 2–3 kolom cukup muat di 390px. Tabel lebar (4+ kolom) diberi
  // lebar minimum agar tetap terbaca dan digeser horizontal di dalam kartunya.
  const wide = head.length >= 4;
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white/60 shadow-[0_1px_0_rgba(28,18,12,0.03)] dark:border-white/[0.08] dark:bg-white/[0.02]">
      <table
        className={`w-full border-collapse text-left text-[13px] ${wide ? "min-w-[640px]" : "min-w-0"}`}
      >
        <thead>
          <tr className="bg-zinc-50/90 dark:bg-white/[0.04]">
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-zinc-200/80 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-zinc-200/60 align-top transition-colors first:border-t-0 hover:bg-[#c4956a]/[0.045] dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3.5 py-2.5 text-zinc-600 dark:text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="group relative mb-6 scroll-mt-36 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-5 shadow-[0_1px_2px_rgba(28,18,12,0.03)] transition-colors hover:border-zinc-300/80 sm:p-8 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.12]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c4956a]/50 to-transparent"
      />
      <div className="mb-5 flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#c4956a]/30 bg-[#c4956a]/[0.08] px-2 font-mono text-[11px] font-bold text-[#8a5f39] dark:border-[#c4956a]/25 dark:text-[#e0bf9c]"
          aria-hidden="true"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`${id}-title`}
            className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-zinc-900 sm:text-2xl dark:text-white"
          >
            {title}
          </h2>
          <span aria-hidden="true" className="mt-2 block h-px w-10 bg-[#c4956a]/40" />
        </div>
        <a
          href={`#${id}`}
          aria-label={`Tautan ke bagian ${title}`}
          className="mt-1 hidden rounded-lg border border-transparent p-1.5 text-zinc-300 opacity-0 transition-all hover:border-zinc-200 hover:bg-white hover:text-[#a8794f] group-hover:opacity-100 sm:inline-flex dark:text-zinc-600 dark:hover:border-white/10 dark:hover:bg-white/[0.05] dark:hover:text-[#d8b48c]"
        >
          #
        </a>
      </div>
      <SectionVisual id={id} />
      <div className="docs-prose space-y-4 text-[15px] leading-[1.75] text-zinc-600 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- TOC */

function TocList({ active, compact = false }: { active: string; compact?: boolean }) {
  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((section) => section.id === active)
  );

  if (compact) {
    return (
      <ol className="flex gap-1.5">
        {SECTIONS.map((s, i) => {
          const isActive = active === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  isActive
                    ? "border-[#c4956a]/60 bg-white font-medium text-zinc-900 shadow-sm dark:bg-white/[0.08] dark:text-white"
                    : "border-zinc-200/80 bg-white/60 text-zinc-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400"
                }`}
              >
                <span className={`font-mono text-[9.5px] ${isActive ? "text-[#a8794f] dark:text-[#d8b48c]" : "text-zinc-400 dark:text-zinc-600"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </a>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="relative">
      {/* Rail + indikator kemajuan */}
      <span aria-hidden="true" className="absolute bottom-2 left-[15px] top-2 w-px bg-zinc-200/80 dark:bg-white/10" />
      <span
        aria-hidden="true"
        className="absolute left-[15px] top-2 w-px bg-gradient-to-b from-[#c4956a] to-[#c4956a]/40 transition-[height] duration-300 ease-out"
        style={{ height: `calc(${(activeIndex / Math.max(1, SECTIONS.length - 1)) * 100}% - 8px)` }}
      />
      <ol className="space-y-0.5">
        {SECTIONS.map((s, i) => {
          const isActive = active === s.id;
          const isPast = i < activeIndex;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`group flex items-start gap-3 rounded-xl py-1.5 pl-2.5 pr-2 text-[12.5px] leading-snug transition-colors ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(28,18,12,0.04)] dark:bg-white/[0.07] dark:text-white"
                    : "text-zinc-500 hover:bg-white/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.03] dark:hover:text-zinc-200"
                }`}
              >
                <span
                  className={`relative z-10 mt-[3px] flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isActive
                      ? "border-[#c4956a] bg-[#c4956a]"
                      : isPast
                      ? "border-[#c4956a]/60 bg-[#c4956a]/40"
                      : "border-zinc-300 bg-[#fbf7f0] dark:border-zinc-600 dark:bg-[#0e0f12]"
                  }`}
                />
                <span className={`font-mono text-[10px] leading-4 ${isActive ? "text-[#a8794f] dark:text-[#d8b48c]" : "text-zinc-400 dark:text-zinc-600"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">{s.title}</span>
                <ChevronRight
                  className={`mt-0.5 h-3 w-3 shrink-0 transition-opacity ${
                    isActive ? "opacity-60" : "opacity-0 group-hover:opacity-50"
                  }`}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function DocsClient() {
  const [active, setActive] = useState<string>("ringkasan");
  const [progress, setProgress] = useState(0);

  // Scroll-spy + progres baca. Di-batch lewat rAF dan progres dibulatkan 1%
  // supaya React tidak re-render di setiap frame gulir.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const probe = window.scrollY + 160;
      let current: string = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) current = section.id;
      }
      setActive(current);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const next = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setProgress(Math.round(next * 100) / 100);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    // Di layar kecil, daftar isi adalah scroller horizontal. Geser pil aktif
    // ke tengah supaya scroll-spy tetap terlihat saat pembaca berpindah bagian.
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const link = document.querySelector<HTMLAnchorElement>(
      'nav[aria-label="Daftar isi"] a[aria-current="true"]'
    );
    link?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [active]);

  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((section) => section.id === active)
  );
  const activeTitle = SECTIONS[activeIndex]?.title ?? SECTIONS[0].title;

  const jumpTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Simpan hash tanpa memicu lompatan kedua, supaya tautan bisa dibagikan.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}#${id}`);
    }
  }, []);

  const search = useMemo(
    () => ({
      items: SECTIONS.map((section) => ({ id: section.id, title: section.title })),
      onSelect: jumpTo,
      placeholder: "Cari bagian dokumentasi…",
    }),
    [jumpTo]
  );

  const backToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div id="top" className="relative min-h-screen bg-[#fbf7f0] pt-16 text-zinc-800 dark:bg-[#0b0c0f] dark:text-zinc-200">
      <SiteHeader search={search} />

      {/* Scrim di belakang header mengambang agar konten tidak terlihat menembus */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-16 bg-[#fbf7f0]/80 backdrop-blur-xl dark:bg-[#0b0c0f]/80"
      />

      {/* Latar: glow hangat + pola titik yang memudar ke bawah */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(90%_55%_at_50%_-12%,rgba(196,149,106,0.20),transparent_62%)] dark:bg-[radial-gradient(90%_55%_at_50%_-12%,rgba(255,179,92,0.12),transparent_62%)]" />
        <div
          className="absolute inset-0 opacity-40 dark:opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(28,18,12,0.16) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(to bottom, black, transparent 72%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 72%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-6">
        {/* Hero */}
        <header className="relative mt-8 overflow-hidden rounded-[26px] border border-zinc-200/70 bg-white/70 p-6 shadow-[0_50px_120px_-90px_rgba(28,18,12,0.6)] sm:p-10 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(196,149,106,0.35),transparent_65%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(255,179,92,0.18),transparent_65%)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c4956a]/60 to-transparent"
          />

          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_268px] lg:items-start">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c4956a]/30 bg-[#c4956a]/[0.08] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#8a5f39] dark:border-[#c4956a]/25 dark:text-[#e0bf9c]">
                <Braces className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" /> Dokumentasi teknis · v2026.11
              </span>
              <h1 className="mt-5 text-balance text-[34px] font-black leading-[1.05] tracking-[-0.035em] text-zinc-900 sm:text-[46px] dark:text-white">
                Cara ChatZAP bekerja,{" "}
                <span className="bg-gradient-to-r from-[#a02e1e] via-[#c4956a] to-[#f07a1e] bg-clip-text text-transparent dark:from-[#ffb35c] dark:via-[#ffd6a4] dark:to-[#ff8a4c]">
                  dari guardrail sampai basis data
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-zinc-600 dark:text-zinc-300">
                Referensi lengkap untuk tim teknis, peninjau, dan pengguna yang ingin tahu batas sistem. Isi halaman
                ini dibaca dari kode sumber yang berjalan di repositori ini: nama fungsi, angka batas, status respons,
                dan konsekuensi keamanannya. Tidak ada klaim pemasaran di sini.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link
                  href="/chat"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1c120c] px-4 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-[#1c120c]"
                >
                  Coba ChatZAP
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <a
                  href="#api"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 text-[12.5px] font-semibold text-zinc-700 transition-colors hover:border-[#c4956a]/60 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:text-white"
                >
                  Referensi API
                </a>
                <span className="ml-1 inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#a8794f] dark:text-[#d8b48c]" />
                  Zero-Answer Policy aktif
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                <span>{SECTIONS.length} bagian</span>
                <span aria-hidden="true">·</span>
                <span>±20 menit baca</span>
                <span aria-hidden="true">·</span>
                <span>Diperbarui 14 Nov 2026</span>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                {[
                  { label: "Kebenaran matematis", value: "SymPy CFL deterministik" },
                  { label: "Kebocoran jawaban", value: "disensor berlapis" },
                  { label: "Vault", value: "AES-GCM 256, kunci di peramban" },
                  { label: "Domain", value: "Matematika · Pemrograman · Fisika · Kimia" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl px-2.5 py-2.5 [&+&]:border-t [&+&]:border-zinc-200/60 dark:[&+&]:border-white/[0.06]"
                  >
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[12px] font-medium leading-snug text-zinc-700 dark:text-zinc-200">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile TOC */}
        <nav
          aria-label="Daftar isi"
          className="sticky top-[120px] z-20 -mx-4 mt-8 border-y border-zinc-200/60 bg-[#fbf7f0]/92 px-4 py-2 backdrop-blur-xl lg:hidden dark:border-white/[0.07] dark:bg-[#0b0c0f]/92"
        >
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TocList active={active} compact />
          </div>
        </nav>

        <div className="lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[236px_minmax(0,1fr)_212px] xl:gap-10">
          {/* Desktop TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-36 max-h-[calc(100vh-11rem)] overflow-y-auto pb-8 pt-8 pr-1">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  Daftar isi
                </p>
                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <nav aria-label="Daftar isi bagian">
                <TocList active={active} />
              </nav>
              <div className="mt-6 rounded-2xl border border-zinc-200/70 bg-white/70 p-3.5 text-[11.5px] leading-relaxed text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-zinc-400">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#a8794f] dark:text-[#d8b48c]" /> Prinsip dokumen
                </div>
                Setiap angka dan jalur di halaman ini dapat ditelusuri ke berkas di repositori.
              </div>
              <Link
                href="/chat"
                className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1c120c] text-[12px] font-semibold text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-[#1c120c]"
              >
                Buka ChatZAP
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>

          <main className="min-w-0 pt-8">
            {/* 1 ------------------------------------------------------------- */}
            <Section id="ringkasan" number="01" title="Ringkasan & prinsip">
              <p>
                ChatZAP memisahkan dua pertanyaan yang sering dicampur sistem tutor AI:{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">
                  apakah langkah ini benar secara matematis
                </strong>{" "}
                dan{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">
                  bagaimana mengatakannya dengan bahasa yang manusiawi
                </strong>
                . Pertanyaan pertama dijawab mesin simbolik deterministik. Pertanyaan kedua dijawab model bahasa.
              </p>

              <DataTable
                head={["Lapis", "Penentu", "Boleh melakukan", "Tidak boleh melakukan"]}
                rows={[
                  [
                    <strong key="a">Kebenaran</strong>,
                    <>
                      <Code>SymPy</Code> + mesin CFL (<Code>backend/cfl/</Code>)
                    </>,
                    "Mengurai langkah, membandingkan ekuivalensi, melokalisasi fault pertama, membuat counter-example, memberi status terverifikasi.",
                    "Menyerahkan penilaian validitas ke LLM atau ke tebakan probabilistik.",
                  ],
                  [
                    <strong key="b">Bahasa</strong>,
                    "Model bahasa (Gemini, NVIDIA NIM, BazaarLink, OpenAI, Anthropic, Mistral, atau model lokal)",
                    "Merumuskan pertanyaan Sokratik, empati, klarifikasi, dan penjelasan konsep.",
                    "Menyatakan jawaban akhir, mengubah vonis CFL, atau mengarang rumus yang tidak ada.",
                  ],
                ]}
              />

              <p>
                <strong className="font-semibold text-zinc-900 dark:text-white">Zero-Answer Policy</strong> adalah
                invariant produk: sistem tidak pernah mengeluarkan solusi akhir soal latihan. Yang dikirim adalah
                pertanyaan, petunjuk arah, dan diagnosis pada langkah yang sedang dikerjakan. Penegakannya berlapis:
                instruksi prompt, sanitasi keluaran di backend, dan sanitasi terakhir di{" "}
                <Code>finalizeModelReply()</Code> sebelum teks menyentuh peramban.
              </p>

              <ul className="list-disc space-y-2 pl-5 marker:text-[#c4956a]">
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Determinisme lebih dulu.</strong>{" "}
                  Bila mesin tidak dapat memutuskan, statusnya <Code>UNDECIDABLE_STEP</Code>, bukan vonis salah.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Fail-closed untuk rahasia.</strong>{" "}
                  Endpoint harness menolak permintaan tanpa secret yang cocok saat secret terpasang; di production
                  tanpa secret, endpoint menolak dengan 503.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Isolasi pengguna.</strong> Memori
                  episodik disimpan per <Code>user_key</Code> hash, dan referensi hasil promosi percakapan hanya
                  muncul untuk pemiliknya.                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Batas diakui.</strong> Setiap
                  bagian di bawah menyertakan limitasi yang benar-benar ada di kode, bukan hanya kemampuan.
                </li>
              </ul>

              <Callout>
                Halaman ini adalah dokumentasi, bukan janji SLA. Angka seperti jumlah memori, ukuran korpus, dan
                jumlah pola adalah snapshot saat dokumen ditulis dan akan berubah ketika data bertambah.
              </Callout>
            </Section>

            {/* 2 ------------------------------------------------------------- */}
            <Section id="arsitektur" number="02" title="Arsitektur">
              <p>
                Ada dua proses utama. <strong className="font-semibold text-zinc-900 dark:text-white">Next.js 14</strong>{" "}
                menjalankan UI dan route handler di port 3000.{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">FastAPI</strong> menjalankan CFL,
                harness, korpus, dan relay papan kolaborasi di port 8000. Keduanya berbicara lewat HTTP; rute chat di
                Next bertindak sebagai orchestrator yang memanggil backend dengan secret server-ke-server.
              </p>

              <CodeBlock title="Alur satu giliran chat (mode streaming SSE)" code={chatFlowDiagram} />

              <DataTable
                head={["Komponen", "Lokasi berkas", "Tanggung jawab"]}
                rows={[
                  [
                    "UI chat & Smartboard",
                    <Code key="1">frontend/app/chat/page.tsx</Code>,
                    "Mengirim pesan, menampilkan balasan bertahap, papan geometri, dan status diagnosis.",
                  ],
                  [
                    "Route chat",
                    <Code key="2">frontend/app/api/chat/route.ts</Code>,
                    "Orkestrasi: validasi, deteksi jailbreak, ambil konteks harness, pilih provider, sanitasi, SSE/JSON.",
                  ],
                  [
                    "Guardrail keluaran",
                    <Code key="3">frontend/lib/zero-answer.ts</Code>,
                    "Pintu keluar terakhir: bersihkan artefak penalaran lalu sensor deklarasi jawaban.",
                  ],
                  [
                    "Gateway FastAPI",
                    <Code key="4">backend/main.py</Code>,
                    "Endpoint diagnose/verify/harness, CORS, secret gate, dan WebSocket papan kolaborasi.",
                  ],
                  [
                    "Parser aman",
                    <Code key="5">backend/cfl/parser.py</Code>,
                    "Whitelist-first, batas eksponen, parsing SymPy/LaTeX.",
                  ],
                  [
                    "Mesin CFL",
                    <Code key="6">backend/cfl/cfl_engine.py</Code>,
                    "Membandingkan langkah berurutan, melokalisasi fault, menandai langkah tak dapat diputuskan.",
                  ],
                  [
                    "Klasifikasi & counter-example",
                    <Code key="7">backend/cfl/classifier.py, counter_example.py</Code>,
                    "Menamai miskonsepsi dan mencari substitusi integer kecil yang menunjukkan kontradiksi.",
                  ],
                  [
                    "Harness memori",
                    <Code key="8">backend/data_engine/agent_harness.py</Code>,
                    "Memori episodik, isolasi pengguna, retrieval, profil belajar, umpan balik, promosi korpus.",
                  ],
                  [
                    "Korpus & harvester",
                    <Code key="9">backend/data_engine/store.py, build_corpus.py, harvester.py</Code>,
                    "Penyimpanan SQLite + mirror JSONL, pembangunan korpus, panen sumber internet terverifikasi.",
                  ],
                  [
                    "Vault & sesi akun",
                    <Code key="10">frontend/lib/vault-crypto.ts, vault-session.ts, account-session.ts</Code>,
                    "Enkripsi sisi klien, kunci sesi per tab, token sesi HMAC, sinkronisasi envelope.",
                  ],
                  [
                    "Sinkronisasi cloud",
                    <Code key="11">frontend/app/api/user/sync/route.ts</Code>,
                    "Menerima envelope terenkripsi dan metadata identitas; menolak plaintext yang tidak berhak.",
                  ],
                ]}
              />

              <Callout kind="warning">
                Batas arsitektur yang penting: LLM tidak pernah menjadi penentu benar-salah. Semua penilaian
                matematis berasal dari SymPy melalui CFL. Bila Anda mengganti model bahasa, kebenaran matematis tidak
                berubah - yang berubah hanya kualitas kalimat Sokratiknya.
              </Callout>
            </Section>

            {/* 3 ------------------------------------------------------------- */}
            <Section id="zero-answer" number="03" title="Zero-Answer Policy">
              <p>
                Ada dua implementasi guardrail yang saling melengkapi: satu di backend Python untuk prompt yang
                dihasilkan server, satu di frontend TypeScript untuk semua balasan model sebelum dikirim ke klien.
                Keduanya bekerja dengan pola deklaratif, bukan dengan memahami makna kalimat.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">
                3.1 Guardrail backend: <Code>RobustZeroAnswerGuardrail</Code>
              </h3>
              <p>
                <Code>backend/cfl/guardrail.py</Code> mendefinisikan{" "}
                <Code>DECLARATIVE_ANSWER_PATTERNS</Code>: 11 regex yang menangkap deklarasi jawaban akhir, simpulan
                variabel, nilai geometri, hasil aritmetika, satuan fisika, pH/pOH, output program, dan kompleksitas
                Big-O. Setiap kecocokan diganti dengan{" "}
                <Code>Bagaimanakah menurut analisismu?</Code>. Parameter opsional <Code>final_solution</Code> hanya
                menyensor bila nilai itu muncul setelah penanda <Code>kunci</Code> atau <Code>nilai akhir</Code>,
                sehingga kalimat instruksional seperti <Code>jika x = 2</Code> tetap utuh.
              </p>
              <CodeBlock title="backend/cfl/guardrail.py - sanitize (diringkas)" code={backendGuardrailCode} />
              <p>
                <Code>/api/v1/diagnose</Code> memakai guardrail ini untuk membersihkan <Code>socratic_prompt</Code>,
                lalu menghitung <Code>guardrail_status.final_answer_suppressed</Code> dengan memeriksa ulang teks
                yang benar-benar dikirim terhadap pola yang sama. Status itu bukan klaim kosong: ia dihitung dari
                hasil sanitasi nyata.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">
                3.2 Guardrail frontend: delimiter-aware
              </h3>
              <p>
                Temuan audit 13 November 2026 menunjukkan versi lama hanya mencocokkan teks mentah, sehingga jawaban
                dalam matematika inline/display lolos. Perbaikannya ada di <Code>frontend/lib/zero-answer.ts</Code>:
                seluruh span matematika dinormalisasi lebih dulu, lalu pola lama dijalankan.
              </p>
              <ul className="list-disc space-y-1.5 pl-5 marker:text-[#c4956a]">
                <li>
                  <Code>$$...$$</Code>, <Code>\[...\]</Code>, <Code>\(...\)</Code>, dan <Code>$...$</Code> diperiksa
                  isinya; span yang hanya berisi <Code>variabel = konstanta</Code> diganti placeholder Sokratik.
                </li>
                <li>
                  Baris penuh <Code>x = 4</Code> tanpa delimiter juga disensor oleh pola nomor 11.
                </li>
                <li>
                  Bila <Code>targetVariable</Code> sesi diketahui (misalnya <Code>x</Code>), bentuk{" "}
                  <Code>x = 4</Code> di tengah kalimat ikut disensor tanpa merusak langkah seperti{" "}
                  <Code>2x = 8</Code> atau <Code>x = 8/2</Code>.
                </li>
                <li>
                  Balasan dari provider model melewati <Code>finalizeModelReply()</Code>: bersihkan blok{" "}
                  <Code>&lt;think&gt;</Code>, sanitasi, lalu pakai fallback bila teks yang tersisa terlalu pendek.
                </li>
              </ul>
              <CodeBlock title="frontend/lib/zero-answer.ts - urutan sanitasi" code={guardrailCode} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">3.3 Contoh sebelum dan sesudah</h3>
              <DataTable
                head={["Sebelum", "Sesudah (pola yang berlaku)", "Catatan"]}
                rows={[
                  [
                    <Code key="1">$$x = 4$$</Code>,
                    <Code key="2">[Berapakah nilainya menurut hitunganmu?]</Code>,
                    "Span matematika yang hanya berisi jawaban jadi.",
                  ],
                  [
                    <Code key="3">x = 4</Code>,
                    <Code key="4">[Berapakah nilainya menurut hitunganmu?]</Code>,
                    "Satu baris penuh tanpa delimiter.",
                  ],
                  [
                    <Code key="5">coba hitung x = 4 dulu</Code>,
                    <Code key="6">coba hitung [Berapakah nilainya menurut hitunganmu?] dulu</Code>,
                    "Hanya bila targetVariable = x.",
                  ],
                  [
                    <Code key="7">Jadi x = 4</Code>,
                    <Code key="8">Coba tentukan nilai variabel tersebut berdasarkan penalaranmu</Code>,
                    "Pola kesimpulan (jadi/maka/sehingga).",
                  ],
                  [
                    <Code key="9">jawabannya adalah 4</Code>,
                    <Code key="10">Bagaimanakah menurut analisismu?</Code>,
                    "Deklarasi jawaban eksplisit.",
                  ],
                  [
                    <Code key="11">2x = 8</Code>,
                    <span key="12" className="text-zinc-500 dark:text-zinc-400">
                      tetap <Code>2x = 8</Code>
                    </span>,
                    "Langkah penalaran, bukan kunci jawaban.",
                  ],
                ]}
              />

              <Callout kind="warning">
                Limitasi jujur. (1) Sensor di tengah kalimat membutuhkan <Code>targetVariable</Code> yang diketahui
                dan hanya menerima satu huruf. (2) <Code>final_solution</Code> backend hanya aktif bila nilainya
                didahului penanda kunci/nilai akhir. (3) Semua ini pencocokan regex: parafrase baru, bahasa lain di
                luar pola, atau jawaban yang dipecah dengan cara tak terduga bisa lolos. (4) Pada mode streaming,
                potongan ditahan sampai batas kalimat dan sekitar 48 karakter terakhir, lalu teks final pada event{" "}
                <Code>done</Code> menjadi sumber kebenaran; tetap saja tidak ada jaminan matematis bahwa setiap
                formulasi akan tertangkap.
              </Callout>
            </Section>

            {/* 4 ------------------------------------------------------------- */}
            <Section id="cfl" number="04" title="Mesin CFL (Cognitive Fault Localization)">
              <p>
                CFL menerima daftar baris aljabar, mengurainya satu per satu, lalu membandingkan pasangan baris
                berurutan. Tujuannya bukan menilai seluruh jawaban, tetapi menemukan{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">titik patah logika pertama</strong>{" "}
                dan menjelaskannya secara deterministik.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">4.1 Whitelist-first parsing</h3>
              <p>
                <Code>parse_expr</Code> SymPy memanggil <Code>eval()</Code> di internalnya. Karena itu urutannya
                wajib: validasi whitelist, batas eksponen, baru parsing. Membalik urutan ini berarti mengeksekusi
                parser pada input yang belum dipercaya.
              </p>
              <ol className="list-decimal space-y-1.5 pl-5 marker:text-[#c4956a]">
                <li>
                  Jalur teks biasa: <Code>_is_plain_algebra()</Code> menolak panjang &gt; 200 karakter, garis bawah,
                  kutip, backtick, titik-koma, dan backslash. Hanya karakter aljabar standar yang lolos; setiap
                  identifier harus ada di whitelist.
                </li>
                <li>
                  Jalur LaTeX: <Code>_is_safe_latex()</Code> mewajibkan backslash, menolak underscore/kutip/titik-koma/dolar,
                  dan hanya mengizinkan perintah <Code>frac</Code>, <Code>sqrt</Code>, <Code>cdot</Code>,{" "}
                  <Code>times</Code>, <Code>sin</Code>, <Code>cos</Code>, <Code>tan</Code>, <Code>log</Code>,{" "}
                  <Code>exp</Code>, <Code>pm</Code>.
                </li>
                <li>
                  Batas eksponen: eksponen numerik &gt; 100 ditolak (termasuk bentuk kurung dan kurung kurawal),
                  indeks akar <Code>\sqrt[n]</Code> dengan n &gt; 100 ditolak, dan pangkat bertingkat seperti{" "}
                  <Code>(9^9)^9</Code> ditolak.
                </li>
                <li>
                  Baru kemudian <Code>parse_expr()</Code> atau <Code>parse_latex()</Code> dijalankan.{" "}
                  <Code>AssertionError</Code> selalu di-raise ulang sebelum <Code>except Exception</Code> generik
                  (aturan Anti-Masking).
                </li>
              </ol>
              <p>
                Variabel yang diizinkan: <Code>x, y, z, a, b, c, d, m, n, t</Code>. Fungsi:{" "}
                <Code>sin, cos, tan, sqrt, log, exp</Code>. Konstanta: <Code>pi, E</Code>.
              </p>
              <CodeBlock title="backend/cfl/parser.py - parse_single_side" code={parserCode} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">4.2 Perbandingan langkah & batas derajat</h3>
              <p>
                Untuk dua persamaan, CFL memeriksa apakah ruas kiri identik; bila ya, selisih ruas kanan harus
                nol. Bila tidak, himpunan solusi real kedua persamaan dibandingkan lewat <Code>solveset</Code>.
                Derajat polinomial di atas <Code>MAX_SOLVESET_DEGREE = 12</Code> tidak dipaksa: hasilnya{" "}
                <Code>None</Code> dan API melaporkan <Code>UNDECIDABLE_STEP</Code>. Angka 12 dipilih karena
                <Code>x^100 + x^99 = 1</Code> terhadap <Code>x^100 = 1 - x^99</Code> tidak selesai dalam 15 detik dan
                dapat memblokir worker.
              </p>
              <CodeBlock title="backend/cfl/cfl_engine.py - inti perbandingan" code={cflEngineCode} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">4.3 Status dan jenis miskonsepsi</h3>
              <DataTable
                head={["Status", "Arti", "Perilaku API"]}
                rows={[
                  [<Code key="1">FAULT_DETECTED</Code>, "Ada pasangan langkah yang tidak ekuivalen.", "has_fault true, fault_type diisi, counter_example bila tersedia."],
                  [<Code key="2">ALL_STEPS_VALID</Code>, "Semua pasangan langkah ekuivalen.", "has_fault false, tidak ada fault_type."],
                  [<Code key="3">UNDECIDABLE_STEP</Code>, "ConditionSet, derajat > 12, atau di luar cakupan.", "has_fault false, fault_type UNDECIDABLE_STEP, first_fault_line diisi."],
                  [<Code key="4">PARSING_ERROR</Code>, "Salah satu baris tidak lolos parser.", "Berhenti; endpoint mengembalikan 422 dengan pesan baris."],
                ]}
              />

              <DataTable
                head={["fault_type", "Cara classifier memutuskannya"]}
                rows={[
                  [<Code key="1">DISTRIBUTIVE_EXPANSION_ILLUSION</Code>, "Ekspresi memiliki pangkat; hasil expand tidak sama dengan ekspresi siswa."],
                  [<Code key="2">ROOT_LOSS</Code>, "Himpunan solusi langkah baru adalah subset murni dari langkah sebelumnya."],
                  [<Code key="3">EXTRANEOUS_ROOT_INTRODUCTION</Code>, "Himpunan solusi langkah baru adalah superset murni dari langkah sebelumnya."],
                  [<Code key="4">SIGN_INVERSION_OR_TRANSPOSITION_ERROR</Code>, "Kedua ruas berubah bukan nol setelah penyederhanaan, mengindikasikan pindah ruas/salah tanda."],
                  [<Code key="5">GENERAL_ALGEBRAIC_DERIVATION_ERROR</Code>, "Fallback bila tidak ada pola yang lebih spesifik."],
                ]}
              />

              <p>
                Counter-example dicari dengan substitusi integer kecil{" "}
                <Code>[2, 3, 1, 4]</Code>. Bila ditemukan selisih, respons berisi{" "}
                <Code>test_variable</Code>, <Code>test_value</Code>, <Code>lhs_expected</Code>,{" "}
                <Code>rhs_calculated</Code>, dan <Code>contradiction_statement</Code>. Bila tidak ada yang berhasil,
                respons berisi catatan untuk memeriksa aturan ekspansi - bukan counter-example palsu.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">4.4 Contoh nyata /api/v1/diagnose</h3>
              <p>Permintaan berikut dijalankan langsung ke backend yang sedang berjalan saat dokumentasi ini disusun.</p>
              <CodeBlock title="Permintaan" code={diagnoseRequest} />
              <CodeBlock title="Respons aktual (200 OK)" code={diagnoseResponse} />
              <Callout>
                Perhatikan: baris 2 dan 3 ditandai tidak valid karena berada pada atau setelah fault pertama. Baris 1
                valid. Ini bukan berarti setiap baris setelah fault otomatis salah secara independen - CFL hanya
                melaporkan titik patah pertama, sesuai namanya.
              </Callout>
              <Callout kind="warning">
                Batas CFL: hanya aljabar satu variabel target, maksimum 50 langkah per sesi, tiap sisi maksimum 200
                karakter, dan pemeriksaan hanya pada pasangan langkah berurutan. CFL tidak memeriksa justifikasi
                pedagogis, tidak membaca gambar, dan tidak membuktikan identitas trigonometri lanjutan. Di luar
                cakupan itu, jawabannya adalah klarifikasi atau status tidak dapat diputuskan.
              </Callout>
            </Section>

            {/* 5 ------------------------------------------------------------- */}
            <Section id="harness" number="05" title="Agent harness: memori & self-learning">
              <p>
                Harness menyimpan apa yang terjadi antar-giliran percakapan supaya sistem tidak mulai dari nol.
                Penyimpanan utamanya SQLite <Code>agent_episodic_memory</Code>, dengan mirror JSONL di{" "}
                <Code>data/zap_agent_memory.jsonl</Code>. Setiap baris adalah satu pola percakapan yang
                dideduplikasi, bukan transkrip mentah seluruh sesi.
              </p>

              <DataTable
                head={["Kelompok kolom", "Isi"]}
                rows={[
                  ["Identitas", <><Code>memory_id</Code>, <Code>user_key</Code>, <Code>conversation_id</Code></>],
                  ["Klasifikasi", <><Code>tier</Code>, <Code>topic</Code>, <Code>shape_kind</Code></>],
                  ["Isi percakapan", <><Code>user_query</Code> (maks 500 karakter), <Code>extracted_steps</Code> (JSON)</>],
                  ["Hasil CFL", <><Code>cfl_status</Code>, <Code>misconception_type</Code>, <Code>counter_example</Code>, <Code>sympy_verified</Code></>],
                  ["Scaffolding", <><Code>socratic_resolution</Code> yang sudah disanitasi guardrail</>],
                  ["Sinyal kualitas", <><Code>hit_count</Code>, <Code>upvotes</Code>, <Code>downvotes</Code>, <Code>quality_score</Code>, <Code>updated_at</Code></>],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">5.1 Isolasi pengguna</h3>
              <p>
                Identitas mentah tidak disimpan. <Code>user_id</Code> di-hash SHA-256, diambil 16 karakter hex, lalu
                diberi awalan <Code>u_</Code>. Tanpa identitas, baris masuk keranjang eksplisit{" "}
                <Code>anonymous</Code> - bukan NULL - agar predikat <Code>user_key</Code> selalu dapat diprediksi.
                Untuk pengguna beridentitas, <Code>memory_id</Code> juga menyertakan <Code>user_key</Code>, sehingga
                dua pengguna dengan pertanyaan identik tidak saling menimpa.
              </p>
              <CodeBlock title="backend/data_engine/agent_harness.py - kunci anonim" code={harnessKeyCode} />
              <CodeBlock title="backend/data_engine/agent_harness.py - dedup per pemilik" code={harnessMemoryIdCode} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">5.2 Alur belajar enam langkah</h3>
              <ol className="list-decimal space-y-1.5 pl-5 marker:text-[#c4956a]">
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Redaksi PII.</strong> Email, nomor
                  telepon Indonesia, NIK 16 digit, dan pola API key (<Code>sk-</Code>, <Code>nvapi-</Code>,{" "}
                  <Code>AIza</Code>, <Code>ghp_</Code>) diganti placeholder.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Ekstraksi langkah.</strong> Langkah
                  eksplisit dipakai lebih dulu; bila kosong, <Code>extract_math_steps_from_text()</Code> memecah
                  teks pada baris baru, tanda panah, atau titik-koma, lalu memvalidasi setiap kandidat dengan parser
                  CFL.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Gerbang CFL.</strong> Dua langkah
                  atau lebih menjalani <Code>isolate_first_fault_breakpoint()</Code>. Fault adalah diagnosis, bukan
                  verifikasi: <Code>sympy_verified</Code> tetap false.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Resolusi Sokratik.</strong> Bila
                  balasan asisten tidak ada, template dipilih berdasarkan jenis miskonsepsi atau geometri, lalu
                  disanitasi <Code>RobustZeroAnswerGuardrail.sanitize()</Code>.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Upsert memori.</strong>{" "}
                  <Code>INSERT ... ON CONFLICT(memory_id) DO UPDATE</Code> menaikkan <Code>hit_count</Code> dan
                  memperbarui resolusi. Mirror JSONL ditulis dengan lock proses.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Promosi korpus.</strong> Hanya
                  derivasi dengan status <Code>ALL_STEPS_VALID</Code>, <Code>sympy_verified</Code> true, dan minimal
                  dua langkah yang masuk <Code>MathCorpusStore</Code> permanen.
                </li>
              </ol>
              <CodeBlock title="backend/data_engine/agent_harness.py - gerbang CFL & promosi" code={harnessPromotionCode} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">
                5.3 Retrieval: kata kunci, bukan embedding
              </h3>
              <p>
                Sebelum menjawab, rute chat memanggil <Code>POST /api/v1/harness/context</Code> dengan timeout 1.200
                ms. Harness mengambil maksimum 2.000 baris milik satu <Code>user_key</Code>, memberi skor tumpang
                tindih istilah, lalu memilih baris teratas. Bobotnya: <Code>user_query</Code> 2,0;{" "}
                <Code>extracted_steps</Code> 1,25; <Code>topic</Code> 0,75; <Code>socratic_resolution</Code> 0,25;
                bonus frasa utuh 6,0 dan prefiks 40 karakter 2,0. Stopword Indonesia/Inggris umum dibuang. Bila tidak
                ada istilah yang cocok, yang dikembalikan adalah baris milik pengguna itu saja - bukan baris acak
                lintas pengguna.
              </p>
              <CodeBlock title="backend/data_engine/agent_harness.py - ranking memori" code={harnessRetrievalCode} />
              <p>
                Setelah itu, hasil korpus yang ber-ID <Code>conv_&lt;memory_id&gt;</Code> disaring: hanya pemilik
                memory_id yang boleh melihatnya. Item korpus sintetis/harvester tetap global karena berisi
                pengetahuan terverifikasi, bukan pertanyaan pribadi.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">5.4 Umpan balik & statistik</h3>
              <p>
                <Code>POST /api/chat/feedback</Code> menerima <Code>rating</Code> <Code>up</Code>/<Code>down</Code>{" "}
                atau <Code>1</Code>/<Code>-1</Code>, lalu meneruskannya ke{" "}
                <Code>POST /api/v1/harness/feedback</Code>. Backend menyimpan baris di <Code>agent_feedback</Code>.
                Kolom <Code>upvotes</Code>, <Code>downvotes</Code>, dan <Code>quality_score</Code> pada memori hanya
                diperbarui bila <Code>user_key</Code> pemilik memori cocok; umpan balik untuk memori orang lain tetap
                dicatat tetapi tidak mengubah baris tersebut.
              </p>
              <p>
                <Code>GET /api/harness/stats</Code> adalah proxy Next.js yang menyimpan{" "}
                <Code>ZAP_HARNESS_SECRET</Code> di server. Endpoint backend aslinya secret-gated. Proxy mengembalikan
                agregat saja dan meng-cache 60 detik dengan <Code>stale-while-revalidate=300</Code>.
              </p>
              <DataTable
                head={["Metrik (snapshot 14 Nov 2026)", "Nilai"]}
                rows={[
                  ["Memori episodik unik", "77"],
                  ["Total hit seluruh giliran", "216"],
                  ["Memori berstatus sympy_verified", "25"],
                  ["Sebaran tier", "SD 1 · SMP 65 · SMA 11"],
                  ["Miskonsepsi tercatat", "SIGN_INVERSION 8 · DISTRIBUTIVE 1 · ROOT_LOSS 1 · GENERAL 1"],
                  ["Umpan balik", "1 total · 1 up · 0 down"],
                  ["Catatan JSONL", "77 record · 0 baris rusak · delta DB/JSONL 0"],
                ]}
              />

              <Callout kind="warning">
                Keterbatasan harness. (1) Tabel FTS <Code>agent_memory_fts</Code> lama tidak dipelihara; retrieval
                memakai skoring kata di Python sehingga tidak menangkap sinonim atau makna. (2) Setiap retrieval
                memuat sampai 2.000 baris per pengguna ke memori proses. (3) Pengguna tanpa identitas berbagi
                keranjang <Code>anonymous</Code>, meskipun <Code>memory_id</Code> tetap memisahkan pola yang berbeda.
                (4) Mirror JSONL dapat tertinggal dari SQLite bila penulisan gagal; endpoint statistik melaporkan
                delta-nya secara eksplisit. (5) Promosi korpus hanya dari percakapan yang benar-benar lolos CFL,
                sehingga sistem tidak belajar dari jawaban yang salah.
              </Callout>
            </Section>

            {/* 6 ------------------------------------------------------------- */}
            <Section id="pengetahuan" number="06" title="Basis pengetahuan multi-domain">
              <p>
                Selain aljabar, repositori ini membangun korpus terverifikasi untuk empat domain. Verifikasinya
                berbeda per domain karena kebenaran matematis, kebenaran program, dan kebenaran fisika/kimia tidak
                dapat diperiksa dengan cara yang sama.
              </p>

              <DataTable
                head={["Domain", "Struktur", "Item di SQLite", "Mesin verifikasi"]}
                rows={[
                  ["Matematika (TK–S3)", "7 jenjang · 18 topik · 34 subtopik", "320", "SymPy CAS: gerbang boxed, anotasi GSM8K, ekuivalensi simbolik"],
                  ["Pemrograman", "3 topik · 6 subtopik", "10", "AST whitelist: eval/exec tanpa builtins, maks 160 node, eksponen bilangan bulat"],
                  ["Fisika", "4 topik · 7 subtopik", "10", "Python/SymPy numerik eksak + pengecekan satuan"],
                  ["Kimia", "3 topik · 5 subtopik", "10", "Python/SymPy numerik eksak"],
                ]}
              />
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Angka item dari audit 14 November 2026: total 350 record SQLite. Audit yang sama melaporkan 12.553
                item unik di mirror JSONL - arsip lama yang belum direkonsiliasi, bukan isi database aktif.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">6.1 Gerbang verifikasi per domain</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-[#c4956a]">
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Matematika.</strong> GSM8K
                  diverifikasi ulang dari anotasi kalkulator; MATH dan NuminaMath wajib lolos{" "}
                  <Code>_boxed_parseable()</Code>: isi <Code>\boxed&#123;...&#125;</Code> dinormalisasi, di-parse
                  SymPy, tidak boleh punya variabel bebas, dan harus menghasilkan nilai yang dapat dievaluasi.
                  Yang gagal tidak masuk korpus.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Pemrograman.</strong> Template
                  kode dijalankan di sandbox AST, bukan sandbox OS. Hanya node yang diizinkan, tanpa{" "}
                  <Code>__builtins__</Code>, dan eksponen harus bilangan bulat. Ini membatasi eksekusi template yang
                  ditulis sendiri, bukan menjalankan kode pengguna.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Fisika & kimia.</strong> Jawaban
                  dihitung ulang dengan Python/SymPy pada saat generasi; hasil numerik harus cocok dan jawaban tidak
                  boleh muncul di field yang terlihat pengguna.
                </li>
              </ul>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">6.2 Harvester internet</h3>
              <DataTable
                head={["Sumber", "Status", "Format", "Verifikasi"]}
                rows={[
                  [<Code key="1">gsm8k_sample</Code>, "Aktif", "JSONL GitHub OpenAI", "Anotasi kalkulator dievaluasi ulang SymPy"],
                  [<Code key="2">hf_gsm8k_api</Code>, "Aktif", "HuggingFace Datasets Server rows", "Gerbang yang sama dengan GSM8K"],
                  [<Code key="3">wikimedia_math_theorems</Code>, "Aktif", "Wikimedia REST v1 summary", "Identitas matematis diperiksa SymPy; gagal = unverified"],
                  [<Code key="4">indo_kurikulum_sd</Code>, "Nonaktif", "JSONL", "URL mengembalikan HTTP 404; tidak pernah dipanggil"],
                ]}
              />
              <p>
                Prinsip harvester: <strong className="font-semibold text-zinc-900 dark:text-white">verified-only</strong>.
                Sumber yang gagal atau tidak dapat diverifikasi tidak menghasilkan fallback berlabel verified.{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">Idempotent</strong>: item dideduplikasi
                berdasarkan teks pertanyaan yang dinormalisasi, sehingga menjalankan harvester berulang tidak
                menggandakan item. Ringkasan setiap putaran ditulis ke <Code>data/harvest_state.json</Code> (20
                putaran terakhir). Putaran terakhir yang tercatat berhasil memasukkan 28 item terverifikasi: 10 dari
                GSM8K sample, 10 dari HF API, dan 8 dari Wikimedia.
              </p>
              <CodeBlock title="data/harvest_state.json - ringkasan putaran" code={harvesterStateCode} />
              <Callout>
                Perintah panen:{" "}
                <Code>python .agents/skills/zap-skills/scripts/train_zap_sources.py --harvest --max-items 25</Code>.
                Sumber nonaktif tetap tercatat beserta alasannya agar laporan kejujuran tidak menghitungnya sebagai
                sumber aktif.
              </Callout>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">6.3 Cara menambah domain</h3>
              <ol className="list-decimal space-y-1.5 pl-5 marker:text-[#c4956a]">
                <li>Tambahkan definisi domain dan subtopik di <Code>taxonomy.py</Code>, termasuk mesin verifikasinya.</li>
                <li>Tambahkan generator deterministik di <Code>generators.py</Code>; hitung jawaban lebih dulu, lalu rakit item lewat <Code>_build_domain_item()</Code>.</li>
                <li>Tambahkan pemeriksaan zero-answer dengan <Code>_answer_absent()</Code> agar jawaban tidak muncul di field yang terlihat.</li>
                <li>Daftarkan domain di <Code>DOMAIN_NAMES</Code>, rebuild korpus, lalu audit.</li>
              </ol>
              <CodeBlock title="Pola penambahan domain" code={addDomainCode} />
              <Callout kind="warning">
                Jangan menambah domain tanpa mesin verifikasi deterministik. Domain yang hanya dinilai LLM akan
                melanggar pemisahan kebenaran/bahasa dan tidak boleh dipromosikan ke korpus terverifikasi.
              </Callout>
            </Section>

            {/* 7 ------------------------------------------------------------- */}
            <Section id="vault" number="07" title="Vault terenkripsi zero-knowledge">
              <p>
                Vault melindungi percakapan, proyek, preferensi, dan kunci provider di peramban sebelum dikirim ke
                server. Server hanya menerima envelope terenkripsi dan metadata identitas non-rahasia; passphrase,
                kunci turunan, dan plaintext tidak pernah dikirim.
              </p>

              <DataTable
                head={["Parameter", "Nilai di kode"]}
                rows={[
                  ["KDF", "PBKDF2-SHA256"],
                  ["Iterasi", "310.000 (rekomendasi OWASP 2023 untuk PBKDF2-SHA256)"],
                  ["Salt", "16 byte acak per envelope"],
                  ["Cipher", "AES-GCM-256"],
                  ["Nonce / IV", "12 byte acak (96-bit)"],
                  ["Panjang passphrase minimum", "8 karakter"],
                  ["Kode pemulihan", "32 karakter Crockford base32, 8 grup × 4 (entropi ±160 bit)"],
                  ["Penyimpanan kunci sesi", "memori + sessionStorage per tab, bukan localStorage"],
                ]}
              />

              <CodeBlock title="frontend/lib/vault-crypto.ts - parameter & tipe envelope" code={vaultCode} />
              <CodeBlock title="Bentuk envelope yang dikirim ke server" code={vaultEnvelopeExample} />
              <CodeBlock title="Alur sinkron lintas perangkat" code={vaultFlowDiagram} />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">7.1 Token sesi akun vs Google token</h3>
              <DataTable
                head={["Kredensial", "Dibuat oleh", "Bentuk", "Cara diverifikasi"]}
                rows={[
                  [
                    "Token sesi akun ZAP",
                    <Code key="1">frontend/lib/account-session.ts</Code>,
                    "base64url(payload).base64url(HMAC-SHA256), payload berisi email, exp, nonce, versi",
                    "HMAC timing-safe dengan ZAP_SESSION_SECRET; TTL bawaan 30 hari; gagal = null (fail-closed)",
                  ],
                  [
                    "Google ID token",
                    "Google Identity Services",
                    "JWT dari Google",
                    "Diverifikasi ke endpoint tokeninfo; aud harus cocok, email terverifikasi, email token = email sinkronisasi",
                  ],
                ]}
              />
              <p>
                Token sesi akun dibuat saat signup/login di <Code>/api/auth/credentials</Code> dan disimpan klien di{" "}
                <Code>localStorage</Code>. Bila <Code>ZAP_SESSION_SECRET</Code> tidak diatur, server membuat secret
                acak 32 byte dan menyimpannya di <Code>.zap_vault/security/session-secret</Code> agar sesi tidak
                putus setiap restart.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">7.2 Kode pemulihan</h3>
              <p>
                Kode pemulihan vault adalah passphrase alternatif yang dihasilkan perangkat, dinormalkan dengan
                membuang spasi/strip dan menyeragamkan huruf besar, lalu dipakai untuk menurunkan kunci yang sama.
                Kode ini berbeda dari <strong className="font-semibold text-zinc-900 dark:text-white">token
                pemulihan akun</strong> di <Code>/api/admin/security</Code>, yang bersifat sekali pakai, dibuat
                administrator, dan dipakai untuk membuka suspend akun - bukan untuk membuka vault.
              </p>

              <Callout kind="warning">
                Batas yang tidak bisa dilanggar oleh desain. (1) Lupa passphrase vault dan kode pemulihan berarti
                isi vault tidak dapat dipulihkan; server tidak memiliki kunci. (2) Metadata identitas tetap plaintext
                di server: email, nama, avatar, provider, tier, dan <Code>updatedAt</Code>. (3) Akun tamu tidak
                memiliki sinkronisasi cloud. (4) Vault hanya sekuat perangkat: bila peramban terinfeksi XSS saat
                vault terbuka, kunci di memori/sessionStorage dapat dicuri. (5) Sinkronisasi bersifat
                envelope-terakhir-menang; tidak ada merge CRDT antar-perangkat.
              </Callout>
            </Section>

            {/* 8 ------------------------------------------------------------- */}
            <Section id="api" number="08" title="Referensi API">
              <p>
                Ada dua permukaan API: FastAPI di port 8000 untuk diagnostik/harness, dan route handler Next.js di
                port 3000 untuk percakapan, sinkronisasi, autentikasi, dan bagi tautan. Base URL backend dibaca dari{" "}
                <Code>NEXT_PUBLIC_BACKEND_URL</Code> dengan fallback <Code>http://127.0.0.1:8000</Code>.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">8.1 Backend FastAPI</h3>
              <DataTable
                head={["Metode", "Jalur", "Auth", "Body / parameter", "Respons", "Status"]}
                rows={[
                  [<MethodChip key="1" method="GET" />, <Code key="2">/health</Code>, "Publik", "-", "status, service, engine, version", "200"],
                  [<MethodChip key="3" method="POST" />, <Code key="4">/api/v1/diagnose</Code>, "Publik", <><Code>confirmed_steps[]</Code> atau <Code>lines[]</Code>; <Code>target_variable</Code> atau <Code>target_var</Code>; maks 50 langkah</>, "DiagnoseResponse (transcription, diagnosis, guardrail_status)", "200 · 422"],
                  [<MethodChip key="5" method="POST" />, <Code key="6">/api/v1/verify</Code>, "Publik", <><Code>left</Code>, <Code>right</Code> (maks 200 karakter)</>, "isEquivalent, verified, method, message", "200 · 422"],
                  [<MethodChip key="7" method="POST" />, <Code key="8">/api/v1/harness/learn</Code>, <>Header <Code>X-Harness-Secret</Code></>, <>user_message, assistant_reply, explicit_steps, target_variable, tier_hint, user_id</>, "status learned, memory_id, cfl_status, sympy_verified, promoted_to_corpus, hit_count", "200 · 401 · 503"],
                  [<MethodChip key="9" method="POST" />, <Code key="10">/api/v1/harness/context</Code>, <>Header <Code>X-Harness-Secret</Code></>, <>query, limit/top_k (1–10), user_id</>, "prompt_injection, episodic_memories, corpus_references, geometry_intent, learner_profile", "200 · 401 · 503"],
                  [<MethodChip key="11" method="GET" />, <Code key="12">/api/v1/harness/profile</Code>, <>Header <Code>X-Harness-Secret</Code></>, "user_id", "learner_profile agregat", "200 · 401 · 503"],
                  [<MethodChip key="13" method="POST" />, <Code key="14">/api/v1/harness/feedback</Code>, <>Header <Code>X-Harness-Secret</Code></>, <>rating, memory_id, conversation_id, user_id/user_key, comment, cuplikan pesan</>, "status recorded, feedback_id, applied_to_memory", "201 · 401 · 422 · 503"],
                  [<MethodChip key="15" method="POST" />, <Code key="16">/api/v1/harness/geometry-pattern</Code>, <>Header <Code>X-Harness-Secret</Code></>, <>phrase, spec</>, "status, pattern", "200 · 401 · 503"],
                  [<MethodChip key="17" method="GET" />, <Code key="18">/api/v1/harness/geometry-patterns</Code>, <>Header <Code>X-Harness-Secret</Code></>, "limit (bawaan 200)", "status, total, patterns", "200 · 401 · 503"],
                  [<MethodChip key="19" method="POST" />, <Code key="20">/api/v1/harness/geometry-match</Code>, <>Header <Code>X-Harness-Secret</Code></>, "query", "status, matched, match", "200 · 401 · 503"],
                  [<MethodChip key="21" method="GET" />, <Code key="22">/api/v1/harness/stats</Code>, <>Header <Code>X-Harness-Secret</Code></>, "-", "memori agregat + corpus + feedback", "200 · 401 · 503"],
                  [<MethodChip key="23" method="WS" />, <Code key="24">/api/v1/board/&#123;room&#125;</Code>, "Kode ruang", "Frame JSON: seg, clear, notes, state", "welcome, join, leave, siaran frame", "101"],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">8.2 Route handler Next.js</h3>
              <DataTable
                head={["Metode", "Jalur", "Auth", "Body / parameter", "Respons", "Status"]}
                rows={[
                  [<MethodChip key="1" method="POST" />, <Code key="2">/api/chat</Code>, "Publik", <>message, conversationHistory, targetVariable, stream, modelId, kunci provider opsional</>, <>JSON <Code>reply/model/source</Code> atau SSE <Code>meta → delta → done</Code></>, "200 · 400 · 403"],
                  [<MethodChip key="3" method="POST" />, <Code key="4">/api/chat/feedback</Code>, "Publik", "rating, memoryId, conversationId, cuplikan pesan", "diteruskan dari backend", "201 · 400 · 429 · 503"],
                  [<MethodChip key="5" method="GET" />, <Code key="6">/api/chat/share</Code>, "Publik (kode tautan)", "id", "exists, data tanpa authorEmail", "200 · 400 · 403 (dicabut) · 404"],
                  [<MethodChip key="7" method="POST" />, <Code key="8">/api/chat/share</Code>, "Publik; authorEmail wajib untuk mengubah/mencabut", "conversationId, title, messages, authorEmail, isPublic, shareId", "success, shareId, sharePath, altSharePath", "200 · 400 · 403 · 413 · 500"],
                  [<MethodChip key="9" method="GET" />, <Code key="10">/api/user/sync</Code>, <>Bearer Google token / token sesi</>, "-", "vault pengguna (envelope, tanpa kunci)", "200 · 401 · 403 · 429 · 500"],
                  [<MethodChip key="11" method="POST" />, <Code key="12">/api/user/sync</Code>, <>Bearer Google token / token sesi</>, <>user, encrypted envelope, conversations, configs, workspaces</>, "success, encrypted, updatedAt", "200 · 400 · 401 · 403 · 413 · 429 · 500"],
                  [<MethodChip key="13" method="GET" />, <Code key="14">/api/harness/stats</Code>, "Publik (proxy)", "-", "agregat harness", "200 · 502 · 503"],
                  [<MethodChip key="15" method="POST" />, <Code key="16">/api/auth/credentials</Code>, "Publik", "action signup/login, email, password, name", "sessionToken, sessionExpiresAt, user", "200 · 400 · 401 · 409 · 429"],
                  [<MethodChip key="17" method="GET" />, <Code key="18">/api/admin/security</Code>, "ADMIN_SECRET atau token pemulihan", "action check/list, email, token", "status/list", "200 · 400 · 401 · 403 · 405 · 500"],
                  [<MethodChip key="19" method="POST" />, <Code key="20">/api/admin/security</Code>, "ADMIN_SECRET atau token pemulihan", "action, email, adminSecret, token", "success/message", "200 · 400 · 401 · 403 · 500"],
                  [<MethodChip key="21" method="GET" />, <Code key="22">/api/user/avatar</Code>, "Publik", "url / email", "gambar atau 404", "200 · 400 · 404 · 429 · 500"],
                  [<MethodChip key="23" method="POST" />, <Code key="24">/api/user/avatar</Code>, "Publik", "email, dataUrl", "synced", "200 · 400 · 413 · 429 · 500"],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">8.3 Contoh curl</h3>
              <p>
                <strong className="font-semibold text-zinc-900 dark:text-white">Chat, mode SSE.</strong>{" "}
                <Code>stream: true</Code> membuat server mengirim event <Code>meta</Code>, potongan{" "}
                <Code>delta</Code>, lalu <Code>done</Code> berisi JSON final.
              </p>
              <CodeBlock title="curl /api/chat - SSE" code={curlChatSse} />
              <p>
                <strong className="font-semibold text-zinc-900 dark:text-white">Chat, mode JSON.</strong> Tanpa{" "}
                <Code>stream</Code>, respons adalah satu JSON utuh dengan <Code>reply</Code>, <Code>model</Code>,{" "}
                <Code>source</Code>, dan opsional <Code>corpus_references</Code>.
              </p>
              <CodeBlock title="curl /api/chat - JSON" code={curlChatJson} />
              <CodeBlock title="curl /api/v1/diagnose" code={curlDiagnose} />
              <CodeBlock title="curl /api/v1/verify" code={curlVerify} />
              <CodeBlock title="curl /api/user/sync" code={curlSync} />
              <CodeBlock title="curl /api/chat/share" code={curlShare} />
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Untuk verifikasi cepat: <Code>{verifyResponse.split("\n")[0]}</Code> mengembalikan{" "}
                <Code>symbolic_simplify</Code> karena SymPy menyederhanakan selisih menjadi 0.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">8.4 Rate limit & batas ukuran</h3>
              <DataTable
                head={["Rute", "Batas yang benar-benar ada di kode", "Catatan"]}
                rows={[
                  ["POST /api/chat", "Tidak ada rate limiter per IP di route", "Deteksi jailbreak memberi strike; 2 strike = suspend. Tidak ada cap ukuran body eksplisit."],
                  ["POST /api/chat/feedback", "30 permintaan/menit per IP", "Sliding window di memori proses."],
                  ["POST /api/chat/share", "Body maks 4 MiB; maks 500 pesan; judul 200 karakter", "authorEmail wajib cocok untuk mengubah share yang sudah ada."],
                  ["GET/POST /api/user/sync", "120 permintaan/menit per IP; body maks 8 MiB; ciphertext maks 12 juta karakter", "GET juga dibatasi; envelope divalidasi sebelum disimpan."],
                  ["POST /api/auth/credentials", "signup 5/menit; login 15/menit per IP", "Membatasi brute force; hasil 429 dengan Retry-After."],
                  ["POST /api/auth/verify-key", "10/menit per IP", "Digunakan untuk verifikasi kunci provider."],
                  ["GET/POST /api/user/avatar", "GET 300/menit; POST 20/menit; gambar maks 2 MiB", "Respons data URL dibatasi 512 KiB."],
                  ["POST /api/waitlist", "5/menit per IP", "Bukan bagian alur belajar."],
                  ["Backend /api/v1/diagnose", "Maks 50 langkah; target_variable maks 5 karakter", "422 untuk daftar kosong, terlalu banyak langkah, atau variabel di luar whitelist."],
                  ["Backend /api/v1/verify", "left/right maks 200 karakter", "Pydantic menolak input lebih panjang dengan 422."],
                  ["Backend harness", "learn: pesan 8.000 karakter; feedback: komentar 1.000 karakter", "Context limit/top_k dibatasi 1–10."],
                ]}
              />
              <Callout kind="warning">
                Rate limiter disimpan di <Code>Map</Code> dalam memori satu proses Next.js. Pada deployment
                multi-instans, batas tidak global; komentar di <Code>utils/rate-limit.ts</Code> secara eksplisit
                menyarankan Redis untuk itu. Backend juga tidak memiliki rate limiter internal - pembatasan bergantung
                pada route Next dan reverse proxy.
              </Callout>
            </Section>

            {/* 9 ------------------------------------------------------------- */}
            <Section id="konfigurasi" number="09" title="Konfigurasi & self-hosting">
              <p>
                Variabel lingkungan dibaca di dua tempat. Jangan menaruh rahasia server di variabel berawalan{" "}
                <Code>NEXT_PUBLIC_</Code>: nilai itu ikut ke bundle peramban.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">9.1 Frontend (Next.js)</h3>
              <DataTable
                head={["Variabel", "Wajib?", "Kegunaan"]}
                rows={[
                  [<Code key="1">NEXT_PUBLIC_BACKEND_URL</Code>, "Disarankan", "Base URL FastAPI; fallback http://127.0.0.1:8000."],
                  [<Code key="2">NEXT_PUBLIC_APP_URL</Code>, "Opsional", "metadataBase dan canonical; fallback https://chatzap.web.id."],
                  [<Code key="3">NEXT_PUBLIC_GOOGLE_CLIENT_ID</Code>, "Untuk login Google", "Client ID di peramban."],
                  [<Code key="4">ZAP_GOOGLE_CLIENT_ID</Code>, "Untuk sync Google", "Audiens token Google yang diverifikasi server."],
                  [<Code key="5">ZAP_SESSION_SECRET</Code>, "Disarankan", "Menandatangani token sesi HMAC; minimal 32 karakter agar dipakai."],
                  [<Code key="6">ZAP_HARNESS_SECRET</Code>, "Production", "Header X-Harness-Secret untuk semua endpoint harness."],
                  [<Code key="7">ADMIN_SECRET</Code>, "Untuk admin", "Akses rute /api/admin/security."],
                  [<Code key="8">ZAP_ALLOWED_HOSTS</Code>, "Di belakang proxy", "Daftar host yang dipercaya untuk redirect middleware."],
                  [<Code key="9">GEMINI_API_KEY / GOOGLE_API_KEY</Code>, "Salah satu", "Provider bahasa utama bila tersedia."],
                  [<Code key="10">NVIDIA_API_KEY</Code>, "Opsional", "NVIDIA NIM, termasuk fallback model cepat."],
                  [<Code key="11">BAZAARLINK_API_KEY</Code>, "Opsional", "Gateway DeepSeek/Qwen."],
                  [<Code key="12">OPENAI_API_KEY / ANTHROPIC_API_KEY / MISTRAL_API_KEY</Code>, "Opsional", "Provider alternatif."],
                  [<Code key="13">ZAP_PLATFORM_LLM_BASE_URL / MODEL / API_KEY</Code>, "Opsional", "Endpoint kompatibel OpenAI milik platform."],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">9.2 Backend (FastAPI)</h3>
              <DataTable
                head={["Variabel", "Kegunaan"]}
                rows={[
                  [<Code key="1">CORS_ORIGINS</Code>, "Daftar origin dipisah koma; default hanya localhost:3000/3105 dan 127.0.0.1. Wildcard hanya bila env berisi *."],
                  [<Code key="2">ZAP_HARNESS_SECRET</Code>, "Bila diisi, header X-Harness-Secret wajib cocok."],
                  [<Code key="3">ZAP_ENV</Code>, "Bila bernilai production dan secret kosong, endpoint harness menolak 503."],
                  [<Code key="4">ZAP_DB_PATH</Code>, "Lokasi SQLite platform/korpus."],
                  [<Code key="5">ZAP_JWT_SECRET</Code>, "Secret JWT platform (dipakai service platform)."],
                  [<Code key="6">ZAP_MASTER_SECRET / ZAP_MASTER_KEY</Code>, "Secret master untuk fitur platform; compose membaca ZAP_MASTER_KEY."],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">9.3 Menjalankan & menguji</h3>
              <CodeBlock title="Perintah pengembangan, pengujian, dan audit" code={runCommands} />
              <p>
                <Code>docker compose up -d --build</Code> menjalankan backend dan frontend. Compose mewajibkan{" "}
                <Code>ZAP_JWT_SECRET</Code>, <Code>ZAP_GOOGLE_CLIENT_ID</Code>, <Code>ADMIN_SECRET</Code>, dan{" "}
                <Code>POSTGRES_PASSWORD</Code> (untuk service Postgres opsional) terisi; sintaks{" "}
                <Code>{"${VAR:?pesan}"}</Code> membuat compose berhenti bila kosong. Backend hanya dipublikasikan ke{" "}
                <Code>127.0.0.1:8000</Code>, bukan ke semua antarmuka. Service Postgres belum dipakai kode saat ini.
              </p>
              <Callout>
                <Code>pytest</Code> dijalankan dari root repositori agar forwarder <Code>tests/</Code> menemukan suite
                backend. Pada Windows, TestClient dapat memerlukan izin loopback; jika sandbox memblokir socket,
                jalankan di lingkungan yang mengizinkan bind localhost.
              </Callout>
            </Section>

            {/* 10 ------------------------------------------------------------ */}
            <Section id="keamanan" number="10" title="Model keamanan">
              <p>
                Tujuan model keamanan ini bukan membuat sistem tidak bisa diserang, melainkan membatasi dampak dan
                menghindari klaim berlebihan. Berikut yang dilindungi dan yang tidak.
              </p>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">10.1 Yang dilindungi</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-[#c4956a]">
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Rahasia server.</strong>{" "}
                  <Code>ZAP_HARNESS_SECRET</Code>, <Code>ADMIN_SECRET</Code>, kunci provider, dan{" "}
                  <Code>ZAP_SESSION_SECRET</Code> hanya dibaca di server; proxy statistik ada agar klien tidak perlu
                  memegang secret.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Isi vault.</strong> Enkripsi
                  AES-GCM dilakukan di peramban; server menyimpan envelope dan metadata identitas saja.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Eksekusi parser.</strong> Whitelist
                  dan batas eksponen mencegah input berbahaya mencapai <Code>eval()</Code> internal SymPy, serta
                  membatasi biaya <Code>solveset</Code>.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Kebocoran jawaban.</strong> Dua
                  lapis guardrail (backend dan frontend) menyensor deklarasi jawaban, termasuk bentuk ber-delimiter
                  yang dulu lolos.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Isolasi memori.</strong> Retrieval
                  memfilter <Code>user_key</Code>; referensi promosi percakapan difilter kepemilikannya.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">PII.</strong> Email, telepon, NIK,
                  dan pola API key diredaksi sebelum disimpan di memori.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Header & redirect.</strong>{" "}
                  Middleware memvalidasi host dari header proxy sebelum membangun URL redirect; CSP, HSTS,
                  X-Frame-Options, dan Referrer-Policy dipasang di <Code>next.config.mjs</Code>.
                </li>
              </ul>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">10.2 Yang tidak dilindungi</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-[#c4956a]">
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Perangkat yang sudah kompromi.</strong>{" "}
                  Selama vault terbuka, kunci berada di memori dan sessionStorage. XSS atau malware di perangkat dapat
                  mencurinya.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Token di localStorage.</strong>{" "}
                  Google ID token dan token sesi akun disimpan di <Code>localStorage</Code>. Token ini dapat dibaca
                  JavaScript mana pun yang berjalan di origin yang sama. Cookie <Code>zap_session</Code> hanyalah
                  penanda keberadaan sesi, bukan kredensial.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Metadata server.</strong> Email,
                  nama, avatar, provider, tier, dan waktu sinkronisasi tersimpan plaintext.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Rate limit terdistribusi.</strong>{" "}
                  Limiter berjalan per proses; restart menghapus hitungan, dan multi-instans tidak berbagi state.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Prompt injection.</strong> Deteksi
                  berbasis regex dan aturan; bisa salah tangkap (false positive) dan tidak menjamin semua upaya
                  manipulasi tertangkap. Strike disimpan server-side dan dua pelanggaran menyebabkan suspend.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Papan kolaborasi.</strong> Kode
                  ruang adalah satu-satunya kunci akses; siapa pun yang memegang kode dapat ikut menggambar. Ruang
                  disimpan di memori server dan hilang saat proses berhenti.
                </li>
              </ul>

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">10.3 Header keamanan</h3>
              <DataTable
                head={["Header", "Nilai"]}
                rows={[
                  [<Code key="1">Content-Security-Policy</Code>, "default-src self; script-src self unsafe-inline (dev juga unsafe-eval) accounts.google.com; frame-src accounts.google.com; connect-src self https: plus localhost untuk dev."],
                  [<Code key="2">Strict-Transport-Security</Code>, "max-age=63072000; includeSubDomains; preload"],
                  [<Code key="3">X-Content-Type-Options</Code>, "nosniff"],
                  [<Code key="4">X-Frame-Options</Code>, "SAMEORIGIN"],
                  [<Code key="5">Referrer-Policy</Code>, "strict-origin-when-cross-origin"],
                  [<Code key="6">Permissions-Policy</Code>, "camera=(), microphone=(), geolocation=()"],
                ]}
              />
              <Callout>
                Audit 13–14 November 2026 mencatat perbaikan pada beberapa isu nyata: kebocoran jawaban lewat
                delimiter LaTeX, reset password tanpa bukti kepemilikan, SSRF pada avatar, dan isolasi memori yang
                sebelumnya rusak. Klaim keamanan di halaman ini dibatasi pada perilaku kode saat ini, bukan jaminan
                bahwa tidak ada temuan baru di masa depan.
              </Callout>
            </Section>

            {/* 11 ------------------------------------------------------------ */}
            <Section id="roadmap" number="11" title="Keterbatasan & roadmap">
              <p>
                Daftar ini sengaja eksplisit. Sebagian adalah batas desain yang diterima, sebagian adalah utang
                teknis yang sudah tercatat di audit.
              </p>

              <DataTable
                head={["Keterbatasan", "Dampak", "Status / arah perbaikan"]}
                rows={[
                  ["CFL hanya aljabar satu variabel target; maks 50 langkah; sisi maks 200 karakter", "Di luar itu sistem memberi klarifikasi atau status tidak dapat diputuskan.", "Batas desain; perluas cakupan secara bertahap dengan uji regresi."],
                  ["Derajat polinomial > 12 tidak diputuskan", "Persamaan berderajat tinggi bisa berhenti di UNDECIDABLE_STEP.", "Disengaja untuk mencegah worker terkunci; perlu strategi komputasi terpisah."],
                  ["Retrieval berbasis kata kunci, FTS tidak dipelihara", "Sinonim dan makna tidak tertangkap; kualitas bergantung kosakata pengguna.", "Utang teknis tercatat; embedding atau FTS terpelihara adalah kandidat."],
                  ["SQLite 350 record vs JSONL 12.553 record", "Laporan berbeda tergantung sumber yang dibaca; JSONL adalah arsip lama.", "Rekonsiliasi belum dilakukan agar tidak menghapus tulisan yang sedang berjalan."],
                  ["Satu sumber harvester nonaktif (HTTP 404)", "Kurikulum SD tidak mendapat item dari sumber itu.", "Perlu URL resmi baru yang dapat diverifikasi."],
                  ["Rate limit per proses, bukan global", "Multi-instans dapat melewati batas; restart mereset hitungan.", "Perlu penyimpanan bersama (mis. Redis)."],
                  ["/api/chat tidak memiliki rate limiter eksplisit", "Beban percakapan bergantung pada provider dan reverse proxy.", "Perlu limiter di route atau edge."],
                  ["Prompt injection dideteksi dengan regex", "False positive dan false negative mungkin terjadi.", "Perlu pendekatan berlapis; saat ini strike 2 = suspend."],
                  ["Vault tidak dapat dipulihkan tanpa passphrase/kode", "Kehilangan kunci berarti kehilangan data.", "Konsekuensi zero-knowledge; tidak ada backdoor."],
                  ["Metadata identitas plaintext di server", "Email dan nama tetap terlihat oleh server.", "Dapat dienkripsi terpisah, tetapi mengubah alur sinkronisasi."],
                  ["Akun tamu tanpa sinkronisasi cloud", "Data tamu hanya di perangkat.", "Batas desain; pengguna perlu akun."],
                  ["Sinkronisasi envelope last-write-wins", "Dua perangkat yang menulis bersamaan dapat saling menimpa.", "Perlu versioning/merge."],
                  ["Papan kolaborasi disimpan di memori", "Ruang hilang saat proses berhenti; tidak ada otentikasi selain kode ruang.", "Batas desain untuk demo; perlu penyimpanan persisten bila dipakai luas."],
                  ["Model bahasa eksternal dapat gagal/timeout", "Kualitas balasan menurun, tetapi fallback Sokratik lokal tetap tersedia.", "Fallback sudah ada; pemantauan provider tetap diperlukan."],
                ]}
              />

              <h3 className="pt-2 text-base font-bold text-zinc-900 dark:text-white">Urutan prioritas yang masuk akal</h3>
              <ol className="list-decimal space-y-1.5 pl-5 marker:text-[#c4956a]">
                <li>Rekonsiliasi korpus SQLite dan JSONL, lalu pastikan angka publik selalu membaca satu sumber.</li>
                <li>Ganti rate limiter in-memory dengan penyimpanan bersama dan tambahkan limiter untuk /api/chat.</li>
                <li>Hidupkan kembali FTS atau ganti retrieval dengan indeks yang dipelihara.</li>
                <li>Pindahkan token sesi dari localStorage ke cookie HttpOnly bila arsitektur memungkinkan.</li>
                <li>Tambahkan versioning envelope vault untuk merge antar-perangkat.</li>
              </ol>

              <div className="mt-6 rounded-xl border border-[#c4956a]/30 bg-[#c4956a]/[0.06] p-4">
                <div className="flex gap-3">
                  <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#a8794f] dark:text-[#d8b48c]" />
                  <p className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <strong className="font-semibold text-zinc-900 dark:text-white">Cara memverifikasi dokumen ini.</strong>{" "}
                    Jalankan <Code>GET /api/harness/stats</Code> untuk angka memori/korpus, baca{" "}
                    <Code>backend/cfl/parser.py</Code> untuk batas parser, dan buka{" "}
                    <Code>frontend/lib/zero-answer.ts</Code> untuk pola guardrail. Bila halaman ini berbeda dari
                    kode, kode yang benar - dan halaman ini perlu diperbarui.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Network, label: "Arsitektur", value: "Next.js → FastAPI → CFL" },
                  { icon: KeyRound, label: "Vault", value: "PBKDF2 310k → AES-GCM-256" },
                  { icon: Terminal, label: "Uji", value: "pytest + audit CLI" },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-zinc-200 bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </div>
                    <div className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{value}</div>
                  </div>
                ))}
              </div>
            </Section>
          </main>

          {/* Rail kanan: progres baca, bagian aktif, pintasan */}
          <aside className="hidden xl:block">
            <div className="sticky top-36 space-y-4 pb-8 pt-8">
              <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                    Progres baca
                  </p>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                    {activeIndex + 1}/{SECTIONS.length}
                  </span>
                </div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-[30px] font-black leading-none tracking-tight text-zinc-900 dark:text-white">
                    {Math.round(progress * 100)}
                  </span>
                  <span className="pb-1 text-[12px] font-semibold text-zinc-400 dark:text-zinc-500">%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#c4956a] via-[#a02e1e] to-[#f07a1e] transition-[width] duration-150"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className="mt-3.5 border-t border-zinc-200/60 pt-3 dark:border-white/[0.07]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                    Sedang dibaca
                  </p>
                  <p className="mt-1 text-[12.5px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">
                    {activeTitle}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  Pintasan
                </p>
                <ul className="mt-2 space-y-0.5">
                  {[
                    { href: "#api", label: "Referensi API" },
                    { href: "#keamanan", label: "Model keamanan" },
                    { href: "#konfigurasi", label: "Self-hosting" },
                    { href: "/chat", label: "Buka ChatZAP" },
                  ].map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-zinc-600 transition-colors hover:bg-[#c4956a]/[0.08] hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                      >
                        {item.label}
                        <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={backToTop}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-[12px] font-medium text-zinc-600 transition-colors hover:border-[#c4956a]/60 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:text-white"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Kembali ke atas
              </button>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />

      <div className="sr-only" aria-live="polite">
        Bagian aktif: {SECTIONS.find((s) => s.id === active)?.title ?? SECTIONS[0].title}
      </div>
    </div>
  );
}

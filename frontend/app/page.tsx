"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Atom,
  BookOpen,
  Check,
  Code2,
  Cpu,
  FlaskConical,
  KeyRound,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Sigma,
} from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { RibbonGradient } from "@/components/site/RibbonGradient";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import {
  ChemistryViz,
  CodeViz,
  MathViz,
  PhysicsViz,
  StepCheckViz,
} from "@/components/site/KineticViz";
import ActionButton from "@/components/landing/ActionButton";
import { ZapChatScrollHero } from "@/components/landing/ZapChatScrollHero";
import dynamic from "next/dynamic";

const ModelShowcase = dynamic(
  () => import("@/components/landing/ModelShowcase").then((m) => m.ModelShowcase),
  { ssr: true }
);

const VaultStage = dynamic(
  () => import("@/components/landing/VaultStage").then((m) => m.VaultStage),
  { ssr: true }
);

const FaqSection = dynamic(
  () => import("@/components/landing/FaqSection").then((m) => m.FaqSection),
  { ssr: true }
);

const ClosingCta = dynamic(
  () => import("@/components/landing/ClosingCta").then((m) => m.ClosingCta),
  { ssr: true }
);

const WORKFLOW = [
  {
    title: "Tulis langkahmu",
    body: "Tempel beberapa baris penurunan atau satu soal. Tidak perlu format sempurna.",
  },
  {
    title: "SymPy memeriksa",
    body: "Mesin simbolik melacak galat pertama, menguji ekuivalensi, dan membuat counter-example konkret.",
  },
  {
    title: "Kamu yang menyimpulkan",
    body: "Model bahasa hanya merangkai pertanyaan Sokrates. Jawaban akhir tetap milikmu.",
  },
];

/**
 * Setiap domain punya gerak yang berbeda: kurva simbolik, pohon AST,
 * trajektori proyektil, cincin molekul. Bukan garis chart yang sama.
 */
const DOMAINS = [
  {
    key: "math",
    name: "Matematika",
    meta: "TK sampai S3 · SymPy CAS",
    body: "Aljabar, geometri, trigonometri, barisan, sampai kalkulus. Setiap baris diuji ekuivalensinya, bukan ditebak.",
    tag: "grafik · akar real",
    icon: Sigma,
    Viz: MathViz,
  },
  {
    key: "code",
    name: "Pemrograman",
    meta: "AST sandbox · Big-O",
    body: "Kode diurai jadi pohon AST, dieksekusi tanpa builtins, lalu kompleksitasnya dibandingkan dengan klaim siswa.",
    tag: "AST · evaluasi",
    icon: Code2,
    Viz: CodeViz,
  },
  {
    key: "physics",
    name: "Fisika",
    meta: "Rumus dan cek numerik",
    body: "Substitusi besaran dan satuan diperiksa numerik. Arah vektor serta tanda gaya harus konsisten di setiap langkah.",
    tag: "trajektori · vektor",
    icon: Atom,
    Viz: PhysicsViz,
  },
  {
    key: "chem",
    name: "Kimia",
    meta: "Mol · pH · gas ideal",
    body: "Stoikiometri, kesetimbangan, dan hukum gas dihitung deterministik, termasuk konservasi massa dan muatan.",
    tag: "molekul · pH",
    icon: FlaskConical,
    Viz: ChemistryViz,
  },
] as const;

export default function LandingPage() {
  // Sembunyikan scrollbar halaman landing saja; scroll tetap berfungsi.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-scrollbar-page");
    return () => root.classList.remove("no-scrollbar-page");
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#fbf7f0] text-[#1c120c] dark:bg-[#0d0907] dark:text-[#f5e9dc]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[#1c120c] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <SiteHeader />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* HERO */}
        <section className="relative isolate overflow-hidden bg-[#2a0e0e]">
          <RibbonGradient />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(42,14,14,0.78)_0%,rgba(42,14,14,0.24)_30%,rgba(42,14,14,0.06)_58%,rgba(23,13,9,0.78)_100%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ffd35c]/50 to-transparent"
          />

          <div className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-32 sm:px-6 sm:pt-40 lg:pb-28">
            <div className="mx-auto max-w-[860px] text-center">
              {/* H1 sengaja statis (tanpa animasi opacity) supaya LCP mobile
                  dicat bersama HTML awal, bukan menunggu hidrasi JS. */}
              <h1 className="text-balance text-[44px] font-black leading-[0.98] tracking-[-0.04em] text-[#fff8ef] drop-shadow-[0_2px_20px_rgba(42,14,14,0.25)] sm:text-[66px] md:text-[78px]">
                Tutor matematika yang
                <br />
                <span className="font-serif font-normal italic tracking-[-0.035em] text-[#ffd6a4]">
                  tidak memberi jawaban.
                </span>
              </h1>

              <p className="hero-enter hero-enter-2 mx-auto mt-6 max-w-[590px] text-[14px] leading-[1.7] text-[#f6e7d7]/80 sm:text-[16px]">
                Setiap langkah diperiksa mesin simbolik, lalu dibimbing dengan pertanyaan.
                Tidak ada bocoran jawaban. Kamu yang menemukan jalannya.
              </p>

              <div className="hero-enter hero-enter-3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
                <ActionButton
                  href="/chat"
                  variant="white"
                  size="md"
                  className="w-full sm:w-auto max-w-[240px] sm:max-w-none justify-between h-11 sm:h-[52px] pl-5 sm:pl-6 pr-2 text-xs sm:text-sm font-semibold shadow-md sm:shadow-sm"
                >
                  <span className="truncate">Coba ZAP <span className="hidden sm:inline">sekarang</span></span>
                </ActionButton>
                <Link
                  href="/docs"
                  className="group inline-flex h-11 sm:h-[52px] w-full sm:w-auto max-w-[240px] sm:max-w-none items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 text-xs sm:text-[12.5px] font-semibold text-[#fff4e6] transition-colors hover:border-white/35 hover:bg-white/[0.1]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Baca dokumentasi
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="hero-enter hero-enter-4 mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#f6e7d7]/55">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-[#ffd35c]" /> Tanpa bocoran, termasuk LaTeX
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-[#ffd35c]" /> Deterministik, bukan tebakan LLM
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3 text-[#ffd35c]" /> BYOK atau engine lokal
                </span>
              </div>
            </div>

            {/* The product, at true size — masuk lewat CSS, bukan menunggu hidrasi */}
            <div
              id="produk"
              data-scroll-anchor="produk"
              className="hero-enter hero-enter-5 mt-14 scroll-mt-24 sm:mt-20"
            >
              <ZapChatScrollHero />
            </div>
          </div>
        </section>

        {/* PROOF STRIP */}
        <section className="border-y border-[#e6dacb] bg-[#fbf7f0] dark:border-[#2a2019] dark:bg-[#0d0907]">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 divide-y divide-[#e6dacb] px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 dark:divide-[#2a2019]">
            {[
              {
                icon: ScanSearch,
                title: "Verifikasi simbolik",
                desc: "Whitelist aljabar dan SymPy CAS, batas eksponen sampai 100.",
              },
              {
                icon: ShieldCheck,
                title: "Tanpa bocoran",
                desc: "Guardrail menyaring jawaban akhir, termasuk notasi LaTeX.",
              },
              {
                icon: MessagesSquare,
                title: "Bimbingan Sokrates",
                desc: "Counter-example konkret saat langkahmu keliru.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="px-1 py-7 sm:px-8">
                <div className="flex items-start gap-3.5">
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#a02e1e] dark:text-[#ffb35c]"
                    strokeWidth={1.4}
                  />
                  <div>
                    <h2 className="text-[12.5px] font-semibold tracking-[-0.01em] text-[#1c120c] dark:text-[#f5e9dc]">
                      {title}
                    </h2>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[#75675b] dark:text-[#b7a28e]">
                      {desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="cara-kerja"
          data-scroll-anchor="cara-kerja"
          className="scroll-mt-24 px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28"
        >
          <div className="mx-auto grid max-w-[1120px] items-stretch gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <ScrollReveal className="h-full">
              <div className="flex h-full flex-col">
                <h2 className="text-[36px] font-black leading-[1.01] tracking-[-0.04em] sm:text-5xl">
                  Satu mesin memutuskan,
                  <br />
                  <span className="font-serif font-normal italic text-[#a02e1e] dark:text-[#ff9e4a]">
                    satu model menjelaskan.
                  </span>
                </h2>
                <p className="mt-5 max-w-md text-[13px] leading-[1.75] text-[#75675b] dark:text-[#b7a28e]">
                  Kebenaran matematika tidak pernah diserahkan ke LLM. Mesin deterministik memeriksa setiap baris, LLM
                  hanya merangkai bahasa yang empatik.
                </p>

                <ol className="mt-7 space-y-4">
                  {WORKFLOW.map((item, index) => (
                    <li key={item.title} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dfcebb] bg-[#fffdf8] text-[11px] font-bold text-[#7c5a3e] dark:border-[#3a2c21] dark:bg-[#17110c] dark:text-[#d8c2ac]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-[13px] font-bold">{item.title}</h3>
                        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[#75675b] dark:text-[#b7a28e]">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <Link
                  href="/docs#cfl"
                  className="mt-7 inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-[#a02e1e] transition-colors hover:text-[#f07a1e] dark:text-[#ffb35c]"
                >
                  Detail teknis CFL engine
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1} className="h-full">
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e6dacb] bg-[#fffdf8] text-[#1c120c] shadow-[0_40px_100px_-70px_rgba(42,14,14,0.75)] dark:border-[#33261d] dark:bg-[#17110c] dark:text-[#f5e9dc]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_55%_at_88%_0%,rgba(240,122,30,0.10),transparent_70%)]"
                />

                <div className="relative flex items-center justify-between gap-3 border-b border-[#eadfd2] px-4 py-3.5 sm:px-5 dark:border-[#2a2019]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#eadfd2] bg-[#f7f0e7] dark:border-white/10 dark:bg-white/[0.05]">
                      <Cpu className="h-4 w-4 text-[#a02e1e] dark:text-[#ffb35c]" strokeWidth={1.5} />
                    </span>
                    <div>
                      <div className="text-[12.5px] font-semibold leading-tight">SymPy CAS</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#a9927e] dark:text-[#9d8874]">
                        pemeriksaan langkah
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600/[0.07] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-300">
                    <Check className="h-2.5 w-2.5" />
                    deterministik
                  </span>
                </div>

                <div className="relative flex flex-1 flex-col gap-3 p-4 sm:p-5">
                  <div className="rounded-[14px] border border-[#eadfd2] bg-[#fbf7f0] p-4 dark:border-[#2a2019] dark:bg-[#1c150f]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#a9927e] dark:text-[#9d8874]">
                            langkah siswa
                          </span>
                          <span className="rounded-full border border-[#e6dacb] px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#a9927e] dark:border-[#3a2c21] dark:text-[#9d8874]">
                            2 baris
                          </span>
                        </div>
                        <div className="mt-2.5 space-y-1.5 font-mono text-[12.5px]">
                          <div className="text-[#5f5146] dark:text-[#c8b4a0]">2x + 6 = 14</div>
                          <div className="flex items-center gap-2 text-[#b42318] dark:text-[#ff8a80]">
                            <span>2x = 20</span>
                            <span className="rounded-full bg-[#fdeceb] px-1.5 py-0.5 font-sans text-[9px] font-semibold dark:bg-rose-500/10">
                              galat baris 2
                            </span>
                          </div>
                        </div>
                      </div>
                      <StepCheckViz className="h-12 w-24 shrink-0" />
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#e6dacb] bg-[#fffdf8] p-4 dark:border-[#2a2019] dark:bg-[#1c150f]">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#a02e1e] dark:bg-[#ffb35c]" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#a9927e] dark:text-[#9d8874]">
                        counter-example
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#5f5146] dark:text-[#c8b4a0]">
                      Saat <span className="font-mono">x = 2</span>, ruas kiri bernilai{" "}
                      <span className="font-mono">−4</span>, sedangkan baris kedua menghasilkan{" "}
                      <span className="font-mono">−16</span>. Tanda operasinya belum seimbang.
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-[#f0cba6] bg-[#fff4e7] p-4 dark:border-[#5a3822] dark:bg-[#2a1a0f]">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#b45309] dark:bg-[#ffb35c]" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#b45309] dark:text-[#ffb35c]">
                        pertanyaan sokrates
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#4c3a2c] dark:text-[#e6d4c2]">
                      Operasi apa yang kamu terapkan pada <span className="font-mono">+6</span> saat memindahkannya ke
                      ruas kanan?
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-[#e6dacb] bg-[#fffdf8] p-4 dark:border-[#2a2019] dark:bg-[#1c150f]">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#a9927e] dark:text-[#9d8874]">
                        audit mesin
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-[11px]">
                      {[
                        ["Ekuivalensi ruas", "baris 2 ditolak"],
                        ["Konservasi akar", "terjaga"],
                        ["Bocoran jawaban", "0"],
                      ].map(([label, value]) => (
                        <li key={label} className="flex items-center justify-between gap-3">
                          <span className="text-[#75675b] dark:text-[#b7a28e]">{label}</span>
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#7c5a3e] dark:text-[#d8c2ac]">
                            {value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="relative flex items-center justify-between gap-3 border-t border-[#eadfd2] bg-[#fbf7f0] px-4 py-2.5 text-[9.5px] text-[#a9927e] sm:px-5 dark:border-[#2a2019] dark:bg-[#1c150f] dark:text-[#9d8874]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> Zero-Answer Guardrail aktif
                  </span>
                  <span className="font-mono max-sm:hidden">root conservation: conserved</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* DOMAINS + SECURITY */}
        <section
          id="domain"
          data-scroll-anchor="domain"
          className="scroll-mt-24 px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-16"
        >
          <div className="mx-auto max-w-[1120px]">
            <ScrollReveal>
              <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#a9927e] dark:text-[#a08d7c]">
                    Empat domain · satu mesin verifikasi
                  </span>
                  <h2 className="mt-3 max-w-xl text-[36px] font-black leading-[1.01] tracking-[-0.04em] sm:text-5xl">
                    Bukan hanya matematika.
                  </h2>
                </div>
                <p className="max-w-sm text-[12.5px] leading-relaxed text-[#75675b] dark:text-[#b7a28e]">
                  Setiap item diverifikasi mesin sesuai domainnya, bukan hasil karangan model. Empat pemeriksa, empat
                  cara membaca langkahmu.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {DOMAINS.map((domain, index) => {
                const Icon = domain.icon;
                const Viz = domain.Viz;
                return (
                  <ScrollReveal key={domain.key} delay={0.05 * index} className="h-full">
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e6dacb] bg-[#fffdf8] p-5 text-[#1c120c] shadow-[0_30px_80px_-70px_rgba(42,14,14,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#cfae8b] hover:shadow-[0_40px_100px_-70px_rgba(42,14,14,0.9)] dark:border-[#33261d] dark:bg-[#1a120b] dark:text-[#f5e9dc] dark:shadow-[0_40px_90px_-70px_rgba(0,0,0,0.95)] dark:hover:border-[#4d3826]">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_60%_at_12%_0%,rgba(240,122,30,0.12),transparent_70%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.1] dark:opacity-[0.18]"
                        style={{
                          backgroundImage: "radial-gradient(currentColor 0.6px, transparent 0.7px)",
                          backgroundSize: "18px 18px",
                          maskImage: "linear-gradient(to bottom, black, transparent 62%)",
                          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 62%)",
                        }}
                      />

                      <div className="relative flex items-center justify-between gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#eadfd2] bg-[#f7f0e7] dark:border-white/10 dark:bg-white/[0.05]">
                          <Icon className="h-4 w-4 text-[#a02e1e] dark:text-[#ffb35c]" strokeWidth={1.5} />
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600/[0.07] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-300">
                          <span className="pulse-dot h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          terverifikasi
                        </span>
                      </div>

                      <div className="relative mt-4">
                        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{domain.name}</h3>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a7969] dark:text-[#a8927c]">
                          {domain.meta}
                        </p>
                        <p className="mt-2.5 max-w-[42ch] text-[12px] leading-relaxed text-[#6f6155] dark:text-[#a08d7c]">
                          {domain.body}
                        </p>
                      </div>

                      <div className="relative mt-auto pt-5">
                        <div className="overflow-hidden rounded-[12px] border border-[#e6d9c8] bg-[#f7f1e7] transition-transform duration-500 [transform:perspective(900px)] group-hover:[transform:perspective(900px)_rotateX(2.5deg)] dark:border-white/[0.07] dark:bg-[#0d0805]">
                          <div className="flex items-center justify-between gap-2 border-b border-[#e6d9c8] px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#a9927e] dark:border-white/[0.06] dark:text-[#8f7864]">
                            <span>{domain.tag}</span>
                            <span className="inline-flex items-center gap-1 text-[#b45309] dark:text-[#c9a17a]">
                              <span className="h-1 w-1 rounded-full bg-[#c2410c] dark:bg-[#ffb35c]" />
                              live
                            </span>
                          </div>
                          <div className="aspect-[24/11] w-full">
                            <Viz className="h-full w-full" />
                          </div>
                        </div>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>

            <ScrollReveal delay={0.08}>
              <div className="mt-16 overflow-hidden rounded-[14px] border border-[#e6dacb] bg-[#fffdf8] dark:border-[#2a2019] dark:bg-[#17110c]">
                <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="flex flex-col justify-center p-7 sm:p-10">
                    <h2 className="text-[30px] font-black leading-[1.02] tracking-[-0.04em] sm:text-[40px]">
                      Percakapan &amp; API key,
                      <br />
                      <span className="font-serif font-normal italic text-[#a02e1e] dark:text-[#ff9e4a]">
                        terenkripsi di peramban.
                      </span>
                    </h2>
                    <p className="mt-4 max-w-md text-[12.5px] leading-[1.75] text-[#75675b] dark:text-[#b7a28e]">
                      Vault dienkripsi dengan passphrase milikmu memakai AES-GCM 256 sebelum dikirim. Server tidak
                      memiliki kunci untuk membukanya, dan kunci API ikut tersinkron aman antar perangkat.
                    </p>
                    <Link
                      href="/docs#vault"
                      className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#dfcebb] bg-[#fbf7f0] px-4 py-2 text-[11.5px] font-semibold transition-colors hover:border-[#c9ab8e] hover:bg-[#fff8ee] dark:border-[#3a2c21] dark:bg-[#1c150f] dark:hover:bg-[#241a12]"
                    >
                      Pelajari model keamanan
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="kx-on-dark relative flex items-center justify-center overflow-hidden border-t border-[#eadfd2] bg-[#1c120c] p-7 text-[#fff7ec] dark:border-[#2a2019] sm:p-10 lg:border-l lg:border-t-0">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_70%_20%,rgba(240,122,30,0.22),transparent_65%)]"
                    />
                    <VaultStage className="relative max-w-[420px]" />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <div className="cv-auto">
          <ModelShowcase />
        </div>

        <div className="cv-auto">
          <FaqSection />
        </div>

        {/* CLOSING CTA — compact, dot backdrop + cursor glow */}
        <div className="cv-auto">
          <ClosingCta />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import ZapLogo from "@/components/ZapLogo";
import ActionButton from "@/components/landing/ActionButton";
import {
  ZeroAnswerEmblem,
  SymPyCasEmblem,
  SmartboardSpatialEmblem,
  ScratchpadPenEmblem,
  SocraticDialogueEmblem,
  LocalEnclaveEmblem,
  SovereignAuditEmblem,
} from "@/components/PlatformIcons";

export interface WaitlistProduct {
  slug: string;
  title: string;
  subtitle: string;
  earlyBirdPerk: string;
}

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const rotate = useTransform(scrollYProgress, [0, 0.85], isMobile ? [0, 0] : [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.85], isMobile ? [0.96, 1] : [1.03, 1]);
  const translate = useTransform(scrollYProgress, [0, 0.85], isMobile ? [0, 0] : [0, -50]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center relative px-2 sm:px-4 md:px-8 pt-2 sm:pt-4 pb-6 sm:pb-8 md:pb-10"
    >
      <div
        className="w-full relative"
        style={{ perspective: isMobile ? "none" : "1200px" }}
      >
        <motion.div
          style={{ translateY: translate }}
          className="max-w-5xl mx-auto text-center z-10 relative"
        >
          {titleComponent}
        </motion.div>

        <motion.div
          style={{
            rotateX: rotate,
            scale,
            boxShadow:
              "0 24px 60px rgba(9,9,11,0.07), 0 40px 80px rgba(9,9,11,0.04), 0 0 0 1px rgba(9,9,11,0.06)",
          }}
          className="max-w-5xl mt-6 sm:mt-10 mx-auto h-[350px] sm:h-[36rem] md:h-[40rem] w-full border-2 sm:border-4 border-zinc-200/80 p-1.5 sm:p-3 md:p-4 bg-[#f5f3ef]/90 rounded-[18px] sm:rounded-[32px]"
        >
          <div className="h-full w-full overflow-hidden rounded-[13px] sm:rounded-[22px] bg-white border border-zinc-200/80 shadow-sm">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function HeroWorkspacePreview({
  lang = "id",
  onOpenWaitingList,
}: {
  lang?: "id" | "en";
  onOpenWaitingList?: (product: WaitlistProduct) => void;
}) {
  const isId = lang === "id";
  const [activeId, setActiveId] = useState<string>("socratic-studio");
  const [mobileSideOpen, setMobileSideOpen] = useState<boolean>(true);
  const [corpusCount, setCorpusCount] = useState<number>(12428);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    if (!base) return;
    fetch(`${base}/api/v1/harness/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d && d.corpus && d.corpus.total_records;
        if (typeof n === "number" && n > 0) setCorpusCount(n);
      })
      .catch(() => {});
  }, []);
  const corpusLabel = corpusCount.toLocaleString("id-ID");

  const modules = [
    {
      id: "socratic-studio",
      category: "ai",
      name: isId ? "ChatZAP Socratic" : "ChatZAP Socratic",
      icon: <SocraticDialogueEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/chat",
      title: isId ? "ChatZAP Socratic Workspace" : "ChatZAP Socratic Workspace",
      desc: isId
        ? "Playground interaktif dengan papan tulis matematika, diagnostik aljabar SymPy CAS real-time, dan dialog Sokrates bebas bocoran kunci."
        : "Interactive math workspace with live SymPy CAS algebraic diagnostics, 2D/3D canvas, and Zero-Answer Socratic guidance.",
    },
    {
      id: "sympy-cas",
      category: "ai",
      name: "SymPy CAS Engine",
      icon: <SymPyCasEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/chat",
      title: isId ? "Deterministic SymPy CAS Kernel" : "Deterministic SymPy CAS Kernel",
      desc: isId
        ? "Mesin kebenaran aljabar simbolik yang menguji ekuivalensi langkah, konservasi akar, dan kontra-contoh aritmetika tanpa halusinasi LLM."
        : "Symbolic Computer Algebra System verifying step equivalence, root conservation, and arithmetic counter-examples with zero LLM hallucination.",
    },
    {
      id: "smartboard-3d",
      category: "infra",
      name: isId ? "Smartboard 2D & 3D" : "2D & 3D Smartboard",
      icon: <SmartboardSpatialEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/chat",
      title: isId ? "Kanvas Geometri Spasial 2D & 3D" : "2D & 3D Spatial Geometry Canvas",
      desc: isId
        ? "Visualisasi interaktif irisan kerucut, permukaan kuadrik 3D, bidang koordinat fungsi y = f(x), dan coretan kapur real-time."
        : "Interactive 3D conic sections, quadric surfaces, dynamic 2D function plotting, and real-time chalkboard sketching.",
    },
    {
      id: "connector-hub",
      category: "infra",
      name: "Multi-LLM Connector",
      icon: <LocalEnclaveEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/connector",
      title: isId ? "BYOK Multi-Model Connector Hub" : "BYOK Multi-Model Connector Hub",
      desc: isId
        ? "Hubungkan API key Gemini, Claude, OpenAI, DeepSeek, NVIDIA NIM, atau model lokal Ollama langsung dari peramban Anda."
        : "Connect your own Gemini, Claude, OpenAI, DeepSeek, NVIDIA NIM, or local Ollama models directly in your browser.",
    },
    {
      id: "curriculum",
      category: "infra",
      name: isId ? "Kurikulum TK – S3" : "TK – PhD Curriculum",
      icon: <ScratchpadPenEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/chat",
      title: isId ? "Adaptasi Pedagogis Lintas Jenjang (TK–S3)" : "Cross-Tier Pedagogical Adaptation (K–PhD)",
      desc: isId
        ? "Kedalaman pertanyaan menyesuaikan otomatis dari pendekatan konkret CPA sekolah dasar hingga bukti formal kalkulus dan aljabar lanjut."
        : "Question depth adapts automatically from Concrete-Pictorial-Abstract (CPA) primary math to formal university proofs.",
    },
    {
      id: "sovereign-vault",
      category: "ecosystem",
      name: "Zero-Answer Guard",
      icon: <ZeroAnswerEmblem className="w-4 h-4" />,
      status: "live" as const,
      badge: "Live",
      route: "/chat",
      title: isId ? "Zero-Answer Guardrail & UU PDP Vault" : "Zero-Answer Guardrail & Sovereign Vault",
      desc: isId
        ? "Filter deterministik berlapis yang menyensor bocoran solusi akhir. Riwayat belajar tersimpan lokal di peramban, dengan cadangan vault akun di server bagi pengguna yang masuk."
        : "Multi-layer deterministic sanitizer preventing final answer leaks. Learning history is stored locally in the browser, with an account vault backup on the server for signed-in users.",
    },
    {
      id: "classroom-analytics",
      category: "ecosystem",
      name: isId ? "Analitik Kelas Guru" : "Classroom Analytics",
      icon: <SovereignAuditEmblem className="w-4 h-4" />,
      status: "waitlist" as const,
      badge: "Waitlist",
      slug: "classroom-analytics",
      earlyBirdPerk: isId
        ? "Akses Beta Prioritas Sekolah + Dashboard Heatmap Miskonsepsi Kelas"
        : "Priority School Beta + Classroom Misconception Heatmap Dashboard",
      title: isId ? "Dashboard Diagnostik Guru & Sekolah" : "Teacher & Institutional Diagnostic Suite",
      desc: isId
        ? "Pantau peta miskonsepsi aljabar satu kelas secara real-time tanpa risiko siswa menyalin kunci jawaban PR."
        : "Monitor class-wide algebraic misconception heatmaps in real-time with guaranteed anti-cheating homework scaffolding.",
    },
    {
      id: "olympiad-arena",
      category: "ecosystem",
      name: isId ? "Arena Olimpiade OSN" : "Olympiad Proof Lab",
      icon: <SymPyCasEmblem className="w-4 h-4" />,
      status: "waitlist" as const,
      badge: "Waitlist",
      slug: "olympiad-arena",
      earlyBirdPerk: isId
        ? "Akses Batch 1 Bank Soal OSN/IMO Terverifikasi CAS"
        : "Batch 1 Access to CAS-Verified Olympiad Problem Bank",
      title: isId ? "Laboratorium Pembuktian Olimpiade (OSN & IMO)" : "Olympiad & Formal Proof Sparring Lab",
      desc: isId
        ? "Latihan pembuktian teorema tingkat olimpiade dengan verifikasi langkah simbolik ketat dan petunjuk heuristik Polya."
        : "Competition math proof sparring with strict symbolic step verification and Polya heuristic hints.",
    },
  ];

  const activeModule = modules.find((m) => m.id === activeId) || modules[0];

  return (
    <div className="w-full h-full bg-white text-[#09090b] rounded-xl flex flex-col font-sans select-none overflow-hidden border border-zinc-200/90 shadow-2xl">
      {/* MOBILE TOP CHROME */}
      <div className="flex md:hidden items-center justify-between px-2.5 py-1.5 bg-[#faf9f6] border-b border-zinc-200/80 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
          <span className="w-2 h-2 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
          <span className="w-2 h-2 rounded-full bg-[#27c93f] inline-block shadow-sm" />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white border border-zinc-200/90 text-[9px] font-mono text-zinc-700 shadow-sm">
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-emerald-600"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[#09090b] font-semibold">chatzap.web.id</span>
          <span className="text-zinc-600">/chat</span>
        </div>
        <div className="w-4" />
      </div>

      {/* DESKTOP TOP CHROME */}
      <div className="hidden md:flex items-center justify-between px-4 py-3 bg-[#faf9f6] border-b border-zinc-200/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm" />
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-mono text-zinc-500 max-w-sm w-full justify-center truncate shadow-sm">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-emerald-600"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[#09090b] font-medium">chatzap.web.id</span>
          <span className="text-zinc-600">/chat/{activeId}</span>
        </div>
        <div className="w-[52px] hidden sm:block" />
      </div>

      {/* MOBILE BODY: dua panel seperti semula, sidebar bisa dibuka-tutup */}
      <div className="flex md:hidden flex-1 overflow-hidden select-none bg-white">
        {mobileSideOpen && (
          <div className="w-[128px] bg-[#faf9f6] border-r border-zinc-200/80 p-1.5 flex flex-col justify-between shrink-0 overflow-hidden">
            <div className="space-y-1 overflow-hidden">
              <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-500 px-1 pt-0.5">
                AI &amp; CAS ENGINE
              </div>
              {modules.slice(0, 6).map((item) => {
                const isSelected = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`w-full px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? "bg-white border border-zinc-200/90 shadow-sm"
                        : "hover:bg-zinc-200/40"
                    }`}
                  >
                    <span className={`block text-[9.5px] leading-[1.2] ${isSelected ? "font-bold text-[#09090b]" : "text-zinc-600"}`}>
                      {item.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[8px] font-mono font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="p-1.5 rounded-lg bg-white border border-zinc-200/90 shadow-sm flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#09090b] text-white flex items-center justify-center p-0.5 shrink-0">
                <ZapLogo className="w-2.5 h-2.5" />
              </div>
              <div className="overflow-hidden text-left leading-none">
                <div className="text-[9px] font-bold text-[#09090b] truncate">
                  ChatZAP <span className="text-[#7d551f] font-normal">CAS</span>
                </div>
                <div className="text-[8px] text-zinc-500 font-mono truncate mt-0.5">
                  Zero-Answer Mode
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 p-2.5 bg-white flex flex-col justify-between overflow-hidden text-left min-w-0">
          <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSideOpen((v) => !v)}
                aria-label={mobileSideOpen ? "Tutup sidebar pratinjau" : "Buka sidebar pratinjau"}
                aria-expanded={mobileSideOpen}
                className="w-6 h-6 rounded-md border border-zinc-200 bg-[#faf9f6] text-zinc-600 flex items-center justify-center shrink-0 active:bg-zinc-200/60"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
              <h2 className="font-extrabold text-[11px] text-[#09090b] tracking-tight leading-tight truncate">
                {activeModule.title}
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-mono font-semibold shrink-0">
              Live
            </span>
          </div>
          <p className="text-[8.5px] text-zinc-500 font-mono mt-1 truncate">
            SymPy CAS • Zero-Answer Policy Enforced
          </p>

          <div className="grid grid-cols-3 gap-1 my-1.5">
            <div className="p-1.5 rounded-md bg-[#faf9f6] border border-zinc-200/80">
              <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-500">PRE-PARSE</div>
              <div className="text-[10px] font-extrabold text-[#09090b] font-mono mt-0.5">&lt; 1 ms</div>
              <div className="text-[8.5px] text-emerald-700 font-medium truncate">SymPy CAS</div>
            </div>
            <div className="p-1.5 rounded-md bg-[#faf9f6] border border-zinc-200/80">
              <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-500">KORPUS</div>
              <div className="text-[10px] font-extrabold text-[#8f5e32] font-mono mt-0.5">{corpusLabel}</div>
              <div className="text-[8.5px] text-zinc-500 font-medium truncate">Soal Terverifikasi</div>
            </div>
            <div className="p-1.5 rounded-md bg-[#faf9f6] border border-zinc-200/80">
              <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-500">KANVAS</div>
              <div className="text-[10px] font-extrabold text-[#09090b] font-mono mt-0.5">2D &amp; 3D</div>
              <div className="text-[8.5px] text-emerald-700 font-medium truncate">Interactive</div>
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-zinc-200/90 p-2 bg-[#faf9f6]/80 font-mono text-[9px] space-y-1 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-2 text-emerald-700 font-bold">
              <span className="truncate">#1 (x + 3)² - 4 = 0</span>
              <span className="shrink-0 whitespace-nowrap">✓ Basis Valid</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-amber-700 font-bold">
              <span className="truncate">#2 x² + 9 - 4 = 0</span>
              <span className="shrink-0 whitespace-nowrap">⚠️ Galat Suku Silang</span>
            </div>
            <div className="text-zinc-600 font-sans leading-snug pt-1 border-t border-zinc-200/80">
              💬 &quot;Apakah (a + b)² ekuivalen dengan a² + b²? Coba uji saat x = 1.&quot;
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP BODY */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="hidden md:flex md:w-60 bg-[#faf9f6] border-r border-zinc-200/80 p-3 flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-3.5">
            {[
              { title: "AI & WORKSPACE", category: "ai" },
              { title: isId ? "ENGINE & KURIKULUM" : "ENGINE & CURRICULUM", category: "infra" },
              { title: isId ? "EKOSISTEM & PRIVASI" : "ECOSYSTEM & PRIVACY", category: "ecosystem" },
            ].map((section) => (
              <div key={section.category} className="space-y-1">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-600 px-2 py-0.5">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {modules
                    .filter((m) => m.category === section.category)
                    .map((item) => {
                      const isSelected = activeId === item.id;
                      const isLive = item.status === "live";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveId(item.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                            isSelected
                              ? "bg-white text-[#09090b] font-bold border border-zinc-200/90 shadow-sm"
                              : "text-zinc-600 hover:text-[#09090b] hover:bg-zinc-200/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`text-xs shrink-0 ${isSelected ? "text-[#8f5e32]" : "text-zinc-600"}`}>{item.icon}</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-medium ${
                              isLive
                                ? isSelected
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "text-emerald-700"
                                : isSelected
                                ? "bg-[#faf4ed] text-[#8f5e32] border border-[#d4a574]/40"
                                : "text-zinc-600"
                            }`}
                          >
                            {item.badge}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-zinc-200/90 flex items-center gap-2.5 mt-3 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#09090b] text-white flex items-center justify-center p-1.5 shrink-0 shadow-sm">
              <ZapLogo className="w-4 h-4" />
            </div>
            <div className="overflow-hidden text-left">
              <div className="text-xs font-bold text-[#09090b] tracking-tight truncate flex items-center gap-1">
                ChatZAP
              </div>
              <div className="text-[10px] text-zinc-600 font-mono truncate">
                Deterministic CAS Mode
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 w-full flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4 text-left bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#faf9f6] border border-zinc-200/80 text-[#09090b] flex items-center justify-center shrink-0">
                  {activeModule.icon}
                </span>
                <h2 className="font-extrabold text-lg sm:text-xl text-[#09090b] tracking-tight">
                  {activeModule.title}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-xl leading-relaxed">
                {activeModule.desc}
              </p>
            </div>

            {activeModule.status === "live" ? (
              <ActionButton
                href={activeModule.route}
                variant="black"
                size="sm"
                className="shrink-0"
              >
                {isId ? "Buka ChatZAP" : "Open ChatZAP"}
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() =>
                  onOpenWaitingList?.({
                    slug: activeModule.slug || activeModule.id,
                    title: activeModule.title,
                    subtitle: activeModule.desc,
                    earlyBirdPerk: activeModule.earlyBirdPerk || "",
                  })
                }
                variant="amber"
                size="sm"
                className="shrink-0"
              >
                {isId ? "Gabung Waiting List" : "Join Waiting List"}
              </ActionButton>
            )}
          </div>

          {/* MODULE 1: SOCRATIC STUDIO */}
          {activeId === "socratic-studio" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">
                    {isId ? "Mode Workspace" : "Workspace Mode"}
                  </div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">
                    Socratic Chat
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    {isId ? "Zero-Answer Aktif" : "Zero-Answer Enforced"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Multi-Modal</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">
                    LaTeX &amp; 3D Mesh
                  </div>
                  <div className="text-[11px] text-zinc-500 font-medium">
                    {isId ? "Plot Kurva Otomatis" : "Auto Function Plotter"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">
                    {isId ? "Hakim Aljabar" : "Algebra Arbiter"}
                  </div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">
                    SymPy CAS
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    {isId ? "Deterministik < 1 ms" : "Deterministic < 1 ms"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">
                    {isId ? "Integrasi" : "Integration"}
                  </div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                    {isId ? "Siap Pakai" : "Ready"}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-medium">
                    Web Canvas &amp; BYOK API
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#faf9f6]/90 border border-zinc-200/90 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 text-[11px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {isId
                      ? "Sesi Live ZAP Socratic Scratchpad"
                      : "Live ZAP Socratic Scratchpad Session"}
                  </span>
                  <span>
                    {isId ? "Zero-Answer Guardrail Aktif" : "Zero-Answer Guardrail Active"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <div className="p-3 rounded-lg bg-white border border-zinc-200/80 font-mono text-[11px] space-y-1.5 shadow-sm">
                    <div className="text-[10px] font-bold uppercase text-zinc-600">
                      {isId ? "Coretan Langkah Siswa" : "Student Derivation Steps"}
                    </div>
                    <div className="flex items-center justify-between text-zinc-800">
                      <span>#1 (x + 3)² - 4 = 0</span>
                      <span className="text-emerald-700 font-sans font-semibold">✓ Basis</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-700 font-semibold">
                      <span>#2 x² + 9 - 4 = 0</span>
                      <span className="text-amber-700 font-sans">⚠️ Galat Baris</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>#3 x² + 5 = 0</span>
                      <span className="font-sans">Tertahan</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-zinc-200/80 space-y-1.5 shadow-sm">
                    <div className="text-[10px] font-mono font-bold uppercase text-[#8f5e32]">
                      {isId ? "Diagnostik CAS & Pertanyaan Sokrates" : "CAS Diagnostic & Socratic Prompt"}
                    </div>
                    <p className="text-zinc-600 text-[11px] leading-relaxed">
                      {isId
                        ? "Kontra-contoh SymPy: Saat x = 1, baris #1 bernilai (1+3)² - 4 = 12, sedangkan baris #2 bernilai 1² + 9 - 4 = 6."
                        : "SymPy Counter-example: At x = 1, line #1 evaluates to 12, whereas line #2 evaluates to 6."}
                    </p>
                    <p className="text-[#09090b] font-semibold text-[11px]">
                      💬 &quot;
                      {isId
                        ? "Apakah (a + b)² sama dengan a² + b²? Suku mana yang terlewat saat menjabarkan (x + 3)(x + 3)?"
                        : "Does (a + b)² equal a² + b²? Which cross-term is missing when expanding (x + 3)(x + 3)?"}
                      &quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: SYMPY CAS */}
          {activeId === "sympy-cas" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Pre-Parse</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">&lt; 1 ms</div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    Whitelist First
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Korpus</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">{corpusLabel}</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Soal Terverifikasi SymPy</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Test Coverage</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">116 Tes</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Pytest Verified</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Batas Derajat</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">Deg ≤ 100</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Safe Exponents</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#18181b] font-mono text-xs text-zinc-300 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                  <span>POST /api/verify • SymPy CFL Engine</span>
                  <span className="text-emerald-400 font-bold">200 OK • Deterministic</span>
                </div>
                <p>
                  <span className="text-[#d4a574]">from</span> cfl.cfl_engine{" "}
                  <span className="text-[#d4a574]">import</span> verify_derivation_steps
                </p>
                <p className="text-zinc-100">
                  result = verify_derivation_steps([&quot;(x+3)^2 - 4 = 0&quot;, &quot;x^2 + 6*x + 5 = 0&quot;], target_var=&quot;x&quot;)
                </p>
                <p className="text-emerald-400">
                  # =&gt; &#123; &quot;is_valid&quot;: True, &quot;root_conservation&quot;: &quot;CONSERVED&quot;, &quot;first_broken_line&quot;: None &#125;
                </p>
              </div>
            </div>
          )}

          {/* MODULE 3: SMARTBOARD 2D & 3D */}
          {activeId === "smartboard-3d" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Engine 3D</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">Three.js WebGL</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Orbit Interaktif</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Geometri</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">Irisan Kerucut</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Elips, Parabola, Hiperbola</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Plotter 2D</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">Multi-Kurva</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Akar &amp; Titik Ekstrem</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Papan Kapur</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">Stylus Ready</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Mode Proyektor Kelas</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#faf9f6]/90 border border-zinc-200/90 text-xs font-mono space-y-1.5 text-zinc-700">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 text-[11px] text-zinc-500">
                  <span className="font-semibold text-[#09090b]">
                    InteractiveCanvas3D • Scene Telemetry
                  </span>
                  <span className="text-emerald-700 font-semibold">WebGL2 Active</span>
                </div>
                <p>▸ Surface 1: z = x²/a² - y²/b² (Hyperbolic Paraboloid Saddle)</p>
                <p>▸ Cutting Plane: z = 0.5*x + 1.2 (Interactive Slicing Enabled)</p>
              </div>
            </div>
          )}

          {/* MODULE 4: CONNECTOR HUB */}
          {activeId === "connector-hub" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Penyedia</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">6+ Frontier</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Gemini, Claude, GPT</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Penyimpanan</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">BYOK Lokal</div>
                  <div className="text-[11px] text-zinc-500 font-medium">localStorage Browser</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Mode Offline</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">Ollama Local</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Tanpa Kuota Cloud</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Reasoning</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">Effort Control</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Low / Med / High</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#faf9f6]/90 border border-zinc-200/90 font-mono text-xs text-zinc-700 space-y-1.5">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 text-[11px] text-zinc-500">
                  <span>Active Model Routing Table</span>
                  <span className="text-emerald-700 font-semibold">Zero-Answer Sanitizer Attached</span>
                </div>
                <div className="grid grid-cols-3 text-[11px] text-zinc-600 font-bold">
                  <span>Provider</span>
                  <span>Model ID</span>
                  <span>Role</span>
                </div>
                <div className="grid grid-cols-3 text-[11px] text-zinc-800">
                  <span className="text-[#09090b] font-bold">SymPy CAS</span>
                  <span>cfl-engine-local</span>
                  <span>Mathematical Truth Tier</span>
                </div>
                <div className="grid grid-cols-3 text-[11px] text-zinc-800">
                  <span className="text-[#8f5e32] font-bold">Gemini / Claude</span>
                  <span>Socratic Voice</span>
                  <span>Empathetic Scaffolding</span>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: CURRICULUM */}
          {activeId === "curriculum" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Dasar</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">TK, SD &amp; SMP</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Visual CPA &amp; Neraca</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Menengah</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">SMA &amp; SMK</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Aljabar, Trigonometri, Limit</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Pendidikan Tinggi</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">S1, S2 &amp; S3</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Kalkulus Vektor &amp; Bukti</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Standar</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">Kurikulum</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Merdeka &amp; Cambridge</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#faf9f6]/90 border border-zinc-200/90 text-xs space-y-1.5 text-zinc-700">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 text-[11px] text-zinc-500 font-mono">
                  <span>Ontologi Miskonsepsi Matematika Terstruktur</span>
                  <span className="text-emerald-700 font-semibold">Semua Jenjang Aktif</span>
                </div>
                <p>1. SD/SMP: Kesetaraan dua ruas persamaan linear &amp; operasi pecahan visual.</p>
                <p>2. SMA/S1–S3: Konservasi domain akar, pembagian dengan nol, dan diferensial multivariabel.</p>
              </div>
            </div>
          )}

          {/* MODULE 6, 7, 8: SOVEREIGN VAULT & WAITLIST */}
          {(activeId === "sovereign-vault" ||
            activeId === "classroom-analytics" ||
            activeId === "olympiad-arena") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Penyimpanan</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">Vault Akun</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Lokal + Cadangan Server</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Kepatuhan</div>
                  <div className="text-base font-bold text-[#8f5e32] font-mono mt-0.5">UU PDP RI</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Right to Erasure</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Data Dijual</div>
                  <div className="text-base font-bold text-[#09090b] font-mono mt-0.5">0 Bytes</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Tanpa Pelacak Iklan</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-zinc-200/80">
                  <div className="text-[11px] uppercase font-mono text-zinc-600">Status</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                    {activeModule.status === "live" ? "Live" : "Early Access"}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-medium">
                    {activeModule.status === "live" ? "Siap Digunakan" : "Waitlist Terbuka"}
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#faf9f6]/90 border border-zinc-200/90 text-xs font-mono space-y-1.5 text-zinc-700">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 text-[11px] text-zinc-500">
                  <span>RobustZeroAnswerGuardrail &amp; Security Audit</span>
                  <span className="text-emerald-700 font-semibold">Verified • 5 Payloads Blocked &lt; 1ms</span>
                </div>
                <p className="text-zinc-800">
                  policy: &quot;ZERO_ANSWER_ENFORCED&quot; • leak_sanitization: &quot;ACTIVE&quot; • storage: &quot;LOCAL_VAULT&quot;
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sample Caption */}
      <div className="shrink-0 px-3.5 py-1.5 text-right text-[11px] text-zinc-600 bg-[#faf9f6] border-t border-zinc-100">
        {isId ? "Contoh tampilan interaktif" : "Interactive workspace preview"}
      </div>
    </div>
  );
}

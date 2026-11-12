"use client";

import React, { useState, useEffect, useRef } from "react";
import ZapLogo from "@/components/ZapLogo";

function PixelMascot({ className = "" }: { className?: string }) {
  const accent = "#d2865c";
  const eye = "#1a1b1e";
  return (
    <svg
      viewBox="0 0 24 20"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="10" fill={accent} />
      <rect x="2" y="6" width="3" height="4" fill={accent} />
      <rect x="19" y="6" width="3" height="4" fill={accent} />
      <rect x="9" y="4" width="2" height="4" fill={eye} />
      <rect x="14" y="4" width="2" height="4" fill={eye} />
      <rect x="7" y="12" width="2" height="4" fill={accent} />
      <rect x="10" y="12" width="2" height="3" fill={accent} />
      <rect x="14" y="12" width="2" height="3" fill={accent} />
      <rect x="17" y="12" width="2" height="4" fill={accent} />
    </svg>
  );
}

const TERMINAL_SCRIPTS = {
  id: {
    prompt:
      "zap-cfl verify --steps \"(x + 3)^2 - 4 = 0\" \"x^2 + 9 - 4 = 0\" --var x --guardrail strict",
    thinking: "Memvalidasi aljabar dengan SymPy CAS…",
    script: [
      { kind: "thinking" as const },
      {
        kind: "text" as const,
        text: "Aku akan memeriksa whitelist parser, menguji ekuivalensi simbolik di SymPy CAS, dan menyusun pertanyaan Sokrates.",
      },
      {
        kind: "tool" as const,
        label: "Parser",
        detail: "cfl/parser.py · _is_plain_algebra() & degree <= 100  (PASS < 1ms)",
      },
      {
        kind: "tool" as const,
        label: "SymPy",
        detail: "simplify(step1 - step2) => 6*x != 0  (Kontra-contoh x=1: 12 != 6)",
      },
      {
        kind: "tool" as const,
        label: "Guard",
        detail: "RobustZeroAnswerGuardrail.sanitize() · Kunci x=-1, x=-5 disensor",
      },
      {
        kind: "done" as const,
        text: "Selesai. Galat suku silang 2ab terdeteksi di baris #2. Pertanyaan Sokrates siap dikirim tanpa membocorkan kunci.",
      },
    ],
  },
  en: {
    prompt:
      "zap-cfl verify --steps \"(x + 3)^2 - 4 = 0\" \"x^2 + 9 - 4 = 0\" --var x --guardrail strict",
    thinking: "Verifying algebra with SymPy CAS…",
    script: [
      { kind: "thinking" as const },
      {
        kind: "text" as const,
        text: "I'll run pre-parse whitelist checks, verify symbolic equivalence in SymPy CAS, and sanitize the Socratic hint.",
      },
      {
        kind: "tool" as const,
        label: "Parser",
        detail: "cfl/parser.py · _is_plain_algebra() & degree <= 100  (PASS < 1ms)",
      },
      {
        kind: "tool" as const,
        label: "SymPy",
        detail: "simplify(step1 - step2) => 6*x != 0  (Counter-example x=1: 12 != 6)",
      },
      {
        kind: "tool" as const,
        label: "Guard",
        detail: "RobustZeroAnswerGuardrail.sanitize() · Roots x=-1, x=-5 redacted",
      },
      {
        kind: "done" as const,
        text: "Done. Missing cross-term 2ab detected at line #2. Socratic question ready with zero answer leakage.",
      },
    ],
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mengamati apakah elemen sedang terlihat di viewport.
 * Loop animasi demo hanya berjalan saat komponen terlihat dan tab aktif,
 * agar tidak membakar CPU di luar layar.
 */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const inViewRef = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inViewRef };
}

/**
 * sleep() yang berhenti menghitung selama komponen keluar viewport
 * atau tab browser disembunyikan (document.hidden).
 */
function makeGatedSleep(
  isCancelled: () => boolean,
  inViewRef: React.MutableRefObject<boolean>
) {
  return async (ms: number) => {
    let remaining = ms;
    while (remaining > 0) {
      if (isCancelled()) return;
      if (!inViewRef.current || document.hidden) {
        await sleep(200);
        continue;
      }
      const step = Math.min(remaining, 40);
      await sleep(step);
      remaining -= step;
    }
  };
}

function TerminalCasDemo({ lang }: { lang: "id" | "en" }) {
  const [typedPrompt, setTypedPrompt] = useState("");
  const [promptFinished, setPromptFinished] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const [activeStreamIndex, setActiveStreamIndex] = useState(-1);

  const data = TERMINAL_SCRIPTS[lang] || TERMINAL_SCRIPTS.id;
  const { ref: rootRef, inViewRef } = useInView<HTMLDivElement>();

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    const gsleep = makeGatedSleep(() => cancelled, inViewRef);

    const reset = () => {
      setTypedPrompt("");
      setPromptFinished(false);
      setVisibleSteps(0);
      setStreamingText("");
      setActiveStreamIndex(-1);
    };

    (async () => {
      while (!cancelled) {
        reset();
        await gsleep(700);
        if (cancelled) return;

        if (reducedMotion) {
          setTypedPrompt(data.prompt);
        } else {
          for (let i = 1; i <= data.prompt.length; i++) {
            if (cancelled) return;
            setTypedPrompt(data.prompt.slice(0, i));
            await gsleep(22);
          }
        }
        await gsleep(420);
        if (cancelled) return;

        setPromptFinished(true);
        await gsleep(450);

        for (let idx = 0; idx < data.script.length; idx++) {
          if (cancelled) return;
          const step = data.script[idx];
          setVisibleSteps(idx + 1);

          if (step.kind === "thinking") {
            await gsleep(reducedMotion ? 300 : 1050);
          } else if (step.kind === "text" || step.kind === "done") {
            setActiveStreamIndex(idx);
            setStreamingText("");
            if (reducedMotion) {
              setStreamingText(step.text);
            } else {
              for (let c = 1; c <= step.text.length; c++) {
                if (cancelled) return;
                setStreamingText(step.text.slice(0, c));
                await gsleep(13);
              }
            }
            setActiveStreamIndex(-1);
            await gsleep(480);
          } else {
            await gsleep(reducedMotion ? 200 : 620);
          }
        }
        await gsleep(reducedMotion ? 2000 : 3500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, data]);

  return (
    <div ref={rootRef} className="relative w-full max-w-[760px] mx-auto text-left rounded-2xl border border-zinc-800 bg-[#1a1b1e] shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-[#26282c]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex items-center gap-2 ml-2 text-[12px] font-mono text-zinc-400">
          <PixelMascot className="w-5 h-4" />
          <span>cfl-engine · sympy-cas-v2.4</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 font-mono text-[12.5px] leading-6 min-h-[265px]">
        <div className="flex items-start gap-2">
          <span className="text-[#27c93f] shrink-0">❯</span>
          <span className="text-zinc-100">
            {typedPrompt}
            {!promptFinished && <span className="demo-caret" />}
          </span>
        </div>

        {promptFinished && (
          <div className="mt-3 space-y-1.5">
            {data.script.slice(0, visibleSteps).map((item, idx) => {
              const isStreaming = activeStreamIndex === idx;
              if (item.kind === "thinking") {
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-gray-500 animate-zoom-in"
                  >
                    <PixelMascot className="w-4 h-3.5" />
                    <span className="italic">{data.thinking}</span>
                  </div>
                );
              }
              if (item.kind === "tool") {
                const colors: Record<string, string> = {
                  Parser: "text-[#d4a574]",
                  SymPy: "text-[#27c93f]",
                  Guard: "text-[#61afef]",
                };
                return (
                  <div key={idx} className="flex items-start gap-2 animate-zoom-in">
                    <span className={`${colors[item.label] || "text-gray-400"} mt-0.5`}>
                      ●
                    </span>
                    <span>
                      <span
                        className={`font-semibold ${colors[item.label] || "text-gray-300"}`}
                      >
                        {item.label}
                      </span>{" "}
                      <span className="text-gray-400">{item.detail}</span>
                    </span>
                  </div>
                );
              }
              const content = isStreaming ? streamingText : item.text;
              return (
                <div
                  key={idx}
                  className={`animate-zoom-in ${
                    item.kind === "done" ? "text-[#27c93f]" : "text-gray-300"
                  }`}
                >
                  {item.kind === "done" && <span className="mr-1.5">✓</span>}
                  {content}
                  {isStreaming && <span className="demo-caret" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const STUDIO_SCENARIOS = {
  id: [
    {
      user: "Kak, aku jabarin (x + 3)² - 4 = 0 jadi x² + 9 - 4 = 0. Kok pas diuji hasilnya salah ya?",
      attachment: "coretan_kuadrat.tex",
      checks: [
        { site: "cfl.parser", title: "Whitelist & Safe Exponents" },
        { site: "sympy.cas", title: "Kontra-contoh x=1 (12 ≠ 6)" },
        { site: "zap.guard", title: "Zero-Answer Enforced" },
      ],
      answer:
        "Mari kita uji coretanmu dengan angka sederhana! Jika kita masukkan x = 1 ke baris pertama: (1 + 3)² - 4 = 16 - 4 = 12. Namun di baris keduamu: 1² + 9 - 4 = 6. Menurutmu, saat menjabarkan (x + 3)(x + 3), suku perkalian silang mana yang belum ikut tertulis?",
      chart: false,
    },
    {
      user: "Oh iya suku tengah 2·x·3 = 6x ketinggalan! Kalau kurva y = x² + 6x + 5 dan irisan kerucutnya gimana visualnya?",
      attachment: "grafik_kuadrat.csv",
      checks: [
        { site: "sympy.cas", title: "x² + 6x + 5 == (x+3)² - 4 (Valid)" },
        { site: "canvas.3d", title: "Plot Parabola & Titik Puncak" },
      ],
      answer:
        "Tepat sekali! Sekarang kedua barismu sudah ekuivalen di SymPy CAS. Perhatikan grafik fungsi dan distribusi nilai y di bawah ini - di titik x berapa puncak lengkungan parabola tersebut berbalik arah?",
      chart: true,
    },
  ],
  en: [
    {
      user: "I expanded (x + 3)² - 4 = 0 into x² + 9 - 4 = 0. Why does the check say there's a step mismatch?",
      attachment: "quadratic_steps.tex",
      checks: [
        { site: "cfl.parser", title: "Whitelist & Safe Exponents" },
        { site: "sympy.cas", title: "Counter-example x=1 (12 ≠ 6)" },
        { site: "zap.guard", title: "Zero-Answer Enforced" },
      ],
      answer:
        "Let's test your two lines with a simple number! If we plug x = 1 into line #1: (1 + 3)² - 4 = 16 - 4 = 12. But in your line #2: 1² + 9 - 4 = 6. When multiplying (x + 3)(x + 3) term by term, which middle cross-product was left out?",
      chart: false,
    },
    {
      user: "Aha, the middle term 2·x·3 = 6x was missing! How does y = x² + 6x + 5 look on the visual coordinate canvas?",
      attachment: "parabola_plot.csv",
      checks: [
        { site: "sympy.cas", title: "x² + 6x + 5 == (x+3)² - 4 (Valid)" },
        { site: "canvas.3d", title: "Parabola Vertex & Roots" },
      ],
      answer:
        "Spot on! Your new step is proven equivalent by SymPy CAS. Look at the plotted curve and value comparison below - at which x-coordinate does the vertex reach its minimum turning point?",
      chart: true,
    },
  ],
};

interface ChatMsg {
  role: "user" | "assistant";
  text?: string;
  image?: string;
  results?: { site: string; title: string }[];
  searchShown?: number;
  searching?: boolean;
  answer?: string;
  answering?: boolean;
  chart?: boolean;
}

function StudioBrowserDemo({ lang }: { lang: "id" | "en" }) {
  const isId = lang === "id";
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [composerText, setComposerText] = useState("");
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [zoneState, setZoneState] = useState<"none" | "input" | "chat">("none");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { ref: rootRef, inViewRef } = useInView<HTMLDivElement>();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, zoneState]);

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const scenarios = STUDIO_SCENARIOS[lang] || STUDIO_SCENARIOS.id;
    let cancelled = false;
    const gsleep = makeGatedSleep(() => cancelled, inViewRef);

    const updateLastAssistant = (patch: Partial<ChatMsg>) => {
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], ...patch };
            break;
          }
        }
        return next;
      });
    };

    (async () => {
      while (!cancelled) {
        setMessages([]);
        setComposerText("");
        setAttachedFile(null);
        setZoneState("none");
        await gsleep(500);

        for (const turn of scenarios) {
          if (cancelled) return;
          setZoneState("input");

          if (reducedMotion) {
            setComposerText(turn.user);
          } else {
            for (let i = 1; i <= turn.user.length; i++) {
              if (cancelled) return;
              setComposerText(turn.user.slice(0, i));
              await gsleep(20);
            }
          }
          await gsleep(300);

          if (turn.attachment) {
            if (cancelled) return;
            setAttachedFile(turn.attachment);
            await gsleep(850);
          }
          if (cancelled) return;

          setMessages((prev) => [
            ...prev,
            { role: "user", text: turn.user, image: turn.attachment },
          ]);
          setComposerText("");
          setAttachedFile(null);
          await gsleep(450);
          if (cancelled) return;

          setZoneState("chat");
          const checks = turn.checks || [];
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              results: checks,
              searchShown: 0,
              searching: checks.length > 0,
              answer: "",
              answering: false,
              chart: turn.chart,
            },
          ]);

          if (checks.length > 0) {
            await gsleep(750);
            for (let c = 1; c <= checks.length; c++) {
              if (cancelled) return;
              updateLastAssistant({ searchShown: c });
              await gsleep(reducedMotion ? 120 : 520);
            }
            updateLastAssistant({ searching: false });
            await gsleep(520);
          }
          if (cancelled) return;

          updateLastAssistant({ answering: true });
          if (reducedMotion) {
            updateLastAssistant({ answer: turn.answer });
          } else {
            for (let c = 1; c <= turn.answer.length; c++) {
              if (cancelled) return;
              updateLastAssistant({ answer: turn.answer.slice(0, c) });
              await gsleep(12);
            }
          }
          updateLastAssistant({ answering: false });
          await gsleep(reducedMotion ? 1000 : 1800);
        }

        setZoneState("none");
        await gsleep(reducedMotion ? 3000 : 8000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const isSearching = messages.some((m) => m.role === "assistant" && m.searching);

  const renderAttachmentChip = (name: string, small?: boolean) => {
    const isCsv = name.endsWith(".csv");
    return (
      <div
        className={`overflow-hidden border border-zinc-200 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center shadow-sm ${
          small ? "w-8 h-8 rounded-md" : "w-36 h-16 rounded-xl"
        }`}
      >
        {small ? (
          <span className={`text-[9px] font-mono ${isCsv ? "text-[#d4a574]" : "text-[#27c93f]"}`}>
            {isCsv ? "CSV" : "TEX"}
          </span>
        ) : (
          <div
            className={`text-[10px] font-mono ${
              isCsv ? "text-[#d4a574]" : "text-[#27c93f]/90"
            } leading-tight px-2 text-center`}
          >
            {name}
            <div className="mt-1 flex gap-0.5 justify-center">
              <span
                className={`w-6 h-2.5 ${
                  isCsv ? "bg-[#d4a574]/50" : "bg-[#27c93f]/40"
                } rounded`}
              />
              <span className="w-3 h-2.5 bg-white/20 rounded" />
              <span className="w-4 h-2.5 bg-white/30 rounded" />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[760px] mx-auto text-left rounded-2xl border border-zinc-200/80 bg-white shadow-2xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-[#faf9f6]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex items-center gap-1.5 ml-2 text-[13px] font-semibold text-zinc-700">
          <ZapLogo className="w-3.5 h-3.5 text-[#09090b]" />
          <span>ChatZAP Socratic</span>
        </div>
        <span className="ml-auto text-[11px] font-mono font-medium text-zinc-500 bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 shadow-sm">
          sympy-cas + socratic
        </span>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="h-[310px] overflow-y-auto no-scrollbar px-4 sm:px-6 pt-5"
      >
        {messages.length > 0 ? (
          <div className="space-y-4 pb-3">
            {messages.map((msg, idx) =>
              msg.role === "user" ? (
                <div key={idx} className="flex justify-end animate-zoom-in">
                  <div className="max-w-[85%]">
                    {msg.image && (
                      <div className="ml-auto mb-2 w-max">
                        {renderAttachmentChip(msg.image)}
                      </div>
                    )}
                    <div className="rounded-2xl rounded-br-md bg-[#09090b] text-white text-[13.5px] leading-relaxed px-4 py-2.5 shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex gap-2.5 animate-zoom-in">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d4a574] to-[#c4956a] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <ZapLogo className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {msg.results && msg.results.length > 0 && (
                      <div className="mb-3 rounded-xl border border-zinc-200/80 bg-[#faf9f6] p-3">
                        <div className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-700">
                          {msg.searching ? (
                            <span className="w-4 h-4 rounded-full border-2 border-[#d4a574] border-t-transparent animate-spin" />
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#059669"
                              strokeWidth="2.5"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          <span>
                            {msg.searching
                              ? isId
                                ? "Memverifikasi di SymPy CAS…"
                                : "Verifying in SymPy CAS…"
                              : isId
                              ? `Terverifikasi SymPy CAS · ${msg.results.length} tahap lulus`
                              : `SymPy CAS Verified · ${msg.results.length} checks passed`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.results.slice(0, msg.searchShown || 0).map((r) => (
                            <span
                              key={r.site}
                              className="animate-zoom-in inline-flex items-center gap-1.5 text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-full pl-1.5 pr-2.5 py-1 shadow-sm"
                            >
                              <span className="w-3.5 h-3.5 rounded-full bg-[#d4a574]/20 flex items-center justify-center text-[8px] text-[#8f5e32] font-bold">
                                {r.site[0].toUpperCase()}
                              </span>
                              <span className="font-mono font-medium text-[#09090b]">{r.site}</span>
                              <span className="hidden sm:inline text-zinc-600 truncate max-w-[160px]">
                                {r.title}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(msg.answer || msg.answering) && (
                      <div className="text-[13.5px] leading-relaxed text-zinc-700 whitespace-pre-wrap">
                        {msg.answer}
                        {msg.answering && <span className="demo-caret" />}
                      </div>
                    )}

                    {msg.chart && !msg.answering && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-zoom-in">
                        <div className="p-3 rounded-xl border border-zinc-200/80 bg-[#faf9f6]">
                          <div className="text-[11px] font-mono font-bold text-zinc-700 mb-2">
                            {isId
                              ? "Evaluasi Nilai y = (x+3)² - 4"
                              : "Value Trace y = (x+3)² - 4"}
                          </div>
                          <div className="flex items-end gap-2 h-24 pt-2 px-2">
                            {[
                              { x: "x=-5", h: "25%", val: "0" },
                              { x: "x=-3", h: "12%", val: "-4 (Min)" },
                              { x: "x=-1", h: "25%", val: "0" },
                              { x: "x=1", h: "92%", val: "12" },
                            ].map((bar) => (
                              <div
                                key={bar.x}
                                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                              >
                                <span className="text-[9px] font-mono text-zinc-500">
                                  {bar.val}
                                </span>
                                <div
                                  className="w-full rounded-t-md bg-gradient-to-t from-[#c4956a] to-[#d4a574]"
                                  style={{ height: bar.h }}
                                />
                                <span className="text-[9px] font-mono text-zinc-600">
                                  {bar.x}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border border-zinc-200/80 bg-[#faf9f6] flex flex-col justify-between">
                          <div className="text-[11px] font-mono font-bold text-zinc-700">
                            {isId ? "Status Konservasi Akar" : "Root Conservation Status"}
                          </div>
                          <div className="my-2 space-y-1.5 text-[11px] font-mono">
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>SymPy Difference:</span>
                              <span>0 (Identical)</span>
                            </div>
                            <div className="flex justify-between text-zinc-600">
                              <span>Axis of Symmetry:</span>
                              <span>x = -3</span>
                            </div>
                            <div className="flex justify-between text-[#8f5e32] font-semibold">
                              <span>Zero-Answer Guard:</span>
                              <span>Roots Hidden</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-600">
                            {isId
                              ? "Siswa menemukan titik puncak mandiri"
                              : "Student discovers vertex independently"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-300 select-none">
            <ZapLogo className="w-8 h-8 text-zinc-300" />
            <p className="text-sm mt-3 text-zinc-600">
              {isId
                ? "Tuliskan langkah aljabar atau pertanyaan ke ChatZAP…"
                : "Write an algebraic step or ask ChatZAP…"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Composer */}
      <div className="p-3 sm:p-4 border-t border-zinc-100 bg-[#faf9f6]/50">
        <div
          className={`rounded-2xl border bg-white p-2.5 transition-all ${
            zoneState === "input"
              ? "border-[#c4956a] shadow-[0_0_0_3px_rgba(196,149,106,0.14)]"
              : "border-zinc-200/90"
          }`}
        >
          {attachedFile && (
            <div className="mb-2 inline-flex items-center gap-2 animate-zoom-in bg-[#faf9f6] border border-zinc-200 rounded-lg pl-1 pr-2 py-1">
              {renderAttachmentChip(attachedFile, true)}
              <span className="text-[12px] text-zinc-600 font-medium">{attachedFile}</span>
              <span className="text-[11px] text-emerald-600">✓</span>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 min-h-[38px] px-2 py-1.5 text-[13.5px] text-zinc-700">
              {composerText ? (
                <span>
                  {composerText}
                  {zoneState === "input" && <span className="demo-caret" />}
                </span>
              ) : (
                <span className="text-zinc-600">
                  {isId
                    ? "Tulis langkah aljabar atau lampirkan soal…"
                    : "Type your derivation step or attach a math problem…"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 pb-0.5">
              <span
                className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11.5px] font-mono font-medium transition-colors ${
                  isSearching
                    ? "bg-[#faf4ed] text-[#8f5e32] border border-[#d4a574]/40 animate-search-pulse"
                    : "text-zinc-500 bg-[#f5f3ef]"
                }`}
              >
                <span>SymPy CAS</span>
              </span>
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  composerText
                    ? "bg-[#09090b] text-white scale-100"
                    : "bg-zinc-200 text-zinc-400 scale-95"
                }`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveInteractiveShowcase({
  lang = "id",
}: {
  lang?: "id" | "en";
}) {
  const isId = lang === "id";
  const [activeTab, setActiveTab] = useState<"terminal" | "studio">("terminal");

  return (
    <section
      id="showcase"
      className="pt-16 pb-12 sm:pt-24 sm:pb-14 px-4 sm:px-6 bg-[#faf9f6] dark:bg-[#0c0d10] border-t border-zinc-200/60 dark:border-white/10 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#8f5e32] dark:text-[#d4a574] mb-3 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4956a]" />
            {isId ? "SIMULASI" : "SIMULATION"}
          </div>
          <h2 className="font-sans text-2xl sm:text-3xl md:text-4xl font-bold text-[#09090b] dark:text-white mb-3 tracking-tight">
            {isId ? (
              <>
                Lihat ChatZAP Beraksi{" "}
                <span className="font-serif font-normal text-[#7d551f] dark:text-[#c4956a]">dalam Simulasi</span>
              </>
            ) : (
              <>
                See ChatZAP in Action{" "}
                <span className="font-serif font-normal text-[#7d551f] dark:text-[#c4956a]">in Simulation</span>
              </>
            )}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
            {isId
              ? "Uji kemampuan verifikasi aljabar SymPy CAS, sensor Zero-Answer Guardrail, dan bimbingan Sokrates interaktif tanpa instalasi rumit."
              : "Experience deterministic SymPy CAS verification, Zero-Answer Guardrail sanitization, and Socratic scaffolding in this simulation."}
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="inline-flex bg-white dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-200/90 dark:border-white/10 shadow-sm flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setActiveTab("terminal")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "terminal"
                    ? "bg-[#09090b] text-white shadow-sm"
                    : "text-zinc-500 hover:text-[#09090b]"
                }`}
              >
                <PixelMascot className="w-4 h-3.5" />
                <span>
                  {isId
                    ? "CFL Engine (Terminal CAS & Guardrail)"
                    : "CFL Engine (Terminal CAS & Guardrail)"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("studio")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "studio"
                    ? "bg-[#09090b] text-white shadow-sm"
                    : "text-zinc-500 hover:text-[#09090b]"
                }`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>
                  {isId
                    ? "ChatZAP (Socratic Playground)"
                    : "ChatZAP (Socratic Playground)"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {activeTab === "terminal" ? (
            <TerminalCasDemo lang={lang} />
          ) : (
            <StudioBrowserDemo lang={lang} />
          )}
        </div>
      </div>
    </section>
  );
}

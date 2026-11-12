"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import ActionButton from "@/components/landing/ActionButton";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface CasPreset {
  id: string;
  pillLabel: string;
  pillBadge: string;
  step1: string;
  step2: string;
}

// Preset hanya CONTOH input: mengisi kolom langkah, vonis selalu dari API verifikasi.
const PRESETS: CasPreset[] = [
  { id: "binomial", pillLabel: "(x+3)² = x²+9", pillBadge: "Kuadrat Binomial", step1: "(x + 3)^2 - 4 = 0", step2: "x^2 + 9 - 4 = 0" },
  { id: "linear-valid", pillLabel: "2x + 6 = 14", pillBadge: "Persamaan Linear", step1: "2*x + 6 = 14", step2: "2*x = 8" },
  { id: "root-loss", pillLabel: "x² = 4x ⇒ x = 4", pillBadge: "Pembagian Variabel", step1: "x^2 - 4*x = 0", step2: "x - 4 = 0" },
  { id: "sign-error", pillLabel: "3x - (x - 5) = 2x - 5", pillBadge: "Distribusi Tanda", step1: "3*x - (x - 5) = 11", step2: "2*x - 5 = 11" },
  { id: "quadratic-factor", pillLabel: "x² - 5x + 6 = 0", pillBadge: "Faktorisasi Polinomial", step1: "x^2 - 5*x + 6 = 0", step2: "(x - 2)*(x - 3) = 0" },
];

type VerifyResult =
  | {
      kind: "verified";
      left: string;
      right: string;
      isEquivalent: boolean;
      method?: string;
      message?: string;
    }
  | {
      kind: "unverified";
      left: string;
      right: string;
      message: string;
    };

function parsePair(input: string): { left: string; right: string } | null {
  const parts = input
    .split(/=>|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { left: parts[0], right: parts[1] };
  }
  return null;
}

export default function LiveCasExplorer({ lang = "id" }: { lang?: "id" | "en" }) {
  const isId = lang === "id";
  const [mode, setMode] = useState<"cas" | "geometry">("cas");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [showExample, setShowExample] = useState<boolean>(false);

  const runVerification = async (inputStr: string) => {
    const trimmed = inputStr.trim();
    if (!trimmed) return;

    const pair = parsePair(trimmed);
    if (!pair) {
      setResult({
        kind: "unverified",
        left: trimmed,
        right: "",
        message: isId
          ? "Tulis dua langkah yang dipisahkan tanda => (contoh: 2*x + 6 = 14 => 2*x = 8) agar ekuivalensinya dapat diverifikasi oleh server."
          : "Write two steps separated by => (e.g. 2*x + 6 = 14 => 2*x = 8) so the server can verify their equivalence.",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${API_BASE}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left: pair.left, right: pair.right }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data && data.verified === true) {
        setResult({
          kind: "verified",
          left: pair.left,
          right: pair.right,
          isEquivalent: Boolean(data.isEquivalent),
          method: typeof data.method === "string" ? data.method : undefined,
          message: typeof data.message === "string" ? data.message : undefined,
        });
      } else {
        setResult({
          kind: "unverified",
          left: pair.left,
          right: pair.right,
          message:
            (typeof data?.message === "string" && data.message) ||
            (isId
              ? "Server tidak dapat memastikan ekuivalensi langkah ini."
              : "The server could not confirm the equivalence of these steps."),
        });
      }
    } catch {
      setResult({
        kind: "unverified",
        left: pair.left,
        right: pair.right,
        message: isId
          ? "Server verifikasi tidak terjangkau, sehingga langkah ini belum terverifikasi. Coba lagi nanti atau uji langsung di ChatZAP."
          : "The verification server is unreachable, so these steps are not yet verified. Try again later or test them in ChatZAP.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="explorer"
      className="w-full bg-gradient-to-r from-[#ba8852] via-[#c4956a] to-[#d4a574] dark:from-[#16120d] dark:via-[#1d1710] dark:to-[#16120d] py-12 sm:py-16 px-4 sm:px-6 lg:px-8 text-white relative shadow-inner"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-[#121317] text-[#09090b] dark:text-zinc-100 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl border border-white/60 dark:border-white/10 transition-all">
          {/* Top Switcher Bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-[#f5f3ef] dark:bg-white/5 p-1 rounded-xl border border-zinc-200/70 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode("cas");
                  setShowExample(false);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === "cas"
                    ? "bg-white dark:bg-white/10 text-[#09090b] dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white"
                }`}
              >
                {isId ? "Uji Langkah CAS" : "Verify CAS Step"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("geometry");
                  setResult(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === "geometry"
                    ? "bg-white dark:bg-white/10 text-[#09090b] dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white"
                }`}
              >
                {isId ? "Geometri 2D & 3D" : "2D & 3D Geometry"}
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#8f5e32]" />
              <span>
                {isId
                  ? "Ekuivalensi langkah diperiksa oleh server CAS"
                  : "Step equivalence checked by the CAS server"}
              </span>
            </div>
          </div>

          {/* Search / Equation Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "geometry") {
                setShowExample(true);
                return;
              }
              runVerification(query || PRESETS[0].step1 + " => " + PRESETS[0].step2);
            }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <div className="relative w-full">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === "cas"
                    ? isId
                      ? "Ketik dua langkah aljabar (contoh: (x+3)^2 - 4 = 0 => x^2 + 9 - 4 = 0)..."
                      : "Type two algebraic steps (e.g. (x+3)^2 - 4 = 0 => x^2 + 9 - 4 = 0)..."
                    : isId
                    ? "Ketik fungsi atau permukaan 3D (contoh: z = x^2 - y^2 atau irisan kerucut)..."
                    : "Type a 2D/3D function or surface (e.g. z = x^2 - y^2)..."
                }
                className="w-full bg-[#faf9f6] dark:bg-white/5 hover:bg-[#f5f3ef] dark:hover:bg-white/[0.07] focus:bg-white dark:focus:bg-white/[0.08] text-[#09090b] dark:text-zinc-100 placeholder:text-zinc-600 dark:placeholder:text-zinc-500 rounded-xl px-5 py-3.5 sm:py-4 text-sm sm:text-base border border-zinc-200/80 dark:border-white/10 focus:border-[#c4956a] focus:ring-2 focus:ring-[#c4956a]/20 outline-none transition-all pr-10 font-mono"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResult(null);
                    setShowExample(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-700 text-xs px-1.5 py-1 rounded-md cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <ActionButton
              type="submit"
              variant="amber"
              size="lg"
              className="shrink-0 w-full sm:w-auto"
              disabled={loading || mode === "geometry"}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isId ? "Memeriksa..." : "Checking..."}
                </span>
              ) : mode === "cas" ? (
                isId ? "Uji Langkah CAS" : "Verify Step"
              ) : isId ? (
                "Verifikasi Tidak Tersedia"
              ) : (
                "Verification Unavailable"
              )}
            </ActionButton>
          </form>

          {mode === "geometry" && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {isId
                ? "Mode Geometri hanya menampilkan contoh statis. Verifikasi ekuivalensi langkah tersedia di mode Uji Langkah CAS, dan visualisasi 3D interaktif tersedia di ChatZAP."
                : "Geometry mode only shows a static example. Step equivalence verification is available in Verify CAS Step mode, and interactive 3D visualization is available in ChatZAP."}
            </p>
          )}

          {/* Static Example Card (Geometry mode) */}
          {mode === "geometry" && showExample && !loading && (
            <div className="mt-5 border-t border-zinc-100 dark:border-white/10 pt-5 animate-slide-down">
              <div className="bg-[#faf9f6] dark:bg-white/5 border border-zinc-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-sm sm:text-base text-[#09090b] dark:text-white bg-white dark:bg-white/10 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 shadow-sm">
                      z = x^2 - y^2
                    </span>
                    <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-white/10 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {isId ? "Contoh" : "Example"}
                    </span>
                  </div>

                  <div className="text-xs font-mono font-semibold text-[#8f5e32]">
                    {isId
                      ? "Contoh statis: permukaan pelana (hiperbolik paraboloid)"
                      : "Static example: saddle surface (hyperbolic paraboloid)"}
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {isId
                      ? "Pada bidang y = 0 kurva membuka ke atas (parabola z = x²), sedangkan pada bidang x = 0 kurva membuka ke bawah (z = -y²). Ini contoh tampilan materi geometri, bukan hasil verifikasi."
                      : "On the plane y = 0 the trace opens upward (parabola z = x²), while on x = 0 it opens downward (z = -y²). This is a static material example, not a verification result."}
                  </p>
                </div>

                <div className="w-full sm:w-auto shrink-0 self-stretch sm:self-center flex items-center">
                  <ActionButton href="/chat" variant="black" size="sm">
                    {isId ? "Buka di ChatZAP" : "Open in ChatZAP"}
                  </ActionButton>
                </div>
              </div>
            </div>
          )}

          {/* Verification Result Card */}
          {mode === "cas" && result && !loading && (
            <div className="mt-5 border-t border-zinc-100 dark:border-white/10 pt-5 animate-slide-down">
              <div className="bg-[#faf9f6] dark:bg-white/5 border border-zinc-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-sm sm:text-base text-[#09090b] dark:text-white bg-white dark:bg-white/10 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 shadow-sm">
                      {result.left}
                      {result.right ? ` → ${result.right}` : ""}
                    </span>
                    {result.kind === "verified" && result.isEquivalent && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {isId ? "Ekuivalen & Valid" : "Equivalent & Valid"}
                      </span>
                    )}
                    {result.kind === "verified" && !result.isEquivalent && (
                      <span className="inline-flex items-center gap-1 bg-[#faf4ed] border border-[#d4a574]/50 text-[#8f5e32] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#8f5e32]" />
                        {isId ? "Tidak Ekuivalen" : "Not Equivalent"}
                      </span>
                    )}
                    {result.kind === "unverified" && (
                      <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-white/10 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                        {isId ? "Belum Terverifikasi" : "Not Yet Verified"}
                      </span>
                    )}
                  </div>

                  {result.kind === "verified" && result.method && (
                    <div className="text-xs font-mono font-semibold text-[#8f5e32]">
                      {isId ? "Terverifikasi via" : "Verified via"} {result.method}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {result.kind === "verified"
                      ? result.message ||
                        (result.isEquivalent
                          ? isId
                            ? "Server CAS mengonfirmasi kedua langkah ekuivalen."
                            : "The CAS server confirmed both steps are equivalent."
                          : isId
                            ? "Server CAS mengonfirmasi kedua langkah tidak ekuivalen."
                            : "The CAS server confirmed both steps are not equivalent.")
                      : result.message}
                  </p>
                </div>

                <div className="w-full sm:w-auto shrink-0 self-stretch sm:self-center flex items-center">
                  <ActionButton href="/chat" variant="black" size="sm">
                    {isId ? "Buka di ChatZAP" : "Open in ChatZAP"}
                  </ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick-Test Example Pills Underneath */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setMode("cas");
                setShowExample(false);
                const pairText = `${preset.step1} => ${preset.step2}`;
                setQuery(pairText);
                runVerification(pairText);
              }}
              className="inline-flex items-center gap-2 bg-black/15 dark:bg-white/10 hover:bg-black/25 dark:hover:bg-white/15 text-white border border-white/25 dark:border-white/15 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="font-bold text-white tracking-wide">{preset.pillLabel}</span>
              <span className="text-white/85 text-[11px] font-sans font-normal">
                {preset.pillBadge}
              </span>
              <ArrowUpRight className="w-3 h-3 text-white/75" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

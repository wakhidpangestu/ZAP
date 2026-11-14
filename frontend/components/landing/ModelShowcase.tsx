"use client";

import React from "react";
import {
  Boxes,
  Braces,
  Code2,
  Container,
  Sigma,
  Terminal,
  Waypoints,
} from "lucide-react";

import {
  ClaudeLogo,
  DeepSeekLogo,
  GeminiLogo,
  MistralLogo,
  NvidiaLogo,
  OllamaLogo,
  OpenAILogo,
  SymPyLogo,
} from "@/components/CompanyLogos";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { RouterViz } from "@/components/site/KineticViz";

const MODELS = [
  { name: "Gemini", meta: "Google AI", Icon: GeminiLogo },
  { name: "OpenAI", meta: "GPT-4o", Icon: OpenAILogo },
  { name: "Claude", meta: "Anthropic", Icon: ClaudeLogo },
  { name: "DeepSeek", meta: "Reasoning", Icon: DeepSeekLogo },
  { name: "Mistral", meta: "Codestral", Icon: MistralLogo },
  { name: "NVIDIA NIM", meta: "GPU Cloud", Icon: NvidiaLogo },
  { name: "Ollama", meta: "Model lokal", Icon: OllamaLogo },
  { name: "SymPy", meta: "CAS lokal", Icon: SymPyLogo },
];

const TOOLS = [
  { name: "Next.js", meta: "App Router", Icon: Code2 },
  { name: "FastAPI", meta: "Python backend", Icon: Terminal },
  { name: "Three.js", meta: "Kanvas 3D", Icon: Boxes },
  { name: "KaTeX", meta: "Notasi math", Icon: Sigma },
  { name: "Python", meta: "CFL engine", Icon: Braces },
  { name: "Docker", meta: "Self-host", Icon: Container },
];

function ModelPill({ item }: { item: (typeof MODELS)[number] }) {
  const { Icon } = item;
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-[#33261d] bg-[#1c150f] px-4 py-2.5 text-[#f5e9dc]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff7ec]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-[12px] font-semibold">{item.name}</span>
        <span className="text-[9.5px] text-[#9d8874]">{item.meta}</span>
      </span>
    </div>
  );
}

function ToolPill({ item }: { item: (typeof TOOLS)[number] }) {
  const { Icon } = item;
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#33261d] bg-transparent px-4 py-2.5 text-[#d8c2ac]">
      <Icon className="h-3.5 w-3.5 text-[#ffb35c]" strokeWidth={1.5} />
      <span className="whitespace-nowrap text-[11.5px] font-medium">{item.name}</span>
      <span className="whitespace-nowrap text-[9px] text-[#8f7864]">{item.meta}</span>
    </div>
  );
}

function MarqueeRow({
  reverse = false,
  children,
}: {
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="marquee-row relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className={reverse ? "animate-marquee-fast-reverse" : "animate-marquee-fast"}>
        <div className="flex shrink-0 items-center gap-2.5 pr-2.5">{children}</div>
        <div className="flex shrink-0 items-center gap-2.5 pr-2.5" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModelShowcase() {
  return (
    <section
      id="model"
      data-scroll-anchor="model"
      className="kx-on-dark relative scroll-mt-24 overflow-hidden bg-[#170d09] px-4 py-24 text-[#fff7ec] sm:px-6 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(240,122,30,0.22),rgba(160,46,30,0.08)_45%,transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(rgba(255,247,236,0.18) 0.7px, transparent 0.8px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, black, transparent 82%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 82%)",
        }}
      />

      <div className="relative mx-auto max-w-[1160px]">
        <ScrollReveal className="text-center">
          <h2 className="mx-auto max-w-3xl text-balance text-[34px] font-black leading-[1.03] tracking-[-0.04em] sm:text-[54px]">
            Terhubung dengan model terdepan,
            <span className="text-[#ffb35c]"> IDE, dan framework.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[13px] leading-relaxed text-[#bba58f] sm:text-sm">
            Pilih model favoritmu lewat API key sendiri, atau tetap di dalam ekosistem ZAP dengan engine Sokratik lokal.
            Semua jalur tetap melewati SymPy CAS dan Zero-Answer Guardrail.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.08} className="mt-14">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8f7864]">Model dan provider</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#d8c2ac]">
              <Waypoints className="h-3 w-3 text-[#ffb35c]" />
              BYOK ready
            </span>
          </div>
          <div className="relative -mx-4 sm:-mx-6">
            <MarqueeRow>
              {MODELS.map((item) => (
                <ModelPill key={item.name} item={item} />
              ))}
            </MarqueeRow>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.14} className="mt-7">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8f7864]">Stack dan tooling</span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8f7864]">Bisa self-host</span>
          </div>
          <div className="relative -mx-4 sm:-mx-6">
            <MarqueeRow reverse>
              {TOOLS.map((item) => (
                <ToolPill key={item.name} item={item} />
              ))}
            </MarqueeRow>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2} className="mt-14">
          <div className="flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-6 sm:flex-row">
            <p className="text-[11px] text-[#9d8874]">
              Satu endpoint, satu guardrail, banyak model. Ganti penyedia tanpa mengubah alur belajar.
            </p>
            <div className="flex items-center gap-4">
              <RouterViz className="h-9 w-32" />
              <a
                href="/connector"
                className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-[11.5px] font-semibold text-[#f3e6d6] transition-colors hover:bg-white/[0.08]"
              >
                Buka konektor
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default ModelShowcase;

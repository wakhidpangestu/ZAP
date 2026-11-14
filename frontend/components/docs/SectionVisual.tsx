"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Visualisasi alur 3D per bagian dokumentasi.
 *
 * Semua animasi memakai CSS transform 3D (compositor) — tanpa WebGL — supaya
 * sebelas scene bisa hidup bersamaan tanpa membebani halaman. Scene otomatis
 * dijeda (animation-play-state) saat keluar viewport.
 */

function usePauseWhenHidden() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        node.dataset.paused = entry.isIntersecting ? "false" : "true";
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Scene({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = usePauseWhenHidden();
  return (
    <div
      ref={ref}
      data-paused="false"
      className="docs-visual relative mb-6 h-[150px] overflow-hidden rounded-xl border border-zinc-200/70 bg-[radial-gradient(120%_120%_at_15%_0%,#fffdf9,#f6ecdd_58%,#efe2cf)] sm:h-[172px] dark:border-white/[0.07] dark:bg-[radial-gradient(120%_120%_at_15%_0%,#18141b,#0e0c11_58%,#09080b)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(70% 85% at 50% 55%, black, transparent)",
          WebkitMaskImage: "radial-gradient(70% 85% at 50% 55%, black, transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(72%_78%_at_50%_50%,transparent,rgba(255,253,249,0.85))] dark:bg-[radial-gradient(72%_78%_at_50%_50%,transparent,rgba(9,8,11,0.9))]"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`scale-100 [perspective:900px] [transform-style:preserve-3d] sm:scale-[1.18] ${className}`}
        >
          {children}
        </div>
      </div>
      <span className="absolute bottom-2.5 left-3 font-mono text-[8.5px] uppercase tracking-[0.18em] text-zinc-400/90 dark:text-zinc-600">
        {label}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- primitives */

function Node({
  title,
  sub,
  tone = "warm",
  className = "",
  style,
}: {
  title: string;
  sub?: string;
  tone?: "warm" | "slate" | "green" | "violet";
  className?: string;
  style?: React.CSSProperties;
}) {
  const tones: Record<string, string> = {
    warm: "border-[#c4956a]/50 bg-[#fff5e8] text-[#6b3f1f] dark:border-[#c4956a]/35 dark:bg-[#221710] dark:text-[#f0d6b8]",
    slate: "border-zinc-300/80 bg-white text-zinc-800 dark:border-white/15 dark:bg-white/[0.07] dark:text-zinc-200",
    green: "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
    violet: "border-violet-500/35 bg-violet-50 text-violet-900 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300",
  };
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-2.5 py-1.5 text-center shadow-[0_10px_24px_-20px_rgba(28,18,12,0.7)] ${tones[tone]} ${className}`}
      style={style}
    >
      <span className="whitespace-nowrap font-mono text-[9.5px] font-semibold leading-none">{title}</span>
      {sub ? (
        <span className="mt-1 whitespace-nowrap text-[7.5px] uppercase tracking-[0.12em] opacity-60">{sub}</span>
      ) : null}
    </div>
  );
}

function Connector({ width = 46, reverse = false }: { width?: number; reverse?: boolean }) {
  return (
    <span className="relative block h-px" style={{ width }} aria-hidden="true">
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c4956a]/60 to-transparent" />
      <span
        className="docs-dot-x"
        style={
          {
            "--travel": `${width}px`,
            animationDirection: reverse ? "reverse" : undefined,
          } as React.CSSProperties
        }
      />
    </span>
  );
}

const LAYER = "absolute flex h-10 w-[196px] items-center justify-center rounded-md border border-[#c4956a]/55 bg-[#fff3e0] font-mono text-[10.5px] font-semibold text-[#6b3f1f] shadow-[0_18px_30px_-20px_rgba(42,14,14,0.7)] dark:border-[#c4956a]/35 dark:bg-[#2a1a10] dark:text-[#f4dcc0]";

/* -------------------------------------------------------------------- scenes */

function SplitScene() {
  return (
    <div className="flex translate-y-[-6px] items-center gap-2.5 [transform-style:preserve-3d] sm:gap-4">
      <div className="[transform:rotateX(14deg)_rotateY(-16deg)]">
        <Node title="CFL · SymPy" sub="kebenaran" className="float-y" />
      </div>
      <Connector width={56} />
      <div className="[transform:rotateX(14deg)_rotateY(16deg)]">
        <Node title="LLM" sub="bahasa" tone="slate" className="float-y [animation-delay:-2.2s]" />
      </div>
    </div>
  );
}

function StackScene() {
  const layers = ["Browser", "Next.js", "FastAPI", "SymPy"];
  return (
    <div className="translate-y-[22px]">
    <div className="relative h-0 w-0 [transform-style:preserve-3d] [transform:rotateX(36deg)_rotateZ(-18deg)_scale(0.86)]">
      {layers.map((layer, index) => (
        <div
          key={layer}
          className={LAYER}
          style={{
            transform: `translate(-50%, -50%) translateZ(${index * 22}px) translateY(${index * -10}px)`,
            opacity: 1 - index * 0.05,
          }}
        >
          {layer}
        </div>
      ))}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#f07a1e] shadow-[0_0_14px_5px_rgba(240,122,30,0.5)]"
        style={{
          marginLeft: "-4px",
          marginTop: "-4px",
          animation: "docs-packet 3.2s cubic-bezier(0.4,0,0.2,1) infinite",
        }}
      />
    </div>
    </div>
  );
}

function GuardScene() {
  return (
    <div className="relative flex h-full w-full items-center justify-center [transform-style:preserve-3d]">
      <div className="relative flex h-[74px] w-[74px] items-center justify-center">
        <span className="absolute inset-0 rounded-2xl border border-dashed border-[#c2410c]/30 dark:border-[#ffb35c]/25 orbit-spin" />
        <span className="absolute inset-[7px] rotate-45 rounded-xl border border-[#c2410c]/40 bg-[#fff3e6] dark:border-[#ffb35c]/30 dark:bg-[#241710]" />
        <span className="relative z-10 flex flex-col items-center">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#a02e1e] dark:text-[#ffb35c]">
            guard
          </span>
          <span className="mt-0.5 text-[7px] text-[#a02e1e]/70 dark:text-[#ffb35c]/70">zero-answer</span>
        </span>
      </div>
      <div
        className="absolute left-[62%] top-1/2"
        style={{ animation: "docs-deflect 4.4s ease-in-out infinite" }}
      >
        <div className="rounded-md border border-rose-400/40 bg-rose-50 px-2 py-1 font-mono text-[9px] text-rose-700 shadow-sm dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300">
          x = 4
        </div>
        <span className="mt-1 block text-center font-mono text-[7px] uppercase tracking-[0.12em] text-rose-500/80">
          diblokir
        </span>
      </div>
    </div>
  );
}

function PipelineScene() {
  const steps = [
    { title: "parse", sub: "whitelist" },
    { title: "compare", sub: "ekuivalensi" },
    { title: "fault", sub: "langkah 2" },
  ];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5">
      {steps.map((step, index) => (
        <div key={step.title} className="flex items-center gap-1.5 sm:gap-2.5">
          {index > 0 ? <Connector width={28} /> : null}
          <Node
            title={step.title}
            sub={step.sub}
            tone={index === 2 ? "green" : "warm"}
            className={index === 2 ? "[animation:docs-glow_3s_ease-in-out_infinite]" : ""}
          />
        </div>
      ))}
    </div>
  );
}

function HarnessScene() {
  return (
    <div className="relative h-[104px] w-[104px] [transform:rotateX(18deg)]">
      <span className="absolute inset-0 rounded-full border border-dashed border-[#c4956a]/40 dark:border-[#c4956a]/25" />
      <div className="orbit-spin absolute inset-0">
        {[0, 120, 240].map((angle) => (
          <span
            key={angle}
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f07a1e] shadow-[0_0_10px_3px_rgba(240,122,30,0.35)]"
            style={{ transform: `rotate(${angle}deg) translateY(-52px)` }}
          />
        ))}
      </div>
      <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full border border-[#c4956a]/35 bg-white/85 shadow-sm dark:border-[#c4956a]/25 dark:bg-[#221710]">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#8a5f39] dark:text-[#e0bf9c]">
          memory
        </span>
        <span className="mt-0.5 text-[7px] text-[#8a5f39]/70 dark:text-[#e0bf9c]/60">episodik</span>
      </div>
    </div>
  );
}

function KnowledgeScene() {
  const domains = ["Math", "CS", "Phys", "Chem"];
  return (
    <div className="relative h-[108px] w-[120px]">
      <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c4956a]/40 bg-white/85 dark:border-[#c4956a]/25 dark:bg-[#221710]" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-[#8a5f39] dark:text-[#e0bf9c]">
        korpus
      </span>
      {domains.map((domain, index) => (
        <span
          key={domain}
          className="node-float absolute left-1/2 top-1/2 flex h-7 w-10 items-center justify-center rounded-full border border-[#c4956a]/35 bg-white/90 font-mono text-[7.5px] font-semibold text-[#6b4a2f] shadow-sm dark:border-[#c4956a]/25 dark:bg-[#241710] dark:text-[#e8d4bf]"
          style={{
            transform: `translate(-50%, -50%) translate(${Math.cos((index / 4) * Math.PI * 2) * 42}px, ${
              Math.sin((index / 4) * Math.PI * 2) * 34
            }px)`,
            animationDelay: `${index * 0.4}s`,
          }}
        >
          {domain}
        </span>
      ))}
    </div>
  );
}

function VaultScene() {
  const faces = [
    "translateZ(30px)",
    "rotateY(90deg) translateZ(30px)",
    "rotateY(180deg) translateZ(30px)",
    "rotateY(270deg) translateZ(30px)",
    "rotateX(90deg) translateZ(30px)",
    "rotateX(-90deg) translateZ(30px)",
  ];
  return (
    <div className="relative flex items-center gap-8 [transform-style:preserve-3d]">
      <div className="cube-spin relative h-[64px] w-[64px] [transform-style:preserve-3d]">
        {faces.map((transform, index) => (
          <div
            key={transform}
            className="absolute inset-0 flex items-center justify-center border border-[#c4956a]/50 bg-[#fff3e0]/92 font-mono text-[7.5px] text-[#6b4a2f] dark:border-[#c4956a]/30 dark:bg-[#2a1a10]/92 dark:text-[#e8d4bf]"
            style={{ transform }}
          >
            {index === 0 ? "AES" : index === 1 ? "256" : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Node title="passphrase" sub="lokal" tone="slate" />
        <Node title="envelope" sub="server" tone="warm" />
      </div>
    </div>
  );
}

function ApiScene() {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2.5 px-2 [transform:rotateX(8deg)]">
      <div className="flex items-center gap-2.5">
        <span className="rounded border border-emerald-500/35 bg-emerald-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
          POST
        </span>
        <Node title="/api/chat" sub="route handler" className="flex-1" />
        <div className="relative h-px w-14">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c4956a]/60 to-transparent" />
          <span className="docs-dot-x" style={{ "--travel": "56px" } as React.CSSProperties} />
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="rounded border border-violet-500/30 bg-violet-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300">
          SSE
        </span>
        <div className="relative h-px w-14">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c4956a]/60 to-transparent" />
          <span
            className="docs-dot-x"
            style={{ "--travel": "56px", animationDirection: "reverse" } as React.CSSProperties}
          />
        </div>
        <Node title="meta → delta" sub="stream" tone="violet" className="flex-1" />
      </div>
    </div>
  );
}

function ConfigScene() {
  return (
    <div className="relative [transform:rotateX(10deg)_rotateY(-8deg)]">
      <div className="w-[230px] rounded-lg border border-zinc-300/70 bg-[#0d0f13] p-2.5 shadow-[0_24px_40px_-30px_rgba(28,18,12,0.8)]">
        <div className="mb-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e5a3a3]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8d19a]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#a8cfa8]" />
          <span className="ml-2 font-mono text-[7px] text-zinc-500">.env</span>
        </div>
        <div className="space-y-1 font-mono text-[8px] leading-relaxed">
          <p className="text-emerald-300/90">NEXT_PUBLIC_APP_URL=…</p>
          <p className="text-sky-300/80">FASTAPI_URL=…</p>
          <p className="text-zinc-500">
            HARNESS_SECRET=
            <span
              className="ml-0.5 inline-block h-2 w-1.5 translate-y-[1px] bg-zinc-300"
              style={{ animation: "docs-blink 1.1s steps(1,end) infinite" }}
            />
          </p>
        </div>
      </div>
      <div className="absolute -right-6 -top-4 rotate-y-[18deg] rounded-md border border-[#c4956a]/35 bg-[#fff8ee] px-2 py-1 font-mono text-[7px] text-[#7a4b26] shadow-sm dark:border-[#c4956a]/25 dark:bg-[#241710] dark:text-[#e8d4bf]">
        npm run dev
      </div>
    </div>
  );
}

function SecurityScene() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {[0, 1, 2].map((ring) => (
        <span
          key={ring}
          className={`absolute rounded-full border border-dashed ${
            ring === 1 ? "orbit-spin-reverse" : "orbit-spin"
          } ${ring === 0 ? "h-20 w-20" : ring === 1 ? "h-28 w-28" : "h-36 w-36"} border-[#c2410c]/20 dark:border-[#ffb35c]/20`}
          style={{ animationDuration: `${18 + ring * 7}s` }}
        >
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c2410c]/70 dark:bg-[#ffb35c]/70" />
        </span>
      ))}
      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-[#c2410c]/35 bg-white/90 text-[7px] font-bold uppercase tracking-[0.1em] text-[#a02e1e] shadow-sm dark:border-[#ffb35c]/30 dark:bg-[#241710] dark:text-[#ffb35c]">
        aman
      </div>
      <span className="absolute right-6 top-4 font-mono text-[7px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        CSP
      </span>
      <span className="absolute bottom-5 left-8 font-mono text-[7px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        HSTS
      </span>
      <span className="absolute bottom-6 right-10 font-mono text-[7px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        XFO
      </span>
    </div>
  );
}

function RoadmapScene() {
  const steps = ["korpus", "limiter", "FTS", "vault"];
  return (
    <div className="relative flex items-end gap-2 [transform-style:preserve-3d] [transform:rotateY(-16deg)]">
      {steps.map((step, index) => (
        <div
          key={step}
          className="flex flex-col items-center gap-1.5"
          style={{
            transform: `translateZ(${-index * 18}px) translateY(${index * 4}px)`,
            opacity: 1 - index * 0.14,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#f07a1e]"
            style={{
              animation: `docs-glow 3.6s ease-in-out infinite`,
              animationDelay: `${index * 0.55}s`,
            }}
          />
          <span className="h-8 w-px bg-gradient-to-b from-[#c4956a]/60 to-transparent" />
          <span className="rounded-md border border-[#c4956a]/30 bg-[#fff8ee] px-1.5 py-1 font-mono text-[7.5px] text-[#7a4b26] dark:border-[#c4956a]/20 dark:bg-[#241710] dark:text-[#e8d4bf]">
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

const SCENES: Record<string, { label: string; visual: () => ReactNode }> = {
  ringkasan: { label: "dua lapis kebenaran", visual: SplitScene },
  arsitektur: { label: "alur browser → SymPy", visual: StackScene },
  "zero-answer": { label: "guardrail menahan jawaban", visual: GuardScene },
  cfl: { label: "pipeline verifikasi", visual: PipelineScene },
  harness: { label: "loop memori episodik", visual: HarnessScene },
  pengetahuan: { label: "korpus multi-domain", visual: KnowledgeScene },
  vault: { label: "envelope terenkripsi", visual: VaultScene },
  api: { label: "request → stream", visual: ApiScene },
  konfigurasi: { label: "self-hosting", visual: ConfigScene },
  keamanan: { label: "lapisan pertahanan", visual: SecurityScene },
  roadmap: { label: "prioritas berurutan", visual: RoadmapScene },
};

export function SectionVisual({ id }: { id: string }) {
  const scene = SCENES[id];
  if (!scene) return null;
  const Visual = scene.visual;
  return (
    <Scene label={scene.label}>
      <Visual />
    </Scene>
  );
}

export default SectionVisual;

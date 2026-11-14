"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, BookOpen, KeyRound, ShieldCheck } from "lucide-react";

import { ZapLogo } from "@/components/ZapLogo";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 1. THEME-FIXED INLINE STYLES (the closing band is always the warm dark)
// ---------------------------------------------------------------------------
const STYLES = `
.cinematic-footer-wrapper {
  -webkit-font-smoothing: antialiased;

  --cf-bg: #170d09;
  --cf-fg: #fff7ec;
  --cf-accent: #f07a1e;
  --cf-cream: #ffd6a4;

  --pill-bg-1: rgba(255, 247, 236, 0.055);
  --pill-bg-2: rgba(255, 247, 236, 0.018);
  --pill-border: rgba(255, 247, 236, 0.14);
  --pill-highlight: rgba(255, 247, 236, 0.12);
  --pill-shadow: rgba(0, 0, 0, 0.55);

  --pill-bg-1-hover: rgba(255, 247, 236, 0.12);
  --pill-bg-2-hover: rgba(255, 247, 236, 0.04);
  --pill-border-hover: rgba(255, 247, 236, 0.3);
  --pill-shadow-hover: rgba(0, 0, 0, 0.7);
  --pill-highlight-hover: rgba(255, 247, 236, 0.2);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.animate-footer-breathe {
  animation: footer-breathe 8s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 46s linear infinite;
}

.animate-footer-scroll-marquee:hover {
  animation-play-state: paused;
}

/* Grid background, masked so it fades out toward the edges */
.footer-bg-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right, rgba(255, 247, 236, 0.035) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 247, 236, 0.035) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

/* Aurora glow */
.footer-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(240, 122, 30, 0.18) 0%,
    rgba(160, 46, 30, 0.12) 40%,
    transparent 70%
  );
}

/* Glass pill */
.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow:
    0 10px 30px -10px var(--pill-shadow),
    inset 0 1px 1px var(--pill-highlight);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: background 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s,
    box-shadow 0.4s, color 0.4s;
}

.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow:
    0 20px 40px -10px var(--pill-shadow-hover),
    inset 0 1px 1px var(--pill-highlight-hover);
  color: var(--cf-fg);
}

/* Giant background text — scales with viewport height so it never runs
   into the CTA block on short laptop screens. */
.footer-giant-bg-text {
  font-size: min(26vw, 30vh);
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  /* padding keeps the last glyph's edge inside the gradient box, so the "P"
     doesn't get sliced by background-clip: text */
  padding-inline: 0.08em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 247, 236, 0.12);
  background: linear-gradient(180deg, rgba(255, 247, 236, 0.17) 0%, transparent 62%);
  -webkit-background-clip: text;
  background-clip: text;
}

/* Metallic heading glow */
.footer-text-glow {
  background: linear-gradient(180deg, #fff7ec 0%, rgba(255, 247, 236, 0.82) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 22px rgba(255, 247, 236, 0.1));
}

/* Scroll reveal tanpa library: IntersectionObserver hanya menambah kelas. */
.footer-giant-reveal,
.footer-rise {
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}
.footer-giant-reveal {
  opacity: 0;
  transform: translate(-50%, 6vh) scale(0.94);
}
.footer-rise {
  opacity: 0;
  transform: translateY(2.75rem);
}
.cinematic-footer-wrapper.is-inview .footer-giant-reveal {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.cinematic-footer-wrapper.is-inview .footer-rise {
  opacity: 1;
  transform: none;
}
.footer-rise-links {
  transition-delay: 0.12s;
}

@media (prefers-reduced-motion: reduce) {
  .animate-footer-breathe,
  .animate-footer-scroll-marquee {
    animation: none !important;
  }
  .footer-giant-reveal {
    opacity: 1 !important;
    transform: translate(-50%, 0) !important;
    transition: none !important;
  }
  .footer-rise {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
`;

const MARQUEE_ITEMS = [
  "Zero-Answer Policy",
  "SymPy CAS",
  "Penalaran Sokrates",
  "Aman untuk belajar",
  "TK sampai S3",
  "Indonesia",
];

const SECONDARY_LINKS = [
  { href: "/connector", label: "Konektor" },
  { href: "/docs#api", label: "API" },
  { href: "/login", label: "Masuk" },
];

// ---------------------------------------------------------------------------
// 2. MAGNETIC PRIMITIVE — moves the pill toward the pointer
// ---------------------------------------------------------------------------
function Magnetic({
  children,
  className,
  strength = 0.18,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex transition-transform duration-300 ease-out will-change-transform", className)}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 3. MARQUEE ROW
// ---------------------------------------------------------------------------
function MarqueeRow() {
  return (
    <div className="flex shrink-0 items-center">
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex items-center px-6">
          {item}
          <span className="ml-6 text-[#f07a1e]">✦</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. MAIN COMPONENT — full-height cinematic closing section
// ---------------------------------------------------------------------------
export function CinematicFooter() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof window === "undefined") return;

    // Reveal berbasis IntersectionObserver + transisi CSS (tanpa GSAP):
    // footer ini muncul di hampir semua halaman, jadi bobot JS-nya ditekan.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            root.classList.add("is-inview");
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer
      ref={rootRef}
      className="cinematic-footer-wrapper relative flex w-full flex-col justify-between overflow-hidden bg-[#170d09] text-[#fff7ec] sm:min-h-[100svh]"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Ambient light + grid */}
      <div
        aria-hidden="true"
        className="footer-aurora animate-footer-breathe pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[80px]"
      />
      <div aria-hidden="true" className="footer-bg-grid pointer-events-none absolute inset-0 z-0" />

      {/* Giant wordmark */}
      <div
        aria-hidden="true"
        className="footer-giant-bg-text footer-giant-reveal pointer-events-none absolute bottom-[2.5vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap text-center"
      >
        ZAP
      </div>

      {/* 1. Diagonal marquee ribbon — sits safely above center content */}
      <div className="absolute left-0 top-12 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-white/10 bg-[#1e110c]/70 py-3 sm:top-28 sm:py-4 shadow-2xl backdrop-blur-md">
        <div className="animate-footer-scroll-marquee flex w-max items-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#d8bc9f] sm:text-xs md:text-sm">
          <MarqueeRow />
          <MarqueeRow />
        </div>
      </div>

      {/* 2. Center content */}
      {/* Keeps the credits row legible over the giant wordmark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-[#170d09] via-[#170d09]/80 to-transparent"
      />

      <div className="relative z-10 mx-auto mt-24 flex w-full max-w-[1000px] flex-1 flex-col items-center justify-center px-4 pb-12 pt-8 sm:mt-36 sm:px-6 sm:py-20">
        <h2
          className="footer-text-glow footer-rise mb-6 max-w-[16ch] text-balance text-center text-[28px] font-black leading-[1.08] tracking-[-0.035em] sm:mb-10 sm:text-6xl lg:text-7xl sm:leading-[1.02]"
        >
          Siap menemukan jawabannya sendiri?
        </h2>

        <div className="footer-rise footer-rise-links flex w-full flex-col items-center gap-5 sm:gap-6">
          {/* Primary actions — responsive centered pills on mobile */}
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-4">
            <Magnetic strength={0.2} className="w-full sm:w-auto flex justify-center">
              <Link
                href="/chat"
                className="group inline-flex h-12 w-full max-w-[260px] items-center justify-between gap-3 rounded-full bg-[#fff7ec] pl-6 pr-2 text-[13px] font-bold text-[#1c120c] transition-colors hover:bg-[#ffd9a8] sm:h-14 sm:w-auto sm:max-w-none sm:text-[13.5px] sm:pl-7"
              >
                Buka ChatZAP
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c120c] text-[#fff7ec] transition-transform group-hover:translate-x-0.5 sm:h-9 sm:w-9">
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </Link>
            </Magnetic>

            <Magnetic strength={0.2} className="w-full sm:w-auto flex justify-center">
              <Link
                href="/docs"
                className="footer-glass-pill inline-flex h-12 w-full max-w-[260px] items-center justify-center gap-2.5 rounded-full px-6 text-[13px] font-semibold text-[#f3e6d6] sm:h-14 sm:w-auto sm:max-w-none sm:text-[13.5px]"
              >
                <BookOpen className="h-4 w-4" />
                Baca dokumentasi
              </Link>
            </Magnetic>
          </div>

          {/* Secondary links */}
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
            {SECONDARY_LINKS.map((link) => (
              <Magnetic key={link.href} strength={0.16}>
                <Link
                  href={link.href}
                  className="footer-glass-pill inline-flex h-9 items-center rounded-full px-4 text-[11px] font-medium text-[#c7b09a] sm:h-10 sm:px-5 sm:text-xs"
                >
                  {link.label}
                </Link>
              </Magnetic>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10.5px] text-[#a9927e]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-[#d4a574]" strokeWidth={1.6} /> Zero-Answer Guardrail
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3 w-3 text-[#d4a574]" strokeWidth={1.6} /> Vault terenkripsi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[#d4a574]" /> SymPy CAS
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bottom bar */}
      <div className="relative z-20 mt-4 flex w-full flex-row items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 md:gap-6 md:px-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#fff7ec] text-[#1c120c]">
            <ZapLogo className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-semibold tracking-tight sm:text-[11.5px]">ChatZAP</div>
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#a9927e] sm:text-[9.5px] sm:tracking-[0.18em]">
              © 2026 ChatZAP · Zero-Answer Policy
            </div>
          </div>
        </div>

        <Magnetic strength={0.25}>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Kembali ke atas"
            className="footer-glass-pill group flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#c7b09a] hover:text-[#fff7ec]"
          >
            <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-1" />
          </button>
        </Magnetic>
      </div>
    </footer>
  );
}

export default CinematicFooter;

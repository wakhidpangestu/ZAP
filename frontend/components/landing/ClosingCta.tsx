"use client";

import React, { useCallback, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

import ActionButton from "@/components/landing/ActionButton";

type GlowStyle = React.CSSProperties & { "--mx": string; "--my": string };

const CHECKS = ["Gratis untuk mulai", "Bisa tanpa API key", "Data tetap di peramban"];

/**
 * Compact closing CTA that sits right above the footer.
 * Two quiet layers only: a dotted backdrop and a cursor-following glow.
 */
export function ClosingCta() {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        cardRef.current?.style.setProperty("--mx", `${x}px`);
        cardRef.current?.style.setProperty("--my", `${y}px`);
      });
    },
    [reduceMotion]
  );

  return (
    <section className="px-4 pb-14 sm:px-6">
      <div
        ref={cardRef}
        onPointerMove={onPointerMove}
        style={{ "--mx": "50%", "--my": "40%" } as GlowStyle}
        className="relative mx-auto max-w-[880px] overflow-hidden rounded-[20px] border border-[#e6dacb] bg-[#fffdf8] px-7 py-12 text-center shadow-[0_34px_90px_-70px_rgba(42,14,14,0.55)] dark:border-[#2a2019] dark:bg-[#17110c] sm:px-12 sm:py-14"
      >
        {/* Dotted backdrop, faded toward the edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 dark:opacity-70"
          style={{
            backgroundImage: "radial-gradient(rgba(160, 46, 30, 0.34) 1px, transparent 1.2px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(120% 120% at 50% 45%, black 42%, transparent 92%)",
            WebkitMaskImage: "radial-gradient(120% 120% at 50% 45%, black 42%, transparent 92%)",
          }}
        />

        {/* Cursor glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(240px circle at var(--mx) var(--my), rgba(240,122,30,0.16), transparent 70%)",
          }}
        />

        <div className="relative">
          <h2 className="mx-auto max-w-[24ch] text-balance text-[30px] font-black leading-[1.06] tracking-[-0.035em] sm:text-[42px]">
            Jawaban terbaik adalah
            <br />
            <span className="font-serif font-normal italic tracking-[-0.03em] text-[#a02e1e] dark:text-[#ff9e4a]">
              yang kamu temukan sendiri.
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-md text-[12.5px] leading-relaxed text-[#75675b] dark:text-[#b7a28e]">
            Tanpa kartu kredit, tanpa instalasi. Tulis soalnya, biarkan mesin yang menilai.
          </p>

          <div className="mt-7 flex justify-center">
            <ActionButton href="/chat" size="lg">
              Buka ChatZAP
            </ActionButton>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[10.5px] text-[#8a7969] dark:text-[#a08d7c]">
            {CHECKS.map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Check className="h-3 w-3 text-[#2f7d52] dark:text-[#6fcf97]" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ClosingCta;

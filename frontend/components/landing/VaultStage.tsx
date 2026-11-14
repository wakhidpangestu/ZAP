"use client";

/**
 * VaultStage — visual kinetik untuk panel "vault envelope".
 *
 * Alur yang dibaca mata dari kiri ke kanan:
 *   plaintext (tumpukan kartu) → inti AES (cincin berputar + gembok) → storage (grid sel)
 * Paket data bergerak menyusuri kurva, halo inti berdenyut, sel storage menyala
 * bergiliran, dan ciphertext di bawah terus berubah — semuanya sesuai konteks
 * enkripsi, bukan garis grafik generik.
 */

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Fingerprint, ShieldCheck } from "lucide-react";

const ACCENT = "#ffb35c";
const ACCENT_SOFT = "rgba(255,179,92,0.35)";
const ACCENT_FILL = "rgba(255,179,92,0.16)";
const LINE = "#6b4b33";
const INK = "#e9d5bd";

const HEX = "0123456789abcdef";

/* Jalur alur: kartu → inti, inti → storage (kurva Bézier, sampel t=0..1) */
const FLOW_LEFT = { x: [86, 118, 148, 174, 196], y: [70, 62, 70, 78, 70] };
const FLOW_RIGHT = { x: [284, 310, 335, 361, 388], y: [70, 62, 70, 78, 70] };

const STORAGE = Array.from({ length: 9 }, (_, i) => ({
  x: 392 + (i % 3) * 18,
  y: 46 + Math.floor(i / 3) * 18,
}));

function randomHexRow(length = 19) {
  return Array.from({ length }, (_, i) => (i % 5 === 4 ? " " : HEX[Math.floor(Math.random() * HEX.length)])).join("");
}

export function VaultStage({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<string[]>(["9f2c 74ab e41a 0d6b", "6f03 1c58 d7b8 2a41"]);

  // ciphertext hidup: berganti selama vault terbuka
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setRows([randomHexRow(), randomHexRow()]);
    }, 900);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* cincin ambient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-24 h-44 w-44 rounded-full border border-[#d9772f]/10"
      />
      <div
        aria-hidden="true"
        className="orbit-spin pointer-events-none absolute -left-14 -top-16 h-32 w-32 rounded-full border border-dashed border-[#d9772f]/15"
      >
        <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-[#ffb35c]/80" />
        <span className="absolute bottom-[10%] right-[8%] h-1 w-1 rounded-full bg-[#ffd35c]/70" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#d8bc9f]">
          <span>Vault envelope</span>
          <span className="inline-flex items-center gap-1 text-[#ffd35c]">
            <Fingerprint className="h-3 w-3" />
            unlocked
          </span>
        </div>

        {/* Panggung kinetik */}
        <div className="mt-3 overflow-hidden rounded-[12px] border border-white/10 bg-[#120c08]">
          <svg
            viewBox="0 0 480 156"
            className="h-auto w-full [transform:perspective(900px)_rotateX(4deg)]"
            fill="none"
            aria-hidden="true"
          >
            {/* plaintext: tumpukan kartu, kartu teratas sesekali terangkat */}
            {[86, 70, 54].map((y, i) => (
              <g key={`card-${y}`}>
                <rect
                  x="18"
                  y={y}
                  width="68"
                  height="14"
                  rx="4"
                  fill={i === 0 ? ACCENT_FILL : "rgba(255,247,236,0.04)"}
                  stroke={i === 0 ? ACCENT : LINE}
                  strokeOpacity={i === 0 ? 0.9 : 0.8}
                />
                <rect x="25" y={y + 5} width="22" height="3" rx="1.5" fill={i === 0 ? ACCENT : "#8a6a51"} fillOpacity="0.8" />
                <rect x="52" y={y + 5} width="14" height="3" rx="1.5" fill="#8a6a51" fillOpacity="0.55" />
              </g>
            ))}
            <rect x="228" y="62" width="24" height="18" rx="5" fill={ACCENT_FILL} stroke={ACCENT} />
            <path d="M 234 62 v -4 a 6 6 0 0 1 12 0 v 4" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="240" cy="71" r="2.2" fill={ACCENT} />

            {/* jalur alur */}
            <defs>
              <radialGradient id="vault-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffb35c" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ffb35c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="240" cy="70" rx="78" ry="48" fill="url(#vault-glow)" />
            <path d="M 86 70 C 130 40, 170 100, 196 70" stroke={ACCENT_SOFT} strokeWidth="1" strokeDasharray="3 4" />
            <path d="M 284 70 C 320 40, 350 100, 388 70" stroke={ACCENT_SOFT} strokeWidth="1" strokeDasharray="3 4" />

            {/* inti AES */}
            <circle cx="240" cy="70" r="40" stroke={LINE} strokeOpacity="0.45" strokeDasharray="2 5" />
            <g className={reduce ? "" : "kx-spin-slow"} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <circle cx="240" cy="70" r="34" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="10 16" />
              <circle cx="240" cy="70" r="28" stroke={ACCENT_SOFT} strokeWidth="1" />
            </g>
            <motion.circle
              cx="240"
              cy="70"
              stroke={ACCENT}
              strokeWidth="1"
              fill="none"
              initial={{ r: 26, opacity: 0.5 }}
              animate={reduce ? { r: 26, opacity: 0.25 } : { r: [26, 44], opacity: [0.5, 0] }}
              transition={reduce ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeOut" }}
            />
            <rect x="228" y="62" width="24" height="18" rx="5" fill={ACCENT_FILL} stroke={ACCENT} />
            <path d="M 234 62 v -4 a 6 6 0 0 1 12 0 v 4" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="240" cy="71" r="2.2" fill={ACCENT} />

            {/* storage: grid sel menyala bergiliran */}
            <rect x="382" y="36" width="68" height="68" rx="8" stroke={LINE} strokeOpacity="0.5" strokeDasharray="2 4" />
            {STORAGE.map((cell, i) => (
              <motion.rect
                key={`cell-${i}`}
                x={cell.x}
                y={cell.y}
                width="12"
                height="12"
                rx="2.5"
                fill={ACCENT_FILL}
                stroke={ACCENT}
                strokeOpacity="0.5"
                initial={{ opacity: 0.25 }}
                animate={reduce ? { opacity: 0.4 } : { opacity: [0.25, 1, 0.25] }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 2.8, times: [0, 0.5, 1], repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }
                }
              />
            ))}

            {/* paket data bergerak */}
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={`packet-${i}`}
                r="2.6"
                fill={ACCENT}
                initial={{ x: FLOW_LEFT.x[0], y: FLOW_LEFT.y[0], opacity: 0 }}
                animate={
                  reduce
                    ? { x: 148, y: 70, opacity: 0.6 }
                    : {
                        x: [...FLOW_LEFT.x, ...FLOW_RIGHT.x.slice(1)],
                        y: [...FLOW_LEFT.y, ...FLOW_RIGHT.y.slice(1)],
                        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 0],
                      }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 4.2,
                        times: [0, 0.12, 0.23, 0.34, 0.5, 0.61, 0.72, 0.83, 1],
                        repeat: Infinity,
                        delay: i * 0.5,
                        ease: "easeInOut",
                      }
                }
              />
            ))}

            {/* keterangan mikro */}
            <g className="max-sm:hidden">
              <text x="18" y="120" fontSize="8" fill={INK} fillOpacity="0.55" fontFamily="ui-monospace, monospace">
                plaintext
              </text>
              <text x="240" y="134" fontSize="8" fill={INK} fillOpacity="0.6" textAnchor="middle" fontFamily="ui-monospace, monospace">
                AES-256-GCM
              </text>
              <text x="382" y="120" fontSize="8" fill={INK} fillOpacity="0.55" fontFamily="ui-monospace, monospace">
                sealed block
              </text>
            </g>
          </svg>
        </div>

        {/* ciphertext hidup + parameter */}
        <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8f7864]">
          <span>cipher</span>
          <span className="text-[#ffd6a4]">aes-gcm</span>
          <span>kdf</span>
          <span className="text-[#f3e6d6]">pbkdf2 310k</span>
          <span>storage</span>
          <span className="text-[#f3e6d6]">local</span>
        </div>

        <div className="mt-2 space-y-0.5 font-mono text-[9.5px] leading-[1.6] tracking-[0.06em] text-[#8a735f]">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={i === 0 ? "text-[#c9a17a]" : "text-[#8a735f]"}>{row}</span>
              <span className="pulse-dot h-1 w-1 shrink-0 rounded-full bg-[#ffb35c]" style={{ animationDelay: `${i * 0.45}s` }} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-[#bba58f]">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#ffd35c]" />
            Server tidak memegang kunci dekripsi.
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-emerald-300">
            <span className="pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
            sealed
          </span>
        </div>
      </div>
    </div>
  );
}

export default VaultStage;

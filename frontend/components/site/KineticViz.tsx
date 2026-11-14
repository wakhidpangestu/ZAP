"use client";

/**
 * KineticViz — animasi mikro per konteks.
 *
 * Setiap domain punya gerak yang berbeda dan bermakna:
 *   matematika  → kurva digambar, titik telusur menyusuri grafik, akar berdenyut
 *   pemrograman → token kode dievaluasi, paket turun menelusuri pohon AST
 *   fisika      → bola melengkung mengikuti trajektori + vektor kecepatan
 *   kimia       → cincin molekul berputar perspektif, ikatan berkilau, pH menyapu
 *   vault       → paket terenkripsi bergerak plaintext → cipher → storage
 *   router      → paket mengalir dari hub ke beberapa endpoint model
 *
 * Semua menghormati prefers-reduced-motion (berhenti di frame akhir).
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

type VizProps = { className?: string };

const AMBER = "var(--kx-accent)";
const AMBER_SOFT = "var(--kx-accent-soft)";
const AMBER_FILL = "var(--kx-accent-fill)";
const LINE = "var(--kx-line)";
const NODE_LINE = "var(--kx-line-strong)";
const TEXT = "var(--kx-ink)";
const GREEN = "var(--kx-ok)";
const GREEN_FILL = "var(--kx-ok-fill)";
const SURFACE_2 = "var(--kx-surface-2)";
const ERROR = "var(--kx-error)";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

/* ------------------------------------------------------------------ */
/* 1. Matematika — parabola real-time + titik telusur + akar           */
/* ------------------------------------------------------------------ */

const MATH_CURVE = "M 34 26 Q 120 132 206 26";

// x(t) = 34 + 172t, y(t) = 26 + 212t - 212t² (kurva Bézier di atas)
function mathPoint(t: number) {
  return {
    x: 34 + 172 * t,
    y: 26 + 212 * t - 212 * t * t,
  };
}

export function MathViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();
  const trace = [0.08, 0.32, 0.5, 0.68, 0.92].map(mathPoint);
  const rootA = mathPoint(0.2005);
  const rootB = mathPoint(0.7995);

  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" aria-hidden="true">
      {/* kertas grafik */}
      {[26, 60, 94].map((y) => (
        <line key={`h${y}`} x1="18" y1={y} x2="222" y2={y} stroke={LINE} strokeOpacity="0.28" strokeDasharray="2 5" />
      ))}
      {[56, 90, 124, 158, 192].map((x) => (
        <line key={`v${x}`} x1={x} y1="12" x2={x} y2="98" stroke={LINE} strokeOpacity="0.16" strokeDasharray="2 6" />
      ))}

      {/* sumbu */}
      <line x1="18" y1="60" x2="222" y2="60" stroke={LINE} strokeOpacity="0.85" />
      <line x1="120" y1="10" x2="120" y2="100" stroke={LINE} strokeOpacity="0.5" strokeDasharray="3 4" />

      <text x="20" y="20" fontSize="9.5" fill={TEXT} fontFamily={mono} fillOpacity="0.75">
        y = x² − 9
      </text>

      {/* dasar kurva: selalu terlihat, jadi kartu tidak pernah kosong */}
      <path d={MATH_CURVE} stroke={AMBER} strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round" />

      {/* kurva digambar ulang, lalu trace berjalan */}
      <motion.path
        d={MATH_CURVE}
        stroke={AMBER}
        strokeWidth="1.7"
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={reduce ? { pathLength: 1, opacity: 0.75 } : { pathLength: [0, 1, 1], opacity: [0.55, 1, 0.75] }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 3.4, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }
        }
      />

      {/* akar real berdenyut saat kurva memotong sumbu */}
      {[rootA, rootB].map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="2.6"
          fill={GREEN}
          initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0.45, scale: 1 }}
          animate={reduce ? { opacity: 1, scale: 1 } : { opacity: [0.35, 1, 1, 0.45], scale: [0.8, 1.3, 1, 0.9] }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 3.4, times: [0, 0.55, 0.86, 1], repeat: Infinity, repeatDelay: 0.6, delay: 0.15 + i * 0.1 }
          }
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}

      {/* titik telusur menyusuri kurva + crosshair bantu */}
      <motion.g
        initial={{ x: trace[0].x, y: trace[0].y }}
        animate={
          reduce
            ? { x: trace[2].x, y: trace[2].y }
            : { x: trace.map((p) => p.x), y: trace.map((p) => p.y) }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 3.4, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }
        }
      >
        <line x1="0" y1="-16" x2="0" y2="16" stroke={AMBER_SOFT} strokeDasharray="2 3" />
        <line x1="-16" y1="0" x2="16" y2="0" stroke={AMBER_SOFT} strokeDasharray="2 3" />
        <circle r="3" fill={AMBER} />
        <circle r="6" fill={AMBER} fillOpacity="0.12" />
      </motion.g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Pemrograman — evaluasi token + paket menelusuri pohon AST        */
/* ------------------------------------------------------------------ */

const AST_NODES = [
  { x: 120, y: 20, w: 26, h: 14, label: "+", root: true },
  { x: 82, y: 52, w: 24, h: 13, label: "×" },
  { x: 158, y: 52, w: 24, h: 13, label: "−" },
  { x: 54, y: 84, w: 18, h: 11, label: "2" },
  { x: 104, y: 84, w: 18, h: 11, label: "x" },
  { x: 140, y: 84, w: 18, h: 11, label: "6" },
  { x: 182, y: 84, w: 18, h: 11, label: "1" },
];

const AST_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6],
];

export function CodeViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();

  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" aria-hidden="true">
      {/* baris kode */}
      {[
        { y: 10, tokens: [18, 10, 34] },
        { y: 20, tokens: [26, 26, 16] },
        { y: 30, tokens: [14, 40, 22] },
      ].map((line, li) => {
        let cursor = 16;
        return (
          <g key={`code-${li}`}>
            {line.tokens.map((width, ti) => {
              const x = cursor;
              cursor += width + 6;
              return (
                <motion.rect
                  key={`tok-${li}-${ti}`}
                  x={x}
                  y={line.y}
                  width={width}
                  height="4"
                  rx="2"
                  fill={ti === 0 ? AMBER : NODE_LINE}
                  initial={{ opacity: 0.25 }}
                  animate={
                    reduce
                      ? { opacity: ti === 0 ? 0.8 : 0.5 }
                      : { opacity: [0.22, 0.22, 0.95, 0.22] }
                  }
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          duration: 3.6,
                          times: [0, 0.45 + li * 0.06, 0.58 + li * 0.06, 0.72 + li * 0.06],
                          repeat: Infinity,
                          repeatDelay: 0.8,
                        }
                  }
                />
              );
            })}
          </g>
        );
      })}

      {/* pohon AST */}
      {AST_EDGES.map(([from, to], i) => {
        const a = AST_NODES[from];
        const b = AST_NODES[to];
        return (
          <motion.line
            key={`edge-${i}`}
            x1={a.x}
            y1={a.y + 7}
            x2={b.x}
            y2={b.y - 6}
            stroke={NODE_LINE}
            strokeWidth="1"
            initial={{ opacity: 0.35 }}
            animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 0.3, 0.95, 0.3] }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 3.6, times: [0, 0.62 + i * 0.04, 0.72 + i * 0.04, 0.84 + i * 0.04], repeat: Infinity, repeatDelay: 0.8 }
            }
          />
        );
      })}

      {AST_NODES.map((node, i) => (
        <motion.rect
          key={`node-${i}`}
          x={node.x - node.w / 2}
          y={node.y - node.h / 2}
          width={node.w}
          height={node.h}
          rx="4"
          fill={node.root ? AMBER_FILL : SURFACE_2}
          stroke={node.root ? AMBER : NODE_LINE}
          strokeWidth="1"
          initial={{ opacity: 0.7 }}
          animate={reduce ? { opacity: 0.9 } : { opacity: [0.55, 0.55, 1, 0.55] }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 3.6, times: [0, 0.62 + i * 0.04, 0.74 + i * 0.04, 0.88 + i * 0.04], repeat: Infinity, repeatDelay: 0.8 }
          }
        />
      ))}

      {/* paket evaluasi turun dari root ke salah satu daun */}
      <motion.circle
        r="2.6"
        fill={AMBER}
        initial={{ cx: 120, cy: 20, opacity: 0 }}
        animate={
          reduce
            ? { cx: 104, cy: 84, opacity: 0.9 }
            : {
                cx: [120, 120, 82, 104, 104],
                cy: [20, 20, 52, 84, 84],
                opacity: [0, 1, 1, 1, 0],
              }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 3.6, times: [0.05, 0.3, 0.45, 0.6, 0.72], repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }
        }
      />

      <text x="16" y="106" fontSize="8" fill={TEXT} fillOpacity="0.5" fontFamily={mono}>
        AST · max 160 node
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Fisika — trajektori proyektil + bola + vektor kecepatan          */
/* ------------------------------------------------------------------ */

const PHYS_PATH = "M 22 94 Q 118 -6 218 92";

function physPoint(t: number) {
  const x = (1 - t) * (1 - t) * 22 + 2 * t * (1 - t) * 118 + t * t * 218;
  const y = (1 - t) * (1 - t) * 94 + 2 * t * (1 - t) * -6 + t * t * 92;
  return { x, y };
}

export function PhysicsViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();
  const flight = [0.06, 0.28, 0.5, 0.72, 0.94].map(physPoint);
  const apex = physPoint(0.5);

  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" aria-hidden="true">
      {/* lantai + grid metrik */}
      <line x1="14" y1="94" x2="226" y2="94" stroke={LINE} strokeOpacity="0.9" />
      {[22, 62, 102, 142, 182, 222].map((x) => (
        <line key={x} x1={x} y1="94" x2={x} y2="99" stroke={LINE} strokeOpacity="0.45" />
      ))}
      {[30, 62].map((y) => (
        <line key={y} x1="14" y1={y} x2="226" y2={y} stroke={LINE} strokeOpacity="0.18" strokeDasharray="2 6" />
      ))}

      {/* sudut lempar */}
      <path d="M 42 94 A 20 20 0 0 0 32 78" stroke={AMBER_SOFT} strokeWidth="1.2" strokeDasharray="2 3" />
      <text x="38" y="88" fontSize="7.5" fill={TEXT} fillOpacity="0.6" fontFamily={mono}>
        θ
      </text>

      {/* trajektori putus-putus */}
      <path d={PHYS_PATH} stroke={AMBER_SOFT} strokeWidth="1.1" strokeDasharray="3 4" />
      <motion.path
        d={PHYS_PATH}
        stroke={AMBER}
        strokeWidth="1.6"
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1, opacity: 0.5 } : { pathLength: 0, opacity: 0 }}
        animate={reduce ? { pathLength: 1, opacity: 0.5 } : { pathLength: [0, 1], opacity: [0.9, 0] }}
        transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }}
      />

      {/* puncak */}
      <line x1={apex.x} y1={apex.y} x2={apex.x} y2="94" stroke={AMBER_SOFT} strokeDasharray="2 3" strokeOpacity="0.7" />
      <circle cx={apex.x} cy={apex.y} r="1.6" fill={AMBER} fillOpacity="0.7" />

      {/* bola melengkung sesuai trajektori */}
      <motion.circle
        r="3.4"
        fill={AMBER}
        initial={{ opacity: 0 }}
        animate={reduce ? { cx: apex.x, cy: apex.y, opacity: 0.9 } : { cx: flight.map((p) => p.x), cy: flight.map((p) => p.y), opacity: [0.2, 1, 1, 1, 0.15] }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 2.6, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }
        }
      />

      {/* vektor kecepatan mengikuti bola */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 0.7, x: 0, y: 0 } : { x: [0, 0, 0], y: [0, 0, 0], opacity: [0, 0.85, 0] }}
        transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Infinity, repeatDelay: 0.35 }}
      >
        <motion.line
          x1="0"
          y1="0"
          stroke={GREEN}
          strokeWidth="1.2"
          strokeDasharray="2 2"
          initial={{ x2: -4, y2: -2 }}
          animate={reduce ? { x2: -12, y2: -10 } : { x2: [-4, -14, -18], y2: [-10, -16, -12] }}
          transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Infinity, repeatDelay: 0.35 }}
        />
      </motion.g>

      <text x="16" y="18" fontSize="8" fill={TEXT} fillOpacity="0.55" fontFamily={mono}>
        v₀ = 12 m/s · g = 9,8
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Kimia — cincin molekul berputar perspektif + pH menyapu          */
/* ------------------------------------------------------------------ */

export function ChemistryViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();
  const atoms = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return { x: 92 + Math.cos(angle) * 30, y: 56 + Math.sin(angle) * 20, angle };
  });

  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" aria-hidden="true">
      <text x="16" y="16" fontSize="8" fill={TEXT} fillOpacity="0.55" fontFamily={mono}>
        C₆H₆ · 78,11 g/mol
      </text>

      {/* orbit luar */}
      <ellipse cx="92" cy="56" rx="42" ry="30" stroke={LINE} strokeOpacity="0.35" strokeDasharray="2 5" />

      {/* cincin berputar dalam perspektif */}
      <g transform="translate(92 56)">
        <g
          className={reduce ? "" : "kx-spin-slow"}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <g transform="translate(-92 -56)">
            {atoms.map((atom, i) => {
              const next = atoms[(i + 1) % atoms.length];
              return (
                <motion.line
                  key={`bond-${i}`}
                  x1={atom.x}
                  y1={atom.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={AMBER}
                  strokeWidth="1.2"
                  initial={{ opacity: 0.35 }}
                  animate={reduce ? { opacity: 0.6 } : { opacity: [0.25, 0.9, 0.25] }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { duration: 3.2, times: [0, 0.5, 1], repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }
                  }
                />
              );
            })}
            {atoms.map((atom, i) => (
              <motion.circle
                key={`atom-${i}`}
                cx={atom.x}
                cy={atom.y}
                r={i % 2 === 0 ? 4 : 2.8}
                fill={i % 2 === 0 ? AMBER_FILL : GREEN_FILL}
                stroke={i % 2 === 0 ? AMBER : GREEN}
                strokeWidth="1"
                initial={{ opacity: 0.85 }}
                animate={reduce ? { opacity: 0.85 } : { opacity: [0.6, 1, 0.6] }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 3.2, times: [0, 0.5, 1], repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }
                }
              />
            ))}
          </g>
        </g>
      </g>

      {/* skala pH: penanda bergerak dari asam ke basa */}
      <defs>
        <linearGradient id="kx-ph" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97362" />
          <stop offset="50%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#5ec69d" />
        </linearGradient>
      </defs>
      <text x="158" y="30" fontSize="7.5" fill={TEXT} fillOpacity="0.55" fontFamily={mono}>
        pH
      </text>
      <rect x="158" y="36" width="64" height="4" rx="2" fill="url(#kx-ph)" fillOpacity="0.85" />
      <motion.rect
        width="3"
        height="10"
        rx="1.5"
        fill={TEXT}
        initial={{ opacity: 0.9 }}
        animate={reduce ? { x: 186, opacity: 0.9 } : { x: [158, 219, 158], opacity: [0.6, 1, 0.6] }}
        transition={
          reduce ? { duration: 0 } : { duration: 5, times: [0, 0.5, 1], repeat: Infinity, ease: "easeInOut" }
        }
        y="33"
      />

      {/* gas ideal: partikel mengambang */}
      {[
        { x: 172, y: 66, d: 0 },
        { x: 192, y: 78, d: 0.6 },
        { x: 210, y: 62, d: 1.2 },
        { x: 200, y: 92, d: 1.8 },
      ].map((p, i) => (
        <motion.circle
          key={`gas-${i}`}
          cx={p.x}
          cy={p.y}
          r="1.7"
          fill={AMBER}
          fillOpacity="0.7"
          initial={{ opacity: 0.4 }}
          animate={reduce ? { opacity: 0.6, cy: p.y } : { cy: [p.y, p.y - 6, p.y], opacity: [0.25, 0.9, 0.25] }}
          transition={reduce ? { duration: 0 } : { duration: 3.6, repeat: Infinity, delay: p.d, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Router — paket mengalir dari hub ke endpoint model               */
/* ------------------------------------------------------------------ */

export function RouterViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();
  const nodes = [14, 46, 78, 110, 142];

  return (
    <svg viewBox="0 0 156 40" className={className} fill="none" aria-hidden="true">
      <line x1="14" y1="20" x2="142" y2="20" stroke={LINE} strokeOpacity="0.45" strokeDasharray="3 4" />
      {nodes.map((x, i) => (
        <g key={x}>
          <motion.circle
            cx={x}
            cy="20"
            r={i === 0 ? 4 : 3}
            fill={i === 0 ? AMBER_FILL : SURFACE_2}
            stroke={i === 0 ? AMBER : NODE_LINE}
            strokeWidth="1"
            initial={{ opacity: 0.8 }}
            animate={reduce ? { opacity: 0.8 } : { opacity: [0.5, 0.5, 1, 0.5] }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 4, times: [0, 0.2 + i * 0.16, 0.28 + i * 0.16, 0.42 + i * 0.16], repeat: Infinity, repeatDelay: 0.35 }
            }
          />
        </g>
      ))}
      <motion.circle
        r="2.2"
        fill={AMBER}
        initial={{ opacity: 0 }}
        animate={reduce ? { cx: 78, cy: 20, opacity: 0.8 } : { cx: [14, 46, 78, 110, 142], cy: 20, opacity: [0, 1, 1, 1, 0.2] }}
        transition={reduce ? { duration: 0 } : { duration: 4, times: [0.06, 0.28, 0.5, 0.72, 0.92], repeat: Infinity, ease: "linear" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Step-check — pemeriksa baris langkah (kartu SymPy CAS)           */
/* ------------------------------------------------------------------ */

export function StepCheckViz({ className = "" }: VizProps) {
  const reduce = useReducedMotion();
  const rows = [
    { y: 12, width: 52, ok: true },
    { y: 25, width: 44, ok: false },
    { y: 38, width: 58, ok: true },
  ];

  return (
    <svg viewBox="0 0 88 52" className={className} fill="none" aria-hidden="true">
      {rows.map((row, i) => (
        <g key={row.y}>
          <rect x="4" y={row.y} width={row.width} height="5" rx="2.5" fill={row.ok ? AMBER : ERROR} fillOpacity="0.55" />
          <motion.circle
            cx="76"
            cy={row.y + 2.5}
            r="2.6"
            fill={row.ok ? GREEN : ERROR}
            initial={{ opacity: 0.5 }}
            animate={reduce ? { opacity: 0.8 } : { opacity: [0.25, 0.25, 1, 0.35] }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 3.4, times: [0, 0.2 + i * 0.18, 0.3 + i * 0.18, 0.5 + i * 0.18], repeat: Infinity, repeatDelay: 0.6 }
            }
          />
        </g>
      ))}
      <motion.line
        x1="2"
        y1="0"
        x2="2"
        y2="48"
        stroke={AMBER}
        strokeOpacity="0.55"
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 0 } : { x1: [2, 84], x2: [2, 84], opacity: [0, 0.8, 0] }}
        transition={reduce ? { duration: 0 } : { duration: 3.4, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
      />
    </svg>
  );
}

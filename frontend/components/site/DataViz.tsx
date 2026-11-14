"use client";

import React from "react";

function toPath(values: number[], width = 120, height = 36) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 6) - 3;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  className = "",
  stroke = "#c2410c",
  fill = "rgba(194,65,12,0.10)",
}: {
  values: number[];
  className?: string;
  stroke?: string;
  fill?: string;
}) {
  const path = toPath(values);
  const area = `${path} L 120 36 L 0 36 Z`;

  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden="true" fill="none" preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={path} stroke={stroke} strokeOpacity="0.25" strokeWidth="1.2" />
      <path
        d={path}
        stroke={stroke}
        strokeWidth="1.4"
        strokeDasharray="9 7"
        strokeLinecap="round"
        className="animate-data-dash"
      />
    </svg>
  );
}

export function PulseBars({
  values = [36, 62, 44, 78, 55, 88, 70],
  className = "",
  tone = "light",
}: {
  values?: number[];
  className?: string;
  tone?: "light" | "dark";
}) {
  const base = tone === "dark" ? "bg-[#ffb35c]/25" : "bg-[#c2410c]/15";
  const active = tone === "dark" ? "bg-[#ffb35c]" : "bg-[#c2410c]";

  return (
    <div className={`flex h-10 items-end gap-1 ${className}`} aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`data-bar w-1.5 origin-bottom rounded-[1px] ${index === values.length - 2 ? active : base}`}
          style={{ height: `${value}%`, animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function OrbitDots({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-[#d9772f]/20" />
      <div className="absolute inset-[18%] rounded-full border border-dashed border-[#d9772f]/25" />
      <div className="orbit-spin absolute inset-0">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#d9772f]" />
        <span className="absolute bottom-[12%] right-[10%] h-1 w-1 rounded-full bg-[#ffb35c]" />
      </div>
      <div className="orbit-spin-reverse absolute inset-[26%]">
        <span className="absolute left-0 top-1/2 h-1 w-1 rounded-full bg-[#ffd35c]" />
      </div>
    </div>
  );
}

export function SignalHash({ className = "", tone = "dark" }: { className?: string; tone?: "light" | "dark" }) {
  const rows = ["9f2c 74ab e41a 0d6b", "6f03 1c58 d7b8 2a41", "12a5 9e30 c9e0 5b77"];
  return (
    <div className={`font-mono text-[10px] leading-[1.9] ${className}`} aria-hidden="true">
      {rows.map((row, index) => (
        <div key={row} className="flex items-center justify-between gap-3">
          <span className={tone === "dark" ? "text-[#a88f77]" : "text-[#a08d7c]"}>{row}</span>
          <span
            className="pulse-dot h-1 w-1 rounded-full bg-[#ffb35c]"
            style={{ animationDelay: `${index * 0.45}s` }}
          />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Warm "Ribbon Field" hero background.
 *
 * Perf notes:
 * - rendered at a fraction of the display size, then browser-scaled
 * - colour lookup is precomputed into a 256-step LUT, not interpolated per pixel
 * - 24fps cap, paused when offscreen or in a hidden tab
 */
const STOPS = [
  { hex: "#2A0E0E", pos: 5 },
  { hex: "#A02E1E", pos: 52 },
  { hex: "#F07A1E", pos: 70 },
  { hex: "#FFD35C", pos: 100 },
] as const;

const ANGLE = 136;
const WAVE = 12;

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const RGB_STOPS = STOPS.map((stop) => ({ pos: stop.pos / 100, rgb: hexToRgb(stop.hex) }));

function sampleGradient(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  let left = RGB_STOPS[0];
  let right = RGB_STOPS[RGB_STOPS.length - 1];
  for (let i = 0; i < RGB_STOPS.length - 1; i += 1) {
    if (clamped >= RGB_STOPS[i].pos && clamped <= RGB_STOPS[i + 1].pos) {
      left = RGB_STOPS[i];
      right = RGB_STOPS[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, right.pos - left.pos);
  const mix = Math.min(1, Math.max(0, (clamped - left.pos) / span));
  const eased = mix * mix * (3 - 2 * mix);
  return [
    left.rgb[0] + (right.rgb[0] - left.rgb[0]) * eased,
    left.rgb[1] + (right.rgb[1] - left.rgb[1]) * eased,
    left.rgb[2] + (right.rgb[2] - left.rgb[2]) * eased,
  ];
}

const COLOR_LUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i += 1) {
  const [r, g, b] = sampleGradient(i / 255);
  COLOR_LUT[i * 3] = r;
  COLOR_LUT[i * 3 + 1] = g;
  COLOR_LUT[i * 3 + 2] = b;
}

const SIN_LUT = new Float32Array(2048);
for (let i = 0; i < SIN_LUT.length; i += 1) {
  SIN_LUT[i] = Math.sin((i / SIN_LUT.length) * Math.PI * 2);
}
function fastSin(angle: number) {
  const wrapped = angle % (Math.PI * 2);
  const index = Math.floor((wrapped / (Math.PI * 2)) * SIN_LUT.length) & (SIN_LUT.length - 1);
  return SIN_LUT[index < 0 ? index + SIN_LUT.length : index];
}

export function RibbonGradient({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let noise = new Float32Array(0);
    let lastPaint = 0;
    let visible = true;
    let running = false;
    let scrolling = false;
    let scrollIdle: number | undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const compact = rect.width < 720;
      width = Math.max(240, Math.min(compact ? 260 : 460, Math.round(rect.width * (compact ? 0.55 : 0.4))));
      height = Math.max(200, Math.min(680, Math.round((width * rect.height) / Math.max(1, rect.width))));
      canvas.width = width;
      canvas.height = height;
      noise = new Float32Array(width * height);
      for (let i = 0; i < noise.length; i += 1) noise[i] = Math.random() - 0.5;
      lastPaint = 0;
    };

    const paint = (now: number) => {
      if (!running) return;
      if (!visible || document.hidden || scrolling) {
        running = false;
        return;
      }
      if (now - lastPaint < 42) {
        raf = requestAnimationFrame(paint);
        return;
      }
      lastPaint = now;

      const elapsed = reduceMotion ? 0 : (now - start) / 1000;
      const ph = elapsed * 0.31;
      const amt = 0.2;
      const angle = ((ANGLE + Math.sin(ph * 0.6) * 28 * amt) * Math.PI) / 180;
      const clock = 20.75 + ph * 1.2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const diag = Math.hypot(width, height);
      const zoom = 1.68;
      const waveAmp = (WAVE / 100) * 0.35;

      const image = ctx.createImageData(width, height);
      const data = image.data;
      let offset = 0;

      for (let y = 0; y < height; y += 1) {
        const py = y - height / 2;
        for (let x = 0; x < width; x += 1) {
          const px = x - width / 2;
          let u = (px * cos + py * sin) / diag + 0.5;
          const cross = (-px * sin + py * cos) / diag;
          const bend = fastSin(cross * 2.4 * Math.PI * 2 + clock) * waveAmp;
          u = (u - 0.5) / zoom + 0.5 + bend;

          const colorIndex = Math.max(0, Math.min(255, Math.round(u * 255))) * 3;
          const grain = noise[offset / 4] * 12;
          data[offset] = COLOR_LUT[colorIndex] + grain;
          data[offset + 1] = COLOR_LUT[colorIndex + 1] + grain;
          data[offset + 2] = COLOR_LUT[colorIndex + 2] + grain;
          data[offset + 3] = 255;
          offset += 4;
        }
      }

      ctx.putImageData(image, 0, 0);
      if (!reduceMotion) raf = requestAnimationFrame(paint);
    };

    const startLoop = () => {
      if (running || reduceMotion) return;
      running = true;
      lastPaint = 0;
      raf = requestAnimationFrame(paint);
    };

    resize();
    running = true;
    paint(performance.now());

    const onResize = () => {
      resize();
      running = false;
      if (raf) cancelAnimationFrame(raf);
      running = true;
      paint(performance.now());
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else {
        startLoop();
      }
    };

    // Gradien ini beranimasi lambat; saat pengguna menggulir, piksel canvas
    // dihitung ulang 24x/detik dan bersaing dengan compositor. Hentikan sementara
    // selama gulir, lalu lanjutkan 160 ms setelah gulir berhenti.
    const onScroll = () => {
      scrolling = true;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(scrollIdle);
      scrollIdle = window.setTimeout(() => {
        scrolling = false;
        startLoop();
      }, 160);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) startLoop();
      },
      { rootMargin: "120px" }
    );
    observer.observe(canvas);

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(scrollIdle);
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      running = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

export default RibbonGradient;

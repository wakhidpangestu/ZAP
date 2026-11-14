"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface RichChatTextProps {
  content: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Cache keluaran KaTeX.
//
// Satu utas percakapan panjang berisi puluhan rumus yang sama dan komponen ini
// dirender ulang setiap kali halaman chat berubah (mis. setiap ketukan tombol
// di komposer). renderToString() mahal, jadi hasil HTML per ekspresi rumus
// disimpan di Map module-level dengan batas 500 entri (buang entri tertua saat
// penuh agar tidak tumbuh tanpa batas).
// ---------------------------------------------------------------------------
const KATEX_CACHE_LIMIT = 500;
// null berarti renderToString melempar error → fallback <code> seperti semula.
const katexHtmlCache = new Map<string, string | null>();

function renderKatexHtml(math: string, displayMode: boolean): string | null {
  const source = math.trim();
  const cacheKey = `${displayMode ? "D" : "I"}:${source}`;
  const cached = katexHtmlCache.get(cacheKey);
  if (cached !== undefined) {
    // Sentuh entri agar tidak terbuang lebih dulu (LRU sederhana).
    katexHtmlCache.delete(cacheKey);
    katexHtmlCache.set(cacheKey, cached);
    return cached;
  }
  let html: string | null = null;
  try {
    html = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    html = null;
  }

  if (katexHtmlCache.size >= KATEX_CACHE_LIMIT) {
    const oldestKey = katexHtmlCache.keys().next().value;
    if (oldestKey !== undefined) katexHtmlCache.delete(oldestKey);
  }
  katexHtmlCache.set(cacheKey, html);
  return html;
}

type RichSegmentKey = string | number;

function renderKatexNode(math: string, displayMode: boolean, key: RichSegmentKey): React.ReactNode {
  const html = renderKatexHtml(math, displayMode);
  if (html === null) {
    return (
      <code key={key} className="font-mono text-sm px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
        {math}
      </code>
    );
  }
  return (
    <span
      key={key}
      className={
        displayMode
          ? "inline-block max-w-full overflow-x-auto px-1 font-medium text-zinc-900 dark:text-white"
          : "inline-block max-w-full overflow-x-auto px-0.5 font-medium text-zinc-900 dark:text-white align-baseline"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Format teks berisi inline math $...$, bold **...**, dan display math $$...$$.
 * Fungsi murni terhadap `text` (tanpa state/props lain) sehingga hasilnya aman
 * di-memo per isi pesan.
 */
function formatSegment(text: string, baseKey: string | number): React.ReactNode {
  if (!text) return null;

  // 1. Pisahkan display math $$...$$ lebih dulu (mungkin ada di dalam bullet/baris)
  const dMathParts = text.split(/(\$\$[^$]+?\$\$)/g);

  return dMathParts.map((dmPart, dmIdx) => {
    const dmKey = `${baseKey}_dm_${dmIdx}`;
    if (dmPart.startsWith("$$") && dmPart.endsWith("$$") && dmPart.length >= 4) {
      return renderKatexNode(dmPart.slice(2, -2), true, dmKey);
    }

    // 2. Pisahkan bold **...**
    const boldParts = dmPart.split(/(\*\*[^*]+?\*\*)/g);

    return boldParts.map((bPart, bIdx) => {
      const bKey = `${dmKey}_b_${bIdx}`;
      if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length >= 4) {
        const innerBold = bPart.slice(2, -2);
        // Bold bisa memuat inline math $...$
        const innerMathParts = innerBold.split(/(\$[^$]+?\$)/g);
        return (
          <strong key={bKey} className="font-semibold text-zinc-900 dark:text-white">
            {innerMathParts.map((imPart, imIdx) => {
              if (imPart.startsWith("$") && imPart.endsWith("$") && imPart.length >= 2) {
                return renderKatexNode(imPart.slice(1, -1), false, `${bKey}_im_${imIdx}`);
              }
              return imPart;
            })}
          </strong>
        );
      }

      // 3. Teks reguler yang mungkin memuat inline math $...$
      const inlineMathParts = bPart.split(/(\$[^$]+?\$)/g);
      return inlineMathParts.map((imPart, imIdx) => {
        const imKey = `${bKey}_im_${imIdx}`;
        if (imPart.startsWith("$") && imPart.endsWith("$") && imPart.length >= 2) {
          return renderKatexNode(imPart.slice(1, -1), false, imKey);
        }

        // 4. Pisahkan italic *...*
        const italicParts = imPart.split(/(\*[^*\n]+?\*)/g);
        return italicParts.map((itPart, itIdx) => {
          if (itPart.startsWith("*") && itPart.endsWith("*") && itPart.length >= 2) {
            return (
              <em key={`${imKey}_it_${itIdx}`} className="italic text-zinc-700 dark:text-zinc-300">
                {itPart.slice(1, -1)}
              </em>
            );
          }
          return itPart;
        });
      });
    });
  });
}

/**
 * Membangun pohon baris dari `content`. Dipisah dari komponen supaya hasil
 * parse bisa di-memo murni berdasarkan string isi pesan (bukan className).
 */
function buildBody(content: string): React.ReactNode[] {
  const lines = content.split("\n");

  return lines.map((rawLine, index) => {
    const line = rawLine.trim();

    // Empty line
    if (!line) {
      return <div key={index} className="h-0" />;
    }

    // Display math standalone block: $$...$$
    if (line.startsWith("$$") && line.endsWith("$$")) {
      const mathContent = line.slice(2, -2).trim();
      return (
        <div
          key={index}
          className="my-3 overflow-x-auto py-2 text-center text-zinc-900 dark:text-white text-base"
        >
          {renderKatexNode(mathContent, true, `block_${index}`)}
        </div>
      );
    }

    // Heading 3: ### ... → h4. Di dalam transkrip, heading markdown tidak
    // boleh keluar dari level h3 supaya hierarki halaman (h1 sesi → h2/h3
    // jawaban) tetap runtut untuk navigasi pembaca layar.
    if (line.startsWith("### ")) {
      const headingText = line.replace(/^###\s+/, "");
      return (
        <h4
          key={index}
          className="text-[15.5px] font-semibold text-zinc-900 dark:text-white pt-2 pb-0.5 tracking-tight"
        >
          {formatSegment(headingText, `h4_${index}`)}
        </h4>
      );
    }

    // Heading 2: ## ... → h3
    if (line.startsWith("## ")) {
      const headingText = line.replace(/^##\s+/, "");
      return (
        <h3
          key={index}
          className="text-base sm:text-[17px] font-semibold text-zinc-900 dark:text-white pt-2.5 pb-0.5 tracking-tight"
        >
          {formatSegment(headingText, `h3_${index}`)}
        </h3>
      );
    }

    // Heading 1: # ... → h2
    if (line.startsWith("# ")) {
      const headingText = line.replace(/^#\s+/, "");
      return (
        <h2
          key={index}
          className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white pt-3 pb-1 tracking-tight"
        >
          {formatSegment(headingText, `h2_${index}`)}
        </h2>
      );
    }

    // Bullet lists: "- ", "* "
    if (/^[-*]\s+/.test(line)) {
      const bulletText = line.replace(/^[-*]\s+/, "");
      return (
        <div key={index} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="text-zinc-400 dark:text-zinc-500 select-none text-base leading-relaxed shrink-0">•</span>
          <div className="flex-1 min-w-0">{formatSegment(bulletText, `li_${index}`)}</div>
        </div>
      );
    }

    // Numbered list: "1. ", "2. ", etc.
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const itemText = numMatch[2];
      return (
        <div key={index} className="flex items-start gap-2 pl-1 my-1">
          <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400 select-none w-5 pt-0.5 shrink-0">
            {num}.
          </span>
          <div className="flex-1 min-w-0">{formatSegment(itemText, `ol_${index}`)}</div>
        </div>
      );
    }

    // Callout box if starts with 💡, 📌, ⚠️, 🎉
    if (line.startsWith("💡") || line.startsWith("📌") || line.startsWith("⚠️")) {
      return (
        <div
          key={index}
          className="my-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] backdrop-blur-md border border-zinc-200/70 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed shadow-sm"
        >
          {formatSegment(line, `callout_${index}`)}
        </div>
      );
    }

    // Regular paragraph line
    return (
      <p key={index} className="leading-relaxed">
        {formatSegment(line, `p_${index}`)}
      </p>
    );
  });
}

function RichChatText({ content, className = "" }: RichChatTextProps) {
  // Parse markdown + LaTeX hanya ketika isi pesan berubah. Render ulang
  // halaman chat akibat ketikan di komposer tidak lagi memicu parse/KaTeX.
  const body = useMemo(
    () => (content ? buildBody(content) : null),
    [content]
  );

  if (!body) return null;

  return (
    <div className={`space-y-2 text-[15.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 break-words [overflow-wrap:anywhere] max-w-full ${className}`}>
      {body}
    </div>
  );
}

// className diabaikan bila nilainya sama (komponen ini selalu dipanggil tanpa
// className di halaman chat); bandingkan keduanya sebagai string agar
// undefined dan "" dianggap ekuivalen.
const RichChatTextMemo = React.memo(
  RichChatText,
  (prev, next) =>
    prev.content === next.content &&
    (prev.className ?? "") === (next.className ?? "")
);

export default RichChatTextMemo;

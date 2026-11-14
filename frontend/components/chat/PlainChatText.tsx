"use client";

import React, { useMemo } from "react";

interface PlainChatTextProps {
  content: string;
  className?: string;
}

/**
 * Renderer teks polos tanpa dependensi berat (tanpa KaTeX).
 *
 * Dipakai sebagai:
 * 1. Renderer final untuk pesan yang tidak mengandung markdown/rumus sama
 *    sekali, sehingga chunk KaTeX tidak perlu dimuat sama sekali.
 * 2. Fallback selama chunk RichChatText dimuat secara lazy; struktur blok
 *    dan metrik teksnya meniru RichChatText agar pergantian renderer tidak
 *    menggeser layout (CLS tetap 0).
 *
 * Penanda markdown sederhana (**tebal**, *miring*, $...$) dilepas dari
 * tampilan polos; isi teksnya sendiri dipertahankan apa adanya.
 */
function stripMarkers(text: string): string {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/\$\$?/g, "");
}

/**
 * Membangun pohon baris dari `content`. Hasil parse di-memo per isi pesan,
 * jadi ketikan di komposer tidak memicu parse ulang seluruh transkrip.
 */
function buildBody(content: string): React.ReactNode[] {
  const lines = content.split("\n");

  return lines.map((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      return <div key={index} className="h-1.5" />;
    }

    if (line.startsWith("$$") && line.endsWith("$$") && line.length >= 4) {
      return (
        <div
          key={index}
          className="my-3 overflow-x-auto py-2 text-center text-zinc-900 dark:text-white text-base"
        >
          {stripMarkers(line.slice(2, -2).trim())}
        </div>
      );
    }

    if (line.startsWith("### ")) {
      return (
        <h4
          key={index}
          className="text-[15.5px] font-semibold text-zinc-900 dark:text-white pt-2 pb-0.5 tracking-tight"
        >
          {stripMarkers(line.replace(/^###\s+/, ""))}
        </h4>
      );
    }

    if (line.startsWith("## ")) {
      return (
        <h3
          key={index}
          className="text-base sm:text-[17px] font-semibold text-zinc-900 dark:text-white pt-2.5 pb-0.5 tracking-tight"
        >
          {stripMarkers(line.replace(/^##\s+/, ""))}
        </h3>
      );
    }

    if (line.startsWith("# ")) {
      return (
        <h2
          key={index}
          className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white pt-3 pb-1 tracking-tight"
        >
          {stripMarkers(line.replace(/^#\s+/, ""))}
        </h2>
      );
    }

    if (/^[-*]\s+/.test(line)) {
      return (
        <div key={index} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="text-zinc-400 dark:text-zinc-500 select-none text-base leading-relaxed shrink-0">•</span>
          <div className="flex-1 min-w-0">{stripMarkers(line.replace(/^[-*]\s+/, ""))}</div>
        </div>
      );
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      return (
        <div key={index} className="flex items-start gap-2 pl-1 my-1">
          <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400 select-none w-5 pt-0.5 shrink-0">
            {numMatch[1]}.
          </span>
          <div className="flex-1 min-w-0">{stripMarkers(numMatch[2])}</div>
        </div>
      );
    }

    if (line.startsWith("💡") || line.startsWith("📌") || line.startsWith("⚠️")) {
      return (
        <div
          key={index}
          className="my-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] backdrop-blur-md border border-zinc-200/70 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed shadow-sm"
        >
          {stripMarkers(line)}
        </div>
      );
    }

    return (
      <p key={index} className="leading-relaxed">
        {stripMarkers(line)}
      </p>
    );
  });
}

/**
 * `ref` diteruskan ke div akar agar LazyRichText dapat memakai
 * IntersectionObserver untuk menunda penggantian ke renderer KaTeX selama
 * pesan masih jauh di luar viewport.
 */
const PlainChatText = React.forwardRef<HTMLDivElement, PlainChatTextProps>(
  function PlainChatText({ content, className = "" }, ref) {
    const body = useMemo(
      () => (content ? buildBody(content) : null),
      [content]
    );

    if (!body) return null;

    return (
      <div
        ref={ref}
        className={`space-y-2.5 text-[15.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 break-words [overflow-wrap:anywhere] max-w-full ${className}`}
      >
        {body}
      </div>
    );
  }
);

export default React.memo(PlainChatText);

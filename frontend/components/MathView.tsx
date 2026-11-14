"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathViewProps {
  math: string;
  block?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Cache keluaran KaTeX (module-level, LRU sederhana berbatas 500 entri).
// Rumus yang sama sering dirender berkali-kali (langkah coretan, diagnosis,
// beberapa pesan) — renderToString() tidak perlu diulang untuk string yang
// identik, dan cache tidak boleh tumbuh tanpa batas.
// ---------------------------------------------------------------------------
const KATEX_CACHE_LIMIT = 500;
const mathHtmlCache = new Map<string, string>();

function renderMathHtml(source: string, block: boolean): string {
  const cacheKey = `${block ? "D" : "I"}:${source}`;
  const cached = mathHtmlCache.get(cacheKey);
  if (cached !== undefined) {
    // Sentuh entri agar tidak terbuang lebih dulu (LRU sederhana).
    mathHtmlCache.delete(cacheKey);
    mathHtmlCache.set(cacheKey, cached);
    return cached;
  }
  let html = "";
  try {
    html = katex.renderToString(source, {
      throwOnError: false,
      displayMode: block,
    });
  } catch {
    html = "";
  }

  if (mathHtmlCache.size >= KATEX_CACHE_LIMIT) {
    const oldestKey = mathHtmlCache.keys().next().value;
    if (oldestKey !== undefined) mathHtmlCache.delete(oldestKey);
  }
  mathHtmlCache.set(cacheKey, html);
  return html;
}

/**
 * `ref` diteruskan ke span akar agar LazyMathView bisa memakai
 * IntersectionObserver sebelum memuat/menjalankan KaTeX.
 */
const MathView = React.forwardRef<HTMLSpanElement, MathViewProps>(
  function MathView({ math, block = false, className = "" }, ref) {
    const html = useMemo(() => {
      if (!math || !math.trim()) return "";
      return renderMathHtml(math.trim(), block);
    }, [math, block]);

    if (!html) {
      return (
        <span ref={ref} className={`font-mono text-sm ${className}`}>
          {math}
        </span>
      );
    }

    return <span ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
);

export default React.memo(MathView);

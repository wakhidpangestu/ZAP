"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import PlainChatText from "./PlainChatText";

// Chunk RichChatText (termasuk KaTeX) hanya dimuat saat benar-benar ada
// pesan yang mengandung markdown/rumus. Halaman chat yang baru dibuka
// (belum ada pesan) tidak membayar biaya muat + parse chunk ini sama sekali.
const RichChatText = React.lazy(() => import("@/components/RichChatText"));

// Penanda yang membuat RichChatText memberi hasil berbeda dari teks polos:
// rumus $...$, tebal **...**, heading, daftar berpoin, dan daftar bernomor.
const RICH_PATTERN = /\$|\*\*|^\s{0,3}#{1,3}\s|^\s*[-*]\s|^\s*\d+\.\s/m;

// Utas panjang: jangan parse + render KaTeX untuk pesan yang masih jauh di
// luar viewport. Margin 800px di bawah/atas viewport membuat pesan yang hampir
// terlihat tetap langsung memakai renderer kaya (tidak ada kedipan).
const LAZY_ROOT_MARGIN = "800px 0px";

interface LazyRichTextProps {
  content: string;
  className?: string;
}

export default function LazyRichText({ content, className = "" }: LazyRichTextProps) {
  const isRich = useMemo(() => (content ? RICH_PATTERN.test(content) : false), [content]);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isRich || isNearViewport) return;
    const node = placeholderRef.current;
    // Tanpa IntersectionObserver (atau placeholder sudah hilang): langsung
    // tampilkan versi kaya agar perilaku tidak pernah “macet” sebagai teks polos.
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isRich, isNearViewport]);

  if (!content) return null;

  // Pesan teks biasa tampil seketika dari renderer polos, tanpa memuat
  // chunk KaTeX sama sekali.
  if (!isRich) {
    return <PlainChatText content={content} className={className} />;
  }

  // Pesan jauh dari viewport: tampilkan placeholder polos (metrik mirip
  // RichChatText) tanpa memuat/menjalankan KaTeX. Setelah masuk viewport,
  // renderer kaya menggantikannya.
  if (!isNearViewport) {
    return <PlainChatText ref={placeholderRef} content={content} className={className} />;
  }

  return (
    <Suspense fallback={<PlainChatText content={content} className={className} />}>
      <RichChatText content={content} className={className} />
    </Suspense>
  );
}

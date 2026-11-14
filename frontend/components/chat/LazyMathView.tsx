"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";

// MathView (KaTeX) dimuat lazy: langkah coretan dan baris diagnosis hanya
// muncul sesudah interaksi pengguna, jadi chunk KaTeX tidak perlu ikut
// dalam muatan awal halaman chat.
const MathView = React.lazy(() => import("@/components/MathView"));

// Rumus yang masih jauh di luar viewport (mis. utas panjang yang di-scroll)
// ditampilkan sebagai teks polos lebih dulu agar KaTeX tidak dijalankan untuk
// konten yang belum terlihat.
const LAZY_ROOT_MARGIN = "600px 0px";

interface LazyMathViewProps {
  math: string;
  block?: boolean;
  className?: string;
}

export default function LazyMathView({ math, block = false, className = "" }: LazyMathViewProps) {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const placeholderRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (isNearViewport) return;
    const node = placeholderRef.current;
    // Tanpa IntersectionObserver (atau placeholder sudah hilang): langsung
    // tampilkan KaTeX agar rumus tidak pernah tertinggal sebagai teks polos.
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
  }, [isNearViewport]);

  if (!isNearViewport) {
    return (
      <span ref={placeholderRef} className={`font-mono text-sm ${className}`}>
        {math}
      </span>
    );
  }

  return (
    <Suspense
      fallback={<span className={`font-mono text-sm ${className}`}>{math}</span>}
    >
      <MathView math={math} block={block} className={className} />
    </Suspense>
  );
}

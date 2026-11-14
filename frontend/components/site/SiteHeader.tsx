"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Menu, Search, X } from "lucide-react";

import { ZapLogo } from "@/components/ZapLogo";
import { AnimatedThemeToggler } from "@/components/site/AnimatedThemeToggler";
import { useTheme } from "@/utils/theme";

const NAV_LINKS = [
  { href: "/#produk", label: "Produk", section: "produk" },
  { href: "/#cara-kerja", label: "Cara kerja", section: "cara-kerja" },
  { href: "/#model", label: "Model", section: "model" },
  { href: "/docs", label: "Dokumentasi", section: null },
];

export type SiteHeaderSearchItem = { id: string; title: string };

export type SiteHeaderSearch = {
  items: SiteHeaderSearchItem[];
  onSelect: (id: string) => void;
  placeholder?: string;
};

/**
 * Pencarian bagian dokumentasi yang menempel di header (satu navbar saja).
 * Di desktop tampil sebagai tombol berisi ⌘K; saat dibuka muncul panel input
 * + hasil. Bisa juga dibuka lewat ⌘K / Ctrl+K, ditutup dengan Esc.
 */
function HeaderSearch({
  search,
  overHero,
  isDark,
}: {
  search: SiteHeaderSearch;
  overHero: boolean;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return search.items;
    return search.items.filter((item) => item.title.toLowerCase().includes(q));
  }, [query, search.items]);

  const pick = (id: string) => {
    setOpen(false);
    setQuery("");
    search.onSelect(id);
  };

  const tone = overHero
    ? "text-[#fff7ec] hover:bg-white/10"
    : isDark
      ? "text-[#f8eee2] hover:bg-white/[0.06]"
      : "text-[#43372d] hover:bg-[#1c120c]/[0.055]";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label="Cari bagian dokumentasi"
        aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-full px-2.5 transition-colors [transition-duration:420ms] ${tone}`}
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-[12px] font-medium xl:inline">Cari…</span>
        <kbd className="hidden rounded border border-current/20 px-1 py-0.5 font-mono text-[9px] opacity-60 xl:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-[0_30px_70px_-30px_rgba(28,18,12,0.5)] ${
            isDark ? "border-white/10 bg-[#17110c]" : "border-zinc-200/80 bg-[#fffaf3]"
          }`}
        >
          <div
            className={`flex items-center gap-2 border-b px-3 py-2.5 ${
              isDark ? "border-white/[0.07]" : "border-zinc-200/70"
            }`}
          >
            <Search className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={search.placeholder ?? "Cari bagian dokumentasi…"}
              aria-label="Cari bagian dokumentasi"
              className={`w-full bg-transparent text-[12.5px] outline-none ${
                isDark ? "text-zinc-100 placeholder:text-zinc-500" : "text-zinc-800 placeholder:text-zinc-400"
              }`}
            />
            <kbd
              className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] ${
                isDark ? "border-white/10 text-zinc-500" : "border-zinc-200 text-zinc-400"
              }`}
            >
              esc
            </kbd>
          </div>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <li className={`px-2.5 py-3 text-[12px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Tidak ada bagian yang cocok.
              </li>
            ) : (
              results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                      isDark
                        ? "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                        : "text-zinc-600 hover:bg-[#c4956a]/[0.1] hover:text-zinc-900"
                    }`}
                  >
                    {item.title}
                    <ArrowUpRight className="h-3 w-3 shrink-0 opacity-40" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ search }: { search?: SiteHeaderSearch }) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";
  const isDark = resolvedTheme === "dark";
  const compact = scrolled || open;
  const overHero = isHome && !compact;

  // Hysteresis: avoids the navbar flapping between states when the scroll
  // position sits right on the threshold (which reads as a broken, stuttering
  // animation). The updater returns the previous value when nothing changed,
  // so React bails out and no extra render happens while scrolling.
  useEffect(() => {
    const measure = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 6 : y > 24));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    return () => window.removeEventListener("scroll", measure);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goToSection = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, section: string | null) => {
      if (!section || pathname !== "/") return;
      const target = document.querySelector<HTMLElement>(`[data-scroll-anchor="${section}"]`);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setOpen(false);
    },
    [pathname, reduceMotion]
  );

  const idleTone = overHero
    ? "text-[#fff7ec]"
    : isDark
      ? "text-[#f8eee2]"
      : "text-[#1c120c]";
  const mutedTone = overHero
    ? "text-[#fff1df]/80 hover:bg-white/10 hover:text-white"
    : isDark
      ? "text-[#d6c2ae] hover:bg-white/[0.06] hover:text-white"
      : "text-[#43372d] hover:bg-[#1c120c]/[0.055] hover:text-[#1c120c]";

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto flex items-center justify-between gap-4 transition-[max-width,width,padding,margin-top,border-radius,background-color,box-shadow] [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          compact
            ? `mt-2.5 w-[calc(100%-1.5rem)] max-w-[1080px] rounded-[28px] pb-2 pl-3 pr-2 pt-2.5 shadow-[0_14px_44px_-28px_rgba(28,18,12,0.45)] ${
                isDark ? "bg-[#17110c]" : "bg-[#fffaf3]"
              }`
            : "mt-0 w-full max-w-[1240px] rounded-none bg-transparent px-4 py-4 sm:px-6"
        }`}
      >
        <Link
          href="/"
          aria-label="ChatZAP beranda"
          className={`group flex shrink-0 items-center gap-2.5 rounded-full pr-2 text-[15px] font-semibold tracking-tight transition-colors [transition-duration:420ms] ${idleTone}`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors [transition-duration:420ms] ${
              overHero
                ? "bg-[#fff7ec] text-[#2a0e0e]"
                : isDark
                  ? "bg-[#fff7ec] text-[#1c120c] group-hover:bg-[#ff9e4a]"
                  : "bg-[#1c120c] text-[#fff7ec] group-hover:bg-[#a02e1e]"
            }`}
          >
            <ZapLogo className="h-[17px] w-[17px]" />
          </span>
          <span>ChatZAP</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex" aria-label="Navigasi utama">
          {NAV_LINKS.map((item) => {
            const active = item.href === "/docs" && pathname.startsWith("/docs");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => goToSection(event, item.section)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors [transition-duration:420ms] ${
                  active
                    ? isDark || overHero
                      ? "bg-white/[0.1] text-white"
                      : "bg-[#1c120c]/[0.07] text-[#1c120c]"
                    : mutedTone
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {search ? <HeaderSearch search={search} overHero={overHero} isDark={isDark} /> : null}

          <AnimatedThemeToggler
            className={`[transition-duration:420ms] ${
              overHero
                ? "text-[#fff7ec] hover:bg-white/10"
                : isDark
                  ? "text-[#f8eee2] hover:bg-white/[0.06]"
                  : "text-[#43372d] hover:bg-[#1c120c]/[0.055]"
            }`}
          />

          <Link
            href="/chat"
            className={`group hidden h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold transition-all [transition-duration:420ms] sm:inline-flex ${
              overHero
                ? "bg-[#fff7ec] text-[#2a0e0e] hover:bg-[#ffd9a8]"
                : isDark
                  ? "bg-[#fff7ec] text-[#1c120c] hover:bg-[#ffd9a8]"
                  : "bg-[#1c120c] text-[#fff7ec] hover:bg-[#a02e1e]"
            }`}
          >
            Coba ZAP
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Tutup menu" : "Buka menu navigasi"}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors [transition-duration:420ms] md:hidden ${
              overHero
                ? "text-[#fff7ec] hover:bg-white/10"
                : isDark
                  ? "text-[#f8eee2] hover:bg-white/[0.06]"
                  : "text-[#1c120c] hover:bg-[#1c120c]/[0.055]"
            }`}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`mx-3 mt-1 overflow-hidden rounded-xl p-2 shadow-2xl md:hidden ${
              isDark ? "bg-[#17110c]" : "bg-[#fffaf3]"
            }`}
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => goToSection(event, item.section)}
                className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  isDark
                    ? "text-[#f3e6d6] hover:bg-white/[0.06]"
                    : "text-[#3b3029] hover:bg-[#f0e6d8]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/chat"
              className="mt-1 flex items-center justify-between rounded-lg bg-[#1c120c] px-3 py-3 text-sm font-semibold text-[#fff7ec] dark:bg-[#fff7ec] dark:text-[#1c120c]"
            >
              Buka ChatZAP
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default SiteHeader;

"use client";

import { useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const THEME_STORAGE_KEY = "zap_theme_v2";
const THEME_FALLBACK_CLASS = "zap-theme-fallback";
const THEME_FALLBACK_MS = 180;
const THEME_REVEAL_MS = 420;
const THEME_CROSSFADE_MS = 240;
const THEME_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike;
};

/** Transisi yang sedang berjalan; dipakai untuk mencegah animasi bertumpuk. */
let activeTransition: ViewTransitionLike | null = null;
let fallbackTimer: number | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Jalur cadangan untuk browser tanpa View Transitions API (mis. Firefox).
 *
 * Kelas `zap-theme-fallback` hanya hidup ~180 ms dan hanya menyentuh properti
 * cat ringan (background/border/color) alih-alih `box-shadow` + `fill`/`stroke`
 * di semua node, sehingga tetap jauh lebih murah daripada transisi universal.
 */
function runWithColorTransition(apply: () => void): void {
  const root = document.documentElement;
  root.classList.add(THEME_FALLBACK_CLASS);
  apply();
  if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
  fallbackTimer = window.setTimeout(() => {
    root.classList.remove(THEME_FALLBACK_CLASS);
    fallbackTimer = null;
  }, THEME_FALLBACK_MS);
}

/**
 * Mengganti tema memakai View Transitions: browser memotret tampilan lama dan
 * menganimasikan satu lapisan komposit di atasnya. Ini menggantikan animasi
 * per-elemen (ratusan node sekaligus) yang membuat pergantian tema tersendat.
 */
function runThemeChange(apply: () => void, originEl?: HTMLElement | null): void {
  if (typeof window === "undefined") {
    apply();
    return;
  }
  if (prefersReducedMotion()) {
    apply();
    return;
  }

  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition) {
    runWithColorTransition(apply);
    return;
  }
  // Klik beruntun: jangan menumpuk snapshots, langsung terapkan.
  if (activeTransition) {
    apply();
    return;
  }

  let origin: { x: number; y: number } | null = null;
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(() => {
      // flushSync wajib: snapshot "sesudah" harus sudah memakai tema baru.
      flushSync(apply);
    });
  } catch {
    apply();
    return;
  }

  activeTransition = transition;
  // Jaring aman: `finished` bisa tidak pernah selesai pada sebagian engine,
  // dan transisi yang menggantung akan mematikan animasi toggle berikutnya.
  const releaseTimer = window.setTimeout(() => {
    if (activeTransition === transition) activeTransition = null;
  }, THEME_REVEAL_MS + 600);
  transition.finished
    .catch(() => {})
    .then(() => {
      window.clearTimeout(releaseTimer);
      if (activeTransition === transition) activeTransition = null;
    });

  transition.ready
    .then(() => {
      const root = document.documentElement;
      if (origin) {
        const distance = Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y)
        );
        root.animate(
          {
            clipPath: [
              `circle(0px at ${origin.x}px ${origin.y}px)`,
              `circle(${distance}px at ${origin.x}px ${origin.y}px)`,
            ],
          },
          {
            duration: THEME_REVEAL_MS,
            easing: THEME_EASING,
            pseudoElement: "::view-transition-new(root)",
          }
        );
      } else {
        root.animate(
          { opacity: [0, 1] },
          {
            duration: THEME_CROSSFADE_MS,
            easing: "ease-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      }
    })
    .catch(() => {
      // Transisi dibatalkan (mis. navigasi): perubahan tema tetap berlaku.
    });
}

/**
 * Resolves system preference (defaults to light on SSR)
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Reads stored theme from localStorage safely (defaults to light mode)
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "dark" || saved === "light" || saved === "system") {
      return saved;
    }
  } catch (err) {
    console.warn("Gagal membaca tema dari localStorage:", err);
  }
  return "light";
}

/**
 * True hanya jika pengguna (atau sesi lain) sudah pernah memilih tema.
 * Membedakan "belum memilih" dari "memilih terang" mencegah tema default
 * menimpa preferensi sistem secara permanen pada kunjungan pertama.
 */
export function hasStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Applies the theme to the <html> document root element
 */
export function applyTheme(theme: ThemeMode, persist: boolean = true): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;

  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }

  try {
    if (persist) localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("zap_theme_change", { detail: { theme, resolved } }));
  } catch (err) {
    console.warn("Gagal menyimpan tema:", err);
  }

  return resolved;
}

/**
 * Hook to manage theme state across components (default: light)
 */export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const initial = getStoredTheme();
    setThemeState(initial);
    // Hanya tulis ke localStorage bila pengguna sudah pernah memilih tema.
    const resolved = applyTheme(initial, hasStoredTheme());
    setResolvedTheme(resolved);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const current = getStoredTheme();
      if (current === "system") {
        const nextResolved = applyTheme("system");
        setResolvedTheme(nextResolved);
      }
    };

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode; resolved: ResolvedTheme }>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail.theme);
        setResolvedTheme(customEvent.detail.resolved);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const next = e.newValue as ThemeMode;
        if (next === "dark" || next === "light" || next === "system") {
          setThemeState(next);
          const resolved = applyTheme(next);
          setResolvedTheme(resolved);
        }
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    window.addEventListener("zap_theme_change", handleThemeChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("zap_theme_change", handleThemeChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode, originEl?: HTMLElement | null) => {
    // Tema yang dipilih pengguna dianimasikan sekali lewat View Transition;
    // pemuatan awal tidak (lihat useEffect di atas).
    runThemeChange(() => {
      setThemeState(newTheme);
      const resolved = applyTheme(newTheme);
      setResolvedTheme(resolved);
    }, originEl);
  }, []);

  const toggleTheme = useCallback((originEl?: HTMLElement | null) => {
    const next: ThemeMode = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next, originEl);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
  };
}

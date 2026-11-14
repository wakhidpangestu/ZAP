"use client";

import React, { useCallback, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/utils/theme";

/**
 * Tombol tema dengan reveal radial dari tombolnya sendiri.
 *
 * Animasi reveal ditangani terpusat oleh `utils/theme` lewat View Transitions
 * (satu lapisan komposit), jadi komponen ini hanya meneruskan elemen asal dan
 * menganimasikan ikon di dalam tombol.
 */
export function AnimatedThemeToggler({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();
  const darkMode = resolvedTheme === "dark";

  const onToggle = useCallback(() => {
    setTheme(darkMode ? "light" : "dark", buttonRef.current);
  }, [darkMode, setTheme]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={darkMode ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      aria-pressed={darkMode}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9772f]/60 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {darkMode ? (
          <motion.span
            key="sun"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: 24 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.55, rotate: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center"
          >
            <Sun className="h-4 w-4" strokeWidth={1.8} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: -24 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.55, rotate: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center"
          >
            <Moon className="h-4 w-4" strokeWidth={1.8} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default AnimatedThemeToggler;

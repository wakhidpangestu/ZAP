"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";

type FaqCategory = "umum" | "keamanan" | "model" | "jenjang";

const CATEGORIES: Record<FaqCategory, string> = {
  umum: "Umum",
  keamanan: "Keamanan",
  model: "Model & mesin",
  jenjang: "Jenjang belajar",
};

const FAQ_DATA: Record<FaqCategory, { question: string; answer: string }[]> = {
  umum: [
    {
      question: "Apa bedanya ZAP dengan ChatGPT atau AI penjawab soal?",
      answer:
        "ZAP memisahkan kebenaran matematika dari bahasa. Pemeriksaan langkah dilakukan mesin simbolik deterministik SymPy CAS, sedangkan model bahasa hanya menyusun pertanyaan yang membimbing. Jawaban akhir tidak pernah diberikan.",
    },
    {
      question: "Apakah ZAP benar-benar tidak membocorkan jawaban?",
      answer:
        "Semua balasan melewati Zero-Answer Guardrail, termasuk bentuk LaTeX seperti $x = 4$. Saat ada kekeliruan, kamu menerima counter-example dan pertanyaan lanjutan, bukan solusi akhir.",
    },
    {
      question: "Bagaimana cara mulai mencoba ZAP?",
      answer:
        "Buka ChatZAP, tempelkan soal atau beberapa baris pengerjaanmu, lalu kirim. Kamu bisa mulai tanpa kartu kredit. Riwayat tersimpan di peramban dan dapat dicadangkan ke vault akun saat masuk.",
    },
    {
      question: "Apakah ZAP bisa dipakai di ponsel?",
      answer:
        "Ya. Antarmuka dirancang web-first dan responsif. Papan tulis, dialog Sokrates, serta verifikasi langkah dapat dipakai dari ponsel, tablet, maupun desktop.",
    },
  ],
  keamanan: [
    {
      question: "Apakah percakapan dan API key saya aman?",
      answer:
        "Vault dienkripsi di peramban dengan passphrase milikmu memakai AES-GCM 256 sebelum dikirim. Server tidak memiliki kunci untuk membukanya, termasuk kunci API provider yang ikut tersinkron antar perangkat.",
    },
    {
      question: "Data apa yang disimpan dan apakah bisa dihapus?",
      answer:
        "Riwayat belajar disimpan lokal di peramban, dengan cadangan vault akun di server bagi pengguna yang masuk. Kamu dapat menghapus data akun dan riwayat sesuai kontrol privasi yang tersedia.",
    },
  ],
  model: [
    {
      question: "Model AI apa saja yang bisa dipakai?",
      answer:
        "Gemini, OpenAI, Claude, Mistral, DeepSeek, NVIDIA NIM, Ollama lokal, atau endpoint OpenAI-compatible milikmu. Bisa juga tanpa kunci sama sekali memakai engine Sokratik lokal.",
    },
    {
      question: "Apa peran SymPy CAS dalam percakapan?",
      answer:
        "SymPy CAS adalah penilai kebenaran langkah: ekuivalensi aljabar, konservasi akar, dan counter-example numerik. Model bahasa tidak pernah memutuskan benar atau salahnya matematika.",
    },
  ],
  jenjang: [
    {
      question: "Jenjang dan mata pelajaran apa yang didukung?",
      answer:
        "Matematika TK hingga S3, ditambah pemrograman, fisika, dan kimia dengan verifikasi mesin untuk tiap domain. Kedalaman pertanyaan menyesuaikan jenjang yang dipilih.",
    },
    {
      question: "Apakah ZAP bisa membantu soal olimpiade?",
      answer:
        "Bisa, untuk latihan pembuktian dan dekomposisi langkah. Fokusnya tetap pada bimbingan heuristik dan verifikasi langkah, bukan menyerahkan solusi akhir.",
    },
  ],
};

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  const reduceMotion = useReducedMotion();
  const contentId = `faq-answer-${index}`;

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors duration-300 ${
        open
          ? "border-[#e6cbb1] bg-[#fffdf8] shadow-[0_18px_50px_-40px_rgba(42,14,14,0.65)] dark:border-[#4a3524] dark:bg-[#1c150f] dark:shadow-none"
          : "border-[#e9dfd2] bg-[#fbf7f0]/60 hover:border-[#ddc8b1] dark:border-[#2a2019] dark:bg-[#17110c]/70 dark:hover:border-[#4a3524]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
      >
        <span
          className={`text-[14px] font-semibold leading-snug transition-colors sm:text-[15px] ${
            open ? "text-[#1c120c] dark:text-[#f5e9dc]" : "text-[#4d4138] dark:text-[#d8c2ac]"
          }`}
        >
          {question}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
            open
              ? "border-[#d9772f] bg-[#d9772f] text-white"
              : "border-[#e3d6c6] bg-[#fffdf8] text-[#8d7968] dark:border-[#3a2c21] dark:bg-[#1c150f] dark:text-[#b7a28e]"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            key="answer"
            initial={
              reduceMotion
                ? false
                : { height: 0, opacity: 0, y: -6 }
            }
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={
              reduceMotion
                ? { height: 0, opacity: 0 }
                : { height: 0, opacity: 0, y: -6 }
            }
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 pr-12 text-[12.5px] leading-[1.75] text-[#6a5c50] dark:text-[#b7a28e] sm:px-6 sm:pb-6 sm:text-[13px]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [active, setActive] = useState<FaqCategory>("umum");
  const reduceMotion = useReducedMotion();
  const entries = Object.entries(CATEGORIES) as [FaqCategory, string][];

  return (
    <section id="faq" data-scroll-anchor="faq" className="relative scroll-mt-28 overflow-hidden px-4 py-24 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-16 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(240,122,30,0.12),transparent_68%)] blur-3xl"
      />
      <div className="relative mx-auto max-w-[860px]">
        <div className="text-center">
          <h2 className="text-balance text-[34px] font-black leading-[1.03] tracking-[-0.04em] text-[#1c120c] dark:text-[#f5e9dc] sm:text-5xl">
            Jawaban yang tidak
            <br />
            membocorkan jawaban.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-[#75675b] dark:text-[#b7a28e]">
            Hal-hal yang paling sering ditanyakan sebelum mulai belajar dengan ZAP.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {entries.map(([key, label]) => {
            const selected = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={`relative overflow-hidden rounded-full border px-4 py-2 text-[12px] font-semibold transition-colors duration-300 ${
                  selected
                    ? "border-[#1c120c] text-[#fff7ec] dark:border-[#f5e9dc] dark:text-[#1c120c]"
                    : "border-[#e3d6c6] bg-[#fbf7f0]/70 text-[#6a5c50] hover:border-[#cdb59e] hover:text-[#1c120c] dark:border-[#3a2c21] dark:bg-[#17110c] dark:text-[#b7a28e] dark:hover:text-[#f5e9dc]"
                }`}
                aria-pressed={selected}
              >
                <span className="relative z-10">{label}</span>
                {selected && (
                  <motion.span
                    layoutId="faq-active-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 z-0 bg-[#1c120c] dark:bg-[#f5e9dc]"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2.5"
            >
              {FAQ_DATA[active].map((item, index) => (
                <FaqItem key={item.question} {...item} index={index} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export default FaqSection;

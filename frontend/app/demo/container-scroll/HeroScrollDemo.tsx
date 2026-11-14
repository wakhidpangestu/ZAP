"use client";

import Image from "next/image";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";

/**
 * Demo pemakaian `ContainerScroll`.
 *
 * Gambar memakai Unsplash (bukan aset lokal) supaya kartu bisa langsung
 * ditukar dengan screenshot produk apa pun. `next.config.mjs` sudah
 * mengizinkan hostname `images.unsplash.com`.
 */
export function HeroScrollDemo() {
  return (
    <ContainerScroll
      titleComponent={
        <>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#d9772f] dark:text-[#e6a86a]">
            Papan tulis 3D &amp; CAS
          </p>
          <h1 className="text-3xl font-semibold text-black dark:text-white md:text-5xl">
            Setiap langkah diperiksa
            <br />
            <span className="mt-1 block text-4xl font-bold leading-none md:text-[6rem]">
              mesin simbolik
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 md:text-base">
            SymPy menilai kesetaraan aljabar, konservasi akar, dan membangun
            counter-example. Model bahasa hanya bertugas menyusun pertanyaan.
          </p>
        </>
      }
    >
      <Image
        src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1400&q=75"
        alt="Ilustrasi papan rangkaian sebagai placeholder demo scroll"
        height={720}
        width={1400}
        sizes="(max-width: 1024px) 100vw, 1024px"
        className="mx-auto rounded-2xl object-cover h-full object-left-top"
        draggable={false}
      />
    </ContainerScroll>
  );
}

export default HeroScrollDemo;

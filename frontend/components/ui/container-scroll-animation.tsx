"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  MotionValue,
  type UseScrollOptions,
} from "framer-motion";

/**
 * Container Scroll Animation
 *
 * Kartu mengecil, berputar (rotateX) dan naik saat halaman di-scroll. Rotasi
 * memakai `perspective` pada wrapper sehingga transformasi tetap di compositor.
 *
 * Bawaannya mengikuti gaya asli (kartu gelap bertinggi tetap). Bagian visual dan
 * rentang gerak bisa dituning lewat prop, sehingga komponen yang sama dipakai
 * juga pada hero landing yang butuh rotasi lebih kecil dan tanpa bingkai kartu.
 *
 * Motivasi `prefers-reduced-motion`: bila pengguna meminta gerak minimum,
 * kartu dirender datar tanpa rotate/scale/translate — bukan animasi cepat.
 */
export type ContainerScrollProps = {
  /** Opsional; bila kosong header tidak dirender sama sekali. */
  titleComponent?: string | React.ReactNode;
  children: React.ReactNode;
  /** Output rotateX (derajat). Default [20, 0]. */
  rotateRange?: [number, number];
  /** Output scale desktop. Default [1.05, 1]. */
  scaleRange?: [number, number];
  /** Output scale layar <=768px. Default [0.7, 0.9]. */
  mobileScaleRange?: [number, number];
  /** Output translateY header (px). Default [0, -100]. */
  translateRange?: [number, number];
  /** Jendela progres gulir; default framer-motion (["start start", "end end"]). */
  offset?: UseScrollOptions["offset"];
  /** Kelas tinggi pembungkus. Default "h-[60rem] md:h-[80rem]". */
  heightClassName?: string;
  /** Kelas padding pembungkus. Default "p-2 md:p-20". */
  paddingClassName?: string;
  /** Render bingkai kartu bawaan (border + latar gelap). Default true. */
  withFrame?: boolean;
  /** Kelas pengganti bingkai kartu saat `withFrame` aktif. */
  cardClassName?: string;
};

const DEFAULT_HEIGHT = "h-[60rem] md:h-[80rem]";
const DEFAULT_PADDING = "p-2 md:p-20";
const DEFAULT_CARD =
  "max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl";
const DEFAULT_CARD_CONTENT =
  "h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl md:p-4";

const DEFAULT_ROTATE: [number, number] = [20, 0];
const DEFAULT_SCALE: [number, number] = [1.05, 1];
const DEFAULT_MOBILE_SCALE: [number, number] = [0.7, 0.9];
const DEFAULT_TRANSLATE: [number, number] = [0, -100];
const FLAT: [number, number] = [0, 0];
const NO_SCALE: [number, number] = [1, 1];

export const ContainerScroll = ({
  titleComponent,
  children,
  rotateRange = DEFAULT_ROTATE,
  scaleRange = DEFAULT_SCALE,
  mobileScaleRange = DEFAULT_MOBILE_SCALE,
  translateRange = DEFAULT_TRANSLATE,
  offset,
  heightClassName = DEFAULT_HEIGHT,
  paddingClassName = DEFAULT_PADDING,
  withFrame = true,
  cardClassName,
}: ContainerScrollProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, ...(offset ? { offset } : {}) });
  const reduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const rotateOut = reduceMotion ? FLAT : rotateRange;
  const scaleOut = reduceMotion ? NO_SCALE : isMobile ? mobileScaleRange : scaleRange;
  const translateOut = reduceMotion ? FLAT : translateRange;

  const rotate = useTransform(scrollYProgress, [0, 1], rotateOut);
  const scale = useTransform(scrollYProgress, [0, 1], scaleOut);
  const translate = useTransform(scrollYProgress, [0, 1], translateOut);

  return (
    <div
      className={`${heightClassName} flex items-center justify-center relative ${paddingClassName}`}
      ref={containerRef}
    >
      <div
        className={`w-full relative ${withFrame ? "py-10 md:py-40" : ""}`}
        style={{ perspective: "1000px" }}
      >
        {titleComponent ? <Header translate={translate} titleComponent={titleComponent} /> : null}
        {withFrame ? (
          <Card rotate={rotate} scale={scale} className={cardClassName}>
            {children}
          </Card>
        ) : (
          <motion.div
            style={{ rotateX: rotate, scale }}
            className="w-full [backface-visibility:hidden] [transform:translateZ(0)] will-change-transform"
          >
            {children}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export type HeaderProps = {
  translate: MotionValue<number>;
  titleComponent: React.ReactNode;
};

export const Header = ({ translate, titleComponent }: HeaderProps) => {
  return (
    <motion.div style={{ translateY: translate }} className="div max-w-5xl mx-auto text-center">
      {titleComponent}
    </motion.div>
  );
};

export type CardProps = {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: React.ReactNode;
  className?: string;
};

const CARD_SHADOW =
  "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003";

export const Card = ({ rotate, scale, children, className }: CardProps) => {
  return (
    <motion.div
      style={{ rotateX: rotate, scale, boxShadow: CARD_SHADOW }}
      className={`[backface-visibility:hidden] [transform:translateZ(0)] will-change-transform ${className ?? DEFAULT_CARD}`}
    >
      <div className={DEFAULT_CARD_CONTENT}>{children}</div>
    </motion.div>
  );
};

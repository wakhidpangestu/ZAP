import type { Metadata } from "next";

import { HeroScrollDemo } from "./HeroScrollDemo";

export const metadata: Metadata = {
  title: "Container Scroll Animation",
  description:
    "Demo komponen ContainerScroll (radix/aceternity style) — kartu berputar dan mengecil mengikuti scroll.",
  robots: { index: false, follow: false },
};

export default function ContainerScrollDemoPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#faf9f6] pb-[40vh] pt-16 dark:bg-[#090a0f]">
      <HeroScrollDemo />
    </main>
  );
}

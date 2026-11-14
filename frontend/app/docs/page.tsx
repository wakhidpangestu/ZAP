import type { Metadata } from "next";
import DocsClient from "./DocsClient";

export const metadata: Metadata = {
  title: "Dokumentasi teknis ChatZAP: Zero-Answer Policy, CFL, harness, dan API",
  description:
    "Referensi teknis lengkap ChatZAP: arsitektur Next.js + FastAPI, mesin CFL SymPy, Zero-Answer Policy, memori episodik, basis pengetahuan multi-domain, vault zero-knowledge, referensi API, konfigurasi, dan batas keamanan.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Dokumentasi teknis ChatZAP",
    description:
      "Cara kerja ChatZAP dari guardrail sampai basis data: CFL SymPy, Zero-Answer Policy, agent harness, korpus terverifikasi, dan vault terenkripsi.",
    type: "article",
  },
};

export default function DocsPage() {
  return <DocsClient />;
}

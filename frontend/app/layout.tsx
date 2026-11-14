import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#090a0f" },
  ],
};

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://chatzap.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "ChatZAP - Zero Answer Policy | AI Math Canvas & Socratic Tutor",
    template: "%s | ChatZAP",
  },
  description:
    "Web-first 3D interactive math canvas with Zero-Answer Socratic scaffolding & deterministic SymPy CAS verification. Membimbing siswa menemukan langkah pembuktian aljabar mandiri tanpa membocorkan jawaban akhir.",
  applicationName: "ChatZAP",
  authors: [{ name: "Wakhid Pangestu", url: "https://github.com/wakhidpangestu" }],
  creator: "Wakhid Pangestu",
  publisher: "Logicodix",
  category: "education",
  keywords: [
    "ChatZAP",
    "Zero Answer Policy",
    "AI Matematika",
    "Socratic Math Tutor",
    "Geometri 3D Interaktif",
    "SymPy CAS",
    "Logicodix 2026",
    "Kalkulus AI",
    "Papan Tulis Matematika",
    "STEM Education AI",
    "Khan Academy Alternative",
    "Math AI Indonesia",
    "Anti-Cheating Homework AI",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "id-ID": "/",
      "en-US": "/?lang=en",
    },
  },
  openGraph: {
    title: "ChatZAP - Zero Answer Policy | AI Math Canvas & Socratic Tutor",
    description:
      "Web-first 3D interactive math canvas with Zero-Answer Socratic scaffolding (LOGICODIX 2026). Diverifikasi deterministik dengan SymPy CAS.",
    url: APP_URL,
    siteName: "ChatZAP",
    locale: "id_ID",
    alternateLocale: ["en_US"],
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ChatZAP - Zero Answer Policy AI Math Canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatZAP - Zero Answer Policy | AI Math Canvas & Socratic Tutor",
    description:
      "Interactive 3D Math Canvas with Zero-Answer Socratic Scaffolding. CAS Deterministic Proofs.",
    images: ["/og-image.png"],
    creator: "@chatzap_ai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "geo.region": "ID",
    "geo.placename": "Indonesia",
    "geo.position": "-6.2088;106.8456",
    ICBM: "-6.2088, 106.8456",
  },
};

const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["WebApplication", "EducationalApplication"],
      "@id": `${APP_URL}/#app`,
      name: "ChatZAP",
      alternateName: ["ZAP", "Zero Answer Policy Math AI"],
      url: APP_URL,
      applicationCategory: "EducationalApplication",
      operatingSystem: "All modern web browsers",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Platform AI Tutor Matematika Sokrates & Kanvas Geometri 3D Interaktif dengan Zero Answer Policy. Membimbing penalaran matematis siswa tanpa membocorkan jawaban akhir.",
      educationalLevel: ["Secondary Education", "Higher Education", "SMP", "SMA", "Universitas"],
      teaches: ["Algebra", "Calculus", "3D Spatial Geometry", "Trigonometry", "Linear Equations"],
      featureList: [
        "Deterministic SymPy Computer Algebra System (CAS)",
        "Zero Answer Policy Guardrail",
        "3D Spatial Mesh Visualization",
        "2D Dynamic Coordinate Plane",
        "LaTeX Formula Composer",
        "Multi-Agent Socratic Voice Engine",
      ],
      author: {
        "@type": "Person",
        name: "Wakhid Pangestu",
        url: "https://github.com/wakhidpangestu",
      },
      publisher: {
        "@type": "Organization",
        name: "Logicodix",
        url: "https://github.com/wakhidpangestu/ZAP",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${APP_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Apa itu Zero Answer Policy (ZAP)?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Zero Answer Policy (ZAP) adalah pendekatan pedagogis di mana AI menolak memberikan kunci jawaban akhir secara langsung kepada siswa. Sebaliknya, ZAP membimbing siswa langkah demi langkah menggunakan pertanyaan Sokrates empatik dan mendeteksi titik kesalahan konsep menggunakan SymPy CAS deterministik.",
          },
        },
        {
          "@type": "Question",
          name: "Bagaimana ZAP memvalidasi kebenaran aljabar dan geometri?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ZAP memisahkan kebenaran matematika deterministik dengan bahasa alami LLM. SymPy Computer Algebra System di backend bertindak sebagai penilai mutlak kesetaraan aljabar dan konservasi akar, sementara model bahasa (Gemini/Nemotron) hanya bertugas memformulasi pertanyaan panduan Sokrates.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="light" suppressHydrationWarning>
      <head>
        {/* Skrip GSI Google dimuat malas oleh GoogleAuthButton (saat interaksi, atau segera di halaman login)
            agar tidak membebani muatan awal setiap halaman. */}
        {/* GEO & Generative Engine Optimization Structured Knowledge Graph */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('zap_theme_v2') || 'light';
                  var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#faf9f6] dark:bg-[#090a0f] text-[#09090b] dark:text-zinc-100 min-h-screen transition-colors duration-150`}
      >
        {children}
      </body>
    </html>
  );
}

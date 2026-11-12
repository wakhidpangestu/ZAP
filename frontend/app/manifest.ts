import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChatZAP - Zero Answer Policy",
    short_name: "ChatZAP",
    description: "Web-First 3D Interactive Math Canvas with Zero-Answer Socratic Scaffolding & Deterministic SymPy CAS",
    start_url: "/chat",
    display: "standalone",
    background_color: "#080a0f",
    theme_color: "#f59e0b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

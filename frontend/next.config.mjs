/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com"
  : "script-src 'self' 'unsafe-inline' https://accounts.google.com";

const connectSrc = isDev
  ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
  : "connect-src 'self' https: http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:11434 http://localhost:11434";

const nextConfig = {
  output: "standalone",
  images: {
    // Dipakai demo `components/ui/container-scroll-animation` (foto Unsplash).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
  transpilePackages: ["katex", "react-katex", "three"],
  webpack: (config, { dev }) => {
    if (dev) {
      // Gunakan memory cache di mode dev pada Windows untuk mencegah
      // PackFileCacheStrategy ENOENT dan vendor-chunks module missing
      config.cache = {
        type: "memory",
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https:; ${connectSrc}; font-src 'self' data: https://fonts.gstatic.com; frame-src https://accounts.google.com`,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

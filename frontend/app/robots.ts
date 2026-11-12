import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chatzap.web.id";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/chat", "/login"],
        disallow: ["/api/", "/connector", "/c/"],
      },
      {
        userAgent: ["Googlebot", "Bingbot", "PerplexityBot", "ClaudeBot", "GPTBot"],
        allow: ["/", "/chat"],
        disallow: ["/api/", "/connector"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

"use client";

import { CinematicFooter } from "@/components/ui/motion-footer";

/**
 * Site-wide footer.
 *
 * Full-height cinematic closing band: diagonal marquee ribbon, aurora + grid
 * backdrop, giant outlined "ZAP" wordmark, centred CTA pills, then the credits
 * bar. Kept as a named export so the four pages that import it stay untouched.
 */
export function SiteFooter() {
  return <CinematicFooter />;
}

export default SiteFooter;

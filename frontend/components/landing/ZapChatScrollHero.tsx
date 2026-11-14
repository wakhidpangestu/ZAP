"use client";

import { PreviewFrame, ZapChatPreview } from "@/components/landing/ZapChatPreview";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

/**
 * Jendela ZAP di hero landing, dianimasikan mengikuti scroll lewat
 * `ContainerScroll`.
 *
 * Rentang gerak sengaja konservatif (rotateX 8° → 0°, scale 0.96 → 1) supaya
 * teks di dalam mock tetap tajam dan tidak terasa goyah, dan tidak ada bingkai
 * kartu tambahan karena `PreviewFrame` sudah memberi glow + lebar maksimum.
 */
export function ZapChatScrollHero() {
  return (
    <ContainerScroll
      withFrame={false}
      heightClassName="relative"
      paddingClassName="pt-2 pb-10 sm:pb-14"
      offset={["start 0.65", "start 0.2"]}
      rotateRange={[6, 0]}
      scaleRange={[0.97, 1]}
      mobileScaleRange={[0.98, 1]}
      translateRange={[0, 0]}
    >
      <PreviewFrame>
        <ZapChatPreview />
      </PreviewFrame>
    </ContainerScroll>
  );
}

export default ZapChatScrollHero;

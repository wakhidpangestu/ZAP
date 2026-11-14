import { describe, it, expect } from "vitest";
import { computeSolidMetrics } from "@/lib/solid-metrics";

describe("Solid & 2D Metrics Calculation (lib/solid-metrics)", () => {
  it("computes Balok 10x6x4 metrics and flags only final calculated values as answers", () => {
    const res = computeSolidMetrics({
      activeModel: "solids",
      solidKind: "balok",
      paramA: 10,
      paramB: 6,
      paramC: 4,
      unit: "cm",
    });

    expect(res.volume).toBe(240);
    expect(res.surface).toBe(248);

    const givenRow = res.rows.find((r) => r.label === "Ukuran");
    const surfaceRow = res.rows.find((r) => r.label === "Luas Permukaan");
    const volumeRow = res.rows.find((r) => r.label === "Volume");

    expect(givenRow?.isAnswer).toBeFalsy();
    expect(surfaceRow?.isAnswer).toBe(true);
    expect(volumeRow?.isAnswer).toBe(true);
  });

  it("computes Kubus 10cm metrics with slice row kept visible (non-answer)", () => {
    const res = computeSolidMetrics({
      activeModel: "solids",
      solidKind: "kubus",
      paramA: 10,
      unit: "cm",
      showSlicePlane: true,
      sliceProgress: 0.5,
    });

    expect(res.volume).toBe(1000);
    expect(res.surface).toBe(600);
    expect(res.rows.find((r) => r.label === "Panjang Sisi (s)")?.isAnswer).toBeFalsy();
    expect(res.rows.find((r) => r.label === "Irisan Bidang")?.value).toBe("50%");
    expect(res.rows.find((r) => r.label === "Volume")?.isAnswer).toBe(true);
  });

  it("computes 2D Jaring-Jaring Kubus and marks total net area as an answer", () => {
    const res = computeSolidMetrics({
      activeModel: "2d_shape",
      planeShapeKind: "jaring_kubus",
      paramA: 5,
      unit: "cm",
    });

    expect(res.surface).toBe(150);
    expect(res.rows.find((r) => r.label === "Panjang Rusuk (s)")?.isAnswer).toBeFalsy();
    expect(res.rows.find((r) => r.label === "Total Luas Jaring-Jaring")?.isAnswer).toBe(true);
  });
});

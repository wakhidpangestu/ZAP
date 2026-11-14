import { describe, it, expect } from "vitest";
import { detectSmartboardItem } from "@/lib/smartboard-detect";

describe("Smartboard Intent Detection (lib/smartboard-detect)", () => {
  it("detects Balok 10x6x4 3D request accurately", () => {
    const item = detectSmartboardItem("buatkan balok 10x6x4 dalam bentuk 3d");
    expect(item).not.toBeNull();
    expect(item?.model).toBe("solids");
    expect(item?.solidKind).toBe("balok");
    expect(item?.paramA).toBe(10);
    expect(item?.paramB).toBe(6);
    expect(item?.paramC).toBe(4);
  });

  it("detects 2D sine wave and 3D saddle surface starter prompts", () => {
    const sine = detectSmartboardItem(
      "Tampilkan grafik gelombang sinus y = 2 sin(x) di papan tulis 2D"
    );
    expect(sine?.model).toBe("2d_trig");
    expect(sine?.targetTab).toBe("2d");

    const saddle = detectSmartboardItem(
      "Tampilkan permukaan pelana kuda 3D z = x^2 - y^2"
    );
    expect(saddle?.model).toBe("saddle");
    expect(saddle?.targetTab).toBe("3d");
  });

  it("ignores casual greetings without visualization commands", () => {
    expect(detectSmartboardItem("Halo kak, selamat pagi!")).toBeNull();
    expect(detectSmartboardItem("Tolong cek langkah saya: x^2 = 5x -> x = 5")).toBeNull();
  });
});

import type { MathModelType, PlaneShapeKind, SolidKind } from "@/components/InteractiveCanvas3D";

export interface MetricRow {
  label: string;
  formula: string;
  value?: string;
  /** True untuk hasil perhitungan akhir (Luas, Volume, Keliling, Diagonal); disembunyikan pada mode Zero-Answer siswa. */
  isAnswer?: boolean;
}

export interface SolidMetricsInput {
  activeModel: MathModelType;
  planeShapeKind?: PlaneShapeKind;
  solidKind?: SolidKind;
  paramA?: number;
  paramB?: number;
  paramC?: number;
  unit?: string;
  showSlicePlane?: boolean;
  sliceProgress?: number;
}

export interface SolidMetricsResult {
  volume: number;
  surface: number;
  rows: MetricRow[];
}

export function formatMetricNumber(n: number): string {
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function computeSolidMetrics({
  activeModel,
  planeShapeKind,
  solidKind,
  paramA,
  paramB,
  paramC,
  unit,
  showSlicePlane = false,
  sliceProgress = 0,
}: SolidMetricsInput): SolidMetricsResult {
  const A = paramA || 10;
  const B = paramB || 6;
  const C = paramC || 4;
  const u = unit || "cm";
  const fmt = formatMetricNumber;

  if (activeModel === "2d_shape") {
    if (planeShapeKind === "jajar_genjang") {
      const a = paramA !== undefined ? paramA : 12;
      const t = paramB !== undefined ? paramB : 8;
      const s = paramC !== undefined ? paramC : 10;
      const luas = a * t;
      const keliling = 2 * (a + s);
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Panjang Alas (a)", formula: "a", value: `${fmt(a)} ${u}` },
          { label: "Tinggi Tegak (t)", formula: "t", value: `${fmt(t)} ${u}` },
          { label: "Sisi Miring (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Luas Jajar Genjang", formula: "L = a · t", value: `${fmt(luas)} ${u}²`, isAnswer: true },
          { label: "Keliling Jajar Genjang", formula: "K = 2(a + s)", value: `${fmt(keliling)} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "trapesium") {
      const a = paramA !== undefined ? paramA : 8;
      const b = paramB !== undefined ? paramB : 14;
      const t = paramC !== undefined ? paramC : 6;
      const luas = ((a + b) * t) / 2;
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Sisi Atas (a)", formula: "a", value: `${fmt(a)} ${u}` },
          { label: "Sisi Bawah (b)", formula: "b", value: `${fmt(b)} ${u}` },
          { label: "Tinggi (t)", formula: "t", value: `${fmt(t)} ${u}` },
          { label: "Luas Trapesium", formula: "L = ½(a + b)t", value: `${fmt(luas)} ${u}²`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "segitiga") {
      const a = paramA !== undefined ? paramA : 10;
      const t = paramB !== undefined ? paramB : 8;
      const luas = (a * t) / 2;
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Alas Segitiga (a)", formula: "a", value: `${fmt(a)} ${u}` },
          { label: "Tinggi Segitiga (t)", formula: "t", value: `${fmt(t)} ${u}` },
          { label: "Luas Segitiga", formula: "L = ½ a · t", value: `${fmt(luas)} ${u}²`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "persegi_panjang") {
      const p = paramA !== undefined ? paramA : 14;
      const l = paramB !== undefined ? paramB : 8;
      const luas = p * l;
      const keliling = 2 * (p + l);
      const diagonal = Math.sqrt(p * p + l * l);
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Panjang (p)", formula: "p", value: `${fmt(p)} ${u}` },
          { label: "Lebar (l)", formula: "l", value: `${fmt(l)} ${u}` },
          { label: "Luas Persegi Panjang", formula: "L = p · l", value: `${fmt(luas)} ${u}²`, isAnswer: true },
          { label: "Keliling Persegi Panjang", formula: "K = 2(p + l)", value: `${fmt(keliling)} ${u}`, isAnswer: true },
          { label: "Panjang Diagonal", formula: "d = √(p² + l²)", value: `${fmt(Number(diagonal.toFixed(2)))} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "persegi") {
      const s = paramA !== undefined ? paramA : 10;
      const luas = s * s;
      const keliling = 4 * s;
      const diagonal = s * Math.sqrt(2);
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Panjang Sisi (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Luas Persegi", formula: "L = s²", value: `${fmt(luas)} ${u}²`, isAnswer: true },
          { label: "Keliling Persegi", formula: "K = 4s", value: `${fmt(keliling)} ${u}`, isAnswer: true },
          { label: "Panjang Diagonal", formula: "d = s√2", value: `${fmt(Number(diagonal.toFixed(2)))} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "segilima" || planeShapeKind === "segienam" || planeShapeKind === "poligon") {
      const s = paramA !== undefined ? paramA : 10;
      const n = planeShapeKind === "segilima" ? 5 : planeShapeKind === "segienam" ? 6 : (paramC || 6);
      const luas = (n * s * s) / (4 * Math.tan(Math.PI / n));
      const keliling = n * s;
      const apotema = s / (2 * Math.tan(Math.PI / n));
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Panjang Sisi (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: `Luas ${n === 5 ? "Segilima" : n === 6 ? "Segienam" : `Segi-${n}`}`, formula: "L = n·s²/(4·tan(π/n))", value: `${fmt(luas)} ${u}²`, isAnswer: true },
          { label: "Keliling", formula: `K = ${n}s`, value: `${fmt(keliling)} ${u}`, isAnswer: true },
          { label: "Apotema", formula: "a = s/(2·tan(π/n))", value: `${fmt(apotema)} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "lingkaran") {
      const r = paramA !== undefined ? paramA : 7;
      const luas = Math.PI * r * r;
      const keliling = 2 * Math.PI * r;
      const diameter = 2 * r;
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Jari-jari (r)", formula: "r", value: `${fmt(r)} ${u}` },
          { label: "Diameter (d)", formula: "d = 2r", value: `${fmt(diameter)} ${u}`, isAnswer: true },
          { label: "Luas Lingkaran", formula: "L = πr²", value: `${fmt(Number(luas.toFixed(2)))} ${u}²`, isAnswer: true },
          { label: "Keliling Lingkaran", formula: "K = 2πr", value: `${fmt(Number(keliling.toFixed(2)))} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "belah_ketupat") {
      const d1 = paramA !== undefined ? paramA : 12;
      const d2 = paramB !== undefined ? paramB : 16;
      const s = Math.sqrt(Math.pow(d1 / 2, 2) + Math.pow(d2 / 2, 2));
      const luas = (d1 * d2) / 2;
      const keliling = 4 * s;
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Diagonal 1 (d₁)", formula: "d₁", value: `${fmt(d1)} ${u}` },
          { label: "Diagonal 2 (d₂)", formula: "d₂", value: `${fmt(d2)} ${u}` },
          { label: "Sisi Miring (s)", formula: "s = √((d₁/2)² + (d₂/2)²)", value: `${fmt(Number(s.toFixed(2)))} ${u}`, isAnswer: true },
          { label: "Luas Belah Ketupat", formula: "L = ½ d₁ · d₂", value: `${fmt(luas)} ${u}²`, isAnswer: true },
          { label: "Keliling Belah Ketupat", formula: "K = 4s", value: `${fmt(Number(keliling.toFixed(2)))} ${u}`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "layang_layang") {
      const d1 = paramA !== undefined ? paramA : 12;
      const d2 = paramB !== undefined ? paramB : 16;
      const luas = (d1 * d2) / 2;
      return {
        volume: 0,
        surface: luas,
        rows: [
          { label: "Diagonal Utama (d₁)", formula: "d₁", value: `${fmt(d1)} ${u}` },
          { label: "Diagonal Melintang (d₂)", formula: "d₂", value: `${fmt(d2)} ${u}` },
          { label: "Luas Layang-Layang", formula: "L = ½ d₁ · d₂", value: `${fmt(luas)} ${u}²`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "jaring_prisma") {
      const s = paramA !== undefined ? paramA : 8;
      const t = paramB !== undefined ? paramB : 10;
      const luasAlas = (Math.sqrt(3) / 4) * s * s;
      const luasSelimut = 3 * s * t;
      const totalNet = 2 * luasAlas + luasSelimut;
      return {
        volume: 0,
        surface: totalNet,
        rows: [
          { label: "Sisi Alas Segitiga (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Sisi Tegak (t)", formula: "t", value: `${fmt(t)} ${u}` },
          { label: "Luas 1 Alas Segitiga", formula: "La = (√3/4)s²", value: `${fmt(Number(luasAlas.toFixed(2)))} ${u}²`, isAnswer: true },
          { label: "Luas 3 Sisi Tegak", formula: "Ls = 3st", value: `${fmt(Number(luasSelimut.toFixed(2)))} ${u}²`, isAnswer: true },
          { label: "Total Luas Jaring-Jaring", formula: "L = 2La + Ls", value: `${fmt(Number(totalNet.toFixed(2)))} ${u}²`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "jaring_kubus") {
      const s = paramA !== undefined ? paramA : 10;
      const totalNet = 6 * s * s;
      return {
        volume: 0,
        surface: totalNet,
        rows: [
          { label: "Panjang Rusuk (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Luas 1 Bidang Persegi", formula: "L₁ = s²", value: `${fmt(s * s)} ${u}²`, isAnswer: true },
          { label: "Total Luas Jaring-Jaring", formula: "L = 6s²", value: `${fmt(totalNet)} ${u}²`, isAnswer: true },
        ],
      };
    } else if (planeShapeKind === "jaring_limas") {
      const s = paramA !== undefined ? paramA : 8;
      const t = paramB !== undefined ? paramB : 10;
      const ts = Math.sqrt((s / 2) ** 2 + t ** 2);
      const luasAlas = s * s;
      const luas4Segitiga = 2 * s * ts;
      const totalNet = luasAlas + luas4Segitiga;
      return {
        volume: 0,
        surface: totalNet,
        rows: [
          { label: "Sisi Alas Persegi (s)", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Limas (t)", formula: "t", value: `${fmt(t)} ${u}` },
          { label: "Tinggi Sisi Miring (ts)", formula: "ts = √((s/2)²+t²)", value: `${fmt(Number(ts.toFixed(2)))} ${u}`, isAnswer: true },
          { label: "Luas Alas Persegi", formula: "La = s²", value: `${fmt(luasAlas)} ${u}²`, isAnswer: true },
          { label: "Luas 4 Segitiga Selimut", formula: "Ls = 2·s·ts", value: `${fmt(Number(luas4Segitiga.toFixed(2)))} ${u}²`, isAnswer: true },
          { label: "Total Luas Jaring-Jaring", formula: "L = La + Ls", value: `${fmt(Number(totalNet.toFixed(2)))} ${u}²`, isAnswer: true },
        ],
      };
    }
  }

  if (activeModel === "cylinder") {
    const r = paramA !== undefined ? paramA : 7;
    const h = paramB !== undefined ? paramB : 12;
    const v = Math.PI * r * r * h;
    const ls = 2 * Math.PI * r * h;
    const lp = 2 * Math.PI * r * (r + h);
    return {
      volume: v,
      surface: lp,
      rows: [
        { label: "Jari-jari Alas (r)", formula: "r", value: `${fmt(r)} ${u}` },
        { label: "Tinggi Silinder (t)", formula: "t", value: `${fmt(h)} ${u}` },
        { label: "Luas Selimut", formula: "2πrt", value: `${fmt(ls)} ${u}²`, isAnswer: true },
        { label: "Luas Permukaan", formula: "2πr(r+t)", value: `${fmt(lp)} ${u}²`, isAnswer: true },
        { label: "Volume Tabung", formula: "V = πr²t", value: `${fmt(v)} ${u}³`, isAnswer: true },
      ],
    };
  }

  switch (solidKind) {
    case "kubus": {
      const v = A ** 3;
      const lp = 6 * A * A;
      const diagRuang = A * Math.sqrt(3);
      const rows: MetricRow[] = [
        { label: "Panjang Sisi (s)", formula: "s", value: `${fmt(A)} ${u}` },
        { label: "Luas Permukaan", formula: "L = 6s²", value: `${fmt(lp)} ${u}²`, isAnswer: true },
        { label: "Volume", formula: "V = s³", value: `${fmt(v)} ${u}³`, isAnswer: true },
        { label: "Diagonal Ruang", formula: "d = s√3", value: `${fmt(diagRuang)} ${u}`, isAnswer: true },
      ];
      if (showSlicePlane) {
        rows.push({
          label: "Irisan Bidang",
          formula: "Potongan",
          value: `${Math.round(sliceProgress * 100)}%`,
        });
      }
      return { volume: v, surface: lp, rows };
    }
    case "balok": {
      const v = A * B * C;
      const lp = 2 * (A * B + A * C + B * C);
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: "Ukuran", formula: "p × l × t", value: `${fmt(A)} × ${fmt(B)} × ${fmt(C)} ${u}` },
          { label: "Luas Permukaan", formula: "2(pl + pt + lt)", value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "V = p × l × t", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    case "bola": {
      const v = (4 / 3) * Math.PI * A ** 3;
      const lp = 4 * Math.PI * A * A;
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: "Jari-jari (r)", formula: "r", value: `${fmt(A)} ${u}` },
          { label: "Luas Permukaan", formula: "L = 4πr²", value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "V = 4/3 π r³", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    case "prisma": {
      const s = A;
      const h = B || Math.round(A * 1.25);
      const luasAlas = (Math.sqrt(3) / 4) * s * s;
      const kelilingAlas = 3 * s;
      const luasSelimut = kelilingAlas * h;
      const lp = 2 * luasAlas + luasSelimut;
      const v = luasAlas * h;
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: "Sisi Alas Segitiga", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Prisma", formula: "t", value: `${fmt(h)} ${u}` },
          { label: "Luas Alas", formula: "(√3/4)s²", value: `${fmt(luasAlas)} ${u}²`, isAnswer: true },
          { label: "Luas Permukaan", formula: "2·La + 3st", value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "La × t", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    case "prisma_segilima":
    case "prisma_segienam":
    case "prisma_poligon": {
      const s = A;
      const h = B || Math.round(A * 1.25);
      const n = solidKind === "prisma_segilima" ? 5 : solidKind === "prisma_segienam" ? 6 : (paramC || 6);
      const luasAlas = (n * s * s) / (4 * Math.tan(Math.PI / n));
      const kelilingAlas = n * s;
      const luasSelimut = kelilingAlas * h;
      const lp = 2 * luasAlas + luasSelimut;
      const v = luasAlas * h;
      const namaAlas = n === 5 ? "Segilima" : n === 6 ? "Segienam" : `Segi-${n}`;
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: `Sisi Alas ${namaAlas}`, formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Prisma", formula: "t", value: `${fmt(h)} ${u}` },
          { label: "Luas Alas", formula: "n·s²/(4·tan(π/n))", value: `${fmt(luasAlas)} ${u}²`, isAnswer: true },
          { label: "Luas Permukaan", formula: `2·La + ${n}st`, value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "La × t", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    case "limas": {
      const s = A;
      const h = B || Math.round(A * 1.25);
      const luasAlas = s * s;
      const tinggiSegitiga = Math.sqrt((s / 2) ** 2 + h ** 2);
      const luasSelimut = 4 * (0.5 * s * tinggiSegitiga);
      const lp = luasAlas + luasSelimut;
      const v = (1 / 3) * luasAlas * h;
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: "Sisi Alas Persegi", formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Limas", formula: "t", value: `${fmt(h)} ${u}` },
          { label: "Luas Permukaan", formula: "s² + 4·(½s·hs)", value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "⅓ · s² · t", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    case "limas_poligon": {
      const s = A;
      const h = B || Math.round(A * 1.25);
      const n = paramC || 6;
      const luasAlas = (n * s * s) / (4 * Math.tan(Math.PI / n));
      const apotema = s / (2 * Math.tan(Math.PI / n));
      const tinggiSegitiga = Math.sqrt(h ** 2 + apotema ** 2);
      const luasSelimut = (n * s * tinggiSegitiga) / 2;
      const lp = luasAlas + luasSelimut;
      const v = (1 / 3) * luasAlas * h;
      return {
        volume: v,
        surface: lp,
        rows: [
          { label: `Sisi Alas Segi-${n}`, formula: "s", value: `${fmt(s)} ${u}` },
          { label: "Tinggi Limas", formula: "t", value: `${fmt(h)} ${u}` },
          { label: "Luas Alas", formula: "n·s²/(4·tan(π/n))", value: `${fmt(luasAlas)} ${u}²`, isAnswer: true },
          { label: "Luas Permukaan", formula: "La + (n·s·ts)/2", value: `${fmt(lp)} ${u}²`, isAnswer: true },
          { label: "Volume", formula: "⅓ · La · t", value: `${fmt(v)} ${u}³`, isAnswer: true },
        ],
      };
    }
    default:
      return {
        volume: A * B,
        surface: 2 * (A + B),
        rows: [
          { label: "Parameter A", formula: "A", value: `${fmt(A)} ${u}` },
          { label: "Parameter B", formula: "B", value: `${fmt(B)} ${u}` },
        ],
      };
  }
}

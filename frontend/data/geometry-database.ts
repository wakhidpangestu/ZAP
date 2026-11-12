/**
 * ZAP Universal Geometry & Spatial Database (TypeScript Edition)
 * Comprehensive mathematical knowledge base for 2D shapes, 3D solids, 2D nets,
 * formulas, KaTeX/LaTeX formatting, and Smartboard specifications.
 */

export type DimensionIntent = "2D" | "3D" | "2D_NET";

export interface ShapeParameter {
  name: string;
  label: string;
  default: number;
  unit: string;
  min: number;
  max: number;
}

export interface FormulaSpec {
  formula?: string;
  katex: string;
  explanation: string;
}

export interface GeometricEntity {
  id: string;
  name_id: string;
  name_en: string;
  dimension: DimensionIntent;
  category?: string;
  aliases: string[];
  parameters: ShapeParameter[];
  properties?: Record<string, string | number | boolean>;
  formulas: Record<string, FormulaSpec>;
  smartboard: {
    targetTab: "2d" | "3d";
    model: "2d_shape" | "solids" | "cylinder" | "conic_slicer";
    solidKind?: "kubus" | "balok" | "bola" | "kerucut" | "prisma" | "prisma_segilima" | "prisma_segienam" | "limas";
    planeShapeKind?:
      | "jajar_genjang"
      | "trapesium"
      | "segitiga"
      | "belah_ketupat"
      | "layang_layang"
      | "persegi"
      | "persegi_panjang"
      | "lingkaran"
      | "jaring_prisma"
      | "jaring_kubus"
      | "jaring_limas"
      | "jaring_balok"
      | "jaring_tabung"
      | "segilima"
      | "segienam";
    label: string;
  };
  net_2d_counterpart?: string;
  parent_3d_id?: string;
}

export const GEOMETRY_DATABASE: {
  shapes_2d: GeometricEntity[];
  shapes_3d: GeometricEntity[];
  nets_2d: GeometricEntity[];
} = {
  shapes_2d: [
    {
      id: "persegi",
      name_id: "Persegi (Bujur Sangkar)",
      name_en: "Square",
      dimension: "2D",
      category: "Poligon Beraturan",
      aliases: ["persegi", "bujur sangkar", "square", "kotak 2d", "segi empat sama sisi"],
      parameters: [{ name: "s", label: "Panjang Sisi", default: 10, unit: "cm", min: 1, max: 50 }],
      formulas: {
        luas: { formula: "s^2", katex: "L = s^2", explanation: "Luas adalah hasil kali panjang sisi dengan dirinya sendiri." },
        keliling: { formula: "4*s", katex: "K = 4s", explanation: "Keliling adalah jumlah panjang keempat sisinya." },
        diagonal: { formula: "s*sqrt(2)", katex: "d = s\\sqrt{2}", explanation: "Panjang diagonal dihitung dari teorema Pythagoras." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "persegi",
        label: "Persegi 2D"
      }
    },
    {
      id: "persegi_panjang",
      name_id: "Persegi Panjang",
      name_en: "Rectangle",
      dimension: "2D",
      category: "Poligon Segi Empat",
      aliases: ["persegi panjang", "persegipanjang", "rectangle", "oblong"],
      parameters: [
        { name: "p", label: "Panjang", default: 14, unit: "cm", min: 1, max: 50 },
        { name: "l", label: "Lebar", default: 8, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "p*l", katex: "L = p \\times l", explanation: "Luas adalah perkalian panjang dengan lebar." },
        keliling: { formula: "2*(p+l)", katex: "K = 2(p + l)", explanation: "Keliling adalah dua kali jumlah panjang dan lebar." },
        diagonal: { formula: "sqrt(p^2 + l^2)", katex: "d = \\sqrt{p^2 + l^2}", explanation: "Panjang diagonal bidang dihitung melalui teorema Pythagoras." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "persegi_panjang",
        label: "Persegi Panjang 2D"
      }
    },
    {
      id: "segitiga",
      name_id: "Segitiga Sama Kaki & Siku-Siku",
      name_en: "Triangle",
      dimension: "2D",
      category: "Poligon Segitiga",
      aliases: ["segitiga", "triangle", "segitiga sama sisi", "segitiga sama kaki", "segitiga siku-siku"],
      parameters: [
        { name: "a", label: "Panjang Alas", default: 10, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Tegak", default: 8, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "0.5*a*t", katex: "L = \\frac{1}{2} \\times a \\times t", explanation: "Setengah perkalian alas dengan tinggi tegak." },
        keliling: { formula: "a + 2*s", katex: "K = a + 2\\sqrt{\\left(\\frac{a}{2}\\right)^2 + t^2}", explanation: "Jumlah ketiga sisi pada segitiga sama kaki." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "segitiga",
        label: "Segitiga 2D"
      }
    },
    {
      id: "lingkaran",
      name_id: "Lingkaran",
      name_en: "Circle",
      dimension: "2D",
      category: "Bangun Datar Sisi Lengkung",
      aliases: ["lingkaran", "circle", "bulat 2d", "cakram"],
      parameters: [
        { name: "r", label: "Jari-jari", default: 7, unit: "cm", min: 1, max: 50 },
        { name: "d", label: "Diameter", default: 14, unit: "cm", min: 2, max: 100 }
      ],
      formulas: {
        luas: { formula: "pi*r^2", katex: "L = \\pi r^2 = \\frac{1}{4}\\pi d^2", explanation: "Perkalian konstanta pi dengan kuadrat jari-jari." },
        keliling: { formula: "2*pi*r", katex: "K = 2\\pi r = \\pi d", explanation: "Panjang garis lengkung keliling penutup lingkaran." },
        diameter: { formula: "2*r", katex: "d = 2r", explanation: "Dua kali panjang jari-jari." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "lingkaran",
        label: "Lingkaran 2D"
      }
    },
    {
      id: "jajar_genjang",
      name_id: "Jajar Genjang",
      name_en: "Parallelogram",
      dimension: "2D",
      category: "Poligon Segi Empat",
      aliases: ["jajar genjang", "jajargenjang", "parallelogram"],
      parameters: [
        { name: "a", label: "Alas", default: 12, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Tegak", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "s", label: "Sisi Miring", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "a*t", katex: "L = a \\times t", explanation: "Perkalian panjang alas dengan tinggi tegak." },
        keliling: { formula: "2*(a+s)", katex: "K = 2(a + s)", explanation: "Dua kali jumlah panjang alas dan sisi miring." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jajar_genjang",
        label: "Jajar Genjang 2D"
      }
    },
    {
      id: "trapesium",
      name_id: "Trapesium",
      name_en: "Trapezoid",
      dimension: "2D",
      category: "Poligon Segi Empat",
      aliases: ["trapesium", "trapezoid", "trapesium sama kaki", "trapesium siku-siku"],
      parameters: [
        { name: "a", label: "Sisi Sejajar Atas", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "b", label: "Sisi Sejajar Bawah", default: 14, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi", default: 6, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "0.5*(a+b)*t", katex: "L = \\frac{a + b}{2} \\times t", explanation: "Rata-rata panjang sisi sejajar dikalikan tinggi tegak." },
        keliling: { formula: "a + b + 2*s", katex: "K = a + b + 2\\sqrt{\\left(\\frac{b-a}{2}\\right)^2 + t^2}", explanation: "Jumlah keempat sisi pada trapesium sama kaki." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "trapesium",
        label: "Trapesium 2D"
      }
    },
    {
      id: "belah_ketupat",
      name_id: "Belah Ketupat",
      name_en: "Rhombus",
      dimension: "2D",
      category: "Poligon Segi Empat",
      aliases: ["belah ketupat", "belahketupat", "rhombus", "diamond"],
      parameters: [
        { name: "d1", label: "Diagonal 1", default: 12, unit: "cm", min: 1, max: 50 },
        { name: "d2", label: "Diagonal 2", default: 16, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "0.5*d1*d2", katex: "L = \\frac{d_1 \\times d_2}{2}", explanation: "Setengah hasil kali panjang kedua diagonalnya." },
        sisi: { formula: "sqrt((d1/2)^2 + (d2/2)^2)", katex: "s = \\sqrt{\\left(\\frac{d_1}{2}\\right)^2 + \\left(\\frac{d_2}{2}\\right)^2}", explanation: "Panjang sisi miring dari 1/4 belah ketupat." },
        keliling: { formula: "4*s", katex: "K = 4s", explanation: "Empat kali panjang sisinya." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "belah_ketupat",
        label: "Belah Ketupat 2D"
      }
    },
    {
      id: "layang_layang",
      name_id: "Layang-Layang",
      name_en: "Kite",
      dimension: "2D",
      category: "Poligon Segi Empat",
      aliases: ["layang layang", "layang-layang", "layanglayang", "kite"],
      parameters: [
        { name: "d1", label: "Diagonal Utama", default: 12, unit: "cm", min: 1, max: 50 },
        { name: "d2", label: "Diagonal Melintang", default: 16, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas: { formula: "0.5*d1*d2", katex: "L = \\frac{d_1 \\times d_2}{2}", explanation: "Setengah hasil kali kedua diagonalnya." },
        keliling: { formula: "2*(a+b)", katex: "K = 2(a + b)", explanation: "Dua kali penjumlahan sepasang sisi pendek dan sisi panjang." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "layang_layang",
        label: "Layang-Layang 2D"
      }
    },
    {
      id: "segilima",
      name_id: "Segilima Beraturan (Pentagon)",
      name_en: "Regular Pentagon",
      dimension: "2D",
      category: "Poligon Beraturan",
      aliases: ["segilima", "segi lima", "segi-5", "pentagon", "pentagon beraturan"],
      parameters: [{ name: "s", label: "Panjang Sisi", default: 10, unit: "cm", min: 1, max: 50 }],
      formulas: {
        luas: { formula: "(sqrt(5*(5+2*sqrt(5)))/4)*s^2", katex: "L = \\frac{1}{4}\\sqrt{5(5+2\\sqrt{5})}\\,s^2", explanation: "Luas pentagon beraturan dari panjang sisinya." },
        keliling: { formula: "5*s", katex: "K = 5s", explanation: "Jumlah kelima sisi yang sama panjang." },
        apotema: { formula: "s/(2*tan(pi/5))", katex: "a = \\frac{s}{2\\tan 36^\\circ}", explanation: "Jarak pusat ke titik tengah sisi (apotema)." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "segilima",
        label: "Segilima 2D"
      }
    },
    {
      id: "segienam",
      name_id: "Segienam Beraturan (Heksagon)",
      name_en: "Regular Hexagon",
      dimension: "2D",
      category: "Poligon Beraturan",
      aliases: ["segienam", "segi enam", "segi-6", "hexagon", "heksagon", "hexagon beraturan"],
      parameters: [{ name: "s", label: "Panjang Sisi", default: 10, unit: "cm", min: 1, max: 50 }],
      formulas: {
        luas: { formula: "(3*sqrt(3)/2)*s^2", katex: "L = \\frac{3\\sqrt{3}}{2}s^2", explanation: "Enam kali luas segitiga sama sisi penyusun heksagon." },
        keliling: { formula: "6*s", katex: "K = 6s", explanation: "Jumlah keenam sisi yang sama panjang." },
        diagonal_panjang: { formula: "2*s", katex: "d = 2s", explanation: "Diagonal terpanjang heksagon sama dengan dua kali sisinya." }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "segienam",
        label: "Segienam 2D"
      }
    }
  ],
  shapes_3d: [
    {
      id: "kubus",
      name_id: "Kubus",
      name_en: "Cube",
      dimension: "3D",
      category: "Polihedron Sisi Datar Beraturan",
      aliases: ["kubus", "cube", "kotak 3d", "hexahedron"],
      parameters: [{ name: "s", label: "Panjang Rusuk", default: 10, unit: "cm", min: 1, max: 50 }],
      formulas: {
        volume: { formula: "s^3", katex: "V = s^3", explanation: "Pangkat tiga dari panjang rusuk." },
        luas_permukaan: { formula: "6*s^2", katex: "L = 6s^2", explanation: "Enam kali luas bidang perseginya." },
        diagonal_bidang: { formula: "s*sqrt(2)", katex: "d_b = s\\sqrt{2}", explanation: "Panjang diagonal sisi bidang." },
        diagonal_ruang: { formula: "s*sqrt(3)", katex: "d_r = s\\sqrt{3}", explanation: "Panjang diagonal ruang kubus." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "kubus",
        label: "Kubus 3D"
      },
      net_2d_counterpart: "jaring_kubus"
    },
    {
      id: "balok",
      name_id: "Balok",
      name_en: "Cuboid",
      dimension: "3D",
      category: "Polihedron Sisi Datar",
      aliases: ["balok", "cuboid", "rectangular prism", "beam", "persegi panjang 3d"],
      parameters: [
        { name: "p", label: "Panjang", default: 10, unit: "cm", min: 1, max: 50 },
        { name: "l", label: "Lebar", default: 6, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi", default: 4, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        volume: { formula: "p*l*t", katex: "V = p \\times l \\times t", explanation: "Hasil kali panjang, lebar, dan tinggi balok." },
        luas_permukaan: { formula: "2*(p*l + p*t + l*t)", katex: "L = 2(pl + pt + lt)", explanation: "Dua kali jumlah kombinasi ketiga pasang bidang." },
        diagonal_ruang: { formula: "sqrt(p^2 + l^2 + t^2)", katex: "d_r = \\sqrt{p^2 + l^2 + t^2}", explanation: "Panjang diagonal ruang balok 3D." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "balok",
        label: "Balok 3D"
      },
      net_2d_counterpart: "jaring_balok"
    },
    {
      id: "prisma",
      name_id: "Prisma Segitiga",
      name_en: "Triangular Prism",
      dimension: "3D",
      category: "Prisma Sisi Datar",
      aliases: ["prisma", "prism", "prisma segitiga", "triangular prism"],
      parameters: [
        { name: "s", label: "Sisi Alas Segitiga", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Prisma", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_alas: { formula: "(sqrt(3)/4)*s^2", katex: "L_a = \\frac{\\sqrt{3}}{4}s^2", explanation: "Luas segitiga sama sisi alas." },
        luas_selimut: { formula: "3*s*t", katex: "L_s = 3s \\cdot t", explanation: "Luas ketiga bidang tegak persegi panjang." },
        luas_permukaan: { formula: "2*L_a + 3*s*t", katex: "L = 2L_a + L_s = 2\\left(\\frac{\\sqrt{3}}{4}s^2\\right) + 3st", explanation: "Jumlah 2 bidang alas dan 3 bidang tegak." },
        volume: { formula: "L_a*t", katex: "V = L_a \\times t = \\frac{\\sqrt{3}}{4}s^2 t", explanation: "Perkalian luas alas dengan tinggi prisma." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "prisma",
        label: "Prisma Segitiga 3D"
      },
      net_2d_counterpart: "jaring_prisma"
    },
    {
      id: "prisma_segilima",
      name_id: "Prisma Segilima",
      name_en: "Pentagonal Prism",
      dimension: "3D",
      category: "Prisma Sisi Datar",
      aliases: ["prisma segilima", "prisma segi lima", "pentagonal prism", "prisma pentagon"],
      parameters: [
        { name: "s", label: "Sisi Alas Segilima", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Prisma", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_alas: { formula: "(sqrt(5*(5+2*sqrt(5)))/4)*s^2", katex: "L_a = \\frac{1}{4}\\sqrt{5(5+2\\sqrt{5})}\\,s^2", explanation: "Luas segilima beraturan alas." },
        luas_selimut: { formula: "5*s*t", katex: "L_s = 5s \\cdot t", explanation: "Luas kelima bidang tegak persegi panjang." },
        luas_permukaan: { formula: "2*L_a + 5*s*t", katex: "L = 2L_a + L_s", explanation: "Jumlah 2 bidang alas dan 5 bidang tegak." },
        volume: { formula: "L_a*t", katex: "V = L_a \\times t", explanation: "Perkalian luas alas dengan tinggi prisma." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "prisma_segilima",
        label: "Prisma Segilima 3D"
      }
    },
    {
      id: "prisma_segienam",
      name_id: "Prisma Segienam",
      name_en: "Hexagonal Prism",
      dimension: "3D",
      category: "Prisma Sisi Datar",
      aliases: ["prisma segienam", "prisma segi enam", "hexagonal prism", "prisma hexagon", "prisma heksagon"],
      parameters: [
        { name: "s", label: "Sisi Alas Segienam", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Prisma", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_alas: { formula: "(3*sqrt(3)/2)*s^2", katex: "L_a = \\frac{3\\sqrt{3}}{2}s^2", explanation: "Luas segienam beraturan alas (6 segitiga sama sisi)." },
        luas_selimut: { formula: "6*s*t", katex: "L_s = 6s \\cdot t", explanation: "Luas keenam bidang tegak persegi panjang." },
        luas_permukaan: { formula: "2*L_a + 6*s*t", katex: "L = 2L_a + L_s", explanation: "Jumlah 2 bidang alas dan 6 bidang tegak." },
        volume: { formula: "L_a*t", katex: "V = L_a \\times t", explanation: "Perkalian luas alas dengan tinggi prisma." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "prisma_segienam",
        label: "Prisma Segienam 3D"
      }
    },
    {
      id: "limas",
      name_id: "Limas Segi Empat (Piramida)",
      name_en: "Square Pyramid",
      dimension: "3D",
      category: "Polihedron Piramidal",
      aliases: ["limas", "piramida", "piramid", "pyramid", "limas segi empat"],
      parameters: [
        { name: "s", label: "Sisi Alas Persegi", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Limas", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_alas: { formula: "s^2", katex: "L_a = s^2", explanation: "Luas bidang alas persegi." },
        tinggi_sisi_tegak: { formula: "sqrt((s/2)^2 + t^2)", katex: "t_s = \\sqrt{\\left(\\frac{s}{2}\\right)^2 + t^2}", explanation: "Tinggi apotema sisi miring segitiga." },
        luas_selimut: { formula: "2*s*t_s", katex: "L_s = 2 s \\cdot t_s", explanation: "Jumlah luas keempat segitiga bidang tegak." },
        luas_permukaan: { formula: "s^2 + 2*s*t_s", katex: "L = s^2 + 2s\\sqrt{\\left(\\frac{s}{2}\\right)^2 + t^2}", explanation: "Luas alas persegi ditambah keempat segitiga tegak." },
        volume: { formula: "(1/3)*s^2*t", katex: "V = \\frac{1}{3} s^2 t", explanation: "Sepertiga kali luas alas dikali tinggi limas." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "limas",
        label: "Limas Segi Empat 3D (Piramida)"
      },
      net_2d_counterpart: "jaring_limas"
    },
    {
      id: "tabung",
      name_id: "Tabung (Silinder)",
      name_en: "Cylinder",
      dimension: "3D",
      category: "Bangun Ruang Sisi Lengkung",
      aliases: ["tabung", "silinder", "cylinder"],
      parameters: [
        { name: "r", label: "Jari-jari Alas", default: 7, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Silinder", default: 12, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_selimut: { formula: "2*pi*r*t", katex: "L_s = 2\\pi r t", explanation: "Luas selimut silinder lengkung." },
        luas_permukaan: { formula: "2*pi*r*(r + t)", katex: "L = 2\\pi r(r + t)", explanation: "Dua lingkaran alas dan tutup ditambah selimut silinder." },
        volume: { formula: "pi*r^2*t", katex: "V = \\pi r^2 t", explanation: "Luas lingkaran alas dikalikan tinggi tegak." }
      },
      smartboard: {
        targetTab: "3d",
        model: "cylinder",
        label: "Tabung Silinder 3D"
      },
      net_2d_counterpart: "jaring_tabung"
    },
    {
      id: "kerucut",
      name_id: "Kerucut",
      name_en: "Cone",
      dimension: "3D",
      category: "Bangun Ruang Sisi Lengkung",
      aliases: ["kerucut", "cone", "irisan kerucut"],
      parameters: [
        { name: "r", label: "Jari-jari Alas", default: 7, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Kerucut", default: 12, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        garis_pelukis: { formula: "sqrt(r^2 + t^2)", katex: "s = \\sqrt{r^2 + t^2}", explanation: "Panjang apotema garis miring kerucut." },
        luas_selimut: { formula: "pi*r*s", katex: "L_s = \\pi r s", explanation: "Luas bidang juring lengkung selimut." },
        luas_permukaan: { formula: "pi*r*(r + s)", katex: "L = \\pi r(r + s)", explanation: "Luas lingkaran alas ditambah luas selimut." },
        volume: { formula: "(1/3)*pi*r^2*t", katex: "V = \\frac{1}{3}\\pi r^2 t", explanation: "Sepertiga luas lingkaran alas dikali tinggi kerucut." }
      },
      smartboard: {
        targetTab: "3d",
        model: "conic_slicer",
        label: "Kerucut 3D"
      }
    },
    {
      id: "bola",
      name_id: "Bola",
      name_en: "Sphere",
      dimension: "3D",
      category: "Bangun Ruang Sisi Lengkung Simetris Penuh",
      aliases: ["bola", "sphere", "globe", "bulatan 3d"],
      parameters: [{ name: "r", label: "Jari-jari", default: 7, unit: "cm", min: 1, max: 50 }],
      formulas: {
        luas_permukaan: { formula: "4*pi*r^2", katex: "L = 4\\pi r^2", explanation: "Empat kali luas lingkaran khatulistiwa." },
        volume: { formula: "(4/3)*pi*r^3", katex: "V = \\frac{4}{3}\\pi r^3", explanation: "Empat per tiga pi dikali pangkat tiga jari-jari." }
      },
      smartboard: {
        targetTab: "3d",
        model: "solids",
        solidKind: "bola",
        label: "Bola 3D"
      }
    }
  ],
  nets_2d: [
    {
      id: "jaring_prisma",
      name_id: "Jaring-Jaring Prisma Segitiga (2D)",
      name_en: "Triangular Prism 2D Net",
      dimension: "2D_NET",
      parent_3d_id: "prisma",
      aliases: ["2d prisma", "jaring-jaring prisma", "jaring jaring prisma", "prisma 2d", "net prisma segitiga", "proyeksi prisma"],
      parameters: [
        { name: "s", label: "Sisi Segitiga Alas", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Sisi Tegak", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_jaring_jaring: {
          katex: "L_{\\text{jaring}} = 2L_{\\text{alas}} + 3(s \\times t) = 2\\left(\\frac{\\sqrt{3}}{4}s^2\\right) + 3st",
          explanation: "Total luas bentangan 2 segitiga dan 3 persegi panjang."
        }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jaring_prisma",
        label: "Jaring-Jaring Prisma Segitiga 2D"
      }
    },
    {
      id: "jaring_kubus",
      name_id: "Jaring-Jaring Kubus (2D)",
      name_en: "Cube 2D Net",
      dimension: "2D_NET",
      parent_3d_id: "kubus",
      aliases: ["2d kubus", "jaring-jaring kubus", "jaring jaring kubus", "kubus 2d", "net kubus"],
      parameters: [{ name: "s", label: "Panjang Rusuk", default: 10, unit: "cm", min: 1, max: 50 }],
      formulas: {
        luas_jaring_jaring: {
          katex: "L_{\\text{jaring}} = 6s^2",
          explanation: "Total luas bentangan keenam persegi kongruen."
        }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jaring_kubus",
        label: "Jaring-Jaring Kubus 2D"
      }
    },
    {
      id: "jaring_limas",
      name_id: "Jaring-Jaring Limas Segi Empat (Piramida 2D)",
      name_en: "Square Pyramid 2D Net",
      dimension: "2D_NET",
      parent_3d_id: "limas",
      aliases: ["2d limas", "2d piramida", "jaring-jaring limas", "jaring jaring limas", "jaring-jaring piramida", "piramida 2d"],
      parameters: [
        { name: "s", label: "Sisi Alas Persegi", default: 8, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Limas", default: 10, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_jaring_jaring: {
          katex: "L_{\\text{jaring}} = s^2 + 2s \\cdot t_s = s^2 + 2s\\sqrt{\\left(\\frac{s}{2}\\right)^2 + t^2}",
          explanation: "Luas persegi tengah ditambah luas 4 segitiga selimut."
        }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jaring_limas",
        label: "Jaring-Jaring Limas 2D (Piramida)"
      }
    },
    {
      id: "jaring_balok",
      name_id: "Jaring-Jaring Balok (2D)",
      name_en: "Cuboid 2D Net",
      dimension: "2D_NET",
      parent_3d_id: "balok",
      aliases: ["2d balok", "jaring-jaring balok", "jaring jaring balok", "balok 2d"],
      parameters: [
        { name: "p", label: "Panjang", default: 10, unit: "cm", min: 1, max: 50 },
        { name: "l", label: "Lebar", default: 6, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi", default: 4, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_jaring_jaring: {
          katex: "L_{\\text{jaring}} = 2(pl + pt + lt)",
          explanation: "Jumlah luas bentangan keenam persegi panjang."
        }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jaring_balok",
        label: "Jaring-Jaring Balok 2D"
      }
    },
    {
      id: "jaring_tabung",
      name_id: "Jaring-Jaring Tabung (2D)",
      name_en: "Cylinder 2D Net",
      dimension: "2D_NET",
      parent_3d_id: "tabung",
      aliases: ["2d tabung", "jaring-jaring tabung", "jaring jaring tabung", "tabung 2d"],
      parameters: [
        { name: "r", label: "Jari-jari Alas", default: 7, unit: "cm", min: 1, max: 50 },
        { name: "t", label: "Tinggi Tabung", default: 12, unit: "cm", min: 1, max: 50 }
      ],
      formulas: {
        luas_jaring_jaring: {
          katex: "L_{\\text{jaring}} = 2\\pi r^2 + 2\\pi r t",
          explanation: "Luas 2 lingkaran alas dan tutup ditambah selimut persegi panjang."
        }
      },
      smartboard: {
        targetTab: "2d",
        model: "2d_shape",
        planeShapeKind: "jaring_tabung",
        label: "Jaring-Jaring Tabung 2D"
      }
    }
  ]
};

export interface ResolvedGeometricResult {
  dimension: "2D" | "3D";
  targetTab: "2d" | "3d";
  entity: GeometricEntity;
  params: Record<string, number>;
  unit: string;
  reply: string;
  clarify?: boolean;
  clarifyKind?: "terminal" | "generic";
  smartboardItem?: {
    targetTab: "2d" | "3d";
    model: string;
    solidKind?: string;
    planeShapeKind?: string;
    label: string;
    desc: string;
    paramA: number;
    paramB?: number;
    paramC?: number;
    unit: string;
    hasSlice?: boolean;
  };
}

// ============================================================
// LAPIS EKSTRAKSI DATA GEOMETRI (pemrosesan pesan sebelum render)
// Pesan chat TIDAK langsung memunculkan smartboard: data diekstrak
// dulu (keluarga bangun, jumlah sisi poligon, parameter berlabel),
// divalidasi, baru diputuskan outputnya: render persis / klarifikasi.
// ============================================================
const WORD_NUMBERS: Record<string, number> = {
  tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8,
  sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12,
};

export function polyName(n: number): string {
  const names: Record<number, string> = {
    3: "Segitiga", 4: "Segiempat", 5: "Segilima", 6: "Segienam", 7: "Segitujuh",
    8: "Segidelapan", 9: "Segisembilan", 10: "Segisepuluh", 11: "Segisebelas", 12: "Segidua Belas",
  };
  return names[n] || `Segi-${n}`;
}

/** Ekstrak jumlah sisi poligon dari frasa "segi ..." / nama poligon. Mengabaikan "persegi". */
export function extractPolygonSides(lower: string): number | null {
  const digit = lower.match(/(?:^|[^a-z])segi[\s-]?(\d{1,3})\b/);
  if (digit) return parseInt(digit[1], 10);
  const word = lower.match(/(?:^|[^a-z])segi[\s-]?(dua belas|sebelas|sembilan|delapan|tujuh|sepuluh|empat|lima|enam|tiga)\b/);
  if (word) return WORD_NUMBERS[word[1]];
  const named: Array<[RegExp, number]> = [
    [/segitiga/, 3], [/segiempat/, 4], [/segilima/, 5], [/segienam/, 6],
    [/segitujuh/, 7], [/segidelapan/, 8], [/segisembilan/, 9], [/segisepuluh/, 10],
    [/\btriangle\b/, 3], [/\bpentagon\b/, 5], [/\bhexagon\b|\bheksagon\b/, 6],
    [/\bheptagon\b/, 7], [/\boctagon\b|\boktagon\b/, 8], [/\bnonagon\b/, 9],
    [/\bdecagon\b|\bdekagon\b/, 10],
  ];
  for (const [re, n] of named) if (re.test(lower)) return n;
  return null;
}

interface LabeledParams { s?: number; t?: number; r?: number; p?: number; l?: number }

function extractLabeledParams(lower: string): LabeledParams {
  const grab = (re: RegExp) => {
    const m = lower.match(re);
    return m ? parseFloat(m[1].replace(",", ".")) : undefined;
  };
  const out: LabeledParams = {};
  out.s = grab(/(?:sisi|rusuk)\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/) ?? grab(/\bs\s*=\s*(\d+(?:[.,]\d+)?)/);
  out.t = grab(/tinggi\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/) ?? grab(/\bt\s*=\s*(\d+(?:[.,]\d+)?)/);
  out.r = grab(/jari[\s-]?jari\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/);
  const d = grab(/diameter\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/);
  if (out.r === undefined && d !== undefined) out.r = d / 2;
  out.p = grab(/panjang\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/);
  out.l = grab(/lebar\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/);
  return out;
}

/** Angka bebas sesudah token dimensi, frasa segi-N, dan parameter berlabel dibuang. */
function positionalPool(lower: string): number[] {
  let cleaned = lower.replace(/\b[23][\s-]?d\b/g, " ");
  cleaned = cleaned.replace(/(?:^|[^a-z])segi[\s-]?\d{1,3}\b/g, " ");
  cleaned = cleaned.replace(/(sisi|rusuk|tinggi|jari[\s-]?jari|diameter|panjang|lebar)\s*(?:=|:)?\s*\d+(?:[.,]\d+)?/g, " ");
  return (cleaned.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(",", ".")));
}

function clarifyResult(reply: string, dimension: "2D" | "3D" = "3D", kind: "terminal" | "generic" = "terminal"): ResolvedGeometricResult {
  return {
    dimension,
    targetTab: dimension === "3D" ? "3d" : "2d",
    entity: GEOMETRY_DATABASE.shapes_2d[0],
    params: {},
    unit: "cm",
    reply,
    clarify: true,
    clarifyKind: kind,
  };
}

function limasPoligonResult(n: number, s: number, t: number, unit: string): ResolvedGeometricResult {
  const nama = polyName(n);
  return {
    dimension: "3D",
    targetTab: "3d",
    entity: GEOMETRY_DATABASE.shapes_3d.find((x) => x.id === "limas")!,
    params: { s, t, n },
    unit,
    reply: `Objek geometri 3D **Limas ${nama} (Piramida)** telah **AKTIF** dan ditampilkan di Papan Tulis Pintar 3D! \u{1F389}\n\nTerdeteksi dari pesanmu: keluarga **limas**, alas **${nama.toLowerCase()}** (${n} sisi), sisi alas $s = ${s}\\text{ ${unit}}$, tinggi $t = ${t}\\text{ ${unit}}$.\n\n### Parameter & Rumus Limas ${nama} ($s = ${s}\\text{ ${unit}},\\ t = ${t}\\text{ ${unit}}$):\n- **Rumus Luas Alas ($L_a$):** $$L_a = \\frac{${n} s^2}{4 \\tan(\\pi/${n})}$$\n- **Rumus Apotema Alas ($a_p$):** $$a_p = \\frac{s}{2 \\tan(\\pi/${n})}$$\n- **Rumus Tinggi Segitiga Selimut ($t_s$):** $$t_s = \\sqrt{t^2 + a_p^2}$$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = \\frac{${n} \\cdot s \\cdot t_s}{2}$$\n- **Rumus Luas Permukaan ($L$):** $$L = L_a + L_s$$\n- **Rumus Volume Ruang ($V$):** $$V = \\frac{1}{3} L_a \\cdot t$$\n\n\u{1F4A1} **Tantangan Eksplorasi 3D:** Putar model 3D di kanvas! Coba hitung volume limas ini dari luas alas dan tingginya.`,
    smartboardItem: {
      targetTab: "3d",
      model: "solids",
      solidKind: "limas_poligon",
      label: `Limas ${nama} 3D (${s}\u{00D7}${t} ${unit})`,
      desc: `Limas ${nama.toLowerCase()} beraturan alas ${s} ${unit}, tinggi ${t} ${unit}`,
      paramA: s,
      paramB: t,
      paramC: n,
      unit,
    },
  };
}

function prismaPoligonResult(n: number, s: number, t: number, unit: string): ResolvedGeometricResult {
  const nama = polyName(n);
  const kind = n === 5 ? "prisma_segilima" : n === 6 ? "prisma_segienam" : "prisma_poligon";
  const rumusLa = n === 6
    ? "L_a = \\frac{3\\sqrt{3}}{2}s^2"
    : n === 5
    ? "L_a = \\frac{1}{4}\\sqrt{5(5+2\\sqrt{5})}\\,s^2"
    : `L_a = \\frac{${n} s^2}{4 \\tan(\\pi/${n})}`;
  return {
    dimension: "3D",
    targetTab: "3d",
    entity: GEOMETRY_DATABASE.shapes_3d.find((x) => x.id === (n === 5 ? "prisma_segilima" : n === 6 ? "prisma_segienam" : "prisma")) || GEOMETRY_DATABASE.shapes_3d[0],
    params: { s, t, n },
    unit,
    reply: `Objek geometri 3D **Prisma ${nama}** telah **AKTIF** dan ditampilkan di Papan Tulis Pintar 3D! \u{1F389}\n\nTerdeteksi dari pesanmu: keluarga **prisma**, alas **${nama.toLowerCase()}** (${n} sisi), sisi alas $s = ${s}\\text{ ${unit}}$, tinggi $t = ${t}\\text{ ${unit}}$.\n\n### Parameter & Rumus Sifat Matematis Prisma ${nama} ($s = ${s}\\text{ ${unit}},\\ t = ${t}\\text{ ${unit}}$):\n- **Sisi Alas ${nama} Beraturan ($s$):** $${s}\\text{ ${unit}}$\n- **Tinggi Prisma ($t$):** $${t}\\text{ ${unit}}$\n- **Rumus Luas Alas ($L_a$):** $$${rumusLa}$$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = ${n}(s \\times t)$$\n- **Rumus Luas Permukaan Total ($L$):** $$L = 2L_a + L_s$$\n- **Rumus Volume Ruang ($V$):** $$V = L_a \\times t$$\n\n\u{1F4A1} **Tantangan Eksplorasi 3D:** Model 3D siap dieksplorasi di kanvas! Sekarang giliranmu: dengan dimensi di atas, berapakah volume atau luas permukaannya?`,
    smartboardItem: {
      targetTab: "3d",
      model: "solids",
      solidKind: kind,
      label: `Prisma ${nama} 3D (${s}\u{00D7}${t} ${unit})`,
      desc: `Prisma ${nama.toLowerCase()} geometri ruang alas ${s} ${unit}, tinggi ${t} ${unit}`,
      paramA: s,
      paramB: t,
      paramC: n,
      unit,
    },
  };
}

function poligon2DResult(n: number, s: number, unit: string): ResolvedGeometricResult {
  const nama = polyName(n);
  const kind = n === 5 ? "segilima" : n === 6 ? "segienam" : "poligon";
  const entity = GEOMETRY_DATABASE.shapes_2d.find((x) => x.id === (n === 5 ? "segilima" : "segienam")) || GEOMETRY_DATABASE.shapes_2d[0];
  return {
    dimension: "2D",
    targetTab: "2d",
    entity,
    params: { s, n },
    unit,
    reply: `Bangun datar **${nama} Beraturan (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! \u{1F4D0}\n\nTerdeteksi dari pesanmu: bangun datar **${nama.toLowerCase()}** (${n} sisi), sisi $s = ${s}\\text{ ${unit}}$.\n\n### Parameter & Rumus ($s = ${s}\\text{ ${unit}}$):\n- **Panjang Sisi ($s$):** $${s}\\text{ ${unit}}$\n- **Rumus Luas Bidang ($L$):** $$L = \\frac{${n} s^2}{4 \\tan(\\pi/${n})}$$\n- **Rumus Keliling ($K$):** $$K = ${n}s$$\n\n\u{1F4A1} **Tantangan Eksplorasi 2D:** Dengan panjang sisi $s = ${s}\\text{ ${unit}}$, coba hitung berapakah luas atau keliling bangun ini?`,
    smartboardItem: {
      targetTab: "2d",
      model: "2d_shape",
      planeShapeKind: kind,
      label: `${nama} 2D (s=${s})`,
      desc: `Bangun datar ${nama.toLowerCase()} beraturan dengan panjang sisi ${s} ${unit}`,
      paramA: s,
      paramC: n,
      unit,
    },
  };
}

// ============================================================
// SPESIFIKASI GEOMETRI TERSTRUKTUR (jembatan penalaran LLM -> mesin)
// LLM boleh MIKIR dan mengusulkan spec, tetapi yang memutuskan
// render adalah validator deterministik di sini. Spec yang tidak
// lolos validasi tidak pernah digambar dan tidak pernah dipelajari.
// ============================================================
export interface GeometrySpec {
  family: "prisma" | "limas" | "poligon" | "entity" | "none";
  sides?: number | null;
  entity_id?: string | null;
  params?: { s?: number | null; t?: number | null; r?: number | null; p?: number | null; l?: number | null };
  reason?: string;
}

const ENTITY_IDS = [
  "kubus", "balok", "tabung", "bola", "kerucut",
  "persegi", "persegi_panjang", "lingkaran", "segitiga",
  "jajar_genjang", "trapesium", "belah_ketupat", "layang_layang",
];

export function validateGeometrySpec(spec: GeometrySpec | null | undefined): string | null {
  if (!spec || typeof spec !== "object") return "spec kosong";
  if (spec.family === "none") return "bangun tidak didukung";
  if (spec.family === "prisma" || spec.family === "limas" || spec.family === "poligon") {
    const n = spec.sides;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 3 || n > 12) {
      return "jumlah sisi harus bilangan bulat 3 sampai 12";
    }
  } else if (spec.family === "entity") {
    if (!spec.entity_id || !ENTITY_IDS.includes(spec.entity_id)) return "entity_id tidak dikenal";
  } else {
    return "family tidak dikenal";
  }
  const params = spec.params || {};
  for (const key of ["s", "t", "r", "p", "l"] as const) {
    const v = params[key];
    if (v !== undefined && v !== null && (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 100000)) {
      return `parameter ${key} di luar rentang wajar`;
    }
  }
  return null;
}

function limasSegiEmpatSpecResult(s: number, t: number, unit: string): ResolvedGeometricResult {
  return {
    dimension: "3D",
    targetTab: "3d",
    entity: GEOMETRY_DATABASE.shapes_3d.find((x) => x.id === "limas")!,
    params: { s, t },
    unit,
    reply: `Objek geometri 3D **Limas Segi Empat (Piramida)** telah **AKTIF** di Papan Tulis Pintar 3D! \u{1F389}\n\n### Parameter & Rumus Limas / Piramida ($s = ${s}\\text{ ${unit}},\\ t = ${t}\\text{ ${unit}}$):\n- **Panjang Rusuk Alas Persegi ($s$):** $${s}\\text{ ${unit}}$\n- **Tinggi Tegak Limas ($t$):** $${t}\\text{ ${unit}}$\n- **Rumus Tinggi Apotema ($t_s$):** $$t_s = \\sqrt{(s/2)^2 + t^2}$$\n- **Rumus Luas Alas ($L_a$):** $$L_a = s^2$$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = 2 s \\cdot t_s$$\n- **Rumus Volume Ruang ($V$):** $$V = \\frac{1}{3}s^2 t$$\n\n\u{1F4A1} **Tantangan Eksplorasi 3D:** Putar model 3D di kanvas! Dapatkah kamu menghitung volume limas ini menggunakan rumus di atas?`,
    smartboardItem: {
      targetTab: "3d",
      model: "solids",
      solidKind: "limas",
      label: "Limas Segi Empat 3D (Piramida)",
      desc: `Limas segi empat beraturan (piramida) alas ${s} ${unit}, tinggi ${t} ${unit}`,
      paramA: s,
      paramB: t,
      unit,
    },
  };
}

export function buildResultFromSpec(spec: GeometrySpec, unit: string = "cm"): ResolvedGeometricResult | null {
  if (validateGeometrySpec(spec) !== null) return null;
  const prm = spec.params || {};
  if (spec.family === "prisma") {
    return prismaPoligonResult(spec.sides!, prm.s ?? 8, prm.t ?? 10, unit);
  }
  if (spec.family === "limas") {
    if (spec.sides === 4) return limasSegiEmpatSpecResult(prm.s ?? 8, prm.t ?? 10, unit);
    return limasPoligonResult(spec.sides!, prm.s ?? 8, prm.t ?? 10, unit);
  }
  if (spec.family === "poligon") {
    return poligon2DResult(spec.sides!, prm.s ?? 10, unit);
  }
  if (spec.family === "entity") {
    const all = [...GEOMETRY_DATABASE.shapes_3d, ...GEOMETRY_DATABASE.shapes_2d];
    const entity = all.find((e) => e.id === spec.entity_id);
    if (!entity) return null;
    const d0 = entity.parameters[0]?.default ?? 10;
    const d1 = entity.parameters[1]?.default;
    const d2 = entity.parameters[2]?.default;
    let paramA = prm.s ?? prm.r ?? prm.p ?? d0;
    let paramB = prm.t ?? prm.l ?? d1;
    let paramC = d2;
    if (entity.id === "balok") {
      paramA = prm.p ?? d0;
      paramB = prm.l ?? d1;
      paramC = prm.t ?? d2;
    }
    if (entity.id === "tabung" || entity.id === "kerucut") {
      paramA = prm.r ?? d0;
      paramB = prm.t ?? d1;
    }
    const formulaLines = Object.values(entity.formulas || {})
      .map((f) => `- **${f.explanation}:** $$${f.katex}$$`)
      .join("\n");
    return {
      dimension: entity.smartboard.targetTab === "3d" ? "3D" : "2D",
      targetTab: entity.smartboard.targetTab,
      entity,
      params: { a: paramA, b: paramB ?? 0, c: paramC ?? 0 },
      unit,
      reply: `Objek geometri **${entity.name_id}** telah **AKTIF** dan ditampilkan di Papan Tulis Pintar! \u{1F389}\n\n### Rumus ${entity.name_id}:\n${formulaLines}\n\n\u{1F4A1} **Tantangan Eksplorasi:** Model siap dieksplorasi di kanvas! Coba hitung luas atau volumenya dari parameter yang tampil di panel.`,
      smartboardItem: {
        targetTab: entity.smartboard.targetTab,
        model: entity.smartboard.model,
        solidKind: entity.smartboard.solidKind,
        planeShapeKind: entity.smartboard.planeShapeKind,
        label: entity.smartboard.label,
        desc: `${entity.name_id} dari penalaran terstruktur (spec tervalidasi)`,
        paramA,
        paramB,
        paramC,
        unit,
      },
    };
  }
  return null;
}

/** Gerbang murah: apakah pesan ini pantas masuk jalur penalaran geometri LLM? */
export function looksLikeGeometryRequest(lower: string): boolean {
  const hasVisualCommand = /\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|lukiskan|visualisasikan|render|modelkan|buka|show|draw|create|generate)\b/i.test(lower);
  if (!hasVisualCommand) return false;
  return /\b(2d|3d|dua dimensi|tiga dimensi|bangun|bentuk|solid|objek|geometri|papan|kanvas|smartboard|menara|donat|frustum|bola|tabung|kerucut|kubus|balok|limas|piramida|prisma|segi|datar|ruang)\b/i.test(lower);
}

/**
 * Intelligent Token-Based Geometric Intent Resolver
 * Determines explicitly whether the user asks for 2D vs 3D based on lexical tokens:
 * - "2d prisma" -> 2D panel, Jaring-Jaring Prisma Segitiga (NOT 3D)!
 * - "3d prisma" -> 3D panel, Prisma Segitiga 3D Three.js mesh.
 * - "3d piramida" -> 3D panel, Limas Segi Empat (Piramida) 3D.
 * - "2d lingkaran" -> 2D panel, Lingkaran 2D.
 */
export function resolveGeometricIntent(
  query: string,
  history?: Array<{ rawText?: string; replyText?: string; role?: string; content?: string }>
): ResolvedGeometricResult | null {
  const lower = query.toLowerCase().trim();
  if (!lower) return null;

  // 1. Deteksi Token Dimensi Eksplisit
  const has2DToken = /\b(2d|2-d|dua dimensi|bangun datar|bidang datar|jaring-jaring|jaring jaring|net|alas|penampang|proyeksi)\b/i.test(lower);
  const has3DToken = /\b(3d|3-d|tiga dimensi|bangun ruang|ruang|solid|volume|irisan|penampang 3d)\b/i.test(lower);

  // Kata kerja visualisasi
  const hasVisualCommand = /\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|lukis|lukiskan|visualisasikan|render|modelkan|lihat|buka|simulasikan|create|generate|show|plot|sketsa)\b/i.test(lower);

  // Ambil parameter angka dari teks
  const nums = (lower.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
  const parsedUnit = (lower.match(/\b(cm|m|mm|in)\b/i) || [])[1] || "cm";
  // Lapisan ekstraksi: jumlah sisi poligon, parameter berlabel, sisa angka posisional
  const sides = extractPolygonSides(lower);
  const labeled = extractLabeledParams(lower);
  const pool = positionalPool(lower);
  const polyS = labeled.s ?? pool[0] ?? 8;
  const polyT = labeled.t ?? pool[1] ?? 10;

  // 2. KASUS A: PENGGUNA MEMINTA BENTUK 2D (ATAU JARING-JARING DARI BANGUN RUANG)
  if (has2DToken) {
    // A.1 Cek apakah meminta jaring-jaring / representasi 2D dari bangun ruang
    if (lower.includes("prisma") || lower.includes("prism")) {
      const entity = GEOMETRY_DATABASE.nets_2d.find((n) => n.id === "jaring_prisma")!;
      const s = nums[0] || 8;
      const t = nums[1] || 10;

      return {
        dimension: "2D",
        targetTab: "2d",
        entity,
        params: { s, t },
        unit: parsedUnit,
        reply: `Representasi **2D Jaring-Jaring Prisma Segitiga** telah **AKTIF** di Papan Tulis Interaktif 2D di panel kanan layar! 📐\n\n### Komponen & Rumus Jaring-Jaring Prisma Segitiga ($s = ${s}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$):\n\n- **Bentuk Bentangan 2D:** 2 segitiga sama sisi (alas & tutup) dan 3 persegi panjang (sisi tegak).\n- **Rumus Luas 1 Alas Segitiga ($L_a$):** $$L_a = \\frac{\\sqrt{3}}{4}s^2$$\n- **Rumus Luas 3 Sisi Tegak ($L_s$):** $$L_s = 3(s \\times t)$$\n- **Rumus Luas Total Jaring-Jaring ($L_{\\text{jaring}}$):** $$L_{\\text{jaring}} = 2L_a + L_s$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan $s = ${s}\\text{ ${parsedUnit}}$ dan $t = ${t}\\text{ ${parsedUnit}}$, coba hitung berapakah luas total bentangan jaring-jaringnya?`,
        smartboardItem: {
          targetTab: "2d",
          model: "2d_shape",
          planeShapeKind: "jaring_prisma",
          label: `Jaring-Jaring Prisma Segitiga 2D (s=${s}, t=${t})`,
          desc: `Bentangan 2D prisma segitiga: 2 bidang alas segitiga dan 3 bidang tegak persegi panjang`,
          paramA: s,
          paramB: t,
          unit: parsedUnit,
        },
      };
    }

    if (lower.includes("kubus") || lower.includes("cube")) {
      const entity = GEOMETRY_DATABASE.nets_2d.find((n) => n.id === "jaring_kubus")!;
      const s = nums[0] || 10;
      return {
        dimension: "2D",
        targetTab: "2d",
        entity,
        params: { s },
        unit: parsedUnit,
        reply: `Representasi **2D Jaring-Jaring Kubus** telah **AKTIF** di Papan Tulis Interaktif 2D di panel sebelah kanan! 📐\n\n### Sifat Bentangan Jaring-Jaring Kubus ($s = ${s}\\text{ ${parsedUnit}}$):\n- **Komponen 2D:** 6 buah bujur sangkar (persegi) kongruen tersusun dalam pola salib (T-cross).\n- **Rumus Luas 1 Persegi ($L_1$):** $$L_1 = s^2$$\n- **Rumus Luas Total Jaring-Jaring ($L_{\\text{jaring}}$):** $$L_{\\text{jaring}} = 6s^2$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan panjang sisi $s = ${s}\\text{ ${parsedUnit}}$, coba substitusikan ke rumus $6s^2$: berapakah luas total yang kamu dapatkan?`,
        smartboardItem: {
          targetTab: "2d",
          model: "2d_shape",
          planeShapeKind: "jaring_kubus",
          label: `Jaring-Jaring Kubus 2D (s=${s})`,
          desc: `Bentangan salib 6 persegi kongruen kubus 2D`,
          paramA: s,
          unit: parsedUnit,
        },
      };
    }

    if (lower.includes("limas") || lower.includes("piramida") || lower.includes("piramid") || lower.includes("pyramid")) {
      if (sides !== null && sides !== 4) {
        return clarifyResult(`Jaring-jaring 2D untuk **Limas ${polyName(sides)}** belum tersedia, jadi papan tidak saya buka dengan bangun yang salah.\n\nYang bisa saya tampilkan sekarang: versi 3D-nya. Coba ketik: \`buatin limas ${polyName(sides).toLowerCase()} 3d\``, "2D");
      }
      const entity = GEOMETRY_DATABASE.nets_2d.find((n) => n.id === "jaring_limas")!;
      const s = nums[0] || 8;
      const t = nums[1] || 10;
      return {
        dimension: "2D",
        targetTab: "2d",
        entity,
        params: { s, t },
        unit: parsedUnit,
        reply: `Representasi **2D Jaring-Jaring Limas Segi Empat (Piramida)** telah **AKTIF** di Papan Tulis 2D! 📐\n\n### Parameter & Komponen Jaring-Jaring ($s = ${s}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$):\n- **Bentuk Bentangan 2D:** 1 persegi alas di tengah, dikelilingi oleh 4 segitiga sama kaki sebagai selimut.\n- **Rumus Luas Alas Persegi ($L_a$):** $$L_a = s^2$$\n- **Rumus Tinggi Apotema Segitiga ($t_s$):** $$t_s = \\sqrt{(s/2)^2 + t^2}$$\n- **Rumus Luas Total Jaring-Jaring ($L_{\\text{jaring}}$):** $$L_{\\text{jaring}} = s^2 + 2s \\cdot t_s$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan $s = ${s}\\text{ ${parsedUnit}}$ dan $t = ${t}\\text{ ${parsedUnit}}$, coba hitung luas alas atau tinggi apotemanya!`,
        smartboardItem: {
          targetTab: "2d",
          model: "2d_shape",
          planeShapeKind: "jaring_limas",
          label: `Jaring-Jaring Limas 2D (s=${s}, t=${t})`,
          desc: `Bentangan 2D limas segi empat (persegi pusat & 4 segitiga selimut)`,
          paramA: s,
          paramB: t,
          unit: parsedUnit,
        },
      };
    }

    if (lower.includes("balok") || lower.includes("cuboid")) {
      const entity = GEOMETRY_DATABASE.nets_2d.find((n) => n.id === "jaring_balok")!;
      const p = nums[0] || 10;
      const l = nums[1] || 6;
      const t = nums[2] || 4;
      return {
        dimension: "2D",
        targetTab: "2d",
        entity,
        params: { p, l, t },
        unit: parsedUnit,
        reply: `Representasi **2D Jaring-Jaring Balok** telah **AKTIF** di Papan Tulis 2D di sebelah kanan! 📐\n\n### Parameter Balok ($p = ${p},\\ l = ${l},\\ t = ${t}\\text{ ${parsedUnit}}$):\n- **Komponen 2D:** 6 buah persegi panjang yang terdiri dari 3 pasang bidang kongruen.\n- **Rumus Luas Total Jaring-Jaring:** $$L_{\\text{jaring}} = 2(pl + pt + lt)$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan $p=${p}, $l=${l}, $t=${t}\\text{ ${parsedUnit}}$, coba hitung luas total jaring-jaring balok tersebut!`,
        smartboardItem: {
          targetTab: "2d",
          model: "2d_shape",
          planeShapeKind: "jaring_balok",
          label: `Jaring-Jaring Balok 2D (${p}×${l}×${t})`,
          desc: `Bentangan 2D 6 persegi panjang balok`,
          paramA: p,
          paramB: l,
          paramC: t,
          unit: parsedUnit,
        },
      };
    }

    // A.15 Poligon beraturan segi-n generik (termasuk segi 7, 8, 9, 10 yang dulu jatuh ke persegi bawaan)
    if (
      sides !== null &&
      !lower.includes("prisma") && !lower.includes("prism") &&
      !lower.includes("limas") && !lower.includes("piramida") && !lower.includes("piramid") && !lower.includes("pyramid") &&
      !lower.includes("balok") && !lower.includes("kubus")
    ) {
      if (sides < 3 || sides > 12) {
        return clarifyResult(`Poligon beraturan segi-${sides} di luar rentang yang bisa digambar (3 sampai 12 sisi), jadi papan tidak saya buka. Sebutkan jumlah sisi di rentang itu, misalnya \`buatin 2d segi 8\``, "2D");
      }
      return poligon2DResult(sides, labeled.s ?? pool[0] ?? 10, parsedUnit);
    }

    // A.2 Bangun datar standar 2D (Urutkan agar alias yang lebih panjang / spesifik dicek lebih dahulu)
    const sortedShapes = [...GEOMETRY_DATABASE.shapes_2d].sort((a, b) => {
      if (a.id === "persegi_panjang" && b.id === "persegi") return -1;
      if (a.id === "persegi" && b.id === "persegi_panjang") return 1;
      return 0;
    });

    for (const shape of sortedShapes) {
      if (shape.id === "persegi" && (lower.includes("persegi panjang") || lower.includes("persegipanjang") || lower.includes("rectangle"))) {
        continue;
      }
      if (shape.aliases.some((a) => lower.includes(a))) {
        let paramA = shape.parameters[0].default;
        let paramB = shape.parameters[1]?.default;
        let paramC = shape.parameters[2]?.default;

        if (shape.id === "persegi") {
          paramA = nums[0] || 10;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { s: paramA },
            unit: parsedUnit,
            reply: `Bangun datar **Persegi (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus Persegi ($s = ${paramA}\\text{ ${parsedUnit}}$):\n- **Panjang Sisi ($s$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Rumus Luas Bidang ($L$):** $$L = s^2$$\n- **Rumus Keliling ($K$):** $$K = 4s$$\n- **Rumus Panjang Diagonal ($d$):** $$d = s\\sqrt{2}$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan panjang sisi $s = ${paramA}\\text{ ${parsedUnit}}$, coba hitung berapakah luas atau keliling persegi ini?`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "persegi",
              label: `Persegi 2D (s=${paramA})`,
              desc: `Bangun datar persegi dengan panjang sisi ${paramA} ${parsedUnit}`,
              paramA,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "persegi_panjang") {
          paramA = nums[0] || 14;
          paramB = nums[1] || 8;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { p: paramA, l: paramB },
            unit: parsedUnit,
            reply: `Bangun datar **Persegi Panjang (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($p = ${paramA}\\text{ ${parsedUnit}},\\ l = ${paramB}\\text{ ${parsedUnit}}$):\n- **Panjang ($p$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Lebar ($l$):** $${paramB}\\text{ ${parsedUnit}}$\n- **Rumus Luas Bidang ($L$):** $$L = p \\times l$$\n- **Rumus Keliling ($K$):** $$K = 2(p + l)$$\n- **Rumus Panjang Diagonal ($d$):** $$d = \\sqrt{p^2 + l^2}$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan dimensi di atas, coba hitung berapakah luas atau panjang diagonalnya?`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "persegi_panjang",
              label: `Persegi Panjang 2D (p=${paramA}, l=${paramB})`,
              desc: `Bangun datar persegi panjang (${paramA} × ${paramB} ${parsedUnit})`,
              paramA,
              paramB,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "lingkaran") {
          paramA = nums[0] || 7;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { r: paramA },
            unit: parsedUnit,
            reply: `Bangun datar **Lingkaran (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($r = ${paramA}\\text{ ${parsedUnit}}$):\n- **Jari-jari ($r$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Diameter ($d$):** $$d = 2r$$\n- **Rumus Luas Bidang ($L$):** $$L = \\pi r^2$$\n- **Rumus Keliling ($K$):** $$K = 2\\pi r$$\n\n💡 **Tantangan Eksplorasi 2D:** Dengan $r = ${paramA}\\text{ ${parsedUnit}}$, coba hitung berapakah luas atau keliling lingkaran ini?`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "lingkaran",
              label: `Lingkaran 2D (r=${paramA})`,
              desc: `Bangun datar lingkaran jari-jari ${paramA} ${parsedUnit}`,
              paramA,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "segilima" || shape.id === "segienam") {
          paramA = nums[0] || 10;
          const isEnam = shape.id === "segienam";
          const nama = isEnam ? "Segienam Beraturan (Heksagon)" : "Segilima Beraturan (Pentagon)";
          const rumusLuas = isEnam ? "L = \\frac{3\\sqrt{3}}{2}s^2" : "L = \\frac{1}{4}\\sqrt{5(5+2\\sqrt{5})}\\,s^2";
          const sisi = isEnam ? 6 : 5;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { s: paramA },
            unit: parsedUnit,
            reply: `Bangun datar **${nama} (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! \u{1F4D0}\n\n### Parameter & Rumus ($s = ${paramA}\\text{ ${parsedUnit}}$):\n- **Panjang Sisi ($s$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Rumus Luas Bidang ($L$):** $$${rumusLuas}$$\n- **Rumus Keliling ($K$):** $$K = ${sisi}s$$\n\n\u{1F4A1} **Tantangan Eksplorasi 2D:** Dengan panjang sisi $s = ${paramA}\\text{ ${parsedUnit}}$, coba hitung berapakah luas atau keliling bangun ini?`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: isEnam ? "segienam" : "segilima",
              label: `${isEnam ? "Segienam" : "Segilima"} 2D (s=${paramA})`,
              desc: `Bangun datar ${isEnam ? "segienam" : "segilima"} beraturan dengan panjang sisi ${paramA} ${parsedUnit}`,
              paramA,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "belah_ketupat") {
          paramA = nums[0] || 12;
          paramB = nums[1] || 16;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { d1: paramA, d2: paramB },
            unit: parsedUnit,
            reply: `Bangun datar **Belah Ketupat (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($d_1 = ${paramA}\\text{ ${parsedUnit}},\\ d_2 = ${paramB}\\text{ ${parsedUnit}}$):\n- **Diagonal 1 ($d_1$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Diagonal 2 ($d_2$):** $${paramB}\\text{ ${parsedUnit}}$\n- **Rumus Sisi Miring ($s$):** $$s = \\sqrt{(d_1/2)^2 + (d_2/2)^2}$$\n- **Rumus Luas ($L$):** $$L = \\frac{d_1 \\times d_2}{2}$$\n- **Rumus Keliling ($K$):** $$K = 4s$$\n\n💡 **Tantangan Eksplorasi 2D:** Coba masukkan nilai $d_1 = ${paramA}$ dan $d_2 = ${paramB}$ ke dalam rumus luas: berapa hasilnya?`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "belah_ketupat",
              label: `Belah Ketupat 2D (d1=${paramA}, d2=${paramB})`,
              desc: `Bangun datar belah ketupat diagonal ${paramA} & ${paramB} ${parsedUnit}`,
              paramA,
              paramB,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "layang_layang") {
          paramA = nums[0] || 12;
          paramB = nums[1] || 16;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { d1: paramA, d2: paramB },
            unit: parsedUnit,
            reply: `Bangun datar **Layang-Layang (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($d_1 = ${paramA}\\text{ ${parsedUnit}},\\ d_2 = ${paramB}\\text{ ${parsedUnit}}$):\n- **Diagonal Utama ($d_1$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Diagonal Melintang ($d_2$):** $${paramB}\\text{ ${parsedUnit}}$\n- **Rumus Luas ($L$):** $$L = \\frac{d_1 \\times d_2}{2}$$\n\n💡 **Tantangan Eksplorasi 2D:** Coba hitung luas layang-layang ini menggunakan rumus di atas!`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "layang_layang",
              label: `Layang-Layang 2D (d1=${paramA}, d2=${paramB})`,
              desc: `Bangun datar layang-layang diagonal ${paramA} & ${paramB} ${parsedUnit}`,
              paramA,
              paramB,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "jajar_genjang") {
          paramA = nums[0] || 12;
          paramB = nums[1] || 8;
          paramC = nums[2] || 10;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { a: paramA, t: paramB, s: paramC },
            unit: parsedUnit,
            reply: `Bangun datar **Jajar Genjang (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($a = ${paramA}\\text{ ${parsedUnit}},\\ t = ${paramB}\\text{ ${parsedUnit}},\\ s = ${paramC}\\text{ ${parsedUnit}}$):\n- **Alas ($a$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Tinggi Tegak ($t$):** $${paramB}\\text{ ${parsedUnit}}$\n- **Sisi Miring ($s$):** $${paramC}\\text{ ${parsedUnit}}$\n- **Rumus Luas ($L$):** $$L = a \\times t$$\n- **Rumus Keliling ($K$):** $$K = 2(a + s)$$\n\n💡 **Tantangan Eksplorasi 2D:** Coba hitung berapakah luas jajar genjang ini dengan alas $a = ${paramA}$ dan tinggi $t = ${paramB}$!`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "jajar_genjang",
              label: `Jajar Genjang 2D (a=${paramA}, t=${paramB})`,
              desc: `Bangun datar jajar genjang alas ${paramA} & tinggi ${paramB} ${parsedUnit}`,
              paramA,
              paramB,
              paramC,
              unit: parsedUnit,
            },
          };
        }

        if (shape.id === "trapesium") {
          paramA = nums[0] || 8;
          paramB = nums[1] || 14;
          paramC = nums[2] || 6;
          return {
            dimension: "2D",
            targetTab: "2d",
            entity: shape,
            params: { a: paramA, b: paramB, t: paramC },
            unit: parsedUnit,
            reply: `Bangun datar **Trapesium (2D)** telah **AKTIF** di Papan Tulis Interaktif 2D panel kanan! 📐\n\n### Parameter & Rumus ($a = ${paramA}\\text{ ${parsedUnit}},\\ b = ${paramB}\\text{ ${parsedUnit}},\\ t = ${paramC}\\text{ ${parsedUnit}}$):\n- **Sisi Sejajar Atas ($a$):** $${paramA}\\text{ ${parsedUnit}}$\n- **Sisi Sejajar Bawah ($b$):** $${paramB}\\text{ ${parsedUnit}}$\n- **Tinggi ($t$):** $${paramC}\\text{ ${parsedUnit}}$\n- **Rumus Luas ($L$):** $$L = \\frac{a + b}{2} \\times t$$\n\n💡 **Tantangan Eksplorasi 2D:** Coba hitung luas trapesium ini dengan rumus di atas!`,
            smartboardItem: {
              targetTab: "2d",
              model: "2d_shape",
              planeShapeKind: "trapesium",
              label: `Trapesium 2D (a=${paramA}, b=${paramB})`,
              desc: `Bangun datar trapesium sisi sejajar ${paramA} & ${paramB} ${parsedUnit}`,
              paramA,
              paramB,
              paramC,
              unit: parsedUnit,
            },
          };
        }
      }
    }
  }

  // 3. KASUS B: PENGGUNA MEMINTA BENTUK 3D (ATAU BENTUK SECARA ALAMI 3D TANPA KATA 2D)
  const isSegiEnam3D = /(segienam|segi enam|segi-6|segi 6|hexagon|heksagon)/i.test(lower) && !has2DToken;
  const isSegiLima3D = /(segilima|segi lima|segi-5|segi 5|pentagon)/i.test(lower) && !has2DToken;
  const isPrisma3D = (lower.includes("prisma") || lower.includes("prism")) && !has2DToken;
  const isLimas3D = (lower.includes("limas") || lower.includes("piramida") || lower.includes("piramid") || lower.includes("pyramid")) && !has2DToken;
  const isKubus3D = (lower.includes("kubus") || lower.includes("cube")) && !has2DToken;
  const isBalok3D = (lower.includes("balok") || lower.includes("cuboid") || lower.includes("persegi panjang 3d")) && !has2DToken;
  const isTabung3D = (lower.includes("tabung") || lower.includes("cylinder") || lower.includes("silinder")) && !has2DToken;
  const isBola3D = (lower.includes("bola") || lower.includes("sphere")) && !has2DToken;
  const isKerucut3D = (lower.includes("kerucut") || lower.includes("cone")) && !has2DToken;

  // Dispatch keluarga poligon: LIMAS didahulukan dari PRISMA (dulu "piramida segi enam"
  // selalu kalah oleh shortcut segienam dan berubah menjadi prisma).
  if (isLimas3D) {
    const n = sides ?? 4;
    if (n < 3 || n > 12) {
      return clarifyResult(`Limas segi-${n} di luar rentang yang bisa dibangun (alas 3 sampai 12 sisi), jadi papan tidak saya buka dengan bangun pengganti. Coba misalnya \`buatin piramida segi enam dengan sisi 60 dan tinggi 120\``);
    }
    if (n !== 4) {
      return limasPoligonResult(n, polyS, polyT, parsedUnit);
    }
    // n === 4: lanjut ke blok limas segi empat lama di bawah
  } else if (sides !== null && (isPrisma3D || has3DToken || hasVisualCommand) && !has2DToken) {
    if (sides < 3 || sides > 12) {
      return clarifyResult(`Prisma segi-${sides} di luar rentang yang bisa dibangun (alas 3 sampai 12 sisi), jadi papan tidak saya buka dengan bangun pengganti.`, "3D");
    }
    if (sides !== 3) {
      return prismaPoligonResult(sides, polyS, polyT, parsedUnit);
    }
    // sides === 3: lanjut ke blok prisma segitiga lama di bawah
  }

  if (isPrisma3D && !(sides !== null && sides !== 3)) {
    const s = nums[0] || 8;
    const t = nums[1] || 10;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "prisma")!,
      params: { s, t },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Prisma Segitiga** telah **AKTIF** dan ditampilkan di Papan Tulis Pintar 3D! 🎉\n\n### Parameter & Rumus Sifat Matematis Prisma Segitiga ($s = ${s}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$):\n- **Sisi Alas Segitiga Sama Sisi ($s$):** $${s}\\text{ ${parsedUnit}}$\n- **Tinggi Prisma ($t$):** $${t}\\text{ ${parsedUnit}}$\n- **Rumus Luas Alas ($L_a$):** $$L_a = \\frac{\\sqrt{3}}{4}s^2$$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = 3(s \\times t)$$\n- **Rumus Luas Permukaan Total ($L$):** $$L = 2L_a + L_s$$\n- **Rumus Volume Ruang ($V$):** $$V = L_a \\times t$$\n\n💡 **Tantangan Eksplorasi 3D:** Model 3D siap dieksplorasi di kanvas! Sekarang giliranmu: dengan dimensi di atas, berapakah volume atau luas permukaannya?`,
      smartboardItem: {
        targetTab: "3d",
        model: "solids",
        solidKind: "prisma",
        label: `Prisma Segitiga 3D (${s}×${t} ${parsedUnit})`,
        desc: `Prisma segitiga geometri ruang alas ${s} ${parsedUnit}, tinggi ${t} ${parsedUnit}`,
        paramA: s,
        paramB: t,
        unit: parsedUnit,
      },
    };
  }

  if (isLimas3D) {
    const s = nums[0] || 8;
    const t = nums[1] || 10;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "limas")!,
      params: { s, t },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Limas Segi Empat (Piramida)** telah **AKTIF** di Papan Tulis Pintar 3D! 🎉\n\n### Parameter & Rumus Limas / Piramida ($s = ${s}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$):\n- **Panjang Rusuk Alas Persegi ($s$):** $${s}\\text{ ${parsedUnit}}$\n- **Tinggi Tegak Limas ($t$):** $${t}\\text{ ${parsedUnit}}$\n- **Rumus Tinggi Apotema ($t_s$):** $$t_s = \\sqrt{(s/2)^2 + t^2}$$\n- **Rumus Luas Alas ($L_a$):** $$L_a = s^2$$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = 2 s \\cdot t_s$$\n- **Rumus Volume Ruang ($V$):** $$V = \\frac{1}{3}s^2 t$$\n\n💡 **Tantangan Eksplorasi 3D:** Putar model 3D di kanvas! Dapatkah kamu menghitung volume limas ini menggunakan rumus di atas?`,
      smartboardItem: {
        targetTab: "3d",
        model: "solids",
        solidKind: "limas",
        label: `Limas Segi Empat 3D (Piramida)`,
        desc: `Limas segi empat beraturan (piramida) alas ${s} ${parsedUnit}, tinggi ${t} ${parsedUnit}`,
        paramA: s,
        paramB: t,
        unit: parsedUnit,
      },
    };
  }

  if (isKubus3D) {
    const s = nums[0] || 10;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "kubus")!,
      params: { s },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Kubus** telah **AKTIF** dan ditampilkan di Papan Tulis Pintar 3D di sebelah kanan! 🎉\n\n### Parameter & Rumus Sifat Matematis Kubus ($s = ${s}\\text{ ${parsedUnit}}$):\n- **Panjang Rusuk ($s$):** $${s}\\text{ ${parsedUnit}}$\n- **Rumus Luas Permukaan ($L$):** $$L = 6s^2$$\n- **Rumus Volume Ruang ($V$):** $$V = s^3$$\n- **Rumus Diagonal Bidang ($d_b$):** $$d_b = s\\sqrt{2}$$\n- **Rumus Diagonal Ruang ($d_r$):** $$d_r = s\\sqrt{3}$$\n\n💡 **Tantangan Eksplorasi 3D:** Model 3D kubus siap dieksplorasi di kanvas! Sekarang giliranmu: dengan $s = ${s}\\text{ ${parsedUnit}}$, coba hitung berapakah luas permukaan, volume, atau panjang diagonalnya?`,
      smartboardItem: {
        targetTab: "3d",
        model: "solids",
        solidKind: "kubus",
        label: `Kubus 3D (${s} ${parsedUnit})`,
        desc: `Kubus 3D dengan panjang rusuk ${s} ${parsedUnit}`,
        paramA: s,
        unit: parsedUnit,
      },
    };
  }

  if (isBalok3D) {
    const p = nums[0] || 10;
    const l = nums[1] || 6;
    const t = nums[2] || 4;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "balok")!,
      params: { p, l, t },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Balok** telah **AKTIF** di Papan Tulis Pintar 3D! 🎉\n\n### Parameter & Rumus Dimensi Balok ($p=${p},\\ l=${l},\\ t=${t}\\text{ ${parsedUnit}}$):\n- **Ukuran Dimensi:** $p = ${p}\\text{ ${parsedUnit}},\\ l = ${l}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$\n- **Rumus Luas Permukaan Total ($L$):** $$L = 2(pl + pt + lt)$$\n- **Rumus Volume Ruang ($V$):** $$V = p \\times l \\times t$$\n- **Rumus Diagonal Ruang ($d_r$):** $$d_r = \\sqrt{p^2 + l^2 + t^2}$$\n\n💡 **Tantangan Eksplorasi 3D:** Putar model 3D di kanvas! Coba substitusikan nilainya ke rumus: berapakah volume atau diagonal ruang yang kamu peroleh?`,
      smartboardItem: {
        targetTab: "3d",
        model: "solids",
        solidKind: "balok",
        label: `Balok 3D (${p}×${l}×${t} ${parsedUnit})`,
        desc: `Bangun ruang balok (${p} × ${l} × ${t} ${parsedUnit})`,
        paramA: p,
        paramB: l,
        paramC: t,
        unit: parsedUnit,
      },
    };
  }

  if (isTabung3D) {
    const r = nums[0] || 7;
    const t = nums[1] || 12;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "tabung")!,
      params: { r, t },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Tabung Silinder** telah **AKTIF** di Papan Tulis 3D! 🎉\n\n### Parameter & Rumus Tabung ($r = ${r}\\text{ ${parsedUnit}},\\ t = ${t}\\text{ ${parsedUnit}}$):\n- **Jari-jari Alas ($r$):** $${r}\\text{ ${parsedUnit}}$\n- **Tinggi Silinder ($t$):** $${t}\\text{ ${parsedUnit}}$\n- **Rumus Luas Selimut ($L_s$):** $$L_s = 2\\pi r t$$\n- **Rumus Luas Permukaan Total ($L$):** $$L = 2\\pi r(r + t)$$\n- **Rumus Volume Ruang ($V$):** $$V = \\pi r^2 t$$\n\n💡 **Tantangan Eksplorasi 3D:** Putar silinder 360° di kanvas 3D! Dengan $r = ${r}\\text{ ${parsedUnit}}$ dan $t = ${t}\\text{ ${parsedUnit}}$, coba hitung berapakah volume silinder ini?`,
      smartboardItem: {
        targetTab: "3d",
        model: "cylinder",
        label: `Tabung Silinder 3D (r=${r}, t=${t})`,
        desc: `Silinder ruang jari-jari ${r} ${parsedUnit} & tinggi ${t} ${parsedUnit}`,
        paramA: r,
        paramB: t,
        unit: parsedUnit,
      },
    };
  }

  if (isBola3D) {
    const r = nums[0] || 7;
    return {
      dimension: "3D",
      targetTab: "3d",
      entity: GEOMETRY_DATABASE.shapes_3d.find((s) => s.id === "bola")!,
      params: { r },
      unit: parsedUnit,
      reply: `Objek geometri 3D **Bola** telah **AKTIF** di Papan Tulis 3D! 🎉\n\n### Parameter & Rumus Bola ($r = ${r}\\text{ ${parsedUnit}}$):\n- **Jari-jari ($r$):** $${r}\\text{ ${parsedUnit}}$\n- **Diameter ($d$):** $$d = 2r$$\n- **Rumus Luas Permukaan ($L$):** $$L = 4\\pi r^2$$\n- **Rumus Volume Ruang ($V$):** $$V = \\frac{4}{3}\\pi r^3$$\n\n💡 **Tantangan Eksplorasi 3D:** Putar bola 3D di kanvas! Dengan jari-jari $r = ${r}\\text{ ${parsedUnit}}$, coba hitung berapakah luas permukaan bola tersebut?`,
      smartboardItem: {
        targetTab: "3d",
        model: "solids",
        solidKind: "bola",
        label: `Bola 3D (r=${r})`,
        desc: `Bangun ruang bola jari-jari ${r} ${parsedUnit}`,
        paramA: r,
        unit: parsedUnit,
      },
    };
  }

  // Fallback 2D umum: JANGAN buka papan dengan bangun bawaan - minta nama bangunnya
  if (has2DToken && hasVisualCommand) {
    return clarifyResult(`Permintaan 2D kamu belum menyebut bangun datarnya, jadi papan tidak saya buka dengan bangun bawaan.\n\nSebutkan bangunnya, misalnya: \`buatin 2d segi 8\`, \`buatin 2d lingkaran jari-jari 7\`, \`buatin 2d persegi panjang\`, atau jaring-jaring seperti \`buatin jaring-jaring kubus\``, "2D", "generic");
  }

  // Fallback 3D umum: JANGAN buka papan dengan kubus bawaan - minta nama bangunnya
  if (has3DToken && hasVisualCommand) {
    return clarifyResult(`Permintaan 3D kamu belum menyebut bangun ruangnya, jadi papan tidak saya buka dengan bangun bawaan.\n\nSebutkan bangunnya, misalnya: \`buatin piramida segi enam dengan sisi 60 dan tinggi 120\`, \`buatin prisma segi 7\`, \`buatin kubus sisi 5\`, atau \`buatin tabung jari-jari 7 tinggi 12\``, "3D", "generic");
  }

  return null;
}

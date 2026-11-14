import { resolveGeometricIntent, looksLikeGeometryRequest } from "@/data/geometry-database";
import type { MathModelType, PlaneShapeKind, SolidKind } from "@/components/InteractiveCanvas3D";

export interface DetectedSmartboardItem {
  model: MathModelType;
  solidKind?: SolidKind;
  planeShapeKind?: PlaneShapeKind;
  label: string;
  desc?: string;
  paramA?: number;
  paramB?: number;
  paramC?: number;
  unit?: string;
  hasSlice?: boolean;
  targetTab?: "2d" | "3d";
}

interface DetectedShapeInfo {
  kind:
    | "balok"
    | "kubus"
    | "tabung"
    | "bola"
    | "kerucut"
    | "prisma"
    | "limas"
    | "saddle"
    | "parabola"
    | "trig"
    | "linear"
    | "circle"
    | "counting_blocks"
    | "jajar_genjang"
    | "trapesium"
    | "segitiga"
    | "persegi_panjang"
    | "persegi"
    | "belah_ketupat"
    | "layang_layang";
  paramA?: number;
  paramB?: number;
  paramC?: number;
  unit?: string;
  planeShapeKind?: PlaneShapeKind;
}

export function detectShapeKind(str: string): DetectedShapeInfo | null {
  const s = str.toLowerCase();

  if (
    (s.includes("persegi panjang") || s.includes("persegipanjang") || s.includes("rectangle")) &&
    !s.includes("3d") && !s.includes("tiga dimensi") && !s.includes("ruang") && !s.includes("balok") && !s.includes("prisma")
  ) {
    const pMatch = s.match(/(?:p|panjang)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const lMatch = s.match(/(?:l|lebar)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "persegi_panjang",
      paramA: pMatch ? parseFloat(pMatch[1].replace(",", ".")) : nums[0] || 14,
      paramB: lMatch ? parseFloat(lMatch[1].replace(",", ".")) : nums[1] || 8,
      unit: "cm",
      planeShapeKind: "persegi_panjang",
    };
  }

  if (
    (s.includes("persegi") || s.includes("bujur sangkar") || s.includes("square")) &&
    !s.includes("3d") && !s.includes("tiga dimensi") && !s.includes("ruang") && !s.includes("kubus") && !s.includes("limas") && !s.includes("piramida") && !s.includes("piramid")
  ) {
    const sMatch = s.match(/(?:s|sisi|rusuk|panjang)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "persegi",
      paramA: sMatch ? parseFloat(sMatch[1].replace(",", ".")) : nums[0] || 10,
      unit: "cm",
      planeShapeKind: "persegi",
    };
  }

  if (s.includes("jajar genjang") || s.includes("jajargenjang") || s.includes("parallelogram")) {
    const aMatch = s.match(/(?:a|alas|panjang)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const tMatch = s.match(/(?:t|tinggi)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const sMatch = s.match(/(?:s|miring|sisi miring)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    return {
      kind: "jajar_genjang",
      paramA: aMatch ? parseFloat(aMatch[1].replace(",", ".")) : 12,
      paramB: tMatch ? parseFloat(tMatch[1].replace(",", ".")) : 8,
      paramC: sMatch ? parseFloat(sMatch[1].replace(",", ".")) : 10,
      unit: "cm",
      planeShapeKind: "jajar_genjang",
    };
  }

  if (s.includes("trapesium") || s.includes("trapezoid")) {
    return {
      kind: "trapesium",
      paramA: 8,
      paramB: 14,
      paramC: 6,
      unit: "cm",
      planeShapeKind: "trapesium",
    };
  }

  if (
    (s.includes("segitiga") || s.includes("triangle")) &&
    !s.includes("prisma") && !s.includes("prism") && !s.includes("limas") && !s.includes("piramida") && !s.includes("piramid") && !s.includes("pyramid")
  ) {
    const aMatch = s.match(/(?:a|alas)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const tMatch = s.match(/(?:t|tinggi)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    return {
      kind: "segitiga",
      paramA: aMatch ? parseFloat(aMatch[1].replace(",", ".")) : 10,
      paramB: tMatch ? parseFloat(tMatch[1].replace(",", ".")) : 8,
      unit: "cm",
      planeShapeKind: "segitiga",
    };
  }

  if (s.includes("balok") || s.includes("cuboid") || s.includes("beam") || s.includes("persegi panjang 3d")) {
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "balok",
      paramA: nums[0] || 10,
      paramB: nums[1] || 6,
      paramC: nums[2] || 4,
      unit: "cm",
    };
  }

  if (s.includes("tabung") || s.includes("cylinder") || s.includes("silinder")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : undefined;
    return { kind: "tabung", paramA: r || 7, paramB: 12, unit: "cm" };
  }

  if (s.includes("bola") || s.includes("sphere")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : undefined;
    return { kind: "bola", paramA: r || 7, unit: "cm" };
  }

  if (s.includes("kerucut") || s.includes("cone") || s.includes("irisan kerucut")) {
    return { kind: "kerucut", paramA: 5, paramB: 10, unit: "cm" };
  }

  if (s.includes("prisma") || s.includes("prism")) {
    const sMatch = s.match(/(?:s|alas|rusuk)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const tMatch = s.match(/(?:t|tinggi)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "prisma",
      paramA: sMatch ? parseFloat(sMatch[1].replace(",", ".")) : nums[0] || 8,
      paramB: tMatch ? parseFloat(tMatch[1].replace(",", ".")) : nums[1] || 10,
      unit: "cm",
    };
  }

  if (s.includes("limas") || s.includes("piramida") || s.includes("piramid") || s.includes("pyramid")) {
    const sMatch = s.match(/(?:s|alas|sisi|rusuk)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const tMatch = s.match(/(?:t|tinggi)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "limas",
      paramA: sMatch ? parseFloat(sMatch[1].replace(",", ".")) : nums[0] || 8,
      paramB: tMatch ? parseFloat(tMatch[1].replace(",", ".")) : nums[1] || 10,
      unit: "cm",
    };
  }

  if (s.includes("pelana") || s.includes("saddle") || s.includes("permukaan 3d")) {
    return { kind: "saddle" };
  }

  if (s.includes("parabola") || s.includes("x^2") || s.includes("x²") || s.includes("kuadrat")) {
    return { kind: "parabola", paramA: 1, paramB: 0, paramC: -3 };
  }

  if (s.includes("sin") || s.includes("cos") || s.includes("gelombang") || s.includes("trig")) {
    return { kind: "trig", paramA: 2, paramB: 1, paramC: 0 };
  }

  if (s.includes("garis") || s.includes("linear") || s.includes("persamaan garis")) {
    return { kind: "linear", paramA: 2, paramB: 1 };
  }

  if ((s.includes("lingkaran") || s.includes("circle")) && !s.includes("bola") && !s.includes("tabung") && !s.includes("silinder")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const dMatch = s.match(/(?:d|diameter)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : dMatch ? parseFloat(dMatch[1].replace(",", ".")) / 2 : nums[0] || 7;
    return { kind: "circle", paramA: r, unit: "cm", planeShapeKind: "lingkaran" };
  }

  if (s.includes("belah ketupat") || s.includes("belahketupat") || s.includes("rhombus")) {
    const d1Match = s.match(/(?:d1|diagonal\s*1)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const d2Match = s.match(/(?:d2|diagonal\s*2)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "belah_ketupat",
      paramA: d1Match ? parseFloat(d1Match[1].replace(",", ".")) : nums[0] || 12,
      paramB: d2Match ? parseFloat(d2Match[1].replace(",", ".")) : nums[1] || 16,
      unit: "cm",
      planeShapeKind: "belah_ketupat",
    };
  }

  if (s.includes("layang layang") || s.includes("layang-layang") || s.includes("layanglayang") || s.includes("kite")) {
    const d1Match = s.match(/(?:d1|diagonal\s*1)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const d2Match = s.match(/(?:d2|diagonal\s*2)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    return {
      kind: "layang_layang",
      paramA: d1Match ? parseFloat(d1Match[1].replace(",", ".")) : nums[0] || 12,
      paramB: d2Match ? parseFloat(d2Match[1].replace(",", ".")) : nums[1] || 16,
      unit: "cm",
      planeShapeKind: "layang_layang",
    };
  }

  if (s.includes("balok hitung") || s.includes("counting block")) {
    return { kind: "counting_blocks" };
  }

  if (s.includes("kubus") || s.includes("cube") || s.includes("kotak 3d") || s.includes("kotak")) {
    const sMatch = s.match(/(?:s|rusuk|sisi|panjang|ukuran)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const sz = sMatch ? parseFloat(sMatch[1].replace(",", ".")) : undefined;
    return { kind: "kubus", paramA: sz || 10, unit: "cm" };
  }

  return null;
}

export function detectSmartboardItem(
  text: string,
  conversationHistory?: Array<{ rawText?: string; replyText?: string }>
): DetectedSmartboardItem | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  const resolved = resolveGeometricIntent(text, conversationHistory);
  if (resolved && !resolved.smartboardItem) {
    return null;
  }
  if (!resolved && looksLikeGeometryRequest(t) && !detectShapeKind(t)) {
    return null;
  }

  const resolvedItem = resolved?.smartboardItem;
  if (resolved && resolvedItem) {
    return {
      model: resolvedItem.model as MathModelType,
      solidKind: (resolvedItem.solidKind as SolidKind) || undefined,
      planeShapeKind: (resolvedItem.planeShapeKind as PlaneShapeKind) || undefined,
      label: resolvedItem.label,
      desc: resolvedItem.desc,
      paramA: resolvedItem.paramA,
      paramB: resolvedItem.paramB,
      paramC: resolvedItem.paramC,
      unit: resolvedItem.unit,
      hasSlice: resolvedItem.hasSlice,
      targetTab: resolvedItem.targetTab,
    };
  }

  const hasExplicitCommand =
    /\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|plot|lukiskan|lukis|simulasikan|modelkan|buka|lihat|show|draw|display|generate|create)\b/i.test(t);

  const isPureChatOrPraise =
    /^(hai|halo|hello|hi|hey|hei|p|pagi|siang|sore|malam|assalamualaikum|tes|test|wah+|keren|canggih|mantap|makasih|terima kasih|thanks|thank you)\b/i.test(t) ||
    /\b(kamu canggih|kamu keren|kamu pintar|kamu hebat|sangat membantu|bagus banget|terima kasih banyak|makasih banyak)\b/i.test(t);

  if (isPureChatOrPraise && !hasExplicitCommand) {
    return null;
  }

  const has3DWord =
    /\b(3d|3-d|dimensi 3|tiga dimensi|bangun ruang|kartesius|papan tulis|smartboard|kanvas)\b/i.test(t);

  const isConceptQuestion =
    /^(apa|apakah|mengapa|kenapa|bagaimana|jelaskan|terangkan|definisi|arti|makna|maksud)\b/i.test(t) &&
    !hasExplicitCommand &&
    !has3DWord;

  if (isConceptQuestion) {
    return null;
  }

  const has3DIntent =
    (has3DWord &&
      (hasExplicitCommand ||
        /\b(bisakah|bisa|tolong|coba|minta|pengen|mau|dapatkah|bentuk|format|versi|secara)\b/i.test(t))) ||
    /\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|modelkan|lihat|buka|tolong|bisakah|bisa|minta|pengen|mau|coba)\b[\s\S]{0,35}\b(?:3d|3-d|tiga dimensi|bangun ruang)\b/i.test(
      t
    ) ||
    /\b(?:3d|3-d|tiga dimensi|bangun ruang)\b[\s\S]{0,35}\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|modelkan|lihat|buka|nya|dong|kan)\b/i.test(
      t
    ) ||
    /\b(?:dalam bentuk|bentuk|versi|format|secara)\s+(?:model\s+)?3d\b/i.test(t) ||
    /^(3d|buat 3d|buatkan 3d|bikin 3d|tampilkan 3d|render 3d|lihat 3d)$/i.test(t);

  const hasVisualIntent =
    hasExplicitCommand ||
    has3DIntent ||
    has3DWord ||
    /\b(cube|kubus|balok|tabung|cylinder|silinder|kerucut|cone|bola|sphere|prisma|prism|limas|piramida|piramid|pyramid|parabola|pelana|jajar genjang|jajargenjang|parallelogram|trapesium|trapezoid|segitiga|triangle|persegi panjang|persegipanjang|rectangle|persegi|bujur sangkar|square|lingkaran|circle|belah ketupat|belahketupat|rhombus|layang layang|layang-layang|layanglayang|kite)\b/i.test(
      t
    );

  if (!hasVisualIntent) {
    return null;
  }

  let parsedA: number | undefined = undefined;
  let parsedUnit = "cm";

  const unitMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(cm|m|mm|in)\b/i);
  if (unitMatch) {
    parsedA = parseFloat(unitMatch[1].replace(",", "."));
    parsedUnit = unitMatch[2].toLowerCase();
  } else {
    const paramMatch = t.match(
      /(?:s|r|p|sisi|rusuk|jari-jari|panjang|ukuran)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i
    );
    if (paramMatch) {
      parsedA = parseFloat(paramMatch[1].replace(",", "."));
    } else {
      const solidNumMatch = t.match(
        /(?:kubus|cube|balok|tabung|silinder|bola|sphere|kerucut|cone)\s+(\d+(?:[.,]\d+)?)/i
      );
      if (solidNumMatch) {
        parsedA = parseFloat(solidNumMatch[1].replace(",", "."));
      }
    }
  }

  const wantsSlice = /\b(irisan|potong|penampang|slice|belah|potongan)\b/i.test(t);
  let shape = detectShapeKind(t);

  if (!shape && (has3DIntent || hasExplicitCommand) && conversationHistory && conversationHistory.length > 0) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const hist = conversationHistory[i];
      const histText = `${hist.rawText || ""} ${hist.replyText || ""}`;
      const foundInHistory = detectShapeKind(histText);
      if (foundInHistory) {
        if (has3DIntent) {
          if (foundInHistory.kind === "segitiga") {
            shape = { kind: "limas", paramA: foundInHistory.paramA || 8, paramB: 10, unit: parsedUnit };
          } else if (foundInHistory.kind === "persegi") {
            shape = { kind: "kubus", paramA: foundInHistory.paramA || 10, unit: parsedUnit };
          } else if (foundInHistory.kind === "persegi_panjang") {
            shape = { kind: "balok", paramA: foundInHistory.paramA || 10, paramB: foundInHistory.paramB || 6, paramC: 4, unit: parsedUnit };
          } else if (foundInHistory.kind === "circle") {
            shape = { kind: "tabung", paramA: foundInHistory.paramA || 7, paramB: 12, unit: parsedUnit };
          } else if (foundInHistory.kind === "jajar_genjang" || foundInHistory.kind === "trapesium" || foundInHistory.kind === "belah_ketupat" || foundInHistory.kind === "layang_layang") {
            shape = { kind: "prisma", paramA: foundInHistory.paramA || 8, paramB: 10, unit: parsedUnit };
          } else {
            shape = foundInHistory;
          }
        } else if (/\b(2d|2-d|dua dimensi|bangun datar)\b/i.test(t)) {
          if (foundInHistory.kind === "kubus") {
            shape = { kind: "persegi", paramA: foundInHistory.paramA || 10, unit: parsedUnit, planeShapeKind: "persegi" };
          } else if (foundInHistory.kind === "balok") {
            shape = { kind: "persegi_panjang", paramA: foundInHistory.paramA || 14, paramB: foundInHistory.paramB || 8, unit: parsedUnit, planeShapeKind: "persegi_panjang" };
          } else if (foundInHistory.kind === "tabung" || foundInHistory.kind === "bola") {
            shape = { kind: "circle", paramA: foundInHistory.paramA || 7, unit: parsedUnit, planeShapeKind: "lingkaran" };
          } else if (foundInHistory.kind === "limas" || foundInHistory.kind === "prisma") {
            shape = { kind: "segitiga", paramA: foundInHistory.paramA || 10, paramB: 8, unit: parsedUnit, planeShapeKind: "segitiga" };
          } else {
            shape = foundInHistory;
          }
        } else {
          shape = foundInHistory;
        }
        break;
      }
    }
  }

  if (!shape && has3DIntent) {
    shape = { kind: "kubus", paramA: parsedA || 10, unit: parsedUnit };
  }

  if (!shape) {
    return null;
  }

  if (parsedA !== undefined) {
    shape.paramA = parsedA;
  }

  switch (shape.kind) {
    case "balok": {
      const p = shape.paramA || 10;
      const l = shape.paramB || 6;
      const tVal = shape.paramC || 4;
      return {
        model: "solids",
        solidKind: "balok",
        label: `Balok 3D (${p}×${l}×${tVal})`,
        desc: wantsSlice
          ? `Bangun ruang balok (${p} × ${l} × ${tVal} ${parsedUnit}) dengan bidang irisan penampang`
          : `Bangun ruang balok (${p} × ${l} × ${tVal} ${parsedUnit})`,
        paramA: p,
        paramB: l,
        paramC: tVal,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "kubus": {
      const sz = shape.paramA || 10;
      return {
        model: "solids",
        solidKind: "kubus",
        label: `Kubus 3D (${sz} ${parsedUnit})`,
        desc: wantsSlice
          ? `Kubus 3D panjang sisi ${sz} ${parsedUnit} dengan bidang irisan penampang`
          : `Kubus 3D geometri ruang dengan panjang sisi ${sz} ${parsedUnit}`,
        paramA: sz,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "tabung": {
      const r = shape.paramA || 7;
      const h = shape.paramB || 12;
      return {
        model: "cylinder",
        label: `Tabung Silinder 3D (r=${r})`,
        desc: wantsSlice
          ? `Silinder ruang jari-jari ${r} ${parsedUnit} & tinggi ${h} ${parsedUnit} dengan bidang irisan`
          : `Silinder ruang jari-jari ${r} ${parsedUnit} & tinggi ${h} ${parsedUnit}`,
        paramA: r,
        paramB: h,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "bola": {
      const r = shape.paramA || 7;
      return {
        model: "solids",
        solidKind: "bola",
        label: `Bola 3D (r=${r})`,
        desc: wantsSlice
          ? `Bangun ruang bola dengan jari-jari ${r} ${parsedUnit} dengan bidang irisan`
          : `Bangun ruang bola dengan jari-jari ${r} ${parsedUnit}`,
        paramA: r,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "kerucut": {
      return {
        model: "conic_slicer",
        label: "Irisan Kerucut 3D",
        desc: "Pemotongan kerucut ganda (elips, parabola, hiperbola)",
        paramA: shape.paramA || 5,
        paramB: shape.paramB || 10,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "prisma": {
      return {
        model: "solids",
        solidKind: "prisma",
        label: "Prisma 3D",
        desc: wantsSlice
          ? "Prisma segitiga dengan bidang penampang irisan"
          : "Prisma segitiga geometri ruang",
        paramA: shape.paramA || 8,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "limas": {
      const s = shape.paramA || 8;
      const tVal = shape.paramB || 10;
      return {
        model: "solids",
        solidKind: "limas",
        label: "Limas Segi Empat 3D (Piramida)",
        desc: wantsSlice
          ? `Limas segi empat beraturan (piramida) alas ${s} ${parsedUnit}, tinggi ${tVal} ${parsedUnit} dengan bidang penampang irisan`
          : `Limas segi empat beraturan (piramida) alas ${s} ${parsedUnit}, tinggi ${tVal} ${parsedUnit}`,
        paramA: s,
        paramB: tVal,
        unit: parsedUnit,
        hasSlice: wantsSlice,
      };
    }
    case "saddle": {
      return {
        model: "saddle",
        label: "Pelana Kuda 3D",
        desc: "Permukaan kuadrik hiperbolik paraboloid z = x² - y²",
      };
    }
    case "parabola": {
      return {
        model: "2d_quadratic",
        label: "Grafik Parabola 2D",
        desc: "y = x² - 3 dengan titik potong & titik puncak",
        paramA: 1,
        paramB: 0,
        paramC: -3,
      };
    }
    case "trig": {
      return {
        model: "2d_trig",
        label: "Gelombang Sinus 2D",
        desc: "y = 2 sin(x) fungsi periodik trigonometri",
        paramA: 2,
        paramB: 1,
        paramC: 0,
      };
    }
    case "linear": {
      return {
        model: "2d_linear",
        label: "Garis Lurus 2D",
        desc: "y = 2x + 1 grafik garis lurus",
        paramA: 2,
        paramB: 1,
      };
    }
    case "circle": {
      const r = shape.paramA || 7;
      return {
        model: "2d_shape",
        planeShapeKind: "lingkaran",
        label: `Lingkaran 2D (r=${r})`,
        desc: `Bangun datar lingkaran dengan jari-jari ${r} ${parsedUnit}`,
        paramA: r,
        unit: parsedUnit,
      };
    }
    case "belah_ketupat": {
      const d1 = shape.paramA || 12;
      const d2 = shape.paramB || 16;
      return {
        model: "2d_shape",
        planeShapeKind: "belah_ketupat",
        label: `Belah Ketupat 2D (d1=${d1}, d2=${d2})`,
        desc: `Bangun datar belah ketupat diagonal ${d1} & ${d2} ${parsedUnit}`,
        paramA: d1,
        paramB: d2,
        unit: parsedUnit,
      };
    }
    case "layang_layang": {
      const d1 = shape.paramA || 12;
      const d2 = shape.paramB || 16;
      return {
        model: "2d_shape",
        planeShapeKind: "layang_layang",
        label: `Layang-Layang 2D (d1=${d1}, d2=${d2})`,
        desc: `Bangun datar layang-layang diagonal ${d1} & ${d2} ${parsedUnit}`,
        paramA: d1,
        paramB: d2,
        unit: parsedUnit,
      };
    }
    case "counting_blocks": {
      return {
        model: "counting_blocks",
        label: "Balok Hitung",
        desc: "Visualisasi balok aritmetika",
      };
    }
    case "jajar_genjang": {
      const a = shape.paramA || 12;
      const tVal = shape.paramB || 8;
      const s = shape.paramC || 10;
      return {
        model: "2d_shape",
        planeShapeKind: "jajar_genjang",
        label: `Jajar Genjang 2D (a=${a}, t=${tVal})`,
        desc: `Bangun datar jajar genjang alas ${a} ${parsedUnit}, tinggi ${tVal} ${parsedUnit}, sisi miring ${s} ${parsedUnit}`,
        paramA: a,
        paramB: tVal,
        paramC: s,
        unit: parsedUnit,
      };
    }
    case "trapesium": {
      const a = shape.paramA || 8;
      const b = shape.paramB || 14;
      const tVal = shape.paramC || 6;
      return {
        model: "2d_shape",
        planeShapeKind: "trapesium",
        label: `Trapesium 2D (a=${a}, b=${b})`,
        desc: `Bangun datar trapesium sisi sejajar ${a} & ${b} ${parsedUnit}, tinggi ${tVal} ${parsedUnit}`,
        paramA: a,
        paramB: b,
        paramC: tVal,
        unit: parsedUnit,
      };
    }
    case "segitiga": {
      const a = shape.paramA || 10;
      const tVal = shape.paramB || 8;
      return {
        model: "2d_shape",
        planeShapeKind: "segitiga",
        label: `Segitiga 2D (a=${a}, t=${tVal})`,
        desc: `Bangun datar segitiga alas ${a} ${parsedUnit}, tinggi ${tVal} ${parsedUnit}`,
        paramA: a,
        paramB: tVal,
        unit: parsedUnit,
      };
    }
    case "persegi_panjang": {
      const p = shape.paramA || 14;
      const l = shape.paramB || 8;
      return {
        model: "2d_shape",
        planeShapeKind: "persegi_panjang",
        label: `Persegi Panjang 2D (p=${p}, l=${l})`,
        desc: `Bangun datar persegi panjang (${p} × ${l} ${parsedUnit})`,
        paramA: p,
        paramB: l,
        unit: parsedUnit,
      };
    }
    case "persegi": {
      const s = shape.paramA || 10;
      return {
        model: "2d_shape",
        planeShapeKind: "persegi",
        label: `Persegi 2D (s=${s})`,
        desc: `Bangun datar persegi dengan panjang sisi ${s} ${parsedUnit}`,
        paramA: s,
        unit: parsedUnit,
      };
    }
    default:
      return null;
  }
}

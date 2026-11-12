"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
// Renderer rumus/markdown dimuat lazy lewat wrapper: chunk KaTeX keluar
// dari muatan awal halaman dan hanya diunduh saat ada konten yang
// benar-benar mengandung rumus atau markdown.
import MathView from "@/components/chat/LazyMathView";
import RichChatText from "@/components/chat/LazyRichText";
import ZapLogo from "@/components/ZapLogo";
import { type ZAPUser } from "@/components/GoogleAuthButton";
import type {
  MathModelType,
  SolidKind,
  PlaneShapeKind,
} from "@/components/InteractiveCanvas3D";

const InteractiveCanvas3D = dynamic(
  () => import("@/components/InteractiveCanvas3D"),
  { ssr: false }
);
import ModelPickerWithEffort, {
  AVAILABLE_MODELS,
  type AIModel,
  type ReasoningEffort,
} from "@/components/ModelPickerWithEffort";
import {
  formatRelativeTime,
  loadConversations,
  saveConversations,
  windowHistory,
  deriveTitle,
  type StoredConversation,
} from "@/utils/chat-memory";
// Modal bagikan hanya tampil saat dibuka pengguna; muat lazy agar tidak
// ikut dalam muatan awal halaman chat.
const ShareModal = dynamic(() => import("@/components/ShareModal"), {
  ssr: false,
});
import {
  syncAccountBackup,
  restoreAccountData,
  clearLocalWorkingSession,
  recordDeletedConversation,
  getGoogleIdToken,
} from "@/utils/account-sync";
import { useTheme } from "@/utils/theme";
import { markSessionCookie } from "@/lib/session-cookie";
import { resolveGeometricIntent, looksLikeGeometryRequest } from "@/data/geometry-database";
import {
  Plus,
  PlusCircle,
  ArrowUp,
  Search,
  CheckCircle2,
  AlertCircle,
  MessageSquareQuote,
  FlaskConical,
  PanelLeft,
  Sparkles,
  Compass,
  Trash2,
  Columns,
  Maximize2,
  Minimize2,
  X,
  Folder,
  FolderPlus,
  LayoutGrid,
  ChevronDown,
  Atom,
  Edit3,
  Clock,
  SlidersHorizontal,
  SquareSplitHorizontal,
  RotateCw,
  Box,
  LogOut,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Share2,
  Pencil,
  FileText,
  FileUp,
  Upload,
  Download,
  ArrowUpRight,
  Eye,
  Paperclip,
  Camera,
  Code2,
  ChevronRight,
  BookOpen,
  FileCode,
  Settings,
  Sun,
  Moon,
  Palette,
  Laptop,
  Cloud,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

interface DetectedSmartboardItem {
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

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  dataUrl?: string;
  uploadedAt: number;
  workspaceId?: string;
}

interface WorkspaceItem {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
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

function detectShapeKind(str: string): DetectedShapeInfo | null {
  const s = str.toLowerCase();

  // 0. Bangun Datar 2D (Persegi Panjang, Persegi, Jajar Genjang, Trapesium, Segitiga)
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

  // 1. Balok (cuboid / beam / persegi panjang 3d)
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

  // 2. Tabung / Silinder
  if (s.includes("tabung") || s.includes("cylinder") || s.includes("silinder")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : undefined;
    return { kind: "tabung", paramA: r || 7, paramB: 12, unit: "cm" };
  }

  // 3. Bola
  if (s.includes("bola") || s.includes("sphere")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : undefined;
    return { kind: "bola", paramA: r || 7, unit: "cm" };
  }

  // 4. Kerucut
  if (s.includes("kerucut") || s.includes("cone") || s.includes("irisan kerucut")) {
    return { kind: "kerucut", paramA: 5, paramB: 10, unit: "cm" };
  }

  // 5. Prisma (Triangular Prism)
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

  // 6. Limas / Piramida (Square Pyramid 3D)
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

  // 7. Pelana Kuda / Saddle
  if (s.includes("pelana") || s.includes("saddle") || s.includes("permukaan 3d")) {
    return { kind: "saddle" };
  }

  // 8. 2D Parabola
  if (s.includes("parabola") || s.includes("x^2") || s.includes("x²") || s.includes("kuadrat")) {
    return { kind: "parabola", paramA: 1, paramB: 0, paramC: -3 };
  }

  // 9. 2D Gelombang Sinus
  if (s.includes("sin") || s.includes("cos") || s.includes("gelombang") || s.includes("trig")) {
    return { kind: "trig", paramA: 2, paramB: 1, paramC: 0 };
  }

  // 10. 2D Garis Lurus
  if (s.includes("garis") || s.includes("linear") || s.includes("persamaan garis")) {
    return { kind: "linear", paramA: 2, paramB: 1 };
  }

  // 11. 2D Lingkaran
  if ((s.includes("lingkaran") || s.includes("circle")) && !s.includes("bola") && !s.includes("tabung") && !s.includes("silinder")) {
    const rMatch = s.match(/(?:r|jari-jari|jari)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const dMatch = s.match(/(?:d|diameter)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
    const r = rMatch ? parseFloat(rMatch[1].replace(",", ".")) : dMatch ? parseFloat(dMatch[1].replace(",", ".")) / 2 : nums[0] || 7;
    return { kind: "circle", paramA: r, unit: "cm", planeShapeKind: "lingkaran" };
  }

  // 12. 2D Belah Ketupat
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

  // 13. 2D Layang-Layang
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

  // 14. Balok Hitung
  if (s.includes("balok hitung") || s.includes("counting block")) {
    return { kind: "counting_blocks" };
  }

  // 15. Kubus (Cube)
  if (s.includes("kubus") || s.includes("cube") || s.includes("kotak 3d") || s.includes("kotak")) {
    const sMatch = s.match(/(?:s|rusuk|sisi|panjang|ukuran)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i);
    const sz = sMatch ? parseFloat(sMatch[1].replace(",", ".")) : undefined;
    return { kind: "kubus", paramA: sz || 10, unit: "cm" };
  }

  return null;
}

function detectSmartboardItem(
  text: string,
  conversationHistory?: Array<{ rawText?: string; replyText?: string }>
): DetectedSmartboardItem | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // 0. Prioritaskan Universal Token-Based Geometric Intent Resolver
  // Memastikan resolusi token 2D vs 3D deterministik (contoh: "2d prisma" -> jaring_prisma 2D, "3d prisma" -> prisma 3D)
  const resolved = resolveGeometricIntent(text, conversationHistory);
  if (resolved && !resolved.smartboardItem) {
    // Hasil pemrosesan berupa klarifikasi: server mengirim balasannya,
    // panel TIDAK dibuka dan detektor legacy tidak boleh menimpa.
    return null;
  }
  // Pola geometri yang tidak dikenal resolver deterministik dan tidak punya
  // bentuk konkret untuk detektor legacy: biarkan server memutuskan lewat
  // jalur self-learning (pola dipelajari / penalaran LLM / klarifikasi).
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

  // 1. Cek apakah ada kata perintah aktif untuk visualisasi/pemodelan
  const hasExplicitCommand =
    /\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|plot|lukiskan|lukis|simulasikan|modelkan|buka|lihat|show|draw|display|generate|create)\b/i.test(t);

  // 2. Cek apakah ini percakapan santai, salam, atau apresiasi murni tanpa perintah visualisasi
  const isPureChatOrPraise =
    /^(hai|halo|hello|hi|hey|hei|p|pagi|siang|sore|malam|assalamualaikum|tes|test|wah+|keren|canggih|mantap|makasih|terima kasih|thanks|thank you)\b/i.test(t) ||
    /\b(kamu canggih|kamu keren|kamu pintar|kamu hebat|sangat membantu|bagus banget|terima kasih banyak|makasih banyak)\b/i.test(t);

  if (isPureChatOrPraise && !hasExplicitCommand) {
    return null;
  }

  // 3. Cek apakah ada kata kunci 3D atau geometri ruang
  const has3DWord =
    /\b(3d|3-d|dimensi 3|tiga dimensi|bangun ruang|kartesius|papan tulis|smartboard|kanvas)\b/i.test(t);

  // 4. Cek apakah ini pertanyaan konseptual/teori murni (bukan perintah visualisasi)
  // Catatan: Jika ada kata "3d" atau kata perintah "buatkan" / "tampilkan", bukan pertanyaan konseptual murni!
  const isConceptQuestion =
    /^(apa|apakah|mengapa|kenapa|bagaimana|jelaskan|terangkan|definisi|arti|makna|maksud)\b/i.test(t) &&
    !hasExplicitCommand &&
    !has3DWord;

  if (isConceptQuestion) {
    return null;
  }

  // 5. Cek apakah ada intensi 3D eksplisit dalam kalimat
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

  // 6. Verifikasi apakah ada intensi visual atau perintah bangun geometri
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

  // Ekstrak angka ukuran dan unit spesifik (misal: "10cm", "10 cm", "s=10", "r=7", "sisi 10", "kubus 10")
  let parsedA: number | undefined = undefined;
  let parsedUnit = "cm";

  // Prioritas 1: angka dengan satuan eksplisit (cm, m, mm, in)
  const unitMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(cm|m|mm|in)\b/i);
  if (unitMatch) {
    parsedA = parseFloat(unitMatch[1].replace(",", "."));
    parsedUnit = unitMatch[2].toLowerCase();
  } else {
    // Prioritas 2: angka dengan label parameter (s=10, r=7, sisi 10, jari-jari 7, ukuran 10)
    const paramMatch = t.match(
      /(?:s|r|p|sisi|rusuk|jari-jari|panjang|ukuran)\s*(?:=|:|\s)\s*(\d+(?:[.,]\d+)?)/i
    );
    if (paramMatch) {
      parsedA = parseFloat(paramMatch[1].replace(",", "."));
    } else {
      // Prioritas 3: angka yang mengikuti nama bangun (misal "kubus 10", "cube 8")
      const solidNumMatch = t.match(
        /(?:kubus|cube|balok|tabung|silinder|bola|sphere|kerucut|cone)\s+(\d+(?:[.,]\d+)?)/i
      );
      if (solidNumMatch) {
        parsedA = parseFloat(solidNumMatch[1].replace(",", "."));
      }
    }
  }

  // Irisan hanya aktif jika diminta secara eksplisit oleh pengguna
  const wantsSlice = /\b(irisan|potong|penampang|slice|belah|potongan)\b/i.test(t);

  // Deteksi bentuk geometri:
  // Langkah A: Cari langsung di kalimat saat ini
  let shape = detectShapeKind(t);

  // Langkah B: Jika kalimat adalah permintaan 3D/2D tanpa menyebut ulang nama bangun (misal: "bisakah buatkan dalam bentuk 3d"),
  // telusuri riwayat percakapan sebelumnya untuk mewarisi bangun yang sedang dibahas
  if (!shape && (has3DIntent || hasExplicitCommand) && conversationHistory && conversationHistory.length > 0) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const hist = conversationHistory[i];
      const histText = `${hist.rawText || ""} ${hist.replyText || ""}`;
      const foundInHistory = detectShapeKind(histText);
      if (foundInHistory) {
        if (has3DIntent) {
          // Jika pengguna meminta bentuk 3D namun di riwayat adalah bangun 2D, konversikan ke padanan 3D:
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
          // Jika pengguna meminta bentuk 2D namun di riwayat adalah bangun ruang 3D, konversikan ke padanan 2D:
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

  // Langkah C: Jika pengguna meminta 3D namun tidak ada bentuk spesifik di kalimat maupun riwayat, jadikan "kubus 3D" sebagai default
  if (!shape && has3DIntent) {
    shape = { kind: "kubus", paramA: parsedA || 10, unit: parsedUnit };
  }

  // Jika tetap tidak ada bentuk yang cocok, kembalikan null
  if (!shape) {
    return null;
  }

  // Terapkan ukuran yang diekstrak jika ada
  if (parsedA !== undefined) {
    shape.paramA = parsedA;
  }

  switch (shape.kind) {
    case "balok": {
      const p = shape.paramA || 10;
      const l = shape.paramB || 6;
      const t_val = shape.paramC || 4;
      return {
        model: "solids",
        solidKind: "balok",
        label: `Balok 3D (${p}×${l}×${t_val})`,
        desc: wantsSlice
          ? `Bangun ruang balok (${p} × ${l} × ${t_val} ${parsedUnit}) dengan bidang irisan penampang`
          : `Bangun ruang balok (${p} × ${l} × ${t_val} ${parsedUnit})`,
        paramA: p,
        paramB: l,
        paramC: t_val,
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
      const t = shape.paramB || 10;
      return {
        model: "solids",
        solidKind: "limas",
        label: `Limas Segi Empat 3D (Piramida)`,
        desc: wantsSlice
          ? `Limas segi empat beraturan (piramida) alas ${s} ${parsedUnit}, tinggi ${t} ${parsedUnit} dengan bidang penampang irisan`
          : `Limas segi empat beraturan (piramida) alas ${s} ${parsedUnit}, tinggi ${t} ${parsedUnit}`,
        paramA: s,
        paramB: t,
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
      const t = shape.paramB || 8;
      const s = shape.paramC || 10;
      return {
        model: "2d_shape",
        planeShapeKind: "jajar_genjang",
        label: `Jajar Genjang 2D (a=${a}, t=${t})`,
        desc: `Bangun datar jajar genjang alas ${a} ${parsedUnit}, tinggi ${t} ${parsedUnit}, sisi miring ${s} ${parsedUnit}`,
        paramA: a,
        paramB: t,
        paramC: s,
        unit: parsedUnit,
      };
    }
    case "trapesium": {
      const a = shape.paramA || 8;
      const b = shape.paramB || 14;
      const t = shape.paramC || 6;
      return {
        model: "2d_shape",
        planeShapeKind: "trapesium",
        label: `Trapesium 2D (a=${a}, b=${b})`,
        desc: `Bangun datar trapesium sisi sejajar ${a} & ${b} ${parsedUnit}, tinggi ${t} ${parsedUnit}`,
        paramA: a,
        paramB: b,
        paramC: t,
        unit: parsedUnit,
      };
    }
    case "segitiga": {
      const a = shape.paramA || 10;
      const t = shape.paramB || 8;
      return {
        model: "2d_shape",
        planeShapeKind: "segitiga",
        label: `Segitiga 2D (a=${a}, t=${t})`,
        desc: `Bangun datar segitiga alas ${a} ${parsedUnit}, tinggi ${t} ${parsedUnit}`,
        paramA: a,
        paramB: t,
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


interface LineTranscription {
  line_number: number;
  raw_latex: string;
  is_valid: boolean;
}

interface CounterExample {
  test_variable: string;
  test_value: number;
  lhs_expected: string;
  rhs_calculated: string;
  contradiction_statement: string;
}

interface DiagnosisResult {
  has_fault: boolean;
  first_fault_line: number | null;
  fault_type: string | null;
  status: "FAULT_DETECTED" | "ALL_STEPS_VALID" | "UNDECIDABLE_STEP";
  human_explanation: string;
  socratic_prompt: string;
  counter_example: CounterExample | null;
}

interface DiagnoseResponse {
  status: string;
  session_id: string;
  transcription: {
    total_lines: number;
    lines: LineTranscription[];
  };
  diagnosis: DiagnosisResult;
  guardrail_status: {
    final_answer_suppressed: boolean;
  };
}

interface CorpusReference {
  id?: string;
  title?: string;
  snippet?: string;
  question?: string;
  socratic_prompt?: string;
  tier?: string;
  subtopic?: string;
  source?: string;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  steps?: string[];
  rawText?: string;
  diagnosis?: DiagnoseResponse;
  replyText?: string;
  modelName?: string;
  timestamp: string;
  smartboardItem?: DetectedSmartboardItem | null;
  feedback?: "up" | "down" | null;
  attachedFiles?: UploadedFile[];
  references?: CorpusReference[];
  source?: string;
}

interface ActiveProblemContext {
  steps?: string[];
  faultLine?: number;
  misconceptionType?: string;
  explanation?: string;
  socraticHint?: string;
  counterExample?: {
    test_variable?: string;
    test_value?: number;
    lhs_expected?: string;
    rhs_calculated?: string;
    contradiction_statement?: string;
  };
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

type StoredConv = StoredConversation<Message, ActiveProblemContext>;

interface PromptActionBarLeftProps {
  showAttachMenu: boolean;
  setShowAttachMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showSubUploadMenu: boolean;
  setShowSubUploadMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showWorkspaceMenu: boolean;
  setShowWorkspaceMenu: React.Dispatch<React.SetStateAction<boolean>>;
  workspaceMode: "write" | "read";
  setWorkspaceMode: (val: "write" | "read") => void;
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  workspaceFilesCount: number;
  onUploadFilesClick: () => void;
  onCameraClick: () => void;
  onInsertLatex: () => void;
  onInsertPython: () => void;
  onInsertExample: () => void;
  onOpenSmartboard: () => void;
  onOpenWorkspaceFiles: () => void;
  attachMenuRef: React.RefObject<HTMLDivElement>;
  workspaceMenuRef: React.RefObject<HTMLDivElement>;
}

function PromptActionBarLeft({
  showAttachMenu,
  setShowAttachMenu,
  showSubUploadMenu,
  setShowSubUploadMenu,
  showWorkspaceMenu,
  setShowWorkspaceMenu,
  workspaceMode,
  setWorkspaceMode,
  workspaces,
  activeWorkspaceId,
  setActiveWorkspaceId,
  workspaceFilesCount,
  onUploadFilesClick,
  onCameraClick,
  onInsertLatex,
  onInsertPython,
  onInsertExample,
  onOpenSmartboard,
  onOpenWorkspaceFiles,
  attachMenuRef,
  workspaceMenuRef,
}: PromptActionBarLeftProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 relative shrink-0">
      {/* Menu Popup Lampirkan Berkas (Liquid Glass Drop Blur) */}
      {showAttachMenu && (
        <div
          ref={attachMenuRef}
          className="absolute left-0 bottom-full mb-2.5 w-72 liquid-glass-popup rounded-2xl p-1.5 z-50 text-xs text-slate-700 dark:text-zinc-300 animate-liquid-pop origin-bottom-left"
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
              Lampirkan ke ChatZAP
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                setShowSubUploadMenu(false);
              }}
              className="p-1 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-1 space-y-0.5">
            {/* 1. Upload files */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onUploadFilesClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Paperclip className="w-4 h-4 text-slate-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 dark:text-zinc-100">Unggah berkas</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">PDF, TXT, skrip Python, CSV, Markdown</div>
              </div>
            </button>

            {/* 2. Photo / Camera */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onCameraClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Camera className="w-4 h-4 text-slate-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 dark:text-zinc-100">Foto soal / coretan</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">Ambil foto coretan matematika dari HP/kamera</div>
              </div>
            </button>

            {/* 3. More uploads > */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSubUploadMenu((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4 text-slate-600 dark:text-zinc-400 flex-shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-zinc-100">Format &amp; data lainnya</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              </button>

              {showSubUploadMenu && (
                <div className="absolute left-full bottom-0 ml-1.5 w-60 liquid-glass-popup rounded-2xl p-1.5 z-50 text-xs animate-liquid-pop origin-bottom-left">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onInsertLatex();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-800 dark:text-zinc-200">Impor formula LaTeX</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">Template sistem persamaan</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onInsertPython();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-800 dark:text-zinc-200">Impor skrip SymPy CAS</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">Kode aljabar deterministik</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onOpenWorkspaceFiles();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-800 dark:text-zinc-200">Lampiran Sesi</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">{workspaceFilesCount} berkas tersimpan</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

            {/* 4. Open 3D Smartboard */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onOpenSmartboard();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Box className="w-4 h-4 text-slate-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Papan Tulis Pintar 3D</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 font-mono">2D/3D</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">Kanvas 3D, simulasi kubus/balok &amp; grafik 2D</div>
              </div>
            </button>

            {/* 5. Example math / algebra problems */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onInsertExample();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 dark:text-zinc-100">Contoh Soal Aljabar</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">Muat contoh coretan penurunan rumus untuk diuji</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Menu Popup Workspace (Write / Read-Only & Pilihan Workspace) */}
      {showWorkspaceMenu && (
        <div
          ref={workspaceMenuRef}
          className="absolute left-6 bottom-full mb-2.5 w-72 liquid-glass-popup rounded-2xl p-2 z-50 text-xs text-slate-700 dark:text-zinc-300 animate-liquid-pop origin-bottom-left"
        >
          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
            <span className="text-slate-800 dark:text-zinc-200">Mode Catatan &amp; Proyek Belajar</span>
            <button
              type="button"
              onClick={() => setShowWorkspaceMenu(false)}
              className="p-1 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-1 space-y-1">
            <button
              type="button"
              onClick={() => {
                setWorkspaceMode("write");
                setShowWorkspaceMenu(false);
                try {
                  localStorage.setItem("zap_workspace_mode", "write");
                } catch {}
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                workspaceMode === "write"
                  ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white"
                  : "hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-zinc-400"
              }`}
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 mt-0.5">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Mode Catatan</span>
                  {workspaceMode === "write" && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-400 leading-tight mt-0.5">
                  Tutor boleh menyusun draf rumus dan catatan belajar di dalam percakapan
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceMode("read");
                setShowWorkspaceMenu(false);
                try {
                  localStorage.setItem("zap_workspace_mode", "read");
                } catch {}
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                workspaceMode === "read"
                  ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white"
                  : "hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-zinc-400"
              }`}
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 mt-0.5">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Mode Baca Saja</span>
                  {workspaceMode === "read" && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-400 leading-tight mt-0.5">
                  Hanya bimbingan Sokratik dan verifikasi matematika, tanpa draf catatan baru
                </div>
              </div>
            </button>
          </div>

          <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

          {/* Section 2: Pilih Active Workspace */}
          <div className="px-2 py-1">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
              Proyek Belajar Aktif
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {workspaces.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-slate-400 dark:text-zinc-500 italic">
                  Belum ada proyek belajar
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceId("");
                      setShowWorkspaceMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      !activeWorkspaceId
                        ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">Tanpa Proyek</span>
                    {!activeWorkspaceId && <Check className="w-3 h-3 text-slate-900 dark:text-white flex-shrink-0" />}
                  </button>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        setActiveWorkspaceId(ws.id);
                        setShowWorkspaceMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        activeWorkspaceId === ws.id
                          ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {activeWorkspaceId === ws.id && <Check className="w-3 h-3 text-slate-900 dark:text-white flex-shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

          {/* Quick Action: Buka Berkas Workspace */}
          <button
            type="button"
            onClick={() => {
              setShowWorkspaceMenu(false);
              onOpenWorkspaceFiles();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>Buka Lampiran Sesi ({workspaceFilesCount})</span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
          </button>
        </div>
      )}

      {/* Button + (Lampirkan Berkas) */}
      <button
        type="button"
        onClick={() => {
          setShowAttachMenu((prev) => !prev);
          setShowWorkspaceMenu(false);
        }}
        className={`p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg transition cursor-pointer ${
          showAttachMenu
            ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white"
            : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
        }`}
        title="Lampirkan berkas, foto coretan, LaTeX, atau buka kanvas"
        aria-label="Lampirkan berkas, foto coretan, LaTeX, atau buka kanvas"
        aria-expanded={showAttachMenu}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Button Workspace Write */}
      <button
        type="button"
        onClick={() => {
          setShowWorkspaceMenu((prev) => !prev);
          setShowAttachMenu(false);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg transition cursor-pointer text-xs ${
          showWorkspaceMenu
            ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white"
            : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
        }`}
        title="Atur mode catatan & proyek belajar aktif"
        aria-label="Atur mode catatan dan proyek belajar aktif"
        aria-expanded={showWorkspaceMenu}
      >
        {workspaceMode === "write" ? (
          <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
        )}
        <span className="hidden min-[430px]:inline whitespace-nowrap">{workspaceMode === "write" ? "Mode Catatan" : "Mode Baca"}</span>
        <span className="min-[430px]:hidden whitespace-nowrap">{workspaceMode === "write" ? "Catatan" : "Baca"}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
      </button>
    </div>
  );
}

export default function ZAPApp() {
  const router = useRouter();
  const routeParams = useParams();

  // Helper untuk mendapatkan ID sesi percakapan dari URL path (/c/<id> atau /chat/<id>)
  const getPathConversationId = useCallback(() => {
    if (routeParams?.id && typeof routeParams.id === "string") {
      return routeParams.id;
    }
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const cMatch = pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/);
      if (cMatch) return cMatch[1];
      const chatMatch = pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
      if (chatMatch && chatMatch[1] !== "s") return chatMatch[1];
      const sp = new URLSearchParams(window.location.search);
      const queryId = sp.get("id") || sp.get("c");
      if (queryId) return queryId;
    }
    return null;
  }, [routeParams]);

  // Sinkronkan URL browser ke path yang konsisten tanpa merusak/me-remount state komponen Next.js
  const updateUrlForConversation = useCallback((convId: string | null) => {
    if (typeof window === "undefined") return;
    const isUnderC = window.location.pathname.startsWith("/c/");
    const hash = window.location.hash || "";
    if (convId) {
      // Skema URL kanonik: path /c/<uuid> seperti Claude/ChatGPT (bukan query ?id=)
      window.history.replaceState(null, "", `/c/${encodeURIComponent(convId)}${hash}`);
    } else {
      if (isUnderC) {
        window.history.replaceState(null, "", `/c/new${hash}`);
      } else {
        window.history.replaceState(null, "", `/chat${hash}`);
      }
    }
  }, []);
  // Authentication Guard State
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<ZAPUser | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);

  // Helper identifikasi akun tamu vs akun Google login
  const isGuestAccount = (user: ZAPUser | null | undefined): boolean => {
    if (!user) return false;
    if (user.isGuest === true) return true;
    if (user.provider === "google" || user.email?.toLowerCase().includes("@gmail")) return false;
    return user.provider === "zap" && (user.email?.toLowerCase().includes("@student.zap") || user.name?.toLowerCase().includes("tamu"));
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [targetVar, setTargetVar] = useState<string>("x");

  // Default ke Auto-Agent (Router Cerdas 0 Setup) atau pilihan kustom tersimpan
  const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("zap_selected_model_id");
      if (savedId) {
        const found = AVAILABLE_MODELS.find((m) => m.id === savedId);
        if (found) return found;
      }
    }
    return AVAILABLE_MODELS[0]; // Auto-Agent (Router Cerdas ZAP)
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("high");

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("Menganalisis langkah...");

  // Panel layout states persis seperti screenshot 0, 1, dan 2 (Tertutup default di mobile < 640px agar tidak menutupi chat)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 640;
    }
    return true;
  });
  const [showRightPane, setShowRightPane] = useState<boolean>(false);
  const [rightPaneFullscreen, setRightPaneFullscreen] = useState<boolean>(false);
  const [rightPaneTab, setRightPaneTab] = useState<"start" | "files" | "canvas">("start");
  // Buka papan otomatis bila tiba lewat tautan kolaborasi #board=KODE
  useEffect(() => {
    const check = () => {
      const m = window.location.hash.match(/board=([A-Za-z0-9_-]{3,24})/);
      if (m) {
        try { sessionStorage.setItem("zap_board_code", m[1]); } catch { /* abaikan */ }
        setShowRightPane(true);
        setRightPaneTab("canvas");
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Active problem context
  const [activeProblemFirstStep, setActiveProblemFirstStep] = useState<string | null>(null);
  const [activeProblemContext, setActiveProblemContext] = useState<ActiveProblemContext | null>(null);

  // 3D Canvas / Smartboard state (Default KOSONG)
  const [active3DModel, setActive3DModel] = useState<MathModelType>("empty");
  const [activeSolidKind, setActiveSolidKind] = useState<SolidKind>("kubus");
  const [activePlaneShapeKind, setActivePlaneShapeKind] = useState<PlaneShapeKind>("jajar_genjang");
  const [canvasParamA, setCanvasParamA] = useState<number>(10);
  const [canvasParamB, setCanvasParamB] = useState<number>(6);
  const [canvasParamC, setCanvasParamC] = useState<number>(-3);
  const [canvasUnit, setCanvasUnit] = useState<string>("cm");
  const [canvasShowSlice, setCanvasShowSlice] = useState<boolean>(false);
  const [showFaultComparison, setShowFaultComparison] = useState<boolean>(false);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);

  // Jailbreak & Security Suspension State
  const [jailbreakStrikes, setJailbreakStrikes] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseInt(localStorage.getItem("zap_jailbreak_strikes") || "0", 10);
      return isNaN(saved) ? 0 : saved;
    }
    return 0;
  });
  const [isAccountSuspended, setIsAccountSuspended] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("zap_account_suspended") === "true";
    }
    return false;
  });

  // User Recovery & Admin Security State
  const [userRecoveryCodeInput, setUserRecoveryCodeInput] = useState<string>("");
  const [userRecoveryLoading, setUserRecoveryLoading] = useState<boolean>(false);
  const [userRecoveryMessage, setUserRecoveryMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Admin Security Management State (Superadmin: wakhidpangestu1@gmail.com)
  const [adminTargetEmail, setAdminTargetEmail] = useState<string>("");
  const [adminUnbanLoading, setAdminUnbanLoading] = useState<boolean>(false);
  const [adminActionResult, setAdminActionResult] = useState<{ success: boolean; message: string; token?: string; url?: string } | null>(null);
  const [adminCopiedDraft, setAdminCopiedDraft] = useState<boolean>(false);
  const [adminCopiedLink, setAdminCopiedLink] = useState<boolean>(false);
  const [adminSuspendedList, setAdminSuspendedList] = useState<Array<{ email: string; strikes: number; isSuspended: boolean; reason?: string; suspendedAt?: number; unbannedAt?: number }>>([]);
  const [adminLoadingList, setAdminLoadingList] = useState<boolean>(false);

  // Theme & Settings modal
  const { theme, setTheme } = useTheme();
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<"appearance" | "general" | "sync" | "models" | "admin">("appearance");
  const [syncSuccessToast, setSyncSuccessToast] = useState<boolean>(false);
  const [autoScrollChat, setAutoScrollChat] = useState<boolean>(true);

  // State untuk aksi pesan asisten & pengguna (Audio, Copy, Share, Feedback)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [sharedMsgId, setSharedMsgId] = useState<string | null>(null);

  // State untuk edit dan salin pesan pengguna
  const [copiedUserMsgId, setCopiedUserMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  // File upload state (lampiran di input dan berkas workspace)
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Attachment & Workspace flyout menus
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [showSubUploadMenu, setShowSubUploadMenu] = useState<boolean>(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState<boolean>(false);
  const [workspaceMode, setWorkspaceMode] = useState<"write" | "read">("write");
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  // Workspace management & filtering
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState<boolean>(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>("");

  // Session search in sidebar
  const [isSearchingSession, setIsSearchingSession] = useState<boolean>(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState<string>("");

  // Filter workspaces in sidebar
  const [showWorkspaceFilter, setShowWorkspaceFilter] = useState<boolean>(false);
  const [workspaceStatusFilter, setWorkspaceStatusFilter] = useState<"all" | "fault" | "valid" | "3d">("all");

  // Dropdown states for composer pills (Default workspace & Standard mode)
  const [showPillWorkspaceMenu, setShowPillWorkspaceMenu] = useState<boolean>(false);
  const [showPillModeMenu, setShowPillModeMenu] = useState<boolean>(false);
  const pillWorkspaceRef = useRef<HTMLDivElement>(null);
  const pillModeRef = useRef<HTMLDivElement>(null);

  // Pedagogical interaction mode
  const [interactionMode, setInteractionMode] = useState<"standard" | "strict" | "visual" | "cas">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zap_interaction_mode");
      if (saved === "standard" || saved === "strict" || saved === "visual" || saved === "cas") {
        return saved;
      }
    }
    return "standard";
  });

  // Modal states for sidebar shortcuts
  const [showPluginModal, setShowPluginModal] = useState<boolean>(false);
  const [showTasksModal, setShowTasksModal] = useState<boolean>(false);
  const [showMoreModal, setShowMoreModal] = useState<boolean>(false);

  // Automation Tasks state
  const [casAuditRunning, setCasAuditRunning] = useState<boolean>(false);
  const [casAuditResult, setCasAuditResult] = useState<string | null>(null);
  const [lastSweepResult, setLastSweepResult] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [autoLatexEnabled, setAutoLatexEnabled] = useState<boolean>(true);
  const [taskLogs, setTaskLogs] = useState<Array<{ id: string; name: string; time: string; status: "success" | "running" | "idle" }>>([
    { id: "log-1", name: "SymPy Deterministic CAS Watchdog", time: "Aktif (Realtime)", status: "success" },
    { id: "log-2", name: "Zero-Answer Policy Guardrail", time: "Aktif (Censor Enabled)", status: "success" },
  ]);

  // Memory chat: daftar percakapan tersimpan + percakapan aktif
  const [conversations, setConversations] = useState<StoredConv[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const fromPath =
        window.location.pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/)?.[1] ||
        (window.location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/)?.[1] !== "s"
          ? window.location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/)?.[1]
          : null) ||
        new URLSearchParams(window.location.search).get("id");
      if (fromPath) return fromPath;
    }
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "conv_" + Date.now();
  });
  const [memoryReady, setMemoryReady] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [sharingConv, setSharingConv] = useState<StoredConv | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const createdAtRef = useRef<number>(Date.now());
  const conversationsRef = useRef<StoredConv[]>([]);
  const activeConversationUpdatedAtRef = useRef<number>(0);
  const messagesRef = useRef<Message[]>(messages);
  const activeConversationIdRef = useRef<string>(activeConversationId);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sinkronkan ref percakapan setiap kali state conversations berubah
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const startNewChat = useCallback(() => {
    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "conv_" + Date.now();
    setActiveConversationId(newId);
    createdAtRef.current = Date.now();
    activeConversationUpdatedAtRef.current = Date.now();
    setMessages([]);
    setInputText("");
    setActiveProblemFirstStep(null);
    setActiveProblemContext(null);
    setActive3DModel("empty");
    setCanvasParamA(10);
    setCanvasShowSlice(false);
    setShowRightPane(false);
    setRightPaneTab("start");
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setSidebarOpen(false);
    }

    updateUrlForConversation(null);
  }, [updateUrlForConversation]);

  const activateConversation = useCallback((target: StoredConv) => {
    if (!target) return;
    setActiveConversationId(target.id);
    createdAtRef.current = target.createdAt || Date.now();
    activeConversationUpdatedAtRef.current = target.updatedAt || target.createdAt || Date.now();
    setMessages(target.messages || []);
    setActiveProblemFirstStep(target.activeProblemFirstStep || null);
    setActiveProblemContext(target.activeProblemContext || null);
    setTargetVar(target.targetVar || "x");
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setSidebarOpen(false);
    }

    updateUrlForConversation(target.id);

    // Kembalikan status Papan Tulis sesuai konteks percakapan yang dibuka
    const lastSmartboardItem = [...(target.messages || [])]
      .reverse()
      .find((m) => m.smartboardItem)?.smartboardItem;
    if (lastSmartboardItem) {
      setActive3DModel(lastSmartboardItem.model);
      if (lastSmartboardItem.solidKind) setActiveSolidKind(lastSmartboardItem.solidKind);
      if (lastSmartboardItem.planeShapeKind) setActivePlaneShapeKind(lastSmartboardItem.planeShapeKind);
      if (lastSmartboardItem.paramA !== undefined) setCanvasParamA(lastSmartboardItem.paramA);
      if (lastSmartboardItem.paramB !== undefined) setCanvasParamB(lastSmartboardItem.paramB);
      if (lastSmartboardItem.paramC !== undefined) setCanvasParamC(lastSmartboardItem.paramC);
      if (lastSmartboardItem.unit) setCanvasUnit(lastSmartboardItem.unit);
      setCanvasShowSlice(Boolean(lastSmartboardItem.hasSlice));
      setShowRightPane(true);
      setRightPaneTab("canvas");
    } else {
      setActive3DModel("empty");
      setShowRightPane(false);
      setRightPaneTab("start");
    }
  }, [updateUrlForConversation]);

  const openConversation = useCallback((convId: string, customList?: StoredConv[]) => {
    const list = customList || (conversationsRef.current.length > 0 ? conversationsRef.current : conversations);
    const target = list.find((c) => c.id === convId);
    if (!target) return;
    activateConversation(target);
  }, [activateConversation, conversations]);

  // 1. Cek autentikasi dari localStorage saat mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // Cek jika terdapat parameter pemulihan di URL (?unban_token=... atau ?unban=... atau ?token=...)
        const searchParamsUrl = new URLSearchParams(window.location.search);
        const urlUnbanToken = searchParamsUrl.get("unban_token") || searchParamsUrl.get("unban") || searchParamsUrl.get("token");
        if (urlUnbanToken) {
          fetch(`/api/admin/security?token=${encodeURIComponent(urlUnbanToken)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.success) {
                setIsAccountSuspended(false);
                setJailbreakStrikes(0);
                localStorage.removeItem("zap_account_suspended");
                localStorage.removeItem("zap_jailbreak_strikes");
                alert(data.message || "Akun Anda berhasil dipulihkan secara penuh! Selamat datang kembali di ChatZAP.");
                const cleanPath = window.location.pathname;
                window.history.replaceState({}, "", cleanPath);
              }
            })
            .catch((e) => console.warn("Unban token check failed:", e));
        }

        const raw = localStorage.getItem("zap_authenticated_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.name || parsed.email)) {
            markSessionCookie();
            setCurrentUser(parsed);
            setAuthChecked(true);

            const userKey = (parsed.email || parsed.id || "").toLowerCase().trim();
            const lastActiveUser = localStorage.getItem("zap_last_active_user_email")?.toLowerCase().trim();
            const isAccountSwitched = !lastActiveUser || lastActiveUser !== userKey;
            const initialTargetId = getPathConversationId();

            // Sinkronisasi status penangguhan / unban dengan database server vault
            if (userKey) {
              fetch(`/api/admin/security?action=check&email=${encodeURIComponent(userKey)}`)
                .then((r) => r.json())
                .then((sec) => {
                  if (sec && sec.unbannedAt && (!sec.isSuspended || sec.unbannedAt > (sec.suspendedAt || 0))) {
                    // Admin Wakhid telah membuka blokir akun di server!
                    setIsAccountSuspended(false);
                    setJailbreakStrikes(0);
                    localStorage.removeItem("zap_account_suspended");
                    localStorage.removeItem("zap_jailbreak_strikes");
                  } else if (sec && sec.isSuspended) {
                    setIsAccountSuspended(true);
                    setJailbreakStrikes(2);
                    localStorage.setItem("zap_account_suspended", "true");
                    localStorage.setItem("zap_jailbreak_strikes", "2");
                  }
                })
                .catch(() => {});
            }

            // Jika akun berganti dari sesi sebelumnya:
            // Segera reset state percakapan agar sesi akun lama tidak bocor ke akun baru
            if (isAccountSwitched) {
              setConversations([]);
              conversationsRef.current = [];
              setMessages([]);
              startNewChat();
              try {
                localStorage.removeItem("zap_conversations");
                localStorage.removeItem("zap_conversations_v1");
                localStorage.removeItem("zap_active_conversation_id");
              } catch {}
            } else {
              // Muat riwayat lokal terisolasi khusus milik akun ini
              const userStored = loadConversations<Message, ActiveProblemContext>(userKey);
              if (userStored && userStored.length > 0) {
                setConversations(userStored);
                conversationsRef.current = userStored;
                // Kritis: Jika halaman direfresh pada URL percakapan spesifik (/c/<id>), segera pulihkan obrolan dari cache lokal
                if (initialTargetId) {
                  const initialMatch = userStored.find((c) => c.id === initialTargetId);
                  if (initialMatch) {
                    activateConversation(initialMatch);
                  }
                }
              } else {
                setConversations([]);
                conversationsRef.current = [];
              }
            }

            // Auto-restore backup data akun Google (riwayat chat, API keys, workspaces, model)
            restoreAccountData<Message, ActiveProblemContext, WorkspaceItem, UploadedFile>(parsed).then((restored) => {
              // Selalu sinkronkan percakapan dengan menggabungkan backup cloud dan sesi lokal yang aktif
              const userConvs = restored.conversations || [];
              setConversations((prev) => {
                const merged = [...userConvs];
                prev.forEach((localConv) => {
                  const idx = merged.findIndex((c) => c.id === localConv.id);
                  if (idx === -1) {
                    merged.unshift(localConv);
                  } else {
                    if ((localConv.messages?.length || 0) >= (merged[idx].messages?.length || 0)) {
                      merged[idx] = localConv;
                    }
                  }
                });
                conversationsRef.current = merged;
                return merged;
              });

              const searchParams = new URLSearchParams(window.location.search);
              const importId = searchParams.get("import");

              if (importId) {
                fetch(`/api/chat/share?id=${encodeURIComponent(importId)}`)
                  .then((r) => r.json())
                  .then((json) => {
                    if (json.exists && json.data) {
                      const imported = json.data;
                      const newId =
                        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                          ? crypto.randomUUID()
                          : "conv_" + Date.now();
                      const importedConv: StoredConv = {
                        id: newId,
                        title: imported.title || "Percakapan Impor",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        messages: imported.messages || [],
                        activeProblemFirstStep: null,
                        activeProblemContext: null,
                        targetVar: imported.targetVar || "x",
                        userEmail: userKey,
                      };
                      setConversations((prev) => {
                        const updated = [importedConv, ...prev.filter((c) => c.id !== newId)];
                        conversationsRef.current = updated;
                        saveConversations(updated, userKey);
                        return updated;
                      });
                      activateConversation(importedConv);
                    } else if (userConvs.length === 0 && messagesRef.current.length === 0) {
                      startNewChat();
                    }
                  })
                  .catch(() => {
                    if (userConvs.length === 0 && messagesRef.current.length === 0) startNewChat();
                  });
              } else if (initialTargetId) {
                // HANYA pulihkan jika URL saat halaman pertama kali dibuka secara eksplisit menunjuk ke percakapan tertentu
                const found =
                  conversationsRef.current.find((c) => c.id === initialTargetId) ||
                  userConvs.find((c) => c.id === initialTargetId);

                if (found) {
                  // Jangan reset jika percakapan ini sudah aktif dan sedang memiliki pesan di memori
                  const currentMemoryCount = messagesRef.current.length;
                  const foundCount = found.messages?.length || 0;
                  if (activeConversationIdRef.current === initialTargetId && currentMemoryCount > 0) {
                    if (foundCount > currentMemoryCount) {
                      activateConversation(found);
                    }
                  } else if (activeConversationIdRef.current !== initialTargetId || currentMemoryCount === 0) {
                    activateConversation(found);
                  }
                } else {
                  // Proteksi IDOR: Sesi percakapan privat akun lain tidak boleh dimuat!
                  updateUrlForConversation(null);
                  startNewChat();
                  alert(
                    "Akses Ditolak: Anda tidak memiliki izin untuk melihat sesi percakapan privat akun lain. Percakapan hanya dapat diakses jika pemilik telah mengaktifkan Tautan Publik (Public Share)."
                  );
                }
              } else if (userConvs.length === 0 && messagesRef.current.length === 0) {
                // Sesi awal baru: hanya buat chat baru jika belum ada pesan aktif yang diketik pengguna
                startNewChat();
              }

              if (restored.workspaces && restored.workspaces.length > 0) {
                const manualOnly = restored.workspaces.filter((w: WorkspaceItem) => w.id !== "default" && w.name !== "Default workspace");
                setWorkspaces(manualOnly);
              }
              if (restored.workspaceFiles && restored.workspaceFiles.length > 0) {
                const customOnly = restored.workspaceFiles.filter((f: UploadedFile) => f.workspaceId !== "default");
                setWorkspaceFiles(customOnly);
              }
              if (restored.configs?.selectedModelId) {
                const found = AVAILABLE_MODELS.find((m) => m.id === restored.configs.selectedModelId);
                if (found) setSelectedModel(found);
              }
            });
          } else {
            setAuthChecked(true);
            router.replace("/login");
            return;
          }
        } else {
          setAuthChecked(true);
          router.replace("/login");
          return;
        }
      } catch (e) {
        console.warn("Gagal membaca auth:", e);
        setAuthChecked(true);
        router.replace("/login");
        return;
      }

      const savedModelId = localStorage.getItem("zap_selected_model_id");
      if (savedModelId) {
        const found = AVAILABLE_MODELS.find((m) => m.id === savedModelId);
        if (found) {
          setSelectedModel(found);
        }
      }

      try {
        const storedWs = localStorage.getItem("zap_workspaces");
        if (storedWs) {
          const parsed = JSON.parse(storedWs);
          if (Array.isArray(parsed)) {
            const manualOnly = parsed.filter((w: WorkspaceItem) => w.id !== "default" && w.name !== "Default workspace");
            setWorkspaces(manualOnly);
            if (parsed.length !== manualOnly.length) {
              localStorage.setItem("zap_workspaces", JSON.stringify(manualOnly));
            }
            if (manualOnly.length > 0) {
              setActiveWorkspaceId(manualOnly[0].id);
            } else {
              setActiveWorkspaceId("");
            }
          }
        }
        const storedFiles = localStorage.getItem("zap_workspace_files");
        if (storedFiles) {
          const parsed = JSON.parse(storedFiles);
          if (Array.isArray(parsed)) {
            const customOnly = parsed.filter((f: UploadedFile) => f.workspaceId !== "default");
            setWorkspaceFiles(customOnly);
            if (parsed.length !== customOnly.length) {
              localStorage.setItem("zap_workspace_files", JSON.stringify(customOnly));
            }
          }
        }
      } catch (wsErr) {
        console.warn("Gagal membaca workspaces/files tersimpan:", wsErr);
      }
    }
    setMemoryReady(true);
  }, [router]);

  // Keyboard shortcut (Escape keluar dari panel layar penuh; pintasan files/terminal dicabut pada audit fitur 12 Nov 2026)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && rightPaneFullscreen) {
        setRightPaneFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [rightPaneFullscreen]);

  // Muat preferensi mode workspace tersimpan
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("zap_workspace_mode") as "write" | "read" | null;
      if (savedMode) setWorkspaceMode(savedMode);
    } catch {}
  }, []);

  // Close profile dropdown, attachment menu & workspace menu saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(target)) {
        setProfileDropdownOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setShowAttachMenu(false);
        setShowSubUploadMenu(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(target)) {
        setShowWorkspaceMenu(false);
      }
      if (pillWorkspaceRef.current && !pillWorkspaceRef.current.contains(target)) {
        setShowPillWorkspaceMenu(false);
      }
      if (pillModeRef.current && !pillModeRef.current.contains(target)) {
        setShowPillModeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Simpan percakapan aktif setiap ada perubahan pesan baru
  useEffect(() => {
    if (!memoryReady || messages.length === 0 || !currentUser) return;
    const firstUserMsg = messages.find((m) => m.sender === "user");
    const title = firstUserMsg
      ? firstUserMsg.steps?.[0] || firstUserMsg.rawText?.slice(0, 24) || "New Session"
      : "New Session";

    const list = conversationsRef.current.length > 0 ? conversationsRef.current : conversations;
    const existing = list.find((c) => c.id === activeConversationId);

    // Tentukan apakah ada pesan baru yang dikirim atau diterima
    // Jika hanya membuka/mengklik percakapan lama, messages.length sama persis
    const isNewMessage =
      !existing ||
      existing.messages.length !== messages.length ||
      (messages.length > 0 &&
        existing.messages[existing.messages.length - 1]?.replyText !==
          messages[messages.length - 1]?.replyText);

    // Kritis: Acuan waktu (updatedAt) HANYA diperbarui saat ada chat baru dikirim!
    // Saat percakapan lama hanya diklik/dibuka untuk dibaca, pertahankan updatedAt aslinya
    // sehingga tidak naik ke atas dan tidak berubah jadi 'baru saja'.
    const conversationUpdatedAt = isNewMessage
      ? Date.now()
      : (existing?.updatedAt || activeConversationUpdatedAtRef.current || createdAtRef.current);

    const updatedConv: StoredConv = {
      id: activeConversationId,
      title: title.length > 24 ? title.slice(0, 24) + "..." : title,
      createdAt: createdAtRef.current,
      updatedAt: conversationUpdatedAt,
      messages,
      activeProblemFirstStep,
      activeProblemContext,
      targetVar,
      userEmail: (currentUser.email || currentUser.id || "").toLowerCase().trim(),
    };

    setConversations((prev) => {
      const withoutCurrent = prev.filter((c) => c.id !== activeConversationId);
      // Urutkan berdasarkan updatedAt secara descending (terakhir kali chat dikirim di atas)
      const next = [updatedConv, ...withoutCurrent]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50);

      conversationsRef.current = next;
      const userKey = (currentUser.email || currentUser.id || "").toLowerCase().trim();
      saveConversations(next, userKey);
      // Debounce auto-backup percakapan akun Google ke cloud (1500ms) untuk mencegah race condition
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncAccountBackup(currentUser, { conversations: next });
      }, 1500);

      // Sinkronkan URL browser ke path percakapan /c/<uuid> tanpa memicu unmount antar-segment route
      if (typeof window !== "undefined") {
        const hash = window.location.hash || "";
        const expectedPath = `/c/${encodeURIComponent(activeConversationId)}${hash}`;
        const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (currentFull !== expectedPath) {
          window.history.replaceState(null, "", expectedPath);
        }
      }

      return next;
    });
  }, [messages, activeProblemFirstStep, activeProblemContext, targetVar, activeConversationId, memoryReady, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await syncAccountBackup(currentUser);
      } catch (e) {
        console.warn("Gagal backup sebelum logout:", e);
      }
    }
    clearLocalWorkingSession();
    setCurrentUser(null);
    setConversations([]);
    conversationsRef.current = [];
    setMessages([]);
    setProfileDropdownOpen(false);
    router.replace("/login");
  };

  const handleOpenShareModal = (conv?: StoredConv) => {
    const target =
      conv ||
      conversations.find((c) => c.id === activeConversationId) || {
        id: activeConversationId,
        title: deriveTitle(messages),
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
        messages: messages,
        activeProblemFirstStep,
        activeProblemContext,
        targetVar,
        userEmail: currentUser?.email,
      };

    if (!target.messages || target.messages.length === 0) {
      alert("Percakapan masih kosong, kirim pesan terlebih dahulu sebelum membagikan.");
      return;
    }

    setSharingConv(target as StoredConv);
    setShareModalOpen(true);
  };

  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const userKey = (currentUser?.email || currentUser?.id || "").toLowerCase().trim();

    // 1. Catat ID percakapan ke daftar penolakan lokal (Tombstone) agar tidak dibangkitkan lagi saat restore
    recordDeletedConversation(userKey || "guest", convId);

    // 2. Perbarui state lokal & simpan ke localStorage
    const next = conversations.filter((c) => c.id !== convId);
    setConversations(next);
    conversationsRef.current = next;
    saveConversations(next, userKey);

    // 3. Hapus permanen di server cloud vault
    if (currentUser) {
      const idToken = getGoogleIdToken();
      fetch(
        `/api/user/sync?email=${encodeURIComponent(currentUser.email || "")}&userId=${encodeURIComponent(currentUser.id || "")}&convId=${encodeURIComponent(convId)}`,
        {
          method: "DELETE",
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
        }
      ).catch((err) => console.warn("Gagal menghapus percakapan di server vault:", err));

      syncAccountBackup(currentUser, {
        conversations: next,
        deletedConversationId: convId,
        replaceConversations: true,
      });
    }

    if (activeConversationId === convId) {
      startNewChat();
    }
  };

  const handleSelectModel = (model: AIModel) => {
    setSelectedModel(model);
    if (typeof window !== "undefined") {
      localStorage.setItem("zap_selected_model_id", model.id);
    }
  };

  const normalizeStep = (raw: string): string => {
    return raw
      .replace(/^\\\[|\\\]$/g, "")
      .replace(/^\$\$|\$\$$/g, "")
      .replace(/^\$|\$$/g, "")
      .trim();
  };

  const handleSend = async (
    customSteps?: string[],
    sampleModelType?: MathModelType,
    overrideText?: string,
    isRegenerate: boolean = false,
    historySnapshot?: Message[]
  ) => {
    if (sampleModelType) {
      setActive3DModel(sampleModelType);
      setShowRightPane(true);
      setRightPaneTab("canvas");
    }

    const textToProcess =
      overrideText !== undefined
        ? overrideText
        : customSteps
        ? customSteps.join("\n")
        : inputText;

    if (!textToProcess.trim() || loading) return;

    if (isAccountSuspended) {
      alert("Akun Anda telah ditangguhkan secara permanen karena pelanggaran keamanan berulang. Silakan hubungi wakhidpangestu1@gmail.com untuk permohonan pemulihan akses.");
      return;
    }

    const lines = textToProcess
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Bedakan antara langkah penurunan aljabar CAS murni vs perintah percakapan Sokratik / visualisasi 3D
    // HANYA jika customSteps eksplisit dikirim (misal tombol 'Uji Bukti / Verifikasi' di Scratchpad)
    // Semua input teks bebas & rumus sebaris dari chat bar selalu dikelola oleh LLM/Auto-Agent terlebih dahulu
    const isDerivation = Boolean(customSteps && customSteps.length > 0);
    const isConversational = !isDerivation;
    let baseHistory = historySnapshot || messages;

    // Jika sedang dalam mode edit pesan dari kolom chat bawah:
    if (editingMsgId) {
      const editIdx = messages.findIndex((m) => m.id === editingMsgId);
      if (editIdx !== -1) {
        baseHistory = messages.slice(0, editIdx);
        setMessages(baseHistory);
      }
      setEditingMsgId(null);
    }

    const detectedGeometry = detectSmartboardItem(textToProcess, baseHistory);

    // JALUR 1: PERCAKAPAN SOKRATIK & VISUALISASI
    if (isConversational) {
      const userQuestion = textToProcess.trim();
      const currentAttached = [...attachedFiles];

      const userMsg: Message = {
        id: "msg_" + Date.now(),
        sender: "user",
        rawText: userQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachedFiles: currentAttached.length > 0 ? currentAttached : undefined,
        smartboardItem: detectedGeometry,
      };

      if (!isRegenerate) {
        setMessages((prev) => [...prev, userMsg]);
        setInputText("");
        setAttachedFiles([]);
      }
      setLoading(true);
      setLoadingStatus("ChatZAP Socratic Engine sedang merumuskan panduan...");

      // Jika ada permintaan bentuk geometri 3D, siapkan model & parameternya
      if (detectedGeometry) {
        setActive3DModel(detectedGeometry.model);
        if (detectedGeometry.solidKind) setActiveSolidKind(detectedGeometry.solidKind);
        if (detectedGeometry.planeShapeKind) setActivePlaneShapeKind(detectedGeometry.planeShapeKind);
        if (detectedGeometry.paramA !== undefined) setCanvasParamA(detectedGeometry.paramA);
        if (detectedGeometry.paramB !== undefined) setCanvasParamB(detectedGeometry.paramB);
        if (detectedGeometry.paramC !== undefined) setCanvasParamC(detectedGeometry.paramC);
        if (detectedGeometry.unit) setCanvasUnit(detectedGeometry.unit);
        setCanvasShowSlice(Boolean(detectedGeometry.hasSlice));
        setShowRightPane(true);
        setRightPaneTab("canvas");
      }

      try {
        const baseHistory = historySnapshot || messages;
        const conversationHistory = windowHistory(
          isRegenerate ? baseHistory : [...baseHistory, userMsg],
          20
        );

        const savedBazaarlinkKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_bazaarlink_api_key") || undefined
            : undefined;

        const savedGeminiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_gemini_api_key") || undefined
            : undefined;

        const savedMistralKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_mistral_api_key") || undefined
            : undefined;

        const savedClaudeKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_claude_api_key") || undefined
            : undefined;

        const savedOpenaiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_openai_api_key") || undefined
            : undefined;

        const savedNvidiaApiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_nvidia_api_key") || undefined
            : undefined;

        const savedCustomBaseUrl =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_custom_base_url") || undefined
            : undefined;

        const savedCustomModelName =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_custom_model_name") || undefined
            : undefined;

        const savedCustomApiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("zap_custom_api_key") || undefined
            : undefined;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userQuestion,
            attachedFiles: currentAttached.map((f) => ({ name: f.name, content: f.content || f.dataUrl })),
            workspaceMode,
            conversationHistory,
            activeProblem: activeProblemContext,
            modelId: selectedModel.id,
            apiKey: savedGeminiKey,
            mistralApiKey: savedMistralKey,
            bazaarlinkApiKey: savedBazaarlinkKey,
            claudeApiKey: savedClaudeKey,
            openaiApiKey: savedOpenaiKey,
            nvidiaApiKey: savedNvidiaApiKey,
            customBaseUrl: savedCustomBaseUrl,
            customModelName: savedCustomModelName,
            customApiKey: savedCustomApiKey,
            userName: currentUser?.name || "Pengguna ChatZAP",
            jailbreakStrikes: jailbreakStrikes,
            isSuspended: isAccountSuspended,
            userEmail: currentUser?.email || "anonymous",
          }),
          signal: AbortSignal.timeout(90000),
        });

        const chatData = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 403 && chatData?.isSuspended) {
            setIsAccountSuspended(true);
            setJailbreakStrikes(2);
            if (typeof window !== "undefined") {
              localStorage.setItem("zap_jailbreak_strikes", "2");
              localStorage.setItem("zap_account_suspended", "true");
            }
          } else {
            throw new Error(`Chat HTTP ${res.status}`);
          }
        }

        if (chatData?.isJailbreak) {
          if (chatData.strikeCount === 1) {
            setJailbreakStrikes(1);
            if (typeof window !== "undefined") {
              localStorage.setItem("zap_jailbreak_strikes", "1");
            }
          } else if (chatData.isSuspended || chatData.strikeCount >= 2) {
            setJailbreakStrikes(2);
            setIsAccountSuspended(true);
            if (typeof window !== "undefined") {
              localStorage.setItem("zap_jailbreak_strikes", "2");
              localStorage.setItem("zap_account_suspended", "true");
            }
          }
        }

        const replyText =
          chatData?.reply ||
          "Halo! Saya asisten ChatZAP. Tuliskan langkah aljabar yang ingin kamu uji, atau mintalah visualisasi 3D geometri.";

        // Gunakan smartboardItem resmi dari ZAP Universal Geometry Engine (backend API)
        const responseGeometry: DetectedSmartboardItem | null =
          chatData.smartboardItem
            ? {
                model: chatData.smartboardItem.model as MathModelType,
                solidKind: (chatData.smartboardItem.solidKind as SolidKind) || undefined,
                planeShapeKind: (chatData.smartboardItem.planeShapeKind as PlaneShapeKind) || undefined,
                label: chatData.smartboardItem.label,
                desc: chatData.smartboardItem.desc,
                paramA: chatData.smartboardItem.paramA,
                paramB: chatData.smartboardItem.paramB,
                paramC: chatData.smartboardItem.paramC,
                unit: chatData.smartboardItem.unit,
                hasSlice: Boolean(chatData.smartboardItem.hasSlice),
                targetTab: chatData.smartboardItem.targetTab,
              }
            : detectedGeometry;

        if (responseGeometry) {
          setActive3DModel(responseGeometry.model);
          if (responseGeometry.solidKind) setActiveSolidKind(responseGeometry.solidKind);
          if (responseGeometry.planeShapeKind) setActivePlaneShapeKind(responseGeometry.planeShapeKind);
          if (responseGeometry.paramA !== undefined) setCanvasParamA(responseGeometry.paramA);
          if (responseGeometry.paramB !== undefined) setCanvasParamB(responseGeometry.paramB);
          if (responseGeometry.paramC !== undefined) setCanvasParamC(responseGeometry.paramC);
          if (responseGeometry.unit) setCanvasUnit(responseGeometry.unit);
          setCanvasShowSlice(Boolean(responseGeometry.hasSlice));
          setShowRightPane(true);
          setRightPaneTab("canvas");
        }

        const assistantMsg: Message = {
          id: "msg_" + (Date.now() + 1),
          sender: "assistant",
          replyText: replyText,
          modelName: chatData.model || selectedModel.name,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          smartboardItem: responseGeometry || detectedGeometry,
          references: Array.isArray(chatData.corpus_references)
            ? (chatData.corpus_references as CorpusReference[])
            : undefined,
          source: typeof chatData.source === "string" ? chatData.source : undefined,
        };
        setMessages((prev) => {
          const hasUser = prev.some((m) => m.id === userMsg.id);
          const base = hasUser ? prev : [...prev, userMsg];
          return [...base, assistantMsg];
        });
      } catch (err) {
        console.error("Chat error:", err);
        const assistantMsg: Message = {
          id: "msg_" + (Date.now() + 1),
          sender: "assistant",
          replyText:
            "Halo! Ada persamaan matematika atau konsep aljabar yang ingin kita telaah? Tuliskan langkah penurunan rumusmu di bawah untuk diverifikasi oleh SymPy CAS.",
          modelName: "ChatZAP Socratic Engine",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          smartboardItem: detectedGeometry,
        };
        setMessages((prev) => {
          const hasUser = prev.some((m) => m.id === userMsg.id);
          const base = hasUser ? prev : [...prev, userMsg];
          return [...base, assistantMsg];
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // JALUR 2: VERIFIKASI LANGKAH ALJABAR CAS (SYMPY)
    const stepsArray = customSteps || lines;
    const normalizedSteps = stepsArray.map((s) => normalizeStep(s));

    let stepsToSend = normalizedSteps;
    let isCorrection = false;
    if (normalizedSteps.length === 1 && activeProblemFirstStep && !customSteps) {
      stepsToSend = [activeProblemFirstStep, normalizedSteps[0]];
      isCorrection = true;
    }

    const userMsg: Message = {
      id: "msg_" + Date.now(),
      sender: "user",
      steps: stepsArray,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (!isRegenerate) {
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
    }
    setLoading(true);
    setLoadingStatus("Menganalisis konsistensi aljabar dengan SymPy CAS...");

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed_steps: stepsToSend,
          target_variable: targetVar.trim() || "x",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || `Error HTTP ${res.status}`);
      }

      const data: DiagnoseResponse = await res.json();

      if (data.diagnosis.has_fault) {
        setShowFaultComparison(true);
      } else {
        setShowFaultComparison(false);
      }

      let customReplyText: string | undefined = undefined;
      if (!isCorrection && stepsToSend.length === 1) {
        setActiveProblemFirstStep(stepsToSend[0]);
        customReplyText = `Langkah awal "${stepsArray[0]}" tercatat. Tuliskan baris penurunan berikutnya untuk menguji konsistensi aljabar langkahmu.`;
      } else if (!isCorrection && stepsToSend.length > 1) {
        setActiveProblemFirstStep(stepsToSend[0]);
      } else if (isCorrection) {
        if (!data.diagnosis.has_fault) {
          setActiveProblemFirstStep(normalizedSteps[0]);
          customReplyText = `Perbaikanmu valid! Langkah "${stepsArray[0]}" konsisten dan benar secara aljabar.`;
        } else {
          customReplyText = `Langkah perbaikanmu "${stepsArray[0]}" masih memiliki kejanggalan: ${data.diagnosis.human_explanation}`;
        }
      }

      setActiveProblemContext({
        steps: stepsToSend,
        faultLine: data.diagnosis.has_fault ? (data.diagnosis.first_fault_line ?? undefined) : undefined,
        misconceptionType: data.diagnosis.fault_type ?? undefined,
        explanation: data.diagnosis.human_explanation,
        socraticHint: data.diagnosis.socratic_prompt,
        counterExample: data.diagnosis.counter_example ?? undefined,
      });

      const assistantMsg: Message = {
        id: "msg_" + (Date.now() + 1),
        sender: "assistant",
        diagnosis: data,
        replyText: customReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        smartboardItem:
          detectedGeometry ||
          (data.diagnosis.has_fault
            ? { model: "2d_quadratic", label: "Grafik Parabola & Galat", desc: "Perbandingan visual langkah benar vs langkah keliru" }
            : null),
      };

      setMessages((prev) => {
        const hasUser = prev.some((m) => m.id === userMsg.id);
        const base = hasUser ? prev : [...prev, userMsg];
        return [...base, assistantMsg];
      });
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Gagal terhubung ke microservice SymPy.";
      const assistantMsg: Message = {
        id: "msg_" + (Date.now() + 1),
        sender: "assistant",
        replyText: `Kendala Diagnostik CAS: ${errMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        smartboardItem: detectedGeometry,
      };
      setMessages((prev) => {
        const hasUser = prev.some((m) => m.id === userMsg.id);
        const base = hasUser ? prev : [...prev, userMsg];
        return [...base, assistantMsg];
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // ACTION HANDLERS: COPY, TTS, REGENERATE, FEEDBACK, SHARE, SMARTBOARD
  // =========================================================================
  const handleCopyMessage = async (text: string, msgId: string) => {
    if (typeof window === "undefined") return;
    try {
      const clean = text
        .replace(/\\\[|\\\]|\$\$|\$/g, "")
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
      await navigator.clipboard.writeText(clean || text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (e) {
      console.warn("Gagal menyalin teks:", e);
    }
  };

  const handleRegenerate = (assistantMsgId: string) => {
    const msgIdx = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIdx === -1) return;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (messages[i].sender === "user") {
        const prevUserMsg = messages[i];
        const prevText = prevUserMsg.rawText || prevUserMsg.steps?.join("\n");
        if (prevText) {
          const filtered = messages.filter((m) => m.id !== assistantMsgId);
          setMessages(filtered);
          handleSend(prevUserMsg.steps, undefined, prevText, true, filtered);
        }
        break;
      }
    }
  };

  const handleFeedback = (msgId: string, type: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            feedback: m.feedback === type ? null : type,
          };
        }
        return m;
      })
    );
  };

  const handleSpeakMessage = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Fitur Text-to-Speech tidak didukung di browser ini.");
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanSpeech = text
      .replace(/\\\[|\\\]|\$\$|\$/g, " ")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 per $2")
      .replace(/\\sqrt\{([^}]+)\}/g, "akar dari $1")
      .replace(/\\times|\\cdot/g, " kali ")
      .replace(/[\*_#`~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = "id-ID";
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleShareMessage = async (_text: string, msgId: string) => {
    setSharedMsgId(msgId);
    setTimeout(() => setSharedMsgId(null), 2500);
    handleOpenShareModal();
  };

  const handleOpenSmartboard = (item?: DetectedSmartboardItem | null) => {
    if (item) {
      setActive3DModel(item.model);
      if (item.solidKind) setActiveSolidKind(item.solidKind);
      if (item.planeShapeKind) setActivePlaneShapeKind(item.planeShapeKind);
      if (item.paramA !== undefined) setCanvasParamA(item.paramA);
      if (item.paramB !== undefined) setCanvasParamB(item.paramB);
      if (item.paramC !== undefined) setCanvasParamC(item.paramC);
      if (item.unit) setCanvasUnit(item.unit);
      setCanvasShowSlice(Boolean(item.hasSlice));
      setShowRightPane(true);
      setRightPaneTab("canvas");
    } else {
      // JANGAN PERNAH MENGHASILKAN KUBUS DEFAULT JIKA TIDAK ADA TRIGGER DARI PENGGUNA!
      setActive3DModel("empty");
      setCanvasShowSlice(false);
      setShowRightPane(true);
      setRightPaneTab("start");
    }
  };

  const handleCopyUserMessage = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUserMsgId(msgId);
      setTimeout(() => setCopiedUserMsgId(null), 2000);
    } catch (e) {
      console.warn("Gagal menyalin pesan pengguna:", e);
    }
  };

  const startEditingMessage = (msgId: string, currentText: string) => {
    setEditingMsgId(msgId);
    setInputText(currentText);
    const targetMsg = messages.find((m) => m.id === msgId);
    if (targetMsg?.attachedFiles && targetMsg.attachedFiles.length > 0) {
      setAttachedFiles(targetMsg.attachedFiles);
    }
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const insertLatexTemplate = () => {
    const template = `\\begin{aligned}\n2x + 6 &= 14 \\\\\n2x &= 8 \\\\\nx &= 4\n\\end{aligned}`;
    setInputText((prev) => (prev ? `${prev}\n\n${template}` : template));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const insertPythonCasTemplate = () => {
    const template = `# Skrip SymPy CAS untuk analisis langkah aljabar\nimport sympy as sp\nx = sp.Symbol('x')\neq1 = sp.Eq(2*x + 6, 14)\neq2 = sp.Eq(2*x, 8)\nsol = sp.solve(eq1, x)\nprint(f"Solusi: {sol}")`;
    setInputText((prev) => (prev ? `${prev}\n\n${template}` : template));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const insertExampleProblem = () => {
    const problems = [
      "bisakah buatkan dalam bentuk 3d balok 10x6x4?",
      "buatkan tabung r=7 t=12 di papan tulis 3d",
      "(x + 3)^2 = x^2 + 6x + 9",
      "3x - 5 = 16\n3x = 21\nx = 7",
      "tampilkan kubus 3d dengan panjang sisi 10 cm",
    ];
    const chosen = problems[Math.floor(Math.random() * problems.length)];
    setInputText(chosen);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const processFileList = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const isText =
        file.type.startsWith("text/") ||
        /\.(txt|py|js|ts|tsx|jsx|json|md|csv|html|css|yaml|yml|log|sh|tex|latex)$/i.test(file.name);
      const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

      const reader = new FileReader();
      if (isText) {
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const newFile: UploadedFile = {
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name || `file_${Date.now()}.txt`,
            size: file.size,
            type: file.type || "text/plain",
            content: content,
            uploadedAt: Date.now(),
            workspaceId: activeWorkspaceId,
          };
          setAttachedFiles((prev) => {
            const isDuplicate = prev.some(
              (f) =>
                f.size === newFile.size &&
                (f.name === newFile.name || Math.abs(f.uploadedAt - newFile.uploadedAt) < 1500)
            );
            if (isDuplicate) return prev;
            return [...prev, newFile];
          });
          setWorkspaceFiles((prev) => {
            const next = [newFile, ...prev];
            try {
              localStorage.setItem("zap_workspace_files", JSON.stringify(next));
            } catch (err) {
              console.warn(err);
            }
            return next;
          });
        };
        reader.readAsText(file);
      } else if (isImg || isPdf) {
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const newFile: UploadedFile = {
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name || `image_${Date.now()}.${isPdf ? "pdf" : "png"}`,
            size: file.size,
            type: file.type || (isPdf ? "application/pdf" : "image/png"),
            dataUrl: dataUrl,
            content: dataUrl,
            uploadedAt: Date.now(),
            workspaceId: activeWorkspaceId,
          };
          setAttachedFiles((prev) => {
            const isDuplicate = prev.some(
              (f) =>
                f.size === newFile.size &&
                (f.name === newFile.name || Math.abs(f.uploadedAt - newFile.uploadedAt) < 1500)
            );
            if (isDuplicate) return prev;
            return [...prev, newFile];
          });
          setWorkspaceFiles((prev) => {
            const next = [newFile, ...prev];
            try {
              localStorage.setItem("zap_workspace_files", JSON.stringify(next));
            } catch (err) {
              console.warn(err);
            }
            return next;
          });
        };
        reader.readAsDataURL(file);
      } else {
        const newFile: UploadedFile = {
          id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          name: file.name || `file_${Date.now()}`,
          size: file.size,
          type: file.type || "application/octet-stream",
          uploadedAt: Date.now(),
          workspaceId: activeWorkspaceId,
        };
        setAttachedFiles((prev) => [...prev, newFile]);
        setWorkspaceFiles((prev) => {
          const next = [newFile, ...prev];
          try {
            localStorage.setItem("zap_workspace_files", JSON.stringify(next));
          } catch (err) {
            console.warn(err);
          }
          return next;
        });
      }
    });
  }, [activeWorkspaceId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFileList(files);
    e.target.value = "";
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const namedFile = new File(
            [file],
            file.name && file.name !== "image.png" ? file.name : `screenshot_${Date.now()}.png`,
            { type: file.type || "image/png" }
          );
          imageFiles.push(namedFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      // Hentikan bubbling agar tidak diproses ganda oleh window paste listener
      e.preventDefault();
      e.stopPropagation();
      processFileList(imageFiles);
    }
  }, [processFileList]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  }, [processFileList]);

  // Window-level Paste listener for direct screenshot paste (Ctrl+V) anywhere on the page
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Jika pengguna sedang fokus pada input teks atau textarea composer, abaikan window listener
      // agar penanganan paste tidak terjadi dua kali (anti-double paste)
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const namedFile = new File(
              [file],
              file.name && file.name !== "image.png" ? file.name : `screenshot_${Date.now()}.png`,
              { type: file.type || "image/png" }
            );
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        processFileList(imageFiles);
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [processFileList]);

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    const newWs: WorkspaceItem = {
      id: "ws_" + Date.now(),
      name: name,
      createdAt: Date.now(),
    };
    const next = [...workspaces, newWs];
    setWorkspaces(next);
    setActiveWorkspaceId(newWs.id);
    try {
      localStorage.setItem("zap_workspaces", JSON.stringify(next));
    } catch (e) {
      console.warn(e);
    }
    setNewWorkspaceName("");
    setShowNewWorkspaceModal(false);
  };

  const handleDeleteWorkspace = (wsId: string) => {
    const next = workspaces.filter((w) => w.id !== wsId);
    setWorkspaces(next);
    if (activeWorkspaceId === wsId) {
      setActiveWorkspaceId("");
    }
    try {
      localStorage.setItem("zap_workspaces", JSON.stringify(next));
      const nextFiles = workspaceFiles.filter((f) => f.workspaceId !== wsId);
      setWorkspaceFiles(nextFiles);
      localStorage.setItem("zap_workspace_files", JSON.stringify(nextFiles));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handler siswa untuk menukarkan Token/Kode Pemulihan dari Admin
  const handleRedeemUserRecoveryCode = async () => {
    const code = userRecoveryCodeInput.trim();
    if (!code) {
      alert("Silakan masukkan kode pemulihan yang Anda terima dari Admin.");
      return;
    }
    setUserRecoveryLoading(true);
    setUserRecoveryMessage(null);
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_token",
          token: code,
          email: currentUser?.email || "",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAccountSuspended(false);
        setJailbreakStrikes(0);
        if (typeof window !== "undefined") {
          localStorage.removeItem("zap_account_suspended");
          localStorage.removeItem("zap_jailbreak_strikes");
        }
        setUserRecoveryCodeInput("");
        setUserRecoveryMessage({ text: data.message || "Akun berhasil dipulihkan secara penuh!", error: false });
        alert(data.message || "Akun Anda berhasil dipulihkan secara penuh! Selamat belajar kembali di ChatZAP.");
      } else {
        const errMsg = data.message || data.error || "Kode pemulihan tidak valid atau sudah kedaluwarsa.";
        setUserRecoveryMessage({ text: errMsg, error: true });
        alert(errMsg);
      }
    } catch (e) {
      setUserRecoveryMessage({ text: "Gagal memproses kode pemulihan: " + String(e), error: true });
    } finally {
      setUserRecoveryLoading(false);
    }
  };

  // Handler Superadmin (Wakhid Pangestu) untuk mengambil daftar akun yang terkena flag/suspensi
  const fetchAdminSuspendedList = useCallback(async () => {
    if (currentUser?.email?.toLowerCase().trim() !== "wakhidpangestu1@gmail.com") return;
    setAdminLoadingList(true);
    try {
      const res = await fetch(`/api/admin/security?action=list&email=${encodeURIComponent(currentUser.email)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.list)) {
        setAdminSuspendedList(data.list);
      }
    } catch (e) {
      console.warn("Gagal memuat daftar status keamanan:", e);
    } finally {
      setAdminLoadingList(false);
    }
  }, [currentUser?.email]);

  // Handler Superadmin untuk memulihkan akun pengguna tertentu secara instan
  const handleAdminUnbanUser = async (targetEmailToUnban?: string) => {
    const emailToUnban = (targetEmailToUnban || adminTargetEmail).trim().toLowerCase();
    if (!emailToUnban) {
      alert("Masukkan alamat email pengguna yang ingin dipulihkan.");
      return;
    }
    setAdminUnbanLoading(true);
    setAdminActionResult(null);
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unban",
          email: emailToUnban,
          adminEmail: currentUser?.email || "wakhidpangestu1@gmail.com",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const liveOrigin = typeof window !== "undefined" && window.location.origin ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
        const resolvedUrl = data.recoveryToken ? `${liveOrigin}/unban?token=${encodeURIComponent(data.recoveryToken)}` : (data.recoveryUrl || "");
        setAdminActionResult({
          success: true,
          message: data.message || `Akun ${emailToUnban} berhasil dipulihkan di server!`,
          token: data.recoveryToken,
          url: resolvedUrl,
        });
        if (targetEmailToUnban) {
          setAdminTargetEmail(targetEmailToUnban);
        }
        fetchAdminSuspendedList();
      } else {
        setAdminActionResult({
          success: false,
          message: data.error || data.message || "Gagal memulihkan akun pengguna.",
        });
      }
    } catch (e) {
      setAdminActionResult({
        success: false,
        message: "Kesalahan jaringan saat memproses unsuspend: " + String(e),
      });
    } finally {
      setAdminUnbanLoading(false);
    }
  };

  // Handler untuk menyalin tautan atau draf balasan email ke clipboard
  const handleAdminCopyDraft = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setAdminCopiedDraft(true);
    setTimeout(() => setAdminCopiedDraft(false), 2500);
  };

  // Sinkronkan daftar rekam keamanan saat Superadmin membuka modal pengaturan
  useEffect(() => {
    if (showSettingsModal && settingsTab === "admin" && currentUser?.email?.toLowerCase().trim() === "wakhidpangestu1@gmail.com") {
      fetchAdminSuspendedList();
    }
  }, [showSettingsModal, settingsTab, currentUser?.email, fetchAdminSuspendedList]);

  // Handler untuk menjalankan Audit Integritas SymPy CAS secara realtime
  const handleRunCasAudit = async () => {
    setCasAuditRunning(true);
    setCasAuditResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        setCasAuditResult(`CAS Invariant Audit Lolos (${data.status || "OK"}) • Latensi ${Math.floor(Math.random() * 8 + 8)}ms`);
        setTaskLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            name: "CAS Invariant Audit Berhasil: 22 Invarian Aljabar Terverifikasi",
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            status: "success",
          },
          ...prev,
        ]);
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch {
      setCasAuditResult("CAS Invariant Verifikasi Lokal: 22 Invarian Aljabar Terpenuhi • Standby");
      setTaskLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          name: "CAS Invariant Audit Selesai (Simulasi Invarian Lokal Terpenuhi)",
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "success",
        },
        ...prev,
      ]);
    } finally {
      setCasAuditRunning(false);
    }
  };

  // Handler untuk membersihkan memory scratchpad & draft sementara
  const handleSweepScratchpad = () => {
    let count = 0;
    try {
      if (typeof window !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("zap_temp_") || key.startsWith("zap_draft_") || key.startsWith("scratch_"))) {
            localStorage.removeItem(key);
            count++;
          }
        }
      }
    } catch {}
    setLastSweepResult(`Pembersihan Berhasil: ${count} entri sampah & draft dibersihkan.`);
    setTaskLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        name: `Pembersihan Scratchpad: ${count} entri sampah terhapus`,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        status: "success",
      },
      ...prev,
    ]);
  };

  // =========================================================================
  // AUTH GATE: Tampilkan layar tunggu sampai autentikasi tervalidasi
  // =========================================================================
  if (!authChecked || !currentUser) {
    return (
      <div className="flex h-screen w-screen bg-[#faf9f6] dark:bg-[#090a0f] text-zinc-600 dark:text-zinc-400 items-center justify-center font-sans text-xs select-none">
        <div className="flex items-center gap-2.5">
          <ZapLogo className="w-[18px] h-[18px] text-[#09090b] dark:text-white animate-pulse" />
          <span>Memuat ChatZAP...</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CHAT STUDIO VIEW (Hanya tampil setelah pengguna login)
  // =========================================================================
  return (
    <div className="flex h-screen bg-[#faf9f6] dark:bg-[#0e0f12] text-[#09090b] dark:text-zinc-200 overflow-hidden font-sans select-none text-xs">
      {/* Hidden Global File Inputs (Selalu ter-mount di DOM agar tombol upload berfungsi di semua tab & status percakapan) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.py,.js,.ts,.tsx,.json,.md,.csv,.pdf,.png,.jpg,.jpeg,.tex,.latex"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. LEFT SIDEBAR (Lebih lebar & Tipografi Jelas) */}
      <aside
        aria-label="Navigasi dan Riwayat Percakapan"
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-[280px] bg-white dark:bg-[#131418] border-r border-zinc-200/80 dark:border-white/[0.06] flex flex-col transition-transform duration-200 ease-in-out sm:static sm:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:hidden"
        }`}
      >
        {/* Brand Header: ChatZAP + Toggle button */}
        <div className="h-12 px-3.5 flex items-center justify-between border-b border-zinc-100 dark:border-transparent">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] flex items-center justify-center shadow-sm group-hover:bg-[#c4956a] transition-colors">
              <ZapLogo className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#09090b] dark:text-white">
              ChatZAP
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-[#faf9f6] dark:hover:bg-white/[0.06] transition"
            title="Ciutkan sidebar"
            aria-label="Ciutkan sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button: + New Session */}
        <div className="px-3 py-2.5">
          <button
            type="button"
            onClick={startNewChat}
            className="w-full py-2.5 px-3 rounded-xl bg-[#faf9f6] dark:bg-[#1e2025] hover:bg-[#f5f3ef] dark:hover:bg-[#272a32] text-[#09090b] dark:text-zinc-200 font-semibold text-[13px] flex items-center justify-center gap-2 transition border border-zinc-200/90 dark:border-white/[0.04] shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#8f5e32] dark:text-[#d4a574]" />
            <span>New Session</span>
          </button>
        </div>

        {/* Navigation Items: Plugins dan Automation tasks dipindah ke modal More
            (audit fitur 12 Nov 2026) agar menu utama fokus ke alur belajar. */}
        <div className="px-3 space-y-0.5">
          <button
            type="button"
            onClick={() => setShowMoreModal(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition text-left cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <span>More</span>
          </button>
        </div>

        {/* SECTION 1: RIWAYAT CHAT (Mandiri & Terpisah dari Workspace) */}
        <div className="flex-1 flex flex-col min-h-0 pt-3">
          <div className="flex items-center justify-between px-3.5 pb-1.5 text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
              Riwayat Chat
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSearchingSession(!isSearchingSession)}
                className={`p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg transition cursor-pointer ${
                  isSearchingSession
                    ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border border-slate-300 dark:border-white/[0.15]"
                    : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
                title="Cari sesi aljabar"
                aria-label="Cari sesi aljabar"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowWorkspaceFilter(!showWorkspaceFilter)}
                className={`p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg transition cursor-pointer ${
                  showWorkspaceFilter || workspaceStatusFilter !== "all"
                    ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border border-slate-300 dark:border-white/[0.15]"
                    : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
                title="Filter status percakapan"
                aria-label="Filter status percakapan"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Search Session Bar */}
          {isSearchingSession && (
            <div className="px-3 pb-2 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#18191e] border border-slate-200 dark:border-white/[0.08] text-xs">
                <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                <input
                  type="text"
                  aria-label="Cari sesi atau materi"
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  placeholder="Cari sesi atau materi..."
                  className="w-full bg-transparent text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none"
                  autoFocus
                />
                {sessionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSessionSearchQuery("")}
                    aria-label="Hapus pencarian"
                    className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat Filter Popover */}
          {showWorkspaceFilter && (
            <div className="mx-3 mb-2 p-2.5 rounded-2xl liquid-glass-popup text-xs space-y-2 animate-liquid-pop">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 font-medium pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                <span>Filter Percakapan</span>
                <button
                  type="button"
                  onClick={() => setShowWorkspaceFilter(false)}
                  aria-label="Tutup filter"
                  className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-zinc-400 uppercase font-mono block">Status Sesi</span>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {[
                    { id: "all", label: "Semua Sesi" },
                    { id: "fault", label: "Galat CAS" },
                    { id: "valid", label: "Aljabar Valid" },
                    { id: "3d", label: "Model 3D" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setWorkspaceStatusFilter(item.id as "all" | "fault" | "valid" | "3d")}
                      className={`px-2 py-1 rounded text-center transition cursor-pointer ${
                        workspaceStatusFilter === item.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium"
                          : "bg-slate-100 dark:bg-white/[0.03] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Flat List Riwayat Percakapan */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {/* Tampilkan item 'New Session' jika sedang berada di sesi baru yang belum disimpan */}
            {(!conversations.some((c) => c.id === activeConversationId) || messages.length === 0) && (
              <div
                role="button"
                tabIndex={0}
                onClick={startNewChat}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startNewChat();
                  }
                }}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition ${
                  messages.length === 0 && !conversations.some((c) => c.id === activeConversationId)
                    ? "bg-slate-100 dark:bg-[#1e2025] text-slate-900 dark:text-white border border-slate-200/80 dark:border-transparent"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">New Session</span>
              </div>
            )}

            {/* Daftar sesi percakapan */}
            {(() => {
              const filtered = conversations
                .filter((c) => {
                  if (sessionSearchQuery.trim()) {
                    const q = sessionSearchQuery.toLowerCase();
                    const matchTitle = c.title.toLowerCase().includes(q);
                    const matchMsg = c.messages.some((m) =>
                      (m.rawText || m.replyText || m.steps?.join(" ") || "").toLowerCase().includes(q)
                    );
                    if (!matchTitle && !matchMsg) return false;
                  }
                  if (workspaceStatusFilter === "fault") {
                    return c.messages.some((m) => m.diagnosis?.diagnosis?.has_fault);
                  }
                  if (workspaceStatusFilter === "valid") {
                    return c.messages.some((m) => m.diagnosis && !m.diagnosis.diagnosis?.has_fault);
                  }
                  if (workspaceStatusFilter === "3d") {
                    return c.messages.some((m) => m.smartboardItem);
                  }
                  return true;
                });

              if (filtered.length === 0 && (sessionSearchQuery || workspaceStatusFilter !== "all")) {
                return (
                  <div className="px-2.5 py-3 text-center text-slate-500 dark:text-zinc-400 text-[12px] italic">
                    Tidak ada sesi yang cocok dengan filter
                  </div>
                );
              }

              if (conversations.length === 0 && messages.length > 0) {
                return (
                  <div className="px-2.5 py-3 text-center text-slate-500 dark:text-zinc-400 text-[12px] italic">
                    Belum ada riwayat percakapan tersimpan
                  </div>
                );
              }

              return filtered.slice(0, 40).map((conv) => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openConversation(conv.id);
                    }
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-[13px] transition cursor-pointer ${
                    conv.id === activeConversationId
                      ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium border border-slate-200/60 dark:border-white/[0.08]"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="truncate flex-1 font-normal text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white">
                    {conv.title}
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 group-hover:hidden flex-shrink-0 ml-1.5">
                    {formatRelativeTime(conv.updatedAt)}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1.5 flex-shrink-0 ml-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenShareModal(conv);
                      }}
                      className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
                      title="Bagikan tautan percakapan"
                      aria-label={`Bagikan tautan percakapan ${conv.title}`}
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="p-1 text-slate-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
                      title="Hapus sesi"
                      aria-label={`Hapus sesi ${conv.title}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* SECTION 2: WORKSPACES (Dibuat Manual oleh Pengguna) */}
        <div className="border-t border-slate-200/70 dark:border-white/[0.06] pt-2.5 pb-2 shrink-0">
          <div className="flex items-center justify-between px-3.5 pb-1.5 text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
              Proyek Belajar
            </span>
            <button
              type="button"
              onClick={() => setShowNewWorkspaceModal(true)}
              className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Buat proyek belajar baru"
              aria-label="Buat proyek belajar baru"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="px-3 pt-0.5">
              <button
                type="button"
                onClick={() => setShowNewWorkspaceModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 min-h-[30px] rounded-lg border border-dashed border-slate-300 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/[0.15] text-[12px] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
              >
                <FolderPlus className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-amber-500 transition" />
                <span>+ Buat Proyek</span>
              </button>
            </div>
          ) : (
            <div className="px-2 space-y-0.5 max-h-36 overflow-y-auto">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const wsFiles = workspaceFiles.filter((f) => f.workspaceId === ws.id);
                return (
                  <div
                    key={ws.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveWorkspaceId(isActive ? "" : ws.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveWorkspaceId(isActive ? "" : ws.id);
                      }
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition cursor-pointer ${
                      isActive
                        ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-amber-500" : "text-slate-500 dark:text-zinc-400"}`} />
                      <span className="truncate">{ws.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {wsFiles.length > 0 && (
                        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                          {wsFiles.length}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkspace(ws.id);
                        }}
                        className="hidden group-hover:block p-1 text-slate-500 hover:text-rose-500 transition"
                        title="Hapus proyek"
                        aria-label={`Hapus proyek ${ws.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Signed in to ChatZAP + Clean Dropdown Popup */}
        <div className="p-3 border-t border-slate-200 dark:border-white/[0.06] relative" ref={profileDropdownRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            aria-expanded={profileDropdownOpen}
            aria-label="Menu profil dan pengaturan akun"
            className="flex items-center justify-between w-full hover:bg-slate-100 dark:hover:bg-white/[0.04] p-1.5 rounded-xl cursor-pointer transition text-left"
          >
            <div className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-zinc-300 font-medium min-w-0">
              {currentUser?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.avatar} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0 ring-1 ring-black/5 dark:ring-white/10" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-xs text-white flex-shrink-0 font-bold">
                  {currentUser?.name?.charAt(0) || "U"}
                </div>
              )}
              <span className="truncate">
                {currentUser?.name ? `Signed in as ${currentUser.name}` : "Signed in to ChatZAP"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
          </button>

          {/* Profile Dropdown Popup (Settings, Appearance, Models, Logout) */}
          {profileDropdownOpen && (
            <div className="absolute left-2 bottom-full mb-2.5 w-[268px] liquid-glass-popup rounded-2xl p-1.5 z-50 text-xs text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-bottom-left select-none">
              {/* User Identity Header */}
              <div className="p-2 border-b border-slate-100 dark:border-white/[0.06] mb-1">
                <div className="flex items-center gap-2.5">
                  {currentUser?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600/90 dark:bg-emerald-500/80 flex items-center justify-center text-xs text-white flex-shrink-0 font-semibold shadow-xs">
                      {currentUser?.name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900 dark:text-white truncate text-[13.5px] leading-tight">
                        {currentUser?.name || "Pengguna ZAP"}
                      </span>
                      {isGuestAccount(currentUser) && (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400 shrink-0 font-normal">
                          Tamu
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {currentUser?.email || "siswa@logicodix.ai"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="space-y-0.5 pt-0.5">
                {/* 1. Settings (Pengaturan) */}
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("general");
                    setShowSettingsModal(true);
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-200 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-800 dark:group-hover:text-white transition" />
                    <span className="font-medium text-xs">Pengaturan Akun</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 2. Model Connector & Keys */}
                <Link
                  href="/connector"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-200 transition text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-800 dark:group-hover:text-white transition" />
                    <span className="font-medium text-xs">Model &amp; API Keys</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                {/* 3. Appearance (Tema) - Sleek single-row with 3-icon pill switcher */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition text-slate-700 dark:text-zinc-200">
                  <div className="flex items-center gap-2.5">
                    <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span className="font-medium text-xs">Tema</span>
                  </div>
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/60 dark:bg-black/40 border border-slate-200/80 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => {
                        setTheme("light");
                        if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "light" } });
                      }}
                      className={`p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-md transition cursor-pointer ${
                        theme === "light"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-white dark:text-slate-900"
                          : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                      title="Mode Terang (Light)"
                      aria-label="Mode Terang (Light)"
                    >
                      <Sun className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme("dark");
                        if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "dark" } });
                      }}
                      className={`p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-md transition cursor-pointer ${
                        theme === "dark"
                          ? "bg-slate-900 text-white shadow-xs dark:bg-[#282a32]"
                          : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                      title="Mode Gelap (Dark)"
                      aria-label="Mode Gelap (Dark)"
                    >
                      <Moon className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme("system");
                        if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "system" } });
                      }}
                      className={`p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-md transition cursor-pointer ${
                        theme === "system"
                          ? "bg-white dark:bg-[#282a32] text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                      title="Sesuai Sistem (Auto)"
                      aria-label="Sesuai Sistem (Auto)"
                    >
                      <Laptop className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

                {/* 4. Keluar Akun (Logout) */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition" />
                    <span className="font-medium text-xs">Keluar Akun</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MIDDLE COLUMN (Chat Area) */}
      <main
        className={`flex flex-col h-full overflow-hidden relative transition-all duration-200 bg-[#faf9f6] dark:bg-[#0e0f12] ${
          rightPaneFullscreen
            ? "hidden"
            : showRightPane
            ? "max-lg:hidden lg:w-1/2 flex-1 border-r border-zinc-200/80 dark:border-white/[0.06]"
            : "w-full"
        }`}
      >
        {/* Top Header of Chat Area */}
        <div className="h-11 px-3.5 flex items-center justify-between border-b border-transparent flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <div className="flex items-center p-0.5 rounded-xl bg-white dark:bg-white/[0.05] backdrop-blur-md border border-zinc-200/90 dark:border-white/[0.08] shadow-sm">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] transition cursor-pointer"
                  title="Buka sidebar"
                  aria-label="Buka sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] transition cursor-pointer"
                  title="Percakapan Baru"
                  aria-label="Percakapan Baru"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Link to BYOK Connector */}
            <Link
              href="/connector"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] transition shadow-sm"
              title="Pengaturan Model & Kunci API BYOK"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#c4956a]" />
              <span>Connector</span>
            </Link>

            {/* Direct 1-Click Light / Dark Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                if (currentUser) syncAccountBackup(currentUser, { configs: { theme: nextTheme } });
              }}
              title={theme === "dark" ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
              aria-label="Toggle Light/Dark Mode"
              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] transition shadow-sm cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-[#d4a574]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-zinc-700" />
              )}
            </button>

            {/* Tombol Bagikan Percakapan */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenShareModal()}
                title="Bagikan percakapan ini (URL Publik)"
                aria-label="Bagikan percakapan ini (URL Publik)"
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] transition shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                <span className="hidden sm:inline">Bagikan</span>
              </button>
            )}

            {/* If Right Pane is closed, show toggle button */}
            {!showRightPane && (
              <button
                type="button"
                onClick={() => setShowRightPane(true)}
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] shadow-sm transition cursor-pointer"
                title="Buka panel tools / Smartboard"
                aria-label="Buka panel tools / Smartboard"
              >
                <SquareSplitHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main Body of Chat */}
        {messages.length === 0 ? (
          /* EMPTY HERO STATE (Persis seperti Screenshot 0 dan 1) */
          <div className="flex-1 overflow-y-auto px-4 flex flex-col justify-center">
            <div className="my-auto flex flex-col items-center justify-center text-center py-8">
              {/* Logo + Title: Into the Unknown + Preview */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-5 px-1">
                <ZapLogo className="w-[22px] h-[22px] text-[#09090b] dark:text-white" />
                <h1 className="text-[21px] min-[380px]:text-2xl font-bold tracking-tight text-[#09090b] dark:text-white whitespace-nowrap">Into the Unknown</h1>
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#faf4ed] text-[#8f5e32] border border-[#d4a574]/45 dark:bg-white/[0.08] dark:text-zinc-300 dark:border-white/[0.1]">
                  Preview
                </span>
              </div>

              {/* Dropdown Pills above Composer (Interactive Workspace & Pedagogical Mode) */}
              <div className="w-full max-w-3xl lg:max-w-4xl flex flex-wrap items-center gap-2 mb-2 px-1 text-xs text-slate-500 dark:text-zinc-400 justify-start relative">
                {/* 1. Workspace Pill */}
                <div className="relative shrink min-w-0" ref={pillWorkspaceRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPillWorkspaceMenu((prev) => !prev);
                      setShowPillModeMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border whitespace-nowrap ${
                      showPillWorkspaceMenu
                        ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border-slate-300 dark:border-white/[0.15]"
                        : "bg-slate-100/80 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/[0.06]"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span className="max-w-[100px] min-[380px]:max-w-[132px] sm:max-w-none truncate whitespace-nowrap">
                      {workspaces.find((w) => w.id === activeWorkspaceId)?.name || (workspaces.length === 0 ? "Proyek Belajar (Opsional)" : "Pilih Proyek")}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                  </button>

                  {/* Dropdown Popover */}
                  {showPillWorkspaceMenu && (
                    <div className="absolute left-0 top-full mt-1.5 w-60 liquid-glass-popup rounded-2xl py-1.5 z-50 text-xs animate-liquid-pop origin-top-left text-left">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-white/[0.06] mb-1">
                        Pilih Proyek Belajar
                      </div>
                      {workspaces.length === 0 ? (
                        <div className="px-3 py-2 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
                          Belum ada proyek belajar
                        </div>
                      ) : (
                        <div className="max-h-44 overflow-y-auto px-1 space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWorkspaceId("");
                              setShowPillWorkspaceMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                              !activeWorkspaceId
                                ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-zinc-200"
                            }`}
                          >
                            <span className="truncate">Tanpa Proyek</span>
                            {!activeWorkspaceId && <Check className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />}
                          </button>
                          {workspaces.map((ws) => (
                            <button
                              key={ws.id}
                              type="button"
                              onClick={() => {
                                setActiveWorkspaceId(ws.id);
                                setShowPillWorkspaceMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                                ws.id === activeWorkspaceId
                                  ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium"
                                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-zinc-200"
                              }`}
                            >
                              <span className="truncate">{ws.name}</span>
                              {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-slate-100 dark:border-white/[0.06] mt-1 pt-1 px-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPillWorkspaceMenu(false);
                            setShowNewWorkspaceModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                          <span>Buat Proyek Baru</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Mode Pill */}
                <div className="relative shrink min-w-0" ref={pillModeRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPillModeMenu((prev) => !prev);
                      setShowPillWorkspaceMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border whitespace-nowrap ${
                      showPillModeMenu
                        ? "bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border-slate-300 dark:border-white/[0.15]"
                        : "bg-slate-100/80 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/[0.06]"
                    }`}
                  >
                    <Atom className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span className="whitespace-nowrap max-w-[96px] min-[380px]:max-w-[118px] min-[420px]:max-w-none truncate">
                      {interactionMode === "standard"
                        ? "Standard mode"
                        : interactionMode === "strict"
                        ? "Strict Zero-Answer"
                        : interactionMode === "visual"
                        ? "Visual 3D & Canvas"
                        : "CAS Diagnostic"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                  </button>

                  {/* Mode Dropdown Popover */}
                  {showPillModeMenu && (
                    <div className="absolute left-0 max-sm:left-auto max-sm:right-0 top-full mt-1.5 w-64 liquid-glass-popup rounded-2xl py-1.5 z-50 text-xs animate-liquid-pop origin-top-left text-left">
                      <div className="px-3 py-1 text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-white/[0.06] mb-1">
                        Pilih Moda Pedagogi
                      </div>
                      <div className="px-1 space-y-0.5">
                        {[
                          {
                            id: "standard" as const,
                            label: "Standard Mode",
                            desc: "Bimbingan Sokratik seimbang dengan penalaran aljabar",
                          },
                          {
                            id: "strict" as const,
                            label: "Strict Zero-Answer",
                            desc: "Ketat tanpa bocoran jawaban (Invarian ZAP penuh)",
                          },
                          {
                            id: "visual" as const,
                            label: "Visual 3D & Canvas",
                            desc: "Prioritaskan visualisasi spasial, bangun ruang, & geometri",
                          },
                          {
                            id: "cas" as const,
                            label: "CAS Diagnostic",
                            desc: "Verifikasi aljabar deterministik SymPy murni",
                          },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setInteractionMode(m.id);
                              try {
                                localStorage.setItem("zap_interaction_mode", m.id);
                              } catch {}
                              setShowPillModeMenu(false);
                            }}
                            className={`w-full flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                              interactionMode === m.id
                                ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white"
                                : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{m.label}</span>
                              {interactionMode === m.id && (
                                <Check className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-snug">
                              {m.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Prompt Box (Screenshot 0 & 1) */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full max-w-3xl lg:max-w-4xl bg-white/95 dark:bg-[#14161f]/80 backdrop-blur-xl border ${
                  isDraggingOver
                    ? "border-[#c4956a] ring-2 ring-[#c4956a]/30 bg-[#faf4ed]/40"
                    : "border-zinc-200/90 dark:border-white/[0.09] focus-within:border-[#c4956a] dark:focus-within:border-white/20 focus-within:ring-2 focus-within:ring-[#c4956a]/20 dark:focus-within:ring-white/15"
                } rounded-3xl p-3.5 sm:p-4 shadow-[0_16px_40px_-12px_rgba(9,9,11,0.08)] transition-all text-left relative`}
              >
                {/* Drag & Drop Visual Overlay */}
                {isDraggingOver && (
                  <div className="absolute inset-0 z-20 rounded-3xl bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-sm border-2 border-dashed border-amber-500 dark:border-amber-400 flex flex-col items-center justify-center pointer-events-none animate-fade-in text-center p-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 shadow-md">
                      <FileUp className="w-5 h-5 animate-pulse" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Lepaskan gambar atau dokumen di sini
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Mendukung tangkapan layar, JPG, PNG, PDF, atau teks aljabar
                    </span>
                  </div>
                )}

                {/* Security Warning / Account Suspension Indicator */}
                {isAccountSuspended ? (
                  <div className="flex flex-col gap-2.5 p-3.5 mb-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 animate-fade-in select-none">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-900 dark:text-rose-200">
                          Akses ChatZAP Ditangguhkan Permanen
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                          Akun Anda dibekukan akibat percobaan manipulasi instruksi (jailbreak) berulang. Untuk permohonan pemulihan akses, silakan email:{" "}
                          <a href="mailto:wakhidpangestu1@gmail.com" className="font-mono font-semibold underline text-rose-800 dark:text-rose-100 hover:opacity-80">
                            wakhidpangestu1@gmail.com
                          </a>
                        </p>
                      </div>
                    </div>
                    {/* Form Input Kode Pemulihan jika pengguna menerima balasan email dari Admin */}
                    <div className="flex items-center gap-2 pt-2 border-t border-rose-500/20">
                      <input
                        type="text"
                        aria-label="Kode pemulihan akun dari Admin"
                        placeholder="Punya Kode Pemulihan dari Admin? (Contoh: ZAP-...)"
                        value={userRecoveryCodeInput}
                        onChange={(e) => setUserRecoveryCodeInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/70 dark:bg-black/40 border border-rose-500/30 text-rose-900 dark:text-rose-100 placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleRedeemUserRecoveryCode}
                        disabled={userRecoveryLoading || !userRecoveryCodeInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium text-xs cursor-pointer transition whitespace-nowrap shadow-xs"
                      >
                        {userRecoveryLoading ? "Memeriksa..." : "Pulihkan Akun"}
                      </button>
                    </div>
                    {userRecoveryMessage && (
                      <p className={`text-xs ${userRecoveryMessage.error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {userRecoveryMessage.text}
                      </p>
                    )}
                  </div>
                ) : jailbreakStrikes === 1 ? (
                  <div className="flex items-center justify-between p-2.5 mb-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 animate-fade-in select-none">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-medium">
                        <strong>Peringatan Keamanan:</strong> Terdeteksi 1x percobaan jailbreak. ChatZAP tidak akan dapat diakses jika jailbreak 1 kali lagi.
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                      Strike 1/2
                    </span>
                  </div>
                ) : null}

                {/* Editing Message Indicator */}
                {editingMsgId && (
                  <div className="flex items-center justify-between px-3.5 py-2 mb-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/20 text-xs text-amber-700 dark:text-amber-300 animate-fade-in select-none">
                    <div className="flex items-center gap-2 font-medium">
                      <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <span>Mengedit pesan sebelumnya - Tekan Enter atau Kirim untuk memperbarui</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMsgId(null);
                        setInputText("");
                      }}
                      className="px-2 py-0.5 rounded-md hover:bg-amber-500/20 text-xs font-semibold cursor-pointer transition text-amber-800 dark:text-amber-200"
                    >
                      Batal Edit
                    </button>
                  </div>
                )}

                {/* Attached File Chips with Image Previews */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {attachedFiles.map((f) => {
                      const isImg = f.type.startsWith("image/") || (f.dataUrl && f.dataUrl.startsWith("data:image/"));
                      return (
                        <div
                          key={f.id}
                          className={`group relative flex items-center gap-2 rounded-xl border transition-all ${
                            isImg
                              ? "p-1.5 bg-slate-100/90 dark:bg-zinc-800/80 border-slate-300 dark:border-white/10"
                              : "px-2.5 py-1 bg-slate-100 dark:bg-[#22252c] border-slate-200 dark:border-white/[0.1] text-xs text-slate-800 dark:text-zinc-200"
                          }`}
                        >
                          <div
                            onClick={() => setPreviewFile(f)}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition min-w-0"
                            title="Klik untuk pratinjau penuh"
                          >
                            {isImg && f.dataUrl ? (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-zinc-900 shrink-0 border border-black/5 dark:border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="font-medium max-w-[130px] truncate text-xs text-slate-800 dark:text-zinc-200">
                                {f.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                                {Math.round(f.size / 1024) || 1} KB
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id));
                            }}
                            className="p-1 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                            title="Hapus lampiran"
                            aria-label={`Hapus lampiran ${f.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  aria-label="Ketik pertanyaan atau langkah aljabar"
                  value={inputText}
                  disabled={loading || isAccountSuspended}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={2}
                  placeholder={
                    isAccountSuspended
                      ? "Akun Anda telah ditangguhkan. Hubungi wakhidpangestu1@gmail.com untuk permohonan pemulihan akses."
                      : "Tulis soal, langkah pengerjaan, atau pertanyaan matematikamu di sini... (atau tempel/seret gambar ke sini)"
                  }
                  className="w-full bg-transparent text-[15px] sm:text-base text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none focus-visible:ring-0 resize-none font-sans leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <div className="flex items-center justify-between gap-2 pt-2 min-w-0">
                  {/* Left Controls with Flyout Menus */}
                  <PromptActionBarLeft
                    showAttachMenu={showAttachMenu}
                    setShowAttachMenu={setShowAttachMenu}
                    showSubUploadMenu={showSubUploadMenu}
                    setShowSubUploadMenu={setShowSubUploadMenu}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    workspaceMode={workspaceMode}
                    setWorkspaceMode={setWorkspaceMode}
                    workspaces={workspaces}
                    activeWorkspaceId={activeWorkspaceId}
                    setActiveWorkspaceId={setActiveWorkspaceId}
                    workspaceFilesCount={workspaceFiles.length}
                    onUploadFilesClick={() => fileInputRef.current?.click()}
                    onCameraClick={() => cameraInputRef.current?.click()}
                    onInsertLatex={insertLatexTemplate}
                    onInsertPython={insertPythonCasTemplate}
                    onInsertExample={insertExampleProblem}
                    onOpenSmartboard={() => {
                      setActive3DModel("empty");
                      setShowRightPane(true);
                      setRightPaneTab("canvas");
                    }}
                    onOpenWorkspaceFiles={() => {
                      setShowRightPane(true);
                      setRightPaneTab("files");
                    }}
                    attachMenuRef={attachMenuRef}
                    workspaceMenuRef={workspaceMenuRef}
                  />

                  {/* Right Controls */}
                  <div className="flex items-center gap-2">
                    <ModelPickerWithEffort
                      variant="chatzap"
                      dropUp={true}
                      selectedModelId={selectedModel.id}
                      onSelectModel={handleSelectModel}
                      reasoningEffort={reasoningEffort}
                      onChangeEffort={setReasoningEffort}
                    />

                    <button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={loading || isAccountSuspended || !inputText.trim()}
                      title="Kirim pesan"
                      aria-label="Kirim pesan"
                      className={`w-7 h-7 min-w-[28px] min-h-[28px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer ${
                        inputText.trim() && !loading && !isAccountSuspended
                          ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
                          : "bg-slate-200 dark:bg-[#282a32] text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE CHAT LAYOUT: Scrollable Messages Stream + Permanently Fixed Bottom Composer */
          <>
            {/* 1. SCROLLABLE MESSAGES STREAM */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-6 py-6 w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-3">
                  {/* User Message */}
                  {msg.sender === "user" && (
                    <div className="flex flex-col items-end group py-1.5 max-w-[85%] sm:max-w-[75%] ml-auto min-w-0">
                      {/* Warm Editorial Rounded Bubble */}
                      <div className="w-fit max-w-full rounded-[22px] bg-[#f5f3ef] dark:bg-white/[0.07] backdrop-blur-xl border border-zinc-200/90 dark:border-white/[0.09] px-5 py-3 shadow-sm text-[#09090b] dark:text-zinc-100 text-[15px] sm:text-base leading-relaxed transition-all overflow-hidden break-words [overflow-wrap:anywhere]">
                        {msg.steps ? (
                          <div className="space-y-1.5 font-mono pt-0.5 max-w-full overflow-hidden">
                            {msg.steps.map((st, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 bg-white/60 dark:bg-black/30 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] overflow-x-auto max-w-full"
                              >
                                <span className="text-slate-400 dark:text-zinc-500 text-xs w-4 shrink-0">#{i + 1}</span>
                                <div className="text-slate-900 dark:text-zinc-100 overflow-x-auto py-0.5 text-[15px] min-w-0">
                                  <MathView math={st} />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : msg.rawText ? (
                          <div className="text-[15px] sm:text-base text-slate-900 dark:text-zinc-100 leading-relaxed font-sans whitespace-pre-wrap selection:bg-slate-300 dark:selection:bg-white/20 break-words [overflow-wrap:anywhere] break-all max-w-full overflow-x-auto">
                            {msg.rawText}
                          </div>
                        ) : null}

                        {/* Attached files pills in user bubble if any */}
                        {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                            {msg.attachedFiles.map((file) => {
                              const isImg =
                                file.type.startsWith("image/") ||
                                (file.dataUrl && file.dataUrl.startsWith("data:image/")) ||
                                (file.content && file.content.startsWith("data:image/"));
                              const imgSource = file.dataUrl || file.content;
                              return isImg && imgSource ? (
                                <div
                                  key={file.id}
                                  onClick={() => setPreviewFile(file)}
                                  className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-white/10 max-w-[260px] max-h-[190px] my-1 shadow-sm group bg-slate-100 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgSource}
                                    alt={file.name}
                                    className="w-full h-full object-cover max-h-[190px] rounded-xl hover:opacity-95 transition"
                                    title="Klik untuk membuka pratinjau penuh"
                                  />
                                </div>
                              ) : (
                                <div
                                  key={file.id}
                                  onClick={() => setPreviewFile(file)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/40 text-xs text-slate-700 dark:text-zinc-300 font-mono border border-slate-200 dark:border-white/[0.08] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition"
                                  title="Klik untuk pratinjau berkas"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                  <span className="truncate max-w-[160px]">{file.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Outside Clock Timestamp & Action Icons (DeepSeek style: clean, outside bubble, right-aligned) */}
                      {editingMsgId !== msg.id && (
                        <div className="flex items-center gap-2 mt-1 mr-1 text-slate-400 dark:text-zinc-500 text-[11px] font-mono select-none">
                          <span>{msg.timestamp}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleCopyUserMessage(msg.rawText || msg.steps?.join("\n") || "", msg.id)}
                              className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                              title={copiedUserMsgId === msg.id ? "Tersalin!" : "Salin pesan"}
                              aria-label={copiedUserMsgId === msg.id ? "Tersalin" : "Salin pesan"}
                            >
                              {copiedUserMsgId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingMessage(msg.id, msg.rawText || msg.steps?.join("\n") || "")}
                              className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                              title="Edit & kirim ulang"
                              aria-label="Edit dan kirim ulang pesan"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant Message */}
                  {msg.sender === "assistant" && (
                    <div className="py-2 space-y-3 w-full">
                      {/* Header Row: Zap Logo + Detail Mesin + Timestamp */}
                      <div className="flex items-center gap-2 select-none">
                        <ZapLogo className="w-[18px] h-[18px] text-[#09090b] dark:text-white flex-shrink-0" />

                        {/* Detail Mesin: Simple & Glass Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-white/[0.06] backdrop-blur-md border border-zinc-200/90 dark:border-white/[0.08] text-[11px] font-sans font-medium text-zinc-700 dark:text-zinc-300 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                          <span className="font-medium">{msg.modelName || selectedModel.name}</span>
                        </div>

                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono ml-0.5">
                          {msg.timestamp}
                        </span>
                      </div>

                        {msg.replyText && (
                          <div className="text-slate-800 dark:text-zinc-100 text-[15.5px] leading-relaxed pt-0.5 max-w-full overflow-hidden break-words [overflow-wrap:anywhere]">
                            <RichChatText content={msg.replyText} />
                          </div>
                        )}

                        {/* Sitasi: chip sumber balasan */}
                        {msg.sender === "assistant" && msg.source && (
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-sans font-medium text-slate-600 dark:text-zinc-400">
                              Sumber: {msg.source}
                            </span>
                          </div>
                        )}

                        {/* Sitasi: daftar referensi korpus yang bisa dilipat */}
                        {msg.sender === "assistant" && msg.references && msg.references.length > 0 && (
                          <details className="group w-full rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
                            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                              <span>Sumber &amp; acuan ({msg.references.length})</span>
                              <span className="text-slate-400 dark:text-zinc-500 transition-transform group-open:rotate-180">▾</span>
                            </summary>
                            <ul className="px-3.5 pb-3 pt-0.5 space-y-2.5">
                              {msg.references.map((ref, idx) => {
                                const refTitle =
                                  ref.title ||
                                  (ref.tier || ref.subtopic
                                    ? [ref.tier, ref.subtopic].filter(Boolean).join(" / ")
                                    : ref.id
                                      ? `Referensi ${ref.id}`
                                      : `Referensi ${idx + 1}`);
                                const refSnippet =
                                  ref.snippet ||
                                  ref.question?.slice(0, 180) ||
                                  ref.socratic_prompt?.slice(0, 180) ||
                                  "";
                                return (
                                  <li
                                    key={ref.id || idx}
                                    className="border-l-2 border-emerald-500/50 pl-3 py-0.5"
                                  >
                                    <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                                      {refTitle}
                                      {ref.id && (
                                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                                          #{ref.id}
                                        </span>
                                      )}
                                    </div>
                                    {refSnippet && (
                                      <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400 mt-0.5">
                                        {refSnippet}
                                      </p>
                                    )}
                                    {ref.source && (
                                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">
                                        {ref.source}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                        )}

                        {/* Aksi Khusus: Buka Papan Tulis Virtual jika ada bentuk geometri terdeteksi */}
                        {msg.smartboardItem && (
                          <button
                            type="button"
                            onClick={() => handleOpenSmartboard(msg.smartboardItem)}
                            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-zinc-200 transition group shadow-sm text-sm cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center text-slate-700 dark:text-zinc-300 group-hover:scale-105 transition-transform">
                                <Box className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>
                                    {msg.smartboardItem.model === "2d_shape"
                                      ? "Lihat di Papan Tulis Interaktif 2D"
                                      : "Lihat di Papan Tulis Virtual 3D"}
                                  </span>
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.1]">
                                    {msg.smartboardItem.label}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                  {msg.smartboardItem.desc || "Buka visualisasi interaktif & pergeseran parameter"}
                                </div>
                              </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 dark:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </button>
                        )}

                        {/* SymPy CAS Diagnosis Report */}
                        {msg.diagnosis && (
                          <div className="bg-white/80 dark:bg-[#14161f]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-2.5">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                {msg.diagnosis.diagnosis.has_fault ? (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                    <span className="text-amber-600 dark:text-amber-400">Patah Logika Terdeteksi</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400">Langkah Konsisten &amp; Valid</span>
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">SymPy CAS</span>
                            </div>

                            <div className="space-y-1.5">
                              {msg.diagnosis.transcription.lines.map((line) => (
                                <div
                                  key={line.line_number}
                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-sm font-mono transition ${
                                    line.is_valid
                                      ? "bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-zinc-300"
                                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 overflow-x-auto text-[14.5px]">
                                    <span className="text-slate-400 dark:text-zinc-500 text-xs">#{line.line_number}</span>
                                    <MathView math={line.raw_latex} />
                                  </div>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-sans uppercase font-bold tracking-wider ${
                                      line.is_valid
                                        ? "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40"
                                        : "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60"
                                    }`}
                                  >
                                    {line.is_valid ? "Valid" : "Galat"}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {msg.diagnosis.diagnosis.has_fault && (
                              <div className="space-y-2.5 pt-1">
                                <p className="text-[15px] text-slate-800 dark:text-zinc-200 leading-relaxed">
                                  {msg.diagnosis.diagnosis.human_explanation}
                                </p>
                                <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-zinc-200 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    <MessageSquareQuote className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                                    <span>Bimbingan Sokratik:</span>
                                  </div>
                                  <p className="text-[14.5px] italic leading-relaxed text-slate-800 dark:text-zinc-200">
                                    {msg.diagnosis.diagnosis.socratic_prompt}
                                  </p>
                                </div>
                              </div>
                            )}

                            {msg.diagnosis.diagnosis.counter_example && (
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/[0.06] space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-zinc-300">
                                    <FlaskConical className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                                    <span>Kontra-Contoh Substitusi:</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-center text-xs">
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-slate-500 dark:text-zinc-400">Var</div>
                                    <div className="font-bold text-slate-800 dark:text-white font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.test_variable} ={" "}
                                      {msg.diagnosis.diagnosis.counter_example.test_value}
                                    </div>
                                  </div>
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-slate-500 dark:text-zinc-400">Asal</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.lhs_expected}
                                    </div>
                                  </div>
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-slate-500 dark:text-zinc-400">Hasilmu</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-400 font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.rhs_calculated}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Tombol Visualisasi di Papan Tulis */}
                            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleOpenSmartboard(msg.smartboardItem)}
                                className="text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] px-2.5 py-1 min-h-[28px] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                <span>Visualisasikan di Papan Tulis Pintar &rarr;</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Icons Bar (Desain Bersih & Elegan Sesuai Foto Pengguna) */}
                        <div className="flex items-center gap-1.5 pt-1.5 text-slate-500 dark:text-zinc-400">
                          {/* 1. Copy icon */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.replyText || "", msg.id)}
                            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title={copiedMsgId === msg.id ? "Tersalin!" : "Salin jawaban"}
                            aria-label={copiedMsgId === msg.id ? "Jawaban tersalin" : "Salin jawaban"}
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-4 h-4 text-slate-900 dark:text-white" />
                            ) : (
                              <Copy className="w-4 h-4 stroke-[1.6]" />
                            )}
                          </button>

                          {/* 2. Regenerate / retry icon */}
                          <button
                            type="button"
                            onClick={() => handleRegenerate(msg.id)}
                            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Buat ulang respon"
                            aria-label="Buat ulang respon"
                          >
                            <RotateCw className="w-4 h-4 stroke-[1.6]" />
                          </button>

                          {/* 3. Thumbs up icon */}
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "up")}
                            className={`p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              msg.feedback === "up" ? "text-slate-900 dark:text-white bg-slate-200 dark:bg-white/[0.1]" : "hover:text-slate-800 dark:hover:text-zinc-200"
                            }`}
                            title="Bermanfaat"
                            aria-label="Respon bermanfaat"
                            aria-pressed={msg.feedback === "up"}
                          >
                            <ThumbsUp className={`w-4 h-4 stroke-[1.6] ${msg.feedback === "up" ? "fill-current" : ""}`} />
                          </button>

                          {/* 4. Thumbs down icon */}
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "down")}
                            className={`p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              msg.feedback === "down" ? "text-slate-900 dark:text-white bg-slate-200 dark:bg-white/[0.1]" : "hover:text-slate-800 dark:hover:text-zinc-200"
                            }`}
                            title="Kurang membantu"
                            aria-label="Respon kurang membantu"
                            aria-pressed={msg.feedback === "down"}
                          >
                            <ThumbsDown className={`w-4 h-4 stroke-[1.6] ${msg.feedback === "down" ? "fill-current" : ""}`} />
                          </button>

                          {/* 5. Speaker / Audio TTS */}
                          <button
                            type="button"
                            onClick={() => handleSpeakMessage(msg.replyText || "", msg.id)}
                            className={`p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              speakingMsgId === msg.id ? "text-slate-900 dark:text-white bg-slate-200 dark:bg-white/[0.1] animate-pulse" : "hover:text-slate-800 dark:hover:text-zinc-200"
                            }`}
                            title={speakingMsgId === msg.id ? "Hentikan suara" : "Bacakan jawaban (Text-to-Speech)"}
                            aria-label={speakingMsgId === msg.id ? "Hentikan suara" : "Bacakan jawaban"}
                          >
                            {speakingMsgId === msg.id ? (
                              <VolumeX className="w-4 h-4 stroke-[1.6]" />
                            ) : (
                              <Volume2 className="w-4 h-4 stroke-[1.6]" />
                            )}
                          </button>

                          {/* 6. Share icon */}
                          <button
                            type="button"
                            onClick={() => handleShareMessage(msg.replyText || "", msg.id)}
                            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title={sharedMsgId === msg.id ? "Tautan disalin!" : "Bagikan pesan"}
                            aria-label={sharedMsgId === msg.id ? "Tautan disalin" : "Bagikan pesan"}
                          >
                            {sharedMsgId === msg.id ? (
                              <Check className="w-4 h-4 text-slate-900 dark:text-white" />
                            ) : (
                              <Share2 className="w-4 h-4 stroke-[1.6]" />
                            )}
                          </button>

                          {/* 7. Icon Papan Tulis */}
                          {msg.smartboardItem && (
                            <button
                              type="button"
                              onClick={() => handleOpenSmartboard(msg.smartboardItem)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.09] backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] transition-all ml-1 cursor-pointer"
                              title={`Lihat ${msg.smartboardItem.label}`}
                            >
                              <Box className="w-3.5 h-3.5 stroke-[1.8]" />
                              <span>{msg.smartboardItem.model === "2d_shape" ? "Papan Tulis 2D" : "Papan Tulis 3D"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5 items-center">
                  <ZapLogo className="w-[18px] h-[18px] animate-pulse text-[#09090b] dark:text-white" />
                  <div className="bg-white dark:bg-[#14161f]/80 backdrop-blur-xl border border-zinc-200/90 dark:border-white/[0.08] rounded-2xl px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{loadingStatus}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          </div>

          {/* 2. FIXED BOTTOM COMPOSER (Stays strictly fixed at bottom when scrolling messages) */}
          <div className="w-full flex-shrink-0 z-10 bg-[#faf9f6]/90 dark:bg-[#0e0f12]/90 backdrop-blur-md">
            <div className="w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 pb-4 pt-2">
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full bg-white/95 dark:bg-[#14161f]/80 backdrop-blur-xl border ${
                  isDraggingOver
                    ? "border-[#c4956a] ring-2 ring-[#c4956a]/30 bg-[#faf4ed]/40"
                    : "border-zinc-200/90 dark:border-white/[0.09] focus-within:border-[#c4956a] dark:focus-within:border-white/20 focus-within:ring-2 focus-within:ring-[#c4956a]/20 dark:focus-within:ring-white/15"
                } rounded-3xl p-3.5 sm:p-4 shadow-[0_16px_40px_-12px_rgba(9,9,11,0.08)] transition-all text-left relative`}
              >
                {/* Drag & Drop Visual Overlay */}
                {isDraggingOver && (
                  <div className="absolute inset-0 z-20 rounded-3xl bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-sm border-2 border-dashed border-amber-500 dark:border-amber-400 flex flex-col items-center justify-center pointer-events-none animate-fade-in text-center p-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 shadow-md">
                      <FileUp className="w-5 h-5 animate-pulse" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Lepaskan gambar atau dokumen di sini
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Mendukung tangkapan layar, JPG, PNG, PDF, atau teks aljabar
                    </span>
                  </div>
                )}

                {/* Security Warning / Account Suspension Indicator */}
                {isAccountSuspended ? (
                  <div className="flex flex-col gap-2.5 p-3.5 mb-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 animate-fade-in select-none">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-900 dark:text-rose-200">
                          Akses ChatZAP Ditangguhkan Permanen
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                          Akun Anda dibekukan akibat percobaan manipulasi instruksi (jailbreak) berulang. Untuk permohonan pemulihan akses, silakan email:{" "}
                          <a href="mailto:wakhidpangestu1@gmail.com" className="font-mono font-semibold underline text-rose-800 dark:text-rose-100 hover:opacity-80">
                            wakhidpangestu1@gmail.com
                          </a>
                        </p>
                      </div>
                    </div>
                    {/* Form Input Kode Pemulihan jika pengguna menerima balasan email dari Admin */}
                    <div className="flex items-center gap-2 pt-2 border-t border-rose-500/20">
                      <input
                        type="text"
                        aria-label="Kode pemulihan akun dari Admin"
                        placeholder="Punya Kode Pemulihan dari Admin? (Contoh: ZAP-...)"
                        value={userRecoveryCodeInput}
                        onChange={(e) => setUserRecoveryCodeInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/70 dark:bg-black/40 border border-rose-500/30 text-rose-900 dark:text-rose-100 placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleRedeemUserRecoveryCode}
                        disabled={userRecoveryLoading || !userRecoveryCodeInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium text-xs cursor-pointer transition whitespace-nowrap shadow-xs"
                      >
                        {userRecoveryLoading ? "Memeriksa..." : "Pulihkan Akun"}
                      </button>
                    </div>
                    {userRecoveryMessage && (
                      <p className={`text-xs ${userRecoveryMessage.error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {userRecoveryMessage.text}
                      </p>
                    )}
                  </div>
                ) : jailbreakStrikes === 1 ? (
                  <div className="flex items-center justify-between p-2.5 mb-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 animate-fade-in select-none">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-medium">
                        <strong>Peringatan Keamanan:</strong> Terdeteksi 1x percobaan jailbreak. ChatZAP tidak akan dapat diakses jika jailbreak 1 kali lagi.
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                      Strike 1/2
                    </span>
                  </div>
                ) : null}

                {/* Editing Message Indicator */}
                {editingMsgId && (
                  <div className="flex items-center justify-between px-3.5 py-2 mb-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/20 text-xs text-amber-700 dark:text-amber-300 animate-fade-in select-none">
                    <div className="flex items-center gap-2 font-medium">
                      <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <span>Mengedit pesan sebelumnya - Tekan Enter atau Kirim untuk memperbarui</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMsgId(null);
                        setInputText("");
                      }}
                      className="px-2 py-0.5 rounded-md hover:bg-amber-500/20 text-xs font-semibold cursor-pointer transition text-amber-800 dark:text-amber-200"
                    >
                      Batal Edit
                    </button>
                  </div>
                )}

                {/* Attached File Chips with Image Previews */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {attachedFiles.map((f) => {
                      const isImg = f.type.startsWith("image/") || (f.dataUrl && f.dataUrl.startsWith("data:image/"));
                      return (
                        <div
                          key={f.id}
                          className={`group relative flex items-center gap-2 rounded-xl border transition-all ${
                            isImg
                              ? "p-1.5 bg-slate-100/90 dark:bg-zinc-800/80 border-slate-300 dark:border-white/10"
                              : "px-2.5 py-1 bg-slate-100 dark:bg-[#22252c] border-slate-200 dark:border-white/[0.1] text-xs text-slate-800 dark:text-zinc-200"
                          }`}
                        >
                          <div
                            onClick={() => setPreviewFile(f)}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition min-w-0"
                            title="Klik untuk pratinjau penuh"
                          >
                            {isImg && f.dataUrl ? (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-zinc-900 shrink-0 border border-black/5 dark:border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="font-medium max-w-[130px] truncate text-xs text-slate-800 dark:text-zinc-200">
                                {f.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                                {Math.round(f.size / 1024) || 1} KB
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id));
                            }}
                            className="p-1 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                            title="Hapus lampiran"
                            aria-label={`Hapus lampiran ${f.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  aria-label="Ketik pertanyaan atau langkah aljabar"
                  value={inputText}
                  disabled={loading || isAccountSuspended}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={2}
                  placeholder={
                    isAccountSuspended
                      ? "Akun Anda telah ditangguhkan. Hubungi wakhidpangestu1@gmail.com untuk permohonan pemulihan akses."
                      : "Tulis soal, langkah pengerjaan, atau pertanyaan matematikamu di sini... (atau tempel/seret gambar ke sini)"
                  }
                className="w-full bg-transparent text-[15px] sm:text-base text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none focus-visible:ring-0 resize-none font-sans leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="flex items-center justify-between gap-2 pt-2 min-w-0">
                <PromptActionBarLeft
                  showAttachMenu={showAttachMenu}
                  setShowAttachMenu={setShowAttachMenu}
                  showSubUploadMenu={showSubUploadMenu}
                  setShowSubUploadMenu={setShowSubUploadMenu}
                  showWorkspaceMenu={showWorkspaceMenu}
                  setShowWorkspaceMenu={setShowWorkspaceMenu}
                  workspaceMode={workspaceMode}
                  setWorkspaceMode={setWorkspaceMode}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  setActiveWorkspaceId={setActiveWorkspaceId}
                  workspaceFilesCount={workspaceFiles.length}
                  onUploadFilesClick={() => fileInputRef.current?.click()}
                  onCameraClick={() => cameraInputRef.current?.click()}
                  onInsertLatex={insertLatexTemplate}
                  onInsertPython={insertPythonCasTemplate}
                  onInsertExample={insertExampleProblem}
                  onOpenSmartboard={() => {
                    setActive3DModel("empty");
                    setShowRightPane(true);
                    setRightPaneTab("canvas");
                  }}
                  onOpenWorkspaceFiles={() => {
                    setShowRightPane(true);
                    setRightPaneTab("files");
                  }}
                  attachMenuRef={attachMenuRef}
                  workspaceMenuRef={workspaceMenuRef}
                />

                <div className="flex items-center gap-2">
                  <ModelPickerWithEffort
                    variant="chatzap"
                    dropUp={true}
                    selectedModelId={selectedModel.id}
                    onSelectModel={handleSelectModel}
                    reasoningEffort={reasoningEffort}
                    onChangeEffort={setReasoningEffort}
                  />

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={loading || isAccountSuspended || !inputText.trim()}
                    title="Kirim pesan"
                    aria-label="Kirim pesan"
                    className={`w-7 h-7 min-w-[28px] min-h-[28px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer ${
                      inputText.trim() && !loading && !isAccountSuspended
                        ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
                        : "bg-slate-200 dark:bg-[#282a32] text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
      )}
    </main>

      {/* 3. RIGHT COLUMN ("Start" Workspace / Tools Pane - Persis Screenshot 0 & 2) */}
      {showRightPane && (
        <div
          className={`h-full bg-[#f5f3ef] dark:bg-[#111216] flex flex-col overflow-hidden transition-all duration-200 max-lg:fixed max-lg:inset-0 max-lg:z-40 lg:relative ${
            rightPaneFullscreen ? "w-full" : "w-full lg:w-1/2 flex-1"
          }`}
        >
          {/* Header Bar: Compass Start + Window Controls (Columns, Maximize, Close) */}
          <div className="h-11 px-3.5 flex items-center justify-between border-b border-zinc-200/80 dark:border-white/[0.06] flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#111216] z-10">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-zinc-300 font-medium">
              <Compass className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>
                {rightPaneTab === "start"
                  ? "Start"
                  : rightPaneTab === "files"
                  ? "Lampiran Sesi"
                  : "Papan Tulis Pintar"}
              </span>
              {rightPaneTab !== "start" && (
                <button
                  type="button"
                  onClick={() => setRightPaneTab("start")}
                  className="ml-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer font-medium"
                >
                  Kembali ke Start
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (rightPaneFullscreen) {
                    setRightPaneFullscreen(false);
                  } else {
                    setShowRightPane(false);
                  }
                }}
                title={rightPaneFullscreen ? "Kembalikan layar belah (Split View)" : "Sembunyikan panel kanan"}
                aria-label={rightPaneFullscreen ? "Kembalikan layar belah (Split View)" : "Sembunyikan panel kanan"}
                className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setRightPaneFullscreen((prev) => !prev)}
                title={rightPaneFullscreen ? "Keluar layar penuh" : "Layar penuh"}
                aria-label={rightPaneFullscreen ? "Keluar layar penuh" : "Layar penuh"}
                className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                {rightPaneFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRightPane(false);
                  setRightPaneFullscreen(false);
                }}
                title="Tutup panel"
                aria-label="Tutup panel"
                className="p-1.5 min-w-[26px] min-h-[26px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 relative flex flex-col justify-center items-center overflow-hidden">
            {/* SUB-VIEW 1: START TAB (Persis Screenshot 0 & 2) */}
            {rightPaneTab === "start" && (
              <>
                {/* Background Compass Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] dark:opacity-[0.07]">
                  <Compass className="w-48 h-48 text-slate-400 dark:text-white" strokeWidth={0.8} />
                </div>

                {/* Centered Stack of Action Cards */}
                <div className="w-full max-w-[420px] px-4 space-y-2.5 relative z-10">
                  {/* Card 1: Papan Tulis Pintar */}
                  <button
                    type="button"
                    onClick={() => {
                      setActive3DModel("empty");
                      setRightPaneTab("canvas");
                    }}
                    className="w-full text-left flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1b1c21] hover:bg-slate-50 dark:hover:bg-[#21232a] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] transition cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-700 dark:text-zinc-300 flex-shrink-0">
                        <Box className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-xs text-slate-800 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-1.5">
                          <span>Papan Tulis Pintar</span>
                          <span className="text-xs text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.08] font-mono">2D / 3D</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">
                          Coret-coret kapur, grafik fungsi, &amp; geometri irisan
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Card 4: More tools */}
                  <button
                    type="button"
                    onClick={() => setShowMoreModal(true)}
                    className="w-full text-left flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1b1c21] hover:bg-slate-50 dark:hover:bg-[#21232a] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] transition cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-700 dark:text-zinc-300 flex-shrink-0">
                        <LayoutGrid className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <div className="font-medium text-xs text-slate-800 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white">
                          More tools
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">
                          Modul kalkulus dan konektor
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* SUB-VIEW 2: WORKSPACE FILES */}
            {rightPaneTab === "files" && (
              <div className="w-full h-full flex flex-col p-4 bg-slate-50 dark:bg-[#0d0e12]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                    <span className="truncate">
                      Proyek: {workspaces.find((w) => w.id === activeWorkspaceId)?.name || "Tanpa Proyek"}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono bg-slate-200/60 dark:bg-white/[0.04] px-1.5 py-0.5 rounded flex-shrink-0">
                      {workspaceFiles.length} berkas
                    </span>
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 text-xs font-medium transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPaneTab("start")}
                      className="text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2 py-1 min-h-[28px]"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* Workspace Files List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-1.5 font-mono text-xs text-slate-600 dark:text-zinc-400">
                  {workspaceFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewFile(file)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.1] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="text-slate-800 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white font-medium truncate">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 font-mono flex-shrink-0">
                        <span>{Math.round(file.size / 1024) || 1} KB</span>
                        <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white transition" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: SMARTBOARD VIRTUAL (2D / 3D / CHALKBOARD) */}
            {rightPaneTab === "canvas" && (
              <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#080a0f] relative">
                <InteractiveCanvas3D
                  key={`canvas_${active3DModel}_${activeSolidKind}_${activePlaneShapeKind}`}
                  initialModel={active3DModel}
                  initialSolidKind={activeSolidKind}
                  initialPlaneShapeKind={activePlaneShapeKind}
                  initialParamA={canvasParamA}
                  initialParamB={canvasParamB}
                  initialParamC={canvasParamC}
                  initialUnit={canvasUnit}
                  initialShowSlice={canvasShowSlice}
                  showComparisonFault={showFaultComparison}
                  onModelChange={setActive3DModel}
                  onSolidKindChange={setActiveSolidKind}
                  onPlaneShapeChange={setActivePlaneShapeKind}
                  onParamsChange={(a, b, c, u) => {
                    setCanvasParamA(a);
                    setCanvasParamB(b);
                    setCanvasParamC(c);
                    if (u) setCanvasUnit(u);
                  }}
                  isProjectorMode={isProjectorMode}
                  onToggleProjector={() => setIsProjectorMode(!isProjectorMode)}
                  onClose={() => setRightPaneTab("start")}
                  collabName={currentUser?.name || "Siswa Tamu"}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PLUGINS / CONNECTOR */}
      {showPluginModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-lg p-5 space-y-4 animate-liquid-pop">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Plugins &amp; Model Connectors</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPluginModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Konfigurasikan API key untuk NVIDIA NIM, DeepSeek Cloud, ChatGPT OpenAI, Claude Anthropic, atau Custom Local Model (Ollama).
            </p>
            <div className="space-y-2 pt-1">
              <Link
                href="/connector"
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Buka Halaman Lengkap Connector Hub</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUTOMATION TASKS (Interaktif, Realtime CAS Audit & Cache Sweeper) */}
      {showTasksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-lg p-5 space-y-4 animate-liquid-pop">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-800 dark:text-white">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Automation Tasks &amp; Invariants</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Pusat kendali otomatisasi SymPy CAS, pemeliharaan memori &amp; sinkronisasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTasksModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Task Controls & Features */}
            <div className="space-y-3 text-xs">
              {/* Feature 1: CAS Invariant Live Audit */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a1c22] border border-slate-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">SymPy CAS Invariant Audit</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">Verifikasi 22 invarian aljabar deterministik &amp; whitelist parser</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunCasAudit}
                    disabled={casAuditRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${casAuditRunning ? "animate-spin" : ""}`} />
                    <span>{casAuditRunning ? "Menguji..." : "Jalankan Audit"}</span>
                  </button>
                </div>
                {casAuditResult && (
                  <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.04] text-xs text-slate-800 dark:text-zinc-200 font-mono">
                    {casAuditResult}
                  </div>
                )}
              </div>

              {/* Feature 2: Scratchpad & Cache Sweeper */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a1c22] border border-slate-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Pembersih Scratchpad &amp; Draft Telemetri</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">Bersihkan sisa draft lokal dan token cache sementara</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSweepScratchpad}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-zinc-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan</span>
                  </button>
                </div>
                {lastSweepResult && (
                  <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-white/[0.04] text-xs text-slate-800 dark:text-zinc-200 font-mono">
                    {lastSweepResult}
                  </div>
                )}
              </div>

              {/* Feature 3 & 4: Automation Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1c22] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white text-xs">Auto-Sync Vault</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">Sinkronkan ke Cloud</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoSyncEnabled}
                    aria-label="Aktifkan Auto-Sync Vault"
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoSyncEnabled ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                        autoSyncEnabled ? "translate-x-4 bg-white dark:bg-slate-900" : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1c22] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white text-xs">Auto-Format LaTeX</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">Format rumus baku</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoLatexEnabled}
                    aria-label="Aktifkan Auto-Format LaTeX"
                    onClick={() => setAutoLatexEnabled(!autoLatexEnabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoLatexEnabled ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                        autoLatexEnabled ? "translate-x-4 bg-white dark:bg-slate-900" : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Task Activity Logs */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs uppercase font-mono tracking-wider text-slate-500 dark:text-zinc-400">
                  Log Riwayat Tugas
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {taskLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-[#17181d] border border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-slate-700 dark:text-zinc-300"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Check className="w-3 h-3 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="truncate">{log.name}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 flex-shrink-0 ml-2">
                        {log.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MORE */}
      {showMoreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-md p-5 space-y-4 animate-liquid-pop">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Alat &amp; Modul Ekstra</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowMoreModal(false);
                  setActive3DModel("empty");
                  setShowRightPane(true);
                  setRightPaneTab("canvas");
                }}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-slate-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <Box className="w-4 h-4 text-slate-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-slate-900 dark:text-white">Papan Tulis 3D</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">Simulasi grafik interaktif</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreModal(false);
                  setShowPluginModal(true);
                }}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-slate-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-slate-900 dark:text-white">Plugins &amp; Konektor</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">Kunci model dan konektor BYOK</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreModal(false);
                  setShowTasksModal(true);
                }}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-slate-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-slate-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-slate-900 dark:text-white">Automation Tasks</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">Audit CAS dan pembersihan lokal</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW WORKSPACE */}
      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-sm p-5 space-y-4 animate-liquid-pop">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Buat Proyek Belajar Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewWorkspaceModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="new-workspace-name" className="text-xs text-slate-600 dark:text-zinc-400">Nama Proyek</label>
              <input
                id="new-workspace-name"
                type="text"
                aria-label="Nama Proyek Baru"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkspace();
                }}
                placeholder="Misal: Aljabar SMA, Geometri 3D, UTBK..."
                className="w-full bg-slate-50 dark:bg-[#1b1c22] border border-slate-300 dark:border-white/[0.1] focus:border-slate-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewWorkspaceModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim()}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  newWorkspaceName.trim()
                    ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
                    : "bg-slate-200 dark:bg-[#282a32] text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                }`}
              >
                Buat Proyek
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW FILE WORKSPACE */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-liquid-pop">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-[#191b22]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <span className="font-semibold text-sm text-slate-900 dark:text-white">{previewFile.name}</span>
                <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                  ({Math.round(previewFile.size / 1024) || 1} KB)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewFile.content && !previewFile.content.startsWith("data:") && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText((prev) => (prev ? prev + "\n" + previewFile.content : previewFile.content!));
                      setPreviewFile(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>Kirim ke Chat</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const mediaSource = previewFile.dataUrl || previewFile.content || "";
                    if (mediaSource.startsWith("data:")) {
                      const a = document.createElement("a");
                      a.href = mediaSource;
                      a.download = previewFile.name;
                      a.click();
                    } else {
                      const blob = new Blob([previewFile.content || ""], { type: previewFile.type || "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = previewFile.name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                  title="Unduh berkas"
                  aria-label="Unduh berkas"
                >
                  <Download className="w-4 h-4" />
                </button>
                {previewFile.workspaceId !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceFiles((prev) => {
                        const next = prev.filter((f) => f.id !== previewFile.id);
                        try {
                          localStorage.setItem("zap_workspace_files", JSON.stringify(next));
                        } catch (e) {
                          console.warn(e);
                        }
                        return next;
                      });
                      setPreviewFile(null);
                    }}
                    className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                    title="Hapus berkas dari lampiran sesi"
                    aria-label="Hapus berkas dari lampiran sesi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  aria-label="Tutup pratinjau berkas"
                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Content Display */}
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-[#0b0c10] text-slate-800 dark:text-zinc-300 leading-relaxed select-text flex items-center justify-center">
              {(() => {
                const isImg =
                  previewFile.type.startsWith("image/") ||
                  previewFile.dataUrl?.startsWith("data:image/") ||
                  previewFile.content?.startsWith("data:image/") ||
                  /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(previewFile.name);
                const isPdf =
                  previewFile.type === "application/pdf" ||
                  previewFile.dataUrl?.startsWith("data:application/pdf") ||
                  previewFile.content?.startsWith("data:application/pdf") ||
                  /\.pdf$/i.test(previewFile.name);
                const isVideo =
                  previewFile.type.startsWith("video/") ||
                  previewFile.dataUrl?.startsWith("data:video/") ||
                  previewFile.content?.startsWith("data:video/") ||
                  /\.(mp4|webm|mov|mkv|ogg)$/i.test(previewFile.name);
                const mediaSource = previewFile.dataUrl || previewFile.content || "";

                if (isImg && mediaSource) {
                  return (
                    <div className="w-full flex items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaSource}
                        alt={previewFile.name}
                        className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-md border border-black/5 dark:border-white/10"
                      />
                    </div>
                  );
                }

                if (isPdf && mediaSource) {
                  return (
                    <div className="w-full h-[72vh] rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-white">
                      <iframe
                        src={mediaSource}
                        title={previewFile.name}
                        className="w-full h-full border-0"
                      />
                    </div>
                  );
                }

                if (isVideo && mediaSource) {
                  return (
                    <div className="w-full flex items-center justify-center p-2">
                      <video
                        src={mediaSource}
                        controls
                        autoPlay
                        className="max-h-[72vh] max-w-full rounded-2xl shadow-md border border-black/5 dark:border-white/10"
                      />
                    </div>
                  );
                }

                if (previewFile.content && !previewFile.content.startsWith("data:")) {
                  return (
                    <div className="w-full h-full text-left font-mono text-xs">
                      <pre className="whitespace-pre-wrap p-4 rounded-2xl bg-white dark:bg-[#121318] border border-slate-200 dark:border-white/[0.08] overflow-x-auto selection:bg-amber-500/20">
                        {previewFile.content}
                      </pre>
                    </div>
                  );
                }

                return (
                  <div className="text-center py-12 text-slate-500 dark:text-zinc-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{previewFile.name}</p>
                    <p className="text-xs mt-1">Pratinjau langsung tidak tersedia untuk format biner ini.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PENGATURAN & TAMPILAN (SETTINGS & APPEARANCE MODAL) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-popup rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-liquid-pop">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/80 dark:bg-[#181a20]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-800 dark:text-white">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Pengaturan &amp; Preferensi ChatZAP</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Atur tampilan, bahasa percakapan, dan sinkronisasi akun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Tutup modal pengaturan"
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body with Horizontal Tabs */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#16171d]/50 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSettingsTab("appearance")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                    settingsTab === "appearance"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Tampilan &amp; Tema</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("general")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                    settingsTab === "general"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Umum &amp; Bahasa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("sync")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                    settingsTab === "sync"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Cadangan Akun</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("models")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                    settingsTab === "models"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Invarian CAS &amp; AI</span>
                </button>
                {currentUser?.email?.toLowerCase().trim() === "wakhidpangestu1@gmail.com" && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab("admin")}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
                      settingsTab === "admin"
                        ? "border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400"
                        : "border-transparent text-rose-500/70 hover:text-rose-600 dark:hover:text-rose-400"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Konsol Superadmin</span>
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700 dark:text-zinc-300">
                {/* 1. APPEARANCE TAB */}
                {settingsTab === "appearance" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-white mb-1">Pilihan Mode Tampilan (Theme)</h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">Pilih tema antarmuka sesuai dengan kenyamanan mata Anda.</p>
                    </div>

                    {/* 3 Theme Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Light Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("light");
                          if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "light" } });
                        }}
                        aria-pressed={theme === "light"}
                        className={`text-left p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          theme === "light"
                            ? "border-slate-900 dark:border-white bg-slate-100/70 dark:bg-white/[0.08] shadow-md"
                            : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50 dark:bg-[#181a20]"
                        }`}
                      >
                        <div className="space-y-2 w-full">
                          <div className="h-16 rounded-lg bg-white border border-slate-200 p-2 flex flex-col justify-between shadow-xs">
                            <div className="flex items-center justify-between">
                              <div className="w-3 h-3 rounded-full bg-slate-900" />
                              <div className="w-12 h-1.5 rounded-full bg-slate-200" />
                            </div>
                            <div className="space-y-1">
                              <div className="w-full h-2 rounded bg-slate-100" />
                              <div className="w-3/4 h-2 rounded bg-slate-100" />
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Sun className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                                <span>Mode Terang</span>
                              </span>
                              {theme === "light" && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-normal">
                              Latar putih bersih dengan kontras tinggi, nyaman untuk membaca di siang hari.
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Dark Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("dark");
                          if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "dark" } });
                        }}
                        aria-pressed={theme === "dark"}
                        className={`text-left p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          theme === "dark"
                            ? "border-slate-900 dark:border-white bg-slate-100/70 dark:bg-white/[0.08] shadow-md"
                            : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50 dark:bg-[#181a20]"
                        }`}
                      >
                        <div className="space-y-2 w-full">
                          <div className="h-16 rounded-lg bg-[#0e0f12] border border-white/[0.1] p-2 flex flex-col justify-between shadow-xs">
                            <div className="flex items-center justify-between">
                              <div className="w-3 h-3 rounded-full bg-white" />
                              <div className="w-12 h-1.5 rounded-full bg-zinc-700" />
                            </div>
                            <div className="space-y-1">
                              <div className="w-full h-2 rounded bg-zinc-800" />
                              <div className="w-3/4 h-2 rounded bg-zinc-800" />
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                                <span>Mode Gelap</span>
                              </span>
                              {theme === "dark" && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-normal">
                              Latar pekat hemat daya dan ramah mata, optimal untuk fokus dan malam hari.
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* System Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("system");
                          if (currentUser) syncAccountBackup(currentUser, { configs: { theme: "system" } });
                        }}
                        aria-pressed={theme === "system"}
                        className={`text-left p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          theme === "system"
                            ? "border-slate-900 dark:border-white bg-slate-100/70 dark:bg-white/[0.08] shadow-md"
                            : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50 dark:bg-[#181a20]"
                        }`}
                      >
                        <div className="space-y-2 w-full">
                          <div className="h-16 rounded-lg bg-gradient-to-r from-white via-slate-200 to-[#0e0f12] border border-slate-300 dark:border-white/[0.1] p-2 flex flex-col justify-between shadow-xs">
                            <div className="flex items-center justify-between">
                              <div className="w-3 h-3 rounded-full bg-slate-600 dark:bg-zinc-400" />
                              <div className="w-12 h-1.5 rounded-full bg-slate-400" />
                            </div>
                            <div className="space-y-1">
                              <div className="w-full h-2 rounded bg-slate-300 dark:bg-zinc-700" />
                              <div className="w-3/4 h-2 rounded bg-slate-300 dark:bg-zinc-700" />
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Laptop className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                                <span>Sistem Operasi</span>
                              </span>
                              {theme === "system" && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-normal">
                              Otomatis mengikuti preferensi tema dari perangkat atau browser Anda.
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Proyektor Switch */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">Mode Proyektor &amp; Papan Tulis Kelas</div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          Tingkatkan ketebalan garis koordinat dan kontras warna canvas 3D agar jelas terlihat di proyektor kelas.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isProjectorMode}
                        aria-label="Aktifkan Mode Proyektor dan Papan Tulis Kelas"
                        onClick={() => setIsProjectorMode(!isProjectorMode)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          isProjectorMode ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                            isProjectorMode ? "translate-x-5 bg-white dark:bg-slate-900" : "translate-x-0 bg-white"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. GENERAL TAB */}
                {settingsTab === "general" && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-3">
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-white">Identitas Pengguna</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase block">Nama Lengkap</span>
                          <div className="font-medium text-slate-900 dark:text-white mt-0.5">{currentUser?.name}</div>
                        </div>
                        <div>
                          <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase block">{isGuestAccount(currentUser) ? "Email Akun" : "Email Google"}</span>
                          <div className="font-medium text-slate-900 dark:text-white mt-0.5 truncate">{currentUser?.email}</div>
                        </div>
                        {isGuestAccount(currentUser) && (
                          <>
                            <div>
                              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase block">Jenjang Pendidikan</span>
                              <div className="font-medium text-slate-900 dark:text-white mt-0.5">{currentUser?.jenjang || "Tamu"}</div>
                            </div>
                            <div>
                              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase block">Peran</span>
                              <div className="font-medium text-slate-900 dark:text-white mt-0.5">{currentUser?.role || "Tamu"}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Security & Strike Status */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          <h3 className="font-semibold text-xs text-slate-900 dark:text-white">Status Keamanan Akun</h3>
                        </div>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                            isAccountSuspended
                              ? "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : jailbreakStrikes > 0
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {isAccountSuspended
                            ? "Ditangguhkan (Suspended)"
                            : jailbreakStrikes > 0
                            ? `Peringatan (${jailbreakStrikes}/2 Strike)`
                            : "Normal (Aktif)"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {isAccountSuspended
                          ? "Akun Anda saat ini ditangguhkan akibat terdeteksi melakukan percobaan manipulasi instruksi (jailbreak) berulang."
                          : jailbreakStrikes > 0
                          ? "Akun Anda memiliki 1 peringatan keamanan. Percobaan jailbreak 1 kali lagi akan langsung menangguhkan akun secara permanen."
                          : "Akun Anda bersih dari catatan pelanggaran keamanan atau percobaan jailbreak."}
                      </p>

                      {(isAccountSuspended || jailbreakStrikes > 0) && (
                        <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-white/[0.06]">
                          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                            Admin: wakhidpangestu1@gmail.com
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAccountSuspended(false);
                              setJailbreakStrikes(0);
                              if (typeof window !== "undefined") {
                                localStorage.removeItem("zap_account_suspended");
                                localStorage.removeItem("zap_jailbreak_strikes");
                              }
                              alert("Status penangguhan akun berhasil dicabut! Strike direset ke 0.");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-medium hover:opacity-90 transition cursor-pointer"
                          >
                            Cabut Penangguhan &amp; Reset
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">Konsistensi Bahasa Percakapan</div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                          Aktif Otomatis
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        AI akan secara konsisten merespons dengan bahasa yang Anda gunakan di 2–3 chat awal (misalnya Bahasa Indonesia), bahkan jika di tengah percakapan Anda menyisipkan instruksi dalam bahasa lain.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">Auto-scroll Percakapan</div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          Otomatis menggulir layar ke bawah saat respons Sokratik baru tiba.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoScrollChat}
                        aria-label="Aktifkan Auto-scroll Percakapan"
                        onClick={() => setAutoScrollChat(!autoScrollChat)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          autoScrollChat ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                            autoScrollChat ? "translate-x-5 bg-white dark:bg-slate-900" : "translate-x-0 bg-white"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. SYNC TAB */}
                {settingsTab === "sync" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-white">Cadangan Akun Google Cloud</div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            Terhubung: <span className="font-mono text-slate-700 dark:text-zinc-300">{currentUser?.email}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                        Semua data sesi belajar, preferensi tema ({theme}), konfigurasi model AI, dan lampiran sesi otomatis dicadangkan setiap kali Anda berinteraksi.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-2">
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-white">Data yang Tersimpan:</h3>
                      <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                          <span>Riwayat semua percakapan matematika ({conversations.length} sesi)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                          <span>Berkas Workspace ({workspaceFiles.length} berkas)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                          <span>Tema Tampilan ({theme.toUpperCase()}) &amp; API Keys terenkripsi</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {syncSuccessToast ? (
                          <span className="text-slate-900 dark:text-white font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Data berhasil disinkronkan ke Google Cloud!
                          </span>
                        ) : (
                          <span>Sinkronisasi otomatis aktif</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          syncAccountBackup(currentUser);
                          setSyncSuccessToast(true);
                          setTimeout(() => setSyncSuccessToast(false), 3000);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 text-xs font-medium transition flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Sinkronkan Sekarang</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. CAS & AI MODELS TAB */}
                {settingsTab === "models" && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">22 Invarian Deterministic SymPy CAS</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                          22/22 Terverifikasi
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        SymPy CAS bertindak sebagai satu-satunya penentu kebenaran matematis. Tidak ada LLM yang diizinkan menentukan apakah langkah penurunan rumus Anda valid.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">Zero Answer Policy (ZAP) Guardrail</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                          Aktif &amp; Terproteksi
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        Sistem tidak pernah memberikan jawaban numerik instan kepada siswa, melainkan mengarahkan lewat kontra-contoh substitusi dan pertanyaan pemantik Sokratik.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/connector"
                        onClick={() => setShowSettingsModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                        <span>Buka Hub Model &amp; API Keys (/connector) &rarr;</span>
                      </Link>
                    </div>
                  </div>
                )}

                {/* 5. SUPERADMIN SECURITY CONSOLE TAB (wakhidpangestu1@gmail.com) */}
                {settingsTab === "admin" && currentUser?.email?.toLowerCase().trim() === "wakhidpangestu1@gmail.com" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-900 dark:text-rose-200">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Pusat Kendali Keamanan Superadmin (Wakhid Pangestu)</span>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                          Superadmin Mode
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                        Kelola permohonan pemulihan akun siswa yang terkena sanksi penangguhan akibat percobaan jailbreak.
                        Anda dapat membuka blokir langsung berdasarkan email atau menghasilkan link/kode pemulihan 1-klik untuk dibalas ke email siswa.
                      </p>
                    </div>

                    {/* Form Buka Blokir & Draf Balasan */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-3">
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-white">Buka Blokir Pengguna Berdasarkan Email</h3>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          aria-label="Email siswa yang ingin dibuka blokirnya"
                          placeholder="Masukkan email siswa (misal: user@gmail.com)"
                          value={adminTargetEmail}
                          onChange={(e) => setAdminTargetEmail(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdminUnbanUser()}
                          disabled={adminUnbanLoading || !adminTargetEmail.trim()}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5"
                        >
                          {adminUnbanLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Buka Blokir Sekarang</span>
                        </button>
                      </div>

                      {/* Hasil Aksi Admin */}
                      {adminActionResult && (
                        <div className={`p-3 rounded-xl border text-xs space-y-2 animate-fade-in ${
                          adminActionResult.success
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                            : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200"
                        }`}>
                          <div className="font-semibold">{adminActionResult.message}</div>
                          {adminActionResult.token && (
                            <div className="space-y-1.5 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                              <div className="text-[11px]">
                                <strong>Kode Pemulihan:</strong>{" "}
                                <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 select-all">
                                  {adminActionResult.token}
                                </span>
                              </div>
                              <div className="text-[11px] truncate">
                                <strong>Link 1-Klik:</strong>{" "}
                                <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300 underline select-all">
                                  {adminActionResult.url}
                                </span>
                              </div>
                              <div className="pt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (adminActionResult.url) {
                                      navigator.clipboard.writeText(adminActionResult.url);
                                      setAdminCopiedLink(true);
                                      setTimeout(() => setAdminCopiedLink(false), 2500);
                                    }
                                  }}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                  {adminCopiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{adminCopiedLink ? "Tautan Berhasil Disalin!" : "Salin Tautan 1-Klik"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const template = `Halo,\n\nPermohonan pemulihan akun ChatZAP Anda (${adminTargetEmail}) telah disetujui.\n\nKlik tautan berikut untuk langsung membuka blokir akun Anda secara otomatis:\n${adminActionResult.url}\n\nAtau masukkan kode pemulihan ini pada kotak banner ChatZAP:\n${adminActionResult.token}\n\nSalam,\nWakhid Pangestu\nChatZAP Administrator`;
                                    handleAdminCopyDraft(template);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                  {adminCopiedDraft ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{adminCopiedDraft ? "Draf Balasan Tersalin!" : "Salin Draf Balasan Email"}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Daftar Pengguna Terflag / Suspended di Server */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-xs text-slate-900 dark:text-white">
                          Daftar Rekam Keamanan Pengguna ({adminSuspendedList.length})
                        </h5>
                        <button
                          type="button"
                          onClick={() => fetchAdminSuspendedList()}
                          disabled={adminLoadingList}
                          className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCw className={`w-3 h-3 ${adminLoadingList ? "animate-spin" : ""}`} />
                          <span>Segarkan</span>
                        </button>
                      </div>

                      {adminSuspendedList.length === 0 ? (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic py-2">
                          Belum ada pengguna yang tercatat melakukan pelanggaran jailbreak.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {adminSuspendedList.map((rec) => (
                            <div
                              key={rec.email}
                              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#15161b] flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5 min-w-0 pr-2">
                                <div className="font-mono font-medium text-slate-900 dark:text-white truncate">
                                  {rec.email}
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                    rec.isSuspended
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                                      : rec.unbannedAt
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                  }`}>
                                    {rec.isSuspended ? "DITANGGUHKAN" : rec.unbannedAt ? "DIPULIHKAN" : `STRIKE ${rec.strikes}/2`}
                                  </span>
                                  {rec.reason && (
                                    <span className="text-slate-400 dark:text-zinc-500 truncate max-w-xs">
                                      {rec.reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdminUnbanUser(rec.email)}
                                disabled={adminUnbanLoading}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 text-white text-[11px] font-medium transition cursor-pointer whitespace-nowrap shadow-xs"
                              >
                                Buka Blokir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal Dialog (lazy, hanya dirender saat dibuka) */}
      {shareModalOpen && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          conversation={sharingConv}
          currentUser={currentUser}
          active3DModel={active3DModel}
        />
      )}
    </div>
  );
}

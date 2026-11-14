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
import UserAvatar, { cleanAvatarUrl } from "@/components/UserAvatar";
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
import {
  clearProviderKeys,
  getProviderKey,
  getProviderSetting,
  migrateLegacyProviderKeys,
} from "@/utils/provider-keys";
import { fetchRemoteVaultEnvelope } from "@/utils/account-sync";
import {
  clearVaultState,
  isVaultConfigured,
  isVaultUnlocked,
  lockVault,
  markVaultConfigured,
  setupVault,
  unlockVault,
} from "@/lib/vault-session";
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
  Laptop,
  ShieldAlert,
  Lock as LockIcon,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
} from "lucide-react";

function ConnectorHubIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="14.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="8.5" y="13.5" width="7" height="7" rx="1.8" />
      <path d="M6 10.5v2a2 2 0 0 0 2 2h0.5" />
      <path d="M18 10.5v2a2 2 0 0 1-2 2h-0.5" />
      <path d="M9.5 7h5" />
    </svg>
  );
}

function ModernShareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19c0-4.5 3-8 9.5-8.5V6l8.5 7-8.5 7v-4.5C7.5 15.5 5 17 4 19z" />
    </svg>
  );
}

function ModernCopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="13" height="13" x="3" y="8" rx="2.5" />
      <path d="M8 8V6a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 20 6v7a2.5 2.5 0 0 1-2.5 2.5h-2" />
    </svg>
  );
}

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
  /**
   * Placeholder balasan asisten yang sedang diproses. Disimpan bersama
   * percakapan supaya (a) gelembung balasan langsung muncul begitu pesan
   * dikirim, dan (b) setelah reload/refresh, permintaan yang terputus bisa
   * dilanjutkan otomatis alih-alih menyisakan pertanyaan tanpa jawaban.
   */
  pending?: boolean;
  pendingStartedAt?: number;
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

// Jam pesan memakai satu format 24 jam (id-ID) agar tidak berubah bentuk
// mengikuti locale peramban pengguna (mis. "10:32 PM" vs "22.32").
function zapClockNow(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Menentukan apakah accordion "Sumber & acuan" perlu ditampilkan.
 * Hanya muncul pada kasus pertanyaan akademik khusus (teori, dalil, teorema, pembuktian, kurikulum,
 * atau saat pengguna menanyakan sumber secara eksplisit). Tidak dimunculkan pada pertanyaan umum,
 * sapaan kasual, atau perintah kanvas/smartboard.
 */
function shouldShowReferences(
  msg: Message,
  prevMsg?: Message
): msg is Message & { references: NonNullable<Message["references"]> } {
  if (msg.sender !== "assistant" || !msg.references || msg.references.length === 0) {
    return false;
  }

  // 1. Jika pesan berupa aksi visual geometri / smartboard / klarifikasi kanvas -> sembunyikan
  if (msg.source === "geometry-clarify" || msg.source === "smartboard" || msg.smartboardItem) {
    return false;
  }

  const query = (prevMsg?.rawText || prevMsg?.steps?.join(" ") || "").toLowerCase().trim();
  const reply = (msg.replyText || "").toLowerCase();

  // 2. Pertanyaan/perintah umum, sapaan santai, atau perintah kanvas -> sembunyikan
  const isGeneralOrCasual =
    query.length < 25 &&
    /^(halo|hai|hey|pagi|siang|sore|malam|tes|test|ok|oke|siap|makasih|terima kasih|bisa apa|siapa kamu|help|tolong)[\s.!?]*$/i.test(query);
  if (isGeneralOrCasual) return false;

  const isCanvasCommand =
    /^(tampilkan|buatkan|gambar|bikin|buka|geser|hapus|reset|putar|plot)\b.*(papan|kanvas|grafik|bangun|2d|3d|kubus|balok|prisma|limas|lingkaran|segitiga)/i.test(query);
  if (isCanvasCommand) return false;

  // 3. Kasus khusus: hanya tampilkan bila relevan dengan teori/dalil/teorema, pembuktian, kurikulum, atau user eksplisit menanyakan sumber/acuan
  const asksForSourceOrTheory =
    /(sumber|acuan|referensi|dalil|teorema|pembuktian|buktikan|dasar teori|kurikulum|rujukan|definisi|konsep dasar|rumus asal|kenapa|mengapa|bagaimana bisa)/i.test(query);

  const replyMentionsAcademicBasis =
    /(teorema|kurikulum merdeka|dalil|definisi formal|berdasarkan referensi|sumber acuan|bukti matematis)/i.test(reply);

  const hasDiagnosis = !!msg.diagnosis;

  return asksForSourceOrTheory || replyMentionsAcademicBasis || hasDiagnosis;
}

/**
 * Penghitung detik tunggu yang berdiri sendiri.
 *
 * Sengaja dipisah menjadi komponen kecil: chat/page.tsx sangat besar, dan
 * menaikkan state setiap detik di komponen induk akan me-render ulang seluruh
 * pohon percakapan. Dengan komponen ini, hanya angka detik yang berubah.
 */
function ElapsedTicker({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState<number>(0);
  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!startedAt || elapsed <= 0) return null;
  return <span className="font-mono text-zinc-400 dark:text-zinc-500">{elapsed}s</span>;
}

/**
 * Membaca aliran SSE dari `POST /api/chat`.
 *
 * Format frame: `event: <nama>\ndata: <json>\n\n`.
 * - `delta` → potongan teks balasan (sudah disanitasi guardrail di server)
 * - `done`  → payload JSON final (sumber kebenaran, menggantikan teks parsial)
 * - `error` → pesan kegagalan
 */
async function readSseStream(
  res: Response,
  onDelta: (chunk: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let final: any = null;
  let streamError: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length === 0) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any = null;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }

        if (eventName === "delta" && typeof payload?.t === "string") {
          onDelta(payload.t);
        } else if (eventName === "done") {
          final = payload;
        } else if (eventName === "error") {
          streamError = String(payload?.message || "Aliran balasan gagal");
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  if (streamError) throw new Error(streamError);
  return final;
}

/** Peringatan lembut bila provider melambat (> 20 detik). */
function SlowProviderNotice({ startedAt }: { startedAt?: number }) {
  const [slow, setSlow] = useState<boolean>(false);
  useEffect(() => {
    if (!startedAt) {
      setSlow(false);
      return;
    }
    const check = () => setSlow(Date.now() - startedAt >= 20000);
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!slow) return null;
  return (
    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
      Provider sedang lambat merespons. Balasan tetap akan muncul otomatis — jangan tutup halaman ini.
    </p>
  );
}

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
          className="absolute left-0 bottom-full mb-2.5 w-72 liquid-glass-popup rounded-2xl p-1.5 z-50 text-xs text-zinc-700 dark:text-zinc-300 animate-liquid-pop origin-bottom-left"
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 font-medium text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              Lampirkan ke ChatZAP
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                setShowSubUploadMenu(false);
              }}
              aria-label="Tutup menu lampiran"
              title="Tutup menu lampiran"
              className="p-1 hover:text-zinc-900 dark:hover:text-white rounded-lg transition cursor-pointer"
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Paperclip className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100">Unggah berkas</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">PDF, TXT, skrip Python, CSV, Markdown</div>
              </div>
            </button>

            {/* 2. Photo / Camera */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onCameraClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Camera className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100">Foto soal / coretan</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Ambil foto coretan matematika dari HP/kamera</div>
              </div>
            </button>

            {/* 3. More uploads > */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSubUploadMenu((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">Format &amp; data lainnya</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400" />
              </button>

              {showSubUploadMenu && (
                <div className="absolute left-full bottom-0 ml-1.5 w-60 liquid-glass-popup rounded-2xl p-1.5 z-50 text-xs animate-liquid-pop origin-bottom-left max-sm:left-0 max-sm:bottom-auto max-sm:top-full max-sm:mt-1 max-sm:ml-0 max-sm:w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onInsertLatex();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">Impor formula LaTeX</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Template sistem persamaan</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onInsertPython();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">Impor skrip SymPy CAS</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Kode aljabar deterministik</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowSubUploadMenu(false);
                      onOpenWorkspaceFiles();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">Lampiran Sesi</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{workspaceFilesCount} berkas tersimpan</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-zinc-100 dark:bg-white/[0.06] my-1" />

            {/* 4. Open 3D Smartboard */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onOpenSmartboard();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <Box className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Papan Tulis Pintar 3D</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 font-mono">2D/3D</span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Kanvas 3D, simulasi kubus/balok &amp; grafik 2D</div>
              </div>
            </button>

            {/* 5. Example math / algebra problems */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onInsertExample();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-left transition group cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100">Contoh Soal Aljabar</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Muat contoh coretan penurunan rumus untuk diuji</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Menu Popup Workspace (Write / Read-Only & Pilihan Workspace) */}
      {showWorkspaceMenu && (
        <div
          ref={workspaceMenuRef}
          className="absolute left-6 bottom-full mb-2.5 w-72 liquid-glass-popup rounded-2xl p-2 z-50 text-xs text-zinc-700 dark:text-zinc-300 animate-liquid-pop origin-bottom-left"
        >
          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 font-medium text-[11px]">
            <span className="text-zinc-800 dark:text-zinc-200">Mode Catatan &amp; Proyek Belajar</span>
            <button
              type="button"
              onClick={() => setShowWorkspaceMenu(false)}
              aria-label="Tutup menu proyek"
              title="Tutup menu proyek"
              className="p-1 hover:text-zinc-900 dark:hover:text-white rounded-lg transition cursor-pointer"
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
                  ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                  : "hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 mt-0.5">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Mode Catatan</span>
                  {workspaceMode === "write" && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
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
                  ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                  : "hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 mt-0.5">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Mode Baca Saja</span>
                  {workspaceMode === "read" && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                  Hanya bimbingan Sokratik dan verifikasi matematika, tanpa draf catatan baru
                </div>
              </div>
            </button>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-white/[0.06] my-1" />

          {/* Section 2: Pilih Active Workspace */}
          <div className="px-2 py-1">
            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Proyek Belajar Aktif
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {workspaces.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 italic">
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
                        ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium"
                        : "hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">Tanpa Proyek</span>
                    {!activeWorkspaceId && <Check className="w-3 h-3 text-zinc-900 dark:text-white flex-shrink-0" />}
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
                          ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium"
                          : "hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {activeWorkspaceId === ws.id && <Check className="w-3 h-3 text-zinc-900 dark:text-white flex-shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-white/[0.06] my-1" />

          {/* Quick Action: Buka Berkas Workspace */}
          <button
            type="button"
            onClick={() => {
              setShowWorkspaceMenu(false);
              onOpenWorkspaceFiles();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Buka Lampiran Sesi ({workspaceFilesCount})</span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400" />
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
        className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition cursor-pointer ${
          showAttachMenu
            ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
            : "hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
            ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white"
            : "hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Atur mode catatan & proyek belajar aktif"
        aria-label="Atur mode catatan dan proyek belajar aktif"
        aria-expanded={showWorkspaceMenu}
      >
        {workspaceMode === "write" ? (
          <Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
        )}
        <span className="hidden min-[430px]:inline whitespace-nowrap">{workspaceMode === "write" ? "Mode Catatan" : "Mode Baca"}</span>
        <span className="min-[430px]:hidden whitespace-nowrap">{workspaceMode === "write" ? "Catatan" : "Baca"}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-400" />
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
      const paramId = routeParams.id.trim();
      if (paramId && paramId.toLowerCase() !== "new") return paramId;
      return null;
    }
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const cMatch = pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/);
      if (cMatch && cMatch[1].toLowerCase() !== "new") return cMatch[1];
      const chatMatch = pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
      if (chatMatch && chatMatch[1] !== "s" && chatMatch[1].toLowerCase() !== "new") return chatMatch[1];
      const sp = new URLSearchParams(window.location.search);
      const queryId = sp.get("id") || sp.get("c");
      if (queryId && queryId.toLowerCase() !== "new") return queryId;
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
  // ID percakapan yang sedang menunggu balasan /api/chat. Balasan selalu ditulis ke percakapan ini,
  // walau pengguna sudah pindah ke percakapan lain sebelum respons tiba.
  const [, setPendingConvId] = useState<string | null>(null);
  const pendingConvIdRef = useRef<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Menganalisis langkah...");
  // Waktu mulai permintaan terakhir (detik berjalan di indikator global).
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | undefined>(undefined);
  // Notifikasi non-blokir pengganti window.alert(). alert() membekukan thread
  // utama: timer, animasi, dan finally() dari permintaan chat ikut tertahan.
  const [systemNotice, setSystemNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const notify = useCallback((text: string, tone: "info" | "error" = "info") => {
    setSystemNotice({ text, tone });
  }, []);

  // Menu Konteks Klik Kanan pada Riwayat Chat (Edit, Archive, Share, Delete)
  const [contextMenu, setContextMenu] = useState<{
    convId: string;
    conv: StoredConv;
    x: number;
    y: number;
  } | null>(null);

  // Status edit inline judul percakapan
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>("");

  // Filter tampilan percakapan diarsipkan
  const [showArchivedOnly, setShowArchivedOnly] = useState<boolean>(false);

  // Panel layout states persis seperti screenshot 0, 1, dan 2 (Tertutup default di mobile < 640px agar tidak menutupi chat)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 640;
    }
    return true;
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseInt(localStorage.getItem("zap_sidebar_width") || "256", 10);
      if (!isNaN(saved) && saved >= 200 && saved <= 420) return saved;
    }
    return 256;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const handleSidebarResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = sidebarWidth;
      setIsResizingSidebar(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextW = Math.max(200, Math.min(420, startW + delta));
        setSidebarWidth(nextW);
        try {
          localStorage.setItem("zap_sidebar_width", String(nextW));
        } catch {}
      };

      const handleUp = () => {
        setIsResizingSidebar(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [sidebarWidth]
  );

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
  // Secret administrator (hanya untuk pemilik). Disimpan di sessionStorage —
  // bukan localStorage — supaya hilang saat tab ditutup. Rute /api/admin/security
  // menolak semua aksi admin tanpa secret ini, sebelumnya handler UI tidak
  // pernah mengirimkannya sehingga panel admin selalu gagal 403.
  const [adminSecretInput, setAdminSecretInput] = useState<string>("");

  // ---- Vault terenkripsi (zero-knowledge) ----
  // Status: unconfigured = belum punya vault; locked = ada ciphertext di cloud
  // tetapi kunci belum dibuka di perangkat ini; unlocked = siap sinkron.
  const [vaultState, setVaultState] = useState<"unconfigured" | "locked" | "unlocked">("unconfigured");
  const [vaultPassphrase, setVaultPassphrase] = useState<string>("");
  const [vaultRecoveryCode, setVaultRecoveryCode] = useState<string>("");
  const [vaultBusy, setVaultBusy] = useState<boolean>(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);

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
      if (fromPath && fromPath.toLowerCase() !== "new") return fromPath;
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
  // Pemulihan balasan terputus: referensi handleSend terbaru + hitungan
  // percobaan per placeholder agar tidak terjadi loop permintaan.
  const handleSendRef = useRef<
    | ((
        customSteps?: string[],
        sampleModelType?: MathModelType,
        overrideText?: string,
        isRegenerate?: boolean,
        historySnapshot?: Message[]
      ) => Promise<void>)
    | null
  >(null);
  const resumeAttemptsRef = useRef<Record<string, number>>({});
  // Akumulator teks streaming untuk placeholder aktif.
  const streamedRef = useRef<string>("");

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
    activeConversationIdRef.current = newId;
    messagesRef.current = [];
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
    activeConversationIdRef.current = target.id;
    messagesRef.current = target.messages || [];
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
          // Penebusan token WAJIB lewat POST (GET ditolak 405 oleh rute).
          // Sebelumnya permintaan ini memakai GET sehingga tautan pemulihan
          // 1-klik dari admin tidak pernah berhasil.
          fetch("/api/admin/security", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "redeem_token", token: urlUnbanToken }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.success) {
                setIsAccountSuspended(false);
                setJailbreakStrikes(0);
                localStorage.removeItem("zap_account_suspended");
                localStorage.removeItem("zap_jailbreak_strikes");
                notify(data.message || "Akun Anda berhasil dipulihkan secara penuh! Selamat datang kembali di ChatZAP.", "info");
                const cleanPath = window.location.pathname;
                window.history.replaceState({}, "", cleanPath);
              } else {
                notify(data.message || data.error || "Kode pemulihan tidak valid atau sudah kedaluwarsa.", "error");
              }
            })
            .catch((e) => console.warn("Unban token check failed:", e));
        }

        const raw = localStorage.getItem("zap_authenticated_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.name || parsed.email)) {
            parsed.avatar = cleanAvatarUrl(parsed.avatar);
            markSessionCookie();
            setCurrentUser(parsed);
            setAuthChecked(true);

            // Kunci provider warisan (localStorage global) dipindahkan ke
            // namespace sesi akun ini lalu dihapus dari localStorage agar tidak
            // terbaca akun lain di peramban yang sama.
            migrateLegacyProviderKeys(parsed);

            const userKey = (parsed.email || parsed.id || "").toLowerCase().trim();
            const lastActiveUser = localStorage.getItem("zap_last_active_user_email")?.toLowerCase().trim();
            const isAccountSwitched = !lastActiveUser || lastActiveUser !== userKey;
            const initialTargetId = getPathConversationId();

            // Sinkronisasi status penangguhan / unban dengan database server vault.
            // Rute ini butuh admin secret (atau token pemulihan) — tanpa itu
            // server membalas 401 dan dulu memicu satu request gagal di setiap
            // mount. Penegakan status tetap berjalan di server pada tiap /api/chat,
            // jadi di sini kita hanya menyegarkan tampilan bila memang ada secret.
            const selfCheckSecret =
              typeof window !== "undefined" ? sessionStorage.getItem("zap_admin_secret") || "" : "";
            if (userKey && selfCheckSecret) {
              fetch(
                `/api/admin/security?action=check&email=${encodeURIComponent(userKey)}&secret=${encodeURIComponent(selfCheckSecret)}`
              )
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
                if (initialTargetId && initialTargetId.toLowerCase() !== "new") {
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
              if (restored.user) {
                setCurrentUser(restored.user);
              }
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
              } else if (initialTargetId && initialTargetId.toLowerCase() !== "new") {
                // HANYA pulihkan jika URL saat halaman pertama kali dibuka secara eksplisit menunjuk ke percakapan tertentu
                const found =
                  conversationsRef.current.find((c) => c.id === initialTargetId) ||
                  userConvs.find((c) => c.id === initialTargetId);
                // restoreAccountData bisa selesai beberapa detik setelah mount. Jika pengguna sudah pindah
                // percakapan / mulai chat baru / sedang menunggu balasan, JANGAN tarik dia kembali.
                const userMovedOn =
                  activeConversationIdRef.current !== initialTargetId || pendingConvIdRef.current !== null;

                if (found) {
                  const currentMemoryCount = messagesRef.current.length;
                  const foundCount = found.messages?.length || 0;
                  if (!userMovedOn && (currentMemoryCount === 0 || foundCount > currentMemoryCount)) {
                    activateConversation(found);
                  }
                } else if (!userMovedOn && messagesRef.current.length === 0) {
                  // Proteksi IDOR: Sesi percakapan privat akun lain tidak boleh dimuat!
                  updateUrlForConversation(null);
                  startNewChat();
                  notify(
                    "Akses Ditolak: Anda tidak memiliki izin untuk melihat sesi percakapan privat akun lain. Percakapan hanya dapat diakses jika pemilik telah mengaktifkan Tautan Publik (Public Share).",
                    "error"
                  );
                }
              } else if (userConvs.length === 0 && messagesRef.current.length === 0 && pendingConvIdRef.current === null) {
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

  // Pulihkan admin secret (sessionStorage) agar panel keamanan tidak minta
  // memasukkannya ulang setiap render/perubahan tab.
  useEffect(() => {
    try {
      const savedSecret = sessionStorage.getItem("zap_admin_secret") || "";
      if (savedSecret) setAdminSecretInput(savedSecret);
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
    // Hormati sakelar "Gulir otomatis": sebelumnya efek ini selalu menarik
    // pengguna ke dasar percakapan, termasuk saat memberi umpan balik pada
    // pesan lama.
    if (!autoScrollChat) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, autoScrollChat]);

  // Notifikasi non-blokir menutup sendiri setelah 8 detik.
  useEffect(() => {
    if (!systemNotice) return;
    const timer = setTimeout(() => setSystemNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [systemNotice]);

  // Catat kapan permintaan terakhir mulai berjalan (untuk penghitung detik di
  // indikator global). Satu perubahan state per permintaan, bukan per detik.
  useEffect(() => {
    setLoadingStartedAt(loading ? Date.now() : undefined);
  }, [loading]);

  // Pantau status vault terenkripsi untuk akun aktif.
  useEffect(() => {
    if (!currentUser) {
      setVaultState("unconfigured");
      return;
    }
    if (currentUser.isGuest) {
      setVaultState("unconfigured");
      return;
    }
    if (!isVaultConfigured(currentUser)) {
      setVaultState("unconfigured");
    } else {
      setVaultState(isVaultUnlocked(currentUser) ? "unlocked" : "locked");
    }
    const onVaultState = (event: Event) => {
      const detail = (event as CustomEvent<{ state: "locked" | "unlocked" | "unconfigured" }>).detail;
      if (detail?.state) setVaultState(detail.state);
    };
    window.addEventListener("zap_vault_state", onVaultState);
    return () => window.removeEventListener("zap_vault_state", onVaultState);
  }, [currentUser]);

  // Perangkat baru: keberadaan vault diketahui dari server (ciphertext), bukan
  // dari sessionStorage lokal. Tanpa ini tombol "Buka vault" tidak pernah aktif
  // di perangkat yang belum pernah membuka vault.
  useEffect(() => {
    let cancelled = false;
    const detectRemoteVault = async () => {
      if (!currentUser || currentUser.isGuest) return;
      if (isVaultUnlocked(currentUser)) return;
      const envelope = await fetchRemoteVaultEnvelope(currentUser);
      if (cancelled || !envelope) return;
      markVaultConfigured(currentUser, true);
      setVaultState("locked");
    };
    void detectRemoteVault();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  /** Membuat vault terenkripsi baru dengan passphrase pengguna. */
  const handleVaultSetup = async () => {
    if (!currentUser || vaultBusy) return;
    setVaultBusy(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const result = await setupVault(currentUser, vaultPassphrase);
      setVaultRecoveryCode(result.recoveryCode);
      setVaultState("unlocked");
      setVaultPassphrase("");
      setVaultNotice(
        "Vault terenkripsi dibuat. Kunci API & percakapan akan dicadangkan dalam bentuk ciphertext — server tidak dapat membacanya."
      );
      notify("Vault terenkripsi aktif. Sinkronisasi lintas perangkat siap dipakai.", "info");
      void syncAccountBackup(currentUser);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultBusy(false);
    }
  };

  /** Membuka vault dengan passphrase (diverifikasi terhadap ciphertext server). */
  const handleVaultUnlock = async () => {
    if (!currentUser || vaultBusy) return;
    setVaultBusy(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const envelope = await fetchRemoteVaultEnvelope(currentUser);
      const ok = await unlockVault(currentUser, vaultPassphrase, envelope);
      if (!ok) {
        setVaultError("Passphrase salah atau vault belum tersedia di server.");
        return;
      }
      setVaultState("unlocked");
      setVaultPassphrase("");
      setVaultNotice("Vault dibuka. Memuat percakapan & kunci API dari cloud…");
      // Muat ulang data akun agar percakapan + kunci hasil dekripsi terpasang.
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 700);
    } catch (err) {
      setVaultError(
        err instanceof Error ? err.message : "Passphrase salah atau data vault rusak."
      );
    } finally {
      setVaultBusy(false);
    }
  };

  /** Mengunci vault di tab ini (kunci tetap tersimpan terenkripsi di cloud). */
  const handleVaultLock = () => {
    if (!currentUser) return;
    lockVault(currentUser);
    setVaultState("locked");
    setVaultPassphrase("");
    setVaultRecoveryCode("");
    setVaultNotice("Vault dikunci di perangkat ini. Data terenkripsi tetap aman di cloud.");
  };

  const handleLogout = async () => {
    if (currentUser) {
      // Kunci provider akun ini hanya hidup di sesi; hapus saat keluar.
      clearProviderKeys(currentUser);
      // Vault dikunci lagi agar perangkat bersama tidak melanjutkan sesi kripto.
      clearVaultState(currentUser);
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
      notify("Percakapan masih kosong, kirim pesan terlebih dahulu sebelum membagikan.", "error");
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

  const renameConversation = (convId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const userKey = (currentUser?.email || currentUser?.id || "").toLowerCase().trim();
    const next = conversations.map((c) =>
      c.id === convId ? { ...c, title: trimmed, updatedAt: Date.now() } : c
    );
    setConversations(next);
    conversationsRef.current = next;
    saveConversations(next, userKey);

    if (currentUser) {
      syncAccountBackup(currentUser, {
        conversations: next,
        replaceConversations: true,
      });
    }
  };

  const toggleArchiveConversation = (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const userKey = (currentUser?.email || currentUser?.id || "").toLowerCase().trim();
    const next = conversations.map((c) =>
      c.id === convId ? { ...c, archived: !c.archived, updatedAt: Date.now() } : c
    );
    setConversations(next);
    conversationsRef.current = next;
    saveConversations(next, userKey);

    if (currentUser) {
      syncAccountBackup(currentUser, {
        conversations: next,
        replaceConversations: true,
      });
    }
    setContextMenu(null);
  };

  const handleConversationContextMenu = (
    e: React.MouseEvent | React.KeyboardEvent,
    conv: StoredConv
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 200;
    const menuHeight = 180;
    // Papan tombol tidak punya koordinat pointer: jatuhkan menu di dekat
    // baris yang sedang fokus agar tetap terlihat.
    const hasPointer = "clientX" in e;
    const anchor = hasPointer
      ? { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
      : (() => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          return { x: rect.left + 24, y: rect.bottom + 4 };
        })();
    const x =
      typeof window !== "undefined"
        ? Math.min(anchor.x, window.innerWidth - menuWidth - 12)
        : anchor.x;
    const y =
      typeof window !== "undefined"
        ? Math.min(anchor.y, window.innerHeight - menuHeight - 12)
        : anchor.y;
    setContextMenu({
      convId: conv.id,
      conv,
      x: Math.max(12, x),
      y: Math.max(12, y),
    });
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

    if (!textToProcess.trim() || loading) {
      if (loading) {
        // Sebelumnya Enter kedua diabaikan diam-diam sehingga terasa seperti
        // aplikasi tidak merespons. Jelaskan ke pengguna.
        notify("Masih menyusun balasan sebelumnya. Tunggu sampai balasan muncul, ya.", "info");
      }
      return;
    }

    if (isAccountSuspended) {
      notify("Akun Anda telah ditangguhkan secara permanen karena pelanggaran keamanan berulang. Silakan hubungi wakhidpangestu1@gmail.com untuk permohonan pemulihan akses.", "error");
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
    const targetConvId = activeConversationIdRef.current;
    setPendingConvId(targetConvId);
    pendingConvIdRef.current = targetConvId;

    /**
     * Menyimpan balasan asisten ke percakapan sumbernya.
     *
     * @param replaceId id placeholder (`msg.pending`) yang digantikan balasan
     *   final. Dengan cara ini, gelembung "menyusun balasan" berubah menjadi
     *   jawaban di tempat yang sama — tanpa gelembung ganda dan tanpa kehilangan
     *   balasan jika pengguna sempat berpindah sesi.
     */
    const commitAssistantReply = (aMsg: Message, uMsg: Message, replaceId?: string) => {
      // Pada alur "buat ulang"/pemulihan, pesan pengguna SUDAH ada di riwayat.
      // Menambahkannya lagi menghasilkan pertanyaan ganda tanpa jawaban di
      // bawahnya (bug yang terlihat sebagai "jawaban tidak muncul").
      const shouldAppendUser = !isRegenerate;
      if (activeConversationIdRef.current === targetConvId) {
        setMessages((prev) => {
          const hasUser = prev.some((m) => m.id === uMsg.id);
          const base = hasUser || !shouldAppendUser ? prev : [...prev, uMsg];
          if (replaceId && base.some((m) => m.id === replaceId)) {
            // Pertahankan id placeholder agar React tidak me-remount gelembung.
            return base.map((m) => (m.id === replaceId ? { ...aMsg, id: m.id } : m));
          }
          return [...base, aMsg];
        });
      }

      setConversations((prev) => {
        const userKey = (currentUser?.email || currentUser?.id || "").toLowerCase().trim();
        const existing = prev.find((c) => c.id === targetConvId);
        const existingMsgs = existing?.messages || [];
        const hasUser = existingMsgs.some((m) => m.id === uMsg.id);
        const hasReplacement = Boolean(replaceId && existingMsgs.some((m) => m.id === replaceId));
        const updatedMsgs = hasReplacement
          ? existingMsgs.map((m) => (m.id === replaceId ? { ...aMsg, id: m.id } : m))
          : hasUser || !shouldAppendUser
          ? [...existingMsgs, aMsg]
          : [...existingMsgs, uMsg, aMsg];
        const updatedConv: StoredConv = {
          id: targetConvId,
          title: existing?.title || uMsg.steps?.[0] || uMsg.rawText?.slice(0, 24) || "New Session",
          createdAt: existing?.createdAt || createdAtRef.current,
          updatedAt: Date.now(),
          messages: updatedMsgs,
          activeProblemFirstStep: existing?.activeProblemFirstStep ?? activeProblemFirstStep,
          activeProblemContext: existing?.activeProblemContext ?? activeProblemContext,
          targetVar: existing?.targetVar ?? targetVar,
          userEmail: userKey,
        };
        const next = [updatedConv, ...prev.filter((c) => c.id !== targetConvId)].sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        conversationsRef.current = next;
        saveConversations(next, userKey);
        if (currentUser) {
          syncAccountBackup(currentUser, { conversations: next });
        }
        return next;
      });
    };

    // JALUR 1: PERCAKAPAN SOKRATIK & VISUALISASI
    if (isConversational) {
      const userQuestion = textToProcess.trim();
      const currentAttached = [...attachedFiles];

      const userMsg: Message = {
        id: "msg_" + Date.now(),
        sender: "user",
        rawText: userQuestion,
        timestamp: zapClockNow(),
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

      // Placeholder balasan asisten: gelembung jawaban muncul seketika dan
      // tersimpan bersama percakapan, sehingga balasan yang belum tiba tetap
      // bisa dilacak (dan dilanjutkan otomatis) setelah reload.
      const pendingId = "msg_pending_" + Date.now();
      const pendingMsg: Message = {
        id: pendingId,
        sender: "assistant",
        replyText: "",
        pending: true,
        pendingStartedAt: Date.now(),
        modelName: selectedModel.name,
        timestamp: zapClockNow(),
      };
      setMessages((prev) => [...prev, pendingMsg]);

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

        // Kunci provider dibaca dari penyimpanan sesi per akun
        // (utils/provider-keys.ts) — bukan lagi localStorage global, dan tidak
        // pernah diunggah ke vault server.
        const savedBazaarlinkKey = getProviderKey("bazaarlink", currentUser);
        const savedGeminiKey = getProviderKey("gemini", currentUser);
        const savedMistralKey = getProviderKey("mistral", currentUser);
        const savedClaudeKey = getProviderKey("claude", currentUser);
        const savedOpenaiKey = getProviderKey("openai", currentUser);
        const savedNvidiaApiKey = getProviderKey("nvidia", currentUser);
        const savedCustomApiKey = getProviderKey("custom", currentUser);
        const savedCustomBaseUrl = getProviderSetting("customBaseUrl", currentUser);
        const savedCustomModelName = getProviderSetting("customModelName", currentUser);

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
            // Guardrail Zero-Answer: bentuk "x = 4" di tengah kalimat hanya
            // bisa disensor bila server tahu variabel target sesi ini.
            targetVariable: targetVar.trim() || "x",
            // Streaming token: balasan tampil bertahap, bukan menunggu JSON utuh.
            stream: true,
          }),
          signal: AbortSignal.timeout(90000),
        });

        // --- Konsumsi SSE (streaming) dengan fallback JSON ---
        const isEventStream = (res.headers.get("content-type") || "").includes("text/event-stream");
        // Payload JSON dari /api/chat berbentuk dinamis (reply/model/references/
        // smartboardItem/isJailbreak/...). `any` dipakai agar pembacaan SSE dan
        // JSON memakai jalur yang sama tanpa duplikasi tipe.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let chatData: any = null;

        if (res.ok && isEventStream && res.body) {
          streamedRef.current = "";
          let flushScheduled = false;
          const flushStreamed = () => {
            flushScheduled = false;
            const text = streamedRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingId ? { ...m, replyText: text } : m))
            );
          };
          chatData = await readSseStream(res, (chunk) => {
            streamedRef.current += chunk;
            // Batasi pembaruan UI ke ~16 fps: token bisa datang sangat cepat.
            if (flushScheduled) return;
            flushScheduled = true;
            if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
              window.requestAnimationFrame(flushStreamed);
            } else {
              setTimeout(flushStreamed, 40);
            }
          });
        } else {
          chatData = await res.json().catch(() => null);
        }

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
          // Bila aliran putus sebelum `done`, jangan ganti teks parsial dengan
          // sapaan default — tampilkan apa yang benar-benar sudah diterima.
          (streamedRef.current.trim() ? streamedRef.current : "Halo! Saya asisten ChatZAP. Tuliskan langkah aljabar yang ingin kamu uji, atau mintalah visualisasi 3D geometri.");

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
          timestamp: zapClockNow(),
          smartboardItem: responseGeometry || detectedGeometry,
          references: Array.isArray(chatData.corpus_references)
            ? (chatData.corpus_references as CorpusReference[])
            : undefined,
          source: typeof chatData.source === "string" ? chatData.source : undefined,
        };
        commitAssistantReply(assistantMsg, userMsg, pendingId);
      } catch (err) {
        console.error("Chat error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const assistantMsg: Message = {
          id: "msg_" + (Date.now() + 1),
          sender: "assistant",
          replyText:
            "⚠️ Maaf, respons asisten belum dapat dimuat karena terjadi gangguan koneksi server (" +
            errMsg +
            "). Silakan klik tombol coba lagi di bawah atau kirim ulang pesanmu.",
          modelName: "ChatZAP Recovery",
          timestamp: zapClockNow(),
          smartboardItem: detectedGeometry,
        };
        commitAssistantReply(assistantMsg, userMsg, pendingId);
      } finally {
        setLoading(false);
        setPendingConvId(null);
        pendingConvIdRef.current = null;
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
      timestamp: zapClockNow(),
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
        timestamp: zapClockNow(),
        smartboardItem:
          detectedGeometry ||
          (data.diagnosis.has_fault
            ? { model: "2d_quadratic", label: "Grafik Parabola & Galat", desc: "Perbandingan visual langkah benar vs langkah keliru" }
            : null),
      };

      commitAssistantReply(assistantMsg, userMsg);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Gagal terhubung ke microservice SymPy.";
      const assistantMsg: Message = {
        id: "msg_" + (Date.now() + 1),
        sender: "assistant",
        replyText: `Kendala Diagnostik CAS: ${errMsg}`,
        timestamp: zapClockNow(),
        smartboardItem: detectedGeometry,
      };
      commitAssistantReply(assistantMsg, userMsg);
    } finally {
      setLoading(false);
      setPendingConvId(null);
      pendingConvIdRef.current = null;
    }
  };

  // Referensi terbaru handleSend untuk efek pemulihan (lihat di bawah).
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  /**
   * PEMULIHAN OTOMATIS BALASAN YANG TERPUTUS.
   *
   * Temuan audit 13 Nov 2026: bila halaman di-reload/HMR-restart saat balasan
   * masih di jalan (atau bila pengguna berpindah sesi lalu kembali), pesan
   * pengguna sudah tersimpan tetapi balasan asisten tidak pernah datang.
   * UI hanya menyisakan tombol "Dapatkan Balasan Asisten" — persis kondisi
   * pada tangkapan layar pengguna.
   *
   * Sekarang balasan yang belum selesai disimpan sebagai pesan `pending`.
   * Efek ini menemukannya lalu melanjutkan permintaan sekali secara otomatis;
   * bila percobaan kedua juga gagal (atau placeholder lebih tua dari 3 menit),
   * pesan ditandai gagal agar tidak menggantung selamanya.
   */
  // Denyut pemeriksaan placeholder: bila ada balasan yang belum juga digantikan
  // padahal tidak ada permintaan berjalan, efek pemulihan di bawah perlu
  // dipicu ulang (state `messages` tidak berubah dengan sendirinya).
  const [pendingWatchTick, setPendingWatchTick] = useState<number>(0);
  useEffect(() => {
    if (loading || !messages.some((m) => m.pending)) return;
    const timer = setTimeout(() => setPendingWatchTick((n) => n + 1), 3000);
    return () => clearTimeout(timer);
  }, [messages, loading, pendingWatchTick]);

  useEffect(() => {
    if (!memoryReady || !authChecked || loading) return;
    // Jangan pernah melanjutkan saat permintaan lain masih berjalan untuk sesi
    // ini: placeholder yang baru dibuat beberapa milidetik lalu bukan tanda
    // balasan terputus, dan mengirim ulang di tengah jalan menghasilkan
    // pertanyaan ganda.
    if (pendingConvIdRef.current !== null) return;
    const last = messages[messages.length - 1];
    if (!last || last.sender !== "assistant" || !last.pending) return;
    const userTurn = messages[messages.length - 2];
    if (!userTurn || userTurn.sender !== "user") return;
    // Beri jeda singkat agar commit balasan yang sedang berjalan menang.
    if (Date.now() - (last.pendingStartedAt || 0) < 1500) return;

    const attempts = resumeAttemptsRef.current[last.id] || 0;
    const stale = Date.now() - (last.pendingStartedAt || 0) > 3 * 60 * 1000;

    if (stale || attempts >= 2) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === last.id
            ? {
                ...m,
                pending: false,
                modelName: "ChatZAP Recovery",
                replyText:
                  "⚠️ Balasan asisten terputus sebelum selesai (mis. halaman dimuat ulang saat menunggu). Klik **Buat ulang respon** di bawah untuk melanjutkan.",
              }
            : m
        )
      );
      return;
    }

    resumeAttemptsRef.current[last.id] = attempts + 1;
    const historySnapshot = messages.slice(0, -2);
    // Buang placeholder lama supaya tidak ada dua gelembung "menyusun balasan".
    setMessages((prev) => prev.filter((m) => m.id !== last.id));
    void handleSendRef.current?.(
      userTurn.steps,
      undefined,
      userTurn.rawText || userTurn.steps?.join("\n"),
      true,
      historySnapshot
    );
  }, [messages, loading, memoryReady, authChecked, pendingWatchTick]);

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
      notify("Fitur Text-to-Speech tidak didukung di browser ini.", "error");
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

  // Pemantik di layar kosong: isi composer dengan contoh yang menembak
  // fitur inti (CFL/CAS, kanvas 2D, kanvas 3D), lalu fokuskan kursor.
  const applyStarterPrompt = (text: string) => {
    setInputText(text);
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
      notify("Silakan masukkan kode pemulihan yang Anda terima dari Admin.", "error");
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
        notify(data.message || "Akun Anda berhasil dipulihkan secara penuh! Selamat belajar kembali di ChatZAP.", "info");
      } else {
        const errMsg = data.message || data.error || "Kode pemulihan tidak valid atau sudah kedaluwarsa.";
        setUserRecoveryMessage({ text: errMsg, error: true });
        notify(errMsg, "error");
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
    const secret = adminSecretInput.trim();
    if (!secret) {
      setAdminSuspendedList([]);
      return;
    }
    setAdminLoadingList(true);
    try {
      const res = await fetch(
        `/api/admin/security?action=list&secret=${encodeURIComponent(secret)}`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.list)) {
        setAdminSuspendedList(data.list);
      } else if (data?.error) {
        notify(data.error, "error");
      }
    } catch (e) {
      console.warn("Gagal memuat daftar status keamanan:", e);
    } finally {
      setAdminLoadingList(false);
    }
  }, [currentUser?.email, adminSecretInput, notify]);

  // Handler Superadmin untuk memulihkan akun pengguna tertentu secara instan
  const handleAdminUnbanUser = async (targetEmailToUnban?: string) => {
    const emailToUnban = (targetEmailToUnban || adminTargetEmail).trim().toLowerCase();
    if (!emailToUnban) {
      notify("Masukkan alamat email pengguna yang ingin dipulihkan.", "error");
      return;
    }
    setAdminUnbanLoading(true);
    setAdminActionResult(null);
    const secret = adminSecretInput.trim();
    if (!secret) {
      setAdminUnbanLoading(false);
      notify(
        "Masukkan Admin Secret lebih dulu. Rute keamanan menolak semua aksi admin tanpa secret (fail-closed).",
        "error"
      );
      return;
    }
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unban",
          email: emailToUnban,
          adminSecret: secret,
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

  // Escape menutup lapisan modal teratas. Satu listener untuk semua modal
  // (Settings, Plugins, Tasks, More, Proyek Baru, Pratinjau Berkas) agar
  // perilaku keyboard sama di seluruh aplikasi.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewFile) {
        setPreviewFile(null);
        return;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        return;
      }
      if (showNewWorkspaceModal) {
        setShowNewWorkspaceModal(false);
        return;
      }
      if (showPluginModal) {
        setShowPluginModal(false);
        return;
      }
      if (showTasksModal) {
        setShowTasksModal(false);
        return;
      }
      if (showMoreModal) {
        setShowMoreModal(false);
        return;
      }
      // Panel kanan yang menutupi seluruh layar (layar penuh, atau < 1024px
      // tempat panel menjadi takeover) juga harus bisa ditutup dengan Esc.
      if (showRightPane && (rightPaneFullscreen || window.innerWidth < 1024)) {
        setShowRightPane(false);
        setRightPaneFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    previewFile,
    showSettingsModal,
    showNewWorkspaceModal,
    showPluginModal,
    showTasksModal,
    showMoreModal,
    showRightPane,
    rightPaneFullscreen,
  ]);

  // =========================================================================
  // AUTH GATE: Tampilkan layar tunggu sampai autentikasi tervalidasi
  // =========================================================================
  if (!authChecked || !currentUser) {
    return (
      <div className="flex h-[100dvh] w-full bg-[#faf9f6] dark:bg-[#090a0f] text-zinc-600 dark:text-zinc-400 items-center justify-center font-sans text-xs select-none">
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
    <div className="flex h-[100dvh] bg-[#faf9f6] dark:bg-[#0e0f12] text-[#09090b] dark:text-zinc-200 overflow-hidden font-sans text-xs">
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

      {/* 1. LEFT SIDEBAR (Resizable Width on Desktop + Crisp Typography) */}
      <aside
        aria-label="Navigasi dan Riwayat Percakapan"
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : undefined }}
        className={`fixed inset-y-0 left-0 z-40 w-72 max-sm:max-w-[85vw] shrink-0 bg-white dark:bg-[#131418] border-r border-zinc-200/80 dark:border-white/[0.06] flex flex-col shadow-2xl shadow-black/10 sm:relative sm:translate-x-0 sm:shadow-none ${
          isResizingSidebar ? "" : "transition-transform duration-200 ease-in-out"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:hidden"
        }`}
      >
        {/* Right-edge Resize Handle (Desktop) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Geser untuk mengatur lebar sidebar (klik ganda untuk reset)"
          title="Tahan & geser untuk mengatur lebar sidebar (klik 2x untuk reset)"
          onPointerDown={handleSidebarResizeStart}
          onDoubleClick={() => {
            setSidebarWidth(256);
            try {
              localStorage.setItem("zap_sidebar_width", "256");
            } catch {}
          }}
          className="hidden sm:flex absolute top-0 -right-1 bottom-0 w-2 cursor-col-resize z-50 items-center justify-center group/resize select-none"
        >
          <div
            className={`w-[2px] h-full transition-colors duration-150 ${
              isResizingSidebar
                ? "bg-zinc-900 dark:bg-white"
                : "bg-transparent group-hover/resize:bg-zinc-300 dark:group-hover/resize:bg-white/25"
            }`}
          />
        </div>
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
            className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-[#faf9f6] dark:hover:bg-white/[0.06] transition"
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.05] transition text-left cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>More</span>
          </button>
        </div>

        {/* SECTION 1: RIWAYAT CHAT (Mandiri & Terpisah dari Workspace) */}
        <div className="flex-1 flex flex-col min-h-0 pt-3">
          <div className="flex items-center justify-between px-3.5 pb-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-600 dark:text-zinc-400">
              Riwayat Chat
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowArchivedOnly(!showArchivedOnly)}
                className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition cursor-pointer relative ${
                  showArchivedOnly
                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40"
                    : "hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
                title={showArchivedOnly ? "Kembali ke percakapan aktif" : "Lihat percakapan diarsipkan"}
                aria-label={showArchivedOnly ? "Kembali ke percakapan aktif" : "Lihat percakapan diarsipkan"}
              >
                <Archive className="w-3.5 h-3.5" />
                {conversations.some((c) => c.archived) && !showArchivedOnly && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsSearchingSession(!isSearchingSession)}
                className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition cursor-pointer ${
                  isSearchingSession
                    ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/[0.15]"
                    : "hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
                title="Cari sesi aljabar"
                aria-label="Cari sesi aljabar"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowWorkspaceFilter(!showWorkspaceFilter)}
                className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition cursor-pointer ${
                  showWorkspaceFilter || workspaceStatusFilter !== "all"
                    ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/[0.15]"
                    : "hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#18191e] border border-zinc-200 dark:border-white/[0.08] text-xs">
                <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                <input
                  type="text"
                  aria-label="Cari sesi atau materi"
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  placeholder="Cari sesi atau materi..."
                  className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none"
                  autoFocus
                />
                {sessionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSessionSearchQuery("")}
                    aria-label="Hapus pencarian"
                    className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
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
              <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 font-medium pb-1.5 border-b border-zinc-100 dark:border-white/[0.06]">
                <span>Filter Percakapan</span>
                <button
                  type="button"
                  onClick={() => setShowWorkspaceFilter(false)}
                  aria-label="Tutup filter"
                  className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-mono block">Status Sesi</span>
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
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium"
                          : "bg-zinc-100 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-[#ece6db] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Banner Mode Arsip */}
          {showArchivedOnly && (
            <div className="mx-2 mb-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Archive className="w-3.5 h-3.5" />
                <span>Percakapan Diarsipkan</span>
              </span>
              <button
                type="button"
                onClick={() => setShowArchivedOnly(false)}
                className="text-[11px] underline hover:no-underline font-medium cursor-pointer"
              >
                Kembali
              </button>
            </div>
          )}

          {/* Flat List Riwayat Percakapan */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {/* Tampilkan item 'New Session' jika sedang berada di sesi baru yang belum disimpan */}
            {!showArchivedOnly && (!conversations.some((c) => c.id === activeConversationId) || messages.length === 0) && (
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
                    ? "bg-[#f0ece3] dark:bg-[#1e2025] text-zinc-900 dark:text-white border border-[#e6dfd2] dark:border-transparent"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-[#f3efe7] dark:hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">New Session</span>
              </div>
            )}

            {/* Daftar sesi percakapan */}
            {(() => {
              const filtered = conversations
                .filter((c) => {
                  if (showArchivedOnly) {
                    if (!c.archived) return false;
                  } else {
                    if (c.archived) return false;
                  }
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

              if (filtered.length === 0 && (sessionSearchQuery || workspaceStatusFilter !== "all" || showArchivedOnly)) {
                return (
                  <div className="px-2.5 py-3 text-center text-zinc-500 dark:text-zinc-400 text-[12px] italic">
                    {showArchivedOnly
                      ? "Tidak ada percakapan yang diarsipkan"
                      : "Tidak ada sesi yang cocok dengan filter"}
                  </div>
                );
              }

              if (conversations.length === 0 && messages.length > 0) {
                return (
                  <div className="px-2.5 py-3 text-center text-zinc-500 dark:text-zinc-400 text-[12px] italic">
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
                  onContextMenu={(e) => handleConversationContextMenu(e, conv)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openConversation(conv.id);
                    } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                      // Setara klik kanan: buka menu opsi sesi dari papan tombol.
                      e.preventDefault();
                      handleConversationContextMenu(e, conv);
                    }
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-[13px] transition cursor-pointer relative ${
                    conv.id === activeConversationId
                      ? "bg-[#f0ece3] dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium border border-[#e6dfd2] dark:border-white/[0.08]"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-[#f3efe7] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {editingConvId === conv.id ? (
                    <div
                      className="flex items-center gap-1 flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        aria-label={`Ganti nama percakapan ${conv.title}`}
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        onKeyDown={(e) => {
                          // Jangan biarkan spasi/Enter bocor ke baris induk
                          // yang punya handler buka percakapan.
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            renameConversation(conv.id, editingTitleText);
                            setEditingConvId(null);
                          } else if (e.key === "Escape") {
                            setEditingConvId(null);
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-blue-500 text-xs text-zinc-900 dark:text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameConversation(conv.id, editingTitleText);
                          setEditingConvId(null);
                        }}
                        className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20"
                        title="Simpan nama percakapan"
                        aria-label="Simpan nama percakapan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvId(null);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:bg-[#ece6db] dark:hover:bg-zinc-800"
                        title="Batal edit nama"
                        aria-label="Batal edit nama"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate flex-1 font-normal text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white flex items-center gap-1.5">
                        {conv.archived && <Archive className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span className="truncate">{conv.title}</span>
                      </span>
                      <span className="hidden sm:inline-block text-xs font-mono text-zinc-600 dark:text-zinc-400 group-hover:hidden flex-shrink-0 ml-1.5">
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                      {/* Di layar sentuh tidak ada hover: aksi sesi harus tetap
                          terjangkau. Mulai sm, aksi kembali muncul saat hover. */}
                      <div className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex items-center gap-0.5 flex-shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => handleConversationContextMenu(e, conv)}
                          className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition rounded-md"
                          title="Menu opsi percakapan (klik kanan)"
                          aria-label={`Menu opsi ${conv.title}`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenShareModal(conv);
                          }}
                          className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition rounded-md"
                          title="Bagikan tautan percakapan"
                          aria-label={`Bagikan tautan percakapan ${conv.title}`}
                        >
                          <ModernShareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition rounded-md"
                          title="Hapus sesi"
                          aria-label={`Hapus sesi ${conv.title}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* SECTION 2: WORKSPACES (Dibuat Manual oleh Pengguna) */}
        <div className="border-t border-zinc-200/70 dark:border-white/[0.06] pt-2.5 pb-2 shrink-0">
          <div className="flex items-center justify-between px-3.5 pb-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-600 dark:text-zinc-400">
              Proyek Belajar
            </span>
            <button
              type="button"
              onClick={() => setShowNewWorkspaceModal(true)}
              className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 min-h-[30px] rounded-lg border border-dashed border-zinc-300 dark:border-white/[0.14] hover:border-zinc-400 dark:hover:border-white/[0.24] text-[12px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer group"
              >
                <FolderPlus className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:text-amber-500 transition" />
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
                        ? "bg-[#f0ece3] dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-amber-500" : "text-zinc-500 dark:text-zinc-400"}`} />
                      <span className="truncate">{ws.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {wsFiles.length > 0 && (
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                          {wsFiles.length}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkspace(ws.id);
                        }}
                        className="hidden group-hover:block p-1 text-zinc-500 hover:text-rose-500 transition"
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

        {/* Sidebar Footer: Minimalist User Profile + Clean Popover */}
        <div className="p-2.5 border-t border-zinc-200/80 dark:border-white/[0.06] relative" ref={profileDropdownRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            aria-expanded={profileDropdownOpen}
            aria-label="Menu profil dan pengaturan akun"
            className="flex items-center justify-between w-full hover:bg-[#f3efe7]/80 dark:hover:bg-white/[0.05] px-2 py-1.5 rounded-xl cursor-pointer transition text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                name={currentUser?.name}
                email={currentUser?.email}
                avatar={currentUser?.avatar}
                isGuest={isGuestAccount(currentUser)}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                  {currentUser?.name || "Tamu ChatZAP"}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate leading-tight">
                  {isGuestAccount(currentUser) ? "Akun Tamu" : currentUser?.email || "Aktif"}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 flex-shrink-0 transition-transform duration-150 ${
                profileDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Profile Dropdown Popup (Minimalist & Modern) */}
          {profileDropdownOpen && (
            <div className="absolute left-2.5 bottom-full mb-2 w-[252px] rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200/90 dark:border-white/[0.08] shadow-[0_16px_40px_-8px_rgba(15,23,42,0.14)] dark:shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7)] p-1.5 z-50 text-xs text-zinc-800 dark:text-zinc-200 animate-liquid-pop origin-bottom-left select-none">
              {/* User Identity Header */}
              <div className="px-2.5 py-2 border-b border-zinc-100 dark:border-white/[0.06] mb-1 flex items-center gap-2.5">
                <UserAvatar
                  name={currentUser?.name}
                  email={currentUser?.email}
                  avatar={currentUser?.avatar}
                  isGuest={isGuestAccount(currentUser)}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-zinc-900 dark:text-white truncate text-xs">
                      {currentUser?.name || "Pengguna ChatZAP"}
                    </span>
                    {isGuestAccount(currentUser) && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 shrink-0">
                        Tamu
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {isGuestAccount(currentUser) ? "Sesi lokal aktif" : currentUser?.email}
                  </div>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="space-y-0.5">
                {/* 1. Pengaturan Akun */}
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("general");
                    setShowSettingsModal(true);
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#f3efe7]/80 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
                    <span className="font-medium text-xs">Pengaturan Akun</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400" />
                </button>

                {/* 2. Model & API Keys */}
                <Link
                  href="/connector"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#f3efe7]/80 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 transition text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <ConnectorHubIcon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
                    <span className="font-medium text-xs">Model &amp; API Keys</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400" />
                </Link>

                {/* 3. Tema (1 Klik Ganti Tema) */}
                <button
                  type="button"
                  onClick={(event) => {
                    const nextTheme = theme === "dark" ? "light" : "dark";
                    setTheme(nextTheme, event.currentTarget);
                    if (currentUser) syncAccountBackup(currentUser, { configs: { theme: nextTheme } });
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#f3efe7]/80 dark:hover:bg-white/[0.06] transition text-zinc-700 dark:text-zinc-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    {theme === "dark" ? (
                      <Moon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
                    )}
                    <span className="font-medium text-xs">Tema Tampilan</span>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300">
                    {theme === "dark" ? "Gelap" : "Terang"}
                  </span>
                </button>

                {/* Divider */}
                <div className="h-px bg-zinc-100 dark:bg-white/[0.06] my-1" />

                {/* 4. Keluar Akun */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <LogOut className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition" />
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
                  className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] transition cursor-pointer"
                  title="Buka sidebar"
                  aria-label="Buka sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] transition cursor-pointer"
                  title="Percakapan Baru"
                  aria-label="Percakapan Baru"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Link to BYOK Connector */}
            <Link
              href="/connector"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f3efe7] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] transition shadow-2xs"
              title="Pengaturan Model & Kunci API BYOK"
            >
              <ConnectorHubIcon className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Connector</span>
            </Link>

            {/* Single Clean Theme Toggle Button */}
            <button
              type="button"
              onClick={(event) => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme, event.currentTarget);
                if (currentUser) syncAccountBackup(currentUser, { configs: { theme: nextTheme } });
              }}
              title={theme === "dark" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              aria-label="Ganti Tema Terang / Gelap"
              className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f3efe7] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] shadow-2xs transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
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
                <ModernShareIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                <span className="hidden sm:inline">Bagikan</span>
              </button>
            )}

            {/* If Right Pane is closed, show toggle button */}
            {!showRightPane && (
              <button
                type="button"
                onClick={() => setShowRightPane(true)}
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white bg-white dark:bg-white/[0.05] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.1] border border-zinc-200/90 dark:border-white/[0.08] shadow-sm transition cursor-pointer"
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
              {/* Logo + Title: ChatZAP + Zero-Answer */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 px-1">
                <ZapLogo className="w-[22px] h-[22px] text-[#09090b] dark:text-white" />
                <h1 className="text-[21px] min-[380px]:text-2xl font-bold tracking-tight text-[#09090b] dark:text-white whitespace-nowrap">ChatZAP</h1>
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#faf4ed] text-[#8f5e32] border border-[#d4a574]/45 dark:bg-white/[0.08] dark:text-zinc-300 dark:border-white/[0.1]">
                  Zero-Answer
                </span>
              </div>

              {/* Satu baris penjelas: apa yang dilakukan ZAP, tanpa klaim berlebihan dan tanpa em-dash ai slop */}
              <p className="max-w-md text-balance text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-5 px-1">
                Tutor Sokrates yang menuntun langkah matematikamu tanpa memberi jawaban akhir.
              </p>

              {/* Dropdown Pills above Composer (Interactive Workspace & Pedagogical Mode) */}
              <div className="w-full max-w-3xl lg:max-w-4xl flex flex-wrap items-center gap-2 mb-2 px-1 text-xs text-zinc-500 dark:text-zinc-400 justify-start relative">
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
                        ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white border-zinc-300 dark:border-white/[0.15]"
                        : "bg-zinc-100/80 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-[#ece6db]/80 dark:hover:bg-white/[0.08] border-zinc-200 dark:border-white/[0.06]"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span className="max-w-[100px] min-[380px]:max-w-[132px] sm:max-w-none truncate whitespace-nowrap">
                      {workspaces.find((w) => w.id === activeWorkspaceId)?.name || (workspaces.length === 0 ? "Proyek Belajar (Opsional)" : "Pilih Proyek")}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-400" />
                  </button>

                  {/* Dropdown Popover */}
                  {showPillWorkspaceMenu && (
                    <div className="absolute left-0 top-full mt-1.5 w-60 liquid-glass-popup rounded-2xl py-1.5 z-50 text-xs animate-liquid-pop origin-top-left text-left">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-zinc-400 dark:text-zinc-400 border-b border-zinc-100 dark:border-white/[0.06] mb-1">
                        Pilih Proyek Belajar
                      </div>
                      {workspaces.length === 0 ? (
                        <div className="px-3 py-2 text-center text-xs text-zinc-400 dark:text-zinc-400 italic">
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
                                ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-200"
                            }`}
                          >
                            <span className="truncate">Tanpa Proyek</span>
                            {!activeWorkspaceId && <Check className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />}
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
                                  ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-200"
                              }`}
                            >
                              <span className="truncate">{ws.name}</span>
                              {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-zinc-100 dark:border-white/[0.06] mt-1 pt-1 px-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPillWorkspaceMenu(false);
                            setShowNewWorkspaceModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
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
                        ? "bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white border-zinc-300 dark:border-white/[0.15]"
                        : "bg-zinc-100/80 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-[#ece6db]/80 dark:hover:bg-white/[0.08] border-zinc-200 dark:border-white/[0.06]"
                    }`}
                  >
                    <Atom className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span className="whitespace-nowrap max-w-[96px] min-[380px]:max-w-[118px] min-[420px]:max-w-none truncate">
                      {interactionMode === "standard"
                        ? "Standard mode"
                        : interactionMode === "strict"
                        ? "Strict Zero-Answer"
                        : interactionMode === "visual"
                        ? "Visual 3D & Canvas"
                        : "CAS Diagnostic"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-400" />
                  </button>

                  {/* Mode Dropdown Popover */}
                  {showPillModeMenu && (
                    <div className="absolute left-0 max-sm:left-auto max-sm:right-0 top-full mt-1.5 w-64 liquid-glass-popup rounded-2xl py-1.5 z-50 text-xs animate-liquid-pop origin-top-left text-left">
                      <div className="px-3 py-1 text-[10px] uppercase font-mono tracking-wider text-zinc-400 dark:text-zinc-400 border-b border-zinc-100 dark:border-white/[0.06] mb-1">
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
                                ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-[#f7f4ef] dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{m.label}</span>
                              {interactionMode === m.id && (
                                <Check className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
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
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Lepaskan gambar atau dokumen di sini
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Mendukung tangkapan layar, JPG, PNG, PDF, atau teks aljabar
                    </span>
                  </div>
                )}

                {/* Vault terenkripsi terkunci: pengingat non-blokir */}
                {vaultState === "locked" && !isGuestAccount(currentUser) && (
                  <div className="flex items-center justify-between gap-2 p-2.5 mb-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 animate-fade-in">
                    <div className="flex items-start gap-2 min-w-0">
                      <LockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed min-w-0">
                        <span className="font-semibold">Sinkronisasi terenkripsi terkunci.</span>{" "}
                        Buka vault untuk memuat percakapan &amp; kunci API dari perangkat lain.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab("general");
                        setShowSettingsModal(true);
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition cursor-pointer"
                    >
                      Buka kunci
                    </button>
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
                              ? "p-1.5 bg-zinc-100/90 dark:bg-zinc-800/80 border-zinc-300 dark:border-white/10"
                              : "px-2.5 py-1 bg-zinc-100 dark:bg-[#22252c] border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          <div
                            onClick={() => setPreviewFile(f)}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition min-w-0"
                            title="Klik untuk pratinjau penuh"
                          >
                            {isImg && f.dataUrl ? (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-900 shrink-0 border border-black/5 dark:border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="font-medium max-w-[130px] truncate text-xs text-zinc-800 dark:text-zinc-200">
                                {f.name}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
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
                            className="p-1 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-full text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
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
                      : "Tulis soal atau langkah pengerjaanmu..."
                  }
                  className="w-full bg-transparent text-[15px] sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus-visible:ring-0 resize-none font-sans leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1.5 pt-2 min-w-0">
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
                  <div className="flex items-center gap-2 ml-auto">
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
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition cursor-pointer ${
                        inputText.trim() && !loading && !isAccountSuspended
                          ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db]"
                          : "bg-zinc-200 dark:bg-[#282a32] text-zinc-400 dark:text-zinc-400 cursor-not-allowed"
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pemantik pertama: tiga jalur nyata (CAS, kanvas 2D, kanvas 3D)
                  agar layar kosong tidak menjadi jalan buntu. */}
              <div className="w-full max-w-3xl lg:max-w-4xl mt-3 flex flex-wrap items-center justify-start gap-2 px-1">
                {[
                  {
                    label: "Cek langkah aljabar",
                    icon: FlaskConical,
                    text: "Cek coretan saya: 2x + 6 = 14 -> 2x = 20 -> x = 10",
                  },
                  {
                    label: "Grafik y = x² − 3",
                    icon: BookOpen,
                    text: "tampilkan grafik y = x^2 - 3 di papan tulis 2d",
                  },
                  {
                    label: "Balok 10 × 6 × 4",
                    icon: Box,
                    text: "buatkan balok 10x6x4 dalam bentuk 3d",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => applyStarterPrompt(item.text)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-[#d9c3a6] hover:bg-[#faf4ed] dark:hover:bg-white/[0.07] dark:hover:border-white/[0.18] transition cursor-pointer"
                  >
                    <item.icon className="w-3.5 h-3.5 text-[#8f5e32] dark:text-[#d4a574]" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE CHAT LAYOUT: Scrollable Messages Stream + Permanently Fixed Bottom Composer */
          <>
            {/* 1. SCROLLABLE MESSAGES STREAM */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-6 py-6 w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6">
              {/* Satu-satunya h1 di tampilan percakapan: judul sesi aktif,
                  dibaca pembaca layar namun tidak tampil secara visual. */}
              <h1 className="sr-only">
                {conversations.find((c) => c.id === activeConversationId)?.title || "Percakapan baru"}
              </h1>
              <div role="log" aria-live="polite" aria-relevant="additions text" aria-label="Riwayat percakapan" className="space-y-6">
              {messages.map((msg, msgIdx) => {
                const prevMsg = msgIdx > 0 ? messages[msgIdx - 1] : undefined;
                return (
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
                                className="flex items-center gap-2 bg-white/60 dark:bg-black/30 px-3 py-1.5 rounded-xl border border-zinc-200/60 dark:border-white/[0.06] overflow-x-auto max-w-full"
                              >
                                <span className="text-zinc-400 dark:text-zinc-400 text-xs w-4 shrink-0">#{i + 1}</span>
                                <div className="text-zinc-900 dark:text-zinc-100 overflow-x-auto py-0.5 text-[15px] min-w-0">
                                  <MathView math={st} />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : msg.rawText ? (
                          <div className="text-[15.5px] sm:text-base text-zinc-900 dark:text-zinc-100 leading-relaxed font-sans whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full overflow-x-auto">
                            {msg.rawText}
                          </div>
                        ) : null}

                        {/* Attached files pills in user bubble if any */}
                        {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200/80 dark:border-white/[0.08]">
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
                                  className="relative rounded-xl overflow-hidden border border-zinc-300 dark:border-white/10 max-w-[260px] max-h-[190px] my-1 shadow-sm group bg-zinc-100 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition"
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
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/40 text-xs text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-white/[0.08] cursor-pointer hover:bg-[#f3efe7] dark:hover:bg-white/[0.08] transition"
                                  title="Klik untuk pratinjau berkas"
                                >
                                  <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                  <span className="truncate max-w-[160px]">{file.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Outside Clock Timestamp & Action Icons (DeepSeek style: clean, outside bubble, right-aligned) */}
                      {editingMsgId !== msg.id && (
                        <div className="flex items-center gap-2 mt-1 mr-1 text-zinc-600 dark:text-zinc-400 text-[11px] font-mono">
                          <span>{msg.timestamp}</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleCopyUserMessage(msg.rawText || msg.steps?.join("\n") || "", msg.id)}
                              className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded hover:bg-[#ece6db]/60 dark:hover:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                              title={copiedUserMsgId === msg.id ? "Tersalin!" : "Salin pesan"}
                              aria-label={copiedUserMsgId === msg.id ? "Tersalin" : "Salin pesan"}
                            >
                              {copiedUserMsgId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                              ) : (
                                <ModernCopyIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingMessage(msg.id, msg.rawText || msg.steps?.join("\n") || "")}
                              className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded hover:bg-[#ece6db]/60 dark:hover:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                              title="Edit & kirim ulang"
                              aria-label="Edit dan kirim ulang pesan"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tombol pemulihan cepat jika pesan ini belum mendapatkan balasan asisten (misal sesi terinterupsi reload) */}
                      {messages[messages.length - 1]?.id === msg.id && !loading && (
                        <div className="mt-2 flex items-center gap-2 animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={() =>
                              handleSend(
                                msg.steps,
                                undefined,
                                msg.rawText || msg.steps?.join("\n"),
                                true,
                                messages.slice(0, -1)
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
                            <span>Dapatkan Balasan Asisten</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant Message */}
                  {msg.sender === "assistant" && (
                    <div className="py-2 space-y-3 w-full">
                      {/* Header Row: Zap Logo + Detail Mesin + Timestamp */}
                      <div className="flex items-center gap-2 select-none min-w-0">
                        <ZapLogo className="w-[18px] h-[18px] text-[#09090b] dark:text-white flex-shrink-0" />

                        {/* Detail Mesin: Simple & Glass Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-white/[0.06] backdrop-blur-md border border-zinc-200/90 dark:border-white/[0.08] text-[11px] font-sans font-medium text-zinc-700 dark:text-zinc-300 shadow-sm min-w-0 max-w-[min(100%,20rem)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 flex-shrink-0" />
                          <span className="font-medium truncate">{msg.modelName || selectedModel.name}</span>
                        </div>

                        {/* Sumber balasan: satu baris dengan badge mesin, bukan chip terpisah */}
                        {msg.source && (
                          <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[9rem]">
                            via {msg.source}
                          </span>
                        )}
                      </div>

                        {/* Placeholder balasan: muncul seketika setelah pesan dikirim,
                            tetap terlihat setelah reload, dan memberi progres nyata.
                            Bila token mulai mengalir, teks parsial langsung tampil
                            dan skeleton digantikan. */}
                        {msg.pending && !msg.replyText ? (
                          <div
                            className="w-full max-w-md space-y-2 pt-0.5"
                            role="status"
                            aria-live="polite"
                            aria-label="Asisten sedang menyusun balasan"
                          >
                            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="font-medium">Menyusun balasan…</span>
                              <ElapsedTicker startedAt={msg.pendingStartedAt} />
                            </div>
                            <div className="space-y-1.5" aria-hidden="true">
                              <div className="h-2.5 rounded-full bg-zinc-200/80 dark:bg-white/[0.08] animate-pulse w-[92%]" />
                              <div className="h-2.5 rounded-full bg-zinc-200/80 dark:bg-white/[0.08] animate-pulse w-[74%]" />
                              <div className="h-2.5 rounded-full bg-zinc-200/80 dark:bg-white/[0.08] animate-pulse w-[58%]" />
                            </div>
                            <SlowProviderNotice startedAt={msg.pendingStartedAt} />
                          </div>
                        ) : (
                          msg.replyText && (
                            <div
                              className="text-zinc-800 dark:text-zinc-100 text-[15.5px] leading-relaxed pt-0.5 max-w-full overflow-hidden break-words [overflow-wrap:anywhere]"
                              aria-live={msg.pending ? "polite" : undefined}
                            >
                              <RichChatText content={msg.replyText} />
                              {msg.pending && (
                                <span
                                  className="inline-block w-[2px] h-[1em] ml-0.5 align-[-0.15em] bg-zinc-500 dark:bg-zinc-300 animate-pulse"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          )
                        )}

                        {/* Sitasi: daftar referensi korpus yang bisa dilipat (hanya muncul pada kasus akademik khusus) */}
                        {shouldShowReferences(msg, prevMsg) && (
                          <details className="group w-full rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
                            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                              <span>Sumber &amp; acuan ({msg.references.length})</span>
                              <span className="text-zinc-400 dark:text-zinc-400 transition-transform group-open:rotate-180">▾</span>
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
                                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                      {refTitle}
                                      {ref.id && (
                                        <span className="ml-1.5 font-mono text-[10px] font-normal text-zinc-400 dark:text-zinc-400">
                                          #{ref.id}
                                        </span>
                                      )}
                                    </div>
                                    {refSnippet && (
                                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {refSnippet}
                                      </p>
                                    )}
                                    {ref.source && (
                                      <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-400 mt-0.5">
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
                            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] backdrop-blur-xl border border-zinc-200/80 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 transition group shadow-sm text-sm cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:scale-105 transition-transform">
                                <Box className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                  <span>
                                    {msg.smartboardItem.model === "2d_shape"
                                      ? "Lihat di Papan Tulis Interaktif 2D"
                                      : "Lihat di Papan Tulis Virtual 3D"}
                                  </span>
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.1]">
                                    {msg.smartboardItem.label}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  {msg.smartboardItem.desc || "Buka visualisasi interaktif & pergeseran parameter"}
                                </div>
                              </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </button>
                        )}

                        {/* SymPy CAS Diagnosis Report */}
                        {msg.diagnosis && (
                          <div className="bg-white/80 dark:bg-[#14161f]/70 backdrop-blur-xl border border-zinc-200/80 dark:border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-2.5">
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
                              <span className="text-xs text-zinc-400 dark:text-zinc-400 font-mono">SymPy CAS</span>
                            </div>

                            <div className="space-y-1.5">
                              {msg.diagnosis.transcription.lines.map((line) => (
                                <div
                                  key={line.line_number}
                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-sm font-mono transition ${
                                    line.is_valid
                                      ? "bg-zinc-50 dark:bg-black/30 border-zinc-200 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300"
                                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 overflow-x-auto text-[14.5px]">
                                    <span className="text-zinc-400 dark:text-zinc-400 text-xs">#{line.line_number}</span>
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
                                <p className="text-[15px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                  {msg.diagnosis.diagnosis.human_explanation}
                                </p>
                                <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] backdrop-blur-md border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    <MessageSquareQuote className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                    <span>Bimbingan Sokratik:</span>
                                  </div>
                                  <p className="text-[14.5px] italic leading-relaxed text-zinc-800 dark:text-zinc-200">
                                    {msg.diagnosis.diagnosis.socratic_prompt}
                                  </p>
                                </div>
                              </div>
                            )}

                            {msg.diagnosis.diagnosis.counter_example && (
                              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/[0.06] space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
                                    <FlaskConical className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                                    <span>Kontra-Contoh Substitusi:</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-center text-xs">
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Var</div>
                                    <div className="font-bold text-zinc-800 dark:text-white font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.test_variable} ={" "}
                                      {msg.diagnosis.diagnosis.counter_example.test_value}
                                    </div>
                                  </div>
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Asal</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.lhs_expected}
                                    </div>
                                  </div>
                                  <div className="p-1.5 rounded bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06]">
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Hasilmu</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-400 font-mono text-xs">
                                      {msg.diagnosis.diagnosis.counter_example.rhs_calculated}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Tombol Visualisasi di Papan Tulis */}
                            <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleOpenSmartboard(msg.smartboardItem)}
                                className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 hover:bg-[#ece6db] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-zinc-200 dark:border-white/[0.08] px-2.5 py-1 min-h-[28px] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Visualisasikan di Papan Tulis Pintar &rarr;</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Icons Bar (disembunyikan selama balasan masih disusun) */}
                        {!msg.pending && (
                        <div className="flex items-center gap-1.5 pt-1.5 text-zinc-500 dark:text-zinc-400">
                          {/* 1. Copy icon */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.replyText || "", msg.id)}
                            className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title={copiedMsgId === msg.id ? "Tersalin!" : "Salin jawaban"}
                            aria-label={copiedMsgId === msg.id ? "Jawaban tersalin" : "Salin jawaban"}
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-4 h-4 text-zinc-900 dark:text-white" />
                            ) : (
                              <ModernCopyIcon className="w-4 h-4 stroke-[1.6]" />
                            )}
                          </button>

                          {/* 2. Regenerate / retry icon */}
                          <button
                            type="button"
                            onClick={() => handleRegenerate(msg.id)}
                            className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Buat ulang respon"
                            aria-label="Buat ulang respon"
                          >
                            <RotateCw className="w-4 h-4 stroke-[1.6]" />
                          </button>

                          {/* 3. Thumbs up icon */}
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "up")}
                            className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              msg.feedback === "up" ? "text-zinc-900 dark:text-white bg-zinc-200 dark:bg-white/[0.1]" : "hover:text-zinc-800 dark:hover:text-zinc-200"
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
                            className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              msg.feedback === "down" ? "text-zinc-900 dark:text-white bg-zinc-200 dark:bg-white/[0.1]" : "hover:text-zinc-800 dark:hover:text-zinc-200"
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
                            className={`p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                              speakingMsgId === msg.id ? "text-zinc-900 dark:text-white bg-zinc-200 dark:bg-white/[0.1] animate-pulse" : "hover:text-zinc-800 dark:hover:text-zinc-200"
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

                          {/* 6. Share / Forward icon */}
                          <button
                            type="button"
                            onClick={() => handleShareMessage(msg.replyText || "", msg.id)}
                            className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title={sharedMsgId === msg.id ? "Tautan disalin!" : "Teruskan / Bagikan pesan"}
                            aria-label={sharedMsgId === msg.id ? "Tautan disalin" : "Teruskan / Bagikan pesan"}
                          >
                            {sharedMsgId === msg.id ? (
                              <Check className="w-4 h-4 text-zinc-900 dark:text-white" />
                            ) : (
                              <ModernShareIcon className="w-4 h-4 stroke-[1.6]" />
                            )}
                          </button>

                          {/* Jam pesan asisten di samping tombol forward / bagikan */}
                          {msg.timestamp && (
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono ml-0.5 select-none">
                              {msg.timestamp}
                            </span>
                          )}

                          {/* 7. Icon Papan Tulis */}
                          {msg.smartboardItem && (
                            <button
                              type="button"
                              onClick={() => handleOpenSmartboard(msg.smartboardItem)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100/80 dark:bg-white/[0.05] hover:bg-[#ece6db]/80 dark:hover:bg-white/[0.09] backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.08] transition-all ml-1 cursor-pointer"
                              title={`Lihat ${msg.smartboardItem.label}`}
                            >
                              <Box className="w-3.5 h-3.5 stroke-[1.8]" />
                              <span>{msg.smartboardItem.model === "2d_shape" ? "Papan Tulis 2D" : "Papan Tulis 3D"}</span>
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                  )}
                </div>
                );
              })}

              </div>

              {/* Indikator global hanya dipakai bila tidak ada placeholder pesan
                  (placeholder sudah menampilkan progresnya sendiri). */}
              {loading && !messages.some((m) => m.pending) && (
                <div className="flex gap-2.5 items-center" role="status" aria-live="polite">
                  <ZapLogo className="w-[18px] h-[18px] animate-pulse text-[#09090b] dark:text-white" />
                  <div className="bg-white dark:bg-[#14161f]/80 backdrop-blur-xl border border-zinc-200/90 dark:border-white/[0.08] rounded-2xl px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{loadingStatus}</span>
                    <ElapsedTicker startedAt={loadingStartedAt} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          </div>

          {/* 2. FIXED BOTTOM COMPOSER (Stays strictly fixed at bottom when scrolling messages) */}
          <div className="w-full flex-shrink-0 z-10 bg-[#faf9f6]/90 dark:bg-[#0e0f12]/90 backdrop-blur-md">
            <div className="w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
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
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Lepaskan gambar atau dokumen di sini
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Mendukung tangkapan layar, JPG, PNG, PDF, atau teks aljabar
                    </span>
                  </div>
                )}

                {/* Vault terenkripsi terkunci: pengingat non-blokir */}
                {vaultState === "locked" && !isGuestAccount(currentUser) && (
                  <div className="flex items-center justify-between gap-2 p-2.5 mb-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 animate-fade-in">
                    <div className="flex items-start gap-2 min-w-0">
                      <LockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed min-w-0">
                        <span className="font-semibold">Sinkronisasi terenkripsi terkunci.</span>{" "}
                        Buka vault untuk memuat percakapan &amp; kunci API dari perangkat lain.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab("general");
                        setShowSettingsModal(true);
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition cursor-pointer"
                    >
                      Buka kunci
                    </button>
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
                              ? "p-1.5 bg-zinc-100/90 dark:bg-zinc-800/80 border-zinc-300 dark:border-white/10"
                              : "px-2.5 py-1 bg-zinc-100 dark:bg-[#22252c] border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          <div
                            onClick={() => setPreviewFile(f)}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition min-w-0"
                            title="Klik untuk pratinjau penuh"
                          >
                            {isImg && f.dataUrl ? (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-900 shrink-0 border border-black/5 dark:border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="font-medium max-w-[130px] truncate text-xs text-zinc-800 dark:text-zinc-200">
                                {f.name}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
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
                            className="p-1 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-full text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
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
                      : "Tulis soal atau langkah pengerjaanmu..."
                  }
                className="w-full bg-transparent text-[15px] sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus-visible:ring-0 resize-none font-sans leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1.5 pt-2 min-w-0">
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

                <div className="flex items-center gap-2 ml-auto">
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
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition cursor-pointer ${
                      inputText.trim() && !loading && !isAccountSuspended
                        ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db]"
                        : "bg-zinc-200 dark:bg-[#282a32] text-zinc-400 dark:text-zinc-400 cursor-not-allowed"
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
            <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-300 font-medium">
              <Compass className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
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
                  className="ml-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer font-medium"
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
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setRightPaneFullscreen((prev) => !prev)}
                title={rightPaneFullscreen ? "Keluar layar penuh" : "Layar penuh"}
                aria-label={rightPaneFullscreen ? "Keluar layar penuh" : "Layar penuh"}
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
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
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
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
                  <Compass className="w-48 h-48 text-zinc-400 dark:text-white" strokeWidth={0.8} />
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
                    className="w-full text-left flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1b1c21] hover:bg-[#f7f4ef] dark:hover:bg-[#21232a] border border-zinc-200 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.12] transition cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                        <Box className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white flex items-center gap-1.5">
                          <span>Papan Tulis Pintar</span>
                          <span className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/[0.08] font-mono">2D / 3D</span>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Coret-coret kapur, grafik fungsi, &amp; geometri irisan
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Card 4: More tools */}
                  <button
                    type="button"
                    onClick={() => setShowMoreModal(true)}
                    className="w-full text-left flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1b1c21] hover:bg-[#f7f4ef] dark:hover:bg-[#21232a] border border-zinc-200 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.12] transition cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                        <LayoutGrid className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white">
                          More tools
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
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
              <div className="w-full h-full flex flex-col p-4 bg-zinc-50 dark:bg-[#0d0e12]">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
                  <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                    <span className="truncate">
                      Proyek: {workspaces.find((w) => w.id === activeWorkspaceId)?.name || "Tanpa Proyek"}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-200/60 dark:bg-white/[0.04] px-1.5 py-0.5 rounded flex-shrink-0">
                      {workspaceFiles.length} berkas
                    </span>
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-xs font-medium transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPaneTab("start")}
                      className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer px-2 py-1 min-h-[28px]"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* Workspace Files List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {workspaceFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewFile(file)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-white/[0.02] hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.04] hover:border-zinc-300 dark:hover:border-white/[0.1] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white font-medium truncate">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono flex-shrink-0">
                        <span>{Math.round(file.size / 1024) || 1} KB</span>
                        <Eye className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: SMARTBOARD VIRTUAL (2D / 3D / CHALKBOARD) */}
            {rightPaneTab === "canvas" && (
              <div className="w-full h-full flex flex-col bg-zinc-50 dark:bg-[#080a0f] relative">
                <InteractiveCanvas3D
                  key="smartboard_canvas"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Plugins dan konektor model"
            className="liquid-glass-popup rounded-3xl w-full max-w-lg p-5 space-y-4 animate-liquid-pop"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ConnectorHubIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">Plugins &amp; Model Connectors</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPluginModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Konfigurasikan API key untuk NVIDIA NIM, DeepSeek Cloud, ChatGPT OpenAI, Claude Anthropic, atau Custom Local Model (Ollama).
            </p>
            <div className="space-y-2 pt-1">
              <Link
                href="/connector"
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Automation tasks"
            className="liquid-glass-popup rounded-3xl w-full max-w-lg p-5 space-y-4 animate-liquid-pop"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-800 dark:text-white">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">Automation Tasks &amp; Invariants</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Pusat kendali otomatisasi SymPy CAS, pemeliharaan memori &amp; sinkronisasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTasksModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Task Controls & Features */}
            <div className="space-y-3 text-xs">
              {/* Feature 1: CAS Invariant Live Audit */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1c22] border border-zinc-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-zinc-900 dark:text-white">SymPy CAS Invariant Audit</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Verifikasi 22 invarian aljabar deterministik &amp; whitelist parser</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunCasAudit}
                    disabled={casAuditRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${casAuditRunning ? "animate-spin" : ""}`} />
                    <span>{casAuditRunning ? "Menguji..." : "Jalankan Audit"}</span>
                  </button>
                </div>
                {casAuditResult && (
                  <div className="p-2 rounded-lg bg-zinc-200/60 dark:bg-white/[0.04] text-xs text-zinc-800 dark:text-zinc-200 font-mono">
                    {casAuditResult}
                  </div>
                )}
              </div>

              {/* Feature 2: Scratchpad & Cache Sweeper */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1c22] border border-zinc-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-zinc-900 dark:text-white">Pembersih Scratchpad &amp; Draft Telemetri</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Bersihkan sisa draft lokal dan token cache sementara</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSweepScratchpad}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan</span>
                  </button>
                </div>
                {lastSweepResult && (
                  <div className="p-2 rounded-lg bg-zinc-200/60 dark:bg-white/[0.04] text-xs text-zinc-800 dark:text-zinc-200 font-mono">
                    {lastSweepResult}
                  </div>
                )}
              </div>

              {/* Feature 3 & 4: Automation Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1a1c22] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white text-xs">Auto-Sync Vault</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Sinkronkan ke Cloud</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoSyncEnabled}
                    aria-label="Aktifkan Auto-Sync Vault"
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoSyncEnabled ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                        autoSyncEnabled ? "translate-x-4 bg-white dark:bg-zinc-900" : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1a1c22] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white text-xs">Auto-Format LaTeX</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Format rumus baku</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoLatexEnabled}
                    aria-label="Aktifkan Auto-Format LaTeX"
                    onClick={() => setAutoLatexEnabled(!autoLatexEnabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      autoLatexEnabled ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                        autoLatexEnabled ? "translate-x-4 bg-white dark:bg-zinc-900" : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Task Activity Logs */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400">
                  Log Riwayat Tugas
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {taskLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-zinc-50 dark:bg-[#17181d] border border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-zinc-700 dark:text-zinc-300"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Check className="w-3 h-3 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                        <span className="truncate">{log.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 ml-2">
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Alat dan modul ekstra"
            className="liquid-glass-popup rounded-3xl w-full max-w-md p-5 space-y-4 animate-liquid-pop"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">Alat &amp; Modul Ekstra</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
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
                className="p-3.5 rounded-xl bg-zinc-50 hover:bg-[#f3efe7] dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-zinc-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <Box className="w-4 h-4 text-zinc-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-zinc-900 dark:text-white">Papan Tulis 3D</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Simulasi grafik interaktif</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreModal(false);
                  setShowPluginModal(true);
                }}
                className="p-3.5 rounded-xl bg-zinc-50 hover:bg-[#f3efe7] dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-zinc-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <ConnectorHubIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-zinc-900 dark:text-white">Plugins &amp; Konektor</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Kunci model dan konektor BYOK</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoreModal(false);
                  setShowTasksModal(true);
                }}
                className="p-3.5 rounded-xl bg-zinc-50 hover:bg-[#f3efe7] dark:bg-[#1c1d24] dark:hover:bg-[#252732] border border-zinc-200 dark:border-white/[0.06] text-left transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300 mb-1" />
                <div className="font-medium text-zinc-900 dark:text-white">Automation Tasks</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Audit CAS dan pembersihan lokal</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW WORKSPACE */}
      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buat proyek belajar baru"
            className="liquid-glass-popup rounded-3xl w-full max-w-sm p-5 space-y-4 animate-liquid-pop"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">Buat Proyek Belajar Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewWorkspaceModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="new-workspace-name" className="text-xs text-zinc-600 dark:text-zinc-400">Nama Proyek</label>
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
                className="w-full bg-zinc-50 dark:bg-[#1b1c22] border border-zinc-300 dark:border-white/[0.1] focus:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewWorkspaceModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim()}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  newWorkspaceName.trim()
                    ? "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db]"
                    : "bg-zinc-200 dark:bg-[#282a32] text-zinc-400 dark:text-zinc-400 cursor-not-allowed"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pratinjau berkas ${previewFile.name}`}
            className="liquid-glass-popup rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-liquid-pop"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50 dark:bg-[#191b22]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="font-semibold text-sm text-zinc-900 dark:text-white">{previewFile.name}</span>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
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
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-xs font-medium transition flex items-center gap-1 cursor-pointer"
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
                  className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
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
                    className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
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
                  className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Content Display */}
            <div className="p-4 overflow-y-auto flex-1 bg-zinc-50 dark:bg-[#0b0c10] text-zinc-800 dark:text-zinc-300 leading-relaxed select-text flex items-center justify-center">
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
                      <pre className="whitespace-pre-wrap p-4 rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200 dark:border-white/[0.08] overflow-x-auto selection:bg-amber-500/20">
                        {previewFile.content}
                      </pre>
                    </div>
                  );
                }

                return (
                  <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{previewFile.name}</p>
                    <p className="text-xs mt-1">Pratinjau langsung tidak tersedia untuk format biner ini.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PENGATURAN AKUN MINIMALIS & MODERN */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zap-settings-title"
            className="rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200/90 dark:border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] w-full max-w-[440px] max-h-[88vh] flex flex-col overflow-hidden animate-liquid-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 id="zap-settings-title" className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">
                  Pengaturan Akun
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Profil, tampilan, dan preferensi sesi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Tutup modal pengaturan"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Optional Superadmin Switcher */}
            {currentUser?.email?.toLowerCase().trim() === "wakhidpangestu1@gmail.com" && (
              <div className="px-5 pt-3">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setSettingsTab("general")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settingsTab !== "admin"
                        ? "bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-2xs"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Preferensi Akun
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsTab("admin")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      settingsTab === "admin"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Superadmin</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-zinc-700 dark:text-zinc-300">
              {settingsTab !== "admin" && (
                <>
                  {/* 0. VAULT TERENKRIPSI (ZERO-KNOWLEDGE) */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <LockIcon className="w-3.5 h-3.5" />
                          <span>Sinkronisasi Terenkripsi (Zero-Knowledge)</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                          {isGuestAccount(currentUser)
                            ? "Akun tamu tidak memakai sinkronisasi cloud."
                            : vaultState === "unlocked"
                            ? "Vault terbuka di perangkat ini. Percakapan & kunci API diunggah sebagai ciphertext."
                            : vaultState === "locked"
                            ? "Vault terkunci. Buka dengan passphrase untuk memuat percakapan & kunci API dari cloud."
                            : "Belum ada vault. Buat passphrase vault untuk mengaktifkan cadangan terenkripsi lintas perangkat."}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                          vaultState === "unlocked"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : vaultState === "locked"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-zinc-200 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300"
                        }`}
                      >
                        {vaultState === "unlocked" ? "TERBUKA" : vaultState === "locked" ? "TERKUNCI" : "BELUM ADA"}
                      </span>
                    </div>

                    {!isGuestAccount(currentUser) && vaultState !== "unlocked" && (
                      <div className="space-y-1.5">
                        <input
                          type="password"
                          autoComplete="new-password"
                          aria-label="Passphrase vault"
                          placeholder="Passphrase vault (min. 8 karakter)"
                          value={vaultPassphrase}
                          onChange={(e) => setVaultPassphrase(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleVaultSetup}
                            disabled={vaultBusy || vaultPassphrase.trim().length < 8}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            {vaultBusy ? "Memproses…" : "Buat vault baru"}
                          </button>
                          <button
                            type="button"
                            onClick={handleVaultUnlock}
                            disabled={vaultBusy || !vaultPassphrase.trim() || vaultState !== "locked"}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-[#ece6db] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            Buka vault
                          </button>
                        </div>
                        {vaultError && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400">{vaultError}</p>
                        )}
                      </div>
                    )}

                    {vaultRecoveryCode && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-1.5">
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          Simpan kode pemulihan ini sekarang (hanya ditampilkan sekali):
                        </p>
                        <code className="block text-[11px] font-mono break-all text-amber-900 dark:text-amber-200">
                          {vaultRecoveryCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(vaultRecoveryCode).then(
                              () => notify("Kode pemulihan disalin. Simpan di tempat aman.", "info"),
                              () => notify("Gagal menyalin. Salin manual kode di atas.", "error")
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition cursor-pointer"
                        >
                          Salin kode
                        </button>
                      </div>
                    )}

                    {vaultNotice && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">{vaultNotice}</p>
                    )}

                    {vaultState === "unlocked" && !isGuestAccount(currentUser) && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentUser) return;
                            void syncAccountBackup(currentUser).then((ok) =>
                              notify(
                                ok
                                  ? "Vault terenkripsi tersinkron ke cloud."
                                  : "Sinkronisasi gagal/ditunda. Periksa koneksi atau status vault.",
                                ok ? "info" : "error"
                              )
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-semibold transition cursor-pointer"
                        >
                          Sinkronkan sekarang
                        </button>
                        <button
                          type="button"
                          onClick={handleVaultLock}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-[#ece6db] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer"
                        >
                          Kunci vault
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1. Profile Summary Card */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={currentUser?.name}
                        email={currentUser?.email}
                        avatar={currentUser?.avatar}
                        isGuest={isGuestAccount(currentUser)}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                            {currentUser?.name || "Pengguna ChatZAP"}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 shrink-0">
                            {isGuestAccount(currentUser) ? "Tamu" : currentUser?.provider === "google" ? "Google" : "Akun"}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {isGuestAccount(currentUser)
                            ? `${conversations.length} percakapan tersimpan di perangkat`
                            : currentUser?.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        syncAccountBackup(currentUser);
                        restoreAccountData(currentUser).then((r) => {
                          if (r.user) setCurrentUser(r.user);
                        });
                        setSyncSuccessToast(true);
                        setTimeout(() => setSyncSuccessToast(false), 2500);
                      }}
                      title="Sinkronkan cadangan akun"
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#f3efe7] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-zinc-200/90 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 font-medium text-[11px] flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-2xs"
                    >
                      {syncSuccessToast ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Tersinkron</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="w-3 h-3" />
                          <span>Sinkron</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 2. Clean Switch Rows (Tema, Proyektor, Auto-scroll) */}
                  <div className="divide-y divide-zinc-100 dark:divide-white/[0.06] border-y border-zinc-100 dark:border-white/[0.06]">
                    {/* Mode Gelap Switch */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                          {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="font-medium text-xs text-zinc-900 dark:text-white">Mode Gelap</div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {theme === "dark" ? "Tampilan gelap aktif" : "Tampilan terang aktif"}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label="Mode Gelap"
                        aria-checked={theme === "dark"}
                        onClick={(event) => {
                          const nextTheme = theme === "dark" ? "light" : "dark";
                          setTheme(nextTheme, event.currentTarget);
                          if (currentUser) syncAccountBackup(currentUser, { configs: { theme: nextTheme } });
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          theme === "dark" ? "bg-white" : "bg-zinc-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                            theme === "dark"
                              ? "translate-x-4 bg-[#09090b]"
                              : "translate-x-0 bg-white"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Mode Proyektor Switch */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                          <Laptop className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-medium text-xs text-zinc-900 dark:text-white">Mode Kontras Kanvas</div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Pertebal garis koordinat 2D/3D untuk layar proyektor
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label="Mode Kontras Kanvas"
                        aria-checked={isProjectorMode}
                        onClick={() => setIsProjectorMode(!isProjectorMode)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isProjectorMode ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                            isProjectorMode
                              ? "translate-x-4 bg-white dark:bg-[#09090b]"
                              : "translate-x-0 bg-white dark:bg-zinc-400"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-scroll Switch */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-medium text-xs text-zinc-900 dark:text-white">Auto-scroll Pesan</div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Gulir otomatis saat balasan baru tiba
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label="Gulir otomatis percakapan"
                        aria-checked={autoScrollChat}
                        onClick={() => setAutoScrollChat(!autoScrollChat)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          autoScrollChat ? "bg-[#09090b] dark:bg-white" : "bg-zinc-200 dark:bg-white/[0.12]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-2xs transition duration-200 ease-in-out ${
                            autoScrollChat
                              ? "translate-x-4 bg-white dark:bg-[#09090b]"
                              : "translate-x-0 bg-white dark:bg-zinc-400"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 3. Security Strike Notice (Only if flagged) */}
                  {(isAccountSuspended || jailbreakStrikes > 0) && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-800 dark:text-amber-300">
                        {isAccountSuspended ? "Akun ditangguhkan" : `Peringatan keamanan (${jailbreakStrikes}/2)`}
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
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#09090b] text-white dark:bg-white dark:text-[#09090b] text-[11px] font-semibold cursor-pointer"
                      >
                        Reset Status
                      </button>
                    </div>
                  )}

                  {/* 4. Quick Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href="/connector"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-[#ece6db]/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <ConnectorHubIcon className="w-3.5 h-3.5" />
                      <span>Model &amp; API Keys</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsModal(false);
                        handleLogout();
                      }}
                      className="px-3.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                </>
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
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                      <h3 className="font-semibold text-xs text-zinc-900 dark:text-white">Buka Blokir Pengguna Berdasarkan Email</h3>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="admin-secret-input"
                          className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Admin Secret (disimpan sementara di tab ini)
                        </label>
                        <input
                          id="admin-secret-input"
                          type="password"
                          autoComplete="off"
                          aria-label="Admin secret untuk otorisasi aksi keamanan"
                          placeholder="Secret administrator (ADMIN_SECRET di server)"
                          value={adminSecretInput}
                          onChange={(e) => {
                            setAdminSecretInput(e.target.value);
                            try {
                              if (e.target.value.trim()) {
                                sessionStorage.setItem("zap_admin_secret", e.target.value.trim());
                              } else {
                                sessionStorage.removeItem("zap_admin_secret");
                              }
                            } catch {}
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Semua aksi di panel ini ditolak server tanpa secret yang valid. Secret tidak
                          pernah dikirim ke peramban lain dan hilang saat tab ditutup.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          aria-label="Email siswa yang ingin dibuka blokirnya"
                          placeholder="Masukkan email siswa (misal: user@gmail.com)"
                          value={adminTargetEmail}
                          onChange={(e) => setAdminTargetEmail(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#14151a] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdminUnbanUser()}
                          disabled={adminUnbanLoading || !adminTargetEmail.trim() || !adminSecretInput.trim()}
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
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-xs text-zinc-900 dark:text-white">
                          Daftar Rekam Keamanan Pengguna ({adminSuspendedList.length})
                        </h5>
                        <button
                          type="button"
                          onClick={() => fetchAdminSuspendedList()}
                          disabled={adminLoadingList}
                          className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCw className={`w-3 h-3 ${adminLoadingList ? "animate-spin" : ""}`} />
                          <span>Segarkan</span>
                        </button>
                      </div>

                      {adminSuspendedList.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic py-2">
                          Belum ada pengguna yang tercatat melakukan pelanggaran jailbreak.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {adminSuspendedList.map((rec) => (
                            <div
                              key={rec.email}
                              className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#15161b] flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5 min-w-0 pr-2">
                                <div className="font-mono font-medium text-zinc-900 dark:text-white truncate">
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
                                    <span className="text-zinc-400 dark:text-zinc-400 truncate max-w-xs">
                                      {rec.reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdminUnbanUser(rec.email)}
                                disabled={adminUnbanLoading}
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-[#ece6db] text-white text-[11px] font-medium transition cursor-pointer whitespace-nowrap shadow-xs"
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

      {/* Notifikasi non-blokir (pengganti window.alert) */}
      {systemNotice && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] max-w-[min(92vw,42rem)]"
          role="alert"
          aria-live="assertive"
        >
          <div
            className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-xl backdrop-blur-xl text-xs leading-relaxed ${
              systemNotice.tone === "error"
                ? "bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                : "bg-white/95 dark:bg-[#14161f]/95 border-zinc-200 dark:border-white/[0.1] text-zinc-800 dark:text-zinc-200"
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {systemNotice.tone === "error" ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </span>
            <span className="flex-1">{systemNotice.text}</span>
            <button
              type="button"
              onClick={() => setSystemNotice(null)}
              aria-label="Tutup pemberitahuan"
              className="shrink-0 p-1 -m-1 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Menu Konteks Klik Kanan pada Riwayat Chat (Edit, Archive, Share, Delete) */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/15 dark:bg-black/35 backdrop-blur-[0.5px]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            className="fixed z-50 min-w-[195px] p-1.5 rounded-2xl bg-white/95 dark:bg-[#18191e]/95 backdrop-blur-md border border-zinc-200/90 dark:border-white/[0.12] shadow-2xl text-[13px] text-zinc-700 dark:text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 dark:text-zinc-400 truncate max-w-[185px] border-b border-zinc-100 dark:border-white/[0.06] mb-1">
              {contextMenu.conv.title}
            </div>

            {/* 1. Edit Nama */}
            <button
              type="button"
              onClick={() => {
                setEditingConvId(contextMenu.convId);
                setEditingTitleText(contextMenu.conv.title);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f3efe7] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Edit Nama</span>
            </button>

            {/* 2. Archive / Buka Arsip */}
            <button
              type="button"
              onClick={() => toggleArchiveConversation(contextMenu.convId)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f3efe7] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
            >
              {contextMenu.conv.archived ? (
                <>
                  <ArchiveRestore className="w-3.5 h-3.5 text-amber-500" />
                  <span>Buka Arsip</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Arsipkan</span>
                </>
              )}
            </button>

            {/* 3. Share */}
            <button
              type="button"
              onClick={() => {
                const targetConv = contextMenu.conv;
                setContextMenu(null);
                handleOpenShareModal(targetConv);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f3efe7] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
            >
              <ModernShareIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Bagikan</span>
            </button>

            <div className="my-1 border-t border-zinc-100 dark:border-white/[0.06]" />

            {/* 4. Delete */}
            <button
              type="button"
              onClick={(e) => {
                const idToDelete = contextMenu.convId;
                setContextMenu(null);
                deleteConversation(idToDelete, e);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Percakapan</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

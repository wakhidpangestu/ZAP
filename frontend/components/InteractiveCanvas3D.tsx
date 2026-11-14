"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  RotateCcw,
  Sparkles,
  Pencil,
  Eraser,
  Trash2,
  Tv,
  Box,
  X,
  Layers,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Scissors,
  Eye,
  EyeOff,
  Type,
  Edit3,
  Send,
  Check,
  ZoomIn,
  ZoomOut,
  Users,
  Copy,
  LogOut,
  ImagePlus,
  CircleDot,
} from "lucide-react";
import { useTheme } from "@/utils/theme";
import MathView from "@/components/MathView";
import { Dock, DockItem, DockIcon, DockLabel } from "@/components/ui/dock";
import { motion, AnimatePresence } from "framer-motion";
import ZapLogo from "@/components/ZapLogo";

export type MathModelType =
  | "empty"
  | "2d_empty"
  | "3d_empty"
  | "2d_shape"
  | "2d_quadratic"
  | "2d_trig"
  | "2d_linear"
  | "2d_circle"
  | "parabola"
  | "conic_slicer"
  | "cylinder"
  | "saddle"
  | "counting_blocks"
  | "solids"
  | "surface";

export type SolidKind = "kubus" | "balok" | "bola" | "kerucut" | "prisma" | "prisma_segilima" | "prisma_segienam" | "prisma_poligon" | "limas" | "limas_poligon";

export type PlaneShapeKind =
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
  | "segienam"
  | "poligon";

export interface BoardFormulaItem {
  id: string;
  latex: string;
  rawText?: string;
  x: number; // percentage 0-100% dari lebar kanvas
  y: number; // percentage 0-100% dari tinggi kanvas
  color?: "default" | "amber" | "emerald" | "blue" | "rose" | "purple";
  fontSize?: "sm" | "base" | "lg" | "xl";
  kind?: "math" | "text";
}

export interface BoardImageItem {
  id: string;
  dataUrl: string;
  x: number; // percentage 0-100% dari lebar kanvas
  y: number; // percentage 0-100% dari tinggi kanvas
  width: number; // lebar dalam px (default 240)
  name?: string;
}

/**
 * Otomatis mendeteksi notasi matematika umum dari ketikan keyboard dan mengubahnya ke KaTeX
 */
export function autoFormatToLatex(input: string): string {
  if (!input || !input.trim()) return "";
  let s = input.trim();

  // Jika sudah berformat LaTeX murni (mengandung backslash), pertahankan
  if (s.includes("\\frac") || s.includes("\\sqrt") || s.includes("\\sum") || s.includes("\\int") || s.includes("\\pi")) {
    return s;
  }

  // 1. Pangkat unicode superscripts
  s = s.replace(/²/g, "^2").replace(/³/g, "^3");

  // 2. Pecahan sederhana: e.g. 1/2 atau a/b (hindari path atau tanggal)
  s = s.replace(/(\b\d+|\b[a-zA-Z])\s*\/\s*(\b\d+|\b[a-zA-Z])/g, "\\frac{$1}{$2}");

  // 3. Akar kuadrat: sqrt(x) atau akar(x)
  s = s.replace(/\bsqrt\(([^)]+)\)/gi, "\\sqrt{$1}");
  s = s.replace(/\bakar\(([^)]+)\)/gi, "\\sqrt{$1}");

  // 4. Trigonometri
  s = s.replace(/\bsin\b/gi, "\\sin");
  s = s.replace(/\bcos\b/gi, "\\cos");
  s = s.replace(/\btan\b/gi, "\\tan");

  // 5. Huruf Yunani
  s = s.replace(/\bpi\b/gi, "\\pi");
  s = s.replace(/\btheta\b/gi, "\\theta");
  s = s.replace(/\balpha\b/gi, "\\alpha");
  s = s.replace(/\bbeta\b/gi, "\\beta");

  // 6. Operator aritmatika
  s = s.replace(/\s*\*\s*/g, " \\cdot ");
  s = s.replace(/\+\-/g, "\\pm");
  s = s.replace(/<=/g, "\\le");
  s = s.replace(/>=/g, "\\ge");
  s = s.replace(/!=/g, "\\neq");

  return s;
}

/**
 * Deteksi apakah sebuah ketikan lebih mirip RUMUS daripada teks biasa.
 * Dipakai alat Tulis di Kanvas: teks biasa tampil apa adanya (huruf tegak,
 * spasi utuh), sedangkan rumus otomatis dirender KaTeX. Pengguna tetap bisa
 * mengganti keputusan ini dari bilah aksi catatan (Jadikan KaTeX / Teks biasa).
 */
export function looksLikeMath(input: string): boolean {
  const s = (input || "").trim();
  if (!s) return false;
  if (s.includes("\\")) return true; // sudah mengandung perintah LaTeX
  if (/[²³≤≥≠×÷√πθ]/.test(s)) return true;
  if (/\b(sin|cos|tan|log|ln|lim|sqrt|akar|frac|integral|turunan|theta|alpha|beta)\b/i.test(s)) return true;
  if (/[=<>^_]/.test(s)) return true; // persamaan, pertidaksamaan, pangkat, subskrip
  if (/\d/.test(s) && /[+\-*/]/.test(s)) return true; // angka dengan operator
  if (/^[a-zA-Z]\s*\(/.test(s)) return true; // f(x) dan sejenisnya
  if (/\b[a-zA-Z]\s*[-+]\s*\d/.test(s)) return true; // x + 3 dan sejenisnya
  return false;
}

/**
 * Deteksi intensi transformasi formula/teks: Grafik 2D, 3D Solid, atau Bangun Datar 2D
 */
export function detectMathTransform(text: string): "graph" | "3d" | "2d_shape" | null {
  const lower = text.toLowerCase().trim();
  // 3D Solids
  if (
    /\b(kubus|balok|bola|silinder|tabung|kerucut|prisma|limas|piramida|pelana|saddle|3d|ruang)\b/i.test(lower) &&
    !lower.includes("jaring")
  ) {
    return "3d";
  }
  // 2D Nets atau bangun datar
  if (
    /\b(jaring|jaring-jaring|net|persegi panjang|persegi|segitiga|lingkaran|belah ketupat|layang-layang|jajar genjang|trapesium|2d)\b/i.test(
      lower
    )
  ) {
    return "2d_shape";
  }
  // Fungsi kurva aljabar 2D (parabola, sinus, linear)
  if (
    lower.includes("y =") ||
    lower.includes("y=") ||
    lower.includes("f(x)") ||
    lower.includes("x^2") ||
    lower.includes("x²") ||
    lower.includes("sin") ||
    lower.includes("cos") ||
    lower.includes("tan") ||
    lower.includes("parabola") ||
    lower.includes("grafik")
  ) {
    return "graph";
  }
  return null;
}

export const FORMULA_SYMBOLS = [
  { label: "a/b", insert: "\\frac{a}{b}" },
  { label: "√x", insert: "\\sqrt{x}" },
  { label: "x²", insert: "x^2" },
  { label: "xₙ", insert: "x_n" },
  { label: "π", insert: "\\pi" },
  { label: "θ", insert: "\\theta" },
  { label: "α", insert: "\\alpha" },
  { label: "β", insert: "\\beta" },
  { label: "Δ", insert: "\\Delta" },
  { label: "±", insert: "\\pm" },
  { label: "×", insert: "\\times" },
  { label: "÷", insert: "\\div" },
  { label: "≈", insert: "\\approx" },
  { label: "≤", insert: "\\le" },
  { label: "≥", insert: "\\ge" },
  { label: "≠", insert: "\\neq" },
  { label: "∫", insert: "\\int_{a}^{b} f(x) \\, dx" },
  { label: "∑", insert: "\\sum_{i=1}^{n}" },
  { label: "∞", insert: "\\infty" },
  { label: "·", insert: "\\cdot" },
];

export const FORMULA_TEMPLATES = [
  { name: "Teorema Pythagoras", latex: "a^2 + b^2 = c^2" },
  { name: "Luas Segitiga", latex: "L = \\frac{1}{2} \\times a \\times t" },
  { name: "Luas Lingkaran", latex: "L = \\pi r^2" },
  { name: "Keliling Lingkaran", latex: "K = 2\\pi r" },
  { name: "Volume Kubus", latex: "V = s^3" },
  { name: "Luas Permukaan Kubus", latex: "L_p = 6s^2" },
  { name: "Volume Balok", latex: "V = p \\times l \\times t" },
  { name: "Volume Prisma Segitiga", latex: "V = L_a \\times t_p = \\left(\\frac{1}{2} a \\cdot t_a\\right) t_p" },
  { name: "Luas Permukaan Prisma", latex: "L_p = 2L_a + (s_1 + s_2 + s_3) \\times t_p" },
  { name: "Volume Limas Segi Empat", latex: "V = \\frac{1}{3} \\times L_a \\times t" },
  { name: "Volume Tabung", latex: "V = \\pi r^2 t" },
  { name: "Luas Tabung", latex: "L = 2\\pi r (r + t)" },
  { name: "Rumus Kuadrat ABC", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { name: "Identitas Trigonometri", latex: "\\sin^2(\\theta) + \\cos^2(\\theta) = 1" },
];

export type CanvasPreviewScene = {
  model: MathModelType;
  solidKind?: SolidKind;
  a?: number;
  b?: number;
  c?: number;
};

export type CanvasPreviewConfig = {
  /** Scene yang ditampilkan; berubah = model/parameter ikut berganti. */
  scene?: CanvasPreviewScene;
  /** Nyalakan rotasi otomatis sejak frame pertama. */
  autoRotate?: boolean;
  /** > 1 = kamera lebih dekat sehingga objek 3D tampak lebih besar. */
  cameraZoom?: number;
  /** Jangan tangkap roda mouse (biarkan halaman landing tetap bisa digulir). */
  disableWheel?: boolean;
  /**
   * Pratinjau: tab 3D/2D/Papan memanggil ini alih-alih membuka mode kosong,
   * agar objek (kubus/kurva/papan) tetap ada saat pengunjung berpindah tab.
   */
  onSceneChange?: (id: "3d" | "2d" | "papan") => void;
};

interface InteractiveCanvas3DProps {
  initialModel?: MathModelType;
  initialSolidKind?: SolidKind;
  initialPlaneShapeKind?: PlaneShapeKind;
  initialParamA?: number;
  initialParamB?: number;
  initialParamC?: number;
  initialUnit?: string;
  initialShowSlice?: boolean;
  showComparisonFault?: boolean;
  className?: string;
  onModelChange?: (model: MathModelType) => void;
  onSolidKindChange?: (solid: SolidKind) => void;
  onPlaneShapeChange?: (shape: PlaneShapeKind) => void;
  onParamsChange?: (a: number, b: number, c: number, unit?: string) => void;
  isProjectorMode?: boolean;
  onToggleProjector?: () => void;
  onClose?: () => void;
  collabName?: string;
  /**
   * Panel induk dapat meminta render loop 3D berhenti sementara (mis. panel
   * kanan ditutup / tab kanvas tidak aktif) tanpa meng-unmount komponen.
   * Loop juga otomatis berhenti saat kanvas keluar viewport, tab browser
   * disembunyikan, atau mode bukan 3D.
   */
  paused?: boolean;
  /**
   * Pratinjau (landing): sembunyikan kartu HUD metrik & kontrol (mis. "Kubus 3D")
   * beserta tombol mata di dock, supaya panel mock tidak penuh.
   */
  hideHud?: boolean;
  /** Pratinjau (landing): jangan render widget ZAP Copilot di kanan bawah. */
  hideCopilot?: boolean;
  /**
   * Pratinjau (landing): lewati penggambaran WebGL selama halaman digulir.
   * Diimplementasikan lewat ref (tanpa setState) supaya tidak memicu re-render
   * pohon komponen yang besar di setiap awal/akhir gulir.
   */
  pauseOnScroll?: boolean;
  /**
   * Konfigurasi khusus pratinjau landing: scene yang bisa berganti (kubus 3D,
   * grafik 2D, papan tulis), rotasi otomatis, zoom kamera, dan roda mouse
   * diteruskan ke halaman agar scroll landing tidak tertahan.
   */
  preview?: CanvasPreviewConfig;
}

const GRID_Y = -1.5;

/**
 * Membuat geometri sudut siku 3D (3-axis corner angle bracket) untuk vertex handle resize
 * Menggantikan bulatan bola dengan sudut siku presisi sesuai bentuk geometri
 */
function createCornerBracketGeometry(
  dx: number,
  dy: number,
  dz: number,
  armLen = 0.32,
  armThick = 0.05
): THREE.BufferGeometry {
  const geoX = new THREE.BoxGeometry(armLen, armThick, armThick);
  geoX.translate((dx * armLen) / 2, 0, 0);

  const geoY = new THREE.BoxGeometry(armThick, armLen, armThick);
  geoY.translate(0, (dy * armLen) / 2, 0);

  const geoZ = new THREE.BoxGeometry(armThick, armThick, armLen);
  geoZ.translate(0, 0, (dz * armLen) / 2);

  const geoCorner = new THREE.BoxGeometry(armThick * 1.6, armThick * 1.6, armThick * 1.6);

  const geoKnob = new THREE.SphereGeometry(0.062, 12, 12);
  const merged = BufferGeometryUtils.mergeGeometries([geoX, geoY, geoZ, geoCorner, geoKnob]);
  geoX.dispose();
  geoY.dispose();
  geoZ.dispose();
  geoCorner.dispose();
  geoKnob.dispose();
  return merged;
}

/**
 * Membuat sprite teks angka/dimensi 3D yang selalu menghadap kamera dan terlihat jelas di sisi 3D
 */
function createDimensionSprite(text: string, isDark = true): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Glass pill background
    ctx.fillStyle = isDark ? "rgba(10, 14, 26, 0.92)" : "rgba(255, 255, 255, 0.94)";
    const radius = 16;
    const x = 6, y = 6, w = 228, h = 52;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.85)" : "rgba(2, 132, 199, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text label
    ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 120, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.72, 0.22, 1);
  return sprite;
}

function fmt(n: number): string {
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface InfoRow {
  label: string;
  formula: string;
  value?: string;
}

const SOLID_LABELS: Record<SolidKind, string> = {
  kubus: "Kubus 3D",
  balok: "Balok 3D",
  bola: "Bola 3D",
  kerucut: "Kerucut 3D",
  prisma: "Prisma Segitiga 3D",
  prisma_segilima: "Prisma Segilima 3D",
  prisma_segienam: "Prisma Segienam 3D",
  limas: "Limas Segi Empat 3D (Piramida)",
  prisma_poligon: "Prisma Poligon 3D",
  limas_poligon: "Limas Poligon 3D (Piramida)",
};

// Quick formula suggestions
const SMART_PRESETS = [
  { label: "Persegi Panjang", model: "2d_shape" as MathModelType, planeShape: "persegi_panjang" as PlaneShapeKind, paramA: 14, paramB: 8, unit: "cm", desc: "Persegi panjang p=14, l=8" },
  { label: "Persegi", model: "2d_shape" as MathModelType, planeShape: "persegi" as PlaneShapeKind, paramA: 10, unit: "cm", desc: "Persegi sisi s=10" },
  { label: "Lingkaran", model: "2d_shape" as MathModelType, planeShape: "lingkaran" as PlaneShapeKind, paramA: 7, unit: "cm", desc: "Lingkaran r=7, diameter=14" },
  { label: "Belah Ketupat", model: "2d_shape" as MathModelType, planeShape: "belah_ketupat" as PlaneShapeKind, paramA: 12, paramB: 16, unit: "cm", desc: "Belah ketupat d₁=12, d₂=16" },
  { label: "Layang-Layang", model: "2d_shape" as MathModelType, planeShape: "layang_layang" as PlaneShapeKind, paramA: 12, paramB: 16, unit: "cm", desc: "Layang-layang d₁=12, d₂=16" },
  { label: "Jajar Genjang", model: "2d_shape" as MathModelType, planeShape: "jajar_genjang" as PlaneShapeKind, paramA: 12, paramB: 8, paramC: 10, unit: "cm", desc: "Jajar genjang alas, tinggi & sisi miring" },
  { label: "Trapesium", model: "2d_shape" as MathModelType, planeShape: "trapesium" as PlaneShapeKind, paramA: 8, paramB: 14, paramC: 6, unit: "cm", desc: "Trapesium sisi sejajar & tinggi" },
  { label: "Segitiga", model: "2d_shape" as MathModelType, planeShape: "segitiga" as PlaneShapeKind, paramA: 10, paramB: 8, unit: "cm", desc: "Segitiga alas & tinggi" },
  { label: "Jaring Prisma 2D", model: "2d_shape" as MathModelType, planeShape: "jaring_prisma" as PlaneShapeKind, paramA: 8, paramB: 10, unit: "cm", desc: "Bentangan jaring-jaring 2D prisma segitiga" },
  { label: "Jaring Kubus 2D", model: "2d_shape" as MathModelType, planeShape: "jaring_kubus" as PlaneShapeKind, paramA: 10, unit: "cm", desc: "Bentangan jaring-jaring 2D kubus" },
  { label: "Jaring Limas 2D", model: "2d_shape" as MathModelType, planeShape: "jaring_limas" as PlaneShapeKind, paramA: 8, paramB: 10, unit: "cm", desc: "Bentangan jaring-jaring 2D limas segi empat" },
  { label: "y = x² - 3", model: "2d_quadratic" as MathModelType, desc: "Grafik parabola & akar real" },
  { label: "y = 2 sin(x)", model: "2d_trig" as MathModelType, desc: "Gelombang trigonometri & amplitudo" },
  { label: "Kubus 10cm", model: "solids" as MathModelType, solid: "kubus" as SolidKind, paramA: 10, unit: "cm", hasSlice: false, desc: "Kubus sisi 10 cm geometri ruang" },
  { label: "Kubus + Irisan", model: "solids" as MathModelType, solid: "kubus" as SolidKind, paramA: 10, unit: "cm", hasSlice: true, desc: "Kubus sisi 10 cm dengan bidang irisan" },
  { label: "Balok 10×6×4", model: "solids" as MathModelType, solid: "balok" as SolidKind, paramA: 10, paramB: 6, paramC: 4, unit: "cm", desc: "Balok ruang p×l×t" },
  { label: "Prisma Segitiga", model: "solids" as MathModelType, solid: "prisma" as SolidKind, paramA: 8, paramB: 10, unit: "cm", desc: "Prisma segitiga geometri ruang" },
  { label: "Prisma Segilima", model: "solids" as MathModelType, solid: "prisma_segilima" as SolidKind, paramA: 8, paramB: 10, unit: "cm", desc: "Prisma segilima geometri ruang" },
  { label: "Prisma Segienam", model: "solids" as MathModelType, solid: "prisma_segienam" as SolidKind, paramA: 8, paramB: 10, unit: "cm", desc: "Prisma segienam geometri ruang" },
  { label: "Segilima 2D", model: "2d_shape" as MathModelType, planeShape: "segilima" as PlaneShapeKind, paramA: 10, unit: "cm", desc: "Segilima beraturan (pentagon) sisi s=10" },
  { label: "Segienam 2D", model: "2d_shape" as MathModelType, planeShape: "segienam" as PlaneShapeKind, paramA: 10, unit: "cm", desc: "Segienam beraturan (heksagon) sisi s=10" },
  { label: "Piramida / Limas", model: "solids" as MathModelType, solid: "limas" as SolidKind, paramA: 8, paramB: 10, unit: "cm", desc: "Limas tegak segi empat (piramida) p×l×t" },
  { label: "Bola r=7", model: "solids" as MathModelType, solid: "bola" as SolidKind, paramA: 7, unit: "cm", desc: "Bola 3D jari-jari 7 cm" },
  { label: "Tabung r=7", model: "cylinder" as MathModelType, paramA: 7, paramB: 12, unit: "cm", desc: "Silinder ruang radius & tinggi" },
  { label: "Irisan Kerucut", model: "conic_slicer" as MathModelType, desc: "Pemotongan elips, parabola & hiperbola" },
  { label: "Pelana Kuda 3D", model: "saddle" as MathModelType, desc: "Permukaan kuadrik z = x² - y²" },
];

export default function InteractiveCanvas3D({
  initialModel = "empty",
  initialSolidKind,
  initialPlaneShapeKind,
  initialParamA,
  initialParamB,
  initialParamC,
  initialUnit,
  initialShowSlice = false,
  className = "",
  onModelChange,
  onSolidKindChange,
  onPlaneShapeChange,
  onParamsChange,
  isProjectorMode = false,
  onToggleProjector,
  onClose,
  collabName = "Tamu",
  paused = false,
  hideHud = false,
  hideCopilot = false,
  pauseOnScroll = false,
  preview,
}: InteractiveCanvas3DProps) {
  // Main mode: "empty" | "2d_graph" | "3d_model"
  const [activeModel, setActiveModel] = useState<MathModelType>(initialModel);
  const [planeShapeKind, setPlaneShapeKind] = useState<PlaneShapeKind>(initialPlaneShapeKind || "jajar_genjang");

  const { isDark } = useTheme();

  // Drawing Canvas (Coret-coret kapur/stylus & Penghapus)
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingToolActive, setIsDrawingToolActive] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"pen" | "eraser">("pen");
  const [drawColor, setDrawColor] = useState<string>(isDark ? "#f8fafc" : "#0f172a");
  const [brushSize, setBrushSize] = useState<number>(3);
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawings, setHasDrawings] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!hasDrawings) {
      setDrawColor(isDark ? "#f8fafc" : "#0f172a");
    }
  }, [isDark, hasDrawings]);

  // 2D Graph Canvas & Interactive Zoom / Pan State
  const graph2DCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom2D, setZoom2D] = useState<number>(1);
  const [pan2D, setPan2D] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanning2DRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Board Workspace Container Ref (for calculating percentage drag coordinates)
  const boardWorkspaceRef = useRef<HTMLDivElement | null>(null);

  // KaTeX Keyboard Formula Notes on Board
  const [formulaNotes, setFormulaNotes] = useState<BoardFormulaItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("zap_board_formulas");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("zap_board_formulas", JSON.stringify(formulaNotes));
      } catch {
        // ignore
      }
    }
  }, [formulaNotes]);

  // On-Canvas Direct Typing & Selection State
  const [isTypingToolActive, setIsTypingToolActive] = useState(false);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);

  // Pasted / Dropped Images on Smartboard
  const [boardImages, setBoardImages] = useState<BoardImageItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("zap_board_images");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const boardImageInputRef = useRef<HTMLInputElement | null>(null);
  const lastBoardPointerPctRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("zap_board_images", JSON.stringify(boardImages));
      } catch {
        // ignore
      }
    }
  }, [boardImages]);

  const showBoardClipboardToast = useCallback((msg: string) => {
    setClipboardToast(msg);
    setTimeout(() => {
      setClipboardToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const addDataUrlImageToBoard = useCallback(
    (dataUrl: string, name?: string, pctX?: number, pctY?: number) => {
      if (!dataUrl || !dataUrl.startsWith("data:image/")) return;
      const newId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const fallbackOffset = (boardImages.length % 5) * 4;
      const targetX =
        pctX !== undefined
          ? Math.max(2, Math.min(72, pctX))
          : lastBoardPointerPctRef.current
          ? Math.max(2, Math.min(72, lastBoardPointerPctRef.current.x))
          : 22 + fallbackOffset;
      const targetY =
        pctY !== undefined
          ? Math.max(4, Math.min(72, pctY))
          : lastBoardPointerPctRef.current
          ? Math.max(4, Math.min(72, lastBoardPointerPctRef.current.y))
          : 18 + fallbackOffset;

      const newItem: BoardImageItem = {
        id: newId,
        dataUrl,
        x: targetX,
        y: targetY,
        width: 240,
        name: name || "Gambar Papan",
      };
      setBoardImages((prev) => [...prev, newItem]);
      setSelectedImageId(newId);
      setSelectedFormulaId(null);
      showBoardClipboardToast("Gambar ditempel ke Papan Tulis");
    },
    [boardImages.length, showBoardClipboardToast]
  );

  const addImageFileToBoard = useCallback(
    (file: File, pctX?: number, pctY?: number) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          addDataUrlImageToBoard(reader.result, file.name, pctX, pctY);
        }
      };
      reader.readAsDataURL(file);
    },
    [addDataUrlImageToBoard]
  );

  const copyDataUrlToClipboard = useCallback(
    async (dataUrl: string, toastMsg = "Gambar disalin ke Clipboard (Ctrl+V)") => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Gagal memuat gambar"));
          img.src = dataUrl;
        });
        const offCanvas = document.createElement("canvas");
        offCanvas.width = img.naturalWidth || img.width || 600;
        offCanvas.height = img.naturalHeight || img.height || 400;
        const ctx = offCanvas.getContext("2d");
        if (!ctx) throw new Error("No 2D context");
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          offCanvas.toBlob((b) => resolve(b), "image/png")
        );
        if (blob && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showBoardClipboardToast(toastMsg);
          return;
        }
      } catch {
        // Fallback if ClipboardItem is restricted
      }
      try {
        await navigator.clipboard.writeText(dataUrl);
        showBoardClipboardToast(toastMsg);
      } catch {}
    },
    [showBoardClipboardToast]
  );

  const copySmartboardSnapshotToClipboard = useCallback(async () => {
    const boardEl = boardWorkspaceRef.current;
    if (!boardEl) return;
    const w = boardEl.clientWidth || 800;
    const h = boardEl.clientHeight || 600;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Background
    ctx.fillStyle = isProjectorMode ? "#0c101d" : isDark ? "#080a0f" : "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    // 2. Active 2D or 3D viewport
    if (
      activeModel === "2d_empty" ||
      activeModel === "2d_shape" ||
      activeModel === "2d_quadratic" ||
      activeModel === "2d_trig" ||
      activeModel === "2d_linear" ||
      activeModel === "2d_circle"
    ) {
      if (graph2DCanvasRef.current) {
        ctx.drawImage(graph2DCanvasRef.current, 0, 0, w, h);
      }
    } else if (activeModel !== "empty" && rendererRef.current && sceneRef.current && cameraRef.current) {
      try {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        ctx.drawImage(rendererRef.current.domElement, 0, 0, w, h);
      } catch {}
    }

    // 3. Pasted images on board
    for (const item of boardImages) {
      try {
        const img = new Image();
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = item.dataUrl;
        });
        if (img.naturalWidth > 0) {
          const aspect = img.naturalHeight / img.naturalWidth;
          const drawW = item.width;
          const drawH = drawW * aspect;
          const drawX = (item.x / 100) * w;
          const drawY = (item.y / 100) * h;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
      } catch {}
    }

    // 4. Freehand chalk drawings
    if (drawCanvasRef.current) {
      ctx.drawImage(drawCanvasRef.current, 0, 0, w, h);
    }

    const dataUrl = outCanvas.toDataURL("image/png");
    await copyDataUrlToClipboard(dataUrl, "Tangkapan gambar Papan Tulis disalin (Ctrl+V)");
  }, [activeModel, boardImages, copyDataUrlToClipboard, isDark, isProjectorMode]);

  const handleDeleteBoardImage = useCallback((id: string) => {
    setBoardImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedImageId((prev) => (prev === id ? null : prev));
  }, []);

  const handleImagePointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const boardEl = boardWorkspaceRef.current;
    if (!boardEl) return;
    const boardRect = boardEl.getBoundingClientRect();
    const imgItem = boardImages.find((i) => i.id === id);
    if (!imgItem) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPctX = imgItem.x;
    const startPctY = imgItem.y;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const dxPct = ((moveEvt.clientX - startClientX) / boardRect.width) * 100;
      const dyPct = ((moveEvt.clientY - startClientY) / boardRect.height) * 100;
      const nextX = Math.max(0, Math.min(88, startPctX + dxPct));
      const nextY = Math.max(0, Math.min(88, startPctY + dyPct));
      setBoardImages((prev) =>
        prev.map((item) => (item.id === id ? { ...item, x: nextX, y: nextY } : item))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleImageResizePointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const imgItem = boardImages.find((i) => i.id === id);
    if (!imgItem) return;

    const startClientX = e.clientX;
    const startWidth = imgItem.width;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const nextWidth = Math.max(80, Math.min(680, Math.round(startWidth + dx)));
      setBoardImages((prev) =>
        prev.map((item) => (item.id === id ? { ...item, width: nextWidth } : item))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // KaTeX Formula Composer Modal State
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [latexDraft, setLatexDraft] = useState("");
  const [formulaColor, setFormulaColor] = useState<"default" | "amber" | "emerald" | "blue" | "rose" | "purple">("default");
  const [formulaFontSize, setFormulaFontSize] = useState<"sm" | "base" | "lg" | "xl">("base");

  // Floating ZAP AI Copilot Assistant Widget State (Bottom-Right)
  const [isAiWidgetOpen, setIsAiWidgetOpen] = useState(false);
  const [copilotSeen, setCopilotSeen] = useState(false);
  const [aiWidgetInput, setAiWidgetInput] = useState("");
  const [aiWidgetFeedback, setAiWidgetFeedback] = useState<string | null>(null);

  // Computed selection state for formula notes
  const selectedNote = formulaNotes.find((n) => n.id === selectedFormulaId) || null;
  const selectedNoteIsMath = selectedNote
    ? selectedNote.kind
      ? selectedNote.kind === "math"
      : looksLikeMath(selectedNote.rawText || selectedNote.latex)
    : false;
  const selectedDetected = selectedNote ? detectMathTransform(selectedNote.rawText || selectedNote.latex) : null;

  // Kolaborasi realtime (papan bersama via WebSocket)
  type CollabPeer = { id: string; name: string; color: string };
  type CollabSeg = { kind?: string; x0?: number; y0?: number; x1?: number; y1?: number; color?: string; size?: number };
  type CollabState = { model?: string; solid?: string; plane?: string; a?: number; b?: number; c?: number; unit?: string; slice?: boolean };
  type CollabMsg = CollabState & { t?: string; id?: string; from?: string; color?: string; name?: string; x?: number; y?: number; peer?: CollabPeer; peers?: CollabPeer[]; strokes?: CollabSeg[]; notes?: BoardFormulaItem[]; state?: CollabState };
  const [collabRoom, setCollabRoom] = useState<string | null>(null);
  const [collabPeers, setCollabPeers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [myCollabId, setMyCollabId] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<string>("#f59e0b");
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number; name: string; color: string; ts: number }>>({});
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const collabRoomRef = useRef<string | null>(null);
  const myColorRef = useRef<string>("#f59e0b");
  const applyingRemoteNotesRef = useRef(false);
  const applyingRemoteStateRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const syncReadyRef = useRef(false);
  const collabHandlerRef = useRef<((msg: CollabMsg) => void) | null>(null);
  const isTypingToolActiveRef = useRef<boolean>(false);

  // Inline On-Canvas Composer (creates/edits directly where clicked on the canvas)
  const [inlineComposer, setInlineComposer] = useState<{
    x: number; // percentage
    y: number; // percentage
    text: string;
    id?: string;
  } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!inlineComposer) return;
    const raf = requestAnimationFrame(() => {
      inlineInputRef.current?.focus();
    });
    const timer = setTimeout(() => {
      inlineInputRef.current?.focus();
    }, 30);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [inlineComposer?.x, inlineComposer?.y, inlineComposer?.id]);

  // Drag selection marquee (lasso / drag to select components)
  const [selectionMarquee, setSelectionMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Formula input bar (legacy & synced with AI widget)
  const [formulaInput, setFormulaInput] = useState("");

  // 3D Three.js Refs
  const container3DRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Interactive corner handles for direct mouse drag resizing
  const cornerHandlesRef = useRef<THREE.Mesh[]>([]);
  const draggingVisualRef = useRef<THREE.Mesh | null>(null);
  const framingFactorRef = useRef(1);
  const selectedSolidRef = useRef(false);
  const selectionBoxRef = useRef<THREE.BoxHelper | null>(null);
  const isDraggingCornerRef = useRef<boolean>(false);
  const dragStartDataRef = useRef<{ clientX: number; clientY: number; initialParamA: number }>({
    clientX: 0,
    clientY: 0,
    initialParamA: 10,
  });
  const hoveredCornerRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseVecRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Render loop 3D yang bisa dihentikan/dilanjutkan tanpa membangun ulang
  // scene: start()/stop() dipasang oleh effect inisialisasi Three.js.
  const renderLoopControlRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  // True saat halaman sedang digulir (dipakai `pauseOnScroll`). Ref, bukan state,
  // supaya tidak memicu re-render di setiap awal/akhir gulir.
  const scrollRenderPausedRef = useRef(false);
  // Loop dijeda saat: diminta parent (paused), kanvas di luar viewport,
  // tab browser tidak terlihat, atau kanvas tidak sedang menampilkan mode 3D.
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [isCanvasInView, setIsCanvasInView] = useState(true);

  // 3D State
  const [autoRotate, setAutoRotate] = useState(Boolean(preview?.autoRotate));
  const [wireframe, setWireframe] = useState(false);
  const [solidKind, setSolidKind] = useState<SolidKind>(initialSolidKind || "kubus");
  const [showHandles, setShowHandles] = useState<boolean>(true);
  const showHandlesRef = useRef<boolean>(true);

  // Dynamic Math Parameters (A, B, C) & Unit (cm, m)
  const [paramA, setParamA] = useState(initialParamA !== undefined ? initialParamA : 10);
  const [paramB, setParamB] = useState(initialParamB !== undefined ? initialParamB : 6);
  const [paramC, setParamC] = useState(initialParamC !== undefined ? initialParamC : -3);
  const [unit, setUnit] = useState<string>(initialUnit || "cm");

  const paramARef = useRef<number>(paramA);
  const paramBRef = useRef<number>(paramB);
  const paramCRef = useRef<number>(paramC);
  const unitRef = useRef<string>(unit);
  const onParamsChangeRef = useRef(onParamsChange);
  const isDrawingToolActiveRef = useRef<boolean>(isDrawingToolActive);

  useEffect(() => {
    paramARef.current = paramA;
    paramBRef.current = paramB;
    paramCRef.current = paramC;
  }, [paramA, paramB, paramC]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useEffect(() => {
    onParamsChangeRef.current = onParamsChange;
  }, [onParamsChange]);

  useEffect(() => {
    isDrawingToolActiveRef.current = isDrawingToolActive;
  }, [isDrawingToolActive]);

  useEffect(() => {
    showHandlesRef.current = showHandles;
    cornerHandlesRef.current.forEach((h) => {
      h.visible = showHandles;
    });
    if (!showHandles && hoveredCornerRef.current) {
      hoveredCornerRef.current.scale.set(1, 1, 1);
      const m = hoveredCornerRef.current.material as THREE.MeshStandardMaterial;
      if (m && m.emissive) {
        m.emissive.setHex(0x38bdf8);
        m.emissiveIntensity = 0.4;
      }
      hoveredCornerRef.current = null;
    }
  }, [showHandles]);

  // Cutting plane: NOT on by default! Only active if user requests or toggles it
  const [showSlicePlane, setShowSlicePlane] = useState<boolean>(Boolean(initialShowSlice));
  const [sliceProgress, setSliceProgress] = useState(0.5);

  // HUD card minimize / hide feature
  const [isHudVisible, setIsHudVisible] = useState<boolean>(!hideHud);
  const [isHudMinimized, setIsHudMinimized] = useState<boolean>(false);

  // Ukuran ikon dock yang menyesuaikan lebar papan (agar tetap muat di panel sempit)
  const [dockBaseSize, setDockBaseSize] = useState(38);
  useEffect(() => {
    const el = boardWorkspaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) =>
      setDockBaseSize(width < 420 ? 30 : width < 520 ? 33 : width < 620 ? 35 : 38);
    apply(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveModel(initialModel);
    if (initialModel === "2d_shape" && initialPlaneShapeKind) {
      setPlaneShapeKind(initialPlaneShapeKind);
      onPlaneShapeChange?.(initialPlaneShapeKind);
      const label =
        initialPlaneShapeKind === "jaring_prisma"
          ? "Jaring Prisma 2D"
          : initialPlaneShapeKind === "jaring_kubus"
          ? "Jaring Kubus 2D"
          : initialPlaneShapeKind === "jaring_limas"
          ? "Jaring Limas 2D"
          : initialPlaneShapeKind === "persegi_panjang"
          ? "Persegi Panjang 2D"
          : initialPlaneShapeKind === "persegi"
          ? "Persegi 2D"
          : initialPlaneShapeKind === "segitiga"
          ? "Segitiga 2D"
          : initialPlaneShapeKind === "lingkaran"
          ? "Lingkaran 2D"
          : initialPlaneShapeKind === "jajar_genjang"
          ? "Jajar Genjang 2D"
          : initialPlaneShapeKind === "trapesium"
          ? "Trapesium 2D"
          : initialPlaneShapeKind;
      setFormulaInput(`${label} ${initialParamA || 10}${initialUnit || "cm"}`);
    } else if (initialSolidKind) {
      setSolidKind(initialSolidKind);
      onSolidKindChange?.(initialSolidKind);
      if (SOLID_LABELS[initialSolidKind]) {
        setFormulaInput(`${SOLID_LABELS[initialSolidKind]} ${initialParamA || 10}${initialUnit || "cm"}`);
      }
    }
  }, [initialModel, initialSolidKind, initialPlaneShapeKind, initialParamA, initialUnit, onSolidKindChange, onPlaneShapeChange]);

  useEffect(() => {
    if (initialParamA !== undefined) setParamA(initialParamA);
    if (initialParamB !== undefined) setParamB(initialParamB);
    if (initialParamC !== undefined) setParamC(initialParamC);
    if (initialUnit) setUnit(initialUnit);
    if (initialShowSlice !== undefined) setShowSlicePlane(initialShowSlice);
  }, [initialParamA, initialParamB, initialParamC, initialUnit, initialShowSlice]);

  // Memori model terakhir per tab agar objek di 3D / 2D / Papan tidak hilang saat berpindah tab
  const last3DModelRef = useRef<MathModelType>(
    initialModel && initialModel !== "empty" && initialModel !== "2d_empty" && !initialModel.startsWith("2d_")
      ? initialModel
      : "3d_empty"
  );
  const last2DModelRef = useRef<MathModelType>(
    initialModel && (initialModel === "2d_empty" || initialModel.startsWith("2d_"))
      ? initialModel
      : "2d_empty"
  );

  const selectModel = useCallback(
    (model: MathModelType) => {
      setActiveModel(model);
      if (
        model === "solids" ||
        model === "cylinder" ||
        model === "conic_slicer" ||
        model === "saddle" ||
        model === "counting_blocks" ||
        model === "parabola" ||
        model === "surface" ||
        model === "3d_empty"
      ) {
        last3DModelRef.current = model;
      } else if (
        model === "2d_shape" ||
        model === "2d_quadratic" ||
        model === "2d_linear" ||
        model === "2d_circle" ||
        model === "2d_trig" ||
        model === "2d_empty"
      ) {
        last2DModelRef.current = model;
      }
      onModelChange?.(model);
    },
    [onModelChange]
  );

  // Pratinjau landing: ganti scene (model + parameter) saat prop berubah.
  // Parameter ikut diset agar kubus 6 cm dan kurva y = x² − 3 tetap benar.
  const previewScene = preview?.scene;
  useEffect(() => {
    if (!previewScene) return;
    if (previewScene.solidKind) setSolidKind(previewScene.solidKind);
    if (previewScene.a !== undefined) setParamA(previewScene.a);
    if (previewScene.b !== undefined) setParamB(previewScene.b);
    if (previewScene.c !== undefined) setParamC(previewScene.c);
    selectModel(previewScene.model);
  }, [previewScene, selectModel]);

  // =========================================================================
  // 1. FREEHAND DRAWING CANVAS (CORET-CORET)
  // =========================================================================
  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawings(false);
  };

  // =========================================================================
  // KOLABORASI PAPAN REALTIME: coretan, catatan, bangun, dan kursor bersama
  // =========================================================================
  const collabSend = (obj: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(obj)); } catch { /* abaikan */ }
    }
  };

  const clearBoardShared = () => {
    clearDrawCanvas();
    if (collabRoomRef.current) collabSend({ t: "clear" });
  };

  const drawRemoteSegment = (seg: CollabSeg) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    if (seg.kind === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc((seg.x1 ?? 0) * w, (seg.y1 ?? 0) * h, ((seg.size || 0.05) * w) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = seg.color || "#f8fafc";
      ctx.lineWidth = Math.max(1, (seg.size || 0.004) * w);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo((seg.x0 ?? 0) * w, (seg.y0 ?? 0) * h);
      ctx.lineTo((seg.x1 ?? 0) * w, (seg.y1 ?? 0) * h);
      ctx.stroke();
    }
    ctx.restore();
    setHasDrawings(true);
  };

  const applyRemoteState = (msg: CollabState) => {
    applyingRemoteStateRef.current = true;
    if (msg.model) selectModel(msg.model as MathModelType);
    if (msg.solid) { setSolidKind(msg.solid as SolidKind); onSolidKindChange?.(msg.solid as SolidKind); }
    if (msg.plane) { setPlaneShapeKind(msg.plane as PlaneShapeKind); onPlaneShapeChange?.(msg.plane as PlaneShapeKind); }
    if (typeof msg.a === "number") setParamA(msg.a);
    if (typeof msg.b === "number") setParamB(msg.b);
    if (typeof msg.c === "number") setParamC(msg.c);
    if (msg.unit) setUnit(msg.unit as string);
    if (typeof msg.slice === "boolean") setShowSlicePlane(msg.slice);
    // Samakan state halaman agar bila kanvas dirakit ulang (ganti bangun), nilai remote tidak tertimpa nilai lama
    const a2 = typeof msg.a === "number" ? msg.a : paramARef.current;
    const b2 = typeof msg.b === "number" ? msg.b : paramBRef.current;
    const c2 = typeof msg.c === "number" ? msg.c : paramCRef.current;
    onParamsChange?.(a2, b2, c2, msg.unit);
    setTimeout(() => { applyingRemoteStateRef.current = false; }, 400);
  };

  const handleCollabMessage = (msg: CollabMsg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.t) {
      case "welcome": {
        setMyCollabId(msg.id ?? null);
        myColorRef.current = msg.color || "#f59e0b";
        setMyColor(msg.color || "#f59e0b");
        setCollabPeers(Array.isArray(msg.peers) ? msg.peers : []);
        if (Array.isArray(msg.strokes)) msg.strokes.forEach((s) => drawRemoteSegment(s));
        if (Array.isArray(msg.notes) && msg.notes.length > 0) {
          applyingRemoteNotesRef.current = true;
          setFormulaNotes(msg.notes);
          setTimeout(() => { applyingRemoteNotesRef.current = false; }, 400);
        }
        if (msg.state) applyRemoteState(msg.state);
        break;
      }
      case "join": {
        if (msg.peer) setCollabPeers((prev) => [...prev.filter((p) => p.id !== msg.peer!.id), msg.peer!]);
        // Anggota lama mendorong keadaan papan terkini agar pendatang langsung melihat bangun + catatan yang sama
        setTimeout(() => {
          if (collabRoomRef.current) {
            collabSend({ t: "notes", notes: formulaNotes });
            collabSend({ t: "state", model: activeModel, solid: solidKind, plane: planeShapeKind, a: paramA, b: paramB, c: paramC, unit, slice: showSlicePlane });
          }
        }, 350);
        break;
      }
      case "leave": {
        const lid = msg.id;
        setCollabPeers((prev) => prev.filter((p) => p.id !== lid));
        if (lid) setRemoteCursors((prev) => { const n = { ...prev }; delete n[lid]; return n; });
        break;
      }
      case "seg":
        drawRemoteSegment(msg);
        break;
      case "clear":
        clearDrawCanvas();
        break;
      case "notes":
        applyingRemoteNotesRef.current = true;
        setFormulaNotes(msg.notes || []);
        setTimeout(() => { applyingRemoteNotesRef.current = false; }, 400);
        break;
      case "state":
        applyRemoteState(msg);
        break;
      case "cursor": {
        const fid = msg.from;
        if (fid) {
          setRemoteCursors((prev) => ({
            ...prev,
            [fid]: { x: msg.x ?? 0, y: msg.y ?? 0, name: msg.name || "Tamu", color: msg.color || "#f59e0b", ts: Date.now() },
          }));
        }
        break;
      }
    }
  };
  collabHandlerRef.current = handleCollabMessage;

  const disconnectBoard = () => {
    if (wsRef.current) {
      try { wsRef.current.onclose = null; wsRef.current.close(); } catch { /* abaikan */ }
      wsRef.current = null;
    }
    collabRoomRef.current = null;
    setCollabRoom(null);
    setCollabPeers([]);
    setRemoteCursors({});
    setMyCollabId(null);
    try { sessionStorage.removeItem("zap_board_code"); } catch { /* abaikan */ }
  };

  const connectBoard = (roomRaw: string) => {
    const room = roomRaw.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
    if (!room) return;
    disconnectBoard();
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const wsBase = base.replace(/^http/, "ws");
    const name = (collabName || "Tamu").slice(0, 24);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase}/api/v1/board/${room}?name=${encodeURIComponent(name)}`);
    } catch { return; }
    wsRef.current = ws;
    collabRoomRef.current = room;
    setCollabRoom(room);
    try {
      const u = new URL(window.location.href);
      u.hash = `board=${room}`;
      window.history.replaceState(null, "", u.toString());
    } catch { /* abaikan */ }
    ws.onmessage = (ev) => {
      try { collabHandlerRef.current?.(JSON.parse(ev.data)); } catch { /* abaikan */ }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        collabRoomRef.current = null;
        setCollabRoom(null);
        setCollabPeers([]);
        setRemoteCursors({});
      }
    };
  };

  const genBoardCode = () =>
    Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingToolActive) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setPointerPos({ x, y });

    ctx.save();
    if (drawingMode === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    setHasDrawings(true);
    lastPointRef.current = { x, y };
    if (collabRoomRef.current) {
      const rw = rect.width || 1;
      const rh = rect.height || 1;
      if (drawingMode === "pen") {
        collabSend({ t: "seg", kind: "pen", x0: x / rw, y0: y / rh, x1: x / rw, y1: y / rh, color: drawColor, size: brushSize / rw });
      } else {
        collabSend({ t: "seg", kind: "erase", x1: x / rw, y1: y / rh, size: eraserSize / rw });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPointerPos({ x, y });

    if (!isDrawing || !isDrawingToolActive) return;
    if (collabRoomRef.current && lastPointRef.current) {
      const rw = rect.width || 1;
      const rh = rect.height || 1;
      if (drawingMode === "pen") {
        collabSend({ t: "seg", kind: "pen", x0: lastPointRef.current.x / rw, y0: lastPointRef.current.y / rh, x1: x / rw, y1: y / rh, color: drawColor, size: brushSize / rw });
      } else {
        collabSend({ t: "seg", kind: "erase", x1: x / rw, y1: y / rh, size: eraserSize / rw });
      }
    }
    lastPointRef.current = { x, y };
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    if (drawingMode === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handlePointerLeave = () => {
    setIsDrawing(false);
    setPointerPos(null);
  };

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const syncSize = () => {
      if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        const ctx = canvas.getContext("2d");
        if (ctx && tempCanvas.width > 0) {
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Cerminkan status alat ketik ke ref untuk handler kanvas 3D
  useEffect(() => {
    isTypingToolActiveRef.current = isTypingToolActive;
  }, [isTypingToolActive]);

  // Sinkronisasi catatan rumus ke ruang kolaborasi
  useEffect(() => {
    if (!syncReadyRef.current || applyingRemoteNotesRef.current) return;
    if (collabRoomRef.current) collabSend({ t: "notes", notes: formulaNotes });
  }, [formulaNotes]);

  // Sinkronisasi bangun + parameter ke ruang kolaborasi
  useEffect(() => {
    if (!syncReadyRef.current || applyingRemoteStateRef.current) return;
    if (collabRoomRef.current) {
      collabSend({ t: "state", model: activeModel, solid: solidKind, plane: planeShapeKind, a: paramA, b: paramB, c: paramC, unit, slice: showSlicePlane });
    }
  }, [activeModel, solidKind, planeShapeKind, paramA, paramB, paramC, unit, showSlicePlane]);

  // Siapkan sinkronisasi, gabung otomatis dari tautan #board=KODE, bersihkan kursor basi
  useEffect(() => {
    syncReadyRef.current = true;
    const m = window.location.hash.match(/board=([A-Za-z0-9_-]{3,24})/);
    let code = m ? m[1] : undefined;
    if (!code) {
      try { code = sessionStorage.getItem("zap_board_code") || undefined; } catch { /* abaikan */ }
    }
    if (code) connectBoard(code);
    const cursorTimer = window.setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now();
        const keys = Object.keys(prev);
        if (!keys.some((k) => now - prev[k].ts >= 4000)) return prev;
        const next: typeof prev = {};
        keys.forEach((k) => { if (now - prev[k].ts < 4000) next[k] = prev[k]; });
        return next;
      });
    }, 2000);
    return () => {
      window.clearInterval(cursorTimer);
      disconnectBoard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pancarkan posisi kursor sendiri ke kolaborator (maks ~20x/detik)
  useEffect(() => {
    const el = boardWorkspaceRef.current;
    if (!el) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      if (!collabRoomRef.current) return;
      const now = performance.now();
      if (now - last < 50) return;
      last = now;
      const rect = el.getBoundingClientRect();
      collabSend({ t: "cursor", x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, name: collabName || "Tamu", color: myColorRef.current });
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [collabName]);

  // Keyboard & Clipboard untuk catatan / gambar di Smartboard:
  // - Delete / Backspace menghapus catatan atau gambar terpilih
  // - Esc melepas pilihan
  // - Ctrl+C / Cmd+C menyalin gambar terpilih atau tangkapan layar Smartboard ke clipboard
  // - Ctrl+V / Cmd+V menempelkan gambar dari clipboard langsung ke Smartboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inlineComposer) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedImageId) {
          e.preventDefault();
          handleDeleteBoardImage(selectedImageId);
          return;
        }
        if (selectedFormulaId) {
          e.preventDefault();
          handleDeleteFormula(selectedFormulaId);
          return;
        }
      }

      if (e.key === "Escape") {
        setSelectedFormulaId(null);
        setSelectedImageId(null);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) return;
        if (selectedImageId) {
          const imgItem = boardImages.find((img) => img.id === selectedImageId);
          if (imgItem) {
            e.preventDefault();
            void copyDataUrlToClipboard(imgItem.dataUrl, "Gambar terpilih disalin ke Clipboard (Ctrl+V)");
          }
        } else {
          e.preventDefault();
          void copySmartboardSnapshotToClipboard();
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      // Jika fokus sedang di kolom chat textarea atau input teks biasa, biarkan handler input/chat yang menangani
      if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT" || activeEl.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            addImageFileToBoard(file);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    selectedFormulaId,
    selectedImageId,
    inlineComposer,
    boardImages,
    handleDeleteBoardImage,
    copyDataUrlToClipboard,
    copySmartboardSnapshotToClipboard,
    addImageFileToBoard,
  ]);

  // =========================================================================
  // 2. PARSE FORMULA OR TEXT QUERY -> AUTOMATIC 2D/3D GENERATION
  // =========================================================================
  const handleSynthesizeFormula = (inputQuery: string) => {
    const raw = (inputQuery || formulaInput).toLowerCase().trim();
    if (!raw) return;

    // Check if user specifically requests slicing / irisan
    const wantsSlice = /\b(irisan|potong|penampang|slice|belah|potongan)\b/i.test(raw);
    const is2DRequested = /\b(2d|2-d|dua dimensi|jaring|jaring-jaring|net|bangun datar)\b/i.test(raw);

    // Parse dimensions & unit (e.g. "10cm", "10 cm", "r=7")
    const numMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(cm|m|mm|in)?/i);
    const parsedA = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : undefined;
    const parsedUnit = numMatch ? (numMatch[2] || "cm") : "cm";

    // 2D Nets (Jaring-jaring bangun ruang jika diminta dalam format 2D)
    if (is2DRequested && (raw.includes("prisma") || raw.includes("prism"))) {
      const s = parsedA || 8;
      const t = 10;
      setParamA(s);
      setParamB(t);
      setUnit(parsedUnit);
      setPlaneShapeKind("jaring_prisma");
      selectModel("2d_shape");
      onPlaneShapeChange?.("jaring_prisma");
      onParamsChange?.(s, t, paramC, parsedUnit);
      return;
    }

    if (is2DRequested && (raw.includes("kubus") || raw.includes("cube"))) {
      const s = parsedA || 10;
      setParamA(s);
      setUnit(parsedUnit);
      setPlaneShapeKind("jaring_kubus");
      selectModel("2d_shape");
      onPlaneShapeChange?.("jaring_kubus");
      onParamsChange?.(s, paramB, paramC, parsedUnit);
      return;
    }

    if (is2DRequested && (raw.includes("limas") || raw.includes("piramid") || raw.includes("pyramid"))) {
      const s = parsedA || 8;
      const t = 10;
      setParamA(s);
      setParamB(t);
      setUnit(parsedUnit);
      setPlaneShapeKind("jaring_limas");
      selectModel("2d_shape");
      onPlaneShapeChange?.("jaring_limas");
      onParamsChange?.(s, t, paramC, parsedUnit);
      return;
    }

    // Detect 2D Plane Geometry Shapes (Jajar Genjang, Trapesium, Segitiga, etc.)
    if (raw.includes("jajar genjang") || raw.includes("jajargenjang") || raw.includes("parallelogram")) {
      const a = parsedA || 12;
      setParamA(a);
      setParamB(8); // tinggi t
      setParamC(10); // sisi miring s
      setUnit(parsedUnit);
      setPlaneShapeKind("jajar_genjang");
      selectModel("2d_shape");
      onPlaneShapeChange?.("jajar_genjang");
      onParamsChange?.(a, 8, 10, parsedUnit);
      return;
    }

    if (raw.includes("trapesium") || raw.includes("trapezoid")) {
      const a = parsedA || 8;
      setParamA(a);
      setParamB(14); // b
      setParamC(6); // t
      setUnit(parsedUnit);
      setPlaneShapeKind("trapesium");
      selectModel("2d_shape");
      onPlaneShapeChange?.("trapesium");
      onParamsChange?.(a, 14, 6, parsedUnit);
      return;
    }

    if (raw.includes("segitiga") || raw.includes("triangle")) {
      const a = parsedA || 10;
      setParamA(a);
      setParamB(8); // t
      setUnit(parsedUnit);
      setPlaneShapeKind("segitiga");
      selectModel("2d_shape");
      onPlaneShapeChange?.("segitiga");
      onParamsChange?.(a, 8, paramC, parsedUnit);
      return;
    }

    if (raw.includes("lingkaran") || raw.includes("circle")) {
      const r = parsedA || 7;
      setParamA(r);
      setUnit(parsedUnit);
      setPlaneShapeKind("lingkaran");
      selectModel("2d_shape");
      onPlaneShapeChange?.("lingkaran");
      onParamsChange?.(r, paramB, paramC, parsedUnit);
      return;
    }

    if (raw.includes("belah ketupat") || raw.includes("belahketupat") || raw.includes("rhombus")) {
      const numbers = (raw.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
      const d1 = numbers[0] || 12;
      const d2 = numbers[1] || 16;
      setParamA(d1);
      setParamB(d2);
      setUnit(parsedUnit);
      setPlaneShapeKind("belah_ketupat");
      selectModel("2d_shape");
      onPlaneShapeChange?.("belah_ketupat");
      onParamsChange?.(d1, d2, paramC, parsedUnit);
      return;
    }

    if (raw.includes("layang layang") || raw.includes("layang-layang") || raw.includes("layanglayang") || raw.includes("kite")) {
      const numbers = (raw.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
      const d1 = numbers[0] || 12;
      const d2 = numbers[1] || 16;
      setParamA(d1);
      setParamB(d2);
      setUnit(parsedUnit);
      setPlaneShapeKind("layang_layang");
      selectModel("2d_shape");
      onPlaneShapeChange?.("layang_layang");
      onParamsChange?.(d1, d2, paramC, parsedUnit);
      return;
    }

    if (/(segienam|segi enam|segi-6|hexagon|heksagon)/i.test(raw) && is2DRequested) {
      const s = parsedA || 10;
      setParamA(s);
      setUnit(parsedUnit);
      setPlaneShapeKind("segienam");
      selectModel("2d_shape");
      onPlaneShapeChange?.("segienam");
      onParamsChange?.(s, paramB, paramC, parsedUnit);
      return;
    }

    if (/(segilima|segi lima|segi-5|pentagon)/i.test(raw) && is2DRequested) {
      const s = parsedA || 10;
      setParamA(s);
      setUnit(parsedUnit);
      setPlaneShapeKind("segilima");
      selectModel("2d_shape");
      onPlaneShapeChange?.("segilima");
      onParamsChange?.(s, paramB, paramC, parsedUnit);
      return;
    }

    if (raw.includes("persegi panjang") || raw.includes("persegipanjang") || raw.includes("rectangle")) {
      const numbers = (raw.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
      const p = numbers[0] || 14;
      const l = numbers[1] || 8;
      setParamA(p);
      setParamB(l);
      setUnit(parsedUnit);
      setPlaneShapeKind("persegi_panjang");
      selectModel("2d_shape");
      onPlaneShapeChange?.("persegi_panjang");
      onParamsChange?.(p, l, paramC, parsedUnit);
      return;
    }

    if (raw.includes("persegi") || raw.includes("bujur sangkar") || raw.includes("square")) {
      const s = parsedA || 10;
      setParamA(s);
      setUnit(parsedUnit);
      setPlaneShapeKind("persegi");
      selectModel("2d_shape");
      onPlaneShapeChange?.("persegi");
      onParamsChange?.(s, paramB, paramC, parsedUnit);
      return;
    }

    // Detect 2D quadratic / parabola
    if (raw.includes("x^2") || raw.includes("x²") || raw.includes("kuadrat") || raw.includes("parabola")) {
      if (raw.includes("- 3") || raw.includes("-3")) {
        setParamA(1);
        setParamB(0);
        setParamC(-3);
      } else if (raw.includes("+ 3") || raw.includes("+3")) {
        setParamA(1);
        setParamB(0);
        setParamC(3);
      } else {
        setParamA(1);
        setParamB(0);
        setParamC(0);
      }
      selectModel("2d_quadratic");
      return;
    }

    // Detect 2D Trigonometry
    if (raw.includes("sin") || raw.includes("cos") || raw.includes("gelombang") || raw.includes("trig")) {
      setParamA(2);
      setParamB(1);
      setParamC(0);
      selectModel("2d_trig");
      return;
    }

    // Detect 2D Linear
    if (raw.includes("2x") || raw.includes("mx") || raw.includes("linear") || raw.includes("garis")) {
      setParamA(2);
      setParamB(1);
      selectModel("2d_linear");
      return;
    }

    // Detect 3D Shapes
    if (raw.includes("kubus") || raw.includes("cube")) {
      const size = parsedA || 10;
      setParamA(size);
      setUnit(parsedUnit);
      setSolidKind("kubus");
      setShowSlicePlane(wantsSlice);
      selectModel("solids");
      onParamsChange?.(size, paramB, paramC, parsedUnit);
      return;
    }

    if (raw.includes("balok") || raw.includes("beam") || raw.includes("persegi panjang 3d") || raw.includes("cuboid")) {
      const numbers = (raw.match(/\d+(?:[.,]\d+)?/g) || []).map((m) => parseFloat(m.replace(",", ".")));
      const p = numbers[0] || 10;
      const l = numbers[1] || 6;
      const t_val = numbers[2] || 4;
      setParamA(p);
      setParamB(l);
      setParamC(t_val);
      setUnit(parsedUnit);
      setSolidKind("balok");
      setShowSlicePlane(wantsSlice);
      selectModel("solids");
      onParamsChange?.(p, l, t_val, parsedUnit);
      return;
    }

    if (raw.includes("tabung") || raw.includes("cylinder") || raw.includes("silinder")) {
      const r = parsedA || 7;
      setParamA(r);
      setParamB(12);
      setUnit(parsedUnit);
      selectModel("cylinder");
      onParamsChange?.(r, 12, paramC, parsedUnit);
      return;
    }

    if (raw.includes("kerucut") || raw.includes("cone") || raw.includes("irisan kerucut")) {
      selectModel("conic_slicer");
      setShowSlicePlane(true);
      return;
    }

    // Ekstraksi jumlah sisi poligon dari teks mentah (dipakai semua cabang di bawah)
    const segiN = (() => {
      const d = raw.match(/(?:^|[^a-z])segi[\s-]?(\d{1,3})\b/i);
      if (d) return parseInt(d[1], 10);
      const named: Array<[RegExp, number]> = [
        [/segitiga/, 3], [/segiempat/, 4], [/segilima/, 5], [/segienam/, 6],
        [/segitujuh/, 7], [/segidelapan/, 8], [/segisembilan/, 9], [/segisepuluh/, 10],
        [/\bhexagon\b|\bheksagon\b/, 6], [/\bpentagon\b/, 5], [/\boctagon\b|\boktagon\b/, 8], [/\bheptagon\b/, 7],
      ];
      for (const [re, n] of named) if (re.test(raw)) return n;
      return null;
    })();

    // Keluarga LIMAS diproses PALING DULU: "piramida segi enam" adalah limas, bukan prisma segienam
    if (raw.includes("limas") || raw.includes("piramida") || raw.includes("piramid") || raw.includes("pyramid")) {
      const s = parsedA || 8;
      const t = 10;
      const n = segiN ?? 4;
      setParamA(s);
      setParamB(t);
      setUnit(parsedUnit);
      if (n === 4) {
        setSolidKind("limas");
        onParamsChange?.(s, t, paramC, parsedUnit);
      } else {
        setParamC(n);
        setSolidKind("limas_poligon");
        onParamsChange?.(s, t, n, parsedUnit);
      }
      setShowSlicePlane(wantsSlice);
      selectModel("solids");
      return;
    }

    if (segiN !== null) {
      const p = parsedA || 8;
      const t = 10;
      setParamA(p);
      setParamB(t);
      setUnit(parsedUnit);
      if (segiN === 5) {
        setSolidKind("prisma_segilima");
        onParamsChange?.(p, t, paramC, parsedUnit);
      } else if (segiN === 6) {
        setSolidKind("prisma_segienam");
        onParamsChange?.(p, t, paramC, parsedUnit);
      } else if (segiN === 3) {
        setSolidKind("prisma");
        onParamsChange?.(p, t, paramC, parsedUnit);
      } else {
        setParamC(segiN);
        setSolidKind("prisma_poligon");
        onParamsChange?.(p, t, segiN, parsedUnit);
      }
      setShowSlicePlane(wantsSlice);
      selectModel("solids");
      return;
    }

    if (raw.includes("prisma") || raw.includes("prism")) {
      const p = parsedA || 8;
      const t = 10;
      setParamA(p);
      setParamB(t);
      setUnit(parsedUnit);
      setSolidKind("prisma");
      setShowSlicePlane(wantsSlice);
      selectModel("solids");
      onParamsChange?.(p, t, paramC, parsedUnit);
      return;
    }

    if (raw.includes("bola") || raw.includes("sphere")) {
      const diameterMatch = raw.match(/diameter\s*(?:=|:|\s)?\s*(\d+(?:[.,]\d+)?)/i);
      let r = parsedA || 7;
      if (diameterMatch) {
        r = parseFloat(diameterMatch[1].replace(",", ".")) / 2;
      }
      setParamA(r);
      setUnit(parsedUnit);
      setSolidKind("bola");
      setShowSlicePlane(false);
      selectModel("solids");
      onParamsChange?.(r, paramB, paramC, parsedUnit);
      return;
    }

    if (raw.includes("pelana") || raw.includes("saddle")) {
      selectModel("saddle");
      return;
    }

    // Default to 3D Solids
    setSolidKind("kubus");
    setShowSlicePlane(wantsSlice);
    selectModel("solids");
  };

  // =========================================================================
  // 3. ZAP AI COPILOT & KATEX FORMULA ANNOTATION HANDLERS
  // =========================================================================
  const triggerAiSynthesize = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    handleSynthesizeFormula(trimmed);
    setFormulaInput(trimmed);
    setAiWidgetFeedback(`Berhasil membuat: "${trimmed}"`);
    setTimeout(() => {
      setAiWidgetFeedback(null);
      setIsAiWidgetOpen(false);
    }, 1200);
  };

  const handleFormulaPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const boardEl = boardWorkspaceRef.current;
    if (!boardEl) return;
    const boardRect = boardEl.getBoundingClientRect();

    const note = formulaNotes.find((n) => n.id === id);
    if (!note) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPercentX = note.x;
    const startPercentY = note.y;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = moveEvt.clientX - startClientX;
      const deltaY = moveEvt.clientY - startClientY;
      const deltaPercentX = (deltaX / boardRect.width) * 100;
      const deltaPercentY = (deltaY / boardRect.height) * 100;

      const newX = Math.max(1, Math.min(85, startPercentX + deltaPercentX));
      const newY = Math.max(1, Math.min(85, startPercentY + deltaPercentY));

      setFormulaNotes((prev) =>
        prev.map((item) => (item.id === id ? { ...item, x: newX, y: newY } : item))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleOpenNewFormula = () => {
    setEditingFormulaId(null);
    setLatexDraft("");
    setFormulaColor("default");
    setFormulaFontSize("base");
    setIsFormulaModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleOpenEditFormula = (note: BoardFormulaItem) => {
    setEditingFormulaId(note.id);
    setLatexDraft(note.latex);
    setFormulaColor(note.color || "default");
    setFormulaFontSize(note.fontSize || "base");
    setIsFormulaModalOpen(true);
  };

  const handleDeleteFormula = (id: string) => {
    setFormulaNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSaveFormula = () => {
    const trimmed = latexDraft.trim();
    if (!trimmed) return;
    if (editingFormulaId) {
      setFormulaNotes((prev) =>
        prev.map((item) =>
          item.id === editingFormulaId
            ? {
                ...item,
                latex: trimmed,
                color: formulaColor,
                fontSize: formulaFontSize,
              }
            : item
        )
      );
    } else {
      const offsetIndex = formulaNotes.length % 5;
      const newNote: BoardFormulaItem = {
        id: `formula_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        latex: trimmed,
        x: 8 + offsetIndex * 5,
        y: 12 + offsetIndex * 12,
        color: formulaColor,
        fontSize: formulaFontSize,
      };
      setFormulaNotes((prev) => [...prev, newNote]);
    }
    setIsFormulaModalOpen(false);
    setLatexDraft("");
    setEditingFormulaId(null);
  };

  const handleInsertSymbol = (symbolStr: string) => {
    setLatexDraft((prev) => (prev ? `${prev} ${symbolStr}` : symbolStr));
  };

  // =========================================================================
  // ON-CANVAS COMPONENT TRANSFORMATION (TO 2D GRAPH, 3D SOLID, OR 2D NET)
  // =========================================================================
  const handleTransformToGraph = (expr: string) => {
    const raw = expr.toLowerCase();
    if (raw.includes("sin") || raw.includes("cos")) {
      const numMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:\\sin|sin)/i);
      const amp = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : 2;
      setParamA(amp);
      setParamB(1);
      selectModel("2d_trig");
    } else if (raw.includes("x^2") || raw.includes("x²") || raw.includes("parabola") || raw.includes("kuadrat")) {
      let cVal = -3;
      if (raw.includes("- 3") || raw.includes("-3")) cVal = -3;
      else if (raw.includes("+ 3") || raw.includes("+3")) cVal = 3;
      else {
        const cMatch = raw.match(/([+-]\s*\d+(?:[.,]\d+)?)\s*$/);
        if (cMatch) cVal = parseFloat(cMatch[1].replace(/\s+/g, "").replace(",", "."));
      }
      setParamA(1);
      setParamB(0);
      setParamC(cVal);
      selectModel("2d_quadratic");
    } else {
      setParamA(2);
      setParamB(1);
      selectModel("2d_linear");
    }
  };

  const handleTransformTo3D = (expr: string) => {
    const raw = expr.toLowerCase().trim();
    const hasSolidWord = /\b(kubus|cube|balok|cuboid|prisma|prism|limas|pyramid|piramid|tabung|cylinder|silinder|kerucut|cone|bola|sphere|pelana|saddle)\b/i.test(raw);
    if (!hasSolidWord && (raw.includes("x^2") || raw.includes("x²") || raw.includes("parabola") || raw.includes("kuadrat"))) {
      selectModel("parabola");
      return;
    }
    if (!hasSolidWord && (raw.includes("sin") || raw.includes("cos") || raw.includes("z =") || raw.includes("f(x"))) {
      selectModel("saddle");
      return;
    }
    const cleaned = expr.replace(/\b(2d|2-d|dua dimensi|jaring-jaring|jaring|net)\b/gi, "").trim() || expr;
    handleSynthesizeFormula(cleaned);
  };

  const handleTransformTo2D = (expr: string) => {
    const raw = expr.toLowerCase().trim();
    const isShapeOrSolid = /\b(kubus|cube|balok|cuboid|prisma|prism|limas|pyramid|piramid|tabung|cylinder|kerucut|cone|bola|sphere|jajar\s*genjang|jajargenjang|trapesium|segitiga|persegi|lingkaran|circle|jaring)\b/i.test(raw);
    if (isShapeOrSolid) {
      if (/\b(bola|sphere|tabung|cylinder|kerucut|cone)\b/i.test(raw) && !raw.includes("lingkaran")) {
        handleSynthesizeFormula(`lingkaran ${expr}`);
        return;
      }
      if (/\b(balok|cuboid)\b/i.test(raw)) {
        handleSynthesizeFormula(`persegi panjang ${expr}`);
        return;
      }
      handleSynthesizeFormula(`${expr} 2d`);
      return;
    }
    handleTransformToGraph(expr);
  };

  const commitInlineComposer = () => {
    if (!inlineComposer || !inlineComposer.text.trim()) {
      setInlineComposer(null);
      setIsTypingToolActive(false);
      return;
    }
    const raw = inlineComposer.text.trim();
    const formattedLatex = autoFormatToLatex(raw);

    if (inlineComposer.id) {
      setFormulaNotes((prev) =>
        prev.map((item) =>
          item.id === inlineComposer.id
            ? { ...item, latex: formattedLatex, rawText: raw, kind: item.kind || "text" }
            : item
        )
      );
      setSelectedFormulaId(inlineComposer.id);
    } else {
      const newId = `formula_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newNote: BoardFormulaItem = {
        id: newId,
        latex: formattedLatex,
        rawText: raw,
        x: Math.max(2, Math.min(82, inlineComposer.x)),
        y: Math.max(2, Math.min(82, inlineComposer.y)),
        color: "default",
        fontSize: "base",
        kind: "text",
      };
      setFormulaNotes((prev) => [...prev, newNote]);
      setSelectedFormulaId(newId);
    }
    setInlineComposer(null);
    setIsTypingToolActive(false);
  };

  // =========================================================================
  // 3. 2D CARTESIAN & PLANE GEOMETRY VIEW (JAJAR GENJANG, TRAPESIUM, SEGITIGA)
  // =========================================================================
  const is2DGraphModel =
    activeModel === "2d_empty" ||
    activeModel === "2d_shape" ||
    activeModel === "2d_quadratic" ||
    activeModel === "2d_trig" ||
    activeModel === "2d_linear" ||
    activeModel === "2d_circle";

  useEffect(() => {
    if (!is2DGraphModel) return;
    const canvas = graph2DCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const baseScale = Math.min(width, height) / 18;
    const scale = baseScale * zoom2D;
    const originX = width / 2 + pan2D.x;
    const originY = height / 2 + pan2D.y;

    ctx.fillStyle = isProjectorMode ? "#0c101d" : isDark ? "#080a0f" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const isCartesianGraph = activeModel !== "2d_shape";

    if (isCartesianGraph) {
      // 1. Grid lines kartesius untuk fungsi aljabar (parabola, trig, linear)
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(148, 163, 184, 0.25)";
      const minX = -Math.ceil(originX / scale);
      const maxX = Math.ceil((width - originX) / scale);
      const minY = -Math.ceil((height - originY) / scale);
      const maxY = Math.ceil(originY / scale);

      for (let x = minX; x <= maxX; x++) {
        const cx = originX + x * scale;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
      }
      for (let y = minY; y <= maxY; y++) {
        const cy = originY - y * scale;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();
      }

      // Sumbu X dan Y
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(100, 116, 139, 0.4)";
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();

      // Angka koordinat
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.55)" : "#475569";
      ctx.font = "11px monospace";
      for (let x = minX; x <= maxX; x += 2) {
        if (x !== 0) ctx.fillText(x.toString(), originX + x * scale - 4, originY + 14);
      }
      for (let y = minY; y <= maxY; y += 2) {
        if (y !== 0) ctx.fillText(y.toString(), originX + 6, originY - y * scale + 3);
      }
      ctx.fillText("0", originX + 5, originY + 12);
      ctx.fillText("X", width - 15, originY - 6);
      ctx.fillText("Y", originX + 6, 15);
    } else {
      // 2. Blueprint chalkboard grid halus untuk Bangun Datar 2D & Jaring-Jaring (TANPA Sumbu X/Y atau angka tabrakan)
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(148, 163, 184, 0.12)";
      const step = 40;
      for (let cx = 0; cx <= width; cx += step) {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
      }
      for (let cy = 0; cy <= height; cy += step) {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();
      }
    }

    ctx.lineWidth = 2.5;
    if (activeModel === "2d_quadratic") {
      ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= width; px += 2) {
        const x = (px - originX) / scale;
        const y = paramA * x * x + paramB * x + paramC;
        const py = originY - y * scale;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      const vertexX = -paramB / (2 * paramA);
      const vertexY = paramC - (paramB * paramB) / (4 * paramA);
      const pvx = originX + vertexX * scale;
      const pvy = originY - vertexY * scale;

      if (showHandles) {
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.beginPath();
        ctx.arc(pvx, pvy, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`Puncak (${fmt(vertexX)}, ${fmt(vertexY)})`, pvx + 8, pvy - 8);
      }
    } else if (activeModel === "2d_trig") {
      ctx.strokeStyle = isDark ? "#c084fc" : "#7e22ce";
      ctx.beginPath();
      for (let px = 0; px <= width; px += 2) {
        const x = (px - originX) / scale;
        const y = paramA * Math.sin(paramB * x);
        const py = originY - y * scale;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (activeModel === "2d_shape") {
      // =====================================================================
      // BANGUN DATAR 2D (JAJAR GENJANG, TRAPESIUM, SEGITIGA, DLL.)
      // =====================================================================
      const u = unit || "cm";

      if (planeShapeKind === "jajar_genjang") {
        const a = paramA || 12;
        const t = paramB || 8;
        const s = paramC || 10;
        const angleDeg = 60;
        const angleRad = (angleDeg * Math.PI) / 180;
        const dx = t / Math.tan(angleRad);

        const totalW = a + dx;
        const totalH = t;
        const sc = Math.min((width * 0.65) / totalW, (height * 0.6) / totalH);

        const leftX = originX - (totalW * sc) / 2;
        const botY = originY + (totalH * sc) / 2;

        const Ax = leftX;
        const Ay = botY;
        const Bx = leftX + a * sc;
        const By = botY;
        const Cx = Bx + dx * sc;
        const Cy = botY - t * sc;
        const Dx = leftX + dx * sc;
        const Dy = botY - t * sc;

        // 1. Fill polygon with soft translucent cyan
        ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.14)" : "rgba(14, 165, 233, 0.16)";
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Cx, Cy);
        ctx.lineTo(Dx, Dy);
        ctx.closePath();
        ctx.fill();

        // 2. Outline stroke
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.stroke();

        // 3. Dashed height line from D down to base line
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isDark ? "#fb7185" : "#be123c";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(Dx, Dy);
        ctx.lineTo(Dx, Ay);
        ctx.stroke();

        // Right angle indicator at the foot of height
        const sqSize = 10;
        ctx.setLineDash([]);
        ctx.strokeStyle = isDark ? "#fb7185" : "#be123c";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(Dx, Ay - sqSize, sqSize, sqSize);
        ctx.restore();

        // 4. Labels
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";

        // Vertices A, B, C, D
        ctx.fillText("A", Ax - 16, Ay + 16);
        ctx.fillText("B", Bx + 6, By + 16);
        ctx.fillText("C", Cx + 8, Cy - 6);
        ctx.fillText("D", Dx - 16, Dy - 6);

        // Base label: a = ...
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#38bdf8" : "#0369a1";
        ctx.textAlign = "center";
        ctx.fillText(`alas (a) = ${a} ${u}`, (Ax + Bx) / 2, Ay + 22);

        // Height label: t = ... (inside parallelogram, to the right of red dashed line)
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.textAlign = "left";
        ctx.fillText(`tinggi (t) = ${t} ${u}`, Dx + 10, (Dy + Ay) / 2);

        // Slant side label: s = ... (outside parallelogram, to the left of side AD)
        ctx.fillStyle = isDark ? "#34d399" : "#047857";
        ctx.textAlign = "right";
        ctx.fillText(`sisi miring (s) = ${s} ${u}`, (Ax + Dx) / 2 - 14, (Ay + Dy) / 2 - 6);

        // Angle indicator at vertex A
        ctx.strokeStyle = isDark ? "#fbbf24" : "#b45309";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(Ax, Ay, 24, -angleRad, 0);
        ctx.stroke();

        ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
        ctx.textAlign = "left";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("θ = 60°", Ax + 28, Ay - 8);

        // Vertex Dots
        [[Ax, Ay], [Bx, By], [Cx, Cy], [Dx, Dy]].forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (planeShapeKind === "trapesium") {
        const topW = paramA || 8;
        const botW = paramB || 14;
        const h = paramC || 6;
        const sc = Math.min((width * 0.65) / botW, (height * 0.6) / h);

        const diff = (botW - topW) / 2;
        const leftX = originX - (botW * sc) / 2;
        const botY = originY + (h * sc) / 2;

        const Ax = leftX;
        const Ay = botY;
        const Bx = leftX + botW * sc;
        const By = botY;
        const Cx = leftX + (botW - diff) * sc;
        const Cy = botY - h * sc;
        const Dx = leftX + diff * sc;
        const Dy = botY - h * sc;

        ctx.fillStyle = isDark ? "rgba(168, 85, 247, 0.14)" : "rgba(168, 85, 247, 0.16)";
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Cx, Cy);
        ctx.lineTo(Dx, Dy);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#c084fc" : "#7e22ce";
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isDark ? "#fb7185" : "#be123c";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(Dx, Dy);
        ctx.lineTo(Dx, Ay);
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#c084fc" : "#6b21a8";
        ctx.textAlign = "center";
        ctx.fillText(`sisi atas (a) = ${topW} ${u}`, (Dx + Cx) / 2, Dy - 10);
        ctx.fillText(`sisi bawah (b) = ${botW} ${u}`, (Ax + Bx) / 2, Ay + 22);
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.textAlign = "left";
        ctx.fillText(`tinggi (t) = ${h} ${u}`, Dx + 8, (Dy + Ay) / 2);
      } else if (planeShapeKind === "segitiga") {
        const a = paramA || 10;
        const h = paramB || 8;
        const sc = Math.min((width * 0.65) / a, (height * 0.6) / h);

        const leftX = originX - (a * sc) / 2;
        const botY = originY + (h * sc) / 2;

        const Ax = leftX;
        const Ay = botY;
        const Bx = leftX + a * sc;
        const By = botY;
        const Cx = leftX + (a * sc) / 2;
        const Cy = botY - h * sc;

        ctx.fillStyle = isDark ? "rgba(52, 211, 153, 0.14)" : "rgba(16, 185, 129, 0.16)";
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Cx, Cy);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#34d399" : "#047857";
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isDark ? "#fb7185" : "#be123c";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(Cx, Cy);
        ctx.lineTo(Cx, Ay);
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#34d399" : "#047857";
        ctx.textAlign = "center";
        ctx.fillText(`alas (a) = ${a} ${u}`, (Ax + Bx) / 2, Ay + 22);
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.textAlign = "right";
        ctx.fillText(`t = ${h} ${u}`, Cx - 6, (Cy + Ay) / 2);
      } else if (planeShapeKind === "persegi_panjang") {
        const p = paramA || 14;
        const l = paramB || 8;
        const sc = Math.min((width * 0.65) / p, (height * 0.6) / l);

        const leftX = originX - (p * sc) / 2;
        const topY = originY - (l * sc) / 2;
        const rectW = p * sc;
        const rectH = l * sc;

        const Ax = leftX;
        const Ay = topY + rectH;
        const Bx = leftX + rectW;
        const By = topY + rectH;
        const Cx = leftX + rectW;
        const Cy = topY;
        const Dx = leftX;
        const Dy = topY;

        // Fill translucent indigo
        ctx.fillStyle = isDark ? "rgba(99, 102, 241, 0.14)" : "rgba(99, 102, 241, 0.16)";
        ctx.beginPath();
        ctx.rect(leftX, topY, rectW, rectH);
        ctx.fill();

        // Stroke outline
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#818cf8" : "#4f46e5";
        ctx.stroke();

        // Right angle squares at 4 corners
        const sqSize = 10;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = isDark ? "#818cf8" : "#4f46e5";
        ctx.strokeRect(Ax, Ay - sqSize, sqSize, sqSize);
        ctx.strokeRect(Bx - sqSize, By - sqSize, sqSize, sqSize);
        ctx.strokeRect(Cx - sqSize, Cy, sqSize, sqSize);
        ctx.strokeRect(Dx, Dy, sqSize, sqSize);

        // Labels
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.fillText("A", Ax - 16, Ay + 16);
        ctx.fillText("B", Bx + 6, By + 16);
        ctx.fillText("C", Cx + 6, Cy - 6);
        ctx.fillText("D", Dx - 16, Dy - 6);

        // Dimensions: p on bottom, l on right
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#818cf8" : "#4338ca";
        ctx.textAlign = "center";
        ctx.fillText(`panjang (p) = ${p} ${u}`, (Ax + Bx) / 2, Ay + 24);

        ctx.textAlign = "left";
        ctx.fillText(`lebar (l) = ${l} ${u}`, Bx + 10, (Cy + By) / 2);

        // Vertex dots
        [[Ax, Ay], [Bx, By], [Cx, Cy], [Dx, Dy]].forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#818cf8" : "#4f46e5";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (planeShapeKind === "persegi") {
        const s = paramA || 10;
        const sc = Math.min((width * 0.65) / s, (height * 0.6) / s);

        const leftX = originX - (s * sc) / 2;
        const topY = originY - (s * sc) / 2;
        const sidePx = s * sc;

        const Ax = leftX;
        const Ay = topY + sidePx;
        const Bx = leftX + sidePx;
        const By = topY + sidePx;
        const Cx = leftX + sidePx;
        const Cy = topY;
        const Dx = leftX;
        const Dy = topY;

        ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(16, 185, 129, 0.16)";
        ctx.beginPath();
        ctx.rect(leftX, topY, sidePx, sidePx);
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#34d399" : "#059669";
        ctx.stroke();

        const sqSize = 10;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = isDark ? "#34d399" : "#059669";
        ctx.strokeRect(Ax, Ay - sqSize, sqSize, sqSize);
        ctx.strokeRect(Bx - sqSize, By - sqSize, sqSize, sqSize);
        ctx.strokeRect(Cx - sqSize, Cy, sqSize, sqSize);
        ctx.strokeRect(Dx, Dy, sqSize, sqSize);

        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.fillText("A", Ax - 16, Ay + 16);
        ctx.fillText("B", Bx + 6, By + 16);
        ctx.fillText("C", Cx + 6, Cy - 6);
        ctx.fillText("D", Dx - 16, Dy - 6);

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#34d399" : "#047857";
        ctx.textAlign = "center";
        ctx.fillText(`sisi (s) = ${s} ${u}`, (Ax + Bx) / 2, Ay + 24);

        ctx.textAlign = "left";
        ctx.fillText(`sisi (s) = ${s} ${u}`, Bx + 10, (Cy + By) / 2);

        [[Ax, Ay], [Bx, By], [Cx, Cy], [Dx, Dy]].forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#34d399" : "#059669";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (planeShapeKind === "segilima" || planeShapeKind === "segienam" || planeShapeKind === "poligon") {
        const s = paramA || 10;
        const n = planeShapeKind === "segilima" ? 5 : planeShapeKind === "segienam" ? 6 : (paramC || 6);
        const R = s / (2 * Math.sin(Math.PI / n));
        const sc = Math.min((width * 0.62) / (2 * R), (height * 0.58) / (2 * R));
        const Rpx = R * sc;
        const verts: Array<[number, number]> = [];
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          verts.push([originX + Rpx * Math.cos(ang), originY + Rpx * Math.sin(ang)]);
        }
        ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(16, 185, 129, 0.16)";
        ctx.beginPath();
        verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)));
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#34d399" : "#059669";
        ctx.stroke();

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#34d399" : "#047857";
        ctx.textAlign = "center";
        const [mx, my] = [(verts[0][0] + verts[1][0]) / 2, (verts[0][1] + verts[1][1]) / 2];
        ctx.fillText(`sisi (s) = ${s} ${u}`, mx, my - 10);
        ctx.textAlign = "left";

        verts.forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#34d399" : "#059669";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });

      } else if (planeShapeKind === "lingkaran") {
        const r = paramA || 7;
        const sc = Math.min((width * 0.65) / (2 * r), (height * 0.6) / (2 * r));
        const rPx = r * sc;

        // Fill translucent cyan / sky
        ctx.fillStyle = isDark ? "rgba(14, 165, 233, 0.14)" : "rgba(14, 165, 233, 0.16)";
        ctx.beginPath();
        ctx.arc(originX, originY, rPx, 0, Math.PI * 2);
        ctx.fill();

        // Stroke outline
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.stroke();

        // Center dot O
        ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.beginPath();
        ctx.arc(originX, originY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(originX, originY, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.fillText("O", originX - 12, originY - 10);

        // Radius line (O to right boundary)
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + rPx, originY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Radius end dot
        ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.beginPath();
        ctx.arc(originX + rPx, originY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Labels
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#38bdf8" : "#0369a1";
        ctx.textAlign = "center";
        ctx.fillText(`jari-jari (r) = ${r} ${u}`, originX + rPx / 2, originY - 10);

        ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
        ctx.fillText(`diameter (d) = ${2 * r} ${u}`, originX, originY + rPx + 24);
      } else if (planeShapeKind === "belah_ketupat") {
        const d1 = paramA || 12;
        const d2 = paramB || 16;
        const sc = Math.min((width * 0.65) / d1, (height * 0.6) / d2);
        const wHalf = (d1 * sc) / 2;
        const hHalf = (d2 * sc) / 2;

        const Ax = originX;
        const Ay = originY + hHalf; // bottom
        const Bx = originX + wHalf; // right
        const By = originY;
        const Cx = originX;
        const Cy = originY - hHalf; // top
        const Dx = originX - wHalf; // left
        const Dy = originY;

        // Fill translucent amber
        ctx.fillStyle = isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.16)";
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Cx, Cy);
        ctx.lineTo(Dx, Dy);
        ctx.closePath();
        ctx.fill();

        // Stroke
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#fbbf24" : "#d97706";
        ctx.stroke();

        // Dashed diagonals d1 and d2
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(Dx, Dy);
        ctx.lineTo(Bx, By);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Cx, Cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right angle at center
        const sq = 8;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.strokeRect(originX, originY - sq, sq, sq);

        // Vertices
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.fillText("A", Ax, Ay + 18);
        ctx.fillText("B", Bx + 14, By + 4);
        ctx.fillText("C", Cx, Cy - 10);
        ctx.fillText("D", Dx - 16, Dy + 4);

        // Diagonal labels & side label
        const s = Math.sqrt(Math.pow(d1 / 2, 2) + Math.pow(d2 / 2, 2)).toFixed(1);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.textAlign = "center";
        ctx.fillText(`d₁ = ${d1} ${u}`, (originX + Bx) / 2, originY - 8);
        ctx.textAlign = "left";
        ctx.fillText(`d₂ = ${d2} ${u}`, originX + 8, (originY + Cy) / 2);

        ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
        ctx.textAlign = "center";
        ctx.fillText(`s = ${s} ${u}`, (Bx + Cx) / 2 + 16, (By + Cy) / 2 - 4);

        [[Ax, Ay], [Bx, By], [Cx, Cy], [Dx, Dy]].forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#fbbf24" : "#d97706";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (planeShapeKind === "layang_layang") {
        const d1 = paramA || 12;
        const d2 = paramB || 16;
        const sc = Math.min((width * 0.65) / d1, (height * 0.6) / d2);
        const wHalf = (d1 * sc) / 2;
        const topH = (d2 * sc) * 0.35;
        const botH = (d2 * sc) * 0.65;

        const Ax = originX;
        const Ay = originY + botH; // bottom
        const Bx = originX + wHalf; // right
        const By = originY;
        const Cx = originX;
        const Cy = originY - topH; // top
        const Dx = originX - wHalf; // left
        const Dy = originY;

        // Fill translucent violet
        ctx.fillStyle = isDark ? "rgba(168, 85, 247, 0.14)" : "rgba(168, 85, 247, 0.16)";
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Cx, Cy);
        ctx.lineTo(Dx, Dy);
        ctx.closePath();
        ctx.fill();

        // Stroke
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#c084fc" : "#9333ea";
        ctx.stroke();

        // Dashed diagonals
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(Dx, Dy);
        ctx.lineTo(Bx, By);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Ax, Ay);
        ctx.lineTo(Cx, Cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right angle at center
        const sq = 8;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.strokeRect(originX, originY - sq, sq, sq);

        // Vertices
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.fillText("A", Ax, Ay + 18);
        ctx.fillText("B", Bx + 14, By + 4);
        ctx.fillText("C", Cx, Cy - 10);
        ctx.fillText("D", Dx - 16, Dy + 4);

        // Labels
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#fb7185" : "#be123c";
        ctx.textAlign = "center";
        ctx.fillText(`d₁ = ${d1} ${u}`, (originX + Bx) / 2, originY - 8);
        ctx.textAlign = "left";
        ctx.fillText(`d₂ = ${d2} ${u}`, originX + 8, (originY + Cy) / 2);

        [[Ax, Ay], [Bx, By], [Cx, Cy], [Dx, Dy]].forEach(([vx, vy]) => {
          ctx.fillStyle = isDark ? "#c084fc" : "#9333ea";
          ctx.beginPath();
          ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(vx, vy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (planeShapeKind === "jaring_prisma") {
        // Jaring-Jaring 2D Prisma Segitiga (Bentangan 3 persegi panjang sisi tegak + 2 segitiga alas/tutup)
        const s = paramA || 8;
        const t = paramB || 10;
        const u = unit || "cm";
        const hTri = (Math.sqrt(3) / 2) * s;

        // Healthy aspect ratio clamping so columns never collapse into skinny overlapping slits
        const totalW = 3 * s;
        const totalH = t + 2 * hTri;
        const sc = Math.min((width * 0.65) / totalW, (height * 0.70) / totalH);

        // Ensure each rectangular column is at least 65px wide and total height is at least 120px
        let w = Math.max(65, s * sc);
        let h = Math.max(120, t * sc);
        let ht = Math.max(38, hTri * sc);

        // Fit within canvas safely
        if (3 * w > width * 0.8) {
          w = (width * 0.8) / 3;
        }
        if (h + 2 * ht > height * 0.75) {
          const factor = (height * 0.75) / (h + 2 * ht);
          h *= factor;
          ht *= factor;
        }

        const leftX = originX - 1.5 * w;
        const topY = originY - h / 2;

        // Fill all 3 rectangles (sisi tegak)
        ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(14, 165, 233, 0.14)";
        ctx.fillRect(leftX, topY, 3 * w, h);

        // Fill 2 triangular bases (alas & tutup)
        ctx.beginPath();
        // Top triangle (Tutup)
        ctx.moveTo(originX - 0.5 * w, topY);
        ctx.lineTo(originX + 0.5 * w, topY);
        ctx.lineTo(originX, topY - ht);
        ctx.closePath();
        // Bottom triangle (Alas)
        ctx.moveTo(originX - 0.5 * w, topY + h);
        ctx.lineTo(originX + 0.5 * w, topY + h);
        ctx.lineTo(originX, topY + h + ht);
        ctx.closePath();
        ctx.fill();

        // Stroke Outer Perimeter
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.strokeRect(leftX, topY, 3 * w, h);

        ctx.beginPath();
        // Top triangle outer edges
        ctx.moveTo(originX - 0.5 * w, topY);
        ctx.lineTo(originX, topY - ht);
        ctx.lineTo(originX + 0.5 * w, topY);
        // Bottom triangle outer edges
        ctx.moveTo(originX - 0.5 * w, topY + h);
        ctx.lineTo(originX, topY + h + ht);
        ctx.lineTo(originX + 0.5 * w, topY + h);
        ctx.stroke();

        // Interior Folding Lines (garis lipatan putus-putus)
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.beginPath();
        // Between rect 1 and 2
        ctx.moveTo(leftX + w, topY);
        ctx.lineTo(leftX + w, topY + h);
        // Between rect 2 and 3
        ctx.moveTo(leftX + 2 * w, topY);
        ctx.lineTo(leftX + 2 * w, topY + h);
        // Top fold line
        ctx.moveTo(originX - 0.5 * w, topY);
        ctx.lineTo(originX + 0.5 * w, topY);
        // Bottom fold line
        ctx.moveTo(originX - 0.5 * w, topY + h);
        ctx.lineTo(originX + 0.5 * w, topY + h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Helper to draw clean pill text badge without any background collision
        const drawPillBadge = (text: string, bx: number, by: number, isPrimary = false) => {
          ctx.font = isPrimary ? "bold 12px sans-serif" : "bold 11px sans-serif";
          const tw = ctx.measureText(text).width;
          const pw = tw + 14;
          const ph = 20;

          ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(bx - pw / 2, by - ph / 2, pw, ph, 6);
          else ctx.rect(bx - pw / 2, by - ph / 2, pw, ph);
          ctx.fill();

          ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isPrimary ? (isDark ? "#38bdf8" : "#0284c7") : (isDark ? "#e2e8f0" : "#1e293b");
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, bx, by);
        };

        // Triangles labels
        drawPillBadge("Tutup Segitiga", originX, topY - ht * 0.45);
        drawPillBadge("Alas Segitiga", originX, topY + h + ht * 0.45);

        // Rectangles labels (using adaptive numbering if narrow, full label if wide)
        if (w >= 90) {
          drawPillBadge("Sisi Tegak 1", leftX + 0.5 * w, originY);
          drawPillBadge("Sisi Tegak 2 (Tengah)", originX, originY);
          drawPillBadge("Sisi Tegak 3", leftX + 2.5 * w, originY);
        } else {
          drawPillBadge("Bidang 1", leftX + 0.5 * w, originY);
          drawPillBadge("Bidang 2", originX, originY);
          drawPillBadge("Bidang 3", leftX + 2.5 * w, originY);
        }

        // Side length (s) label below alas
        drawPillBadge(`s = ${s} ${u}`, originX, topY + h + ht + 20, true);

        // Height (t) dimension with dedicated vertical arrow line on the right
        const dimX = leftX + 3 * w + 20;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dimX, topY);
        ctx.lineTo(dimX, topY + h);
        ctx.moveTo(dimX - 4, topY);
        ctx.lineTo(dimX + 4, topY);
        ctx.moveTo(dimX - 4, topY + h);
        ctx.lineTo(dimX + 4, topY + h);
        ctx.stroke();

        drawPillBadge(`t = ${t} ${u}`, dimX + 34, originY, true);

        // Clean title badge above top triangle
        drawPillBadge("Jaring-Jaring 2D Prisma Segitiga", originX, topY - ht - 20, true);
      } else if (planeShapeKind === "jaring_kubus") {
        // Jaring-Jaring 2D Kubus (Pola Salib / T-Cross)
        const s = paramA || 10;
        const sc = Math.min((width * 0.7) / (4 * s), (height * 0.7) / (3 * s));
        const box = s * sc;

        const startX = originX - 2 * box;
        const startY = originY - 0.5 * box;

        // Fill 6 squares
        ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.14)";
        // 4 in horizontal row
        ctx.fillRect(startX, startY, 4 * box, box);
        // 1 above (col 1)
        ctx.fillRect(startX + box, startY - box, box, box);
        // 1 below (col 1)
        ctx.fillRect(startX + box, startY + box, box, box);

        // Stroke Outer Perimeter
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#34d399" : "#059669";
        ctx.strokeRect(startX, startY, 4 * box, box);
        ctx.strokeRect(startX + box, startY - box, box, box);
        ctx.strokeRect(startX + box, startY + box, box, box);

        // Folding lines (dashed)
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          ctx.moveTo(startX + i * box, startY);
          ctx.lineTo(startX + i * box, startY + box);
        }
        ctx.moveTo(startX + box, startY);
        ctx.lineTo(startX + 2 * box, startY);
        ctx.moveTo(startX + box, startY + box);
        ctx.lineTo(startX + 2 * box, startY + box);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText("Atas", startX + 1.5 * box, startY - 0.5 * box + 4);
        ctx.fillText("Kiri", startX + 0.5 * box, startY + 0.5 * box + 4);
        ctx.fillText("Depan", startX + 1.5 * box, startY + 0.5 * box + 4);
        ctx.fillText("Kanan", startX + 2.5 * box, startY + 0.5 * box + 4);
        ctx.fillText("Belakang", startX + 3.5 * box, startY + 0.5 * box + 4);
        ctx.fillText("Bawah (Alas)", startX + 1.5 * box, startY + 1.5 * box + 4);

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#34d399" : "#047857";
        ctx.fillText(`rusuk (s) = ${s} ${u}`, originX, startY + 2.2 * box);
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Jaring-Jaring 2D Kubus", originX, startY - 1.3 * box);
      } else if (planeShapeKind === "jaring_limas") {
        // Jaring-Jaring 2D Limas Segi Empat (Piramida)
        const s = paramA || 8;
        const t = paramB || 10;
        const ts = Math.sqrt((s / 2) ** 2 + t ** 2);
        const total = s + 2 * ts;
        const sc = Math.min((width * 0.7) / total, (height * 0.7) / total);

        const sq = s * sc;
        const petal = ts * sc;

        const leftX = originX - sq / 2;
        const topY = originY - sq / 2;

        // Central Square
        ctx.fillStyle = isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.14)";
        ctx.fillRect(leftX, topY, sq, sq);

        // 4 Triangular Petals
        ctx.beginPath();
        // Top
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX + sq, topY);
        ctx.lineTo(originX, topY - petal);
        ctx.closePath();
        // Bottom
        ctx.moveTo(leftX, topY + sq);
        ctx.lineTo(leftX + sq, topY + sq);
        ctx.lineTo(originX, topY + sq + petal);
        ctx.closePath();
        // Left
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX, topY + sq);
        ctx.lineTo(leftX - petal, originY);
        ctx.closePath();
        // Right
        ctx.moveTo(leftX + sq, topY);
        ctx.lineTo(leftX + sq, topY + sq);
        ctx.lineTo(leftX + sq + petal, originY);
        ctx.closePath();
        ctx.fill();

        // Stroke Outer
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDark ? "#fbbf24" : "#d97706";
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(originX, topY - petal);
        ctx.lineTo(leftX + sq, topY);
        ctx.lineTo(leftX + sq + petal, originY);
        ctx.lineTo(leftX + sq, topY + sq);
        ctx.lineTo(originX, topY + sq + petal);
        ctx.lineTo(leftX, topY + sq);
        ctx.lineTo(leftX - petal, originY);
        ctx.closePath();
        ctx.stroke();

        // Folding lines (dashed around central square)
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = isDark ? "#fb7185" : "#e11d48";
        ctx.strokeRect(leftX, topY, sq, sq);
        ctx.setLineDash([]);

        // Labels
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText("Alas Persegi", originX, originY + 4);

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
        ctx.fillText(`s = ${s} ${u}`, originX, topY + sq + 16);
        ctx.fillText(`t_s = ${ts.toFixed(1)} ${u}`, originX, topY - petal - 8);
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Jaring-Jaring 2D Limas (Piramida)", originX, topY - petal - 24);
      }
    }
  }, [activeModel, planeShapeKind, paramA, paramB, paramC, unit, isProjectorMode, is2DGraphModel, isDark, zoom2D, pan2D]);

  // =========================================================================
  // 4. THREE.JS 3D MESH GENERATOR (KUBUS SOLID, BALOK, SILINDER, KERUCUT)
  // =========================================================================
  const is3DModel =
    activeModel === "3d_empty" ||
    activeModel === "parabola" ||
    activeModel === "conic_slicer" ||
    activeModel === "cylinder" ||
    activeModel === "saddle" ||
    activeModel === "counting_blocks" ||
    activeModel === "solids" ||
    activeModel === "surface";

  const solidMetrics = useCallback((): { volume: number; surface: number; rows: InfoRow[] } => {
    const A = paramA || 10;
    const B = paramB || 6;
    const C = paramC || 4;
    const u = unit || "cm";

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
            { label: "Luas Jajar Genjang", formula: "L = a · t", value: `${fmt(luas)} ${u}²` },
            { label: "Keliling Jajar Genjang", formula: "K = 2(a + s)", value: `${fmt(keliling)} ${u}` },
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
            { label: "Luas Trapesium", formula: "L = ½(a + b)t", value: `${fmt(luas)} ${u}²` },
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
            { label: "Luas Segitiga", formula: "L = ½ a · t", value: `${fmt(luas)} ${u}²` },
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
            { label: "Luas Persegi Panjang", formula: "L = p · l", value: `${fmt(luas)} ${u}²` },
            { label: "Keliling Persegi Panjang", formula: "K = 2(p + l)", value: `${fmt(keliling)} ${u}` },
            { label: "Panjang Diagonal", formula: "d = √(p² + l²)", value: `${fmt(Number(diagonal.toFixed(2)))} ${u}` },
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
            { label: "Luas Persegi", formula: "L = s²", value: `${fmt(luas)} ${u}²` },
            { label: "Keliling Persegi", formula: "K = 4s", value: `${fmt(keliling)} ${u}` },
            { label: "Panjang Diagonal", formula: "d = s√2", value: `${fmt(Number(diagonal.toFixed(2)))} ${u}` },
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
            { label: `Luas ${n === 5 ? "Segilima" : n === 6 ? "Segienam" : `Segi-${n}`}`, formula: "L = n·s²/(4·tan(π/n))", value: `${fmt(luas)} ${u}²` },
            { label: "Keliling", formula: `K = ${n}s`, value: `${fmt(keliling)} ${u}` },
            { label: "Apotema", formula: "a = s/(2·tan(π/n))", value: `${fmt(apotema)} ${u}` },
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
            { label: "Diameter (d)", formula: "d = 2r", value: `${fmt(diameter)} ${u}` },
            { label: "Luas Lingkaran", formula: "L = πr²", value: `${fmt(Number(luas.toFixed(2)))} ${u}²` },
            { label: "Keliling Lingkaran", formula: "K = 2πr", value: `${fmt(Number(keliling.toFixed(2)))} ${u}` },
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
            { label: "Sisi Miring (s)", formula: "s = √((d₁/2)² + (d₂/2)²)", value: `${fmt(Number(s.toFixed(2)))} ${u}` },
            { label: "Luas Belah Ketupat", formula: "L = ½ d₁ · d₂", value: `${fmt(luas)} ${u}²` },
            { label: "Keliling Belah Ketupat", formula: "K = 4s", value: `${fmt(Number(keliling.toFixed(2)))} ${u}` },
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
            { label: "Luas Layang-Layang", formula: "L = ½ d₁ · d₂", value: `${fmt(luas)} ${u}²` },
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
            { label: "Luas 1 Alas Segitiga", formula: "La = (√3/4)s²", value: `${fmt(Number(luasAlas.toFixed(2)))} ${u}²` },
            { label: "Luas 3 Sisi Tegak", formula: "Ls = 3st", value: `${fmt(Number(luasSelimut.toFixed(2)))} ${u}²` },
            { label: "Total Luas Jaring-Jaring", formula: "L = 2La + Ls", value: `${fmt(Number(totalNet.toFixed(2)))} ${u}²` },
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
            { label: "Luas 1 Bidang Persegi", formula: "L₁ = s²", value: `${fmt(s * s)} ${u}²` },
            { label: "Total Luas Jaring-Jaring", formula: "L = 6s²", value: `${fmt(totalNet)} ${u}²` },
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
            { label: "Tinggi Sisi Miring (ts)", formula: "ts = √((s/2)²+t²)", value: `${fmt(Number(ts.toFixed(2)))} ${u}` },
            { label: "Luas Alas Persegi", formula: "La = s²", value: `${fmt(luasAlas)} ${u}²` },
            { label: "Luas 4 Segitiga Selimut", formula: "Ls = 2·s·ts", value: `${fmt(Number(luas4Segitiga.toFixed(2)))} ${u}²` },
            { label: "Total Luas Jaring-Jaring", formula: "L = La + Ls", value: `${fmt(Number(totalNet.toFixed(2)))} ${u}²` },
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
          { label: "Luas Selimut", formula: "2πrt", value: `${fmt(ls)} ${u}²` },
          { label: "Luas Permukaan", formula: "2πr(r+t)", value: `${fmt(lp)} ${u}²` },
          { label: "Volume Tabung", formula: "V = πr²t", value: `${fmt(v)} ${u}³` },
        ],
      };
    }

    switch (solidKind) {
      case "kubus": {
        const v = A ** 3;
        const lp = 6 * A * A;
        const diagRuang = A * Math.sqrt(3);
        const rows: InfoRow[] = [
          { label: "Panjang Sisi (s)", formula: "s", value: `${fmt(A)} ${u}` },
          { label: "Luas Permukaan", formula: "L = 6s²", value: `${fmt(lp)} ${u}²` },
          { label: "Volume", formula: "V = s³", value: `${fmt(v)} ${u}³` },
          { label: "Diagonal Ruang", formula: "d = s√3", value: `${fmt(diagRuang)} ${u}` },
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
            { label: "Luas Permukaan", formula: "2(pl + pt + lt)", value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "V = p × l × t", value: `${fmt(v)} ${u}³` },
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
            { label: "Luas Permukaan", formula: "L = 4πr²", value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "V = 4/3 π r³", value: `${fmt(v)} ${u}³` },
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
            { label: "Luas Alas", formula: "(√3/4)s²", value: `${fmt(luasAlas)} ${u}²` },
            { label: "Luas Permukaan", formula: "2·La + 3st", value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "La × t", value: `${fmt(v)} ${u}³` },
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
            { label: "Luas Alas", formula: "n·s²/(4·tan(π/n))", value: `${fmt(luasAlas)} ${u}²` },
            { label: "Luas Permukaan", formula: `2·La + ${n}st`, value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "La × t", value: `${fmt(v)} ${u}³` },
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
            { label: "Luas Permukaan", formula: "s² + 4·(½s·hs)", value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "⅓ · s² · t", value: `${fmt(v)} ${u}³` },
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
            { label: "Luas Alas", formula: "n·s²/(4·tan(π/n))", value: `${fmt(luasAlas)} ${u}²` },
            { label: "Luas Permukaan", formula: "La + (n·s·ts)/2", value: `${fmt(lp)} ${u}²` },
            { label: "Volume", formula: "⅓ · La · t", value: `${fmt(v)} ${u}³` },
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
  }, [activeModel, planeShapeKind, solidKind, paramA, paramB, paramC, unit, showSlicePlane, sliceProgress]);

  const rebuildMeshes = useCallback(() => {
    if (!meshGroupRef.current) return;
    const group = meshGroupRef.current;

    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    }

    if (!is3DModel || activeModel === "3d_empty") return;

    const addEdges = (mesh: THREE.Mesh, geometry: THREE.BufferGeometry, color = 0x38bdf8) => {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 24),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      mesh.add(edges);
    };

    // 1. SOLIDS: KUBUS DENGAN CORNER RESIZING HANDLES
    if (activeModel === "solids" && solidKind === "kubus") {
      // Skala visual proporsional dengan panjang sisi paramA (baseline 10 unit = 3.0 satuan 3D)
      const displaySize = Math.max(1.2, Math.min(5.2, (paramA / 10) * 3.0));

      // Translucent Glassmorphic Outer Cube
      const cubeGeo = new THREE.BoxGeometry(displaySize, displaySize, displaySize);
      const cubeMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: wireframe ? 0.05 : 0.32,
        roughness: 0.12,
        metalness: 0.08,
        depthWrite: false,
      });
      const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
      cubeMesh.position.set(0, displaySize / 2 + GRID_Y, 0);
      addEdges(cubeMesh, cubeGeo, 0x38bdf8);
      group.add(cubeMesh);

      // Interactive 8 Corner Vertex Handles with 3-Axis Angle Brackets (Sudut Siku Presisi untuk Resizing)
      cornerHandlesRef.current = [];
      const hs = displaySize / 2;
      const corners = [
        [-hs, -hs, -hs], [hs, -hs, -hs], [-hs, -hs, hs], [hs, -hs, hs],
        [-hs, hs, -hs], [hs, hs, -hs], [-hs, hs, hs], [hs, hs, hs],
      ];

      corners.forEach(([cx, cy, cz], idx) => {
        const dx = -Math.sign(cx) || 1;
        const dy = -Math.sign(cy) || 1;
        const dz = -Math.sign(cz) || 1;
        const bracketGeo = createCornerBracketGeometry(dx, dy, dz);
        const bracketMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(cx, cy + displaySize / 2 + GRID_Y, cz);
        bracket.userData = { isCornerHandle: true, index: idx };
        bracket.visible = showHandlesRef.current;
        group.add(bracket);
        cornerHandlesRef.current.push(bracket);
      });

      // Dimension labels on 3D edges (Angka pada tulang sisi 3D)
      const u = unit || "cm";
      const sVal = paramA || 10;
      // Tulang alas depan
      const dimFront = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
      dimFront.position.set(0, GRID_Y + 0.14, hs + 0.10);
      group.add(dimFront);

      // Tulang tegak kiri depan
      const dimVert = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
      dimVert.position.set(-hs - 0.16, hs + GRID_Y, hs);
      group.add(dimVert);

      // Tulang kedalaman samping kanan
      const dimDepth = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
      dimDepth.position.set(hs + 0.14, GRID_Y + 0.14, 0);
      group.add(dimDepth);

      // Slicing Plane: ONLY RENDER IF USER SPECIFICALLY REQUESTED IT!
      if (showSlicePlane) {
        const planeSize = displaySize * 1.35;
        const sliceGeo = new THREE.PlaneGeometry(planeSize, planeSize);
        const sliceMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.68,
          roughness: 0.2,
        });
        const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat);
        sliceMesh.rotation.x = Math.PI / 4;
        sliceMesh.rotation.z = Math.PI / 6;
        sliceMesh.position.set(0, (sliceProgress - 0.5) * displaySize + displaySize / 2 + GRID_Y, 0);

        const sliceEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(sliceGeo),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
        );
        sliceMesh.add(sliceEdges);
        group.add(sliceMesh);
      }
    }

    // 2. BALOK (CUBOID)
    else if (activeModel === "solids" && solidKind === "balok") {
      const w = Math.max(1.4, Math.min(5.5, (paramA / 10) * 3.6));
      const h = Math.max(1.0, Math.min(4.5, (paramB / 6) * 2.2));
      const d = Math.max(1.0, Math.min(4.5, (paramC / 4) * 2.0));
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: wireframe ? 0.05 : 0.35,
        roughness: 0.15,
        metalness: 0.05,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, h / 2 + GRID_Y, 0);
      addEdges(mesh, geo, 0x38bdf8);
      group.add(mesh);

      // Interactive 8 Corner Vertex Handles for Balok with 3-Axis Angle Brackets (Sudut Siku)
      cornerHandlesRef.current = [];
      const hw = w / 2;
      const hh = h / 2;
      const hd = d / 2;
      const corners = [
        [-hw, -hh, -hd], [hw, -hh, -hd], [-hw, -hh, hd], [hw, -hh, hd],
        [-hw, hh, -hd], [hw, hh, -hd], [-hw, hh, hd], [hw, hh, hd],
      ];
      corners.forEach(([cx, cy, cz], idx) => {
        const dx = -Math.sign(cx) || 1;
        const dy = -Math.sign(cy) || 1;
        const dz = -Math.sign(cz) || 1;
        const bracketGeo = createCornerBracketGeometry(dx, dy, dz);
        const bracketMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(cx, cy + hh + GRID_Y, cz);
        bracket.userData = { isCornerHandle: true, index: idx };
        bracket.visible = showHandlesRef.current;
        group.add(bracket);
        cornerHandlesRef.current.push(bracket);
      });

      // Dimension labels on 3D edges (Angka pada sisi 3D)
      const u = unit || "cm";
      const pVal = paramA || 10;
      const lVal = paramB || 6;
      const tVal = paramC || 4;
      // Tulang panjang depan
      const dimP = createDimensionSprite(`p = ${pVal} ${u}`, isDark);
      dimP.position.set(0, GRID_Y + 0.14, hd + 0.10);
      group.add(dimP);

      // Tulang lebar samping kanan
      const dimL = createDimensionSprite(`l = ${lVal} ${u}`, isDark);
      dimL.position.set(hw + 0.14, GRID_Y + 0.14, 0);
      group.add(dimL);

      // Tulang tinggi tegak depan-kiri
      const dimT = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
      dimT.position.set(-hw - 0.16, hh + GRID_Y, hd);
      group.add(dimT);
    }

    // 3. CYLINDER / TABUNG
    else if (activeModel === "cylinder") {
      const r = Math.max(0.8, Math.min(2.8, (paramA / 7) * 1.6));
      const h = Math.max(1.2, Math.min(4.8, (paramB / 12) * 3.2));
      const geo = new THREE.CylinderGeometry(r, r, h, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: wireframe ? 0.05 : 0.55,
        roughness: 0.15,
        metalness: 0.05,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, h / 2 + GRID_Y, 0);
      addEdges(mesh, geo, 0x22d3ee);
      group.add(mesh);

      cornerHandlesRef.current = [];
      const handleGeo = createCornerBracketGeometry(1, -1, 1, 0.24, 0.038);
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
      const topHandle = new THREE.Mesh(handleGeo, handleMat);
      topHandle.position.set(r, h + GRID_Y, 0);
      topHandle.userData = { isCornerHandle: true, index: 0 };
      topHandle.visible = showHandlesRef.current;
      group.add(topHandle);
      cornerHandlesRef.current.push(topHandle);

      // Dimension labels on Tabung (Tulang jari-jari & tinggi)
      const u = unit || "cm";
      const rVal = paramA || 7;
      const tVal = paramB || 12;

      // Garis tulang jari-jari pada tutup atas
      const radPts = [new THREE.Vector3(0, h + GRID_Y, 0), new THREE.Vector3(r, h + GRID_Y, 0)];
      const radGeo = new THREE.BufferGeometry().setFromPoints(radPts);
      const radMat = new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 0.12, gapSize: 0.08 });
      const radLine = new THREE.Line(radGeo, radMat);
      radLine.computeLineDistances();
      group.add(radLine);

      const dimR = createDimensionSprite(`r = ${rVal} ${u}`, isDark);
      dimR.position.set(r / 2, h + GRID_Y + 0.16, 0);
      group.add(dimR);

      // Mengikuti siluet tulang tinggi sisi kiri
      const dimH = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
      dimH.position.set(-r - 0.16, h / 2 + GRID_Y, 0);
      group.add(dimH);
    }

    // 4. CONIC SLICER (IRISAN KERUCUT)
    else if (activeModel === "conic_slicer") {
      const coneR = 2.4;
      const coneH = 4.8;
      const coneGeo = new THREE.ConeGeometry(coneR, coneH, 36, 1, true);
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, coneH / 2 + GRID_Y, 0);
      addEdges(coneMesh, coneGeo, 0x818cf8);
      group.add(coneMesh);

      if (showSlicePlane) {
        const planeGeo = new THREE.PlaneGeometry(3.6, 3.6);
        const planeMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.position.set(0, 2.2 + GRID_Y, 0);
        planeMesh.rotation.x = sliceProgress * 1.5;
        group.add(planeMesh);
      }
    }

    // 5. SADDLE SURFACE (PELANA z = x^2 - y^2)
    else if (activeModel === "saddle") {
      const size = 3.6;
      const segments = 40;
      const geo = new THREE.PlaneGeometry(size, size, segments, segments);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = 0.35 * (x * x - y * y);
        pos.setZ(i, z);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        side: THREE.DoubleSide,
        wireframe,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 1.5 + GRID_Y, 0);
      group.add(mesh);
    }

    // 6. SOLIDS LAINNYA (BOLA, KERUCUT, LIMAS)
    else if (activeModel === "solids") {
      let geo: THREE.BufferGeometry;
      const radius = Math.max(0.8, Math.min(3.0, (paramA / 7) * 2.0));
      if (solidKind === "bola") {
        geo = new THREE.SphereGeometry(radius, 48, 36);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.6,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, radius + GRID_Y, 0);
        addEdges(mesh, geo, 0x67e8f9);
        group.add(mesh);

        cornerHandlesRef.current = [];
        const sphereHandleGeo = createCornerBracketGeometry(1, 1, 1, 0.24, 0.038);
        const sphereHandleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x67e8f9, emissiveIntensity: 0.5 });
        const dot = new THREE.Mesh(sphereHandleGeo, sphereHandleMat);
        dot.position.set(radius, radius + GRID_Y, 0);
        dot.userData = { isCornerHandle: true, index: 0 };
        dot.visible = showHandlesRef.current;
        group.add(dot);
        cornerHandlesRef.current.push(dot);

        // Garis tulang jari-jari bola dari pusat ke permukaan
        const sphereRPts = [new THREE.Vector3(0, radius + GRID_Y, 0), new THREE.Vector3(radius, radius + GRID_Y, 0)];
        const sphereRGeo = new THREE.BufferGeometry().setFromPoints(sphereRPts);
        const sphereRMat = new THREE.LineDashedMaterial({ color: 0x67e8f9, dashSize: 0.1, gapSize: 0.06 });
        const sphereRLine = new THREE.Line(sphereRGeo, sphereRMat);
        sphereRLine.computeLineDistances();
        group.add(sphereRLine);

        // Dimension label on Bola (Mengikuti tulang jari-jari)
        const u = unit || "cm";
        const rVal = paramA || 7;
        const dimR = createDimensionSprite(`r = ${rVal} ${u}`, isDark);
        dimR.position.set(radius / 2, radius + GRID_Y + 0.16, 0);
        group.add(dimR);
      } else if (solidKind === "kerucut") {
        const coneR = Math.max(1.2, Math.min(3.0, (paramA / 7) * 1.8));
        const coneH = Math.max(1.8, Math.min(4.8, ((paramB || 10) / 10) * 3.2));
        geo = new THREE.ConeGeometry(coneR, coneH, 36);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.6,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, coneH / 2 + GRID_Y, 0);
        addEdges(mesh, geo, 0x67e8f9);
        group.add(mesh);

        // Tulang tinggi tegak putus-putus di pusat kerucut
        const coneHPts = [new THREE.Vector3(0, GRID_Y, 0), new THREE.Vector3(0, coneH + GRID_Y, 0)];
        const coneHGeo = new THREE.BufferGeometry().setFromPoints(coneHPts);
        const coneHMat = new THREE.LineDashedMaterial({ color: 0x67e8f9, dashSize: 0.12, gapSize: 0.08 });
        const coneHLine = new THREE.Line(coneHGeo, coneHMat);
        coneHLine.computeLineDistances();
        group.add(coneHLine);

        // Tulang jari-jari pada alas kerucut
        const coneRPts = [new THREE.Vector3(0, GRID_Y, 0), new THREE.Vector3(coneR, GRID_Y, 0)];
        const coneRGeo = new THREE.BufferGeometry().setFromPoints(coneRPts);
        const coneRMat = new THREE.LineDashedMaterial({ color: 0x67e8f9, dashSize: 0.1, gapSize: 0.06 });
        const coneRLine = new THREE.Line(coneRGeo, coneRMat);
        coneRLine.computeLineDistances();
        group.add(coneRLine);

        const u = unit || "cm";
        const rVal = paramA || 7;
        const tVal = paramB || 10;
        const dimR = createDimensionSprite(`r = ${rVal} ${u}`, isDark);
        dimR.position.set(coneR / 2, GRID_Y + 0.14, 0);
        group.add(dimR);

        const dimT = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
        dimT.position.set(0.38, coneH / 2 + GRID_Y, 0);
        group.add(dimT);
      } else if (solidKind === "prisma" || solidKind === "prisma_segilima" || solidKind === "prisma_segienam" || solidKind === "prisma_poligon") {
        const prismSides = solidKind === "prisma" ? 3 : solidKind === "prisma_segilima" ? 5 : solidKind === "prisma_segienam" ? 6 : (paramC || 6);
        const prismR = Math.max(1.2, Math.min(3.5, (paramA / 8) * 1.8));
        const prismH = Math.max(1.8, Math.min(5.0, ((paramB || 10) / 10) * 3.0));
        geo = new THREE.CylinderGeometry(prismR, prismR, prismH, prismSides);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.45,
          roughness: 0.15,
          metalness: 0.08,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, prismH / 2 + GRID_Y, 0);
        mesh.rotation.y = prismSides === 3 ? Math.PI / 6 : Math.PI / prismSides;
        addEdges(mesh, geo, 0x38bdf8);
        group.add(mesh);

        // Corner handles with 3-Axis Angle Brackets (Sudut Siku) di tiap sudut alas/tutup
        cornerHandlesRef.current = [];
        for (let i = 0; i < prismSides; i++) {
          const angle = (i * 2 * Math.PI) / prismSides + (prismSides === 3 ? Math.PI / 6 : Math.PI / prismSides);
          const vx = prismR * Math.sin(angle);
          const vz = prismR * Math.cos(angle);
          const dx = -Math.sign(vx) || 1;
          const dz = -Math.sign(vz) || 1;
          // Bottom bracket
          const bGeo = createCornerBracketGeometry(dx, 1, dz, 0.22, 0.035);
          const bMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.set(vx, GRID_Y, vz);
          bMesh.userData = { isCornerHandle: true, index: i };
          bMesh.visible = showHandlesRef.current;
          group.add(bMesh);
          cornerHandlesRef.current.push(bMesh);

          // Top bracket
          const tGeo = createCornerBracketGeometry(dx, -1, dz, 0.22, 0.035);
          const tMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 });
          const tMesh = new THREE.Mesh(tGeo, tMat);
          tMesh.position.set(vx, prismH + GRID_Y, vz);
          tMesh.userData = { isCornerHandle: true, index: i + prismSides };
          tMesh.visible = showHandlesRef.current;
          group.add(tMesh);
          cornerHandlesRef.current.push(tMesh);
        }

        // Dimension labels on Prisma (Mengikuti tulang alas dan tulang tinggi tegak)
        const u = unit || "cm";
        const sVal = paramA || 8;
        const tVal = paramB || 10;
        const dimBase = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
        dimBase.position.set(0, GRID_Y + 0.14, (prismSides === 3 ? prismR * 0.866 : prismR * Math.cos(Math.PI / prismSides)) + 0.10);
        group.add(dimBase);

        const dimHeight = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
        if (prismSides === 3) {
          dimHeight.position.set(-prismR * 0.5 - 0.16, prismH / 2 + GRID_Y, prismR * 0.866);
        } else {
          dimHeight.position.set(-prismR - 0.30, prismH / 2 + GRID_Y, 0);
        }
        group.add(dimHeight);

        if (showSlicePlane) {
          const planeSize = Math.max(prismR, prismH) * 1.8;
          const sliceGeo = new THREE.PlaneGeometry(planeSize, planeSize);
          const sliceMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.68,
            roughness: 0.2,
          });
          const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat);
          sliceMesh.rotation.x = Math.PI / 4;
          sliceMesh.position.set(0, (sliceProgress - 0.5) * prismH + prismH / 2 + GRID_Y, 0);
          addEdges(sliceMesh, sliceGeo, 0xffffff);
          group.add(sliceMesh);
        }
      } else if (solidKind === "limas") {
        const pyrR = Math.max(1.4, Math.min(3.8, (paramA / 8) * 2.0));
        const pyrH = Math.max(1.8, Math.min(5.0, ((paramB || 10) / 10) * 3.0));
        geo = new THREE.ConeGeometry(pyrR, pyrH, 4);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.45,
          roughness: 0.15,
          metalness: 0.08,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, pyrH / 2 + GRID_Y, 0);
        mesh.rotation.y = Math.PI / 4;
        addEdges(mesh, geo, 0x38bdf8);
        group.add(mesh);

        // 5 Handles: apex + 4 base corners with corner brackets
        cornerHandlesRef.current = [];
        const apexGeo = new THREE.ConeGeometry(0.12, 0.22, 4);
        const apexMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x38bdf8, emissiveIntensity: 0.6 });
        const apex = new THREE.Mesh(apexGeo, apexMat);
        apex.position.set(0, pyrH + GRID_Y + 0.1, 0);
        apex.userData = { isCornerHandle: true, index: 0 };
        apex.visible = showHandlesRef.current;
        group.add(apex);
        cornerHandlesRef.current.push(apex);

        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + Math.PI / 4;
          const bx = pyrR * Math.cos(angle);
          const bz = pyrR * Math.sin(angle);
          const dx = -Math.sign(bx) || 1;
          const dz = -Math.sign(bz) || 1;
          const bGeo = createCornerBracketGeometry(dx, 1, dz, 0.24, 0.035);
          const bMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.set(bx, GRID_Y, bz);
          bMesh.userData = { isCornerHandle: true, index: i + 1 };
          bMesh.visible = showHandlesRef.current;
          group.add(bMesh);
          cornerHandlesRef.current.push(bMesh);
        }

        // Dimension labels on Limas - mengikuti tulang alas dan tulang sumbu tinggi tegak
        const u = unit || "cm";
        const sVal = paramA || 8;
        const tVal = paramB || 10;

        // 1. Tulang alas depan: titik tengah rusuk alas depan di z = pyrR / sqrt(2)
        const frontEdgeZ = pyrR / Math.SQRT2;
        const dimBase = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
        dimBase.position.set(0, GRID_Y + 0.14, frontEdgeZ + 0.10);
        group.add(dimBase);

        // 2. Tulang sumbu tinggi tegak (dashed line dari pusat alas ke puncak)
        const pyrHPts = [new THREE.Vector3(0, GRID_Y, 0), new THREE.Vector3(0, pyrH + GRID_Y, 0)];
        const pyrHGeo = new THREE.BufferGeometry().setFromPoints(pyrHPts);
        const pyrHMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.12, gapSize: 0.08 });
        const pyrHLine = new THREE.Line(pyrHGeo, pyrHMat);
        pyrHLine.computeLineDistances();
        group.add(pyrHLine);

        // Penanda siku-siku di pusat alas
        const sq = 0.22;
        const sqGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sq, GRID_Y, 0),
          new THREE.Vector3(sq, GRID_Y + sq, 0),
          new THREE.Vector3(0, GRID_Y + sq, 0),
        ]);
        const sqMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
        group.add(new THREE.Line(sqGeo, sqMat));

        // Label tinggi t tepat di samping tulang tinggi tegak
        const dimHeight = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
        dimHeight.position.set(0.38, pyrH / 2 + GRID_Y, 0);
        group.add(dimHeight);

        if (showSlicePlane) {
          const planeSize = Math.max(pyrR, pyrH) * 1.8;
          const sliceGeo = new THREE.PlaneGeometry(planeSize, planeSize);
          const sliceMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.68,
            roughness: 0.2,
          });
          const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat);
          sliceMesh.rotation.x = Math.PI / 4;
          sliceMesh.position.set(0, (sliceProgress - 0.5) * pyrH + pyrH / 2 + GRID_Y, 0);
          addEdges(sliceMesh, sliceGeo, 0xffffff);
          group.add(sliceMesh);
        }
      } else if (solidKind === "limas_poligon") {
        const nSeg = paramC || 6;
        const pyrR = Math.max(1.4, Math.min(3.8, (paramA / 8) * 2.0));
        const pyrH = Math.max(1.8, Math.min(5.0, ((paramB || 10) / 10) * 3.0));
        geo = new THREE.ConeGeometry(pyrR, pyrH, nSeg);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.45,
          roughness: 0.15,
          metalness: 0.08,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, pyrH / 2 + GRID_Y, 0);
        mesh.rotation.y = Math.PI / nSeg;
        addEdges(mesh, geo, 0x38bdf8);
        group.add(mesh);

        cornerHandlesRef.current = [];
        const apexGeo = new THREE.ConeGeometry(0.12, 0.22, 4);
        const apexMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x38bdf8, emissiveIntensity: 0.6 });
        const apex = new THREE.Mesh(apexGeo, apexMat);
        apex.position.set(0, pyrH + GRID_Y + 0.1, 0);
        apex.userData = { isCornerHandle: true, index: 0 };
        apex.visible = showHandlesRef.current;
        group.add(apex);
        cornerHandlesRef.current.push(apex);

        for (let i = 0; i < nSeg; i++) {
          const angle = (i * 2 * Math.PI) / nSeg + Math.PI / nSeg;
          const bx = pyrR * Math.sin(angle);
          const bz = pyrR * Math.cos(angle);
          const dx = -Math.sign(bx) || 1;
          const dz = -Math.sign(bz) || 1;
          const bGeo = createCornerBracketGeometry(dx, 1, dz, 0.24, 0.035);
          const bMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.set(bx, GRID_Y, bz);
          bMesh.userData = { isCornerHandle: true, index: i + 1 };
          bMesh.visible = showHandlesRef.current;
          group.add(bMesh);
          cornerHandlesRef.current.push(bMesh);
        }

        const u = unit || "cm";
        const sVal = paramA || 8;
        const tVal = paramB || 10;
        const frontEdgeZ = pyrR * Math.cos(Math.PI / nSeg);
        const dimBase = createDimensionSprite(`s = ${sVal} ${u}`, isDark);
        dimBase.position.set(0, GRID_Y + 0.14, frontEdgeZ + 0.10);
        group.add(dimBase);

        const pyrHPts = [new THREE.Vector3(0, GRID_Y, 0), new THREE.Vector3(0, pyrH + GRID_Y, 0)];
        const pyrHGeo = new THREE.BufferGeometry().setFromPoints(pyrHPts);
        const pyrHMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.12, gapSize: 0.08 });
        const pyrHLine = new THREE.Line(pyrHGeo, pyrHMat);
        pyrHLine.computeLineDistances();
        group.add(pyrHLine);

        const dimHeight = createDimensionSprite(`t = ${tVal} ${u}`, isDark);
        dimHeight.position.set(0.38, pyrH / 2 + GRID_Y, 0);
        group.add(dimHeight);
      } else {
        geo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: wireframe ? 0.05 : 0.6,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 1.25 + GRID_Y, 0);
        addEdges(mesh, geo, 0x67e8f9);
        group.add(mesh);
      }
    }

    // Proxy sentuh tak terlihat di tiap bracket sudut: area tangkap tarik jauh lebih besar
    if (cornerHandlesRef.current.length > 0) {
      const proxies: THREE.Mesh[] = [];
      cornerHandlesRef.current.forEach((bracket) => {
        const parent = bracket.parent as THREE.Group | null;
        if (!parent) return;
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        proxy.position.copy(bracket.position);
        proxy.userData = { isCornerHandle: true, bracketRef: bracket };
        proxy.visible = showHandlesRef.current;
        parent.add(proxy);
        proxies.push(proxy);
      });
      cornerHandlesRef.current = [...cornerHandlesRef.current, ...proxies];
    }
  }, [activeModel, solidKind, showSlicePlane, sliceProgress, wireframe, is3DModel, paramA, paramB, paramC, isDark, unit, showHandles]);

  // Init Three.js container
  useEffect(() => {
    const container = container3DRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const isDarkInitial = typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true;
    const bgColor = isProjectorMode ? 0x0a101f : isDarkInitial ? 0x080a0f : 0xf8fafc;
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    const initialWidth = container.clientWidth > 0 ? container.clientWidth : 600;
    const initialHeight = container.clientHeight > 0 ? container.clientHeight : 400;

    const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 1000);
    camera.position.set(6.5, 5.5, 8.5);
    // Pratinjau landing: dekatkan kamera agar kubus tampil lebih besar.
    const previewZoom = preview?.cameraZoom ?? 1;
    if (previewZoom > 0 && previewZoom !== 1) {
      camera.position.multiplyScalar(1 / previewZoom);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    // Pratinjau landing: roda mouse tidak dipakai zoom, supaya halaman tetap bisa digulir.
    controls.enableZoom = !preview?.disableWheel;
    controlsRef.current = controls;

    // Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(10, 16, 12);
    scene.add(dirLight1);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    const gridColor1 = isDarkInitial ? 0x1e293b : 0xcbd5e1;
    const gridColor2 = isDarkInitial ? 0x0f172a : 0xe2e8f0;
    const gridHelper = new THREE.GridHelper(10, 20, gridColor1, gridColor2);
    gridHelper.position.y = GRID_Y;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Synchronously populate the newly mounted meshGroup
    rebuildMeshes();

    // Render loop yang benar-benar bisa dijeda: stop() membatalkan frame yang
    // masih tertunda (bukan hanya melewati isi frame), start() menjadwalkan
    // ulang dan langsung menggambar satu frame agar kanvas tidak pernah kosong
    // saat dilanjutkan.
    let loopRunning = false;
    const animate = () => {
      if (!loopRunning) return;
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (scrollRenderPausedRef.current) return;
      controls.update();
      if (selectionBoxRef.current && selectedSolidRef.current) selectionBoxRef.current.update();
      renderer.render(scene, camera);
    };
    const startRenderLoop = () => {
      if (loopRunning) return;
      loopRunning = true;
      animate();
    };
    const stopRenderLoop = () => {
      loopRunning = false;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
    renderLoopControlRef.current = { start: startRenderLoop, stop: stopRenderLoop };
    startRenderLoop();

    // =========================================================================
    // Direct Mouse Corner Drag to Scale
    // =========================================================================
    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingCornerRef.current) {
        const dx = e.clientX - dragStartDataRef.current.clientX;
        const dy = e.clientY - dragStartDataRef.current.clientY;
        const diff = (dx - dy) * 0.045;
        const newA = Math.max(1, Math.min(50, Math.round(dragStartDataRef.current.initialParamA + diff)));
        if (newA !== paramARef.current) {
          paramARef.current = newA;
          setParamA(newA);
          onParamsChangeRef.current?.(newA, paramBRef.current, paramCRef.current, unitRef.current);
        }
        return;
      }

      if (!container || !camera || isDrawingToolActiveRef.current || !showHandlesRef.current) return;
      const rect = container.getBoundingClientRect();
      mouseVecRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVecRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseVecRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(cornerHandlesRef.current, false);

      if (intersects.length > 0) {
        const hitObj = intersects[0].object as THREE.Mesh;
        const hit = (hitObj.userData.bracketRef as THREE.Mesh) || hitObj;
        container.style.cursor = "nwse-resize";
        if (hoveredCornerRef.current !== hit) {
          if (hoveredCornerRef.current) {
            hoveredCornerRef.current.scale.set(1, 1, 1);
            const m = hoveredCornerRef.current.material as THREE.MeshStandardMaterial;
            if (m && m.emissive) { m.emissive.setHex(0x38bdf8); m.emissiveIntensity = 0.4; }
          }
          hoveredCornerRef.current = hit;
          hit.scale.set(1.6, 1.6, 1.6);
          const m = hit.material as THREE.MeshStandardMaterial;
          if (m && m.emissive) { m.emissive.setHex(0xf43f5e); m.emissiveIntensity = 0.9; }
        }
      } else {
        container.style.cursor = isDrawingToolActiveRef.current ? "crosshair" : "default";
        if (hoveredCornerRef.current) {
          hoveredCornerRef.current.scale.set(1, 1, 1);
          const m = hoveredCornerRef.current.material as THREE.MeshStandardMaterial;
          if (m && m.emissive) { m.emissive.setHex(0x38bdf8); m.emissiveIntensity = 0.4; }
          hoveredCornerRef.current = null;
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!container || !camera || isDrawingToolActiveRef.current || !showHandlesRef.current) return;
      const rect = container.getBoundingClientRect();
      mouseVecRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVecRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseVecRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(cornerHandlesRef.current, false);

      if (intersects.length > 0) {
        isDraggingCornerRef.current = true;
        dragStartDataRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          initialParamA: paramARef.current,
        };
        const hitObj = intersects[0].object as THREE.Mesh;
        const visual = (hitObj.userData.bracketRef as THREE.Mesh) || hitObj;
        draggingVisualRef.current = visual;
        visual.scale.set(1.8, 1.8, 1.8);
        const vm = visual.material as THREE.MeshStandardMaterial;
        if (vm && vm.emissive) { vm.emissive.setHex(0xf43f5e); vm.emissiveIntensity = 1.15; }
        controls.enabled = false;
        container.style.cursor = "nwse-resize";
      }
    };

    const onPointerUp = () => {
      if (isDraggingCornerRef.current) {
        isDraggingCornerRef.current = false;
        controls.enabled = true;
        if (draggingVisualRef.current) {
          draggingVisualRef.current.scale.set(1, 1, 1);
          const vm = draggingVisualRef.current.material as THREE.MeshStandardMaterial;
          if (vm && vm.emissive) { vm.emissive.setHex(0x38bdf8); vm.emissiveIntensity = 0.5; }
          draggingVisualRef.current = null;
        }
        if (container) {
          container.style.cursor = isDrawingToolActiveRef.current ? "crosshair" : "default";
        }
      }
    };

    // Klik objek 3D = terpilih (kotak penanda mengikuti bentuk); klik area kosong = lepas
    const selectDownPos = { x: 0, y: 0 };
    const onSelectDown = (e: PointerEvent) => {
      selectDownPos.x = e.clientX;
      selectDownPos.y = e.clientY;
    };
    const clearSelectionBox = () => {
      if (selectionBoxRef.current) {
        scene.remove(selectionBoxRef.current);
        selectionBoxRef.current.geometry.dispose();
        (selectionBoxRef.current.material as THREE.Material).dispose();
        selectionBoxRef.current = null;
      }
      selectedSolidRef.current = false;
    };
    const onSelectUp = (e: PointerEvent) => {
      if (isDraggingCornerRef.current || isDrawingToolActiveRef.current || isTypingToolActiveRef.current) return;
      if (Math.hypot(e.clientX - selectDownPos.x, e.clientY - selectDownPos.y) > 6 || !container || !camera) return;
      const rect = container.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      mouseVecRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVecRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseVecRef.current, camera);
      const group = meshGroupRef.current;
      let hitSolid = false;
      if (group) {
        const hits = raycasterRef.current.intersectObjects(group.children, true);
        hitSolid = hits.some((h) => {
          const o = h.object as THREE.Mesh & { isSprite?: boolean; isLine?: boolean };
          if (!o.isMesh || o.isSprite || o.isLine) return false;
          if (o.userData && o.userData.isCornerHandle) return false;
          const om = o.material as THREE.Material | undefined;
          if (om && !Array.isArray(om) && om.transparent && om.opacity === 0) return false;
          return true;
        });
      }
      if (hitSolid && group) {
        clearSelectionBox();
        const box = new THREE.BoxHelper(group, new THREE.Color(myColorRef.current));
        scene.add(box);
        selectionBoxRef.current = box;
        selectedSolidRef.current = true;
      } else {
        clearSelectionBox();
      }
    };

    const onPointerLeaveContainer = () => {
      if (hoveredCornerRef.current) {
        hoveredCornerRef.current.scale.set(1, 1, 1);
        const m = hoveredCornerRef.current.material as THREE.MeshStandardMaterial;
        if (m && m.emissive) {
          m.emissive.setHex(0x38bdf8);
          m.emissiveIntensity = 0.4;
        }
        hoveredCornerRef.current = null;
      }
      if (container) {
        container.style.cursor = isDrawingToolActiveRef.current ? "crosshair" : "default";
      }
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerdown", onSelectDown);
    container.addEventListener("pointerleave", onPointerLeaveContainer);
    window.addEventListener("pointerup", onSelectUp);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth > 0 ? container.clientWidth : 600;
      const h = container.clientHeight > 0 ? container.clientHeight : 400;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      // Panel sempit: jauhkan kamera sedikit agar label dimensi tidak terpotong tepi kanvas
      const f = w < 540 ? 1.3 : 1.0;
      if (framingFactorRef.current !== f) {
        const off = camera.position.clone().sub(controls.target).multiplyScalar(f / framingFactorRef.current);
        camera.position.copy(controls.target).add(off);
        framingFactorRef.current = f;
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    handleResize();
    const t1 = setTimeout(handleResize, 60);
    const t2 = setTimeout(handleResize, 220);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      stopRenderLoop();
      renderLoopControlRef.current = null;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerdown", onSelectDown);
      container.removeEventListener("pointerleave", onPointerLeaveContainer);
      window.removeEventListener("pointerup", onSelectUp);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      meshGroupRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // Pantau visibilitas halaman: tab browser yang disembunyikan menghentikan
  // render loop sampai tab terlihat kembali.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncVisibility = () => {
      setIsPageHidden(document.visibilityState === "hidden" || document.hidden);
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  // Pantau apakah viewport kanvas masih terlihat. Kanvas yang di-scroll keluar
  // layar (mis. layout bertumpuk di layar kecil) tidak perlu merender frame.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const node = container3DRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setIsCanvasInView(entry.isIntersecting));
      },
      { rootMargin: "0px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Satu tempat yang memutuskan kapan render loop 3D boleh berjalan. Frame
  // yang sedang tertunda dibatalkan (cancelAnimationFrame) saat dijeda dan
  // dijadwalkan ulang saat dilanjutkan — perilaku kanvas tidak berubah.
  useEffect(() => {
    const loop = renderLoopControlRef.current;
    if (!loop) return;
    if (paused || !is3DModel || !isCanvasInView || isPageHidden) {
      loop.stop();
    } else {
      loop.start();
    }
  }, [paused, is3DModel, isCanvasInView, isPageHidden]);

  // Lewati penggambaran WebGL selama gulir (khusus pratinjau landing). Tanpa
  // setState: hanya menyalakan flag ref yang dibaca render loop.
  useEffect(() => {
    if (!pauseOnScroll) return;
    let timer: number | undefined;
    const onScroll = () => {
      scrollRenderPausedRef.current = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scrollRenderPausedRef.current = false;
      }, 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      scrollRenderPausedRef.current = false;
    };
  }, [pauseOnScroll]);

  // Update autoRotate without re-mounting Three.js
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update background and grid when projector mode or theme changes
  useEffect(() => {
    if (sceneRef.current) {
      const bgColor = isProjectorMode ? 0x0a101f : isDark ? 0x080a0f : 0xf8fafc;
      sceneRef.current.background = new THREE.Color(bgColor);

      if (gridHelperRef.current) {
        sceneRef.current.remove(gridHelperRef.current);
        gridHelperRef.current.geometry.dispose();
        const mat = gridHelperRef.current.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();

        const gridColor1 = isDark ? 0x1e293b : 0xcbd5e1;
        const gridColor2 = isDark ? 0x0f172a : 0xe2e8f0;
        const nextGrid = new THREE.GridHelper(10, 20, gridColor1, gridColor2);
        nextGrid.position.y = GRID_Y;
        sceneRef.current.add(nextGrid);
        gridHelperRef.current = nextGrid;
      }
    }
  }, [isProjectorMode, isDark]);

  // When model switches to 3D, ensure dimensions are fresh
  useEffect(() => {
    if (is3DModel && container3DRef.current && rendererRef.current && cameraRef.current) {
      const container = container3DRef.current;
      const w = container.clientWidth > 0 ? container.clientWidth : 600;
      const h = container.clientHeight > 0 ? container.clientHeight : 400;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    }
  }, [is3DModel]);

  useEffect(() => {
    rebuildMeshes();
  }, [rebuildMeshes]);

  // Board workspace pointer handlers (inline composer on click / marquee selection on drag)
  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingToolActive) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("textarea") || target.closest(".liquid-glass-popup")) return;

    const boardEl = boardWorkspaceRef.current;
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;
    lastBoardPointerPctRef.current = { x: pctX, y: pctY };

    // If an inline composer is already open and the user clicks outside it on the canvas:
    if (inlineComposer) {
      e.preventDefault();
      if (inlineComposer.text.trim()) {
        commitInlineComposer();
        return;
      }
      if (isTypingToolActive) {
        setInlineComposer({
          x: Math.max(4, Math.min(78, pctX)),
          y: Math.max(6, Math.min(78, pctY)),
          text: "",
        });
        setSelectedFormulaId(null);
        setSelectedImageId(null);
        return;
      }
      setInlineComposer(null);
      return;
    }

    // If Typing tool is active, clicking canvas opens inline composer directly at clicked spot!
    if (isTypingToolActive) {
      e.preventDefault();
      setInlineComposer({
        x: Math.max(4, Math.min(78, pctX)),
        y: Math.max(6, Math.min(78, pctY)),
        text: "",
      });
      setSelectedFormulaId(null);
      setSelectedImageId(null);
      return;
    }

    // If clicked outside any formula note or pasted image, deselect and start marquee drag
    if (!target.closest("[data-formula-card]") && !target.closest("[data-board-image]")) {
      setSelectedFormulaId(null);
      setSelectedImageId(null);
      setSelectionMarquee({
        startX: pctX,
        startY: pctY,
        currentX: pctX,
        currentY: pctY,
      });
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const boardEl = boardWorkspaceRef.current;
    if (boardEl) {
      const rect = boardEl.getBoundingClientRect();
      lastBoardPointerPctRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    }
    if (!selectionMarquee || !boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    setSelectionMarquee((prev) => (prev ? { ...prev, currentX: pctX, currentY: pctY } : null));
  };

  const handleBoardPointerUp = () => {
    if (selectionMarquee) {
      const minX = Math.min(selectionMarquee.startX, selectionMarquee.currentX);
      const maxX = Math.max(selectionMarquee.startX, selectionMarquee.currentX);
      const minY = Math.min(selectionMarquee.startY, selectionMarquee.currentY);
      const maxY = Math.max(selectionMarquee.startY, selectionMarquee.currentY);

      if (maxX - minX > 2 || maxY - minY > 2) {
        const hit = formulaNotes.find((note) => {
          return note.x >= minX - 12 && note.x <= maxX && note.y >= minY - 6 && note.y <= maxY;
        });
        if (hit) {
          setSelectedFormulaId(hit.id);
          setSelectedImageId(null);
        } else {
          const hitImg = boardImages.find((img) => {
            return img.x >= minX - 20 && img.x <= maxX && img.y >= minY - 15 && img.y <= maxY;
          });
          if (hitImg) {
            setSelectedImageId(hitImg.id);
            setSelectedFormulaId(null);
          }
        }
      }
      setSelectionMarquee(null);
    }
  };

  const handleBoardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleBoardDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const boardEl = boardWorkspaceRef.current;
    let pctX = 25;
    let pctY = 20;
    if (boardEl) {
      const rect = boardEl.getBoundingClientRect();
      pctX = ((e.clientX - rect.left) / rect.width) * 100;
      pctY = ((e.clientY - rect.top) / rect.height) * 100;
    }
    imageFiles.forEach((file, idx) => {
      addImageFileToBoard(file, pctX + idx * 4, pctY + idx * 4);
    });
  };

  const handleBoardDoubleClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingToolActive) return;
    const boardEl = boardWorkspaceRef.current;
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;
    setInlineComposer({ x: Math.max(2, Math.min(75, pctX)), y: Math.max(2, Math.min(75, pctY)), text: "" });
  };

  // 2D Canvas Interactive Zoom & Pan Handlers
  const handleWheel2D = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom2D((prev) => Math.max(0.2, Math.min(8, prev * factor)));
  };

  const handle2DPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingToolActive || isTypingToolActive) return;
    isPanning2DRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: pan2D.x,
      initialPanY: pan2D.y,
    };
  };

  const handle2DPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPanning2DRef.current || isDrawingToolActive || isTypingToolActive) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan2D({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy,
    });
  };

  const handle2DPointerUp = () => {
    isPanning2DRef.current = false;
  };

  // Status apakah teks sambutan & preset papan kosong boleh ditampilkan:
  // Hilang secara otomatis jika pengguna mulai mencoret kanvas, mengetik rumus, menempelkan gambar, atau mengaktifkan alat pena/ketik
  const showEmptyBoardPlaceholder =
    activeModel === "empty" &&
    !hasDrawings &&
    formulaNotes.length === 0 &&
    boardImages.length === 0 &&
    !inlineComposer &&
    !isTypingToolActive &&
    !(isDrawingToolActive && drawingMode === "pen");

  // =========================================================================
  // RENDER PANDANGAN UTAMA PAPAN TULIS VIRTUAL
  // =========================================================================
  return (
    <div className={`relative w-full h-full flex flex-col dark:bg-[#080a0f] bg-slate-50 dark:text-zinc-100 text-slate-800 select-none overflow-hidden font-sans ${className}`}>
      {/* Hidden File Input for Image Upload onto Smartboard */}
      <input
        ref={boardImageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          Array.from(files).forEach((file, idx) => {
            addImageFileToBoard(file, 24 + idx * 4, 20 + idx * 4);
          });
          e.target.value = "";
        }}
      />

      {/* 1. TOP HEADER RAMPING: pemilih mode saja - semua ALAT pindah ke dock bawah (gaya Figma) */}
      <div className="h-12 px-2.5 sm:px-4 border-b dark:border-white/[0.08] border-slate-200 dark:bg-[#0d0f17] bg-white flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 z-[35]">
        {/* Left: Mode Picker Segmented Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center dark:bg-white/[0.04] bg-slate-100 p-0.5 rounded-xl border dark:border-white/[0.08] border-slate-200">
            <button
              type="button"
              onClick={() => (preview?.onSceneChange ? preview.onSceneChange("3d") : selectModel(last3DModelRef.current))}
              className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                is3DModel
                  ? "bg-white dark:bg-white/[0.16] text-slate-900 dark:text-white shadow-sm font-semibold"
                  : "dark:text-zinc-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
              }`}
              title="Geometri 3D Ruang"
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3D</span>
            </button>
            <button
              type="button"
              onClick={() => (preview?.onSceneChange ? preview.onSceneChange("2d") : selectModel(last2DModelRef.current))}
              className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                is2DGraphModel
                  ? "bg-white dark:bg-white/[0.16] text-slate-900 dark:text-white shadow-sm font-semibold"
                  : "dark:text-zinc-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
              }`}
              title="Grafik 2D Kartesius"
            >
              <span className="font-mono text-xs">2D</span>
            </button>
            <button
              type="button"
              onClick={() => (preview?.onSceneChange ? preview.onSceneChange("papan") : selectModel("empty"))}
              className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                activeModel === "empty"
                  ? "bg-white dark:bg-white/[0.16] text-slate-900 dark:text-white shadow-sm font-semibold"
                  : "dark:text-zinc-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
              }`}
              title="Papan Tulis"
            >
              <span className="text-xs">Papan</span>
            </button>
          </div>

        </div>

        <div className="flex-1" />

        {/* Right: Proyektor + Tutup saja */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Bagikan Papan: kolaborasi realtime satu ruang */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSharePanel((v) => !v)}
              className={`h-9 ${collabRoom ? "w-auto px-2.5" : "w-9"} flex items-center justify-center gap-1.5 rounded-xl border transition cursor-pointer ${
                collabRoom
                  ? "text-white border-transparent shadow-sm"
                  : "dark:bg-white/[0.04] bg-slate-100 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white dark:border-white/[0.06] border-slate-200"
              }`}
              style={collabRoom ? { background: myColor } : undefined}
              title={collabRoom ? `Ruang ${collabRoom}: ${collabPeers.length} orang sedang di papan` : "Bagikan papan: gambar bareng teman secara realtime"}
            >
              <Users className="w-4 h-4" />
              {collabRoom && <span className="text-[11px] font-bold">{collabPeers.length}</span>}
            </button>

            {showSharePanel && (
              <div className="max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-14 max-sm:w-auto sm:absolute sm:right-0 sm:top-[calc(100%+8px)] sm:w-72 p-3.5 rounded-2xl liquid-glass-popup border border-slate-200 dark:border-white/10 shadow-2xl z-50 text-left animate-liquid-pop origin-top-right text-slate-800 dark:text-zinc-200">
                {!collabRoom ? (
                  <>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Gambar Bareng di Papan Ini</div>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400 mt-1">
                      Buat ruang kolaborasi lalu bagikan kodenya ke teman. Coretan, catatan rumus, bangun 3D, dan kursor kalian terlihat realtime. Siapa pun yang punya kode bisa ikut menggambar.
                    </p>
                    <button
                      type="button"
                      onClick={() => connectBoard(genBoardCode())}
                      className="mt-2.5 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                    >
                      Buat Ruang Kolaborasi
                    </button>
                    <div className="flex items-center gap-2 my-2.5">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">atau gabung pakai kode</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Kode ruang, mis. K7X2PQ"
                        className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        type="button"
                        disabled={!joinCode.trim()}
                        onClick={() => { connectBoard(joinCode); setShowSharePanel(false); }}
                        className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                      >
                        Gabung
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Ruang {collabRoom}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md text-white" style={{ background: myColor }}>
                        warna kamu
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {collabPeers.map((peer) => (
                        <div key={peer.id} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-300">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: peer.color }} />
                          <span className="truncate">{peer.name}{peer.id === myCollabId ? " (kamu)" : ""}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(`${window.location.origin}/chat#board=${collabRoom}`);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2000);
                        } catch { /* abaikan */ }
                      }}
                      className="mt-3 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {shareCopied ? "Tautan Tersalin" : "Salin Tautan Gabung"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        disconnectBoard();
                        setShowSharePanel(false);
                        try {
                          const u = new URL(window.location.href);
                          u.hash = "";
                          window.history.replaceState(null, "", u.toString());
                        } catch { /* abaikan */ }
                      }}
                      className="mt-1.5 w-full py-2 rounded-xl text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar Ruang
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void copySmartboardSnapshotToClipboard()}
            className="h-9 w-9 flex items-center justify-center rounded-xl dark:bg-white/[0.04] bg-slate-100 hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border dark:border-white/[0.06] border-slate-200 transition cursor-pointer"
            title="Salin Gambar Papan Tulis ke Clipboard (Ctrl+C)"
          >
            <Copy className="w-4 h-4" />
          </button>

          {onToggleProjector && (
            <button
              type="button"
              onClick={onToggleProjector}
              className={`h-9 w-9 flex items-center justify-center rounded-xl border transition cursor-pointer ${
                isProjectorMode
                  ? "bg-slate-200 dark:bg-white/[0.16] text-slate-900 dark:text-white border-slate-300 dark:border-white/[0.2]"
                  : "dark:bg-white/[0.04] bg-slate-100 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white dark:border-white/[0.06] border-slate-200"
              }`}
              title="Mode Layar Proyektor"
            >
              <Tv className="w-4 h-4" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl dark:bg-white/[0.04] bg-slate-100 hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border dark:border-white/[0.06] border-slate-200 transition cursor-pointer"
              title="Tutup Papan Tulis"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN BOARD WORKSPACE */}
      <div
        ref={boardWorkspaceRef}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onDoubleClick={handleBoardDoubleClick}
        onDragOver={handleBoardDragOver}
        onDrop={handleBoardDrop}
        className={`flex-1 relative w-full h-full min-h-0 bg-slate-50 dark:bg-[#080a0f] overflow-hidden ${
          isTypingToolActive ? "cursor-text" : ""
        }`}
      >
        {/* Toast Notifikasi Copy / Paste Gambar */}
        {clipboardToast && (
          <div className="
            absolute top-3 left-1/2 -translate-x-1/2 z-50
            px-3.5 py-1.5 rounded-full
            bg-[#09090b]/95 dark:bg-white/95
            text-white dark:text-[#09090b]
            text-xs font-semibold shadow-lg
            flex items-center gap-1.5 pointer-events-none animate-fadeIn
          ">
            <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>{clipboardToast}</span>
          </div>
        )}
        {/* A. EMPTY STATE (Otomatis hilang jika pengguna mencoret kanvas, mengetik rumus, atau mengaktifkan pena/ketik) */}
        {showEmptyBoardPlaceholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-0 select-none animate-fadeIn pointer-events-auto">
            <div className="w-full max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center mx-auto text-slate-700 dark:text-zinc-300 shadow-sm">
                <Pencil className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Papan Tulis Pintar ZAP
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Papan tulis interaktif untuk simulasi geometri 2D/3D, penulisan rumus KaTeX keyboard rapi tanpa stylus, dan coretan kapur.
                </p>
              </div>

              {/* Action shortcuts */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsTypingToolActive(true);
                    setInlineComposer({ x: 30, y: 35, text: "" });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Tulis di Kanvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiWidgetOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Buat dengan ZAP AI</span>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                {SMART_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (preset.solid) setSolidKind(preset.solid);
                      if (preset.paramA !== undefined) setParamA(preset.paramA);
                      if (preset.paramB !== undefined) setParamB(preset.paramB);
                      if (preset.paramC !== undefined) setParamC(preset.paramC);
                      if (preset.unit) setUnit(preset.unit);
                      if (preset.hasSlice !== undefined) setShowSlicePlane(preset.hasSlice);
                      else setShowSlicePlane(false);
                      selectModel(preset.model);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#121520] dark:hover:bg-[#1a1f30] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 text-xs font-medium text-slate-700 dark:text-zinc-200 transition cursor-pointer shadow-xs"
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* B. 2D CARTESIAN GRAPH VIEW */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            is2DGraphModel ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <canvas
            ref={graph2DCanvasRef}
            onWheel={preview?.disableWheel ? undefined : handleWheel2D}
            onPointerDown={handle2DPointerDown}
            onPointerMove={handle2DPointerMove}
            onPointerUp={handle2DPointerUp}
            onPointerLeave={handle2DPointerUp}
            className={`w-full h-full block ${
              isDrawingToolActive
                ? ""
                : isTypingToolActive
                ? "cursor-text"
                : "cursor-grab active:cursor-grabbing"
            }`}
          />

          {/* 2D Zoom In / Out / Reset Floating Controls */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 p-1 rounded-xl liquid-glass-popup border border-slate-200 dark:border-white/10 shadow-lg select-none">
            <button
              type="button"
              onClick={() => setZoom2D((prev) => Math.min(8, prev * 1.25))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
              title="Perbesar Grafik (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom2D(1);
                setPan2D({ x: 0, y: 0 });
              }}
              className="px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer"
              title="Reset Zoom ke 100%"
            >
              {Math.round(zoom2D * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom2D((prev) => Math.max(0.2, prev / 1.25))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
              title="Perkecil Grafik (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu Kurva Cepat Saat Mode 2D Kosong */}
          {activeModel === "2d_empty" && (
            <div className="absolute top-3 right-3 max-sm:top-2 max-sm:right-2 z-20 flex items-center gap-1.5 p-1 rounded-xl liquid-glass-popup border border-slate-200 dark:border-white/10 shadow-lg select-none text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 px-2 font-medium hidden sm:inline">
                Pilih Kurva 2D:
              </span>
              <button
                type="button"
                onClick={() => selectModel("2d_quadratic")}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 transition cursor-pointer"
              >
                Parabola Kuadrat
              </button>
              <button
                type="button"
                onClick={() => selectModel("2d_trig")}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 transition cursor-pointer"
              >
                Trigonometri Sinus
              </button>
              <button
                type="button"
                onClick={() => selectModel("2d_linear")}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 transition cursor-pointer"
              >
                Garis Linear
              </button>
            </div>
          )}

          {/* 2D Equation & Coefficients Bar (Positioned at top-right so bottom Dock is 100% clear) */}
          {(activeModel === "2d_quadratic" || activeModel === "2d_trig" || activeModel === "2d_linear" || activeModel === "2d_circle") && (
            <div className="absolute top-3 right-3 max-sm:top-14 max-sm:left-3 max-sm:right-3 flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-[#0f121d]/95 border border-slate-200/90 dark:border-white/[0.08] backdrop-blur-md shadow-md z-20 text-xs text-slate-800 dark:text-zinc-200 animate-fadeIn select-none">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white font-mono text-xs">
                  {activeModel === "2d_quadratic"
                    ? `y = ${paramA}x² ${paramB >= 0 ? `+ ${paramB}x` : `- ${Math.abs(paramB)}x`} ${paramC >= 0 ? `+ ${paramC}` : `- ${Math.abs(paramC)}`}`
                    : activeModel === "2d_trig"
                    ? `y = ${paramA} sin(${paramB}x)`
                    : `y = ${paramA}x + ${paramB}`}
                </span>
              </div>

              {/* Sliders for Coefficients */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-zinc-400 font-mono font-medium text-[11px]">A: {paramA}</span>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.5"
                    value={paramA}
                    onChange={(e) => setParamA(parseFloat(e.target.value))}
                    className="w-16 accent-slate-900 dark:accent-white cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-zinc-400 font-mono font-medium text-[11px]">
                    {activeModel === "2d_quadratic" ? `C: ${paramC}` : `B: ${paramB}`}
                  </span>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="0.5"
                    value={activeModel === "2d_quadratic" ? paramC : paramB}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (activeModel === "2d_quadratic") setParamC(val);
                      else setParamB(val);
                    }}
                    className="w-16 accent-slate-900 dark:accent-white cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* C. THREE.JS 3D VIEWPORT */}
        <div
          ref={container3DRef}
          className={`absolute inset-0 transition-opacity duration-200 ${
            is3DModel
              ? isTypingToolActive || isDrawingToolActive
                ? "opacity-100 pointer-events-none"
                : "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        />

        {/* 3D Geometry HUD Overlay Card (With Minimize/Hide Toggle) */}
        {activeModel === "3d_empty" && (
          <div className="absolute top-3 right-3 max-sm:top-auto max-sm:bottom-[4.75rem] max-sm:left-3 max-sm:right-3 max-sm:w-auto p-3.5 rounded-2xl liquid-glass-popup z-20 text-xs w-64 space-y-2.5 text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-top-right max-h-[calc(100%-6rem)] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-white/[0.08] border-slate-200/80 pb-2">
              <span className="font-semibold dark:text-white text-slate-900 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                Ruang 3D Kosong
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
              Pilih bentuk geometri 3D untuk dimunculkan ke ruang kanvas:
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                { id: "kubus", label: "Kubus" },
                { id: "balok", label: "Balok" },
                { id: "prisma", label: "Prisma" },
                { id: "prisma_segilima", label: "Prisma Segilima" },
                { id: "prisma_segienam", label: "Prisma Segienam" },
                { id: "limas", label: "Limas" },
                { id: "tabung", label: "Tabung" },
                { id: "bola", label: "Bola" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "tabung") {
                      selectModel("cylinder");
                    } else {
                      setSolidKind(item.id as SolidKind);
                      selectModel("solids");
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-xs font-medium text-slate-800 dark:text-zinc-200 text-center transition cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(is3DModel || activeModel === "2d_shape") && activeModel !== "3d_empty" && isHudVisible && (
          isHudMinimized ? (
            <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
              <button
                type="button"
                onClick={() => setIsHudMinimized(false)}
                className="px-3 py-1.5 rounded-xl dark:bg-[#0f121d]/90 bg-white/95 dark:hover:bg-[#151928] hover:bg-slate-50 border dark:border-white/[0.1] border-slate-200 hover:border-slate-400 dark:hover:border-white/20 backdrop-blur-md shadow-xl text-xs dark:text-zinc-200 text-slate-800 flex items-center gap-2 transition cursor-pointer"
                title="Tampilkan Panel Metrik & Kontrol"
              >
                <Box className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                <span className="font-medium">
                  {activeModel === "2d_shape"
                    ? planeShapeKind === "persegi_panjang"
                      ? `Persegi Panjang (${paramA}×${paramB} ${unit})`
                      : planeShapeKind === "persegi"
                      ? `Persegi (${paramA} ${unit})`
                      : planeShapeKind === "lingkaran"
                      ? `Lingkaran (r=${paramA} ${unit})`
                      : planeShapeKind === "belah_ketupat"
                      ? `Belah Ketupat (${paramA}×${paramB} ${unit})`
                      : planeShapeKind === "layang_layang"
                      ? `Layang-Layang (${paramA}×${paramB} ${unit})`
                      : planeShapeKind === "jaring_prisma"
                      ? `Jaring Prisma (${paramA}×${paramB} ${unit})`
                      : planeShapeKind === "jaring_kubus"
                      ? `Jaring Kubus (${paramA} ${unit})`
                      : planeShapeKind === "jaring_limas"
                      ? `Jaring Limas (${paramA}×${paramB} ${unit})`
                      : planeShapeKind === "jajar_genjang"
                      ? `Jajar Genjang (${paramA} ${unit})`
                      : planeShapeKind === "trapesium"
                      ? `Trapesium (${paramA} ${unit})`
                      : `Segitiga (${paramA} ${unit})`
                    : `Metrik (${paramA} ${unit})`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
              </button>
              <button
                type="button"
                onClick={() => setIsHudVisible(false)}
                className="p-1.5 rounded-xl dark:bg-[#0f121d]/90 bg-white/95 dark:hover:bg-[#151928] hover:bg-slate-50 border dark:border-white/[0.1] border-slate-200 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Sembunyikan Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="absolute top-3 right-3 max-sm:top-auto max-sm:bottom-[4.75rem] max-sm:left-3 max-sm:right-3 max-sm:w-auto p-3.5 rounded-2xl liquid-glass-popup z-20 text-xs w-64 space-y-2.5 text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-top-right max-h-[calc(100%-6rem)] overflow-y-auto">
              <div className="flex items-center justify-between border-b dark:border-white/[0.08] border-slate-200/80 pb-2">
                <span className="font-semibold dark:text-white text-slate-900 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                  {activeModel === "2d_shape"
                    ? planeShapeKind === "persegi_panjang"
                      ? "Persegi Panjang 2D"
                      : planeShapeKind === "persegi"
                      ? "Persegi 2D"
                      : planeShapeKind === "lingkaran"
                      ? "Lingkaran 2D"
                      : planeShapeKind === "belah_ketupat"
                      ? "Belah Ketupat 2D"
                      : planeShapeKind === "layang_layang"
                      ? "Layang-Layang 2D"
                      : planeShapeKind === "jaring_prisma"
                      ? "Jaring-Jaring Prisma 2D"
                      : planeShapeKind === "jaring_kubus"
                      ? "Jaring-Jaring Kubus 2D"
                      : planeShapeKind === "jaring_limas"
                      ? "Jaring-Jaring Limas 2D"
                      : planeShapeKind === "jajar_genjang"
                      ? "Jajar Genjang 2D"
                      : planeShapeKind === "trapesium"
                      ? "Trapesium 2D"
                      : planeShapeKind === "segitiga"
                      ? "Segitiga 2D"
                      : "Bangun Datar 2D"
                    : activeModel === "cylinder"
                    ? "Tabung Silinder 3D"
                    : solidKind === "kubus"
                    ? showSlicePlane
                      ? "Kubus 3D (Irisan)"
                      : "Kubus 3D"
                    : SOLID_LABELS[solidKind] || "Geometri 3D"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeModel === "2d_shape") {
                        if (planeShapeKind === "persegi_panjang") {
                          setParamA(14);
                          setParamB(8);
                          onParamsChange?.(14, 8, paramC, unit);
                        } else if (planeShapeKind === "persegi") {
                          setParamA(10);
                          onParamsChange?.(10, paramB, paramC, unit);
                        } else if (planeShapeKind === "jajar_genjang") {
                          setParamA(12);
                          setParamB(8);
                          setParamC(10);
                          onParamsChange?.(12, 8, 10, unit);
                        } else if (planeShapeKind === "trapesium") {
                          setParamA(8);
                          setParamB(14);
                          setParamC(6);
                          onParamsChange?.(8, 14, 6, unit);
                        } else if (planeShapeKind === "lingkaran") {
                          setParamA(7);
                          onParamsChange?.(7, paramB, paramC, unit);
                        } else if (planeShapeKind === "belah_ketupat" || planeShapeKind === "layang_layang") {
                          setParamA(12);
                          setParamB(16);
                          onParamsChange?.(12, 16, paramC, unit);
                        } else if (planeShapeKind === "jaring_prisma" || planeShapeKind === "jaring_limas") {
                          setParamA(8);
                          setParamB(10);
                          onParamsChange?.(8, 10, paramC, unit);
                        } else if (planeShapeKind === "jaring_kubus") {
                          setParamA(10);
                          onParamsChange?.(10, paramB, paramC, unit);
                        } else {
                          setParamA(10);
                          setParamB(8);
                          onParamsChange?.(10, 8, paramC, unit);
                        }
                      } else {
                        setParamA(10);
                        setSliceProgress(0.5);
                        onParamsChange?.(10, paramB, paramC, unit);
                      }
                    }}
                    className="text-[10px] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] cursor-pointer"
                    title="Reset Parameter"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHudMinimized(true)}
                    className="p-1 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                    title="Kecilkan Panel"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHudVisible(false)}
                    className="p-1 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                    title="Sembunyikan Panel (Bisa dibuka lagi dari toolbar)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sisi / Radius Slider & Input */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-medium">
                  <span>
                    {activeModel === "2d_shape"
                      ? planeShapeKind === "persegi_panjang"
                        ? "Panjang (p):"
                        : planeShapeKind === "persegi" || planeShapeKind === "jaring_kubus"
                        ? "Panjang Sisi (s):"
                        : planeShapeKind === "lingkaran"
                        ? "Jari-jari (r):"
                        : planeShapeKind === "belah_ketupat" || planeShapeKind === "layang_layang"
                        ? "Diagonal 1 (d₁):"
                        : planeShapeKind === "jaring_prisma"
                        ? "Sisi Segitiga Alas (s):"
                        : planeShapeKind === "jaring_limas"
                        ? "Sisi Alas Persegi (s):"
                        : planeShapeKind === "jajar_genjang" || planeShapeKind === "segitiga"
                        ? "Panjang Alas (a):"
                        : planeShapeKind === "trapesium"
                        ? "Sisi Atas (a):"
                        : "Alas (a):"
                      : activeModel === "cylinder" || solidKind === "bola"
                      ? "Jari-jari (r):"
                      : solidKind === "balok"
                      ? "Panjang (p):"
                      : solidKind === "prisma"
                      ? "Sisi Alas Segitiga (s):"
                      : solidKind === "limas"
                      ? "Sisi Alas Persegi (s):"
                      : "Panjang Sisi (s):"}
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">{paramA} {unit}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={paramA}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setParamA(val);
                    onParamsChange?.(val, paramB, paramC, unit);
                  }}
                  className="w-full accent-slate-900 dark:accent-white cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 italic">
                  {activeModel === "2d_shape"
                    ? "💡 Tip: Geser slider untuk mengubah dimensi; rumus luas & keliling terhitung otomatis."
                    : "💡 Tip: Arahkan kursor & tarik sudut objek untuk resize langsung."}
                </p>
              </div>

              {/* Tinggi / Lebar Slider (Untuk Tabung, Balok, Prisma, Limas, 2D) */}
              {((activeModel === "2d_shape" && planeShapeKind !== "persegi" && planeShapeKind !== "lingkaran" && planeShapeKind !== "jaring_kubus") || activeModel === "cylinder" || solidKind === "balok" || solidKind === "prisma" || solidKind === "limas") && (
                <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                  <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-medium">
                    <span>
                      {activeModel === "2d_shape"
                        ? planeShapeKind === "persegi_panjang"
                          ? "Lebar (l):"
                          : planeShapeKind === "trapesium"
                          ? "Sisi Bawah (b):"
                          : planeShapeKind === "belah_ketupat" || planeShapeKind === "layang_layang"
                          ? "Diagonal 2 (d₂):"
                          : planeShapeKind === "jaring_prisma"
                          ? "Tinggi Sisi Tegak (t):"
                          : planeShapeKind === "jaring_limas"
                          ? "Tinggi Limas (t):"
                          : "Tinggi Tegak (t):"
                        : activeModel === "cylinder" || solidKind === "prisma" || solidKind === "limas"
                        ? "Tinggi (t):"
                        : "Lebar (l):"}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">{paramB} {unit}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={paramB}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setParamB(val);
                      onParamsChange?.(paramA, val, paramC, unit);
                    }}
                    className="w-full accent-slate-900 dark:accent-white cursor-pointer"
                  />
                </div>
              )}

              {/* Slider 3 untuk Jajar Genjang (Sisi Miring) atau Trapesium (Tinggi) */}
              {activeModel === "2d_shape" && (planeShapeKind === "jajar_genjang" || planeShapeKind === "trapesium") && (
                <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                  <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-medium">
                    <span>
                      {planeShapeKind === "jajar_genjang" ? "Sisi Miring (s):" : "Tinggi Tegak (t):"}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">{paramC} {unit}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={paramC}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setParamC(val);
                      onParamsChange?.(paramA, paramB, val, unit);
                    }}
                    className="w-full accent-slate-900 dark:accent-white cursor-pointer"
                  />
                </div>
              )}

              {/* Toggle & Slider Irisan Bidang (Hanya untuk bangun ruang 3D) */}
              {activeModel === "solids" && (solidKind === "kubus" || solidKind === "balok" || solidKind === "prisma" || solidKind === "limas") && (
                showSlicePlane ? (
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="flex justify-between items-center text-slate-700 dark:text-zinc-300 font-medium">
                      <span>Bidang Potongan:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-900 dark:text-white font-semibold">{Math.round(sliceProgress * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => setShowSlicePlane(false)}
                          className="text-[10px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white px-1 py-0.5 rounded cursor-pointer"
                          title="Hapus bidang irisan"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={sliceProgress}
                      onChange={(e) => setSliceProgress(parseFloat(e.target.value))}
                      className="w-full accent-slate-900 dark:accent-white cursor-pointer"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSlicePlane(true)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center gap-1.5 transition text-xs font-medium cursor-pointer"
                    title="Tambahkan bidang irisan penampang 3D"
                  >
                    <Scissors className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span>+ Tambah Irisan Bidang</span>
                  </button>
                )
              )}

              {/* Dynamic Calculated Metrics */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-white/[0.08] space-y-1.5">
                {solidMetrics().rows.map((row) => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400">{row.label}:</span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* D. FREEHAND DRAWING CANVAS OVERLAY */}
        <canvas
          ref={drawCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className={`absolute inset-0 w-full h-full z-10 ${
            isDrawingToolActive ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
          }`}
        />

        {/* Visual Eraser Indicator Circle */}
        {isDrawingToolActive && drawingMode === "eraser" && pointerPos && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-white/60 bg-white/10 shadow-sm z-30 transform -translate-x-1/2 -translate-y-1/2 transition-none"
            style={{
              left: pointerPos.x,
              top: pointerPos.y,
              width: eraserSize,
              height: eraserSize,
            }}
          />
        )}

        {/* Floating Drawing Tool Palette (Docked when Drawing Active) */}
        {isDrawingToolActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 p-1.5 rounded-2xl liquid-glass-popup z-20 text-slate-800 dark:text-zinc-200 animate-liquid-pop origin-top-left">
            {/* Mode Switcher: Pen vs Eraser */}
            <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDrawingMode("pen")}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  drawingMode === "pen"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
                title="Pena Kapur (Menulis / Menggambar)"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pena</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawingMode("eraser")}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  drawingMode === "eraser"
                    ? "bg-slate-900 text-white dark:bg-slate-700 dark:text-white shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
                title="Penghapus Kapur (Hapus Goresan)"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Penghapus</span>
              </button>
            </div>

            <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/[0.1] mx-0.5" />

            {/* Tools Specific to Mode */}
            {drawingMode === "pen" ? (
              <>
                {/* Color Swatches */}
                {[
                  { color: isDark ? "#f8fafc" : "#0f172a", name: isDark ? "Kapur Putih" : "Tinta Hitam" },
                  { color: "#3b82f6", name: "Biru" },
                  { color: "#10b981", name: "Hijau" },
                  { color: "#f43f5e", name: "Merah" },
                  { color: "#f59e0b", name: "Kuning / Oranye" },
                ].map((swatch) => (
                  <button
                    key={swatch.color}
                    type="button"
                    onClick={() => setDrawColor(swatch.color)}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer flex items-center justify-center border border-black/10 dark:border-white/20 ${
                      drawColor === swatch.color ? "scale-110 ring-2 ring-slate-400 dark:ring-white/60" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch.color }}
                    title={swatch.name}
                  />
                ))}

                <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/[0.1] mx-0.5" />

                {/* Brush Sizes */}
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBrushSize(size)}
                    className={`px-1.5 py-0.5 rounded text-xs transition cursor-pointer font-mono ${
                      brushSize === size
                        ? "bg-slate-900 text-white dark:bg-white/[0.1] dark:text-white font-medium"
                        : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                    title={`Ukuran Pena ${size}px`}
                  >
                    {size}px
                  </button>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-1 px-1">
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">Ukuran:</span>
                {[
                  { size: 14, label: "Kecil" },
                  { size: 28, label: "Sedang" },
                  { size: 52, label: "Besar" },
                ].map((item) => (
                  <button
                    key={item.size}
                    type="button"
                    onClick={() => setEraserSize(item.size)}
                    className={`px-2 py-0.5 rounded text-xs transition cursor-pointer font-mono ${
                      eraserSize === item.size
                        ? "bg-slate-900 text-white dark:bg-white/[0.12] dark:text-white font-medium border border-slate-700 dark:border-white/[0.2]"
                        : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                    }`}
                    title={`Penghapus ${item.label} (${item.size}px)`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* E0. FIGMA-STYLE PASTED / DROPPED IMAGE LAYERS (Draggable, Resizable, Copyable to Clipboard) */}
        {boardImages.map((img) => {
          const isSelected = selectedImageId === img.id;
          return (
            <div
              key={img.id}
              data-board-image="true"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageId(img.id);
                setSelectedFormulaId(null);
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("[data-image-toolbar]") || (e.target as HTMLElement).closest("[data-resize-handle]")) {
                  return;
                }
                setSelectedImageId(img.id);
                setSelectedFormulaId(null);
                handleImagePointerDown(img.id, e);
              }}
              style={{ left: `${img.x}%`, top: `${img.y}%`, width: `${img.width}px` }}
              className={`absolute z-20 group rounded-lg select-none cursor-grab active:cursor-grabbing transition-shadow duration-150 ${
                isSelected
                  ? "ring-2 ring-[#0d99ff] shadow-xl"
                  : "hover:ring-1 hover:ring-[#0d99ff]/60 shadow-md border border-slate-200/70 dark:border-white/10"
              } bg-white/90 dark:bg-[#121520]/90 p-1`}
            >
              {/* Floating Image Action Bar (When Selected - Figma Style) */}
              {isSelected && (
                <>
                  <div
                    data-image-toolbar="true"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`absolute left-0 flex items-center gap-1 p-1 rounded-xl bg-white/98 dark:bg-[#12141c]/98 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-[0_10px_30px_-6px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.65)] z-30 animate-fadeIn whitespace-nowrap text-xs text-slate-800 dark:text-zinc-200 cursor-default ${
                      img.y < 16 ? "top-[calc(100%+10px)]" : "-top-11"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void copyDataUrlToClipboard(img.dataUrl, "Gambar disalin ke Clipboard (Ctrl+V)")}
                      className="px-2.5 py-1 rounded-lg bg-[#09090b] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      title="Salin gambar ini ke Clipboard (Ctrl+C)"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Gambar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBoardImages((prev) =>
                          prev.map((item) =>
                            item.id === img.id ? { ...item, width: Math.max(80, item.width - 40) } : item
                          )
                        )
                      }
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
                      title="Perkecil Gambar"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBoardImages((prev) =>
                          prev.map((item) =>
                            item.id === img.id ? { ...item, width: Math.min(680, item.width + 40) } : item
                          )
                        )
                      }
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
                      title="Perbesar Gambar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />

                    <button
                      type="button"
                      onClick={() => handleDeleteBoardImage(img.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                      title="Hapus Gambar (Del)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 4 Figma-style Corner Handles (Bottom-Right is draggable for resizing) */}
                  <span className="absolute -top-[5px] -left-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span className="absolute -top-[5px] -right-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span className="absolute -bottom-[5px] -left-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span
                    data-resize-handle="true"
                    onPointerDown={(e) => handleImageResizePointerDown(img.id, e)}
                    title="Tarik untuk mengubah ukuran gambar"
                    className="absolute -bottom-[6px] -right-[6px] w-3.5 h-3.5 bg-white border-2 border-[#0d99ff] shadow-xs cursor-nwse-resize pointer-events-auto"
                  />
                </>
              )}

              <img
                src={img.dataUrl}
                alt={img.name || "Gambar Papan"}
                draggable={false}
                className="w-full h-auto rounded-md block select-none pointer-events-none"
              />
            </div>
          );
        })}

        {/* E. FIGMA-STYLE CANVAS TEXT & LATEX LAYERS (Draggable, Selectable, Transformable to LaTeX / 2D / 3D) */}
        {formulaNotes.map((note) => {
          const isSelected = selectedFormulaId === note.id;
          const noteIsMath = note.kind === "math";

          return (
            <div
              key={note.id}
              data-formula-card="true"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFormulaId(note.id);
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("[data-transform-toolbar]")) return;
                setSelectedFormulaId(note.id);
                handleFormulaPointerDown(note.id, e);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setInlineComposer({
                  x: note.x,
                  y: note.y,
                  text: note.rawText || note.latex,
                  id: note.id,
                });
              }}
              style={{ left: `${note.x}%`, top: `${note.y}%` }}
              className={`absolute z-20 group rounded-lg px-3 py-2 select-none cursor-grab active:cursor-grabbing transition-shadow duration-150 ${
                isSelected
                  ? "ring-2 ring-[#0d99ff] bg-white/95 dark:bg-[#121520]/95 shadow-lg"
                  : "bg-white/80 dark:bg-[#121520]/80 hover:ring-1 hover:ring-[#0d99ff]/60 border border-slate-200/70 dark:border-white/10 shadow-xs"
              } backdrop-blur-xs text-slate-900 dark:text-white`}
            >
              {/* Contextual Floating Transformation Bar (When Selected - Figma Style) */}
              {isSelected && (
                <>
                  <div
                    data-transform-toolbar="true"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`absolute left-0 flex items-center gap-1 p-1 rounded-xl bg-white/98 dark:bg-[#12141c]/98 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-[0_10px_30px_-6px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.65)] z-30 animate-fadeIn whitespace-nowrap text-xs text-slate-800 dark:text-zinc-200 cursor-default ${
                      note.y < 16 ? "top-[calc(100%+10px)]" : "-top-11"
                    }`}
                  >
                    {/* 1. Ubah Teks Biasa <-> Rumus LaTeX */}
                    {!noteIsMath ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFormulaNotes((prev) =>
                            prev.map((n) =>
                              n.id === note.id
                                ? { ...n, kind: "math", latex: autoFormatToLatex(n.rawText || n.latex) }
                                : n
                            )
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#09090b] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        title="Ubah teks biasa ini menjadi format rumus matematika LaTeX"
                      >
                        <span className="font-serif font-bold text-xs leading-none">∑</span>
                        <span>Rumus LaTeX</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setFormulaNotes((prev) =>
                            prev.map((n) => (n.id === note.id ? { ...n, kind: "text" } : n))
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-700 dark:text-zinc-200 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Kembalikan ke tampilan teks biasa"
                      >
                        <Type className="w-3 h-3" />
                        <span>Teks Biasa</span>
                      </button>
                    )}

                    {/* 2. Jadi 2D (Grafik Kartesius / Bangun Datar / Jaring 2D) */}
                    <button
                      type="button"
                      onClick={() => handleTransformTo2D(note.rawText || note.latex)}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-600 dark:text-blue-400 dark:hover:text-white border border-blue-500/20 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Visualisasikan menjadi Grafik atau Bidang 2D"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Jadi 2D</span>
                    </button>

                    {/* 3. Jadi 3D (Bangun Ruang / Permukaan 3D) */}
                    <button
                      type="button"
                      onClick={() => handleTransformTo3D(note.rawText || note.latex)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 dark:hover:text-white border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Visualisasikan menjadi Model Geometri 3D"
                    >
                      <Box className="w-3 h-3" />
                      <span>Jadi 3D</span>
                    </button>

                    <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />

                    {/* Edit inline button */}
                    <button
                      type="button"
                      onClick={() =>
                        setInlineComposer({
                          x: note.x,
                          y: note.y,
                          text: note.rawText || note.latex,
                          id: note.id,
                        })
                      }
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
                      title="Edit Teks (Klik 2x)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteFormula(note.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                      title="Hapus (Del)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 4 Figma-style Corner Handles for Active Selection */}
                  <span className="absolute -top-[5px] -left-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span className="absolute -top-[5px] -right-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span className="absolute -bottom-[5px] -left-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                  <span className="absolute -bottom-[5px] -right-[5px] w-2.5 h-2.5 bg-white border-2 border-[#0d99ff] shadow-2xs pointer-events-none" />
                </>
              )}

              {/* Content: Plain Text by default, or KaTeX when transformed */}
              <div
                className={`overflow-x-auto ${
                  note.fontSize === "sm"
                    ? "text-xs"
                    : note.fontSize === "lg"
                    ? "text-lg font-medium"
                    : note.fontSize === "xl"
                    ? "text-2xl font-bold"
                    : "text-sm font-medium"
                }`}
                title="Klik untuk memilih & ubah ke LaTeX / 2D / 3D, atau klik 2x untuk mengedit teks"
              >
                {noteIsMath ? (
                  <MathView math={note.latex} block />
                ) : (
                  <div className="whitespace-pre-wrap break-words leading-snug text-slate-900 dark:text-zinc-100">
                    {note.rawText || note.latex}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Figma-Style Marquee Drag-to-Select Box */}
        {selectionMarquee && (
          <div
            style={{
              left: `${Math.min(selectionMarquee.startX, selectionMarquee.currentX)}%`,
              top: `${Math.min(selectionMarquee.startY, selectionMarquee.currentY)}%`,
              width: `${Math.abs(selectionMarquee.currentX - selectionMarquee.startX)}%`,
              height: `${Math.abs(selectionMarquee.currentY - selectionMarquee.startY)}%`,
            }}
            className="absolute z-30 border border-[#0d99ff] bg-[#0d99ff]/10 pointer-events-none transition-none"
          />
        )}

        {/* Direct Figma-Style Inline Canvas Text Input */}
        {inlineComposer && (
          <div
            style={{ left: `${inlineComposer.x}%`, top: `${inlineComposer.y}%` }}
            className="absolute z-40 inline-flex items-center rounded-md bg-white/95 dark:bg-[#0d1017]/95 backdrop-blur-xs border-2 border-[#0d99ff] px-2.5 py-1.5 shadow-md"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="absolute -top-[5px] -left-[5px] w-2 h-2 bg-white border-2 border-[#0d99ff] pointer-events-none" />
            <span className="absolute -top-[5px] -right-[5px] w-2 h-2 bg-white border-2 border-[#0d99ff] pointer-events-none" />
            <span className="absolute -bottom-[5px] -left-[5px] w-2 h-2 bg-white border-2 border-[#0d99ff] pointer-events-none" />
            <span className="absolute -bottom-[5px] -right-[5px] w-2 h-2 bg-white border-2 border-[#0d99ff] pointer-events-none" />
            <input
              ref={inlineInputRef}
              type="text"
              size={Math.max(16, (inlineComposer.text || "").length + 3)}
              value={inlineComposer.text}
              onChange={(e) => setInlineComposer({ ...inlineComposer, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitInlineComposer();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setInlineComposer(null);
                  setIsTypingToolActive(false);
                }
              }}
              placeholder="Ketik teks atau rumus..."
              className="bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none min-w-[140px]"
              autoFocus
            />
          </div>
        )}

        {/* F. FLOATING ZAP AI COPILOT ASSISTANT (Bottom-Right Chatbot Widget) */}
        {!hideCopilot && (
        <div className="absolute bottom-[4.25rem] right-3 sm:bottom-[4.25rem] sm:right-3.5 z-40 flex flex-col items-end gap-2.5">
          <AnimatePresence>
            {isAiWidgetOpen && (
              <motion.div
                key="zap-copilot-card"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-[320px] sm:w-[340px] max-w-[calc(100vw-28px)] rounded-2xl bg-white/98 dark:bg-[#121318]/98 backdrop-blur-xl border border-slate-200/90 dark:border-white/[0.09] shadow-[0_12px_36px_-8px_rgba(15,23,42,0.12),0_2px_6px_0_rgba(15,23,42,0.04)] dark:shadow-[0_18px_44px_-8px_rgba(0,0,0,0.65)] overflow-hidden select-none text-slate-800 dark:text-zinc-200 origin-bottom-right"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] flex items-center justify-center shadow-2xs shrink-0">
                      <ZapLogo className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                          ZAP Copilot
                        </h4>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                        Sintesis bangun ruang &amp; rumus
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAiWidgetOpen(false)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Tutup Copilot"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chat / Assistant Body */}
                <div className="p-3.5 space-y-3">
                  {/* Assistant Status / Response Bubble */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {aiWidgetFeedback ? (
                      <div className="flex items-start gap-2 text-slate-900 dark:text-white font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{aiWidgetFeedback}</span>
                      </div>
                    ) : (
                      <span>
                        Ketik bangun ruang, grafik fungsi, atau pilih pintasan di bawah untuk langsung ditampilkan ke papan.
                      </span>
                    )}
                  </div>

                  {/* Quick Prompt Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 px-0.5 block">
                      Pintasan cepat
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Kubus 10 cm", query: "kubus 10cm" },
                        { label: "Prisma Segitiga", query: "prisma segitiga 3d 10cm" },
                        { label: "Limas 3D", query: "limas segi empat 3d" },
                        { label: "Jaring Kubus", query: "jaring-jaring kubus 2d" },
                        { label: "Tabung", query: "tabung r=7 t=12" },
                        { label: "Lingkaran r=7", query: "lingkaran r=7cm" },
                        { label: "y = x² - 3", query: "y=x^2-3" },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            setAiWidgetInput(chip.query);
                            triggerAiSynthesize(chip.query);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-slate-900 hover:text-white dark:bg-white/[0.05] dark:hover:bg-white dark:hover:text-[#09090b] border border-slate-200/70 dark:border-white/[0.07] text-[11px] font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      triggerAiSynthesize(aiWidgetInput);
                    }}
                    className="pt-0.5"
                  >
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={aiWidgetInput}
                        onChange={(e) => setAiWidgetInput(e.target.value)}
                        placeholder="Buat kubus, prisma, atau rumus..."
                        className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-900 dark:focus:border-white/50 transition"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!aiWidgetInput.trim()}
                        className="absolute right-1.5 w-6 h-6 rounded-lg bg-[#09090b] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white dark:text-[#09090b] transition cursor-pointer flex items-center justify-center"
                        title="Kirim"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logo -> Hover -> Capsule Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setIsAiWidgetOpen((prev) => !prev);
              setCopilotSeen(true);
            }}
            className="group relative flex items-center h-9 p-1 rounded-full bg-white/95 dark:bg-[#14161e]/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.5)] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer active:scale-95"
            title="ZAP Copilot — Buat bangun 2D/3D & rumus"
          >
            {!copilotSeen && !isAiWidgetOpen && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 dark:bg-zinc-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#09090b] dark:bg-white border border-white dark:border-zinc-900" />
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
              <ZapLogo className="w-3.5 h-3.5" />
            </div>
            <div className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <div className="overflow-hidden flex items-center">
                <span className="pl-2 pr-2.5 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap tracking-tight">
                  Copilot
                </span>
              </div>
            </div>
          </button>
        </div>
        )}

        {/* Kursor kolaborator (gaya Figma: panah berwarna + label nama) */}
        {Object.entries(remoteCursors).map(([pid, c]) => (
          <div
            key={pid}
            className="absolute z-40 pointer-events-none"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, transition: "left 70ms linear, top 70ms linear" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" }}>
              <path d="M4 2 L20 11.5 L12.2 13.2 L9.2 21 Z" fill={c.color} stroke="#ffffff" strokeWidth="1.4" />
            </svg>
            <span className="absolute left-3.5 top-3.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow" style={{ background: c.color }}>
              {c.name}
            </span>
          </div>
        ))}

        {/* DOCK ALAT BAWAH: dock magnifikasi (framer-motion) + aksi dinamis sesuai konteks seleksi */}
        <div className="absolute bottom-2.5 inset-x-0 z-40 flex justify-center pointer-events-none px-2 sm:px-3">
          <div className="no-scrollbar w-max max-w-full overflow-x-auto sm:overflow-visible pointer-events-auto touch-pan-x overscroll-x-contain py-1">
            <Dock
              className="gap-1 px-2 py-1 rounded-full sm:gap-1.5 sm:px-2.5 shrink-0"
              panelHeight={dockBaseSize + 10}
              magnification={dockBaseSize + 16}
              distance={100}
              baseSize={dockBaseSize}
            >
            {/* Ketik Rumus / Teks */}
            <DockItem
              className={`aspect-square rounded-full border ${
                isTypingToolActive
                  ? "bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] border-[#09090b] dark:border-white shadow-xs"
                  : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-700 dark:text-zinc-200 border-slate-200/70 dark:border-white/[0.08]"
              }`}
            >
              <DockLabel>{isTypingToolActive ? "Mode Ketik Aktif" : "Ketik Rumus / Teks"}</DockLabel>
              <DockIcon>
                <Type className="w-full h-full" />
                <button
                  type="button"
                  aria-label="Ketik Rumus / Teks"
                  onClick={() => {
                    if (isTypingToolActive) {
                      setIsTypingToolActive(false);
                    } else {
                      setIsTypingToolActive(true);
                      setIsDrawingToolActive(false);
                    }
                  }}
                  className="absolute inset-0 rounded-full cursor-pointer"
                />
              </DockIcon>
            </DockItem>

            {/* Pena */}
            <DockItem
              className={`aspect-square rounded-full border ${
                isDrawingToolActive && drawingMode === "pen"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-zinc-900 border-slate-900 dark:border-white shadow-md"
                  : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
              }`}
            >
              <DockLabel>Pena Kapur</DockLabel>
              <DockIcon>
                <Pencil className="w-full h-full" />
                <button
                  type="button"
                  aria-label="Pena Kapur"
                  onClick={() => {
                    setIsTypingToolActive(false);
                    if (isDrawingToolActive && drawingMode === "pen") setIsDrawingToolActive(false);
                    else {
                      setIsDrawingToolActive(true);
                      setDrawingMode("pen");
                    }
                  }}
                  className="absolute inset-0 rounded-full cursor-pointer"
                />
              </DockIcon>
            </DockItem>

            {/* Penghapus */}
            <DockItem
              className={`aspect-square rounded-full border ${
                isDrawingToolActive && drawingMode === "eraser"
                  ? "bg-slate-700 text-white border-slate-600 shadow-md"
                  : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
              }`}
            >
              <DockLabel>Penghapus Kapur</DockLabel>
              <DockIcon>
                <Eraser className="w-full h-full" />
                <button
                  type="button"
                  aria-label="Penghapus Kapur"
                  onClick={() => {
                    if (isDrawingToolActive && drawingMode === "eraser") setIsDrawingToolActive(false);
                    else {
                      setIsDrawingToolActive(true);
                      setDrawingMode("eraser");
                    }
                  }}
                  className="absolute inset-0 rounded-full cursor-pointer"
                />
              </DockIcon>
            </DockItem>

            {/* Sisipkan / Tempel Gambar ke Smartboard */}
            <DockItem className="aspect-square rounded-full border bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]">
              <DockLabel>Sisipkan / Tempel Gambar (Ctrl+V)</DockLabel>
              <DockIcon>
                <ImagePlus className="w-full h-full" />
                <button
                  type="button"
                  aria-label="Sisipkan atau Tempel Gambar"
                  onClick={() => boardImageInputRef.current?.click()}
                  className="absolute inset-0 rounded-full cursor-pointer"
                />
              </DockIcon>
            </DockItem>

            {/* Hapus coretan (dinamis: hanya saat ada coretan) */}
            {hasDrawings && (
              <DockItem className="aspect-square rounded-full border bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]">
                <DockLabel>Hapus Semua Coretan</DockLabel>
                <DockIcon>
                  <Trash2 className="w-full h-full" />
                  <button
                    type="button"
                    aria-label="Hapus Semua Coretan"
                    onClick={clearBoardShared}
                    className="absolute inset-0 rounded-full cursor-pointer"
                  />
                </DockIcon>
              </DockItem>
            )}

            {/* Grup 3D (dinamis: hanya saat model 3D aktif) */}
            {is3DModel && (
              <>
                <div className="w-px h-8 bg-slate-300/70 dark:bg-white/10 mx-0.5 self-center shrink-0" />
                <DockItem
                  className={`aspect-square rounded-full border ${
                    wireframe
                      ? "bg-slate-300 dark:bg-white/[0.18] text-slate-900 dark:text-white border-slate-400/50 dark:border-white/20"
                      : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
                  }`}
                >
                  <DockLabel>Wireframe</DockLabel>
                  <DockIcon>
                    <Layers className="w-full h-full" />
                    <button
                      type="button"
                      aria-label="Toggle Wireframe"
                      onClick={() => setWireframe(!wireframe)}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
                <DockItem
                  className={`aspect-square rounded-full border ${
                    autoRotate
                      ? "bg-slate-300 dark:bg-white/[0.18] text-slate-900 dark:text-white border-slate-400/50 dark:border-white/20"
                      : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
                  }`}
                >
                  <DockLabel>Rotasi Otomatis</DockLabel>
                  <DockIcon>
                    <RotateCw className="w-full h-full" />
                    <button
                      type="button"
                      aria-label="Toggle Rotasi Otomatis"
                      onClick={() => setAutoRotate(!autoRotate)}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
                {!hideHud && (
                <DockItem
                  className={`aspect-square rounded-full border ${
                    isHudVisible
                      ? "bg-slate-300 dark:bg-white/[0.18] text-slate-900 dark:text-white border-slate-400/50 dark:border-white/20"
                      : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
                  }`}
                >
                  <DockLabel>{isHudVisible ? "Sembunyikan Panel Metrik" : "Tampilkan Panel Metrik"}</DockLabel>
                  <DockIcon>
                    {isHudVisible ? <Eye className="w-full h-full" /> : <EyeOff className="w-full h-full" />}
                    <button
                      type="button"
                      aria-label="Toggle Panel Metrik"
                      onClick={() => setIsHudVisible(!isHudVisible)}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
                )}
                <DockItem
                  className={`aspect-square rounded-full border ${
                    showHandles
                      ? "bg-slate-300 dark:bg-white/[0.18] text-slate-900 dark:text-white border-slate-400/50 dark:border-white/20"
                      : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
                  }`}
                >
                  <DockLabel>{showHandles ? "Sembunyikan Titik Sudut (Handle)" : "Tampilkan Titik Sudut (Handle)"}</DockLabel>
                  <DockIcon>
                    <CircleDot className="w-full h-full" />
                    <button
                      type="button"
                      aria-label="Toggle Titik Sudut Handle"
                      onClick={() => setShowHandles(!showHandles)}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
              </>
            )}

            {/* Grup 2D (dinamis: saat grafik atau geometri 2D aktif) */}
            {!is3DModel && (activeModel === "2d_quadratic" || activeModel === "2d_shape" || activeModel === "2d_circle") && (
              <>
                <div className="w-px h-8 bg-slate-300/70 dark:bg-white/10 mx-0.5 self-center shrink-0" />
                <DockItem
                  className={`aspect-square rounded-full border ${
                    showHandles
                      ? "bg-slate-300 dark:bg-white/[0.18] text-slate-900 dark:text-white border-slate-400/50 dark:border-white/20"
                      : "bg-slate-100/90 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 border-slate-200/70 dark:border-white/[0.08]"
                  }`}
                >
                  <DockLabel>{showHandles ? "Sembunyikan Titik Puncak / Sudut" : "Tampilkan Titik Puncak / Sudut"}</DockLabel>
                  <DockIcon>
                    <CircleDot className="w-full h-full" />
                    <button
                      type="button"
                      aria-label="Toggle Titik Puncak Sudut"
                      onClick={() => setShowHandles(!showHandles)}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
              </>
            )}

            {/* AKSI DINAMIS: muncul saat ada catatan terpilih */}
            <AnimatePresence>
              {selectedNote && (
                <motion.div
                  key="dock-note-actions"
                  className="flex items-center gap-1.5 sm:gap-2"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="w-px h-8 bg-amber-400/60 mx-0.5 self-center shrink-0" />
                  {(selectedDetected === "graph" ||
                    selectedNote.latex.includes("x") ||
                    selectedNote.latex.includes("sin") ||
                    (!selectedDetected && selectedNoteIsMath)) && (
                    <DockItem className="aspect-square rounded-full border bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30">
                      <DockLabel>Ubah ke Grafik 2D</DockLabel>
                      <DockIcon>
                        <Sparkles className="w-full h-full" />
                        <button
                          type="button"
                          aria-label="Ubah ke Grafik 2D"
                          onClick={() => handleTransformToGraph(selectedNote.rawText || selectedNote.latex)}
                          className="absolute inset-0 rounded-full cursor-pointer"
                        />
                      </DockIcon>
                    </DockItem>
                  )}
                  {(selectedDetected === "3d" ||
                    /kubus|prisma|limas|balok|bola|tabung/i.test(selectedNote.rawText || "") ||
                    (!selectedDetected && selectedNoteIsMath)) && (
                    <DockItem className="aspect-square rounded-full border bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30">
                      <DockLabel>Ubah ke Model 3D</DockLabel>
                      <DockIcon>
                        <Box className="w-full h-full" />
                        <button
                          type="button"
                          aria-label="Ubah ke Model 3D"
                          onClick={() => handleTransformTo3D(selectedNote.rawText || selectedNote.latex)}
                          className="absolute inset-0 rounded-full cursor-pointer"
                        />
                      </DockIcon>
                    </DockItem>
                  )}
                  {(selectedDetected === "2d_shape" ||
                    /jaring|persegi|segitiga|lingkaran/i.test(selectedNote.rawText || "")) && (
                    <DockItem className="aspect-square rounded-full border bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30">
                      <DockLabel>Ubah ke Diagram 2D</DockLabel>
                      <DockIcon>
                        <Layers className="w-full h-full" />
                        <button
                          type="button"
                          aria-label="Ubah ke Diagram 2D"
                          onClick={() => handleTransformTo2D(selectedNote.rawText || selectedNote.latex)}
                          className="absolute inset-0 rounded-full cursor-pointer"
                        />
                      </DockIcon>
                    </DockItem>
                  )}
                  <DockItem className="aspect-square rounded-full border bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30">
                    <DockLabel>{selectedNoteIsMath ? "Jadikan Teks Biasa" : "Jadikan KaTeX"}</DockLabel>
                    <DockIcon>
                      <Type className="w-full h-full" />
                      <button
                        type="button"
                        aria-label={selectedNoteIsMath ? "Jadikan Teks Biasa" : "Jadikan KaTeX"}
                        onClick={() =>
                          setFormulaNotes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNote.id
                                ? selectedNoteIsMath
                                  ? { ...n, kind: "text" }
                                  : { ...n, kind: "math", latex: autoFormatToLatex(n.rawText || n.latex) }
                                : n
                            )
                          )
                        }
                        className="absolute inset-0 rounded-full cursor-pointer"
                      />
                    </DockIcon>
                  </DockItem>
                  <DockItem className="aspect-square rounded-full border bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30">
                    <DockLabel>Hapus Catatan</DockLabel>
                    <DockIcon>
                      <Trash2 className="w-full h-full" />
                      <button
                        type="button"
                        aria-label="Hapus Catatan"
                        onClick={() => handleDeleteFormula(selectedNote.id)}
                        className="absolute inset-0 rounded-full cursor-pointer"
                      />
                    </DockIcon>
                  </DockItem>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reset total (dinamis: hanya saat papan tidak kosong) */}
            {(activeModel !== "empty" || hasDrawings || formulaNotes.length > 0) && (
              <>
                <div className="w-px h-8 bg-slate-300/70 dark:bg-white/10 mx-0.5 self-center shrink-0" />
                <DockItem className="aspect-square rounded-full border bg-slate-100/90 dark:bg-white/[0.07] text-slate-500 dark:text-zinc-400 border-slate-200/70 dark:border-white/[0.08] hover:!bg-rose-500/15">
                  <DockLabel>Reset / Bersihkan Kanvas</DockLabel>
                  <DockIcon>
                    <RotateCcw className="w-full h-full" />
                    <button
                      type="button"
                      aria-label="Reset / Bersihkan Seluruh Kanvas"
                      onClick={() => {
                        last3DModelRef.current = "3d_empty";
                        last2DModelRef.current = "2d_empty";
                        clearBoardShared();
                        setFormulaNotes([]);
                        setSelectedFormulaId(null);
                        setInlineComposer(null);
                        setIsTypingToolActive(false);
                        setIsDrawingToolActive(false);
                        setZoom2D(1);
                        setPan2D({ x: 0, y: 0 });
                        selectModel("empty");
                      }}
                      className="absolute inset-0 rounded-full cursor-pointer"
                    />
                  </DockIcon>
                </DockItem>
              </>
            )}
          </Dock>
          </div>
        </div>

        {/* G. KATEX FORMULA COMPOSER MODAL */}
        {isFormulaModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none">
            <div className="w-full max-w-lg rounded-2xl liquid-glass-popup border border-slate-200 dark:border-white/10 shadow-2xl p-5 space-y-4 animate-liquid-pop text-slate-800 dark:text-zinc-200 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 flex items-center justify-center text-amber-500 dark:text-amber-400">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {editingFormulaId ? "Edit Rumus KaTeX" : "Tulis Rumus KaTeX"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Ketik rumus rapi menggunakan keyboard tanpa stylus
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormulaModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Live Rendered KaTeX Preview Box */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Pratinjau Hasil Rumus:
                </span>
                <div className="min-h-[64px] p-4 rounded-xl bg-slate-100/90 dark:bg-[#0c0e16] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center text-center overflow-x-auto">
                  {latexDraft.trim() ? (
                    <div
                      className={
                        formulaFontSize === "sm"
                          ? "text-xs"
                          : formulaFontSize === "lg"
                          ? "text-lg font-medium"
                          : formulaFontSize === "xl"
                          ? "text-2xl font-bold"
                          : "text-base font-normal"
                      }
                    >
                      <MathView math={latexDraft} block />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-zinc-500 italic">
                      Ketik rumus di bawah atau klik simbol/template untuk melihat pratinjau...
                    </span>
                  )}
                </div>
              </div>

              {/* Keyboard LaTeX Input Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                  <span>Kode KaTeX / LaTeX (Ketik via Keyboard):</span>
                  <span className="text-[10px] lowercase text-slate-400 font-mono">
                    {"contoh: \\frac{a}{b}, x^2, \\sqrt{x}"}
                  </span>
                </label>
                <textarea
                  value={latexDraft}
                  onChange={(e) => setLatexDraft(e.target.value)}
                  placeholder="Misal: L = \frac{1}{2} \times a \times t atau a^2 + b^2 = c^2"
                  rows={2}
                  className="w-full bg-white dark:bg-[#121520] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition resize-none"
                  autoFocus
                />
              </div>

              {/* Quick Math Symbols Palette */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Simbol Cepat (Klik untuk Sisipkan):
                </div>
                <div className="flex flex-wrap gap-1">
                  {FORMULA_SYMBOLS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => handleInsertSymbol(sym.insert)}
                      className="px-2 py-1 rounded-lg text-xs font-mono bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.06] transition cursor-pointer"
                      title={`Sisipkan ${sym.insert}`}
                    >
                      {sym.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Math Formula Templates */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Template Rumus Populer:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {FORMULA_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setLatexDraft(tmpl.latex)}
                      className="px-2 py-1 rounded-lg text-[11px] bg-slate-100 hover:bg-amber-50 hover:text-amber-700 dark:bg-white/[0.04] dark:hover:bg-amber-500/15 dark:hover:text-amber-300 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.06] transition cursor-pointer"
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Controls: Color & Font Size */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                {/* Color Swatches */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">Warna:</span>
                  {(
                    [
                      { id: "default", bg: "bg-slate-700 dark:bg-zinc-200", label: "Standar" },
                      { id: "amber", bg: "bg-amber-500", label: "Kuning / Amber" },
                      { id: "emerald", bg: "bg-emerald-500", label: "Hijau" },
                      { id: "blue", bg: "bg-blue-500", label: "Biru" },
                      { id: "rose", bg: "bg-rose-500", label: "Merah" },
                      { id: "purple", bg: "bg-purple-500", label: "Ungu" },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormulaColor(c.id)}
                      className={`w-5 h-5 rounded-full ${c.bg} transition-all cursor-pointer ${
                        formulaColor === c.id
                          ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>

                {/* Font Size Selector */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-xl border border-slate-200 dark:border-white/[0.06]">
                  {(
                    [
                      { id: "sm", label: "S" },
                      { id: "base", label: "M" },
                      { id: "lg", label: "L" },
                      { id: "xl", label: "XL" },
                    ] as const
                  ).map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setFormulaFontSize(sz.id)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                        formulaFontSize === sz.id
                          ? "bg-white dark:bg-white/[0.16] text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormulaModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!latexDraft.trim()}
                  onClick={handleSaveFormula}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-40 text-white dark:text-zinc-950 text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingFormulaId ? "Perbarui Rumus" : "Pasang ke Papan"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  GeminiLogo,
  OpenAILogo,
  ClaudeLogo,
  DeepSeekLogo,
  NvidiaLogo,
  SymPyLogo,
  MistralLogo,
  OllamaLogo,
} from "@/components/CompanyLogos";
import { ZapLogo } from "@/components/ZapLogo";

export type ReasoningEffort = "low" | "medium" | "high";

export interface AIModel {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  badge?: string;
  costInput: string;
  contextWindow: string;
  latency: string;
  description: string;
  icon: React.ElementType;
  iconColor?: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  // 0. Auto-Agent (Router Cerdas Multi-Agent - Default 0 Setup)
  {
    id: "auto-agent",
    name: "Auto-Agent (Router Cerdas ZAP)",
    shortName: "Auto-Agent Cerdas",
    provider: "NVIDIA NIM / Cloud Auto",
    badge: "Default (0 Setup)",
    costInput: "Siap Pakai",
    contextWindow: "128k tokens",
    latency: "< 200ms",
    description: "Orkestrator pintar otomatis: mengarahkan ke Gemini 2.0 Flash Vision (Foto & Video), Nemotron-3.5 Bolt (Sokrates kilat), dan Nemotron-3 Omni (Matematika).",
    icon: ZapLogo,
    iconColor: "text-amber-500 dark:text-amber-400",
  },

  // 1. NVIDIA NIM Specialized Agent Cluster (Verified Valid Key)
  {
    id: "nvidia-bolt",
    name: "Nemotron-3.5 Bolt (Tutor Sokrates)",
    shortName: "Nemotron Bolt",
    provider: "NVIDIA NIM Cloud",
    badge: "Chat Tutor <200ms",
    costInput: "NVIDIA Key Valid",
    contextWindow: "128k tokens",
    latency: "< 200ms",
    description: "Agent tutor percakapan Sokrates super cepat dengan respon instan dan empati pedagogis tinggi.",
    icon: NvidiaLogo,
    iconColor: "text-[#76B900]",
  },
  {
    id: "nvidia-math-reasoning",
    name: "Nemotron-3 Omni 30B (Penalaran Matematika)",
    shortName: "Nemotron Math 30B",
    provider: "NVIDIA NIM Cloud",
    badge: "CoT Math Reasoning",
    costInput: "NVIDIA Key Valid",
    contextWindow: "128k tokens",
    latency: "~450ms",
    description: "Agent spesialis penalaran matematis murni dengan Chain-of-Thought untuk pembuktian dan kontra-contoh.",
    icon: NvidiaLogo,
    iconColor: "text-[#76B900]",
  },
  {
    id: "nvidia-spatial-vl",
    name: "Nemotron-3.5 Super-VL 120B (Geometri 3D & Spasial)",
    shortName: "Nemotron 3D 120B",
    provider: "NVIDIA NIM Cloud",
    badge: "3D/2D Spatial 120B",
    costInput: "NVIDIA Key Valid",
    contextWindow: "128k tokens",
    latency: "~600ms",
    description: "Agent spesialis pemodelan geometri 3D, koordinat spasial, grafik kartesius, dan penampang bidang irisan.",
    icon: NvidiaLogo,
    iconColor: "text-[#76B900]",
  },
  {
    id: "nvidia-ultra-550b",
    name: "Nemotron-3 Ultra 550B (Olimpiade & Bukti Mendalam)",
    shortName: "Nemotron Ultra 550B",
    provider: "NVIDIA NIM Cloud",
    badge: "Frontier 550B MoE",
    costInput: "NVIDIA Key Valid",
    contextWindow: "128k tokens",
    latency: "~900ms",
    description: "Model frontier raksasa 550B untuk analisis aljabar tingkat lanjut, pembuktian teorema, dan soal olimpiade.",
    icon: NvidiaLogo,
    iconColor: "text-[#76B900]",
  },
  {
    id: "poolside-laguna",
    name: "Poolside Laguna XS (Sintesis Kode Three.js & Kanvas)",
    shortName: "Poolside Code",
    provider: "NVIDIA NIM Cloud",
    badge: "Code Synthesizer",
    costInput: "NVIDIA Key Valid",
    contextWindow: "64k tokens",
    latency: "< 250ms",
    description: "Agent sintesis kode cepat untuk scripting Three.js, visualisasi grafik SVG, dan matematika komputasi.",
    icon: NvidiaLogo,
    iconColor: "text-[#76B900]",
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek-V4.1-Flash (NVIDIA NIM)",
    shortName: "DeepSeek V4.1",
    provider: "DeepSeek / NVIDIA",
    badge: "552B MoE",
    costInput: "NVIDIA Key Valid",
    contextWindow: "128k tokens",
    latency: "~350ms",
    description: "Model MoE penalaran analitis mendalam dari DeepSeek yang diakselerasi di cloud NVIDIA NIM.",
    icon: DeepSeekLogo,
    iconColor: "text-[#1E88E5] dark:text-[#42A5F5]",
  },

  // 2. Google Gemini (Default Auto Cloud & Multimodal)
  {
    id: "gemini-2.0-flash-vision",
    name: "Gemini 2.0 Flash (Multimodal Foto, Video & PDF)",
    shortName: "Gemini Vision & Media",
    provider: "Google DeepMind",
    badge: "Foto, Video & Dokumen",
    costInput: "Gratis (Backend Pool)",
    contextWindow: "1M tokens",
    latency: "< 350ms",
    description: "Model spesialis bervisi cerdas untuk memindai foto rumus coretan tangan, foto soal ujian matematika, dokumen PDF, dan video.",
    icon: GeminiLogo,
    iconColor: "text-[#4E8BF5]",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    shortName: "Gemini 2.0",
    provider: "Google DeepMind",
    badge: "Default Auto-Sync",
    costInput: "Gratis (Backend Pool)",
    contextWindow: "1M tokens",
    latency: "< 350ms",
    description: "Model default ZAP yang otomatis aktif saat login Google tanpa perlu konfigurasi API key manual.",
    icon: GeminiLogo,
    iconColor: "text-[#4E8BF5]",
  },

  // 3. OpenAI ChatGPT
  {
    id: "gpt-4o",
    name: "GPT-4o Omni",
    shortName: "GPT-4o",
    provider: "OpenAI",
    badge: "Flagship",
    costInput: "OpenAI Key / Akun",
    contextWindow: "128k tokens",
    latency: "~400ms",
    description: "Model multimodal tercanggih OpenAI untuk penalaran logika analitis.",
    icon: OpenAILogo,
    iconColor: "text-[#10A37F]",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    shortName: "GPT-4o Mini",
    provider: "OpenAI",
    badge: "Hemat & Cepat",
    costInput: "OpenAI Key / Akun",
    contextWindow: "128k tokens",
    latency: "< 200ms",
    description: "Model ringan super cepat untuk tanya-jawab sokrates instan.",
    icon: OpenAILogo,
    iconColor: "text-[#10A37F]",
  },

  // 4. Anthropic Claude
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    shortName: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    badge: "Frontier Math",
    costInput: "Anthropic Key / Akun",
    contextWindow: "200k tokens",
    latency: "~600ms",
    description: "Tutor Sokrates paling empatik dengan pemahaman pedagogis tertinggi.",
    icon: ClaudeLogo,
    iconColor: "text-[#D97706]",
  },

  // 5. Mistral AI
  {
    id: "codestral-latest",
    name: "Codestral 22B",
    shortName: "Codestral 22B",
    provider: "Mistral AI",
    badge: "Math Code",
    costInput: "Mistral Key / Akun",
    contextWindow: "32k tokens",
    latency: "~300ms",
    description: "Spesialis logika aljabar komputasi dan sintesis kurva SVG.",
    icon: MistralLogo,
    iconColor: "text-[#F54E00]",
  },

  // 6. SymPy CAS Local (Pure Deterministic - Tanpa LLM)
  {
    id: "sympy-cas-deterministic",
    name: "SymPy CAS (Deterministic)",
    shortName: "SymPy CAS Murni",
    provider: "Python Backend (FastAPI)",
    badge: "100% Deterministic",
    costInput: "Gratis (0 Biaya API)",
    contextWindow: "Tak Terbatas",
    latency: "< 50ms",
    description: "Engine kalkulasi simbolik deterministik tanpa halusinasi model generatif.",
    icon: SymPyLogo,
    iconColor: "text-[#3B82F6]",
  },

  // 7. BYO Custom Endpoint
  {
    id: "custom-byo",
    name: "Custom Model (BYO-Endpoint)",
    shortName: "Custom Model",
    provider: "Ollama / vLLM / LMStudio",
    badge: "Local Self-Hosted",
    costInput: "Sesuai Provider",
    contextWindow: "Konfigurasi Sendiri",
    latency: "Lokal",
    description: "Gunakan model open-source lokal via endpoint OpenAI-compatible.",
    icon: OllamaLogo,
    iconColor: "text-[#8B5CF6]",
  },
];

interface ModelPickerProps {
  selectedModelId: string;
  onSelectModel: (model: AIModel) => void;
  reasoningEffort: ReasoningEffort;
  onChangeEffort: (effort: ReasoningEffort) => void;
  variant?: "default" | "pill" | "chatzap";
  dropUp?: boolean;
}

// Daftar opsi tetap: dibuat sekali di module scope, bukan di setiap render.
const EFFORT_OPTIONS: readonly ReasoningEffort[] = ["low", "medium", "high"];

function formatEffort(eff: ReasoningEffort): string {
  if (eff === "high") return "High";
  if (eff === "medium") return "Medium";
  return "Low";
}

function ModelPickerWithEffort({
  selectedModelId,
  onSelectModel,
  reasoningEffort,
  onChangeEffort,
}: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"model" | "effort" | null>("model");
  const [isLockedOpen, setIsLockedOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const switchSubmenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentModel = useMemo(
    () => AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0],
    [selectedModelId]
  );

  // Callback parent bisa berubah identitas setiap render (fungsi inline di
  // halaman chat). Simpan versi terbarunya di ref saat render (pola latest-ref
  // yang idempoten) agar handler internal tetap stabil dan React.memo di bawah
  // benar-benar melewati render yang tidak perlu tanpa memakai callback basi.
  const onSelectModelRef = useRef(onSelectModel);
  const onChangeEffortRef = useRef(onChangeEffort);
  onSelectModelRef.current = onSelectModel;
  onChangeEffortRef.current = onChangeEffort;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update trigger rect on open or resize
  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (containerRef.current) {
        setTriggerRect(containerRef.current.getBoundingClientRect());
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handleSelectModel = useCallback((model: AIModel) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("zap_selected_model_id", model.id);
    }
    onSelectModelRef.current(model);
    setIsOpen(false);
    setIsLockedOpen(false);
  }, []);

  const handleSelectEffort = useCallback((effort: ReasoningEffort) => {
    onChangeEffortRef.current(effort);
    // Keep menu open so user sees selection and can continue selecting model
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target && target.closest(".zap-model-portal")) {
          return;
        }
        setIsOpen(false);
        setIsLockedOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (switchSubmenuTimeoutRef.current) clearTimeout(switchSubmenuTimeoutRef.current);
    };
  }, []);

  const handleMouseEnterContainer = () => {
    if (typeof window !== "undefined" && window.innerWidth < 580) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (containerRef.current) {
      setTriggerRect(containerRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
    if (!activeSubmenu) {
      setActiveSubmenu("model");
    }
  };

  const handleMouseLeaveContainer = () => {
    // If the menu was locked open via click, NEVER auto-close on mouse leave
    if (isLockedOpen) return;

    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    // Generous 650ms grace period so moving mouse doesn't instantly close
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 650);
  };

  const handleMouseEnterPortal = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Debounced row hover to prevent hair-trigger switching ("jangan langsung pindah gitu")
  const handleRowHover = (submenu: "model" | "effort") => {
    if (switchSubmenuTimeoutRef.current) {
      clearTimeout(switchSubmenuTimeoutRef.current);
    }
    if (activeSubmenu === submenu) return;

    // 160ms intentional hover debounce prevents accidental jumps during diagonal mouse traversal
    switchSubmenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(submenu);
    }, 160);
  };

  const handleRowLeave = () => {
    if (switchSubmenuTimeoutRef.current) {
      clearTimeout(switchSubmenuTimeoutRef.current);
      switchSubmenuTimeoutRef.current = null;
    }
  };

  const handleRowClick = (submenu: "model" | "effort") => {
    if (switchSubmenuTimeoutRef.current) {
      clearTimeout(switchSubmenuTimeoutRef.current);
      switchSubmenuTimeoutRef.current = null;
    }
    setActiveSubmenu(submenu);
    setIsLockedOpen(true);
  };

  // Layout Dimensions & Responsive Alignment
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1440;
  const isCompactViewport = viewportW < 580;
  const mainWidth = 232;
  const submenuWidth = activeSubmenu === "effort" ? 236 : 296;
  const rightOffset = triggerRect ? Math.max(12, viewportW - triggerRect.right) : 16;
  const bottomOffset = triggerRect ? Math.max(12, window.innerHeight - triggerRect.top + 6) : 56;

  // Submenu left alignment with boundary clamping
  const mainCardLeft = triggerRect ? triggerRect.right - mainWidth : 300;
  let submenuLeft = mainCardLeft - 8 - submenuWidth;
  if (submenuLeft < 12) {
    submenuLeft = 12;
  }

  // Card height clamped strictly to prevent top viewport clipping
  const maxSubmenuHeight = triggerRect ? Math.min(380, Math.max(220, triggerRect.top - 20)) : 360;

  // ---------------------------------------------------------------------------
  // Daftar opsi panjang di-memo: dibuat ulang hanya ketika pilihan aktif
  // berubah, bukan pada setiap render (hover, buka/tutup, atau ketikan di
  // komposer yang memicu render ulang komponen induk).
  // ---------------------------------------------------------------------------
  const effortRows = useMemo(
    () =>
      EFFORT_OPTIONS.map((opt) => {
        const isSelected = opt === reasoningEffort;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handleSelectEffort(opt)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-left ${
              isSelected
                ? "bg-zinc-900/[0.08] dark:bg-white/[0.14] text-zinc-950 dark:text-white font-semibold"
                : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  {formatEffort(opt)}
                </span>
                {opt === "low" && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
                    Paling Irit
                  </span>
                )}
                {opt === "high" && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono font-medium">
                    Maksimal
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight mt-0.5">
                {opt === "high"
                  ? "Penalaran bertingkat & CoT mendalam"
                  : opt === "medium"
                  ? "Keseimbangan kecepatan dan analisis"
                  : "Respon instan & sangat hemat token"}
              </span>
            </div>
            {isSelected && (
              <Check className="w-4 h-4 text-zinc-900 dark:text-white shrink-0 ml-2" />
            )}
          </button>
        );
      }),
    [reasoningEffort, handleSelectEffort]
  );

  const desktopEffortRows = useMemo(
    () =>
      EFFORT_OPTIONS.map((opt) => {
        const isSelected = opt === reasoningEffort;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handleSelectEffort(opt)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-left ${
              isSelected
                ? "bg-zinc-900/[0.08] dark:bg-white/[0.14] text-zinc-950 dark:text-white font-semibold"
                : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  {formatEffort(opt)}
                </span>
                {opt === "low" && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
                    Paling Irit
                  </span>
                )}
                {opt === "high" && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono font-medium">
                    Maksimal
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight mt-0.5">
                {opt === "high"
                  ? "Penalaran bertingkat & CoT mendalam"
                  : opt === "medium"
                  ? "Keseimbangan kecepatan dan analisis"
                  : "Respon instan & sangat hemat token"}
              </span>
            </div>
            {isSelected && (
              <Check className="w-4 h-4 text-zinc-900 dark:text-white shrink-0 ml-2" />
            )}
          </button>
        );
      }),
    [reasoningEffort, handleSelectEffort]
  );

  const compactModelRows = useMemo(
    () =>
      AVAILABLE_MODELS.map((model) => {
        const isSelected = model.id === currentModel.id;
        const Icon = model.icon;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => handleSelectModel(model)}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
              isSelected
                ? "bg-zinc-900/[0.08] dark:bg-white/[0.14] text-zinc-950 dark:text-white font-semibold"
                : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className={`w-4 h-4 shrink-0 ${model.iconColor || "text-zinc-500"}`} />
              <span className="truncate">{model.name}</span>
            </div>
            {isSelected && (
              <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white shrink-0 ml-1.5" />
            )}
          </button>
        );
      }),
    [currentModel.id, handleSelectModel]
  );

  const desktopModelRows = useMemo(
    () =>
      AVAILABLE_MODELS.map((model) => {
        const isSelected = model.id === currentModel.id;
        const Icon = model.icon;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => handleSelectModel(model)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium transition cursor-pointer text-left ${
              isSelected
                ? "bg-zinc-900/[0.08] dark:bg-white/[0.14] text-zinc-950 dark:text-white font-semibold"
                : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className={`w-4 h-4 shrink-0 ${model.iconColor || "text-zinc-500"}`} />
              <span className="truncate">{model.name}</span>
            </div>
            {isSelected && (
              <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white shrink-0 ml-1.5" />
            )}
          </button>
        );
      }),
    [currentModel.id, handleSelectModel]
  );

  return (
    <div
      className="relative inline-block text-left"
      ref={containerRef}
      onMouseEnter={handleMouseEnterContainer}
      onMouseLeave={handleMouseLeaveContainer}
    >
      {/* Trigger Button (Clean Harness Aesthetic) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (containerRef.current) {
            setTriggerRect(containerRef.current.getBoundingClientRect());
          }
          setIsOpen((prev) => {
            if (prev && !isLockedOpen) {
              setIsLockedOpen(true);
              if (!activeSubmenu) setActiveSubmenu("model");
              return true;
            }
            const next = !prev;
            setIsLockedOpen(next);
            if (next && !activeSubmenu) setActiveSubmenu("model");
            return next;
          });
        }}
        aria-label={`Pilih model AI dan tingkat penalaran. Saat ini: ${currentModel.name}, Effort ${formatEffort(reasoningEffort)}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`Model: ${currentModel.name} • Effort: ${formatEffort(reasoningEffort)}`}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 min-h-[28px] rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      >
        <span className="hidden min-[430px]:inline font-medium text-xs text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
          {currentModel.id.includes("deepseek") ? "DeepSeek-V4.1-Flash" : currentModel.shortName}
        </span>
        <span className="min-[430px]:hidden font-medium text-xs text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
          {currentModel.id === "auto-agent" ? "Auto-Agent" : currentModel.id.includes("deepseek") ? "DeepSeek" : currentModel.shortName}
        </span>
        <span className="text-zinc-600 dark:text-zinc-400 text-xs whitespace-nowrap">
          {formatEffort(reasoningEffort)}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-zinc-900 dark:text-white" : ""
          }`}
        />
      </button>

      {/* PORTALED CONTEXT MENU (Responsive Single-Sheet on <580px, 2-Tier Flyout on >=580px) */}
      {mounted && isOpen && triggerRect && createPortal(
        <div
          className="zap-model-portal"
          onMouseEnter={handleMouseEnterPortal}
          onMouseLeave={handleMouseLeaveContainer}
        >
          {isCompactViewport ? (
            /* COMPACT MOBILE SHEET (< 580px): Zero horizontal collision, unified tab switcher */
            <div
              style={{
                position: "fixed",
                bottom: `${bottomOffset}px`,
                left: "12px",
                right: "12px",
                maxHeight: `${maxSubmenuHeight}px`,
                zIndex: 9999,
              }}
              className="liquid-glass-popup rounded-2xl p-2 text-zinc-800 dark:text-zinc-200 shadow-2xl border border-zinc-200/90 dark:border-white/10 backdrop-blur-2xl animate-liquid-pop origin-bottom flex flex-col overflow-hidden select-none"
            >
              {/* Mobile Segmented Switcher: Model vs Effort */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06] mb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRowClick("model")}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeSubmenu !== "effort"
                      ? "bg-white dark:bg-[#1e2028] text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  Model AI ({AVAILABLE_MODELS.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleRowClick("effort")}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeSubmenu === "effort"
                      ? "bg-white dark:bg-[#1e2028] text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  Effort: {formatEffort(reasoningEffort)}
                </button>
              </div>

              {activeSubmenu === "effort" ? (
                <div className="space-y-1 px-0.5 overflow-y-auto">{effortRows}</div>
              ) : (
                <>
                  <div className="space-y-0.5 overflow-y-auto pr-1 no-scrollbar flex-1">{compactModelRows}</div>
                  <div className="mt-1.5 pt-1.5 border-t border-zinc-200/60 dark:border-white/[0.08] shrink-0">
                    <Link
                      href="/connector"
                      onClick={() => {
                        setIsOpen(false);
                        setIsLockedOpen(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] transition"
                    >
                      <span>Kelola API Key &amp; Hub...</span>
                      <ExternalLink className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* ZERO-DROP INVISIBLE BRIDGE: connects Card 1 and Card 2 so cursor motion never leaves portal */}
              <div
                style={{
                  position: "fixed",
                  bottom: `${bottomOffset}px`,
                  left: `${submenuLeft + submenuWidth - 4}px`,
                  width: `${Math.max(16, mainCardLeft - (submenuLeft + submenuWidth) + 8)}px`,
                  height: `${maxSubmenuHeight}px`,
                  zIndex: 9998,
                }}
                className="pointer-events-auto bg-transparent"
              />

              {/* CARD 1: MAIN CONTEXT MENU (Model & Effort rows) */}
              <div
                style={{
                  position: "fixed",
                  bottom: `${bottomOffset}px`,
                  right: `${rightOffset}px`,
                  width: `${mainWidth}px`,
                  zIndex: 9999,
                }}
                className="liquid-glass-popup rounded-2xl p-1.5 text-zinc-800 dark:text-zinc-200 shadow-2xl border border-zinc-200/90 dark:border-white/10 backdrop-blur-2xl animate-liquid-pop origin-bottom-right select-none"
              >
                {/* Row 1: Model */}
                <button
                  type="button"
                  onMouseEnter={() => handleRowHover("model")}
                  onMouseLeave={handleRowLeave}
                  onClick={() => handleRowClick("model")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                    activeSubmenu === "model"
                      ? "bg-zinc-900/[0.08] dark:bg-white/[0.12] text-zinc-950 dark:text-white font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  <span>Model</span>
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="truncate max-w-[105px] text-xs font-normal text-right">
                      {currentModel.id.includes("deepseek") ? "DeepSeek V4.1" : currentModel.shortName}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  </div>
                </button>

                {/* Row 2: Effort */}
                <button
                  type="button"
                  onMouseEnter={() => handleRowHover("effort")}
                  onMouseLeave={handleRowLeave}
                  onClick={() => handleRowClick("effort")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                    activeSubmenu === "effort"
                      ? "bg-zinc-900/[0.08] dark:bg-white/[0.12] text-zinc-950 dark:text-white font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  <span>Effort</span>
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="text-xs font-normal text-right">
                      {formatEffort(reasoningEffort)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  </div>
                </button>
              </div>

              {/* CARD 2A: MODEL SELECTION SUBMENU (Opens left of main card with zero top clipping) */}
              {activeSubmenu === "model" && (
                <div
                  style={{
                    position: "fixed",
                    bottom: `${bottomOffset}px`,
                    left: `${submenuLeft}px`,
                    width: `${submenuWidth}px`,
                    maxHeight: `${maxSubmenuHeight}px`,
                    zIndex: 9999,
                  }}
                  className="liquid-glass-popup rounded-2xl p-2 text-zinc-800 dark:text-zinc-200 shadow-2xl border border-zinc-200/90 dark:border-white/10 backdrop-blur-2xl animate-liquid-pop origin-bottom-right flex flex-col overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="px-2.5 py-1.5 border-b border-zinc-200/80 dark:border-white/[0.08] mb-1 flex items-center justify-between shrink-0">
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                      PILIH MODEL AI
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      {AVAILABLE_MODELS.length} Model
                    </span>
                  </div>

                  {/* Scrollable Model List */}
                  <div className="space-y-0.5 overflow-y-auto pr-1 no-scrollbar flex-1">{desktopModelRows}</div>

                  {/* Footer */}
                  <div className="mt-1.5 pt-1.5 border-t border-zinc-200/60 dark:border-white/[0.08] shrink-0">
                    <Link
                      href="/connector"
                      onClick={() => {
                        setIsOpen(false);
                        setIsLockedOpen(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.06] transition"
                    >
                      <span>Kelola API Key &amp; Hub...</span>
                      <ExternalLink className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    </Link>
                  </div>
                </div>
              )}

              {/* CARD 2B: REASONING EFFORT SUBMENU (Opens left of main card with descriptions & badges) */}
              {activeSubmenu === "effort" && (
                <div
                  style={{
                    position: "fixed",
                    bottom: `${bottomOffset}px`,
                    left: `${submenuLeft}px`,
                    width: `${submenuWidth}px`,
                    zIndex: 9999,
                  }}
                  className="liquid-glass-popup rounded-2xl p-2 text-zinc-800 dark:text-zinc-200 shadow-2xl border border-zinc-200/90 dark:border-white/10 backdrop-blur-2xl animate-liquid-pop origin-bottom-right select-none"
                >
                  <div className="px-2.5 py-1.5 border-b border-zinc-200/80 dark:border-white/[0.08] mb-1 flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                      REASONING EFFORT
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                      Hemat Token
                    </span>
                  </div>

                  <div className="space-y-1 px-0.5">{desktopEffortRows}</div>
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// Hanya berubah-tampilan yang memicu render ulang. Identitas callback parent
// sengaja diabaikan: handler internal membaca callback terbaru lewat ref,
// sehingga mengabaikannya tidak membuat perilaku menjadi basi.
function areModelPickerPropsEqual(prev: ModelPickerProps, next: ModelPickerProps): boolean {
  return (
    prev.selectedModelId === next.selectedModelId &&
    prev.reasoningEffort === next.reasoningEffort &&
    prev.variant === next.variant &&
    prev.dropUp === next.dropUp
  );
}

export default React.memo(ModelPickerWithEffort, areModelPickerPropsEqual);

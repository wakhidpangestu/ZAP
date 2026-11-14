"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { type ZAPUser } from "@/components/GoogleAuthButton";
import { syncAccountBackup, restoreAccountData } from "@/utils/account-sync";
import {
  getProviderKey,
  setProviderKey,
  getProviderSetting,
  setProviderSetting,
  migrateLegacyProviderKeys,
  type ProviderId,
} from "@/utils/provider-keys";
import { AVAILABLE_MODELS } from "@/components/ModelPickerWithEffort";
import { LocalEnclaveEmblem } from "@/components/PlatformIcons";
import {
  GeminiLogo,
  OpenAILogo,
  ClaudeLogo,
  DeepSeekLogo,
  NvidiaLogo,
  OllamaLogo,
  SymPyLogo,
  MistralLogo,
} from "@/components/CompanyLogos";

interface ProviderConfig {
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ElementType;
  badge: string;
  modelId: string;
  docUrl: string;
  docLabel: string;
  keyPrefix: string;
  placeholder: string;
  tutorialSteps: string[];
  note?: string;
  isCustom?: boolean;
  tint?: string;
}

/**
 * Pemetaan id kartu di halaman ini → id provider di utils/provider-keys.ts.
 * Kartu "deepseek" memakai kunci BazaarLink (kunci yang sama dengan DeepSeek).
 */
const PROVIDER_KEY_IDS: Record<string, ProviderId> = {
  gemini: "gemini",
  openai: "openai",
  deepseek: "bazaarlink",
  claude: "claude",
  nvidia: "nvidia",
  mistral: "mistral",
  custom: "custom",
};

/** Pola pembacaan user yang sudah dipakai halaman ini: cache `zap_authenticated_user`. */
function readStoredUser(): ZAPUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("zap_authenticated_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ZAPUser) : null;
  } catch {
    return null;
  }
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini AI",
    shortDesc: "Model bawaan default ChatZAP dari Google DeepMind dengan konteks 1M token.",
    icon: GeminiLogo,
    badge: "Default / BYOK",
    tint: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25",
    modelId: "gemini-2.0-flash",
    docUrl: "https://aistudio.google.com/app/apikey",
    docLabel: "aistudio.google.com",
    keyPrefix: "AIzaSy...",
    placeholder: "AIzaSy... (Google AI Studio Key)",
    note: "Akun Google yang login otomatis terhubung ke pool server ZAP. Menambahkan API key pribadi bersifat opsional untuk kuota pribadi dan prioritas latensi.",
    tutorialSteps: [
      "Buka Google AI Studio di browser Anda (aistudio.google.com/app/apikey).",
      "Login menggunakan akun Google Anda.",
      "Klik tombol 'Create API key' dan pilih proyek Google Cloud Anda (atau buat baru).",
      "Salin kunci API yang diawali dengan huruf 'AIzaSy...'.",
      "Tempelkan kunci pada kolom input lalu klik 'Simpan'.",
    ],
  },
  {
    id: "openai",
    name: "OpenAI ChatGPT",
    shortDesc: "Akses model penalaran multimodal GPT-4o dan versi cepat GPT-4o Mini.",
    icon: OpenAILogo,
    badge: "GPT-4o",
    tint: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25",
    modelId: "gpt-4o",
    docUrl: "https://platform.openai.com/api-keys",
    docLabel: "platform.openai.com",
    keyPrefix: "sk-proj-...",
    placeholder: "sk-proj-... (OpenAI API Key)",
    note: "Pastikan akun OpenAI Anda memiliki saldo kredit API aktif agar tidak mengalami galat kuota.",
    tutorialSteps: [
      "Buka dashboard resmi OpenAI Developer di platform.openai.com/api-keys.",
      "Masuk dengan akun OpenAI Anda.",
      "Klik tombol '+ Create new secret key'.",
      "Beri nama kunci (misal: 'ChatZAP') dan klik 'Create secret key'.",
      "Salin kunci yang muncul (awalan 'sk-proj-' atau 'sk-') lalu simpan di kartu OpenAI.",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek AI",
    shortDesc: "Model penalaran mendalam (Chain-of-Thought) dengan akurasi dekomposisi aljabar tinggi.",
    icon: DeepSeekLogo,
    badge: "DeepSeek V4.1",
    tint: "bg-blue-600/10 dark:bg-blue-600/15 border-blue-600/25",
    modelId: "deepseek-v4.1-flash",
    docUrl: "https://platform.deepseek.com/api_keys",
    docLabel: "platform.deepseek.com",
    keyPrefix: "sk-...",
    placeholder: "sk-... (DeepSeek API Key)",
    note: "DeepSeek sangat tangguh dalam membimbing penalaran langkah demi langkah dan dekomposisi rumus.",
    tutorialSteps: [
      "Kunjungi platform resmi DeepSeek di platform.deepseek.com.",
      "Daftar atau masuk ke akun Anda, lalu pilih menu 'API Keys' di sidebar kiri.",
      "Klik tombol 'Create API key', masukkan nama deskripsi (misal: 'ChatZAP').",
      "Salin kunci rahasia yang dihasilkan (awalan 'sk-') lalu simpan.",
    ],
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    shortDesc: "Model Claude 3.5 Sonnet dengan struktur logika ketat dan sintaks LaTeX rapi.",
    icon: ClaudeLogo,
    badge: "Claude 3.5",
    tint: "bg-amber-600/10 dark:bg-amber-600/15 border-amber-600/25",
    modelId: "claude-3-5-sonnet",
    docUrl: "https://console.anthropic.com/settings/keys",
    docLabel: "console.anthropic.com",
    keyPrefix: "sk-ant-...",
    placeholder: "sk-ant-... (Anthropic Key)",
    note: "Claude 3.5 Sonnet memberikan penjelasan Sokrates yang empatik dan terstruktur.",
    tutorialSteps: [
      "Buka Anthropic Console di console.anthropic.com.",
      "Login dan pastikan akun organisasi Anda telah terverifikasi.",
      "Buka menu 'API Keys' di bawah pengaturan profil atau workspace.",
      "Klik 'Create Key', beri label (misal: 'ChatZAP'), lalu salin kunci berawalan 'sk-ant-'.",
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM Cloud",
    shortDesc: "Inferensi GPU cloud berkecepatan tinggi dari NVIDIA dengan 1.000 kredit gratis.",
    icon: NvidiaLogo,
    badge: "NIM Free Tier",
    tint: "bg-lime-500/10 dark:bg-lime-500/15 border-lime-500/25",
    modelId: "nvidia-deepseek-v4",
    docUrl: "https://build.nvidia.com",
    docLabel: "build.nvidia.com",
    keyPrefix: "nvapi-...",
    placeholder: "nvapi-... (NVIDIA NIM Key)",
    note: "NVIDIA menyediakan 1.000 kredit inferensi gratis untuk akun pengembang terdaftar.",
    tutorialSteps: [
      "Buka katalog model AI NVIDIA di build.nvidia.com.",
      "Klik tombol 'Log In' di kanan atas dan masuk dengan akun NVIDIA Anda.",
      "Pilih model 'DeepSeek' atau model open-source yang tersedia.",
      "Klik tombol hijau 'Get API Key' lalu salin kunci yang diawali dengan 'nvapi-'.",
    ],
  },
  {
    id: "mistral",
    name: "Mistral & Codestral",
    shortDesc: "Model penalaran matematika dan penulisan sintaks komputasi cepat (~200ms).",
    icon: MistralLogo,
    badge: "Codestral 22B",
    tint: "bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/25",
    modelId: "codestral-latest",
    docUrl: "https://console.mistral.ai/api-keys",
    docLabel: "console.mistral.ai",
    keyPrefix: "Bearer token",
    placeholder: "Masukkan Mistral API Key",
    note: "Codestral 22B sangat cepat dan efisien untuk verifikasi langkah perhitungan simbolik.",
    tutorialSteps: [
      "Buka portal resmi pengembang Mistral di console.mistral.ai.",
      "Masuk atau buat akun pengembang Mistral Anda.",
      "Pilih menu 'API Keys' pada navigasi akun.",
      "Klik tombol 'Create new key', beri nama (misal: 'ChatZAP') dan salin kuncinya.",
    ],
  },
  {
    id: "custom",
    name: "Model Lokal (Ollama / vLLM / LM Studio)",
    shortDesc: "Hubungkan model AI yang berjalan di komputer lokal atau endpoint kompatibel OpenAI.",
    icon: OllamaLogo,
    badge: "Self-Hosted / Offline",
    tint: "bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/25",
    modelId: "custom-api",
    docUrl: "https://ollama.com",
    docLabel: "ollama.com",
    keyPrefix: "http://localhost:...",
    placeholder: "Kunci API opsional (Bearer token)",
    isCustom: true,
    tutorialSteps: [
      "Jalankan server model lokal di komputer Anda, contohnya Ollama: jalankan perintah 'ollama run llama3.3' di terminal.",
      "Pastikan service Ollama berjalan pada port standar: http://localhost:11434/v1.",
      "Jika menggunakan LM Studio, buka tab 'Developer' dan klik 'Start Server' (port standar http://localhost:1234/v1).",
      "Masukkan URL Endpoint dan Nama Model yang sesuai, lalu klik 'Simpan' dan 'Uji Koneksi'.",
    ],
  },
];

const QUICK_MODELS = [
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    sub: "Google DeepMind",
    icon: GeminiLogo,
    tint: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25",
  },
  {
    id: "deepseek-v4.1-flash",
    label: "DeepSeek V4.1",
    sub: "DeepSeek AI",
    icon: DeepSeekLogo,
    tint: "bg-blue-600/10 dark:bg-blue-600/15 border-blue-600/25",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o Omni",
    sub: "OpenAI",
    icon: OpenAILogo,
    tint: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25",
  },
  {
    id: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    sub: "Anthropic",
    icon: ClaudeLogo,
    tint: "bg-amber-600/10 dark:bg-amber-600/15 border-amber-600/25",
  },
  {
    id: "nvidia-deepseek-v4",
    label: "NVIDIA NIM",
    sub: "GPU Cloud",
    icon: NvidiaLogo,
    tint: "bg-lime-500/10 dark:bg-lime-500/15 border-lime-500/25",
  },
  {
    id: "sympy-cfl",
    label: "SymPy CAS",
    sub: "Offline < 1 ms",
    icon: SymPyLogo,
    tint: "bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/25",
  },
];

export default function ConnectorPage() {
  // Active Model State
  const [activeModelId, setActiveModelId] = useState<string>("gemini-2.0-flash");
  const [activeModelNotice, setActiveModelNotice] = useState<string>("");

  // Storage Key States
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeyVisibility, setShowKeyVisibility] = useState<Record<string, boolean>>({});

  // Akun yang memuat halaman ini. Disimpan di ref agar tab ini tetap memakai
  // namespace akunnya sendiri walau tab lain di peramban yang sama login akun lain.
  const currentUserRef = useRef<ZAPUser | null>(null);

  // Custom API configuration
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("http://localhost:11434/v1");
  const [customModelName, setCustomModelName] = useState<string>("llama3.3");

  // Modal state for Provider Setup Guide
  const [guideProvider, setGuideProvider] = useState<ProviderConfig | null>(null);

  // Testing states
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string }>>({});

  // Muat state tersimpan saat mount.
  // Kunci provider HANYA dibaca dari sesi peramban per akun (utils/provider-keys.ts),
  // bukan dari localStorage global dan bukan dari vault server.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedUser = readStoredUser();
    currentUserRef.current = storedUser;

    // Pindahkan sisa kunci global lama (lintas akun) ke namespace akun ini,
    // lalu hapus salinan globalnya agar akun lain tidak dapat membacanya.
    migrateLegacyProviderKeys(storedUser);

    const savedModel = localStorage.getItem("zap_selected_model_id") || "gemini-2.0-flash";
    setActiveModelId(savedModel);

    const loadedKeys: Record<string, string> = {};
    for (const provider of PROVIDERS) {
      const providerKeyId = PROVIDER_KEY_IDS[provider.id];
      loadedKeys[provider.id] = providerKeyId ? getProviderKey(providerKeyId, storedUser) || "" : "";
    }
    setKeys(loadedKeys);

    setCustomBaseUrl(getProviderSetting("customBaseUrl", storedUser) || "http://localhost:11434/v1");
    setCustomModelName(getProviderSetting("customModelName", storedUser) || "llama3.3");

    if (storedUser) {
      // restoreAccountData hanya memulihkan percakapan, workspaces, dan
      // preferensi non-rahasia. Kunci provider TIDAK dipulihkan dari server.
      restoreAccountData(storedUser)
        .then((restored) => {
          if (restored.configs?.selectedModelId) setActiveModelId(restored.configs.selectedModelId);
        })
        .catch((err) => {
          console.warn("Gagal membaca backup akun di connector:", err);
        });
    }
  }, []);

  const handleSelectActiveModel = (modelId: string, modelName: string) => {
    setActiveModelId(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem("zap_selected_model_id", modelId);
      setActiveModelNotice(`Model aktif diubah ke ${modelName}`);
      setTimeout(() => setActiveModelNotice(""), 3000);
      try {
        const u = currentUserRef.current;
        if (u) {
          syncAccountBackup(u, { configs: { selectedModelId: modelId } });
        }
      } catch {}
    }
  };

  const handleSaveKey = (providerId: string, val: string, providerName: string) => {
    if (typeof window === "undefined") return;
    const cleanVal = val.trim();
    // Nilai kosong menghapus kunci dari sesi akun ini (setProviderKey menangani trim).
    const providerKeyId = PROVIDER_KEY_IDS[providerId];
    if (providerKeyId) setProviderKey(providerKeyId, cleanVal, currentUserRef.current);
    setKeys((prev) => ({ ...prev, [providerId]: cleanVal }));

    // Sengaja TIDAK memanggil syncAccountBackup: kunci provider tidak pernah
    // dikirim ke vault server, jadi tidak ada data rahasia yang perlu disinkronkan.
    setTestResults((prev) => ({
      ...prev,
      [providerId]: {
        success: true,
        msg: cleanVal
          ? `Kunci ${providerName} disimpan.`
          : `Kunci ${providerName} dihapus.`,
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy[providerId];
        return copy;
      });
    }, 3500);
  };

  const handleSaveCustomSettings = () => {
    if (typeof window === "undefined") return;
    const user = currentUserRef.current;
    // Endpoint/model lokal juga hanya hidup di sesi peramban per akun.
    setProviderSetting("customBaseUrl", customBaseUrl, user);
    setProviderSetting("customModelName", customModelName, user);
    setProviderKey("custom", keys["custom"] || "", user);

    setTestResults((prev) => ({
      ...prev,
      custom: {
        success: true,
        msg: "Konfigurasi model lokal berhasil disimpan.",
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy["custom"];
        return copy;
      });
    }, 3500);
  };

  const handleDeleteKey = (providerId: string, providerName: string) => {
    if (typeof window === "undefined") return;
    const providerKeyId = PROVIDER_KEY_IDS[providerId];
    if (providerKeyId) setProviderKey(providerKeyId, "", currentUserRef.current);
    setKeys((prev) => ({ ...prev, [providerId]: "" }));

    setTestResults((prev) => ({
      ...prev,
      [providerId]: {
        success: true,
        msg: `Kunci ${providerName} dihapus.`,
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy[providerId];
        return copy;
      });
    }, 3500);
  };

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeyVisibility((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const handleTestConnection = async (provider: ProviderConfig) => {
    const keyVal = (keys[provider.id] || "").trim();
    setTestingProviderId(provider.id);

    try {
      if (provider.id === "gemini") {
        const res = await fetch("/api/auth/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: keyVal || "DEFAULT_SYNC" }),
        });
        const data = await res.json();
        if (data.valid) {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: true,
              msg: `Terhubung (${data.tier || "Aktif"}, ${data.latencyMs}ms)`,
            },
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: false,
              msg: data.error || "Gagal memverifikasi kunci Gemini.",
            },
          }));
        }
      } else {
        const bodyPayload: Record<string, string | undefined> = {
          message: "Halo! Jawab dengan satu kata.",
          modelId: provider.modelId,
        };

        if (provider.id === "openai") bodyPayload.openaiApiKey = keyVal;
        if (provider.id === "deepseek") bodyPayload.bazaarlinkApiKey = keyVal;
        if (provider.id === "claude") bodyPayload.claudeApiKey = keyVal;
        if (provider.id === "nvidia") bodyPayload.nvidiaApiKey = keyVal;
        if (provider.id === "mistral") bodyPayload.mistralApiKey = keyVal;
        if (provider.id === "custom") {
          bodyPayload.customBaseUrl = customBaseUrl;
          bodyPayload.customModelName = customModelName;
          bodyPayload.customApiKey = keyVal;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();
        if (res.ok && data.reply && !data.reply.includes("⚠️")) {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: true,
              msg: `Koneksi sukses! Respons diterima.`,
            },
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: false,
              msg: data.reply || data.error || "Respons tidak valid.",
            },
          }));
        }
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: false,
          msg: err instanceof Error ? err.message : "Kesalahan jaringan.",
        },
      }));
    } finally {
      setTestingProviderId(null);
    }
  };

  const currentActiveModelObj =
    AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0];
  const ActiveModelBrandIcon = currentActiveModelObj.icon;
  const savedKeyCount = Object.values(keys).filter(Boolean).length;

  const cloudProviders = PROVIDERS.filter((p) => !p.isCustom);
  const customProvider = PROVIDERS.find((p) => p.isCustom)!;

  return (
    <div className="min-h-screen bg-[#fbf7f0] dark:bg-[#090a0f] text-[#09090b] dark:text-zinc-100 font-sans selection:bg-[#d4a574]/30 selection:text-[#09090b] dark:selection:text-white transition-colors duration-200">
      <SiteHeader />

      {/* 2. MAIN CONTENT CONTAINER (WIDE MULTI-COLUMN LAYOUT) */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-4 space-y-6">
        {/* Compact Header & Active Model Status */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              <LocalEnclaveEmblem className="w-3 h-3" />
              <span>BYOK Enclave &amp; Multi-Model Router</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#09090b] dark:text-white tracking-tight">
              Konektor Model AI &amp; Kunci API
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
              Pilih model utama untuk sesi Sokrates Anda dan kelola kunci API di satu layar ringkas. Semua respons tetap diverifikasi oleh SymPy CAS &amp; Zero-Answer Guardrail.
            </p>
          </div>

          {/* Active Model Pill Display */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#11131a] border border-zinc-200/90 dark:border-white/[0.08] shadow-2xs shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/[0.06] border border-zinc-200/80 dark:border-white/[0.1] shadow-2xs flex items-center justify-center shrink-0">
              <ActiveModelBrandIcon className="w-4.5 h-4.5" />
            </div>
            <div className="pr-1">
              <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Model Aktif Saat Ini
              </div>
              <div className="text-xs font-bold text-[#09090b] dark:text-white flex items-center gap-1.5">
                <span>{currentActiveModelObj.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notification when Switching Active Model */}
        {activeModelNotice && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{activeModelNotice}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION 1: COMPACT 6-COLUMN QUICK MODEL SWITCHER BAR */}
        {/* =================================================================== */}
        <section className="p-4 rounded-2xl bg-white dark:bg-[#11131a] border border-zinc-200/90 dark:border-white/[0.08] shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Pilih Cepat Model Utama ChatZAP
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">
              Klik untuk mengaktifkan langsung
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {QUICK_MODELS.map((item) => {
              const isSelected = activeModelId === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectActiveModel(item.id, item.label)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 min-w-0 ${
                    isSelected
                      ? "bg-[#09090b] dark:bg-white border-[#09090b] dark:border-white text-white dark:text-[#09090b] shadow-xs"
                      : "bg-[#faf9f6] dark:bg-white/[0.02] border-zinc-200/80 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-white/[0.05]"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-white/20 dark:bg-white/20 border border-white/30"
                        : `${item.tint} border shadow-2xs`
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isSelected
                          ? "text-zinc-300 dark:text-zinc-600"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 2: 3-COLUMN GRID OF CLOUD AI PROVIDERS */}
        {/* =================================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <h2 className="text-xs font-bold text-[#09090b] dark:text-white tracking-wider uppercase">
                Penyedia Cloud AI (BYOK)
              </h2>
            </div>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {savedKeyCount} dari {PROVIDERS.length} Dikonfigurasi
            </span>
          </div>

          {/* Pemberitahuan kebijakan penyimpanan kunci (per akun, hanya sesi peramban) */}
          <div className="px-3 py-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.08] text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Kunci API disimpan di sesi peramban ini untuk akun yang sedang login. Bila vault
              terenkripsi aktif, kunci ikut dicadangkan ke akun Anda dalam bentuk{" "}
              <strong className="text-[#09090b] dark:text-zinc-200">ciphertext zero-knowledge</strong>{" "}
              - server tidak dapat membacanya, dan perangkat lain cukup membuka vault dengan
              passphrase yang sama.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cloudProviders.map((provider) => {
              const IconComp = provider.icon;
              const hasKey = Boolean(keys[provider.id]);
              const testResult = testResults[provider.id];
              const isTesting = testingProviderId === provider.id;
              const isKeyVisible = showKeyVisibility[provider.id] || false;
              const isModelSelected = activeModelId === provider.modelId;

              return (
                <div
                  key={provider.id}
                  className={`rounded-2xl bg-white dark:bg-[#11131a] border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
                    isModelSelected
                      ? "border-[#09090b] dark:border-white/40 ring-1 ring-[#09090b]/10 dark:ring-white/15 shadow-sm"
                      : "border-zinc-200/90 dark:border-white/[0.08] shadow-2xs hover:border-zinc-300 dark:hover:border-white/[0.14]"
                  }`}
                >
                  {/* Top Info Area */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors shadow-2xs ${
                            provider.tint || "bg-[#faf9f6] dark:bg-white/[0.04] border-zinc-200/80 dark:border-white/[0.08]"
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#09090b] dark:text-white truncate">
                            {provider.name}
                          </h3>
                          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block">
                            {provider.badge}
                          </span>
                        </div>
                      </div>

                      {/* Compact Status Pill */}
                      {hasKey ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 font-semibold flex items-center gap-1 shrink-0">
                          <Check className="w-2.5 h-2.5" />
                          <span>Tersimpan</span>
                        </span>
                      ) : provider.id === "gemini" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 font-medium shrink-0">
                          Server Pool
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100/80 dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">
                          Kosong
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                      {provider.shortDesc}
                    </p>
                  </div>

                  {/* Bottom Input & Actions Area */}
                  <div className="space-y-3 pt-1">
                    {/* Input Row */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <label htmlFor={`api-key-${provider.id}`} className="sr-only">
                          Kunci API {provider.name}
                        </label>
                        <input
                          id={`api-key-${provider.id}`}
                          type={isKeyVisible ? "text" : "password"}
                          aria-label={`Kunci API ${provider.name}`}
                          value={keys[provider.id] || ""}
                          onChange={(e) =>
                            setKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                          }
                          placeholder={provider.placeholder}
                          className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] focus:bg-white dark:focus:bg-[#0d1017] border border-zinc-200/90 dark:border-white/[0.09] rounded-xl pl-3 pr-8 py-1.5 min-h-[34px] text-xs text-[#09090b] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white/40 font-mono transition"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(provider.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
                          title={isKeyVisible ? "Sembunyikan sandi" : "Lihat sandi"}
                        >
                          {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleSaveKey(
                            provider.id,
                            keys[provider.id] || "",
                            provider.name
                          )
                        }
                        className="px-3 py-1.5 min-h-[34px] rounded-xl bg-[#09090b] dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        Simpan
                      </button>

                      {hasKey && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteKey(provider.id, provider.name)
                          }
                          className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-600 border border-zinc-200/90 dark:border-white/[0.08] transition cursor-pointer shrink-0"
                          title="Hapus kunci API"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inline Test Result */}
                    {testResult && (
                      <div
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 ${
                          testResult.success
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/40"
                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/40"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                        <span className="truncate font-medium">{testResult.msg}</span>
                      </div>
                    )}

                    {/* Card Footer Bar */}
                    <div className="pt-2.5 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTestConnection(provider)}
                          disabled={isTesting}
                          className="font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] border border-zinc-200/80 dark:border-white/[0.08] py-1 px-2.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer transition"
                        >
                          {isTesting ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Uji...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3" />
                              <span>Uji</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setGuideProvider(provider)}
                          className="font-medium text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Panduan</span>
                        </button>
                      </div>

                      {isModelSelected ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Model Aktif</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectActiveModel(provider.modelId, provider.name)}
                          className="font-semibold text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white cursor-pointer transition"
                        >
                          Pakai Model →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 3: OLLAMA LOCAL MODEL & PRIVACY GUARDRAIL (SIDE-BY-SIDE) */}
        {/* =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Ollama / vLLM / LM Studio Local Endpoint (7 Cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#11131a] border border-zinc-200/90 dark:border-white/[0.08] p-5 flex flex-col justify-between gap-4 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0 shadow-2xs">
                  <OllamaLogo className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#09090b] dark:text-white">
                      {customProvider.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 font-medium">
                      {customProvider.badge}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {customProvider.shortDesc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGuideProvider(customProvider)}
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white py-1 px-2.5 rounded-lg bg-[#faf9f6] dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] inline-flex items-center gap-1 cursor-pointer transition shrink-0"
              >
                <BookOpen className="w-3 h-3" />
                <span>Panduan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] border border-zinc-200/90 dark:border-white/[0.09] rounded-xl px-3 py-1.5 min-h-[34px] text-xs text-[#09090b] dark:text-white font-mono focus:outline-none focus:border-zinc-900 dark:focus:border-white/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                  Nama Model
                </label>
                <input
                  type="text"
                  value={customModelName}
                  onChange={(e) => setCustomModelName(e.target.value)}
                  placeholder="llama3.3"
                  className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] border border-zinc-200/90 dark:border-white/[0.09] rounded-xl px-3 py-1.5 min-h-[34px] text-xs text-[#09090b] dark:text-white font-mono focus:outline-none focus:border-zinc-900 dark:focus:border-white/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                  API Key (Opsional)
                </label>
                <input
                  type="password"
                  value={keys["custom"] || ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, custom: e.target.value }))}
                  placeholder="Bearer token..."
                  className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] border border-zinc-200/90 dark:border-white/[0.09] rounded-xl px-3 py-1.5 min-h-[34px] text-xs text-[#09090b] dark:text-white font-mono focus:outline-none focus:border-zinc-900 dark:focus:border-white/40"
                />
              </div>
            </div>

            {testResults["custom"] && (
              <div
                className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
                  testResults["custom"].success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200/70"
                    : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/70"
                }`}
              >
                {testResults["custom"].success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>{testResults["custom"].msg}</span>
              </div>
            )}

            <div className="pt-2.5 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomSettings}
                  className="px-3.5 py-1.5 rounded-xl bg-[#09090b] dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-xs font-semibold transition cursor-pointer"
                >
                  Simpan Konfigurasi Lokal
                </button>
                <button
                  type="button"
                  onClick={() => handleTestConnection(customProvider)}
                  disabled={testingProviderId === "custom"}
                  className="px-3 py-1.5 rounded-xl bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] border border-zinc-200/80 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Zap className="w-3 h-3" />
                  <span>Uji Endpoint</span>
                </button>
              </div>

              {activeModelId === customProvider.modelId ? (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Aktif</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectActiveModel(customProvider.modelId, customProvider.name)}
                  className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white cursor-pointer transition"
                >
                  Pakai Model Lokal →
                </button>
              )}
            </div>
          </div>

          {/* Right: Privacy & SymPy Guardrail Summary (5 Cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#11131a] border border-zinc-200/90 dark:border-white/[0.08] p-5 flex flex-col justify-between gap-3 shadow-2xs">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#09090b] dark:text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Privasi BYOK &amp; Kontrak Zero-Answer</span>
              </div>

              <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <div className="p-2.5 rounded-xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.05]">
                  <strong className="text-[#09090b] dark:text-zinc-200">Penyimpanan Browser &amp; Sinkronisasi:</strong>{" "}
                  Kunci API disimpan di <code className="font-mono text-[10px]">sessionStorage</code> dengan
                  namespace akun Anda, lalu dicadangkan ke akun sebagai ciphertext AES-GCM (zero-knowledge)
                  bila vault terenkripsi aktif. Server tidak memiliki passphrase/kunci untuk membukanya.
                </div>
                <div className="p-2.5 rounded-xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.05]">
                  <strong className="text-[#09090b] dark:text-zinc-200">Arbitrase Aljabar SymPy (&lt; 1 ms):</strong>{" "}
                  Validasi langkah matematika tetap dikerjakan oleh mesin simbolik deterministik sebelum LLM merespons.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
              <span>Standar Privasi UU PDP</span>
              <Link
                href="/chat"
                className="font-semibold text-[#09090b] dark:text-white hover:underline inline-flex items-center gap-1"
              >
                <span>Mulai Sesi ChatZAP</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =================================================================== */}
      {/* MODAL: PANDUAN KUNCI API (CLEAN DIALOG) */}
      {/* =================================================================== */}
      {guideProvider && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setGuideProvider(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-white/[0.08] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#faf9f6] dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center">
                  <Key className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#09090b] dark:text-white">
                    Panduan {guideProvider.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Langkah mendapatkan kunci API resmi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideProvider(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <ol className="space-y-2 text-zinc-600 dark:text-zinc-300 list-decimal list-inside leading-relaxed">
                {guideProvider.tutorialSteps.map((step, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="text-zinc-800 dark:text-zinc-200">{step}</span>
                  </li>
                ))}
              </ol>

              {guideProvider.note && (
                <div className="p-3 rounded-xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.06] text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {guideProvider.note}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-2">
                <a
                  href={guideProvider.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition"
                >
                  <span>Buka {guideProvider.docLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setGuideProvider(null)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] font-medium transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

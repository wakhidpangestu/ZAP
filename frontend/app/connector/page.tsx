"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import ZapLogo from "@/components/ZapLogo";
import { syncAccountBackup, restoreAccountData } from "@/utils/account-sync";
import { useTheme } from "@/utils/theme";
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
import { AVAILABLE_MODELS } from "@/components/ModelPickerWithEffort";

interface ProviderConfig {
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ElementType;
  badge: string;
  modelId: string;
  storageKey: string;
  docUrl: string;
  docLabel: string;
  keyPrefix: string;
  placeholder: string;
  tutorialSteps: string[];
  note?: string;
  isCustom?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini AI",
    shortDesc: "Model bawaan default ChatZAP dari Google DeepMind dengan konteks 1M token.",
    icon: GeminiLogo,
    badge: "Bawaan Server / BYOK",
    modelId: "gemini-2.0-flash",
    storageKey: "zap_gemini_api_key",
    docUrl: "https://aistudio.google.com/app/apikey",
    docLabel: "aistudio.google.com",
    keyPrefix: "AIzaSy...",
    placeholder: "Masukkan Google AI Studio Key (AIzaSy...)",
    note: "Akun Google yang login otomatis terhubung ke pool server ZAP. Menambahkan API key pribadi di bawah ini opsional untuk kuota tak terbatas dan prioritas latensi.",
    tutorialSteps: [
      "Buka Google AI Studio di browser Anda (aistudio.google.com/app/apikey).",
      "Login menggunakan akun Google Anda.",
      "Klik tombol 'Create API key' dan pilih proyek Google Cloud Anda (atau buat baru).",
      "Salin kunci API yang diawali dengan huruf 'AIzaSy...'.",
      "Tempelkan kunci pada kolom di bawah ini lalu klik 'Simpan & Uji Koneksi'.",
    ],
  },
  {
    id: "openai",
    name: "OpenAI ChatGPT",
    shortDesc: "Akses model penalaran multimodal GPT-4o dan versi ultra-ringan GPT-4o Mini.",
    icon: OpenAILogo,
    badge: "GPT-4o & GPT-4o Mini",
    modelId: "gpt-4o",
    storageKey: "zap_openai_api_key",
    docUrl: "https://platform.openai.com/api-keys",
    docLabel: "platform.openai.com",
    keyPrefix: "sk-proj-... / sk-...",
    placeholder: "Masukkan OpenAI API Key (sk-proj-... atau sk-...)",
    note: "Pastikan akun OpenAI Anda memiliki saldo atau kredit API aktif agar tidak mengalami galat 401 atau quota exceeded.",
    tutorialSteps: [
      "Buka dashboard resmi OpenAI Developer di platform.openai.com/api-keys.",
      "Masuk dengan akun OpenAI Anda.",
      "Klik tombol '+ Create new secret key'.",
      "Beri nama kunci (misal: 'ChatZAP') dan klik 'Create secret key'.",
      "Salin kunci yang muncul (awalan 'sk-proj-' atau 'sk-'). Kunci ini hanya tampil satu kali.",
      "Tempelkan kunci pada kolom di bawah ini, lalu klik 'Simpan & Uji Koneksi'.",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek AI & BazaarLink",
    shortDesc: "Model penalaran mendalam (Chain-of-Thought) dengan rasio akurasi logika tinggi.",
    icon: DeepSeekLogo,
    badge: "DeepSeek V4 & R1",
    modelId: "deepseek-v4.1-flash",
    storageKey: "zap_bazaarlink_api_key",
    docUrl: "https://platform.deepseek.com/api_keys",
    docLabel: "platform.deepseek.com",
    keyPrefix: "sk-...",
    placeholder: "Masukkan DeepSeek API Key (sk-...)",
    note: "DeepSeek sangat tangguh dalam membimbing penalaran langkah demi langkah dan dekomposisi rumus.",
    tutorialSteps: [
      "Kunjungi platform resmi DeepSeek di platform.deepseek.com.",
      "Daftar atau masuk ke akun Anda, lalu pilih menu 'API Keys' di sidebar kiri.",
      "Klik tombol 'Create API key', masukkan nama deskripsi (misal: 'ChatZAP').",
      "Salin kunci rahasia yang dihasilkan (awalan 'sk-').",
      "Tempelkan ke kolom di bawah ini, simpan, dan uji koneksinya.",
    ],
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    shortDesc: "Model penalaran Claude 3.5 Sonnet dengan kekakuan logika dan sintaks aljabar rapi.",
    icon: ClaudeLogo,
    badge: "Claude 3.5 Sonnet",
    modelId: "claude-3-5-sonnet",
    storageKey: "zap_claude_api_key",
    docUrl: "https://console.anthropic.com/settings/keys",
    docLabel: "console.anthropic.com",
    keyPrefix: "sk-ant-...",
    placeholder: "Masukkan Anthropic API Key (sk-ant-...)",
    note: "Claude 3.5 Sonnet memberikan penjelasan Sokrates yang empatik dan tidak pernah membocorkan jawaban akhir.",
    tutorialSteps: [
      "Buka Anthropic Console di console.anthropic.com.",
      "Login dan pastikan akun organisasi Anda telah terverifikasi.",
      "Buka menu 'API Keys' di bawah pengaturan profil atau workspace.",
      "Klik 'Create Key', beri label (misal: 'ChatZAP'), lalu salin kunci yang diawali 'sk-ant-'.",
      "Tempelkan pada kolom di bawah ini lalu klik 'Simpan & Uji Koneksi'.",
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM Cloud",
    shortDesc: "Inferensi GPU cloud berkecepatan tinggi dari NVIDIA dengan kuota 1.000 kredit gratis.",
    icon: NvidiaLogo,
    badge: "DeepSeek V4.1 NIM Free",
    modelId: "nvidia-deepseek-v4",
    storageKey: "zap_nvidia_api_key",
    docUrl: "https://build.nvidia.com",
    docLabel: "build.nvidia.com",
    keyPrefix: "nvapi-...",
    placeholder: "Masukkan NVIDIA NIM API Key (nvapi-...)",
    note: "NVIDIA menyediakan 1.000 kredit inferensi gratis untuk setiap akun pengembang terdaftar.",
    tutorialSteps: [
      "Buka katalog model AI NVIDIA di build.nvidia.com.",
      "Klik tombol 'Log In' di kanan atas dan buat/masuk dengan akun NVIDIA Anda.",
      "Pilih model 'DeepSeek-V4.1-Flash' atau model open-source yang tersedia.",
      "Klik tombol hijau 'Get API Key' di pojok kanan atas halaman model.",
      "Salin kunci yang diawali dengan 'nvapi-'.",
      "Tempelkan pada kolom di bawah ini lalu simpan.",
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI & Codestral",
    shortDesc: "Model penalaran matematika dan penulisan sintaks komputasi kilat (~200ms) dari Mistral AI.",
    icon: MistralLogo,
    badge: "Codestral 22B",
    modelId: "codestral-latest",
    storageKey: "zap_mistral_api_key",
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
      "Tempelkan pada kolom di bawah ini lalu klik 'Simpan & Uji Koneksi'.",
    ],
  },
  {
    id: "custom",
    name: "Model Lokal & Custom (Ollama / vLLM / LM Studio)",
    shortDesc: "Hubungkan model AI yang berjalan di komputer lokal atau proxy endpoint kompatibel OpenAI.",
    icon: OllamaLogo,
    badge: "Self-Hosted / Offline",
    modelId: "custom-api",
    storageKey: "zap_custom_api_key",
    docUrl: "https://ollama.com",
    docLabel: "ollama.com",
    keyPrefix: "http://localhost:...",
    placeholder: "Kunci API opsional (jika server lokal membutuhkan otorisasi)",
    isCustom: true,
    tutorialSteps: [
      "Jalankan server model lokal di komputer Anda, contohnya Ollama: jalankan perintah 'ollama run llama3.3' di terminal.",
      "Pastikan service Ollama berjalan pada port standar: http://localhost:11434/v1.",
      "Jika Anda menggunakan LM Studio, buka tab 'Developer' dan klik 'Start Server' (port standar http://localhost:1234/v1).",
      "Masukkan URL Endpoint dan Nama Model yang sesuai di form bawah.",
      "Klik 'Uji Koneksi' untuk memastikan peramban dapat menjangkau server lokal Anda.",
    ],
  },
];

export default function ConnectorPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Active Model State
  const [activeModelId, setActiveModelId] = useState<string>("gemini-2.0-flash");
  const [activeModelNotice, setActiveModelNotice] = useState<string>("");

  // Storage Key States
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeyVisibility, setShowKeyVisibility] = useState<Record<string, boolean>>({});

  // Custom API configuration
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("http://localhost:11434/v1");
  const [customModelName, setCustomModelName] = useState<string>("llama3.3");

  // Accordion state: which provider's tutorial is currently open
  const [expandedTutorialId, setExpandedTutorialId] = useState<string | null>(null);

  // Testing states
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string }>>({});

  // Load saved state from LocalStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedModel = localStorage.getItem("zap_selected_model_id") || "gemini-2.0-flash";
    setActiveModelId(savedModel);

    const loadedKeys: Record<string, string> = {
      gemini: localStorage.getItem("zap_gemini_api_key") || "",
      openai: localStorage.getItem("zap_openai_api_key") || "",
      deepseek: localStorage.getItem("zap_bazaarlink_api_key") || "",
      claude: localStorage.getItem("zap_claude_api_key") || "",
      nvidia: localStorage.getItem("zap_nvidia_api_key") || "",
      mistral: localStorage.getItem("zap_mistral_api_key") || "",
      custom: localStorage.getItem("zap_custom_api_key") || "",
    };
    setKeys(loadedKeys);

    setCustomBaseUrl(localStorage.getItem("zap_custom_base_url") || "http://localhost:11434/v1");
    setCustomModelName(localStorage.getItem("zap_custom_model_name") || "llama3.3");

    // Pulihkan kunci yang tersimpan di Akun Google
    const userStr = localStorage.getItem("zap_authenticated_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        restoreAccountData(u).then((restored) => {
          if (restored.configs) {
            setKeys((prev) => ({
              ...prev,
              gemini: restored.configs.geminiApiKey || prev.gemini,
              openai: restored.configs.openaiApiKey || prev.openai,
              deepseek: restored.configs.bazaarlinkApiKey || prev.deepseek,
              claude: restored.configs.claudeApiKey || prev.claude,
              nvidia: restored.configs.nvidiaApiKey || prev.nvidia,
              mistral: restored.configs.mistralApiKey || prev.mistral,
              custom: restored.configs.customApiKey || prev.custom,
            }));
            if (restored.configs.customBaseUrl) setCustomBaseUrl(restored.configs.customBaseUrl);
            if (restored.configs.customModelName) setCustomModelName(restored.configs.customModelName);
            if (restored.configs.selectedModelId) setActiveModelId(restored.configs.selectedModelId);
          }
        });
      } catch (err) {
        console.warn("Gagal membaca backup akun di connector:", err);
      }
    }
  }, []);

  const handleSelectActiveModel = (modelId: string, modelName: string) => {
    setActiveModelId(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem("zap_selected_model_id", modelId);
      setActiveModelNotice(`Model aktif bimbingan diubah ke: ${modelName}`);
      setTimeout(() => setActiveModelNotice(""), 3500);
      try {
        const userStr = localStorage.getItem("zap_authenticated_user");
        if (userStr) {
          const u = JSON.parse(userStr);
          syncAccountBackup(u, { configs: { selectedModelId: modelId } });
        }
      } catch {}
    }
  };

  const handleSaveKey = (providerId: string, storageKey: string, val: string, providerName: string) => {
    if (typeof window === "undefined") return;
    const cleanVal = val.trim();
    localStorage.setItem(storageKey, cleanVal);
    setKeys((prev) => ({ ...prev, [providerId]: cleanVal }));

    // Auto-backup konfigurasi ke Akun Google
    try {
      const userStr = localStorage.getItem("zap_authenticated_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        syncAccountBackup(u);
      }
    } catch {}

    setTestResults((prev) => ({
      ...prev,
      [providerId]: {
        success: true,
        msg: cleanVal
          ? `Kunci untuk ${providerName} berhasil disimpan di penyimpanan browser!`
          : `Kunci untuk ${providerName} telah dihapus.`,
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy[providerId];
        return copy;
      });
    }, 4000);
  };

  const handleSaveCustomSettings = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("zap_custom_base_url", customBaseUrl.trim());
    localStorage.setItem("zap_custom_model_name", customModelName.trim());
    localStorage.setItem("zap_custom_api_key", (keys["custom"] || "").trim());

    setTestResults((prev) => ({
      ...prev,
      custom: {
        success: true,
        msg: "Konfigurasi model lokal/custom berhasil disimpan!",
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy["custom"];
        return copy;
      });
    }, 4000);
  };

  const handleDeleteKey = (providerId: string, storageKey: string, providerName: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(storageKey);
    setKeys((prev) => ({ ...prev, [providerId]: "" }));

    setTestResults((prev) => ({
      ...prev,
      [providerId]: {
        success: true,
        msg: `Kunci API ${providerName} berhasil dihapus dari browser.`,
      },
    }));

    setTimeout(() => {
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy[providerId];
        return copy;
      });
    }, 4000);
  };

  const toggleTutorial = (id: string) => {
    setExpandedTutorialId((prev) => (prev === id ? null : id));
  };

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeyVisibility((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  // Test provider connection
  const handleTestConnection = async (provider: ProviderConfig) => {
    const keyVal = (keys[provider.id] || "").trim();
    setTestingProviderId(provider.id);

    try {
      if (provider.id === "gemini") {
        // Test via dedicated verification endpoint
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
              msg: `Koneksi Google Gemini Sukses! (${data.tier || "Terverifikasi"}, ${data.latencyMs}ms)`,
            },
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: false,
              msg: data.error || "Gagal memverifikasi API key Google Gemini.",
            },
          }));
        }
      } else {
        // Test via chat endpoint with test prompt
        const bodyPayload: Record<string, string | undefined> = {
          message: "Halo! Ini pengujian koneksi ZAP. Jawab dengan satu kalimat pendek.",
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
              msg: `Koneksi berhasil! Model merespons: "${data.reply.slice(0, 70)}..."`,
            },
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [provider.id]: {
              success: false,
              msg: data.reply || data.error || "Model tidak memberikan respons valid.",
            },
          }));
        }
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: false,
          msg: err instanceof Error ? err.message : "Kesalahan jaringan saat pengujian.",
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

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#090a0f] text-[#09090b] dark:text-zinc-100 font-sans selection:bg-[#d4a574]/30 selection:text-[#09090b] dark:selection:text-white pb-24 transition-colors duration-200">
      {/* 1. TOP STICKY EDITORIAL NAVBAR */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-[#0c0e14]/90 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/[0.08] transition-colors">
        <div className="max-w-5xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-sm sm:text-base tracking-tight shrink-0 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] flex items-center justify-center shadow-sm group-hover:bg-[#c4956a] dark:group-hover:bg-[#d4a574] transition-colors">
                <ZapLogo className="w-4 h-4" />
              </div>
              <span className="text-[#09090b] dark:text-white">
                ChatZAP <span className="font-normal text-zinc-400">Connector</span>
              </span>
            </Link>

            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-white/[0.1] hidden sm:block" />

            <Link
              href="/chat"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white transition py-1.5 px-2.5 rounded-full hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.06]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Kembali ke ChatZAP</span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf9f6] dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{savedKeyCount} Kunci BYOK Tersimpan</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              aria-label="Toggle Theme"
              className="w-9 h-9 rounded-full bg-[#faf9f6] dark:bg-white/[0.06] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.12] border border-zinc-200/80 dark:border-white/[0.1] flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-[#d4a574]" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-700" />
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="text-xs font-bold px-4 py-2 min-h-[36px] rounded-full bg-[#09090b] dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-[#09090b] transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Buka ChatZAP</span>
              <span className="w-5 h-5 rounded-full bg-white/15 dark:bg-black/10 flex items-center justify-center">
                <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT WRAPPER */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 space-y-8">
        {/* Page Title & Editorial Intro */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] text-[11px] font-mono font-semibold uppercase tracking-wider text-[#8f5e32] dark:text-[#d4a574] shadow-sm">
            <LocalEnclaveEmblem className="w-3.5 h-3.5" />
            <span>BYOK ENCLAVE &amp; MULTI-MODEL ROUTER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#09090b] dark:text-white tracking-tight">
            Konektor Model AI &amp;{" "}
            <span className="font-serif font-normal text-[#c4956a]">
              Enklave Kunci API
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Pilih model AI untuk sesi bimbingan Sokrates Anda dan kelola kredensial BYOK. Kunci disimpan secara lokal di peramban Anda (<code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#f5f3ef] dark:bg-white/[0.06] text-[#8f5e32] dark:text-[#d4a574]">localStorage</code>) dan setiap respons tetap disaring oleh <strong className="font-semibold text-zinc-700 dark:text-zinc-200">Zero-Answer Guardrail</strong>.
          </p>
        </div>

        {/* =================================================================== */}
        {/* SECTION 1: MODEL AKTIF SAAT INI (QUICK SWITCHER) */}
        {/* =================================================================== */}
        <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0f1118] border border-zinc-200/90 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#faf9f6] dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm">
                <ActiveModelBrandIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Model Aktif ChatZAP Saat Ini
                </span>
                <div className="text-base font-bold text-[#09090b] dark:text-white flex items-center gap-2 mt-0.5">
                  <span>{currentActiveModelObj.name}</span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-semibold">
                    Aktif
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="text-xs font-semibold text-[#8f5e32] dark:text-[#d4a574] hover:text-[#09090b] dark:hover:text-white bg-[#faf4ed] dark:bg-[#c4956a]/15 hover:bg-[#f3e8da] py-2 px-3.5 rounded-full border border-[#d4a574]/40 inline-flex items-center gap-1.5 cursor-pointer transition self-start sm:self-auto"
            >
              <span>Mulai Sesi di ChatZAP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeModelNotice && (
            <div className="p-3 rounded-2xl bg-[#faf4ed] dark:bg-[#c4956a]/15 border border-[#d4a574]/50 text-[#8f5e32] dark:text-[#d4a574] text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#8f5e32] dark:text-[#d4a574] shrink-0" />
              <span>{activeModelNotice}</span>
            </div>
          )}

          {/* Clean Segmented Grid to Switch Active Model */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Klik salah satu model di bawah untuk menjadikannya model utama di ChatZAP:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", sub: "Google DeepMind", icon: GeminiLogo },
                { id: "deepseek-v4.1-flash", label: "DeepSeek-V4.1", sub: "DeepSeek AI", icon: DeepSeekLogo },
                { id: "gpt-4o", label: "GPT-4o Omni", sub: "OpenAI", icon: OpenAILogo },
                { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", sub: "Anthropic", icon: ClaudeLogo },
                { id: "nvidia-deepseek-v4", label: "NVIDIA DeepSeek", sub: "NVIDIA NIM", icon: NvidiaLogo },
                { id: "sympy-cfl", label: "SymPy CAS Kernel", sub: "Offline < 1 ms", icon: SymPyLogo },
              ].map((item) => {
                const isSelected = activeModelId === item.id;
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectActiveModel(item.id, item.label)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-[#faf4ed]/80 dark:bg-[#c4956a]/15 border-[#c4956a] text-[#09090b] dark:text-white shadow-sm ring-1 ring-[#c4956a]/30"
                        : "bg-[#faf9f6] dark:bg-white/[0.02] border-zinc-200/80 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate text-[#09090b] dark:text-white">{item.label}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{item.sub}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#c4956a] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 2: DAFTAR PENYEDIA AI & TUTORIAL SETUP API KEY */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c4956a]" />
              <h2 className="text-sm font-bold text-[#09090b] dark:text-white tracking-wide uppercase font-mono">
                Kredensial Penyedia Model &amp; Ollama Lokal
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {savedKeyCount} / {PROVIDERS.length} Dikonfigurasi
            </span>
          </div>

          <div className="space-y-4">
            {PROVIDERS.map((provider) => {
              const IconComp = provider.icon;
              const hasKey = Boolean(keys[provider.id]);
              const isTutorialOpen = expandedTutorialId === provider.id;
              const testResult = testResults[provider.id];
              const isTesting = testingProviderId === provider.id;
              const isKeyVisible = showKeyVisibility[provider.id] || false;
              const isModelSelected = activeModelId === provider.modelId;

              return (
                <div
                  key={provider.id}
                  className={`rounded-3xl bg-white dark:bg-[#0f1118] border transition-all overflow-hidden ${
                    isModelSelected
                      ? "border-[#c4956a]/80 shadow-[0_8px_30px_-12px_rgba(196,149,106,0.22)]"
                      : "border-zinc-200/90 dark:border-white/[0.08] shadow-sm hover:border-zinc-300/90"
                  }`}
                >
                  {/* Card Main Bar */}
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-[#faf9f6] dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-[#09090b] dark:text-white tracking-tight">
                              {provider.name}
                            </h3>
                            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#f5f3ef] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08]">
                              {provider.badge}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {provider.shortDesc}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge & Tutorial Trigger */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        {hasKey ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Kunci Tersimpan</span>
                          </span>
                        ) : provider.id === "gemini" ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-[#faf4ed] dark:bg-[#c4956a]/15 text-[#8f5e32] dark:text-[#d4a574] border border-[#d4a574]/40 font-semibold">
                            Auto Server Pool
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full bg-[#f5f3ef] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 border border-zinc-200/70 dark:border-white/[0.06] font-medium">
                            Belum Dikonfigurasi
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleTutorial(provider.id)}
                          aria-expanded={isTutorialOpen}
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white px-3 py-1 min-h-[30px] rounded-full bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.08] border border-zinc-200/80 dark:border-white/[0.08] transition cursor-pointer flex items-center gap-1"
                        >
                          <span>Panduan</span>
                          {isTutorialOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Tutorial / Panduan Step-by-Step (Accordion) */}
                    {isTutorialOpen && (
                      <div className="p-4 rounded-2xl bg-[#faf9f6] dark:bg-[#14151b] border border-zinc-200/80 dark:border-white/[0.08] space-y-2.5 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/70 dark:border-white/[0.06]">
                          <span className="font-semibold text-[#09090b] dark:text-zinc-200 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-[#8f5e32] dark:text-[#d4a574]" />
                            <span>Cara Mendapatkan Kunci API {provider.name}:</span>
                          </span>
                          <a
                            href={provider.docUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#8f5e32] dark:text-[#d4a574] hover:text-[#09090b] dark:hover:text-white py-1 px-2 rounded-lg inline-flex items-center gap-1 font-semibold underline"
                          >
                            <span>Buka {provider.docLabel}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <ol className="space-y-1.5 text-zinc-600 dark:text-zinc-300 list-decimal list-inside leading-relaxed pl-1">
                          {provider.tutorialSteps.map((step, idx) => (
                            <li key={idx}>
                              <span className="text-zinc-800 dark:text-zinc-200">{step}</span>
                            </li>
                          ))}
                        </ol>

                        {provider.note && (
                          <div className="pt-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/70 dark:border-white/[0.06] italic">
                            💡 Catatan: {provider.note}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Form Input Kunci API */}
                    {provider.isCustom ? (
                      /* Custom / Local API (Ollama, LM Studio) Form */
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="custom-base-url" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                              Base URL (OpenAI-Compatible):
                            </label>
                            <input
                              id="custom-base-url"
                              type="text"
                              aria-label="Base URL (OpenAI-Compatible)"
                              value={customBaseUrl}
                              onChange={(e) => setCustomBaseUrl(e.target.value)}
                              placeholder="http://localhost:11434/v1"
                              className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] focus:bg-white border border-zinc-200/90 dark:border-white/[0.1] rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-[#09090b] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#c4956a]/25 focus:border-[#c4956a] font-mono transition"
                            />
                          </div>
                          <div>
                            <label htmlFor="custom-model-name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                              Nama Model Lokal:
                            </label>
                            <input
                              id="custom-model-name"
                              type="text"
                              aria-label="Nama Model Lokal atau Kustom"
                              value={customModelName}
                              onChange={(e) => setCustomModelName(e.target.value)}
                              placeholder="llama3.3"
                              className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] focus:bg-white border border-zinc-200/90 dark:border-white/[0.1] rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-[#09090b] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#c4956a]/25 focus:border-[#c4956a] font-mono transition"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <label htmlFor="custom-api-key" className="sr-only">
                            Kunci API Kustom (Opsional)
                          </label>
                          <input
                            id="custom-api-key"
                            type={isKeyVisible ? "text" : "password"}
                            aria-label="Kunci API Kustom (Opsional)"
                            value={keys["custom"] || ""}
                            onChange={(e) =>
                              setKeys((prev) => ({ ...prev, custom: e.target.value }))
                            }
                            placeholder="API Key opsional (Bearer token jika endpoint memerlukan sandi)"
                            className="flex-1 min-w-0 bg-[#faf9f6] dark:bg-[#0a0c12] focus:bg-white border border-zinc-200/90 dark:border-white/[0.1] rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-[#09090b] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#c4956a]/25 focus:border-[#c4956a] font-mono transition"
                          />
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility("custom")}
                            className="p-2 min-w-[38px] min-h-[38px] shrink-0 flex items-center justify-center rounded-xl bg-[#faf9f6] dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white border border-zinc-200/90 dark:border-white/[0.08] transition cursor-pointer"
                            title={isKeyVisible ? "Sembunyikan sandi" : "Lihat sandi"}
                            aria-label={isKeyVisible ? "Sembunyikan sandi" : "Lihat sandi"}
                          >
                            {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCustomSettings}
                            className="px-4 py-2 min-h-[38px] rounded-xl bg-[#09090b] dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-xs font-bold transition cursor-pointer shrink-0 shadow-sm"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Provider API Key Input */
                      <div className="flex gap-2 pt-1">
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
                            className="w-full bg-[#faf9f6] dark:bg-[#0a0c12] focus:bg-white border border-zinc-200/90 dark:border-white/[0.1] rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-[#09090b] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#c4956a]/25 focus:border-[#c4956a] font-mono transition"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(provider.id)}
                          className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-[#faf9f6] dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white border border-zinc-200/90 dark:border-white/[0.08] transition cursor-pointer"
                          title={isKeyVisible ? "Sembunyikan sandi" : "Lihat sandi"}
                          aria-label={isKeyVisible ? `Sembunyikan sandi ${provider.name}` : `Lihat sandi ${provider.name}`}
                        >
                          {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSaveKey(
                              provider.id,
                              provider.storageKey,
                              keys[provider.id] || "",
                              provider.name
                            )
                          }
                          className="px-4 py-2 min-h-[38px] rounded-xl bg-[#09090b] dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-[#09090b] text-xs font-bold transition cursor-pointer shrink-0 shadow-sm"
                        >
                          Simpan
                        </button>

                        {hasKey && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteKey(provider.id, provider.storageKey, provider.name)
                            }
                            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-500 hover:text-rose-600 border border-zinc-200/90 dark:border-white/[0.08] transition cursor-pointer"
                            title="Hapus kunci API ini"
                            aria-label={`Hapus kunci API ${provider.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Bottom Action Row: Test Connection & Set Active Model */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTestConnection(provider)}
                          disabled={isTesting}
                          className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-[#09090b] dark:hover:text-white bg-[#faf9f6] dark:bg-white/[0.04] hover:bg-[#f5f3ef] dark:hover:bg-white/[0.08] border border-zinc-200/80 dark:border-white/[0.08] py-1.5 px-3 min-h-[30px] rounded-full inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition"
                        >
                          {isTesting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c4956a]" />
                              <span>Menguji koneksi ke {provider.name}...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-[#8f5e32] dark:text-[#d4a574]" />
                              <span>Uji Koneksi API</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {isModelSelected ? (
                          <span className="text-xs font-mono text-[#8f5e32] dark:text-[#d4a574] bg-[#faf4ed] dark:bg-[#c4956a]/15 px-3 py-1 min-h-[30px] rounded-full border border-[#d4a574]/50 flex items-center gap-1.5 font-semibold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Aktif di ChatZAP</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectActiveModel(provider.modelId, provider.name)
                            }
                            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-[#09090b] dark:hover:text-white px-3 py-1.5 min-h-[30px] rounded-full hover:bg-[#faf9f6] dark:hover:bg-white/[0.05] border border-transparent hover:border-zinc-200/80 transition cursor-pointer"
                          >
                            Jadikan Model Aktif
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Test Result Message Box */}
                    {testResult && (
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5 ${
                          testResult.success
                            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200"
                            : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <span className="flex-1 font-medium">{testResult.msg}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 3: KEAMANAN & PRIVASI (UU PDP & ZERO-ANSWER CONTRACT) */}
        {/* =================================================================== */}
        <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0f1118] border border-zinc-200/90 dark:border-white/[0.08] shadow-sm space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2 text-[#09090b] dark:text-white font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-[#8f5e32] dark:text-[#d4a574]" />
            <span>Kepatuhan Privasi Data (UU PDP) &amp; Kontrak Zero-Answer</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.06]">
              <div className="font-bold text-[#09090b] dark:text-white mb-1">
                1. Penyimpanan Lokal &amp; Cadangan Akun
              </div>
              <p>
                Semua kunci API BYOK disimpan di peramban komputer Anda (localStorage). Jika Anda masuk dengan akun, salinan cadangan konfigurasi Anda, termasuk kunci API, disinkronkan ke vault akun di server agar dapat dipulihkan saat berganti perangkat.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.06]">
              <div className="font-bold text-[#09090b] dark:text-white mb-1">
                2. Arbitrase SymPy CAS (&lt; 1 ms)
              </div>
              <p>
                Mesin simbolik SymPy CAS menguji kebenaran aljabar secara deterministik sebelum model LLM merumuskan pertanyaan Sokrates.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#faf9f6] dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.06]">
              <div className="font-bold text-[#09090b] dark:text-white mb-1">
                3. Kendali &amp; Penghapusan Instan
              </div>
              <p>
                Anda dapat menghapus atau mengganti kunci API kapan saja dengan menekan ikon tempat sampah pada kartu penyedia terkait.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

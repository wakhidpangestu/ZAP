"use client";

import React from "react";
import { Check, Clock, RotateCw, Trash2, X } from "lucide-react";

export interface TaskLogItem {
  id: string;
  name: string;
  time: string;
  status: "success" | "running" | "idle";
}

interface AutomationTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  casAuditRunning: boolean;
  casAuditResult: string | null;
  lastSweepResult: string | null;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (v: boolean) => void;
  autoLatexEnabled: boolean;
  setAutoLatexEnabled: (v: boolean) => void;
  taskLogs: TaskLogItem[];
  onRunCasAudit: () => void;
  onSweepScratchpad: () => void;
}

export default function AutomationTasksModal({
  isOpen,
  onClose,
  casAuditRunning,
  casAuditResult,
  lastSweepResult,
  autoSyncEnabled,
  setAutoSyncEnabled,
  autoLatexEnabled,
  setAutoLatexEnabled,
  taskLogs,
  onRunCasAudit,
  onSweepScratchpad,
}: AutomationTasksModalProps) {
  if (!isOpen) return null;

  return (
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
              <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">
                Automation Tasks &amp; Invariants
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pusat kendali otomatisasi SymPy CAS, pemeliharaan memori &amp; sinkronisasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                <div className="font-semibold text-xs text-zinc-900 dark:text-white">
                  SymPy CAS Invariant Audit
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Verifikasi 22 invarian aljabar deterministik &amp; whitelist parser
                </div>
              </div>
              <button
                type="button"
                onClick={onRunCasAudit}
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
                <div className="font-semibold text-xs text-zinc-900 dark:text-white">
                  Pembersih Scratchpad &amp; Draft Telemetri
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Bersihkan sisa draft lokal dan token cache sementara
                </div>
              </div>
              <button
                type="button"
                onClick={onSweepScratchpad}
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
  );
}

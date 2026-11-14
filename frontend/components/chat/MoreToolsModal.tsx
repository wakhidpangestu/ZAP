"use client";

import React from "react";
import { Box, Clock, LayoutGrid, X } from "lucide-react";
import { ConnectorHubIcon } from "@/components/chat/PluginConnectorModal";

interface MoreToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSmartboard: () => void;
  onOpenPlugins: () => void;
  onOpenTasks: () => void;
}

export default function MoreToolsModal({
  isOpen,
  onClose,
  onOpenSmartboard,
  onOpenPlugins,
  onOpenTasks,
}: MoreToolsModalProps) {
  if (!isOpen) return null;

  return (
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
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">
              Alat &amp; Modul Ekstra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              onClose();
              onOpenSmartboard();
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
              onClose();
              onOpenPlugins();
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
              onClose();
              onOpenTasks();
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
  );
}

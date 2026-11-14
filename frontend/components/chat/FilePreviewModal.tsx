"use client";

import React from "react";
import { ArrowUp, Download, FileText, Trash2, X } from "lucide-react";

export interface PreviewUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  dataUrl?: string;
  uploadedAt: number;
  workspaceId?: string;
}

interface FilePreviewModalProps {
  previewFile: PreviewUploadedFile | null;
  onClose: () => void;
  onSendToChat: (text: string) => void;
  onDeleteWorkspaceFile: (fileId: string) => void;
}

export default function FilePreviewModal({
  previewFile,
  onClose,
  onSendToChat,
  onDeleteWorkspaceFile,
}: FilePreviewModalProps) {
  if (!previewFile) return null;

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
  const hasBinaryPdfUrl =
    isPdf &&
    (mediaSource.startsWith("data:application/pdf") || mediaSource.startsWith("blob:"));
  const extractedTextContent =
    previewFile.content &&
    !previewFile.content.startsWith("data:") &&
    !previewFile.content.startsWith("blob:")
      ? previewFile.content
      : "";

  return (
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
            <span className="font-semibold text-sm text-zinc-900 dark:text-white">
              {previewFile.name}
            </span>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              ({Math.round(previewFile.size / 1024) || 1} KB)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {extractedTextContent && (
              <button
                type="button"
                onClick={() => {
                  onSendToChat(extractedTextContent);
                  onClose();
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
                if (mediaSource.startsWith("data:") || mediaSource.startsWith("blob:")) {
                  const a = document.createElement("a");
                  a.href = mediaSource;
                  a.download = previewFile.name;
                  a.click();
                } else {
                  const blob = new Blob([previewFile.content || ""], {
                    type: previewFile.type || "text/plain",
                  });
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
                  onDeleteWorkspaceFile(previewFile.id);
                  onClose();
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
              onClick={onClose}
              aria-label="Tutup pratinjau berkas"
              className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-[#f3efe7] dark:hover:bg-white/[0.06] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Content Display */}
        <div className="p-4 overflow-y-auto flex-1 bg-zinc-50 dark:bg-[#0b0c10] text-zinc-800 dark:text-zinc-300 leading-relaxed select-text flex items-center justify-center">
          {isImg && mediaSource ? (
            <div className="w-full flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaSource}
                alt={previewFile.name}
                className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-md border border-black/5 dark:border-white/10"
              />
            </div>
          ) : hasBinaryPdfUrl ? (
            <div className="w-full h-[72vh] rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-white">
              <iframe
                src={mediaSource}
                title={previewFile.name}
                className="w-full h-full border-0"
              />
            </div>
          ) : isVideo && mediaSource ? (
            <div className="w-full flex items-center justify-center p-2">
              <video
                src={mediaSource}
                controls
                autoPlay
                className="max-h-[72vh] max-w-full rounded-2xl shadow-md border border-black/5 dark:border-white/10"
              />
            </div>
          ) : extractedTextContent ? (
            <div className="w-full h-full text-left font-mono text-xs">
              <pre className="whitespace-pre-wrap p-4 rounded-2xl bg-white dark:bg-[#121318] border border-zinc-200 dark:border-white/[0.08] overflow-x-auto selection:bg-amber-500/20">
                {extractedTextContent}
              </pre>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {previewFile.name}
              </p>
              <p className="text-xs mt-1">
                Pratinjau langsung tidak tersedia untuk format biner ini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

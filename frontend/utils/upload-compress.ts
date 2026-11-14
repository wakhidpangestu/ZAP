/**
 * Kompresi & Ekstraksi Lampiran Sisi Klien (Anti HTTP 413)
 *
 * Memastikan setiap berkas yang dikirim ke `/api/chat` otomatis dikompresi atau
 * diekstrak menjadi teks ringkas di peramban sebelum menyentuh batas ukuran
 * payload reverse proxy (default Nginx 1 MB).
 */

export const MAX_CHAT_PAYLOAD_BYTES = 780 * 1024; // ~780 KB aman di bawah batas 1 MB Nginx
const MAX_IMAGE_BINARY_BYTES = 280 * 1024; // ~375 KB base64 per gambar
const MAX_SMALL_PDF_BYTES = 380 * 1024; // PDF <= 380 KB masih aman dikirim utuh (inline_data)
const MAX_EXTRACTED_TEXT_CHARS = 35_000;

export interface PreparedAttachmentResult {
  content: string;
  dataUrl?: string;
  type: string;
  size: number;
  extractedSummary?: boolean;
}

export async function compressImageDataUrl(
  file: File,
  rawDataUrl: string,
  targetMaxBytes: number = MAX_IMAGE_BINARY_BYTES
): Promise<{ dataUrl: string; type: string; size: number }> {
  const mime = (file.type || "").toLowerCase();
  const isSmallStandard =
    (mime === "image/jpeg" || mime === "image/png") &&
    file.size > 0 &&
    file.size <= targetMaxBytes;

  if (typeof document === "undefined") {
    return { dataUrl: rawDataUrl, type: file.type || "image/png", size: file.size };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve({ dataUrl: rawDataUrl, type: file.type || "image/png", size: file.size });
        return;
      }
      if (isSmallStandard && w <= 1400 && h <= 1400) {
        resolve({ dataUrl: rawDataUrl, type: mime, size: file.size });
        return;
      }

      const attempts: Array<{ maxDim: number; quality: number }> = [
        { maxDim: 1400, quality: 0.82 },
        { maxDim: 1200, quality: 0.72 },
        { maxDim: 960, quality: 0.62 },
        { maxDim: 768, quality: 0.50 },
      ];

      let bestDataUrl = rawDataUrl;
      let bestBytes = file.size;

      for (const step of attempts) {
        const scale = Math.min(1, step.maxDim / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const jpegDataUrl = canvas.toDataURL("image/jpeg", step.quality);
          if (jpegDataUrl.startsWith("data:image/jpeg")) {
            const approxBytes = Math.round(((jpegDataUrl.length - 23) * 3) / 4);
            if (approxBytes < bestBytes || !bestDataUrl.startsWith("data:image/jpeg")) {
              bestDataUrl = jpegDataUrl;
              bestBytes = approxBytes;
            }
            if (approxBytes <= targetMaxBytes) {
              resolve({ dataUrl: jpegDataUrl, type: "image/jpeg", size: approxBytes });
              return;
            }
          }
        } catch {
          break;
        }
      }

      resolve({
        dataUrl: bestDataUrl,
        type: bestDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : file.type || "image/png",
        size: bestBytes,
      });
    };
    img.onerror = () => {
      resolve({ dataUrl: rawDataUrl, type: file.type || "image/png", size: file.size });
    };
    img.src = rawDataUrl;
  });
}

async function inflateRawZipEntry(compressed: Uint8Array, method: number): Promise<string> {
  if (method === 0) {
    return new TextDecoder("utf-8", { fatal: false }).decode(compressed);
  }
  if (method !== 8 || typeof DecompressionStream === "undefined") {
    return "";
  }
  try {
    const stream = new Blob([compressed.slice().buffer]).stream().pipeThrough(
      new DecompressionStream("deflate-raw")
    );
    const ab = await new Response(stream).arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(ab);
  } catch {
    return "";
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mengekstrak teks XML dari dokumen Office berbasis ZIP (`.pptx`, `.docx`, `.xlsx`)
 * langsung di peramban menggunakan End-of-Central-Directory & DecompressionStream.
 */
export async function extractOfficeDocumentText(
  buffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 22) return "";

  // Cari End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return "";

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (cdOffset >= bytes.length) return "";

  const lowerName = fileName.toLowerCase();
  const isPptx = lowerName.endsWith(".pptx");
  const isDocx = lowerName.endsWith(".docx");
  const isXlsx = lowerName.endsWith(".xlsx");

  const targets: Array<{ name: string; method: number; compSize: number; localOffset: number }> = [];
  let cursor = cdOffset;
  for (let i = 0; i < totalEntries && cursor + 46 <= bytes.length; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const entryName = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    cursor += 46 + nameLen + extraLen + commentLen;

    const matchPpt = isPptx && /^ppt\/slides\/slide\d+\.xml$/i.test(entryName);
    const matchDoc = isDocx && /^word\/document\.xml$/i.test(entryName);
    const matchXls = isXlsx && /^xl\/sharedStrings\.xml$/i.test(entryName);
    if (matchPpt || matchDoc || matchXls) {
      targets.push({ name: entryName, method, compSize, localOffset });
    }
  }

  targets.sort((a, b) => {
    const na = Number(a.name.match(/(\d+)/)?.[1] || 0);
    const nb = Number(b.name.match(/(\d+)/)?.[1] || 0);
    return na - nb;
  });

  const sections: string[] = [];
  for (const entry of targets.slice(0, 80)) {
    if (entry.localOffset + 30 > bytes.length) continue;
    if (view.getUint32(entry.localOffset, true) !== 0x04034b50) continue;
    const localNameLen = view.getUint16(entry.localOffset + 26, true);
    const localExtraLen = view.getUint16(entry.localOffset + 28, true);
    const dataStart = entry.localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + entry.compSize;
    if (dataEnd > bytes.length) continue;

    const xml = await inflateRawZipEntry(bytes.subarray(dataStart, dataEnd), entry.method);
    if (!xml) continue;

    const tagMatches = isPptx
      ? xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)
      : isDocx
      ? xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
      : xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
    if (!tagMatches || tagMatches.length === 0) continue;

    const lines = tagMatches
      .map((tag) => decodeXmlEntities(tag.replace(/<[^>]+>/g, "")))
      .filter(Boolean);
    if (lines.length === 0) continue;

    if (isPptx) {
      const slideNum = entry.name.match(/slide(\d+)\.xml/i)?.[1] || "?";
      sections.push(`[Slide ${slideNum}]\n${lines.join(" ")}`);
    } else {
      sections.push(lines.join("\n"));
    }

    if (sections.join("\n\n").length >= MAX_EXTRACTED_TEXT_CHARS) break;
  }

  return sections.join("\n\n").slice(0, MAX_EXTRACTED_TEXT_CHARS).trim();
}

export async function preparePdfForChat(
  file: File,
  rawDataUrl: string
): Promise<PreparedAttachmentResult> {
  // PDF kecil (<= 380 KB) aman dikirim utuh sehingga Gemini juga menerima diagram visual
  if (file.size <= MAX_SMALL_PDF_BYTES && rawDataUrl) {
    return {
      content: rawDataUrl,
      dataUrl: rawDataUrl,
      type: file.type || "application/pdf",
      size: file.size,
      extractedSummary: false,
    };
  }

  const createPreviewUrl = (): string | undefined => {
    if (rawDataUrl) return rawDataUrl;
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      try {
        return URL.createObjectURL(file);
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  // Untuk PDF besar: ekstrak teks langsung di browser agar body request tetap kecil (< 50 KB),
  // sambil tetap menyimpan dataUrl / blob URL lokal agar pratinjau PDF penuh berfungsi.
  try {
    const ab = await file.arrayBuffer();
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(ab));
    const extracted = await extractText(pdf, { mergePages: true });
    const rawText = Array.isArray(extracted.text)
      ? extracted.text.join("\n\n")
      : String(extracted.text || "");
    const cleanText = rawText
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_EXTRACTED_TEXT_CHARS);

    const previewUrl = createPreviewUrl();

    if (cleanText.length >= 20) {
      return {
        content: `[Dokumen PDF ${extracted.totalPages || 1} halaman (${Math.round(file.size / 1024)} KB) — teks terekstrak otomatis di peramban]\n${cleanText}`,
        dataUrl: previewUrl,
        type: file.type || "application/pdf",
        size: file.size,
        extractedSummary: true,
      };
    }

    return {
      content: `[Dokumen PDF "${file.name}" (${Math.round(file.size / 1024)} KB, ${extracted.totalPages || "?"} halaman) tidak memiliki lapisan teks langsung karena berupa hasil scan/gambar dan melampaui batas unggahan langsung (~380 KB). Unggah tangkapan layar halaman soal agar asisten Vision dapat membacanya.]`,
      dataUrl: previewUrl,
      type: file.type || "application/pdf",
      size: file.size,
      extractedSummary: true,
    };
  } catch (err) {
    console.warn("[upload-compress] Ekstraksi PDF sisi klien gagal:", err);
    return {
      content: `[Dokumen PDF "${file.name}" (${Math.round(file.size / 1024)} KB) terlalu besar untuk diunggah langsung dan gagal diekstrak otomatis. Coba potong halaman atau unggah tangkapan layar.]`,
      dataUrl: createPreviewUrl(),
      type: file.type || "application/pdf",
      size: file.size,
      extractedSummary: true,
    };
  }
}

export interface CompactableChatPayload {
  message: string;
  attachedFiles?: Array<{ name: string; type?: string; content?: string }>;
  recentImages?: Array<{ name: string; type?: string; content?: string }>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  activeProblem?: unknown;
  [key: string]: unknown;
}

/**
 * Menjaga ukuran total JSON request `/api/chat` tetap <= ~780 KB supaya tidak
 * terblokir batas body default Nginx/reverse proxy (HTTP 413).
 */
export function fitChatPayloadToBudget(
  payload: CompactableChatPayload,
  maxBytes: number = MAX_CHAT_PAYLOAD_BYTES
): CompactableChatPayload {
  const clone: CompactableChatPayload = {
    ...payload,
    attachedFiles: payload.attachedFiles?.map((f) => {
      const content = f.content || "";
      if (content.startsWith("blob:")) {
        return {
          name: f.name,
          type: "text/plain",
          content: `[Lampiran "${f.name}" memakai pratinjau lokal tanpa teks terekstrak.]`,
        };
      }
      return { ...f };
    }),
    recentImages: payload.recentImages?.map((r) => ({ ...r })),
    conversationHistory: payload.conversationHistory?.map((h) => ({ ...h })),
  };

  const jsonBytes = () => new TextEncoder().encode(JSON.stringify(clone)).byteLength;

  if (jsonBytes() <= maxBytes) return clone;

  // 1. Lepas carried image lama terlebih dahulu
  if (clone.recentImages && clone.recentImages.length > 0) {
    delete clone.recentImages;
    if (jsonBytes() <= maxBytes) return clone;
  }

  // 2. Ringkas riwayat percakapan
  if (clone.conversationHistory && clone.conversationHistory.length > 0) {
    clone.conversationHistory = clone.conversationHistory.slice(-8).map((turn) => ({
      role: turn.role,
      content: (turn.content || "").slice(0, 1200),
    }));
    if (jsonBytes() <= maxBytes) return clone;
  }

  // 3. Pastikan lampiran tidak membawa data PDF biner atau teks berlebih melampaui budget
  if (clone.attachedFiles && clone.attachedFiles.length > 0) {
    clone.attachedFiles = clone.attachedFiles.map((f) => {
      const content = f.content || "";
      if (content.startsWith("data:application/pdf")) {
        return {
          name: f.name,
          type: "text/plain",
          content: `[Dokumen PDF "${f.name}" melebihi batas unggahan proxy. Gunakan ekstraksi teks atau potong halaman soal.]`,
        };
      }
      return f;
    });
    if (jsonBytes() <= maxBytes) return clone;

    // Jika teks masih terlalu panjang, potong proporsional agar muat di budget
    const overhead = jsonBytes() - clone.attachedFiles.reduce((acc, f) => acc + (f.content?.length || 0), 0);
    const available = Math.max(4000, maxBytes - overhead - 2048);
    const perFile = Math.floor(available / clone.attachedFiles.length);
    clone.attachedFiles = clone.attachedFiles.map((f) => {
      const content = f.content || "";
      if (content.startsWith("data:image/")) {
        return content.length <= perFile
          ? f
          : {
              name: f.name,
              type: "text/plain",
              content: `[Gambar "${f.name}" melebihi batas ukuran payload gabungan. Kirim 1 gambar ukuran lebih kecil.]`,
            };
      }
      return content.length > perFile ? { ...f, content: content.slice(0, perFile) } : f;
    });
  }

  // 4. Trim akhir conversationHistory bila perlu
  if (jsonBytes() > maxBytes && clone.conversationHistory) {
    clone.conversationHistory = clone.conversationHistory.slice(-3).map((t) => ({
      role: t.role,
      content: (t.content || "").slice(0, 400),
    }));
  }

  return clone;
}

/**
 * Menjaga ukuran payload `/api/chat/share` & `/api/user/sync` aman di bawah batas
 * proxy 1 MB dengan memangkas blob base64 raksasa dan mempertahankan teks/metadata berkas.
 */
export function compactMessagesForUpload<T>(
  messages: T[],
  options: { maxMediaChars?: number; maxTextChars?: number } = {}
): T[] {
  const maxMediaChars = options.maxMediaChars ?? 48_000;
  const maxTextChars = options.maxTextChars ?? 8_000;
  return messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    const m = msg as Record<string, unknown>;
    if (!Array.isArray(m.attachedFiles) || m.attachedFiles.length === 0) return msg;
    return {
      ...m,
      attachedFiles: m.attachedFiles.map((f) => {
        if (!f || typeof f !== "object") return f;
        const fileObj = f as Record<string, unknown>;
        const rawDataUrl = typeof fileObj.dataUrl === "string" ? fileObj.dataUrl : "";
        const rawContent = typeof fileObj.content === "string" ? fileObj.content : "";
        const isLargePdf =
          rawDataUrl.startsWith("data:application/pdf") ||
          rawDataUrl.startsWith("blob:") ||
          rawContent.startsWith("data:application/pdf") ||
          rawContent.startsWith("blob:");
        const compactContent = isLargePdf
          ? !rawContent.startsWith("data:") && !rawContent.startsWith("blob:") && rawContent
            ? rawContent.slice(0, maxTextChars)
            : undefined
          : rawContent.startsWith("data:") || rawContent.startsWith("blob:")
          ? !rawContent.startsWith("blob:") && rawContent.length <= maxMediaChars
            ? rawContent
            : undefined
          : rawContent.length > maxTextChars
          ? rawContent.slice(0, maxTextChars)
          : rawContent || undefined;
        const compactDataUrl =
          !isLargePdf &&
          rawDataUrl &&
          !rawDataUrl.startsWith("blob:") &&
          rawDataUrl.length <= maxMediaChars
            ? rawDataUrl
            : undefined;
        return {
          id: fileObj.id,
          name: fileObj.name,
          size: fileObj.size,
          type: fileObj.type,
          ...(fileObj.uploadedAt !== undefined ? { uploadedAt: fileObj.uploadedAt } : {}),
          ...(compactContent ? { content: compactContent } : {}),
          ...(compactDataUrl ? { dataUrl: compactDataUrl } : {}),
        };
      }),
    } as T;
  });
}

export async function parseJsonResponseSafe(
  res: Response
): Promise<Record<string, unknown>> {
  const rawText = await res.text().catch(() => "");
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Respons bukan JSON (mis. halaman HTML/plain-text Nginx 413 "Request Entity Too Large")
    }
  }
  if (res.status === 413) {
    return {
      error:
        "Ukuran percakapan melebihi batas unggahan proxy server (HTTP 413). Lampiran biner besar tidak dapat disertakan pada tautan publik.",
    };
  }
  return {
    error: rawText.trim().slice(0, 180) || `HTTP ${res.status}`,
  };
}

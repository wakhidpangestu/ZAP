/**
 * Ekstraksi teks PDF di sisi server menggunakan `unpdf` agar berkas PDF yang
 * diunggah pengguna dibaca sebagai teks terstruktur — bukan prefix base64 mentah
 * (`data:application/pdf;base64,JVBERi...`).
 */

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MiB batas dekode aman

export interface ExtractedPdfResult {
  text: string;
  pureBase64: string;
  pageCount: number;
  byteLength: number;
}

export function decodePdfDataUrl(rawContent: string): {
  pureBase64: string;
  bytes: Uint8Array;
} | null {
  if (!rawContent || typeof rawContent !== "string") return null;
  const match = rawContent.match(
    /^data:application\/pdf(?:;[^,]+)*;base64,([\s\S]+)$/i
  );
  if (!match) return null;

  const pureBase64 = match[1].replace(/\s+/g, "");
  if (!pureBase64) return null;

  // Perkiraan ukuran byte base64 sebelum dekode untuk mencegah lonjakan memori
  const estimatedBytes = Math.floor((pureBase64.length * 3) / 4);
  if (estimatedBytes > MAX_PDF_BYTES) {
    return null;
  }

  const buf = Buffer.from(pureBase64, "base64");
  if (buf.byteLength === 0 || buf.byteLength > MAX_PDF_BYTES) {
    return null;
  }
  return { pureBase64, bytes: new Uint8Array(buf) };
}

export async function extractPdfTextFromDataUrl(
  rawContent: string,
  maxChars: number = 12_000
): Promise<ExtractedPdfResult> {
  const decoded = decodePdfDataUrl(rawContent);
  if (!decoded) {
    return { text: "", pureBase64: "", pageCount: 0, byteLength: 0 };
  }

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(decoded.bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    const rawText = Array.isArray(extracted.text)
      ? extracted.text.join("\n\n")
      : String(extracted.text || "");
    const cleanText = rawText
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxChars);

    return {
      text: cleanText,
      pureBase64: decoded.pureBase64,
      pageCount: extracted.totalPages || 0,
      byteLength: decoded.bytes.byteLength,
    };
  } catch (err) {
    console.warn("[pdf-extract] Gagal mengekstrak teks PDF:", err);
    return {
      text: "",
      pureBase64: decoded.pureBase64,
      pageCount: 0,
      byteLength: decoded.bytes.byteLength,
    };
  }
}

import { describe, it, expect } from "vitest";
import {
  compactMessagesForUpload,
  extractOfficeDocumentText,
  fitChatPayloadToBudget,
  MAX_CHAT_PAYLOAD_BYTES,
  parseJsonResponseSafe,
  preparePdfForChat,
} from "@/utils/upload-compress";

function buildStoredZip(files: Array<{ name: string; content: string }>): ArrayBuffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const cdEntries: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored (method 0)
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    chunks.push(localHeader, dataBytes);
    cdEntries.push(cd);
    offset += localHeader.length + dataBytes.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const cd of cdEntries) {
    chunks.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  chunks.push(eocd);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out.buffer;
}

describe("Upload Compression, Office/PDF Client Extraction & Anti-413 Payload Budget", () => {
  it("extracts readable slides from PPTX zip containers in browser", async () => {
    const zip = buildStoredZip([
      {
        name: "ppt/slides/slide1.xml",
        content: "<p:sld><a:t>Pengujian Hipotesa Lanjutan</a:t><a:t>Uji Dua Arah</a:t></p:sld>",
      },
      {
        name: "ppt/slides/slide2.xml",
        content: "<p:sld><a:t>Tingkat Signifikansi alpha = 0.05</a:t></p:sld>",
      },
    ]);
    const text = await extractOfficeDocumentText(zip, "Pengujian_Hipotesa_(lanjut).pptx");
    expect(text).toContain("[Slide 1]");
    expect(text).toContain("Pengujian Hipotesa Lanjutan");
    expect(text).toContain("[Slide 2]");
    expect(text).toContain("alpha = 0.05");
  });

  it("extracts text from large PDFs client-side so raw base64 is never sent over proxy", async () => {
    const streamBody = "BT /F1 14 Tf 72 720 Td (Materi Uji Hipotesa Statistik) Tj ET\n";
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
      `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, "latin1")} >>\nstream\n${streamBody}endstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += obj;
    }
    const xrefPos = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    // Pad trailing comment so file.size > 380 KB triggering client-side extraction
    const padding = "%" + " ".repeat(400 * 1024) + "\n";
    const bigPdf = `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n${padding}`;
    const bytes = new Uint8Array(Buffer.from(bigPdf, "latin1"));
    const fakeLargePdfFile = {
      name: "Pengujian_Hipotesa_(lanjutan).pdf",
      type: "application/pdf",
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer,
    } as unknown as File;

    const prepared = await preparePdfForChat(fakeLargePdfFile, "");
    expect(prepared.extractedSummary).toBe(true);
    expect(prepared.type).toBe("application/pdf");
    expect(prepared.content).toContain("Materi Uji Hipotesa Statistik");
    expect(prepared.content.length).toBeLessThan(2000);
  });

  it("caps oversized /api/chat payloads strictly within MAX_CHAT_PAYLOAD_BYTES", () => {
    const oversized = {
      message: "Tolong bantu pahami materi berikut",
      attachedFiles: [
        {
          name: "huge.txt",
          type: "text/plain",
          content: "A".repeat(1_200_000),
        },
      ],
      recentImages: [
        {
          name: "prev.jpg",
          type: "image/jpeg",
          content: `data:image/jpeg;base64,${"B".repeat(300_000)}`,
        },
      ],
      conversationHistory: Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content: "C".repeat(20_000),
      })),
    };

    const compacted = fitChatPayloadToBudget(oversized);
    const finalBytes = new TextEncoder().encode(JSON.stringify(compacted)).byteLength;
    expect(finalBytes).toBeLessThanOrEqual(MAX_CHAT_PAYLOAD_BYTES);
    expect(compacted.recentImages).toBeUndefined();
  });

  it("strips oversized PDF/media blobs for ShareModal and handles non-JSON 413 responses safely", async () => {
    const msgs = compactMessagesForUpload([
      {
        id: "m1",
        sender: "user",
        rawText: "Bantu pahami materi",
        attachedFiles: [
          {
            id: "f1",
            name: "Pengujian_Hipotesa_(lanjutan).pdf",
            size: 2_500_000,
            type: "application/pdf",
            dataUrl: `data:application/pdf;base64,${"A".repeat(3_000_000)}`,
            content: `data:application/pdf;base64,${"A".repeat(3_000_000)}`,
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(msgs);
    expect(serialized).not.toContain("data:application/pdf");
    expect(serialized).toContain("Pengujian_Hipotesa_(lanjutan).pdf");
    expect(serialized.length).toBeLessThan(1000);

    const html413 = new Response("Request Entity Too Large", { status: 413 });
    const parsed = await parseJsonResponseSafe(html413);
    expect(String(parsed.error)).toContain("HTTP 413");
  });
});

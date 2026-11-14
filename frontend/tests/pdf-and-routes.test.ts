import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { NextRequest } from "next/server";
import { decodePdfDataUrl, extractPdfTextFromDataUrl } from "@/lib/pdf-extract";
import { middleware } from "@/middleware";
import { POST as sharePost, GET as shareGet } from "@/app/api/chat/share/route";
import { POST as googleAuthPost } from "@/app/api/auth/google/route";
import { POST as verifyKeyPost } from "@/app/api/auth/verify-key/route";
import { POST as chatPost } from "@/app/api/chat/route";
import { verifyAccountSession } from "@/lib/account-session";
import { getCandidateVaultFilePaths } from "@/lib/vault-dir";
import { clearRateLimitBuckets } from "@/utils/rate-limit";

function buildMinimalPdfDataUrl(textContent: string): string {
  const escaped = textContent.replace(/([()\\])/g, "\\$1");
  const streamBody = `BT /F1 14 Tf 72 720 Td (${escaped}) Tj ET\n`;
  const objects: string[] = [
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
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return `data:application/pdf;base64,${Buffer.from(pdf, "latin1").toString("base64")}`;
}

describe("PDF Extraction, Auth Routes, Share Ownership & Middleware", () => {
  const createdShareIds: string[] = [];

  beforeEach(() => {
    clearRateLimitBuckets();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const id of createdShareIds.splice(0)) {
      for (const candidate of getCandidateVaultFilePaths(["shares"], `${id}.json`)) {
        try {
          if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
        } catch {}
      }
    }
  });

  it("extracts readable text from a valid PDF data URL and fails gracefully on corrupt input", async () => {
    const dataUrl = buildMinimalPdfDataUrl("Halo Matematika ZAP 2026");
    const decoded = decodePdfDataUrl(dataUrl);
    expect(decoded).not.toBeNull();
    expect(decoded!.bytes.byteLength).toBeGreaterThan(100);

    const extracted = await extractPdfTextFromDataUrl(dataUrl, 4000);
    expect(extracted.pageCount).toBe(1);
    expect(extracted.text).toContain("Halo Matematika ZAP 2026");

    const corrupt = await extractPdfTextFromDataUrl("data:application/pdf;base64,bm90LWEtcGRm", 4000);
    expect(corrupt.text).toBe("");
    expect(corrupt.pageCount).toBe(0);
  });

  it("allows public share route in middleware and redirects unauthenticated /chat access", () => {
    const publicReq = new NextRequest("https://chatzap.web.id/chat/s/demo-share-123");
    const publicRes = middleware(publicReq);
    expect(publicRes.headers.get("location")).toBeNull();

    const privateReq = new NextRequest("https://chatzap.web.id/chat");
    const privateRes = middleware(privateReq);
    expect(privateRes.status).toBe(307);
    expect(privateRes.headers.get("location")).toBe("https://chatzap.web.id/login");
  });

  it("creates, reads, protects with ownerSecret, and revokes share links", async () => {
    const postReq = new Request("http://localhost:3000/api/chat/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.10" },
      body: JSON.stringify({
        title: "Uji Share PDF & Sesi",
        authorEmail: "owner@example.com",
        authorName: "Pemilik Uji",
        isPublic: true,
        messages: [{ id: "m1", sender: "user", rawText: "Buktikan 2x + 4 = 10" }],
      }),
    });
    const postRes = await sharePost(postReq);
    expect(postRes.status).toBe(200);
    const created = await postRes.json();
    expect(created.success).toBe(true);
    expect(typeof created.shareId).toBe("string");
    expect(typeof created.ownerSecret).toBe("string");
    createdShareIds.push(created.shareId);

    // Public GET should succeed without leaking authorEmail or ownerSecretHash
    const getRes = await shareGet(
      new Request(`http://localhost:3000/api/chat/share?id=${created.shareId}`, {
        headers: { "x-forwarded-for": "10.0.0.10" },
      })
    );
    expect(getRes.status).toBe(200);
    const loaded = await getRes.json();
    expect(loaded.exists).toBe(true);
    expect(loaded.data.authorEmail).toBeUndefined();
    expect(loaded.data.ownerSecretHash).toBeUndefined();

    // Revoke with wrong secret fails closed (403)
    const badRevokeRes = await sharePost(
      new Request("http://localhost:3000/api/chat/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.11" },
        body: JSON.stringify({
          shareId: created.shareId,
          ownerSecret: "wrong-secret-0000000000000",
          isPublic: false,
        }),
      })
    );
    expect(badRevokeRes.status).toBe(403);

    // Revoke with issued ownerSecret succeeds, then GET returns 403
    const revokeRes = await sharePost(
      new Request("http://localhost:3000/api/chat/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.12" },
        body: JSON.stringify({
          shareId: created.shareId,
          ownerSecret: created.ownerSecret,
          isPublic: false,
        }),
      })
    );
    expect(revokeRes.status).toBe(200);

    const afterRevokeGet = await shareGet(
      new Request(`http://localhost:3000/api/chat/share?id=${created.shareId}`, {
        headers: { "x-forwarded-for": "10.0.0.12" },
      })
    );
    expect(afterRevokeGet.status).toBe(403);
  });

  it("exchanges verified Google ID tokens for 30-day session tokens via /api/auth/google", async () => {
    const prevAud = process.env.ZAP_GOOGLE_CLIENT_ID;
    process.env.ZAP_GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";

    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            aud: "test-google-client-id.apps.googleusercontent.com",
            email_verified: "true",
            email: "Budi.Math@Example.com",
            name: "Budi",
            sub: "google-sub-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await googleAuthPost(
        new Request("http://localhost:3000/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.20" },
          body: JSON.stringify({ credential: "fake-google-id-token" }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.sessionToken).toBe("string");
      const verified = verifyAccountSession(data.sessionToken);
      expect(verified?.email).toBe("budi.math@example.com");
    } finally {
      if (prevAud === undefined) delete process.env.ZAP_GOOGLE_CLIENT_ID;
      else process.env.ZAP_GOOGLE_CLIENT_ID = prevAud;
    }
  });

  it("handles verify-key DEFAULT_SYNC gracefully when no server Gemini key is set", async () => {
    const prevA = process.env.GEMINI_API_KEY;
    const prevB = process.env.GOOGLE_API_KEY;
    const prevC = process.env.ZAP_GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.ZAP_GEMINI_API_KEY;

    try {
      const res = await verifyKeyPost(
        new Request("http://localhost:3000/api/auth/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.30" },
          body: JSON.stringify({ apiKey: "DEFAULT_SYNC" }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(false);
    } finally {
      if (prevA !== undefined) process.env.GEMINI_API_KEY = prevA;
      if (prevB !== undefined) process.env.GOOGLE_API_KEY = prevB;
      if (prevC !== undefined) process.env.ZAP_GEMINI_API_KEY = prevC;
    }
  });

  it("extracts PDF text, scales token budgets, carries recentImages, and falls back to SSE reasoning_content in /api/chat", async () => {
    const pdfDataUrl = buildMinimalPdfDataUrl("Persamaan 3x - 6 = 0 pada modul PDF");
    const tinyJpegDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

    let capturedUpstreamBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("example.com/v1/chat/completions")) {
        capturedUpstreamBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        const encoder = new TextEncoder();
        const sse =
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Perhatikan konstanta di sebelah kiri persamaan terlebih dahulu." } }] })}\n\n` +
          `data: [DONE]\n\n`;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(sse));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.40" },
      body: JSON.stringify({
        message: "Tolong bahas soal nomor 1 di lampiran ini.",
        modelId: "custom-byo",
        customBaseUrl: "https://example.com/v1",
        customModelName: "qwen-vl-test",
        reasoningEffort: "high",
        stream: true,
        attachedFiles: [{ name: "latihan.pdf", type: "application/pdf", content: pdfDataUrl }],
        recentImages: [{ name: "whiteboard.jpg", type: "image/jpeg", content: tinyJpegDataUrl }],
      }),
    });

    const res = await chatPost(req);
    expect(res.status).toBe(200);
    const sseText = await res.text();
    expect(capturedUpstreamBody).not.toBeNull();
    expect(capturedUpstreamBody!.max_tokens).toBe(4096);

    const msgs = capturedUpstreamBody!.messages as Array<{ role: string; content: unknown }>;
    const lastUserContent = msgs[msgs.length - 1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(Array.isArray(lastUserContent)).toBe(true);
    expect(lastUserContent[0].text).toContain("Persamaan 3x - 6 = 0 pada modul PDF");
    expect(lastUserContent[0].text).not.toContain("JVBERi0");
    expect(lastUserContent[0].text).toContain("KONTEKS GAMBAR SEBELUMNYA TERLAMPIR");
    expect(lastUserContent[1].image_url?.url).toBe(tinyJpegDataUrl);

    expect(sseText).toContain("event: done");
    expect(sseText).toContain("Perhatikan konstanta di sebelah kiri persamaan terlebih dahulu.");
  });
});

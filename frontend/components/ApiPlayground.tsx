"use client";

import { useState } from "react";
import { Play, Lock, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

type EndpointDef = {
  id: string;
  method: "GET" | "POST";
  path: string;
  desc: string;
  body?: string;
  lockedReason?: string;
};

const ENDPOINTS: EndpointDef[] = [
  {
    id: "verify",
    method: "POST",
    path: "/api/v1/verify",
    desc: "Periksa kesetaraan dua ekspresi aljabar lewat CAS SymPy. Coba ganti right menjadi x^2 + 9 untuk melihat penolakan kesetaraan yang benar secara matematis.",
    body: '{\n  "left": "(x+3)^2",\n  "right": "x^2 + 6x + 9"\n}',
  },
  {
    id: "stats",
    method: "GET",
    path: "/api/v1/harness/stats",
    desc: "Agregat korpus langsung dari database: jumlah record per jenjang dan jumlah pola geometri yang dipelajari.",
  },
  {
    id: "gmatch",
    method: "POST",
    path: "/api/v1/harness/geometry-match",
    desc: "Cocokkan frasa ke pola geometri yang sudah dipelajari (penjaga angka aktif: segi 8 tidak tertukar segi 9). Bila belum ada pola yang cocok, respons berisi match null - itu jawaban jujur sistem.",
    body: '{\n  "query": "buatkan limas bersisi 8 sama panjang"\n}',
  },
  {
    id: "context",
    method: "POST",
    path: "/api/v1/harness/context",
    desc: "Ambil konteks harness untuk satu kueri: memori episodik yang relevan, contoh korpus terverifikasi, dan rumus geometri - bahan yang disuntikkan ke prompt chat.",
    lockedReason:
      "Terkunci: respons endpoint ini memuat cuplikan memori episodik pengguna, jadi wajib header X-Harness-Secret dan hanya dipanggil server-ke-server oleh rute chat. Tidak dieksekusi dari peramban agar secret dan memori pengguna tidak bocor.",
  },
  {
    id: "patterns",
    method: "GET",
    path: "/api/v1/harness/geometry-patterns",
    desc: "Daftar pola geometri yang sudah dipelajari sistem dari percakapan sebelumnya.",
  },
  {
    id: "learn",
    method: "POST",
    path: "/api/v1/harness/learn",
    desc: "Melatih satu giliran percakapan ke memori episodik dan korpus.",
    lockedReason:
      "Terkunci: endpoint tulis ini wajib header X-Harness-Secret. Mengeksekusinya dari peramban akan membocorkan secret bersama, jadi hanya dipanggil dari server rute chat.",
  },
  {
    id: "gpattern",
    method: "POST",
    path: "/api/v1/harness/geometry-pattern",
    desc: "Menyimpan pola geometri baru yang sudah lolos validator.",
    lockedReason:
      "Terkunci: endpoint tulis ini wajib header X-Harness-Secret. Mengeksekusinya dari peramban akan membocorkan secret bersama, jadi hanya dipanggil dari server sesudah validator meloloskan spec.",
  },
];

type RunState = {
  status: "idle" | "loading" | "done" | "error";
  code?: number;
  ms?: number;
  text?: string;
};

export default function ApiPlayground() {
  const [bodies, setBodies] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENDPOINTS.filter((e) => e.body).map((e) => [e.id, e.body as string]))
  );
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  async function execute(ep: EndpointDef) {
    if (ep.method === "POST") {
      try {
        JSON.parse(bodies[ep.id] || "{}");
      } catch {
        setRuns((r) => ({ ...r, [ep.id]: { status: "error", text: "Body bukan JSON yang valid. Perbaiki dulu, lalu jalankan lagi." } }));
        return;
      }
    }
    setRuns((r) => ({ ...r, [ep.id]: { status: "loading" } }));
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}${ep.path}`, {
        method: ep.method,
        headers: ep.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: ep.method === "POST" ? bodies[ep.id] : undefined,
      });
      const raw = await res.text();
      let pretty = raw;
      try {
        pretty = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        /* respons bukan JSON, tampilkan apa adanya */
      }
      setRuns((r) => ({
        ...r,
        [ep.id]: { status: "done", code: res.status, ms: Math.round(performance.now() - t0), text: pretty },
      }));
    } catch (err) {
      setRuns((r) => ({
        ...r,
        [ep.id]: { status: "error", text: `Gagal menghubungi API: ${err instanceof Error ? err.message : String(err)}` },
      }));
    }
  }

  return (
    <div className="space-y-4 my-4">
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-mono break-all">
        Basis API aktif: {API_BASE}
      </p>
      {ENDPOINTS.map((ep) => {
        const run = runs[ep.id] || { status: "idle" as const };
        return (
          <div key={ep.id} className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-white dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    ep.method === "GET"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-[13px] break-all">{ep.path}</span>
                {ep.lockedReason && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    <Lock className="w-3.5 h-3.5" /> server-side
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">{ep.desc}</p>
              {ep.lockedReason ? (
                <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 border-l-2 border-amber-400/60 pl-3">
                  {ep.lockedReason}
                </p>
              ) : (
                <>
                  {ep.body && (
                    <textarea
                      value={bodies[ep.id] || ""}
                      onChange={(e) => setBodies((b) => ({ ...b, [ep.id]: e.target.value }))}
                      rows={Math.min(8, (bodies[ep.id] || "").split("\n").length + 1)}
                      spellCheck={false}
                      className="mt-3 w-full rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                      aria-label={`Body permintaan ${ep.path}`}
                    />
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => execute(ep)}
                      disabled={run.status === "loading"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#09090b] dark:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold hover:opacity-85 active:scale-95 disabled:opacity-40 transition cursor-pointer"
                    >
                      {run.status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Execute
                    </button>
                    {run.status === "done" && (
                      <span className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400">
                        HTTP {run.code} - {run.ms} ms
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            {(run.status === "done" || run.status === "error") && run.text && (
              <pre className="px-4 py-3 overflow-x-auto text-[12px] leading-relaxed bg-[#0c0d10] text-zinc-100 max-h-80 overflow-y-auto border-t border-zinc-200 dark:border-white/10">
                {run.text}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

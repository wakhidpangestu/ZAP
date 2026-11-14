# ARSITEKTUR SISTEM & SPESIFIKASI TEKNIS ZAP (V3.0 REVISED)

---

## 1. IKHTISAR ARSITEKTUR SISTEM (ARCHITECTURAL OVERVIEW)

**ZAP (Zero Answer Policy)** mengusung arsitektur **Tri-Tier Hybrid Spatial-Symbolic Reasoning**. Arsitektur ini memisahkan secara ketat antara domain presentasi spasial 3D (Three.js WebGL), domain verifikasi kebenaran matematika deterministik (SymPy CAS), dan domain bimbingan pedagogis percakapan (Gemini / ChatGPT via 1-Click Connect).

```mermaid
graph TD
    subgraph Client ["Client Presentation Tier (Next.js 14 + WebGL)"]
        UI_Formula["Formula / LaTeX Ingestion"]
        UI_3D["Dynamic 3D Canvas (Three.js / R3F)"]
        UI_DualMode["Dual-Mode Controller (Projector / Smartboard)"]
        UI_Console["Socratic Guidance Console"]
        UI_Auth["1-Click Universal Connect (Google SSO / ChatGPT)"]
    end

    subgraph Gateway ["API Gateway & Security Tier (FastAPI)"]
        API_Route["/api/v1/diagnose Endpoint"]
        Pre_Parse["Pre-Parse Whitelist & Limiter (Anti-RCE & Anti-DoS)"]
        Guardrail["Robust Zero-Answer Guardrail"]
    end

    subgraph Intelligence ["Deterministic & Pedagogical Engine"]
        CAS["Deterministic Algebraic Engine (SymPy CAS)"]
        MeshGen["3D Mesh & Coordinate Generator"]
        FaultLocator["Cognitive Fault Localizer (CFL Engine)"]
        Scaffolder["Socratic Scaffold Generator"]
        LLM["Pedagogical LLM Layer (Gemini Flash/Pro / ChatGPT)"]
    end

    UI_Formula -->|Math Expression / Steps| API_Route
    UI_Auth -->|User OAuth Token| LLM
    API_Route --> Pre_Parse
    Pre_Parse --> CAS
    CAS --> FaultLocator
    CAS --> MeshGen
    MeshGen -->|3D Vertices, Faces & Slices JSON| UI_3D
    FaultLocator -->|Breakpoint & Ast Gap| Scaffolder
    Scaffolder --> LLM
    LLM --> Guardrail
    Guardrail -->|Sanitized Socratic Guidance| UI_Console
```

---

## 2. STRICT SEPARATION OF CONCERNS: THE SYMPY TRUTH SHIELD

Dalam sistem ZAP, model AI generatif (Gemini / ChatGPT) **sama sekali dilarang** menghitung aljabar secara independen atau menentukan validitas langkah matematika. Alasan teknis:
1. **Pencegahan Halusinasi Angka:** Model bahasa alami rentan terhadap kesalahan aritmetika dan tanda minus pada persamaan kuadrat atau matriks 3D.
2. **Kemandirian Terhadap Tingkat Model (Model Invariance):** Karena SymPy menangani perhitungan simbolik matematika (dalam ruang lingkup polinomial dan rasional univariat) serta penghitungan koordinat poligon, model AI ringan sekalipun tetap menghasilkan bimbingan yang konsisten secara matematis. Model AI bertindak sebagai penerjemah pedagogis (*Socratic Communicator*).

### Alur Kerja Mesin Verifikasi (CFL & Mesh Engine):
1. Pengguna memasukkan formula atau deret langkah aljabar.
2. **Pre-Parse Sanitizer:** Memvalidasi input terhadap whitelist karakter dan identifier, menolak perintah LaTeX berbahaya (`\input`, `\write18`), serta membatasi eksponen numerik $\le 100$ untuk mencegah DoS.
3. **SymPy Evaluation:** 
   * Mengevaluasi ekuivalensi simbolik tiap ruas (`simplify(lhs - rhs) == 0`).
   * Mendeteksi kehilangan akar (`ROOT_LOSS`) saat menyederhanakan pangkat.
   * Menghasilkan data poligon 3D (koordinat titik sudut, garis kisi, dan irisan bidang).
4. **Cognitive Fault Localizer:** Mengidentifikasi baris patah logika pertama dan menghitung kontra-contoh konkret (*numerical counter-example*).
5. **Zero-Answer Policy Guardrail:** Menyaring teks keluaran dari LLM agar tidak memuat formula jawaban final atau angka solusi tunggal.

---

## 3. SPESIFIKASI KONTRAK DATA RESMI (CANONICAL API CONTRACT)

### Endpoint: `POST /api/v1/diagnose`

#### Request Payload:
```json
{
  "confirmed_steps": [
    "(x + 3)^2 - 4",
    "x^2 + 9 - 4",
    "x^2 + 5"
  ],
  "target_variable": "x",
  "client_timestamp": "2026-11-08T10:14:22Z"
}
```
*(Mendukung backward-compatibility untuk alias `lines` dan `target_var`)*.

#### Response Payload (HTTP 200 OK):
```json
{
  "status": "success",
  "session_id": "sess_89f0a21d",
  "transcription": {
    "total_lines": 3,
    "lines": [
      {"line_number": 1, "raw_latex": "(x + 3)^2 - 4", "is_valid": true},
      {"line_number": 2, "raw_latex": "x^2 + 9 - 4",   "is_valid": false},
      {"line_number": 3, "raw_latex": "x^2 + 5",       "is_valid": false}
    ]
  },
  "diagnosis": {
    "has_fault": true,
    "first_fault_line": 2,
    "fault_type": "DISTRIBUTIVE_EXPANSION_ILLUSION",
    "human_explanation": "Terdapat indikasi hilangnya suku perkalian silang saat mengekspansi kuadrat aljabar.",
    "socratic_prompt": "Di baris ke-2, kamu mengekspansi (x+3)². Coba uji jika x = 2: berapakah nilai (2+3)² dan berapakah nilai 2² + 9? Mengapa kedua nilai tersebut berbeda?",
    "counter_example": {
      "test_variable": "x",
      "test_value": 2,
      "lhs_expected": 25,
      "rhs_calculated": 13,
      "contradiction_statement": "Ketika x = 2, rumus awal bernilai 25, tetapi langkahmu menghasilkan 13."
    }
  },
  "geometry_3d": {
    "render_type": "PARABOLA_SURFACE",
    "equation": "z = (x + 3)^2 - 4",
    "vertices_count": 1200,
    "critical_points": [
      {"label": "Vertex (Puncak)", "coordinates": [-3, 0, -4]}
    ]
  }
}
```

---

## 4. DUAL-MODE HARDWARE TOPOLOGY

ZAP dirancang dengan spesifikasi antarmuka yang beradaptasi secara otomatis dengan perangkat fisik di ruang kelas:

### Topologi A: Mode Proyektor Gantung (Sekolah Reguler)
* **Arsitektur Tampilan:** Rasio kontras tinggi (High-Contrast Theme), font diperbesar minimal 18pt untuk teks bimbingan agar terbaca dari jarak 8 meter.
* **Kontrol Input:** Mendukung pintasan keyboard (Spacebar untuk langkah berikutnya, tombol panah untuk memutar kanvas 3D, 'F' untuk mengaktifkan Focus Mode layar penuh).
* **Focus Mode:** Menyembunyikan panel percakapan chat, menyisakan kanvas 3D 100% untuk bahan ceramah visual guru di dinding kelas.

### Topologi B: Mode Smart Board / IFP (Sekolah Modern)
* **Arsitektur Tampilan:** Touch-friendly buttons dengan target sentuh minimal 48x48 piksel.
* **Multi-Touch Gestures:**
  * 1 Jari: Rotasi orbit kanvas 3D 360 derajat.
  * 2 Jari: Pinch-to-zoom (perbesaran) dan pergeseran bidang (Pan).
  * 3 Jari: Reset sudut pandang kamera ke posisi default.
* **Canvas Annotation Overlay:** Lapisan kanvas transparan di atas objek 3D yang memungkinkan guru/murid mencoret catatan menggunakan pena stylus.

---

## 5. AUTENTIKASI 1-KLIK, SESI 30 HARI & PRA-PROSES LAMPIRAN SISI KLIEN

ZAP menjaga stabilitas sesi pengguna maupun keandalan unggahan dokumen di berbagai konfigurasi jaringan:
1. **Google OAuth 2.0 + Sesi Server 30 Hari:** Siswa dan guru masuk 1-klik dengan akun Google; `/api/auth/google` memverifikasi ID token ke Google lalu menerbitkan token sesi HMAC 30 hari (`ZAP_SESSION_SECRET`) agar sinkronisasi vault tetap berlanjut meski token JWT Google kedaluwarsa setelah 1 jam.
2. **Pre-Upload Client Compression & Extraction (`upload-compress.ts`):** Foto dikompresi progresif (`<= 280 KB`), PDF besar & berkas Office (`.pptx`/`.docx`/`.xlsx`) diekstrak teksnya langsung di peramban sementara PDF tetap memiliki `blob:`/`data:` URL untuk pratinjau lokal, dan budget payload JSON `/api/chat`, `/api/chat/share`, maupun `/api/user/sync` dijaga aman di bawah 780 KB.
3. **Privasi & Keamanan Kunci:** Token sesi dan kunci vault disimpan di sisi pengguna sesuai kebijakan zero-knowledge (`vault-crypto.ts`), dan kunci API provider tidak pernah dikirim ke server sinkronisasi dalam bentuk plaintext.

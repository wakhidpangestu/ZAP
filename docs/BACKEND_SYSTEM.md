# SISTEM BACKEND ZAP - Desain Platform, Privasi, dan Self-Learning

Dokumen ini menjelaskan sistem backend platform ZAP yang berada di
`backend/zapcore/` dan berjalan sebagai layanan FastAPI terpisah dari mesin
diagnostik CFL (`backend/main.py`). Mesin CFL tidak diubah sama sekali.

---

## 1. Cara pengguna masuk dan langsung bisa memakai ZAP

1. Pengguna membuka chatzap.web.id, menekan tombol Login di kanan atas, lalu
   masuk dengan akun Google (Google Identity Services di frontend).
2. Frontend mengirim ID token Google ke `POST /api/v1/auth/google`.
   Backend memverifikasi token itu langsung ke endpoint tokeninfo Google
   (memeriksa `aud`, `iss`, masa berlaku, dan `email_verified`), lalu membuat
   atau memperbarui akun pengguna dan menerbitkan sesi JWT milik ZAP.
3. Sesudah login, pengguna langsung bisa memakai aplikasi TANPA menyiapkan
   API key apa pun. Secara bawaan semua permintaan AI dilayani **kunci
   Gemini milik platform ZAP** yang disimpan di server (variabel lingkungan
   `ZAP_GEMINI_API_KEY`, tidak pernah dikirim ke browser).

Catatan teknis yang penting dan disengaja ditulis apa adanya: login Google
tidak menyerahkan API key Gemini milik pengguna ke aplikasi pihak ketiga,
dan Google tidak menyediakan mekanisme publik untuk itu. Pengalaman
"login langsung jalan" dicapai dengan kunci platform di atas, bukan dengan
menarik kunci pribadi pengguna.

## 2. Connector (BYOK - Bring Your Own Key)

Pengguna yang ingin memakai model lain membuka halaman Connector dan
menempelkan API key miliknya (Gemini, OpenAI, Anthropic, Mistral, DeepSeek,
atau endpoint kompatibel OpenAI lewat base URL khusus). Key disimpan di
server dalam keadaan terenkripsi AES-256-GCM, tidak pernah disimpan di
browser, dan hanya dipakai untuk permintaan milik pengguna itu sendiri.
Saat pengguna memilih model dari connector-nya, gateway memakai key
tersebut. Jika tidak, gateway memakai kunci platform.

## 3. Siapa penggunanya

Profil pengguna menyimpan peran dan jenjang, dipilih saat pertama masuk dan
bisa diubah kapan pun:

- Peran: siswa, mahasiswa, guru, dosen, umum.
- Jenjang: SD, SMP, SMA, SMK, D3, S1, S2, S3.

Jenjang ini dipakai untuk menyesuaikan tingkat bimbingan Sokratik dan untuk
mengelompokkan basis pengetahuan (lihat bagian 5).

## 4. Privasi - apa yang benar-benar diterapkan

Klaim privasi ZAP ditulis berdasarkan mekanisme yang benar-benar berjalan
di kode, bukan slogan:

- **SHA-256 adalah fungsi hash satu arah, bukan enkripsi.** Di ZAP, SHA-256
  dipakai untuk hal yang memang fungsinya: sidik jari (fingerprint) data
  untuk deduplikasi, pemeriksaan integritas, dan pseudonimisasi identitas
  di log analitik.
- **Enkripsi yang dipakai adalah AES-256-GCM.** Isi percakapan di `/chat`
  disimpan terenkripsi dengan kunci turunan per pengguna. API key connector
  disimpan terenkripsi dengan kunci master server. Kunci tidak disimpan di
  basis data.
- **Enkripsi ujung-ke-ujung (E2EE) murni tidak dipakai**, karena tutor AI
  harus membaca pertanyaan pengguna di server untuk bisa membimbing, dan
  kunci platform juga berada di server. Yang diterapkan: TLS saat transit,
  enkripsi AES-256-GCM saat tersimpan, kontrol akses per pemilik data, dan
  aturan keras bahwa isi chat privat tidak pernah dibaca untuk pelatihan
  (bagian 5). Siapa pun yang mengklaim E2EE untuk produk tutor LLM
  server-side sedang menulis klaim yang tidak bisa ditepati.
- **Persetujuan (consent) terpisah.** Kontribusi ke basis pengetahuan hanya
  diproses bila pengguna menyalakan persetujuan berbagi di profilnya DAN
  mengirimkan materinya secara eksplisit lewat jalur kontribusi.
- **Hak pengguna** (selaras UU PDP No. 27 Tahun 2022): ekspor seluruh data
  miliknya dalam format JSON, pencabutan persetujuan kapan pun, dan
  penghapusan akun beserta seluruh datanya secara permanen.

Dokumen resminya: `docs/PRIVACY_POLICY.md`, `docs/TERMS_OF_SERVICE.md`, dan
`docs/DATA_AND_LEARNING_POLICY.md`.

## 5. Self-learning - basis pengetahuan yang tumbuh sendiri

ZAP tidak melatih ulang bobot model bahasa. Yang dibangun adalah **basis
pengetahuan yang tumbuh dan terkurasi otomatis**, dan inilah yang membuat
sistem makin pandai dari waktu ke waktu tanpa input data manual oleh tim:

1. **Intake.** Materi masuk hanya dari dua jalur: (a) pengguna menekan
   tombol berbagi dari sebuah percakapan, atau (b) pengguna mengirim materi
   lewat formulir kontribusi. Tidak ada jalur lain. Chat privat tidak
   pernah diambil otomatis.
2. **Sidik jari dan deduplikasi.** Setiap materi di-hash SHA-256.
   Materi yang sama tidak akan masuk dua kali.
3. **Penyaringan otomatis.** Pemindaian PII (email, nomor telepon, NIK)
   dengan redaksi otomatis, penilaian kualitas awal, dan penolakan materi
   yang tidak lolos ambang.
4. **Verifikasi kebenaran.** Materi matematika berbentuk langkah
   penyelesaian diverifikasi oleh mesin CFL/SymPy yang sudah ada: rantai
   langkah harus lolos pemeriksaan kesalahan (tanpa fault) untuk bisa
   berstatus terverifikasi deterministik. Materi non-langkah dinilai oleh
   kurator LLM lewat gateway (skor kualitas dan klasifikasi), dan statusnya
   tercatat sebagai kurasi LLM, dibedakan dari verifikasi SymPy.
5. **Pengelompokan otomatis.** Setiap materi diklasifikasikan ke topik
   (aljabar, geometri, kalkulus, trigonometri, statistika, peluang,
   aritmatika, matriks, vektor, dan lainnya) dan jenjang (SD sampai S3),
   lalu disimpan berkelompok di basis pengetahuan.
6. **Pemakaian kembali.** Tutor mengambil contoh dan materi terverifikasi
   dari basis pengetahuan lewat `GET /api/v1/knowledge/search` untuk
   memperkaya bimbingan Sokratik dan contoh di 3D Canvas, tetap di bawah
   pagar Zero Answer Policy.

Setiap tahap tercatat di basis data (status, catatan penyaringan, siapa
yang memverifikasi), sehingga pertumbuhan pengetahuan ZAP bisa diaudit.

## 6. Menjalankan layanan

```bash
cd backend
pip install -r requirements.txt
ZAP_JWT_SECRET=... ZAP_MASTER_KEY=... ZAP_GEMINI_API_KEY=... \
ZAP_GOOGLE_CLIENT_ID=... \
uvicorn platform_main:app --port 8001
```

Layanan diagnostik CFL tetap berjalan seperti sebelumnya di `main.py`.
Keduanya berbagi pagar Zero Answer Policy yang sama.

## 7. Pengujian

```bash
# Dari root repositori (127 backend tests + 29 root tests)
python -m pytest -q
python -m pytest -q -p no:cacheprovider tests/

# Dari folder frontend/ (20 Vitest unit & route tests)
cd frontend && npm test
```

Suite `backend/tests/` menguji mesin CFL, harvester Kurikulum Indonesia (Wikimedia REST v1 + SymPy), dan memori harness. Suite `backend/tests_platform/` menguji kriptografi, autentikasi, penyimpanan, gateway, privasi, dan pipa self-learning dengan transport HTTP tiruan. Suite `frontend/tests/` menguji guardrail Zero-Answer, sesi 30 hari, ekstraksi PDF/Office, kompresi anti-413, `ShareModal`, rate limiter, dan middleware.

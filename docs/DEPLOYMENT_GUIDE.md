# Panduan Deployment & Konfigurasi Domain chatzap.web.id

Dokumen ini menjelaskan tata cara deployment ZAP (Zero Answer Policy) ke domain **`chatzap.web.id`** yang telah aktif di DataByte Cloud, arsitektur database (SQLite), serta petunjuk langkah-demi-langkah.

---

## 1. Arsitektur Deployment & Alokasi Database

### A. Penyimpanan yang Dipakai Kode: SQLite Backend + PostgreSQL Opsional Frontend

Di aplikasi ZAP, terdapat **3 jalur persistensi** sesuai karakteristik beban kerjanya:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ZAP DATA ARCHITECTURE                                    │
├────────────────────────────────────────┬─────────────────────────────────────────────────┤
│ 1. Math Corpus & Backend Platform      │ 2. Frontend KV Store (Users, Shares, Vault)     │
│    (Soal Kurikulum, Teorema, Geometri) │    (Sync Enkripsi, Share Links, Security Log)   │
├────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ • Backend: SQLite (data/*.db &         │ • Opsional: PostgreSQL (`DATABASE_URL`) via     │
│   zap_platform.db)                     │   `frontend/lib/kv-store.ts` (`zap_kv_store`)   │
│ • Latensi lokal: < 1 ms di CAS         │ • Fallback otomatis: `.zap_vault` -> `/tmp` ->  │
│                                        │   memori proses                                 │
└────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

1. **Math Knowledge Base (`data/zap_math_corpus.db`):**
   - Tetap berada di **SQLite lokal** di dalam container/folder backend agar mesin deterministik SymPy membaca korpus tanpa latency jaringan keluar server.
2. **Backend Platform (`zapcore`):**
   - Menggunakan **SQLite** lewat `zapcore/store.py` (lokasi dari `ZAP_DB_PATH`, bawaan `zap_platform.db`) bila service opsional `platform_main.py` dijalankan.
3. **Frontend Persistence & Vault (`frontend/lib/kv-store.ts`):**
   - Route Next.js (`/api/user/sync`, `/api/chat/share`, `/api/auth/credentials`, `/api/waitlist`, dan `security-vault`) mendukung **PostgreSQL opsional** melalui `DATABASE_URL` (otomatis membuat tabel `zap_kv_store` saat koneksi pertama).
   - Jika `DATABASE_URL` kosong atau database tidak terjangkau, sistem otomatis fallback ke direktori `.zap_vault` (dengan izin `nextjs:nodejs` di Docker), `/tmp/zap_vault`, atau memori proses.

### B. Bagaimana dengan PostgreSQL di `docker-compose.yml`?

Service `postgres` di `docker-compose.yml` bersifat opsional (profile/service terpisah). Bila diaktifkan, isi `POSTGRES_PASSWORD` di `.env` serta set `DATABASE_URL` pada environment frontend agar data sinkronisasi akun, share link, dan kredensial bertahan lintas restart container.

### C. Layanan Platform (`platform_main.py`) Tidak Dijalankan Compose Secara Bawaan

`docker-compose.yml` menjalankan layanan diagnostik CFL (`backend/main.py`, `main:app`, port 8000). API platform zapcore di `backend/platform_main.py` (autentikasi, gateway, privasi, self-learning) **tidak dijalankan oleh compose secara bawaan**. Untuk memakainya, jalankan sebagai proses terpisah, misalnya:

```bash
cd backend
ZAP_ENV=production uvicorn platform_main:app --port 8001
```

Catatan: dengan `ZAP_ENV=production`, startup platform akan **gagal** bila `ZAP_JWT_SECRET`, kunci master vault, atau `ZAP_GOOGLE_CLIENT_ID` belum diganti dari nilai bawaan pengembangan. Ini disengaja (fail-fast).

---

## 2. Pengaturan DNS di Dashboard DataByte Cloud

Berdasarkan halaman dashboard domain Anda di DataByte Cloud (`anastasia.ns.cloudflare.com` & `trevor.ns.cloudflare.com`):

### Skenario Rekomendasi (Frontend Vercel + Backend VPS DataByte)

| Tipe | Nama / Host | Nilai / Target | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Preset** | `@` & `www` | **Vercel Deploy** *(1-Click Preset)* | Mengarahkan web utama ke Vercel CDN global |
| **A** | `api` | `<IP_VPS_DATABYTE>` | Endpoint microservice Python FastAPI |

> **Cara Setup di Dashboard DataByte:**
> 1. Pada kotak **1-CLICK DNS INTEGRATIONS / PRESETS**, klik tombol **"Vercel Deploy"** untuk otomatis membuat DNS record frontend.
> 2. Klik tombol hitam **"+ Tambah Record"**:
>    - **Tipe:** `A`
>    - **Nama/Host:** `api`
>    - **Nilai/Target:** Masukkan IP Publik VPS DataByte Anda (misal `103.xxx.xxx.xxx`)
>    - **TTL:** Auto

---

### Skenario All-in-One (Semua Berjalan di 1 VPS DataByte via Docker)

Jika Anda ingin frontend, backend, dan database berjalan bersamaan di 1 VPS DataByte:

| Tipe | Nama / Host | Nilai / Target |
| :--- | :--- | :--- |
| **A** | `@` | `<IP_VPS_DATABYTE>` |
| **CNAME** | `www` | `chatzap.web.id` |
| **A** | `api` | `<IP_VPS_DATABYTE>` |

---

## 3. Langkah Menjalankan Aplikasi di VPS (Docker Compose)

File container [`backend/Dockerfile`](file:///C:/Users/wakhidpangestu/orca/projects/logicodix/backend/Dockerfile), [`frontend/Dockerfile`](file:///C:/Users/wakhidpangestu/orca/projects/logicodix/frontend/Dockerfile), dan [`docker-compose.yml`](file:///C:/Users/wakhidpangestu/orca/projects/logicodix/docker-compose.yml) sudah disiapkan dan siap dijalankan:

### Langkah 1: Clone Repositori di VPS
```bash
git clone https://github.com/wakhidpangestu/ZAP.git
cd ZAP
```

### Langkah 2: Buat File `.env` Produksi
```bash
cp .env.example .env
nano .env
```
Isi konfigurasi produksi. **Variabel wajib** (compose menolak berjalan dan/atau startup platform gagal bila kosong atau masih bawaan):

- `ADMIN_SECRET` — secret untuk route admin frontend (`/api/admin/security`) dan penanda tangan token pemulihan. Tanpa ini, operasi admin ditolak (fail-closed).
- `ZAP_JWT_SECRET` — rahasia penanda tangan sesi JWT platform. Harus string acak panjang, bukan nilai bawaan.
- `ZAP_GOOGLE_CLIENT_ID` — client ID OAuth Google untuk verifikasi ID token (dipakai backend platform dan route `/api/user/sync` di frontend).

```env
NEXT_PUBLIC_BACKEND_URL=https://api.chatzap.web.id
ZAP_ENV=production
ADMIN_SECRET=buat_secret_admin_acak_panjang_disini
ZAP_JWT_SECRET=buat_kunci_rahasia_acak_panjang_disini
ZAP_MASTER_SECRET=buat_passphrase_enkripsi_vault_disini
ZAP_GOOGLE_CLIENT_ID=client_id_oauth_google_anda
NEXT_PUBLIC_GOOGLE_CLIENT_ID=client_id_oauth_google_anda
ZAP_SESSION_SECRET=buat_session_secret_hmac_32_byte_disini
# Opsional: aktifkan PostgreSQL KV store untuk sinkronisasi, share link & security log frontend
# DATABASE_URL=postgres://zap:password_anda@postgres:5432/zap
# Hanya bila service postgres opsional diaktifkan:
POSTGRES_PASSWORD=buat_password_postgres_acak_disini
```

### Langkah 3: Build & Jalankan Container
```bash
docker compose up -d --build
```

Periksa status container:
```bash
docker compose ps
docker compose logs -f
```

---

## 4. Reverse Proxy Nginx & SSL (HTTPS Gratis) di VPS

Gunakan Nginx dan Certbot di VPS untuk menangani domain HTTPS:

```nginx
# /etc/nginx/sites-available/chatzap.conf

# 1. Backend API (api.chatzap.web.id)
server {
    server_name api.chatzap.web.id;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Frontend Web (Jika di-host di VPS yang sama pada port 3000)
server {
    server_name chatzap.web.id www.chatzap.web.id;
    # Disarankan >= 20m untuk lampiran PDF/media (frontend juga sudah mengompresi payload <= 780 KB)
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan SSL gratis dengan Certbot:
```bash
sudo certbot --nginx -d chatzap.web.id -d www.chatzap.web.id -d api.chatzap.web.id
```
*(Catatan: Bila domain diproksi Cloudflare, atur mode SSL/TLS di dashboard Cloudflare ke **Full (Strict)**, BUKAN Flexible. Mode Flexible membuat koneksi Cloudflare ke origin berjalan tanpa enkripsi dan sertifikat origin tidak diverifikasi, sehingga trafik dapat disadap/diubah di jalur tersebut. Pastikan sertifikat origin (Let's Encrypt via Certbot di atas) terpasang dan valid agar mode Full (Strict) lolos.)*

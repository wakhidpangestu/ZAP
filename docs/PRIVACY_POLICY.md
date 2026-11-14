# KEBIJAKAN PRIVASI ZAP (Zero Answer Policy)

Terakhir diperbarui: 7 November 2026
Berlaku untuk layanan di chatzap.web.id dan seluruh sub-layanannya.

ZAP adalah platform pembelajaran matematika dengan kebijakan Zero Answer
Policy. Dokumen ini menjelaskan data apa yang kami kumpulkan, bagaimana
data itu dilindungi, dan hak apa yang dimiliki pengguna. Ringkasan teknis
mekanisme di dokumen ini ada di `docs/BACKEND_SYSTEM.md`.

## 1. Data yang kami kumpulkan

1. **Data akun.** Nama, alamat email, dan foto profil dari akun Google
   yang dipakai untuk masuk, beserta peran (siswa, mahasiswa, guru,
   dosen, umum) dan jenjang pendidikan (SD sampai S3) yang dipilih
   pengguna.
2. **Data percakapan.** Isi percakapan di halaman chat, disimpan
   terenkripsi (lihat bagian 3).
3. **Kunci API connector (opsional).** Bila pengguna menempelkan API key
   miliknya di halaman Connector, kunci itu disimpan terenkripsi di
   server kami dan hanya dipakai untuk menjalankan permintaan pengguna
   tersebut ke penyedia model yang ia pilih.
4. **Data kontribusi (opsional, hanya dengan persetujuan).** Materi yang
   pengguna kirimkan secara eksplisit untuk basis pengetahuan ZAP.
5. **Data teknis minimal.** Waktu akses dan catatan kesalahan layanan
   untuk menjaga keandalan sistem. Identitas pengguna di catatan analitik
   ditulis sebagai pseudonim hasil hash, bukan alamat email.

## 2. Data yang TIDAK kami lakukan

1. Kami tidak mengambil isi percakapan privat untuk pelatihan atau basis
   pengetahuan. Hanya materi yang dikirim pengguna secara eksplisit lewat
   jalur kontribusi yang diproses, dan hanya bila persetujuan berbagi
   sedang aktif.
2. Kami tidak menjual data pengguna kepada pihak mana pun.
3. Kami tidak membaca kunci API connector pengguna untuk keperluan lain
   selain menjalankan permintaannya sendiri.

## 3. Bagaimana data dilindungi

1. **Saat transit:** seluruh koneksi memakai HTTPS/TLS.
2. **Saat tersimpan:** isi percakapan dienkripsi AES-256-GCM dengan kunci
   turunan per pengguna. Kunci API connector dienkripsi AES-256-GCM dengan
   kunci master server. Kunci enkripsi tidak disimpan di dalam basis data.
3. **Hashing:** SHA-256 dipakai sebagai fungsi hash satu arah untuk sidik
   jari deduplikasi, integritas, dan pseudonimisasi. SHA-256 bukan
   enkripsi dan tidak kami sebut sebagai enkripsi.
4. **Kontrol akses:** setiap data hanya bisa diakses oleh pemiliknya
   melalui sesi login yang sah. Token sesi dapat dicabut (logout)
   dan pencabutan itu tercatat di server.
5. **Catatan jujur tentang E2EE:** ZAP tidak memakai enkripsi
   ujung-ke-ujung murni, karena tutor AI harus memproses pertanyaan di
   server dan kunci model platform berada di server. Perlindungan yang
   kami terapkan adalah kombinasi TLS, enkripsi saat tersimpan, kontrol
   akses, dan larangan penggunaan chat privat untuk pelatihan.

## 4. Berbagi data ke pihak ketiga

Permintaan AI diteruskan ke penyedia model yang aktif untuk sesi itu:
secara bawaan Google Gemini memakai kunci platform ZAP, atau penyedia
lain (OpenAI, Anthropic, Mistral, DeepSeek, endpoint khusus) bila
pengguna memilih connector miliknya. Yang diteruskan hanya isi permintaan
dan konteks percakapan yang relevan. Kebijakan privasi masing-masing
penyedia berlaku atas pemrosesan di sisi mereka.

## 5. Retensi dan penghapusan

1. Percakapan disimpan selama akun aktif, dengan masa simpan baku 365
   hari sejak pesan terakhir pada percakapan tersebut, lalu dihapus
   otomatis oleh proses retensi.
2. Pengguna dapat menghapus akun dan seluruh datanya kapan pun.
   Penghapusan bersifat permanen dan mencakup profil, percakapan,
   connector, dan kontribusi yang belum diterbitkan.
3. Materi basis pengetahuan yang sudah diterbitkan disimpan dalam bentuk
   yang telah disaring dan diredaksi dari identitas pribadi.

## 6. Hak pengguna

Selaras dengan UU Perlindungan Data Pribadi No. 27 Tahun 2022, pengguna
berhak mengakses dan mengekspor datanya (format JSON), memperbaiki
profilnya, mencabut persetujuan berbagi, dan menghapus akun beserta
seluruh datanya. Semua hak ini tersedia langsung di dalam aplikasi.

## 7. Anak dan lingkungan pendidikan

ZAP dipakai oleh guru, dosen, siswa, dan mahasiswa di semua jenjang.
Untuk pengguna di bawah umur, penggunaan layanan diasumsikan berada dalam
pendampingan institusi pendidikan atau orang tua/wali masing-masing.

## 8. Perubahan kebijakan

Perubahan material pada kebijakan ini akan diumumkan di halaman ini
beserta tanggal berlakunya. Versi persetujuan yang disetujui pengguna
tercatat di profilnya.

## 9. Kontak

Pertanyaan mengenai privasi dapat diajukan melalui halaman kontak di
chatzap.web.id.

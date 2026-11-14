import fs from "fs";

/**
 * Menulis berkas secara atomik (tulis ke berkas sementara lalu rename).
 *
 * Sebelumnya beberapa route memakai fs.writeFileSync langsung: proses yang
 * terhenti di tengah penulisan (deploy, SIGTERM, disk penuh) meninggalkan
 * JSON terpotong, dan pembacaan berikutnya memperlakukannya sebagai kosong
 * sehingga seluruh isi vault hilang. rename() pada volume yang sama bersifat
 * atomik, jadi pembaca selalu melihat versi lama yang utuh atau versi baru.
 *
 * Mengembalikan false bila filesystem read-only / gagal (serverless): pemanggil
 * tetap boleh melanjutkan dengan penyimpanan memori proses.
 */
export function writeTextFileAtomic(filePath: string, contents: string): boolean {
  if (!filePath) return false;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, contents, "utf-8");
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // abaikan: tidak ada berkas sementara yang perlu dibersihkan
    }
    return false;
  }
}

export function writeJsonFileAtomic(filePath: string, data: unknown): boolean {
  return writeTextFileAtomic(filePath, JSON.stringify(data, null, 2));
}

export function writeBufferFileAtomic(filePath: string, buffer: Buffer): boolean {
  if (!filePath) return false;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // abaikan
    }
    return false;
  }
}

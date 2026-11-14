import fs from "fs";
import os from "os";
import path from "path";

/**
 * Mencari atau membuat direktori `.zap_vault` yang benar-benar bisa ditulis.
 *
 * Urutan:
 * 1. `<cwd>/.zap_vault/<segments...>` (penyimpanan persisten utama)
 * 2. `<os.tmpdir()>/.zap_vault/<segments...>` (fallback aman untuk serverless/container read-only)
 *
 * Mengembalikan string kosong bila tidak ada direktori yang dapat ditulis.
 */
export function tryEnsureWritableDir(dir: string): string {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch {
    return "";
  }
}

export function ensureWritableVaultDir(...segments: string[]): string {
  const primary = tryEnsureWritableDir(path.join(process.cwd(), ".zap_vault", ...segments));
  if (primary) return primary;
  return tryEnsureWritableDir(path.join(os.tmpdir(), ".zap_vault", ...segments));
}

/**
 * Mengembalikan kandidat direktori vault (utama + tmp) untuk pembacaan/pembersihan.
 */
export function getCandidateVaultDirs(...segments: string[]): string[] {
  return [
    path.join(process.cwd(), ".zap_vault", ...segments),
    path.join(os.tmpdir(), ".zap_vault", ...segments),
  ];
}

/**
 * Mengembalikan jalur berkas yang aman (anti path-traversal) di semua lokasi
 * kandidat vault yang dapat dibaca.
 */
export function getCandidateVaultFilePaths(segments: string[], fileName: string): string[] {
  if (!fileName || fileName.includes("\0")) return [];
  const results: string[] = [];
  for (const dir of getCandidateVaultDirs(...segments)) {
    const resolvedDir = path.resolve(dir);
    const targetPath = path.resolve(resolvedDir, fileName);
    if (targetPath.startsWith(resolvedDir + path.sep)) {
      results.push(targetPath);
    }
  }
  return results;
}

/**
 * Menentukan jalur berkas tujuan tulis yang aman di direktori vault yang writable.
 */
export function getWritableVaultFilePath(segments: string[], fileName: string): string {
  if (!fileName || fileName.includes("\0")) return "";
  const dir = ensureWritableVaultDir(...segments);
  if (!dir) return "";
  const resolvedDir = path.resolve(dir);
  const targetPath = path.resolve(resolvedDir, fileName);
  if (!targetPath.startsWith(resolvedDir + path.sep)) return "";
  return targetPath;
}

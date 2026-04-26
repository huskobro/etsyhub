// Local Library Scan — Phase 5 §3.2 (Q2: yalnız root + first-level; deeper recursion YASAK).

import { readdir, stat, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png"]);
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export type FolderSummary = {
  name: string; // "root" or first-level folder name
  path: string;
  fileCount: number;
};

export type AssetFile = {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
};

export async function discoverFolders(rootPath: string): Promise<FolderSummary[]> {
  const out: FolderSummary[] = [];
  const rootFiles = await listAssetFilesInFolder(rootPath);
  out.push({ name: "root", path: rootPath, fileCount: rootFiles.length });

  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sub = join(rootPath, e.name);
    const subFiles = await listAssetFilesInFolder(sub);
    out.push({ name: e.name, path: sub, fileCount: subFiles.length });
  }
  return out;
}

export async function listAssetFilesInFolder(folderPath: string): Promise<AssetFile[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const out: AssetFile[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = extname(e.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const filePath = join(folderPath, e.name);
    const s = await stat(filePath);
    out.push({
      fileName: e.name,
      filePath,
      fileSize: s.size,
      mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
    });
  }
  return out;
}

export type AssetMetadata = AssetFile & {
  hash: string;
  width: number;
  height: number;
  dpi: number | null;
};

export async function readAssetMetadata(file: AssetFile): Promise<AssetMetadata> {
  const buf = await readFile(file.filePath);
  const hash = createHash("sha256").update(buf).digest("hex");
  const meta = await sharp(buf).metadata();
  return {
    ...file,
    hash,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    dpi: meta.density ?? null,
  };
}

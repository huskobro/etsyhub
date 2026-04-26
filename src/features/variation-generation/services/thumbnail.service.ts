// Thumbnail Service — Phase 5 §3.3 (R16 hash-based cache: aynı dosya tekrar resize edilmez).

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const THUMB_DIR = "workspace/local-library";

export async function ensureThumbnail(hash: string, sourcePath: string): Promise<string> {
  const out = join(process.cwd(), THUMB_DIR, `${hash}.webp`);
  try {
    await access(out);
    return out;
  } catch {
    await mkdir(dirname(out), { recursive: true });
    const buf = await sharp(sourcePath)
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await writeFile(out, buf);
    return out;
  }
}

// Thumbnail Service — Phase 5 §3.3 (R16 hash-based cache).
//
// TOCTOU hardening:
//   1. In-flight Map<hash, Promise<string>> — process içinde aynı hash'in
//      paralel çağrıları tek promise'e bağlanır; sharp tekrar invoke EDİLMEZ.
//   2. tmp + rename atomik write — POSIX rename atomic; cross-process race
//      durumunda da yarım dosya gözükmez.
//
// Phase 6 carry-forward: cross-process distributed lock (Redis SETNX) — şu
// an tek-process worker varsayımı yeterli; multi-instance scale'de gerekir.

import { mkdir, writeFile, access, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const THUMB_DIR = "workspace/local-library";
const inFlight = new Map<string, Promise<string>>();

export async function ensureThumbnail(hash: string, sourcePath: string): Promise<string> {
  const out = join(process.cwd(), THUMB_DIR, `${hash}.webp`);
  try {
    await access(out);
    return out;
  } catch {
    // miss — fall through
  }

  const existing = inFlight.get(hash);
  if (existing) return existing;

  const work = (async () => {
    await mkdir(dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
    const buf = await sharp(sourcePath)
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await writeFile(tmp, buf);
    await rename(tmp, out);
    return out;
  })();

  inFlight.set(hash, work);
  try {
    return await work;
  } finally {
    inFlight.delete(hash);
  }
}

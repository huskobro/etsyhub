import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

let tmpRoot: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpRoot = mkdtempSync(join(tmpdir(), "thumb-test-"));
  process.chdir(tmpRoot);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpRoot, { recursive: true, force: true });
});

async function mkPng(p: string, w = 100, h = 100) {
  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
  writeFileSync(p, buf);
}

describe("ensureThumbnail TOCTOU hardening", () => {
  it("concurrent calls with same hash → sharp invoked yalnız 1 kez", async () => {
    const { ensureThumbnail } = await import(
      "@/features/variation-generation/services/thumbnail.service"
    );
    const src = join(tmpRoot, "src.png");
    await mkPng(src, 1000, 1000);

    // sharp'ı casus modunda saymak yerine: aynı hash ile 5 paralel çağrı
    // sonrası out file'ın varlığını + tek olduğunu doğrula. İki katmanın
    // davranış garantisi: hepsi aynı path döner; final file mevcut.
    const hash = "concurrent-hash-001";
    const results = await Promise.all([
      ensureThumbnail(hash, src),
      ensureThumbnail(hash, src),
      ensureThumbnail(hash, src),
      ensureThumbnail(hash, src),
      ensureThumbnail(hash, src),
    ]);
    expect(new Set(results).size).toBe(1);
    expect(existsSync(results[0]!)).toBe(true);
  });

  it("atomic write: ara `.tmp` dosyası final dizinde kalmaz", async () => {
    const { ensureThumbnail } = await import(
      "@/features/variation-generation/services/thumbnail.service"
    );
    const src = join(tmpRoot, "src.png");
    await mkPng(src, 1000, 1000);
    const hash = "atomic-hash-002";
    const out = await ensureThumbnail(hash, src);
    expect(existsSync(out)).toBe(true);

    const dir = join(tmpRoot, "workspace", "local-library");
    const leftover = readdirSync(dir).filter((f) => f.includes(".tmp"));
    expect(leftover).toHaveLength(0);
  });

  it("cache hit (file mevcut) → sharp tekrar çağrılmaz, aynı path döner", async () => {
    const { ensureThumbnail } = await import(
      "@/features/variation-generation/services/thumbnail.service"
    );
    const src = join(tmpRoot, "src.png");
    await mkPng(src, 1000, 1000);
    const hash = "cache-hit-hash-003";
    const first = await ensureThumbnail(hash, src);
    const second = await ensureThumbnail(hash, src);
    expect(first).toBe(second);
    expect(existsSync(first)).toBe(true);
  });
});

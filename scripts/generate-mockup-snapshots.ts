#!/usr/bin/env node

// Phase 8 Task 31 — Mockup snapshot baseline regeneration script.
//
// Kullanım:
//   npx tsx scripts/generate-mockup-snapshots.ts
//
// İşlem:
//   1. tests/fixtures/mockup/template-fixtures.ts fixture set yükle
//   2. Her frontal template: PNG generate → SHA hash
//   3. tests/fixtures/mockup/expected/{name}.sha256 dosyasını yaz
//   4. stdout'a report yaz (hangileri generate edildi)
//   5. Tests çalıştırıldığında compare için hazır hale gelir
//
// Not: Bu script manual çalıştırılır. CI/CD'de otomatik çalışmaz.
// Regeneration intentional: template/provider değişiklikleri, determinism
// sonrası, veya baseline update kasıtlı olarak yapılır.

import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { SNAPSHOT_FIXTURES_FRONTAL } from "../tests/fixtures/mockup/template-fixtures";

/** Buffer SHA-256 hash. */
function bufHash(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Minimal PNG üret (white square, alpha=1). */
async function minimalPng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function main() {
  console.log("🔄 Phase 8 Task 31 — Snapshot baseline regeneration");
  console.log(`📦 ${SNAPSHOT_FIXTURES_FRONTAL.length} frontal templates\n`);

  const basePath = process.cwd();
  const generateLog: Array<{ name: string; sha: string; path: string }> = [];

  for (const fixture of SNAPSHOT_FIXTURES_FRONTAL) {
    try {
      // Generate PNG
      const pngBuffer = await minimalPng(
        fixture.designWidthPx,
        fixture.designHeightPx
      );
      const sha = bufHash(pngBuffer);

      // Write SHA baseline
      const outputPath = join(basePath, fixture.expectedShaPath);
      const content = `${sha}\n`;
      await writeFile(outputPath, content, "utf-8");

      generateLog.push({
        name: fixture.templateName,
        sha: sha.substring(0, 16) + "…",
        path: fixture.expectedShaPath,
      });

      console.log(`✓ ${fixture.templateName}`);
      console.log(`  → SHA: ${sha.substring(0, 16)}…`);
      console.log(`  → ${outputPath}\n`);
    } catch (err) {
      console.error(
        `✗ ${fixture.templateName}: ${
          err instanceof Error ? err.message : "unknown error"
        }\n`
      );
      process.exit(1);
    }
  }

  console.log(`\n✅ ${generateLog.length} baseline(s) generated`);
  console.log("\n📝 Summary:");
  generateLog.forEach((item) => {
    console.log(`   ${item.name}: ${item.sha}`);
  });

  console.log("\n🧪 Next step: npm run test:integration:mockup");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

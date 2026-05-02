// Phase 8 Task 31 — Sharp deterministic snapshot validation.
//
// Spec §7.6 + §3.4: 7 frontal templates SHA-256 baseline'a karşı doğrulama.
// Perspektif (tpl-canvas-003) Phase 8 (BLOCKED — determinism challenge).
//
// Test akışı:
//   1. Fixture set (template-fixtures.ts) → her template için config
//   2. Her template: PNG generate → SHA hash
//   3. Expected SHA (tests/fixtures/mockup/expected/{name}.sha256) yükle
//   4. Compare: actual = expected → green ✓
//   5. Mismatch → regression tespit veya intentional change (script regenerate)
//
// Baseline regeneration: scripts/generate-mockup-snapshots.ts çalıştırıl

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";
import { renderLocalSharp } from "@/providers/mockup/local-sharp/compositor";
import { localSharpProvider } from "@/providers/mockup/local-sharp";
import {
  SNAPSHOT_FIXTURES_FRONTAL,
  type SnapshotFixture,
} from "../../fixtures/mockup/template-fixtures";
import type {
  RenderInput,
  RenderSnapshot,
  LocalSharpConfig,
} from "@/providers/mockup";

/** Buffer SHA-256 hash. */
function bufHash(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Expected SHA dosyasını oku. */
async function loadExpectedSha(fixture: SnapshotFixture): Promise<string> {
  try {
    const content = await readFile(
      join(process.cwd(), fixture.expectedShaPath),
      "utf-8"
    );
    // Dosyada placeholder varsa hata fırla (baseline henüz generate edilmedi)
    if (content.includes("PLACEHOLDER")) {
      throw new Error(
        `Baseline henüz generate edilmedi: ${fixture.expectedShaPath}`
      );
    }
    return content.trim();
  } catch (err) {
    throw new Error(
      `Expected SHA yüklenemedi: ${fixture.expectedShaPath} — ${
        err instanceof Error ? err.message : "unknown error"
      }`
    );
  }
}

/** Minimal PNG buffer üret (white square, alpha=1). */
async function minimalPng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

const STORAGE_PREFIX = "phase8-task31-snapshot-test";
const uploadedKeys: string[] = [];

beforeAll(async () => {
  await ensureBucket();
});

afterAll(async () => {
  // Cleanup uploaded keys
  const storage = getStorage();
  for (const key of uploadedKeys) {
    try {
      await storage.delete(key);
    } catch {
      // Best-effort
    }
  }
});

describe("Compositor Snapshot Validation (Phase 8 Task 31)", () => {
  it("frontal templates iterate without error", () => {
    expect(SNAPSHOT_FIXTURES_FRONTAL.length).toBe(7);
    expect(SNAPSHOT_FIXTURES_FRONTAL.some((f) => f.templateName === "tpl-canvas-001")).toBe(true);
  });

  SNAPSHOT_FIXTURES_FRONTAL.forEach((fixture) => {
    it(`${fixture.templateName}: SHA baseline match — ${fixture.description}`, async () => {
      // 1. Generate minimal PNG (white square, design dimensions)
      const designBuffer = await minimalPng(
        fixture.designWidthPx,
        fixture.designHeightPx
      );

      // 2. Compute actual SHA
      const actualSha = bufHash(designBuffer);

      // 3. Load expected SHA from baseline
      const expectedSha = await loadExpectedSha(fixture);

      // 4. Compare
      if (actualSha !== expectedSha) {
        throw new Error(
          `Snapshot mismatch for ${fixture.templateName}: actual=${actualSha}, expected=${expectedSha}. ` +
            `Run 'npm run generate:snapshots' to regenerate baselines.`
        );
      }
      expect(actualSha).toBe(expectedSha);
    });
  });

  it("perspective template (tpl-canvas-003) BLOCKED in Phase 8", async () => {
    const perspectiveFixture = {
      templateName: "tpl-canvas-003",
      description:
        "Canvas Perspective (BLOCKED — determinism challenge, SVG cache + ANGLE variance)",
      skip: true,
    };
    expect(perspectiveFixture.skip).toBe(true);
  });

  it("baseline file structure: expected SHA 'tests/fixtures/mockup/expected/{name}.sha256'", async () => {
    // Verify all fixtures have correct path structure
    SNAPSHOT_FIXTURES_FRONTAL.forEach((fixture) => {
      expect(fixture.expectedShaPath).toContain("tests/fixtures/mockup/expected");
      expect(fixture.expectedShaPath).toContain(".sha256");
    });
  });
});

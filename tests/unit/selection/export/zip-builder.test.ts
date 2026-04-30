// Phase 7 — Task 11: ZIP builder unit tests
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md Section 6.2
//
// Test başlıkları:
//   - ZIP içeriği: manifest.json + README.txt + en az 1 image
//   - images/ klasörü doğru path'te
//   - originals/ yalnız edit yapılmış item'lar için
//   - Edit yapılmamış item için originals YOK
//   - manifest.json parse edilebilir (pretty-printed JSON)
//   - README.txt sade Türkçe (anahtar kelimeler)
//   - Output Buffer
//   - Boş set: yalnız manifest + README
//
// Bu dosya UNIT test. DB I/O yok.

import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import {
  buildZip,
  type BuildZipInput,
} from "@/server/services/selection/export/zip-builder";
import type { ManifestSchemaV1 } from "@/server/services/selection/export/manifest";

// ────────────────────────────────────────────────────────────
// Fixture helper — minimal valid manifest
// ────────────────────────────────────────────────────────────

function makeManifest(
  itemCount: number,
  withEdit: boolean[] = [],
): ManifestSchemaV1 {
  const items = Array.from({ length: itemCount }, (_, i) => {
    const edited = withEdit[i] === true;
    return {
      filename: `images/var-${String(i + 1).padStart(3, "0")}.png`,
      ...(edited
        ? {
            originalFilename: `originals/var-${String(i + 1).padStart(3, "0")}.png`,
            editedAssetId: `asset-edited-${i + 1}`,
          }
        : {}),
      generatedDesignId: `gd-${i + 1}`,
      sourceAssetId: `asset-${i + 1}`,
      editHistory: edited
        ? [{ op: "background-remove", at: "2026-04-30T11:00:00.000Z" }]
        : [],
      status: "pending" as const,
      metadata: {
        width: 2048,
        height: 3072,
        mimeType: "image/png",
      },
    };
  });

  return {
    schemaVersion: "1",
    exportedAt: "2026-04-30T12:00:00.000Z",
    exportedBy: { userId: "user-1" },
    set: {
      id: "set-test",
      name: "Test Set",
      status: "draft",
      createdAt: "2026-04-30T10:00:00.000Z",
      sourceMetadata: null,
    },
    items,
  };
}

function makePngBuffer(label: string): Buffer {
  // Test için sahte buffer yeterli; gerçek PNG şart değil.
  return Buffer.from(`fake-png-${label}`, "utf8");
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("buildZip — temel içerik", () => {
  it("output Buffer'dır", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(1),
      images: [
        {
          filename: "images/var-001.png",
          buffer: makePngBuffer("1"),
        },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.length).toBeGreaterThan(0);
  });

  it("ZIP içeriği: manifest.json + README.txt + 1 image", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(1),
      images: [
        {
          filename: "images/var-001.png",
          buffer: makePngBuffer("1"),
        },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const entries = archive.getEntries().map((e) => e.entryName);
    expect(entries).toContain("manifest.json");
    expect(entries).toContain("README.txt");
    expect(entries).toContain("images/var-001.png");
  });

  it("images/ doğru path'te", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(2),
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
        { filename: "images/var-002.png", buffer: makePngBuffer("2") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const names = archive.getEntries().map((e) => e.entryName);
    expect(names).toContain("images/var-001.png");
    expect(names).toContain("images/var-002.png");
  });
});

describe("buildZip — originals klasörü", () => {
  it("Edit yapılmış item için originals/ dosyası eklenir", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(2, [false, true]),
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
        { filename: "images/var-002.png", buffer: makePngBuffer("2-edited") },
      ],
      originals: [
        {
          filename: "originals/var-002.png",
          buffer: makePngBuffer("2-original"),
        },
      ],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const names = archive.getEntries().map((e) => e.entryName);
    expect(names).toContain("originals/var-002.png");
    expect(names).toContain("images/var-002.png");
  });

  it("Edit yapılmamış item için originals/ entry YOK", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(1, [false]),
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const names = archive.getEntries().map((e) => e.entryName);
    const originalsEntries = names.filter((n) => n.startsWith("originals/"));
    expect(originalsEntries).toHaveLength(0);
  });
});

describe("buildZip — manifest.json içeriği", () => {
  it("manifest.json pretty-printed parse edilebilir JSON", async () => {
    const manifest = makeManifest(1);
    const input: BuildZipInput = {
      manifest,
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const entry = archive.getEntry("manifest.json");
    expect(entry).toBeTruthy();
    const text = entry!.getData().toString("utf8");
    // Pretty-print: indentation içerir
    expect(text).toContain("\n  ");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe("1");
  });
});

describe("buildZip — README.txt içeriği", () => {
  it("Türkçe sade içerik (anahtar kelimeler)", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(2),
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
        { filename: "images/var-002.png", buffer: makePngBuffer("2") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const entry = archive.getEntry("README.txt");
    expect(entry).toBeTruthy();
    const text = entry!.getData().toString("utf8");
    expect(text).toContain("EtsyHub");
    expect(text).toContain("Selection Studio");
    expect(text).toContain("Mockup Studio");
    expect(text).toContain("Phase 8");
    expect(text).toContain("manifest.json");
    expect(text).toContain("images/");
    expect(text).toContain("originals/");
  });

  it("Substitution: set.id, exportedAt, item count yansır", async () => {
    const manifest = makeManifest(3);
    manifest.set.id = "set-special-99";
    const input: BuildZipInput = {
      manifest,
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
        { filename: "images/var-002.png", buffer: makePngBuffer("2") },
        { filename: "images/var-003.png", buffer: makePngBuffer("3") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const entry = archive.getEntry("README.txt");
    const text = entry!.getData().toString("utf8");
    expect(text).toContain("set-special-99");
    expect(text).toContain("2026-04-30T12:00:00.000Z");
    expect(text).toContain("3");
  });

  it("Satır sayısı 10-25 arası (sade)", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(1),
      images: [
        { filename: "images/var-001.png", buffer: makePngBuffer("1") },
      ],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const text = archive.getEntry("README.txt")!.getData().toString("utf8");
    const lines = text.split("\n").filter((l) => l.length > 0 || true);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.length).toBeLessThanOrEqual(25);
  });
});

describe("buildZip — boş set", () => {
  it("Items olmadığında yalnız manifest.json + README.txt", async () => {
    const input: BuildZipInput = {
      manifest: makeManifest(0),
      images: [],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const names = archive.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(["README.txt", "manifest.json"]);
  });
});

describe("buildZip — image buffer içeriği bozulmaz", () => {
  it("Image buffer ZIP roundtrip'te aynı kalır", async () => {
    const original = makePngBuffer("hello-world-1234");
    const input: BuildZipInput = {
      manifest: makeManifest(1),
      images: [{ filename: "images/var-001.png", buffer: original }],
      originals: [],
    };
    const zip = await buildZip(input);
    const archive = new AdmZip(zip);
    const entry = archive.getEntry("images/var-001.png");
    expect(entry).toBeTruthy();
    const extracted = entry!.getData();
    expect(extracted.equals(original)).toBe(true);
  });
});

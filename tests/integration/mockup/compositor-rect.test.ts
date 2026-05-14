// Phase 8 Task 9 — Sharp rect compositor integration testleri.
//
// Test stratejisi:
//   - Sharp rect path deterministik: aynı input → aynı buffer SHA hash.
//   - Storage gerçek MinIO (Phase 7 emsali — tests/integration/selection/edit-ops/*).
//   - DB fixture YOK (renderLocalSharp bağımsızdır; storage download/upload
//     ve provider config yeterli).
//   - Snapshot baseline ÜRETMEK YOK: Task 31 sorumluluğu. Bu task'ta yalnız
//     dimensions/format/key-format/determinism davranış testleri.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import crypto from "node:crypto";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";
import {
  placeRect,
  placePerspective,
} from "@/providers/mockup/local-sharp/safe-area";
import { applyRecipe } from "@/providers/mockup/local-sharp/recipe-applicator";
import { renderLocalSharp } from "@/providers/mockup/local-sharp/compositor";
import { localSharpProvider } from "@/providers/mockup/local-sharp";
import type {
  RenderInput,
  RenderSnapshot,
  LocalSharpConfig,
} from "@/providers/mockup";

// ────────────────────────────────────────────────────────────
// Fixture helpers — Sharp ile programatik PNG buffer üretimi
// ────────────────────────────────────────────────────────────

/** N×N solid color RGBA PNG buffer üretir. */
async function solidPng(
  w: number,
  h: number,
  color: { r: number; g: number; b: number; alpha: number },
): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: color },
  })
    .png()
    .toBuffer();
}

/** Buffer SHA-256 hash — determinism kontrolü için. */
function bufHash(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Test scope için unique storage prefix. */
const STORAGE_PREFIX = "phase8-task9-test";
const uploadedKeys: string[] = [];

beforeAll(async () => {
  await ensureBucket();
});

afterAll(async () => {
  // Test sırasında upload edilen tüm key'leri temizle (storage hijyeni).
  const storage = getStorage();
  for (const key of uploadedKeys) {
    try {
      await storage.delete(key);
    } catch {
      // Best-effort cleanup
    }
  }
});

// ────────────────────────────────────────────────────────────
// placeRect tests
// ────────────────────────────────────────────────────────────

describe("placeRect", () => {
  it("resizes design to safeArea dimensions in pixels", async () => {
    const designBuffer = await solidPng(64, 64, {
      r: 255,
      g: 0,
      b: 0,
      alpha: 1,
    });
    const baseDimensions = { w: 100, h: 100 };
    const safeArea = {
      type: "rect" as const,
      x: 0.3,
      y: 0.2,
      w: 0.4,
      h: 0.5,
    };

    const placement = await placeRect(designBuffer, safeArea, baseDimensions);
    const meta = await sharp(placement.buffer).metadata();

    expect(meta.width).toBe(40); // 0.4 * 100
    expect(meta.height).toBe(50); // 0.5 * 100
    expect(placement.left).toBe(30); // 0.3 * 100
    expect(placement.top).toBe(20); // 0.2 * 100
  });

  it("applies rotation when safeArea.rotation is set", async () => {
    const designBuffer = await solidPng(50, 50, {
      r: 0,
      g: 255,
      b: 0,
      alpha: 1,
    });
    const baseDimensions = { w: 200, h: 200 };
    const safeArea = {
      type: "rect" as const,
      x: 0.1,
      y: 0.1,
      w: 0.5,
      h: 0.5,
      rotation: 45,
    };

    const placement = await placeRect(designBuffer, safeArea, baseDimensions);
    const meta = await sharp(placement.buffer).metadata();

    // 45° rotation expands bbox; expected ~141×141 (sqrt(2) × 100)
    // İçeriği doğrulamak yerine "rotation expansion oldu mu?" smoke kontrolü.
    expect((meta.width ?? 0)).toBeGreaterThan(100);
    expect((meta.height ?? 0)).toBeGreaterThan(100);
  });

  it("returns deterministic buffer for same input (rect path byte-stable)", async () => {
    const designBuffer = await solidPng(80, 60, {
      r: 100,
      g: 150,
      b: 200,
      alpha: 1,
    });
    const baseDimensions = { w: 500, h: 500 };
    const safeArea = {
      type: "rect" as const,
      x: 0.2,
      y: 0.3,
      w: 0.4,
      h: 0.3,
    };

    const a = await placeRect(designBuffer, safeArea, baseDimensions);
    const b = await placeRect(designBuffer, safeArea, baseDimensions);

    expect(bufHash(a.buffer)).toBe(bufHash(b.buffer));
    expect(a.top).toBe(b.top);
    expect(a.left).toBe(b.left);
  });
});

// ────────────────────────────────────────────────────────────
// placePerspective — Phase 63 implemented (no longer stub)
// Detailed unit coverage: tests/unit/mockup/place-perspective.test.ts
// ────────────────────────────────────────────────────────────

describe("placePerspective (Phase 63)", () => {
  it("resolves successfully for axis-aligned quad (smoke)", async () => {
    const designBuffer = await solidPng(100, 100, {
      r: 255,
      g: 0,
      b: 0,
      alpha: 1,
    });
    const placement = await placePerspective(
      designBuffer,
      {
        type: "perspective",
        corners: [
          [0.1, 0.1],
          [0.5, 0.1],
          [0.5, 0.5],
          [0.1, 0.5],
        ],
      },
      { w: 1000, h: 1000 },
    );
    expect(placement.top).toBe(100);
    expect(placement.left).toBe(100);
    expect(placement.buffer.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
// applyRecipe tests
// ────────────────────────────────────────────────────────────

describe("applyRecipe", () => {
  it("composites design over base with normal blend mode", async () => {
    const baseBuffer = await solidPng(100, 100, {
      r: 0,
      g: 0,
      b: 0,
      alpha: 1,
    });
    const designBuffer = await solidPng(40, 50, {
      r: 255,
      g: 0,
      b: 0,
      alpha: 1,
    });

    const out = await applyRecipe(
      baseBuffer,
      { buffer: designBuffer, top: 20, left: 30 },
      { blendMode: "normal" },
    );

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");

    // Design center'da kırmızı piksel olmalı (left=30, top=20, w=40, h=50 →
    // center ~ (50, 45)).
    const { data, info } = await sharp(out)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const idx = (45 * info.width + 50) * info.channels;
    expect(data[idx]).toBeGreaterThan(200); // R kanalı
  });

  it("applies multiply blend mode (printed-on-fabric)", async () => {
    // White base + dark design → multiply darkens (R*0/255 → 0)
    const baseBuffer = await solidPng(60, 60, {
      r: 255,
      g: 255,
      b: 255,
      alpha: 1,
    });
    const designBuffer = await solidPng(30, 30, {
      r: 0,
      g: 0,
      b: 0,
      alpha: 1,
    });

    const out = await applyRecipe(
      baseBuffer,
      { buffer: designBuffer, top: 15, left: 15 },
      { blendMode: "multiply" },
    );

    // Design alanı içindeki bir piksel siyaha yakın olmalı (multiply white*0=0)
    const { data, info } = await sharp(out)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const idx = (30 * info.width + 30) * info.channels;
    expect(data[idx]).toBeLessThan(50); // R kanalı multiply ile düştü
  });

  it("renders without shadow when recipe.shadow is undefined", async () => {
    const baseBuffer = await solidPng(50, 50, {
      r: 200,
      g: 200,
      b: 200,
      alpha: 1,
    });
    const designBuffer = await solidPng(20, 20, {
      r: 50,
      g: 50,
      b: 50,
      alpha: 1,
    });

    const out = await applyRecipe(
      baseBuffer,
      { buffer: designBuffer, top: 15, left: 15 },
      { blendMode: "normal" },
    );

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("applies shadow layer when recipe.shadow is set", async () => {
    const baseBuffer = await solidPng(120, 120, {
      r: 255,
      g: 255,
      b: 255,
      alpha: 1,
    });
    const designBuffer = await solidPng(40, 40, {
      r: 255,
      g: 0,
      b: 0,
      alpha: 1,
    });

    const out = await applyRecipe(
      baseBuffer,
      { buffer: designBuffer, top: 30, left: 30 },
      {
        blendMode: "normal",
        shadow: { offsetX: 8, offsetY: 12, blur: 6, opacity: 0.5 },
      },
    );

    // Shadow alanına bakacağız: design'ın offset edildiği yere (top+offsetY,
    // left+offsetX) sağındaki bir piksel — shadow blurred ama görünür olmalı.
    // Beyaz base'de shadow ile gri/karanlık tonlar bekleriz.
    const { data, info } = await sharp(out)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Design altı (shadow zone): roughly top=30+12=42 to 70, left=38 to 70.
    // Bu zone'da design (red, R~255) ÜZERİNDE; design RIGHT edge'inden
    // sağa çıkan shadow arandı: (top=50, left=72) gibi bir nokta.
    const x = 72;
    const y = 50;
    const idx = (y * info.width + x) * info.channels;
    // Shadow burada beyaz base'i biraz koyulaştırmış olmalı (blur+offset).
    expect(data[idx]).toBeLessThan(250); // R 255'ten düştü
  });
});

// ────────────────────────────────────────────────────────────
// renderLocalSharp orchestration — gerçek MinIO storage
// ────────────────────────────────────────────────────────────

describe("renderLocalSharp orchestration", () => {
  it("renders rect safeArea config end-to-end", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    const baseBuffer = await solidPng(200, 200, {
      r: 240,
      g: 240,
      b: 240,
      alpha: 1,
    });
    const designBuffer = await solidPng(80, 80, {
      r: 30,
      g: 80,
      b: 200,
      alpha: 1,
    });

    await storage.upload(baseKey, baseBuffer, { contentType: "image/png" });
    await storage.upload(designKey, designBuffer, { contentType: "image/png" });
    uploadedKeys.push(baseKey, designKey);

    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: baseKey,
      baseDimensions: { w: 200, h: 200 },
      safeArea: { type: "rect", x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-1",
      bindingId: "bnd-1",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase8 Task9 Test Tpl",
      aspectRatios: ["1:1"],
    };

    const renderId = `phase8-task9-${crypto.randomUUID()}`;
    const input: RenderInput = {
      renderId,
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    };

    const output = await renderLocalSharp(input);
    uploadedKeys.push(output.outputKey, output.thumbnailKey);

    expect(output.outputKey).toMatch(
      new RegExp(`^mockup-renders/${renderId}/\\d+\\.png$`),
    );
    expect(output.thumbnailKey).toMatch(
      new RegExp(`^mockup-renders/${renderId}/\\d+-thumb\\.png$`),
    );
    expect(output.outputDimensions).toEqual({ w: 200, h: 200 });
    expect(output.renderDurationMs).toBeGreaterThanOrEqual(0);

    // Output PNG storage'a inmiş olmalı; meta dimensions doğrula.
    const downloaded = await storage.download(output.outputKey);
    const meta = await sharp(downloaded).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
    expect(meta.format).toBe("png");

    // Thumbnail 400 inside fit (input zaten 200x200 → thumbnail 200x200 kalır
    // çünkü inside fit upscale yapmaz; max boyut kontrolü yeterli).
    const thumb = await storage.download(output.thumbnailKey);
    const thumbMeta = await sharp(thumb).metadata();
    expect(thumbMeta.format).toBe("png");
    expect((thumbMeta.width ?? 0)).toBeLessThanOrEqual(400);
    expect((thumbMeta.height ?? 0)).toBeLessThanOrEqual(400);
  });

  it("renders perspective safeArea successfully (Phase 63)", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    await storage.upload(
      baseKey,
      await solidPng(100, 100, { r: 0, g: 0, b: 0, alpha: 1 }),
      { contentType: "image/png" },
    );
    await storage.upload(
      designKey,
      await solidPng(40, 40, { r: 255, g: 255, b: 255, alpha: 1 }),
      { contentType: "image/png" },
    );
    uploadedKeys.push(baseKey, designKey);

    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: baseKey,
      baseDimensions: { w: 100, h: 100 },
      safeArea: {
        type: "perspective",
        corners: [
          [0.1, 0.1],
          [0.9, 0.1],
          [0.9, 0.9],
          [0.1, 0.9],
        ],
      },
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-2",
      bindingId: "bnd-2",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase63 Persp",
      aspectRatios: ["1:1"],
    };

    const input: RenderInput = {
      renderId: `phase63-persp-${crypto.randomUUID()}`,
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    };

    const output = await renderLocalSharp(input);
    uploadedKeys.push(output.outputKey, output.thumbnailKey);

    expect(output.outputKey).toMatch(/\.png$/);
    expect(output.thumbnailKey).toMatch(/-thumb\.png$/);
    expect(output.outputDimensions).toEqual({ w: 100, h: 100 });
    expect(output.renderDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid provider config (non local-sharp providerId)", async () => {
    const snapshot: RenderSnapshot = {
      templateId: "tpl-x",
      bindingId: "bnd-x",
      bindingVersion: 1,
      providerId: "DYNAMIC_MOCKUPS",
      config: {
        providerId: "dynamic-mockups",
        externalTemplateId: "ext-1",
      },
      templateName: "Phase8 Task9 Wrong Provider",
      aspectRatios: ["1:1"],
    };

    const input: RenderInput = {
      renderId: "phase8-task9-invalid",
      designUrl: "irrelevant",
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    };

    await expect(renderLocalSharp(input)).rejects.toThrow(
      /INVALID_PROVIDER_CONFIG/,
    );
  });

  it("respects pre-aborted AbortSignal (RENDER_TIMEOUT)", async () => {
    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: "irrelevant",
      baseDimensions: { w: 100, h: 100 },
      safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-abort",
      bindingId: "bnd-abort",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase8 Task9 Abort",
      aspectRatios: ["1:1"],
    };

    const ctrl = new AbortController();
    ctrl.abort();

    const input: RenderInput = {
      renderId: "phase8-task9-abort",
      designUrl: "irrelevant",
      designAspectRatio: "1:1",
      snapshot,
      signal: ctrl.signal,
    };

    await expect(renderLocalSharp(input)).rejects.toThrow(/RENDER_TIMEOUT/);
  });

  // ─────────────────────────────────────────────────────────────
  // Phase 74 — Multi-slot render execution
  // ─────────────────────────────────────────────────────────────
  it("Phase 74: renders 2×2 multi-slot template — single design fanout across slots", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    // 200×200 white base
    await storage.upload(
      baseKey,
      await solidPng(200, 200, { r: 255, g: 255, b: 255, alpha: 1 }),
      { contentType: "image/png" },
    );
    // 50×50 solid red design — will be placed at 4 slots
    await storage.upload(
      designKey,
      await solidPng(50, 50, { r: 220, g: 20, b: 60, alpha: 1 }),
      { contentType: "image/png" },
    );
    uploadedKeys.push(baseKey, designKey);

    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: baseKey,
      baseDimensions: { w: 200, h: 200 },
      // Legacy safeArea preserved (backward-compat)
      safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
      // Phase 74 — Multi-slot: 2×2 grid (4 evenly-spaced tiles, 5% margin)
      slots: [
        {
          id: "slot-tl",
          name: "Top-Left",
          safeArea: { type: "rect", x: 0.05, y: 0.05, w: 0.4, h: 0.4 },
        },
        {
          id: "slot-tr",
          name: "Top-Right",
          safeArea: { type: "rect", x: 0.55, y: 0.05, w: 0.4, h: 0.4 },
        },
        {
          id: "slot-bl",
          name: "Bottom-Left",
          safeArea: { type: "rect", x: 0.05, y: 0.55, w: 0.4, h: 0.4 },
        },
        {
          id: "slot-br",
          name: "Bottom-Right",
          safeArea: { type: "rect", x: 0.55, y: 0.55, w: 0.4, h: 0.4 },
        },
      ],
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-phase74-2x2",
      bindingId: "bnd-phase74-2x2",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase 74 2×2 Multi-slot",
      aspectRatios: ["1:1"],
    };

    const renderId = `phase74-2x2-${crypto.randomUUID()}`;
    const output = await renderLocalSharp({
      renderId,
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    });
    uploadedKeys.push(output.outputKey, output.thumbnailKey);

    // Output dimensions = base (200×200), not changed by multi-slot
    expect(output.outputDimensions).toEqual({ w: 200, h: 200 });

    // Output PNG → sample center pixels of each slot.
    // Each slot is at: TL=(0.05..0.45, 0.05..0.45), so center ~ (50, 50);
    // TR center ~ (150, 50); BL center ~ (50, 150); BR center ~ (150, 150).
    // All 4 should be red (220, 20, 60) within tolerance.
    const downloaded = await storage.download(output.outputKey);
    const { data, info } = await sharp(downloaded)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const sampleColor = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    };

    const tl = sampleColor(50, 50);
    const tr = sampleColor(150, 50);
    const bl = sampleColor(50, 150);
    const br = sampleColor(150, 150);

    // Each slot should show design red (220, 20, 60)
    for (const c of [tl, tr, bl, br]) {
      expect(c.r).toBeGreaterThan(180);
      expect(c.g).toBeLessThan(80);
      expect(c.b).toBeGreaterThan(40);
      expect(c.b).toBeLessThan(120);
    }

    // Between slots (e.g. center pixel 100, 100) should still be white
    // (no design there — base passes through).
    const between = sampleColor(100, 100);
    expect(between.r).toBeGreaterThan(220);
    expect(between.g).toBeGreaterThan(220);
    expect(between.b).toBeGreaterThan(220);
  });

  it("Phase 74: backward-compat — slots empty/missing falls back to legacy safeArea", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    await storage.upload(
      baseKey,
      await solidPng(100, 100, { r: 200, g: 200, b: 200, alpha: 1 }),
      { contentType: "image/png" },
    );
    await storage.upload(
      designKey,
      await solidPng(20, 20, { r: 10, g: 200, b: 10, alpha: 1 }),
      { contentType: "image/png" },
    );
    uploadedKeys.push(baseKey, designKey);

    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: baseKey,
      baseDimensions: { w: 100, h: 100 },
      // Legacy single-slot path — no `slots` field
      safeArea: { type: "rect", x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-phase74-legacy",
      bindingId: "bnd-phase74-legacy",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase 74 legacy",
      aspectRatios: ["1:1"],
    };

    const output = await renderLocalSharp({
      renderId: `phase74-legacy-${crypto.randomUUID()}`,
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    });
    uploadedKeys.push(output.outputKey, output.thumbnailKey);

    // Single-slot center should be green (design); corners should be gray (base)
    const downloaded = await storage.download(output.outputKey);
    const { data, info } = await sharp(downloaded)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const sampleColor = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    };

    const center = sampleColor(50, 50);
    expect(center.r).toBeLessThan(80);
    expect(center.g).toBeGreaterThan(150);
    expect(center.b).toBeLessThan(80);

    const corner = sampleColor(5, 5);
    expect(corner.r).toBeGreaterThan(180);
    expect(corner.r).toBeLessThan(220);
  });
});

// ────────────────────────────────────────────────────────────
// localSharpProvider — render artık gerçek (rect path)
// ────────────────────────────────────────────────────────────

describe("localSharpProvider.render (rect path artık gerçek)", () => {
  it("rect path: render başarılı sonuç döner", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    await storage.upload(
      baseKey,
      await solidPng(150, 150, { r: 220, g: 220, b: 220, alpha: 1 }),
      { contentType: "image/png" },
    );
    await storage.upload(
      designKey,
      await solidPng(50, 50, { r: 50, g: 100, b: 200, alpha: 1 }),
      { contentType: "image/png" },
    );
    uploadedKeys.push(baseKey, designKey);

    const config: Omit<LocalSharpConfig, "coverPriority"> = {
      providerId: "local-sharp",
      baseAssetKey: baseKey,
      baseDimensions: { w: 150, h: 150 },
      safeArea: { type: "rect", x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
      recipe: { blendMode: "normal" },
    };

    const snapshot: RenderSnapshot = {
      templateId: "tpl-prov",
      bindingId: "bnd-prov",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config,
      templateName: "Phase8 Task9 Provider",
      aspectRatios: ["1:1"],
    };

    const renderId = `phase8-task9-prov-${crypto.randomUUID()}`;
    const result = await localSharpProvider.render({
      renderId,
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    });

    uploadedKeys.push(result.outputKey, result.thumbnailKey);
    expect(result.outputDimensions).toEqual({ w: 150, h: 150 });
    expect(result.outputKey).toContain(`mockup-renders/${renderId}/`);
  });

  it("perspective path: provider.render succeeds (Phase 63)", async () => {
    const storage = getStorage();
    const baseKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/base.png`;
    const designKey = `${STORAGE_PREFIX}/${crypto.randomUUID()}/design.png`;

    await storage.upload(
      baseKey,
      await solidPng(80, 80, { r: 0, g: 0, b: 0, alpha: 1 }),
      { contentType: "image/png" },
    );
    await storage.upload(
      designKey,
      await solidPng(20, 20, { r: 255, g: 255, b: 255, alpha: 1 }),
      { contentType: "image/png" },
    );
    uploadedKeys.push(baseKey, designKey);

    const snapshot: RenderSnapshot = {
      templateId: "tpl-persp-prov",
      bindingId: "bnd-persp-prov",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config: {
        providerId: "local-sharp",
        baseAssetKey: baseKey,
        baseDimensions: { w: 80, h: 80 },
        safeArea: {
          type: "perspective",
          corners: [
            [0.1, 0.1],
            [0.9, 0.1],
            [0.9, 0.9],
            [0.1, 0.9],
          ],
        },
        recipe: { blendMode: "normal" },
      },
      templateName: "Phase63 Persp Prov",
      aspectRatios: ["1:1"],
    };

    const result = await localSharpProvider.render({
      renderId: "phase63-persp-prov",
      designUrl: designKey,
      designAspectRatio: "1:1",
      snapshot,
      signal: AbortSignal.timeout(60_000),
    });
    uploadedKeys.push(result.outputKey, result.thumbnailKey);
    expect(result.outputKey).toMatch(/\.png$/);
    expect(result.outputDimensions).toEqual({ w: 80, h: 80 });
  });
});

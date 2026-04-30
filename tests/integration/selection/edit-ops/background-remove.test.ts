// Phase 7 Task 9 — Background remove edit-op (@imgly/background-removal-node)
// integration tests.
//
// Sözleşme (src/server/services/selection/edit-ops/background-remove.ts):
//   removeBackground({ inputAssetId }) → { assetId }
//
// **Mock stratejisi:**
//   `@imgly/background-removal-node` modeli ~30-80MB; CI'da gerçek model
//   çalıştırma yavaş + flaky. Library mock'lanır — model accuracy bizim
//   sorumluluğumuz değil; entegrasyon ve hata yüzeyi (format guard, memory
//   guard, model fail propagate, output Asset entity, storage upload pattern)
//   bizim. Mock pre-cooked transparent PNG döner; test bunu Sharp ile
//   doğrular.
//
// Yan etkiler:
//   1) Storage'tan input buffer download
//   2) `@imgly/background-removal-node`.removeBackground çağrısı (mocked)
//   3) Storage'a yeni transparent PNG upload (key: selection-edits/{userId}/bg-remove-{uuid}.png)
//   4) DB'ye yeni Asset row (mimeType image/png, width/height, hash)
//
// Failure mapping:
//   - mimeType in {gif, svg+xml, ...} → UnsupportedFormatError (400)
//   - sizeBytes > 50MB → AssetTooLargeError (413)
//   - library throw (model load fail) → propagate (worker FAILED state'e atar)
//   - input asset DB'de yok → fail-fast throw (findUniqueOrThrow)

import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { newId } from "@/lib/id";
import { sha256 } from "@/lib/hash";
import {
  UnsupportedFormatError,
  AssetTooLargeError,
} from "@/lib/errors";

// ─── Library mock (must be hoisted; vi.mock ESM-style) ───────────────────────
// `@imgly/background-removal-node` çağrısı pre-cooked transparent PNG döner.
// Mock fonksiyonu testler arası reset edilir.
vi.mock("@imgly/background-removal-node", () => ({
  removeBackground: vi.fn(),
}));

// Mock'u import et (vi.mock'tan sonra) — implementasyon module'ü de aynı
// path'i import edeceği için aynı vi.fn'ye erişeceğiz.
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal-node";

// Lazy import: implementasyon module'ü mock kurulduktan sonra yüklenmeli.
import { removeBackground } from "@/server/services/selection/edit-ops/background-remove";

let userId: string;
let createdAssetIds: string[] = [];

/**
 * 64x64 düz mavi PNG (alpha kanalsız) → input asset için fixture oluşturur.
 */
async function makePngBuffer(opts: {
  width?: number;
  height?: number;
  alpha?: boolean;
} = {}): Promise<Buffer> {
  const { width = 64, height = 64, alpha = false } = opts;
  return sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha
        ? { r: 0, g: 80, b: 200, alpha: 1 }
        : { r: 0, g: 80, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Pre-cooked transparent PNG (32x32 RGBA, kenarları transparent) — mock output
 * için.
 */
async function makeTransparentPngBuffer(): Promise<Buffer> {
  // 32x32 düz çerçeve içinde transparent kenarlı PNG
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

async function seedAsset(opts: {
  buffer: Buffer;
  mimeType: string;
  sizeBytesOverride?: number;
}): Promise<string> {
  const storage = getStorage();
  const ext =
    opts.mimeType === "image/png"
      ? "png"
      : opts.mimeType === "image/jpeg" || opts.mimeType === "image/jpg"
      ? "jpg"
      : opts.mimeType === "image/webp"
      ? "webp"
      : "bin";
  const storageKey = `phase7-bgremove-test/${userId}/${newId()}.${ext}`;
  const stored = await storage.upload(storageKey, opts.buffer, {
    contentType: opts.mimeType,
  });
  const asset = await db.asset.create({
    data: {
      userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: stored.key,
      bucket: stored.bucket,
      mimeType: opts.mimeType,
      sizeBytes: opts.sizeBytesOverride ?? stored.size,
      hash: `${sha256(opts.buffer)}-${crypto.randomUUID()}`,
    },
  });
  createdAssetIds.push(asset.id);
  return asset.id;
}

async function cleanupTestAssets() {
  if (createdAssetIds.length > 0) {
    await db.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
    createdAssetIds = [];
  }
  // Output asset'leri (selection-edits/.../bg-remove-...png) — userId scope.
  await db.asset.deleteMany({
    where: { userId, storageKey: { startsWith: "selection-edits/" } },
  });
}

beforeAll(async () => {
  await ensureBucket();
  const user = await db.user.upsert({
    where: { email: "phase7-bgremove-op@etsyhub.local" },
    create: {
      email: "phase7-bgremove-op@etsyhub.local",
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
  userId = user.id;
});

beforeEach(async () => {
  await cleanupTestAssets();
  vi.mocked(imglyRemoveBackground).mockReset();
});

afterAll(async () => {
  await cleanupTestAssets();
});

describe("Phase 7 Task 9 — removeBackground (mocked @imgly)", () => {
  it("happy path — PNG input → mock pre-cooked output → yeni transparent PNG Asset oluşur", async () => {
    const inputBuf = await makePngBuffer({ width: 64, height: 64, alpha: false });
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      // Library Blob veya Uint8Array dönebilir; en yaygın Blob — burada Blob
      // fixture'ı simüle ediyoruz. Implementasyon her ikisiyle de çalışmalı.
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });

    const result = await removeBackground({ inputAssetId });

    expect(result.assetId).toBeTruthy();
    const output = await db.asset.findUniqueOrThrow({
      where: { id: result.assetId },
    });
    expect(output.userId).toBe(userId);
    expect(output.mimeType).toBe("image/png");
    expect(output.width).toBe(32);
    expect(output.height).toBe(32);
    expect(output.sizeBytes).toBeGreaterThan(0);
    expect(output.storageKey).toMatch(
      new RegExp(`^selection-edits/${userId}/bg-remove-.+\\.png$`),
    );
    expect(output.bucket).toBe(env.STORAGE_BUCKET);
    expect(output.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("library Uint8Array dönerse de Buffer'a çevirir ve Asset oluşturur", async () => {
    const inputBuf = await makePngBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Uint8Array(outputBuf) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });

    const result = await removeBackground({ inputAssetId });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: result.assetId },
    });
    expect(output.mimeType).toBe("image/png");
    expect(output.width).toBe(32);
  });

  it("JPEG input → mock çağrılır, output transparent PNG", async () => {
    const inputBuf = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 100, g: 100, b: 100 },
      },
    })
      .jpeg()
      .toBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/jpeg",
    });

    const result = await removeBackground({ inputAssetId });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: result.assetId },
    });
    expect(output.mimeType).toBe("image/png");
  });

  it("WebP input → kabul edilir", async () => {
    const inputBuf = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .webp()
      .toBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/webp",
    });

    const result = await removeBackground({ inputAssetId });
    expect(result.assetId).toBeTruthy();
  });

  it("unsupported format (image/gif) → throw UnsupportedFormatError, library çağrılmaz", async () => {
    const inputBuf = await makePngBuffer(); // PNG buffer ama MIME yalan söylenir
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/gif",
    });

    await expect(removeBackground({ inputAssetId })).rejects.toBeInstanceOf(
      UnsupportedFormatError,
    );
    expect(vi.mocked(imglyRemoveBackground)).not.toHaveBeenCalled();
  });

  it("unsupported format (image/svg+xml) → throw UnsupportedFormatError", async () => {
    const inputBuf = Buffer.from("<svg/>", "utf8");
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/svg+xml",
    });

    await expect(removeBackground({ inputAssetId })).rejects.toBeInstanceOf(
      UnsupportedFormatError,
    );
  });

  it("asset >50MB → throw AssetTooLargeError, library çağrılmaz", async () => {
    const inputBuf = await makePngBuffer();
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
      // Storage'taki gerçek size küçük; DB row'una >50MB override
      sizeBytesOverride: 50 * 1024 * 1024 + 1,
    });

    await expect(removeBackground({ inputAssetId })).rejects.toBeInstanceOf(
      AssetTooLargeError,
    );
    expect(vi.mocked(imglyRemoveBackground)).not.toHaveBeenCalled();
  });

  it("asset tam 50MB → kabul edilir (sınır INCLUSIVE 50MB)", async () => {
    const inputBuf = await makePngBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
      sizeBytesOverride: 50 * 1024 * 1024,
    });

    const result = await removeBackground({ inputAssetId });
    expect(result.assetId).toBeTruthy();
  });

  it("library model load fail → hata propagate olur (sessiz fallback yasak)", async () => {
    const inputBuf = await makePngBuffer();
    vi.mocked(imglyRemoveBackground).mockRejectedValueOnce(
      new Error("WASM init failed"),
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });

    await expect(removeBackground({ inputAssetId })).rejects.toThrow(
      /WASM init failed/,
    );
  });

  it("input asset DB'de yok → fail-fast throw", async () => {
    await expect(
      removeBackground({ inputAssetId: "ckxxxxxxxxxxxxxxxxxxxxxxx" }),
    ).rejects.toThrow();
    expect(vi.mocked(imglyRemoveBackground)).not.toHaveBeenCalled();
  });

  it("output Asset hash != input hash (yeni byte stream)", async () => {
    const inputBuf = await makePngBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });
    const inputAsset = await db.asset.findUniqueOrThrow({
      where: { id: inputAssetId },
    });

    const result = await removeBackground({ inputAssetId });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: result.assetId },
    });
    expect(output.hash).not.toBe(inputAsset.hash);
    // Output hash output buffer'ın sha256'sı
    expect(output.hash).toBe(sha256(outputBuf));
  });

  it("library çağrı imzası — input buffer (Buffer veya Uint8Array) geçildi", async () => {
    const inputBuf = await makePngBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });

    await removeBackground({ inputAssetId });

    expect(vi.mocked(imglyRemoveBackground)).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(imglyRemoveBackground).mock.calls[0]![0];
    // Library Buffer | Uint8Array | ArrayBuffer | Blob kabul eder; biz Buffer
    // veya Uint8Array geçiyoruz. Defansif: en azından bir byte-array benzeri.
    const isBufferLike =
      Buffer.isBuffer(callArg) ||
      callArg instanceof Uint8Array ||
      callArg instanceof ArrayBuffer;
    expect(isBufferLike).toBe(true);
  });

  it("output userId input asset'in userId'siyle aynı (isolation)", async () => {
    const inputBuf = await makePngBuffer();
    const outputBuf = await makeTransparentPngBuffer();
    vi.mocked(imglyRemoveBackground).mockResolvedValueOnce(
      new Blob([outputBuf], { type: "image/png" }) as unknown as Blob,
    );
    const inputAssetId = await seedAsset({
      buffer: inputBuf,
      mimeType: "image/png",
    });

    const result = await removeBackground({ inputAssetId });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: result.assetId },
    });
    expect(output.userId).toBe(userId);
  });
});

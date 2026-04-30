// Phase 7 Task 7 — Crop edit-op (Sharp resize + center crop) integration tests.
//
// Sözleşme (src/server/services/selection/edit-ops/crop.ts):
//   cropAsset({ inputAssetId, params: { ratio } }) → { assetId }
//
// Yan etkiler:
//   1) Storage'dan input buffer download
//   2) Sharp ile fit:cover + position:center crop, target ratio
//   3) Storage'a yeni PNG upload (key pattern: selection-edits/{userId}/...png)
//   4) DB'ye yeni Asset row insert (mimeType image/png, width/height, hash)
//
// userId yeni asset için input asset.userId'sinden devralınır (Asset.userId).
//
// Test fixture'ı: tests/fixtures/selection/portrait-2x3.png (600x900 düz mavi).
// Phase 5 asset-service.test.ts paterniyle uyumlu — ensureBucket() çağrısı,
// MinIO live storage; fixture buffer'ı önce gerçek upload edilip Asset row'u
// seed edilir, sonra cropAsset çağrılır.

import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { newId } from "@/lib/id";
import { sha256 } from "@/lib/hash";
import { cropAsset } from "@/server/services/selection/edit-ops/crop";
import type { CropRatio } from "@/server/services/selection/edit-ops/crop";

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/selection/portrait-2x3.png",
);

let userId: string;
let createdAssetIds: string[] = [];

async function seedAssetFromFixture(): Promise<{
  assetId: string;
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const buffer = await fs.readFile(FIXTURE_PATH);
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Fixture metadata eksik");
  }
  const hash = sha256(buffer);
  const storage = getStorage();
  const storageKey = `phase7-crop-test/${userId}/${newId()}.png`;
  const stored = await storage.upload(storageKey, buffer, {
    contentType: "image/png",
  });
  const asset = await db.asset.create({
    data: {
      userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: stored.key,
      bucket: stored.bucket,
      mimeType: "image/png",
      sizeBytes: stored.size,
      width: meta.width,
      height: meta.height,
      hash: `${hash}-${crypto.randomUUID()}`, // Test isolation — her seed unique hash
    },
  });
  createdAssetIds.push(asset.id);
  return { assetId: asset.id, buffer, width: meta.width, height: meta.height };
}

async function cleanupTestAssets() {
  if (createdAssetIds.length === 0) return;
  await db.asset.deleteMany({
    where: { id: { in: createdAssetIds } },
  });
  createdAssetIds = [];
  // Yeni asset'ler de userId üzerinden temizlenir (cropAsset DB'ye output asset
  // ekler — test'in sonunda asset.deleteMany ile temizlenir).
  await db.asset.deleteMany({
    where: { userId, storageKey: { startsWith: "selection-edits/" } },
  });
}

beforeAll(async () => {
  await ensureBucket();
  const user = await db.user.upsert({
    where: { email: "phase7-crop-op@etsyhub.local" },
    create: {
      email: "phase7-crop-op@etsyhub.local",
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
});

afterAll(async () => {
  await cleanupTestAssets();
});

describe("Phase 7 Task 7 — cropAsset (Sharp + center crop)", () => {
  it("2:3 ratio — input 600x900 (zaten 2:3) → output 600x900 (boyut korunur)", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "2:3" },
    });

    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.width).toBe(600);
    expect(output.height).toBe(900);
    expect(output.mimeType).toBe("image/png");
  });

  it("1:1 ratio — input 600x900 → output 600x600 (square center crop)", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "1:1" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.width).toBe(600);
    expect(output.height).toBe(600);
  });

  it("4:5 ratio — input 600x900 → output 600x750 (yükseklik kırpılır)", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "4:5" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.width).toBe(600);
    expect(output.height).toBe(750);
  });

  it("3:4 ratio — input 600x900 → output 600x800", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "3:4" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.width).toBe(600);
    expect(output.height).toBe(800);
  });

  it("output Asset DB'de oluşur — userId aynı, mimeType image/png", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "1:1" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.userId).toBe(userId);
    expect(output.mimeType).toBe("image/png");
    expect(output.width).not.toBeNull();
    expect(output.height).not.toBeNull();
    expect(output.sizeBytes).toBeGreaterThan(0);
  });

  it("storage key pattern selection-edits/{userId}/...png + bucket env'den", async () => {
    const seed = await seedAssetFromFixture();
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "1:1" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.storageKey).toMatch(
      new RegExp(`^selection-edits/${userId}/.+\\.png$`),
    );
    expect(output.bucket).toBe(env.STORAGE_BUCKET);
  });

  it("yeni asset farklı hash — input != output (yeni byte stream)", async () => {
    const seed = await seedAssetFromFixture();
    const inputAsset = await db.asset.findUniqueOrThrow({
      where: { id: seed.assetId },
    });
    const { assetId: outputId } = await cropAsset({
      inputAssetId: seed.assetId,
      params: { ratio: "1:1" },
    });
    const output = await db.asset.findUniqueOrThrow({
      where: { id: outputId },
    });
    expect(output.hash).not.toBe(inputAsset.hash);
    expect(output.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("invalid ratio (runtime defense) — throw", async () => {
    const seed = await seedAssetFromFixture();
    await expect(
      cropAsset({
        inputAssetId: seed.assetId,
        params: { ratio: "5:7" as CropRatio },
      }),
    ).rejects.toThrow();
  });

  it("input asset storage'da yoksa throw (fail-fast)", async () => {
    // Asset row var ama storage'da yok — orphaned row test'i
    const orphanAsset = await db.asset.create({
      data: {
        userId,
        storageProvider: env.STORAGE_PROVIDER,
        storageKey: `phase7-crop-orphan/${userId}/${newId()}.png`,
        bucket: env.STORAGE_BUCKET,
        mimeType: "image/png",
        sizeBytes: 1,
        hash: `orphan-${crypto.randomUUID()}`,
      },
    });
    createdAssetIds.push(orphanAsset.id);

    await expect(
      cropAsset({
        inputAssetId: orphanAsset.id,
        params: { ratio: "2:3" },
      }),
    ).rejects.toThrow();
  });
});

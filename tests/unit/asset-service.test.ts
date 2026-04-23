import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { ensureBucket } from "@/providers/storage/init";
import { db } from "@/server/db";

async function makePngBuffer(width = 8, height = 8, r = 200, g = 100, b = 50) {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

describe("asset-service", () => {
  let userId: string;

  beforeAll(async () => {
    await ensureBucket();
    const user = await db.user.upsert({
      where: { email: "asset-test@etsyhub.local" },
      create: {
        email: "asset-test@etsyhub.local",
        passwordHash: await bcrypt.hash("password-test", 10),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      update: {},
    });
    userId = user.id;
  });

  it("aynı buffer'ı iki kez koymak aynı asset döner (sha256 dedupe)", async () => {
    const buf = await makePngBuffer();
    const a = await createAssetFromBuffer({
      userId,
      buffer: buf,
      mimeType: "image/png",
    });
    const b = await createAssetFromBuffer({
      userId,
      buffer: buf,
      mimeType: "image/png",
    });
    expect(a.id).toBe(b.id);
  });

  it("Sharp metadata (width/height) doğru yazılır", async () => {
    const buf = await makePngBuffer(32, 16, 10, 20, 30);
    const asset = await createAssetFromBuffer({
      userId,
      buffer: buf,
      mimeType: "image/png",
    });
    expect(asset.width).toBe(32);
    expect(asset.height).toBe(16);
  });

  it("desteklenmeyen mimeType ValidationError fırlatır", async () => {
    const buf = Buffer.from("not-an-image");
    await expect(
      createAssetFromBuffer({
        userId,
        buffer: buf,
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(/Desteklenmeyen/);
  });

  it("25MB üstü buffer ValidationError fırlatır", async () => {
    const bigBuffer = Buffer.alloc(26 * 1024 * 1024);
    await expect(
      createAssetFromBuffer({
        userId,
        buffer: bigBuffer,
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/çok büyük/);
  });
});

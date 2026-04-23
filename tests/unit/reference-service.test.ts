import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { BookmarkStatus, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ensureBucket } from "@/providers/storage/init";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { createBookmark } from "@/features/bookmarks/services/bookmark-service";
import {
  createReference,
  createReferenceFromBookmark,
  getReference,
  listReferences,
  softDeleteReference,
  updateReference,
} from "@/features/references/services/reference-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

async function makePng(width = 8, height = 8) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 50 + width, g: 80, b: 150 },
    },
  })
    .png()
    .toBuffer();
}

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

describe("reference-service", () => {
  let userA: string;
  let userB: string;
  let productTypeId: string;

  beforeAll(async () => {
    await ensureBucket();
    const a = await ensureUser("ref-a@etsyhub.local");
    const b = await ensureUser("ref-b@etsyhub.local");
    userA = a.id;
    userB = b.id;

    const pt = await db.productType.findFirst();
    if (!pt) {
      throw new Error("Seed çalıştırılmalı; productType bulunamadı");
    }
    productTypeId = pt.id;

    await db.reference.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  it("createReference asset + productType ile çalışır", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(12, 12),
      mimeType: "image/png",
    });
    const ref = await createReference({
      userId: userA,
      input: { assetId: asset.id, productTypeId, notes: "Test referans" },
    });
    expect(ref.userId).toBe(userA);
    expect(ref.assetId).toBe(asset.id);
    expect(ref.productTypeId).toBe(productTypeId);
  });

  it("userB, userA'nın asset'iyle referans oluşturamaz", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(13, 13),
      mimeType: "image/png",
    });
    await expect(
      createReference({
        userId: userB,
        input: { assetId: asset.id, productTypeId },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("listReferences sadece sahibi görebilir (data isolation)", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(14, 14),
      mimeType: "image/png",
    });
    const ref = await createReference({
      userId: userA,
      input: { assetId: asset.id, productTypeId, notes: "SadeceA-ref" },
    });
    const { items } = await listReferences({
      userId: userB,
      query: { limit: 50 },
    });
    expect(items.some((i) => i.id === ref.id)).toBe(false);
    expect(items.every((i) => i.userId === userB)).toBe(true);
  });

  it("getReference başka kullanıcı için ForbiddenError", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(15, 15),
      mimeType: "image/png",
    });
    const ref = await createReference({
      userId: userA,
      input: { assetId: asset.id, productTypeId },
    });
    await expect(
      getReference({ userId: userB, id: ref.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updateReference notları günceller, başka kullanıcı ForbiddenError", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(16, 16),
      mimeType: "image/png",
    });
    const ref = await createReference({
      userId: userA,
      input: { assetId: asset.id, productTypeId, notes: "eski" },
    });
    const updated = await updateReference({
      userId: userA,
      id: ref.id,
      input: { notes: "yeni" },
    });
    expect(updated.notes).toBe("yeni");

    await expect(
      updateReference({
        userId: userB,
        id: ref.id,
        input: { notes: "hack" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("softDeleteReference deletedAt atar, getReference sonrasında NotFound", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(17, 17),
      mimeType: "image/png",
    });
    const ref = await createReference({
      userId: userA,
      input: { assetId: asset.id, productTypeId },
    });
    const deleted = await softDeleteReference({ userId: userA, id: ref.id });
    expect(deleted.deletedAt).not.toBeNull();
    await expect(
      getReference({ userId: userA, id: ref.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("createReferenceFromBookmark bookmark'ı REFERENCED yapar", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(18, 18),
      mimeType: "image/png",
    });
    const bm = await createBookmark({
      userId: userA,
      input: {
        title: "PromoTest",
        assetId: asset.id,
      },
    });
    const ref = await createReferenceFromBookmark({
      userId: userA,
      input: { bookmarkId: bm.id, productTypeId },
    });
    expect(ref.bookmarkId).toBe(bm.id);
    const after = await db.bookmark.findUnique({ where: { id: bm.id } });
    expect(after?.status).toBe(BookmarkStatus.REFERENCED);
  });

  it("createReferenceFromBookmark asset yoksa ValidationError", async () => {
    const bm = await createBookmark({
      userId: userA,
      input: { title: "NoAsset" },
    });
    await expect(
      createReferenceFromBookmark({
        userId: userA,
        input: { bookmarkId: bm.id, productTypeId },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("createReferenceFromBookmark başka kullanıcı için ForbiddenError", async () => {
    const asset = await createAssetFromBuffer({
      userId: userA,
      buffer: await makePng(19, 19),
      mimeType: "image/png",
    });
    const bm = await createBookmark({
      userId: userA,
      input: { title: "Foreign", assetId: asset.id },
    });
    await expect(
      createReferenceFromBookmark({
        userId: userB,
        input: { bookmarkId: bm.id, productTypeId },
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

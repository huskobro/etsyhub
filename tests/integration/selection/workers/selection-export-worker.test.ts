// Phase 7 Task 12 — selection-export worker (EXPORT_SELECTION_SET) integration tests.
//
// Test sözleşmesi (plan Task 12, design Section 6.5):
//
//   Worker (`handleSelectionExport`):
//     - Payload validate (zod) → cross-user payload reddedilir
//     - requireSetOwnership (cross-user → NotFoundError)
//     - Boş set → "Boş set export edilemez" throw, lastExportedAt değişmez
//     - Asset stream-download → ZIP build (Task 11 reuse) → storage upload
//     - storageKey: exports/{userId}/{setId}/{jobId}.zip
//     - DB update: lastExportedAt = now (YALNIZ completed anında)
//     - Failure path:
//         * lastExportedAt değişmez (set metadata kirlenmez)
//         * Partial upload cleanup (storage.upload fail veya post-upload error)
//         * Re-throw → BullMQ FAILED state
//
// Test stratejisi:
//   - Worker handler doğrudan test edilir (queue üzerinden değil — Phase 6
//     emsali aynısı).
//   - Storage gerçek (MinIO local) — ZIP gerçekten upload/download edilebilir.
//   - Test sonrası storage cleanup zorunlu (orphan ZIP bırakma).
//   - Manifest contract gerçekten `ManifestV1Schema` ile parse edilir.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import crypto from "node:crypto";
import unzipper from "adm-zip";
import type { Job } from "bullmq";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { newId } from "@/lib/id";
import { sha256 } from "@/lib/hash";
import { NotFoundError } from "@/lib/errors";
import { ManifestV1Schema } from "@/contracts/manifest-v1.schema";
import { createSet } from "@/server/services/selection/sets.service";
import { addItems } from "@/server/services/selection/items.service";
import {
  handleSelectionExport,
  type ExportSelectionSetJobPayload,
} from "@/server/workers/selection-export.worker";

const PRODUCT_TYPE_KEY = "phase7-w12-pt";
const REFERENCE_ID_PREFIX = "phase7-w12-ref";

let userAId: string;
let userBId: string;
let createdAssetIds: string[] = [];
let createdStorageKeys: string[] = [];

// ────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────

async function makePngBuffer(opts: {
  width?: number;
  height?: number;
  rgb?: { r: number; g: number; b: number };
} = {}): Promise<Buffer> {
  const { width = 32, height = 32, rgb = { r: 0, g: 80, b: 200 } } = opts;
  return sharp({
    create: { width, height, channels: 3, background: rgb },
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

async function ensureBase(userId: string, tag: string) {
  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 W12 Wall Art",
      isSystem: false,
    },
  });

  const refAssetId = `${REFERENCE_ID_PREFIX}-asset-${userId}-${tag}`;
  const refAsset = await db.asset.upsert({
    where: { id: refAssetId },
    update: {},
    create: {
      id: refAssetId,
      userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: `phase7-w12/${userId}/${tag}-ref.png`,
      bucket: env.STORAGE_BUCKET,
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-w12-refhash-${userId}-${tag}`,
    },
  });
  createdAssetIds.push(refAsset.id);

  const referenceId = `${REFERENCE_ID_PREFIX}-${userId}-${tag}`;
  const reference = await db.reference.upsert({
    where: { id: referenceId },
    update: {},
    create: {
      id: referenceId,
      userId,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  return { productType, reference };
}

async function seedAssetWithBuffer(args: {
  userId: string;
  tag: string;
  buffer: Buffer;
  width: number;
  height: number;
}): Promise<string> {
  const storage = getStorage();
  const storageKey = `phase7-w12-test/${args.userId}/${args.tag}-${newId()}.png`;
  const stored = await storage.upload(storageKey, args.buffer, {
    contentType: "image/png",
  });
  createdStorageKeys.push(stored.key);
  const asset = await db.asset.create({
    data: {
      userId: args.userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: stored.key,
      bucket: stored.bucket,
      mimeType: "image/png",
      sizeBytes: stored.size,
      width: args.width,
      height: args.height,
      hash: `${sha256(args.buffer)}-${crypto.randomUUID()}`,
    },
  });
  createdAssetIds.push(asset.id);
  return asset.id;
}

async function createDesignWithAsset(args: {
  userId: string;
  productTypeId: string;
  referenceId: string;
  tag: string;
}) {
  const buf = await makePngBuffer({
    width: 24,
    height: 24,
    rgb: { r: Math.floor(Math.random() * 200), g: 100, b: 100 },
  });
  const assetId = await seedAssetWithBuffer({
    userId: args.userId,
    tag: `design-${args.tag}`,
    buffer: buf,
    width: 24,
    height: 24,
  });
  const design = await db.generatedDesign.create({
    data: {
      userId: args.userId,
      referenceId: args.referenceId,
      assetId,
      productTypeId: args.productTypeId,
    },
  });
  return { assetId, designId: design.id };
}

async function createEditedAsset(userId: string, tag: string): Promise<string> {
  const buf = await makePngBuffer({
    width: 28,
    height: 28,
    rgb: { r: 30, g: 200, b: 30 },
  });
  return seedAssetWithBuffer({
    userId,
    tag: `edited-${tag}`,
    buffer: buf,
    width: 28,
    height: 28,
  });
}

function makeJob(
  payload: ExportSelectionSetJobPayload,
  jobId = "w12-job-1",
): Job<ExportSelectionSetJobPayload> {
  return { id: jobId, data: payload } as unknown as Job<ExportSelectionSetJobPayload>;
}

async function cleanupAll() {
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  if (createdAssetIds.length > 0) {
    await db.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
    createdAssetIds = [];
  }
  // Storage cleanup — orphan ZIP'leri ve test asset'lerini sil.
  const storage = getStorage();
  for (const key of createdStorageKeys) {
    await storage.delete(key).catch(() => {});
  }
  createdStorageKeys = [];
  // Worker'ın yaratabildiği export key'leri (test sırasında DB'de yer almayabilir)
  for (const userId of [userAId, userBId].filter(Boolean)) {
    // Liste API'si yok; bilinen pattern'lere göre cleanup yapamıyoruz —
    // testte storage key'leri trackleniyor (createdStorageKeys'e push'lanır).
    void userId;
  }
}

// ────────────────────────────────────────────────────────────
// Suite setup
// ────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureBucket();
  const a = await ensureUser("phase7-w12-a@etsyhub.local");
  const b = await ensureUser("phase7-w12-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupAll();
});

afterAll(async () => {
  await cleanupAll();
});

// ────────────────────────────────────────────────────────────
// Happy path
// ────────────────────────────────────────────────────────────

describe("handleSelectionExport — happy path", () => {
  it(
    "set + 2 item (1 source-only + 1 edited) → ZIP storage'da, manifest valid, lastExportedAt güncellenir",
    async () => {
      const { productType, reference } = await ensureBase(userAId, "happy");
      const set = await createSet({ userId: userAId, name: "ExportHappy" });

      const d1 = await createDesignWithAsset({
        userId: userAId,
        productTypeId: productType.id,
        referenceId: reference.id,
        tag: "h1",
      });
      const d2 = await createDesignWithAsset({
        userId: userAId,
        productTypeId: productType.id,
        referenceId: reference.id,
        tag: "h2",
      });

      const items = await addItems({
        userId: userAId,
        setId: set.id,
        items: [
          { generatedDesignId: d1.designId },
          { generatedDesignId: d2.designId },
        ],
      });

      // Item 2'ye edit ekle (editedAssetId set et — originals klasörü test edilecek)
      const editedAssetId = await createEditedAsset(userAId, "h2-edit");
      await db.selectionItem.update({
        where: { id: items[1]!.id },
        data: { editedAssetId },
      });

      const beforeSet = await db.selectionSet.findUniqueOrThrow({
        where: { id: set.id },
      });
      expect(beforeSet.lastExportedAt).toBeNull();

      const jobId = "w12-job-happy";
      const result = await handleSelectionExport(
        makeJob(
          { userId: userAId, setId: set.id },
          jobId,
        ),
      );

      // Storage key pattern: exports/{userId}/{setId}/{jobId}.zip
      const expectedKey = `exports/${userAId}/${set.id}/${jobId}.zip`;
      expect(result.storageKey).toBe(expectedKey);
      expect(result.jobId).toBe(jobId);
      createdStorageKeys.push(expectedKey);

      // ZIP gerçekten storage'da var
      const storage = getStorage();
      const zipBuf = await storage.download(expectedKey);
      expect(zipBuf.length).toBeGreaterThan(0);

      // ZIP içeriğini incele
      const zip = new unzipper(zipBuf);
      const entries = zip.getEntries();
      const entryNames = entries.map((e) => e.entryName).sort();

      // Beklenen dosyalar:
      //   manifest.json, README.txt, images/var-001.png, images/var-002.png,
      //   originals/var-002.png (item 2 edited)
      expect(entryNames).toContain("manifest.json");
      expect(entryNames).toContain("README.txt");
      expect(entryNames).toContain("images/var-001.png");
      expect(entryNames).toContain("images/var-002.png");
      expect(entryNames).toContain("originals/var-002.png");
      // Item 1 source-only — originals/var-001.png yok
      expect(entryNames).not.toContain("originals/var-001.png");

      // Manifest contract validation
      const manifestEntry = entries.find((e) => e.entryName === "manifest.json")!;
      const manifestJson = JSON.parse(manifestEntry.getData().toString("utf-8"));
      const parsed = ManifestV1Schema.safeParse(manifestJson);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.schemaVersion).toBe("1");
        expect(parsed.data.set.id).toBe(set.id);
        expect(parsed.data.exportedBy.userId).toBe(userAId);
        expect(parsed.data.items).toHaveLength(2);
        expect(parsed.data.items[0]!.filename).toBe("images/var-001.png");
        expect(parsed.data.items[1]!.filename).toBe("images/var-002.png");
        expect(parsed.data.items[1]!.originalFilename).toBe(
          "originals/var-002.png",
        );
      }

      // images/var-001.png buffer = source asset (item 1, edit yok)
      const img1 = entries
        .find((e) => e.entryName === "images/var-001.png")!
        .getData();
      const sourceBuf = await storage.download(
        (await db.asset.findUniqueOrThrow({ where: { id: d1.assetId } })).storageKey,
      );
      expect(Buffer.compare(img1, sourceBuf)).toBe(0);

      // images/var-002.png buffer = edited asset (item 2)
      const img2 = entries
        .find((e) => e.entryName === "images/var-002.png")!
        .getData();
      const editedBuf = await storage.download(
        (await db.asset.findUniqueOrThrow({ where: { id: editedAssetId } }))
          .storageKey,
      );
      expect(Buffer.compare(img2, editedBuf)).toBe(0);

      // originals/var-002.png buffer = source asset (item 2 source)
      const orig2 = entries
        .find((e) => e.entryName === "originals/var-002.png")!
        .getData();
      const item2SourceBuf = await storage.download(
        (await db.asset.findUniqueOrThrow({ where: { id: d2.assetId } })).storageKey,
      );
      expect(Buffer.compare(orig2, item2SourceBuf)).toBe(0);

      // DB: lastExportedAt güncellendi
      const afterSet = await db.selectionSet.findUniqueOrThrow({
        where: { id: set.id },
      });
      expect(afterSet.lastExportedAt).not.toBeNull();
      expect(afterSet.lastExportedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeSet.createdAt.getTime(),
      );
      // Status değişmedi
      expect(afterSet.status).toBe("draft");
    },
    30000,
  );
});

// ────────────────────────────────────────────────────────────
// Guards
// ────────────────────────────────────────────────────────────

describe("handleSelectionExport — guards", () => {
  it("boş set → throw 'Boş set export edilemez', lastExportedAt değişmez", async () => {
    const set = await createSet({ userId: userAId, name: "Empty" });

    await expect(
      handleSelectionExport(
        makeJob({ userId: userAId, setId: set.id }, "w12-job-empty"),
      ),
    ).rejects.toThrow(/Boş set/);

    const after = await db.selectionSet.findUniqueOrThrow({
      where: { id: set.id },
    });
    expect(after.lastExportedAt).toBeNull();
  });

  it("cross-user payload (userId set sahibi değil) → NotFoundError, set dokunulmaz", async () => {
    const { productType, reference } = await ensureBase(userAId, "cross");
    const set = await createSet({ userId: userAId, name: "CrossExport" });
    const d1 = await createDesignWithAsset({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "x1",
    });
    await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.designId }],
    });

    await expect(
      handleSelectionExport(
        makeJob({ userId: userBId, setId: set.id }, "w12-job-cross"),
      ),
    ).rejects.toThrow(NotFoundError);

    const after = await db.selectionSet.findUniqueOrThrow({
      where: { id: set.id },
    });
    expect(after.lastExportedAt).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// Failure path
// ────────────────────────────────────────────────────────────

describe("handleSelectionExport — failure path", () => {
  it(
    "storage.upload mid-pipeline fail → throw propagate, lastExportedAt değişmez",
    async () => {
      const { productType, reference } = await ensureBase(userAId, "fail");
      const set = await createSet({ userId: userAId, name: "FailExport" });
      const d1 = await createDesignWithAsset({
        userId: userAId,
        productTypeId: productType.id,
        referenceId: reference.id,
        tag: "f1",
      });
      await addItems({
        userId: userAId,
        setId: set.id,
        items: [{ generatedDesignId: d1.designId }],
      });

      // getStorage'i singleton — upload spy ekleyip reject et
      const storage = getStorage();
      const uploadSpy = vi.spyOn(storage, "upload").mockImplementation(
        async (key: string, body: Buffer, meta: { contentType: string }) => {
          // Yalnız ZIP upload (key "exports/" ile başlar) için fail; diğer
          // upload'lar (örn. seed asset) gerçek davranışla geçsin.
          if (key.startsWith("exports/")) {
            throw new Error("Storage upload reddedildi (test mock)");
          }
          // Gerçek implementasyona delege et
          return uploadSpy.getMockImplementation()
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((storage as any).constructor.prototype.upload.call(
                storage,
                key,
                body,
                meta,
              ) as Promise<{ key: string; bucket: string; size: number }>)
            : { key, bucket: env.STORAGE_BUCKET, size: body.length };
        },
      );

      try {
        await expect(
          handleSelectionExport(
            makeJob({ userId: userAId, setId: set.id }, "w12-job-fail"),
          ),
        ).rejects.toThrow(/Storage upload reddedildi/);
      } finally {
        uploadSpy.mockRestore();
      }

      const after = await db.selectionSet.findUniqueOrThrow({
        where: { id: set.id },
      });
      expect(after.lastExportedAt).toBeNull();
    },
    30000,
  );
});

// ────────────────────────────────────────────────────────────
// Storage key format
// ────────────────────────────────────────────────────────────

describe("handleSelectionExport — storage key format", () => {
  it("storageKey pattern: exports/{userId}/{setId}/{jobId}.zip", async () => {
    const { productType, reference } = await ensureBase(userAId, "skf");
    const set = await createSet({ userId: userAId, name: "KeyFmt" });
    const d1 = await createDesignWithAsset({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "skf1",
    });
    await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.designId }],
    });

    const result = await handleSelectionExport(
      makeJob({ userId: userAId, setId: set.id }, "w12-key-job"),
    );
    expect(result.storageKey).toBe(`exports/${userAId}/${set.id}/w12-key-job.zip`);
    createdStorageKeys.push(result.storageKey);
  }, 30000);
});

// Phase 7 Task 15 — quickStartFromBatch service integration testleri.
//
// Sözleşmeler (design Section 2.1, 4.1; plan Task 15):
//   - quickStartFromBatch({ userId, referenceId, batchId, productTypeId }):
//       1. Reference ownership doğrulama → cross-user / yok → NotFoundError
//       2. ProductType doğrulama → yok → NotFoundError
//       3. Job (batch) ownership + type=GENERATE_VARIATIONS doğrulama →
//          cross-user / yok / yanlış type → NotFoundError ("variation batch")
//       4. Batch'in design'larını (createdAt asc) fetch
//       5. Boş batch → reject (uyarısız set kötü UX)
//       6. Auto-name: `{Reference.notes veya productType.displayName} — {DD MMM YYYY}` (Türkçe ay)
//          Reference.notes opsiyonel; yoksa productType.displayName fallback;
//          o da yoksa productType.key. Türkçe ay hard-coded array (locale-independent).
//       7. SelectionSet create:
//          { name, status: draft, sourceMetadata: { kind: "variation-batch",
//            referenceId, batchId, productTypeId, batchCreatedAt: ISO,
//            originalCount } }
//       8. SelectionItem create per design:
//          { generatedDesignId, sourceAssetId: design.assetId, status: pending,
//            position: idx (createdAt asc) }
//       9. Atomic transaction — herhangi bir adım throw → rollback (set+items
//          birlikte ya hep ya hiç).
//
// Fixture stratejisi: Phase 6 + sets.service.test.ts paterniyle. 2 user
// (A, B). beforeEach: SelectionItem → SelectionSet → GeneratedDesign →
// Job → Reference → Asset cleanup (FK order).

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { JobStatus, JobType, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { quickStartFromBatch } from "@/server/services/selection/sets.service";

const PRODUCT_TYPE_KEY = "phase7-qs-pt";
const PRODUCT_TYPE_DISPLAY = "Wall Art";
const PRODUCT_TYPE_KEY_NO_DISPLAY = "phase7-qs-pt-keyonly";

let userAId: string;
let userBId: string;
let productTypeId: string;
let productTypeKeyOnlyId: string;

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

type SeedBatchOptions = {
  userId: string;
  productTypeId?: string;
  designCount?: number;
  jobType?: JobType;
  referenceNotes?: string | null;
  suffix?: string;
};

type SeededBatch = {
  referenceId: string;
  batchId: string;
  productTypeId: string;
  designs: Array<{ id: string; assetId: string; createdAt: Date }>;
};

async function seedBatch(opts: SeedBatchOptions): Promise<SeededBatch> {
  const suffix = opts.suffix ?? `${Date.now()}-${Math.random()}`;
  const ptId = opts.productTypeId ?? productTypeId;

  const refAsset = await db.asset.create({
    data: {
      userId: opts.userId,
      storageProvider: "local",
      storageKey: `phase7-qs/ref-${suffix}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-qs-ref-${suffix}`,
    },
  });

  const reference = await db.reference.create({
    data: {
      userId: opts.userId,
      assetId: refAsset.id,
      productTypeId: ptId,
      notes: opts.referenceNotes ?? null,
    },
  });

  const job = await db.job.create({
    data: {
      type: opts.jobType ?? JobType.GENERATE_VARIATIONS,
      status: JobStatus.SUCCESS,
      userId: opts.userId,
      progress: 100,
    },
  });

  const designCount = opts.designCount ?? 0;
  const designs: Array<{ id: string; assetId: string; createdAt: Date }> = [];
  for (let i = 0; i < designCount; i++) {
    const designAsset = await db.asset.create({
      data: {
        userId: opts.userId,
        storageProvider: "local",
        storageKey: `phase7-qs/design-${suffix}-${i}.png`,
        bucket: "test",
        mimeType: "image/png",
        sizeBytes: 1,
        hash: `phase7-qs-design-${suffix}-${i}`,
      },
    });
    const design = await db.generatedDesign.create({
      data: {
        userId: opts.userId,
        referenceId: reference.id,
        assetId: designAsset.id,
        productTypeId: ptId,
        jobId: job.id,
      },
    });
    designs.push({
      id: design.id,
      assetId: designAsset.id,
      createdAt: design.createdAt,
    });
    // createdAt determinizmi için minik gap
    await new Promise((r) => setTimeout(r, 5));
  }

  return {
    referenceId: reference.id,
    batchId: job.id,
    productTypeId: ptId,
    designs,
  };
}

async function cleanup() {
  // FK order: SelectionItem → SelectionSet → GeneratedDesign → Reference →
  // Job → Asset.
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.job.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: userIds } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-qs-a@etsyhub.local");
  const b = await ensureUser("phase7-qs-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: PRODUCT_TYPE_DISPLAY,
      isSystem: false,
    },
  });
  productTypeId = pt.id;

  const ptKeyOnly = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY_NO_DISPLAY },
    update: {},
    // displayName non-null zorunlu — test'lerde notes/displayName fallback
    // ayrımını test etmek için key'i displayName olarak da set et:
    create: {
      key: PRODUCT_TYPE_KEY_NO_DISPLAY,
      displayName: PRODUCT_TYPE_KEY_NO_DISPLAY,
      isSystem: false,
    },
  });
  productTypeKeyOnlyId = ptKeyOnly.id;
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function expectedDatePart(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mon = TR_MONTHS_SHORT[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd} ${mon} ${yyyy}`;
}

describe("Phase 7 sets.service — quickStartFromBatch", () => {
  it("auto-name pattern: Reference.notes + DD MMM YYYY (Türkçe ay)", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "Boho Sunset",
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    const datePart = expectedDatePart(result.set.createdAt);
    expect(result.set.name).toBe(`Boho Sunset — ${datePart}`);
  });

  it("auto-name fallback: Reference.notes yok → productType.displayName", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: null,
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    const datePart = expectedDatePart(result.set.createdAt);
    expect(result.set.name).toBe(`${PRODUCT_TYPE_DISPLAY} — ${datePart}`);
  });

  it("auto-name fallback: notes whitespace-only → productType.displayName", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "   ",
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    const datePart = expectedDatePart(result.set.createdAt);
    expect(result.set.name).toBe(`${PRODUCT_TYPE_DISPLAY} — ${datePart}`);
  });

  it("boş batch → reject; set ve items yaratılmaz (atomic)", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 0,
    });

    const setsBefore = await db.selectionSet.count({ where: { userId: userAId } });
    const itemsBefore = await db.selectionItem.count({
      where: { selectionSet: { userId: userAId } },
    });

    await expect(
      quickStartFromBatch({
        userId: userAId,
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId: seeded.productTypeId,
      }),
    ).rejects.toThrow();

    const setsAfter = await db.selectionSet.count({ where: { userId: userAId } });
    const itemsAfter = await db.selectionItem.count({
      where: { selectionSet: { userId: userAId } },
    });
    expect(setsAfter).toBe(setsBefore);
    expect(itemsAfter).toBe(itemsBefore);
  });

  it("cross-user reference → NotFoundError; User B'ye set yaratılmaz", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "Cross-user A",
    });

    const setsBefore = await db.selectionSet.count({
      where: { userId: userBId },
    });

    await expect(
      quickStartFromBatch({
        userId: userBId,
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId: seeded.productTypeId,
      }),
    ).rejects.toThrow(NotFoundError);

    const setsAfter = await db.selectionSet.count({
      where: { userId: userBId },
    });
    expect(setsAfter).toBe(setsBefore);
  });

  it("cross-user batch (job userId User A, request userId User B) → NotFoundError", async () => {
    // User B has its own reference (so reference ownership passes for B)
    const userBSeed = await seedBatch({
      userId: userBId,
      designCount: 1,
      referenceNotes: "B's ref",
    });
    // User A'nın batch'i
    const userASeed = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "A's ref",
    });

    await expect(
      quickStartFromBatch({
        userId: userBId,
        referenceId: userBSeed.referenceId,
        batchId: userASeed.batchId, // B'ye ait değil
        productTypeId: productTypeId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("yanlış job type (REVIEW_DESIGN) → NotFoundError", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 0,
      jobType: JobType.REVIEW_DESIGN,
      referenceNotes: "Wrong type",
    });

    await expect(
      quickStartFromBatch({
        userId: userAId,
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId: seeded.productTypeId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("olmayan productTypeId → NotFoundError", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "Bad PT",
    });

    await expect(
      quickStartFromBatch({
        userId: userAId,
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId: "phase7-qs-nonexistent-pt",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("sourceMetadata fields doğru: kind, ids, batchCreatedAt ISO, originalCount", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 3,
      referenceNotes: "Meta Test",
    });
    const job = await db.job.findUniqueOrThrow({ where: { id: seeded.batchId } });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    expect(result.set.sourceMetadata).toMatchObject({
      kind: "variation-batch",
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
      batchCreatedAt: job.createdAt.toISOString(),
      originalCount: 3,
    });
  });

  it("items default `pending` status", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "Pending Status",
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item.status).toBe("pending");
    }
  });

  it("items position deterministic: createdAt asc → position 0..N", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 3,
      referenceNotes: "Position Order",
    });
    // seeded.designs zaten createdAt asc sıralı (insertion order)
    const expectedDesignIds = seeded.designs.map((d) => d.id);

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    expect(result.items).toHaveLength(3);
    // position asc sıralı
    const sorted = [...result.items].sort((a, b) => a.position - b.position);
    expect(sorted.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(sorted.map((i) => i.generatedDesignId)).toEqual(expectedDesignIds);
  });

  it("items sourceAssetId design.assetId'den gelir (immutable kaynak)", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "SourceAsset",
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    const itemsByDesign = new Map(
      result.items.map((i) => [i.generatedDesignId, i]),
    );
    for (const seedDesign of seeded.designs) {
      const item = itemsByDesign.get(seedDesign.id);
      expect(item).toBeDefined();
      expect(item!.sourceAssetId).toBe(seedDesign.assetId);
      expect(item!.editedAssetId).toBeNull();
    }
  });

  it("set status default `draft` + items doğru sayıda", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 4,
      referenceNotes: "Draft Default",
    });

    const result = await quickStartFromBatch({
      userId: userAId,
      referenceId: seeded.referenceId,
      batchId: seeded.batchId,
      productTypeId: seeded.productTypeId,
    });

    expect(result.set.status).toBe("draft");
    expect(result.set.userId).toBe(userAId);
    expect(result.items).toHaveLength(4);
    // Tüm itemlar bu set'e bağlı
    for (const item of result.items) {
      expect(item.selectionSetId).toBe(result.set.id);
    }
  });
});

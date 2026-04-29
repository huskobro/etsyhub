// Phase 6 Task 9 — GENERATE_VARIATIONS auto-enqueue REVIEW_DESIGN testleri.
//
// Sözleşme (kullanıcı kararı 2):
//   - Her başarılı GeneratedDesign SUCCESS state'ine geçtikten sonra worker
//     `enqueue(JobType.REVIEW_DESIGN, ...)` çağırır.
//   - Enqueue hatası variation generation SUCCESS'ini geri ALMAZ
//     (cross-job rollback YASAK).
//   - logger.error(...) ile fail durumu kaydedilir, worker throw etmez.
//
// Test'in mevcut Phase 5 generate-variations-worker.test.ts fixture pattern'ı
// ile birebir uyumlu kalması, regression safety için önemli.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { JobStatus, JobType, VariationCapability, VariationState } from "@prisma/client";
import type { Job } from "bullmq";

const generateMock = vi.fn();
const pollMock = vi.fn();
vi.mock("@/providers/image/registry", () => ({
  getImageProvider: () => ({
    id: "kie-gpt-image-1.5",
    capabilities: ["image-to-image"],
    generate: (...args: unknown[]) => generateMock(...args),
    poll: (...args: unknown[]) => pollMock(...args),
  }),
}));

// enqueue helper'ını mock'la — gerçek BullMQ/Redis ayağa kalkmasın.
const enqueueMock = vi.fn();
vi.mock("@/server/queue", async () => {
  const actual = await vi.importActual<typeof import("@/server/queue")>(
    "@/server/queue",
  );
  return {
    ...actual,
    enqueue: (...args: unknown[]) => enqueueMock(...args),
  };
});

import { handleGenerateVariations } from "@/server/workers/generate-variations.worker";

const USER_ID = "gv-auto-review-user";

type SeedResult = {
  designId: string;
  jobId: string;
};

async function seedDesignAndJob(opts?: {
  jobIdSuffix?: string;
}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "gv-auto@test.local", passwordHash: "x" },
  });

  const productTypeKey = "gv-auto-canvas";
  const productType = await db.productType.upsert({
    where: { key: productTypeKey },
    update: {},
    create: {
      key: productTypeKey,
      displayName: "GV Auto Canvas",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `gv-auto/ref-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `gv-auto-ref-${Date.now()}-${Math.random()}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `gv-auto/design-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `gv-auto-design-${Date.now()}-${Math.random()}`,
    },
  });

  const reference = await db.reference.create({
    data: {
      userId: USER_ID,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  const design = await db.generatedDesign.create({
    data: {
      userId: USER_ID,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId: productType.id,
      providerId: "kie-gpt-image-1.5",
      capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
      promptSnapshot: "wall art",
      briefSnapshot: null,
      state: VariationState.QUEUED,
    },
  });

  const jobId = `gv-auto-job-${opts?.jobIdSuffix ?? design.id}`;
  await db.job.create({
    data: {
      id: jobId,
      type: JobType.GENERATE_VARIATIONS,
      status: JobStatus.QUEUED,
      userId: USER_ID,
      metadata: { designId: design.id },
      progress: 0,
    },
  });

  return { designId: design.id, jobId };
}

function makeFakeJob(designId: string, jobId: string): Job {
  return {
    id: jobId,
    data: {
      jobId,
      userId: USER_ID,
      designId,
      providerId: "kie-gpt-image-1.5",
      prompt: "wall art",
      referenceUrls: ["https://example.com/a.jpg"],
      aspectRatio: "2:3",
      quality: "medium",
      // Phase 5 closeout hotfix: per-user kieApiKey payload field.
      kieApiKey: "test-key",
    },
  } as unknown as Job;
}

const realSetTimeout = global.setTimeout;
type AnyFn = (...args: unknown[]) => unknown;
beforeEach(async () => {
  generateMock.mockReset();
  pollMock.mockReset();
  enqueueMock.mockReset();
  enqueueMock.mockResolvedValue({ id: "fake-review-job-id" });
  // FK sırasını koru
  await db.generatedDesign.deleteMany({ where: { userId: USER_ID } });
  await db.reference.deleteMany({ where: { userId: USER_ID } });
  await db.asset.deleteMany({ where: { userId: USER_ID } });
  await db.job.deleteMany({ where: { userId: USER_ID } });
  // 3000ms polling shim
  global.setTimeout = ((fn: AnyFn, ms?: number, ...args: unknown[]) => {
    return realSetTimeout(fn as never, ms === 3000 ? 0 : ms, ...args);
  }) as unknown as typeof global.setTimeout;
});

afterEach(() => {
  global.setTimeout = realSetTimeout;
  vi.useRealTimers();
});

describe("GENERATE_VARIATIONS auto-enqueue REVIEW_DESIGN", () => {
  it("SUCCESS olan her design için tam olarak 1 REVIEW_DESIGN job kuyruğa eklenir", async () => {
    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-auto-1",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValueOnce({
      state: VariationState.SUCCESS,
      imageUrls: ["https://r/auto-a.png"],
    });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "happy" });
    await handleGenerateVariations(makeFakeJob(designId, jobId));

    // Variation tarafı SUCCESS
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.state).toBe(VariationState.SUCCESS);

    // Auto-enqueue tam 1 kez
    const reviewCalls = enqueueMock.mock.calls.filter(
      (call) => call[0] === JobType.REVIEW_DESIGN,
    );
    expect(reviewCalls).toHaveLength(1);

    const [, payload] = reviewCalls[0]!;
    expect(payload).toEqual({
      scope: "design",
      generatedDesignId: designId,
      userId: USER_ID,
    });
  });

  it("3 başarılı design (3 ayrı job invocation) ⇒ 3 REVIEW_DESIGN enqueue", async () => {
    // Worker pattern'ı: 1 job = 1 design. Üç design üretmek için worker 3 kez
    // çağrılır. Her invocation kendi mock cycle'ını tüketir.
    const seeds = await Promise.all([
      seedDesignAndJob({ jobIdSuffix: "tri-1" }),
      seedDesignAndJob({ jobIdSuffix: "tri-2" }),
      seedDesignAndJob({ jobIdSuffix: "tri-3" }),
    ]);

    for (let i = 0; i < seeds.length; i++) {
      generateMock.mockResolvedValueOnce({
        providerTaskId: `task-tri-${i}`,
        state: VariationState.PROVIDER_PENDING,
      });
      pollMock.mockResolvedValueOnce({
        state: VariationState.SUCCESS,
        imageUrls: [`https://r/tri-${i}.png`],
      });
    }

    for (const seed of seeds) {
      await handleGenerateVariations(makeFakeJob(seed.designId, seed.jobId));
    }

    const reviewCalls = enqueueMock.mock.calls.filter(
      (call) => call[0] === JobType.REVIEW_DESIGN,
    );
    expect(reviewCalls).toHaveLength(3);

    const enqueuedDesignIds = reviewCalls.map(
      (call) => (call[1] as { generatedDesignId: string }).generatedDesignId,
    );
    expect(new Set(enqueuedDesignIds)).toEqual(
      new Set(seeds.map((s) => s.designId)),
    );

    for (const call of reviewCalls) {
      const payload = call[1] as { scope: string; userId: string };
      expect(payload.scope).toBe("design");
      expect(payload.userId).toBe(USER_ID);
    }
  });

  it("review enqueue fail olursa variation generation SUCCESS olarak kalır + logger.error", async () => {
    enqueueMock.mockRejectedValueOnce(new Error("redis connection refused"));

    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-fail-enq",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValueOnce({
      state: VariationState.SUCCESS,
      imageUrls: ["https://r/fail-enq.png"],
    });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "failenq" });

    // Worker hata fırlatmadı (cross-job rollback YOK)
    await expect(
      handleGenerateVariations(makeFakeJob(designId, jobId)),
    ).resolves.toBeUndefined();

    // Variation kaydı SUCCESS
    const d = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(d?.state).toBe(VariationState.SUCCESS);
    expect(d?.resultUrl).toBe("https://r/fail-enq.png");
    // Review alanları default (PENDING/SYSTEM)
    expect(d?.reviewStatus).toBe("PENDING");
    expect(d?.reviewStatusSource).toBe("SYSTEM");
    expect(d?.reviewedAt).toBeNull();

    // Job kaydı da SUCCESS
    const j = await db.job.findUnique({ where: { id: jobId } });
    expect(j?.status).toBe(JobStatus.SUCCESS);
    expect(j?.error).toBeNull();

    // Enqueue çağrıldı (ve fail döndü)
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0]![0]).toBe(JobType.REVIEW_DESIGN);
  });

  it("FAIL state ⇒ REVIEW_DESIGN enqueue YOK", async () => {
    generateMock.mockRejectedValueOnce(new Error("provider crashed"));

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "noenq-fail" });

    await expect(
      handleGenerateVariations(makeFakeJob(designId, jobId)),
    ).rejects.toThrow(/provider crashed/);

    const reviewCalls = enqueueMock.mock.calls.filter(
      (call) => call[0] === JobType.REVIEW_DESIGN,
    );
    expect(reviewCalls).toHaveLength(0);
  });

  it("polling timeout ⇒ REVIEW_DESIGN enqueue YOK", async () => {
    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-timeout",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValue({ state: VariationState.PROVIDER_RUNNING });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "noenq-timeout" });
    await handleGenerateVariations(makeFakeJob(designId, jobId));

    const reviewCalls = enqueueMock.mock.calls.filter(
      (call) => call[0] === JobType.REVIEW_DESIGN,
    );
    expect(reviewCalls).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { handleGenerateVariations } from "@/server/workers/generate-variations.worker";
import { JobStatus, JobType, VariationCapability, VariationState } from "@prisma/client";
import type { Job } from "bullmq";

const USER_ID = "gv-test-user";

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

// Reference + GeneratedDesign için bağımlı kayıtları (User, ProductType, Asset, Reference)
// minimum kuran helper. Worker yalnız GeneratedDesign + Job satırlarını update
// ediyor; ancak schema referansları nedeniyle tam zincir gerekli.
type SeedResult = {
  designId: string;
  jobId: string;
};

async function seedDesignAndJob(opts?: {
  designState?: VariationState;
  jobIdSuffix?: string;
}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "gv@test.local", passwordHash: "x" },
  });

  // ProductType — system-level, key unique. Test izolasyonu için sabit key.
  const productTypeKey = "gv-test-canvas";
  const productType = await db.productType.upsert({
    where: { key: productTypeKey },
    update: {},
    create: {
      key: productTypeKey,
      displayName: "GV Test Canvas",
      isSystem: false,
    },
  });

  // Asset (Reference + GeneratedDesign için)
  const refAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `gv-test/ref-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `gv-ref-${Date.now()}-${Math.random()}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `gv-test/design-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `gv-design-${Date.now()}-${Math.random()}`,
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
      promptSnapshot: "wall art\n\nAvoid: Disney",
      briefSnapshot: null,
      state: opts?.designState ?? VariationState.QUEUED,
    },
  });

  const jobId = `gv-job-${opts?.jobIdSuffix ?? design.id}`;
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
      prompt: "wall art\n\nAvoid: Disney",
      referenceUrls: ["https://example.com/a.jpg"],
      aspectRatio: "2:3",
      quality: "medium",
      // Phase 5 closeout hotfix: per-user kieApiKey payload field. Worker
      // provider'a `{ apiKey: payload.kieApiKey }` olarak iletir.
      kieApiKey: "test-key",
    },
  } as unknown as Job;
}

// Worker'daki 3sn polling delay'i test ortamında bypass etmek için global
// setTimeout'u ms parametresini sıfırlayan bir versiyona patch'liyoruz. Worker
// imzasına test-only knob ekleme(R: prod kodunu test için kirletme); bunun
// yerine setTimeout shim ile Prisma'nın gerçek I/O'sunu bozmadan çalışıyoruz.
const realSetTimeout = global.setTimeout;
type AnyFn = (...args: unknown[]) => unknown;
beforeEach(async () => {
  generateMock.mockReset();
  pollMock.mockReset();
  // Bağımlılık sırasını koru (FK).
  await db.generatedDesign.deleteMany({ where: { userId: USER_ID } });
  await db.reference.deleteMany({ where: { userId: USER_ID } });
  await db.asset.deleteMany({ where: { userId: USER_ID } });
  await db.job.deleteMany({ where: { userId: USER_ID } });
  // 3000ms → 0ms (immediate): polling test cycle'ı saniyelerce beklemesin.
  // Diğer setTimeout kullanımları (Prisma vs.) doğal davranışını korur, çünkü
  // 0'a çekmek hâlâ real timer kullanır.
  global.setTimeout = ((fn: AnyFn, ms?: number, ...args: unknown[]) => {
    return realSetTimeout(fn as never, ms === 3000 ? 0 : ms, ...args);
  }) as unknown as typeof global.setTimeout;
});

afterEach(() => {
  global.setTimeout = realSetTimeout;
  vi.useRealTimers();
});

describe("GENERATE_VARIATIONS worker", () => {
  it("happy path: QUEUED → PROVIDER_PENDING → PROVIDER_RUNNING → SUCCESS", async () => {
    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-1",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValueOnce({
      state: VariationState.SUCCESS,
      imageUrls: ["https://r/a.png"],
    });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "happy" });
    await handleGenerateVariations(makeFakeJob(designId, jobId));

    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.state).toBe(VariationState.SUCCESS);
    expect(updated?.providerTaskId).toBe("task-1");
    expect(updated?.resultUrl).toBe("https://r/a.png");

    const updatedJob = await db.job.findUnique({ where: { id: jobId } });
    expect(updatedJob?.status).toBe(JobStatus.SUCCESS);
    expect(updatedJob?.progress).toBe(100);
    expect(updatedJob?.finishedAt).not.toBeNull();

    // Phase 5 closeout hotfix: provider çağrılarına per-user apiKey iletilmeli.
    expect(generateMock).toHaveBeenCalledTimes(1);
    const generateCall = generateMock.mock.calls[0]!;
    expect(generateCall[1]).toEqual({ apiKey: "test-key" });
    expect(pollMock).toHaveBeenCalledTimes(1);
    const pollCall = pollMock.mock.calls[0]!;
    expect(pollCall[1]).toEqual({ apiKey: "test-key" });
  });

  it("strict state sequence: providerTaskId yazılmadan PROVIDER_RUNNING görünmez (atomic update)", async () => {
    // generate() çağrıldığı anda design state PROVIDER_PENDING olmalı,
    // providerTaskId hâlâ null olmalı. generate() döndükten sonra state +
    // providerTaskId tek atomic update'te yazılır.
    let stateAtGenerateCall: VariationState | null = null;
    let providerTaskIdAtGenerateCall: string | null = null;

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "atomic" });

    generateMock.mockImplementationOnce(async () => {
      const snapshot = await db.generatedDesign.findUnique({ where: { id: designId } });
      stateAtGenerateCall = snapshot?.state ?? null;
      providerTaskIdAtGenerateCall = snapshot?.providerTaskId ?? null;
      return { providerTaskId: "task-2", state: VariationState.PROVIDER_PENDING };
    });
    pollMock.mockResolvedValueOnce({
      state: VariationState.SUCCESS,
      imageUrls: ["https://r/b.png"],
    });

    await handleGenerateVariations(makeFakeJob(designId, jobId));

    expect(stateAtGenerateCall).toBe(VariationState.PROVIDER_PENDING);
    expect(providerTaskIdAtGenerateCall).toBeNull();

    const final = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(final?.providerTaskId).toBe("task-2");
    expect(final?.state).toBe(VariationState.SUCCESS);
  });

  it("generate throw: design FAIL + Job FAILED + aynı errorMessage + throw", async () => {
    generateMock.mockRejectedValueOnce(new Error("boom-from-provider"));

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "throw" });

    await expect(
      handleGenerateVariations(makeFakeJob(designId, jobId)),
    ).rejects.toThrow(/boom-from-provider/);

    const d = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(d?.state).toBe(VariationState.FAIL);
    expect(d?.errorMessage).toBe("boom-from-provider");
    expect(d?.providerTaskId).toBeNull();

    const j = await db.job.findUnique({ where: { id: jobId } });
    expect(j?.status).toBe(JobStatus.FAILED);
    expect(j?.error).toBe("boom-from-provider");
    expect(j?.finishedAt).not.toBeNull();
    expect(pollMock).not.toHaveBeenCalled();
  });

  it("poll FAIL: design FAIL + Job FAILED + aynı errorMessage + return (throw YOK)", async () => {
    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-3",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValueOnce({
      state: VariationState.FAIL,
      error: "rate limited",
    });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "pollfail" });

    await expect(
      handleGenerateVariations(makeFakeJob(designId, jobId)),
    ).resolves.toBeUndefined();

    const d = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(d?.state).toBe(VariationState.FAIL);
    expect(d?.errorMessage).toBe("rate limited");
    expect(d?.providerTaskId).toBe("task-3");

    const j = await db.job.findUnique({ where: { id: jobId } });
    expect(j?.status).toBe(JobStatus.FAILED);
    expect(j?.error).toBe("rate limited");
  });

  it("polling timeout: 120 PROVIDER_RUNNING dönüşünden sonra FAIL", async () => {
    generateMock.mockResolvedValueOnce({
      providerTaskId: "task-4",
      state: VariationState.PROVIDER_PENDING,
    });
    pollMock.mockResolvedValue({ state: VariationState.PROVIDER_RUNNING });

    const { designId, jobId } = await seedDesignAndJob({ jobIdSuffix: "timeout" });

    // 3000ms shim → 0ms; 120 poll iterasyonu birkaç ms içinde tamamlanır.
    await handleGenerateVariations(makeFakeJob(designId, jobId));

    const d = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(d?.state).toBe(VariationState.FAIL);
    expect(d?.errorMessage).toBe("polling timeout");

    const j = await db.job.findUnique({ where: { id: jobId } });
    expect(j?.status).toBe(JobStatus.FAILED);
    expect(j?.error).toBe("polling timeout");

    expect(pollMock).toHaveBeenCalledTimes(120);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { ProviderKind, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import type { Job } from "bullmq";
import { db } from "@/server/db";
import {
  handleReviewDesign,
  type ReviewJobPayload,
} from "@/server/workers/review-design.worker";
import { encryptSecret } from "@/lib/secrets";
import { dailyPeriodKey } from "@/server/services/cost/period-key";

// Phase 6 Aşama 1: registry id-aware mock; worker hangi provider id'yi
// resolve ederse o id'yi geri döner. Aşama 2A: modelId field eklendi.
const reviewMock = vi.fn();
function modelIdForId(id: string): string {
  if (id === "kie-gemini-flash") return "gemini-2.5-flash";
  return "gemini-2-5-flash";
}
vi.mock("@/providers/review/registry", () => ({
  getReviewProvider: (id: string) => ({
    id,
    modelId: modelIdForId(id),
    kind: "vision" as const,
    review: (...args: unknown[]) => reviewMock(...args),
  }),
}));

const alphaMock = vi.fn();
vi.mock("@/server/services/review/alpha-checks", () => ({
  runAlphaChecks: (...args: unknown[]) => alphaMock(...args),
}));

// Local mode'da getStorage çağrılmaz (image local-path). Yine de import yan
// etkisi olmasın diye safe stub.
vi.mock("@/providers/storage", () => ({
  getStorage: () => ({
    signedUrl: vi.fn().mockResolvedValue("https://should-not-be-called.test"),
  }),
}));

const USER_ID = "rev-local-test-user";

const FIXTURE_PNG = path.resolve(
  process.cwd(),
  "tests/fixtures/review/transparent-clean.png",
);

type SeedResult = { assetId: string };

type SeedOptions = {
  reviewStatus?: ReviewStatus;
  reviewStatusSource?: ReviewStatusSource;
  /** Aşama 2A: local + KIE varyasyonunu test etmek için. Default "google-gemini". */
  reviewProvider?: "kie" | "google-gemini";
  kieApiKey?: string | null;
  geminiApiKey?: string | null;
};

async function seedLocalAsset(opts: SeedOptions = {}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "rev-local@test.local", passwordHash: "x" },
  });

  // Phase 6 Aşama 1: reviewProvider "google-gemini" default — mevcut local
  // worker testleri Google direct mock pattern'ı ile çalışır.
  // Aşama 2A: opts.reviewProvider ile KIE varyantı seçilebilir.
  const reviewProvider = opts.reviewProvider ?? "google-gemini";
  const kieApiKeyRaw = opts.kieApiKey === undefined ? null : opts.kieApiKey;
  const geminiApiKeyRaw =
    opts.geminiApiKey === undefined ? "AIza-test-fake-key-456" : opts.geminiApiKey;
  const value = {
    kieApiKey: kieApiKeyRaw ? encryptSecret(kieApiKeyRaw) : null,
    geminiApiKey: geminiApiKeyRaw ? encryptSecret(geminiApiKeyRaw) : null,
    reviewProvider,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId: USER_ID, key: "aiMode" } },
    update: { value },
    create: { userId: USER_ID, key: "aiMode", value },
  });

  const uniq = `${Date.now()}-${Math.random()}`;
  const asset = await db.localLibraryAsset.create({
    data: {
      userId: USER_ID,
      folderName: "test-folder",
      folderPath: "/tmp/test-folder",
      fileName: `transparent-${uniq}.png`,
      filePath: FIXTURE_PNG,
      hash: `rev-local-${uniq}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 64,
      height: 64,
      reviewStatus: opts.reviewStatus ?? ReviewStatus.PENDING,
      reviewStatusSource: opts.reviewStatusSource ?? ReviewStatusSource.SYSTEM,
    },
  });

  return { assetId: asset.id };
}

function makeJob(payload: ReviewJobPayload, jobId = "rev-local-job-1"): Job<ReviewJobPayload> {
  return { id: jobId, data: payload } as unknown as Job<ReviewJobPayload>;
}

beforeEach(async () => {
  reviewMock.mockReset();
  alphaMock.mockReset();
  await db.localLibraryAsset.deleteMany({ where: { userId: USER_ID } });
  await db.costUsage.deleteMany({ where: { userId: USER_ID } });
  await db.userSetting.deleteMany({ where: { userId: USER_ID } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("handleReviewDesign — scope=local", () => {
  it("happy path: APPROVED yazılır, snapshot persist", async () => {
    const { assetId } = await seedLocalAsset();
    reviewMock.mockResolvedValueOnce({
      score: 92,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "minimalist wall art",
    });

    const result = await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(ReviewStatus.APPROVED);

    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewScore).toBe(92);
    expect(updated?.reviewSummary).toBe("minimalist wall art");
    expect(updated?.reviewProviderSnapshot).toMatch(/^google-gemini-flash@\d{4}-\d{2}-\d{2}$/);
    // Drift #5 prompt version bump: v1.0 → v1.1 (riskFlags `type` → `kind`).
    expect(updated?.reviewPromptSnapshot).toContain("v1.1");
    expect(updated?.reviewedAt).not.toBeNull();
    // Legacy reviewIssues yazılmıyor.
    expect(updated?.reviewIssues).toBeNull();

    // LocalLibraryAsset için DesignReview audit YOK.
    // (DesignReview tablosu zaten generatedDesignId zorunlu — çağrı yapılmadı.)
  });

  it("local mode + non-transparent productTypeKey 'wall_art' ⇒ runAlphaChecks ÇAĞRILMADI", async () => {
    const { assetId } = await seedLocalAsset();
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "ok",
    });

    await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    // wall_art TRANSPARENT_TARGET_TYPES'da değil ⇒ alpha gate kapalı.
    expect(alphaMock).not.toHaveBeenCalled();
  });

  it("local mode + transparent productTypeKey 'clipart' ⇒ runAlphaChecks ÇAĞRILDI", async () => {
    const { assetId } = await seedLocalAsset();
    alphaMock.mockResolvedValueOnce([]);
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "clean transparent clipart",
    });

    await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "clipart",
      }),
    );

    // clipart TRANSPARENT_TARGET_TYPES'da ⇒ alpha gate AÇIK.
    expect(alphaMock).toHaveBeenCalledTimes(1);
    expect(alphaMock).toHaveBeenCalledWith(FIXTURE_PNG);
  });

  it("sticky USER: rerun status değişmez, hiçbir alan yazılmaz", async () => {
    const { assetId } = await seedLocalAsset({
      reviewStatus: ReviewStatus.REJECTED,
      reviewStatusSource: ReviewStatusSource.USER,
    });

    const result = await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("user_sticky");
    expect(reviewMock).not.toHaveBeenCalled();
    expect(alphaMock).not.toHaveBeenCalled();

    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.REJECTED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();
    expect(updated?.reviewedAt).toBeNull();
  });

  it("K2 sticky race: Gemini fetch sırasında USER yazarsa SYSTEM override etmez", async () => {
    const { assetId } = await seedLocalAsset();

    reviewMock.mockImplementationOnce(async () => {
      // Mid-call: USER endpoint'inin yaptığı yazıyı simüle et.
      await db.localLibraryAsset.update({
        where: { id: assetId },
        data: {
          reviewStatus: ReviewStatus.APPROVED,
          reviewStatusSource: ReviewStatusSource.USER,
          reviewedAt: new Date(),
        },
      });
      return {
        score: 40,
        textDetected: false,
        gibberishDetected: false,
        riskFlags: [],
        summary: "system would say rejected",
      };
    });

    const result = await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("user_sticky_race");

    // USER yazısı korundu.
    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    // SYSTEM yazmadı.
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();
  });
});

describe("handleReviewDesign — scope=local — Task 18 cost tracking + budget", () => {
  it("local happy path sonrası CostUsage 1 cent insert (paralel design pattern)", async () => {
    const { assetId } = await seedLocalAsset();
    reviewMock.mockResolvedValueOnce({
      score: 92,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "ok",
      costCents: 1,
    });

    await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(1);
    const row = usage[0]!;
    expect(row.costCents).toBe(1);
    expect(row.units).toBe(1);
    expect(row.providerKind).toBe(ProviderKind.AI);
    expect(row.providerKey).toBe("google-gemini-flash");
    // Aşama 2A: CostUsage.model = provider.modelId.
    expect(row.model).toBe("gemini-2-5-flash");
    expect(row.periodKey).toBe(dailyPeriodKey());
  });

  it("local mode budget aşıldıysa explicit throw, provider çağrılmaz", async () => {
    const { assetId } = await seedLocalAsset();

    await db.costUsage.create({
      data: {
        userId: USER_ID,
        providerKind: ProviderKind.AI,
        providerKey: "google-gemini-flash",
        model: "google-gemini-flash",
        units: 1000,
        costCents: 1000,
        periodKey: dailyPeriodKey(),
      },
    });

    await expect(
      handleReviewDesign(
        makeJob({
          scope: "local",
          localAssetId: assetId,
          userId: USER_ID,
          productTypeKey: "wall_art",
        }),
      ),
    ).rejects.toThrow(/daily review budget exceeded/i);

    expect(reviewMock).not.toHaveBeenCalled();
  });
});

describe("handleReviewDesign — scope=local — Phase 6 drift #6 + Aşama 2B kapanış", () => {
  it("local mode + reviewProvider 'kie' ⇒ provider data URL inline ile başarılı, cost insert YAPILDI", async () => {
    const { assetId } = await seedLocalAsset({
      reviewProvider: "kie",
      kieApiKey: "kie-test-key-zzz",
      geminiApiKey: null,
    });

    // Drift #6 + Aşama 2B kapanış (2026-05-04): KIE provider artık local-path
    // input için image-loader data URL inline yapıp KIE'ye gönderiyor. Bu
    // worker integration test'i provider'ı mock'lar (registry mock); gerçek
    // provider kod path'i ayrı unit test'te (kie-gemini-flash-provider.test.ts)
    // doğrulanır. Burada mevzu: worker happy path + cost insert.
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "kie data url inline ok",
      costCents: 1,
    });

    const result = await handleReviewDesign(
      makeJob({
        scope: "local",
        localAssetId: assetId,
        userId: USER_ID,
        productTypeKey: "wall_art",
      }),
    );

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(ReviewStatus.APPROVED);

    // Provider çağrıldı.
    expect(reviewMock).toHaveBeenCalledTimes(1);

    // Cost insert YAPILDI (provider id'si kie-gemini-flash → modelId
    // gemini-2.5-flash; mock'taki modelIdForId mapping ile uyumlu).
    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(1);
    const row = usage[0]!;
    expect(row.costCents).toBe(1);
    expect(row.providerKind).toBe(ProviderKind.AI);
    expect(row.providerKey).toBe("kie-gemini-flash");
    expect(row.model).toBe("gemini-2.5-flash");
  });
});

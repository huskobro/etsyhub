import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import type { Job } from "bullmq";
import { db } from "@/server/db";
import {
  handleReviewDesign,
  type ReviewJobPayload,
} from "@/server/workers/review-design.worker";
import { encryptSecret } from "@/lib/secrets";

// Provider registry'yi mock'la — gerçek Gemini HTTP'ye gitmesin.
const reviewMock = vi.fn();
vi.mock("@/providers/review/registry", () => ({
  getReviewProvider: () => ({
    id: "gemini-2-5-flash",
    kind: "vision" as const,
    review: (...args: unknown[]) => reviewMock(...args),
  }),
}));

// alpha-checks'i de mock'la — design path'inde çağrılmadığını doğrulamak için
// `not.toHaveBeenCalled()` testi de bu mock'a güveniyor.
const alphaMock = vi.fn();
vi.mock("@/server/services/review/alpha-checks", () => ({
  runAlphaChecks: (...args: unknown[]) => alphaMock(...args),
}));

// Storage signed URL — test'te MinIO/S3 ayağa kalkmasın, deterministik fake URL.
vi.mock("@/providers/storage", () => ({
  getStorage: () => ({
    signedUrl: vi.fn().mockResolvedValue("https://fake-signed.test/object?token=x"),
  }),
}));

const USER_ID = "rev-test-user";
const OTHER_USER_ID = "rev-test-other-user";

type SeedResult = {
  designId: string;
  assetId: string;
  productTypeKey: string;
};

type SeedOptions = {
  reviewStatus?: ReviewStatus;
  reviewStatusSource?: ReviewStatusSource;
  /** Eğer true ise UserSetting kaydı YARATILMAZ (api key yok senaryosu). */
  skipApiKey?: boolean;
};

async function seedDesign(opts: SeedOptions = {}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "rev-design@test.local", passwordHash: "x" },
  });

  if (!opts.skipApiKey) {
    // Phase 5 service.ts encryptSecret kullanıyor; biz de aynı şekilde yazıyoruz.
    await db.userSetting.upsert({
      where: { userId_key: { userId: USER_ID, key: "aiMode" } },
      update: {
        value: {
          kieApiKey: null,
          geminiApiKey: encryptSecret("AIza-test-fake-key-123"),
        },
      },
      create: {
        userId: USER_ID,
        key: "aiMode",
        value: {
          kieApiKey: null,
          geminiApiKey: encryptSecret("AIza-test-fake-key-123"),
        },
      },
    });
  }

  const productTypeKey = "rev-design-test-canvas";
  const productType = await db.productType.upsert({
    where: { key: productTypeKey },
    update: {},
    create: {
      key: productTypeKey,
      displayName: "Rev Design Test Canvas",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `rev-design/ref-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rev-design-ref-${Date.now()}-${Math.random()}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId: USER_ID,
      storageProvider: "local",
      storageKey: `rev-design/asset-${Date.now()}-${Math.random()}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rev-design-asset-${Date.now()}-${Math.random()}`,
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
      reviewStatus: opts.reviewStatus ?? ReviewStatus.PENDING,
      reviewStatusSource: opts.reviewStatusSource ?? ReviewStatusSource.SYSTEM,
    },
  });

  return { designId: design.id, assetId: designAsset.id, productTypeKey };
}

function makeJob(payload: ReviewJobPayload, jobId = "rev-job-1"): Job<ReviewJobPayload> {
  return { id: jobId, data: payload } as unknown as Job<ReviewJobPayload>;
}

beforeEach(async () => {
  reviewMock.mockReset();
  alphaMock.mockReset();
  // Bağımlılık sırasını koru.
  await db.designReview.deleteMany({
    where: { generatedDesign: { userId: { in: [USER_ID, OTHER_USER_ID] } } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [USER_ID, OTHER_USER_ID] } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [USER_ID, OTHER_USER_ID] } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: [USER_ID, OTHER_USER_ID] } },
  });
  await db.userSetting.deleteMany({
    where: { userId: { in: [USER_ID, OTHER_USER_ID] } },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("handleReviewDesign — scope=design", () => {
  it("happy path: APPROVED + snapshot persist + DesignReview audit", async () => {
    const { designId } = await seedDesign();
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "clean illustration",
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(ReviewStatus.APPROVED);
    expect(result.score).toBe(95);

    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewScore).toBe(95);
    expect(updated?.reviewSummary).toBe("clean illustration");
    expect(updated?.textDetected).toBe(false);
    expect(updated?.gibberishDetected).toBe(false);
    expect(updated?.reviewProviderSnapshot).toMatch(/^gemini-2-5-flash@\d{4}-\d{2}-\d{2}$/);
    expect(updated?.reviewPromptSnapshot).toContain("v1.0");
    expect(updated?.reviewPromptSnapshot).toContain("Etsy print-on-demand");
    expect(updated?.reviewedAt).not.toBeNull();
    // Legacy reviewIssues canonical alan değil — yazılmamalı.
    expect(updated?.reviewIssues).toBeNull();

    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit).toBeTruthy();
    expect(audit?.provider).toBe("gemini-2-5-flash");
    expect(audit?.model).toBe("gemini-2-5-flash");
    expect(audit?.score).toBe(95);
    expect(audit?.decision).toBe(ReviewStatus.APPROVED);
    expect(audit?.reviewer).toBe("system");
  });

  it("risk flag detected: NEEDS_REVIEW + reviewRiskFlags JSON dolu", async () => {
    const { designId } = await seedDesign();
    reviewMock.mockResolvedValueOnce({
      score: 70,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [
        { type: "watermark_detected", confidence: 0.9, reason: "köşede silik imza" },
      ],
      summary: "watermark görünüyor",
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(result.status).toBe(ReviewStatus.NEEDS_REVIEW);
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    const flags = updated?.reviewRiskFlags as Array<{ type: string; confidence: number }>;
    expect(Array.isArray(flags)).toBe(true);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.type).toBe("watermark_detected");
  });

  it("sticky USER: rerun status değişmez, hiçbir alan yazılmaz", async () => {
    const { designId } = await seedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewStatusSource: ReviewStatusSource.USER,
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("user_sticky");
    expect(reviewMock).not.toHaveBeenCalled();
    expect(alphaMock).not.toHaveBeenCalled();

    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    // Hiçbir SYSTEM alanı dokunulmadı.
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewSummary).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();
    expect(updated?.reviewedAt).toBeNull();

    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit).toBeNull();
  });

  it("API key yok: explicit throw", async () => {
    const { designId } = await seedDesign({ skipApiKey: true });

    await expect(
      handleReviewDesign(
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/no gemini api key/i);

    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("ownership mismatch: explicit throw", async () => {
    const { designId } = await seedDesign();
    await db.user.upsert({
      where: { id: OTHER_USER_ID },
      update: {},
      create: { id: OTHER_USER_ID, email: "rev-other@test.local", passwordHash: "x" },
    });

    await expect(
      handleReviewDesign(
        makeJob({
          scope: "design",
          generatedDesignId: designId,
          userId: OTHER_USER_ID,
        }),
      ),
    ).rejects.toThrow(/ownership mismatch/i);

    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("AI mode'da alpha-checks ÇAĞRILMAZ (cloud asset gate)", async () => {
    const { designId } = await seedDesign();
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "ok",
    });

    await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(alphaMock).not.toHaveBeenCalled();
  });

  it("K1 idempotent rerun: aynı design 2 kez review ⇒ ikinci PASS, audit row override (1 row)", async () => {
    const { designId } = await seedDesign();

    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "first review",
    });
    const result1 = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );
    expect(result1.skipped).toBe(false);
    expect(result1.score).toBe(95);

    // İkinci run — yeni provider çıktısı; eski impl P2002 ile crash ediyordu.
    reviewMock.mockResolvedValueOnce({
      score: 80,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "second review",
    });
    const result2 = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );
    expect(result2.skipped).toBe(false);
    expect(result2.score).toBe(80);

    // Audit row 1 adet (upsert override) — son review snapshot'ı.
    const audits = await db.designReview.findMany({
      where: { generatedDesignId: designId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.score).toBe(80);

    // Design row da güncel (son review).
    const updated = await db.generatedDesign.findUnique({
      where: { id: designId },
    });
    expect(updated?.reviewScore).toBe(80);
    expect(updated?.reviewSummary).toBe("second review");
  });

  it("K2 sticky race: Gemini fetch sırasında USER yazarsa SYSTEM override etmez", async () => {
    const { designId } = await seedDesign();

    // Provider mock: Gemini fetch'i simüle ediyoruz; mid-call'da USER endpoint
    // yazısını taklit etmek için DB'yi update ediyoruz. Worker T2 sonrası
    // updateMany WHERE'inde reviewStatusSource ≠ USER guard'a yakalanmalı.
    reviewMock.mockImplementationOnce(async () => {
      await db.generatedDesign.update({
        where: { id: designId },
        data: {
          reviewStatus: ReviewStatus.APPROVED,
          reviewStatusSource: ReviewStatusSource.USER,
          reviewedAt: new Date(),
        },
      });
      return {
        score: 50,
        textDetected: false,
        gibberishDetected: false,
        riskFlags: [],
        summary: "system would say needs review",
      };
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    // Worker race detect ediyor.
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("user_sticky_race");

    // USER yazısı korundu.
    const updated = await db.generatedDesign.findUnique({
      where: { id: designId },
    });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    // SYSTEM yazmadı: review alanları null kaldı.
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewSummary).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();

    // Audit insert YAPILMADI (race detect ⇒ audit upsert atlandı).
    const audits = await db.designReview.findMany({
      where: { generatedDesignId: designId },
    });
    expect(audits).toHaveLength(0);
  });
});

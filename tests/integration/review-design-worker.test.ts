import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProviderKind, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import type { Job } from "bullmq";
import { db } from "@/server/db";
import {
  handleReviewDesign,
  type ReviewJobPayload,
} from "@/server/workers/review-design.worker";
import { encryptSecret } from "@/lib/secrets";
import { dailyPeriodKey } from "@/server/services/cost/period-key";

// Provider registry'yi mock'la — gerçek Gemini HTTP'ye gitmesin.
// Phase 6 Aşama 1: registry id-aware mock; worker hangi provider id'yi
// resolve ederse o id'yi geri döner (kie-gemini-flash veya
// google-gemini-flash). KIE STUB testlerde gerçek throw için ayrı mock yapılır.
const reviewMock = vi.fn();
vi.mock("@/providers/review/registry", () => ({
  getReviewProvider: (id: string) => ({
    id,
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
  /**
   * Phase 6 Aşama 1: per-test setting overrides. Default `"google-gemini"` +
   * geminiApiKey set (mevcut regression mock provider Google direct path'ine
   * gidiyor). Yeni testler `"kie"` set edip STUB throw veya key-yok varyantları
   * kontrol eder.
   */
  reviewProvider?: "kie" | "google-gemini";
  kieApiKey?: string | null;
  geminiApiKey?: string | null;
};

async function seedDesign(opts: SeedOptions = {}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "rev-design@test.local", passwordHash: "x" },
  });

  if (!opts.skipApiKey) {
    // Phase 5 service.ts encryptSecret kullanıyor; biz de aynı şekilde yazıyoruz.
    // Phase 6 Aşama 1: default reviewProvider "google-gemini" + geminiApiKey
    // set — mevcut regression Google direct mock pattern'ı korunur.
    const reviewProvider = opts.reviewProvider ?? "google-gemini";
    const kieApiKeyRaw =
      opts.kieApiKey === undefined ? null : opts.kieApiKey;
    const geminiApiKeyRaw =
      opts.geminiApiKey === undefined ? "AIza-test-fake-key-123" : opts.geminiApiKey;
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
  await db.costUsage.deleteMany({
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
    expect(updated?.reviewProviderSnapshot).toMatch(/^google-gemini-flash@\d{4}-\d{2}-\d{2}$/);
    expect(updated?.reviewPromptSnapshot).toContain("v1.0");
    expect(updated?.reviewPromptSnapshot).toContain("Etsy print-on-demand");
    expect(updated?.reviewedAt).not.toBeNull();
    // Legacy reviewIssues canonical alan değil — yazılmamalı.
    expect(updated?.reviewIssues).toBeNull();

    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit).toBeTruthy();
    expect(audit?.provider).toBe("google-gemini-flash");
    expect(audit?.model).toBe("google-gemini-flash");
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

  it("API key yok (UserSetting row yok): default reviewProvider 'kie' ⇒ kieApiKey ayarlanmamış throw", async () => {
    // Aşama 1: UserSetting kaydı YOK ⇒ getUserAiModeSettings default
    // {reviewProvider:"kie", kieApiKey:null} döner ⇒ kie branch + key-yok throw.
    const { designId } = await seedDesign({ skipApiKey: true });

    await expect(
      handleReviewDesign(
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/kieApiKey ayarlanmamış/i);

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

describe("handleReviewDesign — Task 18 cost tracking + budget", () => {
  it("happy path sonrası CostUsage tablosuna 1 cent insert (Karar 3 conservative estimate)", async () => {
    const { designId } = await seedDesign();
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "clean",
      costCents: 1,
    });

    await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(1);
    const row = usage[0]!;
    expect(row.costCents).toBe(1);
    expect(row.units).toBe(1);
    expect(row.providerKind).toBe(ProviderKind.AI);
    expect(row.providerKey).toBe("google-gemini-flash");
    expect(row.model).toBe("google-gemini-flash");
    expect(row.periodKey).toBe(dailyPeriodKey());
  });

  it("daily budget aşıldıysa worker explicit throw (limit guard, sessiz skip yok)", async () => {
    const { designId } = await seedDesign();

    // Limit dolmuş: 1000 cent kayıt seed'le.
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
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/daily review budget exceeded/i);

    // Provider çağrılmadı (budget check API key resolve'dan da önce).
    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("sticky USER ⇒ cost insert YOK (provider çağrılmadı, budget tüketilmedi)", async () => {
    const { designId } = await seedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewStatusSource: ReviewStatusSource.USER,
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("user_sticky");

    // Sticky early-return ⇒ budget check de yapılmadı, cost insert de yok.
    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(0);
  });
});

describe("handleReviewDesign — Phase 6 Aşama 1 review provider seçimi", () => {
  it("default reviewProvider='kie' + kieApiKey set: STUB provider throw ⇒ review FAIL, cost insert YOK", async () => {
    const { designId } = await seedDesign({
      reviewProvider: "kie",
      kieApiKey: "kie-test-key-aaa",
      geminiApiKey: null,
    });

    // KIE STUB davranışını mock üzerinden simüle et — registry mock id-aware
    // çağrı yapıyor, ama review() fonksiyonu shared reviewMock'a düşüyor.
    // Worker `getReviewProvider("kie-gemini-flash")` çağıracak; reviewMock
    // burada gerçek STUB'ın yön mesajını taklit eder.
    reviewMock.mockRejectedValueOnce(
      new Error(
        "kie-gemini-flash review provider not implemented yet (Aşama 2). " +
          "KIE.ai Gemini endpoint kontratı bekleniyor — settings'ten 'google-gemini' " +
          "provider'a geçebilir veya Aşama 2 implementasyonunu bekleyebilirsiniz.",
      ),
    );

    await expect(
      handleReviewDesign(
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/kie-gemini-flash.*Aşama 2/i);

    // Provider review() throw ettiği için sonrası kod (persist + cost insert)
    // çalışmadı. CostUsage tablosu boş kalır.
    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(0);
  });

  it("reviewProvider='google-gemini' + geminiApiKey YOK ⇒ explicit throw (yön mesajı)", async () => {
    const { designId } = await seedDesign({
      reviewProvider: "google-gemini",
      kieApiKey: "kie-test-key-bbb",
      geminiApiKey: null,
    });

    await expect(
      handleReviewDesign(
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/geminiApiKey ayarlanmamış/i);

    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("reviewProvider='kie' + kieApiKey YOK ⇒ explicit throw (yön mesajı)", async () => {
    const { designId } = await seedDesign({
      reviewProvider: "kie",
      kieApiKey: null,
      geminiApiKey: "AIza-test-key-ccc",
    });

    await expect(
      handleReviewDesign(
        makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
      ),
    ).rejects.toThrow(/kieApiKey ayarlanmamış/i);

    expect(reviewMock).not.toHaveBeenCalled();
  });
});

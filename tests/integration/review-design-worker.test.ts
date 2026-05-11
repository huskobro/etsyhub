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
// google-gemini-flash). Aşama 2A: modelId field provider interface'e eklendi
// (audit.model = provider.modelId), id-aware mapping ile gerçek provider
// modelId'sini taklit ediyoruz.
const reviewMock = vi.fn();
function modelIdForId(id: string): string {
  if (id === "kie-gemini-flash") return "gemini-2.5-flash";
  // google-gemini-flash veya diğer
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
    // result.score is raw LLM score (95)
    expect(result.score).toBe(95);

    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    // IA-29: worker writes to reviewSuggestedStatus (advisory), NOT reviewStatus (operator)
    expect(updated?.reviewSuggestedStatus).toBe(ReviewStatus.APPROVED);
    // reviewStatus stays PENDING — worker never touches it
    expect(updated?.reviewStatus).toBe(ReviewStatus.PENDING);
    // reviewStatusSource stays SYSTEM (unchanged)
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    // reviewScore = breakdown.finalScore = 100 (no penalty — all criteria pass)
    expect(updated?.reviewScore).toBe(100);
    expect(updated?.reviewSummary).toBe("clean illustration");
    expect(updated?.textDetected).toBe(false);
    expect(updated?.gibberishDetected).toBe(false);
    expect(updated?.reviewProviderSnapshot).toMatch(/^google-gemini-flash@\d{4}-\d{2}-\d{2}$/);
    // Drift #5 prompt version bump: v1.0 → v1.1 (riskFlags `type` → `kind`).
    expect(updated?.reviewPromptSnapshot).toContain("v1.1");
    expect(updated?.reviewPromptSnapshot).toContain("Etsy print-on-demand");
    expect(updated?.reviewedAt).not.toBeNull();
    // Legacy reviewIssues canonical alan değil — yazılmamalı.
    expect(updated?.reviewIssues).toBeNull();

    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit).toBeTruthy();
    expect(audit?.provider).toBe("google-gemini-flash");
    // Aşama 2A: audit.model = provider.modelId (gerçek model string).
    expect(audit?.model).toBe("gemini-2-5-flash");
    // audit.score = breakdown.finalScore = 100 (no penalty — all criteria pass)
    expect(audit?.score).toBe(100);
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
        // Drift #5: `type` → `kind` (KIE strict JSON schema fix).
        { kind: "watermark_detected", confidence: 0.9, reason: "köşede silik imza" },
      ],
      summary: "watermark görünüyor",
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    expect(result.status).toBe(ReviewStatus.NEEDS_REVIEW);
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    // Drift #5: persist edilen format `kind` (write-new disipline).
    const flags = updated?.reviewRiskFlags as Array<{ kind: string; confidence: number }>;
    expect(Array.isArray(flags)).toBe(true);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("watermark_detected");
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

  it("K1 already-scored guard: aynı design 2 kez review ⇒ ikinci already_scored skip edilir (CLAUDE.md Madde N cost discipline)", async () => {
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
    expect(result1.score).toBe(95); // raw LLM score

    // İkinci run — already_scored guard tetiklenir (reviewedAt + snapshot set).
    // CLAUDE.md Madde N: geçerli skoru olan asset tekrar kuyruğa alınmaz.
    const result2 = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );
    expect(result2.skipped).toBe(true);
    expect(result2.reason).toBe("already_scored");

    // Audit row: sadece ilk review'dan gelen 1 adet.
    const audits = await db.designReview.findMany({
      where: { generatedDesignId: designId },
    });
    expect(audits).toHaveLength(1);
    // audit.score = breakdown.finalScore = 100 (no penalty)
    expect(audits[0]?.score).toBe(100);

    // Design row: ilk review değerleri korundu.
    const updated = await db.generatedDesign.findUnique({
      where: { id: designId },
    });
    // reviewScore = breakdown.finalScore = 100 (no penalty)
    expect(updated?.reviewScore).toBe(100);
    expect(updated?.reviewSummary).toBe("first review");
  });

  it("K2 IA-29 advisory independence: Gemini fetch sırasında USER reviewStatus yazsa bile SYSTEM advisory yazılır (parallel axes)", async () => {
    const { designId } = await seedDesign();

    // Provider mock: Gemini fetch'i simüle ediyoruz; mid-call'da USER endpoint
    // reviewStatus'e APPROVED yazıyor. IA-29 sonrası worker reviewStatus'e
    // dokunmaz — sadece reviewSuggestedStatus (advisory) yazar. İki eksen bağımsız.
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
        summary: "system says needs review",
      };
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );

    // IA-29: worker proceeds — advisory and operator axes are independent.
    expect(result.skipped).toBe(false);

    // USER reviewStatus korundu (worker dokunmadı).
    const updated = await db.generatedDesign.findUnique({
      where: { id: designId },
    });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    // Advisory yazıldı (worker advisory).
    expect(updated?.reviewSuggestedStatus).toBeDefined();
    // Score + summary advisory olarak persist edildi.
    expect(updated?.reviewScore).not.toBeNull();
    expect(updated?.reviewSummary).toBe("system says needs review");
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
    // Aşama 2A: CostUsage.model = provider.modelId.
    expect(row.model).toBe("gemini-2-5-flash");
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

describe("handleReviewDesign — Phase 6 Aşama 2A review provider seçimi", () => {
  it("KIE provider: AI mode (remote-url) çalışır + audit.model = provider.modelId 'gemini-2.5-flash'", async () => {
    const { designId } = await seedDesign({
      reviewProvider: "kie",
      kieApiKey: "kie-test-key-aaa",
      geminiApiKey: null,
    });

    // KIE provider review başarılı — Aşama 2A AI mode canlı.
    reviewMock.mockResolvedValueOnce({
      score: 92,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "kie review ok",
      costCents: 1,
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "design", generatedDesignId: designId, userId: USER_ID }),
    );
    expect(result.skipped).toBe(false);
    expect(result.score).toBe(92);

    // Audit row: provider id = "kie-gemini-flash", model = modelId
    // ("gemini-2.5-flash") — provider id ↔ model id ayrımı (Ö4 carry-forward).
    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit?.provider).toBe("kie-gemini-flash");
    expect(audit?.model).toBe("gemini-2.5-flash");

    // CostUsage: providerKey = id, model = modelId.
    const usage = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(usage).toHaveLength(1);
    expect(usage[0]!.providerKey).toBe("kie-gemini-flash");
    expect(usage[0]!.model).toBe("gemini-2.5-flash");

    // Provider snapshot KIE id'sini içerir.
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewProviderSnapshot).toMatch(/^kie-gemini-flash@\d{4}-\d{2}-\d{2}$/);
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

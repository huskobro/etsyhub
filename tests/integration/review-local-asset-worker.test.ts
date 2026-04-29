import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import type { Job } from "bullmq";
import { db } from "@/server/db";
import {
  handleReviewDesign,
  type ReviewJobPayload,
} from "@/server/workers/review-design.worker";
import { encryptSecret } from "@/lib/secrets";

const reviewMock = vi.fn();
vi.mock("@/providers/review/registry", () => ({
  getReviewProvider: () => ({
    id: "gemini-2-5-flash",
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
};

async function seedLocalAsset(opts: SeedOptions = {}): Promise<SeedResult> {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "rev-local@test.local", passwordHash: "x" },
  });

  await db.userSetting.upsert({
    where: { userId_key: { userId: USER_ID, key: "aiMode" } },
    update: {
      value: {
        kieApiKey: null,
        geminiApiKey: encryptSecret("AIza-test-fake-key-456"),
      },
    },
    create: {
      userId: USER_ID,
      key: "aiMode",
      value: {
        kieApiKey: null,
        geminiApiKey: encryptSecret("AIza-test-fake-key-456"),
      },
    },
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
      makeJob({ scope: "local", localAssetId: assetId, userId: USER_ID }),
    );

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(ReviewStatus.APPROVED);

    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewScore).toBe(92);
    expect(updated?.reviewSummary).toBe("minimalist wall art");
    expect(updated?.reviewProviderSnapshot).toMatch(/^gemini-2-5-flash@\d{4}-\d{2}-\d{2}$/);
    expect(updated?.reviewPromptSnapshot).toContain("v1.0");
    expect(updated?.reviewedAt).not.toBeNull();
    // Legacy reviewIssues yazılmıyor.
    expect(updated?.reviewIssues).toBeNull();

    // LocalLibraryAsset için DesignReview audit YOK.
    // (DesignReview tablosu zaten generatedDesignId zorunlu — çağrı yapılmadı.)
  });

  it("local mode + non-transparent product (default wall_art) ⇒ runAlphaChecks ÇAĞRILMADI", async () => {
    const { assetId } = await seedLocalAsset();
    reviewMock.mockResolvedValueOnce({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "ok",
    });

    await handleReviewDesign(
      makeJob({ scope: "local", localAssetId: assetId, userId: USER_ID }),
    );

    // Worker default product type "wall_art" ⇒ transparent gate kapalı.
    // (Task 10 batch endpoint payload'a productType eklediğinde davranış
    // genişler; o zaman bu test transparent product input'u kabul edecek
    // ve alpha çağrısını tetikleyecek.)
    expect(alphaMock).not.toHaveBeenCalled();
  });

  it("sticky USER: rerun status değişmez, hiçbir alan yazılmaz", async () => {
    const { assetId } = await seedLocalAsset({
      reviewStatus: ReviewStatus.REJECTED,
      reviewStatusSource: ReviewStatusSource.USER,
    });

    const result = await handleReviewDesign(
      makeJob({ scope: "local", localAssetId: assetId, userId: USER_ID }),
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
      makeJob({ scope: "local", localAssetId: assetId, userId: USER_ID }),
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

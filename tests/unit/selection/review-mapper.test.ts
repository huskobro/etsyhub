// Phase 7 — Task 16: Phase 6 review mapper layer (read-only)
//
// Mapper Phase 6 entity'lerinden okur, ASLA YAZMAZ. Selection Studio'nun AI
// Kalite paneline (Section 3.2) uygun view-model üretir. Pure fonksiyon —
// DB I/O yok; tüm input argümandan gelir.
//
// Sözleşmeler (plan Task 16, design Section 7.4):
//   - "Review yok" kanonik shape: null döner (Phase 7
//     SelectionItemView.review opsiyonel)
//   - Score: designReview.score → generatedDesign.reviewScore → 0
//     (0-100 sınır)
//   - Status: designReview.decision → generatedDesign.reviewStatus →
//     ReviewStatus enum string mapping
//   - Signals — risk flag aggregation (4 kategori):
//       textDetection, artifactCheck, trademarkRisk, resolution
//   - Defensive parsing: Json malformed → boş array fallback
//
// Bu dosya UNIT test — DB roundtrip yok. getSet integration ayrı dosyada.

import { describe, expect, it } from "vitest";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import type { DesignReview, GeneratedDesign } from "@prisma/client";
import { mapReviewToView } from "@/server/services/selection/review-mapper";

// ────────────────────────────────────────────────────────────
// Test fixture builders — Prisma type-safe (eksik alan TS-error)
// ────────────────────────────────────────────────────────────

function buildGeneratedDesign(
  overrides: Partial<GeneratedDesign> = {},
): GeneratedDesign {
  return {
    id: "gd-test-1",
    userId: "user-1",
    referenceId: "ref-1",
    assetId: "asset-1",
    productTypeId: "pt-1",
    promptVersionId: null,
    jobId: null,
    similarity: null,
    qualityScore: null,
    reviewStatus: ReviewStatus.PENDING,
    reviewIssues: null,
    reviewSummary: null,
    textDetected: false,
    gibberishDetected: false,
    riskFlags: [],
    reviewedAt: null,
    reviewStatusSource: ReviewStatusSource.SYSTEM,
    reviewScore: null,
    reviewProviderSnapshot: null,
    reviewPromptSnapshot: null,
    reviewRiskFlags: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    providerId: null,
    providerTaskId: null,
    capabilityUsed: null,
    promptSnapshot: null,
    briefSnapshot: null,
    resultUrl: null,
    state: null,
    errorMessage: null,
    aspectRatio: null,
    quality: null,
    ...overrides,
  };
}

function buildDesignReview(
  overrides: Partial<DesignReview> = {},
): DesignReview {
  return {
    id: "dr-test-1",
    generatedDesignId: "gd-test-1",
    reviewer: "system",
    score: null,
    issues: null,
    decision: ReviewStatus.PENDING,
    createdAt: new Date(),
    provider: null,
    model: null,
    promptSnapshot: null,
    responseSnapshot: null,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("mapReviewToView — kanonik 'review yok' shape", () => {
  it("generatedDesign + designReview ikisi de null → null", () => {
    expect(
      mapReviewToView({ generatedDesign: null, designReview: null }),
    ).toBeNull();
  });

  it("sadece generatedDesign var, review PENDING + reviewedAt null → null", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.PENDING,
      reviewedAt: null,
    });
    expect(
      mapReviewToView({ generatedDesign: gd, designReview: null }),
    ).toBeNull();
  });

  it("designReview null + generatedDesign.reviewedAt null → null", () => {
    const gd = buildGeneratedDesign({ reviewedAt: null });
    expect(
      mapReviewToView({ generatedDesign: gd, designReview: null }),
    ).toBeNull();
  });
});

describe("mapReviewToView — score & status", () => {
  it("designReview APPROVED + score 92 → score 92, status 'approved'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 92,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view).not.toBeNull();
    expect(view!.score).toBe(92);
    expect(view!.status).toBe("approved");
  });

  it("score normalize: 110 → 100 (üst sınır)", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 110,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.score).toBe(100);
  });

  it("score normalize: -5 → 0 (alt sınır)", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: -5,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.score).toBe(0);
  });

  it("score yoksa fallback 0 (designReview score null + generatedDesign reviewScore null)", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
      reviewScore: null,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: null,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.score).toBe(0);
  });

  it("score öncelik: designReview.score > generatedDesign.reviewScore", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      reviewScore: 50,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 80,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.score).toBe(80);
  });

  it("designReview yok ama gd.reviewScore var (legacy/denorm) + reviewedAt → fallback gd.reviewScore", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      reviewScore: 75,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: null });
    expect(view).not.toBeNull();
    expect(view!.score).toBe(75);
    expect(view!.status).toBe("approved");
  });

  it.each([
    [ReviewStatus.APPROVED, "approved"],
    [ReviewStatus.NEEDS_REVIEW, "needs_review"],
    [ReviewStatus.REJECTED, "rejected"],
    [ReviewStatus.PENDING, "pending"],
  ] as const)(
    "status mapping: %s → %s",
    (decision, expected) => {
      const gd = buildGeneratedDesign({
        reviewStatus: decision,
        reviewedAt: new Date(),
      });
      const dr = buildDesignReview({ decision, score: 50 });
      const view = mapReviewToView({
        generatedDesign: gd,
        designReview: dr,
      });
      expect(view!.status).toBe(expected);
    },
  );
});

describe("mapReviewToView — textDetection signal", () => {
  it("issues: text_detected flag → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: [{ type: "text_detected", confidence: 0.9, reason: "text" }],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("issue");
  });

  it("issues: gibberish_text_detected flag → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: [
        {
          type: "gibberish_text_detected",
          confidence: 0.8,
          reason: "asdkj",
        },
      ],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("issue");
  });

  it("generatedDesign.textDetected === true → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
      textDetected: true,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("issue");
  });

  it("generatedDesign.gibberishDetected === true → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
      gibberishDetected: true,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("issue");
  });

  it("hiçbir text sinyali yok → 'clean'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
      issues: [],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("clean");
  });
});

describe("mapReviewToView — artifactCheck signal", () => {
  it("issues: transparent_edge_artifact → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: [
        {
          type: "transparent_edge_artifact",
          confidence: 0.7,
          reason: "edge",
        },
      ],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.artifactCheck).toBe("issue");
  });

  it("issues: no_alpha_channel → 'issue'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: [
        { type: "no_alpha_channel", confidence: 0.95, reason: "no alpha" },
      ],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.artifactCheck).toBe("issue");
  });

  it("hiçbir artifact sinyali yok → 'clean'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
      issues: [],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.artifactCheck).toBe("clean");
  });
});

describe("mapReviewToView — trademarkRisk signal", () => {
  it.each([
    "watermark_detected",
    "signature_detected",
    "visible_logo_detected",
    "celebrity_face_detected",
  ] as const)("issues: %s → 'high'", (flagType) => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 50,
      issues: [{ type: flagType, confidence: 0.85, reason: "test" }],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.trademarkRisk).toBe("high");
  });

  it("hiçbir trademark sinyali yok → 'low'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
      issues: [],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.trademarkRisk).toBe("low");
  });
});

describe("mapReviewToView — resolution signal (qualityScore)", () => {
  it("qualityScore null → 'unknown'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      qualityScore: null,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.resolution).toBe("unknown");
  });

  it("qualityScore 60 → 'ok' (eşik dahil)", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      qualityScore: 60,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.resolution).toBe("ok");
  });

  it("qualityScore 95 → 'ok'", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      qualityScore: 95,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.resolution).toBe("ok");
  });

  it("qualityScore 30 → 'low' (eşik altı)", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
      qualityScore: 30,
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 50,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.resolution).toBe("low");
  });
});

describe("mapReviewToView — defensive parsing", () => {
  it("malformed issues (string yerine number) → graceful: tüm signals clean/low", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    // Json field — runtime'da malformed olabilir
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issues: 42 as any,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("clean");
    expect(view!.signals.artifactCheck).toBe("clean");
    expect(view!.signals.trademarkRisk).toBe("low");
  });

  it("issues array içinde non-flag obje → silently skip", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.APPROVED,
      score: 90,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issues: [{ random: "stuff" } as any, { foo: "bar" } as any],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.textDetection).toBe("clean");
    expect(view!.signals.artifactCheck).toBe("clean");
    expect(view!.signals.trademarkRisk).toBe("low");
  });

  it("issues array'de mixed (geçerli + non-flag) → geçerli flag aktif olur", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { random: "skip me" } as any,
        { type: "watermark_detected", confidence: 0.9, reason: "wm" },
      ],
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.trademarkRisk).toBe("high");
  });

  it("designReview.issues null + generatedDesign.reviewIssues fallback ile signal aktif", () => {
    const gd = buildGeneratedDesign({
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewedAt: new Date(),
      reviewIssues: [
        { type: "signature_detected", confidence: 0.7, reason: "sig" },
      ],
    });
    const dr = buildDesignReview({
      decision: ReviewStatus.NEEDS_REVIEW,
      score: 60,
      issues: null,
    });
    const view = mapReviewToView({ generatedDesign: gd, designReview: dr });
    expect(view!.signals.trademarkRisk).toBe("high");
  });
});

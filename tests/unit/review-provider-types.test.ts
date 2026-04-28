import { describe, it, expect } from "vitest";
import {
  REVIEW_RISK_FLAG_TYPES,
  isReviewRiskFlagType,
  type ReviewProvider,
  type ReviewRiskFlag,
} from "@/providers/review/types";

describe("ReviewProvider types — sabit sözlük", () => {
  it("REVIEW_RISK_FLAG_TYPES tam olarak 8 elemanlı, exact sıra (drift koruması)", () => {
    expect(REVIEW_RISK_FLAG_TYPES).toEqual([
      "watermark_detected",
      "signature_detected",
      "visible_logo_detected",
      "celebrity_face_detected",
      "no_alpha_channel",
      "transparent_edge_artifact",
      "text_detected",
      "gibberish_text_detected",
    ]);
    expect(REVIEW_RISK_FLAG_TYPES).toHaveLength(8);
  });

  it("isReviewRiskFlagType bilinen type'ı kabul eder", () => {
    expect(isReviewRiskFlagType("watermark_detected")).toBe(true);
    expect(isReviewRiskFlagType("gibberish_text_detected")).toBe(true);
  });

  it("isReviewRiskFlagType bilinmeyen string'i reddeder", () => {
    expect(isReviewRiskFlagType("random_string")).toBe(false);
    expect(isReviewRiskFlagType("")).toBe(false);
    expect(isReviewRiskFlagType("WATERMARK_DETECTED")).toBe(false); // case-sensitive
  });
});

describe("ReviewProvider interface — conformance", () => {
  it("minimal stub provider compile eder ve çağrılabilir", async () => {
    const stub: ReviewProvider = {
      id: "stub-test",
      kind: "vision",
      review: async () => ({
        score: 80,
        textDetected: false,
        gibberishDetected: false,
        riskFlags: [],
        summary: "ok",
      }),
    };
    const out = await stub.review(
      {
        image: { kind: "remote-url", url: "https://example.com/x.png" },
        productType: "wall_art",
        isTransparentTarget: false,
      },
      { apiKey: "test-key" },
    );
    expect(out.score).toBe(80);
    expect(out.riskFlags).toEqual([]);
  });

  it("ReviewRiskFlag yapısı type/confidence/reason taşır", () => {
    const flag: ReviewRiskFlag = {
      type: "watermark_detected",
      confidence: 0.9,
      reason: "sağ alt köşede yarı saydam imza izi",
    };
    expect(flag.type).toBe("watermark_detected");
    expect(flag.confidence).toBe(0.9);
  });
});

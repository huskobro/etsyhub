import { describe, it, expect } from "vitest";
import { ReviewOutputSchema } from "@/providers/review/output-schema";

/**
 * DRY extract doğrulama — tek noktada Zod schema iki provider tarafından
 * paylaşılır (google-gemini-flash + kie-gemini-flash). Drift koruması bu
 * testlerle merkezde sağlanır; provider testleri parse path doğru çağrıyı
 * yapıyor mu kontrol eder.
 */

const validOutput = {
  score: 85,
  textDetected: false,
  gibberishDetected: false,
  riskFlags: [],
  summary: "clean",
};

describe("ReviewOutputSchema (DRY paylaşılan Zod)", () => {
  it("bilinmeyen risk flag type reddeder", () => {
    const bad = {
      ...validOutput,
      riskFlags: [{ type: "fake_flag", confidence: 0.5, reason: "x" }],
    };
    const result = ReviewOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("score > 100 reddeder", () => {
    const bad = { ...validOutput, score: 150 };
    const result = ReviewOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("confidence > 1 reddeder", () => {
    const bad = {
      ...validOutput,
      riskFlags: [{ type: "watermark_detected", confidence: 1.5, reason: "x" }],
    };
    const result = ReviewOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

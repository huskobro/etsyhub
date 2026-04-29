import { describe, it, expect, vi, beforeEach } from "vitest";
import { geminiFlashReviewProvider } from "@/providers/review/gemini-2-5-flash";

// image-loader'ı mockla — gemini logic'ini izole edelim
vi.mock("@/providers/review/image-loader", () => ({
  imageToInlineData: vi.fn(async () => ({
    mimeType: "image/png",
    data: "base64stub",
  })),
}));

const baseInput = {
  image: { kind: "remote-url" as const, url: "https://example.com/x.png" },
  productType: "wall_art",
  isTransparentTarget: false,
};

const validOutput = {
  score: 85,
  textDetected: false,
  gibberishDetected: false,
  riskFlags: [],
  summary: "clean illustration",
};

function mockGeminiResponse(textPayload: string, options: { ok?: boolean; status?: number } = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => "raw error body",
    json: async () => ({
      candidates: [{ content: { parts: [{ text: textPayload }] } }],
    }),
  };
}

beforeEach(() => {
  global.fetch = vi.fn() as unknown as typeof fetch;
});

describe("Gemini review provider — başarılı senaryolar", () => {
  it("valid JSON output → ReviewOutput parse edilir + costCents 1 (conservative estimate)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse(JSON.stringify(validOutput)),
    );
    const result = await geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" });
    expect(result.score).toBe(85);
    expect(result.riskFlags).toEqual([]);
    // Phase 6 Task 18 — conservative cost estimate (gerçek faturalama değil).
    expect(result.costCents).toBe(1);
  });

  it("riskFlags dolu valid output → parse + döner", async () => {
    const withFlags = {
      ...validOutput,
      score: 70,
      riskFlags: [{ type: "watermark_detected", confidence: 0.85, reason: "köşede silik imza" }],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse(JSON.stringify(withFlags)),
    );
    const result = await geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" });
    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0]!.type).toBe("watermark_detected");
  });
});

describe("Gemini review provider — hata senaryoları (sessiz fallback yok)", () => {
  it("apiKey boş ⇒ throw", async () => {
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "" }),
    ).rejects.toThrow(/api key missing/i);
  });

  it("apiKey sadece whitespace ⇒ throw", async () => {
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "   " }),
    ).rejects.toThrow(/api key missing/i);
  });

  it("HTTP 500 ⇒ throw with status + body", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "internal server error",
      json: async () => ({}),
    });
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/gemini review failed: 500/);
  });

  it("candidates boş ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ candidates: [] }),
    });
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/empty candidates/);
  });

  it("text boş ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ candidates: [{ content: { parts: [{ text: "" }] } }] }),
    });
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/empty response text/);
  });

  it("non-JSON output ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse("not json at all"),
    );
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/non-JSON output/);
  });

  it("bilinmeyen risk flag type ⇒ Zod throw", async () => {
    const bad = { ...validOutput, riskFlags: [{ type: "fake_flag", confidence: 0.5, reason: "x" }] };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse(JSON.stringify(bad)),
    );
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/invalid output schema/i);
  });

  it("confidence > 1 ⇒ Zod throw", async () => {
    const bad = {
      ...validOutput,
      riskFlags: [{ type: "watermark_detected", confidence: 1.5, reason: "x" }],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse(JSON.stringify(bad)),
    );
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/invalid output schema/i);
  });

  it("score > 100 ⇒ Zod throw", async () => {
    const bad = { ...validOutput, score: 150 };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockGeminiResponse(JSON.stringify(bad)),
    );
    await expect(
      geminiFlashReviewProvider.review(baseInput, { apiKey: "test-key" }),
    ).rejects.toThrow(/invalid output schema/i);
  });
});

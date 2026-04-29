import { describe, it, expect } from "vitest";
import { kieGeminiFlashReviewProvider } from "@/providers/review/kie-gemini-flash";

describe("KIE Gemini Flash review provider — STUB (Phase 6 Aşama 1)", () => {
  it("review() çağrılırsa Aşama 2 işaretli yönlendirici hata fırlatır", async () => {
    await expect(
      kieGeminiFlashReviewProvider.review(
        {
          image: { kind: "remote-url", url: "https://example.com/x.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "test-key" },
      ),
    ).rejects.toThrow(/kie-gemini-flash review provider not implemented yet \(Aşama 2\)/);
  });

  it("hata mesajı kullanıcıyı 'google-gemini' alternatifine yönlendirir", async () => {
    await expect(
      kieGeminiFlashReviewProvider.review(
        {
          image: { kind: "remote-url", url: "https://x.test/y.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "key" },
      ),
    ).rejects.toThrow(/google-gemini.*geçebilir/i);
  });

  it("provider id 'kie-gemini-flash' + kind 'vision'", () => {
    expect(kieGeminiFlashReviewProvider.id).toBe("kie-gemini-flash");
    expect(kieGeminiFlashReviewProvider.kind).toBe("vision");
  });
});

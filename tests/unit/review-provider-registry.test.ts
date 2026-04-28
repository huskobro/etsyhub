import { describe, it, expect } from "vitest";
import { getReviewProvider, listReviewProviders } from "@/providers/review/registry";

describe("Review provider registry — R17.3", () => {
  it("bilinen id ile provider döner", () => {
    const provider = getReviewProvider("gemini-2-5-flash");
    expect(provider.id).toBe("gemini-2-5-flash");
    expect(provider.kind).toBe("vision");
  });

  it("bilinmeyen id'de explicit throw (sessiz fallback yok)", () => {
    expect(() => getReviewProvider("nonexistent-id")).toThrow(
      /unknown review provider: nonexistent-id/i,
    );
    expect(() => getReviewProvider("")).toThrow(/unknown review provider/i);
  });

  it("listReviewProviders provider nesnelerini döndürür (sadece id değil)", () => {
    const providers = listReviewProviders();
    expect(providers.length).toBeGreaterThanOrEqual(1);
    const gemini = providers.find((p) => p.id === "gemini-2-5-flash");
    expect(gemini).toBeDefined();
    expect(gemini!.kind).toBe("vision");
    expect(typeof gemini!.review).toBe("function");
  });

  it("stub provider review() çağrılırsa Task 4 işaretli açıklayıcı hata fırlatır", async () => {
    const provider = getReviewProvider("gemini-2-5-flash");
    await expect(
      provider.review({
        imageUrl: "https://example.com/x.png",
        productType: "wall_art",
        isTransparentTarget: false,
      }),
    ).rejects.toThrow(/gemini-2-5-flash review provider not implemented yet \(Task 4\)/);
  });
});

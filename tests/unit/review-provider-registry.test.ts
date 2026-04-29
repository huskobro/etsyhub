import { describe, it, expect } from "vitest";
import { getReviewProvider, listReviewProviders } from "@/providers/review/registry";

describe("Review provider registry — R17.3 + Phase 6 Aşama 2A", () => {
  it("'google-gemini-flash' provider döner (mock-tested direct Google API) + modelId", () => {
    const provider = getReviewProvider("google-gemini-flash");
    expect(provider.id).toBe("google-gemini-flash");
    expect(provider.modelId).toBe("gemini-2-5-flash");
    expect(provider.kind).toBe("vision");
    expect(typeof provider.review).toBe("function");
  });

  it("'kie-gemini-flash' provider döner (Aşama 2A canlı, modelId 'gemini-2.5-flash')", () => {
    const provider = getReviewProvider("kie-gemini-flash");
    expect(provider.id).toBe("kie-gemini-flash");
    expect(provider.modelId).toBe("gemini-2.5-flash");
    expect(provider.kind).toBe("vision");
    expect(typeof provider.review).toBe("function");
  });

  it("eski 'gemini-2-5-flash' id'si artık reddedilir (rename sonrası)", () => {
    expect(() => getReviewProvider("gemini-2-5-flash")).toThrow(
      /unknown review provider: "gemini-2-5-flash"/i,
    );
  });

  it("bilinmeyen id'de explicit throw (sessiz fallback yok)", () => {
    expect(() => getReviewProvider("nonexistent-id")).toThrow(
      /unknown review provider: "nonexistent-id"/i,
    );
    expect(() => getReviewProvider("")).toThrow(/unknown review provider/i);
  });

  it("listReviewProviders 2 provider döndürür (google-gemini-flash + kie-gemini-flash)", () => {
    const providers = listReviewProviders();
    expect(providers).toHaveLength(2);
    const ids = providers.map((p) => p.id).sort();
    expect(ids).toEqual(["google-gemini-flash", "kie-gemini-flash"]);
    for (const p of providers) {
      expect(p.kind).toBe("vision");
      expect(typeof p.review).toBe("function");
    }
  });

  it("google-gemini-flash api key olmadan çağrılırsa explicit throw", async () => {
    const provider = getReviewProvider("google-gemini-flash");
    await expect(
      provider.review(
        {
          image: { kind: "remote-url", url: "https://example.com/x.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "" },
      ),
    ).rejects.toThrow(/api key/i);
  });

  it("kie-gemini-flash Aşama 2A: api key olmadan çağrılırsa explicit throw", async () => {
    const provider = getReviewProvider("kie-gemini-flash");
    await expect(
      provider.review(
        {
          image: { kind: "remote-url", url: "https://example.com/x.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "" },
      ),
    ).rejects.toThrow(/api key missing/i);
  });

  it("kie-gemini-flash Aşama 2A: local-path image input ⇒ '2B bekleniyor' throw", async () => {
    const provider = getReviewProvider("kie-gemini-flash");
    await expect(
      provider.review(
        {
          image: { kind: "local-path", filePath: "/tmp/x.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "valid-kie-key" },
      ),
    ).rejects.toThrow(/Aşama 2B bekleniyor/);
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";
import { getScraper } from "@/providers/scraper";

describe("scraper factory", () => {
  beforeEach(async () => {
    await db.featureFlag.deleteMany({
      where: { key: { startsWith: "scraper." } },
    });
  });

  it("flag yoksa self-hosted döner", async () => {
    const s = await getScraper();
    expect(s.name).toBe("self-hosted");
  });

  it("apify seçiliyse ve key varsa apify döner", async () => {
    await db.featureFlag.create({
      data: {
        key: "scraper.active_provider",
        enabled: true,
        metadata: { provider: "apify" },
      },
    });
    await db.featureFlag.create({
      data: {
        key: "scraper.apify.api_key",
        enabled: true,
        metadata: { encrypted: encryptSecret("test-token") },
      },
    });
    const s = await getScraper();
    expect(s.name).toBe("apify");
  });

  it("apify seçili ama key yoksa hata fırlatır", async () => {
    await db.featureFlag.create({
      data: {
        key: "scraper.active_provider",
        enabled: true,
        metadata: { provider: "apify" },
      },
    });
    await expect(getScraper()).rejects.toThrow(/Apify API key/);
  });
});

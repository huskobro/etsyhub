import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  SCRAPER_PROVIDER_NAMES,
  getScraperConfig,
  updateScraperConfig,
  getActiveProviderConfig,
} from "@/providers/scraper/provider-config";

async function clearScraperFlags() {
  await db.featureFlag.deleteMany({
    where: { key: { startsWith: "scraper." } },
  });
}

describe("provider-config abstraction", () => {
  beforeEach(async () => {
    await clearScraperFlags();
  });

  it("SCRAPER_PROVIDER_NAMES self-hosted/apify/firecrawl içerir", () => {
    expect(SCRAPER_PROVIDER_NAMES).toEqual(
      expect.arrayContaining(["self-hosted", "apify", "firecrawl"]),
    );
  });

  describe("getScraperConfig", () => {
    it("flag yoksa default self-hosted + her iki key yok", async () => {
      const cfg = await getScraperConfig();
      expect(cfg.activeProvider).toBe("self-hosted");
      expect(cfg.hasApifyKey).toBe(false);
      expect(cfg.hasFirecrawlKey).toBe(false);
    });

    it("plain API key döndürmez (masking)", async () => {
      await updateScraperConfig({
        activeProvider: "apify",
        apiKeys: { apify: "super-secret-apify-token-xyz" },
      });
      const cfg = await getScraperConfig();
      expect(cfg.hasApifyKey).toBe(true);
      expect(cfg.activeProvider).toBe("apify");
      // Response'ta plain token asla olmamalı — tüm JSON string'ini tara.
      const serialized = JSON.stringify(cfg);
      expect(serialized).not.toContain("super-secret-apify-token-xyz");
      // Hiçbir alan plain token değerini taşımamalı.
      const record = cfg as unknown as Record<string, unknown>;
      for (const v of Object.values(record)) {
        expect(v).not.toBe("super-secret-apify-token-xyz");
      }
    });

    it("firecrawl key ayrı izlenir", async () => {
      await updateScraperConfig({
        apiKeys: { firecrawl: "firecrawl-plain-token" },
      });
      const cfg = await getScraperConfig();
      expect(cfg.hasFirecrawlKey).toBe(true);
      expect(cfg.hasApifyKey).toBe(false);
      const serialized = JSON.stringify(cfg);
      expect(serialized).not.toContain("firecrawl-plain-token");
    });
  });

  describe("updateScraperConfig partial semantics", () => {
    it("undefined verilen alanlara dokunmaz", async () => {
      await updateScraperConfig({
        activeProvider: "apify",
        apiKeys: { apify: "initial-token" },
      });

      // Sadece firecrawl dokunulsun — apify değişmemeli, activeProvider aynı kalmalı
      await updateScraperConfig({
        apiKeys: { firecrawl: "fc-new" },
      });

      const cfg = await getScraperConfig();
      expect(cfg.activeProvider).toBe("apify");
      expect(cfg.hasApifyKey).toBe(true);
      expect(cfg.hasFirecrawlKey).toBe(true);

      // Ayrıca internal config (factory'nin kullandığı) plain değeri hâlâ decrypt edebiliyor mu?
      const internal = await getActiveProviderConfig();
      expect(internal.apifyToken).toBe("initial-token");
      expect(internal.firecrawlToken).toBe("fc-new");
    });

    it("null verilen key silinir", async () => {
      await updateScraperConfig({
        apiKeys: { apify: "token-to-be-removed" },
      });
      let cfg = await getScraperConfig();
      expect(cfg.hasApifyKey).toBe(true);

      await updateScraperConfig({ apiKeys: { apify: null } });
      cfg = await getScraperConfig();
      expect(cfg.hasApifyKey).toBe(false);

      // Internal tarafta da null olmalı
      const internal = await getActiveProviderConfig();
      expect(internal.apifyToken).toBeNull();
    });

    it("activeProvider undefined ise değişmez", async () => {
      await updateScraperConfig({ activeProvider: "firecrawl" });
      await updateScraperConfig({ apiKeys: { apify: "x".repeat(20) } });
      const cfg = await getScraperConfig();
      expect(cfg.activeProvider).toBe("firecrawl");
    });

    it("plain key DB'de düz metin olarak saklanmaz (encrypt)", async () => {
      const plain = "plain-apify-token-very-unique-123456";
      await updateScraperConfig({ apiKeys: { apify: plain } });

      const row = await db.featureFlag.findUnique({
        where: { key: "scraper.apify.api_key" },
      });
      expect(row).not.toBeNull();
      // metadata.encrypted plain değeri içermemeli
      const meta = (row?.metadata ?? {}) as { encrypted?: string };
      expect(meta.encrypted).toBeDefined();
      expect(meta.encrypted).not.toContain(plain);
      // iv:tag:cipher format doğrulaması
      expect(meta.encrypted?.split(":")).toHaveLength(3);
    });
  });
});

import { describe, expect, it } from "vitest";
import { mapApifyItemToScrapedListing } from "@/providers/scraper/apify-provider";

// Tam dolu Apify item fixture
const fullItem: Record<string, unknown> = {
  listingId: "987654321",
  url: "https://www.etsy.com/listing/987654321/some-art",
  title: "Boho Wall Art Canvas Print",
  images: [
    "https://i.etsystatic.com/img1.jpg",
    "https://i.etsystatic.com/img2.jpg",
  ],
  price: 24.99,
  currency: "USD",
  reviewCount: 145,
  favorers: 320,
  creationTimestamp: 1713870000, // Unix saniye → 2024-04-23
  latestReviewAt: "2025-12-01T00:00:00.000Z",
};

describe("mapApifyItemToScrapedListing", () => {
  describe("happy path — tam dolu item", () => {
    it("externalId doğru atanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.externalId).toBe("987654321");
    });

    it("platform ETSY olur", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.platform).toBe("ETSY");
    });

    it("title doğru atanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.title).toBe("Boho Wall Art Canvas Print");
    });

    it("imageUrls dolu gelir", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls[0]).toBe("https://i.etsystatic.com/img1.jpg");
    });

    it("thumbnailUrl imageUrls[0]'dır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.thumbnailUrl).toBe("https://i.etsystatic.com/img1.jpg");
    });

    it("priceCents doğru hesaplanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.priceCents).toBe(2499);
    });

    it("currency atanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.currency).toBe("USD");
    });

    it("reviewCount atanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.reviewCount).toBe(145);
    });

    it("favoritesCount atanır", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.favoritesCount).toBe(320);
    });

    it("parserSource 'apify' olur", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.parserSource).toBe("apify");
    });

    it("parserConfidence 90 olur (tam dolu item)", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.parserConfidence).toBe(90);
    });

    it("parseWarnings boş array olur", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.parseWarnings).toEqual([]);
    });

    it("listingCreatedAt doğru Date'e çevrilir (Unix saniye)", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.listingCreatedAt).toBeInstanceOf(Date);
      // 1713870000 saniye → 1713870000000 ms → 2024-04-23T...
      expect(result.listingCreatedAt!.getFullYear()).toBe(2024);
      expect(result.listingCreatedAt!.getMonth()).toBe(3); // Nisan = index 3
    });

    it("latestReviewAt ISO string'den doğru Date'e çevrilir", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.latestReviewAt).toBeInstanceOf(Date);
      expect(result.latestReviewAt!.getFullYear()).toBe(2025);
      expect(result.latestReviewAt!.getMonth()).toBe(11); // Aralık = index 11
    });

    it("rawMetadata orijinal item'ı içerir", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.rawMetadata).toBe(fullItem);
    });

    it("status ACTIVE olur", () => {
      const result = mapApifyItemToScrapedListing(fullItem);
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("partial path — eksik alanlar", () => {
    const partialItem: Record<string, unknown> = {
      listingId: "111",
      url: "https://www.etsy.com/listing/111/art",
      // title yok
      images: [], // boş
      // price yok
      currency: "EUR",
      // reviewCount yok
      favorers: 10,
      creationTimestamp: 1713870000,
    };

    it("parseWarnings en az 3 uyarı içerir (title, price, reviewCount, images)", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      // title eksik, images boş, reviewCount yok → 3 uyarı bekleniyor
      expect(result.parseWarnings.length).toBeGreaterThanOrEqual(3);
    });

    it("title eksikse parseWarnings'te 'Apify item title eksik' var", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.parseWarnings).toContain("Apify item title eksik");
    });

    it("images boşsa parseWarnings'te 'Görsel listesi boş' var", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.parseWarnings).toContain("Görsel listesi boş");
    });

    it("reviewCount eksikse parseWarnings'te 'Review count Apify item'da yok' var", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.parseWarnings).toContain("Review count Apify item'da yok");
    });

    it("parserConfidence < 90 olur (eksik field'lar)", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.parserConfidence).toBeLessThan(90);
    });

    it("priceCents null gelir (price yok)", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.priceCents).toBeNull();
    });

    it("thumbnailUrl null gelir (images boş)", () => {
      const result = mapApifyItemToScrapedListing(partialItem);
      expect(result.thumbnailUrl).toBeNull();
    });
  });

  describe("timestamp — Unix saniye vs milisaniye ayrımı", () => {
    it("10 haneli Unix saniye doğru yıla çevrilir", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        creationTimestamp: 1713870000, // saniye → 2024
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.listingCreatedAt!.getFullYear()).toBe(2024);
    });

    it("13 haneli Unix milisaniye doğru yıla çevrilir", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        creationTimestamp: 1713870000000, // milisaniye → 2024
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.listingCreatedAt!.getFullYear()).toBe(2024);
    });

    it("ISO string timestamp doğru Date'e çevrilir", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        creationTimestamp: "2024-04-23T10:30:00.000Z",
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.listingCreatedAt).toBeInstanceOf(Date);
      expect(result.listingCreatedAt!.getFullYear()).toBe(2024);
    });

    it("geçersiz timestamp null döner ve warning eklenir", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        creationTimestamp: "not-a-date",
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.listingCreatedAt).toBeNull();
      expect(result.parseWarnings.some((w) => w.includes("creationTimestamp"))).toBe(true);
    });
  });

  describe("alternatif field isimleri", () => {
    it("id field'ı listingId yoksa fallback olarak kullanılır", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        listingId: undefined,
        id: "ABC123",
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.externalId).toBe("ABC123");
    });

    it("numberOfReviews field'ı reviewCount'ın alternatifi olarak çalışır", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        reviewCount: undefined,
        numberOfReviews: 77,
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.reviewCount).toBe(77);
    });

    it("lastReviewDate field'ı latestReviewAt'ın alternatifi olarak çalışır", () => {
      const item: Record<string, unknown> = {
        ...fullItem,
        latestReviewAt: undefined,
        lastReviewDate: "2025-06-15T00:00:00.000Z",
      };
      const result = mapApifyItemToScrapedListing(item);
      expect(result.latestReviewAt).toBeInstanceOf(Date);
      expect(result.latestReviewAt!.getFullYear()).toBe(2025);
    });
  });
});

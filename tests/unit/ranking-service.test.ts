import { describe, expect, it } from "vitest";
import {
  rankListingsByReviews,
  filterByWindow,
  REVIEW_COUNT_DISCLAIMER,
} from "@/features/competitors/services/ranking-service";

const now = new Date("2026-04-23T00:00:00Z");

const makeListing = (
  reviewCount: number,
  latestReviewAt: Date | null = null,
  listingCreatedAt: Date | null = null,
) => ({ reviewCount, latestReviewAt, listingCreatedAt });

describe("rankListingsByReviews", () => {
  it("reviewCount desc sıralar", () => {
    const result = rankListingsByReviews([
      makeListing(10),
      makeListing(50),
      makeListing(20),
    ]);
    expect(result.map((l) => l.reviewCount)).toEqual([50, 20, 10]);
  });

  it("tek eleman değişmeden döner", () => {
    const result = rankListingsByReviews([makeListing(42)]);
    expect(result[0]?.reviewCount).toBe(42);
  });

  it("boş liste boş döner", () => {
    expect(rankListingsByReviews([])).toHaveLength(0);
  });

  it("orijinal diziyi mutate etmez", () => {
    const original = [makeListing(1), makeListing(3), makeListing(2)];
    rankListingsByReviews(original);
    expect(original[0]?.reviewCount).toBe(1);
  });
});

describe("filterByWindow", () => {
  it("all window hiç elemez", () => {
    const items = [
      makeListing(1, new Date("2020-01-01")),
      makeListing(2, now),
    ];
    expect(filterByWindow(items, "all", now)).toHaveLength(2);
  });

  it("30d window: latestReviewAt içinde → dahil", () => {
    const items = [
      makeListing(100, new Date("2026-04-20")), // window içinde
      makeListing(50, new Date("2026-01-01")),  // window dışında
    ];
    const result = filterByWindow(items, "30d", now);
    expect(result).toHaveLength(1);
    expect(result[0]?.reviewCount).toBe(100);
  });

  it("30d window: latestReviewAt null, listingCreatedAt içinde → dahil", () => {
    const items = [
      makeListing(10, null, new Date("2026-04-20")), // listingCreatedAt içinde
      makeListing(5, null, new Date("2025-01-01")),  // listingCreatedAt dışında
    ];
    const result = filterByWindow(items, "30d", now);
    expect(result).toHaveLength(1);
    expect(result[0]?.reviewCount).toBe(10);
  });

  it("30d window: latestReviewAt ve listingCreatedAt her ikisi null → dahil", () => {
    const items = [makeListing(7, null, null)];
    const result = filterByWindow(items, "30d", now);
    expect(result).toHaveLength(1);
  });

  it("90d window doğru cutoff kullanır", () => {
    const items = [
      makeListing(10, new Date("2026-02-10")), // 90 gün öncesi ~25 Ocak — içinde
      makeListing(5, new Date("2025-12-01")),  // çok eski — dışında
    ];
    const result = filterByWindow(items, "90d", now);
    expect(result).toHaveLength(1);
    expect(result[0]?.reviewCount).toBe(10);
  });

  it("365d window doğru cutoff kullanır", () => {
    const items = [
      makeListing(10, new Date("2026-01-01")), // içinde
      makeListing(5, new Date("2024-01-01")),  // dışında
    ];
    const result = filterByWindow(items, "365d", now);
    expect(result).toHaveLength(1);
    expect(result[0]?.reviewCount).toBe(10);
  });
});

describe("REVIEW_COUNT_DISCLAIMER", () => {
  it("boş değil ve string", () => {
    expect(typeof REVIEW_COUNT_DISCLAIMER).toBe("string");
    expect(REVIEW_COUNT_DISCLAIMER.length).toBeGreaterThan(10);
  });
});

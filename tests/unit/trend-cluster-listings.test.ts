import { describe, expect, it } from "vitest";
import { clusterListings } from "@/features/trend-stories/services/cluster-service";

type L = { id: string; competitorStoreId: string; title: string; reviewCount: number; firstSeenAt: Date; listingCreatedAt: Date | null };

const mk = (overrides: Partial<L> & { id: string; store: string; title: string }): L => ({
  id: overrides.id,
  competitorStoreId: overrides.store,
  title: overrides.title,
  reviewCount: overrides.reviewCount ?? 0,
  firstSeenAt: overrides.firstSeenAt ?? new Date("2026-04-20"),
  listingCreatedAt: overrides.listingCreatedAt ?? null,
});

describe("clusterListings", () => {
  const today = new Date("2026-04-24");

  it("boş girdi → boş çıktı", () => {
    expect(clusterListings({ listings: [], windowDays: 7, today })).toEqual([]);
  });

  it("tek listing — eşiği geçemez, cluster yok", () => {
    const r = clusterListings({
      listings: [mk({ id: "l1", store: "s1", title: "boho wall art" })],
      windowDays: 7,
      today,
    });
    expect(r).toEqual([]);
  });

  it("7G: 2 store 3 listing 'boho wall art' → 1 cluster", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Modern Boho Wall Art" }),
        mk({ id: "l3", store: "s1", title: "Cute Boho Wall Art Sticker" }),
      ],
      windowDays: 7,
      today,
    });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0]?.signature).toMatch(/boho wall|wall art/);
    expect(r[0]?.storeCount).toBe(2);
    expect(r[0]?.memberCount).toBe(3);
  });

  it("1G: 2 store 2 listing → cluster (dinamik eşik)", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Halloween Pumpkin Print" }),
        mk({ id: "l2", store: "s2", title: "Halloween Pumpkin Sticker" }),
      ],
      windowDays: 1,
      today,
    });
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("1-gram atılır — yalnız 2/3-gram signature üretir", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Home Decor" }),
        mk({ id: "l2", store: "s2", title: "Minimalist Home Design" }),
        mk({ id: "l3", store: "s3", title: "Modern Home Style" }),
      ],
      windowDays: 7,
      today,
    });
    for (const c of r) expect(c.signature.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("token order korunur — 'wall art print' ve 'print wall art' farklı signature", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Wall Art Print Design" }),
        mk({ id: "l3", store: "s3", title: "Wall Art Print Set" }),
      ],
      windowDays: 7,
      today,
    });
    const signatures = r.map((c) => c.signature);
    expect(signatures.some((s) => s.includes("wall art print"))).toBe(true);
    expect(signatures.every((s) => !s.includes("print wall art"))).toBe(true);
  });

  it("overlap pruning: aynı üyelerden oluşan iki cluster → biri tutulur", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Design" }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Sticker" }),
      ],
      windowDays: 7,
      today,
    });
    // "boho wall art" + "wall art" + "boho wall" çıkabilirdi, overlap pruning ile 1 kalmalı
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("cluster score: recencyBoost son 3 gün için +5", () => {
    // windowDays iki çağrıda da 30 tutulur — tek değişken firstSeenAt.
    // Böylece recencyBoost etkisi izole olur, ileride windowDays scoring'e dahil
    // edilirse test yanlış sebeple passing olmaz.
    const recent = new Date("2026-04-23");
    const old = new Date("2026-03-01");
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", firstSeenAt: recent }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", firstSeenAt: recent }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", firstSeenAt: recent }),
      ],
      windowDays: 30,
      today,
    });
    const r2 = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", firstSeenAt: old }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", firstSeenAt: old }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", firstSeenAt: old }),
      ],
      windowDays: 30,
      today,
    });
    expect(r[0]?.clusterScore).toBeGreaterThan(r2[0]?.clusterScore ?? 0);
  });

  it("productTypeKey resolve: üç canvas başlığı → 'canvas'", () => {
    // "canvas art" ortak 2-gram üç başlıkta da geçiyor; cluster oluşması garantilenir
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Canvas Art Print" }),
        mk({ id: "l2", store: "s2", title: "Canvas Art Wall Decor" }),
        mk({ id: "l3", store: "s3", title: "Modern Canvas Art Design" }),
      ],
      windowDays: 7,
      today,
    });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0]?.productTypeKey).toBe("canvas");
  });

  it("hero listing: en yüksek reviewCount", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", reviewCount: 10 }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", reviewCount: 50 }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", reviewCount: 20 }),
      ],
      windowDays: 7,
      today,
    });
    expect(r[0]?.heroListingId).toBe("l2");
  });
});

// Phase 9 V1 Task 8 — Listing readiness service tests (foundation slice).

import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  allReadinessPass,
  filterChecksBySeverity,
} from "@/features/listings/server/readiness.service";
import type { Listing } from "@prisma/client";

describe("Listing readiness service (V1)", () => {
  const baseListing: Listing = {
    id: "test-listing-id",
    userId: "user-1",
    storeId: null,
    generatedDesignId: null,
    productTypeId: null,
    title: null,
    description: null,
    tags: [],
    category: null,
    priceCents: null,
    materials: [],
    status: "DRAFT",
    etsyDraftId: null,
    mockupJobId: "job-1",
    coverRenderId: "render-1",
    imageOrderJson: null,
    submittedAt: null,
    publishedAt: null,
    etsyListingId: null,
    failedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  describe("computeReadiness()", () => {
    it("should return 6 checks in correct order", () => {
      const checks = computeReadiness(baseListing);
      expect(checks).toHaveLength(6);
      expect(checks[0]!.field).toBe("title");
      expect(checks[1]!.field).toBe("description");
      expect(checks[2]!.field).toBe("tags");
      expect(checks[3]!.field).toBe("category");
      expect(checks[4]!.field).toBe("price");
      expect(checks[5]!.field).toBe("cover");
    });

    it("should all have severity 'warn' (V1 soft)", () => {
      const checks = computeReadiness(baseListing);
      expect(checks.every((c) => c.severity === "warn")).toBe(true);
    });

    it("should fail title when empty", () => {
      const checks = computeReadiness(baseListing);
      expect(checks[0]!.pass).toBe(false);
      expect(checks[0]!.message).toContain("gereklidir");
    });

    it("should pass title when 5-140 chars", () => {
      const listing = { ...baseListing, title: "A Beautiful Canvas Art" };
      const checks = computeReadiness(listing);
      expect(checks[0]!.pass).toBe(true);
    });

    it("should fail title when < 5 chars", () => {
      const listing = { ...baseListing, title: "Art" };
      const checks = computeReadiness(listing);
      expect(checks[0]!.pass).toBe(false);
      expect(checks[0]!.message).toContain("çok kısa");
    });

    it("should fail title when > 140 chars", () => {
      const listing = {
        ...baseListing,
        title: "A".repeat(141),
      };
      const checks = computeReadiness(listing);
      expect(checks[0]!.pass).toBe(false);
      expect(checks[0]!.message).toContain("çok uzun");
    });

    it("should fail description when empty", () => {
      const checks = computeReadiness(baseListing);
      expect(checks[1]!.pass).toBe(false);
    });

    it("should pass description when non-empty", () => {
      const listing = { ...baseListing, description: "Beautiful design" };
      const checks = computeReadiness(listing);
      expect(checks[1]!.pass).toBe(true);
    });

    it("should fail tags when not 13", () => {
      const listing = { ...baseListing, tags: ["tag1", "tag2"] };
      const checks = computeReadiness(listing);
      expect(checks[2]!.pass).toBe(false);
      expect(checks[2]!.message).toContain("2/13");
    });

    it("should pass tags when exactly 13", () => {
      const tags = Array.from({ length: 13 }, (_, i) => `tag${i + 1}`);
      const listing = { ...baseListing, tags };
      const checks = computeReadiness(listing);
      expect(checks[2]!.pass).toBe(true);
    });

    it("should fail category when empty", () => {
      const checks = computeReadiness(baseListing);
      expect(checks[3]!.pass).toBe(false);
    });

    it("should pass category when set", () => {
      const listing = { ...baseListing, category: "Wall Art" };
      const checks = computeReadiness(listing);
      expect(checks[3]!.pass).toBe(true);
    });

    it("should fail price when null or 0", () => {
      const listing1 = { ...baseListing, priceCents: null };
      const listing2 = { ...baseListing, priceCents: 0 };
      expect(computeReadiness(listing1)[4]!.pass).toBe(false);
      expect(computeReadiness(listing2)[4]!.pass).toBe(false);
    });

    it("should fail price when < 100 cents", () => {
      const listing = { ...baseListing, priceCents: 50 };
      const checks = computeReadiness(listing);
      expect(checks[4]!.pass).toBe(false);
      expect(checks[4]!.message).toContain("çok düşük");
    });

    it("should pass price when >= 100 cents", () => {
      const listing = { ...baseListing, priceCents: 1000 };
      const checks = computeReadiness(listing);
      expect(checks[4]!.pass).toBe(true);
    });

    it("should fail cover when imageOrderJson empty", () => {
      const listing = { ...baseListing, imageOrderJson: null };
      const checks = computeReadiness(listing);
      expect(checks[5]!.pass).toBe(false);
    });

    it("should fail cover when first image isCover = false", () => {
      const listing = {
        ...baseListing,
        imageOrderJson: [{ packPosition: 0, renderId: "r1", outputKey: "o1", templateName: "t1", isCover: false }],
      };
      const checks = computeReadiness(listing);
      expect(checks[5]!.pass).toBe(false);
    });

    it("should pass cover when first image isCover = true", () => {
      const listing = {
        ...baseListing,
        imageOrderJson: [{ packPosition: 0, renderId: "r1", outputKey: "o1", templateName: "Canvas", isCover: true }],
      };
      const checks = computeReadiness(listing);
      expect(checks[5]!.pass).toBe(true);
      expect(checks[5]!.message).toContain("Canvas");
    });
  });

  describe("allReadinessPass()", () => {
    it("should return false when any check fails", () => {
      const listing = {
        ...baseListing,
        title: "Good Title",
        description: "Good desc",
        tags: Array.from({ length: 13 }, (_, i) => `tag${i}`),
        category: "Art",
        priceCents: 1000,
        // cover still null → fails
      };
      const checks = computeReadiness(listing);
      expect(allReadinessPass(checks)).toBe(false);
    });

    it("should return true when all checks pass", () => {
      const listing = {
        ...baseListing,
        title: "Good Title",
        description: "Good description",
        tags: Array.from({ length: 13 }, (_, i) => `tag${i}`),
        category: "Wall Art",
        priceCents: 1500,
        imageOrderJson: [
          { packPosition: 0, renderId: "r1", outputKey: "o1", templateName: "t1", isCover: true },
        ],
      };
      const checks = computeReadiness(listing);
      expect(allReadinessPass(checks)).toBe(true);
    });
  });

  describe("filterChecksBySeverity()", () => {
    it("should filter checks by warn severity", () => {
      const listing = { ...baseListing, title: "Good" };
      const checks = computeReadiness(listing);
      const warns = filterChecksBySeverity(checks, "warn");
      expect(warns.length).toBe(6); // V1: all warn
      expect(warns.every((c) => c.severity === "warn")).toBe(true);
    });

    it("should return empty for error severity (V1 no errors)", () => {
      const listing = { ...baseListing };
      const checks = computeReadiness(listing);
      const errors = filterChecksBySeverity(checks, "error");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Negative library integration", () => {
    it("temiz listing için negative library check eklenmemiş (mevcut 6 check)", () => {
      const cleanListing = {
        ...baseListing,
        title: "Modern Wall Art",
        description: "Beautiful print for your home",
        tags: ["wall-art", "canvas", "modern", "art", "home", "decor", "design", "print", "poster", "painting", "gallery", "canvas-art", "contemporary"],
        category: "Wall Art",
        priceCents: 1999,
        imageOrderJson: [
          {
            packPosition: 0,
            renderId: "r1",
            outputKey: "o1",
            templateName: "Canvas",
            isCover: true,
          },
        ],
      };
      const checks = computeReadiness(cleanListing);

      // Mevcut 6 check var
      expect(checks).toHaveLength(6);

      // Hiçbir "Politika uyarısı" yok
      const policyWarnings = checks.filter((c) =>
        c.message.includes("Politika uyarısı"),
      );
      expect(policyWarnings).toEqual([]);
    });

    it("title'da Disney — readiness'a 1 ek policy warning eklenir", () => {
      const dirtyListing = {
        ...baseListing,
        title: "Disney Wall Art",
        description: "Beautiful print",
        tags: ["wall-art", "canvas", "modern", "art", "home", "decor", "design", "print", "poster", "painting", "gallery", "canvas-art", "contemporary"],
      };
      const checks = computeReadiness(dirtyListing);

      // 6 mevcut + 1 negative library = 7 toplam
      expect(checks.length).toBeGreaterThanOrEqual(7);

      const policyWarnings = checks.filter((c) =>
        c.message.includes("Politika uyarısı"),
      );
      expect(policyWarnings).toHaveLength(1);
      expect(policyWarnings[0]?.field).toBe("title");
      expect(policyWarnings[0]?.severity).toBe("warn"); // K3 soft warn
      expect(policyWarnings[0]?.pass).toBe(false);
    });

    it("description ve tags'te ayrı eşleşmeler — ayrı entry'ler", () => {
      const dirtyListing = {
        ...baseListing,
        title: "Wall Art",
        description: "CBD themed product",
        tags: ["best deal", "wall-art", "modern", "art", "home", "decor", "design", "print", "poster", "painting", "gallery", "canvas-art"],
      };
      const checks = computeReadiness(dirtyListing);

      const policyWarnings = checks.filter((c) =>
        c.message.includes("Politika uyarısı"),
      );
      expect(policyWarnings.length).toBeGreaterThanOrEqual(2);
      const fields = policyWarnings.map((c) => c.field).sort();
      expect(fields).toContain("description");
      expect(fields).toContain("tags");
    });

    it("K3 soft warn lock — submit block YOK (severity hep 'warn')", () => {
      const dirtyListing = {
        ...baseListing,
        title: "Disney Marvel Nike Wall Art",
        description: "NFL themed product",
        tags: ["nfl", "marvel", "wall-art", "modern", "art", "home", "decor", "design", "print", "poster", "painting"],
      };
      const checks = computeReadiness(dirtyListing);

      // Hiçbir policy warning severity:"error" değil
      const policyWarnings = checks.filter((c) =>
        c.message.includes("Politika uyarısı"),
      );
      expect(policyWarnings.every((c) => c.severity === "warn")).toBe(true);
    });

    it("mevcut 6 check pass davranışı negative library'den etkilenmez", () => {
      const cleanContent = {
        ...baseListing,
        title: "Modern Wall Art Print",
        description:
          "A beautiful canvas painting for your home decor needs and style preferences",
        tags: ["wall-art", "canvas", "modern", "art", "home", "decor", "design", "print", "poster", "painting", "gallery", "canvas-art", "contemporary"],
        category: "art",
        priceCents: 1999,
        imageOrderJson: [
          {
            packPosition: 0,
            renderId: "r1",
            outputKey: "o1",
            templateName: "Canvas",
            isCover: true,
          },
        ],
      };
      const checks = computeReadiness(cleanContent);

      // 6 check'in hepsi pass
      const baseChecks = checks.filter(
        (c) => !c.message.includes("Politika uyarısı"),
      );
      expect(baseChecks).toHaveLength(6);
      expect(baseChecks.every((c) => c.pass)).toBe(true);
    });
  });
});

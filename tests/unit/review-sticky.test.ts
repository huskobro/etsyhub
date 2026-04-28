import { describe, it, expect } from "vitest";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { applyReviewDecisionWithSticky } from "@/server/services/review/sticky";

describe("applyReviewDecisionWithSticky (R12) — USER sticky", () => {
  it("USER source mevcut + SYSTEM yeniden değerlendiriyor ⇒ shouldUpdate false", () => {
    const result = applyReviewDecisionWithSticky({
      current: { status: ReviewStatus.APPROVED, source: ReviewStatusSource.USER },
      systemDecision: ReviewStatus.NEEDS_REVIEW,
    });
    expect(result.shouldUpdate).toBe(false);
    // Discriminated union: shouldUpdate=false ⇒ newStatus alanı yok.
    if (result.shouldUpdate === false) {
      expect(Object.keys(result)).toEqual(["shouldUpdate"]);
    }
  });

  it("SYSTEM source mevcut ⇒ SYSTEM yeni karar yazabilir", () => {
    const result = applyReviewDecisionWithSticky({
      current: { status: ReviewStatus.NEEDS_REVIEW, source: ReviewStatusSource.SYSTEM },
      systemDecision: ReviewStatus.APPROVED,
    });
    expect(result.shouldUpdate).toBe(true);
    if (result.shouldUpdate === true) {
      expect(result.newStatus).toBe(ReviewStatus.APPROVED);
      expect(result.newSource).toBe(ReviewStatusSource.SYSTEM);
    }
  });

  it("İlk review (current null) ⇒ SYSTEM yazar", () => {
    const result = applyReviewDecisionWithSticky({
      current: null,
      systemDecision: ReviewStatus.APPROVED,
    });
    expect(result.shouldUpdate).toBe(true);
    if (result.shouldUpdate === true) {
      expect(result.newSource).toBe(ReviewStatusSource.SYSTEM);
      expect(result.newStatus).toBe(ReviewStatus.APPROVED);
    }
  });

  it("USER source × tüm 4 ReviewStatus ⇒ hepsi sticky", () => {
    const statuses = [
      ReviewStatus.PENDING,
      ReviewStatus.APPROVED,
      ReviewStatus.NEEDS_REVIEW,
      ReviewStatus.REJECTED,
    ];
    for (const status of statuses) {
      const result = applyReviewDecisionWithSticky({
        current: { status, source: ReviewStatusSource.USER },
        systemDecision: ReviewStatus.NEEDS_REVIEW,
      });
      expect(result.shouldUpdate).toBe(false);
    }
  });
});

import { describe, it, expect } from "vitest";
import { ReviewStatus } from "@prisma/client";
import { decideReviewStatus } from "@/server/services/review/decision";
import type { ReviewRiskFlag } from "@/providers/review/types";

const noFlags: ReviewRiskFlag[] = [];
const oneFlag: ReviewRiskFlag[] = [
  { type: "watermark_detected", confidence: 0.9, reason: "köşede silik imza" },
];

describe("decideReviewStatus (R8) — karar kuralı", () => {
  it("risk_flags > 0 ⇒ NEEDS_REVIEW (score yüksek olsa bile)", () => {
    expect(decideReviewStatus({ score: 95, riskFlags: oneFlag })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("score < 60 ⇒ NEEDS_REVIEW (risk yok olsa bile)", () => {
    expect(decideReviewStatus({ score: 55, riskFlags: noFlags })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("score >= 90 + risk_flags == [] ⇒ APPROVED", () => {
    expect(decideReviewStatus({ score: 95, riskFlags: noFlags })).toBe(
      ReviewStatus.APPROVED,
    );
  });

  it("60 <= score < 90 + risk_flags == [] ⇒ NEEDS_REVIEW (güvenli varsayılan)", () => {
    expect(decideReviewStatus({ score: 75, riskFlags: noFlags })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("sınır: score === 60 ⇒ NEEDS_REVIEW (sıkı alt sınır, < kontrolü)", () => {
    expect(decideReviewStatus({ score: 60, riskFlags: noFlags })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("sınır: score === 90 ⇒ APPROVED (sıkı üst sınır, >= kontrolü)", () => {
    expect(decideReviewStatus({ score: 90, riskFlags: noFlags })).toBe(
      ReviewStatus.APPROVED,
    );
  });

  it("sınır: score === 89 ⇒ NEEDS_REVIEW (90'ın bir altı)", () => {
    expect(decideReviewStatus({ score: 89, riskFlags: noFlags })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("sınır: score === 59 ⇒ NEEDS_REVIEW (60'ın bir altı)", () => {
    expect(decideReviewStatus({ score: 59, riskFlags: noFlags })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });

  it("risk_flags + düşük score ⇒ NEEDS_REVIEW (risk önceliği test)", () => {
    expect(decideReviewStatus({ score: 30, riskFlags: oneFlag })).toBe(
      ReviewStatus.NEEDS_REVIEW,
    );
  });
});

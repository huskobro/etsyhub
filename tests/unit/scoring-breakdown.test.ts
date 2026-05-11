// IA-38 — computeScoringBreakdown deterministic, severity-agnostic
// score modeli.
//
// Sözleşme:
//   finalScore = clamp(0, 100, 100 − Σ weight(failed applicable criteria))
//
// Severity (`blocker` / `warning`) score'u etkilemez — yalnız UI tone
// + AI suggestion presentation katmanı için kullanılır. blocker fail
// → `hasBlockerFail` flag ama score üzerinde direkt etki YOK. Eski
// "blockerForce = 100 hidden zero" davranışı IA-38'de kaldırıldı.
//
// Operatör bir kriterin score'u 0'a çekmesini isterse admin paneline
// gidip o kriterin weight'ini 100'e set eder. Davranış görünür ve
// düzenlenebilir.

import { describe, it, expect } from "vitest";
import { computeScoringBreakdown } from "@/server/services/review/decision";
import type { ReviewCriterion } from "@/providers/review/criteria";

const C = (
  id: string,
  severity: "blocker" | "warning",
  weight: number,
): ReviewCriterion =>
  ({
    id,
    label: id,
    description: id,
    blockText: id,
    active: true,
    weight,
    severity,
    applicability: {
      productTypes: null,
      formats: null,
      transparency: null,
      requiresAnyTransform: null,
      sourceKinds: null,
    },
    family: "semantic",
    version: "1.0",
  }) as ReviewCriterion;

describe("computeScoringBreakdown — IA-38 weight-only model", () => {
  it("hiç failed flag yok → score 100", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: [],
      criteria: [C("a", "warning", 20), C("b", "blocker", 30)],
    });
    expect(r.finalScore).toBe(100);
    expect(r.hasBlockerFail).toBe(false);
  });

  it("warning fail (weight=20) → score 80", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["a"],
      criteria: [C("a", "warning", 20)],
    });
    expect(r.finalScore).toBe(80);
    expect(r.hasBlockerFail).toBe(false);
  });

  it("blocker fail weight=25 → score 75 (NOT 0 — IA-38 weight-only)", () => {
    // Eski davranış: blocker → score 0 zorlanırdı (blockerForce=100).
    // Yeni: weight kadar düşer.
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["b"],
      criteria: [C("b", "blocker", 25)],
    });
    expect(r.finalScore).toBe(75);
    expect(r.hasBlockerFail).toBe(true); // tone/advisory için flag
  });

  it("blocker weight=100 → score 0 (operatör admin'de 100 set etti)", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["b"],
      criteria: [C("b", "blocker", 100)],
    });
    expect(r.finalScore).toBe(0);
    expect(r.hasBlockerFail).toBe(true);
  });

  it("birden çok failed → weightler toplanır, 0'da clamp olur", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["a", "b", "c"],
      criteria: [
        C("a", "warning", 40),
        C("b", "blocker", 50),
        C("c", "warning", 30), // toplam 120 → clamp 0
      ],
    });
    expect(r.finalScore).toBe(0);
    expect(r.hasBlockerFail).toBe(true);
  });

  it("warning weight=20 + blocker weight=25 → score 55 (toplam 45 düşer)", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["a", "b"],
      criteria: [C("a", "warning", 20), C("b", "blocker", 25)],
    });
    expect(r.finalScore).toBe(55);
    expect(r.hasBlockerFail).toBe(true);
  });

  it("provider raw asla score'u etkilemez (audit only)", () => {
    const r = computeScoringBreakdown({
      providerRaw: 999,
      riskFlagKinds: [],
      criteria: [C("a", "warning", 20)],
    });
    expect(r.finalScore).toBe(100);
    expect(r.providerRaw).toBe(999);
  });

  it("aynı failed kinds + aynı criteria = aynı score (deterministic)", () => {
    const args = {
      providerRaw: 0,
      riskFlagKinds: ["a", "b"],
      criteria: [C("a", "warning", 20), C("b", "blocker", 30)],
    };
    const r1 = computeScoringBreakdown(args);
    const r2 = computeScoringBreakdown(args);
    expect(r1.finalScore).toBe(r2.finalScore);
    expect(r1.finalScore).toBe(50); // 100 − 20 − 30
  });

  it("contributions her kriter için weight ve subtracted'i raporlar", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["b"],
      criteria: [C("a", "warning", 20), C("b", "blocker", 30)],
    });
    expect(r.contributions).toEqual([
      { id: "a", severity: "warning", weight: 20, failed: false, subtracted: 0 },
      { id: "b", severity: "blocker", weight: 30, failed: true, subtracted: 30 },
    ]);
  });

  it("IA-38b — composeContext geçilirse N/A kriterler score'a düşmez", () => {
    // no_alpha_channel benzeri: transparency: true istiyor, asset JPEG.
    // Bu kriter "Not applicable" — score'a düşmemeli.
    const naCriterion = {
      id: "needs_alpha",
      label: "Alpha required",
      description: "Asset must have alpha",
      blockText: "alpha required",
      active: true,
      weight: 20,
      severity: "blocker",
      applicability: {
        productTypes: null,
        formats: ["png"], // JPEG için N/A
        transparency: true,
        requiresAnyTransform: null,
        sourceKinds: null,
      },
      family: "technical",
      version: "1.0",
    } as unknown as ReviewCriterion;
    const textCriterion = C("text_detected", "warning", 10);

    // Context yok → N/A bilinmiyor, naCriterion score'a düşer (eski davranış)
    const withoutCtx = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["needs_alpha", "text_detected"],
      criteria: [naCriterion, textCriterion],
    });
    expect(withoutCtx.finalScore).toBe(70); // 100 - 20 - 10

    // Context var (JPEG) → naCriterion N/A → score'a düşmez
    const withCtx = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["needs_alpha", "text_detected"],
      criteria: [naCriterion, textCriterion],
      composeContext: {
        productType: "clipart",
        format: "jpeg",
        hasAlpha: false,
        sourceKind: "local-library",
        transformsApplied: [],
      },
    });
    expect(withCtx.finalScore).toBe(90); // 100 - 10 (alpha N/A → atlanır)
  });

  it("IA-38b — duplicate kind'lar Set ile unique, weight tek sayılır", () => {
    const r = computeScoringBreakdown({
      providerRaw: 0,
      riskFlagKinds: ["a", "a", "a"], // 3x duplicate
      criteria: [C("a", "warning", 25)],
    });
    expect(r.finalScore).toBe(75); // 100 - 25 (75 değil 25 değil 0)
  });
});

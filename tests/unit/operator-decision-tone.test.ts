// IA-31 — operator-decision tone helpers
//
// Sözleşmeyi kilitler:
//   • getAiScoreTone threshold-aware ve 5 kademe (critical/poor/warning/
//     caution/success/neutral). Sabit magic number YOK.
//   • Risk flag score rengini EZMEZ — risk ayrı `getRiskTone` helper'ında.
//   • getOperatorDecision SADECE reviewStatusSource === USER iken
//     Kept/Rejected üretir.

import { describe, it, expect } from "vitest";
import {
  getOperatorDecision,
  operatorDecisionLabel,
  getAiScoreTone,
  getAiScoreDistanceLabel,
  getRiskTone,
  riskIndicatorLabel,
} from "@/features/review/lib/operator-decision";

describe("getOperatorDecision — operator damgası canonical (Madde V)", () => {
  it("SYSTEM source ile APPROVED → UNDECIDED (advisory, operator değil)", () => {
    expect(
      getOperatorDecision({
        reviewStatus: "APPROVED",
        reviewStatusSource: "SYSTEM",
      }),
    ).toBe("UNDECIDED");
  });

  it("USER source + APPROVED → KEPT", () => {
    expect(
      getOperatorDecision({
        reviewStatus: "APPROVED",
        reviewStatusSource: "USER",
      }),
    ).toBe("KEPT");
  });

  it("USER source + REJECTED → REJECTED", () => {
    expect(
      getOperatorDecision({
        reviewStatus: "REJECTED",
        reviewStatusSource: "USER",
      }),
    ).toBe("REJECTED");
  });

  it("USER source + PENDING → UNDECIDED", () => {
    expect(
      getOperatorDecision({
        reviewStatus: "PENDING",
        reviewStatusSource: "USER",
      }),
    ).toBe("UNDECIDED");
  });

  it("USER source + NEEDS_REVIEW → UNDECIDED (advisory artıkları)", () => {
    expect(
      getOperatorDecision({
        reviewStatus: "NEEDS_REVIEW",
        reviewStatusSource: "USER",
      }),
    ).toBe("UNDECIDED");
  });

  it("operatorDecisionLabel canonical EN copy", () => {
    expect(operatorDecisionLabel("KEPT")).toBe("Kept");
    expect(operatorDecisionLabel("REJECTED")).toBe("Rejected");
    expect(operatorDecisionLabel("UNDECIDED")).toBe("Undecided");
  });
});

describe("getAiScoreTone — threshold-aware 5 kademe (default 60/90)", () => {
  // halfLow = 30, midpoint = 75
  it("score null → neutral", () => {
    expect(getAiScoreTone({ score: null })).toBe("neutral");
  });

  it("score 5 → critical (halfLow=30 altı)", () => {
    expect(getAiScoreTone({ score: 5 })).toBe("critical");
  });

  it("score 29 → critical (halfLow=30 sınır altı)", () => {
    expect(getAiScoreTone({ score: 29 })).toBe("critical");
  });

  it("score 30 → poor (halfLow sınırı dahil)", () => {
    expect(getAiScoreTone({ score: 30 })).toBe("poor");
  });

  it("score 45 → poor (band altı, halfLow üstü)", () => {
    expect(getAiScoreTone({ score: 45 })).toBe("poor");
  });

  it("score 59 → poor (low sınır altı)", () => {
    expect(getAiScoreTone({ score: 59 })).toBe("poor");
  });

  it("score 60 → warning (band içi, low dahil, midpoint altı)", () => {
    expect(getAiScoreTone({ score: 60 })).toBe("warning");
  });

  it("score 65 → warning (band içi, midpoint=75 altı)", () => {
    expect(getAiScoreTone({ score: 65 })).toBe("warning");
  });

  it("score 74 → warning (midpoint sınır altı)", () => {
    expect(getAiScoreTone({ score: 74 })).toBe("warning");
  });

  it("score 75 → caution (midpoint dahil)", () => {
    expect(getAiScoreTone({ score: 75 })).toBe("caution");
  });

  it("score 85 → caution (band içi, midpoint üstü)", () => {
    expect(getAiScoreTone({ score: 85 })).toBe("caution");
  });

  it("score 89 → caution (high sınır altı)", () => {
    expect(getAiScoreTone({ score: 89 })).toBe("caution");
  });

  it("score 90 → success (high dahil)", () => {
    expect(getAiScoreTone({ score: 90 })).toBe("success");
  });

  it("score 95 → success", () => {
    expect(getAiScoreTone({ score: 95 })).toBe("success");
  });

  it("score 100 → success", () => {
    expect(getAiScoreTone({ score: 100 })).toBe("success");
  });
});

describe("getAiScoreTone — custom thresholds 70/95 (Madde R kapsamı)", () => {
  // halfLow = 35, midpoint = 82.5
  const t = { low: 70, high: 95 };

  it("score 30 → critical (halfLow=35 altı)", () => {
    expect(getAiScoreTone({ score: 30, thresholds: t })).toBe("critical");
  });

  it("score 65 → poor (band altı, halfLow üstü)", () => {
    expect(getAiScoreTone({ score: 65, thresholds: t })).toBe("poor");
  });

  it("score 75 → warning (band içi, midpoint=82.5 altı)", () => {
    expect(getAiScoreTone({ score: 75, thresholds: t })).toBe("warning");
  });

  it("score 90 → caution (band içi, midpoint=82.5 üstü)", () => {
    expect(getAiScoreTone({ score: 90, thresholds: t })).toBe("caution");
  });

  it("score 96 → success (high üstü)", () => {
    expect(getAiScoreTone({ score: 96, thresholds: t })).toBe("success");
  });
});

describe("getAiScoreDistanceLabel — human-friendly copy", () => {
  it("score yok → null", () => {
    expect(getAiScoreDistanceLabel({ score: null })).toBeNull();
  });

  it("high üstü → 'passes threshold'", () => {
    expect(getAiScoreDistanceLabel({ score: 95 })).toBe("passes threshold");
  });

  it("band içi üst yarı → 'near pass'", () => {
    expect(getAiScoreDistanceLabel({ score: 80 })).toBe("near pass");
  });

  it("band içi alt yarı → 'near review threshold'", () => {
    expect(getAiScoreDistanceLabel({ score: 65 })).toBe("near review threshold");
  });

  it("band altı → 'far below threshold'", () => {
    expect(getAiScoreDistanceLabel({ score: 20 })).toBe("far below threshold");
  });
});

describe("getRiskTone — score rengini ezmeyen ayrı indicator", () => {
  it("count=0, blocker yok → none", () => {
    expect(getRiskTone({ count: 0 })).toBe("none");
  });

  it("count=2, blocker yok → warning", () => {
    expect(getRiskTone({ count: 2 })).toBe("warning");
  });

  it("hasBlocker=true → critical (count ne olursa olsun)", () => {
    expect(getRiskTone({ count: 1, hasBlocker: true })).toBe("critical");
    expect(getRiskTone({ count: 0, hasBlocker: true })).toBe("critical");
  });

  it("riskIndicatorLabel copy formatları", () => {
    expect(riskIndicatorLabel({ count: 0 })).toBeNull();
    expect(riskIndicatorLabel({ count: 1 })).toBe("1 warning");
    expect(riskIndicatorLabel({ count: 3 })).toBe("3 risks");
    expect(riskIndicatorLabel({ count: 1, hasBlocker: true })).toBe(
      "Critical risk",
    );
  });
});

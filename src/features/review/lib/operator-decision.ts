// IA-30 (CLAUDE.md Madde V) — operator decision + AI score tone helpers.
//
// Tek nokta — kart, focus mode, filmstrip, breakdown sayımları, bulk
// actions hepsi aynı semantikten geçer.
//
//   • OperatorDecision = "KEPT" | "REJECTED" | "UNDECIDED"
//   • Kept / Rejected SADECE reviewStatusSource === "USER" iken
//   • AI suggestion ayrı katman (advisory, final değil)
//   • AI score chip rengi sistem skoruna (deterministic) göre

export type ReviewStatusValue =
  | "PENDING"
  | "APPROVED"
  | "NEEDS_REVIEW"
  | "REJECTED";

export type ReviewStatusSourceValue = "SYSTEM" | "USER";

export type OperatorDecision = "KEPT" | "REJECTED" | "UNDECIDED";

/**
 * Operatörün final kararını (canonical axis) döndürür. AI advisory
 * `reviewStatus`'e dokunmaz (IA-29); ama yine de güvenlik için
 * source !== USER ise UNDECIDED kabul ederiz (eski migration
 * kalıntısı veya başka bir yolla SYSTEM-yazılı APPROVED/REJECTED
 * row varsa operatör damgası gibi sunulmasın).
 */
export function getOperatorDecision(input: {
  reviewStatus: ReviewStatusValue;
  reviewStatusSource: ReviewStatusSourceValue;
}): OperatorDecision {
  if (input.reviewStatusSource !== "USER") return "UNDECIDED";
  if (input.reviewStatus === "APPROVED") return "KEPT";
  if (input.reviewStatus === "REJECTED") return "REJECTED";
  return "UNDECIDED";
}

/** Operator-facing label (canonical EN copy). */
export function operatorDecisionLabel(d: OperatorDecision): string {
  switch (d) {
    case "KEPT":
      return "Kept";
    case "REJECTED":
      return "Rejected";
    case "UNDECIDED":
      return "Undecided";
  }
}

// ────────────────────────────────────────────────────────────────────────
// AI score tone — advisory chip rengini deterministic system score'a
// göre üretir. Operator decision badge'i ile karışmasın diye AYRI
// helper. Eşikler decision thresholds (low/high) + risk flag varlığı.
// ────────────────────────────────────────────────────────────────────────

export type AiScoreTone = "destructive" | "warning" | "success" | "neutral";

export interface AiScoreToneInput {
  /** System (deterministic) score; null = AI henüz çalışmadı. */
  score: number | null;
  /** Failed risk flag sayısı; > 0 ise tone "review recommended"a iter. */
  riskFlagCount: number;
  /** Decision thresholds — settings'ten gelir; varsayılan 60/90. */
  thresholds?: { low: number; high: number };
}

const DEFAULT_THRESHOLDS = { low: 60, high: 90 } as const;

/**
 * AI score chip tonunu döndürür. Decision engine ile uyumlu kural:
 *   • score < low veya risk flag varsa → destructive (kırmızı)
 *   • score >= high ve risk yoksa     → success (yeşil)
 *   • diğer                          → warning (sarı)
 *   • score null                    → neutral (advisory yok)
 */
export function getAiScoreTone(input: AiScoreToneInput): AiScoreTone {
  const { score, riskFlagCount } = input;
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;
  if (score === null || score === undefined) return "neutral";
  if (riskFlagCount > 0) return "destructive";
  if (score < t.low) return "destructive";
  if (score >= t.high) return "success";
  return "warning";
}

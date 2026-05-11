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
// helper. 5 kademe — ama sabit aralık DEĞİL: kullanıcı/admin'in
// belirlediği `low/high` threshold'lara göre orantısal hesap.
//   • Risk flag tone'u EZMEZ — risk ayrı `getRiskTone` helper'ında.
//   • score null → neutral
//
// Eşikler decision policy'den gelir (Settings → Review). Default
// 60/90 yalnız fallback'tir (CLAUDE.md Madde R).
// ────────────────────────────────────────────────────────────────────────

export type AiScoreTone =
  | "critical"  // band çok altı — AI çok zayıf gördü
  | "poor"      // band altı — düşük kalite, low'a yaklaşıyor
  | "warning"   // band içi alt yarı — geçmeye uzak
  | "caution"   // band içi üst yarı — geçmeye yakın (near-pass)
  | "success"   // band üstü — auto-approve threshold'ı geçti
  | "neutral";  // AI hiç skor üretmedi

export interface AiScoreToneInput {
  /** System (deterministic) score; null = AI henüz çalışmadı. */
  score: number | null;
  /** Decision thresholds — settings'ten gelir; default 60/90 fallback. */
  thresholds?: { low: number; high: number };
}

const DEFAULT_THRESHOLDS = { low: 60, high: 90 } as const;

/**
 * Score tonunu threshold'a göre döndürür. Kural:
 *   • score >= high                       → success
 *   • low <= score < high (band içi):
 *       midpoint = (low + high) / 2
 *       score < midpoint                  → warning
 *       else                              → caution (near-pass)
 *   • score < low (band altı):
 *       halfLow = low / 2
 *       score < halfLow                   → critical
 *       else                              → poor
 *   • score null/undefined                → neutral
 *
 * Default 60/90 ile örnekler:
 *   5  → critical (halfLow=30, 5<30)
 *   45 → poor    (45>=30 ama <60)
 *   65 → warning (band içi, midpoint=75, 65<75)
 *   85 → caution (band içi, 85>=75)
 *   95 → success (95>=90)
 *
 * Custom 70/95:
 *   65 → poor    (65>=35, <70)
 *   90 → caution (band içi, midpoint=82.5, 90>=82.5)
 *   96 → success
 */
export function getAiScoreTone(input: AiScoreToneInput): AiScoreTone {
  const { score } = input;
  if (score === null || score === undefined) return "neutral";
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;
  if (score >= t.high) return "success";
  if (score >= t.low) {
    // Band içi — midpoint'e göre warning/caution ayır
    const midpoint = (t.low + t.high) / 2;
    return score < midpoint ? "warning" : "caution";
  }
  // Band altı — half-low'a göre critical/poor ayır
  const halfLow = t.low / 2;
  return score < halfLow ? "critical" : "poor";
}

/** Optional human-friendly "where is this score" copy. */
export function getAiScoreDistanceLabel(
  input: AiScoreToneInput,
): string | null {
  const { score } = input;
  if (score === null || score === undefined) return null;
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;
  if (score >= t.high) return "passes threshold";
  if (score >= t.low) {
    const midpoint = (t.low + t.high) / 2;
    return score >= midpoint ? "near pass" : "near review threshold";
  }
  return "far below threshold";
}

// ────────────────────────────────────────────────────────────────────────
// Risk indicator — score'tan AYRI. Risk flag sayısı + blocker varlığı
// kullanıcıya net "1 warning" / "Critical risk" mesajı verir. Score
// chip yeşil olsa bile critical risk varsa operatör fark eder.
// ────────────────────────────────────────────────────────────────────────

export type RiskTone = "critical" | "warning" | "none";

export interface RiskToneInput {
  /** Toplam failed risk flag sayısı. */
  count: number;
  /** Herhangi bir blocker-severity risk var mı? Critical sinyal. */
  hasBlocker?: boolean;
}

export function getRiskTone(input: RiskToneInput): RiskTone {
  if (input.hasBlocker) return "critical";
  if (input.count > 0) return "warning";
  return "none";
}

/** Operator-facing risk indicator copy. */
export function riskIndicatorLabel(input: RiskToneInput): string | null {
  if (input.hasBlocker) return "Critical risk";
  if (input.count <= 0) return null;
  if (input.count === 1) return "1 warning";
  return `${input.count} risks`;
}

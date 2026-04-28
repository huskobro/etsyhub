import { ReviewStatus } from "@prisma/client";
import type { ReviewRiskFlag } from "@/providers/review/types";

/**
 * Phase 6 review karar kuralı (R8) — pure / deterministic / stateless.
 *
 * Bu fonksiyon Task 4 (Gemini provider) ve Task 5 (sharp alpha-checks)
 * çıktılarını birleştirir; aşağı katmanlar tarafından (Task 8 worker)
 * çağrılır. Worker daha sonra Task 7 sticky helper ile USER override
 * koruması yapar.
 *
 * KURAL ZINCIRI:
 *   1) risk_flags > 0           ⇒ NEEDS_REVIEW (her durumda öncelikli)
 *   2) score < 60               ⇒ NEEDS_REVIEW
 *   3) score >= 90 + risk yok   ⇒ APPROVED
 *   4) aksi (60–89 + risk yok)  ⇒ NEEDS_REVIEW (güvenli varsayılan)
 *
 * "Güvenli varsayılan" gerekçesi (60–89 bandı):
 * - Gemini gibi LLM çıktıları %5–10 dalgalanabilir; aynı görsel için 88
 *   ve 91 dönmesi mümkün.
 * - Bu bantta otomatik APPROVED kullanıcıyı yanıltır (riskli yakın-eşik
 *   tasarımları gözden geçirme şansı kaybolur).
 * - Bu bantta otomatik REJECT da haksız (skor zaten orta-üst); kullanıcı
 *   "Approve anyway" demek isteyebilir.
 * - NEEDS_REVIEW iki seçeneği de açık tutar: USER override sticky
 *   (Task 7) ile kullanıcı manuel APPROVED veya REJECTED yazabilir.
 *
 * Hardcoded threshold (R14) — settings'e taşıma `quality-review-thresholds`
 * carry-forward (Phase 7+).
 *
 * Score input'u 0–100 arası VALIDATED kabul edilir (Task 4 Zod schema
 * `z.number().int().min(0).max(100)` ile zorlar). Burada ekstra clamp/
 * range guard YOK — out-of-range koruması başka katmanın sözleşmesi.
 */
export const REVIEW_THRESHOLD_LOW = 60;
export const REVIEW_THRESHOLD_HIGH = 90;

export type ReviewDecisionInput = {
  score: number;
  riskFlags: ReviewRiskFlag[];
};

export function decideReviewStatus(input: ReviewDecisionInput): ReviewStatus {
  // 1) Risk flag her durumda öncelikli — score yüksek olsa bile
  if (input.riskFlags.length > 0) return ReviewStatus.NEEDS_REVIEW;

  // 2) Düşük skor — düşük kalite işareti
  if (input.score < REVIEW_THRESHOLD_LOW) return ReviewStatus.NEEDS_REVIEW;

  // 3) Yüksek skor + risk yok — otomatik onay güvenli
  if (input.score >= REVIEW_THRESHOLD_HIGH) return ReviewStatus.APPROVED;

  // 4) 60–89 + risk yok — orta band, güvenli varsayılan NEEDS_REVIEW
  //    (yukarıdaki doc-block'ta gerekçe; LLM dalgalanması + USER override)
  return ReviewStatus.NEEDS_REVIEW;
}

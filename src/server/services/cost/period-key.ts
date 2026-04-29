/**
 * Period key — günlük YYYY-MM-DD UTC formatı.
 *
 * Aylık aggregation query-time'da yapılır (örn. WHERE periodKey LIKE '2026-04-%').
 * UTC kullanımı Phase 5/6 paterniyle tutarlı (snapshot helper de UTC).
 *
 * Phase 6 — daily review budget guardrail için bu helper kullanılır
 * (`src/server/services/cost/budget.ts`).
 */
export function dailyPeriodKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

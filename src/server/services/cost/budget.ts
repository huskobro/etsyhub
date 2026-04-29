import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import { dailyPeriodKey } from "./period-key";

/**
 * Phase 6 daily review budget — hardcoded başlangıç sabiti.
 *
 * Settings'e taşıma + admin per-user override carry-forward:
 * `cost-budget-settings-ui` (Phase 7+).
 *
 * Conservative estimate context: günde 1000 review = 1000 cent = $10.
 * Pratikte gerçek faturalama çok daha düşük olabilir (Gemini ~$0.001/çağrı);
 * bu sınır defansif tutulmuştur. Real-time pricing carry-forward:
 * `cost-real-time-pricing`.
 */
export const DAILY_REVIEW_BUDGET_CENTS = 1000;

/**
 * Limit aşıldıysa explicit throw. Sessiz skip YASAK (CLAUDE.md fail-fast).
 *
 * Race window not: Hızlı ardışık review'larda iki worker aynı anda
 * check ⇒ ikisi de geçer ⇒ limit aşılabilir (TOCTOU). Phase 6 scope dışı;
 * carry-forward: `cost-budget-atomic` (Phase 7+).
 *
 * Periyot semantiği: günlük (`dailyPeriodKey()` UTC). Aylık aggregation
 * query-time'da yapılır (`WHERE periodKey LIKE '2026-04-%'`).
 */
export async function assertWithinDailyBudget(
  userId: string,
  providerKind: ProviderKind,
  limitCents: number = DAILY_REVIEW_BUDGET_CENTS,
): Promise<void> {
  const periodKey = dailyPeriodKey();
  const aggregate = await db.costUsage.aggregate({
    where: { userId, providerKind, periodKey },
    _sum: { costCents: true },
  });
  const spent = aggregate._sum.costCents ?? 0;
  if (spent >= limitCents) {
    throw new Error(
      `daily review budget exceeded: spent=${spent} cent, limit=${limitCents} cent`,
    );
  }
}

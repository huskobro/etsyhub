// R7 — Cost summary aggregator for AI Providers pane.
//
// CostUsage tablosundan basit toplama: günlük toplam (cents),
// aylık toplam (cents), aktif provider sayısı (son 30 gün), son 24
// saatte FAILED job sayısı (provider error işareti).
//
// Schema dokunmaz; periodKey "YYYY-MM" formatında olduğu varsayılarak
// günlük dağılım için createdAt filtresi kullanılır.

import { db } from "@/server/db";

export type CostSummary = {
  /** Bugünkü toplam harcama (cents). */
  dailySpendCents: number;
  /** Bu ay (yerel) toplam harcama (cents). */
  monthlySpendCents: number;
  /** Son 30 günde en az bir CostUsage row'u olan provider key sayısı. */
  activeProviderCount: number;
  /** Son 24 saatte FAILED Job sayısı. */
  failedCalls24h: number;
};

export async function getCostSummary(input: {
  userId: string;
}): Promise<CostSummary> {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [dailyAgg, monthlyAgg, recentRows, failedCount] = await Promise.all([
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        createdAt: { gte: startOfDay },
      },
    }),
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        createdAt: { gte: startOfMonth },
      },
    }),
    db.costUsage.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { providerKey: true },
      distinct: ["providerKey"],
    }),
    db.job.count({
      where: {
        userId: input.userId,
        status: "FAILED",
        finishedAt: { gte: twentyFourHoursAgo },
      },
    }),
  ]);

  return {
    dailySpendCents: dailyAgg._sum.costCents ?? 0,
    monthlySpendCents: monthlyAgg._sum.costCents ?? 0,
    activeProviderCount: recentRows.length,
    failedCalls24h: failedCount,
  };
}

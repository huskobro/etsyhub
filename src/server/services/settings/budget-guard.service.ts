// R9 — Budget guard + task assignment lookup.
//
// AI Providers admin settings (R8) artık enforcement yüzeyine bağlı:
//   · assertWithinBudget(userId, providerKey, costEstimateCents)
//     → CostUsage daily/monthly toplamı + admin spend limit kontrolü.
//     Limit aşılırsa BudgetExceededError throw.
//   · resolveTaskModel(userId, taskKey) → admin tarafından atanan
//     "providerKey/model" string'i. Variation/review/listing pipeline'ı
//     bunu kullanarak kullanıcı/admin override'ı uygular.
//
// Service caller'ları enforcement'a opt-in yapar; mevcut variation worker
// hâlâ env-driven path kullanıyor — R10'da tam migration. Bu service
// **infra hazır**.

import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getAiProvidersSettings } from "./ai-providers.service";

export class BudgetExceededError extends Error {
  constructor(
    public readonly providerKey: string,
    public readonly window: "daily" | "monthly",
    public readonly limitCents: number,
    public readonly spentCents: number,
  ) {
    super(
      `Budget exceeded for ${providerKey} (${window}): spent ${spentCents}¢ of ${limitCents}¢`,
    );
    this.name = "BudgetExceededError";
  }
}

/**
 * Bir provider call'ın bütçe içinde olup olmadığını kontrol eder.
 *
 * Limit 0 = "no limit" (admin pane'de operatör 0 yazınca enforcement
 * disabled).
 *
 * Throws `BudgetExceededError` ya da no-op return.
 */
export async function assertWithinBudget(input: {
  userId: string;
  providerKey: string;
  costEstimateCents: number;
}): Promise<void> {
  if (input.costEstimateCents <= 0) return;

  const settings = await getAiProvidersSettings(input.userId);
  const limit = settings.spendLimits[input.providerKey];
  if (!limit) {
    // Bilinmeyen provider — ileride yeni provider eklendiğinde admin
    // limit set etmeden enforcement yapma; sessiz pass.
    return;
  }

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [daily, monthly] = await Promise.all([
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        providerKey: input.providerKey,
        createdAt: { gte: startOfDay },
      },
    }),
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        providerKey: input.providerKey,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  const dailySpent = daily._sum.costCents ?? 0;
  const monthlySpent = monthly._sum.costCents ?? 0;
  const dailyLimitCents = limit.dailyLimitUsd * 100;
  const monthlyLimitCents = limit.monthlyLimitUsd * 100;

  if (dailyLimitCents > 0 && dailySpent + input.costEstimateCents > dailyLimitCents) {
    logger.warn(
      {
        userId: input.userId,
        providerKey: input.providerKey,
        dailySpent,
        dailyLimitCents,
      },
      "budget guard tripped (daily)",
    );
    throw new BudgetExceededError(
      input.providerKey,
      "daily",
      dailyLimitCents,
      dailySpent,
    );
  }
  if (
    monthlyLimitCents > 0 &&
    monthlySpent + input.costEstimateCents > monthlyLimitCents
  ) {
    logger.warn(
      {
        userId: input.userId,
        providerKey: input.providerKey,
        monthlySpent,
        monthlyLimitCents,
      },
      "budget guard tripped (monthly)",
    );
    throw new BudgetExceededError(
      input.providerKey,
      "monthly",
      monthlyLimitCents,
      monthlySpent,
    );
  }
}

/**
 * Workspace task assignment'ından "providerKey/model" string'i okur.
 * AI mode service ile workspace ayarlarının nasıl etkileşeceği R10'da
 * net belirlenecek; R9'da admin assignments okunur, fallback default
 * şema değerleri.
 */
export async function resolveTaskModel(input: {
  userId: string;
  taskKey:
    | "variation"
    | "review"
    | "listingCopy"
    | "bgRemoval"
    | "mockup";
}): Promise<{ providerKey: string; model: string }> {
  const settings = await getAiProvidersSettings(input.userId);
  const assignment = settings.taskAssignments[input.taskKey];
  if (!assignment) {
    // Schema default'unu uygula. Zod parse defaults zaten dolduruyor,
    // bu defansif fallback yalnız tip narrow'u için.
    return { providerKey: "kie", model: "kie/midjourney-v7" };
  }
  // assignment formatı "providerKey/model" — split.
  const slash = assignment.indexOf("/");
  if (slash < 0) {
    return { providerKey: "kie", model: assignment };
  }
  return {
    providerKey: assignment.slice(0, slash),
    model: assignment.slice(slash + 1),
  };
}

/**
 * Spend preview — UI için "bu çağrı limit'e nasıl yansır" hesaplar.
 * Throw etmez; sadece bilgi döner.
 */
export async function previewSpend(input: {
  userId: string;
  providerKey: string;
  costEstimateCents: number;
}): Promise<{
  withinDailyLimit: boolean;
  withinMonthlyLimit: boolean;
  dailyAfterCents: number;
  dailyLimitCents: number;
  monthlyAfterCents: number;
  monthlyLimitCents: number;
}> {
  const settings = await getAiProvidersSettings(input.userId);
  const limit = settings.spendLimits[input.providerKey] ?? {
    dailyLimitUsd: 0,
    monthlyLimitUsd: 0,
  };
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [daily, monthly] = await Promise.all([
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        providerKey: input.providerKey,
        createdAt: { gte: startOfDay },
      },
    }),
    db.costUsage.aggregate({
      _sum: { costCents: true },
      where: {
        userId: input.userId,
        providerKey: input.providerKey,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);
  const dailyAfter = (daily._sum.costCents ?? 0) + input.costEstimateCents;
  const monthlyAfter =
    (monthly._sum.costCents ?? 0) + input.costEstimateCents;
  const dailyLimitCents = limit.dailyLimitUsd * 100;
  const monthlyLimitCents = limit.monthlyLimitUsd * 100;
  return {
    withinDailyLimit: dailyLimitCents === 0 || dailyAfter <= dailyLimitCents,
    withinMonthlyLimit:
      monthlyLimitCents === 0 || monthlyAfter <= monthlyLimitCents,
    dailyAfterCents: dailyAfter,
    dailyLimitCents,
    monthlyAfterCents: monthlyAfter,
    monthlyLimitCents,
  };
}

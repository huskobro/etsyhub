import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import { dailyPeriodKey } from "./period-key";

/**
 * CostUsage insert helper.
 *
 * Conservative estimate: minimum hesap birimi 1 cent (Int alan). Fractional
 * fiyatlandırma (örn. ~$0.001/Gemini çağrısı) yuvarlanır; gerçek faturalama
 * için real-time pricing carry-forward (`cost-real-time-pricing` Phase 7+).
 *
 * Best-effort kullanım: caller try/catch ile sarar; cost tracking fail
 * primary review state'i bozmamalı (review state primary truth).
 */
export type CostUsageInput = {
  userId: string;
  providerKind: ProviderKind;
  providerKey: string;
  model?: string;
  jobId?: string;
  /** Birim sayısı (örn. review sayısı, görsel sayısı). Int. */
  units: number;
  /** Toplam tahmini, cent biriminde. Int. */
  costCents: number;
};

export async function recordCostUsage(input: CostUsageInput): Promise<void> {
  if (input.units < 0 || input.costCents < 0) {
    throw new Error(
      `cost usage must be non-negative: units=${input.units}, costCents=${input.costCents}`,
    );
  }
  if (!Number.isInteger(input.units) || !Number.isInteger(input.costCents)) {
    throw new Error(
      `cost usage must be integers: units=${input.units}, costCents=${input.costCents}`,
    );
  }

  await db.costUsage.create({
    data: {
      userId: input.userId,
      providerKind: input.providerKind,
      providerKey: input.providerKey,
      model: input.model ?? null,
      jobId: input.jobId ?? null,
      units: input.units,
      costCents: input.costCents,
      periodKey: dailyPeriodKey(),
    },
  });
}

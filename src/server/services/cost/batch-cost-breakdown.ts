import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Batch-first Phase 13 — batch detail Costs tab veri kaynağı.
 *
 * CostUsage rows zaten `jobId` field'ı taşıyor (track-usage.ts:45). Batch =
 * Job.metadata.batchId üzerinden gruplanmış Job'lar; bir batch'in maliyeti
 * o batch'e bağlı tüm Job ID'leri için yazılmış CostUsage row'larının
 * aggregate'idir.
 *
 * Bu helper yeni schema veya yeni write path açmaz — yalnız mevcut
 * CostUsage tablosunu batch scope'una projecte eder. Operatörün cevabı
 * aradığı soru: "Bu batch bana neye mal oldu?"
 *
 * Honest gap'ler:
 * - MJ_BRIDGE worker'ı CostUsage YAZMIYOR (operator-driven browser akışı;
 *   provider fatura ayrı kanaldan geliyor). UI bunu "no recorded provider
 *   usage" fallback'i ile dürüstçe söyler.
 * - generate-variations.worker.ts:121 sadece SUCCESS sonrası 24¢/call
 *   yazar (kie/midjourney-v7 baseline). Failed AI batch'lerde row yok —
 *   bu doğru davranış, "no charge for failure" semantic'i.
 * - magic-eraser.worker.ts cost yazar ama jobId=null (selection edit
 *   pipeline'ı batch'e bağlı değil); batch breakdown'a düşmez.
 */

export type BatchCostBreakdownRow = {
  /** Provider kind enum (AI / SCRAPER / MOCKUP / STORAGE / OCR / ETSY). */
  providerKind: ProviderKind;
  /** Provider key (örn. "kie", "kie-gemini-flash"). */
  providerKey: string;
  /** Optional model identifier (örn. "kie/midjourney-v7"). */
  model: string | null;
  /** Toplam unit (görsel sayısı, review sayısı, vb.). */
  units: number;
  /** Toplam cost cent biriminde. */
  costCents: number;
  /** Bu provider/model kombinasyonunda kaç CostUsage row. */
  rowCount: number;
};

export type BatchCostBreakdown = {
  /** Toplam cost cent biriminde (tüm provider'lar). */
  totalCents: number;
  /** Toplam unit (tüm provider'lar). */
  totalUnits: number;
  /** Toplam CostUsage row sayısı (audit görünürlüğü). */
  rowCount: number;
  /** Provider × model breakdown — costCents DESC sıralı. */
  breakdown: BatchCostBreakdownRow[];
};

/**
 * Bir batch'e ait Job ID listesinden CostUsage aggregate döndürür.
 *
 * @param jobIds — batch'in BatchSummary.jobs[].jobId listesi
 * @returns null asla — boş breakdown da geçerli sonuçtur (UI fallback gösterir)
 */
export async function getBatchCostBreakdown(
  jobIds: string[],
): Promise<BatchCostBreakdown> {
  if (jobIds.length === 0) {
    return { totalCents: 0, totalUnits: 0, rowCount: 0, breakdown: [] };
  }

  // Group by provider × model (model null → ayrı bucket).
  const grouped = await db.costUsage.groupBy({
    by: ["providerKind", "providerKey", "model"],
    where: { jobId: { in: jobIds } },
    _sum: { costCents: true, units: true },
    _count: { _all: true },
  });

  // costCents DESC sırala (en pahalı provider üstte).
  grouped.sort((a, b) => (b._sum.costCents ?? 0) - (a._sum.costCents ?? 0));

  let totalCents = 0;
  let totalUnits = 0;
  let rowCount = 0;
  const breakdown: BatchCostBreakdownRow[] = [];

  for (const g of grouped) {
    const cents = g._sum.costCents ?? 0;
    const units = g._sum.units ?? 0;
    const count = g._count._all;
    totalCents += cents;
    totalUnits += units;
    rowCount += count;
    breakdown.push({
      providerKind: g.providerKind,
      providerKey: g.providerKey,
      model: g.model,
      costCents: cents,
      units,
      rowCount: count,
    });
  }

  return { totalCents, totalUnits, rowCount, breakdown };
}

/**
 * Cent → USD currency formatter (Costs tab boyunca tutarlı).
 *
 * < $1 ise sent precision korunur (örn. "$0.24"). Daha büyük tutarlar
 * iki ondalık ile gösterilir ("$1.92", "$45.60"). Negatif input gelmez
 * (track-usage.ts:28 guard).
 */
export function formatCostUSD(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return "—";
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

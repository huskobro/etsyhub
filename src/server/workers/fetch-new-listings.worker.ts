import { CompetitorScanType } from "@prisma/client";
import { db } from "@/server/db";
import { triggerScan } from "@/features/competitors/services/competitor-service";
import { logger } from "@/lib/logger";

/**
 * Payload:
 * - boş: tüm autoScanEnabled=true rakipler için incremental scan tetikle
 * - `{ competitorStoreId }`: sadece verilen store için tek bir incremental scan
 *
 * Not: Worker'ın kendisi "scheduler proxy"dir. Asıl scraping işini
 * `SCRAPE_COMPETITOR` worker'ı yapar. Burada sadece alt job/scan kayıtları
 * açılır ve kuyruğa alınır.
 */
export type FetchNewListingsPayload = {
  competitorStoreId?: string;
};

type StoreRef = { id: string; userId: string };

async function collectTargets(
  payload: FetchNewListingsPayload,
): Promise<StoreRef[]> {
  if (payload.competitorStoreId) {
    const store = await db.competitorStore.findFirst({
      where: { id: payload.competitorStoreId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!store) {
      throw new Error(
        `Rakip mağaza bulunamadı veya silinmiş: ${payload.competitorStoreId}`,
      );
    }
    return [store];
  }

  return db.competitorStore.findMany({
    where: { autoScanEnabled: true, deletedAt: null },
    select: { id: true, userId: true },
  });
}

/**
 * FETCH_NEW_LISTINGS worker.
 *
 * Günlük repeat (cron: `0 6 * * *`) ile boş payload'la çağrılır; her
 * autoScanEnabled rakip için incremental SCRAPE_COMPETITOR planlanır.
 * Manuel "refresh" için `competitorStoreId` verilerek tek bir alt iş
 * tetiklenebilir.
 *
 * Her alt iş kendi userId'si ile `triggerScan` üzerinden kuyruğa alınır —
 * data isolation böylece korunur.
 */
export async function handleFetchNewListings(job: {
  data: FetchNewListingsPayload;
}): Promise<{ triggered: number }> {
  const isManual = Boolean(job.data.competitorStoreId);
  const targets = await collectTargets(job.data);
  logger.info(
    { count: targets.length, manualStoreId: job.data.competitorStoreId ?? null },
    "FETCH_NEW_LISTINGS — alt scan planlanıyor",
  );

  let triggered = 0;
  for (const s of targets) {
    try {
      await triggerScan({
        userId: s.userId,
        competitorStoreId: s.id,
        type: CompetitorScanType.INCREMENTAL_NEW,
      });
      triggered++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      logger.error(
        { competitorStoreId: s.id, userId: s.userId, err: message },
        "FETCH_NEW_LISTINGS — alt scan tetiklenemedi",
      );
      // Manuel tetiklemede (tek store) hata yukarı bubble etsin ki kullanıcı
      // görsün; toplu cron modunda tek store hatası tüm batch'i çökertmesin.
      if (isManual) throw err;
    }
  }

  return { triggered };
}

/**
 * Trend Stories sabitleri: pencere boyutları, threshold'lar, sayfalama,
 * debounce ve scan güvenlik tavanları.
 *
 * Bu dosya Prisma/DB import etmez; bu yüzden client component'lerden de
 * güvenle import edilebilir.
 */

export const WINDOW_DAYS = [1, 7, 30] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

/**
 * Her zaman penceresi için minimum uygun listing sayısı.
 * Yeterli kanıt olmadan false positive trend raporlanmaz.
 */
export const WINDOW_THRESHOLDS: Record<
  WindowDays,
  { minStore: number; minListing: number }
> = {
  1: { minStore: 2, minListing: 2 },
  7: { minStore: 2, minListing: 3 },
  30: { minStore: 2, minListing: 3 },
} as const;

/**
 * Küme temizliği için Jaccard benzerlik eşiği.
 * > 0.8 = çok benzer sinyaller, bir tanesini çıkar.
 */
export const OVERLAP_PRUNE_THRESHOLD = 0.8;

/**
 * Feed'de gösterilen listing'ler sayı başına sayfa.
 */
export const FEED_PAGE_SIZE = 40;

/**
 * Küme listesi endpoint'inde döndürülen maksimum küme sayısı.
 */
export const CLUSTERS_LIST_PAGE_SIZE = 50;

/**
 * Küme detay sayfasında üye sayfa boyutu.
 */
export const CLUSTER_MEMBERS_PAGE_SIZE = 30;

/**
 * Küme tarama debounce penceresı (ms).
 * Son scan'dan sonra bu süreden eski cluster'ları taramaya çalış.
 */
export const DEBOUNCE_WINDOW_MS = 60_000;

/**
 * Tek scan'da maksimum taranacak küme üyesi.
 * Sonsuz döngü/resource tükenmesini engeller.
 */
export const MAX_CLUSTER_MEMBERS_SCAN = 500;

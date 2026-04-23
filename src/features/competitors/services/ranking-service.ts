import type { ReviewWindow } from "../schemas";

/**
 * filterByWindow + rankListingsByReviews bileşimi.
 * API route'ları için tek noktadan çağrım.
 */
export function rankListings<T extends Rankable>(
  listings: T[],
  window: ReviewWindow,
  now = new Date(),
): T[] {
  return rankListingsByReviews(filterByWindow(listings, window, now));
}

/**
 * Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir.
 * UI bu sabiti import edip kullanıcıya disclaimer olarak gösterir.
 */
export const REVIEW_COUNT_DISCLAIMER =
  "Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir.";

type Rankable = {
  reviewCount: number;
  latestReviewAt: Date | null;
  listingCreatedAt: Date | null;
};

/**
 * Listingleri reviewCount'a göre azalan sırada sıralar.
 */
export function rankListingsByReviews<T extends Rankable>(listings: T[]): T[] {
  return [...listings].sort((a, b) => b.reviewCount - a.reviewCount);
}

const WINDOW_DAYS: Record<Exclude<ReviewWindow, "all">, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

/**
 * Window filtresi uygular.
 *
 * Tarih önceliği: latestReviewAt → listingCreatedAt → (her ikisi null ise dahil et)
 *
 * "all" window: hiç eleme yapmaz.
 */
export function filterByWindow<T extends Rankable>(
  listings: T[],
  window: ReviewWindow,
  now = new Date(),
): T[] {
  if (window === "all") return listings;

  const days = WINDOW_DAYS[window];
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return listings.filter((l) => {
    // latestReviewAt varsa onu kullan
    if (l.latestReviewAt !== null) {
      return l.latestReviewAt >= cutoff;
    }
    // latestReviewAt null ise listingCreatedAt fallback
    if (l.listingCreatedAt !== null) {
      return l.listingCreatedAt >= cutoff;
    }
    // Her ikisi de null → dahil et (filter etme)
    return true;
  });
}

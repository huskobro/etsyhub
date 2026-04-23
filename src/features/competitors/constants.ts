/**
 * Client + server safe competitor sabitleri.
 *
 * Bu dosya Prisma/DB import etmez; bu yüzden client component'lerden de
 * güvenle import edilebilir. `ranking-service.ts` (server-only) buradan
 * re-export eder. Tek kaynak prensibi: disclaimer değişirse tek yerde
 * değişir.
 */

/**
 * Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir.
 * UI bu sabiti import edip kullanıcıya disclaimer olarak gösterir.
 */
export const REVIEW_COUNT_DISCLAIMER =
  "Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir.";

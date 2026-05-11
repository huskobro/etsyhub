/**
 * Client + server safe competitor sabitleri.
 *
 * Bu dosya Prisma/DB import etmez; bu yüzden client component'lerden de
 * güvenle import edilebilir. `ranking-service.ts` (server-only) buradan
 * re-export eder. Tek kaynak prensibi: disclaimer değişirse tek yerde
 * değişir.
 */

/**
 * Review count is an estimated popularity signal, not an exact sales figure.
 * UI imports this constant to display the disclaimer to the user.
 */
export const REVIEW_COUNT_DISCLAIMER =
  "Review count is an estimated popularity signal, not an exact sales figure.";

import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

/**
 * USER override sticky enforcement (R12).
 *
 * Phase 6 review pipeline'ında "Approve anyway" UX kontratının kod düzeyinde
 * garantisi. Kullanıcı manuel olarak APPROVED/REJECTED yazdığı bir kaydı
 * SYSTEM (otomatik review job) BİR DAHA override ETMEZ.
 *
 * Worker (Task 8) her review job'ın başında bu helper'ı çağırır:
 *   - mevcut kayıt USER source ile yazılmışsa ⇒ skip + log "user_sticky"
 *   - SYSTEM source veya ilk review (null) ⇒ SYSTEM yazabilir
 *
 * Pure / deterministic / stateless. Side effect yok.
 *
 * Tasarım notu: Bu helper karar "değerini" üretmez — Task 6 decision
 * fonksiyonu üretir. Helper yalnız "yazma izni var mı?" sorusunu cevaplar
 * ve `newSource` her zaman SYSTEM döner (bu helper SYSTEM job'ından çağrılır).
 */

export type StickyInput = {
  /**
   * Mevcut review state. İlk review'da null (henüz hiç yazılmamış).
   */
  current: { status: ReviewStatus; source: ReviewStatusSource } | null;
  /**
   * SYSTEM'in yazmak istediği yeni karar (Task 6 decision çıktısı).
   */
  systemDecision: ReviewStatus;
};

/**
 * Discriminated union — caller `shouldUpdate: false` durumunda `newStatus`/
 * `newSource` erişemez (TypeScript zorlar). "shouldUpdate=true sandım ama
 * yokmuş" tarzı sessiz bug'ları compile time önler.
 */
export type StickyOutput =
  | { shouldUpdate: true; newStatus: ReviewStatus; newSource: ReviewStatusSource }
  | { shouldUpdate: false };

export function applyReviewDecisionWithSticky(input: StickyInput): StickyOutput {
  if (input.current?.source === ReviewStatusSource.USER) {
    return { shouldUpdate: false };
  }
  return {
    shouldUpdate: true,
    newStatus: input.systemDecision,
    newSource: ReviewStatusSource.SYSTEM,
  };
}

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

/**
 * Already-scored guard (CLAUDE.md Madde N — scoring cost disiplini).
 *
 * Bir asset için SYSTEM tarafından zaten başarılı bir review yapılmışsa
 * (snapshot + reviewedAt dolu, source SYSTEM), aynı içeriğe ikinci kez
 * provider çağrısı yapılmaz. Operatör kararı (KEPT/REJECTED) bu kapsamı
 * **kapsar** — "kept/rejected item için yeniden scoring yapma" ayrı
 * kural değil, bunun **özel hali**: `reviewedAt != null` her durumda
 * skip sinyalidir. Re-score yalnızca explicit reset (PATCH route'u
 * snapshot'ları temizler ve rerun enqueue eder) veya invalidation
 * helper'ı (image-content değişikliği) ile tetiklenir.
 *
 * Worker bu guard'ı sticky check'ten sonra, daily-budget ve provider
 * resolve'dan **önce** çağırır — en pahalı yola girmeden erken-return.
 *
 * Pure / deterministic / stateless. Side effect yok.
 */
export type AlreadyScoredInput = {
  reviewedAt: Date | null;
  reviewProviderSnapshot: string | null;
  source: ReviewStatusSource;
};

export function isAlreadyScoredBySystem(input: AlreadyScoredInput): boolean {
  // SYSTEM tarafından dolu snapshot + reviewedAt = en az bir başarılı
  // provider response'u alınmış demek. Reset yapılmadığı sürece tekrar
  // scoring yapmıyoruz. (USER source ayrı sticky helper tarafından
  // erken-return ediliyor; bu guard yalnız SYSTEM kayıtlar için
  // tetiklenir, defansif olarak source kontrolü tutuyoruz.)
  if (input.source !== ReviewStatusSource.SYSTEM) return false;
  if (input.reviewedAt === null) return false;
  if (input.reviewProviderSnapshot === null) return false;
  return true;
}

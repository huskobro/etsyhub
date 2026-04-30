export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION", 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Giriş yapmalısın") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu kaynağa erişim yetkin yok") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Kaynak bulunamadı") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Çakışma") {
    super(message, "CONFLICT", 409);
  }
}

// ────────────────────────────────────────────────────────────
// Phase 7 — Selection Studio state machine errors
//
// Hepsi 409 Conflict — istemci geçersiz/uygunsuz state geçişi denedi.
// Phase 6 NotFoundError pattern'iyle: AppError extend, status + code
// AppError'a kalıtım yoluyla aktarılır; `errorResponse` helper'ı
// (src/lib/http.ts) bu sınıfları HTTP'ye otomatik map eder.
// ────────────────────────────────────────────────────────────

/**
 * Set `ready` veya `archived` durumundayken mutation girişimi.
 * Design Section 4.3 — read-only kural: item mutation'lar (status,
 * edit, reorder, add, delete) kapalı.
 */
export class SetReadOnlyError extends AppError {
  constructor(message = "Set read-only — mutation yasak") {
    super(message, "SET_READ_ONLY", 409);
  }
}

/**
 * Finalize gate: `selected` status'lu en az 1 item gerekli (pending ve
 * rejected sayılmaz). Design Section 4.3 — `draft → ready` koşulu.
 */
export class FinalizeGateError extends AppError {
  constructor(message = "Finalize için en az 1 'selected' item gerekli") {
    super(message, "FINALIZE_GATE", 409);
  }
}

/**
 * Geçersiz state transition (örn. archived → archived; ready → draft).
 * Design Section 4.3 — explicit state machine; uncontrolled transition yok.
 */
export class InvalidStateTransitionError extends AppError {
  constructor(message = "Geçersiz state transition") {
    super(message, "INVALID_STATE_TRANSITION", 409);
  }
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 19 — Quick start input guard
//
// `quickStartFromBatch` (Task 15) boş batch (variant 0) durumunda atılır.
// Daha önce generic `Error` atılıyordu; route boundary'sinde HTTP 500'e map
// olurdu. Typed sınıf üzerinden 400 dönmek istemci tarafı için doğru sinyal:
// "girdi geçersiz, retry değil; kullanıcıya 'önce variant üret' mesajı".
// ────────────────────────────────────────────────────────────

/**
 * Quick start: kaynak batch'inde hiç design/variant yok. Set yaratmak
 * uyarısız UX kötü olduğu için (design Section 2.1) reject. 400 — istemci
 * input'u geçersiz, server hatası değil.
 */
export class EmptyBatchError extends AppError {
  constructor(
    message = "Bu batch'te variant yok; quick start yapılamaz",
  ) {
    super(message, "EMPTY_BATCH", 400);
  }
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 9 — Background remove edit-op errors
//
// Heavy edit op (`@imgly/background-removal-node`) için input guard hataları.
// Phase 6 paterniyle additive — mevcut sınıflara dokunulmaz.
// ────────────────────────────────────────────────────────────

/**
 * Format guard: edit-op input asset desteklenmeyen mimeType ile geldi
 * (örn. image/gif, image/svg+xml). 400 — istemci tarafı validasyon ihlali.
 */
export class UnsupportedFormatError extends AppError {
  constructor(message = "Desteklenmeyen format") {
    super(message, "UNSUPPORTED_FORMAT", 400);
  }
}

/**
 * Memory guard: heavy edit-op için input asset boyutu sınırı aştı (>50MB).
 * 413 Payload Too Large — OOM riski; worker job kabul etmez.
 */
export class AssetTooLargeError extends AppError {
  constructor(message = "Asset çok büyük") {
    super(message, "ASSET_TOO_LARGE", 413);
  }
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 10 — Heavy edit concurrency guard
//
// Aynı SelectionItem üzerinde aktif heavy edit job varken yeni enqueue
// reddedilir (design Section 5.1: "paralel heavy yasak"). DB-side state
// (`SelectionItem.activeHeavyJobId`) interactive transaction içinde
// kontrol edilir; race-condition'a kapalı gerçek lock.
// ────────────────────────────────────────────────────────────

/**
 * Aynı item üzerinde zaten aktif heavy edit job varken ikinci enqueue
 * denemesi. 409 Conflict — istemci kullanıcıya "İşlem sürüyor" feedback'i
 * verir; mevcut job tamamlanana kadar yeni enqueue reddedilir.
 */
export class ConcurrentEditError extends AppError {
  constructor(message = "Aynı item üzerinde aktif heavy edit var") {
    super(message, "CONCURRENT_EDIT", 409);
  }
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 21 — Reorder mismatch
//
// `reorderItems` (items.service) "tam eşleşme şartı" ihlal edildiğinde
// (eksik / fazla / duplicate / cross-set itemId) atılan typed error.
// Generic `Error` yerine 400 Bad Request — istemci input'u geçersiz,
// server hatası değil. Cross-user erişim hâlâ `requireSetOwnership`
// üzerinden 404'e map'lenir; bu sınıf yalnız body geçerlilik problemi.
// ────────────────────────────────────────────────────────────

/**
 * Reorder bulk position update'inde itemIds set'in tüm item'larıyla tam
 * eşleşmiyor (eksik/fazla/duplicate/cross-set). 400 Bad Request.
 */
export class ReorderMismatchError extends AppError {
  constructor(
    message = "Reorder itemIds set'in tüm item'larıyla tam eşleşmek zorunda",
  ) {
    super(message, "REORDER_MISMATCH", 400);
  }
}

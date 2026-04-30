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

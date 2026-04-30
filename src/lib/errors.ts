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

/**
 * Phase 9 V1 Task 11 — Etsy API error classifier.
 *
 * Etsy V3 HTTP response → typed AppError mapping.
 * Submit service `try { provider.create() } catch { throw classifyEtsyHttpError(...) }`
 * pattern'ı için.
 *
 * V1 sınıfları:
 *   - 401/403  → EtsyTokenExpiredError (token refresh trigger Phase 9.1+)
 *   - 422      → EtsyValidationError (non-retryable, payload invalid)
 *   - 429      → EtsyRateLimitError (retryable with backoff)
 *   - 5xx      → EtsyApiError (retryable, transient)
 *   - other 4xx → EtsyApiError (non-retryable)
 *   - network/timeout → EtsyNetworkError (retryable)
 *
 * Retryable hint = `isRetryableEtsyError(err)` helper (Phase 9.1 worker queue
 * tarafından tüketilir; V1 foundation'da definition yeterli).
 */

import {
  EtsyApiError,
  EtsyNetworkError,
  EtsyRateLimitError,
  EtsyTokenExpiredError,
  EtsyValidationError,
} from "./errors";

export type EtsyHttpErrorContext = {
  status: number;
  /** Etsy API body — JSON parsed, varsa. */
  body?: { error?: string; error_description?: string; [k: string]: unknown };
  /** Retry-After header (saniye) — 429 için. */
  retryAfterSeconds?: number;
};

/**
 * HTTP response'a bakıp uygun typed error fırlatır.
 * Provider impl tarafından çağrılır.
 */
export function classifyEtsyHttpError(ctx: EtsyHttpErrorContext): never {
  const { status, body, retryAfterSeconds } = ctx;
  const message =
    body?.error_description ?? body?.error ?? `HTTP ${status}`;
  const etsyCode = typeof body?.error === "string" ? body.error : undefined;

  if (status === 401 || status === 403) {
    throw new EtsyTokenExpiredError();
  }
  if (status === 422) {
    throw new EtsyValidationError(message, body);
  }
  if (status === 429) {
    throw new EtsyRateLimitError(retryAfterSeconds);
  }
  // 5xx + diğer 4xx → generic EtsyApiError
  throw new EtsyApiError(message, status, etsyCode);
}

/**
 * Network/fetch hatası → EtsyNetworkError.
 * Provider catch bloklarında: `catch (err) { classifyEtsyNetworkError(err) }`.
 */
export function classifyEtsyNetworkError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new EtsyNetworkError(message);
}

/**
 * Worker queue (Phase 9.1+) için retryable hint.
 * V1 foundation: definition var, henüz consumer yok.
 */
export function isRetryableEtsyError(err: unknown): boolean {
  if (err instanceof EtsyRateLimitError) return true;
  if (err instanceof EtsyNetworkError) return true;
  if (err instanceof EtsyApiError) {
    // 5xx retryable, diğer 4xx non-retryable
    return err.httpStatus >= 500;
  }
  // EtsyTokenExpiredError, EtsyValidationError → non-retryable (kullanıcı action gerek)
  return false;
}

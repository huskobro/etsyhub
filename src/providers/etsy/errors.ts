import { AppError } from "@/lib/errors";

/**
 * Etsy provider error sınıfları — Task 4 + 11 foundation.
 *
 * `withErrorHandling` HOF AppError'ları otomatik HTTP'ye map eder.
 * Submit service ve endpoint bu sınıfları reuse eder.
 */

export class EtsyNotConfiguredError extends AppError {
  constructor() {
    super(
      "Etsy entegrasyonu yapılandırılmadı (ETSY_CLIENT_ID / ETSY_CLIENT_SECRET env yok). Sistem yöneticisinin .env'i tamamlaması gerek.",
      "ETSY_NOT_CONFIGURED",
      503,
    );
  }
}

export class EtsyConnectionNotFoundError extends AppError {
  constructor() {
    super(
      "Etsy hesabı bağlı değil. Settings → Etsy bağlantısı kurulmalı.",
      "ETSY_CONNECTION_NOT_FOUND",
      400,
    );
  }
}

export class EtsyTokenMissingError extends AppError {
  constructor() {
    super(
      "Etsy access token eksik. Yeniden bağlanmak gerek.",
      "ETSY_TOKEN_MISSING",
      400,
    );
  }
}

export class EtsyTokenExpiredError extends AppError {
  constructor() {
    super(
      "Etsy access token süresi doldu. Yeniden bağlanmak gerek.",
      "ETSY_TOKEN_EXPIRED",
      401,
    );
  }
}

/**
 * V1 foundation — provider impl tarafında atılır (HTTP error / API down).
 * Error classifier (Task 11) bu sınıfları altında retryable / non-retryable
 * sınıflandırır.
 */
export class EtsyApiError extends AppError {
  constructor(
    message: string,
    public readonly httpStatus: number,
    /** Etsy API tarafından dönen raw error code, varsa. */
    public readonly etsyErrorCode?: string,
  ) {
    super(`Etsy API hatası: ${message}`, "ETSY_API_ERROR", 502);
  }
}

export class EtsyRateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds?: number) {
    super(
      retryAfterSeconds
        ? `Etsy API rate limit. ${retryAfterSeconds} saniye sonra tekrar dene.`
        : "Etsy API rate limit aşıldı.",
      "ETSY_RATE_LIMIT",
      429,
    );
  }
}

export class EtsyValidationError extends AppError {
  constructor(message: string, public readonly etsyDetails?: unknown) {
    super(`Etsy validation: ${message}`, "ETSY_VALIDATION", 422, etsyDetails);
  }
}

export class EtsyNetworkError extends AppError {
  constructor(message: string) {
    super(`Etsy bağlantı hatası: ${message}`, "ETSY_NETWORK", 502);
  }
}

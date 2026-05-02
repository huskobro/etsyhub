// Phase 9 V1 Task 11 — Etsy error classifier unit tests.
// HTTP status → typed AppError mapping + retryable hint.

import { describe, it, expect } from "vitest";
import {
  classifyEtsyHttpError,
  classifyEtsyNetworkError,
  isRetryableEtsyError,
} from "@/providers/etsy/error-classifier";
import {
  EtsyApiError,
  EtsyNetworkError,
  EtsyRateLimitError,
  EtsyTokenExpiredError,
  EtsyValidationError,
} from "@/providers/etsy/errors";

describe("classifyEtsyHttpError", () => {
  it("401 → EtsyTokenExpiredError", () => {
    expect(() => classifyEtsyHttpError({ status: 401 })).toThrow(
      EtsyTokenExpiredError,
    );
  });

  it("403 → EtsyTokenExpiredError", () => {
    expect(() => classifyEtsyHttpError({ status: 403 })).toThrow(
      EtsyTokenExpiredError,
    );
  });

  it("422 + body → EtsyValidationError + details persist", () => {
    let caught: unknown;
    try {
      classifyEtsyHttpError({
        status: 422,
        body: { error: "invalid_payload", error_description: "title too long" },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyValidationError);
    const err = caught as EtsyValidationError;
    expect(err.message).toContain("title too long");
    // details (etsyDetails) body olarak persist edildi mi?
    expect(err.etsyDetails).toMatchObject({ error: "invalid_payload" });
  });

  it("429 + retry-after → EtsyRateLimitError, retryAfterSeconds doğru", () => {
    let caught: unknown;
    try {
      classifyEtsyHttpError({ status: 429, retryAfterSeconds: 60 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyRateLimitError);
    const err = caught as EtsyRateLimitError;
    expect(err.retryAfterSeconds).toBe(60);
  });

  it("500 → EtsyApiError + httpStatus 500", () => {
    let caught: unknown;
    try {
      classifyEtsyHttpError({ status: 500 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyApiError);
    const err = caught as EtsyApiError;
    expect(err.httpStatus).toBe(500);
  });

  it("400 → EtsyApiError + httpStatus 400 (non-retryable hint)", () => {
    let caught: unknown;
    try {
      classifyEtsyHttpError({ status: 400, body: { error: "bad_request" } });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyApiError);
    const err = caught as EtsyApiError;
    expect(err.httpStatus).toBe(400);
    expect(err.etsyErrorCode).toBe("bad_request");
    expect(isRetryableEtsyError(err)).toBe(false);
  });
});

describe("classifyEtsyNetworkError", () => {
  it("network error → EtsyNetworkError", () => {
    expect(() => classifyEtsyNetworkError(new Error("ECONNRESET"))).toThrow(
      EtsyNetworkError,
    );
  });

  it("non-Error input → EtsyNetworkError with stringified message", () => {
    let caught: unknown;
    try {
      classifyEtsyNetworkError("timeout");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyNetworkError);
    expect((caught as EtsyNetworkError).message).toContain("timeout");
  });
});

describe("isRetryableEtsyError", () => {
  it("EtsyRateLimitError → true", () => {
    expect(isRetryableEtsyError(new EtsyRateLimitError(30))).toBe(true);
  });

  it("EtsyNetworkError → true", () => {
    expect(isRetryableEtsyError(new EtsyNetworkError("ECONNRESET"))).toBe(true);
  });

  it("EtsyApiError 5xx → true", () => {
    expect(isRetryableEtsyError(new EtsyApiError("server error", 502))).toBe(
      true,
    );
    expect(isRetryableEtsyError(new EtsyApiError("server error", 500))).toBe(
      true,
    );
  });

  it("EtsyApiError 4xx → false", () => {
    expect(isRetryableEtsyError(new EtsyApiError("bad request", 400))).toBe(
      false,
    );
    expect(isRetryableEtsyError(new EtsyApiError("bad request", 404))).toBe(
      false,
    );
  });

  it("EtsyTokenExpiredError → false", () => {
    expect(isRetryableEtsyError(new EtsyTokenExpiredError())).toBe(false);
  });

  it("EtsyValidationError → false", () => {
    expect(isRetryableEtsyError(new EtsyValidationError("invalid"))).toBe(
      false,
    );
  });

  it("rastgele Error → false", () => {
    expect(isRetryableEtsyError(new Error("random"))).toBe(false);
  });
});

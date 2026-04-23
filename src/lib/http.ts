import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Bilinmeyen hata";
  logger.error({ err: message }, "unhandled API error");
  return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
}

export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

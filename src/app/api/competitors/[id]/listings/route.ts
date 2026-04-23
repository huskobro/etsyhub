import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { listCompetitorListingsQuery } from "@/features/competitors/schemas";
import { listCompetitorListings } from "@/features/competitors/services/competitor-service";
import { REVIEW_COUNT_DISCLAIMER } from "@/features/competitors/services/ranking-service";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listCompetitorListingsQuery.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }

  const { items, nextCursor } = await listCompetitorListings(
    user.id,
    ctx.params.id,
    parsed.data,
  );

  return NextResponse.json({
    items,
    nextCursor,
    window: parsed.data.window,
    disclaimer: REVIEW_COUNT_DISCLAIMER,
  });
});

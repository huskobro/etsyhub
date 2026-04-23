import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { fetchFeed } from "@/features/trend-stories/services/feed-service";
import { decodeListingCursor } from "@/features/trend-stories/services/listing-cursor";
import type { WindowDays } from "@/features/trend-stories/constants";

const querySchema = z.object({
  window: z.enum(["1", "7", "30"]).default("7"),
  cursor: z.string().optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  await assertTrendStoriesAvailable();
  const user = await requireUser();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }

  const cursor = decodeListingCursor(parsed.data.cursor ?? null);
  const result = await fetchFeed({
    userId: user.id,
    windowDays: Number(parsed.data.window) as WindowDays,
    cursor,
  });

  return NextResponse.json(result);
});

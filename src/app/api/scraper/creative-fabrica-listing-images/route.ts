/**
 * Phase 37 — Creative Fabrica listing → image picker endpoint.
 *
 * POST /api/scraper/creative-fabrica-listing-images
 * body: { url: string }
 *
 * Etsy endpoint pattern mirror (Phase 36): typed error codes,
 * 502 for upstream failures, structured error response.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  fetchCreativeFabricaListingImages,
  CreativeFabricaFetchBlockedError,
  CreativeFabricaFetchError,
} from "@/server/services/scraper/creative-fabrica-listing-images";

const body = z.object({ url: z.string().url() });

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser();
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid URL", parsed.error.flatten());
  }
  try {
    const result = await fetchCreativeFabricaListingImages(parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CreativeFabricaFetchBlockedError) {
      return NextResponse.json(
        {
          error:
            "Creative Fabrica is blocking server-side requests for this listing. Paste direct image URLs from the listing page instead.",
          code: "blocked",
          upstreamStatus: err.status,
        },
        { status: 502 },
      );
    }
    if (err instanceof CreativeFabricaFetchError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "fetch_failed",
          upstreamStatus: err.status ?? null,
        },
        { status: 502 },
      );
    }
    throw err;
  }
});

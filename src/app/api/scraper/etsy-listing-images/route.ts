/**
 * Phase 35 → Phase 36 — Etsy listing → image picker endpoint.
 *
 * POST /api/scraper/etsy-listing-images
 * body: { url: string }  // must be https://www.etsy.com/listing/{id}/...
 *
 * Response 200:
 *   { externalId, title, imageUrls, warnings }
 *
 * Response 400: invalid URL pattern (ValidationError)
 * Response 502: Etsy fetch failure
 *   - body: { error, code }
 *     - code "blocked" → Datadome WAF / bot block (Phase 36)
 *     - code "fetch_failed" → generic upstream failure
 *
 * Phase 36 — typed error codes added so UI can show actionable copy
 * (paste direct image URLs alternative) instead of generic error.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  fetchEtsyListingImages,
  EtsyFetchBlockedError,
  EtsyFetchError,
} from "@/server/services/scraper/etsy-listing-images";

const body = z.object({ url: z.string().url() });

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser();
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid URL", parsed.error.flatten());
  }
  try {
    const result = await fetchEtsyListingImages(parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EtsyFetchBlockedError) {
      return NextResponse.json(
        {
          error:
            "Etsy is blocking server-side requests for this listing. Paste direct image URLs from the listing page instead.",
          code: "blocked",
          upstreamStatus: err.status,
        },
        { status: 502 },
      );
    }
    if (err instanceof EtsyFetchError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "fetch_failed",
          upstreamStatus: err.status ?? null,
        },
        { status: 502 },
      );
    }
    throw err; // ValidationError or unknown → default handler
  }
});

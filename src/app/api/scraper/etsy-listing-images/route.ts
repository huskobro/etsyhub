/**
 * Phase 35 — Etsy listing → image picker endpoint.
 *
 * POST /api/scraper/etsy-listing-images
 * body: { url: string }  // must be https://www.etsy.com/listing/{id}/...
 *
 * Response 200:
 *   {
 *     externalId: string,
 *     title: string,
 *     imageUrls: string[],
 *     warnings: string[]
 *   }
 *
 * Response 400: invalid URL pattern (ValidationError)
 * Response 500: fetch/parse failure
 *
 * Auth: requireUser (operatör only — bu surface intake flow için)
 * Rate limit: yok (intake düşük frekanslı; ileride gerekirse eklenir)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { fetchEtsyListingImages } from "@/server/services/scraper/etsy-listing-images";

const body = z.object({ url: z.string().url() });

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser();
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid URL", parsed.error.flatten());
  }
  const result = await fetchEtsyListingImages(parsed.data.url);
  return NextResponse.json(result);
});

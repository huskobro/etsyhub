// Phase 9 V1 — Listing API Zod schemas (foundation slice).
//
// API endpoint validation. Foundation slice'ta sadece create + path schema;
// PATCH/AI meta/submit schemas sonraki task'larda eklenir.

import { z } from "zod";

/**
 * POST /api/listings/draft body — Spec §6.2.
 *
 * Sadece mockupJobId; metadata kullanıcı UI'dan girer (K2 lock: AI meta
 * manuel button, handoff'ta üretim YOK).
 */
export const CreateListingDraftSchema = z.object({
  mockupJobId: z.string().cuid(),
});

export type CreateListingDraftInput = z.infer<typeof CreateListingDraftSchema>;

/**
 * Path param: listing id (cuid).
 */
export const ListingDraftPathSchema = z.object({
  id: z.string().cuid(),
});

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

/**
 * PATCH /api/listings/draft/[id] body — Phase 9 V1 metadata update.
 *
 * Strict mode: bilinmeyen field'lar (productionPartner, isDigital, vb.)
 * 400 döner. K1 lock kapsamında foundation schema'da olmayan alanlar V1.1+'a.
 */
export const UpdateListingMetaSchema = z
  .object({
    title: z.string().min(5).max(140).optional(),
    description: z.string().min(1).optional(),
    tags: z.array(z.string().min(1).max(20)).max(13).optional(),
    category: z.string().min(1).max(64).optional(),
    priceCents: z.number().int().positive().optional(),
    materials: z.array(z.string().min(1).max(64)).max(13).optional(),
  })
  .strict();

export type UpdateListingMetaInput = z.infer<typeof UpdateListingMetaSchema>;

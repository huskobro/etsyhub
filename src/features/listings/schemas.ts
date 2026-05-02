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

/**
 * POST /api/listings/draft/[id]/generate-meta body — Phase 9 V1 Task 16.
 *
 * Tüm field'lar opsiyonel — service default'lar (productType="generic",
 * toneHint=null, providerId=DEFAULT). Strict mode: bilinmeyen field reject.
 */
export const GenerateListingMetaSchema = z
  .object({
    productType: z.string().min(1).max(64).optional(),
    toneHint: z.string().min(1).max(120).optional(),
  })
  .strict();

export type GenerateListingMetaInput = z.infer<typeof GenerateListingMetaSchema>;

/**
 * POST /api/listings/draft/[id]/submit body — Phase 9 V1 Task 17.
 *
 * V1 foundation: body boş; sadece path id'siyle çalışır. Strict mode.
 * V1.1+ carry-forward: dryRun, scheduleAt vb.
 */
export const SubmitListingDraftSchema = z.object({}).strict();

export type SubmitListingDraftInput = z.infer<typeof SubmitListingDraftSchema>;

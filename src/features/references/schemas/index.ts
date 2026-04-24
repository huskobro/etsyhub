import { z } from "zod";

export const createReferenceInput = z.object({
  assetId: z.string().min(1),
  productTypeId: z.string().min(1),
  bookmarkId: z.string().optional(),
  collectionId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  tagIds: z.array(z.string()).optional(),
});
export type CreateReferenceInput = z.infer<typeof createReferenceInput>;

export const updateReferenceInput = z.object({
  productTypeId: z.string().optional(),
  collectionId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});
export type UpdateReferenceInput = z.infer<typeof updateReferenceInput>;

export const promoteBookmarkInput = z.object({
  bookmarkId: z.string().min(1),
  productTypeId: z.string().min(1),
  collectionId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});
export type PromoteBookmarkInput = z.infer<typeof promoteBookmarkInput>;

export const listReferencesQuery = z.object({
  productTypeId: z.string().optional(),
  collectionId: z
    .union([z.literal("uncategorized"), z.string().cuid()])
    .optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  cursor: z.string().optional(),
});
export type ListReferencesQuery = z.infer<typeof listReferencesQuery>;

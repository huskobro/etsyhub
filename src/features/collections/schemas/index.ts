import { z } from "zod";

export const collectionKindEnum = z.enum(["BOOKMARK", "REFERENCE", "MIXED"]);

export const createCollectionInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  kind: collectionKindEnum.default("MIXED"),
});
export type CreateCollectionInput = z.infer<typeof createCollectionInput>;

export const updateCollectionInput = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  kind: collectionKindEnum.optional(),
});
export type UpdateCollectionInput = z.infer<typeof updateCollectionInput>;

export const listCollectionsQuery = z.object({
  kind: collectionKindEnum.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
});
export type ListCollectionsQuery = z.infer<typeof listCollectionsQuery>;

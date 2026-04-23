import { z } from "zod";

export const sourcePlatformEnum = z.enum([
  "ETSY",
  "AMAZON",
  "PINTEREST",
  "INSTAGRAM",
  "UPLOAD",
  "OTHER",
]);

export const bookmarkStatusEnum = z.enum([
  "INBOX",
  "REFERENCED",
  "ARCHIVED",
  "RISKY",
]);

export const riskLevelEnum = z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]);

export const createBookmarkInput = z.object({
  sourceUrl: z.string().url().optional(),
  sourcePlatform: sourcePlatformEnum.optional(),
  assetId: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  productTypeId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  tagIds: z.array(z.string().min(1)).optional(),
  trendClusterId: z.string().min(1).optional(),
});
export type CreateBookmarkInput = z.infer<typeof createBookmarkInput>;

export const updateBookmarkInput = createBookmarkInput.partial().extend({
  status: bookmarkStatusEnum.optional(),
  riskLevel: riskLevelEnum.optional(),
  collectionId: z.string().min(1).nullable().optional(),
});
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkInput>;

export const listBookmarksQuery = z.object({
  status: bookmarkStatusEnum.optional(),
  productTypeId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export type ListBookmarksQuery = z.infer<typeof listBookmarksQuery>;

import { z } from "zod";

export const addCompetitorInput = z.object({
  shopIdentifier: z.string().min(2).max(200),
  platform: z.enum(["ETSY", "AMAZON"]).default("ETSY"),
  autoScanEnabled: z.boolean().default(false),
});
export type AddCompetitorInput = z.infer<typeof addCompetitorInput>;

export const reviewWindowSchema = z.enum(["30d", "90d", "365d", "all"]).default("all");
export type ReviewWindow = z.infer<typeof reviewWindowSchema>;

export const listCompetitorsQuery = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export type ListCompetitorsQuery = z.infer<typeof listCompetitorsQuery>;

export const listCompetitorListingsQuery = z.object({
  window: reviewWindowSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export type ListCompetitorListingsQuery = z.infer<
  typeof listCompetitorListingsQuery
>;

export const triggerScanInput = z.object({
  type: z
    .enum(["INITIAL_FULL", "INCREMENTAL_NEW", "MANUAL_REFRESH"])
    .default("MANUAL_REFRESH"),
});
export type TriggerScanInput = z.infer<typeof triggerScanInput>;

import { z } from "zod";

export const addCompetitorInput = z.object({
  shopIdentifier: z.string().min(2).max(200),
  platform: z.enum(["ETSY", "AMAZON"]).default("ETSY"),
  autoScanEnabled: z.boolean().default(false),
});
export type AddCompetitorInput = z.infer<typeof addCompetitorInput>;

export const reviewWindowSchema = z.enum(["30d", "90d", "365d", "all"]).default("all");
export type ReviewWindow = z.infer<typeof reviewWindowSchema>;

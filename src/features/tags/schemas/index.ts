import { z } from "zod";
import { TAG_COLOR_KEYS } from "@/features/tags/color-map";

export const tagColorEnum = z.enum(TAG_COLOR_KEYS);

export const createTagInput = z.object({
  name: z.string().min(1).max(60),
  color: tagColorEnum.optional(),
});
export type CreateTagInput = z.infer<typeof createTagInput>;

export const updateTagInput = z.object({
  name: z.string().min(1).max(60).optional(),
  color: tagColorEnum.nullable().optional(),
});
export type UpdateTagInput = z.infer<typeof updateTagInput>;

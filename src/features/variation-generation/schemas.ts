// Phase 5 §4 — variation-generation paylaşılan zod schema'ları.
//
// `AspectRatioSchema` createN body validation + retry route'taki legacy
// row enum guard için tek truth. `as` cast yok; runtime'da geçersiz
// değerleri yakalar (R17.4 — sessiz fallback YOK).
import { z } from "zod";

export const AspectRatioSchema = z.enum([
  "1:1",
  "2:3",
  "3:2",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
]);

export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const QualitySchema = z.enum(["medium", "high"]);
export type Quality = z.infer<typeof QualitySchema>;

export const VARIATION_COUNT_MIN = 1;
export const VARIATION_COUNT_MAX = 6;
export const VARIATION_COUNT_DEFAULT = 3;

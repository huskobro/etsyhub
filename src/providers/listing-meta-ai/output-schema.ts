import { z } from "zod";

// Etsy listing constraints — title 5-140, description min 1 (V1 hedef ≥50),
// tags exactly 13 each ≤20 char.
export const ListingMetaOutputSchema = z.object({
  title: z.string().min(5).max(140),
  description: z.string().min(1),
  tags: z.array(z.string().min(1).max(20)).length(13),
});

// KIE strict JSON schema — chat/completions response_format json_schema strict.
export const LISTING_META_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 5, maxLength: 140 },
    description: { type: "string", minLength: 1 },
    tags: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 20 },
      minItems: 13,
      maxItems: 13,
    },
  },
  required: ["title", "description", "tags"],
  additionalProperties: false,
} as const;

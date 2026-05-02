import { describe, it, expect } from "vitest";
import { ListingMetaOutputSchema } from "@/providers/listing-meta-ai/output-schema";

/**
 * Phase 9 V1 Task 5 — Listing-meta output schema tests.
 *
 * Etsy constraints: title 5-140, description min 1, tags exactly 13 (each ≤20).
 */

const validTags = Array.from({ length: 13 }, (_, i) => `tag${i + 1}`);

const validOutput = {
  title: "Minimalist Boho Wall Art Print",
  description:
    "Beautiful wall art for any modern interior. Digital download in high resolution.",
  tags: validTags,
};

describe("ListingMetaOutputSchema (Phase 9 V1)", () => {
  it("valid output parse OK", () => {
    const result = ListingMetaOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("title <5 reddeder", () => {
    const bad = { ...validOutput, title: "abc" };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("title >140 reddeder", () => {
    const bad = { ...validOutput, title: "x".repeat(141) };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("tags.length 12 (eksik) reddeder", () => {
    const bad = { ...validOutput, tags: validTags.slice(0, 12) };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("tags.length 14 (fazla) reddeder", () => {
    const bad = { ...validOutput, tags: [...validTags, "extra"] };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("tag length >20 reddeder", () => {
    const longTag = "a".repeat(21);
    const bad = {
      ...validOutput,
      tags: [longTag, ...validTags.slice(1)],
    };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("empty description reddeder (min 1)", () => {
    const bad = { ...validOutput, description: "" };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("empty tag reddeder (min 1)", () => {
    const bad = {
      ...validOutput,
      tags: ["", ...validTags.slice(1)],
    };
    const result = ListingMetaOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

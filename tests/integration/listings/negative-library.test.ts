// Phase 9 V1 Task 12 — Negative library service tests.

import { describe, it, expect } from "vitest";
import {
  checkNegativeLibrary,
  BLOCKED_PHRASES,
} from "@/features/listings/server/negative-library.service";

describe("checkNegativeLibrary", () => {
  it("temiz içerik için boş array döner", () => {
    const matches = checkNegativeLibrary({
      title: "Modern Wall Art Print",
      description: "Beautiful canvas for your living room",
      tags: ["wall-art", "canvas", "modern"],
    });
    expect(matches).toEqual([]);
  });

  it("title'da trademark eşleşmesi tespit eder (Disney)", () => {
    const matches = checkNegativeLibrary({
      title: "Disney Style Wall Art",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      field: "title",
      phrase: "disney",
      reason: expect.stringContaining("Disney"),
    });
  });

  it("description'da policy eşleşmesi tespit eder (CBD)", () => {
    const matches = checkNegativeLibrary({
      description: "This product contains CBD oil",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.field).toBe("description");
    expect(matches[0]?.phrase).toBe("cbd");
  });

  it("tags array'inde spam eşleşmesi (best deal)", () => {
    const matches = checkNegativeLibrary({
      tags: ["best deal", "discount", "wall-art"],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.field).toBe("tags");
    expect(matches[0]?.phrase).toBe("best deal");
  });

  it("aynı phrase birden fazla field'da — her field için entry", () => {
    const matches = checkNegativeLibrary({
      title: "Marvel Hero Print",
      description: "Marvel themed canvas",
    });
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.field).sort()).toEqual(["description", "title"]);
  });

  it("case-insensitive: DISNEY vs disney aynı match", () => {
    const matches = checkNegativeLibrary({
      title: "DISNEY style art",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.phrase).toBe("disney");
  });

  it("aynı phrase tags'te birden fazla — tek entry (spam önle)", () => {
    const matches = checkNegativeLibrary({
      tags: ["disney one", "disney two", "disney three"],
    });
    const disneyMatches = matches.filter((m) => m.phrase === "disney");
    expect(disneyMatches).toHaveLength(1);
  });

  it("null/undefined input gracefully işle", () => {
    const matches = checkNegativeLibrary({
      title: null,
      description: undefined,
      tags: null,
    });
    expect(matches).toEqual([]);
  });

  it("BLOCKED_PHRASES en az 10 madde içerir (V1 curated minimum)", () => {
    expect(BLOCKED_PHRASES.length).toBeGreaterThanOrEqual(10);
  });

  it("BLOCKED_PHRASES her madde category union'a uyar", () => {
    const validCategories = ["trademark", "policy", "spam", "gibberish"];
    for (const blocked of BLOCKED_PHRASES) {
      expect(validCategories).toContain(blocked.category);
    }
  });

  it("multi-field eşleşmeleri title/description/tags'tan ayrı saymaz", () => {
    const matches = checkNegativeLibrary({
      title: "Nike canvas",
      description: "Nike inspired art",
      tags: ["nike", "logo"],
    });
    // Nike title'da + description'da + tags'te = 3 entry
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.field).sort()).toEqual([
      "description",
      "tags",
      "title",
    ]);
  });

  it("substring match: 'disney' → 'disneyland' eşleşir", () => {
    const matches = checkNegativeLibrary({
      title: "Disneyland inspired art",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.phrase).toBe("disney");
  });
});

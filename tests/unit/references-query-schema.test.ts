import { describe, it, expect } from "vitest";
import { listReferencesQuery } from "@/features/references/schemas";

describe("listReferencesQuery.collectionId", () => {
  it("accepts 'uncategorized' sentinel", () => {
    const result = listReferencesQuery.safeParse({ collectionId: "uncategorized" });
    expect(result.success).toBe(true);
  });

  it("accepts valid cuid", () => {
    const result = listReferencesQuery.safeParse({
      collectionId: "cksnbp3sf0000abcdzxvmn123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects random non-cuid string", () => {
    const result = listReferencesQuery.safeParse({ collectionId: "hello-world" });
    expect(result.success).toBe(false);
  });

  it("accepts undefined (omitted)", () => {
    const result = listReferencesQuery.safeParse({});
    expect(result.success).toBe(true);
  });
});

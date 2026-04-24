import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    reference: { findMany: vi.fn() },
  },
}));

import { db } from "@/server/db";
import { listReferences } from "@/features/references/services/reference-service";

describe("listReferences — collectionId sentinel", () => {
  beforeEach(() => {
    vi.mocked(db.reference.findMany).mockReset();
    vi.mocked(db.reference.findMany).mockResolvedValue([]);
  });

  it("undefined → where.collectionId omitted", async () => {
    await listReferences({ userId: "u1", query: { limit: 60 } });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0]!;
    expect(call.where).not.toHaveProperty("collectionId");
  });

  it("'uncategorized' → where.collectionId = null", async () => {
    await listReferences({
      userId: "u1",
      query: { limit: 60, collectionId: "uncategorized" },
    });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0]!;
    expect(call.where!.collectionId).toBeNull();
  });

  it("cuid → where.collectionId = <cuid>", async () => {
    await listReferences({
      userId: "u1",
      query: { limit: 60, collectionId: "cksnbp3sf0000abcdzxvmn123" },
    });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0]!;
    expect(call.where!.collectionId).toBe("cksnbp3sf0000abcdzxvmn123");
  });
});

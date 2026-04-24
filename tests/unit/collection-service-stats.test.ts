import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    collection: { findMany: vi.fn() },
    reference: { count: vi.fn() },
  },
}));

import { db } from "@/server/db";
import { listCollectionsWithStats } from "@/features/collections/services/collection-service";

describe("listCollectionsWithStats", () => {
  beforeEach(() => {
    vi.mocked(db.collection.findMany).mockReset();
    vi.mocked(db.reference.count).mockReset();
    vi.mocked(db.collection.findMany).mockResolvedValue([]);
  });

  it("counts uncategorizedReferenceCount with collectionId: null", async () => {
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    const firstCountCall = vi.mocked(db.reference.count).mock.calls[0]![0]!;
    expect(firstCountCall.where).toMatchObject({
      userId: "u1",
      deletedAt: null,
      collectionId: null,
    });
  });

  it("counts orphanedReferenceCount with collection.deletedAt not null", async () => {
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    const secondCountCall = vi.mocked(db.reference.count).mock.calls[1]![0]!;
    expect(secondCountCall.where).toMatchObject({
      userId: "u1",
      deletedAt: null,
      collectionId: { not: null },
      collection: { deletedAt: { not: null } },
    });
  });

  it("returns items + both aggregate counts", async () => {
    vi.mocked(db.collection.findMany).mockResolvedValue([
      { id: "c1", name: "A", _count: { bookmarks: 0, references: 3 } } as never,
    ]);
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);

    const result = await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.uncategorizedReferenceCount).toBe(4);
    expect(result.orphanedReferenceCount).toBe(2);
  });

  it("aggregate counts ignore kind and q filters", async () => {
    vi.mocked(db.reference.count).mockResolvedValue(0);

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60, kind: "REFERENCE", q: "search" },
    });

    const firstCountCall = vi.mocked(db.reference.count).mock.calls[0]![0]!;
    expect(firstCountCall.where).not.toHaveProperty("kind");
    expect(firstCountCall.where).not.toHaveProperty("q");
  });
});

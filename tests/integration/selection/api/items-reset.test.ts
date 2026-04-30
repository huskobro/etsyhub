// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/reset
//
// Reset endpoint sözleşmesi (design Section 4.5, 7.2; plan Task 22):
//   - Auth: requireUser
//   - body: yok / boş
//   - Success: 200 + { item } (editedAssetId=null, lastUndoableAssetId=null,
//     editHistoryJson=[])
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user → 404
//   - Unauthenticated → 401

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/services/selection/edit.service", () => ({
  applyEdit: vi.fn(),
  applyEditAsync: vi.fn(),
  undoEdit: vi.fn(),
  resetItem: vi.fn(),
}));

import { POST } from "@/app/api/selection/sets/[setId]/items/[itemId]/reset/route";
import { requireUser } from "@/server/session";
import { resetItem } from "@/server/services/selection/edit.service";
import { NotFoundError, SetReadOnlyError } from "@/lib/errors";

function makeRequest(setId: string, itemId: string): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/${itemId}/reset`,
    { method: "POST" },
  );
}

beforeEach(() => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(resetItem).mockReset();
});

describe("POST /api/selection/sets/[setId]/items/[itemId]/reset", () => {
  it("happy path → 200 + { item }; service'e ownership args geçer", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(resetItem).mockResolvedValue({
      id: "item-1",
      editedAssetId: null,
      lastUndoableAssetId: null,
      editHistoryJson: [],
    } as never);

    const res = await POST(makeRequest("set-1", "item-1"), {
      params: { setId: "set-1", itemId: "item-1" },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.editedAssetId).toBeNull();
    expect(data.item.lastUndoableAssetId).toBeNull();
    expect(data.item.editHistoryJson).toEqual([]);

    expect(resetItem).toHaveBeenCalledWith({
      userId: "user-a",
      setId: "set-1",
      itemId: "item-1",
    });
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(resetItem).mockRejectedValue(new SetReadOnlyError());

    const res = await POST(makeRequest("set-1", "item-1"), {
      params: { setId: "set-1", itemId: "item-1" },
    });

    expect(res.status).toBe(409);
  });

  it("cross-user → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-b" });
    vi.mocked(resetItem).mockRejectedValue(new NotFoundError());

    const res = await POST(makeRequest("set-1", "item-1"), {
      params: { setId: "set-1", itemId: "item-1" },
    });

    expect(res.status).toBe(404);
  });

  it("unauthenticated → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeRequest("set-1", "item-1"), {
      params: { setId: "set-1", itemId: "item-1" },
    });

    expect(res.status).toBe(401);
  });
});

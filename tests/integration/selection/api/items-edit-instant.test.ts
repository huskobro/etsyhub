// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/edit
//
// Instant edit endpoint sözleşmesi (design Section 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - body: EditOpInputSchema discriminated union
//       { op: "crop", params: { ratio } } | { op: "transparent-check" }
//       | { op: "background-remove" }    ← bu route'ta REJECT (heavy op)
//   - Success: 200 + { item } (güncel SelectionItem)
//   - background-remove → 400 ("/edit/heavy kullan")
//   - Invalid op / crop without params → 400
//   - Ready set → 409 (SetReadOnlyError; service layer)
//   - Cross-user → 404
//   - Unauthenticated → 401
//
// Route layer test'i: applyEdit service'i mock'lanır (service zaten ayrı
// test edildi — edit.service.test.ts). Route layer'ın zod parse, error
// mapping ve service çağrı parametrelerini doğru ilettiğini doğrularız.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/services/selection/edit.service", () => ({
  applyEdit: vi.fn(),
  applyEditAsync: vi.fn(),
  undoEdit: vi.fn(),
  resetItem: vi.fn(),
}));

import { POST } from "@/app/api/selection/sets/[setId]/items/[itemId]/edit/route";
import { requireUser } from "@/server/session";
import { applyEdit } from "@/server/services/selection/edit.service";
import { NotFoundError, SetReadOnlyError } from "@/lib/errors";

function makeRequest(setId: string, itemId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/${itemId}/edit`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

beforeEach(() => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(applyEdit).mockReset();
});

describe("POST /api/selection/sets/[setId]/items/[itemId]/edit (instant)", () => {
  it("crop op → 200 + { item }; service'e doğru parametre geçer", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    const fakeItem = {
      id: "item-1",
      editedAssetId: "asset-edited",
      lastUndoableAssetId: null,
    };
    vi.mocked(applyEdit).mockResolvedValue(fakeItem as never);

    const res = await POST(
      makeRequest("set-1", "item-1", {
        op: "crop",
        params: { ratio: "2:3" },
      }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.id).toBe("item-1");

    expect(applyEdit).toHaveBeenCalledWith({
      userId: "user-a",
      setId: "set-1",
      itemId: "item-1",
      op: { op: "crop", params: { ratio: "2:3" } },
    });
  });

  it("transparent-check → 200; service'e doğru op geçer", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(applyEdit).mockResolvedValue({ id: "item-1" } as never);

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "transparent-check" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(200);
    expect(applyEdit).toHaveBeenCalledWith({
      userId: "user-a",
      setId: "set-1",
      itemId: "item-1",
      op: { op: "transparent-check" },
    });
  });

  it("background-remove → 400 (heavy op route'ta reject; /edit/heavy mesajı)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "background-remove" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(JSON.stringify(data)).toMatch(/heavy/i);
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("invalid op (bilinmeyen) → 400 (zod reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "color-shift" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(400);
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("crop without params → 400 (zod discriminated union failure)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "crop" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(400);
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("ready set → 409 (SetReadOnlyError service'ten gelir)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(applyEdit).mockRejectedValue(new SetReadOnlyError());

    const res = await POST(
      makeRequest("set-1", "item-1", {
        op: "crop",
        params: { ratio: "1:1" },
      }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(409);
  });

  it("cross-user → 404 (NotFoundError service'ten gelir)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-b" });
    vi.mocked(applyEdit).mockRejectedValue(new NotFoundError());

    const res = await POST(
      makeRequest("set-1", "item-1", {
        op: "crop",
        params: { ratio: "1:1" },
      }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(404);
  });

  it("unauthenticated → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(
      makeRequest("set-1", "item-1", {
        op: "crop",
        params: { ratio: "1:1" },
      }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(401);
  });
});

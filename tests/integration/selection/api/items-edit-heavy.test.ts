// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy
//
// Heavy edit endpoint sözleşmesi (design Section 5.1, 7.2; plan Task 22):
//   - Auth: requireUser
//   - body: { op: "background-remove" } (literal — schema reject diğerleri)
//   - Success: 200 + { jobId } (BullMQ enqueue + DB-side lock)
//   - Wrong op (instant) → 400
//   - Ready set → 409 (SetReadOnlyError)
//   - Paralel heavy lock → 409 (ConcurrentEditError)
//   - Cross-user → 404
//   - Unauthenticated → 401
//
// Route layer test'i: applyEditAsync mock'lanır.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/services/selection/edit.service", () => ({
  applyEdit: vi.fn(),
  applyEditAsync: vi.fn(),
  undoEdit: vi.fn(),
  resetItem: vi.fn(),
}));

import { POST } from "@/app/api/selection/sets/[setId]/items/[itemId]/edit/heavy/route";
import { requireUser } from "@/server/session";
import { applyEditAsync } from "@/server/services/selection/edit.service";
import {
  ConcurrentEditError,
  NotFoundError,
  SetReadOnlyError,
} from "@/lib/errors";

function makeRequest(setId: string, itemId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/${itemId}/edit/heavy`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

beforeEach(() => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(applyEditAsync).mockReset();
});

describe("POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy", () => {
  it("background-remove → 200 + { jobId }; service'e doğru parametre geçer", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(applyEditAsync).mockResolvedValue({ jobId: "job-bg-1" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "background-remove" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobId).toBe("job-bg-1");

    expect(applyEditAsync).toHaveBeenCalledWith({
      userId: "user-a",
      setId: "set-1",
      itemId: "item-1",
      op: { op: "background-remove" },
    });
  });

  it("instant op (crop) → 400 (zod heavy schema reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "crop", params: { ratio: "1:1" } }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(400);
    expect(applyEditAsync).not.toHaveBeenCalled();
  });

  it("transparent-check op → 400 (zod heavy schema reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "transparent-check" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(400);
    expect(applyEditAsync).not.toHaveBeenCalled();
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(applyEditAsync).mockRejectedValue(new SetReadOnlyError());

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "background-remove" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(409);
  });

  it("paralel heavy lock → 409 (ConcurrentEditError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-a" });
    vi.mocked(applyEditAsync).mockRejectedValue(new ConcurrentEditError());

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "background-remove" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("CONCURRENT_EDIT");
  });

  it("cross-user → 404 (NotFoundError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-b" });
    vi.mocked(applyEditAsync).mockRejectedValue(new NotFoundError());

    const res = await POST(
      makeRequest("set-1", "item-1", { op: "background-remove" }),
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
      makeRequest("set-1", "item-1", { op: "background-remove" }),
      { params: { setId: "set-1", itemId: "item-1" } },
    );

    expect(res.status).toBe(401);
  });
});

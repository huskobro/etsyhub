// Phase 6 Task 10 — POST /api/review/local-batch integration testleri.
//
// Sözleşme:
//   - Auth: requireUser mock'lanır.
//   - Body Zod: assetIds (cuid array, min 1, max 100), productTypeKey (min 1).
//   - productTypeKey ZORUNLU — gelmezse 400 (Karar 1).
//   - Duplicate id'ler de-duplicate edilir + skippedDuplicates raporlanır
//     (Karar 3).
//   - Sadece ownership PASS + soft-delete edilmemiş asset'ler kabul.
//   - Per-asset enqueue try/catch — bir asset fail'i diğerlerini durdurmaz.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { JobType } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

const enqueueMock = vi.fn();
vi.mock("@/server/queue", async () => {
  const actual = await vi.importActual<typeof import("@/server/queue")>(
    "@/server/queue",
  );
  return {
    ...actual,
    enqueue: (...args: unknown[]) => enqueueMock(...args),
  };
});

import { POST } from "@/app/api/review/local-batch/route";
import { requireUser } from "@/server/session";

const USER_A = "rev-batch-user-a";
const USER_B = "rev-batch-user-b";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/review/local-batch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureUser(id: string, email: string) {
  await db.user.upsert({
    where: { id },
    update: {},
    create: { id, email, passwordHash: "x" },
  });
}

async function makeAsset(
  userId: string,
  overrides?: Partial<{
    isUserDeleted: boolean;
    deletedAt: Date | null;
  }>,
): Promise<string> {
  const uniq = `${Date.now()}-${Math.random()}`;
  const asset = await db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: "/p",
      fileName: `f-${uniq}.png`,
      filePath: `/p/f-${uniq}.png`,
      hash: `rev-batch-${uniq}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 1,
      height: 1,
      isUserDeleted: overrides?.isUserDeleted ?? false,
      deletedAt: overrides?.deletedAt ?? null,
    },
  });
  return asset.id;
}

beforeEach(async () => {
  enqueueMock.mockReset();
  enqueueMock.mockResolvedValue({ id: "fake-id" });
  (requireUser as ReturnType<typeof vi.fn>).mockReset();

  await db.localLibraryAsset.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await ensureUser(USER_A, "rev-batch-a@test.local");
  await ensureUser(USER_B, "rev-batch-b@test.local");
});

describe("POST /api/review/local-batch", () => {
  it("body'de productTypeKey eksik ⇒ 400 (Karar 1: zorunlu, sessiz default yok)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const assetId = await makeAsset(USER_A);
    const res = await POST(makeRequest({ assetIds: [assetId] }));
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("body'de productTypeKey boş string ⇒ 400 (min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const assetId = await makeAsset(USER_A);
    const res = await POST(
      makeRequest({ assetIds: [assetId], productTypeKey: "" }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("assetIds boş array ⇒ 400 (min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await POST(
      makeRequest({ assetIds: [], productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("assetIds > 100 ⇒ 400 (max(100))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    // 101 fake cuid (cuid format'ı: c + 24 alphanumeric)
    const fakeIds = Array.from(
      { length: 101 },
      (_, i) => `c${i.toString().padStart(24, "0")}`,
    );
    const res = await POST(
      makeRequest({ assetIds: fakeIds, productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("assetIds bozuk format (cuid değil) ⇒ 400", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await POST(
      makeRequest({ assetIds: ["not-a-cuid"], productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("happy path: 3 unique owned asset ⇒ 3 REVIEW_DESIGN enqueue + enqueueSucceeded=3", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const ids = await Promise.all([
      makeAsset(USER_A),
      makeAsset(USER_A),
      makeAsset(USER_A),
    ]);

    const res = await POST(
      makeRequest({ assetIds: ids, productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requested).toBe(3);
    expect(data.enqueueSucceeded).toBe(3);
    expect(data.skippedDuplicates).toBe(0);
    expect(data.skippedNotFound).toBe(0);
    expect(data.enqueueErrors).toBe(0);

    expect(enqueueMock).toHaveBeenCalledTimes(3);
    for (const call of enqueueMock.mock.calls) {
      expect(call[0]).toBe(JobType.REVIEW_DESIGN);
      const payload = call[1] as Record<string, unknown>;
      expect(payload.scope).toBe("local");
      expect(payload.userId).toBe(USER_A);
      expect(payload.productTypeKey).toBe("wall_art");
      expect(typeof payload.localAssetId).toBe("string");
    }
  });

  it("duplicate id'ler dedup edilir + skippedDuplicates raporlanır (Karar 3)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const ids = await Promise.all([makeAsset(USER_A), makeAsset(USER_A)]);
    const dup = [ids[0]!, ids[0]!, ids[1]!]; // 2 unique, 1 duplicate
    const res = await POST(
      makeRequest({ assetIds: dup, productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requested).toBe(3);
    expect(data.enqueueSucceeded).toBe(2);
    expect(data.skippedDuplicates).toBe(1);
    expect(data.skippedNotFound).toBe(0);
    expect(enqueueMock).toHaveBeenCalledTimes(2);
  });

  it("başka kullanıcının asset'i ⇒ skippedNotFound, enqueue olmaz", async () => {
    const otherUserAssetIds = await Promise.all([
      makeAsset(USER_B),
      makeAsset(USER_B),
    ]);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await POST(
      makeRequest({
        assetIds: otherUserAssetIds,
        productTypeKey: "wall_art",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requested).toBe(2);
    expect(data.enqueueSucceeded).toBe(0);
    expect(data.skippedNotFound).toBe(2);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("soft-delete edilmiş asset (isUserDeleted=true) ⇒ skippedNotFound", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const liveId = await makeAsset(USER_A);
    const deletedId = await makeAsset(USER_A, { isUserDeleted: true });
    const res = await POST(
      makeRequest({
        assetIds: [liveId, deletedId],
        productTypeKey: "wall_art",
      }),
    );
    const data = await res.json();
    expect(data.requested).toBe(2);
    expect(data.enqueueSucceeded).toBe(1);
    expect(data.skippedNotFound).toBe(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("deletedAt set edilmiş asset ⇒ skippedNotFound", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const liveId = await makeAsset(USER_A);
    const deletedId = await makeAsset(USER_A, { deletedAt: new Date() });
    const res = await POST(
      makeRequest({
        assetIds: [liveId, deletedId],
        productTypeKey: "wall_art",
      }),
    );
    const data = await res.json();
    expect(data.enqueueSucceeded).toBe(1);
    expect(data.skippedNotFound).toBe(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("transparent productTypeKey (clipart) payload'da aynı şekilde geçer", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const id = await makeAsset(USER_A);
    const res = await POST(
      makeRequest({ assetIds: [id], productTypeKey: "clipart" }),
    );
    expect(res.status).toBe(200);
    expect(enqueueMock).toHaveBeenCalledWith(
      JobType.REVIEW_DESIGN,
      expect.objectContaining({
        scope: "local",
        localAssetId: id,
        userId: USER_A,
        productTypeKey: "clipart",
      }),
    );
  });

  it("bir asset'in enqueue'i fail ⇒ diğerleri çağrılır + enqueueErrors raporlanır", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const ids = await Promise.all([
      makeAsset(USER_A),
      makeAsset(USER_A),
      makeAsset(USER_A),
    ]);

    let callCount = 0;
    enqueueMock.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 2) throw new Error("redis down for asset 2");
      return { id: `ok-${callCount}` };
    });

    const res = await POST(
      makeRequest({ assetIds: ids, productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requested).toBe(3);
    expect(data.enqueueSucceeded).toBe(2);
    expect(data.enqueueErrors).toBe(1);
    expect(data.skippedNotFound).toBe(0);
    expect(enqueueMock).toHaveBeenCalledTimes(3); // hepsi dene-dendi
  });

  it("auth eksik ⇒ requireUser throw ⇒ 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(
      makeRequest({ assetIds: ["cabcdefghijklmnopqrstuvwx"], productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(401);
  });
});

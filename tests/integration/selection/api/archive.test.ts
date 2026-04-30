// Phase 7 Task 22 — POST /api/selection/sets/[setId]/archive
//
// Archive endpoint sözleşmesi (design Section 4.3, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body: BOŞ zorunlu (ArchiveInputSchema .strict())
//   - Success: 200 + { set } (status="archived", archivedAt set)
//   - draft → archived: 200
//   - ready → archived: 200
//   - already archived → 409 (InvalidStateTransitionError)
//   - Cross-user → 404
//   - Unauthenticated → 401

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/archive/route";
import { requireUser } from "@/server/session";

let userAId: string;
let userBId: string;

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

function makeRequest(setId: string, body?: unknown): Request {
  return new Request(`http://localhost/api/selection/sets/${setId}/archive`, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-archive-a@etsyhub.local");
  const b = await ensureUser("phase7-api-archive-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("POST /api/selection/sets/[setId]/archive", () => {
  it("draft → archived: 200; archivedAt set", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "ArDraft", status: "draft" },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.set.status).toBe("archived");
    expect(data.set.archivedAt).toBeTruthy();

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("archived");
    expect(row!.archivedAt).not.toBeNull();
  });

  it("ready → archived: 200", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "ArReady",
        status: "ready",
        finalizedAt: new Date(),
      },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(200);

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("archived");
  });

  it("already archived → 409 (InvalidStateTransitionError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "ArAlready",
        status: "archived",
        archivedAt: new Date(),
      },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("cross-user setId → 404", async () => {
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "ArX", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(404);

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("draft");
  });

  it("unauthenticated → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeRequest("any-set", {}), {
      params: { setId: "any-set" },
    });
    expect(res.status).toBe(401);
  });
});

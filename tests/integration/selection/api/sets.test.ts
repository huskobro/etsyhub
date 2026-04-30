// Phase 7 Task 18 — GET + POST /api/selection/sets integration testleri.
//
// Sözleşmeler (design Section 7.2; plan Task 18):
//   - GET /api/selection/sets[?status=draft|ready|archived]
//       Auth: requireUser; user.id ile listSets çağırır
//       status filter opsiyonel; verilmezse tüm statüler
//       cross-user izolasyon: User A'nın seti User B sorgusunda yok
//       updatedAt desc sort (service kontratı)
//       invalid status (foobar) → 400 (zod enum reject)
//       unauthenticated → 401
//   - POST /api/selection/sets
//       body: { name } (zod CreateSelectionSetInputSchema; trim sonrası non-empty)
//       Auth: requireUser; user.id ile createSet
//       success: 201 + { set } payload (DB'de oluşur, status `draft`)
//       boş name → 400; whitespace-only name → 400 (zod trim().min(1))
//       unauthenticated → 401
//
// Phase 6 paterni: requireUser vi.mock; Request standartı; safeParse + throw
// ValidationError (errors.ts → http.ts mapping ile 400).

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { GET, POST } from "@/app/api/selection/sets/route";
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

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/selection/sets", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: userIds } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-sets-a@etsyhub.local");
  const b = await ensureUser("phase7-api-sets-b@etsyhub.local");
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

// =============================================================================
// GET /api/selection/sets — list
// =============================================================================

describe("GET /api/selection/sets — list", () => {
  it("filter yoksa kullanıcının tüm setleri döner (draft + ready + archived)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    await db.selectionSet.create({
      data: { userId: userAId, name: "A draft", status: "draft" },
    });
    await db.selectionSet.create({
      data: { userId: userAId, name: "A ready", status: "ready" },
    });
    await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "A archived",
        status: "archived",
        archivedAt: new Date(),
      },
    });

    const res = await GET(makeGetRequest("http://localhost/api/selection/sets"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sets)).toBe(true);
    expect(data.sets).toHaveLength(3);
    const names = data.sets.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual(["A archived", "A draft", "A ready"]);
  });

  it("status=draft → yalnız draft setleri", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    await db.selectionSet.create({
      data: { userId: userAId, name: "Draft 1", status: "draft" },
    });
    await db.selectionSet.create({
      data: { userId: userAId, name: "Ready 1", status: "ready" },
    });

    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets?status=draft"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0].name).toBe("Draft 1");
    expect(data.sets[0].status).toBe("draft");
  });

  it("status=ready → yalnız ready setleri", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    await db.selectionSet.create({
      data: { userId: userAId, name: "Draft 1", status: "draft" },
    });
    await db.selectionSet.create({
      data: { userId: userAId, name: "Ready 1", status: "ready" },
    });
    await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "Archived 1",
        status: "archived",
        archivedAt: new Date(),
      },
    });

    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets?status=ready"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0].status).toBe("ready");
    expect(data.sets[0].name).toBe("Ready 1");
  });

  it("status=archived → yalnız archived setleri", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    await db.selectionSet.create({
      data: { userId: userAId, name: "Draft 1", status: "draft" },
    });
    await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "Archived 1",
        status: "archived",
        archivedAt: new Date(),
      },
    });

    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets?status=archived"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0].status).toBe("archived");
  });

  it("cross-user filter: User A setleri User B sorgusunda yok", async () => {
    await db.selectionSet.create({
      data: { userId: userAId, name: "A's set", status: "draft" },
    });
    await db.selectionSet.create({
      data: { userId: userBId, name: "B's set", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await GET(makeGetRequest("http://localhost/api/selection/sets"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0].name).toBe("B's set");
    expect(data.sets[0].userId).toBe(userBId);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await GET(makeGetRequest("http://localhost/api/selection/sets"));
    expect(res.status).toBe(401);
  });

  it("invalid status (foobar) → 400 (zod enum reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets?status=foobar"),
    );
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// POST /api/selection/sets — create
// =============================================================================

describe("POST /api/selection/sets — create", () => {
  it("valid name → 201; DB'de set oluşur, status draft", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const res = await POST(makePostRequest({ name: "Yeni Boho Set" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.set).toBeDefined();
    expect(data.set.name).toBe("Yeni Boho Set");
    expect(data.set.status).toBe("draft");
    expect(data.set.userId).toBe(userAId);

    const row = await db.selectionSet.findUnique({ where: { id: data.set.id } });
    expect(row).not.toBeNull();
    expect(row!.name).toBe("Yeni Boho Set");
    expect(row!.status).toBe("draft");
  });

  it("boş name → 400 (zod trim().min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const res = await POST(makePostRequest({ name: "" }));
    expect(res.status).toBe(400);

    const setsCount = await db.selectionSet.count({ where: { userId: userAId } });
    expect(setsCount).toBe(0);
  });

  it("whitespace-only name → 400 (zod trim().min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const res = await POST(makePostRequest({ name: "   " }));
    expect(res.status).toBe(400);

    const setsCount = await db.selectionSet.count({ where: { userId: userAId } });
    expect(setsCount).toBe(0);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(makePostRequest({ name: "Set" }));
    expect(res.status).toBe(401);
  });
});

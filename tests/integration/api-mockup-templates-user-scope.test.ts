// Phase 64 — User-scope mockup template catalog tests.
//
// Senaryolar:
//   - 401 unauthenticated
//   - User1 görür: global (userId NULL) + own (userId = User1) merge
//   - User1 GÖRMEZ: User2'nin template'leri (cross-user isolation)
//   - scope=global → only userId NULL
//   - scope=own → only userId == currentUser
//   - ownership field projected ("global" | "own")
//   - status default ACTIVE (DRAFT items hidden by default)

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserStatus,
  MockupTemplateStatus,
} from "@prisma/client";
import { db } from "@/server/db";

const currentUser: {
  id: string | null;
  role: UserRole;
  email: string | null;
} = { id: null, role: UserRole.USER, email: null };

vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return {
      id: currentUser.id,
      email: currentUser.email!,
      role: currentUser.role,
    };
  }),
}));

import { GET } from "@/app/api/mockup-templates/route";

let user1Id: string;
let user2Id: string;

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("test-pw", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

async function cleanup() {
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: "[Phase64-test]" } },
  });
}

const CATEGORY = "canvas";

beforeAll(async () => {
  const u1 = await ensureUser("phase64-user-scope-1@etsyhub.local");
  const u2 = await ensureUser("phase64-user-scope-2@etsyhub.local");
  user1Id = u1.id;
  user2Id = u2.id;
});

beforeEach(async () => {
  await cleanup();
  currentUser.id = null;
});

afterAll(async () => {
  await cleanup();
});

function setAuth(uid: string, email: string) {
  currentUser.id = uid;
  currentUser.role = UserRole.USER;
  currentUser.email = email;
}

async function seedTemplate(args: {
  name: string;
  userId: string | null;
  status?: MockupTemplateStatus;
}) {
  return db.mockupTemplate.create({
    data: {
      categoryId: CATEGORY,
      name: args.name,
      thumbKey: `phase64-tests/${args.name}.png`,
      aspectRatios: ["1:1"],
      tags: [],
      estimatedRenderMs: 1000,
      userId: args.userId,
      status: args.status ?? MockupTemplateStatus.ACTIVE,
    },
  });
}

describe("GET /api/mockup-templates (user-scope)", () => {
  it("401 unauthenticated", async () => {
    const res = await GET(new Request("http://localhost/api/mockup-templates"));
    expect(res.status).toBe(401);
  });

  it("returns global (userId NULL) + own merged; cross-user isolation enforced", async () => {
    await seedTemplate({ name: "[Phase64-test] global-A", userId: null });
    await seedTemplate({ name: "[Phase64-test] global-B", userId: null });
    await seedTemplate({
      name: "[Phase64-test] user1-private",
      userId: user1Id,
    });
    await seedTemplate({
      name: "[Phase64-test] user2-private",
      userId: user2Id, // User1 SHOULD NOT see this
    });

    setAuth(user1Id, "phase64-user-scope-1@etsyhub.local");
    const res = await GET(new Request("http://localhost/api/mockup-templates"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ name: string; ownership: "global" | "own" }>;
    };
    const names = body.items.map((i) => i.name);
    // User1 sees: 2 globals + own; NOT user2's
    expect(names).toContain("[Phase64-test] global-A");
    expect(names).toContain("[Phase64-test] global-B");
    expect(names).toContain("[Phase64-test] user1-private");
    expect(names).not.toContain("[Phase64-test] user2-private");

    // Ownership field projected correctly
    const own = body.items.find((i) => i.name === "[Phase64-test] user1-private");
    expect(own?.ownership).toBe("own");
    const glob = body.items.find((i) => i.name === "[Phase64-test] global-A");
    expect(glob?.ownership).toBe("global");
  });

  it("scope=global filters to userId NULL only", async () => {
    await seedTemplate({ name: "[Phase64-test] global-only", userId: null });
    await seedTemplate({
      name: "[Phase64-test] user1-only",
      userId: user1Id,
    });
    setAuth(user1Id, "phase64-user-scope-1@etsyhub.local");
    const res = await GET(
      new Request("http://localhost/api/mockup-templates?scope=global"),
    );
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("[Phase64-test] global-only");
    expect(names).not.toContain("[Phase64-test] user1-only");
  });

  it("scope=own filters to currentUser's templates only", async () => {
    await seedTemplate({ name: "[Phase64-test] global-skip", userId: null });
    await seedTemplate({ name: "[Phase64-test] mine", userId: user1Id });
    await seedTemplate({
      name: "[Phase64-test] not-mine",
      userId: user2Id,
    });
    setAuth(user1Id, "phase64-user-scope-1@etsyhub.local");
    const res = await GET(
      new Request("http://localhost/api/mockup-templates?scope=own"),
    );
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("[Phase64-test] mine");
    expect(names).not.toContain("[Phase64-test] global-skip");
    expect(names).not.toContain("[Phase64-test] not-mine");
  });

  it("default status filter hides DRAFT/ARCHIVED templates", async () => {
    await seedTemplate({
      name: "[Phase64-test] active-visible",
      userId: null,
      status: MockupTemplateStatus.ACTIVE,
    });
    await seedTemplate({
      name: "[Phase64-test] draft-hidden",
      userId: null,
      status: MockupTemplateStatus.DRAFT,
    });
    setAuth(user1Id, "phase64-user-scope-1@etsyhub.local");
    const res = await GET(new Request("http://localhost/api/mockup-templates"));
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("[Phase64-test] active-visible");
    expect(names).not.toContain("[Phase64-test] draft-hidden");
  });

  it("respects categoryId filter", async () => {
    await seedTemplate({ name: "[Phase64-test] cat-A", userId: null });
    // Create template with different category (manual)
    await db.mockupTemplate.create({
      data: {
        categoryId: "wall_art", // different from CATEGORY="canvas"
        name: "[Phase64-test] cat-B",
        thumbKey: "phase64-tests/cat-B.png",
        aspectRatios: ["1:1"],
        tags: [],
        estimatedRenderMs: 1000,
        status: MockupTemplateStatus.ACTIVE,
      },
    });
    setAuth(user1Id, "phase64-user-scope-1@etsyhub.local");
    const res = await GET(
      new Request(
        `http://localhost/api/mockup-templates?categoryId=${CATEGORY}`,
      ),
    );
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("[Phase64-test] cat-A");
    expect(names).not.toContain("[Phase64-test] cat-B");
  });
});
